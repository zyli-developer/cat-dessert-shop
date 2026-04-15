import { _decorator, Component, Node, director } from 'cc';
import { PopupManager } from '../PopupManager';
import { POPUP_COLORS, drawRoundedRect, makeButton, makeLabel } from './PopupUIHelper';
const { ccclass, property } = _decorator;

export interface PausePopupData {
    onResume: () => void;
}

@ccclass('PausePopup')
export class PausePopup extends Component {
    private data: PausePopupData | null = null;

    init(data: PausePopupData): void {
        this.data = data;

        // 隐藏 prefab 中所有原有子节点
        for (const child of this.node.children) {
            child.active = false;
        }

        // 绘制弹窗背景
        drawRoundedRect(this.node, 420, 400, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 24);

        // 标题
        makeLabel(this.node, '暂停', 160, 42, POPUP_COLORS.textGold);

        // 按钮
        const btnResume = makeButton(this.node, '继续游戏', 50, POPUP_COLORS.btnPrimary, 300);
        btnResume.on(Node.EventType.TOUCH_END, () => {
            PopupManager.close();
            this.data?.onResume();
        }, this);

        const btnRestart = makeButton(this.node, '重新开始', -30, POPUP_COLORS.btnSecondary, 300);
        btnRestart.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Game');
        }, this);

        const btnHome = makeButton(this.node, '返回主页', -110, POPUP_COLORS.btnSecondary, 300);
        btnHome.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Home');
        }, this);
    }
}
