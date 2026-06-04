#!/usr/bin/env node
/**
 * compress_textures.js — shrink oversized PNG textures to fit the Douyin
 * 4 MB main-package limit, without touching asset UUIDs (scenes keep working).
 *
 * Strategy (per PNG under client/assets):
 *   1. Read pixel stats. If the alpha channel is fully opaque (min === 255),
 *      drop it — backgrounds don't need RGBA and it's pure dead weight.
 *   2. Re-encode as a palette (indexed) PNG with light dithering. This is the
 *      same idea as pngquant; visually near-lossless for game art.
 *   3. Only overwrite the source when the result is meaningfully smaller
 *      (>= MIN_SAVING_RATIO), so already-optimized art is left untouched.
 *
 * Idempotent: re-running on already-compressed files is a no-op (they won't
 * clear the saving threshold a second time).
 *
 * Usage:
 *   node scripts/compress_textures.js            # apply in place
 *   node scripts/compress_textures.js --dry-run  # report only, write nothing
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const TEXTURE_ROOTS = [
    path.join(ROOT, 'client/assets/textures'),
    path.join(ROOT, 'client/assets/resources'),
];
const MIN_SAVING_RATIO = 0.10; // require >=10% smaller to bother replacing
const MIN_SIZE_BYTES = 64 * 1024; // skip files already under 64 KB
const DRY_RUN = process.argv.includes('--dry-run');

function walk(dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (entry.isFile() && /\.png$/i.test(entry.name)) acc.push(full);
    }
    return acc;
}

async function compressOne(file) {
    const before = fs.statSync(file).size;
    if (before < MIN_SIZE_BYTES) return { file, skipped: 'small', before };

    const stats = await sharp(file).stats();
    const alpha = stats.channels[3];
    const fullyOpaque = alpha ? alpha.min === 255 : true;

    let pipe = sharp(file);
    if (fullyOpaque) pipe = pipe.removeAlpha();
    const buf = await pipe
        .png({ palette: true, quality: 80, effort: 8, dither: 0.5 })
        .toBuffer();

    const after = buf.length;
    const saving = (before - after) / before;
    if (saving < MIN_SAVING_RATIO) {
        return { file, skipped: 'no-gain', before, after };
    }
    if (!DRY_RUN) fs.writeFileSync(file, buf);
    return {
        file,
        before,
        after,
        droppedAlpha: fullyOpaque && !!alpha,
        applied: !DRY_RUN,
    };
}

(async () => {
    const files = TEXTURE_ROOTS.flatMap((d) => walk(d));
    const kb = (n) => (n / 1024).toFixed(0).padStart(5) + 'K';
    let totalBefore = 0;
    let totalAfter = 0;
    let changed = 0;

    for (const file of files.sort()) {
        const r = await compressOne(file);
        const rel = path.relative(ROOT, file).replace(/\\/g, '/');
        if (r.skipped) {
            continue;
        }
        changed++;
        totalBefore += r.before;
        totalAfter += r.after;
        const tag = r.droppedAlpha ? ' [-alpha]' : '';
        console.log(`${rel}\n   ${kb(r.before)} -> ${kb(r.after)}  (${(100 * r.after / r.before).toFixed(0)}%)${tag}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}${changed} file(s) ${DRY_RUN ? 'would be' : ''} compressed`);
    console.log(`total: ${(totalBefore / 1024 / 1024).toFixed(2)} MB -> ${(totalAfter / 1024 / 1024).toFixed(2)} MB ` +
        `(saved ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(2)} MB)`);
    if (!DRY_RUN && changed > 0) {
        console.log('\nNext: re-open/rebuild in Cocos Creator so it reimports the textures.');
    }
})();
