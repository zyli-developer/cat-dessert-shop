import { UnauthorizedException } from '@nestjs/common';

export interface CodeExchangeResult { openid: string; }

export interface CodeExchanger {
  exchange(code: string): Promise<CodeExchangeResult>;
}

export const CODE_EXCHANGER = Symbol('CODE_EXCHANGER');

export class StubCodeExchanger implements CodeExchanger {
  constructor(private readonly table: Record<string, string>) {}
  async exchange(code: string): Promise<CodeExchangeResult> {
    const openid = this.table[code];
    if (!openid) throw new UnauthorizedException('invalid code');
    return { openid };
  }
}

export class DouyinCodeExchanger implements CodeExchanger {
  async exchange(_code: string): Promise<CodeExchangeResult> {
    // TODO(restore-douyin-code2session): port the jscode2session HTTP flow back from git history (see pre-7a3bbd6 auth.service.ts).
    // Until then, production login intentionally fails fast with a 401 so ops notices immediately.
    throw new UnauthorizedException(
      'Login service not configured: DouyinCodeExchanger pending implementation',
    );
  }
}
