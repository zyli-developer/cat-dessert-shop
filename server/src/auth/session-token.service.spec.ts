import { UnauthorizedException } from '@nestjs/common';
import { SessionTokenService } from './session-token.service';

describe('SessionTokenService', () => {
  const originalSecret = process.env.AUTH_TOKEN_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalTtl = process.env.AUTH_TOKEN_TTL_SECONDS;

  beforeEach(() => {
    process.env.AUTH_TOKEN_SECRET = 'test-session-secret-with-at-least-32-characters';
    process.env.NODE_ENV = 'test';
    delete process.env.AUTH_TOKEN_TTL_SECONDS;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
    else process.env.AUTH_TOKEN_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalTtl === undefined) delete process.env.AUTH_TOKEN_TTL_SECONDS;
    else process.env.AUTH_TOKEN_TTL_SECONDS = originalTtl;
  });

  it('round-trips the authenticated openId', () => {
    const service = new SessionTokenService();
    const token = service.issue('openid-1');
    expect(service.verify(token)).toBe('openid-1');
  });

  it('rejects a token whose payload was tampered with', () => {
    const service = new SessionTokenService();
    const token = service.issue('openid-1');
    const [, signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({
      version: 1,
      sub: 'openid-2',
      issuedAt: 1,
      expiresAt: 4_102_444_800,
    })).toString('base64url');
    expect(() => service.verify(`${forgedPayload}.${signature}`)).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    process.env.AUTH_TOKEN_TTL_SECONDS = '1';
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const service = new SessionTokenService();
    const token = service.issue('openid-1');

    now.mockReturnValue(1_700_000_002_000);
    expect(() => service.verify(token)).toThrow(UnauthorizedException);
    now.mockRestore();
  });

  it('requires an explicit secret in production', () => {
    delete process.env.AUTH_TOKEN_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => new SessionTokenService()).toThrow(/AUTH_TOKEN_SECRET is required/);
  });
});
