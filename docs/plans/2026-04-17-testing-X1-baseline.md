# X1 — Testing Strategy Baseline + Diagnostics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Establish a trustworthy testing baseline (real coverage numbers, clean skip inventory, Jest harness + Cocos build bundle) so X2 can execute "red → fix → green" cycles on solid ground.

**Architecture:** Fix coverage instrumentation first so baseline numbers are real; build `gameHarness.ts` as the single L1 entry; land Cocos web-mobile bundle in repo; delete fallback shell; enforce skip hygiene via a lint script; set regression-proof coverage floor. One bundled merge at the end of X1.

**Tech Stack:** Jest 30, Playwright 1.48, ts-jest, `--coverage-provider=v8`, Cocos Creator 3.8.8 CLI, Node 20, plain shell for pre-commit (no new runtime deps).

**Reference:** `docs/plans/2026-04-17-testing-strategy-design.md` §5.1

---

## Pre-flight dependency note

**Task 8 (delete fallback shell) depends on Task 6 (build:e2e-bundle) producing a real Cocos product.** If no machine with Cocos Creator 3.8.8 is available during X1, stop after Task 7 and flag Task 8 as blocked in the baseline doc — `main` must stay CI-green, so fallback shell deletion cannot proceed until the real bundle exists in repo.

### Cocos Creator 3.8.8 location (this host)

Confirmed: `C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe`
(Electron 31.3.1 packaging).

Before running Task 6, export the path so the build script finds the binary
without touching PATH. Either shell works:

```bash
# Git Bash
export COCOS_CREATOR_PATH="/c/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe"
```

```powershell
# PowerShell
$env:COCOS_CREATOR_PATH = "C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe"
```

`scripts/build-e2e-bundle.mjs` reads `process.env.COCOS_CREATOR_PATH` and
falls back to the literal string `CocosCreator` (PATH lookup) only when
the env var is unset.

---

## Task 1: Baseline diagnostic report

**Files:**
- Create: `docs/test/2026-04-17-baseline.md`

**Why:** Current coverage numbers are fake (FU-T1-01/02) and some specs are silently skipping. Before changing anything, we freeze the observed state as a "before" snapshot.

**Step 1: Run full test suite and capture output**

```bash
npm run test:all 2>&1 | tee /tmp/test-baseline-before.log
```

Expected: either pass or fail — we just need the output captured. Do NOT fix any failures yet.

**Step 2: List every spec file with its status**

Run:
```bash
find server/src server/test client/tests e2e/specs scripts/tests -name '*.spec.*' -o -name '*.e2e-spec.ts' 2>/dev/null | grep -v node_modules | sort > /tmp/spec-inventory.txt
wc -l /tmp/spec-inventory.txt
```

Expected output: ~20–25 spec files found (4 server, 10 client, 11 e2e, 4 scripts).

**Step 3: Extract skip blocks**

```bash
grep -rn --include='*.spec.ts' --include='*.e2e-spec.ts' -E '(test|it|describe)\.skip\(' server/ client/tests e2e/specs 2>/dev/null > /tmp/skip-inventory.txt
wc -l /tmp/skip-inventory.txt
```

Expected output: ~4–6 skip blocks found (at least 2 in `e2e/specs/playthrough.spec.ts` and `long-run.spec.ts`).

**Step 4: Write `docs/test/2026-04-17-baseline.md`** with these sections:

```markdown
# Testing Baseline — 2026-04-17

Frozen "before" snapshot taken at X1 start. Used as the reference for
§4.3 coverage regression floor.

## Spec inventory
- Server unit: <count> (list file names)
- Server e2e: <count>
- Client unit: <count>
- E2E Playwright: <count>
- Scripts: <count>

## Test suite run result
- Command: `npm run test:all`
- Result: <pass | fail>
- Output log: `/tmp/test-baseline-before.log` (not committed; link to CI run if available)

## Observed coverage (BEFORE instrumentation fix — numbers are known bad)
- server: <n>%
- server-e2e: 0% (FU-T1-01 — empty coverage-final.json)
- client core/data/net: <n>%
- scripts: 0% (FU-T1-02 — ESM not instrumented)

## Skip inventory (BEFORE skip hygiene)
- Total skip blocks: <n>
- Locations:
  - `<file>:<line>` `<test name>` — reason (if any)
  - ...

## Known broken functions
- `DouyinCodeExchanger` — ✅ restored 2026-04-16 (commit 7e76d41)
- `GameState.setStorage` — scaffolding unused in production code (FU-T2-01)
- `ApiClient.queueForLater` — not implemented (FU-T2-02)
- `ApiClient` 401 handling — absent (FU-T2-03)
- `CustomerManager` per-order timeout — absent (FU-T2-04)
- `ValidationPipe` — not strict (FU-T1-05)
- `progress.dto` round/score bounds — absent (FU-T1-06/07)
- `test:client` coverage escapes to parent-of-repo (Task 3.5) — caused merged
  lcov to silently skip client data; unrelated to FU-T1-01/02

## Blockers for X1 completion
- [ ] Cocos Creator 3.8.8 availability for Task 6 build
- [ ] Real historical request samples for Task 8 strict-ValidationPipe safety check
```

