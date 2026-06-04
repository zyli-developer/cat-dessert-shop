#!/usr/bin/env node
/**
 * rasterize_icons.js — 把改版设计稿的统一线条图标 SVG 栅格化为 PNG。
 *
 * 来源：docs/ui-mockup/icons-export/svg/*.svg（26 枚，暖棕 #5A4636 线条，viewBox 24，144²）
 * 输出：client/assets/textures/ui/icons-v2/*.png
 *   —— 故意放到新子目录 icons-v2/，不覆盖现有 icon_*.png，便于回退；
 *      编辑器里按 docs/ui-mockup/icon-swap-guide.md 重新指定 SpriteFrame。
 *
 * 用法：node scripts/rasterize_icons.js
 *   可选环境变量 ICON_SIZE（默认 144）。HUD 大图标可整体跑 192：ICON_SIZE=192 node scripts/rasterize_icons.js
 *
 * 依赖：sharp（仓库 scripts/ 已使用）。
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'docs', 'ui-mockup', 'icons-export', 'svg');
const OUT_DIR = path.join(ROOT, 'client', 'assets', 'textures', 'ui', 'icons-v2');

const SIZE = parseInt(process.env.ICON_SIZE || '144', 10);
// 高密度渲染再降采样，保证线条边缘清晰。
const DENSITY = SIZE * 4;

async function main() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error(`[rasterize_icons] 源目录不存在: ${SRC_DIR}`);
        process.exit(1);
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const svgs = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.svg'));
    if (svgs.length === 0) {
        console.error('[rasterize_icons] 未找到任何 .svg');
        process.exit(1);
    }

    let ok = 0;
    for (const file of svgs) {
        const srcPath = path.join(SRC_DIR, file);
        const outName = file.replace(/\.svg$/i, '.png');
        const outPath = path.join(OUT_DIR, outName);
        const buf = fs.readFileSync(srcPath);
        try {
            await sharp(buf, { density: DENSITY })
                .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png({ compressionLevel: 9 })
                .toFile(outPath);
            ok++;
            console.log(`  ✓ ${outName}  (${SIZE}²)`);
        } catch (err) {
            console.error(`  ✗ ${file}: ${err.message}`);
        }
    }

    console.log(`[rasterize_icons] 完成 ${ok}/${svgs.length} → ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
