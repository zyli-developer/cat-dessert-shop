import {
    _decorator, Component, Label, Node, director, tween, Vec3,
    UITransform, Layers, Sprite, SpriteFrame, resources, Color, Graphics,
} from 'cc';
import { PopupManager } from '../PopupManager';
import { GameState } from '../../data/GameState';
import { DouyinSDK } from '../../platform/DouyinSDK';
import { AD_UNIT_IDS } from '../../platform/AdConfig';
import { ApiClient } from '../../net/ApiClient';
import { Toast } from '../../utils/Toast';
import { TOKENS } from '../DesignTokens';
import {
    POPUP_COLORS, drawRoundedRect, makeJellyButton, makeLabel, formatNumber,
} from './PopupUIHelper';
const { ccclass } = _decorator;

/** 高亮「你」行的浅焦糖底（win.html --butter-sf） */
const BUTTER_SF = new Color(255, 240, 205, 255);
/** 标题色（win.html 营业成功！ #E0657C） */
const TITLE_PINK = new Color(224, 101, 124, 255);

interface WinData {
    stars: number;
    score: number;
    catCoins: number;
    round: number;
    /** 本关猫客总数（用于副标题文案） */
    customerCount?: number;
    isLastRound: boolean;
    progressReady?: Promise<boolean>;
    retryProgress?: () => Promise<boolean>;
}

@ccclass('WinPopup')
export class WinPopup extends Component {
    private data!: WinData;
    private hasDoubled = false;
    private adInProgress = false;
    private adCompleted = false;
    private doubleClaimId = '';
    private catCoinLabel: Label | null = null;
    private friendPanel: Node | null = null;

    init(data: WinData): void {
        this.data = data;

        // 隐藏 prefab 中所有原有子节点（空壳）
        for (const child of this.node.children) child.active = false;

        // 弹窗背景（加高以容纳本关好友排名 + 三按钮行）
        drawRoundedRect(this.node, 600, 880, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 30);

        // 彩屑漂浮甜品（win.html .float：卡片两侧上方，旋转 + 上下浮动）
        this.buildConfetti();

        // 探头猫（橘猫开心）+ 关闭按钮
        this.makeSprite(this.node, 'textures/character/cat_orange_happy', 0, 470, 180);
        this.buildClose(242, 386);

        // 顺序对齐 win.html：三星(上) → 标题 → 副标题
        this.buildStars(344);
        // 通关最终关：给战役一个明确的庆祝终点（区别于普通关的「营业成功！」）
        const title = this.data.isLastRound ? '猫店圆满营业！' : '营业成功！';
        makeLabel(this.node, title, 272, 58, TITLE_PINK);
        const count = this.data.customerCount ?? 0;
        const subtitle = this.data.isLastRound
            ? `恭喜通关全部 ${this.data.round} 关，了不起的甜品大师~`
            : count > 0 ? `${count} 位猫客都满意啦~` : '猫客都满意啦~';
        makeLabel(this.node, subtitle, 218, 27, POPUP_COLORS.textDim);

        // 本关得分 + 猫币奖励（左右两块）
        this.buildScoreRow(130);

        // 本关好友排名（top-3，高亮「你」）—— 异步填充
        this.friendPanel = this.buildFriendPanel(-46);
        void this.loadFriendRanking();

        // 看广告，奖励翻倍（焦糖色，呼应金币）：▶ 图标 + 文字 + ×2 角标（win.html badge-ad）
        const btnAd = makeJellyButton(this.node, '看广告，奖励翻倍', -208, 'butter', 504, 96);
        const adLabel = btnAd.getComponentInChildren(Label);
        if (adLabel) adLabel.fontSize = 28; // 带图标/角标，缩字号避免挤压
        this.makeSprite(btnAd, 'textures/ui/icon_play', -184, 0, 30, TOKENS.butterText);
        this.buildX2Badge(btnAd, 200);
        btnAd.on(Node.EventType.TOUCH_END, () => this.onDoubleClicked(btnAd), this);

        // 底部三按钮：返回 / 炫耀战绩 / 下一关（最后一关：返回首页 + 炫耀战绩）
        this.buildBottomRow(-320);
    }

    // --- 区块构建 ---

