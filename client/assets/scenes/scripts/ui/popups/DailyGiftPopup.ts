import {
    _decorator, Component, Node, Label, UITransform, Layers, Sprite, SpriteFrame, resources, sys, tween, Vec3,
} from 'cc';
import { PopupManager } from '../PopupManager';
import { GameState } from '../../data/GameState';
import { DouyinSDK } from '../../platform/DouyinSDK';
import { TOKENS } from '../DesignTokens';
import { drawRoundedRect, makeButton, makeLabel, POPUP_COLORS } from './PopupUIHelper';
import { GlobalFontManager } from '../GlobalFontManager';
const { ccclass } = _decorator;

const BASE_REWARD = 20;
const DOUBLED_REWARD = 40;

/**
 * 每日礼包弹窗（PRD/审计 M3：每日免费 +20 猫币，看广告翻倍至 +40）。
 * 当前为客户端本地按日防重复（localStorage 日期键）；server-authoritative
 * 按 CST 0 点刷新留待后端 Phase5 接口落地后替换 claim 逻辑。
 */
@ccclass('DailyGiftPopup')
export class DailyGiftPopup extends Component {
    private amountLabel: Label | null = null;
    private btnClaim: Node | null = null;
    private btnDouble: Node | null = null;
    private claimedToday = false;

    init(): void {
        for (const child of this.node.children) child.active = false;
        GlobalFontManager.applyFont(this.node);

        this.claimedToday = sys.localStorage.getItem(this.todayKey()) === '1';

        drawRoundedRect(this.node, 500, 580, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 28);

        makeLabel(this.node, '每日礼包', 230, 42, POPUP_COLORS.textGold);
        makeLabel(this.node, '每天登录领猫币~', 180, 24, POPUP_COLORS.textDim);

        // 礼物 + 金币展示
        this.makeSprite(this.node, 'textures/ui/icon_gift', 0, 70, 132);
        this.makeSprite(this.node, 'textures/ui/icon_coin', -52, -40, 56);
        this.amountLabel = makeLabel(this.node, `+${BASE_REWARD}`, -40, 48, POPUP_COLORS.textGold);
        this.amountLabel.node.setPosition(34, -40, 0);

        // 领取按钮
        this.btnClaim = makeButton(this.node, this.claimedToday ? '今日已领取' : '领取 +20', -130, POPUP_COLORS.btnSuccess, 360, 78);
        this.btnClaim.on(Node.EventType.TOUCH_END, this.onClaim, this);

        // 看广告翻倍
        this.btnDouble = makeButton(this.node, '看广告，翻倍到 +40', -220, POPUP_COLORS.btnPrimary, 360, 70);
        this.btnDouble.on(Node.EventType.TOUCH_END, this.onDouble, this);

        if (this.claimedToday) this.lockButtons();

        this.buildClose(218, 248);
    }

    private todayKey(): string {
        const d = new Date();
        const ymd = `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`;
        return `daily_gift_${ymd}`;
    }

    private grant(amount: number): void {
        const profile = GameState.instance.userProfile;
        if (profile) {
            profile.catCoins += amount;
            GameState.instance.events.emit('profile-changed');
        }
        sys.localStorage.setItem(this.todayKey(), '1');
        this.claimedToday = true;
        if (this.amountLabel) {
            this.amountLabel.string = `+${amount}`;
            tween(this.amountLabel.node)
                .to(0.12, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'backOut' })
                .to(0.1, { scale: new Vec3(1, 1, 1) })
                .start();
        }
        this.lockButtons('已领取');
    }

    private onClaim(): void {
        if (this.claimedToday) return;
        this.grant(BASE_REWARD);
    }

    private async onDouble(): Promise<void> {
        if (this.claimedToday) return;
        const ok = await DouyinSDK.showRewardedAd('home_daily_gift');
        if (ok) this.grant(DOUBLED_REWARD);
    }

    private lockButtons(claimText = '今日已领取'): void {
        for (const btn of [this.btnClaim, this.btnDouble]) {
            if (!btn?.isValid) continue;
            const label = btn.getComponentInChildren(Label);
            if (label && btn === this.btnClaim) label.string = claimText;
            const sp = btn.getComponentInChildren(Sprite);
            if (sp) sp.grayscale = true;
        }
        if (this.btnDouble?.isValid) this.btnDouble.active = false;
    }

    private makeSprite(parent: Node, path: string, x: number, y: number, size: number): void {
        const node = new Node('Icon');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(size, size);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(`${path}/spriteFrame`, SpriteFrame, (err, frame) => {
            if (!err && frame && sp.isValid) sp.spriteFrame = frame;
        });
    }

    private buildClose(x: number, y: number): void {
        const btn = new Node('Close');
        btn.layer = Layers.Enum.UI_2D;
        btn.parent = this.node;
        btn.setPosition(x, y, 0);
        btn.addComponent(UITransform).setContentSize(64, 64);
        this.makeSprite(btn, 'textures/ui/icon_close', 0, 0, 40);
        const sp = btn.getComponentInChildren(Sprite);
        if (sp) sp.color = TOKENS.inkSoft;
        btn.on(Node.EventType.TOUCH_END, () => PopupManager.close(), this);
    }
}
