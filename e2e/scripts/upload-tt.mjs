#!/usr/bin/env node
// Upload the Cocos Creator build that was manually tested in Douyin DevTools.
// Usage:
//   node scripts/upload-tt.mjs <version> "<changelog>"
// Example:
//   node scripts/upload-tt.mjs 0.0.1 "auto upload via CI"

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.TT_BUILD_DIR
  ? path.resolve(process.env.TT_BUILD_DIR)
  : path.resolve(__dirname, '../../client/build/bytedance-mini-game');
const QR_OUT = path.resolve(__dirname, '../dist/bytedance-mini-game.upload.png');
const RELEASE_CHECK = path.resolve(__dirname, '../../scripts/release-config.mjs');

const [, , version, changelog] = process.argv;
if (!version) {
  console.error('usage: upload-tt.mjs <version> "<changelog>"');
  console.error('example: upload-tt.mjs 0.0.1 "first automated upload"');
  process.exit(2);
}

if (!fs.existsSync(path.join(DIST, 'game.json'))) {
  console.error(`[upload:tt] 找不到已测试的 Cocos 构建：${DIST}`);
  console.error('[upload:tt] 请先在 Cocos Creator 构建并完成抖音开发者工具/真机测试');
  process.exit(1);
}

// 上传必须同时验证源码配置与产物中的实际字符串，防止缓存旧包被误传。
const configCheck = spawnSync(process.execPath, [RELEASE_CHECK, '--dist', DIST], {
  stdio: 'inherit',
});
if (configCheck.status !== 0) {
  console.error('[upload:tt] 正式配置或构建新鲜度检查失败，已取消上传');
  process.exit(configCheck.status ?? 1);
}

console.log('[upload:tt] running tmg upload');
console.log('[upload:tt]   entry  :', DIST);
console.log('[upload:tt]   version:', version);
console.log('[upload:tt]   log    :', changelog ?? '<none>');

const args = [
  'upload',
  '-v',
  version,
  '-o',
  QR_OUT,
  ...(changelog ? ['-c', changelog] : []),
  DIST,
];

const tmgBin = process.platform === 'win32' ? 'tmg.cmd' : 'tmg';
const p = spawn(tmgBin, args, { stdio: 'inherit', shell: true });
p.on('exit', (code) => {
  if (code === 0 && fs.existsSync(QR_OUT)) {
    console.log(`[upload:tt] upload OK, QR → ${QR_OUT}`);
  }
  process.exit(code ?? 1);
});