    /** 彩屑漂浮甜品（win.html .float）：卡片两侧、旋转小角度、上下缓浮，第二枚错相 0.7s。 */
    private buildConfetti(): void {
        const items = [
            { tex: 'textures/desserts/dessert_lv2_cookie2', x: -322, y: 368, size: 62, angle: 10, delay: 0 },
            { tex: 'textures/desserts/dessert_lv5_taiyaki', x: 315, y: 298, size: 75, angle: -12, delay: 0.7 },
        ];
        for (const it of items) {
            const n = this.makeSprite(this.node, it.tex, it.x, it.y, it.size);
            n.name = 'Confetti';
            n.angle = it.angle;
            n.setSiblingIndex(0); // 垫在卡片内容之下（与设计稿 dialog 盖住 float 一致）
            tween(n)
                .delay(it.delay)
                .repeatForever(
                    tween(n)
                        .by(1.1, { position: new Vec3(0, 12, 0) }, { easing: 'sineInOut' })
                        .by(1.1, { position: new Vec3(0, -12, 0) }, { easing: 'sineInOut' })
                )
                .start();
        }
    }

    /** 三星：设计稿同款贴图星（icon_star_full / icon_star_empty，由 icons-export svg 渲染）。 */
    private buildStars(y: number): void {
        for (let i = 0; i < 3; i++) {
            const on = i < this.data.stars;
            // 中间星上抬 10px（win.html translateY(-10px)），形成轻微弧线
            const star = this.makeSprite(this.node,
                `textures/ui/${on ? 'icon_star_full' : 'icon_star_empty'}`,
                -86 + i * 86, y + (i === 1 ? 10 : 0), 70);
            star.name = `Star${i + 1}`;
            if (on) {
                star.setScale(0, 0, 1);
                tween(star)
                    .delay(0.3 + i * 0.25)
                    .to(0.2, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'backOut' })
                    .to(0.1, { scale: new Vec3(1, 1, 1) })
                    .start();
            }
        }
    }

    private buildScoreRow(y: number): void {
        // 左：本关得分（砂色面板）
        const panel = new Node('ScorePanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = this.node;
        panel.setPosition(-132, y, 0);
        panel.addComponent(UITransform).setContentSize(252, 100);
        drawRoundedRect(panel, 252, 100, TOKENS.sand, undefined, 0, 22);
        makeLabel(panel, '本关得分', 24, 23, POPUP_COLORS.textDim).node.setPosition(0, 26, 0);
        makeLabel(panel, formatNumber(this.data.score), -20, 44, POPUP_COLORS.textLight).node.setPosition(0, -16, 0);

        // 右：猫币奖励（焦糖浅底胶囊 · 横排 爪印金币 + +N + 猫币，对齐 win.html .reward）
        const reward = new Node('Reward');
        reward.layer = Layers.Enum.UI_2D;
        reward.parent = this.node;
        reward.setPosition(132, y, 0);
        reward.addComponent(UITransform).setContentSize(252, 100);
        drawRoundedRect(reward, 252, 100, BUTTER_SF, TOKENS.butter, 2, 30);
        this.makeSprite(reward, 'textures/ui/icon_coin', -68, 0, 52);
        this.catCoinLabel = makeLabel(reward, `+${this.data.catCoins}`, 0, 40, POPUP_COLORS.textGold);
        this.catCoinLabel.node.setPosition(2, 0, 0);
        makeLabel(reward, '猫币', 0, 22, TOKENS.butterText).node.setPosition(62, -2, 0);
    }

    private buildFriendPanel(y: number): Node {
        const panel = new Node('FriendPanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = this.node;
        panel.setPosition(0, y, 0);
        panel.addComponent(UITransform).setContentSize(540, 188);
        drawRoundedRect(panel, 540, 188, TOKENS.paper, TOKENS.line, 2, 22);

        const title = makeLabel(panel, '本关排名', 62, 22, POPUP_COLORS.textDim);
        title.horizontalAlign = Label.HorizontalAlign.LEFT;
        title.node.getComponent(UITransform)?.setContentSize(300, 30);
        title.node.setPosition(-190, 62, 0);
        return panel;
    }

    private async loadFriendRanking(): Promise<void> {
        if (!this.friendPanel?.isValid) return;
        let rows: Array<{ no: number; name: string; score: number; me: boolean }> = [];
        try {
            const res = await ApiClient.getFriendsRank(this.data.round);
            if (res?.list?.length) {
                rows = res.list.slice(0, 3).map((it: any, i: number) => ({
                    no: i + 1,
                    name: it.nickname || '玩家',
                    score: typeof it.score === 'number' ? it.score : (it.bestScore ?? this.data.score),
                    me: it.isMe === true || res.myRank === i + 1,
                }));
            }
        } catch { /* 离线/无好友：走兜底 */ }

        if (!this.friendPanel?.isValid) return;

        // 兜底：无好友数据 → 只显示「你」一行
        if (!rows.length) {
            makeLabel(this.friendPanel, '暂无排名，联网后再查看~', 0, 24, POPUP_COLORS.textDim);
            return;
        }
        rows.forEach((r, i) => this.makeRankRow(this.friendPanel!, 16 - i * 46, r));
    }

    private makeRankRow(
        parent: Node, y: number,
        row: { no: number; name: string; score: number; me: boolean },
    ): void {
        const rowNode = new Node(`rank_${row.no}`);
        rowNode.layer = Layers.Enum.UI_2D;
        rowNode.parent = parent;
        rowNode.setPosition(0, y, 0);
        rowNode.addComponent(UITransform).setContentSize(492, 42);
        if (row.me) {
            drawRoundedRect(rowNode, 492, 42, BUTTER_SF, TOKENS.butter, 2, 14);
        }

        const no = makeLabel(rowNode, `${row.no}`, 0, 24, row.me ? TOKENS.butterText : POPUP_COLORS.textDim);
        no.node.setPosition(-218, 0, 0);
        no.node.getComponent(UITransform)?.setContentSize(40, 40);

        const name = makeLabel(rowNode, row.name, 0, 25, row.me ? TOKENS.butterText : POPUP_COLORS.textLight);
        name.horizontalAlign = Label.HorizontalAlign.LEFT;
        name.node.getComponent(UITransform)?.setContentSize(260, 40);
        name.node.setPosition(-50, 0, 0);
        name.isBold = true;
        name.isSystemFontUsed = true; // 动态昵称走系统字，避免子集字体豆腐块

        const score = makeLabel(rowNode, formatNumber(row.score), 0, 26, row.me ? TOKENS.butterText : POPUP_COLORS.textLight);
        score.horizontalAlign = Label.HorizontalAlign.RIGHT;
        score.node.getComponent(UITransform)?.setContentSize(150, 40);
        score.node.setPosition(168, 0, 0);
    }

    /**
     * 底部按钮行（对齐 win.html）。果冻按钮已改为 Graphics 绘制（圆角随高度缩放），
     * 任意宽度都不变形，故可三按钮同排：返回 / 炫耀战绩 / 下一关（最后一关：返回首页 + 炫耀战绩）。
     */
    private buildBottomRow(y: number): void {
        const H = 92;

        if (this.data.isLastRound) {
            const home = makeJellyButton(this.node, '返回首页', y, 'ghost', 232, H);
            home.setPosition(-138, y, 0);
            home.on(Node.EventType.TOUCH_END, this.onHomeClicked, this);

            const show = makeJellyButton(this.node, '炫耀战绩', y, 'mint', 252, H);
            show.setPosition(130, y, 0);
            this.decorateShareButton(show, -76);
            show.on(Node.EventType.TOUCH_END, this.onShareClicked, this);
            return;
        }

        const back = makeJellyButton(this.node, '返回', y, 'ghost', 150, H);
        back.setPosition(-201, y, 0);
        back.on(Node.EventType.TOUCH_END, this.onHomeClicked, this);

        const show = makeJellyButton(this.node, '炫耀战绩', y, 'mint', 178, H);
        show.setPosition(-25, y, 0);
        this.decorateShareButton(show, -64);
        show.on(Node.EventType.TOUCH_END, this.onShareClicked, this);

        const next = makeJellyButton(this.node, '下一关', y, 'primary', 192, H);
        next.setPosition(172, y, 0);
        next.on(Node.EventType.TOUCH_END, this.onNextClicked, this);
    }

    /** 炫耀战绩按钮：左侧分享线条图标（win.html i-share，#1F5B41），文字缩号右让。 */
    private decorateShareButton(btn: Node, iconX: number): void {
        const label = btn.getComponentInChildren(Label);
        if (label) {
            label.fontSize = 26;
            label.node.setPosition(13, 0, 0);
        }
        this.makeSprite(btn, 'textures/ui/icon_share', iconX, 0, 28, TOKENS.mintText);
    }

    /** 翻倍按钮右侧「×2」浅白角标（win.html badge-ad）。 */
    private buildX2Badge(btn: Node, x: number): void {
        const badge = new Node('X2Badge');
        badge.layer = Layers.Enum.UI_2D;
        badge.parent = btn;
        badge.setPosition(x, 0, 0);
        badge.addComponent(UITransform).setContentSize(64, 44);
        drawRoundedRect(badge, 64, 44, new Color(255, 255, 255, 110), undefined, 0, 22);
        const l = makeLabel(badge, '×2', 0, 26, TOKENS.butterText);
        l.node.setPosition(0, 0, 0);
    }

    /** 从 resources 加载贴图到一个子 Sprite 节点（tint 给定时染色），返回节点便于挂动画。 */
    private makeSprite(parent: Node, path: string, x: number, y: number, size: number, tint?: Color): Node {
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
        return node;
    }

    /** 右上角圆形关闭按钮 → 返回首页。 */
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
        this.makeSprite(btn, 'textures/ui/icon_close', 0, 0, 40, TOKENS.ink);
        btn.on(Node.EventType.TOUCH_END, this.onHomeClicked, this);
    }

    // --- 回调 ---

    private onNextClicked(): void {
        GameState.instance.currentRound++;
        PopupManager.closeImmediate();
        director.loadScene('Game');
    }

    private onHomeClicked(): void {
        PopupManager.closeImmediate();
        director.loadScene('Home');
    }

    private async onDoubleClicked(btn: Node): Promise<void> {
        if (this.hasDoubled || this.adInProgress) return;
        this.adInProgress = true;
        try {
            if (!this.adCompleted) {
                const success = await DouyinSDK.showRewardedAd(AD_UNIT_IDS.winDouble);
                if (!success) {
                    Toast.show('广告君打了个盹，稍后再来~', true, 'icon_ad');
                    return;
                }
                this.adCompleted = true;
                this.doubleClaimId = ApiClient.createRoundClaimId(this.data.round);
            }

            let bonus = this.data.catCoins;
            if (ApiClient.isOfflineMode()) {
                const profile = GameState.instance.userProfile;
                if (profile) {
                    profile.catCoins += bonus;
                    GameState.instance.persistOfflineProfile();
                    GameState.instance.events.emit('profile-changed');
                }
            } else {
                let progressSaved = await (this.data.progressReady ?? Promise.resolve(true));
                if (!progressSaved && this.data.retryProgress) {
                    progressSaved = await this.data.retryProgress();
                }
                if (!progressSaved) {
                    Toast.show('通关进度仍在排队，联网后再点一次即可领奖~', true, 'icon_wifioff');
                    return;
                }
                const result = await ApiClient.claimReward(
                    'win_double', this.doubleClaimId, this.data.round,
                );
                GameState.instance.applyProgressFromApi(result);
                bonus = result.awarded || bonus;
            }

            this.hasDoubled = true;
            if (this.catCoinLabel) this.catCoinLabel.string = `+${this.data.catCoins + bonus}`;
            if (btn.isValid) btn.active = false;
        } catch (e) {
            console.warn('[WinPopup] claim win double failed:', e);
            Toast.show('奖励保存失败，点击可重试~', true, 'icon_wifioff');
        } finally {
            this.adInProgress = false;
        }
    }

    private async onShareClicked(): Promise<void> {
        const { round, stars } = this.data;
        const result = await DouyinSDK.share({
            title: `我在「一起开猫店」第 ${round} 关获得了 ${'⭐'.repeat(stars)}！`,
            desc: '合成甜品招待猫客，快来挑战我的成绩~',
            query: `from=win_share&round=${round}&stars=${stars}`,
        });
        if (result.status === 'success') Toast.show('战绩分享成功~');
        else if (result.status === 'cancelled') Toast.show('已取消分享');
        else if (result.status !== 'busy') Toast.show('分享暂时不可用，请稍后再试~', true);
    }
}
