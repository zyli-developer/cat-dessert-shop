// Patch the UI-kit sprite metas: set 9-slice border insets and disable trim
// (so borders are measured against the full raw image). Reads ui-kit.borders.json
// written by generate_ui_kit.mjs. Run, then refresh/reimport in Cocos.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = path.join(root, 'client/assets/resources/textures/ui');
const borders = JSON.parse(await readFile(path.join(root, 'scripts/ui-kit.borders.json'), 'utf8'));

for (const [name, b] of Object.entries(borders)) {
    const metaPath = path.join(uiDir, `${name}.png.meta`);
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    const sf = meta.subMetas?.['f9941']?.userData;
    if (!sf) { console.log(`!! ${name}: no spriteFrame submeta, skip`); continue; }

    // disable trim → full-image borders
    sf.trimType = 'none';
    sf.trimThreshold = 1;
    sf.trimX = 0;
    sf.trimY = 0;
    sf.width = sf.rawWidth;
    sf.height = sf.rawHeight;
    sf.borderLeft = b.l;
    sf.borderRight = b.r;
    sf.borderTop = b.t;
    sf.borderBottom = b.b;

    // rebuild vertices for the un-trimmed rect so editor preview matches
    const hw = sf.rawWidth / 2, hh = sf.rawHeight / 2;
    if (sf.vertices) {
        sf.vertices.rawPosition = [-hw, -hh, 0, hw, -hh, 0, -hw, hh, 0, hw, hh, 0];
        sf.vertices.uv = [0, sf.rawHeight, sf.rawWidth, sf.rawHeight, 0, 0, sf.rawWidth, 0];
        sf.vertices.nuv = [0, 0, 1, 0, 0, 1, 1, 1];
        sf.vertices.minPos = [-hw, -hh, 0];
        sf.vertices.maxPos = [hw, hh, 0];
    }
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
    console.log(`  patched ${name}: border L${b.l} R${b.r} T${b.t} B${b.b}, trim off`);
}
console.log('\nDone. Reimport in Cocos to apply.');
