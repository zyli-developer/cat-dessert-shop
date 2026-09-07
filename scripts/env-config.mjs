import fs from 'node:fs';
import path from 'node:path';

export const CLIENT_ENV_KEYS = [
  'CLIENT_API_BASE_URL',
  'REWARDED_AD_UNIT_ID',
  'MOCK_REWARDED_ADS',
];

const INITIAL_ENV_GROUPS = [
  {
    title: '客户端公开配置（会编译进小游戏包，禁止在这里放密钥）',
    values: {
      CLIENT_API_BASE_URL: 'https://jingjingyeye.vip:8099',
      REWARDED_AD_UNIT_ID: '',
      MOCK_REWARDED_ADS: 'false',
    },
  },
  {
    title: '抖音小游戏服务端凭据',
    values: {
      DOUYIN_APP_ID: '',
      DOUYIN_APP_SECRET: '',
    },
  },
  {
    title: '服务端与数据库配置',
    values: {
      AUTH_TOKEN_SECRET: '',
      AUTH_TOKEN_TTL_SECONDS: '604800',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/catbakery',
      PORT: '3333',
      HOST: '0.0.0.0',
      NODE_ENV: 'development',
      AUTH_CODE_EXCHANGER: '',
    },
  },
];

function unquote(rawValue) {
  const value = rawValue.trim();
  if (value.length < 2) return value;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) return value;
  const inner = value.slice(1, -1);
  if (quote === "'") return inner.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  try {
    return JSON.parse(value);
  } catch {
    return inner;
  }
}

/** Parse the dotenv subset used by this project without mutating process.env. */
export function parseEnv(source) {
  const values = {};
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let rawValue = match[2].trim();
    if (!rawValue.startsWith('"') && !rawValue.startsWith("'")) {
      rawValue = rawValue.replace(/\s+#.*$/, '').trim();
    }
    values[match[1]] = unquote(rawValue);
  }
  return values;
}

function formatEnvValue(value) {
  const text = String(value);
  if (!text) return '';
  if (/\s|#|["']/.test(text)) return JSON.stringify(text);
  return text;
}

export function setEnvValues(source, updates) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let next = source;
  for (const [key, value] of Object.entries(updates)) {
    const rendered = `${key}=${formatEnvValue(value)}`;
    const re = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'm');
    if (re.test(next)) next = next.replace(re, rendered);
    else next = `${next.replace(/\s*$/, '')}${newline}${rendered}${newline}`;
  }
  return next;
}

export function initializeEnv(source) {
  const existing = parseEnv(source);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let next = source.replace(/\s*$/, '');
  for (const group of INITIAL_ENV_GROUPS) {
    const missing = Object.entries(group.values).filter(([key]) => !(key in existing));
    if (!missing.length) continue;
    next += `${next ? `${newline}${newline}` : ''}# ${group.title}${newline}`;
    next += missing.map(([key, value]) => `${key}=${formatEnvValue(value)}`).join(newline);
  }
  return `${next}${newline}`;
}

function replaceExport(source, name, value) {
  const rendered = typeof value === 'boolean' ? String(value) : JSON.stringify(value);
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(?:true|false|(['"])(?:\\\\.|(?!\\1).)*\\1)\\s*;`);
  if (!re.test(source)) throw new Error(`无法在客户端配置中找到 ${name}`);
  return source.replace(re, `export const ${name} = ${rendered};`);
}

export function readClientEnv(envSource) {
  const env = parseEnv(envSource);
  const missing = CLIENT_ENV_KEYS.filter((key) => !(key in env));
  if (missing.length) throw new Error(`根目录 .env 缺少：${missing.join(', ')}；请先运行 npm run config:init`);
  if (!env.CLIENT_API_BASE_URL.trim()) throw new Error('CLIENT_API_BASE_URL 不能为空');
  if (!['true', 'false'].includes(env.MOCK_REWARDED_ADS.toLowerCase())) {
    throw new Error('MOCK_REWARDED_ADS 只能是 true 或 false');
  }
  return {
    apiBaseUrl: env.CLIENT_API_BASE_URL.replace(/\/+$/, ''),
    rewardedAdUnitId: env.REWARDED_AD_UNIT_ID.trim(),
    mockRewardedAds: env.MOCK_REWARDED_ADS.toLowerCase() === 'true',
  };
}

export function renderClientSources({ apiSource, adSource, config }) {
  return {
    apiSource: replaceExport(apiSource, 'API_BASE_URL', config.apiBaseUrl),
    adSource: replaceExport(
      replaceExport(adSource, 'MOCK_REWARDED_ADS', config.mockRewardedAds),
      'REWARDED_AD_UNIT_ID',
      config.rewardedAdUnitId,
    ),
  };
}

export function syncClientConfig({ repoRoot, envPath = path.join(repoRoot, '.env'), write = true }) {
  if (!fs.existsSync(envPath)) throw new Error(`找不到 ${envPath}；请先复制 .env.example 为 .env`);
  const apiPath = path.join(repoRoot, 'client', 'assets', 'scenes', 'scripts', 'net', 'ApiConfig.ts');
  const adPath = path.join(repoRoot, 'client', 'assets', 'scenes', 'scripts', 'platform', 'AdConfig.ts');
  const config = readClientEnv(fs.readFileSync(envPath, 'utf8'));
  const current = {
    apiSource: fs.readFileSync(apiPath, 'utf8'),
    adSource: fs.readFileSync(adPath, 'utf8'),
  };
  const rendered = renderClientSources({ ...current, config });
  const changed = [];
  if (current.apiSource !== rendered.apiSource) changed.push(path.relative(repoRoot, apiPath));
  if (current.adSource !== rendered.adSource) changed.push(path.relative(repoRoot, adPath));
  if (write) {
    if (current.apiSource !== rendered.apiSource) fs.writeFileSync(apiPath, rendered.apiSource);
    if (current.adSource !== rendered.adSource) fs.writeFileSync(adPath, rendered.adSource);
  }
  return { config, changed };
}
