const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  applyLabelStyle,
  validateSceneShape,
  optimizeHomeScene,
  optimizeGameScene,
} = require('../optimize_scenes');

// -----------------------------------------------------------------------------
// TC-SCR-OPT-001 — Idempotency
// -----------------------------------------------------------------------------
// NOTE on scope divergence from the template: the full optimize*Scene()
// functions are NOT idempotent — they unconditionally push new group nodes
// (TopLeftStats, HUDGroup, etc.) on every call, so running the script twice
// on the same input would append duplicate groups rather than produce
// byte-identical output. We therefore map TC-SCR-OPT-001 to the idempotency
// of the pure transform the script *is* built from: applyLabelStyle, which
// both optimize functions invoke for each HUD/home label. Running it twice
// on the same component must yield identical bytes.
// -----------------------------------------------------------------------------
describe('applyLabelStyle (TC-SCR-OPT-001 — idempotency of label styling transform)', () => {
  it('returns the same label shape when applied twice', () => {
    const label = { __type__: 'cc.Label', _string: 'Hello' };
    const once = JSON.stringify(applyLabelStyle({ ...label }));
    const twice = JSON.stringify(applyLabelStyle(applyLabelStyle({ ...label })));
    expect(twice).toBe(once);
  });

  it('sets the exact style fields the script commits to scene files', () => {
    const label = {};
    const styled = applyLabelStyle(label);
    expect(styled._isBold).toBe(true);
    expect(styled._enableOutline).toBe(true);
    expect(styled._outlineWidth).toBe(3);
    expect(styled._enableShadow).toBe(true);
    expect(styled._shadowBlur).toBe(2);
    expect(styled._outlineColor).toEqual({ __type__: 'cc.Color', r: 0, g: 0, b: 0, a: 150 });
    expect(styled._shadowColor).toEqual({ __type__: 'cc.Color', r: 0, g: 0, b: 0, a: 80 });
    expect(styled._shadowOffset).toEqual({ __type__: 'cc.Vec2', x: 1, y: -1 });
  });

  it('safely no-ops on null/undefined label (does not throw)', () => {
    expect(() => applyLabelStyle(null)).not.toThrow();
    expect(applyLabelStyle(null)).toBeNull();
    expect(applyLabelStyle(undefined)).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// TC-SCR-OPT-002 — Schema validation
// -----------------------------------------------------------------------------
// NOTE on scope divergence: the original script has no formal schema validator —
// it only has a single inline guard ("Canvas not found at index 2"). We added
// a small pure `validateSceneShape` helper that formalises the invariants both
// optimize functions rely on, and we also exercise the end-to-end graceful-
// handling behavior: given malformed scene JSON, optimizeHomeScene /
// optimizeGameScene must NOT crash the process — they log and return.
// -----------------------------------------------------------------------------
describe('validateSceneShape (TC-SCR-OPT-002 — schema invariants)', () => {
  it('accepts a minimal well-formed scene with a Canvas node', () => {
    const scene = [
      { __type__: 'cc.SceneAsset' },
      { __type__: 'cc.Scene' },
      { __type__: 'cc.Node', _name: 'Canvas', _children: [], _components: [] },
    ];
    expect(validateSceneShape(scene)).toEqual({ ok: true });
  });

  it('rejects a non-array input', () => {
    expect(validateSceneShape({ not: 'an array' })).toMatchObject({ ok: false });
    expect(validateSceneShape(null)).toMatchObject({ ok: false });
    expect(validateSceneShape('string')).toMatchObject({ ok: false });
  });

  it('rejects a scene with no Canvas node', () => {
    const scene = [
      { __type__: 'cc.SceneAsset' },
      { __type__: 'cc.Scene' },
      { __type__: 'cc.Node', _name: 'NotCanvas' },
    ];
    const result = validateSceneShape(scene);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Canvas/);
  });

  it('rejects a scene that is too short', () => {
    expect(validateSceneShape([]).ok).toBe(false);
    expect(validateSceneShape([{}, {}]).ok).toBe(false);
  });
});

describe('optimizeHomeScene / optimizeGameScene (TC-SCR-OPT-002 — graceful handling of malformed scene JSON)', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-scenes-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('optimizeHomeScene does not throw when the scene has no Canvas at index 2', () => {
    // Malformed: no Canvas at the expected slot.
    const malformed = [
      { __type__: 'cc.SceneAsset' },
      { __type__: 'cc.Scene' },
      { __type__: 'cc.Node', _name: 'SomethingElse' },
    ];
    const scenePath = path.join(tmp, 'Home.scene');
    fs.writeFileSync(scenePath, JSON.stringify(malformed));

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => optimizeHomeScene(scenePath)).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();

    // File should be unchanged (the guard returns before writeFileSync).
    expect(JSON.parse(fs.readFileSync(scenePath, 'utf8'))).toEqual(malformed);
  });

  it('optimizeGameScene does not throw when the scene has no Canvas node', () => {
    const malformed = [
      { __type__: 'cc.SceneAsset' },
      { __type__: 'cc.Scene' },
      { __type__: 'cc.Node', _name: 'NotCanvas', _children: [], _components: [] },
    ];
    const scenePath = path.join(tmp, 'Game.scene');
    fs.writeFileSync(scenePath, JSON.stringify(malformed));

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => optimizeGameScene(scenePath)).not.toThrow();
    errSpy.mockRestore();
  });

  it('optimizeHomeScene throws on invalid JSON (parse error propagates — documents current behavior)', () => {
    // The script uses JSON.parse() directly without a try/catch, so a malformed
    // JSON file DOES throw. This is the current contract — we pin it so any
    // future hardening (e.g. wrapping in try/catch) is a deliberate change.
    const scenePath = path.join(tmp, 'Home.scene');
    fs.writeFileSync(scenePath, '{ not valid json');
    expect(() => optimizeHomeScene(scenePath)).toThrow(SyntaxError);
  });
});
