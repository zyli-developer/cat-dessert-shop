import { Node } from 'cc';
import { GameScene } from '../../assets/scenes/scripts/ui/GameScene';
import { PopupManager } from '../../assets/scenes/scripts/ui/PopupManager';

describe('GameScene modal flow', () => {
  afterEach(() => jest.restoreAllMocks());

  it('coalesces rapid clicks and resumes gameplay if popup loading fails', async () => {
    const scene = new GameScene();
    scene.node = new Node('Game');
    const drop = { setEnabled: jest.fn() };
    const overflow = { setEnabled: jest.fn() };
    scene.dropController = drop as any;
    scene.overflowDetector = overflow as any;

    let finish!: (node: Node | null) => void;
    const show = jest.spyOn(PopupManager, 'show').mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );

    const first = scene.onPauseClicked();
    const second = scene.onPauseClicked();
    expect(show).toHaveBeenCalledTimes(1);
    expect(drop.setEnabled).toHaveBeenCalledWith(false);
    expect(overflow.setEnabled).toHaveBeenCalledWith(false);

    finish(null);
    await Promise.all([first, second]);
    expect(drop.setEnabled).toHaveBeenLastCalledWith(true);
    expect(overflow.setEnabled).toHaveBeenLastCalledWith(true);
  });

  it('disables overflow detection before opening the fail popup', () => {
    const scene = new GameScene();
    scene.node = new Node('Game');
    const drop = { setEnabled: jest.fn() };
    const overflow = { setEnabled: jest.fn() };
    scene.dropController = drop as any;
    scene.overflowDetector = overflow as any;
    scene.customerManager = { getProgress: () => ({ served: 1, total: 4 }) } as any;
    jest.spyOn(PopupManager, 'show').mockResolvedValue(new Node('FailPopup'));

    (scene as any).onLose();

    expect(drop.setEnabled).toHaveBeenCalledWith(false);
    expect(overflow.setEnabled).toHaveBeenCalledWith(false);
    expect(PopupManager.show).toHaveBeenCalledWith('FailPopup', expect.objectContaining({
      served: 1,
      total: 4,
    }));
  });
});
