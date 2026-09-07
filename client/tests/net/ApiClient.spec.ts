/**
 * ApiClient specs (T2-12 / TC-API-CLIENT-001..004).
 *
 * Actual ApiClient shape (assets/scenes/scripts/net/ApiClient.ts):
 *   - `setFetchImpl(fn)` / `ApiClient.setFetch(fn)` — injectable fetch seam.
 *   - All requests go through `request<T>()` which:
 *       * Prefers `tt.request` in Douyin runtime (not triggered in tests — our
 *         tt stub lacks .login/.request, so `isDouyinMiniGameRuntime()` is
 *         false and we take the fetch branch).
 *       * Uses global fetch with an 8s timeout via AbortController.
 *       * Expects JSON body shape `{ code, data, message? }` and resolves
 *         `data` only when `code === 0`; otherwise rejects with an Error
 *         containing "API error: code=...".
 *   - Public methods: login, getProfile, updateProgress, getGlobalRank,
 *     getFriendsRank. Offline mode (openId === 'dev-offline') shortcircuits
 *     a few of them with canned responses.
 *   - A 401 response clears the in-memory authentication session.
 *
 * TC mapping:
 *   - TC-API-CLIENT-001 happy path ✔ (login POST and getGlobalRank GET)
 *   - TC-API-CLIENT-002 timeout ✔ (fetch never resolves → 8s timeout rejects)
 *     Implemented with jest fake timers to avoid actually waiting 8s.
 *   - TC-API-CLIENT-003 5xx → rejects ✔ (server returns code!=0; note the
 *     production fetch branch ignores HTTP statusCode and only reads `code`,
 *     so "5xx" is modeled as the body shape the server sends on 5xx:
 *     { code: 500, message: 'server error' }).
 *   - TC-API-CLIENT-004 401 auto-clear-token ✔
 */

import { ApiClient, setFetchImpl } from '../../assets/scenes/scripts/net/ApiClient';

/** Build a minimal Response-like object compatible with ApiClient's `.then(res => res.json())`. */
function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as unknown as Response;
}

