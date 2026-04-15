import { _decorator, Component, Node, UITransform, RigidBody2D, BoxCollider2D,
         ERigidBody2DType, PhysicsSystem2D, Graphics, Color, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

/** 物理常量 */
const GRAVITY = -960;       // px/s²
const RESTITUTION = 0.3;    // 弹性系数
const FRICTION = 0.5;       // 摩擦系数
const LINEAR_DAMPING = 1.0; // 线性阻尼

@ccclass('Container')
export class Container extends Component {
    @property
    containerWidth: number = 400;

    @property
    containerHeight: number = 600;

    @property
    wallThickness: number = 20;

    /** 警戒线位于容器顶部下方 10% */
    get warningLineY(): number {
        return this.containerHeight / 2 - this.containerHeight * 0.1;
    }

    onLoad(): void {
        // 启用物理系统
        PhysicsSystem2D.instance.enable = true;
        PhysicsSystem2D.instance.gravity = new Vec2(0, GRAVITY);

        // 创建三面墙壁（底部 + 左右），顶部开口
        this.createWall('bottom', 0, -this.containerHeight / 2, this.containerWidth + this.wallThickness * 2, this.wallThickness);
        this.createWall('left', -this.containerWidth / 2 - this.wallThickness / 2, 0, this.wallThickness, this.containerHeight);
        this.createWall('right', this.containerWidth / 2 + this.wallThickness / 2, 0, this.wallThickness, this.containerHeight);

        // 绘制警戒线
        this.drawWarningLine();
    }

    private createWall(name: string, x: number, y: number, w: number, h: number): void {
        const wall = new Node(name);
        wall.parent = this.node;
        wall.setPosition(x, y);

        const uiTransform = wall.addComponent(UITransform);
        uiTransform.setContentSize(w, h);

        const body = wall.addComponent(RigidBody2D);
        body.type = ERigidBody2DType.Static;

        const collider = wall.addComponent(BoxCollider2D);
        collider.size.width = w;
        collider.size.height = h;
        collider.friction = FRICTION;
        collider.restitution = RESTITUTION;
        collider.apply();
    }

    private drawWarningLine(): void {
        const gfxNode = new Node('warningLine');
        gfxNode.parent = this.node;

        const gfx = gfxNode.addComponent(Graphics);
        gfx.strokeColor = new Color(255, 80, 80, 150);
        gfx.lineWidth = 2;

        const halfW = this.containerWidth / 2 - 10;
        const y = this.warningLineY;

        for (let x = -halfW; x < halfW; x += 20) {
            gfx.moveTo(x, y);
            gfx.lineTo(Math.min(x + 12, halfW), y);
        }
        gfx.stroke();
    }

    getLeftBound(): number {
        return -this.containerWidth / 2;
    }

    getRightBound(): number {
        return this.containerWidth / 2;
    }

    getWarningLineY(): number {
        return this.warningLineY;
    }

    /** 获取物理参数（供 Dessert 刚体设置） */
    static getPhysicsParams() {
        return { restitution: RESTITUTION, friction: FRICTION, linearDamping: LINEAR_DAMPING };
    }
}
