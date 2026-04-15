import { _decorator, Component, Label, Node, Sprite, director,
         Color, UITransform, Layers, UIOpacity, Button } from 'cc';
import { GameState } from '../data/GameState';
import type { UserProfile } from '../net/ApiTypes';
import { PopupManager } from './PopupManager';
import { DouyinSDK } from '../platform/DouyinSDK';
import { GlobalFontManager } from './GlobalFontManager';
const { ccclass, property } = _decorator;

@ccclass('HomeScene')
export class HomeScene extends Component {
    private viewingRound: number = 1;
    private _ready = false;

    // 运行时查找的节点引用
    private roundLabel: Label | null = null;
    private starsLabel: Label | null = null;
    private catCoinLabel: Label | null = null;
    private totalStarsLabel: Label | null = null;
    private btnStart: Node | null = null;
    private btnPrev: Node | null = null;
    private btnNext: Node | null = null;
    private btnRank: Node | null = null;
    private btnSettings: Node | null = null;
    private btnAdCatCoin: Node | null = null;

    onLoad(): void {
        console.log('[HomeScene] === onLoad ===');

        void GlobalFontManager.applyFontWhenReady(this.node);

        // 递归查找所有 UI 节点
        this.roundLabel = this.findLabel('RoundLabel');
        this.starsLabel = this.findLabel('Stars');
        this.catCoinLabel = this.findLabel('CatCoinLabel');
        this.totalStarsLabel = this.findLabel('TotalStarsLabel');

        this.btnStart = this.findNode('BtnStart');
        this.btnPrev = this.findNode('BtnPrev');
        this.btnNext = this.findNode('BtnNext');
        this.btnRank = this.findNode('BtnRank');
        this.btnSettings = this.findNode('BtnSettings');
        this.btnAdCatCoin = this.findNode('BtnAdCatCoin');

        console.log(`[HomeScene] found: btnStart=${!!this.btnStart}, btnPrev=${!!this.btnPrev}, btnNext=${!!this.btnNext}`);

        // 为开始按钮添加文字（场景中只有图片）
        this.addButtonLabel(this.btnStart, '开始游戏', 28);
        this.ensureAdCatCoinHint();

        const state = GameState.instance;
        this.viewingRound = state.currentRound;
        this.updateDisplay();

        GameState.instance.events.on('profile-changed', this.updateDisplay, this);
    }

    onEnable(): void {
        this.updateDisplay();
    }

    start(): void {
        // 绑定按钮触摸事件
        this.scheduleOnce(() => {
            this.bindBtn(this.btnStart, this.onStartGame);
            this.bindBtn(this.btnPrev, this.onPrevRound);
            this.bindBtn(this.btnNext, this.onNextRound);
            this.bindBtn(this.btnRank, this.onRankClicked);
            this.bindBtn(this.btnSettings, this.onSettingsClicked);
            this.bindBtn(this.btnAdCatCoin, this.onAdCatCoinClicked);
            this._ready = true;
            console.log('[HomeScene] Touch events bound, ready=true');
        }, 0.3);
    }

    /** 递归查找节点 */
    private findNode(name: string): Node | null {
        return this._findChild(this.node, name);
    }

    private _findChild(parent: Node, name: string): Node | null {
        for (const child of parent.children) {
            if (child.name === name) return child;
            const found = this._findChild(child, name);
            if (found) return found;
        }
        return null;
    }

    private findLabel(name: string): Label | null {
        const node = this.findNode(name);
        return node?.getComponent(Label) ?? null;
    }

    private bindBtn(node: Node | null, handler: () => void): void {
        if (!node) return;
        node.on(Node.EventType.TOUCH_END, handler, this);
        console.log(`[HomeScene] bound touch on "${node.name}"`);
    }

