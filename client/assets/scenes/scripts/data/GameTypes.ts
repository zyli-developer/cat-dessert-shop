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
  customers: CustomerData[];
  dropRange: [number, number];
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

