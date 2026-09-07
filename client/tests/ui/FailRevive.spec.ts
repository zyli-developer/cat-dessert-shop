import { Node } from 'cc';
import { FailPopup } from '../../assets/scenes/scripts/ui/popups/FailPopup';
import { DouyinSDK } from '../../assets/scenes/scripts/platform/DouyinSDK';
import { PopupManager } from '../../assets/scenes/scripts/ui/PopupManager';

describe('fail revive availability', () => {
  afterEach(() => jest.restoreAllMocks());
  function popup(canRevive: boolean) {
    const p = new FailPopup() as any;
    p.node = new Node('Fail');
    p.init({ score: 0, round: 1, served: 0, total: 3, canRevive, onRevive: jest.fn() });
    return p;
  }
  it('does not request an ad after the round has used its revive', async () => {
    const p = popup(false);
    const ad = jest.spyOn(DouyinSDK, 'showRewardedAd').mockResolvedValue(true);
    await p.onReviveClicked();
    expect(ad).not.toHaveBeenCalled();
  });
  it('coalesces ad clicks and revives only once', async () => {
    const p = popup(true);
    let finish!: (success: boolean) => void;
    const ad = jest.spyOn(DouyinSDK, 'showRewardedAd').mockImplementation(() => new Promise(r => { finish = r; }));
    jest.spyOn(PopupManager, 'close').mockImplementation(() => undefined);
    const pending = p.onReviveClicked();
    await p.onReviveClicked();
    expect(ad).toHaveBeenCalledTimes(1);
    finish(true);
    await pending;
    await p.onReviveClicked();
    expect(p.data.onRevive).toHaveBeenCalledTimes(1);
  });
});
