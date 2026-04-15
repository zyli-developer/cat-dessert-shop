// Hand-written stub for the `cc` module.
// Surface updated when production code adds new imports; keep this list in sync.
// Covered surface as of initial write:
//   _decorator, AudioClip, AudioSource, BlockInputEvents, BoxCollider2D, Button,
//   Camera, Canvas, CircleCollider2D, Collider2D, Color, Component,
//   Contact2DType, director, ERigidBody2DType, EventKeyboard, EventTarget,
//   EventTouch, find, Font, game, Graphics, Input, input, instantiate,
//   IPhysics2DContact, JsonAsset, KeyCode, Label, Layers, Layout, macro, Node,
//   PhysicsSystem2D, Prefab, RigidBody2D, resources, Size, Sprite,
//   SpriteFrame, sys, Toggle, tween, UIOpacity, UITransform, Vec2,
//   Vec3, view

import { EventEmitter } from 'events';

export class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  add(v: Vec3) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: Vec3) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  clone() { return new Vec3(this.x, this.y, this.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; return this; }
  equals(v: Vec3) { return this.x === v.x && this.y === v.y && this.z === v.z; }
  static lerp(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  }
}

export class Vec2 {
  constructor(public x = 0, public y = 0) {}
  add(v: Vec2) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v: Vec2) { return new Vec2(this.x - v.x, this.y - v.y); }
  clone() { return new Vec2(this.x, this.y); }
  length() { return Math.hypot(this.x, this.y); }
}

export class Color {
  constructor(public r = 255, public g = 255, public b = 255, public a = 255) {}
  static fromHEX(hex: string) { return new Color(); }
  clone() { return new Color(this.r, this.g, this.b, this.a); }
}

export class Size {
  constructor(public width = 0, public height = 0) {}
}

export class Node {
  static EventType = {
    TOUCH_START: 'touch-start',
    TOUCH_MOVE: 'touch-move',
    TOUCH_END: 'touch-end',
    TOUCH_CANCEL: 'touch-cancel',
    MOUSE_DOWN: 'mouse-down',
    MOUSE_UP: 'mouse-up',
    MOUSE_MOVE: 'mouse-move',
    TRANSFORM_CHANGED: 'transform-changed',
    ACTIVE_IN_HIERARCHY_CHANGED: 'active-in-hierarchy-changed',
  };
  name = '';
  constructor(name = '') { this.name = name; }
  active = true;
  position = new Vec3();
  scale = new Vec3(1, 1, 1);
  private _parent: Node | null = null;
  get parent(): Node | null { return this._parent; }
  set parent(p: Node | null) {
    if (this._parent === p) return;
    if (this._parent) {
      this._parent.children = this._parent.children.filter(n => n !== this);
    }
    this._parent = p;
    if (p) p.children.push(this);
  }
  children: Node[] = [];
  private _components: Component[] = [];
  private _emitter = new EventEmitter();

