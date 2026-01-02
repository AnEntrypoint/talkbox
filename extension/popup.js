console.log('Talkbox Extension - Ported Logic');

const RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://nostr.wine',
    'wss://relay.nostr.band',
    'wss://nostr-pub.wellorder.net',
    'wss://relay.snort.social',
    'wss://nostr.mom',
    'wss://relay.current.fyi'
];

let GLOBAL_CREDS = null;
let ACTIVE_SUBSCRIPTION = null;
let SEEN_EVENT_IDS = new Set();
let SUBSCRIPTION_POOL = null;
let GROUP_DEBOUNCE_TIMER = null;

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupEventListeners();
    initFromCurrentTab();

    // Cleanup subscriptions when popup closes
    window.addEventListener('beforeunload', () => {
        if (ACTIVE_SUBSCRIPTION) {
            ACTIVE_SUBSCRIPTION.close();
        }
        if (SUBSCRIPTION_POOL) {
            SUBSCRIPTION_POOL.close(RELAYS);
        }
    });
});

function setupEventListeners() {
    document.getElementById('btn-send-message').addEventListener('click', sendMessage);
    document.getElementById('btn-popout').addEventListener('click', openPopout);
    const groupInput = document.getElementById('private-group-input');
    if (groupInput) {
        groupInput.addEventListener('input', () => {
            clearTimeout(GROUP_DEBOUNCE_TIMER);
            GROUP_DEBOUNCE_TIMER = setTimeout(() => {
                readMessages();
                updateInfoText();
            }, 800);
        });
        groupInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(GROUP_DEBOUNCE_TIMER);
                readMessages();
                updateInfoText();
            }
        });
    }
}

async function initFromCurrentTab() {
    try {
        if (chrome && chrome.tabs) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                const creds = getCredentialsFromUrl(tab.url);
                if (creds.password) {
                    GLOBAL_CREDS = creds;
                    updateUIWithContext(creds);
                    // Immediately trigger read
                    readMessages();
                } else {
                    showNoContextError();
                }
            } else {
                showNoContextError();
            }
        }
    } catch (e) {
        console.error('Error auto-setting up:', e);
        showResult('read-result', 'Error accessing browser tab: ' + e.message, 'error');
    }
}

function updateUIWithContext(creds) {
    // Fill Private Group from found prefix
    if (creds.prefix) {
        document.getElementById('private-group-input').value = creds.prefix;
    }

    updateInfoText();

    // Switch to Read tab by default for "immediate read"
    document.getElementById('tab-read').click();
}

function updateInfoText() {
    const group = document.getElementById('private-group-input').value.trim();
    const threadInfo = group ? `Private Group: <strong>${escapeHtml(group)}</strong>` : 'Main Thread';
    const sendInfo = document.getElementById('send-info');
    if (sendInfo) sendInfo.innerHTML = `Posting to ${threadInfo}`;
}

function showNoContextError() {
    const msg = '<div class="result error" style="margin:0"><strong>No Talkbox URL found.</strong><br>Navigate to a Talkbox URL (with ?secret=...) to use this extension.</div>';
    document.getElementById('send-info').innerHTML = msg;
    document.getElementById('read-result').innerHTML = msg;
    document.getElementById('btn-send-message').disabled = true;
}

function setupTabs() {
    const tabs = ['send', 'read'];
    tabs.forEach(tab => {
        document.getElementById(`tab-${tab}`).addEventListener('click', () => {
            // Deactivate all
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Activate clicked
            document.getElementById(`tab-${tab}`).classList.add('active');
            document.getElementById(`content-${tab}`).classList.add('active');
        });
    });
}

// setupEventListeners replaced in logic block above, removing redundant block if it overlaps, 
// but wait, I defined `setupEventListeners` inside the previous block replacement.
// The previous block REPLACED lines 15..58. 
// Lines 59-77 were NOT replaced. 
// Wait, I am using multi_replace.
// I need to be careful not to leave duplicate functions.
// I will REPLACE 74-77 as well with empty string since I defined it above?
// NO, I defined `setupEventListeners` in the first chunk.
// I should remove the old definition.


// Logic from index.html

function toBase32(bytes) {
    return base32.encode(bytes).replace(/=/g, '');
}

function fromBase32(str) {
    return new Uint8Array(base32.decode.asBytes(str));
}

function generateVisualGrid(bytes, compact = true) {
    // Visual grid generation for the UI
    const html = [];
    for (let i = 0; i < (compact ? 8 : 32); i++) {
        for (let j = 0; j < 8; j++) {
            const bit = (bytes[i] >> (7 - j)) & 1;
            html.push(`<div class="pixel" style="background: ${bit ? '#007bff' : '#f0f0f0'}; width: 4px; height: 4px; display: inline-block;"></div>`);
        }
    }
    return html.join(''); // Simplified for popup without specific CSS for grid yet, but keeping logic
}

