import { _decorator, Component, Node, Label } from 'cc';
import { Dessert } from './Dessert';
const { ccclass, property } = _decorator;

@ccclass('OverflowDetector')
export class OverflowDetector extends Component {
    @property(Node)
    containerNode: Node | null = null;

    @property(Label)
    countdownLabel: Label | null = null;

    @property
    warningLineY: number = 240;

    @property
    countdownTime: number = 5;

    private overflowing: boolean = false;
    private timer: number = 0;
    private _enabled: boolean = true;

    /** 溢出导致游戏结束的回调 */
    onGameOver: (() => void) | null = null;

    start(): void {
        if (this.countdownLabel) {
            this.countdownLabel.node.active = false;
        }
    }

    update(dt: number): void {
        if (!this._enabled) return;

        const isOver = this.checkOverflow();

        if (isOver && !this.overflowing) {
            // 刚开始溢出
            this.overflowing = true;
            this.timer = this.countdownTime;
            if (this.countdownLabel) {
                this.countdownLabel.node.active = true;
                this.countdownLabel.string = Math.ceil(this.timer).toString();
            }
        } else if (!isOver && this.overflowing) {
            // 溢出恢复
            this.overflowing = false;
            if (this.countdownLabel) {
                this.countdownLabel.node.active = false;
            }
        }

        if (this.overflowing) {
            this.timer -= dt;
            if (this.countdownLabel) {
                this.countdownLabel.string = Math.ceil(Math.max(0, this.timer)).toString();
            }
            if (this.timer <= 0) {
                this.overflowing = false;
                if (this.countdownLabel) {
                    this.countdownLabel.node.active = false;
                }
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

    /** 启用/禁用检测 */
    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        if (!enabled) {
            this.overflowing = false;
            if (this.countdownLabel) {
                this.countdownLabel.node.active = false;
            }
        }
    }

    /** 重置状态 */
    reset(): void {
        this.overflowing = false;
        this.timer = 0;
        if (this.countdownLabel) {
            this.countdownLabel.node.active = false;
        }
    }
}
