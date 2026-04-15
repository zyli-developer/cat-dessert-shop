import { _decorator, Component, Node, Vec3, Vec2, RigidBody2D, UITransform } from 'cc';
import { Dessert } from './Dessert';
import { GameState } from '../data/GameState';
import { DouyinSDK } from '../platform/DouyinSDK';
const { ccclass, property } = _decorator;

const HAMMER_COST = 15;
const SHUFFLE_COST = 15;
const AD_GOLD_REWARD = 10;

/** 前 N 关不显示广告（首次体验保护） */
const AD_PROTECTION_ROUNDS = 2;

enum ItemMode { None, Hammer }

@ccclass('ItemManager')
export class ItemManager extends Component {
    @property(Node)
    containerNode: Node | null = null;

    @property(Node)
    btnHammer: Node | null = null;

    @property(Node)
    btnShuffle: Node | null = null;

    @property(Node)
    btnAd: Node | null = null;

    private mode: ItemMode = ItemMode.None;
    private state = GameState.instance;

    onLoad(): void {
        // 前2关隐藏广告按钮
        if (this.btnAd && this.state.currentRound <= AD_PROTECTION_ROUNDS) {
            this.btnAd.active = false;
        }

        // 监听金币变化，更新按钮状态
        this.state.events.on('gold-changed', this.updateButtonStates, this);
        this.updateButtonStates();
    }

    onDestroy(): void {
        this.state.events.off('gold-changed', this.updateButtonStates, this);
        if (this.containerNode?.isValid) {
            this.containerNode.off(Node.EventType.TOUCH_END, this.onContainerTap, this);
        }
    }

    onHammerClicked(): void {
        if (!this.state.spendGold(HAMMER_COST)) return;
        this.mode = ItemMode.Hammer;
        this.containerNode?.on(Node.EventType.TOUCH_END, this.onContainerTap, this);
    }

    onShuffleClicked(): void {
        if (!this.state.spendGold(SHUFFLE_COST)) return;
        if (!this.containerNode) return;

        const desserts = this.containerNode.getComponentsInChildren(Dessert);
        if (desserts.length < 2) return;

        const positions = desserts.map(d => d.node.position.clone());
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        desserts.forEach((d, i) => {
            d.node.setPosition(positions[i]);
            const body = d.getComponent(RigidBody2D);
            if (body) {
                body.linearVelocity = Vec2.ZERO;
                body.angularVelocity = 0;
            }
        });
    }

    async onAdClicked(): Promise<void> {
        const success = await DouyinSDK.showRewardedAd('game_ad_gold');
        if (success) {
            this.state.addGold(AD_GOLD_REWARD);
        }
    }

    private updateButtonStates(): void {
        // 金币不足时可以加视觉提示（灰度等），这里只做逻辑检查
    }

    private onContainerTap(event: any): void {
        if (this.mode !== ItemMode.Hammer) return;
        this.containerNode?.off(Node.EventType.TOUCH_END, this.onContainerTap, this);
        this.mode = ItemMode.None;

        // 将触摸 UI 坐标转换为容器本地坐标
        const tapUIPos = event.getUILocation();
        const containerTransform = this.containerNode!.getComponent(UITransform);
        const localPos = containerTransform
            ? containerTransform.convertToNodeSpaceAR(new Vec3(tapUIPos.x, tapUIPos.y, 0))
            : new Vec3(tapUIPos.x, tapUIPos.y, 0);

        const desserts = this.containerNode!.getComponentsInChildren(Dessert);
        let closest: Dessert | null = null;
        let minDist = Infinity;

        for (const d of desserts) {
            // 使用本地坐标比较
            const dist = Vec3.distance(d.node.position, localPos);
            if (dist < minDist) {
                minDist = dist;
                closest = d;
            }
        }

        if (closest && minDist < 100) {
            closest.node.destroy();
        }
    }
}
