import fs from 'fs';
import path from 'path';

const copyDir = (src, dest) => {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
};

try {
    console.log('Preparing GitHub Pages deployment...');

    // Copy public contents to root
    copyDir('public', '.');

    // Ensure cli directory exists at root and has its index.html
    if (!fs.existsSync('cli')) fs.mkdirSync('cli');
    // Note: We don't want to overwrite the CLI tool js file if it's there?
    // Actually our CLI tool is in cli/index.js. The web page is in public/cli/index.html.
    // To avoid conflict, we can name the web page terminal.html or keep it as cli/index.html if we don't mind.
    // But cli/index.js exists.

    console.log('Deployment files prepared at root.');
} catch (e) {
    console.error('Error preparing deployment:', e);
    process.exit(1);
}
