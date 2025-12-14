import {
  generateShortcode,
  sendMessage,
  readMessages,
  deleteMessage,
  clearMessages,
  reset
} from './src/index.js';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exit(1);
  }
  console.log('✓', message);
}

// Test 1: Shortcode generation is deterministic
const password = 'test-password';
const shortcode1 = generateShortcode(password);
const shortcode2 = generateShortcode(password);
assert(shortcode1 === shortcode2, 'Same password generates same shortcode');

// Test 2: Different passwords generate different shortcodes
const shortcode3 = generateShortcode('different-password');
assert(shortcode1 !== shortcode3, 'Different passwords generate different shortcodes');

// Test 3: Send and read messages
clearMessages();
const messageId = sendMessage(shortcode1, 'Test message');
const messages = readMessages(password);
assert(messages.length === 1, 'Can read sent message with correct password');
assert(messages[0].message === 'Test message', 'Message content is correct');

// Test 4: Wrong password cannot read messages
const wrongMessages = readMessages('wrong-password');
assert(wrongMessages.length === 0, 'Wrong password cannot read messages');

// Test 5: Multiple messages
clearMessages(); // Only clear messages, keep shortcodes
sendMessage(shortcode1, 'Message 1');
sendMessage(shortcode1, 'Message 2');
sendMessage(shortcode1, 'Message 3');
const allMessages = readMessages(password);
assert(allMessages.length === 3, 'Multiple messages can be sent and read');

// Test 6: Delete message
deleteMessage(allMessages[1].messageId);
const remaining = readMessages(password);
assert(remaining.length === 2, 'Message deletion works');

// Test 7: Timestamps are recorded
clearMessages(); // Only clear messages, keep shortcodes
sendMessage(shortcode1, 'Timestamped message');
const timestampedMessages = readMessages(password);
assert(timestampedMessages[0].timestamp > 0, 'Messages have timestamps');

console.log('\n✅ All tests passed!');
