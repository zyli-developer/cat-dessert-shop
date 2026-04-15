# Test Automation Phase T3: End-to-End (Playwright + Douyin CLI smoke) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up Playwright-based E2E against the Cocos `web-mobile` build with injected `tt` mock, cover all P0+P1 user journeys, add long-run and perf specs, and document the Douyin CLI smoke checklist for pre-submission verification.

**Architecture:** New `e2e/` workspace runs Playwright. `globalSetup` launches a real NestJS server (in-memory DB) and a static server serving `e2e/dist/web-mobile/`. Each spec injects a `window.tt` mock via `page.addInitScript` before any game script runs. CI caches the Cocos build output keyed by `client/assets/**` hash.

**Tech Stack:** Playwright, NestJS test instance, custom tt-mock, esbuild (fallback shell for API-only specs), Cocos Creator headless build (cached in CI).

**Prerequisites:** T1 and T2 merged.

**Reference design:** `docs/plans/2026-04-15-test-automation-design.md` sections 2.3, 3.3, 4.4, 5.3, 6.

---

## Conventions

- Every spec must be independent — no shared state across `test()` blocks.
- All async UI waits use `expect.poll` or `await expect(locator).toHaveX(...)`, not `page.waitForTimeout`.
- `retries: 2` on CI; locally 0 (catches real flakes during dev).
- Commit messages: `test(t3): ...` / `chore(t3): ...` / `ci(t3): ...`.

---

## Task 1: Bootstrap `e2e/` workspace

**Files:**
- Modify: root `package.json` (add `e2e` workspace + scripts)
- Create: `e2e/package.json`
- Create: `e2e/tsconfig.json`
- Create: `e2e/playwright.config.ts`

**Step 1: Root `package.json` — final shape**

```json
"workspaces": ["server", "client/tests", "e2e", "scripts/tests"],
"scripts": {
  "test": "npm run test:all",
  "test:all": "npm run test:server && npm run test:server:e2e && npm run test:client && npm run test:scripts && npm run test:e2e",
  "test:server": "npm --workspace server run test:ci",
  "test:server:e2e": "npm --workspace server run test:e2e:ci",
  "test:client": "npm --workspace client/tests run test:ci",
  "test:e2e": "npm --workspace e2e run test:ci",
  "test:e2e:headed": "npm --workspace e2e run test:headed",
  "test:scripts": "npm --workspace scripts/tests run test:ci",
  "coverage:merge": "..."
}
```

**Step 2: `e2e/package.json`**

```json
{
  "name": "@catbakery/e2e",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ci": "playwright test --reporter=list,html",
    "test:headed": "playwright test --headed",
    "build:client": "node scripts/build-web-mobile.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "typescript": "^5.7.3",
    "esbuild": "^0.24.0"
  }
}
```

**Step 3: `e2e/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": ".", "types": ["node"] },
  "include": ["**/*.ts"]
}
```

**Step 4: `e2e/playwright.config.ts`**

(Paste from design section 4.4.)

**Step 5: Install**

Run: `npm install`
Run: `cd e2e && npx playwright install --with-deps chromium`

**Step 6: Commit**

```bash
git add e2e/ package.json package-lock.json
git commit -m "chore(t3): bootstrap e2e Playwright workspace"
```

---

## Task 2: Cocos `web-mobile` build script (with esbuild fallback)

**Files:**
- Create: `e2e/scripts/build-web-mobile.mjs`
- Create: `e2e/scripts/build-fallback-shell.mjs`
- Create: `e2e/static/shell.html`

**Step 1: Primary build script**

`e2e/scripts/build-web-mobile.mjs`:

```js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist/web-mobile');
const COCOS = process.env.COCOS_CREATOR_PATH; // e.g. "C:/Program Files/CocosCreator/3.8.8/CocosCreator.exe"

if (fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('[build] cached web-mobile exists, skipping');
  process.exit(0);
}

if (!COCOS) {
  console.warn('[build] COCOS_CREATOR_PATH not set, building fallback shell');
  await import('./build-fallback-shell.mjs');
  process.exit(0);
}

const args = ['--project', path.resolve('../client'), '--build', 'platform=web-mobile'];
const p = spawn(COCOS, args, { stdio: 'inherit' });
p.on('exit', code => process.exit(code ?? 1));
```

