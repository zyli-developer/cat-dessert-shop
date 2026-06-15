/**
 * 开发期一键改写 client 的 API_BASE_URL（net/ApiConfig.ts）。
 *
 * 用法：
 *   node scripts/set_api_base.mjs --tunnel      启动 cloudflared 临时隧道并写入 https 地址
 *                                               —— 真机预览/真机调试用（真机禁明文 HTTP，局域网 IP 无效）
 *   node scripts/set_api_base.mjs --lan         写入 http://<本机IPv4>:<port>
 *                                               —— 仅浏览器 / 开发者工具模拟器预览可用
 *   node scripts/set_api_base.mjs --url <地址>  手动指定（如上线正式域名）
 *
 * 附加参数：--port <n>（默认 3333）、--dry-run（只打印不写文件）
 *
 * ⚠ 写入后必须在 Cocos Creator 重新构建（地址会编译进包体）。
 * ⚠ --tunnel 的地址每次重启 cloudflared 都会变；脚本退出后 cloudflared 继续后台运行。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(repoRoot, 'client', 'assets', 'scenes', 'scripts', 'net', 'ApiConfig.ts');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
};
const port = Number(valOf('--port') ?? 3333);
const dryRun = has('--dry-run');

/** 探测本机局域网 IPv4：排除虚拟网卡/代理 TUN/CGNAT，优先常见家用私网段。 */
function lanIPv4() {
    const candidates = [];
    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
        for (const a of addrs ?? []) {
            if (a.family !== 'IPv4' || a.internal) continue;
            candidates.push({ name, address: a.address });
        }
    }
    const score = (c) => {
        // 代理 TUN（Mihomo/Clash fake-ip 198.18.0.0/15）、Tailscale CGNAT（100.64.0.0/10）、
        // 常见虚拟网卡一律降权——手机连的是 WiFi，只有真实网卡地址可达
        if (/^198\.1[89]\./.test(c.address)) return -100;
        if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(c.address)) return -50;
        if (/virtual|vethernet|wsl|vmware|docker|loopback|mihomo|clash|tailscale|zerotier/i.test(c.name)) return -10;
        if (c.address.startsWith('192.168.')) return 2;
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(c.address)) return 1;
        return 0;
    };
    candidates.sort((a, b) => score(b) - score(a));
    if (!candidates.length || score(candidates[0]) < 0) {
        console.error('[set-api-base] 未找到可用的局域网 IPv4，候选：', candidates);
        process.exit(1);
    }
    console.log(`[set-api-base] 本机 IPv4 候选：${candidates.map((c) => `${c.name}=${c.address}`).join('，')}`);
    return candidates[0];
}

/** 启动 cloudflared 临时隧道，拿到 https 地址后让其转入后台继续运行。 */
function startTunnel(targetPort) {
    return new Promise((resolve, reject) => {
        const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${targetPort}`], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let buf = '';
        let settled = false;
        const finish = (fn, v) => {
            if (settled) return;
            settled = true;
            fn(v);
        };
        const onData = (d) => {
            buf += d.toString();
            const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
            if (m) {
                proc.stdout.destroy();
                proc.stderr.destroy();
                proc.unref();
                finish(resolve, { url: m[0], pid: proc.pid });
            }
        };
        proc.stdout.on('data', onData);
        proc.stderr.on('data', onData);
        proc.on('error', (e) => finish(reject, new Error(`cloudflared 启动失败（未安装？）: ${e.message}`)));
        proc.on('exit', (code) => finish(reject, new Error(`cloudflared 提前退出 code=${code}\n${buf.slice(-800)}`)));
        setTimeout(() => finish(reject, new Error('等待隧道地址超时(30s)')), 30000).unref();
    });
}

function writeConfig(url) {
    const src = fs.readFileSync(cfgPath, 'utf8');
    const re = /export const API_BASE_URL = '[^']*';/;
    if (!re.test(src)) {
        console.error(`[set-api-base] ${cfgPath} 中未找到 API_BASE_URL 赋值行，请手动检查`);
        process.exit(1);
    }
    const next = src.replace(re, `export const API_BASE_URL = '${url}';`);
    if (dryRun) {
        console.log(`[set-api-base] (dry-run) 将写入：API_BASE_URL = '${url}'`);
        return;
    }
    fs.writeFileSync(cfgPath, next);
    console.log(`[set-api-base] 已写入 ${path.relative(repoRoot, cfgPath)}：API_BASE_URL = '${url}'`);
    console.log('[set-api-base] ⚠ 需要在 Cocos Creator 重新构建后才生效（构建后记得跑 postbuild_subpackage.mjs）');
}

if (has('--url')) {
    const url = valOf('--url');
    if (!url) {
        console.error('[set-api-base] --url 需要一个地址参数');
        process.exit(1);
    }
    writeConfig(url.replace(/\/+$/, ''));
} else if (has('--lan')) {
    const { name, address } = lanIPv4();
    console.log(`[set-api-base] 选用 ${name} = ${address}（⚠ 仅浏览器/模拟器可用，真机禁明文 HTTP）`);
    writeConfig(`http://${address}:${port}`);
} else if (has('--tunnel')) {
    console.log(`[set-api-base] 正在启动 cloudflared 隧道 → http://localhost:${port} ...`);
    startTunnel(port).then(({ url, pid }) => {
        console.log(`[set-api-base] 隧道已就绪（pid=${pid}，脚本退出后继续后台运行）`);
        writeConfig(url);
        console.log('[set-api-base] ⚠ 隧道地址每次重启 cloudflared 都会变；测试期间保持后端 + cloudflared 运行');
    }).catch((e) => {
        console.error('[set-api-base]', e.message);
        process.exit(1);
    });
} else {
    console.log('用法: node scripts/set_api_base.mjs --tunnel | --lan | --url <地址> [--port 3333] [--dry-run]');
    process.exit(1);
}
