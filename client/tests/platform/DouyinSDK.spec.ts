/**
 * DouyinSDK dev-mode fallback anchors (TC-PLAT-SDK-004).
 *
 * These are CHARACTERIZATION tests — they lock in the already-correct
 * non-Douyin fallback behavior so that regressions trip CI. They're not
 * TDD-driven (no red-first); the production code already implements these
 * paths. See docs/test/platform-douyin.md §TC-PLAT-SDK.
 *
 * Environment note: jsdom has no `tt` / `GameGlobal.tt` global, so
 * `resolveTT()` returns undefined and `isDouyinMiniGameRuntime()` is false.
 */
import { DouyinSDK } from '../../assets/scenes/scripts/platform/DouyinSDK';

describe('DouyinSDK (TC-PLAT-SDK-004 non-Douyin fallbacks)', () => {
  beforeEach(() => {
    // Guard against test pollution: ensure no stray tt global.
    delete (globalThis as any).tt;
    delete (globalThis as any).GameGlobal;
  });

  afterEach(() => {
    delete (globalThis as any).tt;
    delete (globalThis as any).GameGlobal;
    jest.restoreAllMocks();
  });

  it('isDouyinMiniGameRuntime returns false when tt global is absent', () => {
    expect(DouyinSDK.isDouyinMiniGameRuntime()).toBe(false);
  });

  it('getUserInfo resolves with a DevUser placeholder (no throw)', async () => {
    await expect(DouyinSDK.getUserInfo()).resolves.toEqual({
      nickName: 'DevUser',
      avatarUrl: '',
    });
  });

  it('showRewardedAd resolves true (simulated success) in dev mode', async () => {
    await expect(DouyinSDK.showRewardedAd('reward-revive')).resolves.toBe(true);
  });

  it('showInterstitialAd is a silent no-op in dev mode', () => {
    expect(() => DouyinSDK.showInterstitialAd('interstitial-home')).not.toThrow();
  });

  it('share resolves cleanly in dev mode', async () => {
    await expect(DouyinSDK.share('title', 'http://img', 'from=test')).resolves.toBeUndefined();
  });

  it('login rejects with an explanatory error when runtime is not Douyin', async () => {
    // Intentional: the spec doc's "不抛异常" is honored by every method EXCEPT
    // login — auth must fail loudly outside Douyin so callers don't silently
    // proceed with a fake session. This anchor pins that contract.
    await expect(DouyinSDK.login()).rejects.toThrow(/非抖音小游戏运行时/);
  });

  it('does not call tt.createRewardedVideoAd with a placeholder ID', async () => {
    const createRewardedVideoAd = jest.fn();
    (globalThis as any).tt = { login: jest.fn(), createRewardedVideoAd };
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(DouyinSDK.showRewardedAd('game_ad_gold')).resolves.toBe(false);
    expect(createRewardedVideoAd).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/开发占位值/));
  });
});
