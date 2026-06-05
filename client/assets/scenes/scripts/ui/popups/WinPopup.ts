import {
    _decorator, Component, Label, Node, director, tween, Vec3,
    UITransform, Layers, Sprite, SpriteFrame, resources, Color,
} from 'cc';
import { PopupManager } from '../PopupManager';
import { GameState } from '../../data/GameState';
import { DouyinSDK } from '../../platform/DouyinSDK';
import { ApiClient } from '../../net/ApiClient';
import { TOKENS } from '../DesignTokens';
import {
    POPUP_COLORS, drawRoundedRect, makeButton, makeLabel,
} from './PopupUIHelper';
const { ccclass } = _decorator;

/** 高亮「你」行的浅焦糖底（win.html --butter-sf） */
const BUTTER_SF = new Color(255, 240, 205, 255);

interface WinData {
    stars: number;
    score: number;
    catCoins: number;
    round: number;
    isLastRound: boolean;
    onDoubled?: (bonus: number) => void;
}

@ccclass('WinPopup')
export class WinPopup extends Component {
    private data!: WinData;
    private hasDoubled = false;
    private catCoinLabel: Label | null = null;
    private friendPanel: Node | null = null;

    init(data: WinData): void {
        this.data = data;

        // 隐藏 prefab 中所有原有子节点（空壳）
        for (const child of this.node.children) child.active = false;

        // 弹窗背景（加高以容纳本关好友排名）
        drawRoundedRect(this.node, 600, 860, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 28);

        // 标题 + 副标题
        makeLabel(this.node, '营业成功！', 370, 46, TOKENS.pink);
        makeLabel(this.node, '猫客都满意啦~', 322, 24, POPUP_COLORS.textDim);

        // 三星（动画弹出）
        this.buildStars(258);

        // 本关得分 + 猫币奖励（左右两块）
        this.buildScoreRow(168);

        // 本关好友排名（top-3，高亮「你」）—— 异步填充
        this.friendPanel = this.buildFriendPanel(36);
        void this.loadFriendRanking();

        // 看广告，奖励翻倍
        const btnAd = makeButton(this.node, '看广告，奖励翻倍 ×2', -150, POPUP_COLORS.btnSuccess, 480, 72);
        btnAd.on(Node.EventType.TOUCH_END, () => this.onDoubleClicked(btnAd), this);

        // 底部三按钮：返回 / 炫耀战绩 / 下一关（最后一关：返回 + 炫耀）
        this.buildBottomRow(-252);
    }

    // --- 区块构建 ---