**Step 2: Fallback shell** (covers API-only specs when Cocos editor unavailable in CI)

`e2e/scripts/build-fallback-shell.mjs`:

```js
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('dist/web-mobile');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.resolve('static/shell.html'), path.join(out, 'index.html'));

await build({
  entryPoints: [path.resolve('../client/assets/scenes/scripts/net/ApiClient.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'CatBakery',
  outfile: path.join(out, 'app.js'),
  loader: { '.ts': 'ts' },
  external: ['cc'],
  banner: { js: 'window.cc = {};' }, // stub cc to avoid runtime error
});
console.log('[build] fallback shell written to', out);
```

**Step 3: Minimal shell HTML**

`e2e/static/shell.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>cb-shell</title></head>
<body>
  <div id="app"></div>
  <script src="./app.js"></script>
  <script>
    // Spec-driven hooks attached to window for Playwright to call.
    window.__cb = { api: new CatBakery.ApiClient() };
  </script>
</body></html>
```

**Step 4: Run build**

Run: `npm --workspace e2e run build:client`
Expected: `e2e/dist/web-mobile/index.html` exists (fallback if COCOS_CREATOR_PATH unset).

**Step 5: Commit**

```bash
git add e2e/scripts/ e2e/static/
git commit -m "chore(t3): web-mobile build script with esbuild fallback shell"
```

---

## Task 3: `tt` mock fixture

**Files:**
- Create: `e2e/fixtures/tt-mock.ts`

```ts
import { Page } from '@playwright/test';

export interface TtMockConfig {
  loginCode?: string;
  loginFails?: boolean;
  rewardedAd?: { isEnded: boolean } | 'loadError';
  shareResult?: 'success' | 'cancel';
}

export async function installTtMock(page: Page, cfg: TtMockConfig = {}) {
  await page.addInitScript((config) => {
    const store = new Map<string, any>();
    (window as any).tt = {
      login: (opts: any) => {
        if (config.loginFails) opts.fail?.({ errMsg: 'login:fail' });
        else opts.success?.({ code: config.loginCode ?? 'test-code-1' });
      },
      getStorageSync: (k: string) => store.get(k) ?? '',
      setStorageSync: (k: string, v: any) => store.set(k, v),
      removeStorageSync: (k: string) => store.delete(k),
      getLaunchOptionsSync: () => ({ query: {}, scene: 1001 }),
      shareAppMessage: (opts: any) => {
        if (config.shareResult === 'cancel') opts.fail?.({ errMsg: 'share:cancel' });
        else opts.success?.({});
      },
      createRewardedVideoAd: () => {
        const cbs: Record<string, Function[]> = { load: [], error: [], close: [] };
        return {
          load: () => {
            if (config.rewardedAd === 'loadError') cbs.error.forEach(f => f({ errMsg: 'load fail' }));
            else cbs.load.forEach(f => f());
          },
          show: () => {
            const r = config.rewardedAd;
            if (r && r !== 'loadError') cbs.close.forEach(f => f({ isEnded: r.isEnded }));
          },
          onLoad: (f: Function) => cbs.load.push(f),
          onError: (f: Function) => cbs.error.push(f),
          onClose: (f: Function) => cbs.close.push(f),
        };
      },
    };
  }, cfg);
}
```

Commit: `chore(t3): add tt-mock fixture for Playwright`

---

## Task 4: Global setup — server + static file server

**Files:**
- Create: `e2e/fixtures/global-setup.ts`
- Create: `e2e/fixtures/global-teardown.ts`

