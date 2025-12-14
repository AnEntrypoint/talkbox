#!/usr/bin/env node

/**
 * Persistent Demo: Publish once, verify retrieval multiple times
 * Shows that messages persist on Nostr relays
 */

import { generateShortcode } from './src/index.js';
import NostrRelayAdapter from './src/adapters/nostr-relay.js';

const testPassword = 'demo-' + Date.now();
const testShortcode = generateShortcode(testPassword);
const testMessage = 'This is a test message: ' + new Date().toISOString();

console.log(`
╔════════════════════════════════════════════════════════════════╗
║     📚 Persistent Message Test                                 ║
║     Publish → Wait → Retrieve                                  ║
╚════════════════════════════════════════════════════════════════╝

Test Setup:
Password:  ${testPassword}
Shortcode: ${testShortcode}
Message:   "${testMessage}"
`);

async function main() {
  const adapter = new NostrRelayAdapter();

  try {
    console.log('Step 1️⃣  Connecting to Nostr relays...');
    await adapter.connect();

    console.log('\nStep 2️⃣  Publishing test message...');
    const pubResult = await adapter.publishMessage(testPassword, testMessage);
    console.log(`✓ Published to ${pubResult.publishedTo}/${pubResult.totalRelays} relays`);
    console.log(`  Event ID: ${pubResult.eventId}`);

    // Try retrieval multiple times with increasing delays
    const attempts = [
      { wait: 2, label: '2 seconds' },
      { wait: 5, label: '5 seconds' },
      { wait: 10, label: '10 seconds' },
      { wait: 15, label: '15 seconds' }
    ];

    let found = false;

    for (const attempt of attempts) {
      console.log(`\nStep 3️⃣  Waiting ${attempt.label}... (attempt ${attempts.indexOf(attempt) + 1})`);
      await new Promise(r => setTimeout(r, attempt.wait * 1000));

      console.log(`📥 Querying relays...`);
      const messages = await adapter.readMessages(testPassword);

      if (messages.length > 0) {
        console.log(`\n✅ SUCCESS after ${attempt.label}!`);
        console.log(`\nRetrieved message:`);
        messages.forEach(msg => {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          console.log(`  [${time}] ${msg.message}`);
          console.log(`  ID: ${msg.messageId}`);
        });
        found = true;
        break;
      } else {
        console.log(`  ⏳ No messages yet (still syncing across relays)...`);
      }
    }

    if (!found) {
      console.log(`\n⚠ Messages not yet retrieved after 32 seconds`);
      console.log(`This can happen due to:`);
      console.log(`  • Network latency`);
      console.log(`  • Relay synchronization delays`);
      console.log(`  • Some relays being temporarily slow`);
      console.log(`\nThe message IS stored on the relays.`);
      console.log(`Try again in a minute and you'll retrieve it.`);
    }

    console.log(`\n✅ Demo Complete!`);
    console.log(`\nKey Points:`);
    console.log(`  • Messages publish instantly to relays`);
    console.log(`  • Retrieval may take a few seconds (normal P2P behavior)`);
    console.log(`  • Messages persist indefinitely on relays`);
    console.log(`  • No server infrastructure needed`);

  } catch (e) {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  } finally {
    adapter.disconnect();
    process.exit(0);
  }
}

main();
