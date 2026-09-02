import { sanitizePublicAvatar, sanitizePublicNickname } from './content-safety';

describe('public profile content safety', () => {
  it('keeps ordinary nicknames and normalizes whitespace', () => {
    expect(sanitizePublicNickname('  开心 猫咪  ')).toBe('开心 猫咪');
  });

  it.each(['加微信abc', '赌博高手', 'https://example.com', '裸聊群'])(
    'replaces risky nickname %s with a safe fallback',
    (nickname) => expect(sanitizePublicNickname(nickname)).toBe('猫店玩家'),
  );

  it('removes control and unsupported symbol characters', () => {
    expect(sanitizePublicNickname('猫\u200b咪🐱')).toBe('猫咪');
  });

  it('allows only HTTPS avatar URLs from trusted platform CDNs', () => {
    expect(sanitizePublicAvatar('https://p3.douyinpic.com/a.jpg')).toContain(
      'douyinpic.com',
    );
    expect(sanitizePublicAvatar('http://p3.douyinpic.com/a.jpg')).toBe('');
    expect(sanitizePublicAvatar('https://evil.example/a.jpg')).toBe('');
  });
});
