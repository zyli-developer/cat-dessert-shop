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
    (DouyinSDK as any).shareInFlight = false;
    (DouyinSDK as any).shareMenuInitialized = false;
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

  it('share reports unavailable in dev mode instead of pretending to succeed', async () => {
    await expect(DouyinSDK.share({ title: 'title', query: 'from=test' }))
      .resolves.toEqual({ status: 'unavailable' });
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

  it('allows only one rewarded-ad request globally until it settles', async () => {
    let finish!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => { finish = resolve; });
    const showOnce = jest.spyOn(DouyinSDK as any, 'showRewardedAdOnce')
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(true);

    const first = DouyinSDK.showRewardedAd('real-ad-unit-a');
    await expect(DouyinSDK.showRewardedAd('real-ad-unit-b')).resolves.toBe(false);
    expect(showOnce).toHaveBeenCalledTimes(1);

    finish(true);
    await expect(first).resolves.toBe(true);
    await expect(DouyinSDK.showRewardedAd('real-ad-unit-b')).resolves.toBe(true);
    expect(showOnce).toHaveBeenCalledTimes(2);
  });
});

describe('DouyinSDK share contract', () => {
  beforeEach(() => {
    delete (globalThis as any).GameGlobal;
    (DouyinSDK as any).shareInFlight = false;
    (DouyinSDK as any).shareMenuInitialized = false;
  });

  afterEach(() => {
    delete (globalThis as any).tt;
    delete (globalThis as any).GameGlobal;
    jest.restoreAllMocks();
  });

  it('passes the approved share fields and reports success', async () => {
    const shareAppMessage = jest.fn((options) => options.success({ data: [{ name: '好友' }] }));
    (globalThis as any).tt = { login: jest.fn(), shareAppMessage };

    await expect(DouyinSDK.share({
      channel: 'invite',
      title: '一起来开猫店吧！',
      desc: '比比谁的猫客更多',
      query: 'from=rank_invite',
      templateId: 'approved-template',
    })).resolves.toEqual({
      status: 'success',
      data: { data: [{ name: '好友' }] },
    });

    expect(shareAppMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'invite',
      title: '一起来开猫店吧！',
      desc: '比比谁的猫客更多',
      query: 'from=rank_invite',
      templateId: 'approved-template',
      success: expect.any(Function),
      fail: expect.any(Function),
    }));
  });

  it('distinguishes user cancellation from a platform failure', async () => {
    (globalThis as any).tt = {
      login: jest.fn(),
      shareAppMessage: (options: any) => options.fail({ errNo: 10502, errMsg: 'cancel' }),
    };
    await expect(DouyinSDK.share({ title: '测试分享' }))
      .resolves.toEqual(expect.objectContaining({ status: 'cancelled' }));

    (globalThis as any).tt.shareAppMessage = (options: any) => {
      options.fail({ errNo: 10103, errMsg: 'network unavailable' });
    };
    await expect(DouyinSDK.share({ title: '测试分享' }))
      .resolves.toEqual(expect.objectContaining({ status: 'failed' }));
  });

  it('prevents repeated taps while the system share panel is pending', async () => {
    let finish!: (data: unknown) => void;
    (globalThis as any).tt = {
      login: jest.fn(),
      shareAppMessage: (options: any) => { finish = options.success; },
    };

    const first = DouyinSDK.share({ title: '第一次' });
    await expect(DouyinSDK.share({ title: '第二次' })).resolves.toEqual({ status: 'busy' });
    finish({});
    await expect(first).resolves.toEqual({ status: 'success', data: {} });
  });

  it('registers custom content for the system share menu once', () => {
    let passiveHandler!: () => Record<string, unknown>;
    const onShareAppMessage = jest.fn((handler) => { passiveHandler = handler; });
    const showShareMenu = jest.fn();
    (globalThis as any).tt = { login: jest.fn(), onShareAppMessage, showShareMenu };

    DouyinSDK.initializeShareMenu();
    DouyinSDK.initializeShareMenu();

    expect(onShareAppMessage).toHaveBeenCalledTimes(1);
    expect(showShareMenu).toHaveBeenCalledTimes(1);
    expect(passiveHandler()).toEqual(expect.objectContaining({
      title: '一起开猫店',
      query: 'from=system_share',
    }));
  });

  it('uses only the supported sidebar scene and preserves failures', async () => {
    const navigateToScene = jest.fn((options) => options.fail({ errMsg: 'auth deny' }));
    (globalThis as any).tt = { login: jest.fn(), navigateToScene };

    await expect(DouyinSDK.navigateToSidebar()).resolves.toEqual(expect.objectContaining({
      ok: false,
      reason: 'failed',
    }));
    expect(navigateToScene).toHaveBeenCalledWith(expect.objectContaining({ scene: 'sidebar' }));
  });
});
