/**
 * 把 AI 生成的冰封蛋糕贴纸图处理成工程可用贴图，覆盖占位图。
 *  1) 洪水填充抠掉「假透明」棋盘灰背景（alpha 实为 255）
 *  2) 只保留最大连通块 → 顺带去掉右下角 Gemini 水印小岛
 *  3) 边缘羽化 + 居中正方形裁剪（防压扁）
 *  4) 缩放到 120×120 调色板 PNG，覆盖 dessert_blocker_ice.png（meta/uuid 不动）
 *
 * 用法：node scripts/process_ice_blocker.mjs [源文件]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] ?? 'C:/Users/Lenovo/Downloads/Gemini_Generated_Image_qfta3qfta3qfta3q.png';
const out = path.join(root, 'client/assets/resources/textures/desserts/dessert_blocker_ice.png');

const GRAYISH = 16;      // max-min ≤ 此值视为「中性灰」
const LUM_LO = 100, LUM_HI = 218; // 棋盘灰亮度区间（白色贴纸边 ~245 被保护）

async function main() {
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels;
    const N = W * H;
    const alpha = new Uint8Array(N).fill(255);

    const isChecker = (idx) => {
        const i = idx * C;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const lum = (r + g + b) / 3;
        return mx - mn <= GRAYISH && lum >= LUM_LO && lum <= LUM_HI;
    };

    // 1) 从四边洪水填充，凡是连到边界的棋盘灰像素 → 背景(alpha 0)
    const bg = new Uint8Array(N);
    const stack = [];
    for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
    for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
    while (stack.length) {
        const idx = stack.pop();
        if (bg[idx]) continue;
        if (!isChecker(idx)) continue;
        bg[idx] = 1;
        const x = idx % W, y = (idx / W) | 0;
        if (x > 0) stack.push(idx - 1);
        if (x < W - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - W);
        if (y < H - 1) stack.push(idx + W);
    }
    for (let i = 0; i < N; i++) if (bg[i]) alpha[i] = 0;

    // 2) 最大连通块（4 邻接）→ 去掉水印小岛与零散残留
    const label = new Int32Array(N).fill(-1);
    let best = -1, bestSize = 0;
    for (let s = 0; s < N; s++) {
        if (alpha[s] === 0 || label[s] !== -1) continue;
        const cur = s; let size = 0; const st = [s]; label[s] = cur;
        while (st.length) {
            const idx = st.pop(); size++;
            const x = idx % W, y = (idx / W) | 0;
            const nb = [];
            if (x > 0) nb.push(idx - 1);
            if (x < W - 1) nb.push(idx + 1);
            if (y > 0) nb.push(idx - W);
            if (y < H - 1) nb.push(idx + W);
            for (const n of nb) if (alpha[n] !== 0 && label[n] === -1) { label[n] = cur; st.push(n); }
        }
        if (size > bestSize) { bestSize = size; best = cur; }
    }
    for (let i = 0; i < N; i++) if (alpha[i] !== 0 && label[i] !== best) alpha[i] = 0;

    // 3) 1px 边缘羽化（柔化锯齿；缩放后几乎不可见，主要防硬边）
    const feather = alpha.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (alpha[idx] === 0) continue;
        const edge = (x > 0 && alpha[idx - 1] === 0) || (x < W - 1 && alpha[idx + 1] === 0)
            || (y > 0 && alpha[idx - W] === 0) || (y < H - 1 && alpha[idx + W] === 0);
        if (edge) feather[idx] = 150;
    }

    // 写回 alpha，求包围盒
    let minX = W, minY = H, maxX = 0, maxY = 0;
    for (let i = 0; i < N; i++) {
        data[i * C + 3] = feather[i];
        if (feather[i] > 0) {
            const x = i % W, y = (i / W) | 0;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    }

    // 4) 居中正方形裁剪（边 = 包围盒长边，防压扁），再缩到 120
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const side = Math.max(bw, bh);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const left = Math.round(cx - side / 2), top = Math.round(cy - side / 2);

    const cropL = Math.max(0, left), cropT = Math.max(0, top);
    const info2 = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: C } })
        .extract({
            left: cropL, top: cropT,
            width: Math.min(side, W - cropL), height: Math.min(side, H - cropT),
        })
        .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, quality: 90, effort: 9 })
        .toFile(out);
    console.log(`[process_ice_blocker] 写入 ${path.relative(root, out)} (${info2.size} bytes), bbox ${bw}x${bh} → 120x120`);
}

main();
