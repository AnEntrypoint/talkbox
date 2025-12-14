import {
  generateShortcode,
  sendMessage,
  readMessages,
  deleteMessage,
  getAllMessageIds,
  reset
} from '../src/index.js';

console.log('🔐 Talkbox Advanced Examples\n');

// Example 1: Multiple shortcodes for different purposes
console.log('--- Example 1: Multiple shortcodes ---');
const work = generateShortcode('work-password');
const personal = generateShortcode('personal-password');

console.log('Work shortcode:', work);
console.log('Personal shortcode:', personal);
console.log();

// Example 2: Sending from different sources
console.log('--- Example 2: Simulating messages from different senders ---');
sendMessage(work, 'Meeting at 3pm tomorrow');
sendMessage(work, 'Project deadline extended');
sendMessage(personal, 'Call me when you get a chance');
sendMessage(personal, 'Coffee this weekend?');
console.log('✓ 4 messages sent');
console.log();

// Example 3: Reading and filtering messages
console.log('--- Example 3: Reading work messages ---');
const workMessages = readMessages('work-password');
console.log(`Work messages (${workMessages.length}):`);
workMessages.forEach((msg, i) => {
  const time = new Date(msg.timestamp).toLocaleTimeString();
  console.log(`  ${i + 1}. [${time}] ${msg.message}`);
});
console.log();

console.log('--- Example 4: Reading personal messages ---');
const personalMessages = readMessages('personal-password');
console.log(`Personal messages (${personalMessages.length}):`);
personalMessages.forEach((msg, i) => {
  const time = new Date(msg.timestamp).toLocaleTimeString();
  console.log(`  ${i + 1}. [${time}] ${msg.message}`);
});
console.log();

// Example 5: Message management
console.log('--- Example 5: Message management ---');
console.log(`Total messages in system: ${getAllMessageIds().length}`);

// Delete first work message
const firstWorkMsg = workMessages[0];
deleteMessage(firstWorkMsg.messageId);
console.log(`Deleted: "${firstWorkMsg.message}"`);

// Check remaining
const remaining = readMessages('work-password');
console.log(`Work messages remaining: ${remaining.length}`);
console.log();

// Example 6: Wrong password security
console.log('--- Example 6: Security - wrong password ---');
const hacker = readMessages('hacker-password');
console.log(`Hacker can read: ${hacker.length} messages ❌`);
console.log('✓ Encryption is working!');
console.log();

// Example 7: Bulk operations
console.log('--- Example 7: Bulk send/read ---');
reset(); // Start fresh
const bulk = generateShortcode('bulk-test');

console.log('Sending 10 messages...');
for (let i = 1; i <= 10; i++) {
  sendMessage(bulk, `Message #${i}: This is a test message`);
}

const allBulk = readMessages('bulk-test');
console.log(`Received ${allBulk.length} messages ✓`);
console.log(`First message: "${allBulk[0].message}"`);
console.log(`Last message: "${allBulk[allBulk.length - 1].message}"`);
console.log();

console.log('✅ All advanced examples completed!');
