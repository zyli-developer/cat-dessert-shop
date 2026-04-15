# Test Automation Phase T2: Client Unit Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up `client/tests/` as an isolated Jest workspace with hand-written `cc` module stub and jsdom environment; land spec suites for `core/`, `data/`, and `net/`; enforce ≥ 85% line coverage on those directories.

**Architecture:** Jest + ts-jest + `jest-environment-jsdom`. Generic `cc` stub lives at `client/tests/__mocks__/cc.ts` and is routed via `moduleNameMapper`. Production code receives minimal dependency injection (clock / rng / fetch / storage) so behaviors can be driven deterministically.

**Tech Stack:** Jest 30, ts-jest, jest-environment-jsdom, zod (for `levels.json` schema).

**Prerequisite:** Phase T1 merged — npm workspaces root in place.

**Reference design:** `docs/plans/2026-04-15-test-automation-design.md` sections 2.2, 3.1, 4.3, 6.

---

## Conventions

- One commit per task. Messages: `test(t2): ...` / `feat(t2): ...` / `chore(t2): ...`.
- All production-code changes must be additive (add optional constructor args with defaults). **Never break existing Cocos scene bindings.**
- When you add a new `cc` symbol to the stub, list it in a comment at the top of `__mocks__/cc.ts`.

---

## Task 1: Bootstrap `client/tests/` workspace

**Files:**
- Create: `client/tests/package.json`
- Create: `client/tests/tsconfig.json`
- Create: `client/tests/jest.config.ts`
- Create: `client/tests/setup.ts`
- Modify: root `package.json` (add `client/tests` to workspaces + add `test:client` script)

**Step 1: Add `client/tests` to root `package.json` workspaces**

```json
"workspaces": ["server", "client/tests", "scripts/tests"]
```

Add script:
```json
"test:client": "npm --workspace client/tests run test:ci"
```

Include `test:client` in `test:all` chain.

**Step 2: Create `client/tests/package.json`**

```json
{
  "name": "@catbakery/client-tests",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test": "jest",
    "test:ci": "jest --coverage --coverageDirectory=../../coverage/raw/client"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "jest": "^30.0.0",
    "jest-environment-jsdom": "^30.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.3",
    "zod": "^3.23.0"
  }
}
```

**Step 3: Create `client/tests/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist",
    "types": ["jest", "node"]
  },
  "include": ["**/*.ts", "../assets/scenes/scripts/**/*.ts"]
}
```

**Step 4: Create `client/tests/jest.config.ts`**

```ts
import type { Config } from 'jest';
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  rootDir: '.',
  roots: ['<rootDir>'],
  moduleNameMapper: {
    '^cc$': '<rootDir>/__mocks__/cc.ts',
    '^cc/env$': '<rootDir>/__mocks__/cc-env.ts',
  },
  setupFilesAfterEach: ['<rootDir>/setup.ts'],
  collectCoverageFrom: [
    '../assets/scenes/scripts/core/**/*.ts',
    '../assets/scenes/scripts/data/**/*.ts',
    '../assets/scenes/scripts/net/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 90, lines: 85, statements: 85 },
  },
};
export default config;
```

**Step 5: Create `client/tests/setup.ts`**

```ts
// Global mocks installed for every spec.
(globalThis as any).tt = {
  _storage: new Map<string, any>(),
  setStorageSync(k: string, v: any) { (globalThis as any).tt._storage.set(k, v); },
  getStorageSync(k: string) { return (globalThis as any).tt._storage.get(k) ?? ''; },
  removeStorageSync(k: string) { (globalThis as any).tt._storage.delete(k); },
};
afterEach(() => { (globalThis as any).tt._storage.clear(); });
```

**Step 6: Install**

Run: `npm install` (from repo root)
Expected: client/tests deps resolve.

**Step 7: Commit**

```bash
git add client/tests/ package.json package-lock.json
git commit -m "chore(t2): bootstrap client/tests workspace"
```

---

## Task 2: Write `cc` module stub

**Files:**
- Create: `client/tests/__mocks__/cc.ts`
- Create: `client/tests/__mocks__/cc-env.ts`

**Step 1: Scan production code for cc imports**

