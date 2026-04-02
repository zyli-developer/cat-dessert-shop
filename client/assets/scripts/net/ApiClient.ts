import { ApiResponse, UserProfile, RankItem } from './ApiTypes';

const BASE_URL = 'http://localhost:3000'; // TODO: 上线前替换为正式服务器地址

function request<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof tt !== 'undefined') {
      // 抖音小游戏环境
      tt.request({
        url: `${BASE_URL}${path}`,
        method: method as 'GET' | 'POST',
        data: body,
        header: { 'Content-Type': 'application/json' },
        success: (res: { data: ApiResponse<T>; statusCode: number }) => {
          if (res.statusCode >= 200 && res.statusCode < 300 && res.data.success) {
            resolve(res.data.data);
          } else {
            reject(new Error(`API error: ${res.statusCode}`));
          }
        },
        fail: (err: unknown) => reject(err),
      });
    } else {
      // 浏览器开发环境
      fetch(`${BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(res => res.json())
        .then((json: ApiResponse<T>) => {
          if (json.success) {
            resolve(json.data);
          } else {
            reject(new Error('API request failed'));
          }
        })
        .catch(reject);
    }
  });
}

export class ApiClient {
  private static _openId: string = '';

  static setOpenId(id: string): void {
    this._openId = id;
  }

  static getOpenId(): string {
    return this._openId;
  }

  static login(code: string): Promise<UserProfile> {
    return request<UserProfile>('/api/auth/login', 'POST', { code });
  }

  static getProfile(): Promise<UserProfile> {
    return request<UserProfile>(`/api/user/profile?openId=${this._openId}`);
  }

  static updateProgress(round: number, score: number, stars: number): Promise<UserProfile> {
    return request<UserProfile>(`/api/user/progress?openId=${this._openId}`, 'POST', {
      round,
      score,
      stars,
    });
  }

  static getGlobalRank(limit: number = 100): Promise<RankItem[]> {
    return request<RankItem[]>(`/api/rank/global?limit=${limit}`);
  }
}
