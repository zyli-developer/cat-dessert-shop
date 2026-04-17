import { test } from '@playwright/test';

// TC-E2E-PERF-001: FPS median ≥ 45 during scripted gameplay. The real
// Cocos bundle now ships with the repo (Task 6), but programmatic
// gameplay driving (drop → merge → …) still depends on the X3 Cocos
// harness. Deferred to X3; see
// docs/plans/2026-04-17-testing-strategy-design.md §3.2.
test.describe('perf FPS (pending X3)', () => {
  // SKIP-REASON: awaiting X3 — need programmatic gameplay to measure FPS.
  test.skip('TC-E2E-PERF-001: median FPS ≥ 45 over 5s gameplay', () => {});
});
