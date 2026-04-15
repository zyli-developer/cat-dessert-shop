const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT_DIR = path.join(__dirname, '..', 'client', 'assets', 'images');
const OUTPUT_DIR = path.join(__dirname, '..', 'client', 'assets', 'images', 'processed');

// Target sizes from 09-assets.md
const ASSETS = {
  // §1 Desserts - square, transparent bg
  'dessert_lv1_cookie.png':    { w: 40,  h: 40,  removeBg: true },
  'dessert_lv2_cookie2.png':   { w: 56,  h: 56,  removeBg: true },
  'dessert_lv3_puff.png':      { w: 72,  h: 72,  removeBg: true },
  'dessert_lv4_dorayaki.png':  { w: 92,  h: 92,  removeBg: true },
  'dessert_lv5_taiyaki.png':   { w: 112, h: 112, removeBg: true },
  'dessert_lv6_swissroll.png': { w: 136, h: 136, removeBg: true },
  'dessert_lv7_cakeroll.png':  { w: 160, h: 160, removeBg: true },
  'dessert_lv8_cream_cake.png':{ w: 188, h: 188, removeBg: true },

  // §2 Cats - 200x200, transparent bg
  'cat_orange_idle.png':  { w: 200, h: 200, removeBg: true },
  'cat_orange_happy.png': { w: 200, h: 200, removeBg: true },
  'cat_orange_bye.png':   { w: 200, h: 200, removeBg: true },
  'cat_blue_idle.png':    { w: 200, h: 200, removeBg: true },
  'cat_blue_happy.png':   { w: 200, h: 200, removeBg: true },
  'cat_blue_bye.png':     { w: 200, h: 200, removeBg: true },
  'cat_white_idle.png':   { w: 200, h: 200, removeBg: true },
  'cat_white_happy.png':  { w: 200, h: 200, removeBg: true },
  'cat_white_bye.png':    { w: 200, h: 200, removeBg: true },

  // §3 Backgrounds - 720x1280, keep as-is (no bg removal)
  'bg_loading.png': { w: 720, h: 1280, removeBg: false },
  'bg_home.png':    { w: 720, h: 1280, removeBg: false },
  'bg_game.png':    { w: 720, h: 1280, removeBg: false },

  // §4 Container - 400x600, transparent bg
  'container.png': { w: 400, h: 600, removeBg: true },

  // §5 UI Icons - various sizes, transparent bg
  'icon_pause.png':       { w: 64, h: 64, removeBg: true },
  'icon_coin.png':        { w: 48, h: 48, removeBg: true },
  'icon_catcoin.png':     { w: 48, h: 48, removeBg: true },
  'icon_hammer.png':      { w: 64, h: 64, removeBg: true },
  'icon_shuffle.png':     { w: 64, h: 64, removeBg: true },
  'icon_ad.png':          { w: 64, h: 64, removeBg: true },
  'icon_rank.png':        { w: 64, h: 64, removeBg: true },
  'icon_settings.png':    { w: 64, h: 64, removeBg: true },
  'icon_share.png':       { w: 64, h: 64, removeBg: true },
  'icon_home_locked.png': { w: 64, h: 64, removeBg: true },
  'icon_star_full.png':   { w: 48, h: 48, removeBg: true },
  'icon_star_empty.png':  { w: 48, h: 48, removeBg: true },
  'icon_prev.png':        { w: 64, h: 64, removeBg: true },
  'icon_next.png':        { w: 64, h: 64, removeBg: true },
  'icon_close.png':       { w: 48, h: 48, removeBg: true },

  // §6 Buttons - transparent bg
  'btn_start.png':     { w: 280, h: 80, removeBg: true },
  'btn_primary.png':   { w: 200, h: 60, removeBg: true },
  'btn_secondary.png': { w: 200, h: 60, removeBg: true },
  'btn_ad.png':        { w: 240, h: 60, removeBg: true },

  // §7 Bubble & popup - transparent bg
  'bubble.png':      { w: 240, h: 180, removeBg: true },
  'panel_popup.png': { w: 500, h: 400, removeBg: true },

  // §8 Particles - transparent bg
  'particle_star.png':   { w: 16, h: 16, removeBg: true },
  'particle_circle.png': { w: 8,  h: 8,  removeBg: true },
  'particle_coin.png':   { w: 24, h: 24, removeBg: true },

  // §9 Logo & other - transparent bg
  'logo.png':            { w: 400, h: 200, removeBg: true },
  'next_preview_bg.png': { w: 80,  h: 80,  removeBg: true },
};

/**
 * Remove white/near-white background by replacing with transparency.
 * Pixels with R>240, G>240, B>240 are treated as background.
 */
async function removeWhiteBackground(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const THRESHOLD = 240;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > THRESHOLD && g > THRESHOLD && b > THRESHOLD) {
      data[i + 3] = 0; // Set alpha to 0 (transparent)
    }
  }

  return sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

async function processImage(filename, config) {
  const inputPath = path.join(INPUT_DIR, filename);
  const outputPath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(inputPath)) {
    console.log(`  SKIP (not found): ${filename}`);
    return false;
  }

  try {
    let buffer = fs.readFileSync(inputPath);

    // Step 1: Remove white background if needed
    if (config.removeBg) {
      buffer = await removeWhiteBackground(buffer);
    }

    // Step 2: Trim transparent/white edges (auto-crop)
    if (config.removeBg) {
      try {
        buffer = await sharp(buffer)
          .trim({ threshold: 10 })
          .toBuffer();
      } catch (e) {
        // trim can fail if image is all one color, ignore
      }
    }

    // Step 3: Resize to target dimensions
    buffer = await sharp(buffer)
      .resize(config.w, config.h, {
        fit: 'contain',
        background: config.removeBg
          ? { r: 0, g: 0, b: 0, alpha: 0 }  // transparent
          : { r: 255, g: 255, b: 255, alpha: 1 }, // white
      })
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(outputPath, buffer);
    const sizeKB = (buffer.length / 1024).toFixed(1);
    console.log(`  ✓ ${filename} → ${config.w}x${config.h} (${sizeKB} KB)`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${filename}: ${err.message}`);
    return false;
  }
}

async function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const entries = Object.entries(ASSETS);
  console.log(`Processing ${entries.length} images...\n`);

  let success = 0, fail = 0;

  for (const [filename, config] of entries) {
    const ok = await processImage(filename, config);
    if (ok) success++;
    else fail++;
  }

  console.log(`\nDone! Success: ${success}, Failed: ${fail}`);

  // Show total size
  let totalSize = 0;
  const files = fs.readdirSync(OUTPUT_DIR);
  for (const f of files) {
    if (f.endsWith('.png')) {
      totalSize += fs.statSync(path.join(OUTPUT_DIR, f)).size;
    }
  }
  console.log(`Total output size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);
