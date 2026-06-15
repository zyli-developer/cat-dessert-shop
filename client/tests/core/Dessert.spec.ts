/**
 * Unit tests for Dessert.takeBlockerHit — 焦糊曲奇裂纹/震碎机制。
 *
 * 只验证状态机与节点副作用（裂纹叠加层是否出现、第几次震碎），不深究 tween 视觉。
 * 用 cc mock 的真实 Node/Component，避免 stub 掉 getComponent/addComponent。
 */
import { Dessert } from '../../assets/scenes/scripts/core/Dessert';
import { BLOCKER_LEVEL, BLOCKER_HITS_TO_BREAK } from '../../assets/scenes/scripts/data/DessertConfig';
import { Node, UITransform, Sprite } from 'cc';

/** 造一个挂在容器下、带 UITransform+Sprite 的甜品节点。 */
function makeDessert(level: number): Dessert {
  const container = new Node();
  const node = new Node();
  (node as any).parent = container;
  container.children.push(node);
  const ut = node.addComponent(UITransform);
  ut.setContentSize(60, 60);
  node.addComponent(Sprite);
  const d = node.addComponent(Dessert);
  d.level = level;
  d.isMerging = false;
  return d;
}

describe('Dessert.takeBlockerHit (裂纹机制)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('普通甜品不受影响，返回 false', () => {
    const d = makeDessert(3);
    expect(d.takeBlockerHit()).toBe(false);
    jest.advanceTimersByTime(50);
    expect(d.node.getChildByName('BlockerCrack')).toBeNull();
  });

  it('焦糊曲奇第一次震击 → 裂纹（返回 false 且出现裂纹叠加层）', () => {
    const d = makeDessert(BLOCKER_LEVEL);
    expect(d.takeBlockerHit()).toBe(false);
    jest.advanceTimersByTime(50);
    expect(d.node.getChildByName('BlockerCrack')).not.toBeNull();
  });

  it(`第 ${BLOCKER_HITS_TO_BREAK} 次震击 → 震碎（返回 true）`, () => {
    const d = makeDessert(BLOCKER_LEVEL);
    let shattered = false;
    for (let i = 0; i < BLOCKER_HITS_TO_BREAK; i++) {
      shattered = d.takeBlockerHit();
      jest.advanceTimersByTime(50);
    }
    expect(shattered).toBe(true);
  });

  it('震碎后再次震击不再重复触发（返回 false）', () => {
    const d = makeDessert(BLOCKER_LEVEL);
    for (let i = 0; i < BLOCKER_HITS_TO_BREAK; i++) d.takeBlockerHit();
    jest.advanceTimersByTime(50);
    expect(d.takeBlockerHit()).toBe(false);
  });
});
