# Talkbox Implementation Roadmap

## Current Status ✓
- [x] Core cryptographic library (126 lines)
- [x] Test suite (all passing)
- [x] Documentation
- [x] Basic examples
- [x] Server scaffold with multiple adapters
- [x] Architecture strategy document

## Phase 1: Quick Deployment (1-2 weeks) - Nostr Relay

### Why Nostr First?
- **Fastest**: 2-3 days to working prototype
- **Zero infrastructure**: Use existing free relays
- **Proven**: Battle-tested with thousands of users
- **Cost**: $0/month
- **Can migrate later**: Nostr messages can be archived to IPFS

### Implementation Steps

#### Week 1: Deploy Nostr Version

1. **Install dependencies**
   ```bash
   npm install nostr-tools
   ```

2. **Update `src/adapters/nostr-relay.js`**
   - Replace stubs with real `nostr-tools` implementation
   - Import: `import { generateSecretKey, getPublicKey, nip04 } from 'nostr-tools'`
   - Use real WebSocket connections to relays
   - Implement proper Nostr event signing

   **Code to add:**
   ```javascript
   import { generateSecretKey, getPublicKey, nip04, finalizeEvent } from 'nostr-tools';
   import { SimplePool } from 'nostr-tools/pool';

   // Replace deriveNostrKeys with:
   deriveNostrKeys(password) {
     const seed = crypto.createHash('sha256')
       .update(password + 'nostr')
       .digest();
     const sk = seed.slice(0, 32);
     const pk = getPublicKey(sk);
     return { sk, pk };
   }

   // Use SimplePool for real relay connections
   this.pool = new SimplePool();
   ```

3. **Test Nostr adapter**
   ```bash
   node -e "
   import NostrRelayAdapter from './src/adapters/nostr-relay.js';
   const adapter = new NostrRelayAdapter();
   await adapter.connect();
   console.log('✓ Connected to Nostr relays');
   "
   ```

4. **Create simple web UI** (optional but recommended)
   - HTML form to generate shortcode
   - Form to send message via shortcode
   - Display messages with password
   - Can be simple single-file HTML

5. **Deploy server**
   ```bash
   # Local testing
   npm run server:nostr

   # Deploy to free server (Fly.io, Railway, Render, Vercel)
   # See deployment section below
   ```

#### Week 2: Validate & Iterate
- Test with real users
- Gather feedback
- Fix Nostr relay synchronization issues
- Add message expiration (Nostr relays typically keep 30 days)

### Deployment Options (Free)

**Option A: Fly.io** (Recommended for simplicity)
```bash
# Install flyctl: https://fly.io/docs/getting-started/installing-flyctl/
flyctl auth login
flyctl launch --name talkbox
flyctl deploy
```

**Option B: Railway**
```bash
# Connect GitHub, select this repo, auto-deploys
# https://railway.app
```

**Option C: Render**
```bash
# https://render.com - free tier with auto-sleep
# Connect GitHub, select Node.js environment
```

**Option D: Vercel** (Requires refactoring to serverless functions)
```bash
vercel --prod
```

---

## Phase 2: IPFS + OrbitDB (2-3 weeks) - Maximum Decentralization

### When to do this
- After validating Nostr version
- If you want permanent message archives
- If you want zero dependence on relay operators

### Implementation Steps

1. **Install dependencies**
   ```bash
   npm install helia orbitdb libp2p
   ```

2. **Update `src/adapters/ipfs-orbitdb.js`**
   - Replace stubs with real Helia initialization
   - Real OrbitDB database operations
   - DHT peer discovery
   - Pinning service integration

   **Code to add:**
   ```javascript
   import { createHelia } from 'helia';
   import { createOrbitDB } from '@orbitdb/core';
   import { createLibp2p } from 'libp2p';

   async initialize() {
     const libp2p = await createLibp2p();
     this.ipfs = await createHelia({ libp2p });
     this.orbitdb = await createOrbitDB({ ipfs: this.ipfs });
   }
   ```

