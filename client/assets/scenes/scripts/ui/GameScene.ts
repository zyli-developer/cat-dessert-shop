import { _decorator, Component, Label, Node, director, Vec3, tween,
         RigidBody2D, ERigidBody2DType, Color, Layout, UITransform } from 'cc';
import { MergeManager } from '../core/MergeManager';
import { DropController } from '../core/DropController';
import { OverflowDetector } from '../core/OverflowDetector';
import { CustomerManager } from '../core/CustomerManager';
import { ItemManager } from '../core/ItemManager';
import { Dessert } from '../core/Dessert';
import { GameState } from '../data/GameState';
import { CUSTOMER_SERVE_SCORE } from '../data/DessertConfig';
import { ApiClient } from '../net/ApiClient';
import { AudioManager } from '../utils/AudioManager';
import { PopupManager } from './PopupManager';
import { GlobalFontManager } from './GlobalFontManager';
const { ccclass, property } = _decorator;

@ccclass('GameScene')
export class GameScene extends Component {
    @property(MergeManager)
    mergeManager: MergeManager | null = null;

    @property(DropController)
    dropController: DropController | null = null;

    @property(OverflowDetector)
    overflowDetector: OverflowDetector | null = null;

    @property(CustomerManager)
    customerManager: CustomerManager | null = null;

    @property(ItemManager)
    itemManager: ItemManager | null = null;

    // HUD Labels
    @property(Label)
    goldLabel: Label | null = null;

    @property(Label)
    scoreLabel: Label | null = null;

    @property(Label)
    roundLabel: Label | null = null;

    // Buttons
    @property(Node)
    btnPause: Node | null = null;

    @property(Node)
    btnHammer: Node | null = null;

    @property(Node)
    btnShuffle: Node | null = null;

    @property(Node)
    btnAd: Node | null = null;

    private state = GameState.instance;
    private hasRevived = false;
    private adCatCoinsEarned = 0;

    /** 与 onLoad 中注册的监听使用同一引用，便于 onDestroy 中安全 off（避免 targetOff 在节点销毁过程中空引用） */
    private readonly onHammerBtnTouch = (): void => {
        this.itemManager?.onHammerClicked();
    };
    private readonly onShuffleBtnTouch = (): void => {
        this.itemManager?.onShuffleClicked();
    };
    private readonly onAdBtnTouch = (): void => {
        this.itemManager?.onAdClicked();
    };

    onLoad(): void {
        void GlobalFontManager.applyFontWhenReady(this.node);

        // 确保 Background 在最底层渲染
        const bg = this.node.getChildByName('Background');
        if (bg) bg.setSiblingIndex(0);

        this.fixGameToolbarLayout();

        this.state.resetRound();
        const round = this.state.currentRound;
        const levelData = this.state.getCurrentLevel();

        console.log(`[GameScene] onLoad: round=${round}, levelData=${!!levelData}, mergeManager=${!!this.mergeManager}, customerManager=${!!this.customerManager}`);

        // Init HUD
        if (this.roundLabel) this.roundLabel.string = `第 ${round}关`;
        this.updateHUD();

        // 监听分数/金币变化
        this.state.events.on('score-changed', this.updateHUD, this);
        this.state.events.on('gold-changed', this.updateHUD, this);

        // Init customer queue
        if (levelData && this.customerManager) {
            this.customerManager.initRound(levelData.customers);
            this.customerManager.onRoundComplete = () => this.onWin();
            // 所有顾客满足后立即禁用溢出检测和投放，防止动画延迟期间误触发 game over
            this.customerManager.onAllCustomersDone = () => {
                this.dropController?.setEnabled(false);
                this.overflowDetector?.setEnabled(false);
            };
        }

        // Init overflow detection
        if (this.overflowDetector) {
            this.overflowDetector.onGameOver = () => this.onLose();
        }

        // Wire merge → customer with fly animation
        console.log(`[GameScene] Wiring merge→customer: mergeManager=${!!this.mergeManager}, customerManager=${!!this.customerManager}`);
        if (this.mergeManager && this.customerManager) {
            this.mergeManager.onMergeComplete = (level: number, dessertNode: Node) => {
                console.log(`[GameScene] onMergeComplete: level=${level}`);
                const served = this.customerManager!.onDessertMerged(level);
                if (served && dessertNode.isValid) {
                    const body = dessertNode.getComponent(RigidBody2D);
                    if (body) body.type = ERigidBody2DType.Static;

                    const startPos = dessertNode.worldPosition.clone();
                    const targetPos = this.customerManager!.getCatWorldPosition();
                    const midPos = new Vec3(
                        (startPos.x + targetPos.x) / 2,
                        Math.max(startPos.y, targetPos.y) + 100,
                        0
                    );

                    tween(dessertNode)
                        .to(0.25, { worldPosition: midPos, scale: new Vec3(0.7, 0.7, 1) }, { easing: 'sineOut' })
                        .to(0.25, { worldPosition: targetPos, scale: new Vec3(0.3, 0.3, 1) }, { easing: 'sineIn' })
                        .call(() => dessertNode.destroy())
                        .start();
                }
            };

            this.customerManager.onCustomerServed = () => {
                this.state.addScore(CUSTOMER_SERVE_SCORE);
            };
        }

        // Init audio
        AudioManager.instance.init(this.node);

        // Buttons
        this.btnPause?.on(Node.EventType.TOUCH_END, this.onPauseClicked, this);
        this.btnHammer?.on(Node.EventType.TOUCH_END, this.onHammerBtnTouch, this);
        this.btnShuffle?.on(Node.EventType.TOUCH_END, this.onShuffleBtnTouch, this);
        this.btnAd?.on(Node.EventType.TOUCH_END, this.onAdBtnTouch, this);
    }

