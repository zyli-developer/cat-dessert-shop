import { _decorator, Component, Node, Label, Graphics, Color, tween, UIOpacity } from 'cc';
import { Dessert } from './Dessert';
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

    private overflowing: boolean = false;
    private timer: number = 0;
    private _enabled: boolean = true;
    private flashTween: any = null;

    onGameOver: (() => void) | null = null;

    onLoad(): void {
        // 立即隐藏倒计时，避免场景加载时闪现 "5"
        if (this.countdownLabel) {
            this.countdownLabel.node.active = false;
        }
    }

    update(dt: number): void {
        if (!this._enabled) return;

        const isOver = this.checkOverflow();

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
                // 颜色随倒计时变红
                const r = Math.min(255, 150 + (5 - t) * 20);
                this.countdownLabel.color = new Color(r, 50, 50, 255);
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
            if (d.node.position.y > this.warningLineY) {
                return true;
            }
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
    }

    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        if (!enabled) {
            this.overflowing = false;
            this.showCountdown(false);
            this.stopWarningFlash();
        }
    }

    reset(): void {
        this.overflowing = false;
        this.timer = 0;
        this.showCountdown(false);
        this.stopWarningFlash();
    }
}
