/**
 * 抖音小游戏 tt 全局 API 类型声明
 * 文档：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/overview
 */
declare namespace tt {
  // --- 登录 ---
  function login(options: {
    force?: boolean;
    success?: (res: { code: string; anonymousCode?: string }) => void;
    fail?: (err: any) => void;
    complete?: () => void;
  }): void;

  // --- 用户信息 ---
  function getUserInfo(options: {
    withCredentials?: boolean;
    success?: (res: {
      userInfo: {
        nickName: string;
        avatarUrl: string;
        gender: number;
      };
      rawData: string;
    }) => void;
    fail?: (err: any) => void;
  }): void;

  // --- 系统信息 ---
  function getSystemInfoSync(): {
    platform: string;
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    pixelRatio: number;
    SDKVersion: string;
    appName: string;
  };

  // --- 生命周期 ---
  function onShow(callback: (res: { query: Record<string, string> }) => void): void;
  function onHide(callback: () => void): void;
  function offShow(callback: Function): void;
  function offHide(callback: Function): void;
  function getLaunchOptionsSync(): { query: Record<string, string>; scene: string };

  // --- 存储 ---
  function setStorageSync(key: string, data: any): void;
  function getStorageSync(key: string): any;
  function removeStorageSync(key: string): void;

  // --- 网络请求 ---
  function request(options: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    header?: Record<string, string>;
    success?: (res: { data: any; statusCode: number; header: Record<string, string> }) => void;
    fail?: (err: any) => void;
    complete?: () => void;
  }): void;

  // --- 激励视频广告 ---
  function createRewardedVideoAd(options: { adUnitId: string }): RewardedVideoAd;
  interface RewardedVideoAd {
    load(): Promise<void>;
    show(): Promise<void>;
    onLoad(callback: () => void): void;
    offLoad(callback: () => void): void;
    onError(callback: (err: { errMsg: string; errCode: number }) => void): void;
    offError(callback: Function): void;
    onClose(callback: (res: { isEnded: boolean }) => void): void;
    offClose(callback: Function): void;
  }

  // --- 插屏广告 ---
  function createInterstitialAd(options: { adUnitId: string }): InterstitialAd;
  interface InterstitialAd {
    load(): Promise<void>;
    show(): Promise<void>;
    onLoad(callback: () => void): void;
    onError(callback: (err: any) => void): void;
    onClose(callback: () => void): void;
  }

  // --- Banner 广告 ---
  function createBannerAd(options: {
    adUnitId: string;
    style: { left: number; top: number; width: number };
  }): BannerAd;
  interface BannerAd {
    show(): Promise<void>;
    hide(): void;
    destroy(): void;
    onResize(callback: (size: { width: number; height: number }) => void): void;
    onLoad(callback: () => void): void;
    onError(callback: (err: any) => void): void;
  }

  // --- 分享 ---
  function shareAppMessage(options: {
    title?: string;
    desc?: string;
    imageUrl?: string;
    query?: string;
    success?: () => void;
    fail?: (err: any) => void;
  }): void;

  // --- 震动 ---
  function vibrateShort(options?: { success?: () => void; fail?: (err: any) => void }): void;
  function vibrateLong(options?: { success?: () => void; fail?: (err: any) => void }): void;

  // --- 支付（抖币） ---
  function requestGamePayment(options: {
    mode: 'game';
    env: number;
    currencyType: 'DIAMOND';
    platform: 'android' | 'ios';
    buyQuantity: number;
    customId: string;
    extraInfo?: string;
    success?: (res: any) => void;
    fail?: (err: any) => void;
  }): void;

  // --- 录屏 ---
  function getGameRecorderManager(): GameRecorderManager;
  interface GameRecorderManager {
    start(options?: { duration?: number }): void;
    stop(): void;
    onStart(callback: () => void): void;
    onStop(callback: (res: { videoPath: string }) => void): void;
    onError(callback: (err: any) => void): void;
  }
}
