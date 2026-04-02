import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween,
         Contact2DType, Collider2D, IPhysics2DContact, PhysicsSystem2D,
         RigidBody2D, ERigidBody2DType } from 'cc';
import { Dessert } from './Dessert';
import { getDessert, MAX_LEVEL, LV8_MERGE_GOLD } from '../data/DessertConfig';
import { GameState } from '../data/GameState';
const { ccclass, property } = _decorator;

@ccclass('MergeManager')
export class MergeManager extends Component {
    @property(Prefab)
    dessertPrefab: Prefab | null = null;

    @property(Node)
    containerNode: Node | null = null;

    private pendingMerges: Set<string> = new Set();

    /** 合成后的回调，用于通知 CustomerManager */
    onMergeComplete: ((level: number, node: Node) => void) | null = null;

    onLoad(): void {
        PhysicsSystem2D.instance.on(Contact2DType.BEGIN_CONTACT, this.onContact, this);
    }

    onDestroy(): void {
        PhysicsSystem2D.instance.off(Contact2DType.BEGIN_CONTACT, this.onContact, this);
    }

    private onContact(selfCollider: Collider2D, otherCollider: Collider2D, _contact: IPhysics2DContact): void {
        const dessertA = selfCollider.node.getComponent(Dessert);
        const dessertB = otherCollider.node.getComponent(Dessert);

        if (!dessertA || !dessertB) return;
        if (dessertA.isMerging || dessertB.isMerging) return;
        if (dessertA.isDropping || dessertB.isDropping) return;
        if (dessertA.level !== dessertB.level) return;

        // 防止重复合成
        const key = [selfCollider.node.uuid, otherCollider.node.uuid].sort().join('-');
        if (this.pendingMerges.has(key)) return;
        this.pendingMerges.add(key);

        this.merge(dessertA, dessertB, key);
    }

    private merge(a: Dessert, b: Dessert, key: string): void {
        a.isMerging = true;
        b.isMerging = true;

        const level = a.level;

        // 禁用物理，防止合成动画中继续碰撞
        const bodyA = a.getComponent(RigidBody2D);
        const bodyB = b.getComponent(RigidBody2D);
        if (bodyA) bodyA.type = ERigidBody2DType.Static;
        if (bodyB) bodyB.type = ERigidBody2DType.Static;

        // 计算中间位置
        const midPos = new Vec3();
        Vec3.lerp(midPos, a.node.worldPosition, b.node.worldPosition, 0.5);

        // 两个甜品向中间聚合
        tween(a.node).to(0.15, { worldPosition: midPos, scale: new Vec3(0.5, 0.5, 1) }).call(() => {
            a.node.destroy();
        }).start();

        tween(b.node).to(0.15, { worldPosition: midPos, scale: new Vec3(0.5, 0.5, 1) }).call(() => {
            b.node.destroy();
            this.pendingMerges.delete(key);

            if (level >= MAX_LEVEL) {
                // 两个 Lv8 合成 → 获得 50 金币
                GameState.instance.addGold(LV8_MERGE_GOLD);
                // TODO: 播放金币特效
                return;
            }

            // 生成下一级甜品
            const newLevel = level + 1;
            const newNode = this.spawnDessert(newLevel, midPos);
            GameState.instance.addScore(getDessert(newLevel).score);

            // 通知外部（CustomerManager 等）
            this.onMergeComplete?.(newLevel, newNode);
        }).start();
    }

    /** 在指定世界坐标生成甜品 */
    spawnDessert(level: number, worldPos: Vec3): Node {
        if (!this.dessertPrefab || !this.containerNode) {
            throw new Error('MergeManager: dessertPrefab or containerNode not set');
        }
        const node = instantiate(this.dessertPrefab);
        node.parent = this.containerNode;
        node.worldPosition = worldPos;
        node.getComponent(Dessert)?.init(level);
        return node;
    }

    /** 获取容器中所有甜品 */
    getAllDesserts(): Dessert[] {
        if (!this.containerNode) return [];
        return this.containerNode.getComponentsInChildren(Dessert);
    }
}
