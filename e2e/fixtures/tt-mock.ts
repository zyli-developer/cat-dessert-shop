import type { Page } from '@playwright/test';

export interface TtMockConfig {
  loginCode?: string;
  loginFails?: boolean;
  rewardedAd?: { isEnded: boolean } | 'loadError';
  shareResult?: 'success' | 'cancel';
}

export async function installTtMock(page: Page, cfg: TtMockConfig = {}): Promise<void> {
  await page.addInitScript((config) => {
    const store = new Map<string, any>();
    (window as any).tt = {
      login: (opts: any) => {
        if (config.loginFails) opts.fail?.({ errMsg: 'login:fail' });
        else opts.success?.({ code: config.loginCode ?? 'test-code-e2e' });
      },
      getStorageSync: (k: string) => store.get(k) ?? '',
      setStorageSync: (k: string, v: any) => store.set(k, v),
      removeStorageSync: (k: string) => store.delete(k),
      getLaunchOptionsSync: () => ({ query: {}, scene: 1001 }),
      shareAppMessage: (opts: any) => {
        if (config.shareResult === 'cancel') opts.fail?.({ errMsg: 'share:cancel' });
        else opts.success?.({});
      },
      createRewardedVideoAd: () => {
        const cbs: Record<string, Function[]> = { load: [], error: [], close: [] };
        return {
          load: () => {
            if (config.rewardedAd === 'loadError') cbs.error.forEach(f => f({ errMsg: 'load fail' }));
            else cbs.load.forEach(f => f());
          },
          show: () => {
            const r = config.rewardedAd;
            if (r && r !== 'loadError') cbs.close.forEach(f => f({ isEnded: r.isEnded }));
          },
          onLoad: (f: Function) => cbs.load.push(f),
          onError: (f: Function) => cbs.error.push(f),
          onClose: (f: Function) => cbs.close.push(f),
        };
      },
      request: (opts: any) => {
        fetch(opts.url, { method: opts.method ?? 'GET', body: opts.data ? JSON.stringify(opts.data) : undefined, headers: opts.header })
          .then(r => r.json())
          .then(data => opts.success?.({ data, statusCode: 200 }))
          .catch(err => opts.fail?.(err));
      },
    };
  }, cfg);
}
