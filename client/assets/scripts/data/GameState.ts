import { LevelData } from './GameTypes';
import { UserProfile } from '../net/ApiTypes';

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

  // 用户数据（来自服务端）
  userProfile: UserProfile | null = null;

  // 当前回合状态
  currentRound: number = 1;
  gold: number = INITIAL_GOLD;
  score: number = 0;
  mergeCount: number = 0;
  startTime: number = 0;

  // 关卡配置（从 JSON 加载）
  allLevels: LevelData[] = [];

  /** 重置回合内状态 */
  resetRound(): void {
    this.gold = INITIAL_GOLD;
    this.score = 0;
    this.mergeCount = 0;
    this.startTime = Date.now();
  }

  /** 增加金币 */
  addGold(amount: number): void {
    this.gold += amount;
  }

  /** 消费金币，余额不足返回 false */
  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  /** 增加分数 */
  addScore(points: number): void {
    this.score += points;
    this.mergeCount++;
  }

  /** 获取当前回合的关卡配置 */
  getCurrentLevel(): LevelData | null {
    if (this.currentRound <= 0 || this.currentRound > this.allLevels.length) {
      return null;
    }
    return this.allLevels[this.currentRound - 1];
  }

  /** 根据合成效率计算星级 */
  calcStars(): number {
    const elapsed = (Date.now() - this.startTime) / 1000;
    // 简单公式：基于用时和合成次数
    if (elapsed < this.currentRound * 30 && this.mergeCount >= this.currentRound * 5) return 3;
    if (this.mergeCount >= this.currentRound * 3) return 2;
    return 1;
  }

  /** 获取通关猫币奖励 */
  getCatCoinReward(stars: number): number {
    return CAT_COIN_REWARDS[stars] || 0;
  }
}
