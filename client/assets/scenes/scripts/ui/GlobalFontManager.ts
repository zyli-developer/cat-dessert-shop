import { _decorator, Component, Node, Label, Font, resources, director, find } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GlobalFontManager')
export class GlobalFontManager extends Component {
    private static _font: Font | null = null;
    private static _isLoaded = false;

    /**
     * 加载全局字体
     */
    public static loadFont(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._isLoaded) {
                resolve();
                return;
            }

            resources.load('fonts/ZCOOLKuaiLe-Regular', Font, (err, font) => {
                if (err) {
                    console.error('[GlobalFontManager] Failed to load font:', err);
                    reject(err);
                    return;
                }
                this._font = font;
                this._isLoaded = true;
                console.log('[GlobalFontManager] Font loaded successfully');
                resolve();
            });
        });
    }

    /**
     * 为指定节点及其所有子节点中的 Label 组件应用全局字体
     * @param rootNode 根节点
     */
    public static applyFont(rootNode: Node): void {
        if (!this._font) {
            console.warn('[GlobalFontManager] Font not loaded yet, skipping applyFont');
            return;
        }

        const labels = rootNode.getComponentsInChildren(Label);
        labels.forEach(label => {
            label.font = this._font;
            // 确保使用 TTF 渲染模式
            label.isSystemFontUsed = false;
        });
        console.log(`[GlobalFontManager] Applied font to ${labels.length} labels in ${rootNode.name}`);
    }

    /** 先加载字体再应用（与 Loading 场景一致，避免 Game/Home 直开时仍是系统字） */
    public static async applyFontWhenReady(rootNode: Node): Promise<void> {
        try {
            await this.loadFont();
            this.applyFont(rootNode);
        } catch (e) {
            console.warn('[GlobalFontManager] applyFontWhenReady failed:', e);
        }
    }

    /**
     * 为当前激活场景的所有 Label 应用字体
     */
    public static applyToCurrentScene(): void {
        const scene = director.getScene();
        if (scene) {
            this.applyFont(scene);
        }
    }
}
