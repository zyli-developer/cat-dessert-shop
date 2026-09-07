import { Node, Prefab, director, resources } from 'cc';

jest.mock('../../assets/scenes/scripts/ui/popups/PopupUIHelper', () => ({
  ensurePopupKit: jest.fn().mockResolvedValue(undefined),
}));

import { PopupManager } from '../../assets/scenes/scripts/ui/PopupManager';

describe('PopupManager', () => {
  let loadCallbacks: Array<(err: Error | null, prefab?: Prefab) => void>;
  let scene: Node;

  beforeEach(() => {
    PopupManager.closeImmediate();
    loadCallbacks = [];
    scene = new Node('Scene');
    scene.addChild(new Node('Canvas'));
    (director.getScene as jest.Mock).mockReturnValue(scene);
    (resources.load as jest.Mock).mockImplementation(
      (_path: string, _type: unknown, callback: (err: Error | null, prefab?: Prefab) => void) => {
        loadCallbacks.push(callback);
      },
    );
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    PopupManager.closeImmediate();
    jest.restoreAllMocks();
  });

  it('blocks a second request while the first prefab is loading and unlocks after failure', async () => {
    const first = PopupManager.show('PausePopup');

    expect(PopupManager.isShowing).toBe(true);
    await expect(PopupManager.show('SettingsPopup')).resolves.toBeNull();
    expect(loadCallbacks).toHaveLength(1);

    loadCallbacks[0](new Error('missing prefab'));
    await expect(first).resolves.toBeNull();
    expect(PopupManager.isShowing).toBe(false);

    const retry = PopupManager.show('PausePopup');
    expect(loadCallbacks).toHaveLength(2);
    loadCallbacks[1](new Error('missing prefab'));
    await expect(retry).resolves.toBeNull();
  });

  it('ignores a prefab load that completes after the request is cancelled', async () => {
    const pending = PopupManager.show('PausePopup');
    const canvas = scene.getChildByName('Canvas')!;

    PopupManager.closeImmediate();
    loadCallbacks[0](null, new Prefab());

    await expect(pending).resolves.toBeNull();
    expect(canvas.children).toHaveLength(0);
    expect(PopupManager.isShowing).toBe(false);
  });
});
