import { isConfiguredAdUnitId } from '../../assets/scenes/scripts/platform/AdConfig';

describe('AdConfig', () => {
  it.each([
    '', 'game_ad_gold', 'win_double', 'fail_revive', 'home_catcoin',
    'home_daily_gift', 'rewarded_video_ad', 'test-ad-unit-1', 'placeholder', 'xxx',
  ])('rejects development ad unit ID %p', (value) => {
    expect(isConfiguredAdUnitId(value)).toBe(false);
  });

  it('accepts a non-placeholder platform ad unit ID', () => {
    expect(isConfiguredAdUnitId('998877001')).toBe(true);
  });
});
