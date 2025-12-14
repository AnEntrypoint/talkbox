# Talkbox on GitHub Pages + Backend

This guide explains how Talkbox is deployed:
- **Frontend**: GitHub Pages (free, automatic)
- **Backend**: Fly.io, Railway, Render, or Heroku (optional, $0-5/month)

## Frontend Deployment (Already Done ✅)

The frontend is automatically deployed to GitHub Pages whenever you push to `main`.

**GitHub Pages URL:**
```
https://anentrypoint.github.io/talkbox
```

## Backend Setup (Required to Use)

The frontend alone cannot send/receive messages (it needs a backend API). You must deploy the backend to one of these platforms:

### Option 1: Fly.io (Recommended - 5 minutes)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Create app
flyctl launch --name talkbox-nostr

# Deploy
flyctl deploy

# Get your URL (something like: https://talkbox-nostr.fly.dev)
flyctl status
```

Then access GitHub Pages with your API URL:
```
https://anentrypoint.github.io/talkbox?api=https://talkbox-nostr.fly.dev
```

### Option 2: Railway (10 minutes)

1. Push talkbox repo to your GitHub account
2. Go to https://railway.app
3. Click "New Project"
4. Select "Deploy from GitHub"
5. Choose this repository
6. Click "Deploy"

Get your Railway URL from the dashboard:
```
https://anentrypoint.github.io/talkbox?api=https://your-railway-url
```

### Option 3: Render (10 minutes)

1. Go to https://render.com
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub repo
5. Configure:
   - Build command: `npm install`
   - Start command: `npm run server:nostr`
6. Click "Create Web Service"

Get your Render URL:
```
https://anentrypoint.github.io/talkbox?api=https://your-render-url
```

### Option 4: Heroku (Legacy)

```bash
heroku create talkbox-nostr
git push heroku main
heroku open
```

## API Endpoint Configuration

The frontend uses 3 ways to find the backend API:

### 1. Query Parameter (Recommended for testing)
```
https://anentrypoint.github.io/talkbox?api=https://your-api.com
```

### 2. Environment Variable (For custom deployments)
```javascript
window.TALKBOX_API_URL = 'https://your-api.com';
```

### 3. Default (For local development)
- If running locally: uses `http://localhost:3000`
- If on GitHub Pages: uses `https://talkbox-api.fly.dev` (example)

## Testing Locally

### Test Frontend + Local Backend

Terminal 1 (Backend):
```bash
npm run server:nostr
# Starts on http://localhost:3000
```

Terminal 2 (Frontend):
```bash
npx http-server public/
# Starts on http://localhost:8080
```

Then visit: http://localhost:8080

The frontend will automatically detect it's on `localhost:8080` and use `http://localhost:3000` as the API.

## Testing with GitHub Pages

Once you have a backend deployed (e.g., Fly.io):

```
https://anentrypoint.github.io/talkbox?api=https://talkbox-nostr.fly.dev
```

## CORS Notes

The backend (server.js) is already configured with CORS headers:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
```

This allows the GitHub Pages frontend to call it from any origin.

## Troubleshooting

### "Connection error. Check API URL and CORS settings."

1. Verify your backend is running
2. Check the API URL is correct
3. Look at browser console (F12 → Console) for details
4. Verify CORS headers are being sent

### Frontend shows old code

1. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. Check GitHub Actions shows ✅ for latest deployment
3. Wait 1-2 minutes for cache to clear

### "Failed to fetch"

This usually means:
1. Backend API is down or wrong URL
2. Network connectivity issue
3. CORS headers missing (shouldn't happen with current server.js)

### Messages not appearing

1. Verify you're using the same password
2. Check Nostr relay connectivity: `npm run demo:nostr`
3. Wait 2-5 seconds (relays need time to sync)

## Production Checklist

- [x] Frontend deployed to GitHub Pages
- [ ] Backend deployed to Fly.io / Railway / Render
- [ ] Tested locally with `npm run demo:nostr`
- [ ] Created account on backend platform
- [ ] Got backend API URL
- [ ] Tested GitHub Pages with backend
- [ ] Shared with users via `https://anentrypoint.github.io/talkbox?api=your-api-url`

## For Users

Share this URL with people:
```
https://anentrypoint.github.io/talkbox?api=YOUR_API_URL
```

They can:
1. Enter a password → get a shortcode
2. Share the shortcode
3. Others send messages using shortcode
4. They read messages with password

## Architecture

```
┌─────────────────────────────────────────────────┐
│     GitHub Pages Frontend                       │
│     https://anentrypoint.github.io/talkbox      │
│                                                 │
│     HTML + CSS + JavaScript                     │
│     (No build needed)                           │
│                                                 │
│     Calls API for:                              │
│     - /generate (shortcode)                     │
│     - /send (publish message)                   │
│     - /read (retrieve messages)                 │
└────────────┬────────────────────────────────────┘
             │ HTTPS Fetch (CORS allowed)
             │
┌────────────▼────────────────────────────────────┐
│     Node.js Backend API                         │
│     https://your-platform.com                   │
│                                                 │
│     Nostr Adapter                               │
│     └─ Connects to Nostr relays                 │
│        wss://relay.damus.io                     │
│        wss://nos.lol                            │
│        etc.                                     │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│     Nostr Relay Network (Free, Decentralized)  │
│     30+ day message retention                   │
└─────────────────────────────────────────────────┘
```

## Next Steps

1. **Minimal Setup**: Just use GitHub Pages frontend + free public Nostr relays
   - No backend needed!
   - Users can run their own Node.js backend locally
   - Or deploy to free tier of Fly.io/Railway

2. **Full Setup**: Deploy both frontend and backend
   - Frontend: GitHub Pages (already done)
   - Backend: Fly.io, Railway, Render, or Heroku

3. **Custom Domain** (Optional)
   - Point DNS to GitHub Pages
   - Update GitHub repo settings

## Support

- GitHub Pages issues: https://docs.github.com/en/pages
- Fly.io: https://fly.io/docs
- Railway: https://docs.railway.app
- Render: https://render.com/docs
- Heroku: https://devcenter.heroku.com

---

**Questions?** Check NOSTR_DEPLOYMENT.md for full backend deployment details.
# GitHub Pages Enabled ✅
