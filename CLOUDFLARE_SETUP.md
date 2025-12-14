# Talkbox on Cloudflare (Free Tier)

Deploy Talkbox entirely on Cloudflare using Workers + KV + Pages. **Completely free with generous limits.**

## What You Get

- **Cloudflare Pages**: Frontend (GitHub Pages replacement)
- **Cloudflare Workers**: Serverless backend API
- **Cloudflare KV**: Persistent message storage
- **Nostr Relays**: Message persistence (free, decentralized)

## Costs

- **Pages**: FREE (unlimited deployments)
- **Workers**: FREE tier (100,000 requests/day - plenty for personal use)
- **KV**: FREE tier (with fair use policy)
- **Nostr**: FREE (decentralized, no infrastructure needed)

**Total: $0/month**

## Prerequisites

1. **Cloudflare Account**: https://dash.cloudflare.com/sign-up
2. **GitHub Account**: Already set up
3. **Wrangler CLI**: Already installed locally

## Step 1: Deploy Backend to Cloudflare Workers

### 1.1 Login to Cloudflare
```bash
wrangler login
# Opens browser to authenticate
```

### 1.2 Create KV Namespaces
```bash
wrangler kv:namespace create "MESSAGES"
wrangler kv:namespace create "SHORTCODES"

# Save the IDs returned - you'll use them in wrangler.toml
```

### 1.3 Update wrangler.toml
Edit `wrangler.toml` and add the IDs from step 1.2:

```toml
[[kv_namespaces]]
binding = "MESSAGES"
id = "YOUR_MESSAGES_ID"
preview_id = "YOUR_MESSAGES_PREVIEW_ID"

[[kv_namespaces]]
binding = "SHORTCODES"
id = "YOUR_SHORTCODES_ID"
preview_id = "YOUR_SHORTCODES_PREVIEW_ID"
```

### 1.4 Deploy to Workers
```bash
wrangler deploy
# Returns: Deployment successful at https://talkbox.YOUR_ACCOUNT.workers.dev
```

**Save your Worker URL** - you'll need it for the frontend!

## Step 2: Deploy Frontend to Cloudflare Pages

### 2.1 Push to GitHub (if not done)
```bash
git add -A
git commit -m "Add Cloudflare Workers deployment"
git push origin main
```

### 2.2 Deploy Pages via Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Navigate to **Pages**
3. Click **Create a project**
4. Select **Connect to Git**
5. Choose **AnEntrypoint/talkbox**
6. Configure build settings:
   - **Build command**: `echo "No build needed"`
   - **Build output directory**: `public`
7. Click **Save and Deploy**

**Your frontend URL**: `https://talkbox.YOUR_ACCOUNT.pages.dev`

## Step 3: Connect Frontend to Backend

Update frontend to use your Worker:

### Option A: Update public/index.html
Change line ~343:
```javascript
API_URL = window.TALKBOX_API_URL || 'https://your-worker.workers.dev';
```

### Option B: Use Query Parameter
```
https://talkbox.YOUR_ACCOUNT.pages.dev?api=https://talkbox.YOUR_ACCOUNT.workers.dev
```

## Step 4: Set Custom Domain (Optional)

### For Pages (Frontend)
1. **Cloudflare Dashboard** → **Pages** → **Your project** → **Custom domain**
2. Add your domain (must be on Cloudflare)
3. DNS auto-configured

### For Workers (Backend)
1. **Cloudflare Dashboard** → **Workers** → **Routes**
2. Add route: `api.yourdomain.com/*` → `talkbox` worker

Then use:
```
https://yourdomain.com?api=https://api.yourdomain.com
```

## Architecture

```
┌──────────────────────────────────────────┐
│ Cloudflare Pages (Frontend)              │
│ https://talkbox.YOUR_ACCOUNT.pages.dev   │
│                                          │
│ Static HTML/CSS/JS                       │
│ Auto-deploys on git push                 │
└────────────┬─────────────────────────────┘
             │
             ↓ HTTPS API Calls
             │
┌────────────▼─────────────────────────────┐
│ Cloudflare Workers (Backend API)         │
│ https://talkbox.YOUR_ACCOUNT.workers.dev │
│                                          │
│ Serverless Node.js execution             │
│ Handles crypto & Nostr integration       │
└────────────┬─────────────────────────────┘
             │
             ↓ Reads/writes
             │
┌────────────▼─────────────────────────────┐
│ Cloudflare KV (Message Storage)          │
│ 30-day expiration per message            │
│                                          │
│ Shortcode → Password mapping             │
│ Messages with metadata                   │
└────────────┬─────────────────────────────┘
             │
             ↓ WebSocket to Nostr
             │
┌────────────▼─────────────────────────────┐
│ Nostr Relay Network (Decentralized)      │
│ wss://relay.damus.io                     │
│ wss://nos.lol                            │
│ etc.                                     │
│                                          │
│ FREE + Decentralized + Permanent         │
└──────────────────────────────────────────┘
```