    /**
     * ButtonGroup 上曾启用 Layout，会覆盖子节点坐标，导致暂停/道具挤在一起或不可见。
     * 关闭 Layout，手动排布在顶栏一行。
     */
    private fixGameToolbarLayout(): void {
        const group = this.btnPause?.parent;
        if (!group || group.name !== 'ButtonGroup') return;

        const layout = group.getComponent(Layout);
        if (layout) layout.enabled = false;

        const ut = group.getComponent(UITransform);
        ut?.setContentSize(680, 96);

        this.btnPause?.setPosition(-255, 0, 0);
        this.btnHammer?.setPosition(-85, 0, 0);
        this.btnShuffle?.setPosition(85, 0, 0);
        this.btnAd?.setPosition(255, 0, 0);

        group.setSiblingIndex(this.node.children.length - 1);
    }

    onDestroy(): void {
        this.state.events.off('score-changed', this.updateHUD, this);
        this.state.events.off('gold-changed', this.updateHUD, this);
        this.safeOffTouch(this.btnPause, this.onPauseClicked);
        this.safeOffTouch(this.btnHammer, this.onHammerBtnTouch);
        this.safeOffTouch(this.btnShuffle, this.onShuffleBtnTouch);
        this.safeOffTouch(this.btnAd, this.onAdBtnTouch);
    }

    private safeOffTouch(node: Node | null, handler: (...args: unknown[]) => void): void {
        if (node?.isValid) {
            node.off(Node.EventType.TOUCH_END, handler, this);
        }
    }

    // --- HUD ---
    private updateHUD(): void {
        if (this.goldLabel) this.goldLabel.string = `${this.state.gold}`;
        if (this.scoreLabel) this.scoreLabel.string = `${this.state.score}`;
    }

    // --- Pause (C2 fix: pass onResume callback) ---
    onPauseClicked(): void {
        this.dropController?.setEnabled(false);
        this.overflowDetector?.setEnabled(false);
        PopupManager.show('PausePopup', {
            onResume: () => {
                this.dropController?.setEnabled(true);
                this.overflowDetector?.setEnabled(true);
            },
        });
    }

    // --- Win (C4 fix: send catCoinsEarned to server) ---
    private async onWin(): Promise<void> {
        console.log(`[GameScene] === onWin === score=${this.state.score}, isPopupShowing=${PopupManager.isShowing}`);
        const winRound = this.state.currentRound;
        const stars = this.state.calcStars();
        const catCoins = this.state.getCatCoinReward(stars);

        this.dropController?.setEnabled(false);
        this.overflowDetector?.setEnabled(false);

        // 先本地落盘“已通关”状态，避免用户立即返回主页时仍显示未解锁（接口回包有延迟）。
        this.applyLocalUnlockAfterWin(winRound, this.state.score, stars);

        PopupManager.show('WinPopup', {
            stars,
            score: this.state.score,
            catCoins,
            round: winRound,
            isLastRound: winRound >= this.state.allLevels.length,
            onDoubled: (bonus: number) => {
                this.adCatCoinsEarned += bonus;
            },
        });

        try {
            const data = await ApiClient.updateProgress(
                winRound,
                this.state.score,
                stars,
                this.adCatCoinsEarned,
            );
            if (!ApiClient.isOfflineMode() && data && typeof data === 'object' && 'catCoins' in data) {
                GameState.instance.applyProgressFromApi(data as {
                    catCoins: number;
                    currentRound: number;
                    highScore: number;
                    stars: Record<string, number>;
                    roundScores: Record<string, number>;
                });
            }
        } catch (e) {
            console.error('Failed to save progress:', e);
        }
    }

    private applyLocalUnlockAfterWin(round: number, score: number, stars: number): void {
        const profile = this.state.userProfile;
        if (!profile) return;
        if (!profile.stars) profile.stars = {};
        if (!profile.roundScores) profile.roundScores = {};

        const key = String(round);
        profile.stars[key] = Math.max(profile.stars[key] ?? 0, stars);
        profile.roundScores[key] = Math.max(profile.roundScores[key] ?? 0, score);
        profile.currentRound = Math.max(profile.currentRound ?? 1, round + 1);
        profile.highScore = Math.max(profile.highScore ?? 0, score);

        this.state.events.emit('profile-changed');
    }

    // --- Lose (C1 fix: pass revive callback) ---
    private onLose(): void {
        this.dropController?.setEnabled(false);
        PopupManager.show('FailPopup', {
            score: this.state.score,
            round: this.state.currentRound,
            onRevive: () => this.performRevive(),
        });
    }

    private performRevive(): void {
        if (this.hasRevived) return;
        this.hasRevived = true;

        // 清除容器 Y > 0（中心以上）的甜品
        if (this.mergeManager) {
            const desserts = this.mergeManager.getAllDesserts();
            for (const d of desserts) {
                if (d.node.position.y > 0) {
                    d.node.destroy();
                }
            }
        }

        this.overflowDetector?.reset();
        this.overflowDetector?.setEnabled(true);
        this.dropController?.setEnabled(true);
    }
}
