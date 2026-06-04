import {
    _decorator, Component, Node, Vec3, Vec2, RigidBody2D, UITransform,
    Sprite, Label, Layers, Color, tween, UIOpacity,
} from 'cc';
import { Dessert } from './Dessert';
import { GameState } from '../data/GameState';
import { DouyinSDK } from '../platform/DouyinSDK';
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

    /** 锤子选择模式临时节点（遮罩/提示条/准星/取消） */
    private hammerOverlay: Node | null = null;
    private crosshair: Node | null = null;
    private adPulse: any = null;

    onLoad(): void {
        // 前2关隐藏广告按钮
        if (this.btnAd && this.state.currentRound <= AD_PROTECTION_ROUNDS) {
            this.btnAd.active = false;
        }

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
        if (!this.state.spendGold(HAMMER_COST)) return;
        this.mode = ItemMode.Hammer;
        this.enterHammerMode();
        this.containerNode?.on(Node.EventType.TOUCH_END, this.onContainerTap, this);
        this.containerNode?.on(Node.EventType.TOUCH_MOVE, this.onContainerMove, this);
    }

    onShuffleClicked(): void {
        if (!this.state.spendGold(SHUFFLE_COST)) return;
        if (!this.containerNode) return;

        const desserts = this.containerNode.getComponentsInChildren(Dessert);
        if (desserts.length < 2) return;

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
        const success = await DouyinSDK.showRewardedAd('game_ad_gold');
        if (success) {
            this.state.addGold(AD_GOLD_REWARD);
        }
    }

    // --- 道具栏三态（金币购买制，无次数库存）---

    private updateButtonStates(): void {
        const afford = this.state.gold >= HAMMER_COST;
        this.decorateToolButton(this.btnHammer, HAMMER_COST, afford);
        this.decorateToolButton(this.btnShuffle, SHUFFLE_COST, afford);

        // 金币不足 → 广告按钮脉动引导；充足 → 停止
        if (!afford && this.btnAd?.active) {
            this.startAdPulse();
        } else {
            this.stopAdPulse();
        }
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
        const priceLabel = this.ensureChildLabel(btn, 'PriceChip', -2, 18);
        priceLabel.string = `${cost}`;
        priceLabel.color = afford ? TOKENS.butterDp : TOKENS.pinkDp;
        priceLabel.node.setPosition(0, -38, 0);

        // 锁徽标（仅不足态）
        const lock = this.ensureChildLabel(btn, 'LockBadge', 0, 22);
        lock.string = '🔒';
        lock.node.setPosition(32, 32, 0);
        lock.node.active = !afford;
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
        // 引导气泡指向看广告
        const bubble = this.ensureChildLabel(this.btnAd, 'GuideBubble', 0, 20);
        bubble.string = '金币不足，看广告 +10';
        bubble.color = TOKENS.paper2;
        bubble.node.getComponent(UITransform)?.setContentSize(260, 36);
        bubble.node.setPosition(0, 54, 0);
        bubble.node.active = true;
    }

    private stopAdPulse(): void {
        if (this.adPulse) {
            this.adPulse.stop();
            this.adPulse = null;
        }
        if (this.btnAd) {
            this.btnAd.setScale(1, 1, 1);
            const bubble = this.btnAd.getChildByName('GuideBubble');
            if (bubble) bubble.active = false;
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
        hintLabel.string = '点击要消除的甜品';
        hintLabel.fontSize = 26;
        hintLabel.lineHeight = 44;
        hintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        hintLabel.verticalAlign = Label.VerticalAlign.CENTER;
        hintLabel.color = TOKENS.paper2;
        hintLabel.isBold = true;
        applyInkOutline(hintLabel, 200, 2);
        GlobalFontManager.applyFont(hint);

        // ✕ 取消（退还金币）
        const cancel = new Node('Cancel');
        cancel.layer = Layers.Enum.UI_2D;
        cancel.parent = overlay;
        cancel.setPosition(w / 2 - 30, h / 2 - 28, 0);
        cancel.addComponent(UITransform).setContentSize(48, 48);
        const cancelLabel = cancel.addComponent(Label);
        cancelLabel.string = '✕';
        cancelLabel.fontSize = 34;
        cancelLabel.lineHeight = 48;
        cancelLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        cancelLabel.verticalAlign = Label.VerticalAlign.CENTER;
        cancelLabel.color = TOKENS.paper2;
        cancelLabel.isBold = true;
        applyInkOutline(cancelLabel, 200, 2);
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

        this.hammerOverlay = overlay;
        this.crosshair = cross;
    }

    private clearHammerMode(): void {
        this.containerNode?.off(Node.EventType.TOUCH_END, this.onContainerTap, this);
        this.containerNode?.off(Node.EventType.TOUCH_MOVE, this.onContainerMove, this);
        this.mode = ItemMode.None;
        if (this.hammerOverlay?.isValid) this.hammerOverlay.destroy();
        this.hammerOverlay = null;
        this.crosshair = null;
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
    }

    private toContainerLocal(event: any): Vec3 {
        const tapUIPos = event.getUILocation();
        const containerTransform = this.containerNode!.getComponent(UITransform);
        return containerTransform
            ? containerTransform.convertToNodeSpaceAR(new Vec3(tapUIPos.x, tapUIPos.y, 0))
            : new Vec3(tapUIPos.x, tapUIPos.y, 0);
    }

    private onContainerTap(event: any): void {
        if (this.mode !== ItemMode.Hammer) return;

        const localPos = this.toContainerLocal(event);

        const desserts = this.containerNode!.getComponentsInChildren(Dessert);
        let closest: Dessert | null = null;
        let minDist = Infinity;

        for (const d of desserts) {
            const dist = Vec3.distance(d.node.position, localPos);
            if (dist < minDist) {
                minDist = dist;
                closest = d;
            }
        }

        if (closest && minDist < 100) {
            closest.node.destroy();
        }

        // 命中或空击都退出锤子模式（不退还，已消费）
        this.clearHammerMode();
    }
}
