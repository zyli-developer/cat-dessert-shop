const fs = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = process.argv[2] || 'AIzaSyCHjaZmpt2SVW1r1HNsdueJ4apjEt2NNYs';
const OUTPUT_DIR = path.join(__dirname, '..', 'client', 'assets', 'images');
const MODEL = 'gemini-2.5-flash-image';

// All prompts from 09-assets.md sections 2-8
const ASSETS = [
  // §2 Cats - Orange
  { name: 'cat_orange_idle.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic orange tabby cat standing on two legs, wearing a small white apron, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered' },
  { name: 'cat_orange_happy.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic orange tabby cat standing on two legs, wearing a small white apron, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered' },
  { name: 'cat_orange_bye.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic orange tabby cat standing on two legs, wearing a small white apron, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered' },
  // §2 Cats - Blue
  { name: 'cat_blue_idle.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic British Shorthair blue-gray cat standing on two legs, wearing a small pink bow tie, round chubby face with big copper eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered' },
  { name: 'cat_blue_happy.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic British Shorthair blue-gray cat, wearing a small pink bow tie, same body proportions, very happy excited expression, both paws raised, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered' },
  { name: 'cat_blue_bye.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic British Shorthair blue-gray cat, wearing a small pink bow tie, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered' },
  // §2 Cats - White/Ragdoll
  { name: 'cat_white_idle.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Ragdoll cat standing on two legs, white fluffy fur with light brown points on face and ears, wearing a small chef hat, big blue eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered' },
  { name: 'cat_white_happy.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Ragdoll cat, white fluffy fur with light brown points, wearing a small chef hat, same body proportions, very happy excited expression, both paws raised, sparkling blue eyes, mouth open smiling, full body view, isolated on pure white background, centered' },
  { name: 'cat_white_bye.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Ragdoll cat, white fluffy fur with light brown points, wearing a small chef hat, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered' },
  // §3 Backgrounds
  { name: 'bg_loading.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a vertical mobile game loading screen, soft pink gradient background from light pink at top to warm pink at bottom, scattered small floating dessert icons as decorative elements, dreamy and warm atmosphere, no text, no characters, clean composition with empty center area for logo placement, portrait orientation 9:16' },
  { name: 'bg_home.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a vertical mobile game home screen background, a cute cat bakery storefront exterior, warm yellow wooden counter at bottom, glass display case with colorful desserts, warm orange ambient lighting, a striped awning at top in pink and white, cozy street scene, no text, no characters, kawaii architecture, portrait orientation 9:16' },
  { name: 'bg_game.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a vertical mobile game gameplay background, inside a cozy bakery interior, warm cream-yellow walls, simple wooden shelves with jars on the sides, soft warm lighting from above, minimal detail to not distract from gameplay, clean and uncluttered, no text, no characters, muted warm tones, portrait orientation 9:16' },
  // §4 Container
  { name: 'container.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a tall glass jar container viewed from the front, transparent glass with subtle shine highlights on edges, rounded bottom corners, open top, thin light-blue glass border outline, empty inside, clean and simple design, no shadow, isolated on pure white background' },
  // §5 UI Icons
  { name: 'icon_pause.png', prompt: 'Generate an image: Cute cartoon flat design, a pause button icon, two vertical pink rounded rectangles, simple and clean, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_coin.png', prompt: 'Generate an image: Cute cartoon flat design, a shiny gold coin icon with a star emblem in the center, metallic gold with warm highlight, simple and round, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_catcoin.png', prompt: 'Generate an image: Cute cartoon flat design, a pink coin icon with a cute cat paw print emblem in the center, metallic pink with soft highlight, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_hammer.png', prompt: 'Generate an image: Cute cartoon flat design, a cute small wooden hammer tool icon, brown wooden handle with pink hammer head, kawaii tool design, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_shuffle.png', prompt: 'Generate an image: Cute cartoon flat design, two curved pink arrows forming a circular shuffle refresh symbol, rounded arrow tips, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_ad.png', prompt: 'Generate an image: Cute cartoon flat design, a small pink TV monitor icon with a white play triangle button in the center, cute and rounded design, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_rank.png', prompt: 'Generate an image: Cute cartoon flat design, a golden trophy cup icon with a small pink heart on it, cute and shiny, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_settings.png', prompt: 'Generate an image: Cute cartoon flat design, a pink gear cog icon with rounded teeth, simple and cute, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_share.png', prompt: 'Generate an image: Cute cartoon flat design, a pink share icon with three connected dots forming a share symbol, rounded and cute, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_home_locked.png', prompt: 'Generate an image: Cute cartoon flat design, a small gray house icon with a cute cat silhouette in the window, a tiny lock symbol overlay, grayed out locked appearance, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_star_full.png', prompt: 'Generate an image: Cute cartoon flat design, a bright golden yellow five-pointed star icon, shiny with a small white sparkle highlight, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_star_empty.png', prompt: 'Generate an image: Cute cartoon flat design, a light gray five-pointed star outline icon, empty hollow appearance with thin border, game UI icon, isolated on pure white background, centered' },
  { name: 'icon_prev.png', prompt: 'Generate an image: Cute cartoon flat design, a pink left-pointing arrow in a circle, rounded and cute design, game UI navigation icon, isolated on pure white background, centered' },
  { name: 'icon_next.png', prompt: 'Generate an image: Cute cartoon flat design, a pink right-pointing arrow in a circle, rounded and cute design, game UI navigation icon, isolated on pure white background, centered' },
  { name: 'icon_close.png', prompt: 'Generate an image: Cute cartoon flat design, a pink X close button icon in a small circle, rounded and soft design, game UI icon, isolated on pure white background, centered' },
  // §6 Buttons
  { name: 'btn_start.png', prompt: 'Generate an image: Cute cartoon flat design, a wide rounded capsule-shaped button, bright pink color with a subtle gradient from light pink to medium pink, soft white inner highlight at top edge, gentle drop shadow underneath, empty with no text at all, clean and glossy appearance, game UI button, isolated on pure white background' },
  { name: 'btn_primary.png', prompt: 'Generate an image: Cute cartoon flat design, a medium rounded capsule-shaped button, pink color with subtle gradient, soft white highlight, gentle shadow, empty with no text at all, clean design, game UI button, isolated on pure white background' },
  { name: 'btn_secondary.png', prompt: 'Generate an image: Cute cartoon flat design, a medium rounded capsule-shaped button, white light gray color with pink thin border outline, subtle shadow, empty with no text at all, clean design, game UI button, isolated on pure white background' },
  { name: 'btn_ad.png', prompt: 'Generate an image: Cute cartoon flat design, a wide rounded capsule-shaped button, light purple lavender color with a small white play triangle icon on the left side, subtle gradient and shadow, no text, game UI button, isolated on pure white background' },
  // §7 Bubble & popup
  { name: 'bubble.png', prompt: 'Generate an image: Cute cartoon flat design, a white speech bubble with a small triangular tail pointing down-left, soft pink border outline, rounded corners, empty inside with no text, clean and simple, game UI thought bubble, isolated on pure white background' },
  { name: 'panel_popup.png', prompt: 'Generate an image: Cute cartoon flat design, a rectangular popup panel with heavily rounded corners, white background, pink decorative border with small heart accents at corners, empty inside with no text at all, soft drop shadow, game UI dialog panel, isolated on pure white background' },
  // §8 Particles
  { name: 'particle_star.png', prompt: 'Generate an image: A simple bright yellow four-pointed star sparkle, glowing effect, clean edges, tiny game particle effect, isolated on pure white background, centered' },
  { name: 'particle_circle.png', prompt: 'Generate an image: A simple soft yellow glowing circle dot, blurred edges, tiny game particle effect, isolated on pure white background, centered' },
  { name: 'particle_coin.png', prompt: 'Generate an image: Cute cartoon flat design, a tiny shiny gold coin, simple flat design, game particle effect for coin burst animation, isolated on pure white background, centered' },
  // §9 Logo & other
  { name: 'logo.png', prompt: 'Generate an image: Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, a game logo graphic featuring a cute orange tabby cat face wearing a chef hat, pink and warm yellow color scheme, decorative small dessert icons flanking the sides, no text at all, leave blank space at the bottom for text overlay later, kawaii logo design, isolated on pure white background' },
  { name: 'next_preview_bg.png', prompt: 'Generate an image: Cute cartoon flat design, a small square frame with rounded corners, light cream beige fill with thin pink dashed border, empty inside, game UI preview box element, isolated on pure white background' },
];

