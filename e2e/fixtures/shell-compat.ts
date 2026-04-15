import type { Page, Locator } from '@playwright/test';

/**
 * DOM compat layer: the same specs run against either
 *   (a) the esbuild fallback shell (index.html has #app + window.__cb)
 *   (b) the real Cocos Creator web-mobile build (index.html has #GameCanvas)
 *
 * This helper returns a root locator that matches whichever root exists.
 */
export function shellRoot(page: Page): Locator {
  return page.locator('#app, #GameCanvas').first();
}

export async function waitForShellReady(page: Page, timeoutMs = 10_000): Promise<void> {
  await shellRoot(page).waitFor({ state: 'visible', timeout: timeoutMs });
}

/**
 * Shell mode detection — some specs exercise a fallback-only harness
 * (e.g. window.__cb.state.setScene). Those tests skip themselves when
 * running against a real Cocos build, where the harness doesn't exist.
 */
export async function isFallbackShell(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const cb = (window as any).__cb;
    return !!(cb && cb.state && typeof cb.state.setScene === 'function');
  });
}
