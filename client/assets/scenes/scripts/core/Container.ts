import { _decorator, Component, Node, UITransform, RigidBody2D, BoxCollider2D,
         ERigidBody2DType, PhysicsSystem2D, Graphics, Color, Vec2, Label, Sprite, Layers } from 'cc';
import { GlobalFontManager } from '../ui/GlobalFontManager';
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

        // 杯型容器（替换旧的蓝瓶贴图）+ 警戒线
        this.drawCup();
        this.drawWarningLine();
    }

    /**
     * 半透明开口杯型（对齐 docs/ui-mockup/game.html）：圆角杯体 + 暖描边 + 内白高光 + 杯口高光。
     * 关掉容器节点原来的「蓝瓶」贴图，改用 Graphics 绘制。
     */
    private drawCup(): void {
        const sprite = this.getComponent(Sprite);
        if (sprite) sprite.enabled = false;

        const cup = new Node('cupBody');
        cup.layer = Layers.Enum.UI_2D;
        cup.parent = this.node;

        const g = cup.addComponent(Graphics);
        const W = this.containerWidth;
        const H = this.containerHeight;
        const r = 40;

        // 杯体：半透明乳白
        g.fillColor = new Color(255, 255, 255, 78);
        g.roundRect(-W / 2, -H / 2, W, H, r);
        g.fill();

        // 外描边：柔棕 line-2
        g.lineWidth = 6;
        g.strokeColor = new Color(220, 193, 151, 220);
        g.roundRect(-W / 2, -H / 2, W, H, r);
        g.stroke();

        // 内描边：白色杯壁高光
        g.lineWidth = 4;
        g.strokeColor = new Color(255, 255, 255, 210);
        g.roundRect(-W / 2 + 5, -H / 2 + 5, W - 10, H - 10, r - 4);
        g.stroke();

        // 杯口高光（顶部一条）
        g.fillColor = new Color(255, 255, 255, 95);
        g.roundRect(-W / 2 + 10, H / 2 - 50, W - 20, 42, 20);
        g.fill();

        cup.setSiblingIndex(0); // 杯体在最底，甜点/警戒线在其上
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
        gfxNode.layer = Layers.Enum.UI_2D;
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

        // 「警戒线」标签（粉色胶囊，贴在警戒线右端上方，对齐 game.html）
        const tag = new Node('warningTag');
        tag.layer = Layers.Enum.UI_2D;
        tag.parent = this.node;
        tag.setPosition(halfW - 46, y + 16, 0);
        tag.addComponent(UITransform).setContentSize(86, 30);
        const bg = tag.addComponent(Graphics);
        bg.fillColor = new Color(255, 230, 235, 235); // pink-sf
        bg.roundRect(-43, -15, 86, 30, 15);
        bg.fill();
        const labelNode = new Node('warningTagLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = tag;
        labelNode.addComponent(UITransform).setContentSize(86, 30);
        const label = labelNode.addComponent(Label);
        label.string = '警戒线';
        label.fontSize = 20;
        label.lineHeight = 30;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(217, 89, 111, 255); // pink-dp
        label.isBold = true;
        GlobalFontManager.applyFont(labelNode);
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
