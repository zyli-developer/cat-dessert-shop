import { ApiClient, setFetchImpl } from '../../assets/scenes/scripts/net/ApiClient';
import { GameState, KVStorage } from '../../assets/scenes/scripts/data/GameState';

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as unknown as Response;
}

function responseFor(round: number, score: number, stars: number): Response {
  return jsonResponse({
    code: 0,
    data: {
      catCoins: stars * 5,
      currentRound: round + 1,
      highScore: score,
      stars: { [String(round)]: stars },
      roundScores: { [String(round)]: score },
    },
  });
}

describe('pending progress sync', () => {
  let storage: KVStorage;

  beforeEach(() => {
    const data = new Map<string, string>();
    storage = {
      get: (key) => data.get(key) ?? '',
      set: (key, value) => { data.set(key, value); },
      remove: (key) => { data.delete(key); },
    };
    GameState.instance.setStorage(storage);
    GameState.instance.userProfile = {
      openId: 'open-xyz', nickname: '', avatar: '', catCoins: 0,
      currentRound: 1, highScore: 0, stars: {}, roundScores: {},
    };
    ApiClient.setSession('open-xyz', 'signed-token');
  });

  afterEach(() => {
    ApiClient.clearSession();
    setFetchImpl(((input: RequestInfo, init?: RequestInit) =>
      fetch(input as any, init)) as typeof fetch);
  });

  it('uploads queued rounds in order and removes only confirmed entries', async () => {
    const state = GameState.instance;
    state.queuePendingProgress('open-xyz', 2, 1000, 2);
    state.queuePendingProgress('open-xyz', 1, 600, 2);
    const fake = jest.fn().mockImplementation((_url: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return Promise.resolve(responseFor(body.round, body.score, body.stars));
    });
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await expect(ApiClient.syncPendingProgress()).resolves.toEqual({ synced: 2, remaining: 0 });
    expect(fake.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).round)).toEqual([1, 2]);
  });

  it('re-reads the queue when a better result arrives during an upload', async () => {
    const state = GameState.instance;
    state.queuePendingProgress('open-xyz', 1, 600, 2);
    const sentScores: number[] = [];
    const fake = jest.fn().mockImplementation((_url: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      sentScores.push(body.score);
      if (sentScores.length === 1) state.queuePendingProgress('open-xyz', 1, 1000, 3);
      return Promise.resolve(responseFor(body.round, body.score, body.stars));
    });
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await expect(ApiClient.syncPendingProgress()).resolves.toEqual({ synced: 2, remaining: 0 });
    expect(sentScores).toEqual([600, 1000]);
    expect(state.userProfile?.roundScores['1']).toBe(1000);
  });

  it('stops on failure and retains all unconfirmed entries', async () => {
    const state = GameState.instance;
    state.queuePendingProgress('open-xyz', 1, 600, 2);
    state.queuePendingProgress('open-xyz', 2, 1000, 2);
    ApiClient.setFetch(jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch);

    await expect(ApiClient.syncPendingProgress()).resolves.toEqual({ synced: 0, remaining: 2 });
    expect(state.getPendingProgress('open-xyz').map((entry) => entry.round)).toEqual([1, 2]);
  });

  it('does not send queued data without an authenticated session', async () => {
    GameState.instance.queuePendingProgress('open-xyz', 1, 600, 2);
    ApiClient.setOpenId('open-xyz');
    const fake = jest.fn();
    ApiClient.setFetch(fake as unknown as typeof fetch);

    await expect(ApiClient.syncPendingProgress()).resolves.toEqual({ synced: 0, remaining: 1 });
    expect(fake).not.toHaveBeenCalled();
  });
});
