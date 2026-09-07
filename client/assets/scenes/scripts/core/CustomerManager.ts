import {
    _decorator, Component, Node, Label, Sprite, SpriteFrame, tween, Vec3,
    resources, Layers, Color, UITransform,
} from 'cc';
import { CustomerData } from '../data/GameTypes';
import { getDessert } from '../data/DessertConfig';
import { GlobalFontManager } from '../ui/GlobalFontManager';
const { ccclass, property } = _decorator;

/**
 * 顾客猫咪品种池 —— 上客时从中抽取，确保同屏不重复。
 * 资源 `resources/textures/character/cat_<type>_<idle|happy|bye>`（每品种 3 表情），共 10 个。
 */
export const CAT_TYPES = [
    'orange', 'blue', 'white',
    'bengal', 'maine_coon', 'munchkin', 'persian', 'scottish_fold', 'siamese', 'sphynx',
] as const;

/** 同屏 3 位顾客（PRD §2 / game.html 顶部横排）。x 收窄：缩小三位顾客之间的间距。 */
const SLOT_X = [-150, 0, 150];
// 下移并缩小顾客排：① 让出顶部订单面板 + 分数（大胶囊机型会下压），避免遮住中间顾客气泡；
// ② 同时贴近容器顶沿（容器顶 y≈180），缩小顾客与容器之间的空隙。
const SLOT_Y = 248;
const SLOT_COUNT = 3;

interface Slot {
    root: Node;
    catSprite: Sprite;
    dessertSprite: Sprite;
    needLabel: Label;
    /** 剩余需求（level → 剩余数量） */
    demands: Map<number, number>;
    /** 原始需求总量（level → 总数，用于 x/y 显示） */
    totals: Map<number, number>;
    catType: string;
    active: boolean;
    /** 槽位换客版本；旧顾客的异步资源回调不得写入新顾客。 */
    revision: number;
    catRequest: number;
    bubbleRequest: number;
}

@ccclass('CustomerManager')
export class CustomerManager extends Component {
    // 旧的单顾客绑定（保留以兼容场景，运行时隐藏，改用 3 槽位重建）
    @property(Node) catNode: Node | null = null;
    @property(Sprite) catSprite: Sprite | null = null;
    @property(Node) bubbleNode: Node | null = null;
    @property(Node) demandContainer: Node | null = null;
    @property(Label) progressLabel: Label | null = null;

    private queue: CustomerData[] = [];
    private queueIndex = 0;
    private servedCount = 0;
    private slots: Slot[] = [];
    private lastServedPos = new Vec3();
    private roundDone = false;

    private rng: () => number = Math.random;
    public setRng(fn: () => number): void { this.rng = fn; }

    onRoundComplete: (() => void) | null = null;
    onCustomerServed: (() => void) | null = null;
    onAllCustomersDone: (() => void) | null = null;

    initRound(customers: CustomerData[]): void {
        console.log(`[CustomerManager v2 · 3-slot] initRound: ${customers.length} customers`);
        this.queue = customers;
        this.queueIndex = 0;
        this.servedCount = 0;
        this.roundDone = false;
        this.buildSlots();
        for (let i = 0; i < SLOT_COUNT; i++) this.fillSlot(i);
        this.updateProgressLabel();
    }

    // --- 槽位搭建 ---

    private buildSlots(): void {
        // 容器归零到 Canvas 原点，让槽位用 Canvas 坐标横排在顶部
        this.node.setPosition(0, 0, 0);
        // 隐藏旧的单顾客占位节点
        for (const child of this.node.children) child.active = false;
        // 清理可能存在的旧槽位
        this.slots.forEach(s => s.root.isValid && s.root.destroy());
        this.slots = [];
        for (let i = 0; i < SLOT_COUNT; i++) this.slots.push(this.createSlot(i));
    }

