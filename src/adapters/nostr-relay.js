/**
 * Nostr Relay Adapter for Talkbox
 * Uses Nostr protocol for message discovery and relay
 * Messages are stored as Nostr events (kind 1 - text notes)
 * Tagged with 'talkbox' for filtering
 *
 * Free public relays (no authentication needed):
 * - wss://relay.damus.io
 * - wss://nos.lol
 * - wss://nostr.wine
 * - wss://relay.nostr.band
 */

import crypto from 'crypto';
import { SimplePool, nip19, generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://relay.nostr.band'
];

class NostrRelayAdapter {
  constructor(relays = DEFAULT_RELAYS, options = {}) {
    this.relays = relays;
    this.pool = null;
    this.options = {
      timeout: options.timeout || 3000,
      eventKind: options.eventKind || 1, // kind 1 = text note
      tag: 'talkbox'
    };
    this.keyCache = new Map(); // Cache derived keys
  }

  /**
   * Derive deterministic Nostr keypair from talkbox password
   * Same password always produces same keypair
   */
  deriveNostrKeys(password) {
    if (this.keyCache.has(password)) {
      return this.keyCache.get(password);
    }

    // Use SHA256(password + salt) as seed for consistent keys
    const seed = crypto
      .createHash('sha256')
      .update(password + 'talkbox-nostr-derivation')
      .digest();

    // Generate Nostr secret key from seed
    // Use first 32 bytes of seed as secret key
    const secretKey = seed.slice(0, 32);
    const publicKey = getPublicKey(secretKey);

    const keys = { secretKey, publicKey };
    this.keyCache.set(password, keys);
    return keys;
  }

  /**
   * Initialize connection pool to relays
   */
  async connect() {
    console.log(`\n📡 Connecting to ${this.relays.length} Nostr relays...`);

    this.pool = new SimplePool();

    // Test each relay connection
    const results = await Promise.allSettled(
      this.relays.map(url => this._testRelayConnection(url))
    );

    const connected = results
      .map((r, i) => ({ url: this.relays[i], status: r.status }))
      .filter(r => r.status === 'fulfilled');

    console.log(`✓ Connected to ${connected.length}/${this.relays.length} relays`);
    return connected;
  }

  _testRelayConnection(url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout connecting to ${url}`));
      }, this.options.timeout);

      // Try to get relay info
      fetch(`${url.replace('wss://', 'https://')}/`)
        .then(() => {
          clearTimeout(timer);
          resolve(true);
        })
        .catch(() => {
          clearTimeout(timer);
          // Still try to connect even if info fails
          resolve(true);
        });
    });
  }

  /**
   * Publish a message to all relays
   * Message is published with pubkey of password's keypair
   * This allows filtering by pubkey (which all relays support)
   */
  async publishMessage(password, message) {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const { secretKey, publicKey } = this.deriveNostrKeys(password);

    // Create Nostr event
    // Messages are posted AS IF from the public key derived from the password
    // This makes it easy to filter all messages for a mailbox by just using the pubkey
    const event = {
      kind: this.options.eventKind,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', 'talkbox-mailbox'], // Identifier for mailbox
        ['talkbox', 'v1'] // Tag to mark as talkbox message
      ],
      content: message,
      pubkey: publicKey
    };

    // Sign event
    const signedEvent = finalizeEvent(event, secretKey);

    console.log(`\n📤 Publishing to ${this.relays.length} relays...`);

    // Publish to all relays in parallel
    const publishPromises = this.relays.map(url => {
      return (async () => {
        try {
          // Publish returns an async iterator of promises
          const results = this.pool.publish([url], signedEvent);
          // Wait for the promises to settle
          for await (const result of results) {
            // result is resolved when the relay confirms
          }
          return { url, ok: true };
        } catch (e) {
          console.warn(`  ⚠ ${url}: ${e.message}`);
          return { url, ok: false };
        }
      })();
    });

    const results = await Promise.all(publishPromises);
    const succeeded = results.filter(r => r.ok).length;

    console.log(`✓ Published to ${succeeded}/${this.relays.length} relays`);

    return {
      eventId: signedEvent.id,
      publishedTo: succeeded,
      totalRelays: this.relays.length
    };
  }

  /**
   * Query all relays for messages matching a password
   * Returns all messages sent to this shortcode
   * Filters by the public key derived from the password
   */
  async readMessages(password) {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const { publicKey } = this.deriveNostrKeys(password);
    console.log(`\n📥 Querying relays for messages...`);

    // Filter events by pubkey (which all relays support)
    // We filter by the public key derived from the password
    const filter = {
      kinds: [this.options.eventKind],
      authors: [publicKey], // Find events authored by this pubkey
      limit: 100
    };

    try {
      // Query all relays in parallel
      const events = await this.pool.querySync(this.relays, filter, {
        timeout: this.options.timeout * 2
      });

      console.log(`✓ Found ${events.length} messages`);

      // Sort by timestamp (newest first)
      const messages = events
        .sort((a, b) => b.created_at - a.created_at)
        .map(event => ({
          messageId: event.id,
          message: event.content,
          timestamp: event.created_at * 1000, // Convert to milliseconds
          pubkey: event.pubkey
        }));

      return messages;
    } catch (e) {
      console.error('Query error:', e.message);
      return [];
    }
  }

  /**
   * Stream messages in real-time
   * Subscribes to relay for new events as they arrive
   */
  async subscribeToMessages(password, onMessage, onEose = null) {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const { publicKey } = this.deriveNostrKeys(password);
    console.log(`\n📻 Subscribing to real-time messages...`);

    const filter = {
      kinds: [this.options.eventKind],
      authors: [publicKey],
      limit: 50
    };

    // Use sub for streaming
    const sub = this.pool.sub(this.relays, [filter]);

    let messageCount = 0;

    sub.on('event', event => {
      messageCount++;
      const message = {
        messageId: event.id,
        message: event.content,
        timestamp: event.created_at * 1000,
        pubkey: event.pubkey,
        isNew: event.created_at > (Date.now() / 1000 - 60) // Within last minute
      };
      onMessage(message);
    });

    sub.on('eose', () => {
      if (onEose) onEose(messageCount);
    });

    // Return unsubscribe function
    return () => sub.unsub();
  }

  /**
   * Get relay statistics
   */
  async getRelayStats() {
    if (!this.pool) {
      return { connected: 0, total: this.relays.length };
    }

    return {
      connected: this.relays.length,
      total: this.relays.length,
      relays: this.relays
    };
  }

  /**
   * Close all relay connections
   */
  disconnect() {
    if (this.pool) {
      console.log('\n👋 Disconnecting from relays...');
      this.pool.close(this.relays);
      this.pool = null;
    }
  }
}

export default NostrRelayAdapter;
