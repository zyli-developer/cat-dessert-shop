import { _decorator, Component, Node, RigidBody2D, CircleCollider2D,
         ERigidBody2DType, UITransform, Sprite, SpriteFrame, UIOpacity,
         Vec3, tween, resources } from 'cc';
import { getDessert, getBlocker } from '../data/DessertConfig';
import { Container } from './Container';
import { AudioManager } from '../utils/AudioManager';
const { ccclass, property } = _decorator;

@ccclass('Dessert')
export class Dessert extends Component {
    private static readonly COLLIDER_RADIUS_SCALE = 1.08;
    level: number = 1;
    isMerging: boolean = false;
    isDropping: boolean = true;

    /** 焦糊曲奇专用：已承受的相邻大合成震击次数 */
    private blockerDamage: number = 0;
    private isShattering: boolean = false;
    private crackOverlay: Node | null = null;

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

    /**
     * 障碍物受到相邻大合成的震击：第一次裂开（出现裂纹叠加层 + 受击挤压），
     * 达到该档 hitsToBreak 次时震碎并自销毁。破坏阈值/贴图/分数按档位（this.level）决定。
     * @returns true 表示本次震碎（调用方负责加分/音效）。
     */
    takeBlockerHit(): boolean {
        const blocker = getBlocker(this.level);
        if (!blocker || this.isShattering || !this.node?.isValid) return false;

        this.blockerDamage++;
        if (this.blockerDamage >= blocker.hitsToBreak) {
            this.isShattering = true;
            this.shatter();
            return true;
        }

        this.showCrack(blocker.crackTexture);
        this.playHitSquash();
        AudioManager.instance?.playSFX('audio/sfx_merge');
        return false;
    }

    /** 叠加裂纹贴图（淡入）。已有则不重复添加。 */
    private showCrack(crackTexture: string): void {
        if (this.crackOverlay?.isValid) return;

        const baseUi = this.getComponent(UITransform);
        const size = baseUi && baseUi.width > 0 ? baseUi.width : getDessert(this.level).radius * 2;

        const overlay = new Node('BlockerCrack');
        overlay.layer = this.node.layer;
        overlay.parent = this.node;
        overlay.setPosition(0, 0, 0);
        overlay.addComponent(UITransform).setContentSize(size, size);
        const sp = overlay.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        const op = overlay.addComponent(UIOpacity);
        op.opacity = 0;
        this.crackOverlay = overlay;

        resources.load(crackTexture + '/spriteFrame', SpriteFrame, (err, frame) => {
            if (err || !sp.isValid) return;
            sp.spriteFrame = frame;
            tween(op).to(0.12, { opacity: 255 }).start();
        });
    }

    /** 受击挤压回弹（缩放不与物理旋转冲突，安全用于带刚体的节点）。 */
    private playHitSquash(): void {
        const n = this.node;
        tween(n)
            .to(0.05, { scale: new Vec3(1.18, 0.86, 1) })
            .to(0.08, { scale: new Vec3(0.92, 1.1, 1) })
            .to(0.07, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    /** 震碎：冻结物理 → 迸出碎屑 → 本体缩小淡出销毁。 */
    private shatter(): void {
        const body = this.getComponent(RigidBody2D);
        if (body) body.type = ERigidBody2DType.Static;

        this.spawnCrumbs();

        const op = this.getComponent(UIOpacity) ?? this.addComponent(UIOpacity);
        tween(this.node)
            .to(0.18, { scale: new Vec3(0.1, 0.1, 1) })
            .call(() => { if (this.node?.isValid) this.node.destroy(); })
            .start();
        tween(op).to(0.18, { opacity: 0 }).start();

        AudioManager.instance?.playSFX('audio/sfx_merge');
        AudioManager.instance?.vibrate();
    }

    /** 复用焦糊曲奇贴图迸出 5 块小碎屑：向外飞散后受「重力」下坠并淡出。 */
    private spawnCrumbs(): void {
        const parent = this.node.parent;
        if (!parent) return;
        const sprite = this.getComponent(Sprite);
        const frame = sprite?.spriteFrame ?? null;
        const baseUi = this.getComponent(UITransform);
        const baseSize = (baseUi ? baseUi.width : 60) * 0.38;
        const worldPos = this.node.worldPosition.clone();

        const COUNT = 5;
        for (let i = 0; i < COUNT; i++) {
            const crumb = new Node('Crumb');
            crumb.layer = this.node.layer;
            crumb.parent = parent;
            crumb.worldPosition = worldPos;

            // 用 index 制造伪随机散布，避免依赖 Math.random（也便于单测）
            const jitter = ((i * 2654435761) % 1000) / 1000; // 0..1 确定性扰动
            const size = baseSize * (0.6 + jitter * 0.6);
            crumb.addComponent(UITransform).setContentSize(size, size);
            const sp = crumb.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = frame;
            const op = crumb.addComponent(UIOpacity);

            const start = crumb.position.clone();
            const angle = (Math.PI * 2 * i) / COUNT + jitter * 0.7;
            const dist = 38 + jitter * 36;
            const dx = Math.cos(angle) * dist;
            const up = Math.sin(angle) * dist + 22;

            tween(crumb)
                .to(0.16, { position: new Vec3(start.x + dx, start.y + up, 0) }, { easing: 'quartOut' })
                .to(0.24, { position: new Vec3(start.x + dx * 1.25, start.y + up - 96, 0) }, { easing: 'quadIn' })
                .call(() => { if (crumb.isValid) crumb.destroy(); })
                .start();
            tween(crumb).delay(0.16).to(0.24, { scale: new Vec3(0.4, 0.4, 1) }).start();
            tween(op).delay(0.14).to(0.26, { opacity: 0 }).start();
        }
    }
}
