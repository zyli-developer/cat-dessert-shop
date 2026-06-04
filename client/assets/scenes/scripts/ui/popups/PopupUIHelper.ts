import { Node, UITransform, Graphics, Color, Label, Layers, Sprite, SpriteFrame, resources } from 'cc';
import { GlobalFontManager } from '../GlobalFontManager';
import {
    TOKENS, JELLY_VARIANTS, JellyVariantName, applyInkOutline,
} from '../DesignTokens';

/**
 * 果冻按钮贴图缓存 —— 用烘焙好的九宫格 PNG（含渐变面 + 顶高光 + 厚底）替代 Graphics 平涂，
 * 一处加载、所有弹窗按钮共享。未就绪时 buildJelly 自动回退到 Graphics（不阻塞）。
 */
const JELLY_FRAME_PATH: Record<JellyVariantName, string> = {
    primary: 'textures/ui/jelly_primary/spriteFrame',
    butter: 'textures/ui/jelly_butter/spriteFrame',
    mint: 'textures/ui/jelly_mint/spriteFrame',
    ghost: 'textures/ui/jelly_ghost/spriteFrame',
};
const JELLY_FRAMES: Partial<Record<JellyVariantName, SpriteFrame>> = {};
let _kitLoading: Promise<void> | null = null;

/** 预加载果冻贴图（PopupManager 在 init 前 await）。重复调用复用同一 Promise。 */
export function ensurePopupKit(): Promise<void> {
    if (_kitLoading) return _kitLoading;
    _kitLoading = Promise.all(
        (Object.keys(JELLY_FRAME_PATH) as JellyVariantName[]).map(
            (v) => new Promise<void>((resolve) => {
                resources.load(JELLY_FRAME_PATH[v], SpriteFrame, (err, frame) => {
                    if (!err && frame) JELLY_FRAMES[v] = frame;
                    resolve();
                });
            }),
        ),
    ).then(() => undefined);
    return _kitLoading;
}

/**
 * 弹窗配色 —— 治愈手绘烘焙风（纸感暖色）。
 * 保留旧 key 名以兼容现有调用方（WinPopup / FailPopup / PausePopup），
 * 但底层全部指向 DesignTokens 暖色板。按钮色仅作为「语义标记」，
 * 实际渲染交给果冻按钮变体（见 makeJellyButton）。
 */
export const POPUP_COLORS = {
    bg: TOKENS.paper2,          // 卡片象牙白底
    bgBorder: TOKENS.line2,     // 柔描边外圈
    btnPrimary: TOKENS.pink,    // 主 CTA → primary 变体
    btnSecondary: TOKENS.ghostFace, // 中性 → ghost 变体
    btnDanger: TOKENS.danger,   // 危险（多用于标题文字）
    btnSuccess: TOKENS.mint,    // 正向/广告 → mint 变体
    textLight: TOKENS.ink,      // 主文字（暖棕，纸底上）
    textGold: TOKENS.butterDp,  // 标题/金币高亮（焦糖）
    textDim: TOKENS.inkSoft,    // 次级文字
    starOn: TOKENS.star,        // 星星亮
    starOff: TOKENS.starOff,    // 星星暗
};

/** 按钮语义色 → 果冻变体映射（按 Color 引用匹配）。 */
const BUTTON_VARIANT: Array<[Color, JellyVariantName]> = [
    [POPUP_COLORS.btnPrimary, 'primary'],
    [POPUP_COLORS.btnSuccess, 'mint'],
    [POPUP_COLORS.btnSecondary, 'ghost'],
    [POPUP_COLORS.btnDanger, 'primary'],
];

function variantFor(c: Color): JellyVariantName {
    for (const [color, name] of BUTTON_VARIANT) {
        if (color === c) return name;
    }
    return 'primary';
}

/** 在节点上画圆角矩形背景 */
export function drawRoundedRect(
    node: Node, w: number, h: number,
    fillColor: Color, borderColor?: Color, borderWidth: number = 3, radius: number = 20
): void {
    let gfx = node.getComponent(Graphics);
    if (!gfx) gfx = node.addComponent(Graphics);
    gfx.clear();

    if (borderColor) {
        gfx.strokeColor = borderColor;
        gfx.lineWidth = borderWidth;
    }
    gfx.fillColor = fillColor;

    const x = -w / 2;
    const y = -h / 2;
    gfx.roundRect(x, y, w, h, radius);
    gfx.fill();
    if (borderColor) gfx.stroke();
}

/**
 * 在给定节点上搭建果冻按钮三层结构（Shadow 厚底 / Face 面色+顶高光 / Label）。
 * 节点需已挂到父级并设好 position。
 */