Fill in actual numbers from Steps 1–3.

**Step 5: Commit**

```bash
git add docs/test/2026-04-17-baseline.md
git commit -m "docs: freeze pre-X1 testing baseline snapshot"
```

---

## Task 2: Fix server-e2e coverage instrumentation (FU-T1-01)

**Files:**
- Modify: `server/test/jest-e2e.json`

**Step 1: Verify the bug**

```bash
rm -rf coverage/raw/server-e2e
npm run test:server:e2e
cat coverage/raw/server-e2e/coverage-final.json | head -c 100
```

Expected: empty object `{}` or minimal content — confirms FU-T1-01.

**Step 2: Add `coverageProvider: "v8"` to jest-e2e.json**

Edit `server/test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testRegex": ".e2e-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "testEnvironment": "node",
  "globalSetup": "<rootDir>/setup-e2e.ts",
  "globalTeardown": "<rootDir>/teardown-e2e.ts",
  "collectCoverageFrom": ["../src/**/*.ts", "!../src/main.ts", "!**/*.d.ts"],
  "coverageProvider": "v8"
}
```

**Step 3: Re-run and verify non-empty coverage**

```bash
rm -rf coverage/raw/server-e2e
npm run test:server:e2e
node -e "const c = require('./coverage/raw/server-e2e/coverage-final.json'); console.log('files covered:', Object.keys(c).length);"
```

Expected: `files covered: 20+` (real data, not `0`).

**Step 4: Commit**

```bash
git add server/test/jest-e2e.json
git commit -m "fix(test): enable v8 coverage provider for server e2e (FU-T1-01)"
```

---

## Task 3: Fix scripts ESM coverage instrumentation (FU-T1-02)

**Files:**
- Modify: `scripts/tests/jest.config.js`

**Step 1: Verify the bug**

```bash
rm -rf coverage/raw/scripts
npm run test:scripts
cat coverage/raw/scripts/coverage-summary.json 2>/dev/null || echo "no summary"
```

Expected: 0% coverage on `.mjs` files (`cocos-mcp-proxy.mjs` shows `0/0` despite having a spec).

**Step 2: Switch provider to v8**

Edit `scripts/tests/jest.config.js`:

```js
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/**/*.spec.{js,mjs}'],
  testEnvironment: 'node',
  passWithNoTests: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '../generate_images.js',
    '../process_images.js',
    '../optimize_scenes.js',
    '../cocos-mcp-proxy.mjs',
  ],
};
```

**Step 3: Re-run and verify .mjs now instrumented**

```bash
rm -rf coverage/raw/scripts
npm run test:scripts
node -e "const c = require('./coverage/raw/scripts/coverage-summary.json'); console.log(JSON.stringify(c.total, null, 2));"
```

Expected: non-zero lines/functions/statements for the .mjs file.

**Step 4: Commit**

```bash
git add scripts/tests/jest.config.js
git commit -m "fix(test): enable v8 coverage provider for scripts ESM (FU-T1-02)"
```

---

## Task 3.5: Fix client coverage output escape-to-parent-of-repo bug

**Files:**
- Modify: `client/tests/package.json`

