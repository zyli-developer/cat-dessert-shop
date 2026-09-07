/**
 * Unit tests for DropController (TC-DROP-001..004).
 *
 * Real API shape:
 * - DropController is a Cocos @ccclass Component. Drops are NOT a public method;
 *   they occur through Node touch events (TOUCH_START/MOVE/END). We exercise the
 *   flow by calling the private `onTouchStart` / `onTouchEnd` directly, or by
 *   firing the corresponding events on `this.node`.
 * - An injectable RNG seam is exposed via `setRng(fn)` — used to pin the value
 *   emitted by `generateNext()` so TC-DROP-004 can assert deterministic change.
 * - A touch only arms a drop ("aiming") when TOUCH_START lands INSIDE the
 *   container rect (|x| <= w/2 && |y| <= h/2 in container-local space) — taps on
 *   HUD buttons / blank screen are ignored. TOUCH_MOVE/END may leave the rect;
 *   x is clamped to [containerLeft + radius, containerRight - radius] in
 *   `applyAimX`. The UITransform stub's `convertToNodeSpaceAR` is identity, so
 *   UI location maps directly to container-local.
 * - `dropCooldown` uses `scheduleOnce` — the cc stub's scheduleOnce is a jest.fn
 *   that does NOT auto-fire. We verify throttle by observing `canDrop` flips to
 *   false after a drop and the next touch is a no-op until the scheduled
 *   callback runs.
 */

import { DropController } from '../../assets/scenes/scripts/core/DropController';
import { MergeManager } from '../../assets/scenes/scripts/core/MergeManager';
import { BLOCKER_LEVEL, BLOCKER_LEVEL_T2 } from '../../assets/scenes/scripts/data/DessertConfig';
import { GameState } from '../../assets/scenes/scripts/data/GameState';
import { Node, UITransform, EventTouch, Vec3 } from 'cc';

function makeController(width = 400, height = 600) {
  const dc = new DropController();
  // Host node that receives touch events.
  (dc as any).node = new Node();

  // Container node with a UITransform the controller will read.
  const containerNode = new Node();
  const containerUi = containerNode.addComponent(UITransform);
  containerUi.setContentSize(width, height);
  dc.containerNode = containerNode;

  // MergeManager with a spy for spawnDessert so we can observe drop target level/pos.
  const mm = new MergeManager();
  (mm as any).spawnDessert = jest.fn();
  dc.mergeManager = mm;

  // Preview nodes — keep present so the onTouch path uses them.
  dc.previewNode = new Node();
  dc.nextPreviewNode = new Node();
  dc.guideLineNode = new Node();

  return { dc, mm, containerNode };
}

