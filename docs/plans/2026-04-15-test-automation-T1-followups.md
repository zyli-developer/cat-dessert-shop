# Phase T1 Follow-ups

> Tracked work deferred from T1 tasks. Each item includes the source task and blocking status for later phases.

## Test infrastructure

### FU-T1-01: NestJS + ts-jest e2e coverage instrumentation (from T1-13)
**Problem:** `server/test/*.e2e-spec.ts` runs produce `coverage-final.json` with `{}` — no instrumentation. Drags merged coverage to ~45% when unit coverage alone is actually much higher.
**Fix candidates:** `--coverage-provider=v8`, switch e2e transform to babel-jest with istanbul plugin, or use `@swc/jest` with coverage.
**Blocks:** raising server coverage threshold to design-doc 90%.

### FU-T1-02: Scripts ESM coverage instrumentation (from T1-12)
**Problem:** `scripts/tests` runs under `--experimental-vm-modules`, which bypasses Jest's babel-jest coverage instrumentation for `.mjs` modules. Coverage reports 0% even for well-tested code.
**Fix:** Migrate to `--coverage-provider=v8` or rewrite `.mjs` scripts as `.js` with dynamic import.
**Blocks:** including scripts workspace in merged coverage threshold.

### FU-T1-03: Jest bin path resilience (from T1-12)
**Problem:** `scripts/tests/package.json` invokes `node --experimental-vm-modules ../../node_modules/jest/bin/jest.js` — fragile to Jest's internal bin layout.
**Fix:** Restore `cross-env` devDep for cross-platform env var, or wrap via `npx jest`.
**Blocks:** nothing; cleanup only.

## Server-side gaps

### FU-T1-04: Restore Douyin code2session implementation (from T1-04)
**Problem:** `server/src/auth/code-exchanger.ts` `DouyinCodeExchanger.exchange` is a stub throwing `UnauthorizedException`. Production login path broken.
**Fix:** Port the jscode2session HTTPS flow back (see pre-7a3bbd6 auth.service.ts).
**Blocks:** production deployment.

### FU-T1-05: ValidationPipe global config (from T1-06)
**Problem:** `server/src/main.ts` uses `ValidationPipe({transform:true})` only; missing `whitelist + forbidNonWhitelisted`. E2E tests opt in locally; production does not.
**Fix:** Update main.ts to use the stricter config. Validate no existing endpoint breaks.

### FU-T1-06: ProgressDto.round bounds (from T1-06)
**Problem:** No `@Min(1)` / `@Max(N)` on `server/src/user/dto/progress.dto.ts` `round`. TC-USER-004 skipped.
**Fix:** Add `@Min(1) @Max(10)` (or actual max-level from levels.json). Un-skip TC-USER-004.

### FU-T1-07: ProgressDto.score bounds (from T1-07)
**Problem:** No `@Min(0)` on `score`. TC-RANK-006 skipped.
**Fix:** Add `@Min(0)`. Un-skip TC-RANK-006.

## Scripts-side gaps

### FU-T1-08: Error propagation policy in process_images.js (from T1-10)
**Problem:** `processImage` swallows sharp errors (logs + returns false). `main()` never exits non-zero on partial failures.
**Fix:** Decide — propagate, OR have main() count failures and exit non-zero if any. Align TC-SCR-PROC-003 with the decision.

### FU-T1-09: Asset bundle budget enforcement in process_images.js (from T1-10)
**Problem:** No mechanism to enforce the Douyin 4MB main-package / 20MB total budget. `main()` prints total MB but doesn't fail.
**Fix:** Add `--budget-mb` flag (or env var) that exits non-zero when total output exceeds budget. Re-target TC-SCR-PROC-001 at this.

## Coverage thresholds

### FU-T1-10: Raise coverage thresholds toward design target (from T1-13)
**Problem:** Current thresholds set to honest floor (~45%) due to FU-T1-01/02 instrumentation gaps. Design doc target is ≥90% line coverage.
**Fix sequence:** Resolve FU-T1-01/02 → re-measure → raise `coverageThreshold.global.lines` to 85% then 90%.

---

## Execution priority

1. **FU-T1-10** (blocked by FU-T1-01/02) — unlocks threshold enforcement
2. **FU-T1-04** — production login is broken, pre-submission blocker
3. **FU-T1-05** — defense-in-depth; low effort
4. **FU-T1-06/07** — unblocks 2 skipped tests, low effort
5. **FU-T1-08/09** — quality gates for asset pipeline
6. **FU-T1-03** — nitpick cleanup

## Parking lot (for T2/T3 to pick up)

- The above FU-T1-XX items may be pulled into T2 planning if they block client-side test strategy.
- Phase T2's generic `cc` stub will need updating if `progress.dto.ts` bounds change (client `ApiClient` validation may want to match server).

---

# Phase T2 Follow-ups

### FU-T2-01: Implement GameState persistence (unblocks TC-STATE-001)
The `setStorage` / `KVStorage` scaffolding was added in T2-03 but production code never calls `this.storage`. Choose: either wire persistence across game sessions, or remove the dead scaffolding.

### FU-T2-02: Implement offline score queue (unblocks TC-STATE-002)
ApiClient has no queuing mechanism for failed uploads. Design and add `queueForLater(endpoint, payload)` + `flushQueue()` if the design doc requires offline-tolerant score upload.

### FU-T2-03: ApiClient 401 auto-clear-token (unblocks TC-API-CLIENT-004)
On 401 response, currently token is preserved. If spec requires auto-clear, implement; otherwise remove the TC.

### FU-T2-04: CustomerManager timeout mechanism (unblocks TC-CUST-004)
Current manager has no per-order timeout. Add `onCustomerTimeout` callback if timeout-based fail is a gameplay requirement.

### FU-T2-05: Raise client coverage to design target
Current honest floor: 70% lines. Design doc target: 85% lines / 90% funcs. Blocked by ItemManager (0% coverage), Dessert (24%), ApiClient (51%). Add specs for ItemManager and the remaining ApiClient error paths.

### FU-T2-06: cc stub maintenance
As client/assets/scenes/scripts/* gets new `cc` imports, they'll fail at spec load unless added to `client/tests/__mocks__/cc.ts`. Document the "add to stub" step in a README under `client/tests/__mocks__/`.