async function generateShortcodeFromPassword(password, prefix = '') {
    if (!password) return { hex: '', base58: '', visual: '', qr: null };
    if (!window.nostrTools) {
        console.error('nostr-tools not loaded');
        return { hex: '', base58: '', visual: '', qr: null };
    }

    // Derive Nostr Ed25519 public key from password + prefix
    const encoder = new TextEncoder();
    // Include prefix in derivation input if present
    const derivationInput = password + (prefix || '') + 'talkbox-nostr-derivation';
    const data = encoder.encode(derivationInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const seed = new Uint8Array(hashBuffer);
    const secretKey = seed.slice(0, 32);
    const publicKey = window.nostrTools.getPublicKey(secretKey);

    const shortcode = toBase32(secretKey);
    // Skipped visual grid implementation detail for brevity in popup unless needed

    return { hex: publicKey, base58: shortcode, bytes: secretKey };
}

async function deriveSecret(password) {
    // This function seems unused in new logic or used by generateShortcodeFromPassword logic duplication?
    // Actually used for Sender Identity logic which uses random seed.
    // We keep it as is for sender identity, OR we update it to match.
    // Sender identity doesn't use prefix, it's global identity.
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'talkbox-nostr-derivation');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer).slice(0, 32);
}

// Helper: Extract password AND prefix from URL
function getCredentialsFromUrl(urlOrPassword) {
    let password = urlOrPassword;
    let prefix = '';

    if (!urlOrPassword) return { password: '', prefix: '' };

    try {
        const url = new URL(urlOrPassword);
        const secret = url.searchParams.get('secret') || url.searchParams.get('code');
        const p = url.searchParams.get('prefix');
        if (secret) {
            password = secret;
            if (p) prefix = p;
            return { password, prefix };
        }
    } catch (e) {
        // Not a URL
    }
    return { password, prefix };
}

// Stable Sender Identity
async function getSenderIdentity() {
    let seed = localStorage.getItem('talkbox_sender_seed');
    if (!seed) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        seed = toBase32(array); // Store as string for easy localstorage
        localStorage.setItem('talkbox_sender_seed', seed);
    }

    // Derive keypair from this seed
    const secret = await deriveSecret(seed);
    const pubkey = window.nostrTools.getPublicKey(secret);
    return { secret, pubkey };
}

// Blacklist Logic
function getBlacklist() {
    const s = localStorage.getItem('talkbox_blacklist');
    return s ? JSON.parse(s) : [];
}

function addToBlacklist(pubkey) {
    const list = getBlacklist();
    if (!list.includes(pubkey)) {
        list.push(pubkey);
        localStorage.setItem('talkbox_blacklist', JSON.stringify(list));
    }
}

// Send Message
async function sendMessage() {
    if (!GLOBAL_CREDS) {
        showResult('send-result', 'No context found. Navigate to a Talkbox URL.', 'error');
        return;
    }

    const message = document.getElementById('send-message').value;

    if (!message) {
        showResult('send-result', 'Please enter a message', 'error');
        return;
    }

    try {
        showResult('send-result', 'Publishing...', 'success');

        const pool = new window.nostrTools.SimplePool();
        const sender = await getSenderIdentity();

        // Derive recipient from GLOBAL_CREDS + Private Group Input
        const group = document.getElementById('private-group-input').value.trim();
        const derived = await generateShortcodeFromPassword(GLOBAL_CREDS.password, group);
        const recipientPubkey = derived.hex;

        if (!recipientPubkey) {
            showResult('send-result', 'Invalid context', 'error');
            return;
        }

        const event = window.nostrTools.finalizeEvent({
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', recipientPubkey]],
            content: message,
            pubkey: sender.pubkey
        }, sender.secret);

        const publishPromises = RELAYS.map(async r => {
            try {
                const pubs = pool.publish([r], event);
                let published = false;
                for await (const pub of pubs) {
                    published = true;
                }
                return published;
            } catch (e) {
                console.error('Publish error:', e);
                return false;
            }
        });

        await Promise.all(publishPromises);
        await new Promise(r => setTimeout(r, 500));
        pool.close(RELAYS);

        document.getElementById('send-message').value = '';
        showResult('send-result', '✓ Sent!', 'success');

        // Auto-refresh read if on that thread
        readMessages();

    } catch (e) {
        showResult('send-result', 'Error: ' + e.message, 'error');
    }
}

