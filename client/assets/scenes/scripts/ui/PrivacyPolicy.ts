import {
    Node, UITransform, Label, Layers, Graphics, Color, BlockInputEvents, Sprite, SpriteFrame, resources,
    sys, director,
} from 'cc';
import { TOKENS } from './DesignTokens';
import { drawRoundedRect, makeJellyButton, makeLabel, POPUP_COLORS } from './popups/PopupUIHelper';
import { GlobalFontManager } from './GlobalFontManager';
import { ApiClient } from '../net/ApiClient';
import { GameState } from '../data/GameState';

export const PRIVACY_CONSENT_VERSION = '2026-09-02';
const PRIVACY_CONSENT_KEY = 'catbakery_privacy_consent_v1';

/**
 * 上线版隐私政策。后台提交的隐私政策必须与此处逐项保持一致。
 */
const PRIVACY_TEXT = [
    '更新日期：2026-09-02　生效日期：2026-09-02',
    '开发者：李震宇',
    '',
    '我们重视你的隐私。本政策说明《一起开猫店》如何处理你的信息。',
    '',
    '【收集的信息】',
    '· 账号标识（OpenID）：你同意后，通过抖音登录能力取得，用于识别账号。',
    '· 游戏数据：关卡、分数、星级、猫币、奖励领取记录，用于存档与排行榜。',
    '当前版本不会主动获取你的抖音昵称、头像、手机号、通讯录或位置。',
    '',
    '【使用与共享】',
    '信息仅用于账号登录、云端存档、排行榜、防止奖励重复领取及故障排查。',
    '登录、激励视频、分享由抖音平台提供；除依法要求外，我们不会出售、',
    '出租或向无关第三方提供你的信息。排行榜仅展示游戏默认昵称与成绩。',
    '',
    '【存储与保护】',
    '在线数据通过 HTTPS 传输并存储于中国境内服务器，保留至你主动删除。',
    '删除后将从业务数据库移除；法律法规要求继续保存的除外。',
    '',
    '【你的权利】',
    '你可以拒绝本政策并使用离线模式，此时不会调用抖音登录或上传存档。',
    '你可在“设置－关于游戏－删除账号数据”删除云端资料和本机相关记录。',
    '如需查询、更正或投诉，可通过抖音小游戏反馈渠道，或发送邮件至',
    'lizhenyu0613@126.com 联系开发者李震宇；我们将在合理期限内处理。',
    '',
    '【未成年人】',
    '未成年人应在监护人指导下阅读并决定是否同意。我们不主动收集年龄、',
    '身份证等信息。政策发生实质变更时，我们会重新征求你的同意。',
].join('\n');

const USER_AGREEMENT_TEXT = [
    '更新日期：2026-09-02　开发者：李震宇',
    '',
    '欢迎使用《一起开猫店》。开始使用前，请阅读并同意本协议。',
    '',
    '【服务内容】',
    '本游戏提供甜品合成、关卡、排行榜、分享和激励视频奖励等功能。',
    '你可拒绝联网登录并使用离线模式；离线进度不会跨设备同步。',
    '',
    '【使用规则】',
    '请勿利用游戏实施违法活动、攻击服务、篡改数据、作弊，或发布侵犯',
    '他人权益的内容。违反规则时，我们可依法限制相关账号使用。',
    '',
    '【虚拟奖励与广告】',
    '猫币、金币及道具仅用于游戏体验，不具备现金价值，不支持交易或提现。',
    '激励视频由用户主动选择观看；完整观看后按页面说明发放对应奖励。',
    '',
    '【服务变更与中断】',
    '因维护、网络或不可抗力导致服务暂时不可用时，游戏会提供离线入口。',
    '重大变更将通过游戏内说明或平台通知告知。',
    '',
    '【账号与数据】',
    '联网存档与抖音平台账号标识关联。你可在设置中删除账号数据；删除后',
    '云端进度不可恢复，再次登录会创建新的游戏档案。',
    '',
    '【知识产权与联系】',
    '游戏程序、界面和自有素材受法律保护。问题或投诉请通过抖音小游戏',
    '反馈渠道或 lizhenyu0613@126.com 联系开发者李震宇。',
    '本协议适用中华人民共和国法律。',
].join('\n');

export function hasPrivacyConsent(): boolean {
    return sys.localStorage.getItem(PRIVACY_CONSENT_KEY) === PRIVACY_CONSENT_VERSION;
}

export function acceptPrivacyConsent(): void {
    sys.localStorage.setItem(PRIVACY_CONSENT_KEY, PRIVACY_CONSENT_VERSION);
}

