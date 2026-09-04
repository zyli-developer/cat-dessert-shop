import {
    _decorator, Component, Node, Vec3, Vec2, RigidBody2D, UITransform,
    Sprite, SpriteFrame, resources, Label, Layers, Color, tween, UIOpacity, Graphics,
} from 'cc';
import { Dessert } from './Dessert';
import { GameState } from '../data/GameState';
import { touchToNodeLocal } from '../utils/TouchSpace';
import { DouyinSDK } from '../platform/DouyinSDK';
import { AD_UNIT_IDS } from '../platform/AdConfig';
import { Toast } from '../utils/Toast';
import { TOKENS, applyInkOutline } from '../ui/DesignTokens';
import { GlobalFontManager } from '../ui/GlobalFontManager';
const { ccclass, property } = _decorator;

const HAMMER_COST = 15;
const SHUFFLE_COST = 15;
const AD_GOLD_REWARD = 10;

/** 前 N 关不显示广告（首次体验保护） */
const AD_PROTECTION_ROUNDS = 2;

enum ItemMode { None, Hammer }

@ccclass('ItemManager')
export class ItemManager extends Component {
    private adInProgress = false;
    @property(Node)
    containerNode: Node | null = null;

    @property(Node)
    btnHammer: Node | null = null;

    @property(Node)
    btnShuffle: Node | null = null;

    @property(Node)
    btnAd: Node | null = null;

    private mode: ItemMode = ItemMode.None;
    private state = GameState.instance;

    /** 锤子选择模式临时节点（遮罩/提示条/准星/取消/命中高亮环） */
    private hammerOverlay: Node | null = null;
    private crosshair: Node | null = null;
    private highlightRing: Node | null = null;
    private adPulse: any = null;

    /** 锤子模式：逐甜品挂的点击监听（引擎命中检测，移动端可靠），退出时统一解绑 */
    private hammerTargets: Array<{ node: Node; handler: () => void }> = [];

    /** 金币不足气泡：只闪 3 秒；记录上一次余额状态，只在「变为不足」时触发 */
    private prevAfford = true;
    private bubbleBlink: any = null;
    private readonly hideBubbleCb = (): void => this.hideGuideBubble();

    onLoad(): void {
        // 道具栏始终展示三件道具（锤子/洗牌/看广告），对齐 docs/ui-mockup/game.html。
        // 「首次体验保护」改为：前 N 关不主动脉动引导看广告（见 updateButtonStates），
        // 但按钮本体保持可见，避免与设计稿（三道具）不一致。
        if (this.btnAd) this.btnAd.active = true;

        // 监听金币变化，更新按钮状态
        this.state.events.on('gold-changed', this.updateButtonStates, this);
        this.updateButtonStates();
    }

    onDestroy(): void {
        this.state.events.off('gold-changed', this.updateButtonStates, this);
        if (this.containerNode?.isValid) {
            this.containerNode.off(Node.EventType.TOUCH_END, this.onContainerTap, this);
            this.containerNode.off(Node.EventType.TOUCH_MOVE, this.onContainerMove, this);
        }
        this.stopAdPulse();
    }

    onHammerClicked(): void {
        if (this.mode === ItemMode.Hammer) return;
        if (!this.containerNode) return;
        // 容器内没有甜品时锤子无意义，先判断再扣费，避免白扣金币
        if (this.containerNode.getComponentsInChildren(Dessert).length === 0) return;
        if (!this.state.spendGold(HAMMER_COST)) {
            // 金币不足时点道具 → 重新弹出引导气泡（再闪 3 秒）
            this.showGuideBubble();
            return;
        }
        this.mode = ItemMode.Hammer;
        // 通知 DropController 挂起掉落：选择模式里点容器是「选甜品」，不是「投放」
        this.state.events.emit('hammer-mode-changed', true);
        this.enterHammerMode();
        // 命中主路径：逐甜品挂点击监听，由引擎做命中检测（与按钮同机制，
        // 移动端 DPR/坐标换算差异不影响）；容器监听只作准星跟随 + 兜底命中。
        this.bindDessertTaps();
        this.containerNode.on(Node.EventType.TOUCH_END, this.onContainerTap, this);
        this.containerNode.on(Node.EventType.TOUCH_MOVE, this.onContainerMove, this);
    }

