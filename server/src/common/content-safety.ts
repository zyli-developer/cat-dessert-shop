const DEFAULT_NICKNAME = '猫店玩家';

const BLOCKED_TEXT = [
  /(?:https?:\/\/|www\.|\.com\b|\.cn\b)/iu,
  /(?:微信|威信|微\s*信|vx|v信|qq|扣扣|群号|加群|手机号|电话)/iu,
  /(?:赌博|博彩|赌场|下注|代充|返利|色情|约炮|裸聊|毒品|枪支|炸弹)/iu,
  /(?:恐怖主义|极端主义|邪教|反政府|颠覆国家)/iu,
];

const TRUSTED_AVATAR_HOSTS = [
  'douyinpic.com',
  'douyincdn.com',
  'byteimg.com',
  'zijiecdn.com',
];

/** Normalize public profile text and fail closed when it contains risky content. */
export function sanitizePublicNickname(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_NICKNAME;
  const withoutControls = Array.from(value.normalize('NFKC'))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && !(codePoint >= 127 && codePoint <= 159);
    })
    .join('');
  const normalized = withoutControls
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized || BLOCKED_TEXT.some((pattern) => pattern.test(normalized))) {
    return DEFAULT_NICKNAME;
  }
  const safe = normalized
    .replace(/[^\p{L}\p{N}\p{Script=Han}_·\- ]/gu, '')
    .trim()
    .slice(0, 20);
  return safe || DEFAULT_NICKNAME;
}

/** Only retain HTTPS avatar URLs served by known Douyin/ByteDance CDNs. */
export function sanitizePublicAvatar(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return '';
    return TRUSTED_AVATAR_HOSTS.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    )
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}
