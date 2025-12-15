import { getPublicKey } from 'nostr-tools';
import NostrRelayAdapter from './adapters/nostr-relay.js';

const adapter = new NostrRelayAdapter();

/**
 * Derive Nostr keypair from password (Ed25519)
 * Uses same derivation as adapter.deriveNostrKeys()
 */
async function deriveNostrKeys(password) {
  // Create deterministic seed from password
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'talkbox-nostr-derivation');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const seed = new Uint8Array(hashBuffer);

  // Use first 32 bytes as secret key
  const secretKey = seed.slice(0, 32);
  const publicKey = getPublicKey(secretKey);

  return { secretKey, publicKey };
}

/**
 * Generate shortcode from password
 * Shortcode = Nostr public key (hex string)
 */
async function generateShortcode(password) {
  const { publicKey } = await deriveNostrKeys(password);
  return publicKey;
}

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    await adapter.connect();

    if (path === '/generate' && request.method === 'GET') {
      const password = url.searchParams.get('password');
      if (!password) {
        return new Response(JSON.stringify({ error: 'Missing password' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      const shortcode = await generateShortcode(password);

      return new Response(JSON.stringify({
        shortcode,
        message: `Share this code: ${shortcode}. Keep your password secret!`,
        note: 'Password is needed when sending messages - share only the shortcode with message senders',
        apiEndpoints: {
          send: 'POST /send with { shortcode, message }',
          read: `GET /read?password=${password}`,
          status: 'GET /status'
        }
      }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/send' && request.method === 'POST') {
      const body = await request.json();
      const { shortcode, message } = body;

      if (!shortcode || !message) {
        return new Response(JSON.stringify({ error: 'Missing shortcode or message' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      try {
        const publisherPassword = 'talkbox-relay-publisher';
        const result = await adapter.publishMessage(publisherPassword, message, shortcode);

        return new Response(JSON.stringify({
          success: true,
          messageId: result.eventId,
          publishedTo: result.publishedTo,
          totalRelays: result.totalRelays
        }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/read' && request.method === 'GET') {
      const password = url.searchParams.get('password');
      if (!password) {
        return new Response(JSON.stringify({ error: 'Missing password' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      try {
        const { publicKey } = await deriveNostrKeys(password);
        const shortcode = await generateShortcode(password);

        const messages = await adapter.readMessagesByRecipient(publicKey);

        return new Response(JSON.stringify({
          success: true,
          shortcode,
          messageCount: messages.length,
          messages: messages
        }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/status' && request.method === 'GET') {
      const stats = await adapter.getRelayStats();
      return new Response(JSON.stringify({
        server: 'Talkbox (Cloudflare Workers)',
        adapter: 'nostr',
        status: 'running',
        relays: stats.relays,
        endpoints: {
          generate: 'GET /generate?password=YOUR_PASSWORD',
          send: 'POST /send with { shortcode, message }',
          read: 'GET /read?password=YOUR_PASSWORD',
          status: 'GET /status'
        }
      }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};
