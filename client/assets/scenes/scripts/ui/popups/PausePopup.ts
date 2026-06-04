import { _decorator, Component, Node, Label, UITransform, Layers, director, sys } from 'cc';
import { PopupManager } from '../PopupManager';
import { POPUP_COLORS, drawRoundedRect, makeButton, makeLabel } from './PopupUIHelper';
import { TOKENS, applyInkOutline } from '../DesignTokens';
import { AudioManager } from '../../utils/AudioManager';
import { GlobalFontManager } from '../GlobalFontManager';
const { ccclass, property } = _decorator;

// 与 SettingsPopup 共用同一套持久化 key
const STORAGE_KEY_BGM = 'settings_bgm';
const STORAGE_KEY_SFX = 'settings_sfx';

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

        // 绘制弹窗背景（加高以容纳音乐/音效开关）
        drawRoundedRect(this.node, 420, 480, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 24);

        // 标题
        makeLabel(this.node, '暂停', 200, 42, POPUP_COLORS.textGold);

        // 音乐 / 音效 就地开关（PRD §6）
        this.createToggleRow(
            '音乐', 120,
            () => AudioManager.instance.isBGMEnabled(),
            (on) => {
                sys.localStorage.setItem(STORAGE_KEY_BGM, String(on));
                AudioManager.instance.setBGMEnabled(on);
            }
        );
        this.createToggleRow(
            '音效', 70,
            () => AudioManager.instance.isSFXEnabled(),
            (on) => {
                sys.localStorage.setItem(STORAGE_KEY_SFX, String(on));
                AudioManager.instance.setSFXEnabled(on);
            }
        );

        // 按钮
        const btnResume = makeButton(this.node, '继续游戏', -10, POPUP_COLORS.btnPrimary, 300);
        btnResume.on(Node.EventType.TOUCH_END, () => {
            PopupManager.close();
            this.data?.onResume();
        }, this);

        const btnRestart = makeButton(this.node, '重新开始', -90, POPUP_COLORS.btnSecondary, 300);
        btnRestart.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Game');
        }, this);

        const btnHome = makeButton(this.node, '返回主页', -170, POPUP_COLORS.btnSecondary, 300);
        btnHome.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Home');
        }, this);
    }

    /** 一行就地开关：左侧标签 + 右侧「开/关」胶囊，点整行切换。 */
    private createToggleRow(
        label: string, y: number,
        getEnabled: () => boolean, setEnabled: (on: boolean) => void
    ): void {
        const row = new Node(`Toggle_${label}`);
        row.layer = Layers.Enum.UI_2D;
        row.parent = this.node;
        row.setPosition(0, y, 0);
        row.addComponent(UITransform).setContentSize(300, 44);

        // 左侧名称
        const nameLabel = makeLabel(row, label, 0, 27, POPUP_COLORS.textLight);
        nameLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        nameLabel.node.setPosition(-110, 0, 0);
        nameLabel.node.getComponent(UITransform)?.setContentSize(120, 44);

        // 右侧状态胶囊
        const stateNode = new Node('State');
        stateNode.layer = Layers.Enum.UI_2D;
        stateNode.parent = row;
        stateNode.setPosition(100, 0, 0);
        stateNode.addComponent(UITransform).setContentSize(96, 44);
        const stateLabel = stateNode.addComponent(Label);
        stateLabel.fontSize = 25;
        stateLabel.lineHeight = 44;
        stateLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        stateLabel.verticalAlign = Label.VerticalAlign.CENTER;
        stateLabel.isBold = true;

        const render = () => {
            const on = getEnabled();
            stateLabel.string = on ? '开' : '关';
            stateLabel.color = on ? TOKENS.mintDp : TOKENS.inkMute;
            applyInkOutline(stateLabel, 120, 2);
        };
        render();
        GlobalFontManager.applyFont(stateNode);

        row.on(Node.EventType.TOUCH_END, () => {
            setEnabled(!getEnabled());
            render();
        }, this);
    }
}