  addChild(c: Node) {
    c.parent = this; // setter handles children array
  }
  removeFromParent() {
    this.parent = null;
  }
  destroy() { this.removeFromParent(); }
  destroyAllChildren() {
    for (const child of [...this.children]) child.destroy();
  }
  getComponent<T>(ctor: new () => T): T | null {
    return (this._components.find(c => c instanceof (ctor as any)) as any) ?? null;
  }
  getComponentsInChildren<T>(ctor: new () => T): T[] {
    const out: T[] = [];
    const walk = (n: Node) => {
      for (const c of n._components) {
        if (c instanceof (ctor as any)) out.push(c as any);
      }
      for (const child of n.children) walk(child);
    };
    walk(this);
    return out;
  }
  addComponent<T extends Component>(ctor: new () => T): T {
    const c = new ctor();
    (c as any).node = this;
    this._components.push(c);
    return c;
  }
  isValid = true;
  getChildByName(name: string): Node | null {
    return this.children.find(n => n.name === name) ?? null;
  }
  private _bindings = new Map<Function, Map<any, Function>>();
  on(e: string, fn: (...args: any[]) => void, target?: any) {
    let bound: Function = fn;
    if (target) {
      let byTarget = this._bindings.get(fn);
      if (!byTarget) { byTarget = new Map(); this._bindings.set(fn, byTarget); }
      if (!byTarget.has(target)) byTarget.set(target, fn.bind(target));
      bound = byTarget.get(target)!;
    }
    this._emitter.on(e, bound as any);
  }
  off(e: string, fn: (...args: any[]) => void, target?: any) {
    let bound: Function = fn;
    if (target) bound = this._bindings.get(fn)?.get(target) ?? fn;
    this._emitter.off(e, bound as any);
  }
  emit(e: string, ...args: any[]) {
    this._emitter.emit(e, ...args);
  }
  setScale(x: number | Vec3, y?: number, z?: number) {
    if (x instanceof Vec3) { this.scale = x.clone(); }
    else { this.scale.set(x, y ?? x, z ?? 1); }
  }
  setPosition(x: number | Vec3, y?: number, z?: number) {
    if (x instanceof Vec3) { this.position = x.clone(); }
    else { this.position.set(x, y ?? 0, z ?? 0); }
  }
  getPosition() { return this.position.clone(); }
}

export class Component {
  node: Node = new Node();
  enabled = true;
  schedule = jest.fn();
  unschedule = jest.fn();
  scheduleOnce = jest.fn();
  onLoad?(): void;
  onEnable?(): void;
  start?(): void;
  update?(dt: number): void;
  lateUpdate?(dt: number): void;
  onDestroy?(): void;
  onDisable?(): void;
}

export class Label extends Component { string = ''; fontSize = 20; color = new Color(); font: any = null; }
export class Sprite extends Component { spriteFrame: any = null; color = new Color(); }
export class UITransform extends Component {
  contentSize = new Size();
  width = 0;
  height = 0;
  setContentSize(w: number | Size, h?: number) {
    if (w instanceof Size) { this.contentSize = w; this.width = w.width; this.height = w.height; }
    else { this.contentSize.width = w; this.contentSize.height = h ?? 0; this.width = w; this.height = h ?? 0; }
  }
  convertToNodeSpaceAR(v: Vec3) { return new Vec3(v.x, v.y, v.z); }
  convertToWorldSpaceAR(v: Vec3) { return new Vec3(v.x, v.y, v.z); }
}
export class Layout extends Component {}
export class Button extends Component {
  interactable = true;
  clickEvents: any[] = [];
}
export class Toggle extends Component {
  isChecked = false;
}

export class Prefab {}
export class SpriteFrame {}
export class Font {}
export class JsonAsset { json: any = null; }
export class AudioClip {}
export class AudioSource extends Component {
  clip: AudioClip | null = null;
  loop = false;
  volume = 1;
  play = jest.fn();
  pause = jest.fn();
  stop = jest.fn();
  playOneShot = jest.fn();
}
export class RigidBody2D extends Component {
  linearVelocity = new Vec2();
  type = 0;
  applyForce = jest.fn();
  applyLinearImpulse = jest.fn();
  applyLinearImpulseToCenter = jest.fn();
  wakeUp = jest.fn();
}
export class Collider2D extends Component {
  private _emitter = new EventEmitter();
  tag = 0;
  on(e: string, fn: (...args: any[]) => void, _target?: any) {
    this._emitter.on(e, fn);
    return this;
  }
  off(e: string, fn: (...args: any[]) => void, _target?: any) {
    this._emitter.off(e, fn);
    return this;
  }
  emit(e: string, ...args: any[]) {
    this._emitter.emit(e, ...args);
  }
}
export class BoxCollider2D extends Collider2D {
  size = new Size();
  offset = new Vec2();
  apply = jest.fn();
}
export class CircleCollider2D extends Collider2D {
  radius = 0;
  apply = jest.fn();
}
export class Graphics extends Component {
  lineWidth = 1;
  strokeColor = new Color();
  fillColor = new Color();
  clear = jest.fn();
  moveTo = jest.fn();
  lineTo = jest.fn();
  rect = jest.fn();
  circle = jest.fn();
  stroke = jest.fn();
  fill = jest.fn();
  close = jest.fn();
}
export class UIOpacity extends Component {
  opacity = 255;
}
export class BlockInputEvents extends Component {}
export class PhysicsSystem2D {
  private static _inst: PhysicsSystem2D | null = null;
  static get instance(): PhysicsSystem2D {
    return (this._inst ??= new PhysicsSystem2D());
  }
  gravity = new Vec2(0, -320);
  enable = true;
}

