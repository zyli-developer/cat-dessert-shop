/** 甜品数据 */
export interface DessertData {
  level: number;
  name: string;
  radius: number;
  score: number;
  /** 图片资源路径（textures/desserts/ 下） */
  texture: string;
}

/** 关卡配置 — 补充星级分数阈值 */
export interface LevelData {
  round: number;
  /** 关卡主题名（首页关卡卡展示，如「草莓季 · 午后」）。 */
  name: string;
  customers: CustomerData[];
  dropRange: [number, number];
  /** T1 焦糊曲奇掉落概率 0~1，缺省 0 = 不掉落（向后兼容的单档写法）。 */
  blockerChance?: number;
  /**
   * 多档障碍物掉落配置：每项 { level, chance }（level 见 DessertConfig 的 BLOCKER_LEVEL*）。
   * 配置后优先于 blockerChance；各 chance 之和应 < 1（其余为普通甜品）。
   */
  blockers?: { level: number; chance: number }[];
  star2Score: number;
  star3Score: number;
}

/** 单个顾客需求 */
export interface Demand {
  level: number;
  count: number;
}

/** 顾客配置 */
export interface CustomerData {
  demands: Demand[];
}

