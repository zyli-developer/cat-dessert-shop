import {
    _decorator, Component, Node, Label, UITransform, Layers,
    Sprite, SpriteFrame, resources, Graphics, sys,
} from 'cc';
import { PopupManager } from '../PopupManager';
import { AudioManager } from '../../utils/AudioManager';
import { DouyinSDK } from '../../platform/DouyinSDK';
import { TOKENS } from '../DesignTokens';
import { drawRoundedRect, makeLabel, POPUP_COLORS } from './PopupUIHelper';
import { showPrivacyPolicy } from '../PrivacyPolicy';
const { ccclass } = _decorator;

// 与 PausePopup 共用同一套持久化 key
const STORAGE_KEY_BGM = 'settings_bgm';
const STORAGE_KEY_SFX = 'settings_sfx';
const STORAGE_KEY_VIBRATE = 'settings_vibration';

/**
 * 设置弹窗 —— 对齐 docs/ui-mockup/settings.html：
 *   声音与触感（背景音乐 / 音效 / 震动反馈 开关）
 *   帮助与反馈（联系客服 / 给个好评 / 隐私政策）
 *   版本号页脚
 * 运行时组装（隐藏 prefab 空壳子节点），与其余弹窗一致。
 * 旧版依赖 prefab @property Toggle，已弃用。
 */
@ccclass('SettingsPopup')
export class SettingsPopup extends Component {
    init(): void {
        for (const child of this.node.children) child.active = false;

        // 卡片背景
        drawRoundedRect(this.node, 600, 860, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 30);

        // 标题 + 关闭
        makeLabel(this.node, '设置', 372, 44, POPUP_COLORS.textGold);
        this.buildClose(252, 388);

        // 声音与触感
        this.buildSection('声音与触感', 300);
        const p1 = this.buildPanel(186, 210);
        this.buildToggleRow(p1, 62, 'icon_music', '背景音乐', '店内的治愈轻音乐',
            () => AudioManager.instance.isBGMEnabled(),
            (on) => {
                sys.localStorage.setItem(STORAGE_KEY_BGM, String(on));
                AudioManager.instance.setBGMEnabled(on);
            });
        this.buildToggleRow(p1, 0, 'icon_sound', '音效', '合成 / 完成订单音效',
            () => AudioManager.instance.isSFXEnabled(),
            (on) => {
                sys.localStorage.setItem(STORAGE_KEY_SFX, String(on));
                AudioManager.instance.setSFXEnabled(on);
            });
        this.buildToggleRow(p1, -62, 'icon_vibe', '震动反馈', '合成时轻轻一震',
            () => sys.localStorage.getItem(STORAGE_KEY_VIBRATE) === 'true',
            (on) => sys.localStorage.setItem(STORAGE_KEY_VIBRATE, String(on)));

        // 帮助与反馈（客服对纯广告变现游戏非必接，且 navigateToScene 仅支持 sidebar，
        // 故先隐藏「联系客服」，面板重排为两行）
        this.buildSection('帮助与反馈', 42);
        const p2 = this.buildPanel(-47, 148);
        this.buildLinkRow(p2, 37, 'icon_star', '给个好评', '喜欢的话鼓励一下~',
            () => void DouyinSDK.navigateToScene('feedback'), TOKENS.star);
        this.buildLinkRow(p2, -37, 'icon_info', '隐私政策', '数据使用与权限说明',
            () => showPrivacyPolicy(this.node));

        // 版本号
        const ver = makeLabel(this.node, '一起开猫店 · v1.0.0', -360, 22, POPUP_COLORS.textDim);
        ver.node.getComponent(UITransform)?.setContentSize(400, 30);
    }

    // --- 区块 ---

    private buildSection(text: string, y: number): void {
        const label = makeLabel(this.node, text, y, 24, POPUP_COLORS.textDim);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.node.getComponent(UITransform)?.setContentSize(300, 32);
        label.node.setPosition(-186, y, 0);

        // 前导粉色圆点
        const dot = new Node('dot');
        dot.layer = Layers.Enum.UI_2D;
        dot.parent = this.node;
        dot.setPosition(-262, y, 0);
        dot.addComponent(UITransform).setContentSize(12, 12);
        const g = dot.addComponent(Graphics);
        g.fillColor = TOKENS.pink;
        g.circle(0, 0, 6);
        g.fill();
    }

