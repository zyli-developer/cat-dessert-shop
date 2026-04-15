#!/bin/bash
# Browser-based image generation via Gemini
# Usage: bash scripts/browser_generate.sh

OUTPUT_DIR="D:/workspace/tiktok/mini-game/client/assets/images"
TOOL_RESULTS_DIR="C:/Users/Lenovo/.claude/projects/D--workspace-tiktok-mini-game/26c683ea-bc22-4be1-b600-0a74f7cbd2e5/tool-results"

generate_one() {
    local NAME="$1"
    local PROMPT="$2"
    local OUTPUT_PATH="$OUTPUT_DIR/$NAME"

    # Skip if already exists and > 10KB
    if [ -f "$OUTPUT_PATH" ] && [ $(stat -c%s "$OUTPUT_PATH" 2>/dev/null || echo 0) -gt 10000 ]; then
        echo "SKIP (exists): $NAME"
        return 0
    fi

    echo "Generating: $NAME"

    # Find textbox ref
    local REF=$(agent-browser snapshot -i 2>&1 | grep 'textbox.*Enter a prompt' | sed 's/.*ref=\([a-z0-9]*\).*/\1/')
    if [ -z "$REF" ]; then
        echo "  ERROR: Could not find input textbox"
        return 1
    fi

    # Fill and submit
    agent-browser fill "@$REF" "$PROMPT" 2>&1 > /dev/null
    agent-browser press Enter 2>&1 > /dev/null

    # Wait for image (poll every 15s, max 3min)
    local TRIES=0
    local MAX_TRIES=12
    local COUNT_BEFORE=$(agent-browser eval --stdin <<< 'document.querySelectorAll("img[alt=\", AI generated\"]").length' 2>/dev/null || echo "0")

    while [ $TRIES -lt $MAX_TRIES ]; do
        sleep 15
        agent-browser scroll down 2000 2>&1 > /dev/null
        sleep 2
        local COUNT=$(agent-browser eval --stdin <<< 'document.querySelectorAll("img[alt=\", AI generated\"]").length' 2>/dev/null || echo "0")
        if [ "$COUNT" != "$COUNT_BEFORE" ] && [ "$COUNT" -gt "$COUNT_BEFORE" ] 2>/dev/null; then
            echo "  Image generated (count: $COUNT)"
            break
        fi
        TRIES=$((TRIES + 1))
        echo "  Waiting... ($((TRIES * 15))s)"
    done

    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "  TIMEOUT: $NAME"
        return 1
    fi

    # Extract via canvas
    local TMPFILE="$OUTPUT_DIR/_tmp_extract.txt"
    agent-browser eval --stdin > "$TMPFILE" 2>&1 <<'JSEOF'
(async () => {
  const imgs = document.querySelectorAll('img[alt=", AI generated"]');
  const img = imgs[imgs.length - 1];
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
})()
JSEOF

    # Save
    head -1 "$TMPFILE" | sed 's/^"data:image\/png;base64,//' | sed 's/"$//' | base64 -d > "$OUTPUT_PATH" 2>/dev/null
    local SIZE=$(stat -c%s "$OUTPUT_PATH" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 10000 ]; then
        echo "  ✓ Saved: $NAME ($((SIZE / 1024)) KB)"
    else
        echo "  ✗ Failed to save: $NAME"
        rm -f "$OUTPUT_PATH"
        return 1
    fi

    rm -f "$TMPFILE"
    return 0
}

# Remaining cats
generate_one "cat_orange_happy.png" "Generate an image of the same cute chibi orange tabby cat with white apron, but now very happy, both paws raised in joy, sparkling eyes, mouth open smiling, full body, kawaii style, flat design, white background"

generate_one "cat_orange_bye.png" "Generate an image of the same cute chibi orange tabby cat with white apron, but now waving goodbye with one paw, eyes closed with a gentle smile, full body, kawaii style, flat design, white background"

generate_one "cat_blue_idle.png" "Generate an image of a cute chibi British Shorthair blue-gray cat standing on two legs, wearing a pink bow tie, round chubby face, big copper eyes, neutral expression, arms at sides, full body, kawaii style, flat design, white background"

generate_one "cat_blue_happy.png" "Generate an image of the same cute chibi blue-gray cat with pink bow tie, but now very happy, both paws raised, sparkling eyes, mouth open smiling, full body, kawaii style, flat design, white background"

generate_one "cat_blue_bye.png" "Generate an image of the same cute chibi blue-gray cat with pink bow tie, but now waving goodbye with one paw, eyes closed with a gentle smile, full body, kawaii style, flat design, white background"

generate_one "cat_white_idle.png" "Generate an image of a cute chibi Ragdoll cat standing on two legs, white fluffy fur with light brown face points, wearing a small chef hat, big blue eyes, neutral expression, arms at sides, full body, kawaii style, flat design, white background"

generate_one "cat_white_happy.png" "Generate an image of the same cute chibi white Ragdoll cat with chef hat, but now very happy, both paws raised, sparkling blue eyes, mouth open smiling, full body, kawaii style, flat design, white background"

generate_one "cat_white_bye.png" "Generate an image of the same cute chibi white Ragdoll cat with chef hat, but now waving goodbye with one paw, eyes closed with a gentle smile, full body, kawaii style, flat design, white background"

