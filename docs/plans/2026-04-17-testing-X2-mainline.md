# X2 — Mainline + High-Priority Exceptions Implementation Plan (SCAFFOLD)

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task **AFTER X1 is merged**.

> **SCAFFOLD STATUS:** This plan lists the 6 PRs and their scope, but the bite-sized TDD steps will be filled in post-X1 when the Jest harness API surface and baseline are known. Do NOT start X2 until X1 is complete.

**Goal:** Land the 4 scaffolded-but-unused production features (GameState persistence, offline queue, 401 handling, order timeout) as real implementations, each driven by a failing spec. Ship ~40 L1 specs covering the R3 mainline.

**Architecture:** 6 independent PRs, each following "red (write spec) → green (implement production) → refactor". Every scaffold completion is paired with its target spec in the same PR — no production change without a regression guard.

**Tech Stack:** Same as X1, plus generous use of `jest.useFakeTimers()` for time-dependent behavior (overflow countdown, order deadlines, cooldowns).

**Reference:** `docs/plans/2026-04-17-testing-strategy-design.md` §5.2

---

## PR P1: GameState persistence (FU-T2-01)

**Scope:** 5 specs + production persistence wiring.

**Specs (L1):**
- TC-STATE-001 round-trip serialization (in-memory)
- TC-STATE-002 exit → reload restores progress (via injected `storage`)
- TC-STATE-003 storage cleared → fresh initial state
- TC-STATE-004 incompatible schema version → safe downgrade
- TC-STATE-005 `levels.json` + `DessertConfig` schema self-check

**Production touches:**
- `client/assets/scenes/scripts/data/GameState.ts` — §2.1 A-5 (add `storage?: IKVStorage` injection) + §2.2 B-1 (actually call `this.storage.set(...)`/`.get(...)`)
- `client/tests/harness/gameHarness.ts` — wire `storage` through `createGameHarness({ storage })`

**Expansion hook:** The harness's `getState()` gains real content in this PR. All subsequent PRs inherit it.

**Commit style:**
- `test(state): add TC-STATE-001..005 persistence specs` (red)
- `feat(state): wire GameState persistence through injected storage (FU-T2-01)` (green)

---

## PR P2: ApiClient offline queue (FU-T2-02)

**Scope:** 1 critical spec + production queue + flush mechanism.

**Specs (L1):**
- TC-NET-001 offline → in-game score queued → network restored → auto-flush to server

