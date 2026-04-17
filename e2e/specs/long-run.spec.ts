import { test } from '@playwright/test';

// TC-E2E-LONG-001 heap stability: deferred to X3. Not a skip — the test
// doesn't exist yet. See docs/plans/2026-04-17-testing-strategy-design.md §3.2 ⑨.
test.describe.skip('long-run (pending X3)', () => {
  // SKIP-REASON: awaiting X3 implementation
  test('placeholder', () => {});
});