    private createSlot(i: number): Slot {
        const root = new Node(`CustomerSlot_${i}`);
        root.layer = Layers.Enum.UI_2D;
        root.parent = this.node;
        root.setPosition(SLOT_X[i], SLOT_Y, 0);
        root.addComponent(UITransform).setContentSize(120, 158);

        // 气泡底（象牙圆角）+ 甜点图标 + 需求 x/y
        const bubble = new Node('Bubble');
        bubble.layer = Layers.Enum.UI_2D;
        bubble.parent = root;
        bubble.setPosition(0, 52, 0);
        bubble.addComponent(UITransform).setContentSize(112, 58);
        const bsp = bubble.addComponent(Sprite);
        bsp.type = Sprite.Type.SLICED;
        bsp.sizeMode = Sprite.SizeMode.CUSTOM;
        bsp.color = new Color(255, 255, 255, 255);
        resources.load('textures/ui/chip_bg/spriteFrame', SpriteFrame, (e, f) => {
            if (!e && f && bsp.isValid) bsp.spriteFrame = f;
        });

        const dessertNode = new Node('Dessert');
        dessertNode.layer = Layers.Enum.UI_2D;
        dessertNode.parent = bubble;
        dessertNode.setPosition(-26, 0, 0);
        dessertNode.addComponent(UITransform).setContentSize(46, 46);
        const dsp = dessertNode.addComponent(Sprite);
        dsp.sizeMode = Sprite.SizeMode.CUSTOM;
        dsp.trim = false;

        const needNode = new Node('Need');
        needNode.layer = Layers.Enum.UI_2D;
        needNode.parent = bubble;
        needNode.setPosition(28, 0, 0);
        needNode.addComponent(UITransform).setContentSize(56, 34);
        const need = needNode.addComponent(Label);
        need.fontSize = 24;
        need.lineHeight = 28;
        need.horizontalAlign = Label.HorizontalAlign.CENTER;
        need.verticalAlign = Label.VerticalAlign.CENTER;
        need.color = new Color(90, 70, 54, 255);
        need.isBold = true;
        GlobalFontManager.applyFont(needNode);

        // 猫咪
        const catNode = new Node('Cat');
        catNode.layer = Layers.Enum.UI_2D;
        catNode.parent = root;
        catNode.setPosition(0, -26, 0);
        catNode.addComponent(UITransform).setContentSize(78, 78);
        const cat = catNode.addComponent(Sprite);
        cat.sizeMode = Sprite.SizeMode.CUSTOM;
        cat.trim = false;

        return {
            root, catSprite: cat, dessertSprite: dsp, needLabel: need,
            demands: new Map(), totals: new Map(), catType: '', active: false,
            revision: 0, catRequest: 0, bubbleRequest: 0,
        };
    }

    // --- 槽位填充 / 离场 ---

