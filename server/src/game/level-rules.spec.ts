import { calculateStars, getStarThresholds } from './level-rules';

describe('level rules', () => {
  it('matches curated round thresholds', () => {
    expect(calculateStars(1, 549)).toBe(1);
    expect(calculateStars(1, 550)).toBe(2);
    expect(calculateStars(1, 950)).toBe(3);
  });

  it('matches generated round threshold growth', () => {
    expect(getStarThresholds(11)).toEqual({ star2: 23205, star3: 35700 });
    expect(getStarThresholds(30)).toEqual({ star2: 75075, star3: 115500 });
  });
});
