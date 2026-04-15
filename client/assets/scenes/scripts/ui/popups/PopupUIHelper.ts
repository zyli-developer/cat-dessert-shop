import { Node, UITransform, Graphics, Color, Label, Layers } from 'cc';
import { GlobalFontManager } from '../GlobalFontManager';

/** 配色方案 */
export const POPUP_COLORS = {
    bg: new Color(58, 46, 63, 245),          // 深紫灰
    bgBorder: new Color(255, 200, 120, 255),  // 金色边框
    btnPrimary: new Color(255, 160, 60, 255), // 橙色按钮
    btnSecondary: new Color(120, 100, 160, 255), // 紫灰按钮
    btnDanger: new Color(220, 80, 80, 255),   // 红色按钮
    btnSuccess: new Color(80, 190, 120, 255), // 绿色按钮
    textLight: new Color(255, 255, 240, 255), // 暖白文字
    textGold: new Color(255, 220, 100, 255),  // 金色文字
    textDim: new Color(180, 170, 200, 255),   // 淡紫灰文字
    starOn: new Color(255, 210, 60, 255),     // 星星亮
    starOff: new Color(80, 70, 90, 255),      // 星星暗
};

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

/** 创建一个带文字的按钮节点 */
export function makeButton(
    parent: Node, text: string, y: number,
    bgColor: Color, w: number = 320, h: number = 70
): Node {
    const btn = new Node(text);
    btn.layer = Layers.Enum.UI_2D;
    btn.parent = parent;
    btn.setPosition(0, y);

    const ut = btn.addComponent(UITransform);
    ut.setContentSize(w, h);

    // 背景画在按钮节点上
    drawRoundedRect(btn, w, h, bgColor, undefined, 0, h / 2);

    // 文字放在子节点上，渲染在 Graphics 之上
    const labelNode = new Node('BtnLabel');
    labelNode.layer = Layers.Enum.UI_2D;
    labelNode.parent = btn;

    const labelUT = labelNode.addComponent(UITransform);
    labelUT.setContentSize(w, h);

    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 28;
    label.lineHeight = h;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = POPUP_COLORS.textLight;
    label.isBold = true;
    label.enableOutline = true;
    label.outlineColor = new Color(0, 0, 0, 120);
    label.outlineWidth = 2;

    // 应用全局字体
    GlobalFontManager.applyFont(labelNode);

    return btn;
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
    label.enableOutline = true;
    label.outlineColor = new Color(0, 0, 0, 100);
    label.outlineWidth = 2;

    // 应用全局字体
    GlobalFontManager.applyFont(node);

    return label;
}

/** 样式化已有的按钮节点（prefab 中的空 Sprite 按钮） */
export function styleExistingButton(
    node: Node | null, text: string, bgColor: Color,
    w: number = 320, h: number = 70
): void {
    if (!node) return;

    const ut = node.getComponent(UITransform);
    if (ut) ut.setContentSize(w, h);

    drawRoundedRect(node, w, h, bgColor, undefined, 0, h / 2);

    // 文字放在子节点上，渲染在 Graphics 之上
    const labelNode = new Node('BtnLabel');
    labelNode.layer = Layers.Enum.UI_2D;
    labelNode.parent = node;

    const labelUT = labelNode.addComponent(UITransform);
    labelUT.setContentSize(w, h);

    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 28;
    label.lineHeight = h;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = POPUP_COLORS.textLight;
    label.isBold = true;
    label.enableOutline = true;
    label.outlineColor = new Color(0, 0, 0, 120);
    label.outlineWidth = 2;

    // 应用全局字体
    GlobalFontManager.applyFont(labelNode);
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
    label.enableOutline = true;
    label.outlineColor = new Color(0, 0, 0, 100);
    label.outlineWidth = 2;

    // 应用全局字体
    GlobalFontManager.applyFont(label.node);
}
