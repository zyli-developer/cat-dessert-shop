import { _decorator, Component, Label, Node, Sprite, SpriteFrame, UITransform,
         director, resources, JsonAsset, macro, Color, Graphics, Layers, BlockInputEvents } from 'cc';
import { ApiClient } from '../net/ApiClient';
import { GameState } from '../data/GameState';
import { LevelData } from '../data/GameTypes';
import { DouyinSDK } from '../platform/DouyinSDK';
import { GlobalFontManager } from './GlobalFontManager';
import { TOKENS, applyInkOutline } from './DesignTokens';
import { AudioManager } from '../utils/AudioManager';
import { drawRoundedRect, makeJellyButton, makeLabel } from './popups/PopupUIHelper';
const { ccclass, property } = _decorator;

/** 加载时轮播的游戏小知识（mockup loading.html 文案轮播）。 */
const LOADING_TIPS = [
    '把相同的甜品拖到一起，就能合成更高一级的甜品~',
    '两个奶油蛋糕合成会触发满屏特效，还有金币奖励！',
    '金币不够用？看一小段广告就能补充哦~',
    '锤子能敲掉一个碍事的甜品，洗牌能重新打乱布局。',
    '甜品堆过警戒线会开始倒计时，赶紧合成降下来！',
    '完成猫客订单能拿到大量积分，星级越高奖励越多~',
    '容器越往下空间越大，先把大甜品垫在底部更稳。',
    '每天回来都能领取每日礼包，记得来看看~',
];

@ccclass('LoadingScene')
export class LoadingScene extends Component {
    @property(Label)
    statusLabel: Label | null = null;

    @property(Sprite)
    progressBar: Sprite | null = null;

    /** 进度头爪印金币 —— 随填充宽度沿轨道移动（对齐 mockup load-head）。 */
    private coinHead: Node | null = null;

    /** 进度百分比文字（mockup load-bar 百分比），随动画实时刷新。 */
    private percentLabel: Label | null = null;

    /** 加载条上方的小知识轮播文字。 */
    private tipLabel: Label | null = null;
    private tipIndex = 0;

    /** 平滑进度：_target 为目标值，_visual 每帧逼近，避免分段硬跳、让进度条真正“走”起来。 */
    private _target = 0;
    private _visual = 0;

    private loginBtn: Node | null = null;
    private offlineBtn: Node | null = null;
    private offlineRequested = false;
    private navigated = false;
    private destroyed = false;
    private loginInProgress = false;

    onLoad(): void {
        macro.CLEANUP_IMAGE_CACHE = false;
        console.log('[LoadingScene] CLEANUP_IMAGE_CACHE disabled');
        // 进游戏第一时间 dump，提前暴露 IDE 加载到的 AppID / SDK / Host 信息
        DouyinSDK.dumpEnvironment('boot');
    }

    start(): void {
        const bg = this.node.getChildByName('Background');
        if (bg) bg.setSiblingIndex(0);

        this.coinHead = this.node.getChildByName('CoinHead');
        // 复用场景里进度条上方的 PctLabel（不再额外创建条下方的百分比）
        this.percentLabel = this.node.getChildByName('PctLabel')?.getComponent(Label) ?? null;
        this.applyProgress(0);

        // 布局：进度条(-437) → 小知识提示(-490) → 加载资源状态(-535)，都在进度条下方
        if (this.statusLabel) {
            this.statusLabel.node.setPosition(0, -535, 0);
            this.statusLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        }
        this.createTipLabel();
        this.schedule(this.nextTip, 3.0);

        // 全局音频（常驻，跨场景不中断；受设置开关控制）
        AudioManager.instance.init(this.node);

        this.doLoad();
    }

