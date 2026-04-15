import { DessertData } from './GameTypes';

export const DESSERTS: DessertData[] = [
  { level: 1, name: '饼干',     radius: 20,  score: 0,    texture: 'textures/desserts/dessert_lv1_cookie' },
  { level: 2, name: '曲奇',     radius: 28,  score: 10,   texture: 'textures/desserts/dessert_lv2_cookie2' },
  { level: 3, name: '泡芙',     radius: 36,  score: 20,   texture: 'textures/desserts/dessert_lv3_puff' },
  { level: 4, name: '铜锣烧',   radius: 46,  score: 40,   texture: 'textures/desserts/dessert_lv4_dorayaki' },
  { level: 5, name: '鲷鱼烧',   radius: 56,  score: 80,   texture: 'textures/desserts/dessert_lv5_taiyaki' },
  { level: 6, name: '瑞士卷',   radius: 68,  score: 160,  texture: 'textures/desserts/dessert_lv6_swissroll' },
  { level: 7, name: '蛋糕卷',   radius: 80,  score: 320,  texture: 'textures/desserts/dessert_lv7_cakeroll' },
  { level: 8, name: '奶油蛋糕', radius: 94,  score: 640,  texture: 'textures/desserts/dessert_lv8_cream_cake' },
];

export const MAX_LEVEL = DESSERTS.length;

export function getDessert(level: number): DessertData {
  return DESSERTS[level - 1];
}

/** 两个 Lv8 合成奖励的金币数 */
export const LV8_MERGE_GOLD = 50;

/** Lv8 消除奖励分数 */
export const LV8_MERGE_SCORE = 1000;

/** 服务顾客奖励分数 */
export const CUSTOMER_SERVE_SCORE = 50;
