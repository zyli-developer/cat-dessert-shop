import { _decorator, Component, Label, Node, director, tween, Vec3 } from 'cc';
import { PopupManager } from '../PopupManager';
import { GameState } from '../../data/GameState';
import { DouyinSDK } from '../../platform/DouyinSDK';
import {
    POPUP_COLORS, drawRoundedRect, makeButton, makeLabel
} from './PopupUIHelper';
const { ccclass, property } = _decorator;

@ccclass('WinPopup')
export class WinPopup extends Component {
    private data: any = null;
    private hasDoubled: boolean = false;
    private catCoinLabel: Label | null = null;
    private btnNext: Node | null = null;
    private btnAdDouble: Node | null = null;
    private btnShare: Node | null = null;
    private btnHome: Node | null = null;

    init(data: { stars: number; score: number; catCoins: number; round: number; isLastRound: boolean; onDoubled?: (bonus: number) => void }): void {
        this.data = data;

        // 隐藏 prefab 中所有原有子节点（都是空壳）
        for (const child of this.node.children) {
            child.active = false;
        }

        // 绘制弹窗背景
        drawRoundedRect(this.node, 560, 720, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 24);

        // 标题
        makeLabel(this.node, '关卡通过!', 320, 42, POPUP_COLORS.textGold);

        // 分数
        makeLabel(this.node, '得分', 270, 22, POPUP_COLORS.textDim);
        makeLabel(this.node, `${data.score}`, 230, 48, POPUP_COLORS.textLight);

        // 猫币
        makeLabel(this.node, '猫币', 185, 22, POPUP_COLORS.textDim);
        this.catCoinLabel = makeLabel(this.node, `+${data.catCoins}`, 150, 36, POPUP_COLORS.textGold);

        // 星级
        for (let i = 0; i < 3; i++) {
            const label = makeLabel(this.node, i < data.stars ? '★' : '☆', 80, 56,
                i < data.stars ? POPUP_COLORS.starOn : POPUP_COLORS.starOff);
            label.node.setPosition(-80 + i * 80, 80);
            if (i < data.stars) {
                label.enableOutline = true;
                label.outlineColor = POPUP_COLORS.bgBorder;
                label.outlineWidth = 2;
                label.node.setScale(0, 0, 1);
                tween(label.node)
                    .delay(0.3 + i * 0.3)
                    .to(0.2, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'backOut' })
                    .to(0.1, { scale: new Vec3(1, 1, 1) })
                    .start();
            }
        }

        // 主操作：非最后一关为「下一关 + 返回主页」并排；最后一关仅「返回主页」
        let btnY = -10;
        if (data.isLastRound) {
            this.btnHome = makeButton(this.node, '返回主页', btnY, POPUP_COLORS.btnSecondary, 320, 70);
            this.btnHome.on(Node.EventType.TOUCH_END, this.onHomeClicked, this);
        } else {
            this.btnNext = makeButton(this.node, '下一关', btnY, POPUP_COLORS.btnPrimary, 240, 68);
            this.btnNext.setPosition(-125, btnY);
            this.btnNext.on(Node.EventType.TOUCH_END, this.onNextClicked, this);

            this.btnHome = makeButton(this.node, '返回主页', btnY, POPUP_COLORS.btnSecondary, 240, 68);
            this.btnHome.setPosition(125, btnY);
            this.btnHome.on(Node.EventType.TOUCH_END, this.onHomeClicked, this);
        }

        btnY -= 88;
        this.btnAdDouble = makeButton(this.node, '看广告双倍猫币', btnY, POPUP_COLORS.btnSuccess);
        this.btnAdDouble.on(Node.EventType.TOUCH_END, this.onDoubleClicked, this);

        btnY -= 80;
        this.btnShare = makeButton(this.node, '分享给好友', btnY, POPUP_COLORS.btnSecondary);
        this.btnShare.on(Node.EventType.TOUCH_END, this.onShareClicked, this);
    }

    private onNextClicked(): void {
        GameState.instance.currentRound++;
        PopupManager.closeImmediate();
        director.loadScene('Game');
    }

    private onHomeClicked(): void {
        PopupManager.closeImmediate();
        director.loadScene('Home');
    }

    private async onDoubleClicked(): Promise<void> {
        if (this.hasDoubled) return;
        const success = await DouyinSDK.showRewardedAd('win_double');
        if (success) {
            this.hasDoubled = true;
            const bonus = this.data.catCoins;
            if (this.catCoinLabel) {
                this.catCoinLabel.string = `+${this.data.catCoins + bonus}`;
            }
            if (this.btnAdDouble) this.btnAdDouble.active = false;

            const profile = GameState.instance.userProfile;
            if (profile) {
                profile.catCoins += bonus;
            }
            this.data.onDoubled?.(bonus);
        }
    }

    private async onShareClicked(): Promise<void> {
        const { round, stars } = this.data;
        await DouyinSDK.share(
            `我在猫咪甜品店第 ${round} 关获得了 ${'⭐'.repeat(stars)}，快来挑战！`,
            '',
            `round=${round}&stars=${stars}`
        );
    }
}
