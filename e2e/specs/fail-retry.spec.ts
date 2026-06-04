import { test } from '@playwright/test';

// TC-E2E-002: overflow → fail popup → retry. Requires programmatic access to
// the Cocos container/overflow detector, which the real web-mobile bundle
// doesn't yet expose for e2e. Deferred to X3 (gameHarness expansion + test
// hook for forced overflow). See
// docs/plans/2026-04-17-testing-strategy-design.md §3.2.
// SKIP-REASON: awaiting X3 — need a Cocos-side hook to force overflow.
test.describe.skip('fail-retry (pending X3)', () => {
  test('placeholder', () => {});
});
