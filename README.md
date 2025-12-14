# Talkbox

Minimal cryptographic system for sharing messages via shortcodes. Generate a shortcode from a secret password, share the code, and let others send encrypted messages that only you can read.

## How it works

1. **Generate shortcode**: Create a short public code from your secret password
2. **Share shortcode**: Give the code to people who want to send you messages
3. **Send messages**: Others use the shortcode to encrypt and send messages
4. **Read messages**: Only you (with the password) can decrypt all messages

## Installation

```bash
npm install talkbox
```

Or use directly as a module:

```bash
node examples/basic.js
```

## Quick Start

```javascript
import {
  generateShortcode,
  sendMessage,
  readMessages
} from 'talkbox';

// Step 1: Generate a shortcode from your secret password
const myPassword = 'my-super-secret-password';
const shortcode = generateShortcode(myPassword);
console.log('Share this code:', shortcode); // "da0fafa85358"

// Step 2: Others send messages using the shortcode
const messageId = sendMessage(shortcode, 'Hello!');

// Step 3: You read messages with your password
const messages = readMessages(myPassword);
console.log(messages);
// Output: [
//   {
//     messageId: "...",
//     message: "Hello!",
//     timestamp: 1702345600000
//   }
// ]
```

## API

### `generateShortcode(password)`

Generate a deterministic shortcode from a password. The same password always produces the same shortcode.

**Parameters:**
- `password` (string): Your secret password

**Returns:** `string` - 12-character shortcode

**Example:**
```javascript
const code = generateShortcode('my-password');
// Returns: "a1b2c3d4e5f6" (deterministic)
```

### `sendMessage(shortcode, message)`

Send an encrypted message using a shortcode. The message is encrypted with AES-256-GCM.

**Parameters:**
- `shortcode` (string): The public shortcode
- `message` (string): Message to encrypt and send

**Returns:** `string` - Message ID

**Example:**
```javascript
const messageId = sendMessage('a1b2c3d4e5f6', 'Secret message');
```

### `readMessages(password)`

Decrypt and read all messages sent to your password's shortcode.

**Parameters:**
- `password` (string): Your secret password

**Returns:** `Array<Object>` - Array of messages with structure:
```javascript
{
  messageId: string,
  message: string,
  timestamp: number
}
```

**Example:**
```javascript
const messages = readMessages('my-password');
messages.forEach(msg => {
  console.log(`[${new Date(msg.timestamp)}] ${msg.message}`);
});
```

### `deleteMessage(messageId)`

Delete a specific message by ID.

**Parameters:**
- `messageId` (string): ID of message to delete

**Returns:** `boolean` - True if deleted, false if not found

**Example:**
```javascript
deleteMessage('message-id-here');
```

### `clearMessages()`

Clear all messages (but keep shortcode mappings).

**Example:**
```javascript
clearMessages();
```

### `reset()`

Reset everything - clear all messages and shortcode mappings.

**Example:**
```javascript
reset();
```

### `getAllMessageIds()`

Get all message IDs currently stored.

**Returns:** `Array<string>` - List of message IDs

**Example:**
```javascript
const ids = getAllMessageIds();
console.log(ids); // ["id1", "id2", "id3"]
```

## Security Notes

- **Password strength matters**: Use a strong password - it's the only thing protecting your messages
- **In-memory storage**: Messages are stored in memory by default. They're lost when the process ends
- **Deterministic shortcodes**: Same password always produces the same shortcode. Keep your password secret
- **PBKDF2 KDF**: Uses PBKDF2 with SHA-256 (100,000 iterations) to derive encryption keys
- **AES-256-GCM**: Uses authenticated encryption with 256-bit keys and random IVs

## Limitations

- In-memory message store (see usage with databases below)
- Single-server/single-process (no distributed support out of the box)
- No user management or multiple recipients per shortcode
- Password = Identity (no separate usernames)

## Usage with a Database

To use with a database instead of in-memory storage:

```javascript
import { generateShortcode, deriveKey } from 'talkbox';
import db from './your-database';

// On message send
function sendMessage(shortcode, message) {
  const password = await db.getPassword(shortcode);
  const key = deriveKey(password);
  // ... encrypt message ...
  await db.saveMessage({ encrypted, iv, authTag });
}

// On message read
async function readMessages(password) {
  const key = deriveKey(password);
  const messages = await db.getMessagesByPassword(password);
  // ... decrypt each message ...
}
```

## Examples

See `/examples` directory:
- `basic.js` - Simple send/receive example
- `test.js` - Comprehensive test suite

Run examples:
```bash
npm run example
npm test
```

## License

MIT
