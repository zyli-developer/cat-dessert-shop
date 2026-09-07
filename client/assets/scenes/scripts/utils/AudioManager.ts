import { AudioSource, AudioClip, assetManager, resources, Node, director, sys } from 'cc';
import { DouyinSDK } from '../platform/DouyinSDK';

/** 音频所在的分包 bundle 名（assets/bundles/audio，抖音端打成小游戏分包以瘦身主包） */
const AUDIO_BUNDLE = 'audio';

const KEY_BGM = 'settings_bgm';
const KEY_SFX = 'settings_sfx';
const KEY_VIBRATE = 'settings_vibration';

/**
 * 全局音频 / 触感管理（单例）。
 * 关键：挂在一个 **常驻根节点**（addPersistRootNode）上，BGM 跨场景不中断、只初始化一次。
 * 设置项（背景音乐 / 音效 / 震动）开机即从 localStorage 读取，开关有真实效果。
 */
export class AudioManager {
    private static _instance: AudioManager;
    static get instance(): AudioManager {
        if (!this._instance) this._instance = new AudioManager();
        return this._instance;
    }

    private node: Node | null = null;
    private bgmSource: AudioSource | null = null;
    private sfxSource: AudioSource | null = null;

    private bgmEnabled = true;
    private sfxEnabled = true;
    private vibrationEnabled = false;

    private lastBgmPath = '';

    /** 音频分包 bundle（懒加载，首次播放时拉取分包） */
    private audioBundle: { load: Function } | null = null;
    private bundleLoading: Promise<void> | null = null;

    /** 确保音频分包就绪（加载失败则置空走 resources 兜底）。 */
    private ensureBundle(): Promise<void> {
        if (this.audioBundle) return Promise.resolve();
        if (!this.bundleLoading) {
            this.bundleLoading = new Promise((resolve) => {
                assetManager.loadBundle(AUDIO_BUNDLE, (err: Error | null, bundle: any) => {
                    if (!err && bundle) this.audioBundle = bundle;
                    resolve();
                });
            });
        }
        return this.bundleLoading;
    }

    /**
     * 统一取音频剪辑：分包优先，resources 兜底（编辑器预览 / bundle 配置缺失时仍可发声）。
     * 外部路径形如 'audio/bgm_main'；bundle 内部资源名去掉 'audio/' 前缀。
     */
    private loadClip(clipPath: string, cb: (clip: AudioClip) => void): void {
        const inBundle = clipPath.startsWith('audio/') ? clipPath.slice('audio/'.length) : clipPath;
        void this.ensureBundle().then(() => {
            if (this.audioBundle) {
                this.audioBundle.load(inBundle, AudioClip, (err: Error | null, clip: AudioClip) => {
                    if (!err && clip) cb(clip);
                });
                return;
            }
            resources.load(clipPath, AudioClip, (err, clip) => {
                if (!err && clip) cb(clip as AudioClip);
            });
        });
    }

    /** 幂等初始化：首个场景（Loading）调用一次，之后跨场景常驻。 */
    init(_node?: Node): void {
        if (this.node && this.node.isValid) return;

        this.loadSettings();

        const node = new Node('AudioManager');
        // 常驻根节点：场景切换不销毁，BGM 不中断
        director.addPersistRootNode(node);
        this.node = node;
        this.bgmSource = node.addComponent(AudioSource);
        this.bgmSource.loop = true;
        this.sfxSource = node.addComponent(AudioSource);

        // 启动主 BGM（受开关控制）
        this.playBGM('audio/bgm_main');
    }

    private loadSettings(): void {
        // 默认：音乐/音效开，震动关（与设计稿 settings.html 一致）
        this.bgmEnabled = sys.localStorage.getItem(KEY_BGM) !== 'false';
        this.sfxEnabled = sys.localStorage.getItem(KEY_SFX) !== 'false';
        this.vibrationEnabled = sys.localStorage.getItem(KEY_VIBRATE) === 'true';
    }

    // --- BGM ---

    playBGM(clipPath: string): void {
        this.lastBgmPath = clipPath;
        if (!this.bgmEnabled || !this.bgmSource) return;
        this.loadClip(clipPath, (clip) => {
            if (!this.bgmSource) return;
            this.bgmSource.clip = clip;
            this.bgmSource.play();
        });
    }

    stopBGM(): void {
        this.bgmSource?.stop();
    }

    setBGMEnabled(enabled: boolean): void {
        this.bgmEnabled = enabled;
        sys.localStorage.setItem(KEY_BGM, String(enabled));
        if (!enabled) {
            this.stopBGM();
        } else if (this.lastBgmPath) {
            // 重新开启 → 续播主 BGM
            this.playBGM(this.lastBgmPath);
        }
    }

    isBGMEnabled(): boolean { return this.bgmEnabled; }

    // --- SFX ---

    playSFX(clipPath: string): void {
        if (!this.sfxEnabled || !this.sfxSource) return;
        this.loadClip(clipPath, (clip) => {
            this.sfxSource?.playOneShot(clip);
        });
    }

    setSFXEnabled(enabled: boolean): void {
        this.sfxEnabled = enabled;
        sys.localStorage.setItem(KEY_SFX, String(enabled));
    }

    isSFXEnabled(): boolean { return this.sfxEnabled; }

    // --- 触感（震动）---

    /** 一次轻震（合成 / 完成订单时调用），受震动开关控制。 */
    vibrate(): void {
        if (!this.vibrationEnabled) return;
        const tt = DouyinSDK.getTT();
        if (tt && typeof tt.vibrateShort === 'function') {
            try { tt.vibrateShort({}); } catch { /* 宿主不支持则忽略 */ }
        }
    }

    setVibrationEnabled(enabled: boolean): void {
        this.vibrationEnabled = enabled;
        sys.localStorage.setItem(KEY_VIBRATE, String(enabled));
        if (enabled) this.vibrate(); // 开启时给一次即时反馈
    }

    isVibrationEnabled(): boolean { return this.vibrationEnabled; }
}
