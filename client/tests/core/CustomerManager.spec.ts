/**
 * Unit tests for CustomerManager (TC-CUST-001..005) — 3-simultaneous-customer model.
 *
 * CustomerManager now shows up to 3 active customers at once (game.html top row).
 * It builds 3 slots at runtime under its own node. A merged dessert is matched to
 * the first active slot that needs it; when a slot's demands are cleared the
 * customer leaves and the slot refills from the queue.
 *
 * Public contract exercised here:
 *   initRound(customers)            // fills up to 3 slots from the queue
 *   onDessertMerged(level): boolean // true if some active customer needed it
 *   getCurrentDemands(): Map        // union of all active slots' remaining demands
 *   onCustomerServed / onAllCustomersDone / onRoundComplete callbacks
 *   setRng(fn)                      // deterministic cat-type picks
 *   reset()
 *
 * Slot refill + round-completion run on scheduleOnce (shimmed synchronous below)
 * so the multi-step flow resolves inline; tween is visual-only.
 */

import { CustomerManager, CAT_TYPES } from '../../assets/scenes/scripts/core/CustomerManager';
import { CustomerData } from '../../assets/scenes/scripts/data/GameTypes';
import { Label } from 'cc';

function makeManager(): CustomerManager {
  const cm = new CustomerManager();
  cm.progressLabel = new Label();
  // Refill / round-complete timing runs synchronously so the flow resolves inline.
  (cm as any).scheduleOnce = (fn: Function, _d?: number) => fn();
  return cm;
}

function customer(...demands: Array<[number, number]>): CustomerData {
  return { demands: demands.map(([level, count]) => ({ level, count })) };
}

function slotsOf(cm: CustomerManager): any[] {
  return (cm as any).slots;
}

describe('CustomerManager (3-customer model)', () => {
  it('TC-CUST-001 initRound fills up to 3 slots; demands are the union of active customers', () => {
    const cm = makeManager();
    cm.initRound([customer([2, 2], [3, 1]), customer([4, 1])]);

    const demands = cm.getCurrentDemands();
    expect(demands.get(2)).toBe(2);
    expect(demands.get(3)).toBe(1);
    expect(demands.get(4)).toBe(1);
    // 2 customers in the queue → 2 active slots, third empty.
    expect(slotsOf(cm).filter(s => s.active).length).toBe(2);
    expect(cm.progressLabel!.string).toBe('0/2');
  });

  it('TC-CUST-002 a needed dessert is accepted and clears that customer', () => {
    const cm = makeManager();
    const served = jest.fn();
    cm.onCustomerServed = served;
    cm.initRound([customer([2, 1]), customer([3, 1])]);

    const accepted = cm.onDessertMerged(2); // matches the [2,1] customer → satisfied
    expect(accepted).toBe(true);
    expect(served).toHaveBeenCalledTimes(1);
    // queue exhausted at init (2 customers, 2 slots) → that slot empties on refill.
    const demands = cm.getCurrentDemands();
    expect(demands.has(2)).toBe(false);
    expect(demands.get(3)).toBe(1);
    expect(cm.progressLabel!.string).toBe('1/2');
  });

  it('TC-CUST-003 a dessert no active customer needs is rejected, state unchanged', () => {
    const cm = makeManager();
    const served = jest.fn();
    cm.onCustomerServed = served;
    cm.initRound([customer([4, 2])]);

    const accepted = cm.onDessertMerged(7); // nobody needs Lv7
    expect(accepted).toBe(false);
    expect(served).not.toHaveBeenCalled();
    expect(cm.getCurrentDemands().get(4)).toBe(2);
  });

  it('TC-CUST-004 the 3 on-screen customers have distinct cat breeds', () => {
    const cm = makeManager();
    let i = 0;
    const seq = [0.0, 0.3, 0.6, 0.9, 0.2];
    cm.setRng(() => seq[i++ % seq.length]);

    cm.initRound([customer([2, 1]), customer([2, 1]), customer([2, 1])]);

    const types = slotsOf(cm).filter(s => s.active).map(s => s.catType);
    expect(types.length).toBe(3);
    expect(new Set(types).size).toBe(3); // no same-screen repeat
    for (const t of types) expect(CAT_TYPES as readonly string[]).toContain(t);
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

    cm.onDessertMerged(2); // first customer done (1/2)
    expect(allDone).not.toHaveBeenCalled();
    expect(roundComplete).not.toHaveBeenCalled();

    cm.onDessertMerged(3); // final customer done
    expect(served).toHaveBeenCalledTimes(2);
    expect(allDone).toHaveBeenCalledTimes(1);
    expect(roundComplete).toHaveBeenCalledTimes(1);
    // onAllCustomersDone fires before onRoundComplete (overflow disabled first).
    const allDoneOrder = allDone.mock.invocationCallOrder[0];
    const roundOrder = roundComplete.mock.invocationCallOrder[0];
    expect(allDoneOrder).toBeLessThan(roundOrder);
    expect(cm.progressLabel!.string).toBe('2/2');
  });

  it('reset() clears all active customers', () => {
    const cm = makeManager();
    cm.initRound([customer([2, 1])]);
    cm.reset();
    expect(cm.getCurrentDemands().size).toBe(0);
  });
});
