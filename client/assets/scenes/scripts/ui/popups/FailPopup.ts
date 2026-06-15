import {
    _decorator, Component, Node, director, Layers, UITransform,
    Graphics, Sprite, SpriteFrame, resources, Label, Color,
} from 'cc';
import { PopupManager } from '../PopupManager';
import { DouyinSDK } from '../../platform/DouyinSDK';
import { AD_UNIT_IDS } from '../../platform/AdConfig';
import { Toast } from '../../utils/Toast';
import { TOKENS } from '../DesignTokens';
import { POPUP_COLORS, drawRoundedRect, makeJellyButton, makeLabel } from './PopupUIHelper';
const { ccclass } = _decorator;

export interface FailPopupData {
    score: number;
    round: number;
    /** 已完成订单数 */
    served: number;
    /** 本关订单总数 */
    total: number;
    onRevive: () => void;
}

/** 复活按钮上的爱心红（fail.html #C0364B） */
const HEART_RED = new Color(192, 54, 75, 255);

/**
 * 失败弹窗 —— 对齐 docs/ui-mockup/fail.html「今天先打烊啦」温柔口吻：
 * 探头猫 + 完成订单进度条 + 看广告复活（爱心 + 30s 角标）+ 返回首页 / 再试一次。
 * 运行时组装（隐藏 prefab 空壳子节点），与其余弹窗一致。
 */
@ccclass('FailPopup')
export class FailPopup extends Component {
    private data: FailPopupData | null = null;
    private hasRevived = false;

    init(data: FailPopupData): void {
        this.data = data;

        for (const child of this.node.children) child.active = false;

        const served = Math.max(0, Math.min(data.served, data.total));
        const remaining = Math.max(0, data.total - served);

        // 卡片背景
        drawRoundedRect(this.node, 600, 620, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 30);

        // 探头猫（白猫挥手 · 打烊）
        this.makeSprite(this.node, 'textures/character/cat_white_bye', 0, 316, 196);

        // 关闭（右上角圆形）→ 返回首页
        this.buildClose(252, 252);

        // 标题 + 副标题（标题用暖棕，对齐 fail.html 的 title-lg 默认色，温柔打烊不刺眼）
        makeLabel(this.node, '今天先打烊啦', 190, 56, TOKENS.ink);
        const sub = remaining > 0
            ? `还差 ${remaining} 位猫客的订单没做完~`
            : '就差一点点啦，再来一次~';
        makeLabel(this.node, sub, 136, 27, POPUP_COLORS.textDim);

        // 完成订单进度面板
        this.buildProgressPanel(44, served, data.total);

        // 看广告复活（清空上半区）—— mint + 爱心 + 30s 角标
        const btnRevive = makeJellyButton(this.node, '看广告，清空上半区复活', -94, 'mint', 520, 100);
        const reviveLabel = btnRevive.getComponentInChildren(Label);
        if (reviveLabel) reviveLabel.fontSize = 28; // 长文案，缩字号避免与爱心/角标挤压
        this.makeSprite(btnRevive, 'textures/ui/icon_heart', -212, 0, 32, HEART_RED);
        this.buildAdBadge(btnRevive, 208);
        btnRevive.on(Node.EventType.TOUCH_END, () => this.onReviveClicked(), this);

        // 底部：返回首页（幽灵）/ 再试一次（主，更宽 —— fail.html flex 1:1.3，主按钮权重更高）
        const back = makeJellyButton(this.node, '返回首页', -214, 'ghost', 218, 92);
        back.setPosition(-151, -214, 0);
        back.on(Node.EventType.TOUCH_END, this.onHome, this);

        const retry = makeJellyButton(this.node, '再试一次', -214, 'primary', 284, 92);
        retry.setPosition(118, -214, 0);
        retry.on(Node.EventType.TOUCH_END, this.onRetry, this);
    }

    // --- 区块 ---

