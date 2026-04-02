import { _decorator, Component, Label, director, resources, JsonAsset } from 'cc';
import { ApiClient } from '../net/ApiClient';
import { GameState } from '../data/GameState';
import { LevelData } from '../data/GameTypes';
const { ccclass, property } = _decorator;

@ccclass('LoadingScene')
export class LoadingScene extends Component {
    @property(Label)
    statusLabel: Label | null = null;

    start(): void {
        this.doLoad();
    }

    private async doLoad(): Promise<void> {
        try {
            // Step 1: 登录
            this.setStatus('正在登录中...');
            let code = 'dev-test-code';
            if (typeof tt !== 'undefined') {
                code = await new Promise<string>((resolve, reject) => {
                    tt.login({
                        success: (res: { code: string }) => resolve(res.code),
                        fail: (err: unknown) => reject(err),
                    });
                });
            }

            const user = await ApiClient.login(code);
            ApiClient.setOpenId(user.openId);
            GameState.instance.userProfile = user;
            GameState.instance.currentRound = user.currentRound;

            // Step 2: 加载关卡配置
            this.setStatus('加载资源中...');
            await this.loadLevelConfigs();

            // Step 3: 跳转主页
            director.loadScene('Home');
        } catch (e) {
            console.error('Loading failed:', e);
            this.setStatus('加载失败，点击重试');
            this.node.once(Node.EventType.TOUCH_END, () => {
                this.doLoad();
            });
        }
    }

    private loadLevelConfigs(): Promise<void> {
        return new Promise((resolve, reject) => {
            resources.load('configs/levels', JsonAsset, (err, asset) => {
                if (err) { reject(err); return; }
                GameState.instance.allLevels = (asset as JsonAsset).json as LevelData[];
                resolve();
            });
        });
    }

    private setStatus(text: string): void {
        if (this.statusLabel) {
            this.statusLabel.string = text;
        }
    }
}
