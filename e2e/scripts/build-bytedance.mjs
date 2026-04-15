#!/usr/bin/env node
// Cocos Creator headless build for the bytedance-mini-game target.
// Produces e2e/dist/bytedance-mini-game/{project.config.json,game.json,src,assets,...}
// suitable as input to `tmg preview` / `tmg upload`.
//
// Honours cache: if index of a Cocos build already exists, skips unless FORCE=1.
// Requires env: COCOS_CREATOR_PATH (absolute path to CocosCreator.exe).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist/bytedance-mini-game');
const MARKER = path.join(DIST, 'game.json');
const COCOS = process.env.COCOS_CREATOR_PATH;
const FORCE = process.env.FORCE === '1';

if (!FORCE && fs.existsSync(MARKER)) {
  console.log('[build:tt] cached bytedance-mini-game exists, skipping (FORCE=1 to rebuild)');
  process.exit(0);
}

if (!COCOS || !fs.existsSync(COCOS)) {
  console.error('[build:tt] COCOS_CREATOR_PATH not set or invalid');
  console.error('[build:tt] set it to your CocosCreator.exe, e.g.');
  console.error('[build:tt]   set COCOS_CREATOR_PATH=C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8\\CocosCreator.exe');
  process.exit(1);
}

const projectDir = path.resolve(__dirname, '../../client');
const outputDir = path.resolve(__dirname, '../dist');
const args = [
  '--project',
  projectDir,
  '--build',
  `platform=bytedance-mini-game;buildPath=${outputDir}`,
];

console.log('[build:tt] invoking Cocos Creator');
console.log('[build:tt]   bin :', COCOS);
console.log('[build:tt]   proj:', projectDir);
console.log('[build:tt]   out :', outputDir);

const t0 = Date.now();
const p = spawn(COCOS, args, { stdio: 'inherit' });
p.on('exit', (code) => {
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  // Cocos Creator sometimes exits non-zero (ports left in use, orphan
  // subprocesses) even after writing the build artifact successfully.
  // Trust the file marker over the exit code.
  if (fs.existsSync(MARKER)) {
    console.log(`[build:tt] build complete in ${dt}s → ${DIST} (cocos exit=${code})`);
    process.exit(0);
  }
  console.error(`[build:tt] build failed (exit=${code}, elapsed=${dt}s, marker=${MARKER} missing)`);
  process.exit(code ?? 1);
});