export const ERigidBody2DType = {
  Static: 0,
  Kinematic: 1,
  Dynamic: 2,
  Animated: 3,
};

export const Layers = {
  Enum: {
    NONE: 0,
    IGNORE_RAYCAST: 1 << 20,
    GIZMOS: 1 << 21,
    EDITOR: 1 << 22,
    UI_3D: 1 << 23,
    SCENE_GIZMO: 1 << 24,
    UI_2D: 1 << 25,
    PROFILER: 1 << 28,
    DEFAULT: 1 << 30,
    ALL: 0xffffffff,
  },
  BitMask: {
    NONE: 0,
    IGNORE_RAYCAST: 1 << 20,
    GIZMOS: 1 << 21,
    EDITOR: 1 << 22,
    UI_3D: 1 << 23,
    SCENE_GIZMO: 1 << 24,
    UI_2D: 1 << 25,
    PROFILER: 1 << 28,
    DEFAULT: 1 << 30,
    ALL: 0xffffffff,
  },
};

export const macro = {
  REPEAT_FOREVER: Number.MAX_VALUE - 1,
  KEY: {},
  ENABLE_TRANSPARENT_CANVAS: false,
  ENABLE_WEBGL_ANTIALIAS: true,
};

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
  stop: () => TweenChain;
  union: () => TweenChain;
  repeat: (...a: any[]) => TweenChain;
  repeatForever: () => TweenChain;
  sequence: (...a: any[]) => TweenChain;
  parallel: (...a: any[]) => TweenChain;
  target: (t: any) => TweenChain;
};

