import type { Page } from '@playwright/test';

export interface TtMockConfig {
  loginCode?: string;
  loginFails?: boolean;
  rewardedAd?: { isEnded: boolean } | 'loadError';
  shareResult?: 'success' | 'cancel' | 'fail';
}

export async function installTtMock(page: Page, cfg: TtMockConfig = {}): Promise<void> {
  await page.addInitScript((config) => {
    const store = new Map<string, any>();
    const calls = { share: [] as any[], navigate: [] as any[] };
    (window as any).__ttMockCalls = calls;
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
        calls.share.push({
          title: opts.title,
          desc: opts.desc,
          query: opts.query,
          channel: opts.channel,
          templateId: opts.templateId,
        });
        if (config.shareResult === 'cancel') opts.fail?.({ errNo: 10502, errMsg: 'share:cancel' });
        else if (config.shareResult === 'fail') opts.fail?.({ errNo: 10103, errMsg: 'network unavailable' });
        else opts.success?.({});
      },
      showShareMenu: (opts: any = {}) => opts.success?.(),
      onShareAppMessage: (handler: Function) => { (window as any).__ttPassiveShare = handler; },
      checkScene: (opts: any) => opts.success?.({ isExist: opts.scene === 'sidebar' }),
      navigateToScene: (opts: any) => {
        calls.navigate.push({ scene: opts.scene });
        opts.success?.({});
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
