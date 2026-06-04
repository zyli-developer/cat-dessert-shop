#!/usr/bin/env node
/**
 * swap_button_icons.js — 把 buttons-sheet 那套扁平图标整体替换为统一线条风。
 *
 * 做两件事（均为原地替换，保留各 .png.meta / UUID 不动，场景引用不断链）：
 *   1) 用 docs/ui-mockup/icons-export/svg 的统一线条图标，原地覆盖 textures/ui 下
 *      buttons-sheet 对应的旧扁平单图（pause/hammer/shuffle/settings/home/star/next/prev 等）。
 *   2) 重建 textures/ui/buttons-sheet.png（1536×838，4×2 网格）为统一线条风，
 *      使这张被你点名的图集本身也从扁平 → 统一。
 *
 * 覆盖前把原件备份到 backup/buttons-sheet-swap-<DATE>/，可回退。
 * 只换像素，不动 .meta，因此 Cocos 下次 Refresh 会按同 UUID 重新导入，引用全部保持有效。
 *
 * 用法：node scripts/swap_button_icons.js
 * 依赖：sharp。
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SVG_DIR = path.join(ROOT, 'docs', 'ui-mockup', 'icons-export', 'svg');
const UI_DIR = path.join(ROOT, 'client', 'assets', 'textures', 'ui');
const DATE = '2026-06-04';
const BACKUP_DIR = path.join(ROOT, 'backup', `buttons-sheet-swap-${DATE}`);

const BROWN = '#5A4636';
const STAR_GOLD = '#F2B53B';   // 亮星
const STAR_GREY = '#CBB89E';   // 暗星

// 旧扁平文件名 → 新图标 SVG（可选 tint：把 SVG 里的暖棕替换成该色）
const SWAP = [
    { dst: 'pause.png',           svg: 'icon_pause.svg' },
    { dst: 'icon_pause.png',      svg: 'icon_pause.svg' },
    { dst: 'hammer.png',          svg: 'icon_hammer.svg' },
    { dst: 'icon_hammer.png',     svg: 'icon_hammer.svg' },
    { dst: 'shuffle.png',         svg: 'icon_shuffle.svg' },
    { dst: 'icon_shuffle.png',    svg: 'icon_shuffle.svg' },
    { dst: 'settings.png',        svg: 'icon_settings.svg' },
    { dst: 'icon_settings.png',   svg: 'icon_settings.svg' },
    { dst: 'home.png',            svg: 'icon_home.svg' },   // 被 Home/Loading 场景引用，覆盖后立即生效
    { dst: 'icon_next.png',       svg: 'icon_next.svg' },
    { dst: 'btn_next.png',        svg: 'icon_next.svg' },
    { dst: 'icon_prev.png',       svg: 'icon_prev.svg' },
    { dst: 'btn_prev.png',        svg: 'icon_prev.svg' },
    { dst: 'star_on.png',         svg: 'icon_star.svg', tint: STAR_GOLD },
    { dst: 'icon_star_full.png',  svg: 'icon_star.svg', tint: STAR_GOLD },
    { dst: 'star_off.png',        svg: 'icon_star.svg', tint: STAR_GREY },
    { dst: 'icon_star_empty.png', svg: 'icon_star.svg', tint: STAR_GREY },
    // —— 第二批：剩余非 buttons-sheet 的扁平图标（同样原地覆盖，.meta/UUID 不动）——
    { dst: 'ad.png',              svg: 'icon_ad.svg' },
    { dst: 'icon_ad.png',         svg: 'icon_ad.svg' },
    { dst: 'icon_close.png',      svg: 'icon_close.svg' },
    { dst: 'icon_rank.png',       svg: 'icon_rank.svg' },
    { dst: 'icon_share.png',      svg: 'icon_share.svg' },
    { dst: 'icon_coin.png',       svg: 'icon_coin.svg' },     // 金色爪印币，多色不 tint
    { dst: 'icon_catcoin.png',    svg: 'icon_coin.svg' },     // 猫币同款金色爪印币
    { dst: 'icon_home_locked.png', svg: 'icon_lock.svg' },    // 锁定关卡 → 统一锁图标
];

const SIZE = 144;
const DENSITY = SIZE * 4;

function svgBuf(svgName, tint) {
    let s = fs.readFileSync(path.join(SVG_DIR, svgName), 'utf8');
    if (tint) s = s.split(BROWN).join(tint);
    return Buffer.from(s, 'utf8');
}

async function renderPng(svgName, tint, size = SIZE) {
    return sharp(svgBuf(svgName, tint), { density: size * 4 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

async function main() {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    let ok = 0;

    // 1) 原地覆盖旧扁平单图
    for (const { dst, svg, tint } of SWAP) {
        const dstPath = path.join(UI_DIR, dst);
        if (!fs.existsSync(dstPath)) { console.warn(`  · 跳过(不存在) ${dst}`); continue; }
        const bak = path.join(BACKUP_DIR, dst);
        if (!fs.existsSync(bak)) fs.copyFileSync(dstPath, bak);      // 仅首次备份原件（幂等，重跑不覆盖真原件）
        fs.writeFileSync(dstPath, await renderPng(svg, tint));       // 覆盖像素，.meta 不动
        ok++;
        console.log(`  ✓ ${dst}  ←  ${svg}${tint ? '  (' + tint + ')' : ''}`);
    }

    // 2) 重建 buttons-sheet.png（1536×838，4×2 统一线条风）
    const sheetPath = path.join(UI_DIR, 'buttons-sheet.png');
    if (fs.existsSync(sheetPath)) {
        const sheetBak = path.join(BACKUP_DIR, 'buttons-sheet.png');
        if (!fs.existsSync(sheetBak)) fs.copyFileSync(sheetPath, sheetBak);
        const W = 1536, H = 838, COLS = 4, ROWS = 2, ICON = 240;
        const cellW = W / COLS, cellH = H / ROWS;
        const cells = [
            { svg: 'icon_pause.svg' },   { svg: 'icon_hammer.svg' },
            { svg: 'icon_shuffle.svg' }, { svg: 'icon_next.svg' },
            { svg: 'icon_star.svg', tint: STAR_GOLD }, { svg: 'icon_star.svg', tint: STAR_GREY },
            { svg: 'icon_home.svg' },    { svg: 'icon_settings.svg' },
        ];
        const composites = [];
        for (let i = 0; i < cells.length; i++) {
            const col = i % COLS, row = Math.floor(i / COLS);
            const buf = await renderPng(cells[i].svg, cells[i].tint, ICON);
            composites.push({
                input: buf,
                left: Math.round(col * cellW + (cellW - ICON) / 2),
                top: Math.round(row * cellH + (cellH - ICON) / 2),
            });
        }
        await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
            .composite(composites)
            .png({ compressionLevel: 9 })
            .toFile(sheetPath);
        ok++;
        console.log(`  ✓ buttons-sheet.png  重建为统一线条风 (1536×838, 4×2)`);
    }

    console.log(`\n[swap_button_icons] 完成 ${ok} 个文件；原件已备份到 ${path.relative(ROOT, BACKUP_DIR)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
