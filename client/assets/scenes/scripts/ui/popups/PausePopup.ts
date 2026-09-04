import {
    _decorator, Component, Node, Label, UITransform, Layers,
    Sprite, SpriteFrame, resources, director, Color,
} from 'cc';
import { PopupManager } from '../PopupManager';
import { POPUP_COLORS, drawRoundedRect, makeJellyButton, makeLabel } from './PopupUIHelper';
import { TOKENS } from '../DesignTokens';
import { AudioManager } from '../../utils/AudioManager';
import { GlobalFontManager } from '../GlobalFontManager';
const { ccclass } = _decorator;

export interface PausePopupData {
    onResume: () => void;
}

/**
 * 暂停弹窗 —— 对齐 docs/ui-mockup/states.html §C「休息一下～」：
 * 探头猫 + 音乐/音效开关（果冻胶囊开关）+ 继续游戏（主）+ 重新开始/主页（幽灵两连）。
 * 运行时组装，开关样式 / 果冻按钮与设置页一致。
 */
@ccclass('PausePopup')
export class PausePopup extends Component {
    private data: PausePopupData | null = null;

    init(data: PausePopupData): void {
        this.data = data;
        for (const child of this.node.children) child.active = false;

        // 卡片
        drawRoundedRect(this.node, 560, 480, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 30);

        // 探头猫与标题分栏，避免角色插画压住标题。
        this.makeSprite(this.node, 'textures/character/cat_white_idle', -188, 202, 118);
        const title = makeLabel(this.node, '休息一下~', 196, 38, POPUP_COLORS.textGold);
        title.node.setPosition(46, 196, 0);

        // 音乐 / 音效 开关
        this.buildToggleRow('音乐', 'icon_music', 108,
            () => AudioManager.instance.isBGMEnabled(),
            (on) => AudioManager.instance.setBGMEnabled(on));
        this.buildToggleRow('音效', 'icon_sound', 36,
            () => AudioManager.instance.isSFXEnabled(),
            (on) => AudioManager.instance.setSFXEnabled(on));

        // 继续游戏（主按钮）
        const resume = makeJellyButton(this.node, '继续游戏', -68, 'primary', 480, 84);
        resume.on(Node.EventType.TOUCH_END, () => {
            PopupManager.close();
            this.data?.onResume();
        }, this);

        // 重新开始 / 主页（幽灵两连）
        const restart = makeJellyButton(this.node, '重新开始', -176, 'ghost', 240, 78);
        restart.setPosition(-128, -176, 0);
        this.addBtnIcon(restart, 'icon_restart', -82);
        restart.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Game');
        }, this);

        const home = makeJellyButton(this.node, '主页', -176, 'ghost', 240, 78);
        home.setPosition(128, -176, 0);
        this.addBtnIcon(home, 'icon_home', -64);
        home.on(Node.EventType.TOUCH_END, () => {
            PopupManager.closeImmediate();
            director.loadScene('Home');
        }, this);
    }

    /** 一行开关：纸底圆角行 + 图标 + 标签（左）+ 胶囊开关（右）。 */
    private buildToggleRow(
        label: string, icon: string, y: number,
        getEnabled: () => boolean, setEnabled: (on: boolean) => void,
    ): void {
        const row = new Node(`row_${label}`);
        row.layer = Layers.Enum.UI_2D;
        row.parent = this.node;
        row.setPosition(0, y, 0);
        row.addComponent(UITransform).setContentSize(480, 62);
        drawRoundedRect(row, 480, 62, TOKENS.paper, TOKENS.line, 2, 18);

        this.makeSprite(row, `textures/ui/${icon}`, -200, 0, 34, TOKENS.ink);
        this.leftLabel(row, label, -162, 0, 28, POPUP_COLORS.textLight);

        const sw = new Node('Switch');
        sw.layer = Layers.Enum.UI_2D;
        sw.parent = row;
        sw.setPosition(188, 0, 0);
        sw.addComponent(UITransform).setContentSize(96, 52);
        const sp = sw.addComponent(Sprite);
        sp.type = Sprite.Type.SIMPLE;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        const apply = (): void => {
            const on = getEnabled();
            resources.load(`textures/ui/${on ? 'toggle_on' : 'toggle_off'}/spriteFrame`, SpriteFrame, (e, f) => {
                if (!e && f && sp.isValid) sp.spriteFrame = f;
            });
        };
        apply();
        sw.on(Node.EventType.TOUCH_END, () => { setEnabled(!getEnabled()); apply(); }, this);
    }

    /** 给果冻按钮左侧加一枚图标（按钮文字仍居中，图标靠左）。 */
    private addBtnIcon(btn: Node, icon: string, x: number): void {
        this.makeSprite(btn, `textures/ui/${icon}`, x, 0, 30, TOKENS.ink);
    }

    /** 左对齐标签：anchorX=0，节点 x 即文字左缘（避免居中文字覆盖图标）。 */
    private leftLabel(parent: Node, text: string, leftX: number, y: number, fontSize: number, color: Color): void {
        const node = new Node('L');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        const ut = node.addComponent(UITransform);
        ut.setAnchorPoint(0, 0.5);
        node.setPosition(leftX, y, 0);
        const l = node.addComponent(Label);
        l.string = text;
        l.fontSize = fontSize;
        l.lineHeight = fontSize + 6;
        l.horizontalAlign = Label.HorizontalAlign.LEFT;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = color;
        l.isBold = true;
        GlobalFontManager.applyFont(node);
    }

    /** 从 resources 加载贴图到一个子 Sprite（tint 给定时染色）。 */
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
}
