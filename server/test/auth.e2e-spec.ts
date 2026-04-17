import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
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

  // ----- TC-AUTH-005 DTO matrix anchors (characterization, not TDD) -----
  // The spec doc's original matrix (docs/test/unit-server.md) references a
  // `nickname` field that LoginDto does not have, and assumes stricter
  // validation than the current `@IsOptional() @IsString()` pair allows.
  // These anchors pin the actually-testable contract:
  //   - whitespace-only code trims to '' → 401 (AuthService guard, not DTO)
  //   - null code passes DTO (class-validator + @IsOptional skips null)
  //     and reaches AuthService which rejects → 401
  //   - unknown extra fields are rejected by ValidationPipe whitelist → 400
  describe('TC-AUTH-005 DTO + AuthService validation anchors', () => {
    it('whitespace-only code trims to empty → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ code: '   ' });
      expect(res.status).toBe(401);
    });

    it('null code with no anonymousCode → 401 (service-level guard)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ code: null });
      expect(res.status).toBe(401);
    });

    it('unknown extra field → 400 (ValidationPipe forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ code: 'test-code-1', nickname: 'x'.repeat(99) });
      expect(res.status).toBe(400);
    });

    it('non-string code type → 400 (class-validator @IsString)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ code: 12345 });
      expect(res.status).toBe(400);
    });
  });
});