export function revokePrivacyConsent(): void {
    sys.localStorage.removeItem(PRIVACY_CONSENT_KEY);
}

/**
 * 弹出隐私政策全屏弹层（自带暖色遮罩 + 卡片 + 关闭）。
 * 场景版与弹窗版设置共用。挂到传入节点下，覆盖全屏、置顶。
 */
export function showPrivacyPolicy(anchor: Node): void {
    showLegalDocument(anchor, 'PrivacyOverlay', '隐私政策', PRIVACY_TEXT);
}

export function showUserAgreement(anchor: Node): void {
    showLegalDocument(anchor, 'UserAgreementOverlay', '用户协议', USER_AGREEMENT_TEXT);
}

function showLegalDocument(anchor: Node, nodeName: string, title: string, content: string): void {
    const existing = anchor.getChildByName(nodeName);
    if (existing?.isValid) return;

    const root = new Node(nodeName);
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
    makeLabel(card, title, 520, 40, POPUP_COLORS.textGold);

    // 正文（左对齐、自动撑高）
    const body = new Node('Body');
    body.layer = Layers.Enum.UI_2D;
    body.parent = card;
    const bodyUt = body.addComponent(UITransform);
    bodyUt.setContentSize(568, 10);
    bodyUt.setAnchorPoint(0.5, 1); // 顶部锚点，向下生长
    body.setPosition(0, 458, 0);
    const bl = body.addComponent(Label);
    bl.string = content;
    bl.fontSize = 18;
    bl.lineHeight = 24;
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

/** 用户主动触发的数据删除确认。成功后清理云端账号、本机档案和授权记录。 */
export function showDeleteAccountDialog(anchor: Node): void {
    if (anchor.getChildByName('DeleteAccountDialog')) return;

    const root = new Node('DeleteAccountDialog');
    root.layer = Layers.Enum.UI_2D;
    root.parent = anchor;
    root.addComponent(UITransform).setContentSize(720, 1280);
    root.setSiblingIndex(anchor.children.length - 1);
    root.addComponent(BlockInputEvents);
    const mask = root.addComponent(Graphics);
    mask.fillColor = new Color(74, 55, 40, 170);
    mask.rect(-360, -640, 720, 1280);
    mask.fill();

    const card = new Node('Card');
    card.layer = Layers.Enum.UI_2D;
    card.parent = root;
    card.addComponent(UITransform).setContentSize(600, 520);
    drawRoundedRect(card, 600, 520, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 30);
    makeLabel(card, '删除账号数据？', 170, 40, TOKENS.danger);
    const body = makeLabel(
        card,
        '云端关卡、分数、猫币和奖励记录将永久删除，\n本机离线档案与待同步记录也会清除。\n此操作不可撤销。',
        58,
        24,
        POPUP_COLORS.textLight,
    );
    body.lineHeight = 38;
    body.overflow = Label.Overflow.RESIZE_HEIGHT;
    body.node.getComponent(UITransform)?.setContentSize(520, 130);

    const cancel = makeJellyButton(card, '取消', -92, 'ghost', 220, 82);
    cancel.setPosition(-125, -92, 0);
    cancel.on(Node.EventType.TOUCH_END, () => root.isValid && root.destroy());

    const confirm = makeJellyButton(card, '永久删除', -92, 'primary', 220, 82);
    confirm.setPosition(125, -92, 0);
    confirm.on(Node.EventType.TOUCH_END, async () => {
        if (!confirm.active) return;
        confirm.active = false;
        try {
            const openId = ApiClient.getOpenId();
            await ApiClient.deleteAccount();
            GameState.instance.clearPersonalData(openId);
            ApiClient.clearSession();
            revokePrivacyConsent();
            if (root.isValid) root.destroy();
            director.loadScene('Loading');
        } catch (error) {
            console.warn('[Privacy] 删除账号数据失败:', error);
            confirm.active = true;
            const message = root.getChildByName('DeleteError') ?? new Node('DeleteError');
            message.name = 'DeleteError';
            message.layer = Layers.Enum.UI_2D;
            message.parent = card;
            message.setPosition(0, -180, 0);
            if (!message.getComponent(UITransform)) message.addComponent(UITransform).setContentSize(520, 42);
            const label = message.getComponent(Label) ?? message.addComponent(Label);
            label.string = '删除失败，请检查网络后重试';
            label.fontSize = 22;
            label.lineHeight = 32;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.color = TOKENS.danger;
            GlobalFontManager.applyFont(message);
        }
    });
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