function generateImage(prompt, outputPath) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    });

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)));
            return;
          }
          // Find image part in response
          const candidates = json.candidates || [];
          for (const c of candidates) {
            const parts = (c.content && c.content.parts) || [];
            for (const p of parts) {
              if (p.inlineData && p.inlineData.data) {
                const imgBuffer = Buffer.from(p.inlineData.data, 'base64');
                fs.writeFileSync(outputPath, imgBuffer);
                resolve({ success: true, size: imgBuffer.length });
                return;
              }
            }
          }
          reject(new Error('No image in response: ' + data.substring(0, 300)));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Filter out already generated files
  const toGenerate = ASSETS.filter(a => {
    const filePath = path.join(OUTPUT_DIR, a.name);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.size > 10000) {
        console.log(`SKIP (exists): ${a.name}`);
        return false;
      }
    }
    return true;
  });

  console.log(`\nTotal: ${ASSETS.length}, To generate: ${toGenerate.length}\n`);

  let success = 0, fail = 0;
  for (let i = 0; i < toGenerate.length; i++) {
    const asset = toGenerate[i];
    const outputPath = path.join(OUTPUT_DIR, asset.name);
    console.log(`[${i + 1}/${toGenerate.length}] Generating: ${asset.name}`);
    try {
      const result = await generateImage(asset.prompt, outputPath);
      console.log(`  ✓ Saved (${(result.size / 1024).toFixed(0)} KB)`);
      success++;
    } catch (err) {
      console.error(`  ✗ Error: ${err.message.substring(0, 150)}`);
      fail++;
    }
    // Delay to avoid rate limiting
    if (i < toGenerate.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\nDone! Success: ${success}, Failed: ${fail}`);
}

main().catch(console.error);
