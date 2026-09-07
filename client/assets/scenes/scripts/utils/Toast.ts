import {
    Node, UITransform, Graphics, Label, Color, UIOpacity, tween, Vec3, Layers, director,
    Sprite, SpriteFrame, resources,
} from 'cc';
import { GlobalFontManager } from '../ui/GlobalFontManager';
import { TOKENS } from '../ui/DesignTokens';

/**
 * 轻量 Toast（对齐 docs/ui-mockup/states.html 的 .toast）：
 * 深色圆角胶囊 + 文字，淡入停留淡出。用于「看广告 +10 金币」「广告无填充」「断网重连」等即时反馈。
 */
export class Toast {
    /** @param icon 可选左侧图标（resources 下 textures/ui 的文件名，如 'icon_coin'），对齐设计稿 toast 的 icon+文字结构 */
    static show(text: string, warn = false, icon?: string): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;

        // 单例：移除上一条 toast，避免叠加（D2 的「正在重连…」→「进度已保存」顺序替换）
        for (const c of canvas.children) if (c.name === 'Toast' && c.isValid) c.destroy();

        const iconW = icon ? 52 : 0;
        const w = Math.min(620, 96 + text.length * 30 + iconW);
        const node = new Node('Toast');
        node.layer = Layers.Enum.UI_2D;
        node.parent = canvas;
        node.setPosition(0, 110, 0);
        node.addComponent(UITransform).setContentSize(w, 72);

        const g = node.addComponent(Graphics);
        g.fillColor = warn ? new Color(168, 99, 46, 236) : new Color(90, 70, 54, 236);
        g.roundRect(-w / 2, -36, w, 72, 20);
        g.fill();

        if (icon) {
            const ic = new Node('icon');
            ic.layer = Layers.Enum.UI_2D;
            ic.parent = node;
            ic.setPosition(-w / 2 + 44, 0, 0);
            ic.addComponent(UITransform).setContentSize(38, 38);
            const sp = ic.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            // 金币保留原色，线条图标染成纸色与文字一致
            if (icon !== 'icon_coin') sp.color = TOKENS.paper2;
            resources.load(`textures/ui/${icon}/spriteFrame`, SpriteFrame, (err, f) => {
                if (!err && f && sp.isValid) sp.spriteFrame = f;
            });
        }

        const ln = new Node('t');
        ln.layer = Layers.Enum.UI_2D;
        ln.parent = node;
        ln.setPosition(iconW / 2, 0, 0);
        ln.addComponent(UITransform).setContentSize(w - iconW, 72);
        const l = ln.addComponent(Label);
        l.string = text;
        l.fontSize = 28;
        l.lineHeight = 72;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = TOKENS.paper2;
        l.isBold = true;
        GlobalFontManager.applyFont(ln);

        node.setSiblingIndex(canvas.children.length - 1);
        const op = node.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.18, { opacity: 255 }).delay(1.4).to(0.35, { opacity: 0 })
            .call(() => node.isValid && node.destroy()).start();
        node.setScale(0.9, 0.9, 1);
        tween(node).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }
}
