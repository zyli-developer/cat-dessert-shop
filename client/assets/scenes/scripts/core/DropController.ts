import { _decorator, Component, Node, EventTouch, UITransform, Vec3, Sprite, SpriteFrame, resources } from 'cc';
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

    @property(Node)
    containerNode: Node | null = null;

    @property
    containerLeft: number = -200;

    @property
    containerRight: number = 200;

    @property
    dropY: number = 280;

    @property
    dropCooldown: number = 0.8;

    private currentLevel: number = 1;
    private nextLevel: number = 1;
    private canDrop: boolean = true;
    private containerTransform: UITransform | null = null;

    onLoad(): void {
        this.syncBoundsFromContainer();
        this.generateNext();
        this.currentLevel = this.nextLevel;
        this.generateNext();
        this.updatePreviewDisplay();

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy(): void {
        if (!this.node.isValid) return;
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
        if (!this.canDrop || !this.previewNode || !this.containerTransform) return;
        this.canDrop = false;

        // 使用容器本地坐标 -> 世界坐标，确保生成位置与预览位置一致
        const dropPosLocal = new Vec3(this.previewNode.position.x, this.dropY, 0);
        const worldPos = this.containerTransform.convertToWorldSpaceAR(dropPosLocal);

        this.mergeManager?.spawnDessert(this.currentLevel, worldPos);

        // 切换到下一个
        this.currentLevel = this.nextLevel;
        this.generateNext();
        this.updatePreviewDisplay();

        this.previewNode.active = false;
        if (this.guideLineNode) this.guideLineNode.active = false;

        this.scheduleOnce(() => {
            this.canDrop = true;
        }, this.dropCooldown);
    }

    private updatePreviewPosition(event: EventTouch): void {
        if (!this.previewNode || !this.containerTransform) return;

        const uiPos = event.getUILocation();
        // 触摸点直接换算到容器本地坐标
        const localPos = this.containerTransform.convertToNodeSpaceAR(new Vec3(uiPos.x, uiPos.y, 0));

        // 考虑甜品半径，防止甜品超出容器边界
        const dessertRadius = getDessert(this.currentLevel).radius;
        const left = this.containerLeft + dessertRadius;
        const right = this.containerRight - dessertRadius;
        const x = Math.max(left, Math.min(right, localPos.x));
        this.previewNode.setPosition(x, this.dropY);

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
        this.loadDessertSprite(this.currentLevel, this.previewNode);
        this.loadDessertSprite(this.nextLevel, this.nextPreviewNode);
    }

    private syncBoundsFromContainer(): void {
        if (!this.containerNode) return;
        const containerTransform = this.containerNode.getComponent(UITransform);
        if (!containerTransform) return;
        this.containerTransform = containerTransform;

        const halfW = containerTransform.width / 2;
        const halfH = containerTransform.height / 2;

        // 改为容器本地坐标，避免和 Canvas 坐标混用导致“松手后消失”
        this.containerLeft = -halfW;
        this.containerRight = halfW;
        // 预览球放在容器上沿稍上方 10px
        this.dropY = halfH + 10;
    }

    private loadDessertSprite(level: number, targetNode: Node | null): void {
        if (!targetNode) return;
        const dessert = getDessert(level);
        const sprite = targetNode.getComponent(Sprite);
        if (!sprite) return;

        resources.load(dessert.texture + '/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (err) return;
            sprite.spriteFrame = spriteFrame;
        });

        // 设置预览大小
        const uiTransform = targetNode.getComponent(UITransform);
        if (uiTransform) {
            const rawSize = dessert.radius * 2;
            if (targetNode === this.nextPreviewNode) {
                // NEXT 区域保持稳定视觉，不让高等级甜品撑爆预览位
                uiTransform.setContentSize(Math.min(rawSize, 72), Math.min(rawSize, 72));
            } else {
                uiTransform.setContentSize(rawSize, rawSize);
            }
        }
    }

    setEnabled(enabled: boolean): void {
        this.canDrop = enabled;
        if (!enabled) {
            if (this.previewNode) this.previewNode.active = false;
            if (this.guideLineNode) this.guideLineNode.active = false;
        }
    }
}