Run: `grep -rh "from 'cc'" client/assets/scenes/scripts | sort -u`
Note: record every imported symbol. Treat this as the required surface.

**Step 2: Write `client/tests/__mocks__/cc.ts`**

```ts
// Minimal hand-written stub for the `cc` module.
// Surface covered: Component, Node, Vec2, Vec3, tween, director, resources,
//                  _decorator (ccclass, property), Label, Sprite, Prefab,
//                  instantiate, EventTarget, sys, find, Color.
// When a new cc API is imported by production code, add it here.

import { EventEmitter } from 'events';

export class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  add(v: Vec3) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: Vec3) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  clone() { return new Vec3(this.x, this.y, this.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; return this; }
}
export class Vec2 { constructor(public x = 0, public y = 0) {} }
export class Color { constructor(public r = 255, public g = 255, public b = 255, public a = 255) {} }

export class Node {
  name = '';
  active = true;
  position = new Vec3();
  parent: Node | null = null;
  children: Node[] = [];
  private _components: Component[] = [];
  private _emitter = new EventEmitter();
  addChild(c: Node) { c.parent = this; this.children.push(c); }
  removeFromParent() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null; }
  destroy() { this.removeFromParent(); }
  getComponent<T>(ctor: new () => T): T | null { return (this._components.find(c => c instanceof (ctor as any)) as any) ?? null; }
  addComponent<T extends Component>(ctor: new () => T): T { const c = new ctor(); (c as any).node = this; this._components.push(c); return c; }
  on(e: string, fn: (...args: any[]) => void) { this._emitter.on(e, fn); }
  off(e: string, fn: (...args: any[]) => void) { this._emitter.off(e, fn); }
  emit(e: string, ...args: any[]) { this._emitter.emit(e, ...args); }
}

export class Component {
  node: Node = new Node();
  enabled = true;
  onLoad?(): void;
  onEnable?(): void;
  start?(): void;
  update?(dt: number): void;
  onDestroy?(): void;
  schedule = jest.fn();
  unschedule = jest.fn();
  scheduleOnce = jest.fn();
}

export class Label extends Component { string = ''; }
export class Sprite extends Component { spriteFrame: any = null; }
export class Prefab { }

export const instantiate = jest.fn((src: any) => {
  const n = new Node();
  n.name = src?.name ?? 'instantiated';
  return n;
});

type TweenChain = {
  to: (...a: any[]) => TweenChain;
  by: (...a: any[]) => TweenChain;
  delay: (...a: any[]) => TweenChain;
  call: (cb: () => void) => TweenChain;
  start: () => TweenChain;
  union: () => TweenChain;
  repeat: (...a: any[]) => TweenChain;
};

export function tween<T>(_target?: T): TweenChain {
  let queued: Array<() => void> = [];
  const chain: TweenChain = {
    to: () => chain,
    by: () => chain,
    delay: () => chain,
    call: (cb) => { queued.push(cb); return chain; },
    start: () => {
      // Upgrade A: drive via rAF instead of synchronous, so timing-sensitive
      // tests can advance using fake timers + jest.advanceTimersByTime.
      const run = () => { while (queued.length) queued.shift()!(); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else run();
      return chain;
    },
    union: () => chain,
    repeat: () => chain,
  };
  return chain;
}

export const director = {
  getScene: jest.fn(() => new Node()),
  loadScene: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

export const resources = {
  load: jest.fn((_p: string, cb?: Function) => cb?.(null, {})),
  release: jest.fn(),
};

export const sys = { platform: 'unknown', isBrowser: true };

export const find = jest.fn((_name: string) => new Node());

export const _decorator = {
  ccclass: (_name?: string) => <T>(_cls: T) => _cls,
  property: (_arg?: any) => (_t: any, _k: string) => {},
  executeInEditMode: <T>(_cls: T) => _cls,
  menu: (_m: string) => <T>(_cls: T) => _cls,
  requireComponent: (_c: any) => <T>(_cls: T) => _cls,
};

export class EventTarget extends EventEmitter {
  emit(e: string, ...a: any[]): boolean { super.emit(e, ...a); return true; }
}

export const view = { getVisibleSize: () => ({ width: 720, height: 1280 }) };
```