**Background:** Empirically verified on 2026-04-17 — `npm run test:client`
writes its coverage to `D:\workspace\tiktok\coverage\raw\client\` (one level
**above the repo root**), not to `<repo>/coverage/raw/client/`. Root cause:
`client/tests/jest.config.ts` has `rootDir: '..'` (→ `client/`), so Jest
resolves the CLI flag `--coverageDirectory=../../coverage/raw/client`
relative to `client/` and climbs one level too many. Result:
`nyc merge coverage/raw/client ...` in the root `coverage:merge` script
silently ignores the missing input → merged lcov is incomplete → Codecov
numbers are wrong even after Tasks 2 and 3 are done.

**Step 1: Verify the bug is still present after a fresh install**

```bash
cd D:/workspace/tiktok/mini-game
rm -rf coverage/ ../coverage/ 2>/dev/null
npm run test:client
ls coverage/raw/ 2>&1
ls ../coverage/raw/ 2>&1
```

Expected: `../coverage/raw/` (outside repo) has a `client` subdir; local
`coverage/raw/` does not. Confirms the bug.

**Step 2: Fix `client/tests/package.json`**

Change the `test:ci` line by adding one more `../` — from `../../coverage/raw/client`
to `../../../coverage/raw/client`. The path now climbs: `client/` → repo root
→ `coverage/raw/client`. Wait — that's three ups from `client/`, which
overshoots. The correct path from rootDir=`client/` to repo-root is
**one** `../`, not three. The original `--coverageDirectory=../../...`
overshot by one because whoever wrote it assumed Jest resolves CLI flags
from `client/tests/` (the package.json dir), not from `rootDir=client/`.

Correct fix: `../coverage/raw/client`.

Edit `client/tests/package.json`:

```json
"test:ci": "jest --coverage --coverageDirectory=../coverage/raw/client"
```

**Step 3: Re-run and verify the coverage now lands inside the repo**

```bash
cd D:/workspace/tiktok/mini-game
rm -rf coverage/ ../coverage/ 2>/dev/null
npm run test:client
ls coverage/raw/client/ 2>&1 | head
ls ../coverage/raw/ 2>&1
```

Expected:
- `coverage/raw/client/` contains `coverage-final.json` and friends (inside repo ✅)
- `../coverage/raw/` does not exist (no more leak ✅)

**Step 4: Verify `coverage:merge` now consumes client raw data**

```bash
npm run test:all
npm run coverage:merge 2>&1 | tail -10
cat coverage/client.json | head -c 100
```

Expected: `coverage/client.json` is non-empty JSON; `coverage:merge` does
not skip any input.

**Step 5: Commit**

```bash
git add client/tests/package.json
git commit -m "fix(test): client coverage was writing outside repo (rootDir double-climb)"
```

---

## Task 4: Re-measure baseline with real coverage

**Files:**
- Modify: `docs/test/2026-04-17-baseline.md`

**Step 1: Run full coverage**

```bash
rm -rf coverage/
npm run test:all
npm run coverage:merge 2>/dev/null || true
```

**Step 2: Collect real numbers**

Read `coverage/raw/server/coverage-summary.json`, `coverage/raw/server-e2e/coverage-summary.json`, `coverage/raw/client/coverage-summary.json`, `coverage/raw/scripts/coverage-summary.json`. Get `total.lines.pct` / `total.branches.pct` / `total.functions.pct` / `total.statements.pct` for each.

**Step 3: Update the "Observed coverage" section of baseline doc with real numbers**

Replace the "BEFORE instrumentation fix" paragraph with:

```markdown
## Observed coverage (AFTER instrumentation fix — real numbers)
| Workspace | lines | branches | functions | statements |
|-----------|-------|----------|-----------|------------|
| server    |  <n>% |   <n>%   |   <n>%    |    <n>%    |
| server-e2e|  <n>% |   <n>%   |   <n>%    |    <n>%    |
| client    |  <n>% |   <n>%   |   <n>%    |    <n>%    |
| scripts   |  <n>% |   <n>%   |   <n>%    |    <n>%    |

These numbers become the X1-end regression floor (Task 11).
```

**Step 4: Commit**

```bash
git add docs/test/2026-04-17-baseline.md
git commit -m "docs: record real coverage baseline after v8 instrumentation"
```

---

## Task 5: Jest harness entry package

**Files:**
- Create: `client/tests/harness/gameHarness.ts`
- Create: `client/tests/harness/gameHarness.spec.ts`

**Step 1: Write the failing test**

Create `client/tests/harness/gameHarness.spec.ts`:

```ts
import { createGameHarness } from './gameHarness';

describe('gameHarness', () => {
  it('instantiates with default deps', () => {
    const h = createGameHarness();
    expect(h).toBeDefined();
    expect(typeof h.dropDessert).toBe('function');
    expect(typeof h.getState).toBe('function');
  });

  it('accepts injected rng for determinism', () => {
    const rng = jest.fn(() => 0.5);
    const h = createGameHarness({ rng });
    // Intentionally minimal — full API surface grows in X2.
    // This test only proves the injection plumbing is alive.
    h.getState();
    // rng is not yet wired to anything; we assert the factory accepts it.
    expect(h).toBeDefined();
  });
});
```

**Step 2: Run the test — verify it fails**

```bash
cd client/tests && npx jest harness/gameHarness.spec.ts
```

Expected: `Cannot find module './gameHarness'` or similar — test fails.

**Step 3: Write the minimal harness**

Create `client/tests/harness/gameHarness.ts`:

```ts
/**
 * X1 minimal scaffold — API surface grows in X2 as production code modules
 * are refactored for dependency injection (see
 * docs/plans/2026-04-17-testing-strategy-design.md §2.1).
 */

