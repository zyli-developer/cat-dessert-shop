/**
 * Unit tests for the procedural LevelGenerator.
 * 关注点：确定性（同关号→同关）、结构合法、难度单调、数值在可通关范围内。
 */
import { generateLevel, buildLevels, TOTAL_ROUNDS } from '../../assets/scenes/scripts/data/LevelGenerator';
import { MAX_LEVEL, BLOCKER_LEVEL, BLOCKER_LEVEL_T2 } from '../../assets/scenes/scripts/data/DessertConfig';
import { LevelData } from '../../assets/scenes/scripts/data/GameTypes';

const CURATED_COUNT = 10;
const BASE_STAR3 = 31500;

describe('LevelGenerator.generateLevel', () => {
  it('确定性：同一关号生成完全相同的关卡', () => {
    const a = generateLevel(17, CURATED_COUNT, BASE_STAR3);
    const b = generateLevel(17, CURATED_COUNT, BASE_STAR3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('不同关号生成不同关卡（名称/订单不同）', () => {
    const a = generateLevel(11, CURATED_COUNT, BASE_STAR3);
    const b = generateLevel(12, CURATED_COUNT, BASE_STAR3);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('结构合法：8 个顾客、dropRange [1,3]、star2 < star3', () => {
    const lv = generateLevel(15, CURATED_COUNT, BASE_STAR3);
    expect(lv.round).toBe(15);
    expect(lv.customers).toHaveLength(8);
    expect(lv.dropRange).toEqual([1, 3]);
    expect(lv.star2Score).toBeLessThan(lv.star3Score);
    expect(lv.name).toMatch(/狂想/);
  });

  it('订单等级都是可合成甜品（5..MAX_LEVEL，不含障碍物）', () => {
    for (let round = 11; round <= 40; round++) {
      const lv = generateLevel(round, CURATED_COUNT, BASE_STAR3);
      for (const c of lv.customers) {
        for (const d of c.demands) {
          expect(d.level).toBeGreaterThanOrEqual(MAX_LEVEL - 3);
          expect(d.level).toBeLessThanOrEqual(MAX_LEVEL);
          expect(d.count).toBeGreaterThanOrEqual(1);
          expect(d.count).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('障碍物：含 T1+T2 两档，概率封顶且总和 < 1', () => {
    const lv = generateLevel(50, CURATED_COUNT, BASE_STAR3);
    const levels = (lv.blockers ?? []).map((b) => b.level).sort((x, y) => y - x);
    expect(levels).toEqual([BLOCKER_LEVEL, BLOCKER_LEVEL_T2]);
    const total = (lv.blockers ?? []).reduce((s, b) => s + b.chance, 0);
    expect(total).toBeLessThan(0.25);
    for (const b of lv.blockers ?? []) expect(b.chance).toBeLessThanOrEqual(0.15 + 1e-9);
  });

  it('难度单调：3 星阈值随关卡严格递增', () => {
    let prev = -1;
    for (let round = 11; round <= 60; round++) {
      const lv = generateLevel(round, CURATED_COUNT, BASE_STAR3);
      expect(lv.star3Score).toBeGreaterThan(prev);
      prev = lv.star3Score;
    }
  });

  it('生成关第一关延续手工关的星级水位（不出现难度断崖）', () => {
    const first = generateLevel(11, CURATED_COUNT, BASE_STAR3);
    // 11 关只比基线高一个增量，应接近而非暴涨
    expect(first.star3Score).toBeGreaterThan(BASE_STAR3);
    expect(first.star3Score).toBeLessThan(BASE_STAR3 * 1.3);
  });
});

describe('LevelGenerator.buildLevels', () => {
  const curated: LevelData[] = Array.from({ length: CURATED_COUNT }, (_, i) => ({
    round: i + 1,
    name: `手工关${i + 1}`,
    customers: [{ demands: [{ level: 4, count: 1 }] }],
    dropRange: [1, 2],
    star2Score: 100 * (i + 1),
    star3Score: 200 * (i + 1),
  }));

  it('补足到 TOTAL_ROUNDS 关', () => {
    const all = buildLevels(curated);
    expect(all).toHaveLength(TOTAL_ROUNDS);
  });

  it('手工关前缀原样保留', () => {
    const all = buildLevels(curated);
    for (let i = 0; i < CURATED_COUNT; i++) {
      expect(all[i]).toBe(curated[i]);
    }
  });

  it('生成关的 round 字段连续且正确', () => {
    const all = buildLevels(curated);
    for (let i = CURATED_COUNT; i < all.length; i++) {
      expect(all[i].round).toBe(i + 1);
    }
  });

  it('生成关从手工关末尾星级水位继续上爬', () => {
    const all = buildLevels(curated);
    const lastCurated = curated[CURATED_COUNT - 1].star3Score; // 2000
    expect(all[CURATED_COUNT].star3Score).toBeGreaterThan(lastCurated);
  });

  it('自定义总关数', () => {
    expect(buildLevels(curated, 12)).toHaveLength(12);
    expect(buildLevels(curated, CURATED_COUNT)).toHaveLength(CURATED_COUNT); // 不生成
  });
});
