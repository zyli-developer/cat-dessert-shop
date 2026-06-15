import {
    _decorator, Component, Node, Label, UITransform, Layers, Graphics, Color,
    Sprite, SpriteFrame, resources, director,
} from 'cc';
import { ApiClient } from '../net/ApiClient';
import { GameState } from '../data/GameState';
import { TOKENS } from './DesignTokens';
import { drawRoundedRect, makeJellyButton, makeLabel, POPUP_COLORS } from './popups/PopupUIHelper';
import { GlobalFontManager } from './GlobalFontManager';
import { DouyinSDK } from '../platform/DouyinSDK';
import { SafeArea } from '../platform/SafeArea';
const { ccclass } = _decorator;

type Board = 'friends' | 'global';
interface Row { no: number; name: string; score: number; me: boolean }

/** 领奖台台座色（rank.html：1=焦糖 / 2=天蓝 / 3=蜜桃） */
const PED_COLORS = [TOKENS.butter, new Color(169, 207, 224, 255), new Color(221, 175, 147, 255)];
const PED_TEXT = [TOKENS.butterText, new Color(40, 70, 90, 255), new Color(110, 70, 45, 255)];
const BUTTER_SF = new Color(255, 240, 205, 255);

/**
 * 排行榜 —— 完整页面（独立 Scene，对齐 docs/ui-mockup/rank.html）。
 * 顶栏 返回 / 标题 / 猫币，好友榜·全国榜切换 + 前三领奖台 + 榜单列表 + 空态邀请。
 * 全部运行时组装（场景里只保留 Canvas/Camera + 本脚本，其余 Loading 节点已隐藏）。
 */
@ccclass('RankScene')
export class RankScene extends Component {
    private board: Board = 'friends';
    private tabFriends: Node | null = null;
    private tabGlobal: Node | null = null;
    private podium: Node | null = null;
    private list: Node | null = null;
    private hint: Label | null = null;
    private emptyNode: Node | null = null;

    onLoad(): void {
        void GlobalFontManager.applyFontWhenReady(this.node);
        this.build();
    }

    private build(): void {
        // 纸底全屏背景
        const bg = new Node('PaperBg');
        bg.layer = Layers.Enum.UI_2D;
        bg.parent = this.node;
        bg.addComponent(UITransform).setContentSize(720, 1280);
        const g = bg.addComponent(Graphics);
        g.fillColor = TOKENS.paper;
        g.rect(-360, -640, 720, 1280);
        g.fill();
        bg.setSiblingIndex(0);

        // 顶栏（压到胶囊下沿之下、收进安全带）
        const safe = SafeArea.get();
        const titleY = Math.min(540, (640 - safe.capsuleBottom) - 36);
        this.buildHomeButton(-232, titleY);
        makeLabel(this.node, '排行榜', titleY, 44, POPUP_COLORS.textGold);
        this.buildCoinChip(196, titleY);

        // 好友榜 / 全国榜 切换
        const tabY = titleY - 96;
        this.tabFriends = this.buildTab('好友榜', -118, tabY, true);
        this.tabGlobal = this.buildTab('全国榜', 118, tabY, false);
        this.tabFriends.on(Node.EventType.TOUCH_END, () => this.switchBoard('friends'), this);
        this.tabGlobal.on(Node.EventType.TOUCH_END, () => this.switchBoard('global'), this);

        // 领奖台 + 列表容器
        this.podium = new Node('Podium');
        this.podium.layer = Layers.Enum.UI_2D;
        this.podium.parent = this.node;
        this.podium.addComponent(UITransform).setContentSize(620, 340);
        this.podium.setPosition(0, tabY - 280, 0);

        this.list = new Node('List');
        this.list.layer = Layers.Enum.UI_2D;
        this.list.parent = this.node;
        this.list.addComponent(UITransform).setContentSize(560, 500);
        this.list.setPosition(0, -360, 0);

        this.hint = makeLabel(this.node, '', -40, 26, POPUP_COLORS.textDim);
        this.hint.node.active = false;

        void this.loadBoard();
    }

