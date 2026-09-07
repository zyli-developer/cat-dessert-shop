import { _decorator, Component, Node, EventTouch, UITransform, Vec3, Sprite, SpriteFrame, resources } from 'cc';
import { MergeManager } from './MergeManager';
import { GameState } from '../data/GameState';
import { getDessert, BLOCKER_LEVEL } from '../data/DessertConfig';
import { touchToNodeLocal } from '../utils/TouchSpace';
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
    /** 冷却门闸（每次掉落后 dropCooldown 秒） */
    private canDrop: boolean = true;
    /** 本次触摸是否从容器内部开始（只有容器内起手才会瞄准/掉落） */
    private aiming: boolean = false;
    /** 外部挂起（暂停 / 结算 / 锤子选择模式），与冷却互不干扰 */
    private suspended: boolean = false;
    private containerTransform: UITransform | null = null;

    /** Injectable RNG seam (test-only). Defaults to Math.random to preserve behavior. */
    private rng: () => number = Math.random;
    public setRng(fn: () => number): void { this.rng = fn; }

    onLoad(): void {
        this.syncBoundsFromContainer();
        this.generateNext();
        this.currentLevel = this.nextLevel;
        this.generateNext();
        this.updatePreviewDisplay();

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

        // 锤子选择模式期间挂起掉落（容器内点选甜品不能触发掉落）
        GameState.instance.events.on('hammer-mode-changed', this.onHammerModeChanged, this);
    }

    onDestroy(): void {
        GameState.instance.events.off('hammer-mode-changed', this.onHammerModeChanged, this);
        if (!this.node.isValid) return;
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    private onHammerModeChanged(active: boolean): void {
        this.setEnabled(!active);
    }

    /**
     * 触摸点 → 容器本地坐标；落在容器矩形内才返回，否则 null。
     * 监听挂在全屏节点上，必须靠这层命中检测把 HUD / 道具栏 / 暂停键的点击挡掉。
     */
    private toContainerLocal(event: EventTouch, requireInside: boolean): Vec3 | null {
        if (!this.containerTransform) return null;
        // 相机同源转换（touchToNodeLocal）：可点区域严格贴合容器的渲染位置
        const localPos = touchToNodeLocal(event, this.containerTransform);
        if (requireInside) {
            const halfW = this.containerTransform.width / 2;
            const halfH = this.containerTransform.height / 2;
            if (Math.abs(localPos.x) > halfW || Math.abs(localPos.y) > halfH) return null;
        }
        return localPos;
    }

    private onTouchStart(event: EventTouch): void {
        if (this.suspended || !this.canDrop) return;
        // 只有在容器内部按下才开始瞄准——容器外（按钮/空白处）一概不响应
        const localPos = this.toContainerLocal(event, true);
        if (!localPos) return;
        this.aiming = true;
        this.applyAimX(localPos.x);
        if (this.previewNode) this.previewNode.active = true;
        if (this.guideLineNode) this.guideLineNode.active = true;
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.aiming) return;
        // 拖动允许滑出容器，x 始终被 clamp 在容器内
        const localPos = this.toContainerLocal(event, false);
        if (localPos) this.applyAimX(localPos.x);
    }

    private onTouchEnd(event: EventTouch): void {
        if (!this.aiming) return;
        this.aiming = false;
        if (this.suspended || !this.canDrop || !this.previewNode || !this.containerTransform) {
            this.hideAimUI();
            return;
        }
        this.canDrop = false;

        // 用本次触摸的最终位置重算落点（不依赖可能过期的预览位置）
        const localPos = this.toContainerLocal(event, false);
        if (localPos) this.applyAimX(localPos.x);

        // 使用容器本地坐标 -> 世界坐标，确保生成位置与预览位置一致
        const dropPosLocal = new Vec3(this.previewNode.position.x, this.dropY, 0);
        const worldPos = this.containerTransform.convertToWorldSpaceAR(dropPosLocal);

        this.mergeManager?.spawnDessert(this.currentLevel, worldPos);

        // 切换到下一个
        this.currentLevel = this.nextLevel;
        this.generateNext();
        this.updatePreviewDisplay();

        this.hideAimUI();

        this.scheduleOnce(() => {
            this.canDrop = true;
        }, this.dropCooldown);
    }

    /** 触摸被系统打断（弹窗/来电等）：取消瞄准，不掉落。 */
    private onTouchCancel(_event: EventTouch): void {
        this.aiming = false;
        this.hideAimUI();
    }

    private hideAimUI(): void {
        if (this.previewNode) this.previewNode.active = false;
        if (this.guideLineNode) this.guideLineNode.active = false;
    }

    /** 把瞄准 x（容器本地）clamp 到边界内并同步预览球 / 引导线。 */
    private applyAimX(rawX: number): void {
        if (!this.previewNode) return;
        // 考虑甜品半径，防止甜品超出容器边界
        const dessertRadius = getDessert(this.currentLevel).radius;
        const left = this.containerLeft + dessertRadius;
        const right = this.containerRight - dessertRadius;
        const x = Math.max(left, Math.min(right, rawX));
        this.previewNode.setPosition(x, this.dropY);

        if (this.guideLineNode) {
            this.guideLineNode.setPosition(x, 0);
        }
    }

    private generateNext(): void {
        const state = GameState.instance;
        const levelConfig = state.getCurrentLevel();

        // 障碍物掉落：优先用多档 blockers 配置，否则回落到单档 blockerChance(=T1)。
        // 整段只消耗 1 次 rng()（按各档概率分区）；无任何配置时不掷随机数，
        // 保持掉落序列与无 blocker 配置完全一致。
        const blockers = levelConfig?.blockers
            ?? (levelConfig?.blockerChance ? [{ level: BLOCKER_LEVEL, chance: levelConfig.blockerChance }] : []);
        if (blockers.length > 0) {
            let roll = this.rng();
            for (const b of blockers) {
                if (roll < b.chance) {
                    this.nextLevel = b.level;
                    return;
                }
                roll -= b.chance;
            }
        }

        const dropRange = levelConfig?.dropRange || [1, 2];
        const min = dropRange[0];
        const max = dropRange[1];
        this.nextLevel = min + Math.floor(this.rng() * (max - min + 1));
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

        const rawSize = dessert.radius * 2;
        // NEXT 区域保持稳定视觉，不让高等级甜品撑爆预览位
        const box = targetNode === this.nextPreviewNode ? Math.min(rawSize, 78) : rawSize;

        resources.load(dessert.texture + '/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (err || !sprite.isValid) return;
            // 场景里预览节点的 Sprite 是 TRIMMED：赋 spriteFrame 时节点尺寸会被重置成贴图
            // 原始大小。甜品贴图碰巧都是 radius*2 像素所以一直没暴露，占位蛋糕贴图是
            // 120px（radius 30），在 NEXT 框里直接撑出边框 → 强制 CUSTOM 并在赋帧后定尺寸。
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = spriteFrame;
            const uiTransform = targetNode.getComponent(UITransform);
            if (!uiTransform) return;
            // 按裁切帧宽高比内接到 box，避免非正方形帧被压扁（同登录猫修复）
            const rect = (spriteFrame as { rect?: { width: number; height: number } })?.rect;
            const aspect = rect && rect.height > 0 ? rect.width / rect.height : 1;
            if (aspect >= 1) {
                uiTransform.setContentSize(box, box / aspect);
            } else {
                uiTransform.setContentSize(box * aspect, box);
            }
        });
    }

    /**
     * 外部启停（暂停 / 结算 / 锤子模式）。独立于冷却门闸 canDrop：
     * 之前直接改 canDrop，冷却的 scheduleOnce 会在暂停期间把它重新置 true。
     */
    setEnabled(enabled: boolean): void {
        this.suspended = !enabled;
        if (!enabled) {
            this.aiming = false;
            this.hideAimUI();
        }
    }
}