export interface IKVStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface GameHarnessOpts {
  rng?: () => number;
  clock?: () => number;
  storage?: IKVStorage;
  fetchImpl?: typeof fetch;
}

export interface GameHarness {
  dropDessert: (type: number, x: number) => void;
  getState: () => Record<string, unknown>;
}

export function createGameHarness(_opts: GameHarnessOpts = {}): GameHarness {
  // X1 stub: the real harness composes core/data/net modules.
  // Each X2 PR will expand this as the corresponding production module
  // becomes injectable.
  return {
    dropDessert: () => {
      throw new Error('not yet wired — see X2 P5 (core dependency injection)');
    },
    getState: () => ({}),
  };
}
```

**Step 4: Run the test — verify it passes**

```bash
cd client/tests && npx jest harness/gameHarness.spec.ts
```

Expected: 2 passed, 0 failed.

**Step 5: Commit**

```bash
git add client/tests/harness/
git commit -m "test(harness): add gameHarness entry scaffold for X2 expansion"
```

---

## Task 6: `build:e2e-bundle` script

**Files:**
- Create: `scripts/build-e2e-bundle.mjs`
- Modify: `package.json` (root) — add `build:e2e-bundle` script
- Create: `e2e/dist/web-mobile/__asset-hash` (auto-generated)

**Pre-req check:** Confirm Cocos Creator 3.8.8 binary is reachable. The
build script reads `$COCOS_CREATOR_PATH` first, then falls back to a bare
`CocosCreator` on PATH. On this host the confirmed path is
`C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe` — set the
env var before running Task 6 (see top-of-plan "Cocos Creator 3.8.8
location" block for the exact export).

```bash
# Sanity: binary exists and is executable
[ -x "$COCOS_CREATOR_PATH" ] && echo OK || echo "set COCOS_CREATOR_PATH first"
```

If the binary is NOT present on this machine, **stop here and flag in
baseline doc**: X1 will end at Task 7 with Task 8 pending.

**Step 1: Write the script**

Create `scripts/build-e2e-bundle.mjs`:

```js
#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CLIENT = join(ROOT, 'client');
const OUTDIR = join(ROOT, 'e2e/dist/web-mobile');
const COCOS = process.env.COCOS_CREATOR_PATH || 'CocosCreator';

function hashAssets() {
  const h = createHash('sha256');
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        h.update(relative(CLIENT, p));
        h.update(readFileSync(p));
      }
    }
  };
  walk(join(CLIENT, 'assets'));
  walk(join(CLIENT, 'settings'));
  return h.digest('hex');
}

function build() {
  const hash = hashAssets();
  console.log(`Asset hash: ${hash}`);
  const existing = existsSync(join(OUTDIR, '__asset-hash'))
    ? readFileSync(join(OUTDIR, '__asset-hash'), 'utf8').trim()
    : null;
  if (existing === hash && existsSync(join(OUTDIR, 'index.html'))) {
    console.log('Bundle already fresh, skipping rebuild.');
    return;
  }
  console.log('Invoking Cocos Creator CLI…');
  execSync(
    `"${COCOS}" --project "${CLIENT}" --build "platform=web-mobile;debug=false;md5Cache=false"`,
    { stdio: 'inherit' }
  );
  // Cocos default output is client/build/web-mobile — move/copy to e2e/dist/web-mobile
  const cocosOut = join(CLIENT, 'build/web-mobile');
  if (!existsSync(cocosOut)) {
    throw new Error(`Cocos output not found at ${cocosOut}`);
  }
  execSync(`rm -rf "${OUTDIR}" && mkdir -p "${OUTDIR}" && cp -R "${cocosOut}/"* "${OUTDIR}/"`, { stdio: 'inherit' });
  writeFileSync(join(OUTDIR, '__asset-hash'), hash + '\n');
  console.log(`Bundle written to ${OUTDIR}`);
}

build();
```

**Step 2: Wire the npm script**

Edit root `package.json`, add to the `scripts` block:

```json
"build:e2e-bundle": "node scripts/build-e2e-bundle.mjs"
```

**Step 3: Run it**

```bash
npm run build:e2e-bundle
```

Expected:
- Cocos Creator invoked, build completes (2–5 min)
- `e2e/dist/web-mobile/index.html` exists
- `e2e/dist/web-mobile/__asset-hash` matches `hashAssets()` output

**Step 4: Verify Playwright can load the bundle**

```bash
npx http-server e2e/dist/web-mobile -p 4567 &
sleep 2
curl -s http://127.0.0.1:4567/ | grep -i 'GameCanvas' && echo OK
kill %1
```

Expected: `OK` — `#GameCanvas` is in the HTML.