# Backgrounds
generate_one "bg_loading.png" "Generate an image: vertical mobile game loading screen, soft pink gradient background, scattered small floating dessert icons, dreamy warm atmosphere, no text, no characters, empty center, portrait 9:16 ratio, kawaii style"

generate_one "bg_home.png" "Generate an image: vertical mobile game background, cute cat bakery storefront, warm yellow wooden counter, glass display case with desserts, pink and white striped awning, cozy scene, no text, no characters, portrait 9:16, kawaii style"

generate_one "bg_game.png" "Generate an image: vertical mobile game background, cozy bakery interior, warm cream-yellow walls, simple wooden shelves, soft lighting, minimal detail, clean and uncluttered, no text, no characters, portrait 9:16, kawaii style"

# Container
generate_one "container.png" "Generate an image: tall glass jar container, transparent glass with shine highlights, rounded bottom corners, open top, thin light-blue border, empty inside, simple design, no shadow, white background"

# Icons
generate_one "icon_pause.png" "Generate an image: simple pause icon, two vertical pink rounded rectangles, flat design, game UI icon, white background, centered"
generate_one "icon_coin.png" "Generate an image: shiny gold coin icon with star emblem, metallic gold, simple round, flat design, game UI icon, white background, centered"
generate_one "icon_catcoin.png" "Generate an image: pink coin icon with cat paw print emblem, metallic pink, flat design, game UI icon, white background, centered"
generate_one "icon_hammer.png" "Generate an image: cute wooden hammer icon, brown handle with pink head, kawaii design, flat style, game UI icon, white background, centered"
generate_one "icon_shuffle.png" "Generate an image: two curved pink arrows forming circular shuffle symbol, flat design, game UI icon, white background, centered"
generate_one "icon_ad.png" "Generate an image: small pink TV icon with white play triangle, cute rounded design, flat style, game UI icon, white background, centered"
generate_one "icon_rank.png" "Generate an image: golden trophy cup with pink heart, cute and shiny, flat design, game UI icon, white background, centered"
generate_one "icon_settings.png" "Generate an image: pink gear cog icon, rounded teeth, simple cute, flat design, game UI icon, white background, centered"
generate_one "icon_share.png" "Generate an image: pink share icon, three connected dots, rounded cute design, flat style, game UI icon, white background, centered"
generate_one "icon_home_locked.png" "Generate an image: gray house icon with cat silhouette in window, small lock overlay, grayed out, flat design, game UI icon, white background, centered"
generate_one "icon_star_full.png" "Generate an image: bright golden five-pointed star, shiny with white sparkle, flat design, game UI icon, white background, centered"
generate_one "icon_star_empty.png" "Generate an image: light gray five-pointed star outline, empty hollow, thin border, flat design, game UI icon, white background, centered"
generate_one "icon_prev.png" "Generate an image: pink left arrow in a circle, rounded cute design, flat style, game UI icon, white background, centered"
generate_one "icon_next.png" "Generate an image: pink right arrow in a circle, rounded cute design, flat style, game UI icon, white background, centered"
generate_one "icon_close.png" "Generate an image: pink X close button in small circle, rounded soft design, flat style, game UI icon, white background, centered"

# Buttons
generate_one "btn_start.png" "Generate an image: wide rounded capsule button, bright pink with gradient, white highlight, drop shadow, no text, glossy, game UI button, white background"
generate_one "btn_primary.png" "Generate an image: medium rounded capsule button, pink with gradient, white highlight, no text, flat design, game UI button, white background"
generate_one "btn_secondary.png" "Generate an image: medium rounded capsule button, white with pink border outline, no text, flat design, game UI button, white background"
generate_one "btn_ad.png" "Generate an image: wide rounded capsule button, lavender purple with small white play triangle on left, no text, flat design, game UI button, white background"

# Bubble & popup
generate_one "bubble.png" "Generate an image: white speech bubble with triangular tail pointing down-left, pink border, rounded corners, empty inside, no text, flat design, game UI, white background"
generate_one "panel_popup.png" "Generate an image: rectangular popup panel with rounded corners, white background, pink border with heart accents at corners, empty inside, no text, flat design, game UI panel, white background"

# Particles
generate_one "particle_star.png" "Generate an image: simple bright yellow four-pointed star sparkle, glowing effect, tiny particle, white background, centered"
generate_one "particle_circle.png" "Generate an image: simple soft yellow glowing circle dot, blurred edges, tiny particle, white background, centered"
generate_one "particle_coin.png" "Generate an image: tiny shiny gold coin, simple flat design, game particle, white background, centered"

# Logo & other
generate_one "logo.png" "Generate an image: cute orange tabby cat face wearing chef hat, pink and warm yellow colors, small dessert icons on sides, no text at all, blank space at bottom, kawaii logo design, white background"
generate_one "next_preview_bg.png" "Generate an image: small square frame with rounded corners, light cream fill, thin pink dashed border, empty inside, game UI element, white background"

echo ""
echo "=== GENERATION COMPLETE ==="
ls -la "$OUTPUT_DIR"/*.png | wc -l
echo "total PNG files generated"