```ts
// global-setup.ts
import { FullConfig } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';

let serverProc: ChildProcess | null = null;
let staticServer: http.Server | null = null;

export default async function globalSetup(_config: FullConfig) {
  // 1. Start NestJS server on 4568 (in-memory DB via default behavior)
  serverProc = spawn('npm', ['--workspace', 'server', 'run', 'start'], {
    env: { ...process.env, PORT: '4568', NODE_ENV: 'test' },
    stdio: 'inherit',
    shell: true,
  });

  // Wait for health
  await new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      http.get('http://127.0.0.1:4568/health', res => res.statusCode === 200 ? resolve() : setTimeout(poll, 200))
          .on('error', () => (Date.now() - start > 30_000 ? reject(new Error('server timeout')) : setTimeout(poll, 200)));
    };
    poll();
  });

  // 2. Static server for web-mobile build on 4567
  const distDir = path.resolve(__dirname, '../dist/web-mobile');
  staticServer = http.createServer((req, res) => {
    const p = path.join(distDir, req.url === '/' ? 'index.html' : req.url!);
    if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
    res.end(fs.readFileSync(p));
  });
  await new Promise<void>(r => staticServer!.listen(4567, r));

  process.env.API_BASE = 'http://127.0.0.1:4568';
  (global as any).__SERVERS__ = { serverProc, staticServer };
}
```

```ts
// global-teardown.ts
export default async function globalTeardown() {
  const s = (global as any).__SERVERS__;
  s?.staticServer?.close();
  s?.serverProc?.kill();
}
```

> Prerequisite: ensure server exposes `GET /health`; if missing, add a trivial controller (small, additive — commit separately as `feat(t3): add /health endpoint`).

Commit: `chore(t3): Playwright global setup spawns server + static`

---

## Task 5: Auth flow spec

**Files:** `e2e/specs/auth-flow.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';

test.beforeEach(async ({ page }) => { await installTtMock(page); });

test('first launch completes login and reaches Home', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-scene="Home"]')).toBeVisible({ timeout: 15_000 });
});

test('cached token skips login on second launch', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('[data-scene="Home"]')).toBeVisible();
  const page2 = await context.newPage();
  await installTtMock(page2, { loginFails: true });
  await page2.goto('/');
  await expect(page2.locator('[data-scene="Home"]')).toBeVisible();
});
```

> Expects game code to set `data-scene` attribute on a root element for each scene. If not present, add it in `client/assets/scenes/scripts/ui/*Scene.ts` during this task.

Commit: `test(t3): auth flow e2e (TC-API-AUTH-001..002)`

---

## Task 6: Playthrough spec (happy path + chained levels)

**Files:** `e2e/specs/playthrough.spec.ts`

Cover TC-E2E-001 (new-player completion), TC-E2E-004 (three consecutive levels). Drive game via exposed `window.__cb` harness methods (`completeLevel(level, score)`) — add thin cheat hooks in dev builds guarded by `process.env.NODE_ENV==='test'`.

Commit.

---

## Task 7: Fail-retry spec

**Files:** `e2e/specs/fail-retry.spec.ts`

Trigger overflow via harness; assert Fail popup; click retry → state reset.

Commit.

---

## Task 8: Rank spec

**Files:** `e2e/specs/rank.spec.ts`

Seed three users via API (see `fixtures/api-helpers.ts` — create in this task if missing). Log in as user A, open rank page, assert order + own highlight.

Commit.

---

## Task 9: Offline-resubmit spec

**Files:** `e2e/specs/offline-resubmit.spec.ts`

- `context.setOffline(true)` → complete a level → expect local cache
- `context.setOffline(false)` → poll `GET /user/progress` and expect entry to appear

Commit.

---

## Task 10: Ad & share spec

**Files:** `e2e/specs/ad-share.spec.ts`

- `installTtMock(page, { rewardedAd: { isEnded: true } })` → reward given
- `{ isEnded: false }` → no reward
- `'loadError'` → UI shows error toast
- `shareResult: 'cancel'` → no crash

Commit.

---

## Task 11: Network spec (TC-API-ERR, TC-PLAT-NET)

**Files:** `e2e/specs/network.spec.ts`

Use `page.route('**/user/progress', r => r.fulfill({ status: 500 }))` for 5xx; `r.abort()` for network failure; `context.setOffline(true)` for offline; `await page.waitForEvent('close')` simulate backgrounding for `visibilitychange`.

