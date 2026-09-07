/**
 * Unit tests for Container (TC-CONT-001..002).
 *
 * Real API shape:
 * - Container is a physics/wall setup @ccclass Component. Its public surface is
 *   `getLeftBound()`, `getRightBound()`, `getWarningLineY()`, the `warningLineY`
 *   getter, and the static `Container.getPhysicsParams()`. `onLoad()` enables
 *   `PhysicsSystem2D`, spawns three static-wall child Nodes, and draws a
 *   warning line via Graphics.
 * - There is NO `getOccupiedHeight()` and NO `clear()` method in production.
 *   Desserts live as children of the container node (added by MergeManager),
 *   and lifecycle is driven through `node.destroy()` / parent swaps, not a
 *   container API. TC-CONT-001/002 are therefore adapted to what the class
 *   actually exposes:
 *     - TC-CONT-001: bounds/warning-line geometry scales monotonically with
 *       containerWidth/Height (the real monotonic invariant in this class).
 *     - TC-CONT-002: onLoad provisions exactly the expected wall + warning-line
 *       children and the dessert-tracking child set is empty until populated
 *       externally — i.e. the container starts "clear".
 *
 * Product-gap follow-ups:
 * - If T2 expects first-class `getOccupiedHeight()` / `clear()` on Container,
 *   those need to be added to production code before they can be asserted.
 *   Logged as a product gap; not blocking this unit-test pass.
 */

import { Container } from '../../assets/scenes/scripts/core/Container';
import { Node } from 'cc';

function makeContainer(w = 400, h = 600): Container {
  const node = new Node();
  const c = node.addComponent(Container);
  c.containerWidth = w;
  c.containerHeight = h;
  c.wallThickness = 20;
  return c;
}

describe('Container', () => {
  it('TC-CONT-001 bounds and warning-line geometry scale monotonically with containerWidth/Height', () => {
    const small = makeContainer(200, 300);
    const large = makeContainer(600, 900);

    // Left bound is the negative half-width; right bound is the positive half-width.
    expect(small.getLeftBound()).toBe(-100);
    expect(small.getRightBound()).toBe(100);
    expect(large.getLeftBound()).toBe(-300);
    expect(large.getRightBound()).toBe(300);

    // Monotonicity: larger container -> warning line further from origin.
    expect(large.getWarningLineY()).toBeGreaterThan(small.getWarningLineY());

    // Warning line lives 10% below the top edge: y = H/2 - H*0.1 = 0.4 * H.
    expect(small.getWarningLineY()).toBeCloseTo(0.4 * 300, 5);
    expect(large.getWarningLineY()).toBeCloseTo(0.4 * 900, 5);
  });

  it('TC-CONT-002 onLoad wires walls + warning-line and starts with no dessert children', () => {
    const c = makeContainer(400, 600);
    c.onLoad();

    const names = c.node.children.map(n => n.name).sort();
    // Cup body + three static walls + warning line + its「警戒线」tag.
    expect(names).toEqual(['bottom', 'cupBody', 'left', 'right', 'warningLine', 'warningTag']);

    // Container is "clear" to start: no dessert child is present (MergeManager
    // is responsible for adding them later).
    const staticChildren = ['bottom', 'cupBody', 'left', 'right', 'warningLine', 'warningTag'];
    const dessertChildren = c.node.children.filter(n => !staticChildren.includes(n.name));
    expect(dessertChildren).toHaveLength(0);

    // Physics params exposed by the static accessor are stable.
    const p = Container.getPhysicsParams();
    expect(p.restitution).toBeGreaterThanOrEqual(0);
    expect(p.friction).toBeGreaterThanOrEqual(0);
    expect(p.linearDamping).toBeGreaterThanOrEqual(0);
  });
});
