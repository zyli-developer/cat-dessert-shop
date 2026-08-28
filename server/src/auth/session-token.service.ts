import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

interface SessionPayload {
  version: 1;
  sub: string;
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

@Injectable()
export class SessionTokenService {
  private readonly logger = new Logger(SessionTokenService.name);
  private readonly secret: Buffer;
  private readonly ttlSeconds: number;

  constructor() {
    const configuredSecret = process.env.AUTH_TOKEN_SECRET?.trim();
    if (configuredSecret && configuredSecret.length < MIN_SECRET_LENGTH) {
      throw new Error(`AUTH_TOKEN_SECRET must contain at least ${MIN_SECRET_LENGTH} characters`);
    }
    if (!configuredSecret && process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_TOKEN_SECRET is required when NODE_ENV=production');
    }

    if (configuredSecret) {
      this.secret = Buffer.from(configuredSecret, 'utf8');
    } else {
      this.secret = randomBytes(32);
      this.logger.warn(
        'AUTH_TOKEN_SECRET is not configured; using an ephemeral development key',
      );
    }

    const configuredTtl = Number(process.env.AUTH_TOKEN_TTL_SECONDS);
    this.ttlSeconds =
      Number.isInteger(configuredTtl) && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_TTL_SECONDS;
  }

  issue(openId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      version: 1,
      sub: openId,
      issuedAt: now,
      expiresAt: now + this.ttlSeconds,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  verify(token: string): string {
    const [encodedPayload, signature, extra] = token.split('.');
    if (!encodedPayload || !signature || extra) this.reject();

    const expected = Buffer.from(this.sign(encodedPayload), 'base64url');
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) this.reject();

    let payload: SessionPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as SessionPayload;
    } catch {
      this.reject();
    }

    const now = Math.floor(Date.now() / 1000);
    if (
      payload.version !== 1 ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      !Number.isInteger(payload.issuedAt) ||
      !Number.isInteger(payload.expiresAt) ||
      payload.issuedAt > now + 60 ||
      payload.expiresAt <= now
    ) {
      this.reject();
    }
    return payload.sub;
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.secret).update(encodedPayload).digest('base64url');
  }

  private reject(): never {
    throw new UnauthorizedException('Invalid or expired session token');
  }
}
