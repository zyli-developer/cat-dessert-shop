import { Camera, EventTouch, UITransform, Vec3, director } from 'cc';

let _cam: Camera | null = null;

/** 渲染 UI 的相机（Canvas 下），跨场景缓存失效自动重查。 */
function uiCamera(): Camera | null {
    if (_cam && _cam.isValid && _cam.node?.isValid) return _cam;
    const canvas = director.getScene()?.getChildByName('Canvas');
    _cam = canvas?.getComponentInChildren(Camera) ?? null;
    return _cam;
}

/**
 * 触摸点 → 目标节点本地坐标（锚点系）。
 * 优先走「屏幕像素 → 同一渲染相机 screenToWorld → 节点本地」：与画面显示严格同源，
 * 杜绝小游戏适配层 getUILocation 在 letterbox / DPR 下与渲染投影不一致造成的整体偏移。
 * 拿不到相机（如单测环境）时回退 getUILocation。
 */
export function touchToNodeLocal(event: EventTouch, transform: UITransform): Vec3 {
    const cam = uiCamera();
    if (cam) {
        const sp = event.getLocation();
        const world = cam.screenToWorld(new Vec3(sp.x, sp.y, 0));
        return transform.convertToNodeSpaceAR(world);
    }
    const ui = event.getUILocation();
    return transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
}