function buildJelly(btn: Node, text: string, variant: JellyVariantName, w: number, h: number): void {
    const v = JELLY_VARIANTS[variant];
    const radius = h / 2;

    let ut = btn.getComponent(UITransform);
    if (!ut) ut = btn.addComponent(UITransform);
    ut.setContentSize(w, h);

    const frame = JELLY_FRAMES[variant];
    const face = new Node('Face');
    face.layer = Layers.Enum.UI_2D;
    face.parent = btn;
    face.setPosition(0, 0, 0);
    face.addComponent(UITransform).setContentSize(w, h);

    if (frame) {
        // 烘焙贴图：单层九宫格已含渐变面 + 顶高光 + 厚底，无需 Shadow/TopHi
        const sp = face.addComponent(Sprite);
        sp.spriteFrame = frame;
        sp.type = Sprite.Type.SLICED;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
    } else {
        // 回退：Graphics 平涂（厚底 + 面 + 顶高光）
        const shadow = new Node('Shadow');
        shadow.layer = Layers.Enum.UI_2D;
        shadow.parent = btn;
        shadow.setPosition(0, -8, 0);
        shadow.setSiblingIndex(0);
        shadow.addComponent(UITransform).setContentSize(w, h);
        drawRoundedRect(shadow, w, h, v.shadow, undefined, 0, radius);

        drawRoundedRect(face, w, h, v.face, undefined, 0, radius);

        const hiH = Math.max(6, h * 0.42);
        const hi = new Node('TopHi');
        hi.layer = Layers.Enum.UI_2D;
        hi.parent = face;
        hi.addComponent(UITransform).setContentSize(w - 12, hiH);
        hi.setPosition(0, h / 2 - hiH / 2 - 4, 0);
        const hiColor = new Color(v.faceHi.r, v.faceHi.g, v.faceHi.b, 150);
        drawRoundedRect(hi, w - 12, hiH, hiColor, undefined, 0, hiH / 2);
    }

    // Label —— 文字（渲染在最上层）
    const labelNode = new Node('BtnLabel');
    labelNode.layer = Layers.Enum.UI_2D;
    labelNode.parent = face;
    labelNode.addComponent(UITransform).setContentSize(w, h);

    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 28;
    label.lineHeight = h;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = v.text;
    label.isBold = true;
    if (variant === 'ghost') {
        // 幽灵按钮暖棕字 + 砂色描边
        applyInkOutline(label, 200, 2);
    }
    GlobalFontManager.applyFont(labelNode);

    attachJellyPress(btn, face);
}

/** 按下整体下沉 6px（Face 下移盖住厚底），松开还原 —— 果冻"汁感"。 */
function attachJellyPress(btn: Node, face: Node): void {
    const baseY = face.position.y;
    const press = () => face.setPosition(0, baseY - 6, 0);
    const release = () => face.setPosition(0, baseY, 0);
    btn.on(Node.EventType.TOUCH_START, press);
    btn.on(Node.EventType.TOUCH_END, release);
    btn.on(Node.EventType.TOUCH_CANCEL, release);
}

/** 创建果冻按钮节点（三层结构 + 按下下沉）。 */
export function makeJellyButton(
    parent: Node, text: string, y: number,
    variant: JellyVariantName = 'primary', w: number = 320, h: number = 70
): Node {
    const btn = new Node(text);
    btn.layer = Layers.Enum.UI_2D;
    btn.parent = parent;
    btn.setPosition(0, y, 0);
    buildJelly(btn, text, variant, w, h);
    return btn;
}

/** 创建一个带文字的按钮节点（兼容旧签名，内部走果冻按钮）。 */
export function makeButton(
    parent: Node, text: string, y: number,
    bgColor: Color, w: number = 320, h: number = 70
): Node {
    return makeJellyButton(parent, text, y, variantFor(bgColor), w, h);
}

/** 创建文字标签 */
export function makeLabel(
    parent: Node, text: string, y: number,
    fontSize: number = 32, color: Color = POPUP_COLORS.textLight
): Label {
    const node = new Node('Label');
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.setPosition(0, y);

    node.addComponent(UITransform);

    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = color;
    applyInkOutline(label, 100, 2);

    // 应用全局字体
    GlobalFontManager.applyFont(node);

    return label;
}

/** 样式化已有的按钮节点（prefab 中的空 Sprite 按钮）→ 果冻按钮。 */
export function styleExistingButton(
    node: Node | null, text: string, bgColor: Color,
    w: number = 320, h: number = 70
): void {
    if (!node) return;
    buildJelly(node, text, variantFor(bgColor), w, h);
}

/** 样式化已有的 Label */
export function styleExistingLabel(
    label: Label | null, fontSize: number = 32,
    color: Color = POPUP_COLORS.textLight
): void {
    if (!label) return;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = color;
    label.isBold = true;
    applyInkOutline(label, 100, 2);

    // 应用全局字体
    GlobalFontManager.applyFont(label.node);
}
