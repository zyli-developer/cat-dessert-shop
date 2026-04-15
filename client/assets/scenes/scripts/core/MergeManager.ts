import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween,
         Contact2DType, Collider2D, IPhysics2DContact, PhysicsSystem2D,
         RigidBody2D, ERigidBody2DType, Color, UIOpacity, Layers } from 'cc';
import { Dessert } from './Dessert';
import { getDessert, MAX_LEVEL, LV8_MERGE_GOLD, LV8_MERGE_SCORE } from '../data/DessertConfig';
import { GameState } from '../data/GameState';
import { AudioManager } from '../utils/AudioManager';
const { ccclass, property } = _decorator;

/** 连锁合成超时（秒），超过此时间重置连击计数 */
const CHAIN_TIMEOUT = 1.5;

@ccclass('MergeManager')
export class MergeManager extends Component {
    @property(Prefab)
    dessertPrefab: Prefab | null = null;

    @property(Node)
    containerNode: Node | null = null;

    /** 屏幕闪白遮罩节点（可选） */
    @property(Node)
    flashOverlay: Node | null = null;

    private pendingMerges: Set<string> = new Set();

    /** 连锁合成计数 */
    private chainCount: number = 0;
    private lastMergeTime: number = 0;

    /** 合成后的回调，用于通知 CustomerManager / ScoreManager */
    onMergeComplete: ((level: number, node: Node) => void) | null = null;

    /** Lv8 消除回调 */
    onLv8Eliminate: (() => void) | null = null;

    /** 连锁合成回调（传入连击数） */
    onChainMerge: ((chainCount: number) => void) | null = null;

    onLoad(): void {
        PhysicsSystem2D.instance.on(Contact2DType.BEGIN_CONTACT, this.onContact, this);
    }

    onDestroy(): void {
        const sys = PhysicsSystem2D.instance;
        if (sys) {
            sys.off(Contact2DType.BEGIN_CONTACT, this.onContact, this);
        }
    }

    private onContact(selfCollider: Collider2D, otherCollider: Collider2D, _contact: IPhysics2DContact): void {
        const dessertA = selfCollider.node.getComponent(Dessert);
        const dessertB = otherCollider.node.getComponent(Dessert);

        if (!dessertA || !dessertB) return;
        if (dessertA.isMerging || dessertB.isMerging) return;
        if (dessertA.level !== dessertB.level) return;

        console.log(`[MergeManager] contact: lv${dessertA.level} + lv${dessertB.level}`);
        const key = [selfCollider.node.uuid, otherCollider.node.uuid].sort().join('-');
        if (this.pendingMerges.has(key)) return;
        this.pendingMerges.add(key);
        // 不要在物理接触回调里直接改/销毁刚体，延后一帧执行可避免
        // [TMG] Error at requestAnimationFrame callback 这类异常
        this.scheduleOnce(() => {
            if (!dessertA.isValid || !dessertB.isValid) {
                this.pendingMerges.delete(key);
                return;
            }
            this.merge(dessertA, dessertB, key);
        }, 0);
    }

    private merge(a: Dessert, b: Dessert, key: string): void {
        if (!a.isValid || !b.isValid || !a.node?.isValid || !b.node?.isValid) {
            this.pendingMerges.delete(key);
            return;
        }
        a.isMerging = true;
        b.isMerging = true;

        const level = a.level;

        // 更新连锁计数
        const now = Date.now() / 1000;
        if (now - this.lastMergeTime < CHAIN_TIMEOUT) {
            this.chainCount++;
        } else {
            this.chainCount = 1;
        }
        this.lastMergeTime = now;

        // 禁用物理
        const bodyA = a.getComponent(RigidBody2D);
        const bodyB = b.getComponent(RigidBody2D);
        if (bodyA) bodyA.type = ERigidBody2DType.Static;
        if (bodyB) bodyB.type = ERigidBody2DType.Static;

        // 计算中间位置
        const midPos = new Vec3();
        Vec3.lerp(midPos, a.node.worldPosition, b.node.worldPosition, 0.5);

        // 两个甜品向中间聚合
        tween(a.node).to(0.15, { worldPosition: midPos, scale: new Vec3(0.5, 0.5, 1) }).call(() => {
            if (a.node?.isValid) a.node.destroy();
        }).start();

        tween(b.node).to(0.15, { worldPosition: midPos, scale: new Vec3(0.5, 0.5, 1) }).call(() => {
            if (b.node?.isValid) b.node.destroy();
            this.pendingMerges.delete(key);

            if (level >= MAX_LEVEL) {
                // Lv8 消除：+50 金币 + 1000 分
                GameState.instance.addGold(LV8_MERGE_GOLD);
                GameState.instance.addScore(LV8_MERGE_SCORE);
                this.playLv8EliminateEffect();
                this.onLv8Eliminate?.();
                return;
            }

            // 生成下一级甜品
            const newLevel = level + 1;
            const newNode = this.spawnDessert(newLevel, midPos);

            // Juice: 缩放弹跳效果
            this.playMergeBounce(newNode);

            // 合成加分
            GameState.instance.addScore(getDessert(newLevel).score);

            // 连锁反馈
            if (this.chainCount > 1) {
                this.onChainMerge?.(this.chainCount);
                this.playChainEffect(this.chainCount);
            }

            // 音效
            AudioManager.instance?.playSFX('audio/sfx_merge');

            console.log(`[MergeManager] merge complete: lv${level}→lv${newLevel}, hasCallback=${!!this.onMergeComplete}`);
            this.onMergeComplete?.(newLevel, newNode);
        }).start();
    }

    /** 合成弹跳 Juice */
    private playMergeBounce(node: Node): void {
        node.setScale(0.3, 0.3, 1);
        tween(node)
            .to(0.1, { scale: new Vec3(1.3, 1.3, 1) })
            .to(0.1, { scale: new Vec3(0.9, 0.9, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    /** 连锁合成屏幕轻震 */
    private playChainEffect(count: number): void {
        if (!this.containerNode) return;
        const intensity = Math.min(count * 2, 10);
        const originPos = this.containerNode.position.clone();
        tween(this.containerNode)
            .to(0.03, { position: new Vec3(originPos.x + intensity, originPos.y, 0) })
            .to(0.03, { position: new Vec3(originPos.x - intensity, originPos.y, 0) })
            .to(0.03, { position: new Vec3(originPos.x, originPos.y, 0) })
            .start();
    }

    /** Lv8 消除全屏闪白效果 */
    private playLv8EliminateEffect(): void {
        AudioManager.instance?.playSFX('audio/sfx_win');

        if (!this.flashOverlay) return;
        this.flashOverlay.active = true;
        const opacity = this.flashOverlay.getComponent(UIOpacity);
        if (!opacity) return;

        opacity.opacity = 200;
        tween(opacity)
            .to(0.3, { opacity: 0 })
            .call(() => { this.flashOverlay!.active = false; })
            .start();
    }

    spawnDessert(level: number, worldPos: Vec3): Node {
        if (!this.dessertPrefab || !this.containerNode) {
            throw new Error('MergeManager: dessertPrefab or containerNode not set');
        }
        const node = instantiate(this.dessertPrefab);
        node.layer = Layers.Enum.UI_2D;
        node.parent = this.containerNode;
        node.worldPosition = worldPos;
        node.getComponent(Dessert)?.init(level);
        return node;
    }

    getAllDesserts(): Dessert[] {
        if (!this.containerNode) return [];
        return this.containerNode.getComponentsInChildren(Dessert);
    }
}
