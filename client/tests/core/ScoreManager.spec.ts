/**
 * Unit tests for ScoreManager (TC-SCORE-001..004).
 *
 * IMPORTANT — scope correction vs. TC template:
 *   `ScoreManager` in this codebase is a THIN HUD listener. It subscribes to
 *   `GameState.events` for 'score-changed' / 'gold-changed' and writes to two
 *   Labels. It does NOT own:
 *     - score accumulation (TC-SCORE-001)
 *     - star thresholds (TC-SCORE-002)
 *     - roundScores payload (TC-SCORE-003)
 *     - reset() (TC-SCORE-004)
 *   All of that lives in `data/GameState.ts`. These specs therefore verify the
 *   scoring contract on GameState (the real owner of the behavior the TCs
 *   describe) AND separately verify ScoreManager's HUD-binding behavior. No
 *   new "ScoreManager API" is fabricated.
 *
 * Real GameState shape:
 *   score: number (initial 0)
 *   addScore(points): void                  // emits 'score-changed'
 *   resetRound(): void                      // zeros score/gold/mergeCount
 *   getCurrentLevel(): LevelData | null
 *   calcStars(): 1 | 2 | 3 based on star2Score / star3Score
 *   applyProgressFromApi({roundScores}): void  // writes roundScores onto userProfile
 *
 * Per ApiTypes.ts, `UserProfile.roundScores` is `Record<string, number>` and
 * `UserProfile.stars` is `Record<string, number>` — we assert that shape.
 *
 * GameState is a singleton — reset score/gold/profile in beforeEach to isolate tests.
 */

import { ScoreManager } from '../../assets/scenes/scripts/core/ScoreManager';
import { GameState } from '../../assets/scenes/scripts/data/GameState';
import { Node, Label } from 'cc';
import type { LevelData } from '../../assets/scenes/scripts/data/GameTypes';
import type { UserProfile } from '../../assets/scenes/scripts/net/ApiTypes';

function level(round: number, star2: number, star3: number): LevelData {
  return {
    round,
    customers: [],
    dropRange: [-200, 200],
    star2Score: star2,
    star3Score: star3,
  };
}

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

describe('ScoreManager (HUD) + GameState (scoring engine)', () => {
  beforeEach(() => {
    const gs = GameState.instance;
    gs.resetRound();
    gs.userProfile = null;
    gs.allLevels = [];
    gs.currentRound = 1;
  });

  // ----- TC-SCORE-001 -----
  it('TC-SCORE-001 addScore accumulates and emits score-changed', () => {
    const gs = GameState.instance;
    const seen: number[] = [];
    gs.events.on('score-changed', (v: number) => seen.push(v));

    gs.addScore(10);
    gs.addScore(25);
    gs.addScore(7);

    expect(gs.score).toBe(42);
    expect(seen).toEqual([10, 35, 42]);
  });

  // ----- TC-SCORE-002 -----
  it('TC-SCORE-002 calcStars respects per-level star2Score/star3Score thresholds', () => {
    const gs = GameState.instance;
    // Use thresholds referenced by the template (star2=300, star3=600) to
    // exercise the stated boundaries 99/100/299/300/599/600/700 → 1/1/1/2/2/3/3.
    // Below star2 returns 1 (the implementation's floor); star2 hit → 2;
    // star3 hit → 3. Boundary is inclusive on both thresholds.
    gs.allLevels = [level(1, 300, 600)];
    gs.currentRound = 1;

    const cases: Array<[number, number]> = [
      [99, 1], [100, 1], [299, 1],
      [300, 2], [599, 2],
      [600, 3], [700, 3],
    ];
    for (const [score, expected] of cases) {
      gs.score = score;
      expect(gs.calcStars()).toBe(expected);
    }
  });

  // ----- TC-SCORE-003 -----
  it('TC-SCORE-003 roundScores payload matches ApiTypes (Record<string, number>)', () => {
    const gs = GameState.instance;
    gs.userProfile = baseProfile();

    gs.applyProgressFromApi({
      catCoins: 55,
      currentRound: 3,
      highScore: 720,
      stars: { '1': 3, '2': 2 },
      roundScores: { '1': 720, '2': 480 },
    });

    const rs = gs.userProfile!.roundScores;
    // Shape: plain object, string keys, number values.
    expect(typeof rs).toBe('object');
    expect(Array.isArray(rs)).toBe(false);
    for (const [k, v] of Object.entries(rs)) {
      expect(typeof k).toBe('string');
      expect(typeof v).toBe('number');
    }
    expect(rs).toEqual({ '1': 720, '2': 480 });
    // Companion stars field follows the same contract.
    const stars = gs.userProfile!.stars;
    expect(stars).toEqual({ '1': 3, '2': 2 });
    for (const v of Object.values(stars)) expect(typeof v).toBe('number');
    // Round-trip sanity: high-level counters.
    expect(gs.userProfile!.catCoins).toBe(55);
    expect(gs.userProfile!.currentRound).toBe(3);
    expect(gs.userProfile!.highScore).toBe(720);
  });

  // ----- TC-SCORE-004 -----
  it('TC-SCORE-004 resetRound() zeros score (and companion round state)', () => {
    const gs = GameState.instance;
    gs.addScore(123);
    gs.addGold(9);
    gs.addMerge();
    expect(gs.score).toBe(123);

    gs.resetRound();
    expect(gs.score).toBe(0);
    expect(gs.gold).toBe(15); // INITIAL_GOLD
    expect(gs.mergeCount).toBe(0);
  });

  // ----- ScoreManager HUD binding (covers the component file itself) -----
  it('ScoreManager updates Labels on score-changed / gold-changed', () => {
    const gs = GameState.instance;
    gs.score = 42;
    gs.gold = 7;

    const sm = new ScoreManager();
    const scoreLabel = new Node('score').addComponent(Label);
    const goldLabel = new Node('gold').addComponent(Label);
    sm.scoreLabel = scoreLabel;
    sm.goldLabel = goldLabel;

    sm.onLoad!();
    // Initial push from onLoad reflects current state.
    expect(scoreLabel.string).toBe('42');
    expect(goldLabel.string).toBe('7');

    // Subsequent events update the labels.
    gs.addScore(8);
    expect(scoreLabel.string).toBe('50');
    gs.addGold(3);
    expect(goldLabel.string).toBe('10');

    sm.onDestroy!();
    // After onDestroy, further events no longer mutate the labels.
    gs.addScore(100);
    expect(scoreLabel.string).toBe('50');
  });
});
