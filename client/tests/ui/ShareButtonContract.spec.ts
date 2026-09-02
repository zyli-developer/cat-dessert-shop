import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../assets/scenes/scripts', relativePath), 'utf8');
}

describe('share and platform button contracts', () => {
  it('binds the Home share icon to sharing, not the sidebar action', () => {
    const source = readSource('ui/HomeScene.ts');
    expect(source).toContain('this.bindBtn(this.btnShare, this.onShareClicked)');
    expect(source).not.toContain('this.bindBtn(this.btnShare, this.onSidebarClicked)');
  });

  it('keeps sidebar navigation on its own accurately named button', () => {
    const source = readSource('ui/HomeScene.ts');
    expect(source).toContain("new Node('BtnSidebar')");
    expect(source).toContain("label.string = '去侧边栏'");
    expect(source).toContain('btn.on(Node.EventType.TOUCH_END, this.onSidebarClicked, this)');
  });

  it('keeps the sidebar entry compact and inside the safe-area top HUD group', () => {
    const source = readSource('ui/HomeScene.ts');
    expect(source).toContain("const right = ['BtnSidebar', 'BtnShare', 'BtnSettings']");
    expect(source).toContain('const W = 148, H = 60');
    expect(source).not.toContain('btn.setPosition(190, 470, 0)');
  });

  it('uses a closeable guide before navigating to the host sidebar', () => {
    const source = readSource('ui/HomeScene.ts');
    expect(source).toContain("new Node('SidebarGuide')");
    expect(source).toContain("new Node('BtnClose')");
    expect(source).toContain("'去首页侧边栏'");
    expect(source).toContain('void this.navigateToSidebar()');
  });

});
