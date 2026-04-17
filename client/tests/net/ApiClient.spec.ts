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
 *   - NO 401 auto-clear-token logic exists today.
 *
 * TC mapping:
 *   - TC-API-CLIENT-001 happy path ✔ (login POST and getGlobalRank GET)
 *   - TC-API-CLIENT-002 timeout ✔ (fetch never resolves → 8s timeout rejects)
 *     Implemented with jest fake timers to avoid actually waiting 8s.
 *   - TC-API-CLIENT-003 5xx → rejects ✔ (server returns code!=0; note the
 *     production fetch branch ignores HTTP statusCode and only reads `code`,
 *     so "5xx" is modeled as the body shape the server sends on 5xx:
 *     { code: 500, message: 'server error' }).
 *   - TC-API-CLIENT-004 401 auto-clear-token → SKIPPED (product gap: no
 *     such logic). Still asserts the current behavior: 401-shaped error
 *     body rejects and openId is preserved.
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
    ApiClient.setOpenId('');
    jest.useRealTimers();
  });

  // ----- TC-API-CLIENT-001 -----
  it('TC-API-CLIENT-001a happy path: login POST resolves with parsed body', async () => {
    const fake = jest.fn().mockResolvedValue(jsonResponse({
      code: 0,
      data: {
        openId: 'o1', nickname: 'n', avatar: '',
        catCoins: 0, currentRound: 1, highScore: 0,
        stars: {}, roundScores: {},
      },
    }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    const profile = await ApiClient.login({ code: 'c' });
    expect(profile.openId).toBe('o1');
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

  it('TC-API-CLIENT-001c X-Open-Id header is sent when openId is set', async () => {
    ApiClient.setOpenId('open-xyz');
    const fake = jest.fn().mockResolvedValue(jsonResponse({ code: 0, data: [] }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await ApiClient.getGlobalRank(10);
    const [, init] = fake.mock.calls[0];
    expect((init?.headers as any)['X-Open-Id']).toBe('open-xyz');
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
  // SKIP-REASON: FU-T2-03 — ApiClient has no 401 auto-clear branch yet.
  it.skip('TC-API-CLIENT-004 401 auto-clears token (product gap: not implemented)', () => {
    // ApiClient has no 401-handling branch today. Unskip once implemented.
  });

  it('TC-API-CLIENT-004 current behavior: 401-shaped body rejects; openId preserved', async () => {
    ApiClient.setOpenId('will-stay');
    const fake = jest.fn().mockResolvedValue(jsonResponse({
      code: 401, message: 'unauthorized',
    }));
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await expect(ApiClient.getGlobalRank(10)).rejects.toThrow(/code=401/);
    // No auto-clear today — documents current contract.
    expect(ApiClient.getOpenId()).toBe('will-stay');
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

    const resp = await ApiClient.updateProgress(2, 500, 3, 20);
    expect(resp.offline).toBe(true);
    expect(resp.currentRound).toBe(2);
    expect(fake).not.toHaveBeenCalled();
  });
});
