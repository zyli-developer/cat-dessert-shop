import { sys } from 'cc';
import { isConfiguredAdUnitId, MOCK_REWARDED_ADS } from './AdConfig';

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
    private static adInFlight = false;

    /** 供 ApiClient 等使用，与 resolveTT 一致 */
    static getTT(): any {
        return resolveTT();
    }

    /**
     * 打印当前抖音宿主运行时的关键诊断信息。
     * 调试 protocol mismatch / AppID 不匹配 / 账号权限错乱 时第一手证据。
     * 重点字段：runtime appId（IDE 实际加载的）、host version、launch scene。
     */
    static dumpEnvironment(label: string = 'env-dump'): void {
        const gg = (globalThis as any).GameGlobal;
        const ttGlobal = (globalThis as any).tt;
        const ttFromGg = gg?.tt;
        const tt = resolveTT();

        const summary: Record<string, unknown> = {
            label,
            'sys.platform': sys.platform,
            'GameGlobal exists': !!gg,
            'GameGlobal.tt exists': !!ttFromGg,
            'globalThis.tt exists': !!ttGlobal,
            'resolved tt source': ttFromGg ? 'GameGlobal.tt' : ttGlobal ? 'globalThis.tt' : 'none',
            'tt.login type': typeof tt?.login,
            'tt.checkSession type': typeof tt?.checkSession,
            'tt.getSystemInfoSync type': typeof tt?.getSystemInfoSync,
            'tt.getAccountInfoSync type': typeof tt?.getAccountInfoSync,
            'tt.getEnvInfoSync type': typeof tt?.getEnvInfoSync,
            'tt.getLaunchOptionsSync type': typeof tt?.getLaunchOptionsSync,
        };
        console.log(`[DouyinSDK][${label}] basic capability:`, summary);

        // 关键：拿到运行时实际 AppID。优先 getAccountInfoSync，回落 getEnvInfoSync().microapp.appId。
        let runtimeAppId: string | undefined;
        try {
            if (typeof tt?.getAccountInfoSync === 'function') {
                const acc = tt.getAccountInfoSync();
                console.log(`[DouyinSDK][${label}] tt.getAccountInfoSync() →`, acc);
                runtimeAppId = acc?.miniProgram?.appId ?? acc?.miniGame?.appId ?? acc?.appId;
            } else {
                console.log(`[DouyinSDK][${label}] tt.getAccountInfoSync 不可用 (将从 getEnvInfoSync 回落)`);
            }
        } catch (e) {
            console.warn(`[DouyinSDK][${label}] getAccountInfoSync threw:`, (e as Error)?.message);
        }

        try {
            if (typeof tt?.getSystemInfoSync === 'function') {
                const sys = tt.getSystemInfoSync();
                console.log(`[DouyinSDK][${label}] tt.getSystemInfoSync():`, {
                    platform: sys?.platform,
                    appName: sys?.appName,
                    appVersion: sys?.appVersion,
                    SDKVersion: sys?.SDKVersion,
                    hostName: sys?.hostName,
                    devicePixelRatio: sys?.devicePixelRatio,
                });
            }
        } catch (e) {
            console.warn(`[DouyinSDK][${label}] getSystemInfoSync threw:`, (e as Error)?.message);
        }

        try {
            if (typeof tt?.getEnvInfoSync === 'function') {
                const env = tt.getEnvInfoSync() ?? {};
                // 显式打开 microapp / plugin / common，避免 console 折叠藏掉 appId
                const microapp = env.microapp ?? {};
                const plugin = env.plugin ?? {};
                const common = env.common ?? {};
                console.log(`[DouyinSDK][${label}] env.microapp keys = [${Object.keys(microapp).join(', ')}]`);
                console.log(`[DouyinSDK][${label}] env.microapp =`, microapp);
                console.log(`[DouyinSDK][${label}] env.plugin =`, plugin);
                console.log(`[DouyinSDK][${label}] env.common =`, common);
                if (!runtimeAppId) {
                    runtimeAppId = microapp.appId ?? microapp.mpId ?? microapp.appid;
                }
            }
        } catch (e) {
            console.warn(`[DouyinSDK][${label}] getEnvInfoSync threw:`, (e as Error)?.message);
        }

        if (runtimeAppId) {
            console.log(`[DouyinSDK][${label}] 🎯 RUNTIME APPID = ${runtimeAppId}`);
        } else {
            console.warn(
                `[DouyinSDK][${label}] ⚠️ 未能从宿主拿到 runtime AppID。` +
                `请展开上面 env.microapp 那一行，肉眼看里面有没有 appId / mpId 字段，把字段名告诉我。`
            );
        }

        try {
            if (typeof tt?.getLaunchOptionsSync === 'function') {
                const opt = tt.getLaunchOptionsSync();
                console.log(`[DouyinSDK][${label}] tt.getLaunchOptionsSync():`, {
                    scene: opt?.scene,
                    query: opt?.query,
                    referrerInfo: opt?.referrerInfo,
                });
            }
        } catch (e) {
            console.warn(`[DouyinSDK][${label}] getLaunchOptionsSync threw:`, (e as Error)?.message);
        }
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
        // 每次登录前 dump 一次环境，便于和 fail 错码对照（看运行时 AppID 到底是哪个）
        this.dumpEnvironment('pre-login');
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
            // 重试延迟（attempt 1, 2）；attempt 0 同步触发，不进 setTimeout
            const RETRY_DELAYS_MS = [800, 1500];
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
                            '1) 确认开发者工具中已登录抖音账号（点左上角头像扫码绑定测试号）\n' +
                            '2) 确认项目 AppID 为抖音开放平台注册的真实 AppID\n' +
                            '3) 尝试使用「真机调试」\n' +
                            '4) 确认 tt.login 是从用户点击事件同步触发的，前面没有 await/setTimeout\n详情:',
                        err
                    );
                }
                reject(err);
            };

            const fire = (index: number): void => {
                if (finished) return;
                if (index >= maxTry) {
                    finishErr(new Error('tt.login exhausted retries'), true);
                    return;
                }

                /**
                 * IDE 4.x 触发 errNo 20000 / protocol mismatch 的已知诱因之一是 `force: true`
                 * —— 桥协议把 force 当作 "刷新已授权用户" 路径，但 IDE 模拟器里通常没有真实用户，
                 * 直接撞到协议不一致。轮换策略：
                 *   attempt 0: 不带 force（默认拿 code/anonymousCode）
                 *   attempt 1: force=false（显式）
                 *   attempt 2: force=true（最后兜底，对真机已授权账号有效）
                 */
                const loginParams: Record<string, unknown> = {};
                if (index === 1) loginParams.force = false;
                else if (index === 2) loginParams.force = true;
                const forceDesc = index === 0 ? 'omit' : (index === 1 ? 'false' : 'true');
                const stackTag = index === 0 ? ' [SYNC on user gesture]' : '';
                console.log(`[DouyinSDK] tt.login attempt ${index + 1}/${maxTry} (force=${forceDesc})${stackTag}`);

                let attemptDone = false;
                const timer = setTimeout(() => {
                    if (attemptDone || finished) return;
                    attemptDone = true;
                    console.warn(`[DouyinSDK] tt.login attempt ${index + 1} timed out (${ATTEMPT_TIMEOUT}ms), retrying...`);
                    scheduleNext(index + 1);
                }, ATTEMPT_TIMEOUT);

                // 始终使用 callback 模式 —— tt.login 返回 void，不是 Promise
                ttApi.login({
                    ...loginParams,
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
                                scheduleNext(index + 1);
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
                        // 把 err 对象所有字段全部 dump，避免 console 折叠隐藏关键字段（errno/errCode/data 等）
                        const errKeys = err && typeof err === 'object' ? Object.keys(err) : [];
                        const errFull: Record<string, unknown> = {};
                        for (const k of errKeys) {
                            try { errFull[k] = (err as any)[k]; } catch { errFull[k] = '<unreadable>'; }
                        }
                        console.warn(
                            `[DouyinSDK] tt.login attempt ${index + 1} fail: ${msg}\n` +
                            `  errKeys: [${errKeys.join(', ')}]\n` +
                            `  errFull:`, errFull
                        );

                        if (isLoginRetryable(err) && index < maxTry - 1) {
                            scheduleNext(index + 1);
                        } else {
                            finishErr(err, index >= maxTry - 1);
                        }
                    },
                });
            };

            const scheduleNext = (index: number): void => {
                // 重试本来就脱离用户手势栈（在 callback / setTimeout 里），用普通 setTimeout 没问题
                const delay = RETRY_DELAYS_MS[index - 1] ?? 1500;
                setTimeout(() => fire(index), delay);
            };

            /**
             * CRITICAL: 第一次 tt.login 必须保持在用户点击事件的同步调用栈上。
             * 抖音平台/IDE 4.x 要求 tt.login 由用户手势触发，前面任何 await / setTimeout /
             * tt.checkSession 异步调用都会让 IDE 把这次 login 当作"非用户触发"拒掉，
             * 返回 errNo 20000 / "login:fail protocol mismatch"。
             *
             * 调用链：onLoginClicked (touch handler) → doLogin() → await DouyinSDK.login()
             *   → new Promise(executor 同步执行) → fire(0) 同步执行 → ttApi.login(...) 同步触发
             * `await` 关键字出现在外层调用方，但 Promise 构造器内部是同步执行的，所以
             * ttApi.login 仍在 touch handler 的调用栈上。
             */
            fire(0);
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
    static async showRewardedAd(adId: string): Promise<boolean> {
        // 抖音激励视频是全局单例；任一入口展示期间都拒绝新的请求，
        // 防止快速连点或两个弹窗重叠时重复展示、重复发奖。
        if (this.adInFlight) return false;
        this.adInFlight = true;
        try {
            return await this.showRewardedAdOnce(adId);
        } finally {
            this.adInFlight = false;
        }
    }

    private static showRewardedAdOnce(adId: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.isDouyinMiniGameRuntime()) {
                console.log(`[DouyinSDK] Dev mode: rewarded ad "${adId}" → simulated success`);
                resolve(true);
                return;
            }
            const ttApi = resolveTT();

            // 测试期模拟广告（见 AdConfig.MOCK_REWARDED_ADS 注释；上线前必须关闭）
            if (MOCK_REWARDED_ADS) {
                console.warn(`[DouyinSDK] ⚠ MOCK_REWARDED_ADS=true，模拟激励视频 "${adId}"（上线前在 AdConfig.ts 改回 false）`);
                if (typeof ttApi?.showModal === 'function') {
                    ttApi.showModal({
                        title: '模拟广告（测试）',
                        content: `广告位: ${adId}\n「确定」= 看完发奖\n「取消」= 中途关闭`,
                        success: (res: any) => resolve(!!res?.confirm),
                        fail: () => resolve(true),
                    });
                } else {
                    resolve(true);
                }
                return;
            }

            if (!isConfiguredAdUnitId(adId)) {
                console.error(
                    `[DouyinSDK] 激励视频广告位 "${adId}" 仍是开发占位值；` +
                    '请在 AdConfig.ts 配置抖音开放平台创建的真实广告位 ID。',
                );
                resolve(false);
                return;
            }

            if (typeof ttApi?.createRewardedVideoAd !== 'function') {
                console.warn('[DouyinSDK] 当前抖音宿主不支持 tt.createRewardedVideoAd');
                resolve(false);
                return;
            }

            let ad = this.adInstances.get(adId);
            if (!ad) {
                ad = ttApi.createRewardedVideoAd({ adUnitId: adId });
                // 真机排查唯一线索：广告位 ID 无效、无填充（errCode 1004）等都只从这里报出来
                ad.onError((err: any) => {
                    console.warn(`[DouyinSDK] rewarded ad "${adId}" onError: errCode=${err?.errCode}, ${err?.errMsg ?? err}`);
                });
                this.adInstances.set(adId, ad);
            }

            const onClose = (res: any) => {
                ad.offClose(onClose);
                console.log(`[DouyinSDK] rewarded ad "${adId}" closed, isEnded=${res?.isEnded}`);
                resolve(res?.isEnded ?? false);
            };

            ad.onClose(onClose);
            ad.show().catch((err: any) => {
                console.warn(`[DouyinSDK] rewarded ad "${adId}" show() fail, retrying via load():`, err?.errMsg ?? err);
                ad.load()
                    .then(() => ad.show())
                    .catch((err2: any) => {
                        console.warn(`[DouyinSDK] rewarded ad "${adId}" load/show retry fail:`, err2?.errMsg ?? err2);
                        ad.offClose(onClose);
                        resolve(false);
                    });
            });
        });
    }

    /**
     * 跳转抖音宿主特定场景。审核「侧边栏复访」必须 bundle 里存在 tt.navigateToScene 调用。
     * 常用 scene 值：
     *   - 'sidebar'         添加到「我的小游戏」侧边栏（满足复访审核）
     *   - 'feedback'        意见反馈
     *   - 'customerService' 客服
     */
    static navigateToScene(scene: string): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isDouyinMiniGameRuntime()) {
                console.log(`[DouyinSDK] Dev mode: navigateToScene("${scene}") → noop`);
                resolve();
                return;
            }
            const ttApi = resolveTT();
            if (typeof ttApi.navigateToScene !== 'function') {
                console.warn('[DouyinSDK] tt.navigateToScene 在当前宿主不可用');
                resolve();
                return;
            }
            ttApi.navigateToScene({
                scene,
                success: () => resolve(),
                fail: (err: any) => {
                    console.warn('[DouyinSDK] navigateToScene fail:', err?.errMsg ?? err);
                    resolve();
                },
            });
        });
    }

    /** 引导用户把小游戏加到侧边栏（满足平台「侧边栏复访」审核硬指标） */
    static navigateToSidebar(): Promise<void> {
        return this.navigateToScene('sidebar');
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
