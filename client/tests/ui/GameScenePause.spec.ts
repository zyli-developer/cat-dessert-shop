import { Node } from 'cc';
import { GameScene } from '../../assets/scenes/scripts/ui/GameScene';
import { PopupManager } from '../../assets/scenes/scripts/ui/PopupManager';

describe('GameScene pause flow', () => {
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
});