**Step 5: Commit (bundle + script together)**

```bash
git add scripts/build-e2e-bundle.mjs package.json e2e/dist/web-mobile/
git commit -m "build(e2e): add build:e2e-bundle + commit initial Cocos web-mobile bundle"
```

Expected commit size: 5–10 MB (bundle contents). If >30 MB, stop and discuss LFS.

---

## Task 7: Asset-hash freshness check (CI gate, optional local pre-commit)

**Files:**
- Create: `scripts/check-e2e-bundle-freshness.mjs`
- Modify: `package.json` — add `check:e2e-bundle` script
- Modify: `.github/workflows/test.yml` — add freshness gate to e2e job

**Step 1: Write the failing check (no bundle-stale scenario yet)**

Create `scripts/check-e2e-bundle-freshness.mjs`:

```js
#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CLIENT = join(ROOT, 'client');
const OUTDIR = join(ROOT, 'e2e/dist/web-mobile');

function hashAssets() {
  const h = createHash('sha256');
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else { h.update(relative(CLIENT, p)); h.update(readFileSync(p)); }
    }
  };
  walk(join(CLIENT, 'assets'));
  walk(join(CLIENT, 'settings'));
  return h.digest('hex');
}

const current = hashAssets();
const hashFile = join(OUTDIR, '__asset-hash');
if (!existsSync(hashFile)) {
  console.error('E2E bundle missing. Run: npm run build:e2e-bundle');
  process.exit(2);
}
const committed = readFileSync(hashFile, 'utf8').trim();
if (current !== committed) {
  console.error(`E2E bundle stale:
  committed: ${committed}
  current:   ${current}
Run: npm run build:e2e-bundle && git add e2e/dist/web-mobile && commit.`);
  process.exit(1);
}
console.log('E2E bundle is fresh.');
```

**Step 2: Wire npm script**

Edit root `package.json`, add:

```json
"check:e2e-bundle": "node scripts/check-e2e-bundle-freshness.mjs"
```

**Step 3: Verify: fresh bundle → exit 0**

```bash
npm run check:e2e-bundle
echo "exit=$?"
```

Expected: `E2E bundle is fresh.` and `exit=0`.

**Step 4: Verify: stale bundle → exit 1**

```bash
# Temporarily touch an asset so hashes diverge
touch client/assets/scripts/test-scratch.txt
npm run check:e2e-bundle
echo "exit=$?"
rm client/assets/scripts/test-scratch.txt
```

Expected: `E2E bundle stale:` with hashes, `exit=1`.

**Step 5: Wire into CI e2e job**

Edit `.github/workflows/test.yml`, in the `e2e` job add a step BEFORE `npm run test:e2e`:

```yaml
      - name: Verify e2e bundle freshness
        run: npm run check:e2e-bundle
```

Also remove the "Restore Cocos web-mobile build cache" and "Build web-mobile" steps from the e2e job — the bundle is now committed, no build needed in CI.

**Step 6: Optional — install local git pre-commit hook**

This is documentation, not enforcement. Add to `docs/test/README.md` (will be created in X4) or to the baseline doc's appendix:

```bash
# Optional local hook
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/sh
if git diff --cached --name-only | grep -qE '^client/(assets|settings)/'; then
  npm run check:e2e-bundle || exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

**Step 7: Commit**

```bash
git add scripts/check-e2e-bundle-freshness.mjs package.json .github/workflows/test.yml
git commit -m "ci(e2e): gate PRs on e2e-bundle freshness (asset-hash check)"
```

---

## Task 8: Delete fallback shell (BLOCKED until Task 6 succeeded)

**Pre-req:** `e2e/dist/web-mobile/index.html` exists (from Task 6). If Task 6 was flagged blocked, SKIP THIS TASK and update baseline doc.

**Files:**
- Delete: `e2e/static/app.ts`
- Delete: `e2e/static/shell.html`
- Delete: `e2e/fixtures/shell-compat.ts`
- Delete: `e2e/scripts/build-fallback-shell.mjs`
- Modify: `e2e/scripts/build-web-mobile.mjs` — remove fallback path
- Modify: `e2e/playwright.config.ts` — baseURL change
- Modify: `e2e/specs/smoke.spec.ts`, `e2e/specs/playthrough.spec.ts`, `e2e/specs/long-run.spec.ts` — remove shell-compat usages and dead skip blocks
- Modify: `e2e/fixtures/global-setup.ts` — serve real bundle

**Step 1: Inventory what references fallback shell**

```bash
grep -rn --include='*.ts' --include='*.mjs' 'shell-compat\|isFallbackShell\|__cb\|e2e/static\|build-fallback-shell' e2e/ 2>/dev/null
```

List every match — every one of them will be deleted or updated in this task.

**Step 2: Delete fallback-shell-only skip blocks**

Edit `e2e/specs/playthrough.spec.ts`:

- Delete `test.skip('TC-E2E-001 real playthrough: drop -> merge -> complete round', ...)` and its comment.
- Delete `test.skip('TC-E2E-004 three consecutive rounds no leak', ...)` and its comment.
- Delete the `isFallbackShell(page)` branch in `TC-E2E-001 lifecycle proxy` — keep only the real-Cocos assertion: `await expect(page.locator('#GameCanvas')).toBeAttached();`.

Edit `e2e/specs/long-run.spec.ts` — the entire file is gated-on-Cocos-build skip. Replace the file content with a placeholder that will be filled by X3:

```ts
import { test } from '@playwright/test';

