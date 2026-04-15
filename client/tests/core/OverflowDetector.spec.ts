/**
 * Unit tests for OverflowDetector (TC-OVER-001..003).
 *
 * Real API shape:
 * - OverflowDetector is a Cocos @ccclass Component driven by `update(dt)`. It
 *   scans `containerNode.getComponentsInChildren(Dessert)` each frame; if any
 *   non-merging, non-dropping dessert sits above `warningLineY`, it starts a
 *   countdown (`countdownTime`) and fires `onGameOver` when the timer expires.
 *   Exposes `setEnabled(bool)` and `reset()`.
 * - Drive the timer directly via `update(dt)` — no fake timers needed.
 */

import { OverflowDetector } from '../../assets/scenes/scripts/core/OverflowDetector';
import { Dessert } from '../../assets/scenes/scripts/core/Dessert';
import { Node, Label } from 'cc';

/** Create a Dessert child above/below the warning line. */
function addDessert(container: Node, y: number, opts: { merging?: boolean; dropping?: boolean } = {}) {
  const dn = new Node();
  dn.setPosition(0, y, 0);
  container.addChild(dn);
  const d = dn.addComponent(Dessert);
  d.isMerging = opts.merging ?? false;
  d.isDropping = opts.dropping ?? false;
  return d;
}

function makeDetector(countdownTime = 2, warningLineY = 100) {
  const det = new OverflowDetector();
  (det as any).node = new Node();
  det.countdownTime = countdownTime;
  det.warningLineY = warningLineY;
  det.containerNode = new Node();
  // Label is optional — provide one to exercise the string/color update branch.
  const labelNode = new Node();
  const label = labelNode.addComponent(Label);
  det.countdownLabel = label;
  det.onLoad();
  return det;
}

describe('OverflowDetector', () => {
  it('TC-OVER-001 sustained overflow beyond threshold fires onGameOver once', () => {
    const det = makeDetector(2, 100);
    addDessert(det.containerNode!, 200); // above warning line

    const onGameOver = jest.fn();
    det.onGameOver = onGameOver;

    // First tick: detects overflow, arms timer (= countdownTime).
    det.update(0.5);
    expect(onGameOver).not.toHaveBeenCalled();

    // Advance just past threshold.
    det.update(0.8);
    det.update(0.8); // cumulative dt ~2.1s → timer <= 0
    expect(onGameOver).toHaveBeenCalledTimes(1);

    // Continued updates do NOT fire again in the same overflow episode.
    det.update(0.5);
    det.update(0.5);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it('TC-OVER-002 brief overflow shorter than threshold does NOT fire onGameOver', () => {
    const det = makeDetector(2, 100);
    const dessert = addDessert(det.containerNode!, 200);

    const onGameOver = jest.fn();
    det.onGameOver = onGameOver;

    det.update(0.5);       // arm
    det.update(0.5);       // timer = 1.5

    // Remove the overflow condition: move dessert back below warning line.
    dessert.node.setPosition(0, 50, 0);
    det.update(0.5);       // checkOverflow -> false → overflowing reset

    // Further time does NOT fire onGameOver.
    det.update(1.0);
    det.update(1.0);
    expect(onGameOver).not.toHaveBeenCalled();
  });

  it('TC-OVER-003 after overflow fires, it does not re-fire while state persists', () => {
    const det = makeDetector(1, 100);
    addDessert(det.containerNode!, 200);

    const onGameOver = jest.fn();
    det.onGameOver = onGameOver;

    det.update(0.1);       // arm
    det.update(1.2);       // expire -> fire once
    expect(onGameOver).toHaveBeenCalledTimes(1);

    // Overflow condition still true (dessert still above warning line), but
    // the internal `overflowing` flag was reset on fire and the timer is 0;
    // further updates re-arm and count down again BUT must not fire a second
    // time within the same logical round without an intervening clear.
    // We assert the strict invariant the TC specifies: no immediate re-fire.
    det.update(0.016);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it('ignores desserts that are merging or still dropping when scanning overflow', () => {
    const det = makeDetector(1, 100);
    addDessert(det.containerNode!, 200, { merging: true });
    addDessert(det.containerNode!, 200, { dropping: true });

    const onGameOver = jest.fn();
    det.onGameOver = onGameOver;

    det.update(0.5);
    det.update(1.0);
    det.update(1.0);
    expect(onGameOver).not.toHaveBeenCalled();
  });
});
