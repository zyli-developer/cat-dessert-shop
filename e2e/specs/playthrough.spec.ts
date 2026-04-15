import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';

// TC-E2E-001 / TC-E2E-004 — Cocos runtime required for the real game loop.
// Without COCOS_CREATOR_PATH → web-mobile build, we can only verify:
//   (a) the fallback shell boots and exposes __cb state,
//   (b) harness can transition scene states via window.__cb.state.setScene()
// Real drop/merge/render coverage is gated on T3 follow-up: wire Cocos
// headless build into CI.

test.describe('playthrough (fallback-shell harness)', () => {
  test('TC-E2E-001 lifecycle proxy: shell reaches Home scene', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'Home');
  });

  test.skip('TC-E2E-001 real playthrough: drop -> merge -> complete round', () => {
    // Requires Cocos web-mobile build. Tracked in docs/plans followups.
  });

  test.skip('TC-E2E-004 three consecutive rounds no leak', () => {
    // Requires Cocos web-mobile build. See long-run.spec.ts.
  });
});
