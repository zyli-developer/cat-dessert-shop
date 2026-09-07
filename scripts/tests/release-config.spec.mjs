import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseClientConfig,
  validateAppIdentity,
  validateBuiltArtifact,
  validateReleaseConfig,
} from '../release-config.mjs';

const validAdIds = {
  gameGold: '998877001',
  winDouble: '998877002',
  failRevive: '998877003',
  homeCatCoin: '998877004',
  dailyGift: '998877005',
};

function adSource(mock = false, ids = validAdIds) {
  return `
    export const MOCK_REWARDED_ADS = ${mock};
    export const REWARDED_AD_UNIT_ID = '${ids.gameGold}';
    export const AD_UNIT_IDS = {
      gameGold: '${ids.gameGold}',
      winDouble: '${ids.winDouble}',
      failRevive: '${ids.failRevive}',
      homeCatCoin: '${ids.homeCatCoin}',
      dailyGift: '${ids.dailyGift}',
    } as const;
  `;
}

describe('release-config', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parses the TypeScript config source without executing Cocos modules', () => {
    expect(parseClientConfig(
      "export const API_BASE_URL = 'https://api.catbakery.cn';",
      adSource(),
    )).toEqual({
      apiBaseUrl: 'https://api.catbakery.cn',
      mockRewardedAds: false,
      adUnitIds: validAdIds,
    });
  });

  it('rejects local, temporary and placeholder release values', () => {
    const config = parseClientConfig(
      "export const API_BASE_URL = 'https://demo.trycloudflare.com';",
      adSource(true, {
        gameGold: 'game_ad_gold', winDouble: 'test-ad-2', failRevive: '',
        homeCatCoin: 'xxx', dailyGift: 'home_daily_gift',
      }),
    );
    const errors = validateReleaseConfig(config);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/临时隧道/),
      expect.stringMatching(/MOCK_REWARDED_ADS/),
      expect.stringMatching(/gameGold/),
      expect.stringMatching(/dailyGift/),
    ]));
  });

  it('accepts an HTTPS public API and configured ad IDs', () => {
    const config = parseClientConfig(
      "export const API_BASE_URL = 'https://api.catbakery.cn';",
      adSource(),
    );
    expect(validateReleaseConfig(config)).toEqual([]);
  });

  it('supports one shared rewarded-video ID for every reward entry', () => {
    const source = `
      export const MOCK_REWARDED_ADS = false;
      export const REWARDED_AD_UNIT_ID = '998877001';
      export const AD_UNIT_IDS = {
        gameGold: REWARDED_AD_UNIT_ID,
        winDouble: REWARDED_AD_UNIT_ID,
        failRevive: REWARDED_AD_UNIT_ID,
        homeCatCoin: REWARDED_AD_UNIT_ID,
        dailyGift: REWARDED_AD_UNIT_ID,
      } as const;
    `;
    const config = parseClientConfig(
      "export const API_BASE_URL = 'https://api.catbakery.cn';",
      source,
    );
    expect(new Set(Object.values(config.adUnitIds))).toEqual(new Set(['998877001']));
    expect(validateReleaseConfig(config)).toEqual([]);
  });

  it('detects a stale or incomplete built artifact', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catbakery-release-config-'));
    tempDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'game.json'), '{}');
    fs.writeFileSync(path.join(dir, 'index.js'), [
      'https://api.catbakery.cn',
      ...Object.values(validAdIds),
    ].join('|'));

    const config = {
      apiBaseUrl: 'https://api.catbakery.cn',
      mockRewardedAds: false,
      adUnitIds: validAdIds,
    };
    expect(validateBuiltArtifact(dir, config)).toEqual([]);

    fs.writeFileSync(path.join(dir, 'index.js'), 'old bundle');
    expect(validateBuiltArtifact(dir, config)).toEqual(expect.arrayContaining([
      expect.stringMatching(/可能是旧包/),
    ]));
  });

  it('requires the backend and built client to use the same Douyin app', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catbakery-app-id-'));
    tempDirs.push(root);
    const dist = path.join(root, 'dist');
    fs.mkdirSync(dist);
    fs.writeFileSync(path.join(root, '.env'), 'DOUYIN_APP_ID=ttserverapp\n');
    fs.writeFileSync(path.join(dist, 'project.config.json'), JSON.stringify({
      appid: 'ttclientapp',
      compileType: 'miniGame',
    }));
    expect(validateAppIdentity(root, dist)).toEqual([
      '客户端 App ID 与根目录 .env 的 DOUYIN_APP_ID 不一致',
    ]);

    fs.writeFileSync(path.join(root, '.env'), 'DOUYIN_APP_ID=ttclientapp\n');
    expect(validateAppIdentity(root, dist)).toEqual([]);
  });
});
