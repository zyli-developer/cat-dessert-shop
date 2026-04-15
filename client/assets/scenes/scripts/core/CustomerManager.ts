import { _decorator, Component, Node, Label, Sprite, SpriteFrame, tween, Vec3, resources, Layers, Color } from 'cc';
import { CustomerData, Demand } from '../data/GameTypes';
import { getDessert } from '../data/DessertConfig';
import { AudioManager } from '../utils/AudioManager';
const { ccclass, property } = _decorator;

/** 猫咪类型，确保不连续重复 */
const CAT_TYPES = ['orange', 'blue', 'white'] as const;

@ccclass('CustomerManager')
export class CustomerManager extends Component {
    @property(Node)
    catNode: Node | null = null;

    @property(Sprite)
    catSprite: Sprite | null = null;

    @property(Node)
    bubbleNode: Node | null = null;

    @property(Node)
    demandContainer: Node | null = null;

    @property(Label)
    progressLabel: Label | null = null;

    private customers: CustomerData[] = [];
    private currentIndex: number = 0;
    private currentDemands: Map<number, number> = new Map();
    private fulfilledDemands: Map<number, number> = new Map();
    private lastCatType: string = '';

    onRoundComplete: (() => void) | null = null;
    onCustomerServed: (() => void) | null = null;
    /** 最后一位顾客满足时立即触发（动画播放前），用于提前禁用溢出检测 */
    onAllCustomersDone: (() => void) | null = null;

    initRound(customers: CustomerData[]): void {
        this.customers = customers;
        this.currentIndex = 0;
        this.lastCatType = '';
        console.log(`[CustomerManager] initRound: ${customers.length} customers`);
        this.showCustomer(0);
        this.updateProgressLabel();
    }

    /**
     * 检查合成出的甜品是否为当前顾客需要的
     * 返回 true 表示该甜品被顾客需要
     */
    onDessertMerged(level: number): boolean {
        if (!this.currentDemands.has(level)) {
            console.log(`[CustomerManager] onDessertMerged(lv${level}): NOT needed, demands=`, [...this.currentDemands.entries()]);
            return false;
        }

        const remaining = this.currentDemands.get(level)! - 1;
        if (remaining <= 0) {
            this.currentDemands.delete(level);
        } else {
            this.currentDemands.set(level, remaining);
        }

        // 更新已满足数
        const fulfilled = (this.fulfilledDemands.get(level) || 0) + 1;
        this.fulfilledDemands.set(level, fulfilled);

        console.log(`[CustomerManager] onDessertMerged(lv${level}): served! remaining demands=`, [...this.currentDemands.entries()]);

        this.updateDemandUI();

        if (this.currentDemands.size === 0) {
            console.log(`[CustomerManager] All demands fulfilled for customer ${this.currentIndex}`);
            this.onCustomerSatisfied();
        }
        return true;
    }

    private onCustomerSatisfied(): void {
        if (!this.catNode) {
            console.error('[CustomerManager] onCustomerSatisfied: catNode is null! Skipping.');
            return;
        }

        // 猫咪开心表情
        this.loadCatExpression('happy');

        // 满意动画
        tween(this.catNode)
            .by(0.1, { position: new Vec3(0, 20, 0) })
            .by(0.1, { position: new Vec3(0, -20, 0) })
            .by(0.08, { position: new Vec3(0, 10, 0) })
            .by(0.08, { position: new Vec3(0, -10, 0) })
            .start();

        this.onCustomerServed?.();
        this.currentIndex++;
        this.updateProgressLabel();

        console.log(`[CustomerManager] Customer satisfied. index=${this.currentIndex}/${this.customers.length}`);

        if (this.currentIndex >= this.customers.length) {
            console.log('[CustomerManager] All customers done! Triggering round complete...');
            // 立即通知：所有顾客已满足，禁用溢出检测防止误判 game over
            this.onAllCustomersDone?.();
            // 最后一位顾客 → 播放离开动画后通关
            this.scheduleOnce(() => {
                this.playCustomerLeave();
                this.scheduleOnce(() => {
                    console.log('[CustomerManager] Calling onRoundComplete');
                    this.onRoundComplete?.();
                }, 0.6);
            }, 0.6);
        } else {
            this.scheduleOnce(() => {
                this.playCustomerLeave();
                this.scheduleOnce(() => {
                    this.showCustomer(this.currentIndex);
                }, 0.4);
            }, 0.6);
        }
    }

