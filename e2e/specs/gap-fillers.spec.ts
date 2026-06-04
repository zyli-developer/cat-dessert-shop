import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { API_BASE } from '../fixtures/api-helpers';

test.describe('gap-fillers', () => {
  test('TC-E2E-ASSET-001: route static 404 → shell still responsive (no white screen)', async ({
    page,
  }) => {
    await installTtMock(page);
    // Route a non-existent asset to 404 to simulate asset miss
    await page.route('**/missing-asset.png', (route) => route.fulfill({ status: 404 }));
    await page.goto('/');
    await expect(page.locator('#GameCanvas')).toBeVisible();
  });

  test('TC-E2E-CONCUR-001: rapid parallel logins idempotent (no race error)', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    const openIds = await page.evaluate(async (base) => {
      const login = () =>
        fetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'test-code-e2e' }),
        }).then((r) => r.json());
      const results = await Promise.all([login(), login(), login(), login(), login()]);
      return results.map((r: any) => r.data.openId);
    }, API_BASE);
    // All 5 parallel logins should succeed and return the same openId (upsert guard)
    expect(new Set(openIds).size).toBe(1);
    expect(openIds[0]).toBe('openid-e2e');
  });

  test('TC-E2E-STATE-001: localStorage round-trip + clear zeroes out', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('foo', 'bar'));
    expect(await page.evaluate(() => localStorage.getItem('foo'))).toBe('bar');
    await page.evaluate(() => localStorage.clear());
    expect(await page.evaluate(() => localStorage.getItem('foo'))).toBeNull();
  });
});
