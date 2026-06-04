import { _decorator, Component, Node, Label, Font, Color, resources, director, find } from 'cc';
const { ccclass, property } = _decorator;

/** 暖棕描边色（替换所有黑描边/黑阴影，cocos-mapping.md §0 灵魂法则）。 */
const INK = new Color(90, 70, 54, 255);

/** 近黑判定：baked 场景里很多 Label 开了纯黑描边/阴影，统一矫正为暖棕。 */
function isNearBlack(c: Color): boolean {
    return c.r < 40 && c.g < 40 && c.b < 40;
}

/** 把单个 Label 的黑描边/黑阴影矫正为暖棕（治愈手绘风的统一关键）。 */
function normalizeInk(label: Label): void {
    if (label.enableOutline && isNearBlack(label.outlineColor)) {
        label.outlineColor = new Color(INK.r, INK.g, INK.b, label.outlineColor.a);
    }
    if (label.enableShadow && isNearBlack(label.shadowColor)) {
        // 柔化刺眼黑阴影为低透明暖棕
        label.shadowColor = new Color(INK.r, INK.g, INK.b, 70);
    }
}

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
            // 全局矫正：黑描边/黑阴影 → 暖棕（零纯黑，验收 §6.1）
            normalizeInk(label);
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