describe('ApiClient (T2-12)', () => {
  afterEach(() => {
    // Restore real fetch between tests.
    setFetchImpl(((input: RequestInfo, init?: RequestInit) =>
      fetch(input as any, init)) as typeof fetch);
    ApiClient.clearSession();
    jest.useRealTimers();
  });

  // ----- TC-API-CLIENT-001 -----
  it('TC-API-CLIENT-001a happy path: login POST resolves with parsed body', async () => {
    const fake = jest.fn().mockResolvedValue(jsonResponse({
      code: 0,
      data: {
        accessToken: 'signed-token',
        user: {
          openId: 'o1', nickname: 'n', avatar: '',
          catCoins: 0, currentRound: 1, highScore: 0,
          stars: {}, roundScores: {},
        },
      },
    }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    const session = await ApiClient.login({ code: 'c' });
    expect(session.user.openId).toBe('o1');
    expect(session.accessToken).toBe('signed-token');
    expect(fake).toHaveBeenCalledTimes(1);
    const [url, init] = fake.mock.calls[0];
    expect(String(url)).toContain('/api/auth/login');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ code: 'c' }));
    expect((init?.headers as any)['Content-Type']).toBe('application/json');
  });

  it('TC-API-CLIENT-001b happy path: GET /api/rank/global resolves with list', async () => {
    const fake = jest.fn().mockResolvedValue(jsonResponse({
      code: 0,
      data: [{ nickname: 'a', avatar: '', highScore: 100, currentRound: 1 }],
    }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    const list = await ApiClient.getGlobalRank(50);
    expect(Array.isArray(list)).toBe(true);
    expect(list[0].highScore).toBe(100);
    const [url, init] = fake.mock.calls[0];
    expect(String(url)).toContain('/api/rank/global?limit=50');
    expect(init?.method).toBe('GET');
  });

  it('TC-API-CLIENT-001c Bearer token is sent for an authenticated session', async () => {
    ApiClient.setSession('open-xyz', 'signed-token');
    const fake = jest.fn().mockResolvedValue(jsonResponse({ code: 0, data: [] }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await ApiClient.getGlobalRank(10);
    const [, init] = fake.mock.calls[0];
    expect((init?.headers as any).Authorization).toBe('Bearer signed-token');
    expect((init?.headers as any)['X-Open-Id']).toBeUndefined();
  });

  // ----- TC-API-CLIENT-002 -----
  it('TC-API-CLIENT-002 timeout: aborts after 8s and rejects', async () => {
    jest.useFakeTimers();

    // fetch returns a promise that never resolves — forces the timeout path.
    // We also capture the AbortSignal and reject with an abort-shaped error
    // when aborted (mirroring real fetch semantics).
    const fake = jest.fn((_url: RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err: any = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });
    ApiClient.setFetch(fake as unknown as typeof fetch);

    const p = ApiClient.getGlobalRank(1);
    // Attach rejection handler before advancing timers to avoid unhandled rejection.
    const assertion = expect(p).rejects.toThrow();
    jest.advanceTimersByTime(8001);
    await assertion;
    expect(fake).toHaveBeenCalledTimes(1);
  });

  // ----- TC-API-CLIENT-003 -----
  it('TC-API-CLIENT-003 5xx: rejects with API error when body.code !== 0', async () => {
    const fake = jest.fn().mockResolvedValue(jsonResponse({
      code: 500, message: 'server error',
    }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await expect(ApiClient.getGlobalRank(10)).rejects.toThrow(/API error.*code=500/);
  });

  it('TC-API-CLIENT-003b network error propagates (fetch rejection)', async () => {
    const fake = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    ApiClient.setFetch(fake as unknown as typeof fetch);
    await expect(ApiClient.getGlobalRank(10)).rejects.toThrow(/ECONNREFUSED/);
  });

  // ----- TC-API-CLIENT-004 -----
  it('TC-API-CLIENT-004 401 auto-clears the local session', async () => {
    ApiClient.setSession('will-clear', 'expired-token');
    const fake = jest.fn().mockResolvedValue(jsonResponse({
      code: 401, message: 'unauthorized',
    }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await expect(ApiClient.getGlobalRank(10)).rejects.toThrow(/code=401/);
    expect(ApiClient.getOpenId()).toBe('');
    expect(ApiClient.getAccessToken()).toBe('');
  });

  // ----- TC-API-ERR-003 (integration-api.md §错误路径) -----
  // Malformed server response must NOT leak undefined/null into callers.
  it('TC-API-ERR-003a empty {} body rejects (no undefined leaks into caller)', async () => {
    ApiClient.setFetch(jest.fn().mockResolvedValue(jsonResponse({})) as unknown as typeof fetch);
    await expect(ApiClient.getGlobalRank(10)).rejects.toThrow();
  });

  it('TC-API-ERR-003b {code:0} with missing data field rejects (no undefined leaks)', async () => {
    ApiClient.setFetch(jest.fn().mockResolvedValue(jsonResponse({ code: 0 })) as unknown as typeof fetch);
    await expect(ApiClient.getGlobalRank(10)).rejects.toThrow();
  });

  it('TC-API-ERR-003c {code:0, data:null} rejects (explicit null is not a valid payload)', async () => {
    ApiClient.setFetch(
      jest.fn().mockResolvedValue(jsonResponse({ code: 0, data: null })) as unknown as typeof fetch,
    );
    await expect(ApiClient.getGlobalRank(10)).rejects.toThrow();
  });

  // ----- Offline mode shortcircuits (bonus coverage) -----
  it('offline mode: getProfile returns canned dev-offline profile without fetch', async () => {
    ApiClient.setOpenId('dev-offline');
    const fake = jest.fn();
    ApiClient.setFetch(fake as unknown as typeof fetch);

    const p = await ApiClient.getProfile();
    expect(p.openId).toBe('dev-offline');
    expect(fake).not.toHaveBeenCalled();
  });

  it('offline mode: updateProgress returns canned response marked offline=true', async () => {
    ApiClient.setOpenId('dev-offline');
    const fake = jest.fn();
    ApiClient.setFetch(fake as unknown as typeof fetch);

    const resp = await ApiClient.updateProgress(2, 500, 3);
    expect(resp.offline).toBe(true);
    expect(resp.currentRound).toBe(2);
    expect(fake).not.toHaveBeenCalled();
  });

  it('claimReward sends only the server-controlled kind, claim id, and round', async () => {
    ApiClient.setSession('open-xyz', 'signed-token');
    const fake = jest.fn().mockResolvedValue(jsonResponse({
      code: 0,
      data: {
        openId: 'open-xyz', nickname: '', avatar: '', catCoins: 20,
        currentRound: 2, highScore: 1000, stars: { '1': 3 },
        roundScores: { '1': 1000 }, awarded: 20, alreadyClaimed: false,
      },
    }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await ApiClient.claimReward('win_double', 'win_double_1', 1);
    const [, init] = fake.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: 'win_double', claimId: 'win_double_1', round: 1,
    });
  });

  it('deleteAccount uses the authenticated DELETE endpoint', async () => {
    ApiClient.setSession('open-xyz', 'signed-token');
    const fake = jest.fn().mockResolvedValue(jsonResponse({ code: 0, data: { deleted: true } }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await expect(ApiClient.deleteAccount()).resolves.toEqual({ deleted: true });
    const [url, init] = fake.mock.calls[0];
    expect(String(url)).toContain('/api/user/account');
    expect(init?.method).toBe('DELETE');
    expect((init?.headers as any).Authorization).toBe('Bearer signed-token');
  });

  it('uses stable daily and round claim ids so a lost response can be replayed', () => {
    const beforeCstMidnight = Date.UTC(2026, 7, 28, 15, 59, 59);
    const afterCstMidnight = Date.UTC(2026, 7, 28, 16, 0, 1);

    expect(ApiClient.createDailyClaimId('gift', beforeCstMidnight)).toBe('gift_20260828');
    expect(ApiClient.createDailyClaimId('gift', beforeCstMidnight)).toBe('gift_20260828');
    expect(ApiClient.createDailyClaimId('gift', afterCstMidnight)).toBe('gift_20260829');
    expect(ApiClient.createRoundClaimId(1)).toBe('win_double_1');
  });

});