    private buildStars(y: number): void {
        for (let i = 0; i < 3; i++) {
            const on = i < this.data.stars;
            const label = makeLabel(this.node, on ? '★' : '☆', y, 58,
                on ? POPUP_COLORS.starOn : POPUP_COLORS.starOff);
            label.node.setPosition(-86 + i * 86, y);
            if (on) {
                label.node.setScale(0, 0, 1);
                tween(label.node)
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
        panel.setPosition(-138, y, 0);
        panel.addComponent(UITransform).setContentSize(248, 96);
        drawRoundedRect(panel, 248, 96, TOKENS.sand, undefined, 0, 22);
        makeLabel(panel, '本关得分', 24, 22, POPUP_COLORS.textDim).node.setPosition(0, 24, 0);
        makeLabel(panel, `${this.data.score}`, -20, 40, POPUP_COLORS.textLight).node.setPosition(0, -16, 0);

        // 右：猫币奖励（爪印金币 + +N 猫币）
        const reward = new Node('Reward');
        reward.layer = Layers.Enum.UI_2D;
        reward.parent = this.node;
        reward.setPosition(140, y, 0);
        reward.addComponent(UITransform).setContentSize(220, 96);
        this.makeSprite(reward, 'textures/ui/icon_coin', -54, 6, 56);
        this.catCoinLabel = makeLabel(reward, `+${this.data.catCoins}`, 6, 40, POPUP_COLORS.textGold);
        this.catCoinLabel.node.setPosition(28, 6, 0);
        makeLabel(reward, '猫币', -28, 22, TOKENS.butterText).node.setPosition(28, -30, 0);
    }

    private buildFriendPanel(y: number): Node {
        const panel = new Node('FriendPanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = this.node;
        panel.setPosition(0, y, 0);
        panel.addComponent(UITransform).setContentSize(520, 200);
        drawRoundedRect(panel, 520, 200, TOKENS.paper, TOKENS.line, 2, 22);

        const title = makeLabel(panel, '本关好友排名', 78, 22, POPUP_COLORS.textDim);
        title.horizontalAlign = Label.HorizontalAlign.LEFT;
        title.node.getComponent(UITransform)?.setContentSize(300, 30);
        title.node.setPosition(-180, 78, 0);
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
                    me: !!it.isMe || it.nickname === GameState.instance.userProfile?.nickname,
                }));
            }
        } catch { /* 离线/无好友：走兜底 */ }

        if (!this.friendPanel?.isValid) return;

        // 兜底：无好友数据 → 只显示「你」一行
        if (!rows.length) {
            rows = [{ no: 1, name: '你', score: this.data.score, me: true }];
        }
        rows.forEach((r, i) => this.makeRankRow(this.friendPanel!, 32 - i * 48, r));
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

        const score = makeLabel(rowNode, `${row.score}`, 0, 26, row.me ? TOKENS.butterText : POPUP_COLORS.textLight);
        score.horizontalAlign = Label.HorizontalAlign.RIGHT;
        score.node.getComponent(UITransform)?.setContentSize(150, 40);
        score.node.setPosition(168, 0, 0);
    }

    private buildBottomRow(y: number): void {
        if (this.data.isLastRound) {
            const back = makeButton(this.node, '返回', y, POPUP_COLORS.btnSecondary, 240, 72);
            back.setPosition(-130, y);
            back.on(Node.EventType.TOUCH_END, this.onHomeClicked, this);
            const show = makeButton(this.node, '炫耀战绩', y, POPUP_COLORS.btnSuccess, 240, 72);
            show.setPosition(130, y);
            show.on(Node.EventType.TOUCH_END, this.onShareClicked, this);
            return;
        }
        const back = makeButton(this.node, '返回', y, POPUP_COLORS.btnSecondary, 150, 72);
        back.setPosition(-200, y);
        back.on(Node.EventType.TOUCH_END, this.onHomeClicked, this);

        const show = makeButton(this.node, '炫耀战绩', y, POPUP_COLORS.btnSuccess, 180, 72);
        show.setPosition(-15, y);
        show.on(Node.EventType.TOUCH_END, this.onShareClicked, this);

        const next = makeButton(this.node, '下一关', y, POPUP_COLORS.btnPrimary, 180, 72);
        next.setPosition(180, y);
        next.on(Node.EventType.TOUCH_END, this.onNextClicked, this);
    }

    /** 从 resources 加载贴图到一个子 Sprite 节点 */
    private makeSprite(parent: Node, path: string, x: number, y: number, size: number): void {
        const node = new Node('Icon');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(size, size);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(`${path}/spriteFrame`, SpriteFrame, (err, frame) => {
            if (!err && frame && sp.isValid) sp.spriteFrame = frame;
        });
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
        if (this.hasDoubled) return;
        const success = await DouyinSDK.showRewardedAd('win_double');
        if (!success) return;
        this.hasDoubled = true;
        const bonus = this.data.catCoins;
        if (this.catCoinLabel) this.catCoinLabel.string = `+${this.data.catCoins + bonus}`;
        if (btn.isValid) btn.active = false;
        const profile = GameState.instance.userProfile;
        if (profile) profile.catCoins += bonus;
        this.data.onDoubled?.(bonus);
    }

    private async onShareClicked(): Promise<void> {
        const { round, stars } = this.data;
        await DouyinSDK.share(
            `我在猫咪甜品店第 ${round} 关获得了 ${'⭐'.repeat(stars)}，快来挑战！`,
            '',
            `round=${round}&stars=${stars}`,
        );
    }
}