    private showCustomer(index: number): void {
        const customer = this.customers[index];
        this.currentDemands.clear();
        this.fulfilledDemands.clear();

        for (const demand of customer.demands) {
            const existing = this.currentDemands.get(demand.level) || 0;
            this.currentDemands.set(demand.level, existing + demand.count);
        }
        console.log(`[CustomerManager] showCustomer(${index}): demands=`, [...this.currentDemands.entries()]);

        // 随机选择不连续重复的猫咪
        const catType = this.pickCatType();
        this.lastCatType = catType;
        this.loadCatExpression('idle', catType);

        // 猫咪入场动画
        if (this.catNode) {
            const targetY = this.catNode.position.y;
            this.catNode.setPosition(-300, targetY);
            tween(this.catNode)
                .to(0.4, { position: new Vec3(0, targetY, 0) }, { easing: 'backOut' })
                .start();
        }

        if (this.bubbleNode) {
            this.bubbleNode.active = true;
        }

        this.updateDemandUI();
    }

    private playCustomerLeave(): void {
        if (!this.catNode) return;
        this.loadCatExpression('bye');

        const targetY = this.catNode.position.y;
        tween(this.catNode)
            .to(0.4, { position: new Vec3(-300, targetY, 0) }, { easing: 'sineIn' })
            .start();

        if (this.bubbleNode) {
            this.bubbleNode.active = false;
        }
    }

    private pickCatType(): string {
        const available = CAT_TYPES.filter(t => t !== this.lastCatType);
        return available[Math.floor(Math.random() * available.length)];
    }

    private loadCatExpression(expression: string, catType?: string): void {
        const type = catType || this.lastCatType || 'orange';
        const path = `textures/character/cat_${type}_${expression}/spriteFrame`;

        if (!this.catSprite) return;
        resources.load(path, SpriteFrame, (err, sf) => {
            if (err || !this.catSprite?.isValid) return;
            this.catSprite!.spriteFrame = sf;
        });
    }

    private updateDemandUI(): void {
        if (!this.demandContainer) return;

        // 清空旧的需求UI
        this.demandContainer.removeAllChildren();

        // 获取当前顾客的原始需求列表
        const customer = this.customers[this.currentIndex];
        if (!customer) return;

        let yOffset = 0;
        for (const demand of customer.demands) {
            const fulfilled = this.fulfilledDemands.get(demand.level) || 0;
            const demandNode = new Node(`demand_lv${demand.level}`);
            demandNode.layer = Layers.Enum.UI_2D;
            demandNode.parent = this.demandContainer;
            demandNode.setPosition(0, yOffset);

            // 添加文本标签显示进度
            const label = demandNode.addComponent(Label);
            const dessertName = getDessert(demand.level).name;
            label.string = `${dessertName} ${fulfilled}/${demand.count}`;
            label.fontSize = 22;
            label.lineHeight = 30;
            if (fulfilled >= demand.count) {
                label.color = new Color(100, 200, 100, 255);
            }
            yOffset -= 32;
        }
    }

    private updateProgressLabel(): void {
        if (this.progressLabel) {
            this.progressLabel.string = `${this.currentIndex}/${this.customers.length}`;
        }
    }

    getCatWorldPosition(): Vec3 {
        return this.catNode?.worldPosition.clone() || new Vec3();
    }

    getCurrentDemands(): Map<number, number> {
        return new Map(this.currentDemands);
    }

    reset(): void {
        this.customers = [];
        this.currentIndex = 0;
        this.currentDemands.clear();
        this.fulfilledDemands.clear();
    }
}
