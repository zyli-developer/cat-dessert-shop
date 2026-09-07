import {
    _decorator, Component, Node, Label, UITransform, Layers,
    Sprite, SpriteFrame, resources, Graphics, director, Color,
} from 'cc';
import { AudioManager } from '../utils/AudioManager';
import { TOKENS } from './DesignTokens';
import { drawRoundedRect, makeLabel, POPUP_COLORS } from './popups/PopupUIHelper';
import { GlobalFontManager } from './GlobalFontManager';
import { SafeArea } from '../platform/SafeArea';
import { showDeleteAccountDialog, showPrivacyPolicy, showUserAgreement } from './PrivacyPolicy';
const { ccclass } = _decorator;

const PANEL_W = 560;     // 面板宽（落在水平安全带 ±280 内）
const ROW_W = 524;       // 行宽
const ICON_X = -ROW_W / 2 + 41;        // 图标方块中心
const TEXT_X = ICON_X + 27 + 18;       // 标题/副标题左缘
const CTRL_X = ROW_W / 2 - 14;         // 右侧控件右缘基准

/**
 * 设置 —— 完整页面（独立 Scene，对齐 docs/ui-mockup/settings.html）。
 * 顶栏 返回(左) · 标题 · 探头猫，声音与触感 / 关于游戏两组面板 + 版本号页脚。
 * 运行时组装；左对齐文字用 anchorX=0 钉在左缘，避免居中文字覆盖图标。
 * 整页自顶向下随安全区基线流式排布，大胶囊机型也不互相重叠。
 */
@ccclass('SettingsScene')
export class SettingsScene extends Component {
    onLoad(): void {
        void GlobalFontManager.applyFontWhenReady(this.node);
        this.build();
    }

    private build(): void {
        this.buildPaperBg();

        const safe = SafeArea.get();
        const titleY = Math.min(548, (640 - safe.capsuleBottom) - 42);

        // 顶栏：返回（左）+ 标题 + 探头猫（右）
        this.buildHomeButton(-238, titleY);
        makeLabel(this.node, '设置', titleY, 44, POPUP_COLORS.textGold);
        this.makeSprite(this.node, 'textures/character/cat_orange_idle', 198, titleY - 6, 140);

        // 声音与触感
        const sec1Y = titleY - 100;
        this.buildSection('声音与触感', sec1Y);
        const p1 = this.buildPanel(sec1Y - 28 - 116, 232);
        this.buildToggleRow(p1, 74, 'icon_music', '背景音乐', '店内的治愈轻音乐',
            () => AudioManager.instance.isBGMEnabled(),
            (on) => AudioManager.instance.setBGMEnabled(on));
        this.buildToggleRow(p1, 0, 'icon_sound', '音效', '合成 / 完成订单音效',
            () => AudioManager.instance.isSFXEnabled(),
            (on) => AudioManager.instance.setSFXEnabled(on));
        this.buildToggleRow(p1, -74, 'icon_vibe', '震动反馈', '合成时轻轻一震',
            () => AudioManager.instance.isVibrationEnabled(),
            (on) => AudioManager.instance.setVibrationEnabled(on));

        // 关于游戏：不展示平台没有对应实现的「给个好评」按钮。
        const sec2Y = sec1Y - 28 - 232 - 44;
        this.buildSection('关于游戏', sec2Y);
        const p2 = this.buildPanel(sec2Y - 28 - 116, 232);
        this.buildLinkRow(p2, 74, 'icon_info', '隐私政策', '数据使用与权限说明',
            () => showPrivacyPolicy(this.node));
        this.buildLinkRow(p2, 0, 'icon_info', '用户协议', '服务内容与使用规则',
            () => showUserAgreement(this.node));
        this.buildLinkRow(p2, -74, 'icon_info', '删除账号数据', '永久删除云端及本机档案',
            () => showDeleteAccountDialog(this.node), TOKENS.danger);

        // 版本号（固定在底部，避让 Home 指示条）
        const ver = makeLabel(this.node, '一起开猫店 · 1.0.0', -(640 - 60 - safe.bottom), 24, POPUP_COLORS.textDim);
        ver.node.getComponent(UITransform)?.setContentSize(400, 32);
    }

    // --- 区块 ---

    private buildPaperBg(): void {
        const bg = new Node('PaperBg');
        bg.layer = Layers.Enum.UI_2D;
        bg.parent = this.node;
        bg.addComponent(UITransform).setContentSize(720, 1280);
        const g = bg.addComponent(Graphics);
        g.fillColor = TOKENS.paper;
        g.rect(-360, -640, 720, 1280);
        g.fill();
        bg.setSiblingIndex(0);
    }

    /** 分区小标题：粉点 + 左对齐文字。 */
    private buildSection(text: string, y: number): void {
        const dot = new Node('dot');
        dot.layer = Layers.Enum.UI_2D;
        dot.parent = this.node;
        dot.setPosition(-PANEL_W / 2 + 16, y, 0);
        dot.addComponent(UITransform).setContentSize(14, 14);
        const g = dot.addComponent(Graphics);
        g.fillColor = TOKENS.pink;
        g.circle(0, 0, 7);
        g.fill();

        this.leftLabel(this.node, text, -PANEL_W / 2 + 34, y, 26, POPUP_COLORS.textDim);
    }

