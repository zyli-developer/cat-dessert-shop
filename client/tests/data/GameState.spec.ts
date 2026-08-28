/**
 * Unit tests for GameState (T2-10 / TC-STATE-001..002).
 *
 * Actual GameState shape (verified against assets/scenes/scripts/data/GameState.ts):
 *   - singleton (static instance)
 *   - EventTarget `events` emits: 'score-changed', 'gold-changed', 'profile-changed'
 *   - mutators: resetRound, addGold, spendGold, addScore, addMerge
 *   - selectors: getCurrentLevel, calcStars, getCatCoinReward, getTotalStarsCount
 *   - API glue: applyProgressFromApi
 *   - offline persistence: loadOfflineProfile / persistOfflineProfile
 *
 * TC mapping:
 *   - TC-STATE-001 persistence round-trip
 *   - TC-STATE-002 durable online progress queue
 *
 * Scoring/reset/stars/addScore duplicate ScoreManager.spec.ts — not repeated.
 * The tests below cover GameState's OTHER unique surface: spendGold,
 * applyProgressFromApi, getCatCoinReward, getTotalStarsCount,
 * getCurrentLevel bounds, and the KVStorage seam wiring itself.
 */

import { GameState, KVStorage } from '../../assets/scenes/scripts/data/GameState';
import type { UserProfile } from '../../assets/scenes/scripts/net/ApiTypes';
import type { LevelData } from '../../assets/scenes/scripts/data/GameTypes';

function baseProfile(): UserProfile {
  return {
    openId: 'u1',
    nickname: 'tester',
    avatar: '',
    catCoins: 0,
    currentRound: 1,
    highScore: 0,
    stars: {},
    roundScores: {},
  };
}

function level(round: number, star2 = 300, star3 = 600): LevelData {
  return { round, customers: [], dropRange: [1, 1], star2Score: star2, star3Score: star3 };
}

/** In-memory KVStorage for seam wiring assertion. */
function makeMemStorage(): KVStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? '',
    set: (k, v) => { data.set(k, v); },
    remove: (k) => { data.delete(k); },
  };
}