    /** 广告按钮仅有底图时补充说明文案 */
    private ensureAdCatCoinHint(): void {
        if (!this.btnAdCatCoin || this.btnAdCatCoin.getChildByName('AdHint')) return;
        const hint = new Node('AdHint');
        hint.layer = Layers.Enum.UI_2D;
        hint.parent = this.btnAdCatCoin;
        const parentUt = this.btnAdCatCoin.getComponent(UITransform);
        const w = parentUt?.width ?? 200;
        const h = parentUt?.height ?? 60;
        const hintUt = hint.addComponent(UITransform);
        hintUt.setContentSize(w, h);
        hint.setPosition(0, 0, 0);
        const label = hint.addComponent(Label);
        label.string = '看广告 +10';
        label.fontSize = 22;
        label.lineHeight = 26;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);
        label.isBold = true;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 160);
        label.outlineWidth = 2;
    }

    private addButtonLabel(btn: Node | null, text: string, fontSize: number): void {
        if (!btn || !text) return;
        const labelNode = new Node('BtnLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = btn;

        const ut = btn.getComponent(UITransform);
        const w = ut ? ut.width : 200;
        const h = ut ? ut.height : 60;
        const labelUT = labelNode.addComponent(UITransform);
        labelUT.setContentSize(w, h);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = h;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);
        label.isBold = true;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 150);
        label.outlineWidth = 3;
    }

    // --- 按钮回调 ---
    private onStartGame(): void {
        if (!this._ready) return;
        // 检查是否解锁
        if (!this.isRoundUnlocked(this.viewingRound)) return;
        console.log('[HomeScene] Start game clicked!');
        GameState.instance.currentRound = this.viewingRound;
        GameState.instance.resetRound();
        director.loadScene('Game');
    }

    private onPrevRound(): void {
        if (this.viewingRound > 1) {
            this.viewingRound--;
            this.updateDisplay();
        }
    }

    private onNextRound(): void {
        const allLevels = GameState.instance.allLevels;
        if (this.viewingRound < allLevels.length) {
            this.viewingRound++;
            this.updateDisplay();
        }
    }

    private onRankClicked(): void {
        PopupManager.show('RankPopup');
    }

    private onSettingsClicked(): void {
        PopupManager.show('SettingsPopup');
    }

    private async onAdCatCoinClicked(): Promise<void> {
        const success = await DouyinSDK.showRewardedAd('home_catcoin');
        if (success) {
            const state = GameState.instance;
            if (state.userProfile) {
                state.userProfile.catCoins += 10;
            }
            this.updateDisplay();
        }
    }

    // --- 关卡解锁判断 ---
    /** 第 N 关已解锁 = 第 N-1 关已获得至少 1 星（第 1 关始终解锁） */
    private isRoundUnlocked(round: number): boolean {
        if (round <= 1) return true;
        const profile = GameState.instance.userProfile;
        if (!profile?.stars) return false;
        const prevStars = profile.stars[String(round - 1)] ?? 0;
        return prevStars > 0;
    }

    // --- 更新显示 ---
    private updateDisplay(): void {
        const state = GameState.instance;
        const profile = state.userProfile;

        if (this.roundLabel) {
            this.roundLabel.string = `第 ${this.viewingRound} 关`;
        }

        if (this.catCoinLabel) {
            this.catCoinLabel.string = this.formatCatCoinsLine(profile);
        }

        const stars = profile?.stars?.[String(this.viewingRound)] ?? 0;
        if (this.starsLabel) {
            this.starsLabel.string = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        }

        if (this.totalStarsLabel) {
            this.totalStarsLabel.string = this.formatTotalStarsLine();
        }

        // 更新开始按钮状态（未解锁关卡显示锁定样式）
        const unlocked = this.isRoundUnlocked(this.viewingRound);
        if (this.btnStart) {
            // 查找或创建文字子节点
            const labelNode = this.btnStart.getChildByName('BtnLabel');
            const label = labelNode?.getComponent(Label);
            if (label) {
                label.string = unlocked ? '开始游戏' : '🔒 未解锁';
                label.color = unlocked
                    ? new Color(255, 255, 255, 255)
                    : new Color(180, 180, 180, 255);
            }
            // 按钮变灰
            const sprite = this.btnStart.getComponent(Sprite);
            if (sprite) {
                sprite.color = unlocked
                    ? new Color(255, 255, 255, 255)
                    : new Color(120, 120, 120, 255);
            }
        }

        // 左右切换：不能用 active=false，否则横向 Layout 会少一格，「开始游戏」会整体偏左/偏右。
        // 改为透明占位 + 禁用交互，保持三格宽度与居中。
        this.setRoundNavPlaceholder(this.btnPrev, this.viewingRound > 1);
        this.setRoundNavPlaceholder(this.btnNext, this.viewingRound < state.allLevels.length);
    }

    private formatTotalStarsLine(): string {
        const n = GameState.instance.getTotalStarsCount();
        return `总星 ${n}`;
    }

    private formatCatCoinsLine(profile: UserProfile | null | undefined): string {
        const n = profile?.catCoins ?? 0;
        return `猫币 ${n}`;
    }

    onDestroy(): void {
        GameState.instance.events.off('profile-changed', this.updateDisplay, this);
    }

    /** 隐藏时仍占位（opacity=0），避免 ButtonsContainer 的 Layout 重排导致主按钮不居中 */
    private setRoundNavPlaceholder(btn: Node | null, visible: boolean): void {
        if (!btn) return;
        btn.active = true;
        let op = btn.getComponent(UIOpacity);
        if (!op) {
            op = btn.addComponent(UIOpacity);
        }
        op.opacity = visible ? 255 : 0;
        const b = btn.getComponent(Button);
        if (b) {
            b.interactable = visible;
        }
    }
}
