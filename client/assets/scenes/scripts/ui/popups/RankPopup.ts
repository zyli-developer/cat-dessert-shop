import { _decorator, Component, Node, Label } from 'cc';
import { PopupManager } from '../PopupManager';
import { ApiClient } from '../../net/ApiClient';
import { GlobalFontManager } from '../GlobalFontManager';
const { ccclass, property } = _decorator;

@ccclass('RankPopup')
export class RankPopup extends Component {
    @property(Node)
    rankListContainer: Node | null = null;

    @property(Label)
    myRankLabel: Label | null = null;

    @property(Node)
    btnClose: Node | null = null;

    onLoad(): void {
        // 应用全局字体
        GlobalFontManager.applyFont(this.node);

        this.btnClose?.on(Node.EventType.TOUCH_END, this.onClose, this);
        this.loadRank();
    }

    onDestroy(): void {
        if (this.btnClose?.isValid) {
            this.btnClose.off(Node.EventType.TOUCH_END, this.onClose, this);
        }
    }

    private async loadRank(): Promise<void> {
        try {
            const result = await ApiClient.getFriendsRank();
            if (!result) return;

            if (this.myRankLabel) {
                this.myRankLabel.string = `我的排名：第 ${result.myRank} 名`;
            }

            if (this.rankListContainer && result.list) {
                this.rankListContainer.removeAllChildren();
                const top10 = result.list.slice(0, 10);
                for (let i = 0; i < top10.length; i++) {
                    const item = top10[i];
                    const node = new Node(`rank_${i}`);
                    node.parent = this.rankListContainer;
                    const label = node.addComponent(Label);
                    label.string = `${i + 1}. ${item.nickname || '玩家'} - 第${item.currentRound || 1}关`;
                    label.fontSize = 22;
                    label.lineHeight = 36;
                    
                    // 为动态创建的 Label 应用字体
                    GlobalFontManager.applyFont(node);
                }
            }
        } catch (e) {
            console.warn('Failed to load rank:', e);
        }
    }

    private onClose(): void {
        PopupManager.close();
    }
}
