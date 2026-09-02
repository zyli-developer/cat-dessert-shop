#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeEnv, syncClientConfig } from './env-config.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(repoRoot, '.env');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

try {
  if (args.has('--init')) {
    const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const initialized = initializeEnv(current);
    if (current !== initialized) {
      fs.writeFileSync(envPath, initialized);
      console.log('[env-config] 已在根目录 .env 补齐缺少的配置键（已有值未改动）');
    } else {
      console.log('[env-config] 根目录 .env 已包含全部配置键');
    }
  }

  const { config, changed } = syncClientConfig({ repoRoot, write: !checkOnly });
  if (checkOnly && changed.length) {
    console.error('[env-config] 客户端配置与根目录 .env 不一致：');
    for (const file of changed) console.error(`  - ${file}`);
    console.error('请运行 npm run config:sync');
    process.exit(1);
  }
  if (!checkOnly && changed.length) {
    console.log(`[env-config] 已同步客户端公开配置：${changed.join(', ')}`);
  } else if (!changed.length) {
    console.log('[env-config] 客户端公开配置已是最新状态');
  }
  if (!config.rewardedAdUnitId) {
    console.warn('[env-config] 提醒：REWARDED_AD_UNIT_ID 仍为空，正式发布检查会失败');
  }
} catch (error) {
  console.error(`[env-config] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
