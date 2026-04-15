import { sys } from 'cc';

/**
 * 解析抖音宿主提供的 tt 对象。
 * Cocos 构建后优先挂在 GameGlobal.tt；仅用全局 tt 可能拿到与宿主桥接不一致的引用，易触发 login:fail protocol mismatch (errNo 20000)。
 */
function resolveTT(): any {
    const gg = (globalThis as unknown as { GameGlobal?: { tt?: unknown } }).GameGlobal;
    const fromGg = gg?.tt as { login?: unknown } | undefined;
    if (fromGg && typeof fromGg.login === 'function') {
        return fromGg;
    }
    const t = (globalThis as unknown as { tt?: unknown }).tt as { login?: unknown } | undefined;
    if (t && typeof t.login === 'function') {
        return t;
    }
    return undefined;
}

function isLoginRetryable(err: { errMsg?: string; errNo?: number; errno?: number }): boolean {
    const no = err?.errNo ?? err?.errno;
    const msg = String(err?.errMsg ?? '');
    return (
        no === 2000 ||
        no === 20000 ||
        msg.includes('protocol mismatch') ||
        msg.includes('system error') ||
        msg.includes('internal error')
    );
}

function normalizeLoginResult(res: any): { code?: string; anonymousCode?: string; isLogin?: boolean } {
    const raw = res ?? {};
    const level1Code = typeof raw.code === 'string' ? raw.code : undefined;
    const level1Anonymous =
        typeof raw.anonymousCode === 'string'
            ? raw.anonymousCode
            : typeof raw.anonymous_code === 'string'
              ? raw.anonymous_code
              : undefined;
    const data = raw?.data ?? raw?.result ?? {};
    const nestedCode = typeof data.code === 'string' ? data.code : undefined;
    const nestedAnonymous =
        typeof data.anonymousCode === 'string'
            ? data.anonymousCode
            : typeof data.anonymous_code === 'string'
              ? data.anonymous_code
              : undefined;

    const code = level1Code || nestedCode;
    const anonymousCode = level1Anonymous || nestedAnonymous;
    const isLogin = typeof raw.isLogin === 'boolean' ? raw.isLogin : undefined;
    return { code, anonymousCode, isLogin };
}

export class DouyinSDK {
    private static adInstances: Map<string, any> = new Map();

    /** 供 ApiClient 等使用，与 resolveTT 一致 */
    static getTT(): any {
        return resolveTT();
    }

    /**
     * 仅在「抖音小游戏」包体且能解析到宿主 tt 时返回 true。
     */
    static isDouyinMiniGameRuntime(): boolean {
        const ttApi = resolveTT();
        // 真机/工具在个别版本下，sys.platform 可能未正确映射；
        // 以宿主 tt 能力为准更稳妥。
        return !!(ttApi?.login || ttApi?.request);
    }

