#!/bin/bash
OUTPUT_DIR="D:/workspace/tiktok/mini-game/client/assets/images"

gen() {
    local NAME="$1"
    local PROMPT="$2"
    local OUT="$OUTPUT_DIR/$NAME"

    if [ -f "$OUT" ] && [ $(stat -c%s "$OUT" 2>/dev/null || echo 0) -gt 10000 ]; then
        echo "SKIP: $NAME"; return 0
    fi

    echo ">>> Generating: $NAME"
    agent-browser open "https://gemini.google.com/app" 2>&1 > /dev/null
    sleep 5

    local REF=$(agent-browser snapshot -i 2>&1 | grep 'textbox.*Enter a prompt' | sed 's/.*ref=\([a-z0-9]*\).*/\1/')
    agent-browser fill "@$REF" "$PROMPT" 2>&1 > /dev/null
    agent-browser press Enter 2>&1 > /dev/null

    for i in $(seq 1 24); do
        sleep 15
        agent-browser scroll down 2000 2>&1 > /dev/null
        sleep 2
        local HAS=$(agent-browser eval --stdin <<< 'document.querySelectorAll("img[alt=\", AI generated\"]").length' 2>/dev/null)
        if echo "$HAS" | grep -q '[1-9]'; then
            echo "  Image found at ${i}x15s"
            sleep 3
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
                echo "  ✓ Saved: $NAME ($((SZ / 1024)) KB)"; return 0
            else
                echo "  ✗ Extract failed, retrying extract..."
                sleep 5
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
                SZ=$(stat -c%s "$OUT" 2>/dev/null || echo 0)
                if [ "$SZ" -gt 10000 ]; then
                    echo "  ✓ Saved on retry: $NAME ($((SZ / 1024)) KB)"; return 0
                fi
                rm -f "$OUT"
                echo "  ✗ Failed again"
            fi
            break
        fi
    done
    echo "  ✗ TIMEOUT: $NAME"
}

gen "cat_white_idle.png" "Generate an image: cute chibi white Ragdoll cat, standing upright on two legs, brown face markings, wearing chef hat, big blue eyes, neutral calm expression, full body, kawaii flat design, white background"

gen "bg_game.png" "Generate an image: cozy bakery interior background for a mobile game, warm yellow walls, wooden shelves, soft lighting, minimal detail, portrait vertical format, no text no characters, kawaii cartoon style"

gen "btn_start.png" "Generate an image: wide rounded pink capsule button, gradient from light to medium pink, glossy highlight, drop shadow, completely empty with no text, game UI element, white background"

gen "particle_coin.png" "Generate an image: tiny cartoon gold coin, flat simple design, circular, shiny, small game particle icon, white background"

echo ""
echo "=== FINAL STATUS ==="
TOTAL=0; OK=0
for f in cat_orange_idle cat_orange_happy cat_orange_bye cat_blue_idle cat_blue_happy cat_blue_bye cat_white_idle cat_white_happy cat_white_bye bg_loading bg_home bg_game container icon_pause icon_coin icon_catcoin icon_hammer icon_shuffle icon_ad icon_rank icon_settings icon_share icon_home_locked icon_star_full icon_star_empty icon_prev icon_next icon_close btn_start btn_primary btn_secondary btn_ad bubble panel_popup particle_star particle_circle particle_coin logo next_preview_bg dessert_lv1_cookie dessert_lv2_cookie2 dessert_lv3_puff dessert_lv4_dorayaki dessert_lv5_taiyaki dessert_lv6_swissroll dessert_lv7_cakeroll dessert_lv8_cream_cake; do
    TOTAL=$((TOTAL + 1))
    if [ -f "$OUTPUT_DIR/${f}.png" ] && [ $(stat -c%s "$OUTPUT_DIR/${f}.png" 2>/dev/null || echo 0) -gt 10000 ]; then
        OK=$((OK + 1))
    else
        echo "  MISSING: ${f}.png"
    fi
done
echo "  Total: $OK / $TOTAL"
