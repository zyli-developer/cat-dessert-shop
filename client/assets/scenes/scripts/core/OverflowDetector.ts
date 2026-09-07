import { _decorator, Component, Node, Label, Graphics, Color, tween, UIOpacity, UITransform, Layers, director } from 'cc';
import { Dessert } from './Dessert';
import { applyInkOutline, TOKENS } from '../ui/DesignTokens';
import { GlobalFontManager } from '../ui/GlobalFontManager';
const { ccclass, property } = _decorator;

@ccclass('OverflowDetector')
export class OverflowDetector extends Component {
    @property(Node)
    containerNode: Node | null = null;

    @property(Label)
    countdownLabel: Label | null = null;

    /** 警戒线节点（用于闪烁） */
    @property(Node)
    warningLineNode: Node | null = null;

    @property
    warningLineY: number = 240;

    @property
    countdownTime: number = 5;

    /** 超线需持续这么久才判定（避免下落中的甜品掠过警戒线时误触发倒计时）。 */
    @property
    overflowGrace: number = 0.6;

    private overflowing: boolean = false;
    private timer: number = 0;
    private _aboveTimer: number = 0;
    private _enabled: boolean = true;
    private flashTween: any = null;
    private glowNode: Node | null = null;
    private glowTween: any = null;

    onGameOver: (() => void) | null = null;

    onLoad(): void {
        // 立即隐藏倒计时，避免场景加载时闪现 "5"
        if (this.countdownLabel) {
            this.countdownLabel.node.active = false;
        }
    }

    update(dt: number): void {
        if (!this._enabled) return;

        // 关键：只有"持续超线 overflowGrace 秒"才算真溢出。
        // 下落中的甜品只是短暂掠过警戒线上方（不足 0.6s），不会触发；
        // 真正堆稳在线上方的甜品会一直满足条件 → 触发倒计时。
        // isOver 必须以"当前确实超线"为前提，否则 grace=0 时 0>=0 恒真、永远无法解除。
        let isOver = false;
        if (this.checkOverflow()) {
            this._aboveTimer += dt;
            isOver = this._aboveTimer >= this.overflowGrace;
        } else {
            this._aboveTimer = 0;
        }

        if (isOver && !this.overflowing) {
            this.overflowing = true;
            this.timer = this.countdownTime;
            this.showCountdown(true);
            this.startWarningFlash();
        } else if (!isOver && this.overflowing) {
            this.overflowing = false;
            this.showCountdown(false);
            this.stopWarningFlash();
        }

        if (this.overflowing) {
            this.timer -= dt;
            if (this.countdownLabel) {
                const t = Math.ceil(Math.max(0, this.timer));
                this.countdownLabel.string = `${t}`;
                // 颜色随倒计时变红（危险态保留红，描边改暖棕）
                const r = Math.min(255, 150 + (5 - t) * 20);
                this.countdownLabel.color = new Color(r, 50, 50, 255);
                applyInkOutline(this.countdownLabel, 220, 3);
                // 倒计时脉冲
                this.countdownLabel.fontSize = t <= 2 ? 60 : 48;
            }
            if (this.timer <= 0) {
                this.overflowing = false;
                this.showCountdown(false);
                this.stopWarningFlash();
                this.onGameOver?.();
            }
        }
    }

    private checkOverflow(): boolean {
        if (!this.containerNode) return false;

        const desserts = this.containerNode.getComponentsInChildren(Dessert);
        for (const d of desserts) {
            if (d.isMerging || d.isDropping) continue;
            if (d.node.position.y > this.warningLineY) return true;
        }
        return false;
    }

    private showCountdown(show: boolean): void {
        if (this.countdownLabel) {
            this.countdownLabel.node.active = show;
            if (show) {
                this.countdownLabel.string = Math.ceil(this.timer).toString();
            }
        }
    }

    private startWarningFlash(): void {
        this.startEdgeGlow();
        this.showWarnBar(true);
        if (!this.warningLineNode) return;
        const opacity = this.warningLineNode.getComponent(UIOpacity)
            || this.warningLineNode.addComponent(UIOpacity);

        this.flashTween = tween(opacity)
            .repeatForever(
                tween(opacity)
                    .to(0.3, { opacity: 60 })
                    .to(0.3, { opacity: 255 })
            )
            .start();
    }

    private stopWarningFlash(): void {
        if (this.flashTween) {
            this.flashTween.stop();
            this.flashTween = null;
        }
        if (this.warningLineNode) {
            const opacity = this.warningLineNode.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;
        }
        this.showWarnBar(false);
        this.stopEdgeGlow();
    }

