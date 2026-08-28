/**
 * 构建后处理：把指定 Asset Bundle 从主包搬进小游戏分包。
 *
 * 背景：Creator 3.8.8 中 bundle 的「小游戏分包」压缩类型需要在编辑器 UI 的
 * Bundle 配置方案里设置，文件夹 meta / 构建 profile 注入均不生效。
 * 本脚本直接改造构建产物，结构复刻自构建器对 main 包的处理：
 *   assets/<name>/{config.json,import,native}  →  subpackages/<name>/
 *   assets/<name>/index.js                     →  subpackages/<name>/game.js
 *   game.json.subPackages        += { name, root: 'subpackages/<name>/' }
 *   src/settings.json assets.subpackages += name
 *
 * 用法（构建完成后、上传前执行一次）：
 *   node scripts/postbuild_subpackage.mjs [构建目录] [bundle名...]
 *   默认：client/build/bytedance-mini-game audio
 */
import fs from 'node:fs';
import path from 'node:path';

const buildDir = process.argv[2] ?? 'client/build/bytedance-mini-game';
const bundles = process.argv.length > 3 ? process.argv.slice(3) : ['audio'];

/**
 * 移动文件/目录：优先 rename；被占用（EPERM，常见于抖音 IDE 开着构建目录）
 * 或跨盘（EXDEV）时退回「递归复制 + 删除源」。目标已存在则覆盖（支持半迁移恢复）。
 */
function moveRobust(from, to) {
    try {
        if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
        fs.renameSync(from, to);
        return;
    } catch { /* fall through to copy+delete */ }
    fs.cpSync(from, to, { recursive: true, force: true });
    fs.rmSync(from, { recursive: true, force: true });
}

function dirSize(dir) {
    let total = 0;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        total += f.isDirectory() ? dirSize(p) : fs.statSync(p).size;
    }
    return total;
}

function mainPackageSize(root) {
    let total = 0;
    for (const f of fs.readdirSync(root, { withFileTypes: true })) {
        if (f.name === 'subpackages') continue;
        const p = path.join(root, f.name);
        if (f.name === 'cocos-js' && f.isDirectory()) {
            // cocos-js/chunks 是 wasm 子包，不计入主包
            for (const g of fs.readdirSync(p, { withFileTypes: true })) {
                if (g.name === 'chunks') continue;
                const q = path.join(p, g.name);
                total += g.isDirectory() ? dirSize(q) : fs.statSync(q).size;
            }
            continue;
        }
        total += f.isDirectory() ? dirSize(p) : fs.statSync(p).size;
    }
    return total;
}

const gameJsonPath = path.join(buildDir, 'game.json');
const settingsPath = path.join(buildDir, 'src', 'settings.json');
if (!fs.existsSync(gameJsonPath) || !fs.existsSync(settingsPath)) {
    console.error(`[postbuild] 构建目录不完整: ${buildDir}（缺 game.json 或 src/settings.json）`);
    process.exit(1);
}

const gameJson = JSON.parse(fs.readFileSync(gameJsonPath, 'utf8'));
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
// Cocos 构建器生成的键是小写 subpackages（抖音两种拼写都认，跟随构建器）
const SUB_KEY = 'subpackages' in gameJson ? 'subpackages' : 'subPackages';
gameJson[SUB_KEY] = gameJson[SUB_KEY] ?? [];
settings.assets.subpackages = settings.assets.subpackages ?? [];

let changed = false;
for (const name of bundles) {
    const src = path.join(buildDir, 'assets', name);
    const dst = path.join(buildDir, 'subpackages', name);

    if (gameJson[SUB_KEY].some((s) => s.name === name)) {
        console.log(`[postbuild] ${name}: 已是分包，跳过`);
        continue;
    }
    if (!fs.existsSync(src)) {
        console.warn(`[postbuild] ${name}: assets/${name} 不存在（bundle 未参与构建？），跳过`);
        continue;
    }

    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        const from = path.join(src, entry);
        // bundle 入口 index.js 在分包根下叫 game.js（与构建器处理 main 包一致）
        const to = path.join(dst, entry === 'index.js' ? 'game.js' : entry);
        moveRobust(from, to);
    }
    try {
        fs.rmSync(src, { recursive: true, force: true });
    } catch {
        console.warn(`[postbuild] ⚠ assets/${name} 删除失败（目录被占用？关闭抖音开发者工具后重跑本脚本）`);
    }

    gameJson[SUB_KEY].push({ name, root: `subpackages/${name}/` });
    if (!settings.assets.subpackages.includes(name)) settings.assets.subpackages.push(name);
    changed = true;
    console.log(`[postbuild] ${name}: assets/${name} → subpackages/${name} ✓`);
}

if (changed) {
    fs.writeFileSync(gameJsonPath, JSON.stringify(gameJson, null, 2));
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
}

const mainBytes = mainPackageSize(buildDir);
console.log(`[postbuild] 主包大小 ≈ ${(mainBytes / 1048576).toFixed(3)} MB（上限 4 MB）`);
if (mainBytes > 4 * 1048576) {
    console.error('[postbuild] 主包仍超过 4 MB，拒绝继续预览或上传');
    process.exit(1);
}