    private createTipLabel(): void {
        if (this.tipLabel) return;
        const node = new Node('TipLabel');
        node.parent = this.node;
        node.addComponent(UITransform).setContentSize(600, 60);
        node.setPosition(0, -490, 0);
        const l = node.addComponent(Label);
        l.string = LOADING_TIPS[0];
        l.fontSize = 26;
        l.lineHeight = 36;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.overflow = Label.Overflow.RESIZE_HEIGHT;
        l.enableWrapText = true;
        l.color = TOKENS.inkSoft;
        GlobalFontManager.applyFont(node);
        this.tipLabel = l;
    }

    private nextTip = (): void => {
        this.tipIndex = (this.tipIndex + 1) % LOADING_TIPS.length;
        if (this.tipLabel?.isValid) this.tipLabel.string = LOADING_TIPS[this.tipIndex];
    };

    /** 每帧把可见进度平滑逼近目标值（恒定速度 ~2/s，0→100% 约 0.5s），让进度条连续走动。 */
    update(dt: number): void {
        if (this._visual === this._target) return;
        const step = 2.0 * dt;
        if (Math.abs(this._target - this._visual) <= step) {
            this._visual = this._target;
        } else {
            this._visual += Math.sign(this._target - this._visual) * step;
        }
        this.applyProgress(this._visual);
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
            // 进度条只反映「资源加载」，与登录无关：资源就绪即 100%。
            this.setStatus('加载字体...');
            this.setProgress(0.2);

            const fontPromise = GlobalFontManager.loadFont();

            this.setStatus('加载关卡配置...');
            this.setProgress(0.45);
            await this.loadLevelConfigs();
            this.setProgress(0.7);

            this.setStatus('整理甜品中...');
            await fontPromise;
            if (this.destroyed || this.navigated) return;
            GlobalFontManager.applyFont(this.node);

            this.setProgress(1.0);
            this.setStatus('加载完成，点击登录开始');

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

        console.log('[LoadingScene] ===== 登录流程开始 =====');

        try {
            this.setStatus('正在登录...');

            console.log('[LoadingScene] [Step 1/4] 调用 DouyinSDK.login() → tt.login');
            let loginResult: { code?: string; anonymousCode?: string; isLogin?: boolean };
            try {
                loginResult = await DouyinSDK.login();
                console.log('[LoadingScene] [Step 1/4] ✓ DouyinSDK.login 返回:', {
                    hasCode: !!loginResult.code,
                    codePreview: loginResult.code?.slice(0, 8) + '...',
                    hasAnonymousCode: !!loginResult.anonymousCode,
                    anonymousCodePreview: loginResult.anonymousCode?.slice(0, 8) + '...',
                    isLogin: loginResult.isLogin,
                });
            } catch (loginErr) {
                const msg = loginErr instanceof Error ? loginErr.message : String(loginErr);
                console.error('[LoadingScene] [Step 1/4] ✗ tt.login 失败:', msg, loginErr);
                throw new Error(`[tt.login失败] ${msg}`);
            }

            this.setStatus('正在验证...');

            console.log('[LoadingScene] [Step 2/4] 调用 ApiClient.login() → POST /api/auth/login');
            let user;
            try {
                user = await ApiClient.login({
                    code: loginResult.code,
                    anonymousCode: loginResult.anonymousCode,
                });
                console.log('[LoadingScene] [Step 2/4] ✓ 后端返回 user:', {
                    openId: user.openId,
                    nickname: user.nickname,
                    currentRound: user.currentRound,
                    catCoins: user.catCoins,
                });
            } catch (apiErr) {
                const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
                console.error('[LoadingScene] [Step 2/4] ✗ 后端登录失败:', msg, apiErr);
                throw new Error(`[后端登录失败] ${msg}`);
            }

            console.log('[LoadingScene] [Step 3/4] 写入 GameState（openId / userProfile / currentRound）');
            ApiClient.setOpenId(user.openId);
            GameState.instance.userProfile = user;
            GameState.instance.currentRound = user.currentRound;

            // 异步补全抖音昵称/头像（首次会弹授权窗），失败/拒绝不阻塞进游戏
            this.syncProfileFromDouyin(user.nickname, user.avatar);

            console.log('[LoadingScene] [Step 4/4] 跳转 Home 场景');
            this.setStatus('登录成功!');
            this.setProgress(1.0);
            this.scheduleOnce(() => this.gotoHome(), 0.3);

            console.log('[LoadingScene] ===== 登录流程结束（成功） =====');

        } catch (e) {
            this.loginInProgress = false;
            if (this.destroyed || !this.node?.isValid || this.navigated) return;
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error('Login failed:', errMsg, e);
            this.setStatus('');
            // 隐藏底部裸按钮，改用设计稿 D4 的「登录没成功」带猫弹窗
            if (this.loginBtn) this.loginBtn.active = false;
            this.showLoginFailDialog();
        }
    }

