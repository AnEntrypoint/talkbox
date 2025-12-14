/**
 * Talkbox Server - Simple API wrapper
 * Supports multiple storage backends:
 * - Nostr Relays (fastest to deploy)
 * - IPFS + OrbitDB (maximum decentralization)
 *
 * Usage:
 *   node server.js --adapter nostr
 *   node server.js --adapter ipfs
 */

import http from 'http';
import url from 'url';
import { generateShortcode, sendMessage as encryptMessage, readMessages } from './src/index.js';
import NostrRelayAdapter from './src/adapters/nostr-relay.js';
import IPFSOrbitDBAdapter from './src/adapters/ipfs-orbitdb.js';

const args = process.argv.slice(2);
const adapterType = args.includes('--adapter')
  ? args[args.indexOf('--adapter') + 1]
  : 'nostr';

let adapter;

if (adapterType === 'ipfs') {
  console.log('📦 Starting with IPFS + OrbitDB backend...');
  adapter = new IPFSOrbitDBAdapter({
    nodeType: 'server',
    pinningService: 'nft.storage'
  });
} else {
  console.log('📡 Starting with Nostr Relay backend...');
  adapter = new NostrRelayAdapter();
}

// In-memory shortcode registry (could be distributed)
const shortcodeRegistry = new Map();

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET /generate - Generate new shortcode
    if (pathname === '/generate' && method === 'GET') {
      const password = parsedUrl.query.password;
      if (!password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing password parameter' }));
        return;
      }

      const shortcode = generateShortcode(password);
      shortcodeRegistry.set(shortcode, password);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        shortcode,
        message: `Share this code: ${shortcode}. Keep your password secret!`,
        apiEndpoints: {
          send: `/send?code=${shortcode}&message=hello`,
          read: `/read?password=${password}`,
          status: '/status'
        }
      }));
      return;
    }

    // POST /send - Send a message
    if (pathname === '/send' && method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { shortcode, message } = JSON.parse(body);

          if (!shortcode || !message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing shortcode or message' }));
            return;
          }

          // For Nostr: publish to relays
          if (adapterType === 'nostr') {
            const password = shortcodeRegistry.get(shortcode);
            const result = await adapter.publishMessage(password || shortcode, message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              messageId: result.eventId,
              publishedTo: result.publishedTo,
              totalRelays: result.totalRelays
            }));
          }
          // For IPFS: add to database
          else {
            const result = await adapter.sendMessage(shortcode, message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              messageId: result.messageId,
              databaseAddress: result.databaseAddress
            }));
          }
        } catch (e) {
          console.error('Send error:', e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // GET /read - Read messages
    if (pathname === '/read' && method === 'GET') {
      const password = parsedUrl.query.password;
      if (!password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing password parameter' }));
        return;
      }

      try {
        const shortcode = generateShortcode(password);
        let messages;

        if (adapterType === 'nostr') {
          // For Nostr: would need async subscription
          messages = [{ message: '(Nostr subscription returns streaming events)', timestamp: Date.now() }];
        } else {
          // For IPFS: load from database
          messages = await adapter.readMessages(shortcode);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          shortcode,
          messageCount: messages.length,
          messages
        }));
      } catch (e) {
        console.error('Read error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // GET /status - System status
    if (pathname === '/status' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        server: 'Talkbox API',
        adapter: adapterType,
        shortcodesRegistered: shortcodeRegistry.size,
        status: 'running',
        endpoints: {
          generate: 'GET /generate?password=YOUR_PASSWORD',
          send: 'POST /send with { shortcode, message }',
          read: 'GET /read?password=YOUR_PASSWORD',
          status: 'GET /status'
        }
      }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

// Initialize adapter
async function startup() {
  try {
    if (adapterType === 'ipfs') {
      await adapter.initialize();
    } else if (adapterType === 'nostr') {
      await adapter.connect();
    }

    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║  🎁 Talkbox Server Running             ║
╚════════════════════════════════════════╝

Adapter: ${adapterType.toUpperCase()}
Port: ${PORT}

Quick Start:
  1. Generate:
     curl "http://localhost:${PORT}/generate?password=mysecret"

  2. Share the shortcode with others

  3. Someone sends:
     curl -X POST http://localhost:${PORT}/send \\
       -H "Content-Type: application/json" \\
       -d '{"shortcode":"abc123","message":"hello"}'

  4. You read:
     curl "http://localhost:${PORT}/read?password=mysecret"

Status: http://localhost:${PORT}/status
      `);
    });
  } catch (e) {
    console.error('Startup failed:', e);
    process.exit(1);
  }
}

startup();

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await adapter.disconnect();
  server.close();
  process.exit(0);
});
