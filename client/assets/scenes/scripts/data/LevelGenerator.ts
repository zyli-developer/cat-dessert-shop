import { LevelData, CustomerData, Demand } from './GameTypes';
import { MAX_LEVEL, BLOCKER_LEVEL, BLOCKER_LEVEL_T2 } from './DessertConfig';

/**
 * 程序化关卡生成器。
 *
 * 手工关（configs/levels.json）作为前缀保留不动；之后的关卡由 `generateLevel` 按
 * 关卡号**确定性**地算出来——同一关号永远生成同一关，保证公平、可复现、可单测。
 * 难度从手工关末尾的水位继续上爬，约 20 关后机制难度趋于平台，星级阈值持续上调
 * （通关始终可达，3 星追求无封顶）。
 */

/**
 * 战役总关数（含手工关）。合成玩法难度在 Lv8 天花板 + 障碍封顶后约 20 关到平台，
 * 故战役收在 30 关：R1-10 手工陡升、R11-30 生成关爬到机制天花板后收尾（有终点）。
 * 想做更长更难的战役需抬天花板（加 Lv9/Lv10 甜品 + 新机制），而非单纯调大此值。
 */
export const TOTAL_ROUNDS = 30;

/** 每生成一关，3 星阈值在上一关基础上的增量（延续手工关的上升曲线）。 */
const STAR3_GROWTH_PER_ROUND = 4200;

/** 没有手工关时的 3 星阈值兜底基线。 */
const FALLBACK_BASE_STAR3 = 31500;

/** 32-bit 确定性伪随机（mulberry32）。 */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const THEMES = ['霜糖', '莓酱', '焦糖', '抹茶', '蜜桃', '可可', '香草', '栗子', '柚子', '海盐'];
const MOMENTS = ['黎明', '正午', '黄昏', '星夜', '月光', '晨雾', '暮色', '极夜'];

/**
 * 按关卡号确定性生成一关。
 * @param round       关卡号（应 > curatedCount）
 * @param curatedCount 手工关数量（生成关从此后开始计难度增量）
 * @param baseStar3   手工关末尾的 3 星阈值，作为继续上爬的基线
 */
export function generateLevel(round: number, curatedCount: number, baseStar3: number): LevelData {
    const rng = mulberry32((round * 2654435761) >>> 0);
    const g = round - curatedCount; // 第几个生成关：1,2,3,...
    const ramp = Math.min(Math.max(g, 1), 20); // 机制难度约 20 关到顶

    // 主订单为顶级 / 双倍的概率，随关卡缓升后封顶。
    // 起步基线对齐手工末关的订单强度，避免进入生成关时出现「完成难度反而变轻」的断档。
    const pTop = Math.min(0.6, 0.34 + ramp * 0.013);
    const pDouble = Math.min(0.7, 0.48 + ramp * 0.011);

    const top = MAX_LEVEL; // 8
    const mid = MAX_LEVEL - 1; // 7
    const low = MAX_LEVEL - 2; // 6

    const customers: CustomerData[] = [];
    for (let i = 0; i < 8; i++) {
        const r = rng();
        const primary = r < pTop ? top : r < pTop + 0.3 ? mid : low;
        const count = 1 + (rng() < pDouble ? 1 : 0);
        const demands: Demand[] = [{ level: primary, count }];
        // ~35% 追加一个中级副需求，丰富订单层次
        if (rng() < 0.35) {
            demands.push({ level: rng() < 0.5 ? MAX_LEVEL - 3 : MAX_LEVEL - 2, count: 1 + (rng() < 0.4 ? 1 : 0) });
        }
        customers.push({ demands });
    }

    // 冰封障碍概率随关卡缓升并封顶，保证通关仍可达（总障碍 ≈ 0.05 + ≤0.15）
    const t2 = Math.min(0.15, 0.12 + g * 0.004);
    const blockers = [
        { level: BLOCKER_LEVEL, chance: 0.05 },
        { level: BLOCKER_LEVEL_T2, chance: Math.round(t2 * 1000) / 1000 },
    ];

    const star3 = baseStar3 + g * STAR3_GROWTH_PER_ROUND;
    const star2 = Math.round(star3 * 0.65);

    const name = `${THEMES[round % THEMES.length]}狂想 · ${MOMENTS[round % MOMENTS.length]}`;

    return {
        round,
        name,
        customers,
        dropRange: [1, 3],
        blockers,
        star2Score: star2,
        star3Score: star3,
    };
}

/**
 * 以手工关为前缀，补足程序化关卡到 totalRounds 关。
 * 手工关原样保留；其后每关由 generateLevel 延续难度生成。
 */
export function buildLevels(curated: LevelData[], totalRounds: number = TOTAL_ROUNDS): LevelData[] {
    const out = curated.slice();
    const baseStar3 = curated.length ? curated[curated.length - 1].star3Score : FALLBACK_BASE_STAR3;
    for (let round = curated.length + 1; round <= totalRounds; round++) {
        out.push(generateLevel(round, curated.length, baseStar3));
    }
    return out;
}
