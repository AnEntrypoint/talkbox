import 'websocket-polyfill';
import Talkbox from '../lib/index.js';

import { exec } from 'child_process';
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

    // Subscribe to ephemeral events (kind 20000-29999)
    // We'll use 20001 for commands and 20002 for responses
    const sub = await talkbox.subscribe(async (msg) => {
        spinner.stop();

        // Only process messages that aren't from us (if possible to distinguish, but here we share identity)
        // In shared identity mode, we might see our own responses if we don't filter.
        // But since we use kind 20001 for commands and 20002 for responses, we won't loop.

        if (msg.event.kind === 20001) {
            console.log(`[${new Date().toLocaleTimeString()}] > ${msg.content}`);

            const execSpinner = ora('Executing...').start();
            exec(msg.content, async (error, stdout, stderr) => {
                execSpinner.stop();

                const output = stdout || stderr || (error ? error.message : '(no output)');

                if (stdout) console.log(stdout);
                if (stderr) console.error(stderr);
                if (error && !stderr && !stdout) console.error(error.message);

                await talkbox.post(output, {
                    encrypt: true,
                    kind: 20002, // Response
                    client: 'talkbox-cli-terminal'
                });

                console.log(`[✓] Response sent back encrypted.`);
                spinner.start('Waiting for next command...');
            });
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