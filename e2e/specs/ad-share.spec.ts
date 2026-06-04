import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';

test.describe('tt mock: rewarded video + share', () => {
  test('TC-PLAT-AD-001: rewarded video watched fully → isEnded=true', async ({ page }) => {
    await installTtMock(page, { rewardedAd: { isEnded: true } });
    await page.goto('/');
    const result = await page.evaluate(
      () =>
        new Promise<any>((resolve) => {
          const ad = (window as any).tt.createRewardedVideoAd();
          ad.onClose((info: any) => resolve(info));
          ad.load();
          ad.show();
        }),
    );
    expect(result).toEqual({ isEnded: true });
  });

  test('TC-PLAT-AD-002: user closes early → isEnded=false', async ({ page }) => {
    await installTtMock(page, { rewardedAd: { isEnded: false } });
    await page.goto('/');
    const result = await page.evaluate(
      () =>
        new Promise<any>((resolve) => {
          const ad = (window as any).tt.createRewardedVideoAd();
          ad.onClose(resolve);
          ad.load();
          ad.show();
        }),
    );
    expect(result).toEqual({ isEnded: false });
  });

  test('TC-PLAT-AD-003: load error → onError fires', async ({ page }) => {
    await installTtMock(page, { rewardedAd: 'loadError' });
    await page.goto('/');
    const err = await page.evaluate(
      () =>
        new Promise<any>((resolve) => {
          const ad = (window as any).tt.createRewardedVideoAd();
          ad.onError(resolve);
          ad.load();
        }),
    );
    expect(err.errMsg).toMatch(/load fail/);
  });

  test('TC-PLAT-SHARE-001: share success callback', async ({ page }) => {
    await installTtMock(page, { shareResult: 'success' });
    await page.goto('/');
    const ok = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          (window as any).tt.shareAppMessage({
            success: () => resolve(true),
            fail: () => resolve(false),
          });
        }),
    );
    expect(ok).toBe(true);
  });

  test('TC-PLAT-SHARE-002: share cancel → fail callback', async ({ page }) => {
    await installTtMock(page, { shareResult: 'cancel' });
    await page.goto('/');
    const ok = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          (window as any).tt.shareAppMessage({
            success: () => resolve(true),
            fail: () => resolve(false),
          });
        }),
    );
    expect(ok).toBe(false);
  });
});