describe('DropController', () => {
  beforeEach(() => {
    // Reset GameState so generateNext falls back to dropRange [1,2].
    GameState.instance.allLevels = [];
    GameState.instance.currentRound = 1;
  });

  it('TC-DROP-001 drop spawns a dessert at the touch x via mergeManager.spawnDessert', () => {
    const { dc, mm } = makeController();
    // Deterministic rng: always pick min of dropRange -> currentLevel becomes 1.
    dc.setRng(() => 0);
    dc.onLoad();

    const ev = new EventTouch(50, 0);
    (dc as any).onTouchStart(ev);
    (dc as any).onTouchEnd(ev);

    const spawn = (mm as any).spawnDessert as jest.Mock;
    expect(spawn).toHaveBeenCalledTimes(1);
    const [level, worldPos] = spawn.mock.calls[0];
    expect(level).toBe(1);
    expect(worldPos).toBeDefined();
    // Stub convertToWorldSpaceAR is identity, so world x equals preview local x.
    expect(worldPos.x).toBe(50);
  });

  it('TC-DROP-002 rapid drops are throttled by dropCooldown (canDrop flips false)', () => {
    const { dc, mm } = makeController();
    dc.setRng(() => 0);
    dc.onLoad();

    const ev = new EventTouch(0, 0);
    (dc as any).onTouchStart(ev);
    (dc as any).onTouchEnd(ev);

    // After first drop, canDrop is gated to false until the scheduled callback
    // fires. The cc stub's scheduleOnce is a jest.fn that does NOT auto-invoke.
    expect((dc as any).canDrop).toBe(false);
    expect((dc as any).scheduleOnce).toHaveBeenCalledTimes(1);

    // Second touch in the cooldown window is a no-op: no additional spawn.
    (dc as any).onTouchStart(ev);
    (dc as any).onTouchEnd(ev);
    expect((mm as any).spawnDessert).toHaveBeenCalledTimes(1);

    // Manually fire the scheduled cooldown callback -> canDrop re-enables.
    const cb = ((dc as any).scheduleOnce as jest.Mock).mock.calls[0][0];
    cb();
    expect((dc as any).canDrop).toBe(true);
  });

  it('TC-DROP-003 touch x is clamped to container bounds minus dessert radius', () => {
    const { dc, mm } = makeController(400, 600);
    dc.setRng(() => 0); // currentLevel = 1 -> radius = 20
    dc.onLoad();

    // Container 400 wide -> left = -200, right = +200. Radius 20 -> inner [-180, 180].
    // Start INSIDE (required to arm aiming), then release far outside → clamped.
    (dc as any).onTouchStart(new EventTouch(150, 0));
    (dc as any).onTouchEnd(new EventTouch(10_000, 0));

    let [, worldPos] = ((mm as any).spawnDessert as jest.Mock).mock.calls[0];
    expect(worldPos.x).toBe(180);

    // Let cooldown elapse.
    const cd = ((dc as any).scheduleOnce as jest.Mock).mock.calls[0][0];
    cd();

    (dc as any).onTouchStart(new EventTouch(-150, 0));
    (dc as any).onTouchEnd(new EventTouch(-10_000, 0));
    [, worldPos] = ((mm as any).spawnDessert as jest.Mock).mock.calls[1];
    expect(worldPos.x).toBe(-180);
  });

  it('blockerChance rolls BLOCKER_LEVEL as next drop; chance 0 consumes no rng', () => {
    GameState.instance.allLevels = [{
      round: 1,
      name: 't',
      customers: [],
      dropRange: [1, 2],
      blockerChance: 0.5,
      star2Score: 100,
      star3Score: 200,
    } as any];
    GameState.instance.currentRound = 1;

    const { dc } = makeController();
    // rng 序列：onLoad 两次 generateNext，每次先掷 blocker 概率再掷 dropRange。
    // 0.4<0.5 → current 为 blocker；0.9>0.5 → 走 dropRange，0.9→Lv2。
    const seq = [0.4, 0.9, 0.9];
    let i = 0;
    dc.setRng(() => seq[i++] ?? 0.9);
    dc.onLoad();

    expect((dc as any).currentLevel).toBe(BLOCKER_LEVEL);
    expect((dc as any).nextLevel).toBe(2);
  });

  it('多档 blockers：单次 rng 按概率分区，落在 T2 区间则掉 T2 障碍', () => {
    GameState.instance.allLevels = [{
      round: 1,
      name: 't',
      customers: [],
      dropRange: [1, 2],
      // T1 占 [0,0.3)，T2 占 [0.3,0.6)，其余为普通甜品
      blockers: [{ level: BLOCKER_LEVEL, chance: 0.3 }, { level: BLOCKER_LEVEL_T2, chance: 0.3 }],
      star2Score: 100,
      star3Score: 200,
    } as any];
    GameState.instance.currentRound = 1;

    const { dc } = makeController();
    // onLoad 两次 generateNext：
    //   current: rng=0.1 → 落在 T1 区间 → BLOCKER_LEVEL
    //   next:    rng=0.45 → 落在 T2 区间 → BLOCKER_LEVEL_T2
    const seq = [0.1, 0.45, 0.9];
    let i = 0;
    dc.setRng(() => seq[i++] ?? 0.9);
    dc.onLoad();

    expect((dc as any).currentLevel).toBe(BLOCKER_LEVEL);
    expect((dc as any).nextLevel).toBe(BLOCKER_LEVEL_T2);
  });

  it('touches starting OUTSIDE the container never drop (HUD buttons / blank screen)', () => {
    const { dc, mm } = makeController(400, 600);
    dc.setRng(() => 0);
    dc.onLoad();

    // Outside horizontally (toolbar / pause button region) and vertically.
    for (const [x, y] of [[-300, 0], [300, 0], [0, 580], [0, -580]]) {
      const ev = new EventTouch(x, y);
      (dc as any).onTouchStart(ev);
      (dc as any).onTouchEnd(ev);
    }
    expect((mm as any).spawnDessert).not.toHaveBeenCalled();

    // Inside still works.
    const inside = new EventTouch(0, 0);
    (dc as any).onTouchStart(inside);
    (dc as any).onTouchEnd(inside);
    expect((mm as any).spawnDessert).toHaveBeenCalledTimes(1);
  });

  it('TOUCH_CANCEL aborts aiming without dropping; hammer-mode suspends drops', () => {
    const { dc, mm } = makeController(400, 600);
    dc.setRng(() => 0);
    dc.onLoad();

    // Cancel (e.g. popup opening interrupts the touch) → no spawn.
    (dc as any).onTouchStart(new EventTouch(0, 0));
    (dc as any).onTouchCancel(new EventTouch(0, 0));
    (dc as any).onTouchEnd(new EventTouch(0, 0));
    expect((mm as any).spawnDessert).not.toHaveBeenCalled();

    // Hammer mode: in-container taps select desserts, must NOT drop.
    GameState.instance.events.emit('hammer-mode-changed', true);
    (dc as any).onTouchStart(new EventTouch(0, 0));
    (dc as any).onTouchEnd(new EventTouch(0, 0));
    expect((mm as any).spawnDessert).not.toHaveBeenCalled();

    // Leaving hammer mode re-enables dropping.
    GameState.instance.events.emit('hammer-mode-changed', false);
    (dc as any).onTouchStart(new EventTouch(0, 0));
    (dc as any).onTouchEnd(new EventTouch(0, 0));
    expect((mm as any).spawnDessert).toHaveBeenCalledTimes(1);
  });

  it('TC-DROP-004 after a drop the queued "current level" advances to the previously-next level', () => {
    const { dc, mm } = makeController();

    // Pre-set allLevels so generateNext uses a deterministic dropRange.
    GameState.instance.allLevels = [{
      round: 1,
      customers: [],
      dropRange: [1, 3],
      star2Score: 100,
      star3Score: 200,
    }];
    GameState.instance.currentRound = 1;

    // rng sequence: onLoad calls generateNext twice (first for "current",
    // then for "next" before the drop). After drop, generateNext fires once more.
    // Emit 0, then 0.9, then 0.9 -> current=1, next=3, then after drop: level=3, next=3.
    const seq = [0, 0.9, 0.9];
    let i = 0;
    dc.setRng(() => seq[i++] ?? 0);
    dc.onLoad();

    expect((dc as any).currentLevel).toBe(1);
    expect((dc as any).nextLevel).toBe(3);

    const ev = new EventTouch(0, 0);
    (dc as any).onTouchStart(ev);
    (dc as any).onTouchEnd(ev);

    expect((dc as any).currentLevel).toBe(3); // promoted from previous next
    // The spawnDessert receives the pre-drop current level (1).
    const [spawnedLevel] = ((mm as any).spawnDessert as jest.Mock).mock.calls[0];
    expect(spawnedLevel).toBe(1);
  });
});
