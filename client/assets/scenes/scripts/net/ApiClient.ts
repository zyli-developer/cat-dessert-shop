import { UserProfile, RankItem } from './ApiTypes';
import { DouyinSDK } from '../platform/DouyinSDK';
import { API_BASE_URL } from './ApiConfig';

const TIMEOUT = 8000;

interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

function request<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  const openId = ApiClient.getOpenId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (openId) {
    headers['X-Open-Id'] = openId;
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const isHttp = /^http:\/\//i.test(base);
  const url = `${base}${path}`;
  return new Promise((resolve, reject) => {
    // 抖音小游戏：
    // - https 走 tt.request（官方链路）
    // - http（局域网联调）直接走 fetch/XHR，避免 tt.request 的域名/协议校验拦截
    if (DouyinSDK.isDouyinMiniGameRuntime() && isHttp) {
      console.warn(
        '[ApiClient] 当前为抖音运行时且 API_BASE_URL 为 http。开发者工具默认会校验 request 合法域名，' +
          '可能导致 XHR/tt.request 都失败。请在开发者工具关闭「校验合法域名」用于本地调试，或改用 HTTPS 域名并在平台配置白名单。'
      );
    }
    if (DouyinSDK.isDouyinMiniGameRuntime() && !isHttp) {
      if (base.includes('localhost') || base.includes('127.0.0.1')) {
        console.warn(
          '[ApiClient] 真机环境下 localhost 无法访问你电脑上的后端。请在 ApiConfig.ts 将 API_BASE_URL 改为电脑局域网 IP（如 http://192.168.x.x:3333），并确保 Nest 监听 0.0.0.0、防火墙放行端口。'
        );
      }
      const ttApi = DouyinSDK.getTT();
      if (ttApi?.request) {
        ttApi.request({
          url,
          method: method as 'GET' | 'POST',
          data: body,
          header: headers,
          timeout: TIMEOUT,
          success: (res: { data: ApiResponse<T>; statusCode: number }) => {
            if (res.statusCode >= 200 && res.statusCode < 300 && res.data.code === 0) {
              resolve(res.data.data);
            } else {
              reject(
                new Error(
                  `API error: status=${res.statusCode}, code=${res.data?.code}, message=${res.data?.message ?? ''}`
                )
              );
            }
          },
          fail: (err: { errMsg?: string } | unknown) => {
            const msg = String((err as any)?.errMsg ?? err);
            // 个别环境会被 tt.request 拒绝，改用 fetch/XHR
            const invalidProtocol = msg.includes('invalid protocol');
            const invalidDomain = msg.includes('not valid domain') || msg.includes('invalid domain');
            const errNo = Number((err as any)?.errNo ?? (err as any)?.errno ?? -1);
            if (invalidProtocol || invalidDomain || errNo === 21000) {
              console.warn('[ApiClient] tt.request rejected current url, fallback to fetch/xhr:', msg);
              // 继续走下面的 fetch/xhr 分支
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              return doFetchOrXhr();
            }
            console.error('[ApiClient] tt.request failed:', msg, 'url=', url);
            reject(err);
          },
        });
        return;
      }
      console.warn('[ApiClient] Douyin runtime detected but tt.request unavailable, fallback to fetch/xhr');
    }

    const doFetchOrXhr = (): void => {
      const canFetch = typeof fetch === 'function';
      if (canFetch) {
        const canAbort = typeof AbortController === 'function';
        const controller = canAbort ? new AbortController() : null;
        let finished = false;
        const timer = setTimeout(() => {
          if (finished) return;
          if (controller) {
            controller.abort();
          } else {
            finished = true;
            reject(new Error('Fetch timeout'));
          }
        }, TIMEOUT);

        fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          ...(controller ? { signal: controller.signal } : {}),
        })
          .then(res => { clearTimeout(timer); return res.json(); })
          .then((json: ApiResponse<T>) => {
            if (finished) return;
            finished = true;
            if (json.code === 0) {
              resolve(json.data);
            } else {
              reject(new Error(`API error: code=${json.code}, message=${json.message ?? ''}`));
            }
          })
          .catch(err => {
            clearTimeout(timer);
            if (finished) return;
            finished = true;
            reject(err);
          });
        return;
      }

      // 抖音小游戏部分运行时没有 fetch，回退到 XHR（开发期 http 联调）
      if (typeof XMLHttpRequest !== 'undefined') {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.timeout = TIMEOUT;
        Object.keys(headers).forEach((k) => xhr.setRequestHeader(k, headers[k]));
        xhr.onreadystatechange = () => {
          if (xhr.readyState !== 4) return;
          try {
            const json = JSON.parse(xhr.responseText) as ApiResponse<T>;
            if (xhr.status >= 200 && xhr.status < 300 && json.code === 0) {
              resolve(json.data);
            } else {
              reject(new Error(`API error: status=${xhr.status}, code=${json?.code}`));
            }
          } catch (e) {
            reject(new Error(`API parse error: ${String(e)}`));
          }
        };
        xhr.onerror = () => {
          reject(new Error(`XHR network error (url=${url})`));
        };
        xhr.ontimeout = () => {
          reject(new Error(`XHR timeout (url=${url})`));
        };
        xhr.send(body ? JSON.stringify(body) : undefined);
        return;
      }

      reject(new Error('No available HTTP client in current runtime'));
    };

    doFetchOrXhr();
  });
}

export class ApiClient {
  private static _openId: string = '';
  private static readonly OFFLINE_OPEN_ID = 'dev-offline';

  static setOpenId(id: string): void {
    this._openId = id;
  }

  static getOpenId(): string {
    return this._openId;
  }

  static isOfflineMode(): boolean {
    return this._openId === this.OFFLINE_OPEN_ID;
  }

  static login(credentials: { code?: string; anonymousCode?: string }): Promise<UserProfile> {
    return request<UserProfile>('/api/auth/login', 'POST', credentials);
  }

  static getProfile(): Promise<UserProfile> {
    if (this.isOfflineMode()) {
      return Promise.resolve({
        openId: this.OFFLINE_OPEN_ID,
        nickname: '离线玩家',
        avatar: '',
        catCoins: 0,
        currentRound: 1,
        highScore: 0,
        stars: {},
        roundScores: {},
      });
    }
    return request<UserProfile>('/api/user/profile');
  }

  static updateProgress(round: number, score: number, stars: number, catCoinsEarned?: number): Promise<any> {
    if (this.isOfflineMode()) {
      return Promise.resolve({
        catCoins: 0,
        currentRound: round,
        highScore: score,
        stars: {},
        roundScores: {},
        isNewBest: true,
        offline: true,
      });
    }
    return request('/api/user/progress', 'POST', {
      round,
      score,
      stars,
      catCoinsEarned,
    });
  }

  static getGlobalRank(limit: number = 100): Promise<RankItem[]> {
    return request<RankItem[]>(`/api/rank/global?limit=${limit}`);
  }

  static getFriendsRank(round?: number): Promise<{ list: any[]; myRank: number }> {
    if (this.isOfflineMode()) {
      return Promise.resolve({ list: [], myRank: 0 });
    }
    const query = round ? `?round=${round}` : '';
    return request(`/api/rank/friends${query}`);
  }
}
