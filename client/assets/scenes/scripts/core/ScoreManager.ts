import { _decorator, Component, Label } from 'cc';
import { GameState } from '../data/GameState';
const { ccclass, property } = _decorator;

/**
 * ScoreManager — 监听 GameState 的分数/金币变化事件并更新 HUD
 */
@ccclass('ScoreManager')
export class ScoreManager extends Component {
    @property(Label)
    scoreLabel: Label | null = null;

    @property(Label)
    goldLabel: Label | null = null;

    private state = GameState.instance;

    onLoad(): void {
        this.state.events.on('score-changed', this.onScoreChanged, this);
        this.state.events.on('gold-changed', this.onGoldChanged, this);

        // 初始化显示
        this.onScoreChanged(this.state.score);
        this.onGoldChanged(this.state.gold);
    }

    onDestroy(): void {
        this.state.events.off('score-changed', this.onScoreChanged, this);
        this.state.events.off('gold-changed', this.onGoldChanged, this);
    }

    private onScoreChanged(score: number): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = `${score}`;
        }
    }

    private onGoldChanged(gold: number): void {
        if (this.goldLabel) {
            this.goldLabel.string = `${gold}`;
        }
    }
}
