import { AudioSource, AudioClip, resources, Node } from 'cc';

export class AudioManager {
    private static _instance: AudioManager;

    static get instance(): AudioManager {
        if (!this._instance) this._instance = new AudioManager();
        return this._instance;
    }

    private bgmSource: AudioSource | null = null;
    private sfxSource: AudioSource | null = null;
    private bgmEnabled: boolean = true;
    private sfxEnabled: boolean = true;

    init(node: Node): void {
        this.bgmSource = node.addComponent(AudioSource);
        this.sfxSource = node.addComponent(AudioSource);
        this.bgmSource.loop = true;
    }

    playBGM(clipPath: string): void {
        if (!this.bgmEnabled || !this.bgmSource) return;
        resources.load(clipPath, AudioClip, (err, clip) => {
            if (err || !this.bgmSource) return;
            this.bgmSource.clip = clip;
            this.bgmSource.play();
        });
    }

    stopBGM(): void {
        this.bgmSource?.stop();
    }

    playSFX(clipPath: string): void {
        if (!this.sfxEnabled || !this.sfxSource) return;
        resources.load(clipPath, AudioClip, (err, clip) => {
            if (err || !this.sfxSource) return;
            this.sfxSource.playOneShot(clip);
        });
    }

    setBGMEnabled(enabled: boolean): void {
        this.bgmEnabled = enabled;
        if (!enabled) this.stopBGM();
    }

    setSFXEnabled(enabled: boolean): void {
        this.sfxEnabled = enabled;
    }

    isBGMEnabled(): boolean { return this.bgmEnabled; }
    isSFXEnabled(): boolean { return this.sfxEnabled; }
}
