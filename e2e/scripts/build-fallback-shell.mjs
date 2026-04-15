import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../dist/web-mobile');
fs.mkdirSync(outDir, { recursive: true });

const staticDir = path.resolve(__dirname, '../static');
fs.copyFileSync(path.join(staticDir, 'shell.html'), path.join(outDir, 'index.html'));

const entry = path.resolve(__dirname, '../static/app.ts');
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: 'CatBakery',
  outfile: path.join(outDir, 'app.js'),
  loader: { '.ts': 'ts' },
  platform: 'browser',
  target: 'es2020',
  tsconfig: path.resolve(__dirname, '../tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"test"' },
});

console.log('[build] fallback shell written to', outDir);
