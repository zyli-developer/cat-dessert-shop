import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';

// TC-E2E-001 / TC-E2E-004 — full playthrough coverage (drop → merge → round
// complete, multi-round leak) is deferred to X3 once the Cocos harness
// exposes setters for programmatic gameplay. Until then, the lifecycle-proxy
// check below is all the playthrough smoke we can run against the real
// Cocos bundle.

test.describe('playthrough', () => {
  test('TC-E2E-001 lifecycle proxy: GameCanvas attaches on load', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    await expect(page.locator('#GameCanvas')).toBeAttached();
  });
});