**Step 3: Create `client/tests/__mocks__/cc-env.ts`**

```ts
export const DEBUG = true;
export const EDITOR = false;
export const DEV = true;
export const PREVIEW = false;
export const BUILD = false;
```

**Step 4: Smoke-test the stub**

Create `client/tests/__mocks__/cc.smoke.spec.ts`:

```ts
import { Vec3, tween, Node, _decorator } from 'cc';

describe('cc stub smoke', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Vec3 arithmetic', () => {
    expect(new Vec3(1, 2, 3).add(new Vec3(1, 1, 1))).toMatchObject({ x: 2, y: 3, z: 4 });
  });

  it('tween executes queued callback via rAF', () => {
    const cb = jest.fn();
    tween({}).call(cb).start();
    jest.advanceTimersByTime(20);
    expect(cb).toHaveBeenCalled();
  });

  it('Node add/remove child', () => {
    const p = new Node(), c = new Node();
    p.addChild(c);
    expect(p.children).toContain(c);
    c.removeFromParent();
    expect(p.children).not.toContain(c);
  });

  it('_decorator.ccclass is a no-op', () => {
    @_decorator.ccclass('X') class X {}
    expect(new X()).toBeInstanceOf(X);
  });
});
```

**Step 5: Run**

Run: `npm run test:client`
Expected: PASS.

**Step 6: Commit**

```bash
git add client/tests/__mocks__/
git commit -m "feat(t2): hand-written cc module stub with jsdom + rAF tween"
```

---

## Task 3: Production-code testability refactor (DI)

**Goal:** Add optional injected deps to 5 production files with zero behavior change at default.

**Files:**
- Modify: `client/assets/scenes/scripts/core/CustomerManager.ts` — add `rng?: () => number` constructor arg or property
- Modify: `client/assets/scenes/scripts/core/DropController.ts` — add `clock?: () => number`
- Modify: `client/assets/scenes/scripts/core/OverflowDetector.ts` — add `clock?: () => number`
- Modify: `client/assets/scenes/scripts/net/ApiClient.ts` — add `fetchImpl?: typeof fetch`
- Modify: `client/assets/scenes/scripts/data/GameState.ts` — introduce `Storage` interface and optional injected impl; default wraps `tt`

**Step 1: Read each file, identify the spot** where `Math.random`, `Date.now`, `globalThis.fetch`, and `tt.setStorageSync` are called.

**Step 2: Refactor `CustomerManager.ts`**

Add field + setter (keep decorators for Cocos):
```ts
private rng: () => number = Math.random;
setRng(fn: () => number) { this.rng = fn; }
```
Replace inline `Math.random()` calls with `this.rng()`.

**Step 3: Refactor `DropController.ts` and `OverflowDetector.ts`**

```ts
private clock: () => number = () => Date.now();
setClock(fn: () => number) { this.clock = fn; }
```
Replace `Date.now()` with `this.clock()`.

**Step 4: Refactor `ApiClient.ts`**

```ts
private fetchImpl: typeof fetch = (...args) => fetch(...args);
setFetch(fn: typeof fetch) { this.fetchImpl = fn; }
```
Replace `fetch(...)` calls with `this.fetchImpl(...)`.

**Step 5: Introduce Storage interface in `GameState.ts`**

```ts
export interface KVStorage { get(k: string): string; set(k: string, v: string): void; remove(k: string): void; }
const ttStorage: KVStorage = {
  get: (k) => (globalThis as any).tt?.getStorageSync(k) ?? '',
  set: (k, v) => (globalThis as any).tt?.setStorageSync(k, v),
  remove: (k) => (globalThis as any).tt?.removeStorageSync(k),
};
// Add an optional constructor/field:
private storage: KVStorage = ttStorage;
setStorage(s: KVStorage) { this.storage = s; }
```
Replace all `tt.setStorageSync/getStorageSync/removeStorageSync` calls with `this.storage.*`.

**Step 6: Verify server still builds & existing server tests still pass**

Run: `npm run test:server`
Expected: PASS (no client changes affect server).

**Step 7: Verify Cocos scenes still compile** — open Cocos Creator editor once; scenes should load without missing references. If you cannot run the editor now, defer this check but flag it in the commit message.

