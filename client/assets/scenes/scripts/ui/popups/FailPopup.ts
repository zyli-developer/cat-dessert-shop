import { _decorator, Component, Node, director } from 'cc';
import { PopupManager } from '../PopupManager';
import { DouyinSDK } from '../../platform/DouyinSDK';
import { POPUP_COLORS, drawRoundedRect, makeButton, makeLabel } from './PopupUIHelper';
const { ccclass, property } = _decorator;

export interface FailPopupData {
    score: number;
    round: number;
    onRevive: () => void;
}

@ccclass('FailPopup')
export class FailPopup extends Component {
    private data: FailPopupData | null = null;
    private hasRevived: boolean = false;

    init(data: FailPopupData): void {
        this.data = data;

        // 隐藏 prefab 中所有原有子节点
        for (const child of this.node.children) {
            child.active = false;
        }

        // 绘制弹窗背景
        drawRoundedRect(this.node, 480, 480, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 24);

        // 标题
        makeLabel(this.node, '挑战失败', 200, 42, POPUP_COLORS.btnDanger);

        // 分数
        makeLabel(this.node, '得分', 145, 22, POPUP_COLORS.textDim);
        makeLabel(this.node, `${data.score}`, 105, 48, POPUP_COLORS.textLight);

        // 按钮
        const btnRevive = makeButton(this.node, '看广告复活', 20, POPUP_COLORS.btnSuccess);
        btnRevive.on(Node.EventType.TOUCH_END, async () => {
            if (this.hasRevived) return;
            const success = await DouyinSDK.showRewardedAd('fail_revive');
            if (success) {
                this.hasRevived = true;
                PopupManager.close();
                this.data?.onRevive();
            }
        }, this);

        const btnRetry = makeButton(this.node, '重新开始', -60, POPUP_COLORS.btnPrimary);
        btnRetry.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Game');
        }, this);

        const btnHome = makeButton(this.node, '返回主页', -140, POPUP_COLORS.btnSecondary);
        btnHome.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Home');
        }, this);
    }
}
