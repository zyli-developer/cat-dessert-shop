/**
 * Levels + DessertConfig schema spec (T2-11 / TC-CFG-001).
 *
 * Validates that `resources/configs/levels.json` matches `LevelData` shape
 * and cross-references `DessertConfig.DESSERTS`. Uses zod (installed in T2-01).
 *
 * Contract enforced:
 *   - Round ids are contiguous 1..N.
 *   - Each level has: round, customers[], dropRange [min,max] with min<=max,
 *     star2Score, star3Score, and star2Score < star3Score.
 *   - Every customer demand level is an integer within 1..MAX_LEVEL
 *     (i.e. exists in DESSERTS).
 *   - Each demand count is a positive integer.
 *   - Star thresholds strictly ascending across rounds (scaling difficulty).
 *
 * DessertConfig schema:
 *   - Levels are contiguous 1..MAX_LEVEL.
 *   - radius strictly ascending with level (bigger dessert = bigger radius).
 *   - score monotonically non-decreasing (doubling pattern in actual data).
 */

import { z } from 'zod';
import levels from '../../assets/resources/configs/levels.json';
import { DESSERTS, MAX_LEVEL, getDessert } from '../../assets/scenes/scripts/data/DessertConfig';

const DemandSchema = z.object({
  level: z.number().int().min(1).max(MAX_LEVEL),
  count: z.number().int().positive(),
});

const CustomerSchema = z.object({
  demands: z.array(DemandSchema).min(1),
});

const LevelSchema = z.object({
  round: z.number().int().positive(),
  name: z.string().min(1),
  customers: z.array(CustomerSchema).min(1),
  dropRange: z.tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([a, b]) => a <= b, 'dropRange min must be <= max'),
  star2Score: z.number().int().positive(),
  star3Score: z.number().int().positive(),
}).refine(d => d.star2Score < d.star3Score, 'star2Score must be < star3Score');

const LevelsSchema = z.array(LevelSchema).min(1);

describe('levels.json + DessertConfig schema (T2-11 / TC-CFG-001)', () => {
  it('levels.json matches LevelData schema', () => {
    const parsed = LevelsSchema.safeParse(levels);
    if (!parsed.success) {
      // Surface full error for debugging.
      throw new Error(JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.success).toBe(true);
  });

  it('round ids are contiguous 1..N', () => {
    for (let i = 0; i < (levels as any[]).length; i++) {
      expect((levels as any[])[i].round).toBe(i + 1);
    }
  });

  it('star thresholds strictly ascend across rounds', () => {
    const arr = levels as any[];
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i].star2Score).toBeGreaterThan(arr[i - 1].star2Score);
      expect(arr[i].star3Score).toBeGreaterThan(arr[i - 1].star3Score);
    }
  });

  it('every customer demand references an existing dessert level', () => {
    for (const lvl of levels as any[]) {
      for (const customer of lvl.customers) {
        for (const d of customer.demands) {
          expect(d.level).toBeGreaterThanOrEqual(1);
          expect(d.level).toBeLessThanOrEqual(MAX_LEVEL);
          const dessert = getDessert(d.level);
          expect(dessert).toBeDefined();
          expect(dessert.level).toBe(d.level);
        }
      }
    }
  });

  it('DessertConfig: levels are contiguous 1..MAX_LEVEL', () => {
    expect(DESSERTS.length).toBe(MAX_LEVEL);
    DESSERTS.forEach((d, i) => expect(d.level).toBe(i + 1));
  });

  it('DessertConfig: radius strictly ascending; score non-decreasing', () => {
    for (let i = 1; i < DESSERTS.length; i++) {
      expect(DESSERTS[i].radius).toBeGreaterThan(DESSERTS[i - 1].radius);
      expect(DESSERTS[i].score).toBeGreaterThanOrEqual(DESSERTS[i - 1].score);
    }
  });

  it('DessertConfig: every dessert has a texture path rooted at textures/desserts/', () => {
    for (const d of DESSERTS) {
      expect(typeof d.texture).toBe('string');
      expect(d.texture.startsWith('textures/desserts/')).toBe(true);
      expect(d.name.length).toBeGreaterThan(0);
    }
  });
});