    /** 给容器内每个甜品节点挂 TOUCH_END（含焦糊曲奇等一切甜品），退出锤子模式时统一解绑。 */
    private bindDessertTaps(): void {
        this.hammerTargets = [];
        const desserts = this.containerNode!.getComponentsInChildren(Dessert);
        for (const d of desserts) {
            const handler = (): void => this.hammerHit(d);
            d.node.on(Node.EventType.TOUCH_END, handler);
            this.hammerTargets.push({ node: d.node, handler });
        }
    }

    /** 锤子命中：消除目标甜品并退出选择模式（已消费，不退款）。 */
    private hammerHit(target: Dessert): void {
        if (this.mode !== ItemMode.Hammer) return;
        if (target?.node?.isValid) target.node.destroy();
        this.clearHammerMode();
    }

    onShuffleClicked(): void {
        // 先检查容器与甜品数量，再扣费，避免无法洗牌却白扣 15 金币
        if (!this.containerNode) return;
        const desserts = this.containerNode.getComponentsInChildren(Dessert);
        if (desserts.length < 2) return;
        if (!this.state.spendGold(SHUFFLE_COST)) {
            this.showGuideBubble();
            return;
        }

        const positions = desserts.map(d => d.node.position.clone());
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        desserts.forEach((d, i) => {
            d.node.setPosition(positions[i]);
            const body = d.getComponent(RigidBody2D);
            if (body) {
                body.linearVelocity = Vec2.ZERO;
                body.angularVelocity = 0;
            }
        });
    }

    async onAdClicked(): Promise<void> {
        if (this.adInProgress) return;
        this.adInProgress = true;
        try {
            const success = await DouyinSDK.showRewardedAd(AD_UNIT_IDS.gameGold);
            if (success) {
                this.state.addGold(AD_GOLD_REWARD);
                Toast.show(`+${AD_GOLD_REWARD} 金币`, false, 'icon_coin');
            } else {
                Toast.show('广告君打了个盹，稍后再来~', true, 'icon_ad');
            }
        } finally {
            this.adInProgress = false;
        }
    }

    // --- 道具栏三态（金币购买制，无次数库存）---

    private updateButtonStates(): void {
        const afford = this.state.gold >= HAMMER_COST;
        this.decorateToolButton(this.btnHammer, HAMMER_COST, afford);
        this.decorateToolButton(this.btnShuffle, SHUFFLE_COST, afford);

        // 金币不足 → 广告按钮持续脉动；气泡只在「变为不足」那一刻闪 3 秒
        // （之后玩家再点锤子/洗牌会重新触发，见 onHammerClicked/onShuffleClicked）。
        // 首次体验保护：前 N 关不主动脉动/弹气泡（按钮仍可见可点）。
        const adGuideAllowed = this.state.currentRound > AD_PROTECTION_ROUNDS;
        if (!afford && this.btnAd?.active && adGuideAllowed) {
            if (this.prevAfford) this.showGuideBubble();
            this.startAdPulse();
        } else {
            this.stopAdPulse();
            if (afford) this.hideGuideBubble();
        }
        this.prevAfford = afford;
    }

    /**
     * 道具按钮三态外观：
     * A 可用（afford）：图标暖白、价格焦糖、无锁。
     * B 金币不足：图标转灰、价格转红、右上角锁徽标。
     */
    private decorateToolButton(btn: Node | null, cost: number, afford: boolean): void {
        if (!btn) return;

        // 图标去色/还原。注意：按钮底图 Base 也是 Sprite，必须按名字精确取 Icon，
        // 否则会把砂色底座染灰而非图标。
        const iconNode = btn.getChildByName('Icon');
        const icon = iconNode?.getComponent(Sprite)
            ?? btn.getComponentsInChildren(Sprite).find(s => s.node.name === 'Icon')
            ?? null;
        if (icon) {
            icon.color = afford ? TOKENS.white : TOKENS.inkMute;
        }

        // 价格挂签
        const priceLabel = this.ensureChildLabel(btn, 'PriceChip', -2, 22);
        priceLabel.string = `${cost}`;
        priceLabel.color = afford ? TOKENS.butterDp : TOKENS.pinkDp;
        priceLabel.node.setPosition(0, -38, 0);

        // 锁徽标（仅不足态）——线条锁图标（emoji 在真机字体下渲染不可控）
        const lock = this.ensureLockBadge(btn);
        lock.active = !afford;
    }

