// Rasterize the warm line-icon SVG set (docs/ui-mockup/icons-export/svg/*.svg)
// into PNGs under client/assets/resources/textures/ui/ for the Cocos UI revamp.
// Output @192px (crisp on 2x screens; UI scales down without blur).
import sharp from 'sharp';
import { readdir, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'docs/ui-mockup/icons-export/svg');
const outDir = path.join(root, 'client/assets/resources/textures/ui');
const SIZE = 192;

await mkdir(outDir, { recursive: true });
const files = (await readdir(srcDir)).filter((f) => f.endsWith('.svg'));
let n = 0;
for (const f of files) {
    const svg = await readFile(path.join(srcDir, f));
    const out = path.join(outDir, f.replace(/\.svg$/, '.png'));
    await sharp(svg, { density: 384 })
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out);
    n++;
    console.log(`  ${f} -> ${path.basename(out)} (${SIZE}px)`);
}
console.log(`\nExported ${n} icons to ${path.relative(root, outDir)}`);
