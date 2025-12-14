import {
  generateShortcode,
  sendMessage,
  readMessages,
  deleteMessage
} from '../src/index.js';

// Step 1: Create a secret password
const mySecret = 'my-super-secret-password';

// Step 2: Generate a shortcode to share with others
const shortcode = generateShortcode(mySecret);
console.log('📌 Your shortcode to share:', shortcode);
console.log('🔐 Your secret password (keep private):', mySecret);
console.log('');

// Step 3: Someone sends a message using the shortcode
console.log('--- Messages being sent ---');
const msgId1 = sendMessage(shortcode, 'Hello! Can you hear me?');
console.log('✓ Message sent, ID:', msgId1);

const msgId2 = sendMessage(shortcode, 'Second message here!');
console.log('✓ Message sent, ID:', msgId2);

const msgId3 = sendMessage(shortcode, 'Third one for good measure');
console.log('✓ Message sent, ID:', msgId3);
console.log('');

// Step 4: You read the messages using your secret
console.log('--- Reading messages with your secret ---');
const messages = readMessages(mySecret);
console.log(`Found ${messages.length} messages:\n`);

messages.forEach((msg, index) => {
  const date = new Date(msg.timestamp).toLocaleTimeString();
  console.log(`${index + 1}. [${date}] ${msg.message}`);
  console.log(`   ID: ${msg.messageId}`);
});
console.log('');

// Step 5: Delete a message
console.log('--- Deleting a message ---');
deleteMessage(msgId2);
const remaining = readMessages(mySecret);
console.log(`After deletion: ${remaining.length} messages remain`);
console.log('');

// Step 6: Try with wrong password
console.log('--- Trying with wrong password ---');
const wrongMessages = readMessages('wrong-password');
console.log(`With wrong password: ${wrongMessages.length} messages readable`);
