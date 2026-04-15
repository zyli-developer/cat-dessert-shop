import { _decorator, Component, Node, Prefab, instantiate, Color, UITransform,
         UIOpacity, BlockInputEvents, Sprite, SpriteFrame, tween, Vec3, resources, director, Layers } from 'cc';
const { ccclass } = _decorator;

@ccclass('PopupManager')
export class PopupManager {
    private static _currentPopup: Node | null = null;
    private static _maskNode: Node | null = null;

    /** 显示弹窗（从 resources/prefabs/popups/ 加载） */
    static show(popupName: string, data?: any): Promise<Node | null> {
        return new Promise((resolve) => {
            if (this._currentPopup) {
                console.warn(`[PopupManager] Blocked: "${popupName}" — already showing a popup`);
                resolve(null);
                return;
            }
            console.log(`[PopupManager] Loading popup: ${popupName}`);

            const path = `prefabs/popups/${popupName}`;
            resources.load(path, Prefab, (err, prefab) => {
                if (err) {
                    console.error(`[PopupManager] Failed to load ${path}`, err);
                    resolve(null);
                    return;
                }
                console.log(`[PopupManager] Prefab loaded: ${popupName}`);

                const scene = director.getScene();
                if (!scene) {
                    resolve(null);
                    return;
                }

                const canvas = scene.getChildByName('Canvas');
                if (!canvas) {
                    resolve(null);
                    return;
                }

                // 创建遮罩
                this._maskNode = this.createMask(canvas);

                // 实例化弹窗
                const popup = instantiate(prefab);
                // 修正图层：prefab 节点默认是 DEFAULT 层，相机只渲染 UI_2D
                this.setLayerRecursive(popup, Layers.Enum.UI_2D);
                popup.parent = canvas;
                popup.setSiblingIndex(999);
                this._currentPopup = popup;

                // 传递数据
                const comp = popup.getComponent(popupName);
                console.log(`[PopupManager] getComponent('${popupName}') => ${!!comp}, hasInit=${comp && typeof (comp as any).init === 'function'}`);
                if (comp && typeof (comp as any).init === 'function') {
                    (comp as any).init(data);
                }

                // 弹出动画
                popup.setScale(0.5, 0.5, 1);
                tween(popup)
                    .to(0.2, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'backOut' })
                    .to(0.08, { scale: new Vec3(1, 1, 1) })
                    .start();

                resolve(popup);
            });
        });
    }

    /** 关闭当前弹窗 */
    static close(): void {
        if (this._currentPopup) {
            tween(this._currentPopup)
                .to(0.15, { scale: new Vec3(0, 0, 1) })
                .call(() => {
                    this._currentPopup?.destroy();
                    this._currentPopup = null;
                })
                .start();
        }

        if (this._maskNode) {
            const opacity = this._maskNode.getComponent(UIOpacity);
            if (opacity) {
                tween(opacity)
                    .to(0.15, { opacity: 0 })
                    .call(() => {
                        this._maskNode?.destroy();
                        this._maskNode = null;
                    })
                    .start();
            } else {
                this._maskNode.destroy();
                this._maskNode = null;
            }
        }
    }

    /**
     * 立即销毁弹窗与遮罩（无动画）。
     * 在 `director.loadScene` 之前必须调用本方法而不是 `close()`，
     * 否则场景卸载时 tween 仍操作已销毁节点，会触发 targetOff / 生命周期异常。
     */
    static closeImmediate(): void {
        if (this._currentPopup) {
            this._currentPopup.destroy();
            this._currentPopup = null;
        }
        if (this._maskNode) {
            this._maskNode.destroy();
            this._maskNode = null;
        }
    }

    /** 是否有弹窗正在显示 */
    static get isShowing(): boolean {
        return this._currentPopup !== null;
    }

    private static setLayerRecursive(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayerRecursive(child, layer);
        }
    }

    private static createMask(parent: Node): Node {
        const mask = new Node('PopupMask');
        mask.layer = Layers.Enum.UI_2D;
        mask.parent = parent;
        mask.setSiblingIndex(998);

        const uiTransform = mask.addComponent(UITransform);
        uiTransform.setContentSize(1440, 2560); // 足够大覆盖屏幕

        // 半透明黑色背景
        const sprite = mask.addComponent(Sprite);
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = new Color(0, 0, 0, 255);

        // 阻挡输入穿透
        mask.addComponent(BlockInputEvents);

        const opacity = mask.addComponent(UIOpacity);
        opacity.opacity = 0;

        // 渐显遮罩
        tween(opacity).to(0.2, { opacity: 150 }).start();

        return mask;
    }
}