    /** 右上角锁徽标：白色小圆底 + icon_lock 线条图标（states.html A2 .tool__lock）。 */
    private ensureLockBadge(btn: Node): Node {
        let badge = btn.getChildByName('LockBadge');
        if (badge) return badge;
        badge = new Node('LockBadge');
        badge.layer = Layers.Enum.UI_2D;
        badge.parent = btn;
        badge.setPosition(34, 34, 0);
        badge.addComponent(UITransform).setContentSize(36, 36);
        const g = badge.addComponent(Graphics);
        g.fillColor = TOKENS.paper2;
        g.circle(0, 0, 18);
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = TOKENS.line2;
        g.circle(0, 0, 18);
        g.stroke();

        const icon = new Node('lockIcon');
        icon.layer = Layers.Enum.UI_2D;
        icon.parent = badge;
        icon.addComponent(UITransform).setContentSize(22, 22);
        const sp = icon.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = TOKENS.pinkDp;
        resources.load('textures/ui/icon_lock/spriteFrame', SpriteFrame, (err, f) => {
            if (!err && f && sp.isValid) sp.spriteFrame = f;
        });
        return badge;
    }

    private ensureChildLabel(parent: Node, name: string, _y: number, fontSize: number): Label {
        let node = parent.getChildByName(name);
        if (node) {
            return node.getComponent(Label) ?? node.addComponent(Label);
        }
        node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.addComponent(UITransform).setContentSize(48, fontSize + 6);
        const label = node.addComponent(Label);
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.isBold = true;
        applyInkOutline(label, 160, 2);
        GlobalFontManager.applyFont(node);
        return label;
    }

    private startAdPulse(): void {
        if (this.adPulse || !this.btnAd) return;
        this.btnAd.setScale(1, 1, 1);
        this.adPulse = tween(this.btnAd)
            .repeatForever(
                tween(this.btnAd)
                    .to(0.5, { scale: new Vec3(1.12, 1.12, 1) })
                    .to(0.5, { scale: new Vec3(1, 1, 1) })
            )
            .start();
    }

    /**
     * 深色引导气泡（states.html A2 .hint--down）：暗棕胶囊 + 下指小三角指向广告按钮，
     * 文案带实时余额「金币不足 X / 15 · 看广告 +10」。每次金币变化都会重进此方法刷新文案。
     */
    private showGuideBubble(): void {
        if (!this.btnAd) return;
        let bubble = this.btnAd.getChildByName('GuideBubble');
        if (!bubble) {
            bubble = new Node('GuideBubble');
            bubble.layer = Layers.Enum.UI_2D;
            bubble.parent = this.btnAd;
            // 气泡整体左移避免出屏，三角指回按钮中心（气泡本地 x=+75 即按钮正上方）
            bubble.setPosition(-75, 92, 0);
            bubble.addComponent(UITransform).setContentSize(330, 56);
            const g = bubble.addComponent(Graphics);
            g.fillColor = new Color(90, 70, 54, 240); // 与 Toast 同款暗棕
            g.roundRect(-165, -28, 330, 56, 18);
            g.fill();
            g.moveTo(59, -28);
            g.lineTo(75, -44);
            g.lineTo(91, -28);
            g.fill();

            const ln = new Node('t');
            ln.layer = Layers.Enum.UI_2D;
            ln.parent = bubble;
            ln.addComponent(UITransform).setContentSize(330, 56);
            const l = ln.addComponent(Label);
            l.fontSize = 22;
            l.lineHeight = 56;
            l.horizontalAlign = Label.HorizontalAlign.CENTER;
            l.verticalAlign = Label.VerticalAlign.CENTER;
            l.color = TOKENS.paper2;
            l.isBold = true;
            GlobalFontManager.applyFont(ln);
        }
        const label = bubble.getComponentInChildren(Label);
        if (label) label.string = `金币不足 ${this.state.gold} / ${HAMMER_COST} · 看广告 +10`;
        bubble.active = true;

        // 闪烁 3 秒后自动消失；期间再次触发则重新计时
        const op = bubble.getComponent(UIOpacity) ?? bubble.addComponent(UIOpacity);
        op.opacity = 255;
        if (this.bubbleBlink) this.bubbleBlink.stop();
        this.bubbleBlink = tween(op)
            .repeatForever(
                tween(op)
                    .to(0.4, { opacity: 110 })
                    .to(0.4, { opacity: 255 })
            )
            .start();
        this.unschedule(this.hideBubbleCb);
        this.scheduleOnce(this.hideBubbleCb, 3);
    }

