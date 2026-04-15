import { _decorator, Component, RigidBody2D, CircleCollider2D,
         ERigidBody2DType, UITransform, Sprite, SpriteFrame, resources } from 'cc';
import { getDessert } from '../data/DessertConfig';
import { Container } from './Container';
const { ccclass, property } = _decorator;

@ccclass('Dessert')
export class Dessert extends Component {
    private static readonly COLLIDER_RADIUS_SCALE = 1.08;
    level: number = 1;
    isMerging: boolean = false;
    isDropping: boolean = true;

    init(level: number): void {
        this.level = level;
        this.isMerging = false;
        this.isDropping = true;

        const data = getDessert(level);
        const physics = Container.getPhysicsParams();

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
            body.linearDamping = physics.linearDamping;
        }

        // 配置圆形碰撞器
        const collider = this.getComponent(CircleCollider2D);
        if (collider) {
            // 贴图经过透明裁切与视觉放大后，视觉边缘通常略大于原始配置半径；
            // 适度放大碰撞体，减少“看起来贴住但不触发合成”的假象。
            collider.radius = data.radius * Dessert.COLLIDER_RADIUS_SCALE;
            collider.density = 1;
            collider.friction = physics.friction;
            collider.restitution = physics.restitution;
            collider.apply();
        }

        // 加载甜品贴图
        this.loadSprite(data.texture);

        this.scheduleOnce(() => {
            this.isDropping = false;
        }, 0.3);
    }

    private loadSprite(texturePath: string): void {
        const sprite = this.getComponent(Sprite);
        if (!sprite) return;

        resources.load(texturePath + '/spriteFrame', SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error(`[Dessert] load sprite failed: ${texturePath}/spriteFrame`, err);
                return;
            }
            if (!this.isValid) return;
            sprite.spriteFrame = spriteFrame;
        });
    }
}
