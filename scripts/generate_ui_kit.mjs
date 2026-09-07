// Generate the baked UI sprite kit (cards / jelly buttons / chips / tool bases /
// circle buttons / toggles / warning dash) as 9-slice-ready PNGs for the Cocos
// UI revamp. Colors come from docs/ui-mockup/cocos-mapping.md §1.
//
// Output: client/assets/resources/textures/ui/<name>.png  (@2x)
// Also writes ui-kit.borders.json (per-sprite 9-slice border insets, in OUTPUT px)
// which the meta-patcher reads to mark sprites as SLICED.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'client/assets/resources/textures/ui');
await mkdir(outDir, { recursive: true });

const C = {
    paper2: '#FFFDF8', line2: '#DCC197', line: '#ECDABF',
    sand: '#F6E8D0', sand2: '#F0DBBB',
    ink: '#5A4636', inkMute: '#B59C80',
    pink: '#F5879B', pinkHi: '#FF9DB0', pinkDp: '#D9596F', pinkSf: '#FFE6EB',
    butter: '#F7C156', butterHi: '#FCD37E', butterDp: '#DA9B30',
    mint: '#8AD2AE', mintHi: '#A6E2C6', mintDp: '#56AE88',
    ghost: '#FFFDF8', ghostDp: '#E4D2B5',
};
const S = 2; // export scale

/** A jelly-pill SVG: face (vertical hi->base gradient) + 8px dark thick bottom. */
function jelly(name, hi, base, dp) {
    const w = 160, faceH = 92, thick = 8, h = faceH + thick, r = faceH / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${base}"/>
  </linearGradient></defs>
  <rect x="2" y="${thick}" width="${w - 4}" height="${faceH}" rx="${r}" fill="${dp}"/>
  <rect x="2" y="0" width="${w - 4}" height="${faceH}" rx="${r}" fill="url(#g)"/>
  <rect x="14" y="6" width="${w - 28}" height="${faceH * 0.4}" rx="${faceH * 0.2}" fill="#ffffff" opacity="0.28"/>
</svg>`;
    // horizontal-only 9-slice: caps fixed, middle stretches; vertical kept 1:1
    return { name, svg, border: { l: r * S, r: r * S, t: 0, b: 0 } };
}

/** Rounded card / panel, uniform 9-slice. */
function card(name, fill, stroke, sw, radius, pad = 0) {
    const sz = 96, r = radius;
    const inset = sw / 2 + pad;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz * S}" height="${sz * S}" viewBox="0 0 ${sz} ${sz}">
  <rect x="${inset}" y="${inset}" width="${sz - inset * 2}" height="${sz - inset * 2}" rx="${r}"
        fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${sw}"` : ''}/>
</svg>`;
    const b = (r + 4) * S;
    return { name, svg, border: { l: b, r: b, t: b, b } };
}

/** Small pill chip (price / coin). */
function chip(name, fill, stroke) {
    const w = 80, h = 44, r = h / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}" viewBox="0 0 ${w} ${h}">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${r - 2}" fill="${fill}"
        ${stroke ? `stroke="${stroke}" stroke-width="2"` : ''}/>
</svg>`;
    return { name, svg, border: { l: r * S, r: r * S, t: 0, b: 0 } };
}

/** White circle icon-button base (simple, no slice). */
function circle(name, fill, stroke, sw) {
    const sz = 72, r = sz / 2 - sw;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz * S}" height="${sz * S}" viewBox="0 0 ${sz} ${sz}">
  <circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
</svg>`;
    return { name, svg, border: null };
}

/** Toggle pill (on=mint / off=sand) with white knob. */
function toggle(name, track, knobX) {
    const w = 84, h = 46, r = h / 2, kr = (h - 10) / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}" viewBox="0 0 ${w} ${h}">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${r - 1}" fill="${track}"/>
  <circle cx="${knobX}" cy="${h / 2}" r="${kr}" fill="#FFFFFF"/>
</svg>`;
    return { name, svg, border: null };
}

/** Wide dashed warning line (warm red), tiled/simple. */
function warnDash() {
    const w = 240, h = 8, seg = 22, gap = 12;
    let rects = '';
    for (let x = 0; x < w; x += seg + gap) {
        rects += `<rect x="${x}" y="2" width="${seg}" height="4" rx="2" fill="${C.pinkDp}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}" viewBox="0 0 ${w} ${h}">${rects}</svg>`;
    return { name: 'warn_dash', svg, border: { l: 0, r: 0, t: 0, b: 0 } };
}

/** Cup-shaped container frame (rounded, open top, soft sand fill + warm rim). */
function containerCup() {
    const w = 200, h = 300, r = 28, sw = 5;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}" viewBox="0 0 ${w} ${h}">
  <rect x="${sw}" y="${sw}" width="${w - sw * 2}" height="${h - sw * 2}" rx="${r}"
        fill="${C.paper2}" fill-opacity="0.55" stroke="${C.line2}" stroke-width="${sw}"/>
  <rect x="${sw + 6}" y="${sw + 6}" width="${w - sw * 2 - 12}" height="${h - sw * 2 - 12}" rx="${r - 4}"
        fill="none" stroke="${C.line}" stroke-width="2" opacity="0.7"/>
</svg>`;
    const b = (r + 8) * S;
    return { name: 'container_cup', svg, border: { l: b, r: b, t: b, b } };
}

const sprites = [
    jelly('jelly_primary', C.pinkHi, C.pink, C.pinkDp),
    jelly('jelly_butter', C.butterHi, C.butter, C.butterDp),
    jelly('jelly_mint', C.mintHi, C.mint, C.mintDp),
    jelly('jelly_ghost', C.ghost, C.ghost, C.ghostDp),
    card('card_ivory', C.paper2, C.line2, 3, 24),
    card('panel_sand', C.sand, C.sand2, 3, 20),
    card('panel_sand2', C.sand2, C.line2, 2, 16),
    card('toolbase_sand', C.paper2, C.sand2, 3, 24),
    card('chipbg_pink', C.pinkSf, undefined, 0, 18),
    chip('chip_butter', C.butterHi, C.butterDp),
    chip('chip_pink', C.pinkSf, C.pink),
    circle('circle_white', C.paper2, C.ink, 2.4),
    circle('circle_sand', C.sand, C.line2, 3),
    toggle('toggle_on', C.mint, 84 - 23),
    toggle('toggle_off', C.sand2, 23),
    warnDash(),
    containerCup(),
];

const borders = {};
for (const sp of sprites) {
    const out = path.join(outDir, `${sp.name}.png`);
    await sharp(Buffer.from(sp.svg)).png().toFile(out);
    if (sp.border) borders[sp.name] = sp.border;
    console.log(`  ${sp.name}.png${sp.border ? '  (9-slice ' + JSON.stringify(sp.border) + ')' : ''}`);
}
await writeFile(path.join(root, 'scripts/ui-kit.borders.json'), JSON.stringify(borders, null, 2));
console.log(`\nGenerated ${sprites.length} kit sprites -> ${path.relative(root, outDir)}`);
