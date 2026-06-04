// Patch object-valued node props that the Cocos MCP bridge mangles
// (UITransform contentSize, node scale/position, Sprite sizeMode/type).
// Cocos .scene/.prefab are JSON arrays; each node carries its editor UUID as `_id`.
//
// Usage: node scripts/patch_scene_nodes.mjs <sceneFile> <editsJsonFile>
//   edits = [{ id, contentSize:{width,height}, scale:{x,y,z}|n, pos:{x,y}, sizeMode, type }]
// After running, reopen the scene in Cocos so the editor reloads from disk.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [sceneFile, editsFile] = process.argv.slice(2);
if (!sceneFile || !editsFile) { console.error('args: <sceneFile> <editsJsonFile>'); process.exit(1); }

const root = path.resolve(sceneFile);
const arr = JSON.parse(await readFile(root, 'utf8'));
const edits = JSON.parse(await readFile(path.resolve(editsFile), 'utf8'));

const byId = new Map();
arr.forEach((o, i) => { if (o && o.__type__ === 'cc.Node' && o._id) byId.set(o._id, { o, i }); });

const compOf = (node, type) => {
    for (const ref of node._components || []) {
        const c = arr[ref.__id__];
        if (c && c.__type__ === type) return c;
    }
    return null;
};

let n = 0;
for (const e of edits) {
    const hit = byId.get(e.id);
    if (!hit) { console.log(`!! node ${e.id} not found`); continue; }
    const node = hit.o;
    if (e.contentSize) {
        const ut = compOf(node, 'cc.UITransform');
        if (ut) { ut._contentSize.width = e.contentSize.width; ut._contentSize.height = e.contentSize.height; }
        else console.log(`!! ${e.id} has no UITransform`);
    }
    if (e.anchor) {
        const ut = compOf(node, 'cc.UITransform');
        if (ut) { if (e.anchor.x !== undefined) ut._anchorPoint.x = e.anchor.x; if (e.anchor.y !== undefined) ut._anchorPoint.y = e.anchor.y; }
        else console.log(`!! ${e.id} has no UITransform`);
    }
    if (e.scale !== undefined) {
        const s = typeof e.scale === 'number' ? { x: e.scale, y: e.scale, z: 1 } : e.scale;
        node._lscale.x = s.x; node._lscale.y = s.y; node._lscale.z = s.z ?? 1;
    }
    if (e.pos) { node._lpos.x = e.pos.x; node._lpos.y = e.pos.y; if (e.pos.z !== undefined) node._lpos.z = e.pos.z; }
    if (e.noOutline) {
        const lb = compOf(node, 'cc.Label');
        if (lb) lb._enableOutline = false;
        else console.log(`!! ${e.id} has no Label`);
    }
    if (e.sizeMode !== undefined || e.type !== undefined) {
        const sp = compOf(node, 'cc.Sprite');
        if (sp) {
            if (e.sizeMode !== undefined) sp._sizeMode = e.sizeMode;
            if (e.type !== undefined) sp._type = e.type;
        } else console.log(`!! ${e.id} has no Sprite`);
    }
    n++;
    console.log(`  patched ${node._name} (${e.id})`);
}
await writeFile(root, JSON.stringify(arr, null, 2));
console.log(`\nPatched ${n}/${edits.length} nodes in ${path.basename(root)}. Reopen scene in Cocos.`);
