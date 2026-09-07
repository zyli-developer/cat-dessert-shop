import { Node } from 'cc';
import { GameState } from '../../assets/scenes/scripts/data/GameState';
import { ApiClient } from '../../assets/scenes/scripts/net/ApiClient';
import { DouyinSDK } from '../../assets/scenes/scripts/platform/DouyinSDK';
import { HomeScene } from '../../assets/scenes/scripts/ui/HomeScene';

describe('reward claim retry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    ApiClient.clearSession();
  });

  it('reuses the completed ad and claim id when the home reward response is lost', async () => {
    const scene = new HomeScene();
    scene.node = new Node('Home');
    GameState.instance.userProfile = {
      openId: 'user-1', nickname: '', avatar: '', catCoins: 0,
      currentRound: 1, highScore: 0, stars: {}, roundScores: {},
    };
    ApiClient.setSession('user-1', 'token');

    const showAd = jest.spyOn(DouyinSDK, 'showRewardedAd').mockResolvedValue(true);
    const claim = jest.spyOn(ApiClient, 'claimReward')
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({
        ...GameState.instance.userProfile,
        catCoins: 10,
        awarded: 0,
        alreadyClaimed: true,
      });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await (scene as any).onAdCatCoinClicked();
    await (scene as any).onAdCatCoinClicked();

    expect(showAd).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledTimes(2);
    expect(claim.mock.calls[1][1]).toBe(claim.mock.calls[0][1]);
    expect(GameState.instance.userProfile.catCoins).toBe(10);
  });
});
