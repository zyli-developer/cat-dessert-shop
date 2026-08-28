import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SessionTokenService } from './session-token.service';

export interface AuthenticatedRequest extends Request {
  auth?: { openId: string };
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly tokens: SessionTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+(.+)$/i)
      : null;
    if (!match) throw new UnauthorizedException('Missing Bearer token');

    request.auth = { openId: this.tokens.verify(match[1]) };
    return true;
  }
}