    private buildProgressPanel(y: number, served: number, total: number): void {
        const panel = new Node('Progress');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = this.node;
        panel.setPosition(0, y, 0);
        panel.addComponent(UITransform).setContentSize(524, 120);
        drawRoundedRect(panel, 524, 120, TOKENS.sand, undefined, 0, 24);

        const cap = makeLabel(panel, '完成订单', 28, 26, POPUP_COLORS.textDim);
        cap.horizontalAlign = Label.HorizontalAlign.LEFT;
        cap.node.getComponent(UITransform)?.setContentSize(240, 34);
        cap.node.setPosition(-140, 28, 0);

        const cnt = makeLabel(panel, `${served} / ${total}`, 28, 32, TOKENS.pinkDp);
        cnt.horizontalAlign = Label.HorizontalAlign.RIGHT;
        cnt.node.getComponent(UITransform)?.setContentSize(200, 40);
        cnt.node.setPosition(150, 28, 0);

        // 进度条
        const bar = new Node('Bar');
        bar.layer = Layers.Enum.UI_2D;
        bar.parent = panel;
        bar.setPosition(0, -28, 0);
        bar.addComponent(UITransform).setContentSize(464, 18);
        const g = bar.addComponent(Graphics);
        const W = 464, H = 18, r = total > 0 ? served / total : 0;
        g.fillColor = TOKENS.sand2;
        g.roundRect(-W / 2, -H / 2, W, H, H / 2);
        g.fill();
        if (r > 0) {
            const fw = Math.max(H, W * r);
            g.fillColor = TOKENS.pink;
            g.roundRect(-W / 2, -H / 2, fw, H, H / 2);
            g.fill();
            // 上半叠一条 pink-hi 高光，模拟 fail.html 的 pink-hi→pink 竖向渐变
            const hiH = H / 2 - 3;
            g.fillColor = TOKENS.pinkHi;
            g.roundRect(-W / 2 + 3, 0, fw - 6, hiH, hiH / 2);
            g.fill();
        }
    }

    /** 复活按钮右侧「▶ 30s」浅色角标（对齐 fail.html badge-ad）。 */
    private buildAdBadge(btn: Node, x: number): void {
        const badge = new Node('AdBadge');
        badge.layer = Layers.Enum.UI_2D;
        badge.parent = btn;
        badge.setPosition(x, 0, 0);
        badge.addComponent(UITransform).setContentSize(86, 44);
        drawRoundedRect(badge, 86, 44, new Color(255, 255, 255, 110), undefined, 0, 22);
        this.makeSprite(badge, 'textures/ui/icon_play', -22, 0, 20, TOKENS.mintText);
        const l = makeLabel(badge, '30s', 0, 22, TOKENS.mintText);
        l.node.getComponent(UITransform)?.setContentSize(60, 44);
        l.node.setPosition(12, 0, 0);
    }

    private buildClose(x: number, y: number): void {
        const btn = new Node('Close');
        btn.layer = Layers.Enum.UI_2D;
        btn.parent = this.node;
        btn.setPosition(x, y, 0);
        btn.addComponent(UITransform).setContentSize(72, 72);
        const g = btn.addComponent(Graphics);
        g.fillColor = TOKENS.paper2;
        g.circle(0, 0, 34);
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = TOKENS.line2;
        g.circle(0, 0, 34);
        g.stroke();
        this.makeSprite(btn, 'textures/ui/icon_close', 0, 0, 40, TOKENS.ink);
        btn.on(Node.EventType.TOUCH_END, this.onHome, this);
    }

    /** 从 resources 加载贴图到一个子 Sprite 节点（tint 给定时染色）。 */
    private makeSprite(parent: Node, path: string, x: number, y: number, size: number, tint?: Color): void {
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

    // --- 回调 ---

    private async onReviveClicked(): Promise<void> {
        if (this.hasRevived) return;
        const success = await DouyinSDK.showRewardedAd(AD_UNIT_IDS.failRevive);
        if (!success) { Toast.show('广告君打了个盹，稍后再来~', true, 'icon_ad'); return; }
        this.hasRevived = true;
        PopupManager.close();
        this.data?.onRevive();
    }

    private onRetry(): void {
        PopupManager.closeImmediate();
        director.loadScene('Game');
    }

    private onHome(): void {
        PopupManager.closeImmediate();
        director.loadScene('Home');
    }
}
