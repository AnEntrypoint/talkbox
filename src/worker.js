import NostrRelayAdapter from './adapters/nostr-relay.js';

const adapter = new NostrRelayAdapter();

/**
 * Generate shortcode from password using Web Crypto API (Cloudflare Workers compatible)
 * Must match the client-side implementation in public/index.html
 */
async function generateShortcode(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to base64 for shortcode
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.substring(0, 16);
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

      const result = await adapter.publishMessage(shortcode, message);

      const msgKey = `${shortcode}:${result.eventId}`;
      await env.MESSAGES.put(msgKey, JSON.stringify({
        content: message,
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
      const messages = await adapter.readMessages(password);

      return new Response(JSON.stringify({
        success: true,
        shortcode,
        messageCount: messages.length,
        messages
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
