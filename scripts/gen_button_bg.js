#!/usr/bin/env node
/**
 * gen_button_bg.js — 生成果冻按钮底图（capsule + 烘焙厚底 + 顶部高光）。
 *
 * 替代旧「玻璃糖果」按钮贴图 btn_primary/btn_secondary…。
 * 每个变体一张 PNG，作 9 宫格（SLICED）横向拉伸，左右各保留圆头。
 *
 * 输出：client/assets/textures/ui/jelly/btn_<variant>.png
 *   变体：primary(草莓粉) / butter(焦糖) / mint(薄荷) / ghost(象牙白中性)
 *
 * 9 宫格边距（落地时在编辑器/或 save_asset_meta 设）：left=right=56, top=bottom=0
 *
 * 用法：node scripts/gen_button_bg.js
 * 依赖：sharp
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'client', 'assets', 'textures', 'ui', 'jelly');

const W = 240;
const H = 104;       // 含 8px 厚底
const PILL_H = 96;
const R = PILL_H / 2; // 48
const INSET_X = 8;
const FACE_W = W - INSET_X * 2; // 224

const VARIANTS = {
    primary: { face: '#F5879B', hi: '#FF9DB0', shadow: '#D9596F' },
    butter:  { face: '#F7C156', hi: '#FCD37E', shadow: '#DA9B30' },
    mint:    { face: '#8AD2AE', hi: '#A6E2C6', shadow: '#56AE88' },
    ghost:   { face: '#FFFDF8', hi: '#FFFFFF', shadow: '#E4D2B5' },
};

function svgFor(v) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- 厚底（同形下沉 8px） -->
  <rect x="${INSET_X}" y="8" width="${FACE_W}" height="${PILL_H}" rx="${R}" ry="${R}" fill="${v.shadow}"/>
  <!-- 面色 -->
  <rect x="${INSET_X}" y="0" width="${FACE_W}" height="${PILL_H}" rx="${R}" ry="${R}" fill="${v.face}"/>
  <!-- 顶部内高光 -->
  <rect x="${INSET_X + 12}" y="7" width="${FACE_W - 24}" height="40" rx="20" ry="20" fill="${v.hi}" opacity="0.55"/>
</svg>`;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    let ok = 0;
    for (const [name, v] of Object.entries(VARIANTS)) {
        const out = path.join(OUT_DIR, `btn_${name}.png`);
        await sharp(Buffer.from(svgFor(v)), { density: 288 })
            .png({ compressionLevel: 9 })
            .toFile(out);
        ok++;
        console.log(`  ✓ btn_${name}.png`);
    }
    console.log(`[gen_button_bg] 完成 ${ok}/${Object.keys(VARIANTS).length} → ${path.relative(ROOT, OUT_DIR)}`);
    console.log('  9 宫格边距建议：left=right=56, top=bottom=0（SLICED 横向拉伸）');
}

main().catch((e) => { console.error(e); process.exit(1); });