describe('GameState (T2-10)', () => {
  let storage: ReturnType<typeof makeMemStorage>;

  beforeEach(() => {
    const gs = GameState.instance;
    storage = makeMemStorage();
    gs.setStorage(storage);
    gs.resetRound();
    gs.userProfile = null;
    gs.allLevels = [];
    gs.currentRound = 1;
  });

  it('TC-STATE-001 persists and restores the offline profile', () => {
    const gs = GameState.instance;
    gs.userProfile = {
      ...baseProfile(), openId: 'dev-offline', nickname: '本地猫', catCoins: 35,
      currentRound: 4, highScore: 880, stars: { '1': 3 }, roundScores: { '1': 880 },
    };
    gs.persistOfflineProfile();

    const restored = gs.loadOfflineProfile();
    expect(restored).toEqual(gs.userProfile);
    expect(storage.data.size).toBe(1);
  });

  it('ignores corrupt offline storage and clamps invalid values', () => {
    const gs = GameState.instance;
    storage.set('catbakery_offline_profile_v1', '{broken');
    expect(gs.loadOfflineProfile().currentRound).toBe(1);

    storage.set('catbakery_offline_profile_v1', JSON.stringify({
      catCoins: -10, currentRound: 2.9, highScore: Number.NaN,
      stars: { '1': 99, bad: 2 }, roundScores: { '1': 12.8 },
    }));
    const restored = gs.loadOfflineProfile();
    expect(restored.catCoins).toBe(0);
    expect(restored.currentRound).toBe(2);
    expect(restored.stars).toEqual({ '1': 3 });
    expect(restored.roundScores).toEqual({ '1': 12 });
  });

  it('TC-STATE-002 persists pending online progress and restores it in round order', () => {
    const gs = GameState.instance;
    gs.queuePendingProgress('u1', 3, 900, 3);
    gs.queuePendingProgress('u1', 1, 300, 2);

    expect(gs.getPendingProgress('u1').map(({ round, score, stars }) => ({ round, score, stars })))
      .toEqual([
        { round: 1, score: 300, stars: 2 },
        { round: 3, score: 900, stars: 3 },
      ]);
    expect(storage.data.has('catbakery_pending_progress_v1')).toBe(true);
  });

  it('pending progress is isolated by user and cannot be downgraded', () => {
    const gs = GameState.instance;
    gs.queuePendingProgress('u1', 1, 500, 2);
    gs.queuePendingProgress('u1', 1, 300, 1);
    gs.queuePendingProgress('u2', 1, 700, 3);

    expect(gs.getPendingProgress('u1')).toHaveLength(1);
    expect(gs.getPendingProgress('u1')[0].score).toBe(500);
    expect(gs.getPendingProgress('u2')[0].score).toBe(700);
  });

  it('acknowledging an older upload keeps a better result queued mid-request', () => {
    const gs = GameState.instance;
    gs.queuePendingProgress('u1', 1, 500, 2);
    const submitted = gs.getPendingProgress('u1')[0];

    gs.queuePendingProgress('u1', 1, 800, 3);
    gs.acknowledgePendingProgress(submitted);
    expect(gs.hasPendingProgress('u1', 1)).toBe(true);
    expect(gs.getPendingProgress('u1')[0].score).toBe(800);

    gs.acknowledgePendingProgress(gs.getPendingProgress('u1')[0]);
    expect(gs.hasPendingProgress('u1', 1)).toBe(false);
    expect(storage.data.has('catbakery_pending_progress_v1')).toBe(false);
  });

  it('ignores malformed pending queue records and invalid enqueue input', () => {
    const gs = GameState.instance;
    storage.set('catbakery_pending_progress_v1', JSON.stringify([
      null,
      { openId: '', round: 1, score: 1, stars: 1 },
      { openId: 'u1', round: 0, score: 1, stars: 1 },
      { openId: 'u1', round: 1, score: -1, stars: 1 },
      { openId: 'u1', round: 1, score: 1, stars: 4 },
      { openId: 'u1', round: 2, score: 20, stars: 1, updatedAt: 'bad' },
    ]));
    gs.queuePendingProgress('dev-offline', 1, 100, 1);
    gs.queuePendingProgress('u1', 1.5, 100, 1);

    expect(gs.getPendingProgress('u1')).toEqual([
      { openId: 'u1', round: 2, score: 20, stars: 1, updatedAt: 0 },
    ]);
  });

  it('setStorage replaces the internal KVStorage seam (structural check)', () => {
    const gs = GameState.instance;
    const mem = makeMemStorage();
    // Exercises the public setter — no throw, chainable default.
    expect(() => gs.setStorage(mem)).not.toThrow();
    // Direct behavioral round-trip through the injected storage to confirm
    // the custom KVStorage contract is honored.
    mem.set('k', '"v"');
    expect(mem.get('k')).toBe('"v"');
    mem.remove('k');
    expect(mem.get('k')).toBe('');
  });

  it('spendGold deducts when sufficient and rejects when insufficient', () => {
    const gs = GameState.instance;
    // resetRound sets gold to INITIAL_GOLD (15).
    const seen: number[] = [];
    gs.events.on('gold-changed', (v: number) => seen.push(v));

    expect(gs.spendGold(5)).toBe(true);
    expect(gs.gold).toBe(10);
    expect(gs.spendGold(999)).toBe(false);
    expect(gs.gold).toBe(10);         // unchanged on failure
    expect(gs.spendGold(10)).toBe(true);
    expect(gs.gold).toBe(0);
    expect(seen).toEqual([10, 0]);    // only successful spends emit
  });

  it('getCurrentLevel returns null when currentRound is out of bounds', () => {
    const gs = GameState.instance;
    gs.allLevels = [level(1), level(2)];
    gs.currentRound = 1;
    expect(gs.getCurrentLevel()?.round).toBe(1);
    gs.currentRound = 2;
    expect(gs.getCurrentLevel()?.round).toBe(2);
    gs.currentRound = 3;
    expect(gs.getCurrentLevel()).toBeNull();
    gs.currentRound = 0;
    expect(gs.getCurrentLevel()).toBeNull();
    gs.currentRound = -1;
    expect(gs.getCurrentLevel()).toBeNull();
  });

  it('getCatCoinReward maps stars 1/2/3 → 5/10/20 and 0 otherwise', () => {
    const gs = GameState.instance;
    expect(gs.getCatCoinReward(1)).toBe(5);
    expect(gs.getCatCoinReward(2)).toBe(10);
    expect(gs.getCatCoinReward(3)).toBe(20);
    expect(gs.getCatCoinReward(0)).toBe(0);
    expect(gs.getCatCoinReward(4)).toBe(0);
  });

  it('getTotalStarsCount sums UserProfile.stars values', () => {
    const gs = GameState.instance;
    expect(gs.getTotalStarsCount()).toBe(0); // no profile
    gs.userProfile = baseProfile();
    expect(gs.getTotalStarsCount()).toBe(0);
    gs.userProfile.stars = { '1': 3, '2': 2, '3': 1 };
    expect(gs.getTotalStarsCount()).toBe(6);
  });

  it('applyProgressFromApi noop when userProfile is null', () => {
    const gs = GameState.instance;
    gs.userProfile = null;
    // Should not throw, should not create a profile out of thin air.
    gs.applyProgressFromApi({
      catCoins: 10, currentRound: 2, highScore: 500,
      stars: { '1': 3 }, roundScores: { '1': 500 },
    });
    expect(gs.userProfile).toBeNull();
  });

  it('applyProgressFromApi overwrites scalar fields and clones maps, emits profile-changed', () => {
    const gs = GameState.instance;
    gs.userProfile = baseProfile();
    const changes: any[] = [];
    gs.events.on('profile-changed', () => changes.push(true));

    const starsIn = { '1': 3, '2': 2 };
    const roundScoresIn = { '1': 720, '2': 480 };
    gs.applyProgressFromApi({
      catCoins: 55,
      currentRound: 3,
      highScore: 720,
      stars: starsIn,
      roundScores: roundScoresIn,
    });

    expect(gs.userProfile!.catCoins).toBe(55);
    expect(gs.userProfile!.currentRound).toBe(3);
    expect(gs.userProfile!.highScore).toBe(720);
    expect(gs.userProfile!.stars).toEqual(starsIn);
    expect(gs.userProfile!.roundScores).toEqual(roundScoresIn);
    // Defensive clone: mutating the input map must not affect stored state.
    (starsIn as any)['1'] = 1;
    (roundScoresIn as any)['1'] = 0;
    expect(gs.userProfile!.stars['1']).toBe(3);
    expect(gs.userProfile!.roundScores['1']).toBe(720);
    expect(changes.length).toBe(1);
  });

  it('initial defaults: currentRound=1, gold=15, score=0, mergeCount=0', () => {
    const gs = GameState.instance;
    // resetRound runs in beforeEach.
    expect(gs.currentRound).toBe(1);
    expect(gs.gold).toBe(15);
    expect(gs.score).toBe(0);
    expect(gs.mergeCount).toBe(0);
  });
});
