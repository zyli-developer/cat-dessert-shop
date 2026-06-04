// X1 minimal scaffold — API surface grows in X2 as production code modules
// are refactored for dependency injection (see
// docs/plans/2026-04-17-testing-strategy-design.md §2.1).

export interface IKVStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface GameHarnessOpts {
  rng?: () => number;
  clock?: () => number;
  storage?: IKVStorage;
  fetchImpl?: typeof fetch;
}

export interface GameHarness {
  dropDessert: (type: number, x: number) => void;
  getState: () => Record<string, unknown>;
}

export function createGameHarness(_opts: GameHarnessOpts = {}): GameHarness {
  // X1 stub: the real harness composes core/data/net modules.
  // Each X2 PR will expand this as the corresponding production module
  // becomes injectable.
  return {
    dropDessert: () => {
      throw new Error('not yet wired — see X2 P5 (core dependency injection)');
    },
    getState: () => ({}),
  };
}