    // --- 数据 ---

    private switchBoard(b: Board): void {
        if (this.board === b) return;
        this.board = b;
        this.styleTab(this.tabFriends, b === 'friends');
        this.styleTab(this.tabGlobal, b === 'global');
        void this.loadBoard();
    }

    private async loadBoard(): Promise<void> {
        const myName = GameState.instance.userProfile?.nickname;
        let rows: Row[] = [];
        try {
            if (this.board === 'friends') {
                const res = await ApiClient.getFriendsRank();
                rows = (res?.list ?? []).map((it: any, i: number) => ({
                    no: i + 1,
                    name: it.nickname || '玩家',
                    score: it.score ?? it.highScore ?? 0,
                    me: !!it.isMe || (myName != null && it.nickname === myName),
                }));
            } else {
                const list = await ApiClient.getGlobalRank(50);
                rows = (list ?? []).map((it, i) => ({
                    no: i + 1,
                    name: it.nickname || '玩家',
                    score: it.score ?? it.highScore ?? 0,
                    me: myName != null && it.nickname === myName,
                }));
            }
        } catch { /* 断网/离线：空态 */ }

        this.render(rows);
    }

    private render(rows: Row[]): void {
        this.podium?.removeAllChildren();
        this.list?.removeAllChildren();
        if (this.emptyNode?.isValid) this.emptyNode.destroy();
        this.emptyNode = null;

        if (!rows.length) {
            this.renderEmpty();
            return;
        }
        if (this.hint) this.hint.node.active = false;

        // 前三领奖台（顺序：2 / 1 / 3）
        const top3 = rows.slice(0, 3);
        const order = [1, 0, 2];
        const xs = [-190, 0, 190];
        const elevated = [false, true, false];
        order.forEach((idx, col) => {
            if (top3[idx]) this.buildPodiumColumn(top3[idx], xs[col], elevated[col]);
        });

        // 列表（第 4 名起；若「我」不在前三，置顶高亮一行）
        const rest = rows.slice(3);
        const meRow = rows.find(r => r.me);
        const meInTop3 = top3.some(r => r.me);
        let y = 220;
        if (meRow && !meInTop3) {
            this.buildListRow(meRow, y);
            y -= 86;
        }
        for (const r of rest.slice(0, meRow && !meInTop3 ? 4 : 5)) {
            this.buildListRow(r, y);
            y -= 86;
        }
    }

    // --- 空态 ---

    private renderEmpty(): void {
        if (this.hint) this.hint.node.active = false;
        const box = new Node('Empty');
        box.layer = Layers.Enum.UI_2D;
        box.parent = this.node;
        box.setPosition(0, -40, 0);
        box.addComponent(UITransform).setContentSize(560, 600);
        this.emptyNode = box;

        const cat = new Node('cat');
        cat.layer = Layers.Enum.UI_2D;
        cat.parent = box;
        cat.setPosition(0, 160, 0);
        cat.addComponent(UITransform).setContentSize(220, 220);
        const sp = cat.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('textures/character/cat_blue_idle/spriteFrame', SpriteFrame, (err, f) => {
            if (!err && f && sp.isValid) sp.spriteFrame = f;
        });

        const friends = this.board === 'friends';
        makeLabel(box, friends ? '本周还没有好友上榜' : '暂时无法加载榜单', 0, 34, POPUP_COLORS.textLight);
        makeLabel(box, friends ? '邀请好友一起开甜品店，比比谁的猫客更多~' : '网络开小差，请稍后再试',
            -54, 26, POPUP_COLORS.textDim);

        if (friends) {
            const invite = makeJellyButton(box, '邀请好友', -160, 'primary', 320, 92);
            invite.on(Node.EventType.TOUCH_END, () => {
                void DouyinSDK.share('一起来猫咪甜品店开店吧，比比谁的猫客更多！', '', 'from=rank_invite');
            }, this);
        }
    }

