import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { shellRoot, isFallbackShell } from '../fixtures/shell-compat';

// TC-E2E-001 / TC-E2E-004 — real playthrough requires the Cocos game loop.
// With Cocos web-mobile build available: verify canvas renders + boots.
// With fallback shell only: verify harness transitions scene state.
// Real drop/merge/render coverage is gated on T3 follow-up.

test.describe('playthrough', () => {
  test('TC-E2E-001 lifecycle proxy: shell root visible on load', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    await expect(shellRoot(page)).toBeVisible();

    // Harness-only assertion when running the fallback shell
    if (await isFallbackShell(page)) {
      await expect(page.locator('#app')).toHaveAttribute('data-scene', 'Home');
    } else {
      // Real Cocos build: confirm GameCanvas element is present
      await expect(page.locator('#GameCanvas')).toBeAttached();
    }
  });

  test.skip('TC-E2E-001 real playthrough: drop -> merge -> complete round', () => {
    // Requires Cocos runtime hooks to drive the actual game loop. Tracked
    // in docs/plans/2026-04-15-test-automation-T1-followups.md (FU-T3-pending).
  });

  test.skip('TC-E2E-004 three consecutive rounds no leak', () => {
    // Requires Cocos runtime. See long-run.spec.ts.
  });
});
