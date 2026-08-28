import { ItemManager } from '../../assets/scenes/scripts/core/ItemManager';
import { GameState } from '../../assets/scenes/scripts/data/GameState';
import { DouyinSDK } from '../../assets/scenes/scripts/platform/DouyinSDK';
import { Toast } from '../../assets/scenes/scripts/utils/Toast';

describe('ItemManager rewarded-ad input guard', () => {
  let manager: ItemManager;
  let toastSpy: jest.SpyInstance;

  beforeEach(() => {
    GameState.instance.resetRound();
    GameState.instance.currentRound = 1;
    manager = new ItemManager();
    toastSpy = jest.spyOn(Toast, 'show').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('coalesces rapid taps and unlocks after the request settles', async () => {
    let finish!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => { finish = resolve; });
    const adSpy = jest.spyOn(DouyinSDK, 'showRewardedAd')
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(true);

    const first = manager.onAdClicked();
    const duplicate = manager.onAdClicked();
    expect(adSpy).toHaveBeenCalledTimes(1);

    finish(true);
    await Promise.all([first, duplicate]);
    expect(GameState.instance.gold).toBe(25);
    expect(toastSpy).toHaveBeenCalledTimes(1);

    await manager.onAdClicked();
    expect(adSpy).toHaveBeenCalledTimes(2);
    expect(GameState.instance.gold).toBe(35);
  });
});
