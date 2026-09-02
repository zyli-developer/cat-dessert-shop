import { test, expect } from '@playwright/test';
import { installTtMock } from '../fixtures/tt-mock';
import { API_BASE, loginViaApi, submitProgress } from '../fixtures/api-helpers';

// TC-API-RANK-003 anchor: empty rank result. Uses a round number no other
// spec seeds (30) so the server-side roundScores.$exists filter returns 0
// rows deterministically, regardless of test order.
test('TC-API-RANK-003: empty rank returns {list: [], myRank: 1} without error', async ({ page }) => {
  await installTtMock(page);
  await page.goto('/');
  const session = await loginViaApi('test-code-e2e');

  const result = await page.evaluate(
    async ({ base, accessToken }) => {
      const res = await fetch(`${base}/rank/friends?round=30`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { status: res.status, body: await res.json() };
    },
    { base: API_BASE, accessToken: session.accessToken },
  );

  expect(result.status).toBe(200);
  expect(result.body.code).toBe(0);
  expect(Array.isArray(result.body.data.list)).toBe(true);
  expect(result.body.data.list).toEqual([]);
  // With an empty list, service semantics: myRank = list.length + 1 = 1.
  expect(result.body.data.myRank).toBe(1);
});

// TC-E2E-003: rank visible after seeding. Fallback-shell adaptation — we
// seed three users via the API, then GET /api/rank/friends?round=1 and
// assert DESC score ordering.

test('TC-E2E-003: friends rank returns seeded users in DESC score order', async ({ page }) => {
  await installTtMock(page);
  await page.goto('/');

  const ROUND = 1;

  // Seed: 3 users with distinct scores on the same round.
  const session1 = await loginViaApi('test-code-1');
  const session2 = await loginViaApi('test-code-2');
  const session3 = await loginViaApi('test-code-3');

  await submitProgress(session1, ROUND, 2, 700);
  await submitProgress(session2, ROUND, 1, 400);
  await submitProgress(session3, ROUND, 3, 1000);

  // Fetch rank from page context (honors the fallback shell network path).
  const result = await page.evaluate(
    async ({ base, round, accessToken }) => {
      const res = await fetch(`${base}/rank/friends?round=${round}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { status: res.status, body: await res.json() };
    },
    { base: API_BASE, round: ROUND, accessToken: session1.accessToken },
  );

  expect(result.status).toBe(200);
  expect(result.body.code).toBe(0);

  const list = result.body.data.list as Array<{ score: number }>;
  expect(Array.isArray(list)).toBe(true);
  expect(list.length).toBeGreaterThanOrEqual(3);

  // Restrict to the three we just seeded (others may exist from prior specs).
  const seededScores = [700, 400, 1000];
  const seenForUs = list.filter((e) => seededScores.includes(e.score)).map((e) => e.score);
  expect(seenForUs).toContain(700);
  expect(seenForUs).toContain(400);
  expect(seenForUs).toContain(1000);

  // Assert DESC ordering overall.
  for (let i = 1; i < list.length; i++) {
    expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
  }

  // Top seeded entry should be 1000.
  const firstSeeded = list.find((e) => seededScores.includes(e.score));
  expect(firstSeeded?.score).toBe(1000);
});