    // --- 组件 ---

    private buildPodiumColumn(row: Row, x: number, elevated: boolean): void {
        if (!this.podium) return;
        const col = new Node(`ped_${row.no}`);
        col.layer = Layers.Enum.UI_2D;
        col.parent = this.podium;
        col.setPosition(x, 0, 0);
        col.addComponent(UITransform).setContentSize(180, 340);

        const avaSize = elevated ? 124 : 100;
        const avaY = elevated ? 100 : 80;
        this.buildAvatar(col, 0, avaY, avaSize, row.no <= 3 ? PED_COLORS[row.no - 1] : TOKENS.line2);

        const name = makeLabel(col, row.name, avaY - avaSize / 2 - 24, elevated ? 28 : 24, POPUP_COLORS.textLight);
        name.isBold = true;
        name.isSystemFontUsed = true;

        makeLabel(col, `${row.score}`, avaY - avaSize / 2 - 56, elevated ? 28 : 24, POPUP_COLORS.textGold);

        const pedH = elevated ? 150 : (row.no === 2 ? 112 : 88);
        const pedY = -96 - (elevated ? 0 : 8);
        const ped = new Node('ped');
        ped.layer = Layers.Enum.UI_2D;
        ped.parent = col;
        ped.setPosition(0, pedY - (150 - pedH) / 2, 0);
        ped.addComponent(UITransform).setContentSize(160, pedH);
        const c = row.no <= 3 ? PED_COLORS[row.no - 1] : TOKENS.line2;
        drawRoundedRect(ped, 160, pedH, c, undefined, 0, 16);
        const num = makeLabel(ped, `${row.no}`, 0, elevated ? 58 : 46, row.no <= 3 ? PED_TEXT[row.no - 1] : TOKENS.white);
        num.node.setPosition(0, 0, 0);
    }

    private buildListRow(row: Row, y: number): void {
        if (!this.list) return;
        const node = new Node(`row_${row.no}`);
        node.layer = Layers.Enum.UI_2D;
        node.parent = this.list;
        node.setPosition(0, y, 0);
        node.addComponent(UITransform).setContentSize(560, 74);
        drawRoundedRect(node, 560, 74, row.me ? BUTTER_SF : TOKENS.paper2,
            row.me ? TOKENS.butter : TOKENS.line, 2, 22);

        const no = makeLabel(node, `${row.no}`, 0, 32, row.me ? TOKENS.butterText : TOKENS.inkMute);
        no.node.setPosition(-238, 0, 0);
        no.node.getComponent(UITransform)?.setContentSize(54, 50);

        this.buildAvatar(node, -168, 0, 60, row.me ? TOKENS.butter : TOKENS.line2);

        const name = makeLabel(node, row.me ? '我' : row.name, 0, 30, row.me ? TOKENS.butterText : POPUP_COLORS.textLight);
        name.horizontalAlign = Label.HorizontalAlign.LEFT;
        name.node.getComponent(UITransform)?.setContentSize(row.me ? 70 : 240, 50);
        name.node.setPosition(-110, 0, 0);
        name.isBold = true;
        name.isSystemFontUsed = true;

        if (row.me) {
            const tag = makeLabel(node, '· 本周最佳', 0, 20, TOKENS.butterText);
            tag.horizontalAlign = Label.HorizontalAlign.LEFT;
            tag.node.getComponent(UITransform)?.setContentSize(150, 40);
            tag.node.setPosition(-30, 0, 0);
            tag.isSystemFontUsed = true;
        }

        const score = makeLabel(node, `${row.score}`, 0, 32, row.me ? TOKENS.butterText : POPUP_COLORS.textLight);
        score.horizontalAlign = Label.HorizontalAlign.RIGHT;
        score.node.getComponent(UITransform)?.setContentSize(180, 50);
        score.node.setPosition(170, 0, 0);
    }

