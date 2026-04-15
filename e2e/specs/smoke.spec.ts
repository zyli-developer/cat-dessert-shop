import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { loginViaApi } from '../fixtures/api-helpers';
import { shellRoot } from '../fixtures/shell-compat';

test('global setup: shell loads and server is up', async ({ page }) => {
  await installTtMock(page);
  await page.goto('/');
  await expect(shellRoot(page)).toBeVisible();
  const openId = await loginViaApi('test-code-e2e');
  expect(openId).toBeTruthy();
});
