import { DessertData } from './GameTypes';

/** 不可合成障碍物的数据：在普通甜品基础上带「破坏条件」。 */
export interface BlockerData extends DessertData {
  /** 裂纹叠加层贴图 */
  crackTexture: string;
  /** 相邻合成出 ≥ 此等级的甜品才会震击它（越高越硬） */
  crackTriggerLevel: number;
  /** 累计几次震击后震碎清除 */
  hitsToBreak: number;
  /** 震碎奖励分数 */
  shatterScore: number;
}

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

/**
 * 不可合成障碍物分档（多档难度）：
 *   T1 焦糊曲奇  level 0：相邻 ≥Lv4 合成可破坏 —— 早关的「软」填充
 *   T2 冰封蛋糕  level -1：相邻 ≥Lv6 合成才破坏 —— 后关的「硬」障碍
 * 共性：不与任何甜品合成（MergeManager 跳过）、不计分、占容器空间并参与溢出判定，
 * 也可用锤子道具直接敲掉。破坏阈值随档位升高，使后期关卡的障碍真正更难清除。
 */
export const BLOCKER_LEVEL = 0;       // T1 焦糊曲奇（保留旧常量名，向后兼容）
export const BLOCKER_LEVEL_T2 = -1;   // T2 冰封蛋糕

/** 合成中点到障碍中心 ≤ (两者半径之和 + 此余量) 判定为「相邻」 */
export const BLOCKER_CRACK_ADJACENCY_MARGIN = 26;

export const BLOCKERS: Record<number, BlockerData> = {
  [BLOCKER_LEVEL]: {
    level: BLOCKER_LEVEL,
    name: '焦糊曲奇',
    radius: 30,
    score: 0,
    texture: 'textures/desserts/dessert_blocker',
    crackTexture: 'textures/desserts/dessert_blocker_crack',
    crackTriggerLevel: 4,
    hitsToBreak: 2,
    shatterScore: 30,
  },
  [BLOCKER_LEVEL_T2]: {
    level: BLOCKER_LEVEL_T2,
    name: '冰封蛋糕',
    radius: 32,
    score: 0,
    texture: 'textures/desserts/dessert_blocker_ice',
    crackTexture: 'textures/desserts/dessert_blocker_ice_crack',
    crackTriggerLevel: 6,
    hitsToBreak: 2,
    shatterScore: 60,
  },
};

/** 跨所有档位的最低破坏阈值（用于 MergeManager 提前剪枝，避免每次小合成都扫描） */
export const MIN_BLOCKER_CRACK_TRIGGER = Math.min(
  ...Object.values(BLOCKERS).map((b) => b.crackTriggerLevel),
);

// --- 向后兼容的 T1 常量别名（旧代码/测试仍在引用）---
export const BLOCKER: BlockerData = BLOCKERS[BLOCKER_LEVEL];
export const BLOCKER_CRACK_TEXTURE = BLOCKER.crackTexture;
export const BLOCKER_CRACK_TRIGGER_LEVEL = BLOCKER.crackTriggerLevel;
export const BLOCKER_HITS_TO_BREAK = BLOCKER.hitsToBreak;
export const BLOCKER_SHATTER_SCORE = BLOCKER.shatterScore;

/** 是否为不可合成障碍物（任意档位） */
export function isBlocker(level: number): boolean {
  return BLOCKERS[level] !== undefined;
}

/** 取障碍物配置；非障碍返回 null。 */
export function getBlocker(level: number): BlockerData | null {
  return BLOCKERS[level] ?? null;
}

export function getDessert(level: number): DessertData {
  return BLOCKERS[level] ?? DESSERTS[level - 1];
}

/** 两个 Lv8 合成奖励的金币数 */
export const LV8_MERGE_GOLD = 50;

/** Lv8 消除奖励分数 */
export const LV8_MERGE_SCORE = 1000;

/** 服务顾客奖励分数 */
export const CUSTOMER_SERVE_SCORE = 50;
