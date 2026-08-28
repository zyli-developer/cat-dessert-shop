import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './session-auth.guard';

export const CurrentOpenId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const openId = request.auth?.openId;
    if (!openId) throw new UnauthorizedException('Missing authenticated user');
    return openId;
  },
);
