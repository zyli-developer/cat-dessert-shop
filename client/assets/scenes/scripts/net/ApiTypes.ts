export interface UserProfile {
  openId: string;
  nickname: string;
  avatar: string;
  catCoins: number;
  currentRound: number;
  highScore: number;
  stars: Record<string, number>;
  roundScores: Record<string, number>;
}

export interface AuthSession {
  user: UserProfile;
  accessToken: string;
}

export type RewardKind = 'home_ad' | 'win_double' | 'daily_gift' | 'daily_gift_double';

export interface RewardClaimResult extends UserProfile {
  awarded: number;
  alreadyClaimed: boolean;
}

export interface ProgressRankItem {
  nickname: string;
  avatar: string;
  score: number;
  currentRound?: number;
  isMe?: boolean;
}

export interface RankItem {
  nickname: string;
  avatar: string;
  highScore: number;
  currentRound: number;
  score?: number;
}
