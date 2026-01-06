import { SimplePool, finalizeEvent, getPublicKey, nip44 } from 'nostr-tools';

const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://nostr.wine',
    'wss://relay.nostr.band',
    'wss://nostr-pub.wellorder.net',
    'wss://relay.snort.social',
    'wss://nostr.mom',
    'wss://relay.current.fyi'
];

const PREFIX_SALT = 'talkbox-comments-v1';

class Talkbox {
    constructor(options = {}) {
        this.relays = options.relays || DEFAULT_RELAYS;
        this.pool = new SimplePool();
        this.senderSeedKey = 'talkbox_lib_sender_seed';
        this.url = options.url || (typeof window !== 'undefined' ? (window.location.origin + window.location.pathname) : null);
        this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this.useTopicKeyAsSender = options.useTopicKeyAsSender || false;

        if (!this.url && !this.useTopicKeyAsSender) {
            console.warn('Talkbox: No URL provided and window.location is unavailable.');
        }
    }

    async _getCrypto() {
        if (typeof crypto !== 'undefined') return crypto;
        if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;

        try {
            const nodeCrypto = await import('node:crypto');
            return nodeCrypto.webcrypto;
        } catch (e) {
            throw new Error('Talkbox: Web Crypto API not found');
        }
    }

    async _getDigest(data) {
        const cryptoObj = await this._getCrypto();
        const encoder = new TextEncoder();
        const hashBuffer = await cryptoObj.subtle.digest('SHA-256', encoder.encode(data));
        return new Uint8Array(hashBuffer);
    }

    async _getRandomValues(arr) {
        const cryptoObj = await this._getCrypto();
        return cryptoObj.getRandomValues(arr);
    }

    async _deriveTopicKeys() {
        if (this._cachedTopicKeys) return this._cachedTopicKeys;
        if (!this.url) throw new Error('Talkbox: URL is required for deriving topic keys');

        const input = this.url + PREFIX_SALT;
        const secret = await this._getDigest(input);
        const pubkey = getPublicKey(secret);

        this._cachedTopicKeys = { secret, pubkey, url: this.url };
        return this._cachedTopicKeys;
    }

    async _getSenderIdentity() {
        if (this._cachedSenderIdentity) return this._cachedSenderIdentity;
        if (this.useTopicKeyAsSender) {
            const { secret, pubkey } = await this._deriveTopicKeys();
            this._cachedSenderIdentity = { secret, pubkey };
            return this._cachedSenderIdentity;
        }

        let seed = this.storage ? this.storage.getItem(this.senderSeedKey) : null;
        if (!seed) {
            const arr = new Uint8Array(32);
            await this._getRandomValues(arr);
            seed = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            if (this.storage) this.storage.setItem(this.senderSeedKey, seed);
        }

        const input = seed + 'talkbox-sender-identity';
        const secret = await this._getDigest(input);
        const pubkey = getPublicKey(secret);

        this._cachedSenderIdentity = { secret, pubkey };
        return this._cachedSenderIdentity;
    }

    async post(content, options = {}) {
        const { pubkey: topicPubkey, url } = await this._deriveTopicKeys();
        const sender = await this._getSenderIdentity();

        let finalContent = content;
        if (options.encrypt) {
            // Self-encrypt or encrypt to topic?
            // For a shared terminal, they both use the same password -> same topic key.
            // We can use the topic secret to encrypt/decrypt.
            const { secret: topicSecret } = await this._deriveTopicKeys();
            const conversationKey = nip44.getConversationKey(topicSecret, topicPubkey);
            finalContent = nip44.encrypt(content, conversationKey);
        }

        const tags = [
            ['p', topicPubkey]
        ];

        if (url) tags.push(['r', url]);
        if (options.client) tags.push(['client', options.client]);
        if (options.encrypt) tags.push(['encrypted', 'nip44']);

        const kind = options.kind || 20000;
        // Nostr Convention: Kind 20000-29999 are ephemeral and not stored by relays
        if (kind < 20000) {
            console.warn(`Talkbox: Using non-ephemeral kind ${kind}. Secure communication should use 20000-29999.`);
        }

        const event = finalizeEvent({
            kind: kind,
            created_at: Math.floor(Date.now() / 1000),
            tags: tags,
            content: finalContent,
            pubkey: sender.pubkey
        }, sender.secret);

        try {
            const pubs = this.pool.publish(this.relays, event);
            // In nostr-tools v2, publish returns an array of Pub objects.
            // We wait for at least one to succeed.
            await Promise.any(pubs.map(p => new Promise((resolve, reject) => {
                if (p && typeof p.then === 'function') {
                    p.then(resolve).catch(reject);
                } else if (p && p.done && typeof p.done.then === 'function') {
                    p.done.then(resolve).catch(reject);
                } else {
                    resolve();
                }
            })));
            return true;
        } catch (e) {
            // console.warn('Publish failed to all relays', e.message);
            return false;
        }
    }

    // Legacy method name
    async postComment(text, options = {}) {
        return this.post(text, options);
    }

    async getComments(limit = 100) {
        const { pubkey: topicPubkey } = await this._deriveTopicKeys();

        const filter = {
            kinds: [20000],
            '#p': [topicPubkey],
            since: Math.floor(Date.now() / 1000) - 3600 // Real-time context (+/- 1hr)
        };

        let events = await this.pool.querySync(this.relays, filter);

        return events.sort((a, b) => b.created_at - a.created_at).map(e => ({
            id: e.id,
            pubkey: e.pubkey,
            content: e.content,
            created_at: e.created_at,
            date: new Date(e.created_at * 1000)
        }));
    }

    async subscribe(callback, options = {}) {
        const { pubkey: topicPubkey, secret: topicSecret } = await this._deriveTopicKeys();

        const filter = {
            kinds: options.kinds || [20000],
            '#p': [topicPubkey]
        };

        if (options.limit > 0) {
            filter.limit = options.limit;
        }

        if (options.since) {
            filter.since = options.since;
        }

        const conversationKey = options.decrypt ? nip44.getConversationKey(topicSecret, topicPubkey) : null;

        const sub = this.pool.subscribeMany(this.relays, filter, {
            onevent(event) {
                let content = event.content;
                if (options.decrypt && event.tags.some(t => t[0] === 'encrypted' && t[1] === 'nip44')) {
                    try {
                        content = nip44.decrypt(content, conversationKey);
                    } catch (e) {
                        console.warn('Failed to decrypt event', event.id, e);
                    }
                }

                callback({
                    id: event.id,
                    pubkey: event.pubkey,
                    content: content,
                    created_at: event.created_at,
                    date: new Date(event.created_at * 1000),
                    event: event
                });
            },
            oneose() {
                // End of stored events
            }
        });

        return sub;
    }

    close() {
        this.pool.close(this.relays);
    }
}

if (typeof window !== 'undefined') {
    window.Talkbox = Talkbox;
}

export default Talkbox;