**Step 8: Commit**

```bash
git add client/assets/scenes/scripts/
git commit -m "feat(t2): add DI seams (rng/clock/fetch/storage) to core/net/data for testability"
```

---

## Task 4: MergeManager specs (TC-MERGE-001..005)

**Files:**
- Create: `client/tests/core/MergeManager.spec.ts`

**Step 1: Write the failing tests**

```ts
import { MergeManager } from '../../assets/scenes/scripts/core/MergeManager';
import { Dessert, DessertType } from '../../assets/scenes/scripts/core/Dessert';

function dessert(type: DessertType, level: number): Dessert {
  const d = new Dessert();
  (d as any).type = type;
  (d as any).level = level;
  return d;
}

describe('MergeManager', () => {
  let mm: MergeManager;
  beforeEach(() => { mm = new MergeManager(); });

  it('TC-MERGE-001: merges two same-type same-level into level+1', () => {
    const a = dessert('cake', 1), b = dessert('cake', 1);
    const merged = mm.tryMerge(a, b);
    expect(merged).not.toBeNull();
    expect(merged!.level).toBe(2);
    expect(merged!.type).toBe('cake');
  });

  it('TC-MERGE-002: refuses different types', () => {
    expect(mm.tryMerge(dessert('cake', 1), dessert('pie', 1))).toBeNull();
  });

  it('TC-MERGE-003: refuses at MAX level', () => {
    const MAX = mm.maxLevel;
    expect(mm.tryMerge(dessert('cake', MAX), dessert('cake', MAX))).toBeNull();
  });

  it('TC-MERGE-004: three same-level produces one merge only', () => {
    const triples = [dessert('cake', 1), dessert('cake', 1), dessert('cake', 1)];
    const results = mm.tryMergeAll(triples);
    expect(results.merges).toHaveLength(1);
    expect(results.leftover).toHaveLength(1);
  });

  it('TC-MERGE-005: emits onMerge with correct payload', () => {
    const spy = jest.fn();
    mm.onMerge(spy);
    mm.tryMerge(dessert('cake', 1), dessert('cake', 1));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'cake', newLevel: 2 }));
  });
});
```

**Step 2: Run — adjust MergeManager API minimally** if tests expose gaps (add `maxLevel` / `tryMergeAll` / `onMerge` if missing). Never edit tests to match buggy behavior.

**Step 3: Commit**

```bash
git add client/tests/core/MergeManager.spec.ts client/assets/scenes/scripts/core/MergeManager.ts
git commit -m "test(t2): MergeManager specs (TC-MERGE-001..005)"
```

---

## Task 5: DropController specs (TC-DROP-001..004)

**Files:**
- Create: `client/tests/core/DropController.spec.ts`

**Step 1: Write tests using fake clock**

```ts
import { DropController } from '../../assets/scenes/scripts/core/DropController';

describe('DropController', () => {
  let now = 0; const clock = () => now;
  let ctrl: DropController;
  beforeEach(() => { now = 0; ctrl = new DropController(); ctrl.setClock(clock); });

  it('TC-DROP-001: drop at given x produces dessert at that x', () => {
    const d = ctrl.drop(120);
    expect(d).not.toBeNull();
    expect(d!.node.position.x).toBe(120);
  });

  it('TC-DROP-002: throttle ignores calls within cooldown', () => {
    ctrl.drop(100);
    now += 50;
    expect(ctrl.drop(100)).toBeNull();
    now += 300;
    expect(ctrl.drop(100)).not.toBeNull();
  });

  it('TC-DROP-003: clamps x to container bounds', () => {
    ctrl.setBounds(-100, 100);
    expect(ctrl.drop(999)!.node.position.x).toBeLessThanOrEqual(100);
    now += 500;
    expect(ctrl.drop(-999)!.node.position.x).toBeGreaterThanOrEqual(-100);
  });

  it('TC-DROP-004: nextDessert refreshed after drop', () => {
    const before = ctrl.getNextDessert();
    ctrl.drop(0);
    const after = ctrl.getNextDessert();
    expect(after).not.toBe(before);
  });
});
```

