import { LevelData } from './GameTypes';
import { UserProfile } from '../net/ApiTypes';
import { EventTarget } from 'cc';

/** 猫币通关奖励 */
const CAT_COIN_REWARDS: Record<number, number> = { 1: 5, 2: 10, 3: 20 };

/** 每回合初始金币 */
const INITIAL_GOLD = 15;

export class GameState {
  private static _instance: GameState | null = null;

  static get instance(): GameState {
    if (!this._instance) {
      this._instance = new GameState();
    }
    return this._instance;
  }

  /** 分数/金币变化事件 */
  readonly events = new EventTarget();

  // 用户数据（来自服务端）
  userProfile: UserProfile | null = null;

  // 当前回合状态
  currentRound: number = 1;
  gold: number = INITIAL_GOLD;
  score: number = 0;
  mergeCount: number = 0;

  // 关卡配置（从 JSON 加载）
  allLevels: LevelData[] = [];

  resetRound(): void {
    this.gold = INITIAL_GOLD;
    this.score = 0;
    this.mergeCount = 0;
  }

  addGold(amount: number): void {
    this.gold += amount;
    this.events.emit('gold-changed', this.gold);
  }

  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.events.emit('gold-changed', this.gold);
    return true;
  }

  addScore(points: number): void {
    this.score += points;
    this.events.emit('score-changed', this.score);
  }

  addMerge(): void {
    this.mergeCount++;
  }

  getCurrentLevel(): LevelData | null {
    if (this.currentRound <= 0 || this.currentRound > this.allLevels.length) {
      return null;
    }
    return this.allLevels[this.currentRound - 1];
  }

  /** 按分数阈值计算星级 */
  calcStars(): number {
    const level = this.getCurrentLevel();
    if (!level) return 1;

    if (this.score >= level.star3Score) return 3;
    if (this.score >= level.star2Score) return 2;
    return 1;
  }

  getCatCoinReward(stars: number): number {
    return CAT_COIN_REWARDS[stars] || 0;
  }

  /** 累计已获得星数（各关最高星之和） */
  getTotalStarsCount(): number {
    const map = this.userProfile?.stars;
    if (!map) return 0;
    return Object.values(map).reduce((sum, v) => sum + Number(v), 0);
  }

  /** 将 `/api/user/progress` 返回的数据写回内存（通关后 Home 才能显示最新猫币/星级） */
  applyProgressFromApi(data: {
    catCoins: number;
    currentRound: number;
    highScore: number;
    stars: Record<string, number>;
    roundScores: Record<string, number>;
  }): void {
    if (!this.userProfile) return;
    this.userProfile.catCoins = data.catCoins;
    this.userProfile.currentRound = data.currentRound;
    this.userProfile.highScore = data.highScore;
    this.userProfile.stars = { ...data.stars };
    this.userProfile.roundScores = { ...data.roundScores };
    this.events.emit('profile-changed');
  }
}
