#!/usr/bin/env node
// Thin wrapper: ensure bytedance-mini-game build is present, then run
//   tmg preview -o <qr.png> <dist>
// Outputs QR at e2e/dist/bytedance-mini-game.preview.png for easy scanning.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist/bytedance-mini-game');
const QR_OUT = path.resolve(__dirname, '../dist/bytedance-mini-game.preview.png');

if (!fs.existsSync(path.join(DIST, 'game.json'))) {
  console.log('[preview:tt] no build found, running build-bytedance first');
  const build = spawnSync(process.execPath, [path.join(__dirname, 'build-bytedance.mjs')], {
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    console.error('[preview:tt] build step failed; abort');
    process.exit(build.status ?? 1);
  }
}

console.log('[preview:tt] running tmg preview');
console.log('[preview:tt]   entry:', DIST);
console.log('[preview:tt]   qr out:', QR_OUT);

const tmgBin = process.platform === 'win32' ? 'tmg.cmd' : 'tmg';
const p = spawn(tmgBin, ['preview', '-o', QR_OUT, DIST], {
  stdio: 'inherit',
  shell: true,
});
p.on('exit', (code) => {
  if (code === 0 && fs.existsSync(QR_OUT)) {
    console.log(`[preview:tt] QR saved → ${QR_OUT}`);
    console.log('[preview:tt] scan it with the 抖音 App to open the experience build');
  }
  process.exit(code ?? 1);
});
