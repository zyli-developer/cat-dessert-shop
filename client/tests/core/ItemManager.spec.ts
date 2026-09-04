import { Node } from 'cc';
import { ItemManager } from '../../assets/scenes/scripts/core/ItemManager';
import { GameState } from '../../assets/scenes/scripts/data/GameState';
import { DouyinSDK } from '../../assets/scenes/scripts/platform/DouyinSDK';
import { AD_UNIT_IDS } from '../../assets/scenes/scripts/platform/AdConfig';
import { Toast } from '../../assets/scenes/scripts/utils/Toast';

describe('ItemManager', () => {
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

  it('grants gold only after a rewarded video completes', async () => {
    const adSpy = jest.spyOn(DouyinSDK, 'showRewardedAd').mockResolvedValue(true);

    await manager.onAdClicked();

    expect(adSpy).toHaveBeenCalledWith(AD_UNIT_IDS.gameGold);
    expect(GameState.instance.gold).toBe(25);
    expect(toastSpy).toHaveBeenCalledWith('+10 金币', false, 'icon_coin');
  });

  it('does not grant gold when the rewarded video is not completed', async () => {
    jest.spyOn(DouyinSDK, 'showRewardedAd').mockResolvedValue(false);

    await manager.onAdClicked();

    expect(GameState.instance.gold).toBe(15);
    expect(toastSpy).toHaveBeenCalledWith(expect.any(String), true, 'icon_ad');
  });

  it('coalesces rapid ad taps and unlocks after the request settles', async () => {
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

    await manager.onAdClicked();
    expect(adSpy).toHaveBeenCalledTimes(2);
    expect(GameState.instance.gold).toBe(35);
  });

  it('builds affordable tool states and cleans listeners on destroy', () => {
    manager.btnHammer = new Node('Hammer');
    manager.btnShuffle = new Node('Shuffle');
    manager.btnAd = new Node('Ad');
    manager.containerNode = new Node('Container');

    manager.onLoad();

    expect(manager.btnHammer.getChildByName('PriceChip')).not.toBeNull();
    expect(manager.btnShuffle.getChildByName('PriceChip')).not.toBeNull();
    expect(manager.btnHammer.getChildByName('LockBadge')?.active).toBe(false);
    expect(manager.btnAd.active).toBe(true);
    expect(() => manager.onDestroy()).not.toThrow();
  });

  it('shows the ad guide when tools become unaffordable after protection rounds', () => {
    GameState.instance.currentRound = 3;
    GameState.instance.spendGold(15);
    manager.btnHammer = new Node('Hammer');
    manager.btnShuffle = new Node('Shuffle');
    manager.btnAd = new Node('Ad');

    manager.onLoad();

    expect(manager.btnHammer.getChildByName('LockBadge')?.active).toBe(true);
    expect(manager.btnAd.getChildByName('GuideBubble')?.active).toBe(true);
    manager.onDestroy();
  });

  it('does not charge hammer or shuffle when the container has no valid targets', () => {
    manager.containerNode = new Node('Container');

    manager.onHammerClicked();
    manager.onShuffleClicked();

    expect(GameState.instance.gold).toBe(15);
  });
});
