#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AD_SLOT_KEYS = [
  'gameGold',
  'winDouble',
  'failRevive',
  'homeCatCoin',
  'dailyGift',
];

const DEVELOPMENT_AD_IDS = new Set([
  'game_ad_gold',
  'win_double',
  'fail_revive',
  'home_catcoin',
  'home_daily_gift',
  'rewarded_video_ad',
]);

const TEMPORARY_API_HOSTS = [
  /(?:^|\.)trycloudflare\.com$/i,
  /(?:^|\.)ngrok(?:-free)?\.(?:app|io)$/i,
  /(?:^|\.)loca\.lt$/i,
  /(?:^|\.)localhost\.run$/i,
  /(?:^|\.)tunnelmole\.net$/i,
];

function parseStringExport(source, name) {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(['"])(.*?)\\1\\s*;`, 's'));
  if (!match) throw new Error(`无法解析 ${name}`);
  return match[2];
}

function parseBooleanExport(source, name) {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(true|false)\\s*;`));
  if (!match) throw new Error(`无法解析 ${name}`);
  return match[1] === 'true';
}

export function parseClientConfig(apiSource, adSource) {
  const objectMatch = adSource.match(/export\s+const\s+AD_UNIT_IDS\s*=\s*\{([\s\S]*?)\}\s+as\s+const\s*;/);
  if (!objectMatch) throw new Error('无法解析 AD_UNIT_IDS');

  const adUnitIds = {};
  const sharedRewardedId = parseStringExport(adSource, 'REWARDED_AD_UNIT_ID');
  for (const key of AD_SLOT_KEYS) {
    const match = objectMatch[1].match(
      new RegExp(`${key}\\s*:\\s*(?:(['"])(.*?)\\1|(REWARDED_AD_UNIT_ID))`),
    );
    if (!match) throw new Error(`AD_UNIT_IDS 缺少 ${key}`);
    adUnitIds[key] = match[3] ? sharedRewardedId : match[2];
  }

  return {
    apiBaseUrl: parseStringExport(apiSource, 'API_BASE_URL'),
    mockRewardedAds: parseBooleanExport(adSource, 'MOCK_REWARDED_ADS'),
    adUnitIds,
  };
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254);
}

function isPlaceholderAdId(value) {
  const normalized = value.trim().toLowerCase();
  return !normalized ||
    DEVELOPMENT_AD_IDS.has(normalized) ||
    /(?:placeholder|test[-_]?ad|your[-_]?ad|demo|xxx)/.test(normalized);
}

export function validateReleaseConfig(config) {
  const errors = [];
  let apiUrl;
  try {
    apiUrl = new URL(config.apiBaseUrl);
  } catch {
    errors.push(`API_BASE_URL 不是有效 URL：${config.apiBaseUrl || '<empty>'}`);
  }

  if (apiUrl) {
    const hostname = apiUrl.hostname.toLowerCase();
    if (apiUrl.protocol !== 'https:') errors.push('API_BASE_URL 正式环境必须使用 HTTPS');
    if (apiUrl.username || apiUrl.password) errors.push('API_BASE_URL 不得包含用户名或密码');
    if (apiUrl.search || apiUrl.hash) errors.push('API_BASE_URL 不得包含 query 或 hash');
    if (
      hostname === 'localhost' || hostname === '::1' ||
      hostname.endsWith('.local') || isPrivateIpv4(hostname)
    ) {
      errors.push(`API_BASE_URL 指向本地或私有网络：${hostname}`);
    }
    if (TEMPORARY_API_HOSTS.some((pattern) => pattern.test(hostname))) {
      errors.push(`API_BASE_URL 使用临时隧道域名：${hostname}`);
    }
    if (/^(?:example|your-domain|api-domain)\./i.test(hostname) || hostname.endsWith('.example.com')) {
      errors.push(`API_BASE_URL 仍是示例域名：${hostname}`);
    }
  }

  if (config.mockRewardedAds) errors.push('MOCK_REWARDED_ADS 必须为 false');
  const invalidAds = AD_SLOT_KEYS
    .map((key) => [key, String(config.adUnitIds[key] ?? '')])
    .filter(([, value]) => isPlaceholderAdId(value));
  if (
    invalidAds.length === AD_SLOT_KEYS.length &&
    new Set(invalidAds.map(([, value]) => value)).size === 1
  ) {
    errors.push(`REWARDED_AD_UNIT_ID 仍是开发占位值：${invalidAds[0][1] || '<empty>'}`);
  } else {
    for (const [key, value] of invalidAds) {
      errors.push(`AD_UNIT_IDS.${key} 仍是开发占位值：${value || '<empty>'}`);
    }
  }
  return errors;
}

export function loadClientConfig(repoRoot) {
  const apiPath = path.join(repoRoot, 'client', 'assets', 'scenes', 'scripts', 'net', 'ApiConfig.ts');
  const adPath = path.join(repoRoot, 'client', 'assets', 'scenes', 'scripts', 'platform', 'AdConfig.ts');
  return parseClientConfig(fs.readFileSync(apiPath, 'utf8'), fs.readFileSync(adPath, 'utf8'));
}

function walkTextFiles(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTextFiles(target, visit);
    else if (/\.(?:js|json)$/i.test(entry.name)) visit(target);
  }
}

export function validateBuiltArtifact(distDir, config) {
  const errors = [];
  if (!fs.existsSync(path.join(distDir, 'game.json'))) {
    return [`抖音构建产物缺少 game.json：${distDir}`];
  }

  const required = new Set([
    config.apiBaseUrl,
    ...Object.values(config.adUnitIds),
  ]);
  walkTextFiles(distDir, (file) => {
    if (!required.size) return;
    const source = fs.readFileSync(file, 'utf8');
    for (const value of required) {
      if (source.includes(value)) required.delete(value);
    }
  });
  for (const value of required) {
    errors.push(`构建产物未包含当前配置值，可能是旧包：${value}`);
  }
  return errors;
}

export function checkReleaseConfig({ repoRoot, distDir } = {}) {
  const resolvedRoot = repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = loadClientConfig(resolvedRoot);
  const errors = validateReleaseConfig(config);
  if (distDir) errors.push(...validateBuiltArtifact(path.resolve(distDir), config));
  return { config, errors };
}

function runCli() {
  const args = process.argv.slice(2);
  const distIndex = args.indexOf('--dist');
  const distDir = distIndex >= 0 ? args[distIndex + 1] : undefined;
  if (distIndex >= 0 && !distDir) {
    console.error('[release-config] --dist 需要目录参数');
    process.exit(2);
  }

  try {
    const { config, errors } = checkReleaseConfig({ distDir });
    if (errors.length) {
      console.error('[release-config] 正式配置检查失败：');
      for (const error of errors) console.error(`  - ${error}`);
      process.exit(1);
    }
    const adCount = new Set(Object.values(config.adUnitIds)).size;
    console.log(`[release-config] 正式配置有效：${new URL(config.apiBaseUrl).hostname}，广告位 ${adCount} 个`);
  } catch (error) {
    console.error(`[release-config] 无法检查配置：${error instanceof Error ? error.message : error}`);
    process.exit(2);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) runCli();
