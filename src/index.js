import crypto from 'crypto';

// In-memory stores - can be extended to use DB/localStorage
const messageStore = new Map();
const shortcodeMap = new Map(); // shortcode → password mapping

/**
 * Generate a shortcode from a password
 * Same password always produces the same shortcode
 * Stores the mapping internally for message encryption
 */
export function generateShortcode(password) {
  const hash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex')
    .substring(0, 12);

  // Store the mapping so sendMessage can look it up
  shortcodeMap.set(hash, password);
  return hash;
}

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(password) {
  return crypto.pbkdf2Sync(
    password,
    'talkbox-salt', // Static salt for simplicity, could be randomized
    100000,
    32,
    'sha256'
  );
}

/**
 * Send an encrypted message using a shortcode
 * Returns message ID for retrieval
 */
export function sendMessage(shortcode, message) {
  const password = shortcodeMap.get(shortcode);
  if (!password) {
    throw new Error(`Invalid shortcode: ${shortcode}`);
  }

  const key = deriveKey(password);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const messageId = crypto.randomUUID();
  messageStore.set(messageId, {
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
    timestamp: Date.now()
  });

  return messageId;
}

/**
 * Read all messages that can be decrypted with the given password
 * Returns array of {messageId, message, timestamp}
 */
export function readMessages(password) {
  const key = deriveKey(password);
  const messages = [];

  for (const [messageId, data] of messageStore) {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(data.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      messages.push({
        messageId,
        message: decrypted,
        timestamp: data.timestamp
      });
    } catch (e) {
      // Wrong password or tampered message, skip
    }
  }

  return messages;
}

/**
 * Delete a message by ID
 */
export function deleteMessage(messageId) {
  return messageStore.delete(messageId);
}

/**
 * Get all message IDs (for debugging/management)
 */
export function getAllMessageIds() {
  return Array.from(messageStore.keys());
}

/**
 * Clear all messages (but keep shortcode mappings)
 */
export function clearMessages() {
  messageStore.clear();
}

/**
 * Reset everything (messages and shortcodes)
 */
export function reset() {
  messageStore.clear();
  shortcodeMap.clear();
}
