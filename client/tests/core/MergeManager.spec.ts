/**
 * Unit tests for MergeManager (TC-MERGE-001..005).
 *
 * Notes on adaptation from template:
 * - Desserts in this codebase have NO "type" field — they are identified solely by
 *   numeric `level`. TC-MERGE-002 ("refuses different types") is adapted to
 *   "refuses different levels" (the equivalent real behavior in `onContact`).
 * - MergeManager is a Cocos @ccclass Component. We instantiate with `new MergeManager()`
 *   and skip `onLoad()` (which wires `PhysicsSystem2D.instance.on(...)`, not in stub).
 *   We test by invoking the private `merge()` directly or via `onContact()` with
 *   stubbed Collider2D + Dessert pairs.
 * - The merge pipeline uses `tween(...).call(...).start()` which in the cc stub
 *   dispatches queued callbacks via `requestAnimationFrame`. We run `jest.useFakeTimers()`
 *   and advance timers to flush.
 * - `scheduleOnce` is a `jest.fn()` stub (no auto-fire), so we replace it with a
 *   synchronous shim when we drive `onContact`.
 */

import { MergeManager } from '../../assets/scenes/scripts/core/MergeManager';
import { Dessert } from '../../assets/scenes/scripts/core/Dessert';
import { MAX_LEVEL } from '../../assets/scenes/scripts/data/DessertConfig';
import { GameState } from '../../assets/scenes/scripts/data/GameState';
import { Node, Prefab, Collider2D, Vec3 } from 'cc';

/** Build a minimal Dessert component attached to a fresh Node, pre-initialized. */
function makeDessert(level: number): Dessert {
  const node = new Node();
  const d = node.addComponent(Dessert);
  d.level = level;
  d.isMerging = false;
  d.isDropping = false;
  // MergeManager reads `.isValid` on both Dessert and its node during merge().
  (d as any).isValid = true;
  (node as any).isValid = true;
  (node as any).worldPosition = new Vec3(0, 0, 0);
  // Cocos Component in production proxies getComponent to its node; the stub
  // does not. MergeManager.merge() calls `a.getComponent(RigidBody2D)` — return
  // null so the physics-disable branch is skipped during unit tests.
  (d as any).getComponent = (_ctor: any) => null;
  return d;
}

/** Build a Collider2D whose `.node` carries an initialized Dessert of given level. */
function makeCollider(level: number): Collider2D {
  const d = makeDessert(level);
  const col = new Collider2D();
  (col as any).node = d.node;
  return col;
}

/** Create a MergeManager wired with required props, with private `scheduleOnce` made sync. */
function makeManager(): MergeManager {
  const mm = new MergeManager();
  const container = new Node();
  (mm as any).dessertPrefab = new Prefab();
  (mm as any).containerNode = container;
  // Fire scheduleOnce callbacks synchronously so onContact path actually runs merge().
  (mm as any).scheduleOnce = (fn: Function, _d?: number) => fn();
  return mm;
}

describe('MergeManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset GameState singleton side-effects between tests.
    GameState.instance.score = 0;
    GameState.instance.gold = 0;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('TC-MERGE-001 merges two same-level desserts into level+1', () => {
    const mm = makeManager();
    const a = makeDessert(3);
    const b = makeDessert(3);

    const cb = jest.fn();
    mm.onMergeComplete = cb;

    (mm as any).merge(a, b, 'key-001');

    // Flush tween rAF chain (two chains: one for A destroy, one for B destroy+spawn).
    jest.advanceTimersByTime(50);

    expect(a.isMerging).toBe(true);
    expect(b.isMerging).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    const [newLevel, newNode] = cb.mock.calls[0];
    expect(newLevel).toBe(4);
    expect(newNode).toBeDefined();
  });

  it('TC-MERGE-002 refuses different levels (no merge scheduled on contact)', () => {
    const mm = makeManager();
    const cb = jest.fn();
    mm.onMergeComplete = cb;

    const selfCol = makeCollider(2);
    const otherCol = makeCollider(5);

    // Exercise private onContact: must early-return when levels differ.
    (mm as any).onContact(selfCol, otherCol, {});
    jest.advanceTimersByTime(50);

    expect(cb).not.toHaveBeenCalled();
    expect((mm as any).pendingMerges.size).toBe(0);
  });

  it('TC-MERGE-003 at MAX level triggers Lv8-eliminate, NOT level+1 spawn', () => {
    const mm = makeManager();
    const merged = jest.fn();
    const lv8 = jest.fn();
    mm.onMergeComplete = merged;
    mm.onLv8Eliminate = lv8;

    const a = makeDessert(MAX_LEVEL);
    const b = makeDessert(MAX_LEVEL);
    (mm as any).merge(a, b, 'key-003');
    jest.advanceTimersByTime(50);

    expect(lv8).toHaveBeenCalledTimes(1);
    expect(merged).not.toHaveBeenCalled();
  });

  it('TC-MERGE-004 duplicate contact for same pair is deduplicated (one merge only)', () => {
    const mm = makeManager();
    const cb = jest.fn();
    mm.onMergeComplete = cb;

    // Single pair of matching-level desserts; fire onContact twice with the
    // same collider pair to prove pendingMerges/uuid-key dedup prevents a
    // second scheduled merge for the same pair (guards against "triple/repeat
    // merges" on the same frame).
    const selfCol = makeCollider(3);
    const otherCol = makeCollider(3);
    // Assign stable uuids so key derivation is deterministic.
    (selfCol.node as any).uuid = 'node-A';
    (otherCol.node as any).uuid = 'node-B';

    // Prevent merge() side-effects from finishing synchronously by making the
    // scheduleOnce shim a no-op for this test — we only inspect pendingMerges.
    (mm as any).scheduleOnce = jest.fn();

    (mm as any).onContact(selfCol, otherCol, {});
    (mm as any).onContact(selfCol, otherCol, {});

    expect((mm as any).pendingMerges.size).toBe(1);
    expect((mm as any).scheduleOnce).toHaveBeenCalledTimes(1);
  });

  it('TC-MERGE-005 invokes onMergeComplete callback with (newLevel, newNode) payload', () => {
    const mm = makeManager();
    const cb = jest.fn();
    mm.onMergeComplete = cb;

    const a = makeDessert(1);
    const b = makeDessert(1);
    (mm as any).merge(a, b, 'key-005');
    jest.advanceTimersByTime(50);

    expect(cb).toHaveBeenCalledTimes(1);
    const [level, node] = cb.mock.calls[0];
    expect(level).toBe(2);
    expect(node).toBeTruthy();
    expect(typeof node).toBe('object');
  });
});
