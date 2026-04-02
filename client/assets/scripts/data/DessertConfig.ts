import { DessertData } from './GameTypes';

export const DESSERTS: DessertData[] = [
  { level: 1, name: '饼干',     radius: 25,  score: 1 },
  { level: 2, name: '曲奇',     radius: 32,  score: 2 },
  { level: 3, name: '泡芙',     radius: 40,  score: 4 },
  { level: 4, name: '铜锣烧',   radius: 50,  score: 8 },
  { level: 5, name: '鲷鱼烧',   radius: 60,  score: 16 },
  { level: 6, name: '瑞士卷',   radius: 72,  score: 32 },
  { level: 7, name: '蛋糕卷',   radius: 85,  score: 64 },
  { level: 8, name: '奶油蛋糕', radius: 100, score: 128 },
];

export const MAX_LEVEL = DESSERTS.length;

export function getDessert(level: number): DessertData {
  return DESSERTS[level - 1];
}

/** 两个 Lv8 合成奖励的金币数 */
export const LV8_MERGE_GOLD = 50;
