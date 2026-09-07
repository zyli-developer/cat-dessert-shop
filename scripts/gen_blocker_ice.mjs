/**
 * 生成 T2 障碍物「冰封蛋糕」的**占位**贴图（本体 + 霜裂叠加层）。
 *
 * 本体是临时占位（冷蓝色，与暖色甜品一眼区分），等美术按
 * docs/ui-mockup/blocker-ice-spec.md 出 AI 生图后直接覆盖 dessert_blocker_ice.png 即可。
 * 霜裂叠加层（dessert_blocker_ice_crack.png）是程序生成、非美术交付项，结构同焦糊曲奇裂纹。
 *
 * 用法：node scripts/gen_blocker_ice.mjs
 * 输出：client/assets/resources/textures/desserts/dessert_blocker_ice.png
 *       client/assets/resources/textures/desserts/dessert_blocker_ice_crack.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'client/assets/resources/textures/desserts');

// --- 本体占位：冷蓝冰封球 + X X 晕眼 + 雪顶 ---
const bodySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <circle cx="60" cy="62" r="46" fill="#CDEBF7" stroke="#5E8AA0" stroke-width="6"/>
  <path d="M16,64 A46,46 0 0 0 104,64 A46,30 0 0 1 16,64 Z" fill="#A9D8EE" opacity="0.7"/>
  <polygon points="60,24 70,46 50,46" fill="#EAF7FE" opacity="0.85"/>
  <polygon points="86,52 96,70 78,68" fill="#EAF7FE" opacity="0.7"/>
  <ellipse cx="46" cy="46" rx="13" ry="7" fill="#FFFFFF" opacity="0.55"/>
  <path d="M20,42 Q60,16 100,42 Q80,33 60,32 Q40,33 20,42 Z" fill="#FFFFFF" opacity="0.92"/>
  <g stroke="#33525F" stroke-width="4.5" stroke-linecap="round">
    <path d="M40,54 L52,66 M52,54 L40,66"/>
    <path d="M68,54 L80,66 M80,54 L68,66"/>
  </g>
  <path d="M52,82 Q60,76 68,82" stroke="#33525F" stroke-width="3.5" fill="none" stroke-linecap="round"/>
</svg>`;

// --- 霜裂叠加层：冷白裂缝 + 浅蓝底纹（几何同焦糊曲奇裂纹，收在中心半径≤44） ---
const CRACKS = [
    'M58,18 L52,38 L63,55 L55,76 L60,98',
    'M52,38 L31,46',
    'M63,55 L86,60',
    'M55,76 L37,89',
    'M58,18 L73,31 L69,44',
];
const crackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#5E8AA0" stroke-width="6" opacity="0.5">
      ${CRACKS.map((d) => `<path d="${d}"/>`).join('\n      ')}
    </g>
    <g stroke="#F2FBFF" stroke-width="2.6" opacity="0.97">
      ${CRACKS.map((d) => `<path d="${d}"/>`).join('\n      ')}
    </g>
  </g>
</svg>`;

async function render(svg, outName) {
    const png = await sharp(Buffer.from(svg), { density: 480 })
        .resize(120, 120)
        .png({ palette: true, quality: 90, effort: 9 })
        .toBuffer();
    const out = path.join(dir, outName);
    fs.writeFileSync(out, png);
    console.log(`[gen_blocker_ice] 写入 ${path.relative(root, out)} (${png.length} bytes)`);
}

await render(bodySvg, 'dessert_blocker_ice.png');
await render(crackSvg, 'dessert_blocker_ice_crack.png');
