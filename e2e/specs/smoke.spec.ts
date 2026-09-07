import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { loginViaApi } from '../fixtures/api-helpers';

test('global setup: shell loads and server is up', async ({ page }) => {
  await installTtMock(page);
  await page.goto('/');
  await expect(page.locator('#GameCanvas')).toBeVisible();
  const session = await loginViaApi('test-code-e2e');
  expect(session.openId).toBeTruthy();
  expect(session.accessToken).toBeTruthy();
});
