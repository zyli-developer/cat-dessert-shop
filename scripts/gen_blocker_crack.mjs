/**
 * 生成焦糊曲奇的「裂纹叠加层」贴图 —— 占位蛋糕被相邻大合成震出裂纹时叠在本体上。
 *
 * 设计：120×120 透明底，与 dessert_blocker.png 同尺寸同中心，可直接 1:1 叠加。
 * 裂纹用「深色底纹 + 奶油亮线」两层描边，确保在焦黑曲奇表面上清晰可辨（露出未烤糊的面）。
 * 所有路径都收在以中心(60,60)为圆心、半径≤44 的范围内，避免越过白色贴纸边框。
 *
 * 用法：node scripts/gen_blocker_crack.mjs
 * 输出：client/assets/resources/textures/desserts/dessert_blocker_crack.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'client/assets/resources/textures/desserts/dessert_blocker_crack.png');

// 同一组裂纹路径，画两遍（先深后亮）形成立体裂缝
const CRACKS = [
    'M58,18 L52,38 L63,55 L55,76 L60,98',
    'M52,38 L31,46',
    'M63,55 L86,60',
    'M55,76 L37,89',
    'M58,18 L73,31 L69,44',
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#241813" stroke-width="6" opacity="0.5">
      ${CRACKS.map((d) => `<path d="${d}"/>`).join('\n      ')}
    </g>
    <g stroke="#F2D8AA" stroke-width="2.6" opacity="0.95">
      ${CRACKS.map((d) => `<path d="${d}"/>`).join('\n      ')}
    </g>
  </g>
</svg>`;

async function main() {
    const png = await sharp(Buffer.from(svg), { density: 480 })
        .resize(120, 120)
        .png({ palette: true, quality: 90, effort: 9 })
        .toBuffer();
    fs.writeFileSync(outPath, png);
    console.log(`[gen_blocker_crack] 写入 ${path.relative(root, outPath)} (${png.length} bytes)`);
}

main();