**Production touches:**
- `client/assets/scenes/scripts/net/ApiClient.ts` — §2.2 B-2 (`queueForLater(endpoint, payload)` + `flushQueue()` trigger on `tt.onNetworkStatusChange` and app foreground)
- Storage key `pending_queue` — FIFO, max N items, survives restart (reuses P1's `storage` injection)

**Test fixtures:**
- Fake `fetch` that rejects on first call then resolves on second
- Fake `tt.onNetworkStatusChange` that drives network state transitions
- Time control via `jest.useFakeTimers()` for backoff behavior

**Commit style:**
- `test(net): add TC-NET-001 offline resubmit spec` (red)
- `feat(net): ApiClient offline queue + auto-flush (FU-T2-02)` (green)

---

## PR P3: 401 auto-clear-token + re-login event (FU-T2-03)

**Scope:** 2 specs + production 401 handling.

**Specs (L1):**
- TC-AUTH-003 token expired → next request returns 401 → token is cleared from storage
- TC-NET-004 401 response → `onUnauthorized` event fires → re-login happens

**Production touches:**
- `client/assets/scenes/scripts/net/ApiClient.ts` — §2.2 B-3 (intercept 401 → clear token → emit event)
- New event bus or callback prop on ApiClient; wire a listener in `LoadingScene` / `HomeScene` that triggers re-login

**Server-side assertion** (already in place from X1): JWT expiration returns 401, not 403.

**Commit style:**
- `test(auth): add TC-AUTH-003 + TC-NET-004 token-expiry specs`
- `feat(net): 401 auto-clear + onUnauthorized event (FU-T2-03)`

---

## PR P4: CustomerManager per-order timeout (FU-T2-04)

**Scope:** 1 spec + production timeout logic.

**Specs (L1):**
- TC-CUST-003 order with deadline T exceeds T → `onOrderTimeout` fires, score deducted

**Production touches:**
- `client/assets/scenes/scripts/core/CustomerManager.ts` — §2.2 B-4 (add `order.deadline`, tick loop, `onOrderTimeout` callback)

**Test fixtures:**
- `jest.useFakeTimers()` to advance time past deadline deterministically
- Injected `clock` from §2.1 A-3 (though CustomerManager uses `rng`, not clock — decide whether to add clock injection here or in P5)

**Commit style:**
- `test(customer): add TC-CUST-003 order-timeout spec`
- `feat(customer): per-order timeout with onOrderTimeout callback (FU-T2-04)`

---

## PR P5: Core dependency injection + core specs (§2.1 A)

**Scope:** 14 specs + injection refactor on 4 modules.

**Specs (L1):**
- TC-DROP-001..004 drop position / cooldown / rapid-click debounce / paused-state reject
- TC-MERGE-001..005 adjacent / cascade / max-level / animation-window click / score
- TC-OVER-001..003 overflow 5s countdown / recovery cancel / timeout fail
- TC-SCORE-001..004 score / star thresholds / coin reward / history star retention
- TC-CUST-001..002 order RNG determinism / matching

**Production touches (refactors, behavior-preserving):**
- `CustomerManager.ts` — `rng?: () => number` (§2.1 A-1)
- `DropController.ts` — `clock?: () => number` (§2.1 A-2)
- `OverflowDetector.ts` — `clock?: () => number` (§2.1 A-3)
- `net/ApiClient.ts` — `fetchImpl?: typeof fetch` (§2.1 A-4) — may already be done in P2, if so just confirm

**Note:** Because this PR is pure refactor + new specs (no new behavior), it can be broken into smaller commits. Suggested structure:
- Commit 1: inject `clock` into DropController + TC-DROP-001..004
- Commit 2: inject `clock` into OverflowDetector + TC-OVER-001..003
- Commit 3: inject `rng` into CustomerManager + TC-CUST-001..002
- Commit 4: TC-MERGE-001..005 + TC-SCORE-001..004 (MergeManager + ScoreManager may not need injection if they're already pure)

---

## PR P6: Server strict validation + security specs (FU-T1-05/06/07)

**Scope:** 10 specs + server hardening.

**Specs (L1):**
- TC-AUTH-001 first login link (supertest end-to-end: code → token → Mongo)
- TC-AUTH-002 valid token → no re-login needed
- TC-AUTH-004 forged/missing token → 401
- TC-RANK-001 `$max` atomic submission
- TC-RANK-002 concurrent submissions from multiple accounts
- TC-SEC-001 token tampering → 401
- TC-SEC-002 oversized body / malformed JSON → 400
- TC-VALID-001 ValidationPipe whitelist strips extra fields
- TC-VALID-002 DTO bounds (round 1..10, score >=0)

**Production touches:**
- `server/src/main.ts` — FU-T1-05 (add `whitelist: true, forbidNonWhitelisted: true` to global `ValidationPipe`)
- `server/src/user/dto/progress.dto.ts` — FU-T1-06/07 (add `@Min(1) @Max(10)` on `round`, `@Min(0)` on `score`)

**Pre-work (critical):** Before flipping strict ValidationPipe, run the Task-1 baseline log against client to find any historical request sending extra fields. Adjust DTO allowlist if needed. Document decisions in the PR description.

**Commit style:**
- `test(server): add TC-VALID-001..002 + TC-SEC-001..002 specs` (red)
- `feat(server): enforce strict ValidationPipe + DTO bounds (FU-T1-05/06/07)` (green)

---

## X2 Completion Checklist

- [ ] All 6 PRs merged to main
- [ ] L1 layer has ~40 specs passing
- [ ] All 4 `FU-T2-*` scaffold items closed (code actually used, not just present)
- [ ] Coverage threshold raised: server 75% / client core 70% (after 1 week CI-stable per §4.3)
- [ ] No naked skips in repo (`npm run lint:skips` clean)
- [ ] Baseline doc updated with new FU item closure list

## Post-X2 refinement

Before starting X3, check:
- Are any remaining R3 users cases surfacing as "hard to test" because of some *further* missing injection point? → add to X3 scope.
- Is CI wall-clock still ≤ 6 min? → if creeping, flag Playwright additions for nightly-only label.
