import { _decorator, Component, Label, Node, Sprite, UITransform, Color,
         director, resources, JsonAsset, macro } from 'cc';
import { ApiClient } from '../net/ApiClient';
import { GameState } from '../data/GameState';
import { LevelData } from '../data/GameTypes';
import { DouyinSDK } from '../platform/DouyinSDK';
import { GlobalFontManager } from './GlobalFontManager';
const { ccclass, property } = _decorator;

@ccclass('LoadingScene')
export class LoadingScene extends Component {
    @property(Label)
    statusLabel: Label | null = null;

    @property(Sprite)
    progressBar: Sprite | null = null;

    private offlineBtn: Node | null = null;
    private offlineRequested = false;
    private navigated = false;
    private destroyed = false;

    onLoad(): void {
        // 必须在任何场景/纹理加载之前禁用图片缓存清理
        // 否则纹理像素数据会在 GPU 上传之前被释放，导致图片显示为纯色
        macro.CLEANUP_IMAGE_CACHE = false;
        console.log('[LoadingScene] CLEANUP_IMAGE_CACHE disabled');
    }

    start(): void {
        // 确保 Background 在最底层渲染
        const bg = this.node.getChildByName('Background');
        if (bg) bg.setSiblingIndex(0);

        this.doLoad();
    }

    onDestroy(): void {
        this.destroyed = true;
        if (this.offlineBtn?.isValid) {
            this.offlineBtn.off(Node.EventType.TOUCH_END, this.onOfflineClicked, this);
        }
    }

    private async doLoad(): Promise<void> {
        if (this.destroyed || this.navigated) return;
        try {
            // Step 1: tt.login
            this.setStatus('[1/4] tt.login...');
            this.setProgress(0.1);

            const fontPromise = GlobalFontManager.loadFont();

            let loginResult: { code?: string; anonymousCode?: string; isLogin?: boolean };
            try {
                loginResult = await DouyinSDK.login();
            } catch (loginErr) {
                const msg = loginErr instanceof Error ? loginErr.message : String(loginErr);
                throw new Error(`[tt.login失败] ${msg}`);
            }

            this.setStatus('[2/4] 正在向后端验证...');
            this.setProgress(0.2);
            console.log('[LoadingScene] tt.login result:', {
                hasCode: !!loginResult.code,
                hasAnonymousCode: !!loginResult.anonymousCode,
                isLogin: loginResult.isLogin,
            });

            // Step 2: 后端登录
            let user;
            try {
                user = await ApiClient.login({
                    code: loginResult.code,
                    anonymousCode: loginResult.anonymousCode,
                });
            } catch (apiErr) {
                const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
                throw new Error(`[后端登录失败] ${msg}`);
            }

            ApiClient.setOpenId(user.openId);
            GameState.instance.userProfile = user;
            GameState.instance.currentRound = user.currentRound;

            this.setProgress(0.4);

            // Step 3: 字体
            this.setStatus('[3/4] 加载字体...');
            await fontPromise;
            if (this.offlineRequested) return;
            GlobalFontManager.applyFont(this.node);

            this.setProgress(0.5);

            // Step 4: 关卡配置
            this.setStatus('[4/4] 加载关卡配置...');
            await this.loadLevelConfigs();
            this.setProgress(0.8);

            this.setStatus('加载完成!');
            this.setProgress(1.0);
            this.scheduleOnce(() => this.gotoHome(), 0.3);
        } catch (e) {
            if (this.destroyed || !this.node?.isValid || this.navigated) return;
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error('Loading failed:', errMsg, e);
            this.setStatus(errMsg + '\n\n点击屏幕重试');
            this.setProgress(0);
            this.node.once(Node.EventType.TOUCH_END, () => {
                if (this.destroyed || this.navigated || !this.node?.isValid) return;
                this.doLoad();
            });
        }
    }

    private createOfflineButton(): void {
        if (this.offlineBtn) return;
        const btn = new Node('OfflineModeButton');
        btn.parent = this.node;
        const btnUt = btn.addComponent(UITransform);
        btnUt.setContentSize(220, 64);
        btn.setPosition(0, -520, 0);

        const label = btn.addComponent(Label);
        label.string = '离线模式';
        label.fontSize = 30;
        label.lineHeight = 36;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(50, 50, 50, 200);
        label.outlineWidth = 3;

        btn.on(Node.EventType.TOUCH_END, this.onOfflineClicked, this);
        this.offlineBtn = btn;
    }

    private onOfflineClicked(): void {
        if (this.offlineRequested) return;
        this.offlineRequested = true;
        this.setStatus('正在进入离线模式...');
        this.setProgress(0.3);
        if (this.offlineBtn) this.offlineBtn.active = false;
        void this.enterOfflineMode();
    }

    private async enterOfflineMode(): Promise<void> {
        ApiClient.setOpenId('dev-offline');
        GameState.instance.userProfile = {
            openId: 'dev-offline',
            nickname: '离线玩家',
            avatar: '',
            catCoins: 0,
            currentRound: 1,
            highScore: 0,
            stars: {},
            roundScores: {},
        };
        GameState.instance.currentRound = 1;

        await GlobalFontManager.loadFont().catch(() => undefined);
        GlobalFontManager.applyFont(this.node);

        await this.loadLevelConfigs();
        this.setStatus('离线模式已启动');
        this.setProgress(1);
        this.scheduleOnce(() => this.gotoHome(), 0.2);
    }

    private gotoHome(): void {
        if (this.navigated || this.destroyed || !this.node?.isValid) return;
        this.navigated = true;
        director.loadScene('Home');
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

    private setProgress(ratio: number): void {
        if (this.progressBar) {
            const ut = this.progressBar.getComponent(UITransform);
            if (ut) {
                ut.width = 400 * Math.min(ratio, 1);
            }
        }
    }
}
