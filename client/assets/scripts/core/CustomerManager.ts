import { _decorator, Component, Node, Label, tween, Vec3 } from 'cc';
import { CustomerData, Demand } from '../data/GameTypes';
const { ccclass, property } = _decorator;

@ccclass('CustomerManager')
export class CustomerManager extends Component {
    @property(Node)
    catNode: Node | null = null;

    @property(Node)
    bubbleNode: Node | null = null;

    @property(Node)
    demandContainer: Node | null = null;

    @property(Label)
    progressLabel: Label | null = null;

    private customers: CustomerData[] = [];
    private currentIndex: number = 0;
    private currentDemands: Map<number, number> = new Map();

    /** 所有顾客服务完毕回调 */
    onRoundComplete: (() => void) | null = null;

    /** 初始化回合顾客列表 */
    initRound(customers: CustomerData[]): void {
        this.customers = customers;
        this.currentIndex = 0;
        this.showCustomer(0);
        this.updateProgressLabel();
    }

    /**
     * 当合成出指定等级甜品时调用
     * 返回 true 表示该甜品被顾客需要并消耗了
     */
    onDessertMerged(level: number): boolean {
        if (!this.currentDemands.has(level)) return false;

        const remaining = this.currentDemands.get(level)! - 1;
        if (remaining <= 0) {
            this.currentDemands.delete(level);
        } else {
            this.currentDemands.set(level, remaining);
        }

        this.updateDemandUI();

        // 当前顾客需求全部满足
        if (this.currentDemands.size === 0) {
            this.onCustomerSatisfied();
            return true;
        }
        return true;
    }

    private onCustomerSatisfied(): void {
        if (!this.catNode) return;

        // 满意动画：猫咪跳一下
        tween(this.catNode)
            .by(0.1, { position: new Vec3(0, 15, 0) })
            .by(0.1, { position: new Vec3(0, -15, 0) })
            .start();

        this.currentIndex++;
        this.updateProgressLabel();

        if (this.currentIndex >= this.customers.length) {
            // 所有顾客服务完毕 → 通关
            this.scheduleOnce(() => {
                this.onRoundComplete?.();
            }, 0.8);
        } else {
            // 下一位顾客
            this.scheduleOnce(() => {
                this.showCustomer(this.currentIndex);
            }, 0.8);
        }
    }

    private showCustomer(index: number): void {
        const customer = this.customers[index];
        this.currentDemands.clear();

        for (const demand of customer.demands) {
            const existing = this.currentDemands.get(demand.level) || 0;
            this.currentDemands.set(demand.level, existing + demand.count);
        }

        // 猫咪入场动画
        if (this.catNode) {
            const targetY = this.catNode.position.y;
            this.catNode.setPosition(-400, targetY);
            tween(this.catNode)
                .to(0.4, { position: new Vec3(-80, targetY, 0) }, { easing: 'backOut' })
                .start();
        }

        // 显示气泡
        if (this.bubbleNode) {
            this.bubbleNode.active = true;
        }

        this.updateDemandUI();
    }

    private updateDemandUI(): void {
        // TODO: 根据 currentDemands 更新气泡内的需求图标
        // 每个需求显示：甜品图标 + "x数量"
        // 需要美术资源就绪后实现
    }

    private updateProgressLabel(): void {
        if (this.progressLabel) {
            this.progressLabel.string = `${this.currentIndex}/${this.customers.length}`;
        }
    }

    /** 获取当前顾客的猫咪节点世界坐标（用于送餐飞行动画） */
    getCatWorldPosition(): Vec3 {
        return this.catNode?.worldPosition.clone() || new Vec3();
    }

    /** 获取当前需求列表（供外部查询） */
    getCurrentDemands(): Map<number, number> {
        return new Map(this.currentDemands);
    }

    /** 重置 */
    reset(): void {
        this.customers = [];
        this.currentIndex = 0;
        this.currentDemands.clear();
    }
}
