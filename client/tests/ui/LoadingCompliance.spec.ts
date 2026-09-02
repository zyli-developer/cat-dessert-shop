import { Graphics, Node } from 'cc';
import { LoadingScene } from '../../assets/scenes/scripts/ui/LoadingScene';
import { TOKENS } from '../../assets/scenes/scripts/ui/DesignTokens';
import { hasPrivacyConsent } from '../../assets/scenes/scripts/ui/PrivacyPolicy';

describe('LoadingScene compliance and privacy gate', () => {
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('shows the privacy choice after the health notice and keeps login blocked', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const scene = new LoadingScene();
    scene.node = new Node('Loading');
    (scene as any).resourcesReady = true;

    (scene as any).createComplianceNotice();

    (scene as any).createLoginButton();
    const loginButton = scene.node.getChildByName('LoginButton');

    const complianceNotice = scene.node.getChildByName('ComplianceNotice');
    const noticeCard = complianceNotice?.getChildByName('NoticeCard');
    expect(complianceNotice).not.toBeNull();
    expect(noticeCard).not.toBeNull();
    expect(complianceNotice?.getComponent(Graphics)?.fillColor).toMatchObject(TOKENS.paper);
    expect(noticeCard?.getComponent(Graphics)?.fillColor).toMatchObject(TOKENS.sand);
    expect(noticeCard?.getChildByName('TitleChip')).not.toBeNull();
    expect(noticeCard?.getChildByName('NoticeContentPanel')?.getComponent(Graphics)?.fillColor)
      .toMatchObject(TOKENS.paper2);
    expect(noticeCard?.getChildByName('CopyrightPanel')).not.toBeNull();
    expect(noticeCard?.getChildByName('CountdownChip')).not.toBeNull();
    expect(loginButton).not.toBeNull();
    expect(loginButton?.active).toBe(false);
    expect(scene.scheduleOnce).toHaveBeenCalledWith(expect.any(Function), 3);

    const close = (scene.scheduleOnce as jest.Mock).mock.calls[0][0] as () => void;
    close();
    expect(scene.node.getChildByName('ComplianceNotice')).toBeNull();
    expect(scene.node.getChildByName('PrivacyConsentDialog')).not.toBeNull();
    expect(loginButton?.active).toBe(false);
    expect(hasPrivacyConsent()).toBe(false);
  });

  it('records explicit consent before starting platform login', () => {
    const scene = new LoadingScene();
    scene.node = new Node('Loading');
    (scene as any).resourcesReady = true;
    (scene as any).createLoginButton();
    const login = jest.spyOn(scene as any, 'doLogin').mockResolvedValue(undefined);

    (scene as any).showPrivacyConsentIfReady();
    const dialog = scene.node.getChildByName('PrivacyConsentDialog');
    const accept = dialog?.getChildByName('Card')?.getChildByName('同意并登录');
    expect(accept).not.toBeNull();

    accept?.emit(Node.EventType.TOUCH_END);
    expect(hasPrivacyConsent()).toBe(true);
    expect(login).toHaveBeenCalledTimes(1);
    expect(scene.node.getChildByName('PrivacyConsentDialog')).toBeNull();
  });

  it('enters local-only mode when the user refuses consent', () => {
    const scene = new LoadingScene();
    scene.node = new Node('Loading');
    (scene as any).resourcesReady = true;
    (scene as any).createLoginButton();
    const offline = jest.spyOn(scene as any, 'onOfflineClicked').mockImplementation(() => undefined);

    (scene as any).showPrivacyConsentIfReady();
    const reject = scene.node.getChildByName('PrivacyConsentDialog')
      ?.getChildByName('Card')?.getChildByName('不同意，使用离线模式');
    expect(reject).not.toBeNull();

    reject?.emit(Node.EventType.TOUCH_END);
    expect(hasPrivacyConsent()).toBe(false);
    expect(offline).toHaveBeenCalledTimes(1);
  });
});
