import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initializeEnv,
  parseEnv,
  readClientEnv,
  renderClientSources,
  setEnvValues,
  syncClientConfig,
} from '../env-config.mjs';

describe('env-config', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parses quoted values and comments', () => {
    expect(parseEnv([
      'PLAIN=value',
      'QUOTED="hello world"',
      "SINGLE='a # b'",
      'COMMENTED=value # comment',
    ].join('\n'))).toEqual({
      PLAIN: 'value',
      QUOTED: 'hello world',
      SINGLE: 'a # b',
      COMMENTED: 'value',
    });
  });

  it('initializes missing keys without overwriting secrets', () => {
    const source = 'DOUYIN_APP_SECRET=keep-me\nCLIENT_API_BASE_URL=https://old.example.cn\n';
    const result = initializeEnv(source);
    const parsed = parseEnv(result);
    expect(parsed.DOUYIN_APP_SECRET).toBe('keep-me');
    expect(parsed.CLIENT_API_BASE_URL).toBe('https://old.example.cn');
    expect(parsed.REWARDED_AD_UNIT_ID).toBe('');
    expect(parsed.AUTH_TOKEN_TTL_SECONDS).toBe('604800');
  });

  it('creates a complete env file from an empty source', () => {
    const parsed = parseEnv(initializeEnv(''));
    expect(parsed).toEqual(expect.objectContaining({
      CLIENT_API_BASE_URL: 'https://jingjingyeye.vip:8099',
      REWARDED_AD_UNIT_ID: '',
      MOCK_REWARDED_ADS: 'false',
      DOUYIN_APP_ID: '',
      DOUYIN_APP_SECRET: '',
      AUTH_TOKEN_SECRET: '',
      AUTH_TOKEN_TTL_SECONDS: '604800',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/catbakery',
      PORT: '3333',
      HOST: '0.0.0.0',
      NODE_ENV: 'development',
      AUTH_CODE_EXCHANGER: '',
    }));
  });

  it('updates one env value without changing unrelated values', () => {
    const result = setEnvValues('SECRET=keep\nCLIENT_API_BASE_URL=http://old\n', {
      CLIENT_API_BASE_URL: 'https://jingjingyeye.vip:8099',
    });
    expect(parseEnv(result)).toEqual({
      SECRET: 'keep',
      CLIENT_API_BASE_URL: 'https://jingjingyeye.vip:8099',
    });
  });

  it('renders only the allowlisted client values', () => {
    const config = readClientEnv([
      'CLIENT_API_BASE_URL=https://jingjingyeye.vip:8099/',
      'REWARDED_AD_UNIT_ID=123456789',
      'MOCK_REWARDED_ADS=false',
      'DOUYIN_APP_SECRET=must-not-leak',
    ].join('\n'));
    const rendered = renderClientSources({
      apiSource: "export const API_BASE_URL = 'old';\n",
      adSource: "export const MOCK_REWARDED_ADS = true;\nexport const REWARDED_AD_UNIT_ID = 'old';\n",
      config,
    });
    expect(rendered.apiSource).toContain('"https://jingjingyeye.vip:8099"');
    expect(rendered.adSource).toContain('REWARDED_AD_UNIT_ID = "123456789"');
    expect(`${rendered.apiSource}${rendered.adSource}`).not.toContain('must-not-leak');
  });

  it('detects stale generated files in check mode', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catbakery-env-config-'));
    tempDirs.push(root);
    const apiDir = path.join(root, 'client', 'assets', 'scenes', 'scripts', 'net');
    const adDir = path.join(root, 'client', 'assets', 'scenes', 'scripts', 'platform');
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(adDir, { recursive: true });
    fs.writeFileSync(path.join(root, '.env'), [
      'CLIENT_API_BASE_URL=https://api.example.cn',
      'REWARDED_AD_UNIT_ID=987654321',
      'MOCK_REWARDED_ADS=false',
    ].join('\n'));
    fs.writeFileSync(path.join(apiDir, 'ApiConfig.ts'), "export const API_BASE_URL = 'old';\n");
    fs.writeFileSync(path.join(adDir, 'AdConfig.ts'), [
      'export const MOCK_REWARDED_ADS = true;',
      "export const REWARDED_AD_UNIT_ID = 'old';",
    ].join('\n'));

    expect(syncClientConfig({ repoRoot: root, write: false }).changed).toHaveLength(2);
    syncClientConfig({ repoRoot: root });
    expect(syncClientConfig({ repoRoot: root, write: false }).changed).toEqual([]);
  });
});
