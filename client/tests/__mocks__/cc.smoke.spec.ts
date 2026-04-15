import { Vec3, tween, Node, _decorator, Color, Component, EventTarget } from 'cc';

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
    const p = new Node();
    const c = new Node();
    p.addChild(c);
    expect(p.children).toContain(c);
    c.removeFromParent();
    expect(p.children).not.toContain(c);
  });

  it('_decorator.ccclass is a no-op', () => {
    @_decorator.ccclass('X')
    class X { value = 42; }
    expect(new X().value).toBe(42);
  });

  it('Color construction', () => {
    const c = new Color(100, 150, 200, 255);
    expect(c).toMatchObject({ r: 100, g: 150, b: 200, a: 255 });
  });

  it('Component lifecycle methods are optional', () => {
    class MyComp extends Component {}
    const m = new MyComp();
    expect(m).toBeInstanceOf(Component);
  });

  it('EventTarget works for pub/sub', () => {
    const e = new EventTarget();
    const fn = jest.fn();
    e.on('foo', fn);
    e.emit('foo', 42);
    expect(fn).toHaveBeenCalledWith(42);
  });
});