    /** 底部红色警告条「⚠ 甜品要溢出啦！快合成」（states.html B1）。 */
    private warnBar: Node | null = null;
    private showWarnBar(show: boolean): void {
        if (!show) {
            if (this.warnBar?.isValid) this.warnBar.active = false;
            return;
        }
        if (this.warnBar?.isValid) { this.warnBar.active = true; return; }
        if (!this.containerNode) return;
        const h = this.containerNode.getComponent(UITransform)?.height ?? 600;

        const bar = new Node('OverflowWarnBar');
        bar.layer = Layers.Enum.UI_2D;
        bar.parent = this.containerNode;
        bar.setPosition(0, -h / 2 + 86, 0);
        bar.addComponent(UITransform).setContentSize(380, 56);
        const g = bar.addComponent(Graphics);
        g.fillColor = TOKENS.pink;
        g.roundRect(-190, -28, 380, 56, 28);
        g.fill();
        // ⚠ 三角（Graphics 绘制，设计稿条首的警示符；自定义字体缺 U+26A0 字形，不能用字符）
        g.fillColor = TOKENS.white;
        g.moveTo(-160, -10);
        g.lineTo(-146, 14);
        g.lineTo(-132, -10);
        g.fill();
        g.fillColor = TOKENS.pink;
        g.roundRect(-147.5, -3, 3, 9, 1.5);
        g.fill();
        g.circle(-146, -6.5, 1.8);
        g.fill();

        const ln = new Node('t');
        ln.layer = Layers.Enum.UI_2D;
        ln.parent = bar;
        ln.setPosition(14, 0, 0);
        ln.addComponent(UITransform).setContentSize(340, 56);
        const l = ln.addComponent(Label);
        l.string = '甜品要溢出啦！快合成';
        l.fontSize = 24;
        l.lineHeight = 56;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = TOKENS.white;
        l.isBold = true;
        GlobalFontManager.applyFont(ln);
        bar.setSiblingIndex(this.containerNode.children.length - 1);
        this.warnBar = bar;
    }

    /** 屏幕边缘红光呼吸（states.html B1 .danger-vignette）—— 超线倒计时期间的危险反馈。 */
    private startEdgeGlow(): void {
        if (this.glowTween) return;
        // 挂到 Canvas 全屏边缘；拿不到 Canvas（如单测环境）时退回容器节点
        const host = director.getScene()?.getChildByName('Canvas') ?? this.containerNode;
        if (!host) return;
        const ut = host.getComponent(UITransform);
        const w = ut?.width || 750;
        const h = ut?.height || 1334;

        let glow = this.glowNode;
        if (!glow || !glow.isValid) {
            glow = new Node('OverflowGlow');
            glow.layer = Layers.Enum.UI_2D;
            glow.parent = host;
            glow.setPosition(0, 0, 0);
            glow.addComponent(UITransform).setContentSize(w, h);
            const gfx = glow.addComponent(Graphics);
            // 多圈内缩描边模拟由边缘向内渐隐的红色 vignette
            const layers = 5;
            for (let i = 0; i < layers; i++) {
                const inset = 7 + i * 14;
                gfx.lineWidth = 14;
                gfx.strokeColor = new Color(255, 70, 70, 110 - i * 22);
                gfx.rect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2);
                gfx.stroke();
            }
            this.glowNode = glow;
        }
        glow.setSiblingIndex(host.children.length - 1);
        glow.active = true;
        const op = glow.getComponent(UIOpacity) || glow.addComponent(UIOpacity);
        op.opacity = 255;
        this.glowTween = tween(op)
            .repeatForever(
                tween(op)
                    .to(0.5, { opacity: 80 })
                    .to(0.5, { opacity: 255 })
            )
            .start();
    }

    private stopEdgeGlow(): void {
        if (this.glowTween) {
            this.glowTween.stop();
            this.glowTween = null;
        }
        if (this.glowNode?.isValid) {
            this.glowNode.active = false;
        }
    }

    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        if (!enabled) {
            this.overflowing = false;
            this._aboveTimer = 0;
            this.showCountdown(false);
            this.stopWarningFlash();
        }
    }

    reset(): void {
        this.overflowing = false;
        this.timer = 0;
        this._aboveTimer = 0;
        this.showCountdown(false);
        this.stopWarningFlash();
    }
}
