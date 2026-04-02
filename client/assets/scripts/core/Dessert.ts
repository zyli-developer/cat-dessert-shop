import { _decorator, Component, RigidBody2D, CircleCollider2D,
         ERigidBody2DType, UITransform } from 'cc';
import { getDessert } from '../data/DessertConfig';
const { ccclass, property } = _decorator;

@ccclass('Dessert')
export class Dessert extends Component {
    /** 当前甜品等级 1-8 */
    level: number = 1;

    /** 是否正在合成动画中 */
    isMerging: boolean = false;

    /** 是否刚投放，还在下落中（防止刚投放就触发合成） */
    isDropping: boolean = true;

    init(level: number): void {
        this.level = level;
        this.isMerging = false;
        this.isDropping = true;

        const data = getDessert(level);

        // 设置节点尺寸
        const ui = this.getComponent(UITransform);
        if (ui) {
            ui.setContentSize(data.radius * 2, data.radius * 2);
        }

        // 配置物理刚体
        const body = this.getComponent(RigidBody2D);
        if (body) {
            body.type = ERigidBody2DType.Dynamic;
            body.gravityScale = 1;
            body.linearDamping = 0.5;
        }

        // 配置圆形碰撞器
        const collider = this.getComponent(CircleCollider2D);
        if (collider) {
            collider.radius = data.radius;
            collider.density = 1;
            collider.friction = 0.5;
            collider.restitution = 0.3;
            collider.apply();
        }

        // 短延迟后取消 dropping 状态
        this.scheduleOnce(() => {
            this.isDropping = false;
        }, 0.3);
    }
}
