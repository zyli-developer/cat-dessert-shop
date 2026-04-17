import { createGameHarness } from './gameHarness';

describe('gameHarness', () => {
  it('instantiates with default deps', () => {
    const h = createGameHarness();
    expect(h).toBeDefined();
    expect(typeof h.dropDessert).toBe('function');
    expect(typeof h.getState).toBe('function');
  });

  it('accepts injected rng for determinism', () => {
    const rng = jest.fn(() => 0.5);
    const h = createGameHarness({ rng });
    // Intentionally minimal — full API surface grows in X2.
    // This test only proves the injection plumbing is alive.
    h.getState();
    // rng is not yet wired to anything; we assert the factory accepts it.
    expect(h).toBeDefined();
  });
});
