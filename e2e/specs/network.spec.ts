import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { API_BASE, loginViaApi } from '../fixtures/api-helpers';

// TC-API-ERR-001: server unreachable → fetch rejects
// TC-API-ERR-002: server returns 5xx → caller observes error status

test.describe('network errors', () => {
  test('TC-API-ERR-002: 5xx response is surfaced as a non-OK status', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    const openId = await loginViaApi('test-code-4');

    await page.route('**/api/user/progress', (route) => {
      void route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 500, message: 'internal error' }),
      });
    });

    const result = await page.evaluate(
      async ({ base, openId }) => {
        const res = await fetch(`${base}/user/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Open-Id': openId },
          body: JSON.stringify({ round: 70, stars: 1, score: 100 }),
        });
        return { status: res.status, ok: res.ok };
      },
      { base: API_BASE, openId },
    );

    expect(result.status).toBe(500);
    expect(result.ok).toBe(false);

    await page.unroute('**/api/user/progress');

    // Verify normal operation resumes after unroute.
    const healthy = await page.evaluate(
      async ({ base, openId }) => {
        const res = await fetch(`${base}/user/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Open-Id': openId },
          body: JSON.stringify({ round: 70, stars: 1, score: 100 }),
        });
        return { status: res.status };
      },
      { base: API_BASE, openId },
    );
    expect([200, 201]).toContain(healthy.status);
  });

  test('TC-API-ERR-001: aborted request (server unreachable) rejects', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');
    const openId = await loginViaApi('test-code-5');

    await page.route('**/api/user/progress', (route) => {
      void route.abort();
    });

    const result = await page.evaluate(
      async ({ base, openId }) => {
        try {
          const res = await fetch(`${base}/user/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Open-Id': openId },
            body: JSON.stringify({ round: 71, stars: 1, score: 200 }),
          });
          return { threw: false, status: res.status };
        } catch (err: any) {
          return { threw: true, error: String(err?.message || err) };
        }
      },
      { base: API_BASE, openId },
    );

    expect(result.threw).toBe(true);
    expect(result.error).toBeTruthy();

    await page.unroute('**/api/user/progress');

    // Recovery check.
    const healthy = await page.evaluate(
      async ({ base, openId }) => {
        const res = await fetch(`${base}/user/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Open-Id': openId },
          body: JSON.stringify({ round: 71, stars: 1, score: 200 }),
        });
        return { status: res.status };
      },
      { base: API_BASE, openId },
    );
    expect([200, 201]).toContain(healthy.status);
  });
});
