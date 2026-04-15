import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { shellRoot, isFallbackShell } from '../fixtures/shell-compat';

// TC-E2E-002: overflow -> fail popup -> retry. Requires Cocos game loop for
// the real failure/retry flow. Harness-level proxy test runs only against
// the fallback shell; skipped transparently on real Cocos builds.
test.describe('fail-retry', () => {
  test('harness: state transitions through Game -> Result (fallback only)', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    await expect(shellRoot(page)).toBeVisible();

    if (!(await isFallbackShell(page))) {
      test.skip(true, 'Real Cocos build does not expose __cb.state.setScene harness');
    }

    await page.evaluate(() => (window as any).__cb.state.setScene('Game'));
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'Game');
    await page.evaluate(() => (window as any).__cb.state.setScene('Result'));
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'Result');
  });

  test.skip('TC-E2E-002 overflow triggers fail popup (Cocos runtime required)', () => {
    // Requires driving the real Cocos container/overflow detector.
  });
});