// TC-E2E-LONG-001 heap stability: deferred to X3. Not a skip — the test
// doesn't exist yet. See docs/plans/2026-04-17-testing-strategy-design.md §3.2 ⑨.
test.describe.skip('long-run (pending X3)', () => {
  // SKIP-REASON: awaiting X3 implementation
  test('placeholder', () => {});
});
```

**Step 3: Delete shell-compat fixture**

```bash
rm e2e/fixtures/shell-compat.ts
rm e2e/static/app.ts e2e/static/shell.html
rm e2e/scripts/build-fallback-shell.mjs
rmdir e2e/static 2>/dev/null || true
```

**Step 4: Replace `shellRoot` usages in specs**

Anywhere a spec imports `shellRoot` or `isFallbackShell`, replace with direct `#GameCanvas` locator. Example for `smoke.spec.ts`:

```ts
// before:
import { shellRoot } from '../fixtures/shell-compat';
// ...
await expect(shellRoot(page)).toBeVisible();

// after:
// ...
await expect(page.locator('#GameCanvas')).toBeVisible();
```

Grep and apply across: `smoke.spec.ts`, `playthrough.spec.ts`, `auth-flow.spec.ts`, `ad-share.spec.ts`, etc. — whatever Task 8 Step 1 surfaced.

**Step 5: Simplify `build-web-mobile.mjs`**

Edit `e2e/scripts/build-web-mobile.mjs`:

- Remove the "try Cocos CLI, fallback to esbuild shell" logic.
- Replace body with: verify `e2e/dist/web-mobile/index.html` exists; if not, error: "Run `npm run build:e2e-bundle` at repo root."

```js
#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE = join(process.cwd(), '../e2e/dist/web-mobile/index.html');
if (!existsSync(BUNDLE)) {
  console.error('e2e bundle missing. Run at repo root: npm run build:e2e-bundle');
  process.exit(1);
}
console.log('e2e bundle present:', BUNDLE);
```

**Step 6: Confirm Playwright baseURL already points to `http://127.0.0.1:4567`**

Inspect `e2e/playwright.config.ts` — baseURL should already be `http://127.0.0.1:4567`. The `global-setup.ts` must serve `e2e/dist/web-mobile/` on that port (not `e2e/static/`).

Inspect `e2e/fixtures/global-setup.ts`:

```bash
grep -n 'e2e/static\|e2e/dist' e2e/fixtures/global-setup.ts
```

If it mentions `e2e/static/`, change to `e2e/dist/web-mobile/`.

**Step 7: Run Playwright smoke**

```bash
npm run test:e2e -- --grep smoke
```

Expected: smoke.spec.ts passes against real Cocos bundle. If fails because server not up, check `global-setup.ts` launches NestJS — that stays unchanged.

**Step 8: Commit**

```bash
git add e2e/ -A
git commit -m "test(e2e): delete fallback shell; Playwright now runs against real Cocos bundle"
```

---

## Task 9: Skip-lint tool

**Files:**
- Create: `scripts/lint-skip-reasons.mjs`
- Create: `scripts/tests/lint-skip-reasons.spec.mjs`
- Modify: `package.json` — add `lint:skips` script
- Modify: `.github/workflows/test.yml` — add lint:skips step to one of the jobs

**Step 1: Write failing test**

Create `scripts/tests/lint-skip-reasons.spec.mjs`:

