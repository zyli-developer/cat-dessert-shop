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

    private loginBtn: Node | null = null;
    private offlineBtn: Node | null = null;
    private offlineRequested = false;
    private navigated = false;
    private destroyed = false;
    private loginInProgress = false;

    onLoad(): void {
        macro.CLEANUP_IMAGE_CACHE = false;
        console.log('[LoadingScene] CLEANUP_IMAGE_CACHE disabled');
    }

    start(): void {
        const bg = this.node.getChildByName('Background');
        if (bg) bg.setSiblingIndex(0);

        this.doLoad();
    }

    onDestroy(): void {
        this.destroyed = true;
        if (this.loginBtn?.isValid) {
            this.loginBtn.off(Node.EventType.TOUCH_END, this.onLoginClicked, this);
        }
        if (this.offlineBtn?.isValid) {
            this.offlineBtn.off(Node.EventType.TOUCH_END, this.onOfflineClicked, this);
        }
    }

    /**
     * Phase 1: load resources only (font + level configs). No login.
     * When done, show the login button and wait for user tap.
     */
    private async doLoad(): Promise<void> {
        if (this.destroyed || this.navigated) return;
        try {
            this.setStatus('[1/3] 加载字体...');
            this.setProgress(0.1);

            const fontPromise = GlobalFontManager.loadFont();

            this.setStatus('[2/3] 加载关卡配置...');
            this.setProgress(0.3);
            await this.loadLevelConfigs();
            this.setProgress(0.5);

            this.setStatus('[3/3] 等待字体...');
            await fontPromise;
            if (this.destroyed || this.navigated) return;
            GlobalFontManager.applyFont(this.node);

            this.setProgress(0.7);
            this.setStatus('资源加载完成，请登录');

            // Show login button
            this.createLoginButton();

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

    /**
     * Phase 2: user tapped "登录" — run tt.login + backend auth, then go Home.
     */
    private async doLogin(): Promise<void> {
        if (this.destroyed || this.navigated || this.loginInProgress) return;
        this.loginInProgress = true;

        // Hide login button, show progress
        if (this.loginBtn) this.loginBtn.active = false;

        try {
            this.setStatus('正在登录...');
            this.setProgress(0.75);

            let loginResult: { code?: string; anonymousCode?: string; isLogin?: boolean };
            try {
                loginResult = await DouyinSDK.login();
            } catch (loginErr) {
                const msg = loginErr instanceof Error ? loginErr.message : String(loginErr);
                throw new Error(`[tt.login失败] ${msg}`);
            }

            this.setStatus('正在验证...');
            this.setProgress(0.85);
            console.log('[LoadingScene] tt.login result:', {
                hasCode: !!loginResult.code,
                hasAnonymousCode: !!loginResult.anonymousCode,
                isLogin: loginResult.isLogin,
            });

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

            this.setStatus('登录成功!');
            this.setProgress(1.0);
            this.scheduleOnce(() => this.gotoHome(), 0.3);

        } catch (e) {
            this.loginInProgress = false;
            if (this.destroyed || !this.node?.isValid || this.navigated) return;
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error('Login failed:', errMsg, e);
            this.setStatus(errMsg + '\n\n点击"登录"重试');
            this.setProgress(0.7);

            // Re-show login button for retry
            if (this.loginBtn) this.loginBtn.active = true;

            // Show offline button as fallback
            this.createOfflineButton();
        }
    }

    private createLoginButton(): void {
        if (this.loginBtn) {
            this.loginBtn.active = true;
            return;
        }
        const btn = new Node('LoginButton');
        btn.parent = this.node;
        const btnUt = btn.addComponent(UITransform);
        btnUt.setContentSize(280, 72);
        btn.setPosition(0, -440, 0);

        const label = btn.addComponent(Label);
        label.string = '登  录';
        label.fontSize = 36;
        label.lineHeight = 42;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(80, 60, 40, 220);
        label.outlineWidth = 3;

        GlobalFontManager.applyFont(btn);

        btn.on(Node.EventType.TOUCH_END, this.onLoginClicked, this);
        this.loginBtn = btn;
    }

    private onLoginClicked(): void {
        if (this.loginInProgress) return;
        void this.doLogin();
    }

    private createOfflineButton(): void {
        if (this.offlineBtn) {
            this.offlineBtn.active = true;
            return;
        }
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
        if (this.loginBtn) this.loginBtn.active = false;
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