    /**
     * 登录成功后获取抖音昵称/头像并上报服务端（写入 users 表的 nickname/avatar，排行榜展示用）。
     * tt.getUserInfo 首次调用会弹授权窗；用户拒绝或环境不支持时静默放弃，绝不阻塞登录流程。
     */
    private syncProfileFromDouyin(serverNickname: string, serverAvatar: string): void {
        DouyinSDK.getUserInfo()
            .then((info) => {
                const nickname = info.nickName?.trim() ?? '';
                const avatar = info.avatarUrl ?? '';
                if (!nickname) return;
                if (nickname === serverNickname && avatar === serverAvatar) {
                    console.log('[LoadingScene] 抖音昵称与服务端一致，无需上报');
                    return;
                }
                return ApiClient.updateProfile({ nickname, avatar }).then((updated) => {
                    const profile = GameState.instance.userProfile;
                    if (profile) {
                        profile.nickname = updated.nickname;
                        profile.avatar = updated.avatar;
                    }
                    console.log(`[LoadingScene] 抖音昵称已同步到服务端: ${updated.nickname}`);
                });
            })
            .catch((e) => {
                console.warn('[LoadingScene] 获取/同步抖音昵称失败（用户拒绝授权或环境不支持），跳过:',
                    (e as { errMsg?: string })?.errMsg ?? e);
            });
    }