    private hideGuideBubble(): void {
        this.unschedule(this.hideBubbleCb);
        if (this.bubbleBlink) {
            this.bubbleBlink.stop();
            this.bubbleBlink = null;
        }
        const bubble = this.btnAd?.getChildByName('GuideBubble');
        if (bubble) {
            const op = bubble.getComponent(UIOpacity);
            if (op) op.opacity = 255;
            bubble.active = false;
        }
    }

    private stopAdPulse(): void {
        if (this.adPulse) {
            this.adPulse.stop();
            this.adPulse = null;
        }
        if (this.btnAd) {
            this.btnAd.setScale(1, 1, 1);
        }
    }

    // --- 锤子选择模式 ---

    private enterHammerMode(): void {
        if (!this.containerNode) return;
        const ut = this.containerNode.getComponent(UITransform);
        const w = ut?.width || 400;
        const h = ut?.height || 600;

        const overlay = new Node('HammerOverlay');
        overlay.layer = Layers.Enum.UI_2D;
        overlay.parent = this.containerNode;
        overlay.setPosition(0, 0, 0);
        overlay.addComponent(UITransform).setContentSize(w, h);

        // 暗遮罩
        const mask = new Node('Mask');
        mask.layer = Layers.Enum.UI_2D;
        mask.parent = overlay;
        mask.addComponent(UITransform).setContentSize(w, h);
        const maskSprite = mask.addComponent(Sprite);
        maskSprite.color = new Color(40, 30, 24, 110);
        mask.addComponent(UIOpacity).opacity = 110;

        // 顶部提示条
        const hint = new Node('Hint');
        hint.layer = Layers.Enum.UI_2D;
        hint.parent = overlay;
        hint.setPosition(0, h / 2 - 28, 0);
        hint.addComponent(UITransform).setContentSize(w, 44);
        const hintLabel = hint.addComponent(Label);
        hintLabel.string = '点选一个甜品消除它';
        hintLabel.fontSize = 26;
        hintLabel.lineHeight = 44;
        hintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        hintLabel.verticalAlign = Label.VerticalAlign.CENTER;
        hintLabel.color = TOKENS.paper2;
        hintLabel.isBold = true;
        applyInkOutline(hintLabel, 200, 2);
        GlobalFontManager.applyFont(hint);

        // ✕ 取消（退还金币）—— 白色圆形图标按钮（states.html A3 .iconbtn）
        const cancel = new Node('Cancel');
        cancel.layer = Layers.Enum.UI_2D;
        cancel.parent = overlay;
        cancel.setPosition(w / 2 - 36, h / 2 - 36, 0);
        cancel.addComponent(UITransform).setContentSize(56, 56);
        const cg = cancel.addComponent(Graphics);
        cg.fillColor = TOKENS.paper2;
        cg.circle(0, 0, 26);
        cg.fill();
        cg.lineWidth = 2;
        cg.strokeColor = TOKENS.line2;
        cg.circle(0, 0, 26);
        cg.stroke();
        const cancelIcon = new Node('xicon');
        cancelIcon.layer = Layers.Enum.UI_2D;
        cancelIcon.parent = cancel;
        cancelIcon.addComponent(UITransform).setContentSize(26, 26);
        const csp = cancelIcon.addComponent(Sprite);
        csp.sizeMode = Sprite.SizeMode.CUSTOM;
        csp.color = TOKENS.ink;
        resources.load('textures/ui/icon_close/spriteFrame', SpriteFrame, (err, f) => {
            if (!err && f && csp.isValid) csp.spriteFrame = f;
        });
        cancel.on(Node.EventType.TOUCH_END, this.onHammerCancel, this);

        // 准星
        const cross = new Node('Crosshair');
        cross.layer = Layers.Enum.UI_2D;
        cross.parent = overlay;
        cross.addComponent(UITransform).setContentSize(40, 40);
        const crossLabel = cross.addComponent(Label);
        crossLabel.string = '✛';
        crossLabel.fontSize = 40;
        crossLabel.lineHeight = 40;
        crossLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        crossLabel.verticalAlign = Label.VerticalAlign.CENTER;
        crossLabel.color = TOKENS.pink;
        cross.active = false;

        // 命中高亮环（套在被瞄准的甜品上，对齐 states.html A3「点中的甜品高亮」）
        const ring = new Node('HitRing');
        ring.layer = Layers.Enum.UI_2D;
        ring.parent = overlay;
        ring.addComponent(UITransform).setContentSize(120, 120);
        ring.addComponent(Graphics);
        ring.active = false;

        this.hammerOverlay = overlay;
        this.crosshair = cross;
        this.highlightRing = ring;
    }

