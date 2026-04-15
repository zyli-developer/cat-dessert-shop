// Global mocks installed for every spec in this workspace.
interface TtStub {
  _storage: Map<string, any>;
  setStorageSync(k: string, v: any): void;
  getStorageSync(k: string): any;
  removeStorageSync(k: string): void;
}

const ttStub: TtStub = {
  _storage: new Map(),
  setStorageSync(k, v) { this._storage.set(k, v); },
  getStorageSync(k) { return this._storage.get(k) ?? ''; },
  removeStorageSync(k) { this._storage.delete(k); },
};
(globalThis as any).tt = ttStub;

afterEach(() => { ttStub._storage.clear(); });
