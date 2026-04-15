/**
 * Unit tests for CustomerManager (TC-CUST-001..005).
 *
 * Real API shape (from scenes/scripts/core/CustomerManager.ts):
 * - Cocos @ccclass Component. Customers are INJECTED via `initRound(customers)` —
 *   the manager does not generate orders from a level config itself. Any
 *   level→customer mapping happens upstream in the scene controller.
 * - Public API:
 *     initRound(customers: CustomerData[]): void
 *     onDessertMerged(level: number): boolean   // true if the dessert was needed
 *     getCurrentDemands(): Map<number, number>
 *     reset(): void
 *     setRng(fn: () => number): void            // T2-03 RNG seam
 *     getCatWorldPosition(): Vec3
 *   Callbacks (set by owner):
 *     onRoundComplete, onCustomerServed, onAllCustomersDone
 * - There is NO timeout/onCustomerTimeout mechanism in the implementation.
 *   TC-CUST-004 is adapted to cover the actual behavior exposed by T2-03's
 *   RNG seam (deterministic cat-type rotation) and is called out as such.
 * - There is NO direct score/bonus coupling — MergeManager owns score addition
 *   when a dessert is spawned. TC-CUST-002 is narrowed to the contract that
 *   CustomerManager actually fulfills: a matching merge is acknowledged and
 *   drives the onCustomerServed / progress transition.
 * - Cat transition uses scheduleOnce (stubbed as jest.fn() in cc.ts). We install
 *   a synchronous shim so the multi-step transition runs to completion inline.
 */

import { CustomerManager } from '../../assets/scenes/scripts/core/CustomerManager';
import { CustomerData } from '../../assets/scenes/scripts/data/GameTypes';
import { Node, Label, Sprite } from 'cc';

function makeManager(): CustomerManager {
  const cm = new CustomerManager();
  const catNode = new Node('cat');
  const catSprite = new Node('cat-sprite').addComponent(Sprite);
  const bubbleNode = new Node('bubble');
  const demandContainer = new Node('demands');
  const progressNode = new Node('progress');
  const progressLabel = progressNode.addComponent(Label);

  cm.catNode = catNode;
  cm.catSprite = catSprite;
  cm.bubbleNode = bubbleNode;
  cm.demandContainer = demandContainer;
  cm.progressLabel = progressLabel;

  // Fire scheduleOnce synchronously so customer transitions run inline.
  (cm as any).scheduleOnce = (fn: Function, _d?: number) => fn();
  return cm;
}

function customer(...demands: Array<[number, number]>): CustomerData {
  return { demands: demands.map(([level, count]) => ({ level, count })) };
}

describe('CustomerManager', () => {
  it('TC-CUST-001 initRound registers demands from provided customer list', () => {
    const cm = makeManager();
    cm.initRound([customer([2, 2], [3, 1]), customer([4, 1])]);

    const demands = cm.getCurrentDemands();
    // First customer's demands are active immediately.
    expect(demands.get(2)).toBe(2);
    expect(demands.get(3)).toBe(1);
    expect(demands.size).toBe(2);
    // Progress label reflects "0/total" prior to any service.
    expect(cm.progressLabel!.string).toBe('0/2');
  });

  it('TC-CUST-002 correct dessert delivery is accepted and advances the customer', () => {
    const cm = makeManager();
    const served = jest.fn();
    cm.onCustomerServed = served;
    cm.initRound([customer([2, 1]), customer([3, 1])]);

    // Matching level — returns true, current demand cleared, customer satisfied,
    // onCustomerServed fires, next customer shown.
    const accepted = cm.onDessertMerged(2);
    expect(accepted).toBe(true);
    expect(served).toHaveBeenCalledTimes(1);
    // After transition, the second customer's demands are active.
    const demands = cm.getCurrentDemands();
    expect(demands.get(3)).toBe(1);
    expect(demands.has(2)).toBe(false);
    expect(cm.progressLabel!.string).toBe('1/2');
  });

  it('TC-CUST-003 wrong dessert level is rejected and state is unchanged', () => {
    const cm = makeManager();
    const served = jest.fn();
    cm.onCustomerServed = served;
    cm.initRound([customer([4, 2])]);

    const accepted = cm.onDessertMerged(7); // not in demands
    expect(accepted).toBe(false);
    expect(served).not.toHaveBeenCalled();
    // Demand count untouched.
    expect(cm.getCurrentDemands().get(4)).toBe(2);
  });

  it('TC-CUST-004 setRng produces deterministic non-repeating cat types (no timeout API exists)', () => {
    // NOTE: the original TC template asks for onCustomerTimeout. The real
    // implementation has no timeout mechanism — demands are open-ended until
    // satisfied. We repurpose this TC to cover the T2-03 deterministic-RNG
    // seam, which IS the randomness surface the class actually exposes.
    const cm = makeManager();

    // rng sequence chosen to force picks 0, 1, 0, 1... against the
    // "available" slice (which always excludes lastCatType, so size == 2 after
    // the first pick). First call has size 3, we pick index 0.
    const seq = [0.0, 0.0, 0.99, 0.0, 0.99];
    let i = 0;
    cm.setRng(() => seq[i++]);

    cm.initRound([
      customer([2, 1]),
      customer([2, 1]),
      customer([2, 1]),
      customer([2, 1]),
    ]);

    const picks: string[] = [(cm as any).lastCatType];
    for (let k = 0; k < 3; k++) {
      cm.onDessertMerged(2);
      picks.push((cm as any).lastCatType);
    }

    // No two consecutive picks are equal — the "no-repeat" invariant holds
    // regardless of seed because lastCatType is filtered out before sampling.
    for (let k = 1; k < picks.length; k++) {
      expect(picks[k]).not.toBe(picks[k - 1]);
    }
    // And picks are drawn from the canonical CAT_TYPES set.
    for (const p of picks) expect(['orange', 'blue', 'white']).toContain(p);
  });

  it('TC-CUST-005 satisfying the final customer fires onAllCustomersDone then onRoundComplete', () => {
    const cm = makeManager();
    const allDone = jest.fn();
    const roundComplete = jest.fn();
    const served = jest.fn();
    cm.onAllCustomersDone = allDone;
    cm.onRoundComplete = roundComplete;
    cm.onCustomerServed = served;

    cm.initRound([customer([2, 1]), customer([3, 1])]);

    cm.onDessertMerged(2); // customer 1 done
    expect(allDone).not.toHaveBeenCalled();
    expect(roundComplete).not.toHaveBeenCalled();

    cm.onDessertMerged(3); // customer 2 (final) done
    expect(served).toHaveBeenCalledTimes(2);
    expect(allDone).toHaveBeenCalledTimes(1);
    expect(roundComplete).toHaveBeenCalledTimes(1);
    // Ordering: allDone fires before roundComplete so overflow detection is
    // disabled prior to the completion handler.
    const allDoneOrder = allDone.mock.invocationCallOrder[0];
    const roundOrder = roundComplete.mock.invocationCallOrder[0];
    expect(allDoneOrder).toBeLessThan(roundOrder);
    expect(cm.progressLabel!.string).toBe('2/2');
  });

  it('reset() clears customers and demand state', () => {
    const cm = makeManager();
    cm.initRound([customer([2, 1])]);
    cm.reset();
    expect(cm.getCurrentDemands().size).toBe(0);
  });
});