    /** 圆形头像占位（远端抖音头像 URL 在 Cocos 内不便加载，用描边圆底 + 图标占位）。 */
    private buildAvatar(parent: Node, x: number, y: number, size: number, ring: Color): void {
        const ava = new Node('ava');
        ava.layer = Layers.Enum.UI_2D;
        ava.parent = parent;
        ava.setPosition(x, y, 0);
        ava.addComponent(UITransform).setContentSize(size, size);
        const g = ava.addComponent(Graphics);
        g.fillColor = TOKENS.sand2;
        g.circle(0, 0, size / 2);
        g.fill();
        g.lineWidth = 4;
        g.strokeColor = ring;
        g.circle(0, 0, size / 2);
        g.stroke();
        const inner = new Node('avaIcon');
        inner.layer = Layers.Enum.UI_2D;
        inner.parent = ava;
        inner.addComponent(UITransform).setContentSize(size * 0.62, size * 0.62);
        const sp = inner.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('textures/ui/icon_rank/spriteFrame', SpriteFrame, (err, frame) => {
            if (!err && frame && sp.isValid) { sp.spriteFrame = frame; sp.color = ring; }
        });
    }

    private buildTab(text: string, x: number, y: number, on: boolean): Node {
        const tab = new Node(`tab_${text}`);
        tab.layer = Layers.Enum.UI_2D;
        tab.parent = this.node;
        tab.setPosition(x, y, 0);
        tab.addComponent(UITransform).setContentSize(220, 72);
        const label = makeLabel(tab, text, 0, 28, on ? POPUP_COLORS.textLight : POPUP_COLORS.textDim);
        label.node.setPosition(0, 0, 0);
        this.styleTab(tab, on);
        return tab;
    }

    private styleTab(tab: Node | null, on: boolean): void {
        if (!tab) return;
        drawRoundedRect(tab, 220, 72, on ? TOKENS.paper2 : TOKENS.sand, on ? TOKENS.line2 : undefined, on ? 2 : 0, 24);
        const label = tab.getComponentInChildren(Label);
        if (label) {
            label.color = on ? POPUP_COLORS.textLight : POPUP_COLORS.textDim;
            label.node.setSiblingIndex(99);
        }
    }

    private buildCoinChip(x: number, y: number): void {
        const chip = new Node('CoinChip');
        chip.layer = Layers.Enum.UI_2D;
        chip.parent = this.node;
        chip.setPosition(x, y, 0);
        chip.addComponent(UITransform).setContentSize(132, 58);
        drawRoundedRect(chip, 132, 58, TOKENS.paper2, TOKENS.line2, 2, 22);

        const icon = new Node('coin');
        icon.layer = Layers.Enum.UI_2D;
        icon.parent = chip;
        icon.setPosition(-40, 0, 0);
        icon.addComponent(UITransform).setContentSize(40, 40);
        const sp = icon.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('textures/ui/icon_coin/spriteFrame', SpriteFrame, (err, f) => {
            if (!err && f && sp.isValid) sp.spriteFrame = f;
        });

        const coins = GameState.instance.userProfile?.catCoins ?? 0;
        const label = makeLabel(chip, `${coins}`, 0, 26, TOKENS.butterText);
        label.node.setPosition(16, 0, 0);
        label.node.getComponent(UITransform)?.setContentSize(80, 40);
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
        const icon = new Node('img');
        icon.layer = Layers.Enum.UI_2D;
        icon.parent = btn;
        icon.addComponent(UITransform).setContentSize(40, 40);
        const sp = icon.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = TOKENS.ink;
        resources.load('textures/ui/icon_home/spriteFrame', SpriteFrame, (e, f) => {
            if (!e && f && sp.isValid) sp.spriteFrame = f;
        });
        btn.on(Node.EventType.TOUCH_END, () => director.loadScene('Home'), this);
    }
}