    private clearHammerMode(): void {
        this.containerNode?.off(Node.EventType.TOUCH_END, this.onContainerTap, this);
        this.containerNode?.off(Node.EventType.TOUCH_MOVE, this.onContainerMove, this);
        for (const { node, handler } of this.hammerTargets) {
            if (node.isValid) node.off(Node.EventType.TOUCH_END, handler);
        }
        this.hammerTargets = [];
        this.mode = ItemMode.None;
        this.state.events.emit('hammer-mode-changed', false);
        if (this.hammerOverlay?.isValid) this.hammerOverlay.destroy();
        this.hammerOverlay = null;
        this.crosshair = null;
        this.highlightRing = null;
    }

    private onHammerCancel(): void {
        // 退还 15 金币
        this.state.addGold(HAMMER_COST);
        this.clearHammerMode();
    }

    private onContainerMove(event: any): void {
        if (this.mode !== ItemMode.Hammer || !this.crosshair) return;
        const localPos = this.toContainerLocal(event);
        this.crosshair.active = true;
        this.crosshair.setPosition(localPos.x, localPos.y, 0);
        this.updateHitRing(localPos);
    }

    /** 找离触点最近的甜品（命中阈值 100）。 */
    private findClosestDessert(localPos: Vec3): Dessert | null {
        const desserts = this.containerNode!.getComponentsInChildren(Dessert);
        let closest: Dessert | null = null;
        let minDist = Infinity;
        for (const d of desserts) {
            const dist = Vec3.distance(d.node.position, localPos);
            if (dist < minDist) { minDist = dist; closest = d; }
        }
        return closest && minDist < 100 ? closest : null;
    }

    /** 把高亮环套到瞄准的甜品上；没瞄到则隐藏。 */
    private updateHitRing(localPos: Vec3): void {
        const ring = this.highlightRing;
        if (!ring?.isValid) return;
        const target = this.findClosestDessert(localPos);
        if (!target) { ring.active = false; return; }
        const r = (target.node.getComponent(UITransform)?.width ?? 80) / 2 + 8;
        const g = ring.getComponent(Graphics);
        if (g) {
            g.clear();
            g.lineWidth = 5;
            g.strokeColor = TOKENS.pink;
            g.circle(0, 0, r);
            g.stroke();
        }
        ring.setPosition(target.node.position.x, target.node.position.y, 0);
        ring.setSiblingIndex(ring.parent!.children.length - 1);
        ring.active = true;
    }

    private toContainerLocal(event: any): Vec3 {
        const containerTransform = this.containerNode!.getComponent(UITransform);
        if (containerTransform) {
            // 相机同源转换：与 DropController 同口径，准星/命中环贴合渲染位置
            return touchToNodeLocal(event, containerTransform);
        }
        const tapUIPos = event.getUILocation();
        return new Vec3(tapUIPos.x, tapUIPos.y, 0);
    }

    private onContainerTap(event: any): void {
        if (this.mode !== ItemMode.Hammer) return;

        const localPos = this.toContainerLocal(event);
        const closest = this.findClosestDessert(localPos);
        if (!closest) return; // 空击不消费：保持选择模式，玩家可继续点选或点 ✕ 退费取消

        closest.node.destroy();
        this.clearHammerMode();
    }
}
