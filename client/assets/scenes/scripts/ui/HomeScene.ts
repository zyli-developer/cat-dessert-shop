import { _decorator, Component, Label, Node, Sprite, SpriteFrame, resources, director,
         Color, Graphics, UITransform, Layers, UIOpacity, Button, tween, Vec3 } from 'cc';
import { GameState } from '../data/GameState';
import type { UserProfile } from '../net/ApiTypes';
import { PopupManager } from './PopupManager';
import { DouyinSDK } from '../platform/DouyinSDK';
import { GlobalFontManager } from './GlobalFontManager';
import { TOKENS, applyInkOutline } from './DesignTokens';
const { ccclass, property } = _decorator;

@ccclass('HomeScene')
export class HomeScene extends Component {
    private viewingRound: number = 1;
    private _ready = false;

    // 运行时查找的节点引用
    private roundLabel: Label | null = null;
    private levelNameLabel: Label | null = null;
    private starsLabel: Label | null = null;
    private catCoinLabel: Label | null = null;
    private totalStarsLabel: Label | null = null;
    private btnStart: Node | null = null;
    private btnPrev: Node | null = null;
    private btnNext: Node | null = null;
    private btnRank: Node | null = null;
    private btnSettings: Node | null = null;
    private btnAdCatCoin: Node | null = null;
    private btnShare: Node | null = null;
    private btnGift: Node | null = null;

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
        this.btnShare = this.findNode('BtnShare');
        this.btnGift = this.findNode('BtnGift');

        console.log(`[HomeScene] found: btnStart=${!!this.btnStart}, btnPrev=${!!this.btnPrev}, btnNext=${!!this.btnNext}`);

