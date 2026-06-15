import { DouyinSDK } from './DouyinSDK';

/**
 * 安全区换算工具 —— 把抖音宿主的 safeArea / 胶囊矩形（逻辑 px）
 * 换算成 720×1280 设计单位下的四向内缩，喂给 Widget 的 top/bottom/left/right。
 *
 * 适配前提：项目 fitWidth:false / fitHeight:true（设计高度 1280 撑满屏高）。
 * 故纵横统一缩放系数 k = 1280 / screenHeight（逻辑 px → 设计单位）。
 *
 * 用法：
 *   const safe = SafeArea.get();
 *   this.anchor(node, { top: 62 + safe.capsuleBottom, right: 22 + safe.right + safe.capsuleWidth });
 */
export interface SafeInsets {
    /** 顶部安全内缩（设计单位） */
    top: number;
    /** 底部安全内缩（Home 指示条，设计单位） */
    bottom: number;
    /** 左侧安全内缩（设计单位） */
    left: number;
    /** 右侧安全内缩（设计单位） */
    right: number;
    /** 顶部右侧抖音胶囊：从屏顶到胶囊下沿的高度（设计单位）。HUD 顶栏应从此线以下开始 */
    capsuleBottom: number;
    /** 胶囊宽度（设计单位）。右上元素若与胶囊同一行需额外让出此宽度 */
    capsuleWidth: number;
}

const DESIGN_H = 1280;

let cached: SafeInsets | null = null;

export class SafeArea {
    /** 取一次并缓存（屏幕旋转 / 尺寸变更时调 invalidate 重算）。 */
    static get(): SafeInsets {
        if (cached) return cached;
        cached = SafeArea.compute();
        return cached;
    }

    /** 失效缓存（resize / 切横竖屏后调用，下次 get 会重算）。 */
    static invalidate(): void {
        cached = null;
    }

    private static compute(): SafeInsets {
        // 浏览器预览 / 编辑器内拿不到 tt：回落到一组保守值，
        // 与设计稿 --cap-top:100 / --safe-bottom:34 对齐，保证编辑器里也不穿帮。
        const fallback: SafeInsets = {
            top: 88,
            bottom: 34,
            left: 0,
            right: 0,
            capsuleBottom: 100,
            capsuleWidth: 96,
        };

        const ttApi = DouyinSDK.getTT();
        if (!ttApi || typeof ttApi.getSystemInfoSync !== 'function') return fallback;

        try {
            const info = ttApi.getSystemInfoSync();
            const sh: number = info.screenHeight;
            const sw: number = info.screenWidth;
            if (!sh || !sw) return fallback;

            const k = DESIGN_H / sh; // 逻辑 px → 设计单位（fitHeight 纵横同系数）
            const sa = info.safeArea ?? { top: 0, bottom: sh, left: 0, right: sw };

            // 胶囊矩形（逻辑 px，相对屏幕左上角）。部分宿主不支持则回落到 safeArea.top + 标准宽。
            let capBottomPx = sa.top || 0;
            let capWidthPx = 87; // 抖音胶囊标准宽 ≈ 87pt
            if (typeof ttApi.getMenuButtonBoundingClientRect === 'function') {
                const cap = ttApi.getMenuButtonBoundingClientRect();
                if (cap && cap.bottom) {
                    capBottomPx = cap.bottom;
                    capWidthPx = cap.width || capWidthPx;
                }
            }

            return {
                top: Math.max(0, sa.top || 0) * k,
                bottom: Math.max(0, sh - (sa.bottom || sh)) * k,
                left: Math.max(0, sa.left || 0) * k,
                right: Math.max(0, sw - (sa.right || sw)) * k,
                capsuleBottom: capBottomPx * k,
                capsuleWidth: capWidthPx * k,
            };
        } catch (e) {
            console.warn('[SafeArea] compute failed, use fallback:', (e as Error)?.message);
            return fallback;
        }
    }
}
