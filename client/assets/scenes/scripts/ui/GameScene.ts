import { _decorator, Component, Label, Node, director, Vec3, tween,
         RigidBody2D, ERigidBody2DType, Color, Layout, UITransform,
         Sprite, SpriteFrame, resources, Graphics, Layers, Widget } from 'cc';
import { TOKENS } from './DesignTokens';
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
import { Toast } from '../utils/Toast';
import { PopupManager } from './PopupManager';
import { GlobalFontManager } from './GlobalFontManager';
import { SafeArea } from '../platform/SafeArea';
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

    /** 订单面板：进度计数 + 动态进度条 */
    private orderProgressLabel: Label | null = null;
    private orderBar: Node | null = null;

    /** 金币芯片（HUD 右上）：金币到账时弹跳一次（states.html A4） */
    private goldChip: Node | null = null;
    private lastGold = -1;

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

        this.layoutGameUI();

        this.state.resetRound();
        const round = this.state.currentRound;
        const levelData = this.state.getCurrentLevel();

        console.log(`[GameScene] onLoad: round=${round}, levelData=${!!levelData}, mergeManager=${!!this.mergeManager}, customerManager=${!!this.customerManager}`);

        // Init HUD
        if (this.roundLabel) this.roundLabel.string = `第 ${round} 关`;
        this.updateHUD();

        // 监听分数/金币变化
        this.state.events.on('score-changed', this.updateHUD, this);
        this.state.events.on('gold-changed', this.updateHUD, this);

        // Init customer queue
        if (levelData && this.customerManager) {
            this.customerManager.initRound(levelData.customers);
            this.updateOrderProgress();
            this.customerManager.onRoundComplete = () => this.onWin();
            // 所有顾客满足后立即禁用溢出检测和投放，防止动画延迟期间误触发 game over
            this.customerManager.onAllCustomersDone = () => {
                this.dropController?.setEnabled(false);
                this.overflowDetector?.setEnabled(false);
            };
        }

        // 顾客槽位创建后，把顶栏 HUD 全部置顶，确保暂停/金币/订单不被任何后建节点遮住
        this.bringHudToFront();

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
                this.updateOrderProgress();
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
     * 局内 UI 排版（对齐 docs/ui-mockup/game.html）—— 运行时组装，避免 Game.scene
     * 原始 JSON 编辑无法被编辑器/构建可靠刷新的缓存问题。
     *  顶栏 暂停(左) · 订单面板(中) · 金币芯片(右) + 分数(居中大字)
     *  道具栏 锤子/洗牌/看广告 → 底部一行（暂停移出道具组到左上）
     *  NEXT → 容器右上侧；背景柔化遮罩
     */
    private layoutGameUI(): void {
        this.addBgVeil();
        const safe = SafeArea.get();
        // 顶栏基线 = 紧贴胶囊下沿再上提一点（整条顶栏继续上移；无 tt 时回落 48）。
        // 注意：再往上就会被抖音胶囊/灵动岛压住（尤其右上角的金币），这里已接近系统 UI 下沿。
        const TOP = Math.max(48, safe.capsuleBottom - 6);

        // 暂停 → 左上角：场景里的 BtnPause 在真机上始终不显示（疑似序列化/层级问题），
        // 改为运行时新建一个保证可见的暂停键，并隐藏场景旧节点。
        const scenePause = this.btnPause ?? this.findInScene('BtnPause');
        if (scenePause) scenePause.active = false;
        const pauseBtn = new Node('PauseBtn');
        pauseBtn.layer = Layers.Enum.UI_2D;
        pauseBtn.parent = this.node;
        pauseBtn.addComponent(UITransform).setContentSize(62, 62);
        this.addButtonBg(pauseBtn, 62, 62);
        this.makeIcon(pauseBtn, 'textures/ui/icon_pause', 0, 0, 34, TOKENS.ink);
        // 用 hCenter 而非 left：Widget 的 left/right 锚到 720 设计画布边，长屏会被推出屏外（之前暂停只剩一条缝）。
        this.anchor(pauseBtn, { top: TOP, hCenter: -238 });
        this.btnPause = pauseBtn;

        // 道具栏 → 底部一行（关 Layout，Widget 改锚到底部中心）
        const group = this.btnHammer?.parent;
        if (group && group.name === 'ButtonGroup') {
            const layout = group.getComponent(Layout);
            if (layout) layout.enabled = false;
            group.getComponent(UITransform)?.setContentSize(560, 110);
            this.btnHammer?.setPosition(-185, 0, 0);
            this.btnShuffle?.setPosition(0, 0, 0);
            this.btnAd?.setPosition(185, 0, 0);
            this.addButtonBg(this.btnHammer, 96, 96);
            this.addButtonBg(this.btnShuffle, 96, 96);
            this.addButtonBg(this.btnAd, 96, 96);
            this.anchor(group, { bottom: 46 + safe.bottom, hCenter: 0 });
            group.setSiblingIndex(this.node.children.length - 1);
        }

        // 金币芯片 → 右上：关键修复！右侧让出整个胶囊宽度，把芯片推到胶囊左边，避免被压住。
        if (this.goldLabel) {
            this.goldLabel.fontSize = 30;
            this.goldLabel.color = TOKENS.butterText;
            this.goldLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
            const chip = this.chipContainer(this.goldLabel, 122, 58, 'textures/ui/icon_coin');
            // 与暂停按钮（62 高）底边对齐：金币芯片 58 高 → 顶部 +4 让底边落在 TOP+62 这条线上。
            this.anchor(chip, { top: TOP + 4, hCenter: 228 });
            this.goldChip = chip;
        }

        // 订单面板 → 顶栏中部：关卡名(左) · ★得分(中) · 订单进度(右) · 进度条
        // 「计分」已并入这里，移除原来居中的独立大字分数。
        if (this.roundLabel) {
            const panel = new Node('OrderPanel');
            panel.layer = Layers.Enum.UI_2D;
            panel.parent = this.node;
            panel.addComponent(UITransform).setContentSize(320, 72);
            this.wrapChip(panel, 320, 72);

            // 关卡名（左，anchorX=0 钉左缘避免居中文字溢出）
            const rl = this.roundLabel;
            rl.node.parent = panel;
            rl.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
            rl.node.getComponent(UITransform)?.setContentSize(110, 28);
            rl.node.setPosition(-155, 16, 0);
            rl.fontSize = 22;
            rl.color = TOKENS.inkSoft;
            rl.horizontalAlign = Label.HorizontalAlign.LEFT;

            // ★ 得分（中）—— 计分与关卡进度结合
            if (this.scoreLabel) {
                const sc = this.scoreLabel.node;
                sc.parent = panel;
                sc.getComponent(UITransform)?.setContentSize(140, 28);
                sc.setPosition(6, 16, 0);
                this.scoreLabel.fontSize = 24;
                this.scoreLabel.color = TOKENS.ink;
                this.scoreLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
                this.makeIcon(sc, 'textures/ui/icon_star', -40, 0, 22, TOKENS.star);
            }

            // 订单进度计数（右，anchorX=1 钉右缘）
            this.orderProgressLabel = this.makeOrderCount(panel, 155, 16);
            this.orderProgressLabel.node.getComponent(UITransform)?.setAnchorPoint(1, 0.5);

            // 进度条（底）
            this.orderBar = this.buildOrderBar(panel, 0, -20);
            // 与暂停按钮底边对齐：面板 72 高 → 顶部 TOP-10 让底边落在 TOP+62 这条线上（整体略下移）。
            this.anchor(panel, { top: TOP - 10, hCenter: 0 });
            this.updateOrderProgress();
        }

        // NEXT → 右侧（独立面板，甜点预览置于其上）
        const next = this.node.getChildByName('HUD')?.getChildByName('NextPreview')
            ?? this.node.getChildByName('NextPreview');
        if (next) {
            const panel = new Node('NextPanel');
            panel.layer = Layers.Enum.UI_2D;
            panel.parent = this.node;
            panel.addComponent(UITransform).setContentSize(90, 118);
            this.wrapChip(panel, 90, 118);
            this.makeText(panel, 'NEXT', 0, 42, 20, TOKENS.inkSoft);
            next.parent = panel;
            next.setPosition(0, -12, 0);
            // 再往右靠（仍留余量不被裁），落在容器右上角外侧、基本不压容器。
            this.anchor(panel, { top: TOP + 234, hCenter: 244 });
        }
    }

    /** 把顶栏 HUD 节点逐个置顶（高于运行时新建的顾客槽位），避免被遮挡。 */
    private bringHudToFront(): void {
        const nodes: Array<Node | null> = [
            this.node.getChildByName('NextPanel'),
            this.node.getChildByName('OrderPanel'),
            this.node.getChildByName('Chip'),       // 金币芯片
            this.scoreLabel?.node ?? null,
            this.btnPause,                           // PauseBtn
        ];
        for (const n of nodes) {
            if (n?.isValid) n.setSiblingIndex(this.node.children.length - 1);
        }
    }

    /** 在场景树里按名字递归查找节点（@property 兜底用）。 */
    private findInScene(name: string, parent: Node = this.node): Node | null {
        for (const child of parent.children) {
            if (child.name === name) return child;
            const found = this.findInScene(name, child);
            if (found) return found;
        }
        return null;
    }

    /** cc.Widget 锚定到屏幕边/中线，适配不同机型分辨率（避免固定坐标被裁切）。 */
    private anchor(node: Node, o: { top?: number; bottom?: number; left?: number; right?: number; hCenter?: number; vCenter?: number }): void {
        const w = node.getComponent(Widget) ?? node.addComponent(Widget);
        w.enabled = true;
        w.isAlignTop = o.top != null; if (o.top != null) w.top = o.top;
        w.isAlignBottom = o.bottom != null; if (o.bottom != null) w.bottom = o.bottom;
        w.isAlignLeft = o.left != null; if (o.left != null) w.left = o.left;
        w.isAlignRight = o.right != null; if (o.right != null) w.right = o.right;
        w.isAlignHorizontalCenter = o.hCenter != null; if (o.hCenter != null) w.horizontalCenter = o.hCenter;
        w.isAlignVerticalCenter = o.vCenter != null; if (o.vCenter != null) w.verticalCenter = o.vCenter;
        w.alignMode = Widget.AlignMode.ALWAYS;
        w.updateAlignment();
    }

    /** 芯片容器：象牙底 + 可选图标 + 把传入 Label 收进来置顶（底在下、字在上）。 */
    private chipContainer(label: Label, w: number, h: number, iconPath?: string): Node {
        const c = new Node('Chip');
        c.layer = Layers.Enum.UI_2D;
        c.parent = this.node;
        c.addComponent(UITransform).setContentSize(w, h);
        this.wrapChip(c, w, h);
        if (iconPath) this.makeIcon(c, iconPath, -w / 2 + 30, 0, 38);
        label.node.parent = c;
        label.node.setPosition(iconPath ? 16 : 0, 0, 0);
        label.node.getComponent(UITransform)?.setContentSize(w - (iconPath ? 56 : 24), h);
        return c;
    }

    private addBgVeil(): void {
        if (this.node.getChildByName('BgVeil')) return;
        const veil = new Node('BgVeil');
        veil.layer = Layers.Enum.UI_2D;
        veil.parent = this.node;
        veil.addComponent(UITransform).setContentSize(720, 1280);
        const g = veil.addComponent(Graphics);
        g.fillColor = new Color(255, 247, 236, 70);
        g.rect(-360, -640, 720, 1280);
        g.fill();
        veil.setSiblingIndex(1);
    }

    /** 在节点下方铺一张象牙圆角芯片底（card_ivory），并下沉到最底渲染。 */
    private wrapChip(host: Node, w: number, h: number, yOff = 0): void {
        if (host.getChildByName('ChipBg')) return;
        const bg = new Node('ChipBg');
        bg.layer = Layers.Enum.UI_2D;
        bg.parent = host;
        bg.setPosition(0, yOff, 0);
        bg.addComponent(UITransform).setContentSize(w, h);
        const sp = bg.addComponent(Sprite);
        sp.type = Sprite.Type.SLICED;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = TOKENS.white;
        resources.load('textures/ui/chip_bg/spriteFrame', SpriteFrame, (e, f) => {
            if (!e && f && sp.isValid) sp.spriteFrame = f;
        });
        bg.setSiblingIndex(0);
    }

    /** 给按钮（暂停/道具）补一张象牙圆角背景，垫在图标之下。 */
    private addButtonBg(btn: Node | null, w: number, h: number): void {
        if (!btn || btn.getChildByName('BtnBg')) return;
        const bg = new Node('BtnBg');
        bg.layer = Layers.Enum.UI_2D;
        bg.parent = btn;
        bg.setPosition(0, 0, 0);
        bg.addComponent(UITransform).setContentSize(w, h);
        const sp = bg.addComponent(Sprite);
        sp.type = Sprite.Type.SLICED;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = TOKENS.white;
        resources.load('textures/ui/chip_bg/spriteFrame', SpriteFrame, (e, f) => {
            if (!e && f && sp.isValid) sp.spriteFrame = f;
        });
        bg.setSiblingIndex(0);
    }

    /** 订单进度条节点（Graphics，宽度由 updateOrderProgress 重绘）。 */
    private buildOrderBar(parent: Node, x: number, y: number): Node {
        const bar = new Node('OrderBar');
        bar.layer = Layers.Enum.UI_2D;
        bar.parent = parent;
        bar.setPosition(x, y, 0);
        bar.addComponent(UITransform).setContentSize(280, 12);
        bar.addComponent(Graphics);
        return bar;
    }

    /** 订单进度计数标签「x/y」（薄荷，右对齐）。 */
    private makeOrderCount(parent: Node, x: number, y: number): Label {
        const node = new Node('OrderCount');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(70, 30);
        const l = node.addComponent(Label);
        l.fontSize = 24;
        l.lineHeight = 28;
        l.horizontalAlign = Label.HorizontalAlign.RIGHT;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = TOKENS.mintDp;
        l.isBold = true;
        GlobalFontManager.applyFont(node);
        return l;
    }

    /** 刷新订单面板进度（已服务/总顾客 + 进度条填充）。 */
    private updateOrderProgress(): void {
        const p = this.customerManager?.getProgress() ?? { served: 0, total: 0 };
        if (this.orderProgressLabel) this.orderProgressLabel.string = `${p.served}/${p.total}`;
        if (this.orderBar) {
            const g = this.orderBar.getComponent(Graphics);
            if (g) {
                const W = 280, H = 12, r = p.total > 0 ? p.served / p.total : 0;
                g.clear();
                g.fillColor = TOKENS.sand2;
                g.roundRect(-W / 2, -H / 2, W, H, H / 2);
                g.fill();
                if (r > 0) {
                    g.fillColor = TOKENS.mint;
                    g.roundRect(-W / 2, -H / 2, Math.max(H, W * r), H, H / 2);
                    g.fill();
                }
            }
        }
    }

    private makeIcon(parent: Node, path: string, x: number, y: number, size: number, tint?: Color): void {
        const node = new Node('Icon');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(size, size);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (tint) sp.color = tint;
        resources.load(`${path}/spriteFrame`, SpriteFrame, (e, f) => {
            if (!e && f && sp.isValid) sp.spriteFrame = f;
        });
    }

    private makeText(parent: Node, text: string, x: number, y: number, fontSize: number, color: Color): void {
        const node = new Node('TxtLabel');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(120, fontSize + 6);
        const l = node.addComponent(Label);
        l.string = text;
        l.fontSize = fontSize;
        l.lineHeight = fontSize + 4;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = color;
        l.isBold = true;
        GlobalFontManager.applyFont(node);
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

        // 金币增加 → 芯片弹跳一次（states.html A4「HUD 金币芯片做一次弹跳」）
        if (this.lastGold >= 0 && this.state.gold > this.lastGold && this.goldChip?.isValid) {
            this.goldChip.setScale(1, 1, 1);
            tween(this.goldChip)
                .to(0.1, { scale: new Vec3(1.18, 1.18, 1) })
                .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }
        this.lastGold = this.state.gold;
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

        const progress = this.customerManager?.getProgress() ?? { served: 0, total: 0 };
        const winScore = this.state.score;
        const progressReady = this.saveProgressWithRetry(winRound, winScore, stars);
        PopupManager.show('WinPopup', {
            stars,
            score: this.state.score,
            catCoins,
            round: winRound,
            customerCount: progress.total,
            isLastRound: winRound >= this.state.allLevels.length,
            progressReady,
            retryProgress: () => this.saveProgressWithRetry(winRound, winScore, stars, false),
        });
    }

    /**
     * 上传进度（D2：自动重连 + 双 toast）。失败本地已落盘，不阻断对局。
     * 首次失败 →「正在重连…」；重连成功 →「进度已保存」；多次仍失败 → 本地保存提示。
     */
    private async saveProgressWithRetry(
        winRound: number, score: number, stars: number, notify = true,
    ): Promise<boolean> {
        if (ApiClient.isOfflineMode()) return true;
        const maxTries = 3;
        for (let i = 0; i < maxTries; i++) {
            try {
                const data = await ApiClient.updateProgress(winRound, score, stars);
                if (data && typeof data === 'object' && 'catCoins' in data) {
                    GameState.instance.applyProgressFromApi(data as {
                        catCoins: number; currentRound: number; highScore: number;
                        stars: Record<string, number>; roundScores: Record<string, number>;
                    });
                }
                if (notify && i > 0) Toast.show('进度已保存，放心', false, 'icon_bell');
                return true;
            } catch (e) {
                console.error(`[GameScene] save progress failed (try ${i + 1}/${maxTries})`, e);
                if (notify && i === 0) Toast.show('网络开小差，正在重连…', true, 'icon_wifioff');
                if (i < maxTries - 1) await this.delay(1.2 * (i + 1));
            }
        }
        if (notify) Toast.show('网络仍未恢复 · 进度已本地保存~', true, 'icon_wifioff');
        return false;
    }

    /** scheduleOnce 包成 Promise 的延时（用于重连退避）。 */
    private delay(seconds: number): Promise<void> {
        return new Promise((resolve) => this.scheduleOnce(() => resolve(), seconds));
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
        const progress = this.customerManager?.getProgress() ?? { served: 0, total: 0 };
        PopupManager.show('FailPopup', {
            score: this.state.score,
            round: this.state.currentRound,
            served: progress.served,
            total: progress.total,
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