        // 为开始按钮添加文字（场景中只有果冻底图）
        this.addButtonLabel(this.btnStart, '开始营业', 34);
        this.ensureAdCatCoinHint();
        this.ensureGiftBadge();
        this.createHomelandPlaceholder();
        this.setupLevelCard();

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
            this.bindBtn(this.btnShare, this.onSidebarClicked);
            this.bindBtn(this.btnGift, this.onGiftClicked);
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
        label.color = TOKENS.white;
        label.isBold = true;
        applyInkOutline(label, 200, 2);
    }

    /**
     * 顶部右上角创建一个「+ 添加到侧边栏」小按钮。
     * 唯一目的：满足抖音小游戏审核硬指标「侧边栏复访」 —— 必须在 bundle 里调用 tt.navigateToScene。
     * 同时是真实可用功能：玩家点了能把游戏加到自己抖音侧边栏，下次能直接进。
     */
    private createSidebarButton(): void {
        const btn = new Node('BtnSidebar');
        btn.layer = Layers.Enum.UI_2D;
        btn.parent = this.node;
        const ut = btn.addComponent(UITransform);
        ut.setContentSize(180, 56);
        btn.setPosition(220, 480, 0);

        const label = btn.addComponent(Label);
        label.string = '+ 加到侧边栏';
        label.fontSize = 22;
        label.lineHeight = 28;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = TOKENS.white;
        label.isBold = true;
        applyInkOutline(label, 220, 3);

        btn.on(Node.EventType.TOUCH_END, this.onSidebarClicked, this);
    }

    private async onSidebarClicked(): Promise<void> {
        await DouyinSDK.navigateToSidebar();
    }

    /**
     * 关卡卡排版（home.html 关卡选择卡）：
     * 顶部小字「第 N 关 · 共 X 关」(RoundLabel 降为副标题) + 中部大字关卡主题名(LevelName)。
     */
    private setupLevelCard(): void {
        // RoundLabel 降级为顶部小副标题
        if (this.roundLabel) {
            this.roundLabel.fontSize = 22;
            this.roundLabel.lineHeight = 26;
            this.roundLabel.color = TOKENS.inkSoft;
            this.roundLabel.node.setPosition(0, 48, 0);
            this.roundLabel.enableOutline = false;
        }

        // 中部大字主题名
        if (!this.levelNameLabel) {
            const node = new Node('LevelName');
            node.layer = Layers.Enum.UI_2D;
            node.parent = this.roundLabel?.node.parent ?? this.node;
            node.setPosition(0, 10, 0);
            node.addComponent(UITransform).setContentSize(500, 56);
            const l = node.addComponent(Label);
            l.fontSize = 36;
            l.lineHeight = 46;
            l.horizontalAlign = Label.HorizontalAlign.CENTER;
            l.verticalAlign = Label.VerticalAlign.CENTER;
            l.color = TOKENS.ink;
            l.isBold = true;
            l.cacheMode = Label.CacheMode.BITMAP;
            this.levelNameLabel = l;
            GlobalFontManager.applyFont(node);
        }
    }

    /** 每日礼包入口角标「1」（home.html tool__count）。 */
    private ensureGiftBadge(): void {
        if (!this.btnGift || this.btnGift.getChildByName('GiftBadge')) return;
        const badge = new Node('GiftBadge');
        badge.layer = Layers.Enum.UI_2D;
        badge.parent = this.btnGift;
        badge.addComponent(UITransform).setContentSize(40, 40);
        badge.setPosition(46, 46, 0);
        const g = badge.addComponent(Graphics);
        g.fillColor = TOKENS.pink;
        g.circle(0, 0, 20);
        g.fill();
        const label = new Node('n');
        label.layer = Layers.Enum.UI_2D;
        label.parent = badge;
        label.addComponent(UITransform).setContentSize(40, 40);
        const l = label.addComponent(Label);
        l.string = '1';
        l.fontSize = 24;
        l.lineHeight = 40;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = TOKENS.white;
        l.isBold = true;
    }

    /**
     * 家园（即将开放）占位 —— PRD 03-ui/07 要求首页有置灰预告入口（home.html M4）。
     * 砂色胶囊 + 家园图标 + 文案 + 锁；点击仅弹出「敬请期待」轻提示，不进屏。
     */
    private createHomelandPlaceholder(): void {
        if (this.node.getChildByName('BtnHomeland')) return;
        const btn = new Node('BtnHomeland');
        btn.layer = Layers.Enum.UI_2D;
        btn.parent = this.node;
        btn.setPosition(0, 135, 0);
        const W = 320, H = 72;
        btn.addComponent(UITransform).setContentSize(W, H);
        const g = btn.addComponent(Graphics);
        g.fillColor = TOKENS.sand2;
        g.roundRect(-W / 2, -H / 2, W, H, H / 2);
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = TOKENS.line2;
        g.roundRect(-W / 2, -H / 2, W, H, H / 2);
        g.stroke();

        this.makeIconSprite(btn, 'textures/ui/icon_home', -118, 0, 34, TOKENS.inkMute);
        const label = new Node('label');
        label.layer = Layers.Enum.UI_2D;
        label.parent = btn;
        label.addComponent(UITransform).setContentSize(220, H);
        label.setPosition(6, 0, 0);
        const l = label.addComponent(Label);
        l.string = '家园 · 即将开放';
        l.fontSize = 26;
        l.lineHeight = H;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = TOKENS.inkMute;
        l.isBold = true;
        GlobalFontManager.applyFont(label);
        this.makeIconSprite(btn, 'textures/ui/icon_lock', 120, 0, 26, TOKENS.inkMute);

        btn.on(Node.EventType.TOUCH_END, () => this.showToast('家园正在装修，敬请期待~'), this);
    }

    /** 从 resources 加载图标到子 Sprite（可染色）。 */
    private makeIconSprite(parent: Node, path: string, x: number, y: number, size: number, tint?: Color): void {
        const node = new Node('Icon');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(size, size);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (tint) sp.color = tint;
        resources.load(`${path}/spriteFrame`, SpriteFrame, (err, frame) => {
            if (!err && frame && sp.isValid) sp.spriteFrame = frame;
        });
    }

    /** 一闪而过的居中轻提示。 */
    private showToast(text: string): void {
        const toast = new Node('Toast');
        toast.layer = Layers.Enum.UI_2D;
        toast.parent = this.node;
        toast.setPosition(0, 0, 0);
        toast.addComponent(UITransform).setContentSize(420, 64);
        const g = toast.addComponent(Graphics);
        g.fillColor = new Color(90, 70, 54, 230);
        g.roundRect(-210, -32, 420, 64, 18);
        g.fill();
        const ln = new Node('t');
        ln.layer = Layers.Enum.UI_2D;
        ln.parent = toast;
        ln.addComponent(UITransform).setContentSize(420, 64);
        const l = ln.addComponent(Label);
        l.string = text;
        l.fontSize = 26;
        l.lineHeight = 64;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = TOKENS.paper2;
        l.isBold = true;
        const op = toast.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.15, { opacity: 255 }).delay(1.0).to(0.3, { opacity: 0 })
            .call(() => toast.isValid && toast.destroy()).start();
        tween(toast).to(0.15, { scale: new Vec3(1, 1, 1) }).start();
        toast.setScale(0.92, 0.92, 1);
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
        label.color = TOKENS.white;
        label.isBold = true;
        applyInkOutline(label, 220, 3);
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

    private onGiftClicked(): void {
        PopupManager.show('DailyGiftPopup');
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

        // 关卡卡：小字「第 N 关 · 共 X 关」+ 大字关卡主题名（对齐 home.html）
        const total = state.allLevels.length;
        if (this.roundLabel) {
            this.roundLabel.string = `第 ${this.viewingRound} 关 · 共 ${total} 关`;
        }
        if (this.levelNameLabel) {
            const level = state.allLevels[this.viewingRound - 1];
            this.levelNameLabel.string = level?.name ?? `第 ${this.viewingRound} 关`;
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
                label.string = unlocked ? '开始营业' : '🔒 未解锁';
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
        return `${n}`;
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
