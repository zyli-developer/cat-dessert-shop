import { LevelData } from './GameTypes';
import { UserProfile } from '../net/ApiTypes';
import { EventTarget } from 'cc';

/** 猫币通关奖励 */
const CAT_COIN_REWARDS: Record<number, number> = { 1: 5, 2: 10, 3: 20 };

/** 每回合初始金币 */
const INITIAL_GOLD = 15;
const OFFLINE_PROFILE_KEY = 'catbakery_offline_profile_v1';
const PENDING_PROGRESS_KEY = 'catbakery_pending_progress_v1';
const MAX_PENDING_PROGRESS = 120;

export interface PendingProgress {
  openId: string;
  round: number;
  score: number;
  stars: number;
  updatedAt: number;
}

/** KV storage seam for tests. Default wraps `tt.*StorageSync` (抖音小游戏持久化接口)。 */
export interface KVStorage {
  get(k: string): string;
  set(k: string, v: string): void;
  remove(k: string): void;
}

const platformStorage: KVStorage = {
  get: (k) => {
    const tt = (globalThis as any).tt;
    if (typeof tt?.getStorageSync === 'function') return String(tt.getStorageSync(k) ?? '');
    return String((globalThis as any).localStorage?.getItem?.(k) ?? '');
  },
  set: (k, v) => {
    const tt = (globalThis as any).tt;
    if (typeof tt?.setStorageSync === 'function') tt.setStorageSync(k, v);
    else (globalThis as any).localStorage?.setItem?.(k, v);
  },
  remove: (k) => {
    const tt = (globalThis as any).tt;
    if (typeof tt?.removeStorageSync === 'function') tt.removeStorageSync(k);
    else (globalThis as any).localStorage?.removeItem?.(k);
  },
};

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

  /** Injectable storage seam (test-only). Defaults to tt-storage wrapper. */
  private storage: KVStorage = platformStorage;
  public setStorage(s: KVStorage): void { this.storage = s; }

  /** 读取离线档案；损坏或旧格式数据会被安全忽略。 */
  loadOfflineProfile(): UserProfile {
    const fallback = this.createOfflineProfile();
    try {
      const raw = this.storage.get(OFFLINE_PROFILE_KEY);
      if (!raw) return fallback;
      const value = JSON.parse(raw) as Partial<UserProfile>;
      if (!value || typeof value !== 'object') return fallback;
      return {
        openId: 'dev-offline',
        nickname: typeof value.nickname === 'string' && value.nickname ? value.nickname : fallback.nickname,
        avatar: typeof value.avatar === 'string' ? value.avatar : '',
        catCoins: this.safeNonNegativeInt(value.catCoins),
        currentRound: Math.max(1, this.safeNonNegativeInt(value.currentRound, 1)),
        highScore: this.safeNonNegativeInt(value.highScore),
        stars: this.sanitizeNumberMap(value.stars, 3),
        roundScores: this.sanitizeNumberMap(value.roundScores),
      };
    } catch (error) {
      console.warn('[GameState] Ignoring invalid offline profile', error);
      return fallback;
    }
  }

  /** 保存离线档案。在线账号不会写入离线槽位。 */
  persistOfflineProfile(): void {
    if (this.userProfile?.openId !== 'dev-offline') return;
    try {
      this.storage.set(OFFLINE_PROFILE_KEY, JSON.stringify(this.userProfile));
    } catch (error) {
      console.warn('[GameState] Failed to persist offline profile', error);
    }
  }

  /** 删除指定账号，或在拒绝隐私协议时清除全部本机档案与待同步记录。 */
  clearPersonalData(openId?: string): void {
    if (openId) {
      const remaining = this.readPendingProgress().filter((entry) => entry.openId !== openId);
      this.writePendingProgress(remaining);
    } else {
      this.writePendingProgress([]);
    }
    this.storage.remove(OFFLINE_PROFILE_KEY);
    this.userProfile = null;
    this.currentRound = 1;
    this.resetRound();
    this.events.emit('profile-changed');
  }

  /**
   * Persist an online result before attempting the network request. Entries are
   * isolated by openId and de-duplicated by round so a retry cannot downgrade a
   * better score already queued for the same player.
   */
  queuePendingProgress(openId: string, round: number, score: number, stars: number): void {
    const normalizedOpenId = openId.trim();
    if (
      !normalizedOpenId || normalizedOpenId === 'dev-offline' ||
      !Number.isInteger(round) || round < 1 ||
      !Number.isInteger(score) || score < 0 ||
      !Number.isInteger(stars) || stars < 1 || stars > 3
    ) return;

    const queue = this.readPendingProgress();
    const existing = queue.find((entry) =>
      entry.openId === normalizedOpenId && entry.round === round,
    );
    if (existing) {
      if (score < existing.score) return;
      existing.score = score;
      existing.stars = stars;
      existing.updatedAt = Date.now();
    } else {
      queue.push({ openId: normalizedOpenId, round, score, stars, updatedAt: Date.now() });
    }
    this.writePendingProgress(queue);
  }

  getPendingProgress(openId: string): PendingProgress[] {
    return this.readPendingProgress()
      .filter((entry) => entry.openId === openId)
      .sort((a, b) => a.round - b.round || a.updatedAt - b.updatedAt)
      .map((entry) => ({ ...entry }));
  }

  hasPendingProgress(openId: string, round: number): boolean {
    return this.readPendingProgress().some((entry) =>
      entry.openId === openId && entry.round === round,
    );
  }

  /** Remove only the submitted version; a better result queued mid-request survives. */
  acknowledgePendingProgress(submitted: PendingProgress): void {
    const queue = this.readPendingProgress().filter((entry) => {
      if (entry.openId !== submitted.openId || entry.round !== submitted.round) return true;
      return entry.score > submitted.score;
    });
    this.writePendingProgress(queue);
  }

  private readPendingProgress(): PendingProgress[] {
    try {
      const raw = this.storage.get(PENDING_PROGRESS_KEY);
      if (!raw) return [];
      const value = JSON.parse(raw) as unknown;
      if (!Array.isArray(value)) return [];
      return value.flatMap((entry): PendingProgress[] => {
        if (!entry || typeof entry !== 'object') return [];
        const candidate = entry as Partial<PendingProgress>;
        if (
          typeof candidate.openId !== 'string' || !candidate.openId ||
          !Number.isInteger(candidate.round) || (candidate.round ?? 0) < 1 ||
          !Number.isInteger(candidate.score) || (candidate.score ?? -1) < 0 ||
          !Number.isInteger(candidate.stars) || (candidate.stars ?? 0) < 1 || (candidate.stars ?? 0) > 3
        ) return [];
        return [{
          openId: candidate.openId,
          round: candidate.round!,
          score: candidate.score!,
          stars: candidate.stars!,
          updatedAt: Number.isFinite(candidate.updatedAt) ? Math.max(0, Math.floor(candidate.updatedAt!)) : 0,
        }];
      });
    } catch (error) {
      console.warn('[GameState] Ignoring invalid pending progress queue', error);
      return [];
    }
  }

  private writePendingProgress(entries: PendingProgress[]): void {
    try {
      if (!entries.length) {
        this.storage.remove(PENDING_PROGRESS_KEY);
        return;
      }
      const bounded = entries
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .slice(-MAX_PENDING_PROGRESS);
      this.storage.set(PENDING_PROGRESS_KEY, JSON.stringify(bounded));
    } catch (error) {
      console.warn('[GameState] Failed to persist pending progress queue', error);
    }
  }

  private createOfflineProfile(): UserProfile {
    return {
      openId: 'dev-offline', nickname: '离线玩家', avatar: '', catCoins: 0,
      currentRound: 1, highScore: 0, stars: {}, roundScores: {},
    };
  }

  private safeNonNegativeInt(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : fallback;
  }

  private sanitizeNumberMap(value: unknown, max = Number.MAX_SAFE_INTEGER): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: Record<string, number> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (!/^\d+$/.test(key)) continue;
      result[key] = Math.min(max, this.safeNonNegativeInt(entry));
    }
    return result;
  }

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
