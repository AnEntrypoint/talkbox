import 'websocket-polyfill';
import Talkbox from '../lib/index.js';

import { spawn } from 'child_process';
import ora from 'ora';

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

    const { pubkey } = await talkbox._deriveTopicKeys();

    console.log(`\n[✓] Terminal Identity Derived.`);
    console.log(`[!] Pubkey: ${pubkey}`);
    console.log(`[!] Mode: Fully Encrypted & Ephemeral (Real-time only)`);
    console.log(`[!] Status: Listening for commands...\n`);

    const spinner = ora('Initializing connection to relays...').start();

    let shell = null;

    function startShell() {
        // Use powershell on windows, sh on others
        const shellCmd = process.platform === 'win32' ? 'powershell.exe' : 'sh';
        const shellArgs = process.platform === 'win32' ? ['-NoLogo', '-NoExit', '-Command', '-'] : [];

        console.log(`[!] Starting persistent shell: ${shellCmd}`);
        shell = spawn(shellCmd, shellArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env
        });

        shell.stdout.on('data', async (data) => {
            const output = data.toString();
            process.stdout.write(output);
            await talkbox.post(output, {
                encrypt: true,
                kind: 20002,
                client: 'talkbox-cli-terminal'
            });
        });

        shell.stderr.on('data', async (data) => {
            const output = data.toString();
            process.stderr.write(output);
            await talkbox.post(output, {
                encrypt: true,
                kind: 20002,
                client: 'talkbox-cli-terminal'
            });
        });

        shell.on('exit', (code) => {
            console.log(`[!] Shell exited with code ${code}. Restarting...`);
            setTimeout(startShell, 1000);
        });
    }

    startShell();

    // Subscribe to ephemeral events (kind 20001 for commands)
    const sub = await talkbox.subscribe(async (msg) => {
        spinner.stop();

        if (msg.event.kind === 20001) {
            console.log(`[${new Date().toLocaleTimeString()}] > ${msg.content}`);

            if (shell && shell.stdin.writable) {
                // Write command to shell stdin
                shell.stdin.write(msg.content + '\n');
            } else {
                console.error('[!] Shell not ready or stdin not writable');
            }
        }
    }, {
        kinds: [20001],
        decrypt: true
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