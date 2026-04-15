import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';

// TC-E2E-002: overflow -> fail popup -> retry. Requires Cocos game loop.
test.describe('fail-retry (gated on Cocos build)', () => {
  test('harness: state transitions through Game -> Result', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    await page.evaluate(() => (window as any).__cb.state.setScene('Game'));
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'Game');
    await page.evaluate(() => (window as any).__cb.state.setScene('Result'));
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'Result');
  });

  test.skip('TC-E2E-002 overflow triggers fail popup (Cocos required)', () => {
    // Requires Cocos web-mobile build.
  });
});
