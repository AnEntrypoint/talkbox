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

    const { secret: topicSecret, pubkey: topicPubkey } = await talkbox._deriveTopicKeys();
    const conversationKey = nip44.getConversationKey(topicSecret, topicPubkey);

    console.log(`[✓] Terminal Identity Derived.`);
    console.log(`[!] Pubkey: ${topicPubkey}`);
    console.log(`[!] Mode: Fully Encrypted & Ephemeral (Real-time only)`);

    const spinner = ora('Connecting to Nostr network...').start();

    const shellCmd = os.platform() === 'win32' ? 'powershell.exe' : 'sh';
    const term = pty.spawn(shellCmd, [], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: process.cwd(),
        env: process.env
    });

    let outputBuffer = '';
    let flushTimeout = null;

    function flushOutput() {
        if (!outputBuffer) return;
        const data = outputBuffer;
        outputBuffer = '';
        flushTimeout = null;

        // Fire and forget broadcast
        talkbox.post(data, {
            encrypt: true,
            kind: 20002,
            client: 'talkbox-cli-terminal'
        }).catch(() => { });
    }

    term.onData((data) => {
        process.stdout.write(data);
        outputBuffer += data;

        // Use a 15ms batching window for output to prevent relay flooding
        if (!flushTimeout) {
            flushTimeout = setTimeout(flushOutput, 15);
        }
    });

    // Subscribe to ephemeral events (kind 20001 for commands/input)
    const sub = await talkbox.subscribe(async (msg) => {
        if (msg.event.kind === 20001) {
            term.write(msg.content);
        }
    }, {
        kinds: [20001],
        decrypt: true,
        since: Math.floor(Date.now() / 1000)
    });

    spinner.succeed('Connected to Nostr network. Remote terminal ready.');

    // Handle graceful exit
    process.on('SIGINT', () => {
        console.log('\nClosing connections...');
        talkbox.close();
        process.exit();
    });
}

main().catch(err => {
    console.error('[!] Fatal Error:', err);
    process.exit(1);
});