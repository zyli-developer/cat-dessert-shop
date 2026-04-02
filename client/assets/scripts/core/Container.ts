import { _decorator, Component, Node, UITransform, RigidBody2D, BoxCollider2D,
         ERigidBody2DType, PhysicsSystem2D, Graphics, Color, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Container')
export class Container extends Component {
    @property
    containerWidth: number = 360;

    @property
    containerHeight: number = 600;

    @property
    wallThickness: number = 20;

    @property
    warningLineY: number = 240;

    onLoad(): void {
        // 启用物理系统
        PhysicsSystem2D.instance.enable = true;
        PhysicsSystem2D.instance.gravity = new Vec2(0, -800);

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

        // UITransform 用于设置尺寸
        const uiTransform = wall.addComponent(UITransform);
        uiTransform.setContentSize(w, h);

        // 静态刚体
        const body = wall.addComponent(RigidBody2D);
        body.type = ERigidBody2DType.Static;

        // 碰撞器
        const collider = wall.addComponent(BoxCollider2D);
        collider.size.width = w;
        collider.size.height = h;
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

        // 绘制虚线
        for (let x = -halfW; x < halfW; x += 20) {
            gfx.moveTo(x, y);
            gfx.lineTo(Math.min(x + 12, halfW), y);
        }
        gfx.stroke();
    }

    /** 获取容器内部左边界 X */
    getLeftBound(): number {
        return -this.containerWidth / 2;
    }

    /** 获取容器内部右边界 X */
    getRightBound(): number {
        return this.containerWidth / 2;
    }

    /** 获取警戒线 Y 坐标 */
    getWarningLineY(): number {
        return this.warningLineY;
    }
}
