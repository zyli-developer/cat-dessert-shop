import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, login, authed, TestSession } from './helpers';

/**
 * Discovered API contract (see Step-1 notes in T1-06 task):
 *  - POST /api/user/progress         body: ProgressDto { round, score, stars(1..3), catCoinsEarned? }
 *  - GET  /api/user/profile          returns full user document
 *  - Both are protected by a signed Bearer session token.
 *  - Controllers wrap success responses as { code: 0, data: <payload> }
 *  - Service stores progress as Map<string, number> on the User doc:
 *      stars[round]        -> highest star rating ever achieved (max-keep)
 *      roundScores[round]  -> highest score for that round    (max-keep)
 *      highScore           -> global highest score across all rounds
 *  - currentRound is monotonic-increasing (next-round pointer)
 *  - "No-downgrade" for both stars and score IS implemented in updateProgress.
 *
 * Round/score bounds and score-derived stars are enforced server-side. Progress
 * may only be submitted for an already unlocked round.
 */
describe('User Progress (e2e)', () => {
  let app: INestApplication;
  let session: TestSession;

  beforeAll(async () => {
    app = await createTestApp();
    // Login via auth to obtain a signed session and auto-provision the user.
    session = await login(app, 'test-code-1');
    expect(session.user.openId).toBe('openid-1');
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  const postProgress = (body: Record<string, unknown>) =>
    authed(request(app.getHttpServer()).post('/api/user/progress'), session).send(body);

  const getProfile = () => authed(request(app.getHttpServer()).get('/api/user/profile'), session);

  it('TC-USER-001 updates and retrieves progress', async () => {
    const post = await postProgress({ round: 1, stars: 2, score: 600 });
    expect([200, 201]).toContain(post.status);
    expect(post.body).toHaveProperty('code', 0);

    const read = await getProfile();
    expect(read.status).toBe(200);
    expect(read.body).toHaveProperty('code', 0);
    expect(read.body.data).toBeTruthy();

    // stars and roundScores are Mongoose Maps -> serialized as plain objects keyed by round-as-string
    expect(read.body.data.stars['1']).toBe(2);
    expect(read.body.data.roundScores['1']).toBe(600);
    expect(read.body.data.highScore).toBeGreaterThanOrEqual(600);
    // currentRound is "next round" pointer = round + 1
    expect(read.body.data.currentRound).toBeGreaterThanOrEqual(2);
  });

  it('TC-USER-002 progress update is idempotent', async () => {
    // Seed round 12 once, then capture baseline coins so repeat submits prove idempotency.
    const seed = await postProgress({ round: 2, stars: 2, score: 1000 });
    expect([200, 201]).toContain(seed.status);

    const baseline = await getProfile();
    const baselineCoins = baseline.body.data.catCoins;

    for (let i = 0; i < 3; i++) {
      const r = await postProgress({ round: 2, stars: 2, score: 1000 });
      expect([200, 201]).toContain(r.status);
    }

    const read = await getProfile();
    expect(read.body.data.stars['2']).toBe(2);
    expect(read.body.data.roundScores['2']).toBe(1000);
    // No additional star reward should have been issued (already at stars=2).
    expect(read.body.data.catCoins).toBe(baselineCoins);
  });

  it('TC-USER-003 higher existing score and stars are preserved (no-downgrade)', async () => {
    // First: write a high score+stars -> should be flagged as a new best.
    const high = await postProgress({ round: 3, stars: 3, score: 7000 });
    expect([200, 201]).toContain(high.status);
    expect(high.body.data.isNewBest).toBe(true);

    // Then: attempt a "downgrade" submit -> server keeps the old best, isNewBest=false.
    const low = await postProgress({ round: 3, stars: 1, score: 4000 });
    expect([200, 201]).toContain(low.status);
    expect(low.body.data.isNewBest).toBe(false);

    const read = await getProfile();
    expect(read.body.data.stars['3']).toBe(3);
    expect(read.body.data.roundScores['3']).toBe(7000);
    expect(read.body.data.highScore).toBeGreaterThanOrEqual(7000);
  });

  it('TC-USER-004 rejects invalid level', async () => {
    const res = await postProgress({ round: 99, stars: 1, score: 10 });
    expect(res.status).toBe(400);
  });

  // Bonus: prove that the only bounded field on ProgressDto (stars 1..3) IS validated,
  // so the global ValidationPipe is wired correctly and the gap above is purely a missing decorator.
  it('TC-USER-005 (compensates for skipped TC-USER-004): out-of-range stars returns 400', async () => {
    const res = await postProgress({ round: 4, stars: 5, score: 10 });
    expect(res.status).toBe(400);
  });

  it('TC-VALID-001 ValidationPipe rejects unknown fields with forbidNonWhitelisted', async () => {
    const res = await postProgress({ round: 4, stars: 1, score: 10, malicious: 'drop table' });
    // The test app sets whitelist + forbidNonWhitelisted, so unknown props -> 400.
    expect(res.status).toBe(400);
  });

  it('rejects client-controlled cat coin rewards in progress submissions', async () => {
    const res = await postProgress({
      round: 16,
      stars: 1,
      score: 10,
      catCoinsEarned: 999_999,
    });
    expect(res.status).toBe(400);
  });

  it('awards a fixed home-ad reward once and replays the same claim idempotently', async () => {
    const claimId = 'home_reward_000001';
    const first = await authed(
      request(app.getHttpServer()).post('/api/user/rewards/claim'),
      session,
    ).send({ kind: 'home_ad', claimId });
    expect([200, 201]).toContain(first.status);
    expect(first.body.data.awarded).toBe(10);

    const replay = await authed(
      request(app.getHttpServer()).post('/api/user/rewards/claim'),
      session,
    ).send({ kind: 'home_ad', claimId });
    expect([200, 201]).toContain(replay.status);
    expect(replay.body.data.alreadyClaimed).toBe(true);
    expect(replay.body.data.catCoins).toBe(first.body.data.catCoins);
  });

  it('rejects client-supplied reward fields', async () => {
    const res = await authed(
      request(app.getHttpServer()).post('/api/user/rewards/claim'),
      session,
    ).send({ kind: 'daily_gift', claimId: 'daily_reward_0001', amount: 999_999 });
    expect(res.status).toBe(400);
  });

  it('allows the authenticated user to permanently delete account data', async () => {
    const deleted = await authed(
      request(app.getHttpServer()).delete('/api/user/account'),
      session,
    );
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ code: 0, data: { deleted: true } });

    const read = await getProfile();
    expect(read.status).toBe(200);
    expect(read.body.data).toBeNull();
  });
});
