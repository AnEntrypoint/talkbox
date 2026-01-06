import * as esbuild from 'esbuild';

esbuild.build({
    entryPoints: ['lib/index.js'],
    bundle: true,
    outfile: 'dist/talkbox-lib.js',
    format: 'iife', // Immediately Invoked Function Expression for direct browser script tag usage
    globalName: 'TalkboxLib', // Internal variable name if needed, but we attach to window manually in code
    minify: true,
    sourcemap: true,
    platform: 'browser',
    target: ['es2020'],
    external: ['crypto', 'node:crypto'],
    define: {
        'global': 'window'
    }
}).catch(() => process.exit(1));

console.log('Build complete: dist/talkbox-lib.js');
