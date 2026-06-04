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

// jsdom does not provide global `fetch`. ApiClient checks `typeof fetch === 'function'`
// at call time to decide between fetch and XHR fallback. Install a no-op shim so that
// (a) the production fetch branch is exercised, and (b) tests can override behavior via
// `setFetchImpl`. The shim itself is never invoked (tests always inject a fake first).
if (typeof (globalThis as any).fetch !== 'function') {
  (globalThis as any).fetch = () => Promise.reject(new Error('no fetch shim invoked - test must inject fetch via setFetchImpl'));
}

afterEach(() => { ttStub._storage.clear(); });