Commit.

---

## Task 12: Long-run spec (upgrade B)

**Files:** `e2e/specs/long-run.spec.ts`

```ts
test('no heap growth over 5 levels', async ({ page }) => {
  await page.goto('/');
  const client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.collectGarbage');
  const { usedSize: before } = await client.send('Runtime.getHeapUsage') as any;
  for (let lv = 1; lv <= 5; lv++) {
    await page.evaluate((n) => (window as any).__cb.completeLevel(n, 500), lv);
  }
  await client.send('HeapProfiler.collectGarbage');
  const { usedSize: after } = await client.send('Runtime.getHeapUsage') as any;
  expect(after - before).toBeLessThan(20 * 1024 * 1024);
});
```

Commit.

---

## Task 13: Perf spec (upgrade B)

**Files:** `e2e/specs/perf.spec.ts`

Use CDP tracing / `performance.now()` deltas during a scripted 5-second gameplay frame. Assert ≥ 45 FPS median.

Commit.

---

## Task 14: Gap-filler specs

**Files:**
- `e2e/specs/asset-fail.spec.ts` — TC-E2E-ASSET-001 (route static asset to 404 → error page, no white screen)
- `e2e/specs/concurrent-tap.spec.ts` — TC-E2E-CONCUR-001 (rapid-click drop; assert only one dessert per cooldown)
- `e2e/specs/storage-cleared.spec.ts` — TC-E2E-STATE-001 (`context.clearCookies()` + `page.evaluate(() => localStorage.clear())` → re-login)

Commit (one per file).

---

## Task 15: Douyin CLI smoke checklist

**Files:** `e2e/smoke-douyin-cli.md`

```markdown
# Douyin CLI Pre-Submission Smoke Test

> Run before every store submission. Not automated — human-in-the-loop.

## Prerequisites
- Douyin developer tool (latest stable)
- Test AppID + ad unit IDs
- iOS + Android devices (incl. one low-end)

## Checklist
- [ ] TC-PLAT-PKG-001..004: main ≤ 4MB / total ≤ 20MB / cold start ≤ 8s
- [ ] TC-PLAT-SDK-001..004: real `tt.login` → server token exchange → authorized request works
- [ ] TC-PLAT-AD-001..005: rewarded video watch / close / load-fail / rapid trigger / production ad unit
- [ ] TC-PLAT-SHARE-001..002: share card title/image/query correct
- [ ] TC-PLAT-COMPAT-001..005: iOS ok / Android ok / low-end ≥ 30fps / notch safe / orientation locked
- [ ] TC-PLAT-NET-001..003: 3G/30% loss / airplane mode / background-resume
- [ ] TC-PLAT-REVIEW-001..005: privacy agreement / TOS / content compliance / minor protection / ad frequency

## Sign-off
- Name: ______   Date: ______
- Build hash: ______
- Submission URL: ______
```

Commit.

---

## Task 16: Add e2e CI job

**Files:**
- Modify: `.github/workflows/test.yml`

Append the full `e2e` job from design section 5.1. Ensure `needs: [server, client-unit]`. Verify cache key paths: `client/assets/**` and `client/settings/**`.

Commit: `ci(t3): add e2e Playwright workflow job`

---

## Task 17: Acceptance verification

- [ ] `npm run test:e2e` PASS locally (with fallback shell if no Cocos editor)
- [ ] `npm run test:all` PASS end-to-end
- [ ] All P0 + P1 specs green (matrix per design §3.3)
- [ ] `smoke-douyin-cli.md` committed and linked from `docs/test/README.md`
- [ ] CI wall-clock ≤ 6 minutes on cache hit
- [ ] Playwright HTML report artifact uploads on failure
- [ ] Codecov badge added to `README.md` (or create `README.md` if missing — keep minimal)
- [ ] `docs/dev/README.md` status table updated: "集成测试 ✅"

If green → **T3 complete; all 10 gaps from design §3.6 are closed**; project is ready for the Douyin CLI human smoke pass before submission.
