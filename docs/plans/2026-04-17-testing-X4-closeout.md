# X4 — Closeout Implementation Plan (SCAFFOLD)

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` **AFTER X3 is merged AND X3 has been CI-stable for one week**.

**Goal:** Land the design's final coverage thresholds, publish the nightly workflow, and produce contributor-facing documentation so new test cases can be added without re-deriving the strategy.

**Architecture:** Four independent small tasks. No production code changes. Doc + config only.

**Reference:** `docs/plans/2026-04-17-testing-strategy-design.md` §5.4

---

## Task 1: Coverage threshold finalization

**Files:**
- `server/package.json` (or `jest.config.js`) — raise to lines 90%
- `client/tests/jest.config.ts` — raise to lines 85%

**Gate:** Only proceed after X3 has been CI-stable for 7 consecutive days. Verify by reviewing GitHub Actions history.

**Step-by-step:**
1. Confirm current CI passes with X3 thresholds (server 85% / client 80%)
2. Update threshold to final values
3. Run `npm run test:all` locally to confirm no trip
4. Open PR; await CI pass; merge

---

## Task 2: Nightly workflow

**Files:**
- Create: `.github/workflows/nightly.yml`

**Content pattern:**

```yaml
name: nightly
on:
  schedule:
    - cron: '0 16 * * *'  # 00:00 Beijing time
  workflow_dispatch:

permissions:
  contents: read

jobs:
  nightly-specs:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      # Runs specs tagged with @nightly or in nightly-only projects
      - run: npm --workspace e2e run test:ci -- --grep @nightly
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: nightly-playwright-report, path: e2e/playwright-report }

  heap-fps-watch:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: nightly-specs
    steps:
      - uses: actions/checkout@v4
      # placeholder for future heap/FPS specs (§4.5 mentions reserved slot)
      - run: echo "heap-fps specs not yet implemented"
```

**Gate:** The `@nightly` tag mechanism must exist in the Playwright config before merging this workflow. If not yet in place from X3 flake isolation work, add it here.

---

## Task 3: Documentation reorganization

**Files:**
- Rewrite: `docs/dev/phase-7-testing.md` — now a pointer to the L3 manual
- Update: `docs/dev/README.md` — status table row for 集成测试
- Update: repo root `README.md` — Codecov badge + `npm run test:all` section
- Create: `docs/test/README.md` — contributor-facing guide

**`docs/dev/phase-7-testing.md` new content:**

```markdown
# Phase 7: Integration Testing

> Superseded by the layered L3 strategy in
> [docs/plans/2026-04-17-testing-strategy-design.md](../plans/2026-04-17-testing-strategy-design.md).
> Pre-submission manual smoke checklist lives at
> [docs/test/manual-douyin-smoke.md](../test/manual-douyin-smoke.md).

## For CI/PR regression
Run `npm run test:all` — covers L1 (Jest) + L2 (Playwright).

## For pre-submission
Follow `docs/test/manual-douyin-smoke.md` on a real device + Douyin IDE.
```

**`docs/test/README.md` outline (~100 lines):**

```markdown
# Testing Guide

## Where a new test case belongs (decision table)
| Question | Layer |
| ...the 1.4 table from the design doc... |

## How to run tests locally
- L1: `npm run test:client`, `npm run test:server`, `npm run test:scripts`
- L2: `npm --workspace e2e run test`
- L3: manual, see manual-douyin-smoke.md

## Adding a new `cc` API to the stub
Location, pattern, test to add.

## Skip policy
SKIP-REASON requirement, review frequency.

## Adding to the Jest harness
When to expand `gameHarness.ts` vs write a bespoke spec.

## Debugging a flaky Playwright test
trace / video / `expect.poll` guidance; how to mark @nightly.

## Coverage floor policy
Scripts to check current coverage, how to propose a raise.
```

**README.md additions:**

```markdown
![coverage](https://codecov.io/gh/<org>/<repo>/branch/main/graph/badge.svg)

## Testing
- `npm run test:all` — full L1 suite (Jest) + L2 (Playwright) locally
- `npm run lint:skips` — enforce skip policy
- See [docs/test/README.md](docs/test/README.md) for layer responsibilities
```

---

## Task 4: Smoke-test with a fresh clone

**Gate:** Before declaring X4 done, a maintainer (or the next onboarding engineer) clones into a fresh directory, follows only `docs/test/README.md`, and adds one R3 spec end-to-end without asking questions.

**Success criteria:** they can identify which layer, write the spec, run it locally, and open a PR that passes CI — all without reading the design doc or asking clarifying questions.

If they get stuck, revise `docs/test/README.md` to close the gap. Iterate until 1 engineer can do this cleanly.

---

## X4 Completion Checklist

- [ ] Server coverage threshold at 90% lines; client core at 85%
- [ ] `nightly.yml` merged; first nightly run completed successfully
- [ ] `docs/dev/phase-7-testing.md` rewritten as pointer
- [ ] `docs/dev/README.md` status table updated
- [ ] `README.md` has Codecov badge + test section
- [ ] `docs/test/README.md` passes the fresh-clone smoke test
- [ ] All 5 `2026-04-15-*.md` archive banners still present (sanity)
- [ ] `docs/plans/2026-04-17-testing-*` set (design + X1..X4) remains the sole authoritative reference

---

## Post-X4

Possible follow-ups (not in this plan's scope):
- Heap/FPS specs (§4.5 reserved slot)
- Automated Douyin IDE integration via MCP (replaces Track C manual)
- Visual regression via Playwright screenshots for UI-heavy changes