    private buildPanel(y: number, h: number): Node {
        const panel = new Node('Panel');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = this.node;
        panel.setPosition(0, y, 0);
        panel.addComponent(UITransform).setContentSize(PANEL_W, h);
        drawRoundedRect(panel, PANEL_W, h, TOKENS.paper2, TOKENS.line, 2, 26);
        return panel;
    }

    private buildToggleRow(
        panel: Node, y: number, icon: string, title: string, sub: string,
        getEnabled: () => boolean, setEnabled: (on: boolean) => void,
    ): void {
        const row = this.buildRowBase(panel, y, icon, title, sub);

        const sw = new Node('Switch');
        sw.layer = Layers.Enum.UI_2D;
        sw.parent = row;
        sw.setPosition(CTRL_X - 52, 0, 0);
        sw.addComponent(UITransform).setContentSize(104, 56);
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

    private buildLinkRow(
        panel: Node, y: number, icon: string, title: string, sub: string,
        onTap: () => void, iconTint = TOKENS.ink,
    ): void {
        const row = this.buildRowBase(panel, y, icon, title, sub, iconTint);

        // 右侧圆形箭头（呼应设计稿 .go）
        const go = new Node('go');
        go.layer = Layers.Enum.UI_2D;
        go.parent = row;
        go.setPosition(CTRL_X - 26, 0, 0);
        go.addComponent(UITransform).setContentSize(52, 52);
        const gg = go.addComponent(Graphics);
        gg.fillColor = TOKENS.sand;
        gg.circle(0, 0, 26);
        gg.fill();
        const chev = new Node('chev');
        chev.layer = Layers.Enum.UI_2D;
        chev.parent = go;
        chev.addComponent(UITransform).setContentSize(52, 52);
        const cl = chev.addComponent(Label);
        cl.string = '›';
        cl.fontSize = 36;
        cl.lineHeight = 52;
        cl.horizontalAlign = Label.HorizontalAlign.CENTER;
        cl.verticalAlign = Label.VerticalAlign.CENTER;
        cl.color = TOKENS.inkSoft;
        cl.isBold = true;
        cl.isSystemFontUsed = true;

        row.on(Node.EventType.TOUCH_END, onTap, this);
    }

    /** 行公共部分：左侧图标方块 + 左对齐标题/副标题。 */
    private buildRowBase(panel: Node, y: number, icon: string, title: string, sub: string, iconTint = TOKENS.ink): Node {
        const row = new Node(`row_${title}`);
        row.layer = Layers.Enum.UI_2D;
        row.parent = panel;
        row.setPosition(0, y, 0);
        row.addComponent(UITransform).setContentSize(ROW_W, 64);

        // 图标方块
        const ico = new Node('ico');
        ico.layer = Layers.Enum.UI_2D;
        ico.parent = row;
        ico.setPosition(ICON_X, 0, 0);
        ico.addComponent(UITransform).setContentSize(54, 54);
        drawRoundedRect(ico, 54, 54, TOKENS.sand, undefined, 0, 16);
        const img = new Node('img');
        img.layer = Layers.Enum.UI_2D;
        img.parent = ico;
        img.addComponent(UITransform).setContentSize(30, 30);
        const sp = img.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = iconTint;
        resources.load(`textures/ui/${icon}/spriteFrame`, SpriteFrame, (e, f) => {
            if (!e && f && sp.isValid) sp.spriteFrame = f;
        });

        // 标题 + 副标题（左对齐，anchorX=0 钉在图标右侧，不会覆盖图标）
        this.leftLabel(row, title, TEXT_X, 13, 28, POPUP_COLORS.textLight);
        this.leftLabel(row, sub, TEXT_X, -15, 20, POPUP_COLORS.textDim);

        return row;
    }

    /** 左对齐标签：anchorX=0，节点 x 即文字左缘。 */
    private leftLabel(parent: Node, text: string, leftX: number, y: number, fontSize: number, color: Color): Label {
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
        GlobalFontManager.applyFont(node);
        return l;
    }

    private buildHomeButton(x: number, y: number): void {
        const btn = new Node('HomeButton');
        btn.layer = Layers.Enum.UI_2D;
        btn.parent = this.node;
        btn.setPosition(x, y, 0);
        btn.addComponent(UITransform).setContentSize(76, 76);
        const g = btn.addComponent(Graphics);
        g.fillColor = TOKENS.paper2;
        g.circle(0, 0, 36);
        g.fill();
        g.lineWidth = 2;
        g.strokeColor = TOKENS.line2;
        g.circle(0, 0, 36);
        g.stroke();
        this.makeSprite(btn, 'textures/ui/icon_home', 0, 0, 40, TOKENS.ink);
        btn.on(Node.EventType.TOUCH_END, () => director.loadScene('Home'), this);
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
}
