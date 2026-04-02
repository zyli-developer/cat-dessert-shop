/** 甜品数据 */
export interface DessertData {
  level: number;
  name: string;
  radius: number;
  score: number;
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

/** 关卡配置 */
export interface LevelData {
  round: number;
  customers: CustomerData[];
  dropRange: [number, number];
}
