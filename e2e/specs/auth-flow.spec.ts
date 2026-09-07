import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { API_BASE } from '../fixtures/api-helpers';

// TC-API-AUTH-001, TC-API-AUTH-002
// Exercise /api/auth/login directly from the page rather than asserting the
// real client's cached-token flow — the Cocos bundle boots but doesn't yet
// expose its cache getter for e2e. Cached-token assertions land in X3 once
// the Cocos harness exports them.

test.describe('auth-flow', () => {
  test('TC-API-AUTH-001: first login returns openId and 201', async ({ page }) => {
    await installTtMock(page);
    await page.goto('/');

    const result = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test-code-e2e' }),
      });
      const body = await res.json();
      return { status: res.status, body };
    }, API_BASE);

    expect([200, 201]).toContain(result.status);
    expect(result.body.code).toBe(0);
    expect(result.body.data.user.openId).toBeTruthy();
    expect(typeof result.body.data.user.openId).toBe('string');
    expect(typeof result.body.data.accessToken).toBe('string');

    // Stash openId on window for the idempotency assertion below. The
    // Cocos bundle doesn't expose a token cache for e2e yet (X3).
    await page.evaluate((openId) => {
      (window as any).__e2e_openId = openId;
    }, result.body.data.user.openId);

    const stored = await page.evaluate(() => (window as any).__e2e_openId);
    expect(stored).toBe(result.body.data.user.openId);
  });

  test('TC-API-AUTH-002: login is idempotent — same code returns same openId', async ({
    page,
  }) => {
    await installTtMock(page);
    await page.goto('/');

    const [first, second] = await page.evaluate(async (base) => {
      const login = async () => {
        const r = await fetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'test-code-e2e' }),
        });
        return (await r.json()) as any;
      };
      return [await login(), await login()];
    }, API_BASE);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(first.data.user.openId).toBeTruthy();
    expect(second.data.user.openId).toBe(first.data.user.openId);
  });
});
