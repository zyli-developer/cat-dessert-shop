/**
 * 设计令牌中枢 —— 治愈手绘烘焙风 UI 改版。
 *
 * 数值依据 `docs/ui-mockup/cocos-mapping.md` §1 色板与 `prefab-spec.md` 果冻按钮语义色。
 * 单一来源：所有 UI 颜色 / 描边 / 果冻按钮变体都从这里取，避免散落的黑描边与紫灰配色。
 *
 * 核心原则：删掉所有纯黑描边，统一用暖棕 INK (#5A4636)。
 */
import { Color, Label } from 'cc';

/** 把令牌克隆出去，避免调用方意外修改共享的 Color 实例。 */
export function cloneColor(c: Color): Color {
    return new Color(c.r, c.g, c.b, c.a);
}

// --- 色板（cocos-mapping.md §1，RGBA 0–255）---
export const TOKENS = {
    // 纸底 / 面板
    paper: new Color(255, 247, 236, 255),   // #FFF7EC 页面纸底
    paper2: new Color(255, 253, 248, 255),  // #FFFDF8 卡片象牙白
    sand: new Color(246, 232, 208, 255),    // #F6E8D0 面板砂色
    sand2: new Color(240, 219, 187, 255),   // #F0DBBB 面板深砂

    // 文字 / 描边（暖棕系，替换所有黑色）
    ink: new Color(90, 70, 54, 255),        // #5A4636 主文字 / 描边
    inkSoft: new Color(138, 114, 89, 255),  // #8A7259 次级文字
    inkMute: new Color(181, 156, 128, 255), // #B59C80 弱文字 / 禁用

    // 分隔 / 描边线
    line: new Color(236, 218, 191, 255),    // #ECDABF 细分隔线
    line2: new Color(220, 193, 151, 255),   // #DCC197 卡片柔描边

    // 主 CTA 草莓粉
    pink: new Color(245, 135, 155, 255),    // #F5879B
    pinkHi: new Color(255, 157, 176, 255),  // #FF9DB0
    pinkDp: new Color(217, 89, 111, 255),   // #D9596F 厚底
    pinkSf: new Color(255, 230, 235, 255),  // #FFE6EB 浅底 / 不足态价格底

    // 货币 焦糖黄
    butter: new Color(247, 193, 86, 255),   // #F7C156
    butterHi: new Color(252, 211, 126, 255),// #FCD37E
    butterDp: new Color(218, 155, 48, 255), // #DA9B30 厚底
    butterText: new Color(122, 78, 22, 255),// #7A4E16 焦糖按钮字色

    // 正向 薄荷绿
    mint: new Color(138, 210, 174, 255),    // #8AD2AE
    mintHi: new Color(166, 226, 198, 255),  // #A6E2C6
    mintDp: new Color(86, 174, 136, 255),   // #56AE88 厚底
    mintText: new Color(31, 91, 65, 255),   // #1F5B41 薄荷按钮字色

    // 幽灵 / 中性按钮（象牙白底 + 暖棕字）
    ghostFace: new Color(255, 253, 248, 255), // #FFFDF8
    ghostShadow: new Color(228, 210, 181, 255), // #E4D2B5

    // 星级
    star: new Color(255, 197, 61, 255),     // #FFC53D
    starOff: new Color(220, 193, 151, 255), // 暗星用柔描边色

    // 通用
    white: new Color(255, 255, 255, 255),
    danger: new Color(217, 89, 111, 255),   // 危险/失败沿用 pinkDp 暖红
} as const;

/** 果冻按钮语义变体（prefab-spec.md §① 语义色表）。 */
export interface JellyVariant {
    /** 面主色（渐变下端 / 实色填充） */
    face: Color;
    /** 面高光（渐变上端 / 顶部白条之外的受光色） */
    faceHi: Color;
    /** 厚底深色（Shadow 层） */
    shadow: Color;
    /** 文字色 */
    text: Color;
}

export type JellyVariantName = 'primary' | 'butter' | 'mint' | 'ghost';

export const JELLY_VARIANTS: Record<JellyVariantName, JellyVariant> = {
    primary: { face: TOKENS.pink, faceHi: TOKENS.pinkHi, shadow: TOKENS.pinkDp, text: TOKENS.white },
    butter: { face: TOKENS.butter, faceHi: TOKENS.butterHi, shadow: TOKENS.butterDp, text: TOKENS.butterText },
    mint: { face: TOKENS.mint, faceHi: TOKENS.mintHi, shadow: TOKENS.mintDp, text: TOKENS.mintText },
    ghost: { face: TOKENS.ghostFace, faceHi: TOKENS.white, shadow: TOKENS.ghostShadow, text: TOKENS.ink },
};

/**
 * 统一描边：暖棕 INK width 2（替换所有黑描边）。
 * @param label 目标 Label
 * @param alpha 描边透明度（次要文字可降到 ~160）
 * @param width 描边宽度（默认 2）
 */
export function applyInkOutline(label: Label | null, alpha = 255, width = 2): void {
    if (!label) return;
    label.enableOutline = true;
    label.outlineColor = new Color(TOKENS.ink.r, TOKENS.ink.g, TOKENS.ink.b, alpha);
    label.outlineWidth = width;
}
