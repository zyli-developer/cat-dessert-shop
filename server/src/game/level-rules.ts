export const TOTAL_ROUNDS = 30;
export const MAX_REPORTED_SCORE = 10_000_000;

const CURATED_THRESHOLDS: ReadonlyArray<{ star2: number; star3: number }> = [
  { star2: 550, star3: 950 },
  { star2: 900, star3: 1500 },
  { star2: 4400, star3: 7000 },
  { star2: 5500, star3: 8800 },
  { star2: 7400, star3: 11500 },
  { star2: 9200, star3: 14500 },
  { star2: 14000, star3: 21500 },
  { star2: 17500, star3: 27000 },
  { star2: 18500, star3: 28500 },
  { star2: 20500, star3: 31500 },
];

const GENERATED_STAR3_GROWTH = 4200;

export function getStarThresholds(round: number): { star2: number; star3: number } {
  const curated = CURATED_THRESHOLDS[round - 1];
  if (curated) return curated;

  const star3 = CURATED_THRESHOLDS[CURATED_THRESHOLDS.length - 1].star3
    + (round - CURATED_THRESHOLDS.length) * GENERATED_STAR3_GROWTH;
  return { star2: Math.round(star3 * 0.65), star3 };
}

export function calculateStars(round: number, score: number): number {
  const thresholds = getStarThresholds(round);
  if (score >= thresholds.star3) return 3;
  if (score >= thresholds.star2) return 2;
  return 1;
}
