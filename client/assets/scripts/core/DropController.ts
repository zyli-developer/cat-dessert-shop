import { _decorator, Component, Node, EventTouch, UITransform, Vec3, Sprite, SpriteFrame } from 'cc';
import { MergeManager } from './MergeManager';
import { GameState } from '../data/GameState';
import { getDessert } from '../data/DessertConfig';
const { ccclass, property } = _decorator;

@ccclass('DropController')
export class DropController extends Component {
    @property(MergeManager)
    mergeManager: MergeManager | null = null;

    @property(Node)
    previewNode: Node | null = null;

    @property(Node)
    nextPreviewNode: Node | null = null;

    @property(Node)
    guideLineNode: Node | null = null;

    @property
    containerLeft: number = -180;

    @property
    containerRight: number = 180;

    @property
    dropY: number = 280;

    @property
    dropCooldown: number = 0.5;

    private currentLevel: number = 1;
    private nextLevel: number = 1;
    private canDrop: boolean = true;

    onLoad(): void {
        this.generateNext();
        this.currentLevel = this.nextLevel;
        this.generateNext();
        this.updatePreviewDisplay();

        // 注册触摸事件
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart(event: EventTouch): void {
        if (!this.canDrop) return;
        this.updatePreviewPosition(event);
        if (this.previewNode) this.previewNode.active = true;
        if (this.guideLineNode) this.guideLineNode.active = true;
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.canDrop) return;
        this.updatePreviewPosition(event);
    }

    private onTouchEnd(_event: EventTouch): void {
        if (!this.canDrop || !this.previewNode) return;
        this.canDrop = false;

        // 计算投放世界坐标
        const dropPos = new Vec3(this.previewNode.position.x, this.dropY, 0);
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) return;
        const worldPos = uiTransform.convertToWorldSpaceAR(dropPos);

        // 投放甜品
        this.mergeManager?.spawnDessert(this.currentLevel, worldPos);

        // 切换到下一个
        this.currentLevel = this.nextLevel;
        this.generateNext();
        this.updatePreviewDisplay();

        // 隐藏预览和引导线
        this.previewNode.active = false;
        if (this.guideLineNode) this.guideLineNode.active = false;

        // 冷却
        this.scheduleOnce(() => {
            this.canDrop = true;
        }, this.dropCooldown);
    }

    private updatePreviewPosition(event: EventTouch): void {
        if (!this.previewNode) return;

        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) return;

        const uiPos = event.getUILocation();
        const localPos = uiTransform.convertToNodeSpaceAR(new Vec3(uiPos.x, uiPos.y, 0));

        // 限制在容器范围内
        const x = Math.max(this.containerLeft, Math.min(this.containerRight, localPos.x));
        this.previewNode.setPosition(x, this.dropY);

        // 更新引导线位置
        if (this.guideLineNode) {
            this.guideLineNode.setPosition(x, 0);
        }
    }

    private generateNext(): void {
        const state = GameState.instance;
        const levelConfig = state.getCurrentLevel();
        const dropRange = levelConfig?.dropRange || [1, 2];
        const min = dropRange[0];
        const max = dropRange[1];
        this.nextLevel = min + Math.floor(Math.random() * (max - min + 1));
    }

    private updatePreviewDisplay(): void {
        // TODO: 根据 this.currentLevel 更新预览节点的 SpriteFrame
        // TODO: 根据 this.nextLevel 更新 NEXT 预览节点的 SpriteFrame
        // 这些需要在美术资源就绪后实现
    }

    /** 禁用投放（游戏暂停/结束时调用） */
    setEnabled(enabled: boolean): void {
        this.canDrop = enabled;
        if (!enabled) {
            if (this.previewNode) this.previewNode.active = false;
            if (this.guideLineNode) this.guideLineNode.active = false;
        }
    }
}
