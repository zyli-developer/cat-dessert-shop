# X3 — R3 Full Coverage + Secondary Exceptions Implementation Plan (SCAFFOLD)

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` **AFTER X2 is merged**. Detailed TDD steps to be filled when X2 lands.

**Goal:** Extend L1 to cover remaining R3 secondary/exception paths and add the thin Playwright visual-smoke layer (L2). Consolidate manual Douyin checks into a single execution manual.

**Architecture:** Three parallel tracks. Track A: L1 expansion (~8 specs). Track B: L2 Playwright smoke (~10 specs) against the real Cocos bundle committed in X1. Track C: manual-smoke consolidation (documentation only).

**Tech Stack:** Adds `catbakery-douyin` MCP integration notes for Track C; Playwright `page.route()` for network-condition simulation in Track B; extended `tt` mock.

**Reference:** `docs/plans/2026-04-17-testing-strategy-design.md` §5.3

---

## Track A: L1 expansion (~8 specs)

Each spec is a short PR (red → green → refactor), 1–2 hours each.

**Specs:**
- TC-AD-REVIVE ad watch → isEnded true → revive; isEnded false → no revive
- TC-AD-COIN / CATCOIN / DOUBLE rewarded-video grants correct resource
- TC-NET-002 flaky network → write timeout → retry succeeds
- TC-NET-003 5xx response → user-visible error surface
- TC-NET-005 rapid-click debounce on share / drop
- TC-UI-ITEM-001 hammer item removes target dessert
- TC-UI-ITEM-002 shuffle item reorders container contents
- TC-UI-SETTINGS music/SFX on/off persists across sessions

**Shared prerequisite:** A reusable `tt` mock helper in `client/tests/__mocks__/tt.ts` with ad-state machine, network-status events, storage.

**Test patterns:**
- Advertising: mock `tt.createRewardedVideoAd()` → simulate `onClose({isEnded: true | false})` callbacks
- Debounce: inject `clock` (from X2 P5) + fire rapid callbacks, assert only one propagates
- Items: drive through `harness.useItem(name)`; assert state change on `harness.getState()`

---

## Track B: Playwright visual smoke (~10 specs)

All run against `e2e/dist/web-mobile/` committed in X1. Use `?e2e=1` bridge from §2.3 to drive game actions.

**Specs:**
- TC-AUTH-005 login button → token → UI transitions from Loading to Home
- TC-UI-HOME home screen displays level/stars/coins
- TC-UI-PAUSE pause popup opens and closes
- TC-UI-RANK rank popup loads and renders at least 1 row
- TC-UI-SHARE share button triggers `tt.shareAppMessage` mock
- TC-STATE-002 (visual layer) exit → re-enter → progress visible in UI
- TC-RANK-003 friend rankings render in rank popup
- TC-FAIL-001 (visual layer) fail → revive-ad → play continues
- TC-NET-006 background → foreground → BGM resumes, state intact
- Mainline playthrough: login → drop → merge → complete 1 round → scoring screen

**Fixture prerequisites:**
- Extend `e2e/fixtures/tt-mock.ts` with ad/share/network-status mocks matching Track A's `__mocks__/tt.ts`
- Add `e2e/fixtures/e2e-bridge.ts` helper that wraps `page.evaluate((actions) => window.__e2e.x(...))` calls

**CI budget:** 10 specs × mobile + chromium projects = 20 runs total ≤ 3 min.

---

## Track C: Manual smoke manual consolidation

**Files:**
- Create: `docs/test/manual-douyin-smoke.md`
- Delete or redirect: `e2e/smoke-douyin-cli.md`
- Delete or merge: `docs/dev/phase-7-testing.md` Tasks 7-1..7-5

**Consolidation target structure:**

```markdown
# Douyin Mini-Game Manual Smoke Checklist (L3)

> Run in Douyin developer tool + real device before every submission.
> Automation covers L1 (Jest) and L2 (Playwright). This document is L3.

## Section A: Package & Cold Start (TC-PLAT-PKG)
- TC-PLAT-PKG-001..004

## Section B: Real tt SDK (TC-PLAT-SDK)
- TC-PLAT-SDK-001..004

## Section C: Rewarded Video (TC-PLAT-AD)
- TC-PLAT-AD-001..005

## Section D: Device Compatibility (TC-PLAT-COMPAT)
- TC-PLAT-COMPAT-001..005

## Section E: Compliance & Review (TC-PLAT-REVIEW)
- TC-PLAT-REVIEW-001..005

## Sign-off
| Role | Name | Date | Build SHA |

## Related automation
Links to L1/L2 specs that cover adjacent behavior.

## How to run preview via MCP
`catbakery-douyin__tmg_preview` / `__upload` / `__login_status` usage notes.
```

**Cross-reference:** Any TC-PLAT-xxx ID mentioned in an L1/L2 spec comment must match IDs in this manual — use the same numbering series.

---

## X3 Completion Checklist

- [ ] L1 spec count: ~48 total (40 from X2 + 8 from Track A)
- [ ] L2 Playwright spec count: ~10 covering main visual paths
- [ ] `docs/test/manual-douyin-smoke.md` created; old `smoke-douyin-cli.md` deleted or redirected
- [ ] `docs/dev/phase-7-testing.md` Task 7-1..7-5 sections removed / merged
- [ ] CI wall-clock ≤ 6 min with full L1+L2
- [ ] Coverage threshold raised: server 85% / client core 80% (after X2 stable week)
- [ ] `npm run lint:skips` still clean
