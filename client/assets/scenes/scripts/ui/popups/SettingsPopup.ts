import { _decorator, Component, Node, Toggle, sys } from 'cc';
import { PopupManager } from '../PopupManager';
import { AudioManager } from '../../utils/AudioManager';
import { GlobalFontManager } from '../GlobalFontManager';
const { ccclass, property } = _decorator;

const STORAGE_KEY_BGM = 'settings_bgm';
const STORAGE_KEY_SFX = 'settings_sfx';

@ccclass('SettingsPopup')
export class SettingsPopup extends Component {
    @property(Toggle)
    bgmToggle: Toggle | null = null;

    @property(Toggle)
    sfxToggle: Toggle | null = null;

    @property(Node)
    btnClose: Node | null = null;

    onLoad(): void {
        // 应用全局字体
        GlobalFontManager.applyFont(this.node);

        // 加载持久化设置
        const bgmEnabled = sys.localStorage.getItem(STORAGE_KEY_BGM) !== 'false';
        const sfxEnabled = sys.localStorage.getItem(STORAGE_KEY_SFX) !== 'false';

        if (this.bgmToggle) this.bgmToggle.isChecked = bgmEnabled;
        if (this.sfxToggle) this.sfxToggle.isChecked = sfxEnabled;

        this.bgmToggle?.node.on('toggle', this.onBGMToggle, this);
        this.sfxToggle?.node.on('toggle', this.onSFXToggle, this);
        this.btnClose?.on(Node.EventType.TOUCH_END, this.onClose, this);
    }

    onDestroy(): void {
        if (this.bgmToggle?.node?.isValid) {
            this.bgmToggle.node.off('toggle', this.onBGMToggle, this);
        }
        if (this.sfxToggle?.node?.isValid) {
            this.sfxToggle.node.off('toggle', this.onSFXToggle, this);
        }
        if (this.btnClose?.isValid) {
            this.btnClose.off(Node.EventType.TOUCH_END, this.onClose, this);
        }
    }

    private onBGMToggle(toggle: Toggle): void {
        const enabled = toggle.isChecked;
        sys.localStorage.setItem(STORAGE_KEY_BGM, String(enabled));
        AudioManager.instance.setBGMEnabled(enabled);
    }

    private onSFXToggle(toggle: Toggle): void {
        const enabled = toggle.isChecked;
        sys.localStorage.setItem(STORAGE_KEY_SFX, String(enabled));
        AudioManager.instance.setSFXEnabled(enabled);
    }

    private onClose(): void {
        PopupManager.close();
    }
}