```js
import { describe, it, expect } from '@jest/globals';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function runLint(content) {
  const dir = mkdtempSync(join(tmpdir(), 'lint-skip-'));
  writeFileSync(join(dir, 'fake.spec.ts'), content);
  try {
    execSync(`node ${process.cwd()}/../scripts/lint-skip-reasons.mjs ${dir}`, { stdio: 'pipe' });
    return { exit: 0 };
  } catch (e) {
    return { exit: e.status, stderr: String(e.stderr) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('lint-skip-reasons', () => {
  it('passes when no skips present', () => {
    const r = runLint(`test('x', () => {});`);
    expect(r.exit).toBe(0);
  });

  it('passes when skip has SKIP-REASON comment above', () => {
    const r = runLint(`
// SKIP-REASON: FU-T2-01 pending
test.skip('y', () => {});
`);
    expect(r.exit).toBe(0);
  });

  it('fails on naked test.skip', () => {
    const r = runLint(`test.skip('z', () => {});`);
    expect(r.exit).toBe(1);
    expect(r.stderr).toMatch(/naked skip/i);
  });

  it('fails on describe.skip without reason', () => {
    const r = runLint(`describe.skip('w', () => {});`);
    expect(r.exit).toBe(1);
  });
});
```

**Step 2: Run — verify fails with "module not found"**

```bash
npm run test:scripts -- lint-skip-reasons
```

Expected: failing — script doesn't exist yet.

**Step 3: Implement `scripts/lint-skip-reasons.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_RE = /\b(test|it|describe)\.skip\s*\(/;
const REASON_RE = /SKIP-REASON:/;

const roots = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['server', 'client/tests', 'e2e/specs', 'scripts/tests'];

const violations = [];

function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.spec\.(ts|js|mjs)$|\.e2e-spec\.ts$/.test(name)) checkFile(p);
  }
}

function checkFile(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (SKIP_RE.test(lines[i])) {
      const window = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
      if (!REASON_RE.test(window)) {
        violations.push(`${path}:${i + 1} naked skip (no SKIP-REASON comment within 5 preceding lines)`);
      }
    }
  }
}

for (const r of roots) walk(r);

if (violations.length > 0) {
  console.error('Skip-lint violations:');
  for (const v of violations) console.error('  ' + v);
  console.error(`\n${violations.length} violation(s). Add SKIP-REASON comments or remove the skip.`);
  process.exit(1);
}
console.log('Skip-lint: clean.');
```

**Step 4: Run test — verify passes**

```bash
npm run test:scripts -- lint-skip-reasons
```

Expected: 4 passed.

**Step 5: Wire npm script and CI**

Add to root `package.json`:

```json
"lint:skips": "node scripts/lint-skip-reasons.mjs"
```

