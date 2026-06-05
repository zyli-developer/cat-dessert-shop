import {
    _decorator, Component, Node, Label, UITransform, Layers, Graphics, Color, Sprite, SpriteFrame, resources,
} from 'cc';
import { PopupManager } from '../PopupManager';
import { ApiClient } from '../../net/ApiClient';
import { GameState } from '../../data/GameState';
import { TOKENS } from '../DesignTokens';
import { drawRoundedRect, makeLabel, POPUP_COLORS } from './PopupUIHelper';
import { GlobalFontManager } from '../GlobalFontManager';
const { ccclass } = _decorator;

type Board = 'friends' | 'global';

interface Row { no: number; name: string; score: number; me: boolean }

/** 领奖台台座色（rank.html：1=焦糖 / 2=天蓝 / 3=蜜桃） */
const PED_COLORS = [TOKENS.butter, new Color(169, 207, 224, 255), new Color(221, 175, 147, 255)];
const PED_TEXT = [TOKENS.butterText, new Color(40, 70, 90, 255), new Color(110, 70, 45, 255)];
const BUTTER_SF = new Color(255, 240, 205, 255);

@ccclass('RankPopup')
export class RankPopup extends Component {
    private board: Board = 'friends';
    private tabFriends: Node | null = null;
    private tabGlobal: Node | null = null;
    private podium: Node | null = null;
    private list: Node | null = null;
    private hint: Label | null = null;

    init(): void {
        for (const child of this.node.children) child.active = false;
        GlobalFontManager.applyFont(this.node);

        // 卡片背景
        drawRoundedRect(this.node, 640, 1040, POPUP_COLORS.bg, POPUP_COLORS.bgBorder, 4, 30);

        // 标题
        makeLabel(this.node, '排行榜', 460, 44, POPUP_COLORS.textGold);

        // 关闭按钮（右上角圆形）
        this.buildClose(280, 466);

        // 切换：好友榜 / 全国榜
        this.tabFriends = this.buildTab('好友榜', -110, 392, true);
        this.tabGlobal = this.buildTab('全国榜', 110, 392, false);
        this.tabFriends.on(Node.EventType.TOUCH_END, () => this.switchBoard('friends'), this);
        this.tabGlobal.on(Node.EventType.TOUCH_END, () => this.switchBoard('global'), this);

        // 领奖台 + 列表容器
        this.podium = new Node('Podium');
        this.podium.layer = Layers.Enum.UI_2D;
        this.podium.parent = this.node;
        this.podium.addComponent(UITransform).setContentSize(600, 320);
        this.podium.setPosition(0, 190, 0);

        this.list = new Node('List');
        this.list.layer = Layers.Enum.UI_2D;
        this.list.parent = this.node;
        this.list.addComponent(UITransform).setContentSize(560, 460);
        this.list.setPosition(0, -260, 0);

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

        if (!rows.length) {
            // 空态：邀请入口（断网不阻断，本地先存 —— 见 PRD M8）
            if (this.hint) {
                this.hint.node.active = true;
                this.hint.string = this.board === 'friends'
                    ? '还没有好友上榜 · 分享给好友一起玩吧~'
                    : '暂时无法加载榜单 · 请稍后再试';
            }
            return;
        }
        if (this.hint) this.hint.node.active = false;

        // 前三领奖台（顺序：2 / 1 / 3）
        const top3 = rows.slice(0, 3);
        const order = [1, 0, 2]; // 列位置 → rows 索引
        const xs = [-180, 0, 180];
        const elevated = [false, true, false];
        order.forEach((idx, col) => {
            if (top3[idx]) this.buildPodiumColumn(top3[idx], xs[col], elevated[col]);
        });

        // 列表（第 4 名起；若「我」不在前三，置顶高亮一行）
        const rest = rows.slice(3);
        const meRow = rows.find(r => r.me);
        const meInTop3 = top3.some(r => r.me);
        let y = 200;
        if (meRow && !meInTop3) {
            this.buildListRow(meRow, y);
            y -= 84;
        }
        for (const r of rest.slice(0, meRow && !meInTop3 ? 4 : 5)) {
            this.buildListRow(r, y);
            y -= 84;
        }
    }

    // --- 组件 ---

