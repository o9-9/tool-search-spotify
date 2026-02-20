import esbuild from 'esbuild';
import path from 'path';

const root = path.join(import.meta.dirname, '..');

await Promise.all((['cjs', 'esm'] as const).map(async (format) => await esbuild.build({
    entryPoints: [path.join(root, 'src', 'index.ts')],
    outfile: path.join(root, 'dist', 'index.' + (format === 'cjs' ? 'cjs' : 'mjs')),
    bundle: true,
    minify: false,
    keepNames: true,
    platform: 'node',
    format
})));

console.log('build completed!');