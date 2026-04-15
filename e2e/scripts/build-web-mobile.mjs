import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist/web-mobile');
const COCOS = process.env.COCOS_CREATOR_PATH;

if (fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('[build] cached web-mobile exists, skipping');
  process.exit(0);
}

if (!COCOS || !fs.existsSync(COCOS)) {
  console.warn('[build] COCOS_CREATOR_PATH not set or invalid, building fallback shell');
  await import('./build-fallback-shell.mjs');
  process.exit(0);
}

const projectDir = path.resolve(__dirname, '../../client');
const outputDir = path.resolve(__dirname, '../dist');
const args = [
  '--project', projectDir,
  '--build', `platform=web-mobile;buildPath=${outputDir}`,
];

console.log('[build] invoking Cocos Creator:', COCOS, args.join(' '));
const p = spawn(COCOS, args, { stdio: 'inherit' });
p.on('exit', code => process.exit(code ?? 1));
