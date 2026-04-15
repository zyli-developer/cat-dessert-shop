import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('POST /api/auth/login with valid stub code returns user (TC-AUTH-E2E-001)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ code: 'test-code-1' });
    expect([200, 201]).toContain(res.status);
    // Controller wraps response as { code: 0, data: User }
    expect(res.body).toHaveProperty('code', 0);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('openId', 'openid-1');
  });

  it('POST /api/auth/login with invalid code returns 401 (TC-SEC-001)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ code: 'definitely-not-a-real-code' });
    // StubCodeExchanger now throws UnauthorizedException for parity with DouyinCodeExchanger.
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login with empty body returns 401 (TC-SEC-001)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({});
    // AuthService throws UnauthorizedException when both code and anonymousCode missing.
    expect(res.status).toBe(401);
  });

  it('GET /api/user/profile without X-Open-Id header returns 401 (TC-SEC-001)', async () => {
    const res = await request(app.getHttpServer()).get('/api/user/profile');
    expect(res.status).toBe(401);
  });
});
