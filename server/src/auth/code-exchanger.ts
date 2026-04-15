export interface CodeExchangeResult { openid: string; }

export interface CodeExchanger {
  exchange(code: string): Promise<CodeExchangeResult>;
}

export const CODE_EXCHANGER = Symbol('CODE_EXCHANGER');

export class StubCodeExchanger implements CodeExchanger {
  constructor(private readonly table: Record<string, string>) {}
  async exchange(code: string): Promise<CodeExchangeResult> {
    const openid = this.table[code];
    if (!openid) throw new Error('invalid code');
    return { openid };
  }
}

export class DouyinCodeExchanger implements CodeExchanger {
  async exchange(_code: string): Promise<CodeExchangeResult> {
    // Production implementation: HTTP call to https://developer.toutiao.com/api/apps/v2/jscode2session
    // Reads APPID/SECRET from env. Currently stubbed to match existing project state.
    throw new Error('DouyinCodeExchanger not yet implemented');
  }
}
