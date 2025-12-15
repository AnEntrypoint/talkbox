import NostrRelayAdapter from './adapters/nostr-relay.js';

const adapter = new NostrRelayAdapter();

/**
 * Generate shortcode from password using Web Crypto API (Cloudflare Workers compatible)
 * Must match the client-side implementation in public/index.html
 * Simple SHA256 hash-based shortcode
 */
async function generateShortcode(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64;
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
      const { shortcode, message, recipientPassword } = body;

      if (!shortcode || !message) {
        return new Response(JSON.stringify({ error: 'Missing shortcode or message' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      // The shortcode IS the recipient's public key (in base64)
      // We need to publish the message so it can be found by pubkey
      // Since we don't have the recipient's secret key, we use the adapter's publish
      // with a temporary "mailbox" identity, then tag it for the recipient

      // For now, just store in KV - the recipient will query using their password
      // which derives to the same pubkey/shortcode
      const result = { eventId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36) };

      const msgKey = `${shortcode}:${result.eventId}`;
      await env.MESSAGES.put(msgKey, JSON.stringify({
        message: message,
        timestamp: Date.now(),
        id: result.eventId
      }), { expirationTtl: 2592000 });

      return new Response(JSON.stringify({
        success: true,
        messageId: result.eventId,
        publishedTo: result.publishedTo,
        totalRelays: result.totalRelays
      }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/read' && request.method === 'GET') {
      const password = url.searchParams.get('password');
      if (!password) {
        return new Response(JSON.stringify({ error: 'Missing password' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      const shortcode = await generateShortcode(password);

      // Query KV store for messages sent to this shortcode
      const messagesList = [];
      const kvPrefix = `${shortcode}:`;

      // Get all messages for this shortcode from KV
      const list = await env.MESSAGES.list({ prefix: kvPrefix });
      for (const item of list.keys) {
        const msgData = await env.MESSAGES.get(item.name, 'json');
        if (msgData) {
          messagesList.push(msgData);
        }
      }

      // Sort by timestamp (newest first)
      messagesList.sort((a, b) => b.timestamp - a.timestamp);

      return new Response(JSON.stringify({
        success: true,
        shortcode,
        messageCount: messagesList.length,
        messages: messagesList
      }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
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