// Read Messages
async function readMessages() {
    if (!GLOBAL_CREDS) {
        showResult('read-result', 'No context.', 'error');
        return;
    }

    try {
        const group = document.getElementById('private-group-input').value.trim();
        const result = await generateShortcodeFromPassword(GLOBAL_CREDS.password, group);
        const shortcode = result.hex; // PUBKEY

        // Close existing subscription if any
        if (ACTIVE_SUBSCRIPTION) {
            ACTIVE_SUBSCRIPTION.close();
            ACTIVE_SUBSCRIPTION = null;
        }

        // Initialize persistent pool if needed
        if (!SUBSCRIPTION_POOL) {
            SUBSCRIPTION_POOL = new window.nostrTools.SimplePool();
        }

        const filter = {
            kinds: [1],
            '#p': [shortcode],
            limit: 100
        };

        // Clear seen IDs when switching groups
        SEEN_EVENT_IDS.clear();

        // Show loading state
        showResult('read-result', 'Connecting...', 'success');

        // Create subscription with initial query + real-time updates
        ACTIVE_SUBSCRIPTION = SUBSCRIPTION_POOL.subscribe(RELAYS, filter, {
            onevent: (event) => {
                handleNewMessage(event);
            },
            oneose: () => {
                updateLiveIndicator(true);
            }
        });

    } catch (e) {
        showResult('read-result', 'Error: ' + e.message, 'error');
        updateLiveIndicator(false);
    }
}

function showResult(elementId, message, type) {
    const resultDiv = document.getElementById(elementId);
    resultDiv.innerHTML = `<div class="result ${type}"><h3>${type === 'error' ? '⚠' : '✓'}</h3>${message}</div>`;
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

async function openPopout() {
    if (chrome && chrome.windows) {
        chrome.windows.create({
            url: chrome.runtime.getURL('popup.html'),
            type: 'popup',
            width: 400,
            height: 600,
            focused: true
        });
    }
}

function handleNewMessage(event) {
    if (SEEN_EVENT_IDS.has(event.id)) {
        return;
    }
    SEEN_EVENT_IDS.add(event.id);

    const blacklist = getBlacklist();
    if (blacklist.includes(event.pubkey)) {
        return;
    }

    const message = {
        message: event.content,
        timestamp: event.created_at * 1000,
        pubkey: event.pubkey,
        id: event.id
    };

    appendMessageToUI(message);
}

function appendMessageToUI(msg) {
    const container = document.getElementById('read-result');

    if (!container.querySelector('.message-list')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'result success';
        const h3 = document.createElement('h3');
        h3.innerHTML = '📨 Messages <span id="live-indicator" style="font-size: 11px; margin-left: 8px;">🟢 Live</span>';
        wrapper.appendChild(h3);

        const messageList = document.createElement('div');
        messageList.className = 'message-list';
        wrapper.appendChild(messageList);

        container.innerHTML = '';
        container.appendChild(wrapper);
    }

    const messageList = container.querySelector('.message-list');
    const time = new Date(msg.timestamp).toLocaleString();

    const item = document.createElement('div');
    item.className = 'message-item';
    item.dataset.eventId = msg.id;

    const text = document.createElement('div');
    text.className = 'message-text';
    text.innerText = msg.message;

    const meta = document.createElement('div');
    meta.className = 'message-time';
    meta.innerText = time;

    const blockBtn = document.createElement('button');
    blockBtn.className = 'small block-btn';
    blockBtn.innerText = '🚫 Block Sender';
    blockBtn.style.background = '#dc3545';
    blockBtn.style.marginTop = '8px';
    blockBtn.onclick = () => {
        if (confirm('Block this sender? You wont see messages from them again.')) {
            addToBlacklist(msg.pubkey);
            item.remove();
            updateMessageCount();
        }
    };

    item.appendChild(text);
    item.appendChild(meta);
    item.appendChild(blockBtn);

    messageList.insertBefore(item, messageList.firstChild);
    updateMessageCount();
}

function updateLiveIndicator(isLive) {
    const indicator = document.getElementById('live-indicator');
    if (indicator) {
        indicator.innerHTML = isLive ? '🟢 Live' : '🔴 Offline';
    }
}

function updateMessageCount() {
    const messageList = document.querySelector('.message-list');
    if (messageList) {
        const count = messageList.querySelectorAll('.message-item').length;
        const h3 = document.querySelector('#read-result h3');
        if (h3) {
            const indicator = document.getElementById('live-indicator');
            if (indicator) {
                h3.innerHTML = `📨 Messages (${count}) <span id="live-indicator" style="font-size: 11px; margin-left: 8px;">${indicator.innerHTML}</span>`;
            } else {
                h3.innerHTML = `📨 Messages (${count})`;
            }
        }
    }
}
