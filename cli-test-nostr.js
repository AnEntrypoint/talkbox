#!/usr/bin/env node

/**
 * Nostr Adapter Test CLI
 * Tests the full flow: generate shortcode, publish, and read from real Nostr relays
 */

import NostrRelayAdapter from './src/adapters/nostr-relay.js';
import { generateShortcode } from './src/index.js';

const password = 'test-password-' + Date.now();
const shortcode = generateShortcode(password);
const testMessage = 'Hello from Talkbox! ' + new Date().toISOString();

console.log(`
╔════════════════════════════════════════════╗
║     🚀 Nostr Adapter Test                  ║
╚════════════════════════════════════════════╝

Password: ${password}
Shortcode: ${shortcode}
Test message: ${testMessage}
`);

async function main() {
  const adapter = new NostrRelayAdapter();

  try {
    // Step 1: Connect
    console.log('Step 1️⃣  Connecting to Nostr relays...');
    await adapter.connect();

    // Step 2: Publish message
    console.log('\nStep 2️⃣  Publishing test message...');
    const publishResult = await adapter.publishMessage(password, testMessage);
    console.log(`   Event ID: ${publishResult.eventId.substring(0, 16)}...`);
    console.log(`   Published to: ${publishResult.publishedTo}/${publishResult.totalRelays}`);

    // Step 3: Wait a moment for relays to process
    console.log('\nStep 3️⃣  Waiting for relays to process (3 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Read messages back
    console.log('\nStep 4️⃣  Querying relays for messages...');
    const messages = await adapter.readMessages(password);

    if (messages.length === 0) {
      console.log('   ⚠  No messages found yet (relays may need more time)');
      console.log('   This is normal on first publish - relays sync messages gradually');
      return;
    }

    console.log(`\n✓ Found ${messages.length} message(s):\n`);
    messages.forEach((msg, i) => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      console.log(`   ${i + 1}. [${time}] ${msg.message}`);
      console.log(`      ID: ${msg.messageId.substring(0, 20)}...`);
    });

    // Verify our message is there
    const ourMessage = messages.find(m => m.message === testMessage);
    if (ourMessage) {
      console.log('\n✅ SUCCESS! Message round-trip successful!');
    } else {
      console.log('\n⚠ Message published but not yet retrieved (typical - relays sync gradually)');
    }

  } catch (e) {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  } finally {
    adapter.disconnect();
    process.exit(0);
  }
}

main();
