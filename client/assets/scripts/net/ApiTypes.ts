export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface UserProfile {
  openId: string;
  nickname: string;
  avatar: string;
  catCoins: number;
  currentRound: number;
  highScore: number;
  stars: Record<string, number>;
}

export interface RankItem {
  nickname: string;
  avatar: string;
  highScore: number;
  currentRound: number;
}