## Features

✅ **Zero Cost**: Everything on free tier
✅ **Global**: Cloudflare edge network (200+ locations)
✅ **Fast**: Sub-100ms API responses
✅ **Scalable**: Auto-scales with demand
✅ **Secure**: TLS/SSL included
✅ **Reliable**: 99.99% uptime SLA
✅ **Persistent**: KV storage with TTL
✅ **Decentralized**: Nostr relays for message archive

## Usage

Once deployed:

```
1. Visit your Pages URL: https://talkbox.YOUR_ACCOUNT.pages.dev
2. Generate shortcode (uses your Worker API)
3. Share shortcode
4. Friends send messages (stored in Cloudflare KV)
5. You read with password (encrypted via core library)
```

## Monitoring

### View Worker Logs
```bash
wrangler tail
# Live logs from your Worker
```

### View KV Storage
1. **Cloudflare Dashboard** → **Workers** → **KV**
2. Click on namespace to view keys
3. See all shortcodes and messages

### Performance Metrics
1. **Cloudflare Dashboard** → **Pages** → **Analytics**
2. Track requests, cache hits, errors

## Troubleshooting

### Worker not responding
```bash
wrangler deployments list
# Check last deployment status
```

### KV not storing data
```bash
wrangler kv:key list --namespace-id=YOUR_ID
# List all keys in namespace
```

### CORS errors
- Ensure wrangler.toml has correct headers
- Verify API_URL in frontend matches Worker URL

### Messages expiring too fast
- Default TTL: 30 days (2592000 seconds)
- Change in src/worker.js: `expirationTtl: 2592000`

## Advanced Features

### Custom Domain
```bash
# Route API through custom domain
# In Cloudflare: Workers → Routes
# Add: api.yourdomain.com/* → talkbox worker
```

### Analytics
```bash
# View in Cloudflare Analytics
# Track API usage, errors, performance
```

### Rate Limiting
```bash
# In Cloudflare: Workers → Rate Limiting
# Protect against abuse (optional)
```

## Migration from GitHub Pages

If you're already using GitHub Pages:

1. **Keep GitHub Pages frontend** (or switch to Cloudflare Pages)
2. **Deploy Worker backend**
3. **Update API_URL** in frontend to point to Worker
4. **Test**: Generate shortcode, send message, read it

That's it! Same frontend, better backend.

## Next Steps

1. **Create Cloudflare account**: https://dash.cloudflare.com/sign-up
2. **Login locally**: `wrangler login`
3. **Create KV namespaces**: `wrangler kv:namespace create "MESSAGES"`
4. **Deploy Worker**: `wrangler deploy`
5. **Deploy Pages**: Via Cloudflare Dashboard
6. **Test**: Visit Pages URL with `?api=WORKER_URL` query param

## Support

- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Workers Docs**: https://developers.cloudflare.com/workers/
- **KV Docs**: https://developers.cloudflare.com/workers/runtime-apis/kv/

## Comparison: GitHub Pages vs Cloudflare Pages

| Feature | GitHub Pages | Cloudflare Pages |
|---------|-------------|-----------------|
| **Cost** | $0 | $0 |
| **Builds** | GitHub Actions | Cloudflare native |
| **Custom Domain** | $12/year (if using DNS elsewhere) | FREE |
| **Analytics** | Limited | Built-in |
| **Performance** | Good | Excellent (edge) |
| **Bandwidth** | Unlimited | Unlimited |

## Comparison: Node.js Server vs Cloudflare Workers

| Feature | Node.js Server | Cloudflare Workers |
|---------|------|-----------------|
| **Cost** | $5-10/month | $0 (free tier) |
| **Scalability** | Manual | Automatic |
| **Global** | Single region | 200+ locations |
| **Cold starts** | None | <5ms |
| **CPU time** | Unlimited | 50ms limit |
| **Setup** | Complex | Simple |

## Full Cloudflare Stack Benefits

✅ **Frontend**: Pages (free, auto-deploy)
✅ **API**: Workers (free, 100k req/day)
✅ **Storage**: KV (free, fair use)
✅ **DNS**: FREE (if using Cloudflare nameservers)
✅ **SSL/TLS**: FREE (Cloudflare automatic)
✅ **DDoS Protection**: FREE (Cloudflare built-in)
✅ **CDN**: FREE (Cloudflare edge network)
✅ **Email**: Cloudflare Pages Functions (optional)

**Total value**: Would cost $50+/month elsewhere
**Your cost**: $0/month

---

**Ready to deploy?** Follow Step 1-4 above!

Questions? See GITHUB_PAGES_SETUP.md or README.md
