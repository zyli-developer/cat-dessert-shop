import {
    Node, UITransform, Label, Layers, Graphics, Color, BlockInputEvents, Sprite, SpriteFrame, resources,
} from 'cc';
import { TOKENS } from './DesignTokens';
import { drawRoundedRect, makeLabel, POPUP_COLORS } from './popups/PopupUIHelper';
import { GlobalFontManager } from './GlobalFontManager';

/**
 * 隐私政策正文（精简版，覆盖抖音上线所需的核心告知项）。
 * ⚠ 这是占位/通用文案，正式上线前请结合实际数据处理方式与法务确认，
 *   并与抖音开发者后台填写的隐私政策保持一致。
 */
const PRIVACY_TEXT = [
    '更新日期：2026-06-15',
    '',
    '我们重视你的隐私。本政策说明我们如何收集、使用和保护你的信息。',
    '',
    '【收集的信息】',
    '· 抖音昵称与头像：经你授权后获取，用于游戏内显示与排行榜。',
    '· 用户标识（openid）：用于识别账号、保存游戏进度。',
    '· 游戏数据：关卡、分数、星级、金币等存档信息。',
    '我们不收集手机号、通讯录、位置等与游戏无关的信息。',
    '',
    '【信息的使用】',
    '用于登录、存档、排行榜，以及激励视频广告奖励（广告由抖音平台提供）。',
    '我们不会出售你的个人信息或提供给无关第三方。',
    '',
    '【存储与保护】',
    '数据存于我们的服务器并采取合理安全措施，保留至你清除或删除账号。',
    '',
    '【第三方服务】',
    '本游戏运行于抖音小游戏平台，使用其登录/广告/分享能力，',
    '相关数据处理同时受抖音平台隐私政策约束。',
    '',
    '【你的权利】',
    '你可不授权昵称头像（不影响核心玩法），',
    '或通过抖音反馈渠道联系我们处理你的数据。',
    '',
    '本政策可能适时更新，更新后将在本页面公示。',
].join('\n');

/**
 * 弹出隐私政策全屏弹层（自带暖色遮罩 + 卡片 + 关闭）。
 * 场景版与弹窗版设置共用。挂到传入节点下，覆盖全屏、置顶。
 */
export function showPrivacyPolicy(anchor: Node): void {
    const root = new Node('PrivacyOverlay');
    root.layer = Layers.Enum.UI_2D;
    root.parent = anchor;
    root.setPosition(0, 0, 0);
    root.addComponent(UITransform).setContentSize(720, 1280);
    root.setSiblingIndex(anchor.children.length - 1); // 置顶

    // 暖色半透明遮罩（烘焙 alpha：抖音上 Graphics+UIOpacity 会变不透明，故直接写进 fillColor）
    const mask = root.addComponent(Graphics);
    mask.fillColor = new Color(74, 55, 40, 150);
    mask.rect(-360, -640, 720, 1280);
    mask.fill();
    root.addComponent(BlockInputEvents); // 吞掉点击，防止穿透到底层设置

    // 卡片
    const card = new Node('Card');
    card.layer = Layers.Enum.UI_2D;
    card.parent = root;
    card.setPosition(0, 0, 0);
    card.addComponent(UITransform).setContentSize(640, 1160);
    drawRoundedRect(card, 640, 1160, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 30);

    // 标题
    makeLabel(card, '隐私政策', 520, 40, POPUP_COLORS.textGold);

    // 正文（左对齐、自动撑高）
    const body = new Node('Body');
    body.layer = Layers.Enum.UI_2D;
    body.parent = card;
    const bodyUt = body.addComponent(UITransform);
    bodyUt.setContentSize(568, 10);
    bodyUt.setAnchorPoint(0.5, 1); // 顶部锚点，向下生长
    body.setPosition(0, 458, 0);
    const bl = body.addComponent(Label);
    bl.string = PRIVACY_TEXT;
    bl.fontSize = 19;
    bl.lineHeight = 27;
    bl.horizontalAlign = Label.HorizontalAlign.LEFT;
    bl.verticalAlign = Label.VerticalAlign.TOP;
    bl.overflow = Label.Overflow.RESIZE_HEIGHT;
    bl.color = POPUP_COLORS.textLight;
    GlobalFontManager.applyFont(body);

    // 关闭 ✕（右上）
    buildCloseButton(card, 270, 516, () => { if (root.isValid) root.destroy(); });

    // 底部「我知道了」按钮
    const ok = new Node('OkBtn');
    ok.layer = Layers.Enum.UI_2D;
    ok.parent = card;
    ok.setPosition(0, -512, 0);
    ok.addComponent(UITransform).setContentSize(320, 88);
    drawRoundedRect(ok, 320, 88, TOKENS.pink, undefined, 0, 24);
    const okLabel = makeLabel(ok, '我知道了', 0, 30, TOKENS.white);
    okLabel.node.setPosition(0, 0, 0);
    ok.on(Node.EventType.TOUCH_END, () => { if (root.isValid) root.destroy(); });
}

function buildCloseButton(parent: Node, x: number, y: number, onTap: () => void): void {
    const btn = new Node('Close');
    btn.layer = Layers.Enum.UI_2D;
    btn.parent = parent;
    btn.setPosition(x, y, 0);
    btn.addComponent(UITransform).setContentSize(72, 72);
    const g = btn.addComponent(Graphics);
    g.fillColor = TOKENS.paper2;
    g.circle(0, 0, 32);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = TOKENS.line2;
    g.circle(0, 0, 32);
    g.stroke();
    const ic = new Node('xicon');
    ic.layer = Layers.Enum.UI_2D;
    ic.parent = btn;
    ic.addComponent(UITransform).setContentSize(36, 36);
    const sp = ic.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.color = TOKENS.ink;
    resources.load('textures/ui/icon_close/spriteFrame', SpriteFrame, (e, f) => {
        if (!e && f && sp.isValid) sp.spriteFrame = f;
    });
    btn.on(Node.EventType.TOUCH_END, onTap);
}
