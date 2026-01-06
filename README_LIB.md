# Talkbox Library

A standalone, headless JavaScript library for decentalized comments, powered by Nostr.

## Features
- **Context-Aware**: Automatically generates a unique topic based on the current page URL.
- **Private/Secure**: Uses client-side key derivation. No central server for accounts.
- **Stable Identity**: Remembers the user (sender) in the browser's `localStorage`.
- **Zero-Conflict**: Bundled as a self-contained script.

## Installation

1.  Copy `dist/talkbox-lib.js` to your project.
2.  Include it in your HTML:
    ```html
    <script src="path/to/talkbox-lib.js"></script>
    ```

## Usage

The library exposes a global `Talkbox` class.

```javascript
// Initialize
const talkbox = new Talkbox({
    // Optional: override default relays
    // relays: ['wss://relay.damus.io', ...]
});

// 1. Get Comments
// Returns array of { id, pubkey, content, created_at, date }
const comments = await talkbox.getComments(50);
console.log(comments);

// 2. Post Comment
// Returns true on success
const success = await talkbox.postComment("Hello world!");
```

## Building from Source

Prerequisites: Node.js

```bash
npm install
npm run build-lib
```
(See `build-lib.js` for details)
