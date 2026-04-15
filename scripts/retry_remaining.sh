#!/bin/bash
OUTPUT_DIR="D:/workspace/tiktok/mini-game/client/assets/images"

gen() {
    local NAME="$1"
    local PROMPT="$2"
    local OUT="$OUTPUT_DIR/$NAME"

    if [ -f "$OUT" ] && [ $(stat -c%s "$OUT" 2>/dev/null || echo 0) -gt 10000 ]; then
        echo "SKIP: $NAME"
        return 0
    fi

    echo ">>> Generating: $NAME"

    # Get textbox ref
    local REF=$(agent-browser snapshot -i 2>&1 | grep 'textbox.*Enter a prompt' | sed 's/.*ref=\([a-z0-9]*\).*/\1/')
    if [ -z "$REF" ]; then
        # Try new chat
        agent-browser open "https://gemini.google.com/app" 2>&1 > /dev/null
        sleep 5
        REF=$(agent-browser snapshot -i 2>&1 | grep 'textbox.*Enter a prompt' | sed 's/.*ref=\([a-z0-9]*\).*/\1/')
    fi

    agent-browser fill "@$REF" "$PROMPT" 2>&1 > /dev/null
    agent-browser press Enter 2>&1 > /dev/null

    # Poll for image with longer timeout (5min)
    for i in $(seq 1 20); do
        sleep 15
        agent-browser scroll down 2000 2>&1 > /dev/null
        sleep 2
        local HAS=$(agent-browser eval --stdin <<< 'document.querySelectorAll("img[alt=\", AI generated\"]").length' 2>/dev/null)
        # Check if new image appeared (any number > 0 in fresh chat, or increased)
        if echo "$HAS" | grep -q '[1-9]'; then
            echo "  Image found (count: $HAS) at ${i}x15s"
            # Extract
            agent-browser eval --stdin > /tmp/img_extract.txt 2>&1 <<'JSEOF'
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
            head -1 /tmp/img_extract.txt | sed 's/^"data:image\/png;base64,//' | sed 's/"$//' | base64 -d > "$OUT" 2>/dev/null
            local SZ=$(stat -c%s "$OUT" 2>/dev/null || echo 0)
            if [ "$SZ" -gt 10000 ]; then
                echo "  ✓ Saved: $NAME ($((SZ / 1024)) KB)"
                # Open new chat for next one
                agent-browser open "https://gemini.google.com/app" 2>&1 > /dev/null
                sleep 5
                return 0
            else
                echo "  ✗ Save failed"
                rm -f "$OUT"
            fi
            break
        fi
    done

    if [ ! -f "$OUT" ]; then
        echo "  ✗ TIMEOUT: $NAME"
        # Open new chat anyway
        agent-browser open "https://gemini.google.com/app" 2>&1 > /dev/null
        sleep 5
    fi
}

# Start fresh
agent-browser open "https://gemini.google.com/app" 2>&1 > /dev/null
sleep 5

gen "cat_blue_bye.png" "Generate an image of a cute chibi British Shorthair blue-gray cat standing on two legs, wearing a pink bow tie, waving goodbye with one paw, eyes closed, gentle smile, full body, kawaii style, flat design, white background"

gen "cat_white_idle.png" "Generate an image of a cute chibi white Ragdoll cat standing on two legs, light brown face markings, wearing a small chef hat, big blue eyes, neutral expression, arms at sides, full body, kawaii style, flat design, white background"

gen "bg_home.png" "Generate a vertical portrait image of a cute cartoon cat bakery storefront, warm yellow wooden counter, glass case with desserts, pink and white striped awning, cozy warm lighting, no text, no characters, kawaii style, 9:16 ratio"

gen "bg_game.png" "Generate a vertical portrait image of a cozy bakery interior, warm cream-yellow walls, simple wooden shelves, soft lighting, minimal clean detail, no text, no characters, kawaii style, muted tones, 9:16 ratio"

gen "icon_coin.png" "Generate an image of a shiny gold coin icon with a star in the center, simple round flat design, game UI icon, white background"

gen "btn_start.png" "Generate an image of a wide pink rounded capsule button with gradient, glossy, no text, game UI button, white background"

gen "particle_coin.png" "Generate an image of a tiny shiny gold coin, simple flat cartoon design, small game particle, white background"

echo ""
echo "=== RETRY COMPLETE ==="
for f in cat_blue_bye cat_white_idle bg_home bg_game icon_coin btn_start particle_coin; do
    if [ -f "$OUTPUT_DIR/${f}.png" ] && [ $(stat -c%s "$OUTPUT_DIR/${f}.png" 2>/dev/null || echo 0) -gt 10000 ]; then
        echo "  ✓ ${f}.png"
    else
        echo "  ✗ ${f}.png (MISSING)"
    fi
done
