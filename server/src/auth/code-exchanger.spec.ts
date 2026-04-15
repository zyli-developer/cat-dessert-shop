import { StubCodeExchanger } from './code-exchanger';

describe('StubCodeExchanger', () => {
  it('returns deterministic openid for test code', async () => {
    const ex = new StubCodeExchanger({ 'CODE1': 'OPEN1' });
    expect(await ex.exchange('CODE1')).toEqual({ openid: 'OPEN1' });
  });

  it('throws on unknown code', async () => {
    const ex = new StubCodeExchanger({});
    await expect(ex.exchange('UNKNOWN')).rejects.toThrow(/invalid code/i);
  });
});
