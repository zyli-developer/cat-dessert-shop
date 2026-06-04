import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { API_BASE, loginViaApi } from '../fixtures/api-helpers';

// TC-API-USER-002: offline cache + resubmit. The client's automatic retry
// queue is not yet implemented (FU-T2-02); we only assert that a
// user-initiated retry after connectivity returns actually succeeds and
// that the server recorded the progress.

test('TC-API-USER-002: offline progress submit fails, retry after online succeeds', async ({
  page,
  context,
}) => {
  await installTtMock(page);
  await page.goto('/');

  const openId = await loginViaApi('test-code-1');
  const ROUND = 60;
  const SCORE = 420;

  // Go offline.
  await context.setOffline(true);

  const offlineResult = await page.evaluate(
    async ({ base, openId, round, score }) => {
      try {
        const res = await fetch(`${base}/user/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Open-Id': openId },
          body: JSON.stringify({ round, stars: 1, score }),
        });
        return { ok: true, status: res.status };
      } catch (err: any) {
        return { ok: false, error: String(err?.message || err) };
      }
    },
    { base: API_BASE, openId, round: ROUND, score: SCORE },
  );

  expect(offlineResult.ok).toBe(false);
  expect(offlineResult.error).toBeTruthy();

  // Back online.
  await context.setOffline(false);

  const retryResult = await page.evaluate(
    async ({ base, openId, round, score }) => {
      const res = await fetch(`${base}/user/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Open-Id': openId },
        body: JSON.stringify({ round, stars: 1, score }),
      });
      return { status: res.status, body: await res.json() };
    },
    { base: API_BASE, openId, round: ROUND, score: SCORE },
  );

  expect([200, 201]).toContain(retryResult.status);
  expect(retryResult.body.code).toBe(0);

  // Confirm server persisted it by reading rank for the round.
  const rank = await page.evaluate(
    async ({ base, openId, round }) => {
      const res = await fetch(`${base}/rank/friends?round=${round}`, {
        headers: { 'X-Open-Id': openId },
      });
      return await res.json();
    },
    { base: API_BASE, openId, round: ROUND },
  );
  const scores = (rank.data.list as Array<{ score: number }>).map((e) => e.score);
  expect(scores).toContain(SCORE);
});
