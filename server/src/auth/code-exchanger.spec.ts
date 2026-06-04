import { DouyinCodeExchanger, StubCodeExchanger } from './code-exchanger';

describe('StubCodeExchanger', () => {
  it('returns deterministic openid for test code', async () => {
    const ex = new StubCodeExchanger({ CODE1: 'OPEN1' });
    expect(await ex.exchange('CODE1')).toEqual({ openid: 'OPEN1' });
  });

  it('throws on unknown code', async () => {
    const ex = new StubCodeExchanger({});
    await expect(ex.exchange('UNKNOWN')).rejects.toThrow(/invalid code/i);
  });
});

describe('DouyinCodeExchanger', () => {
  const REAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...REAL_ENV,
      DOUYIN_APP_ID: 'tt_real_appid_123',
      DOUYIN_APP_SECRET: 'real_secret_456',
    };
  });

  afterEach(() => {
    process.env = REAL_ENV;
  });

  function mockFetch(responses: Array<{ ok: boolean; json: any }>): typeof fetch {
    let call = 0;
    return (async () => {
      const r = responses[call++] ?? responses[responses.length - 1];
      return { ok: r.ok, json: async () => r.json } as Response;
    }) as unknown as typeof fetch;
  }

  it('returns openid when GET endpoint succeeds', async () => {
    const fetcher = mockFetch([
      { ok: true, json: { error: 0, openid: 'oid_from_get' } },
    ]);
    const ex = new DouyinCodeExchanger(fetcher);
    const result = await ex.exchange('valid-code');
    expect(result).toEqual({ openid: 'oid_from_get' });
  });

  it('falls back to POST when GET returns error, POST succeeds', async () => {
    const fetcher = mockFetch([
      { ok: true, json: { error: 40015, errmsg: 'invalid code' } }, // GET fails
      { ok: true, json: { err_no: 0, data: { openid: 'oid_from_post' } } }, // POST ok
    ]);
    const ex = new DouyinCodeExchanger(fetcher);
    const result = await ex.exchange('code-that-needs-fallback');
    expect(result).toEqual({ openid: 'oid_from_post' });
  });

  it('throws 401 when both endpoints fail', async () => {
    const fetcher = mockFetch([
      { ok: true, json: { error: 40015, errmsg: 'bad code' } },   // GET fails
      { ok: true, json: { err_no: 40015, err_tips: 'bad code' } }, // POST fails
    ]);
    const ex = new DouyinCodeExchanger(fetcher);
    await expect(ex.exchange('bad-code')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when AppID/Secret are placeholder values', async () => {
    process.env.DOUYIN_APP_ID = 'tt_test_appid';
    process.env.DOUYIN_APP_SECRET = 'tt_test_secret';
    const ex = new DouyinCodeExchanger(jest.fn());
    await expect(ex.exchange('any-code')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when code is empty', async () => {
    const ex = new DouyinCodeExchanger(jest.fn());
    await expect(ex.exchange('')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when fetch itself throws (network error)', async () => {
    const fetcher = (() => { throw new Error('network down'); }) as unknown as typeof fetch;
    const ex = new DouyinCodeExchanger(fetcher);
    await expect(ex.exchange('some-code')).rejects.toMatchObject({ status: 401 });
  });
});
