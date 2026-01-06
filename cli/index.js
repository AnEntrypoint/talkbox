import 'websocket-polyfill';
import Talkbox from '../lib/index.js';


import ora from 'ora';
import pty from 'node-pty';
import os from 'os';
import { nip44 } from 'nostr-tools';

async function main() {
    console.log(`
  _____     _ _     _               
 |_   _|_ _| | |__ | |__  _____  __ 
   | |/ _' | | / / | '_ \\/ _ \\ \\/ / 
   | | (_| | |  \\  | |_) | (_) >  <  
   |_|\\__,_|_|_|\\_\\|_.__/\\___/_/\\_\\ 
                                     
   Nostr-Powered Remote Terminal
    `);

    const password = process.env.TALKBOX_PASSWORD || process.argv[2];
    if (!password) {
        console.error('[!] Error: No password provided.');
        console.error('    Use TALKBOX_PASSWORD environment variable or pass password as first argument.');
        console.error('    Example: talkbox my-secret-password');
        process.exit(1);
    }

    // Use a specific salt for Terminal Mode to isolate from comments
    const terminalUrl = `terminal://talkbox-v1/${password}`;

    const talkbox = new Talkbox({
        url: terminalUrl,
        useTopicKeyAsSender: true
    });

    const spinner = ora('Connecting to Nostr network...').start();

    // Deriving keys first...
    const { secret: topicSecret, pubkey: topicPubkey } = await talkbox._deriveTopicKeys();
    const conversationKey = nip44.getConversationKey(topicSecret, topicPubkey);

    spinner.text = 'Initializing local shell...';

    const shellCmd = os.platform() === 'win32' ? 'powershell.exe' : 'sh';
    const term = pty.spawn(shellCmd, [], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: process.cwd(),
        env: process.env
    });

    // Serial queue for Nostr publishing to guarantee ordering
    const publishQueue = [];
    let isProcessingQueue = false;

    async function processQueue() {
        if (isProcessingQueue || publishQueue.length === 0) return;
        isProcessingQueue = true;
        while (publishQueue.length > 0) {
            const data = publishQueue.shift();
            try {
                await talkbox.post(data, {
                    encrypt: true,
                    kind: 20002,
                    client: 'talkbox-cli-terminal'
                });
            } catch (e) {
                // Silently continue for ephemeral order
            }
        }
        isProcessingQueue = false;
    }

    async function sendOutput(data) {
        publishQueue.push(data);
        processQueue();
    }

    let outputBuffer = '';
    let flushTimeout = null;

    function flushOutput() {
        if (!outputBuffer) return;
        const data = outputBuffer;
        outputBuffer = '';
        if (flushTimeout) clearTimeout(flushTimeout);
        flushTimeout = null;
        sendOutput(data);
    }

    term.onData((data) => {
        // Local terminal echo/output
        process.stdout.write(data);

        // Push to buffer for remote delivery
        outputBuffer += data;

        if (!flushTimeout) {
            flushTimeout = setTimeout(flushOutput, 50); // Improved batching window
        }
    });

    // Keep-alive even in non-TTY environments
    process.stdin.resume();
    const keepAlive = setInterval(() => { }, 1000000);

    // Local input handling
    if (process.stdin.isTTY) {
        try {
            process.stdin.setRawMode(true);
            process.stdin.on('data', (data) => {
                // Local stdin -> PTY
                term.write(data.toString());
            });

            // Sync local resize to PTY
            process.stdout.on('resize', () => {
                term.resize(process.stdout.columns, process.stdout.rows);
            });
        } catch (e) {
            console.warn('[!] Warning: Could not enable raw mode on stdin.');
        }
    }

    // Subscribe to events (kind 20001 for input, 20004 for resize)
    const startTime = Math.floor(Date.now() / 1000);
    const sub = await talkbox.subscribe(async (msg) => {
        // Strict ignore of any event created before this exact millisecond
        if (msg.event.created_at < startTime) return;

        if (msg.event.kind === 20001) {
            // REMOTE input -> PTY
            term.write(msg.content);
        } else if (msg.event.kind === 20004) {
            try {
                const { cols, rows } = JSON.parse(msg.content);
                if (cols && rows) {
                    term.resize(cols, rows);
                }
            } catch (e) { }
        }
    }, {
        kinds: [20001, 20004],
        decrypt: true,
        since: startTime
    });

    if (spinner.isSpinning) spinner.succeed('Nostr Link Established. Remote terminal ready.');

    console.log(`[✓] Terminal Identity: ${topicPubkey}`);
    console.log(`[!] Mode: Fully Encrypted & Ephemeral (Real-time only)`);
    console.log(`[!] Zero state isolation active: only new events processed.`);
    console.log(`[!] Listening for local and remote commands...`);

    term.onExit(({ exitCode, signal }) => {
        clearInterval(keepAlive);
        console.log(`\n[!] Shell exited with code ${exitCode}. Closing down...`);
        if (process.stdin.isTTY) {
            try { process.stdin.setRawMode(false); } catch (e) { }
        }
        process.exit(exitCode);
    });
}

main().catch(err => {
    console.error('\n[!] Fatal Error:', err.stack || err);
    process.exit(1);
});