    private buildPodiumColumn(row: Row, x: number, elevated: boolean): void {
        if (!this.podium) return;
        const col = new Node(`ped_${row.no}`);
        col.layer = Layers.Enum.UI_2D;
        col.parent = this.podium;
        col.setPosition(x, 0, 0);
        col.addComponent(UITransform).setContentSize(170, 320);

        const avaSize = elevated ? 116 : 96;
        const avaY = elevated ? 96 : 78;
        this.buildAvatar(col, 0, avaY, avaSize, row.no <= 3 ? PED_COLORS[row.no - 1] : TOKENS.line2);

        const name = makeLabel(col, row.name, avaY - avaSize / 2 - 24, elevated ? 26 : 24, POPUP_COLORS.textLight);
        name.isBold = true;
        name.isSystemFontUsed = true;

        makeLabel(col, `${row.score}`, avaY - avaSize / 2 - 54, elevated ? 26 : 24, POPUP_COLORS.textGold);

        // 台座
        const pedH = elevated ? 140 : (row.no === 2 ? 104 : 82);
        const pedY = -90 - (elevated ? 0 : 8);
        const ped = new Node('ped');
        ped.layer = Layers.Enum.UI_2D;
        ped.parent = col;
        ped.setPosition(0, pedY - (140 - pedH) / 2, 0);
        ped.addComponent(UITransform).setContentSize(150, pedH);
        const c = row.no <= 3 ? PED_COLORS[row.no - 1] : TOKENS.line2;
        drawRoundedRect(ped, 150, pedH, c, undefined, 0, 14);
        const num = makeLabel(ped, `${row.no}`, 0, elevated ? 56 : 44, row.no <= 3 ? PED_TEXT[row.no - 1] : TOKENS.white);
        num.node.setPosition(0, 0, 0);
    }

    private buildListRow(row: Row, y: number): void {
        if (!this.list) return;
        const node = new Node(`row_${row.no}`);
        node.layer = Layers.Enum.UI_2D;
        node.parent = this.list;
        node.setPosition(0, y, 0);
        node.addComponent(UITransform).setContentSize(560, 72);
        drawRoundedRect(node, 560, 72, row.me ? BUTTER_SF : TOKENS.paper2,
            row.me ? TOKENS.butter : TOKENS.line, 2, 22);

        const no = makeLabel(node, `${row.no}`, 0, 32, row.me ? TOKENS.butterText : TOKENS.inkMute);
        no.node.setPosition(-238, 0, 0);
        no.node.getComponent(UITransform)?.setContentSize(54, 50);

        this.buildAvatar(node, -168, 0, 58, row.me ? TOKENS.butter : TOKENS.line2);

        const name = makeLabel(node, row.me ? '我' : row.name, 0, 30, row.me ? TOKENS.butterText : POPUP_COLORS.textLight);
        name.horizontalAlign = Label.HorizontalAlign.LEFT;
        name.node.getComponent(UITransform)?.setContentSize(240, 50);
        name.node.setPosition(-110, 0, 0);
        name.isBold = true;
        name.isSystemFontUsed = true;

        const score = makeLabel(node, `${row.score}`, 0, 32, row.me ? TOKENS.butterText : POPUP_COLORS.textLight);
        score.horizontalAlign = Label.HorizontalAlign.RIGHT;
        score.node.getComponent(UITransform)?.setContentSize(180, 50);
        score.node.setPosition(170, 0, 0);
    }

    /** 圆形头像占位（远端抖音头像 URL 在 Cocos 内不便加载，用描边圆底占位，保证可靠呈现） */
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
        // 中间放一枚暖色图标占位（远端头像不便加载）
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
        tab.addComponent(UITransform).setContentSize(220, 68);
        const label = makeLabel(tab, text, 0, 28, on ? POPUP_COLORS.textLight : POPUP_COLORS.textDim);
        label.node.setPosition(0, 0, 0);
        this.styleTab(tab, on);
        return tab;
    }

    private styleTab(tab: Node | null, on: boolean): void {
        if (!tab) return;
        drawRoundedRect(tab, 220, 68, on ? TOKENS.paper2 : TOKENS.sand, on ? TOKENS.line2 : undefined, on ? 2 : 0, 34);
        const label = tab.getComponentInChildren(Label);
        if (label) {
            label.color = on ? POPUP_COLORS.textLight : POPUP_COLORS.textDim;
            label.node.setSiblingIndex(99);
        }
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
        x2.addComponent(UITransform).setContentSize(44, 44);
        const sp = x2.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = TOKENS.ink;
        resources.load('textures/ui/icon_close/spriteFrame', SpriteFrame, (err, frame) => {
            if (!err && frame && sp.isValid) sp.spriteFrame = frame;
        });
        btn.on(Node.EventType.TOUCH_END, () => PopupManager.close(), this);
    }
}