Add to `.github/workflows/test.yml` — put it in one of the existing jobs (e.g., `client-unit` since it's fast). Add a step BEFORE the `test:client` run:

```yaml
      - run: npm run lint:skips
```

**Step 6: Commit**

```bash
git add scripts/lint-skip-reasons.mjs scripts/tests/lint-skip-reasons.spec.mjs package.json .github/workflows/test.yml
git commit -m "test(lint): add skip-reasons linter (blocks naked test.skip in CI)"
```

---

## Task 10: Audit existing skips and fix violations

**Files:** whatever Task 9 Step 5 output lists as violations.

**Step 1: Run lint, capture violations**

```bash
npm run lint:skips 2>&1 | tee /tmp/skip-violations.txt
```

Expected: 2–4 violations (Task 8 should have already cleaned the two `playthrough.spec.ts` and `long-run.spec.ts` skips; remaining are legitimate pending work).

**Step 2: For each violation, choose one of two fixes**

**Fix A — add SKIP-REASON comment** (when the skip is waiting on known pending work):

```ts
// SKIP-REASON: FU-T1-06 — progress.dto round bounds not yet enforced.
// Tracked in docs/plans/2026-04-17-testing-strategy-design.md §3.3.
test.skip('TC-USER-004 round boundary rejection', () => { ... });
```

**Fix B — delete the skip block** (when the test was abandoned or supersded).

Decision for each violation:
- If a FU-TX-XX item in §3.3 covers the gap → Fix A with that reference.
- If no pending work tracks it → Fix B.

**Step 3: Re-run lint**

```bash
npm run lint:skips
echo "exit=$?"
```

Expected: `Skip-lint: clean.` and `exit=0`.

**Step 4: Commit**

```bash
git add server/ client/tests e2e/specs scripts/tests
git commit -m "test: annotate or remove legacy test.skip blocks (skip-lint clean)"
```

---

## Task 11: Coverage regression-proof floor

**Files:**
- Modify: `client/tests/jest.config.ts` — coverageThreshold
- Modify: `server/package.json` (`jest` block or separate `jest.config.js`) — coverageThreshold
- Modify: `scripts/tests/jest.config.js` — coverageThreshold

**Step 1: Read baseline numbers from Task 4**

Open `docs/test/2026-04-17-baseline.md` "Observed coverage" table. Note each workspace's `lines` percentage.

**Step 2: Compute floor values**

For each workspace, floor = `max(0, floor(baseline_pct) - 2)`. The -2 gives small headroom so minor refactors don't trip CI. Do NOT round up.

**Step 3: Update server jest threshold**

Look at `server/package.json` — if there's a top-level `jest` config, edit it; otherwise the defaults are fine to add:

```json
"jest": {
  "coverageThreshold": {
    "global": {
      "lines": <floor>,
      "branches": <floor-5>,
      "functions": <floor>,
      "statements": <floor>
    }
  }
}
```

**Step 4: Update client threshold**

Edit `client/tests/jest.config.ts` — change the existing `coverageThreshold.global` block to match real baseline (currently it's `{ branches: 40, functions: 45, lines: 70, statements: 60 }` which may or may not be accurate).

**Step 5: Update scripts threshold**

Add `coverageThreshold` to `scripts/tests/jest.config.js`. Per §4.3 scripts does not target numeric coverage but still needs a regression floor:

```js
coverageThreshold: {
  global: { lines: <floor>, functions: <floor>, branches: <floor-5>, statements: <floor> },
},
```

**Step 6: Run full test:all**

```bash
rm -rf coverage/
npm run test:all
```

Expected: all green, no threshold violations.

**Step 7: Commit**

```bash
git add server/package.json client/tests/jest.config.ts scripts/tests/jest.config.js
git commit -m "test: enforce X1 coverage floor (regression-proof baseline)"
```

---

## Task 12: Archive superseded design docs

**Files:**
- Modify: `docs/plans/2026-04-15-test-automation-design.md`
- Modify: `docs/plans/2026-04-15-test-automation-T1-server-scripts.md`
- Modify: `docs/plans/2026-04-15-test-automation-T1-followups.md`
- Modify: `docs/plans/2026-04-15-test-automation-T2-client-unit.md`
- Modify: `docs/plans/2026-04-15-test-automation-T3-e2e.md`

**Step 1: Prepend archive banner to each file**

Add this block at the very top of each of the 5 files:

```markdown
> **[ARCHIVED 2026-04-17]** — Superseded by
> [2026-04-17-testing-strategy-design.md](./2026-04-17-testing-strategy-design.md).
> Kept for historical decision context; do NOT execute from this document.

---

```

**Step 2: Verify each file has the banner**

```bash
head -5 docs/plans/2026-04-15-test-automation-*.md
```

Expected: all 5 files have the banner as the first lines.

**Step 3: Commit**

```bash
git add docs/plans/2026-04-15-test-automation-*.md
git commit -m "docs: archive superseded 2026-04-15 test-automation design set"
```

---

## X1 Completion Checklist

Before declaring X1 done, verify all of:

- [ ] `docs/test/2026-04-17-baseline.md` committed with real coverage numbers
- [ ] `npm run test:server:e2e` produces non-empty coverage-final.json
- [ ] `npm run test:scripts` produces non-zero coverage for .mjs files
- [ ] `npm run test:client` writes coverage inside the repo (Task 3.5 fix verified; no `../coverage/` leak)
- [ ] `client/tests/harness/gameHarness.ts` + its spec committed and green
- [ ] `e2e/dist/web-mobile/index.html` + `__asset-hash` committed (OR baseline doc flags Task 6 blocked)
- [ ] `npm run check:e2e-bundle` returns 0 on fresh, 1 on stale
- [ ] CI `test.yml` e2e job uses bundle directly (no more Cocos build step)
- [ ] `e2e/fixtures/shell-compat.ts`, `e2e/static/`, `build-fallback-shell.mjs` deleted (if Task 8 executed)
- [ ] `npm run lint:skips` returns 0
- [ ] Coverage thresholds set in all 3 workspaces matching baseline - 2%
- [ ] 5 `2026-04-15-test-automation-*.md` files have `[ARCHIVED 2026-04-17]` banner
- [ ] `npm run test:all` green end-to-end

Then push the bundled work as one merge to `main` (or the X1 integration branch) per design doc §5.1 "合入闸门".

---

## Next

After X1 is merged:
1. Fill in detailed steps for `2026-04-17-testing-X2-mainline.md` (currently a scaffold). The P1–P6 PR structure is predefined; the per-spec TDD steps can be written now that baseline is known.
2. Begin X2 P1 (TC-STATE-001..005 + FU-T2-01 persistence).