    private buildPanel(y: number, h: number): Node {
        const panel = new Node('Panel');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = this.node;
        panel.setPosition(0, y, 0);
        panel.addComponent(UITransform).setContentSize(520, h);
        drawRoundedRect(panel, 520, h, TOKENS.paper, TOKENS.line, 2, 24);
        return panel;
    }

    /** 一行：图标 + 标题/副标题 + 开关。 */
    private buildToggleRow(
        panel: Node, y: number, icon: string, title: string, sub: string,
        getEnabled: () => boolean, setEnabled: (on: boolean) => void,
    ): void {
        const row = this.buildRowBase(panel, y, icon, title, sub);

        const sw = new Node('Switch');
        sw.layer = Layers.Enum.UI_2D;
        sw.parent = row;
        sw.setPosition(206, 0, 0);
        sw.addComponent(UITransform).setContentSize(96, 52);
        const sp = sw.addComponent(Sprite);
        sp.type = Sprite.Type.SIMPLE;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;

        const apply = () => {
            const on = getEnabled();
            resources.load(`textures/ui/${on ? 'toggle_on' : 'toggle_off'}/spriteFrame`, SpriteFrame, (e, f) => {
                if (!e && f && sp.isValid) sp.spriteFrame = f;
            });
        };
        apply();
        sw.on(Node.EventType.TOUCH_END, () => { setEnabled(!getEnabled()); apply(); }, this);
    }

    /** 一行：图标 + 标题/副标题 + 右侧箭头，整行可点。 */
    private buildLinkRow(
        panel: Node, y: number, icon: string, title: string, sub: string,
        onTap: () => void, iconTint = TOKENS.ink,
    ): void {
        const row = this.buildRowBase(panel, y, icon, title, sub, iconTint);

        const chev = makeLabel(row, '›', 0, 40, POPUP_COLORS.textDim);
        chev.node.setPosition(214, 0, 0);
        chev.node.getComponent(UITransform)?.setContentSize(40, 50);
        chev.isSystemFontUsed = true; // 自定义子集字体可能缺 '›'，走系统字

        row.on(Node.EventType.TOUCH_END, onTap, this);
    }

    /** 行的公共部分：图标方块 + 标题 + 副标题。 */
    private buildRowBase(panel: Node, y: number, icon: string, title: string, sub: string, iconTint = TOKENS.ink): Node {
        const row = new Node(`row_${title}`);
        row.layer = Layers.Enum.UI_2D;
        row.parent = panel;
        row.setPosition(0, y, 0);
        row.addComponent(UITransform).setContentSize(500, 60);

        // 图标底座
        const ico = new Node('ico');
        ico.layer = Layers.Enum.UI_2D;
        ico.parent = row;
        ico.setPosition(-210, 0, 0);
        ico.addComponent(UITransform).setContentSize(52, 52);
        drawRoundedRect(ico, 52, 52, TOKENS.sand, undefined, 0, 16);
        const iconNode = new Node('img');
        iconNode.layer = Layers.Enum.UI_2D;
        iconNode.parent = ico;
        iconNode.addComponent(UITransform).setContentSize(30, 30);
        const sp = iconNode.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = iconTint;
        resources.load(`textures/ui/${icon}/spriteFrame`, SpriteFrame, (e, f) => {
            if (!e && f && sp.isValid) sp.spriteFrame = f;
        });

        const t = makeLabel(row, title, 12, 26, POPUP_COLORS.textLight);
        t.horizontalAlign = Label.HorizontalAlign.LEFT;
        t.node.getComponent(UITransform)?.setContentSize(300, 32);
        t.node.setPosition(-20, 12, 0);

        const s = makeLabel(row, sub, -16, 19, POPUP_COLORS.textDim);
        s.horizontalAlign = Label.HorizontalAlign.LEFT;
        s.node.getComponent(UITransform)?.setContentSize(320, 26);
        s.node.setPosition(-20, -16, 0);

        return row;
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
        const x2 = new Node('xicon');
        x2.layer = Layers.Enum.UI_2D;
        x2.parent = btn;
        x2.addComponent(UITransform).setContentSize(40, 40);
        const sp = x2.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = TOKENS.ink;
        resources.load('textures/ui/icon_close/spriteFrame', SpriteFrame, (e, f) => {
            if (!e && f && sp.isValid) sp.spriteFrame = f;
        });
        btn.on(Node.EventType.TOUCH_END, () => PopupManager.close(), this);
    }
}
