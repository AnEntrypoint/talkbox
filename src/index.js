import crypto from 'crypto';
import keypear from 'keypear';
import nacl from 'tweetnacl';

nacl.util = nacl.util || {};
nacl.util.encodeBase64 = (arr) => Buffer.from(arr).toString('base64');
nacl.util.decodeBase64 = (str) => new Uint8Array(Buffer.from(str, 'base64'));

export function deriveKeypair(password) {
  const seed = crypto.createHash('sha256').update(password).digest();
  const kp = keypear(seed);
  return {
    publicKey: Buffer.from(kp.publicKey),
    secretKey: Buffer.from(kp.secretKey)
  };
}

export function generateShortcode(password) {
  const { publicKey } = deriveKeypair(password);
  return publicKey.toString('base64').substring(0, 16);
}

export function encryptMessage(publicKeyBase64, message) {
  const publicKey = new Uint8Array(Buffer.from(publicKeyBase64, 'base64'));
  const nonce = nacl.randomBytes(24);
  const msgBytes = Buffer.from(message, 'utf8');

  const ephemeralKeypair = nacl.box.keyPair();
  const ciphertext = nacl.box(msgBytes, nonce, publicKey, ephemeralKeypair.secretKey);

  return {
    nonce: Buffer.from(nonce).toString('base64'),
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    ephemeralPublicKey: Buffer.from(ephemeralKeypair.publicKey).toString('base64')
  };
}

export function decryptMessage(encryptedData, secretKeyBase64) {
  try {
    const secretKey = new Uint8Array(Buffer.from(secretKeyBase64, 'base64'));
    const nonce = new Uint8Array(Buffer.from(encryptedData.nonce, 'base64'));
    const ciphertext = new Uint8Array(Buffer.from(encryptedData.ciphertext, 'base64'));
    const ephemeralPublicKey = new Uint8Array(Buffer.from(encryptedData.ephemeralPublicKey, 'base64'));

    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPublicKey, secretKey);
    if (!decrypted) return null;

    return Buffer.from(decrypted).toString('utf8');
  } catch (e) {
    return null;
  }
}