    private fillSlot(i: number): void {
        const slot = this.slots[i];
        slot.revision++;
        if (this.queueIndex >= this.queue.length) {
            slot.active = false;
            slot.root.active = false;
            return;
        }
        const cust = this.queue[this.queueIndex++];
        slot.demands = new Map();
        slot.totals = new Map();
        for (const d of cust.demands) {
            slot.demands.set(d.level, (slot.demands.get(d.level) ?? 0) + d.count);
            slot.totals.set(d.level, (slot.totals.get(d.level) ?? 0) + d.count);
        }
        slot.catType = this.pickCatType();
        slot.active = true;
        slot.root.active = true;
        this.loadCatExpr(slot, 'idle');
        this.updateSlotBubble(slot);

        // 入场弹跳
        slot.root.setScale(0.6, 0.6, 1);
        tween(slot.root)
            .to(0.28, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    /** 顾客满足 → 开心 → 离场 → 槽位补位。 */
    private satisfySlot(slot: Slot): void {
        this.loadCatExpr(slot, 'happy');
        this.onCustomerServed?.();
        this.servedCount++;
        this.updateProgressLabel();

        const allServed = this.servedCount >= this.queue.length;
        if (allServed && !this.roundDone) {
            this.roundDone = true;
            // 提前通知，禁用溢出检测，防止离场动画期间误判 game over
            this.onAllCustomersDone?.();
        }

        const i = this.slots.indexOf(slot);
        // 视觉：开心跳 + 缩小离场（纯动画，无逻辑回调）
        tween(slot.root)
            .by(0.1, { position: new Vec3(0, 18, 0) })
            .by(0.1, { position: new Vec3(0, -18, 0) })
            .call(() => this.loadCatExpr(slot, 'bye'))
            .to(0.3, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .start();
        // 逻辑：延时补位 + 通关判定（走 scheduleOnce，可测试）
        this.scheduleOnce(() => {
            slot.root.setScale(1, 1, 1);
            this.fillSlot(i);
            this.checkRoundComplete();
        }, 0.7);
    }

    private checkRoundComplete(): void {
        if (this.queueIndex >= this.queue.length && this.slots.every(s => !s.active)) {
            this.onRoundComplete?.();
        }
    }

    // --- 合成匹配 ---

    /** 合成出一个 level 甜品：找到第一个需要它的活跃顾客并满足。返回是否被需要。 */
    onDessertMerged(level: number): boolean {
        for (const slot of this.slots) {
            if (!slot.active || !slot.demands.has(level)) continue;

            const remaining = slot.demands.get(level)! - 1;
            if (remaining <= 0) slot.demands.delete(level);
            else slot.demands.set(level, remaining);

            const node = slot.catSprite.node;
            this.lastServedPos = (node.worldPosition ?? node.position).clone();
            this.updateSlotBubble(slot);

            if (slot.demands.size === 0) this.satisfySlot(slot);
            return true;
        }
        return false;
    }

    // --- UI ---

    private updateSlotBubble(slot: Slot): void {
        // 展示第一个未完成的需求（甜点图标 + 已满足/总量）
        let level = -1;
        for (const [lv] of slot.totals) {
            if ((slot.demands.get(lv) ?? 0) > 0) { level = lv; break; }
        }
        if (level < 0) {
            // 全部满足：显示最后一项满量
            const keys = [...slot.totals.keys()];
            if (!keys.length) return;
            level = keys[keys.length - 1];
        }
        const dessert = getDessert(level);
        if (!dessert) return; // 防御：无效等级（如最大级消除）不刷新气泡

        const total = slot.totals.get(level) ?? 0;
        const fulfilled = total - (slot.demands.get(level) ?? 0);
        if (slot.needLabel?.isValid) slot.needLabel.string = `${fulfilled}/${total}`;

        const sp = slot.dessertSprite;
        const revision = slot.revision;
        const request = ++slot.bubbleRequest;
        resources.load(`${dessert.texture}/spriteFrame`, SpriteFrame, (e, f) => {
            if (
                !e && f && sp?.isValid && slot.active &&
                slot.revision === revision && slot.bubbleRequest === request
            ) sp.spriteFrame = f;
        });
    }

    private pickCatType(): string {
        // 排除当前同屏已用品种，避免同屏重复
        const used = this.slots.filter(s => s.active).map(s => s.catType);
        const available = CAT_TYPES.filter(t => !used.includes(t));
        const pool = available.length ? available : (CAT_TYPES as readonly string[]);
        return pool[Math.floor(this.rng() * pool.length)];
    }

    private loadCatExpr(slot: Slot, expr: string): void {
        const catType = slot.catType;
        const revision = slot.revision;
        const request = ++slot.catRequest;
        const path = `textures/character/cat_${catType}_${expr}/spriteFrame`;
        resources.load(path, SpriteFrame, (err, sf) => {
            if (
                err || !slot.catSprite.isValid || !slot.active ||
                slot.revision !== revision || slot.catRequest !== request ||
                slot.catType !== catType
            ) return;
            slot.catSprite.spriteFrame = sf;
        });
    }

    private updateProgressLabel(): void {
        if (this.progressLabel) {
            this.progressLabel.string = `${this.servedCount}/${this.queue.length}`;
        }
    }

    // --- 对外查询（合成飞行目标 / 测试）---

    /** 最近被满足的顾客（合成飞行目标）的世界坐标。 */
    getCatWorldPosition(): Vec3 {
        return this.lastServedPos.clone();
    }

    /** 本回合订单进度（已服务 / 总顾客数），供 HUD 订单面板展示。 */
    getProgress(): { served: number; total: number } {
        return { served: this.servedCount, total: this.queue.length };
    }

    /** 所有活跃顾客的剩余需求并集（任一活跃顾客需要即视为需要）。 */
    getCurrentDemands(): Map<number, number> {
        const merged = new Map<number, number>();
        for (const slot of this.slots) {
            if (!slot.active) continue;
            for (const [lv, n] of slot.demands) merged.set(lv, (merged.get(lv) ?? 0) + n);
        }
        return merged;
    }

    reset(): void {
        this.queue = [];
        this.queueIndex = 0;
        this.servedCount = 0;
        this.roundDone = false;
        this.slots.forEach(s => {
            s.revision++;
            s.demands.clear();
            s.totals.clear();
            s.active = false;
        });
    }
}