**Step 2: Run + commit** (pattern: same as Task 4).

```bash
git commit -m "test(t2): DropController specs with injected clock (TC-DROP-001..004)"
```

---

## Task 6: Container specs (TC-CONT-001..002)

**Files:**
- Create: `client/tests/core/Container.spec.ts`

Minimal spec: add desserts → `getOccupiedHeight()` monotonic; `clear()` empties. Commit.

---

## Task 7: OverflowDetector specs (TC-OVER-001..003)

**Files:**
- Create: `client/tests/core/OverflowDetector.spec.ts`

Inject clock; assert:
- Exceeds threshold for `dt` duration → `onOverflow` fires once
- Brief excursion (< dt) → no fire
- Fire only once per round

Commit.

---

## Task 8: CustomerManager specs (TC-CUST-001..005)

**Files:**
- Create: `client/tests/core/CustomerManager.spec.ts`

Inject `rng` with deterministic sequence. Cover:
- Orders match level config
- Correct dessert → score (+ remaining-time bonus)
- Wrong dessert → no score
- Timeout path
- `onLevelComplete` payload shape

Commit.

---

## Task 9: ScoreManager specs (TC-SCORE-001..004)

**Files:**
- Create: `client/tests/core/ScoreManager.spec.ts`

Cover accumulation, star thresholds matrix (99/100/299/300/599/600/700 → 0/1/1/2/2/3/3), roundScores shape matches `net/ApiTypes.ts`, reset zeros score.

Commit.

---

## Task 10: GameState persistence specs (TC-STATE-001..002, new)

**Files:**
- Create: `client/tests/data/GameState.spec.ts`

Inject in-memory `KVStorage`. Cover:
- Write → read round-trip
- Offline queue: failed upload enqueued, retry drains queue

Commit.

---

## Task 11: DessertConfig + levels.json schema specs (TC-CFG-001, new)

**Files:**
- Create: `client/tests/data/levels.spec.ts`

```ts
import { z } from 'zod';
import levels from '../../assets/resources/configs/levels.json';
import { DessertConfig } from '../../assets/scenes/scripts/data/DessertConfig';

const LevelSchema = z.object({
  id: z.number().int().positive(),
  stars: z.object({ 1: z.number(), 2: z.number(), 3: z.number() })
    .refine(s => s[1] < s[2] && s[2] < s[3], { message: 'star thresholds must be ascending' }),
  customers: z.array(z.object({ type: z.string(), level: z.number().int().positive() })).min(1),
});

describe('levels.json schema', () => {
  it('parses and ids are contiguous 1..N', () => {
    const arr = z.array(LevelSchema).parse(levels);
    arr.forEach((lv, i) => expect(lv.id).toBe(i + 1));
  });

  it('every customer.type exists in DessertConfig', () => {
    const known = new Set(Object.keys(DessertConfig.types));
    for (const lv of levels as any[]) {
      for (const c of lv.customers) expect(known.has(c.type)).toBe(true);
    }
  });
});
```

Run + commit.

---

## Task 12: ApiClient specs (TC-API-CLIENT-001..004, new)

**Files:**
- Create: `client/tests/net/ApiClient.spec.ts`

Cover with injected `fetchImpl`:
- Happy path returns parsed body
- Timeout → rejects with timeout error
- 5xx → rejects with server error
- 401 → clears token (via injected Storage) and rejects

Commit.

---

## Task 13: Add client-unit CI job

**Files:**
- Modify: `.github/workflows/test.yml` — add `client-unit` job (copy from design section 5.1)
- Modify: `coverage` job `needs:` to include `client-unit`

Commit: `ci(t2): add client-unit workflow job`

---

## Task 14: Acceptance verification

- [ ] `npm run test:client` PASS; coverage `lines ≥ 85%`
- [ ] `npm run test:all` still PASS (T1 didn't regress)
- [ ] `coverage/raw/client/lcov.info` populated
- [ ] No changes to Cocos `.meta` files; editor still loads scenes
- [ ] All 10 new-gap items from design §3.6 that belong in T2 have specs (STATE, CFG, API-CLIENT)

If green → T2 complete. Next: `docs/plans/2026-04-15-test-automation-T3-e2e.md`.