    /**
     * 获取 tt.login 返回的登录凭证，供服务端 code2Session。
     * - **抖音小游戏真机/开发者工具**：必须调起成功并返回 `code`。
     * - 官方文档：`code` / `anonymousCode` 二选一即可换会话，开发工具中未登录账号时可能只拿到匿名凭证。
     *
     * 开发者工具 4.x 上偶发 errNo 20000 / protocol mismatch：延迟首调并带 force 重试。
     */
    static login(): Promise<{ code?: string; anonymousCode?: string; isLogin?: boolean }> {
        return new Promise((resolve, reject) => {
            if (!this.isDouyinMiniGameRuntime()) {
                reject(
                    new Error(
                        '[DouyinSDK] 非抖音小游戏运行时 (platform=' +
                            sys.platform +
                            ')，无法执行真实 tt.login。请在抖音开发者工具或真机环境测试登录。'
                    )
                );
                return;
            }

            const ttApi = resolveTT();
            if (!ttApi?.login) {
                reject(new Error('抖音小游戏环境已就绪但无法调用 tt.login，请检查构建与适配层'));
                return;
            }

            let finished = false;
            const maxTry = 3;
            const delaysMs = [300, 800, 1500];
            const ATTEMPT_TIMEOUT = 5000; // 单次尝试超时 5s

            const finishOk = (result: { code?: string; anonymousCode?: string; isLogin?: boolean }): void => {
                if (finished) return;
                finished = true;
                resolve(result);
            };

            const finishErr = (err: unknown, exhausted: boolean): void => {
                if (finished) return;
                finished = true;
                if (exhausted) {
                    console.warn(
                        '[DouyinSDK] tt.login 多次重试仍失败。建议：\n' +
                            '1) 确认开发者工具中已登录抖音账号\n' +
                            '2) 确认项目 AppID 为抖音开放平台注册的真实 AppID（当前可能是占位符）\n' +
                            '3) 尝试使用「真机调试」\n' +
                            '4) 开发者工具 4.x 与 Cocos 适配层可能存在兼容问题，可尝试降级至 2.0.6～3.0\n详情:',
                        err
                    );
                }
                reject(err);
            };

            const attempt = (index: number): void => {
                if (index >= maxTry) {
                    finishErr(new Error('tt.login exhausted retries'), true);
                    return;
                }

                const delay = delaysMs[index];
                setTimeout(() => {
                    if (finished) return;

                    console.log(`[DouyinSDK] tt.login attempt ${index + 1}/${maxTry} (delay=${delay}ms, force=true)`);

                    // 超时保护：单次 callback 超时后自动重试下一次
                    let attemptDone = false;
                    const timer = setTimeout(() => {
                        if (attemptDone || finished) return;
                        attemptDone = true;
                        console.warn(`[DouyinSDK] tt.login attempt ${index + 1} timed out (${ATTEMPT_TIMEOUT}ms), retrying...`);
                        attempt(index + 1);
                    }, ATTEMPT_TIMEOUT);

                    // 始终使用 callback 模式 —— tt.login 返回 void，不是 Promise
                    ttApi.login({
                        force: true,
                        success: (res: any) => {
                            if (attemptDone || finished) return;
                            attemptDone = true;
                            clearTimeout(timer);

                            console.log(`[DouyinSDK] tt.login attempt ${index + 1} success, raw:`,
                                JSON.stringify(res, null, 2));

                            const normalized = normalizeLoginResult(res);
                            if (normalized.code || normalized.anonymousCode) {
                                finishOk(normalized);
                            } else {
                                console.warn(`[DouyinSDK] tt.login returned success but no code/anonymousCode. ` +
                                    `Raw keys: [${Object.keys(res ?? {}).join(', ')}]. ` +
                                    `请确认 AppID 是否为真实注册的 AppID，而非占位符。`);
                                if (index < maxTry - 1) {
                                    attempt(index + 1);
                                } else {
                                    finishErr(
                                        new Error('tt.login success but no code/anonymousCode after all retries. ' +
                                            'Check: 1) AppID is real 2) Developer tools login status'),
                                        true
                                    );
                                }
                            }
                        },
                        fail: (err: any) => {
                            if (attemptDone || finished) return;
                            attemptDone = true;
                            clearTimeout(timer);

                            const msg = err?.errMsg ?? String(err);
                            console.warn(`[DouyinSDK] tt.login attempt ${index + 1} fail:`, msg, err);

                            if (isLoginRetryable(err) && index < maxTry - 1) {
                                attempt(index + 1);
                            } else {
                                finishErr(err, index >= maxTry - 1);
                            }
                        },
                    });
                }, delay);
            };

            attempt(0);
        });
    }

    static getUserInfo(): Promise<{ nickName: string; avatarUrl: string }> {
        return new Promise((resolve, reject) => {
            if (!this.isDouyinMiniGameRuntime()) {
                resolve({ nickName: 'DevUser', avatarUrl: '' });
                return;
            }
            const ttApi = resolveTT();
            ttApi.getUserInfo({
                success: (res: any) => resolve(res.userInfo),
                fail: (err: any) => reject(err),
            });
        });
    }

    /**
     * 显示激励视频广告
     * @param adId 广告位标识（用于缓存实例）
     * @returns true=观看完成，false=关闭/失败
     */
    static showRewardedAd(adId: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.isDouyinMiniGameRuntime()) {
                console.log(`[DouyinSDK] Dev mode: rewarded ad "${adId}" → simulated success`);
                resolve(true);
                return;
            }
            const ttApi = resolveTT();

            let ad = this.adInstances.get(adId);
            if (!ad) {
                ad = ttApi.createRewardedVideoAd({ adUnitId: adId });
                this.adInstances.set(adId, ad);
            }

            const onClose = (res: any) => {
                ad.offClose(onClose);
                resolve(res?.isEnded ?? false);
            };

            ad.onClose(onClose);
            ad.show().catch(() => {
                ad.load()
                    .then(() => ad.show())
                    .catch(() => resolve(false));
            });
        });
    }

    static showInterstitialAd(adUnitId: string): void {
        if (!this.isDouyinMiniGameRuntime()) return;
        const ttApi = resolveTT();
        const ad = ttApi.createInterstitialAd({ adUnitId });
        ad.show().catch(() => {});
    }

    /**
     * 分享到抖音
     */
    static share(title: string, imageUrl?: string, query?: string): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isDouyinMiniGameRuntime()) {
                console.log(`[DouyinSDK] Dev mode: share → title="${title}", query="${query}"`);
                resolve();
                return;
            }
            const ttApi = resolveTT();
            ttApi.shareAppMessage({
                title,
                imageUrl: imageUrl || '',
                query: query || '',
                success: () => resolve(),
                fail: () => resolve(),
            });
        });
    }
}