    /** 登录失败 / 授权拒绝弹窗（states.html D4）：探头猫 + 重新登录 / 先用离线模式。 */
    private showLoginFailDialog(): void {
        const exist = this.node.getChildByName('LoginFailDialog');
        if (exist?.isValid) { exist.active = true; return; }

        const dim = new Node('LoginFailDialog');
        dim.layer = Layers.Enum.UI_2D;
        dim.parent = this.node;
        dim.addComponent(UITransform).setContentSize(1600, 2800);
        const dg = dim.addComponent(Graphics);
        // 暖棕半透明遮罩（mockup .overlay rgba(74,55,40,.42)），与 PopupManager 同款
        dg.fillColor = new Color(74, 55, 40, 107);
        dg.rect(-800, -1400, 1600, 2800);
        dg.fill();
        dim.addComponent(BlockInputEvents);
        dim.setSiblingIndex(this.node.children.length - 1);

        const card = new Node('Card');
        card.layer = Layers.Enum.UI_2D;
        card.parent = dim;
        card.addComponent(UITransform).setContentSize(580, 520);
        drawRoundedRect(card, 580, 520, TOKENS.paper2, TOKENS.line2, 4, 30);

        // 探头猫 —— 按 spriteFrame 裁切矩形的宽高比设置尺寸，避免被压成正方形
        const cat = new Node('cat');
        cat.layer = Layers.Enum.UI_2D;
        cat.parent = card;
        cat.setPosition(0, 312, 0);
        const catUt = cat.addComponent(UITransform);
        catUt.setContentSize(170, 170);
        const csp = cat.addComponent(Sprite);
        csp.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('textures/character/cat_white_idle/spriteFrame', SpriteFrame, (er, f) => {
            if (er || !f || !csp.isValid) return;
            csp.spriteFrame = f;
            // 自动裁切后内容矩形往往不是正方形，CUSTOM 模式会硬拉伸 → 按比例修正高度
            const r = f.rect;
            if (r.width > 0 && catUt.isValid) {
                catUt.setContentSize(170, 170 * r.height / r.width);
            }
        });

        makeLabel(card, '登录没成功…', 178, 46, TOKENS.butterText);
        const tip = makeLabel(card, '网络开小差，或暂未授权抖音账号。\n可重试，也能先用离线模式逛逛~', 92, 25, TOKENS.inkSoft);
        tip.overflow = Label.Overflow.RESIZE_HEIGHT;
        tip.enableWrapText = true;
        tip.lineHeight = 38;
        tip.node.getComponent(UITransform)?.setContentSize(500, 86);

        const relogin = makeJellyButton(card, '重新登录', -32, 'primary', 480, 88);
        relogin.on(Node.EventType.TOUCH_END, () => {
            dim.destroy();
            if (this.loginBtn) this.loginBtn.active = false;
            void this.doLogin();
        }, this);

        const offline = makeJellyButton(card, '先用离线模式', -150, 'ghost', 480, 80);
        offline.on(Node.EventType.TOUCH_END, () => {
            dim.destroy();
            this.onOfflineClicked();
        }, this);

        // 按钮文字加粗：自定义 TTF 在真机上不渲染合成粗体（isBold 无效），
        // 用与文字同色的描边加厚字形，视觉等效粗体。
        for (const btn of [relogin, offline]) {
            const label = btn.getComponentInChildren(Label);
            if (!label) continue;
            label.isBold = true;
            label.enableOutline = true;
            label.outlineColor = label.color.clone();
            label.outlineWidth = 2;
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
        btn.setPosition(0, -300, 0);

        const label = btn.addComponent(Label);
        label.string = '登  录';
        label.fontSize = 36;
        label.lineHeight = 42;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = TOKENS.white;
        applyInkOutline(label, 220, 3);

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
        btn.setPosition(0, -380, 0);

        const label = btn.addComponent(Label);
        label.string = '离线模式';
        label.fontSize = 30;
        label.lineHeight = 36;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = TOKENS.white;
        applyInkOutline(label, 200, 3);

        btn.on(Node.EventType.TOUCH_END, this.onOfflineClicked, this);
        this.offlineBtn = btn;
    }

    private onOfflineClicked(): void {
        if (this.offlineRequested) return;
        this.offlineRequested = true;
        this.setStatus('正在进入离线模式...');
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

    /** 设置进度目标值；实际填充由 update() 每帧平滑逼近，避免硬跳。 */
    private setProgress(ratio: number): void {
        this._target = Math.max(0, Math.min(ratio, 1));
    }

    /** 立即把给定比例渲染到进度条 / 进度头 / 百分比文字（由 update 驱动）。 */
    private applyProgress(r: number): void {
        const track = this.progressBar?.node.parent;
        const trackUt = track?.getComponent(UITransform);
        // 槽宽取自父级 ProgressBg（设计稿 566），fill 锚点在左侧从左向右生长。
        const full = trackUt && trackUt.width > 0 ? trackUt.width : 566;

        if (this.progressBar) {
            const ut = this.progressBar.getComponent(UITransform);
            if (ut) ut.width = full * r;
        }

        // 爪印金币进度头：沿轨道从左端随填充右移（与 ProgressBg 同父，x 对齐）。
        if (this.coinHead && track) {
            const tx = track.position.x;
            this.coinHead.setPosition(tx - full / 2 + full * r, this.coinHead.position.y, 0);
        }

        // 百分比文字（场景里进度条上方的 PctLabel）
        if (this.percentLabel) {
            this.percentLabel.string = `${Math.round(r * 100)}%`;
        }
    }
}