export function tween<T>(_target?: T): TweenChain {
  let queued: Array<() => void> = [];
  const chain: TweenChain = {
    to: () => chain,
    by: () => chain,
    delay: () => chain,
    call: (cb) => { queued.push(cb); return chain; },
    start: () => {
      const run = () => { const q = queued; queued = []; for (const fn of q) fn(); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else run();
      return chain;
    },
    stop: () => { queued = []; return chain; },
    union: () => chain,
    repeat: () => chain,
    repeatForever: () => chain,
    sequence: () => chain,
    parallel: () => chain,
    target: () => chain,
  };
  return chain;
}

export const director = {
  getScene: jest.fn(() => new Node()),
  loadScene: jest.fn((_name: string, cb?: Function) => cb?.()),
  preloadScene: jest.fn((_name: string, cb?: Function) => cb?.()),
  on: jest.fn(),
  off: jest.fn(),
  getDeltaTime: () => 0.016,
  pause: jest.fn(),
  resume: jest.fn(),
  EVENT_BEFORE_SCENE_LOADING: 'director_before_scene_loading',
  EVENT_AFTER_SCENE_LAUNCH: 'director_after_scene_launch',
};

export const resources = {
  load: jest.fn((_p: string, _typeOrCb?: any, cb?: Function) => {
    if (typeof _typeOrCb === 'function') _typeOrCb(null, {});
    else if (cb) cb(null, {});
  }),
  loadDir: jest.fn((_p: string, cb?: Function) => cb?.(null, [])),
  release: jest.fn(),
  releaseAll: jest.fn(),
  get: jest.fn(),
};

export const sys = {
  platform: 'unknown',
  isBrowser: true,
  localStorage: {
    getItem: (k: string) => (globalThis as any).localStorage?.getItem?.(k) ?? null,
    setItem: (k: string, v: string) => (globalThis as any).localStorage?.setItem?.(k, v),
    removeItem: (k: string) => (globalThis as any).localStorage?.removeItem?.(k),
  },
  OS: { ANDROID: 'android', IOS: 'ios', WINDOWS: 'windows' },
  Platform: { BYTEDANCE_MINI_GAME: 'bytedance-mini-game' },
};

export const find = jest.fn((_name: string) => new Node());

export const _decorator = {
  ccclass: (_name?: string) => <T>(cls: T) => cls,
  property: (_arg?: any) => (_t: any, _k: string) => {},
  executeInEditMode: <T>(cls: T) => cls,
  menu: (_m: string) => <T>(cls: T) => cls,
  requireComponent: (_c: any) => <T>(cls: T) => cls,
  disallowMultiple: <T>(cls: T) => cls,
  playOnFocus: <T>(cls: T) => cls,
  executionOrder: (_n: number) => <T>(cls: T) => cls,
};

export class EventTarget extends EventEmitter {
  private _bindings = new Map<Function, Map<any, Function>>();
  emit(e: string, ...a: any[]): boolean { super.emit(e, ...a); return true; }
  on(e: string, fn: (...args: any[]) => void, target?: any): this {
    let bound: Function = fn;
    if (target) {
      let byTarget = this._bindings.get(fn);
      if (!byTarget) { byTarget = new Map(); this._bindings.set(fn, byTarget); }
      if (!byTarget.has(target)) byTarget.set(target, fn.bind(target));
      bound = byTarget.get(target)!;
    }
    super.on(e, bound as any);
    return this;
  }
  off(e: string, fn: (...args: any[]) => void, target?: any): this {
    let bound: Function = fn;
    if (target) bound = this._bindings.get(fn)?.get(target) ?? fn;
    super.off(e, bound as any);
    return this;
  }
  targetOff = jest.fn();
}

export const view = {
  getVisibleSize: () => ({ width: 720, height: 1280 }),
  setResolutionPolicy: jest.fn(),
};

export const Input = {
  EventType: {
    TOUCH_START: 'touch-start',
    TOUCH_MOVE: 'touch-move',
    TOUCH_END: 'touch-end',
    TOUCH_CANCEL: 'touch-cancel',
    MOUSE_DOWN: 'mouse-down',
    MOUSE_UP: 'mouse-up',
    MOUSE_MOVE: 'mouse-move',
    KEY_DOWN: 'key-down',
    KEY_UP: 'key-up',
  },
};

export const input = {
  on: jest.fn(),
  off: jest.fn(),
};

export class EventTouch {
  _uiLocation = new Vec2();
  constructor(x = 0, y = 0) { this._uiLocation = new Vec2(x, y); }
  getLocation() { return this._uiLocation.clone(); }
  getLocationX() { return this._uiLocation.x; }
  getLocationY() { return this._uiLocation.y; }
  getUILocation() { return this._uiLocation.clone(); }
}
export class EventKeyboard { keyCode = 0; }

export const KeyCode = {
  SPACE: 32, ENTER: 13, ESCAPE: 27,
  ARROW_LEFT: 37, ARROW_UP: 38, ARROW_RIGHT: 39, ARROW_DOWN: 40,
};

export const Contact2DType = {
  BEGIN_CONTACT: 'begin-contact',
  END_CONTACT: 'end-contact',
  PRE_SOLVE: 'pre-solve',
  POST_SOLVE: 'post-solve',
};

export class IPhysics2DContact {
  getWorldManifold() { return { normal: new Vec2(), points: [] }; }
}

export const game = {
  EVENT_SHOW: 'game-show',
  EVENT_HIDE: 'game-hide',
  on: jest.fn(),
  off: jest.fn(),
};

export class Canvas extends Component {}
export class Camera extends Component {}