3. **Add pinning service API keys**
   ```javascript
   // Option A: Pinata (5GB free)
   // - Sign up: https://pinata.cloud
   // - Get API key
   // - Environment: PINATA_API_KEY

   // Option B: nft.storage (unlimited free)
   // - Sign up: https://nft.storage
   // - Get API token
   // - Environment: NFT_STORAGE_TOKEN
   ```

4. **Create CLI tools for advanced users**
   ```bash
   # Run your own IPFS node for redundancy
   npm run node:ipfs

   # Participate in mesh gossip
   npm run join:network
   ```

5. **Deploy distributed**
   - Run node on your server
   - Other users run nodes
   - Messages auto-replicate
   - Network is resilient to outages

---

## Phase 3: Hybrid (Nostr + IPFS) (1 week after Phase 2)

### Architecture
```
User → Nostr Relay (discovery) → IPFS (storage) → Message
       ↓
  Fast discovery + permanent storage + zero cost
```

### Implementation
1. Use Nostr for announcing mailbox addresses
2. Store actual messages on IPFS
3. Nostr events reference IPFS CIDs
4. Best of both worlds

---

## Quick Reference: Running Today

### Test the core library
```bash
npm test                    # All tests pass ✓
```

### Run examples
```bash
npm run example            # Basic example
npm run examples:advanced  # Advanced features
```

### Start server (stub version)
```bash
npm run server:nostr       # Nostr backend (needs implementation)
npm run server:ipfs        # IPFS backend (needs implementation)
```

---

## Key Decisions Before Starting Phase 1

### Question 1: Relay Redundancy
**For Nostr:** Should you run your own relay or use public ones?
- **Public only**: Free, no maintenance, trust relay operators
- **Public + your relay**: Ensure uptime, costs $5-10/month
- **Recommendation**: Start with public, add your relay later

### Question 2: Message Encryption
**For Nostr:** Should messages be encrypted end-to-end?
- **Yes (NIP-04)**: More privacy, harder to implement
- **No (plaintext)**: Simple, relays see content
- **Recommendation**: Use NIP-04 encryption, implement in Phase 2

### Question 3: Backup Strategy
**For both:** How to backup messages?
- **Nostr**: Relays keep 30 days, set longer retention on your relay
- **IPFS**: Pin to Pinata/nft.storage, run backup node
- **Recommendation**: Use free pinning service

---

## Testing Your Deployment

Once deployed, test with:

```bash
# 1. Generate shortcode
curl "https://your-domain.com/generate?password=test123"
# Returns: {"shortcode":"abc123def456",...}

# 2. Send message
curl -X POST https://your-domain.com/send \
  -H "Content-Type: application/json" \
  -d '{"shortcode":"abc123def456","message":"Hello!"}'

# 3. Read messages
curl "https://your-domain.com/read?password=test123"
# Returns: {"messages":[{"message":"Hello!","timestamp":...}]}
```

---

## File Checklist for Phase 1 (Nostr)

- [ ] `src/adapters/nostr-relay.js` - Use real nostr-tools
- [ ] `server.js` - Already scaffolded, ready to use
- [ ] `public/index.html` - Simple web UI (create new)
- [ ] `.env.example` - Document environment variables
- [ ] `README.md` - Update with deployment instructions
- [ ] Deploy to Fly.io / Railway / Render
- [ ] Test with real users

---

## Costs Summary

| Phase | Implementation | Monthly Cost | Setup Time |
|-------|----------------|--------------|-----------|
| 1 (Nostr) | Deploy + Web UI | $0 | 2-3 days |
| 2 (IPFS) | OrbitDB + DHT | $0-5 | 2 weeks |
| 3 (Hybrid) | Nostr + IPFS | $0-5 | 1 week |

---

## Next Step
Choose your starting phase and we'll implement it together. Phase 1 (Nostr) is recommended to validate the concept quickly with zero infrastructure cost.

Which would you like to tackle first?
