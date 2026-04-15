#!/usr/bin/env node
/**
 * Douyin Mini-Game MCP Server (stdio transport).
 *
 * Exposes the local Cocos + tmg toolchain as MCP tools so Claude Code (or any
 * MCP client) can build / preview / upload the Douyin mini-game bundle
 * conversationally, without remembering the raw CLI flags.
 *
 * Hand-rolled JSON-RPC 2.0 server; no @modelcontextprotocol/sdk dependency
 * (keeps the repo's devDep footprint small).
 *
 * Tools:
 *   cocos_build_bytedance  - Cocos headless build, platform=bytedance-mini-game
 *   tmg_preview            - Build-if-missing + tmg preview, returns QR + URL
 *   tmg_upload             - Build-if-missing + tmg upload with version + changelog
 *   tmg_login_status       - Probe whether tmg has a cached session
 *   build_status           - Report dist/bytedance-mini-game size + file listing
 *
 * Requires env COCOS_CREATOR_PATH for build/preview/upload.
 * Requires prior `tmg login -m` (interactive) for preview/upload.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const E2E_DIR = path.join(REPO_ROOT, 'e2e');
const DIST = path.join(E2E_DIR, 'dist', 'bytedance-mini-game');
const SERVER_NAME = 'catbakery-douyin';
const SERVER_VERSION = '0.1.0';

const TOOLS = [
  {
    name: 'cocos_build_bytedance',
    description:
      'Run Cocos Creator headless build for platform=bytedance-mini-game. Output lands in e2e/dist/bytedance-mini-game/. Requires COCOS_CREATOR_PATH env var. Typical run takes ~30s-3min on first build, cached otherwise (use force=true to rebuild).',
    inputSchema: {
      type: 'object',
      properties: {
        force: { type: 'boolean', description: 'Force rebuild even if cached build exists', default: false },
      },
    },
  },
  {
    name: 'tmg_preview',
    description:
      'Build-if-missing + run `tmg preview` against the bytedance-mini-game bundle. Returns the 抖音 experience QR URL + file path to QR PNG. Requires prior interactive `tmg login -m` on this machine.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tmg_upload',
    description:
      'Build-if-missing + run `tmg upload` with a version (semver) and changelog. Uploads to 抖音 developer console as an experience version.',
    inputSchema: {
      type: 'object',
      properties: {
        version: { type: 'string', description: 'Semver version like "0.0.1"' },
        changelog: { type: 'string', description: 'Short changelog line' },
      },
      required: ['version'],
    },
  },
  {
    name: 'tmg_login_status',
    description:
      'Probe whether `tmg` has a cached session. Returns { logged_in: boolean, reason: string }. Cheap call; does not hit the network.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'build_status',
    description:
      'Report the on-disk bytedance-mini-game build: existence, total size, top-level file listing. Useful to sanity-check a build without re-running it.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function exec(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: true, ...opts });
  return {
    code: r.status ?? -1,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
  };
}

function dirSize(root) {
  if (!fs.existsSync(root)) return 0;
  let total = 0;
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f));
    else total += st.size;
  };
  walk(root);
  return total;
}

async function toolCocosBuild({ force = false } = {}) {
  const env = { ...process.env };
  if (force) env.FORCE = '1';
  if (!env.COCOS_CREATOR_PATH) {
    return {
      content: [
        { type: 'text', text: 'error: COCOS_CREATOR_PATH env var not set.\nExample: C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' },
      ],
      isError: true,
    };
  }
  const r = exec('node', [path.join(E2E_DIR, 'scripts', 'build-bytedance.mjs')], { env, cwd: E2E_DIR });
  const ok = fs.existsSync(path.join(DIST, 'game.json'));
  return {
    content: [
      { type: 'text', text: [
        ok ? '✅ bytedance-mini-game build OK' : '❌ bytedance-mini-game build FAILED',
        `exit=${r.code}`,
        `stdout (tail): ${r.stdout.slice(-800)}`,
        r.stderr ? `stderr (tail): ${r.stderr.slice(-400)}` : '',
      ].filter(Boolean).join('\n') },
    ],
    isError: !ok,
  };
}

async function toolPreview() {
  const env = { ...process.env };
  if (!env.COCOS_CREATOR_PATH) {
    return { content: [{ type: 'text', text: 'COCOS_CREATOR_PATH not set' }], isError: true };
  }
  const r = exec('node', [path.join(E2E_DIR, 'scripts', 'preview-tt.mjs')], { env, cwd: E2E_DIR });
  const urlMatch = r.stdout.match(/(https:\/\/[^\s]+)/);
  const qrPath = path.join(E2E_DIR, 'dist', 'bytedance-mini-game.preview.png');
  return {
    content: [
      { type: 'text', text: [
        r.code === 0 && urlMatch ? '✅ preview ready' : '❌ preview failed',
        urlMatch ? `QR URL: ${urlMatch[1]}` : '',
        fs.existsSync(qrPath) ? `QR image: ${qrPath}` : '',
        `exit=${r.code}`,
        `stdout (tail): ${r.stdout.slice(-800)}`,
      ].filter(Boolean).join('\n') },
    ],
    isError: r.code !== 0 || !urlMatch,
  };
}

async function toolUpload({ version, changelog = '' }) {
  if (!version) return { content: [{ type: 'text', text: 'version required' }], isError: true };
  const env = { ...process.env };
  const args = [path.join(E2E_DIR, 'scripts', 'upload-tt.mjs'), version];
  if (changelog) args.push(changelog);
  const r = exec('node', args, { env, cwd: E2E_DIR });
  return {
    content: [{ type: 'text', text: [
      r.code === 0 ? `✅ uploaded ${version}` : `❌ upload failed (exit=${r.code})`,
      r.stdout.slice(-1200),
    ].join('\n') }],
    isError: r.code !== 0,
  };
}

async function toolLoginStatus() {
  // tmg stores its session under user home; the exact path differs by version, so we
  // probe with a cheap command that requires auth (`tmg version` against a valid project).
  if (!fs.existsSync(path.join(DIST, 'project.config.json'))) {
    return {
      content: [{ type: 'text', text: '无法探测：还没跑过 build（需要项目产物才能用 tmg version 探测 session）。先跑 cocos_build_bytedance。' }],
    };
  }
  const tmg = process.platform === 'win32' ? 'tmg.cmd' : 'tmg';
  const r = exec(tmg, ['version', DIST]);
  const loggedIn = r.code === 0 && !/login/i.test(r.stdout + r.stderr);
  return {
    content: [{ type: 'text', text: [
      loggedIn ? '✅ tmg session active' : '⚠️ not logged in; run `tmg login -m` interactively',
      `exit=${r.code}`,
      r.stdout ? `stdout: ${r.stdout.slice(0, 400)}` : '',
      r.stderr ? `stderr: ${r.stderr.slice(0, 400)}` : '',
    ].filter(Boolean).join('\n') }],
  };
}

async function toolBuildStatus() {
  const exists = fs.existsSync(path.join(DIST, 'game.json'));
  if (!exists) {
    return { content: [{ type: 'text', text: '❌ no build at ' + DIST + '\nRun cocos_build_bytedance first.' }] };
  }
  const sz = dirSize(DIST);
  const files = fs.readdirSync(DIST).slice(0, 20);
  return {
    content: [{ type: 'text', text: [
      '✅ build present at ' + DIST,
      `size: ${(sz / 1024 / 1024).toFixed(2)} MB`,
      'top-level: ' + files.join(', '),
    ].join('\n') }],
  };
}

const DISPATCH = {
  cocos_build_bytedance: toolCocosBuild,
  tmg_preview: toolPreview,
  tmg_upload: toolUpload,
  tmg_login_status: toolLoginStatus,
  build_status: toolBuildStatus,
};

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleRequest(req) {
  const { id, method, params = {} } = req;
  try {
    switch (method) {
      case 'initialize':
        reply(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        });
        return;
      case 'tools/list':
        reply(id, { tools: TOOLS });
        return;
      case 'tools/call': {
        const tool = params.name;
        const args = params.arguments ?? {};
        const fn = DISPATCH[tool];
        if (!fn) return replyError(id, -32601, `unknown tool: ${tool}`);
        const result = await fn(args);
        reply(id, result);
        return;
      }
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return; // no response for notifications
      default:
        replyError(id, -32601, `method not found: ${method}`);
    }
  } catch (err) {
    replyError(id, -32603, `internal error: ${err?.message ?? String(err)}`);
  }
}

function main() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let req;
    try { req = JSON.parse(line); }
    catch { return process.stderr.write(`[douyin-mcp] invalid JSON: ${line.slice(0, 200)}\n`); }
    handleRequest(req);
  });
  process.stderr.write(`[douyin-mcp] ${SERVER_NAME} v${SERVER_VERSION} ready (stdio)\n`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

export { TOOLS, DISPATCH, handleRequest };
