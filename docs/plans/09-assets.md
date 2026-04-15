# 资产清单与生成提示词

> 所属项目：猫咪甜品店
> 总文档：[README.md](README.md)

---

## 统一风格说明

所有图片资产使用以下统一风格前缀：

```
Style Base (所有 prompt 必须以此开头):
"Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors,
kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery
mobile game"
```

- 单个元素（甜品/图标/猫咪）：`isolated on pure white background, centered`（生成后抠图去白底）
- 场景背景：完整画面，`portrait orientation, 9:16 aspect ratio`
- UI 元素：`isolated on pure white background, centered`（生成后抠图）

---

## 1. 甜品（8 个）

> 所有甜品必须呈**圆形/接近圆形**外观，因为物理系统使用圆形碰撞体。不加阴影，甜品在容器中会被物理引擎移动，固定阴影会不自然。

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| dessert_lv1_cookie.png | 40×40 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a small round butter cookie, beige/cream color, simple surface texture with tiny cracks, round circular shape, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |
| dessert_lv2_cookie2.png | 56×56 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a round chocolate chip cookie, warm brown color with dark chocolate chips scattered on top, round circular shape, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |
| dessert_lv3_puff.png | 72×72 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a cream puff pastry, pale yellow fluffy round ball shape with white cream on top, round circular shape, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |
| dessert_lv4_dorayaki.png | 92×92 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a dorayaki (Japanese red bean pancake), caramel brown color, two round pancake layers with filling visible, round circular shape, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |
| dessert_lv5_taiyaki.png | 112×112 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a taiyaki (Japanese fish-shaped cake) curled into a round ball shape, golden yellow color, compact circular form, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |
| dessert_lv6_swissroll.png | 136×136 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a Swiss roll cake viewed from the front showing round spiral cross-section, brown and white spiral pattern, cream filling visible, round circular shape, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |
| dessert_lv7_cakeroll.png | 160×160 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a round strawberry shortcake viewed from above, pink and white layers, strawberry on top, round circular shape, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |
| dessert_lv8_cream_cake.png | 188×188 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a grand round multi-layer cream cake viewed from front, white frosting with pink decorations, a cherry on top, three visible layers, round circular shape, the largest and most impressive dessert, no shadow, kawaii food art, isolated on pure white background, centered, square aspect ratio 1:1` |

> 生成后：1) 抠除白色背景 2) 裁剪为正方形 3) 缩放到目标尺寸。建议原图生成 1024×1024 再缩小。

---

## 2. 猫咪顾客（3 种 × 3 表情 = 9 个）

> 同一只猫的 3 个表情在同一会话中连续生成。先生成 idle 作为基准，happy 和 bye 的 prompt 加 `same character as the previous image, only change facial expression and arm pose`。

### 橘猫

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| cat_orange_idle.png | 200×200 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic orange tabby cat standing on two legs, wearing a small white apron, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1` |
| cat_orange_happy.png | 200×200 | `Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic orange tabby cat standing on two legs, wearing a small white apron, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1` |
| cat_orange_bye.png | 200×200 | `Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic orange tabby cat standing on two legs, wearing a small white apron, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1` |

### 英短蓝猫

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| cat_blue_idle.png | 200×200 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic British Shorthair blue-gray cat standing on two legs, wearing a small pink bow tie, round chubby face with big copper eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1` |
| cat_blue_happy.png | 200×200 | `Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic British Shorthair blue-gray cat, wearing a small pink bow tie, same body proportions, very happy excited expression, both paws raised, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1` |
| cat_blue_bye.png | 200×200 | `Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic British Shorthair blue-gray cat, wearing a small pink bow tie, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1` |

### 布偶猫

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| cat_white_idle.png | 200×200 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Ragdoll cat standing on two legs, white fluffy fur with light brown points on face and ears, wearing a small chef hat, big blue eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1` |
| cat_white_happy.png | 200×200 | `Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Ragdoll cat, white fluffy fur with light brown points, wearing a small chef hat, same body proportions, very happy excited expression, both paws raised, sparkling blue eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1` |
| cat_white_bye.png | 200×200 | `Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Ragdoll cat, white fluffy fur with light brown points, wearing a small chef hat, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1` |

> 每只猫咪通过服饰区分：橘猫=白围裙，蓝猫=粉色领结，布偶猫=厨师帽。

---

## 3. 场景背景（3 个）

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| bg_loading.png | 720×1280 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a vertical mobile game loading screen, soft pink gradient background from light pink at top to warm pink at bottom, scattered small floating dessert icons (cookies, cupcakes, donuts) as decorative elements, dreamy and warm atmosphere, no text, no characters, clean composition with empty center area for logo placement, portrait orientation, 9:16 aspect ratio` |
| bg_home.png | 720×1280 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a vertical mobile game home screen background, a cute cat bakery storefront exterior, warm yellow wooden counter at bottom, glass display case with colorful desserts, warm orange ambient lighting, a striped awning at top in pink and white, cozy street scene, no text, no characters, kawaii architecture, portrait orientation, 9:16 aspect ratio` |
| bg_game.png | 720×1280 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a vertical mobile game gameplay background, inside a cozy bakery interior, warm cream-yellow walls, simple wooden shelves with jars on the sides, soft warm lighting from above, minimal detail to not distract from gameplay, clean and uncluttered, no text, no characters, muted warm tones, portrait orientation, 9:16 aspect ratio` |

---

## 4. 容器（2 个）

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| container.png | 400×600 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset for a cat bakery mobile game, a tall glass jar/container viewed from the front, transparent glass with subtle shine highlights on edges, rounded bottom corners, open top, thin light-blue glass border outline, empty inside, clean and simple design, no shadow, isolated on pure white background, portrait aspect ratio 2:3` |
| container_warning_line.png | — | 程序生成：红色虚线，无需图片资产 |

---

## 5. UI 图标（15 个）

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| icon_pause.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a pause button icon, two vertical pink rounded rectangles, simple and clean, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_coin.png | 48×48 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a shiny gold coin icon with a star emblem in the center, metallic gold with warm highlight, simple and round, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_catcoin.png | 48×48 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a pink coin icon with a cute cat paw print emblem in the center, metallic pink with soft highlight, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_hammer.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a cute small wooden hammer tool icon, brown wooden handle with pink hammer head, kawaii tool design, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_shuffle.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, two curved pink arrows forming a circular shuffle/refresh symbol, rounded arrow tips, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_ad.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a small pink TV/monitor icon with a white play triangle button in the center, cute and rounded design, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_rank.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a golden trophy cup icon with a small pink heart on it, cute and shiny, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_settings.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a pink gear/cog icon with rounded teeth, simple and cute, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_share.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a pink share icon with three connected dots forming a share symbol, rounded and cute, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_home_locked.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a small gray house icon with a cute cat silhouette in the window, a tiny lock symbol overlay, grayed out/locked appearance, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_star_full.png | 48×48 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a bright golden yellow five-pointed star icon, shiny with a small white sparkle highlight, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_star_empty.png | 48×48 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a light gray five-pointed star outline icon, empty/hollow appearance with thin border, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_prev.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a pink left-pointing arrow in a circle, rounded and cute design, game UI navigation icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_next.png | 64×64 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a pink right-pointing arrow in a circle, rounded and cute design, game UI navigation icon, isolated on pure white background, centered, square aspect ratio 1:1` |
| icon_close.png | 48×48 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a pink X close button icon in a small circle, rounded and soft design, game UI icon, isolated on pure white background, centered, square aspect ratio 1:1` |

> 图标生成后：抠白底 → 裁剪正方形 → 缩小到目标尺寸。

---

## 6. 按钮（4 个）

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| btn_start.png | 280×80 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a wide rounded capsule-shaped button, bright pink color with a subtle gradient from light pink to medium pink, soft white inner highlight at top edge, gentle drop shadow underneath, empty with no text at all, clean and glossy appearance, game UI button, isolated on pure white background, landscape aspect ratio 3.5:1` |
| btn_primary.png | 200×60 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a medium rounded capsule-shaped button, pink color with subtle gradient, soft white highlight, gentle shadow, empty with no text at all, clean design, game UI button, isolated on pure white background, landscape aspect ratio 3.3:1` |
| btn_secondary.png | 200×60 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a medium rounded capsule-shaped button, white/light gray color with pink thin border outline, subtle shadow, empty with no text at all, clean design, game UI button, isolated on pure white background, landscape aspect ratio 3.3:1` |
| btn_ad.png | 240×60 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a wide rounded capsule-shaped button, light purple/lavender color with a small white play triangle icon on the left side, subtle gradient and shadow, no text, game UI button, isolated on pure white background, landscape aspect ratio 4:1` |

> 按钮文字由程序叠加，图片不含任何文字。

---

## 7. 气泡与弹窗（3 个）

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| bubble.png | 240×180 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a white speech bubble with a small triangular tail pointing down-left, soft pink border outline, rounded corners, empty inside with no text, clean and simple, game UI thought bubble, isolated on pure white background, aspect ratio 4:3` |
| panel_popup.png | 500×400 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design, game asset, a rectangular popup panel with heavily rounded corners, white background, pink decorative border with small heart accents at corners, empty inside with no text at all, soft drop shadow, game UI dialog panel, isolated on pure white background, aspect ratio 5:4` |
| overlay_dark.png | — | 程序生成：半透明黑色矩形，无需图片资产 |

---

## 8. 特效粒子（3 个）

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| particle_star.png | 16×16 | `Cute cartoon hand-drawn style, flat design, a simple bright yellow four-pointed star sparkle, glowing effect, clean edges, tiny game particle effect, isolated on pure white background, centered, square aspect ratio 1:1` |
| particle_circle.png | 8×8 | `Cute cartoon hand-drawn style, flat design, a simple soft white glowing circle dot, blurred edges, tiny game particle effect, isolated on pure white background, centered, square aspect ratio 1:1` |
| particle_coin.png | 24×24 | `Cute cartoon hand-drawn style, flat design, a tiny shiny gold coin, simple flat design, game particle effect for coin burst animation, isolated on pure white background, centered, square aspect ratio 1:1` |

---

## 9. Logo 与其他（2 个）

| 资产名 | 尺寸 | Prompt |
|--------|------|--------|
| logo.png | 400×200 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset, a game logo graphic featuring a cute orange tabby cat face wearing a chef hat, pink and warm yellow color scheme, decorative small dessert icons (cookie, cupcake) flanking the sides, no text at all, leave blank space at the bottom for text overlay later, kawaii logo design, isolated on pure white background, landscape aspect ratio 2:1` |
| next_preview_bg.png | 80×80 | `Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, flat design, game asset, a small square frame with rounded corners, light cream/beige fill with thin pink dashed border, empty inside, game UI preview box element, isolated on pure white background, square aspect ratio 1:1` |

---

## 10. 音频（4 个）

| 资产名 | 格式 | 说明 | 获取建议 |
|--------|------|------|---------|
| bgm_main.mp3 | MP3 | 甜品店轻松爵士 BGM，循环，30-60秒 | 使用 Suno AI 生成，prompt: `cozy cafe jazz, gentle piano and light drums, warm and happy, loopable, background music for a cute bakery game` |
| sfx_merge.mp3 | MP3 | 合成成功叮咚声，0.3秒 | 免费音效网站（freesound.org）搜索 "cute chime" 或 "bell ding" |
| sfx_win.mp3 | MP3 | 通关庆祝音效，1-2秒 | 搜索 "victory jingle cute" 或 "level complete chime" |
| sfx_fail.mp3 | MP3 | 失败音效，1秒 | 搜索 "game over soft" 或 "sad trombone short" |

---

## 资产统计

| 类别 | 数量 | 需生成图片 | 程序生成 |
|------|------|-----------|---------|
| 甜品 | 8 | 8 | — |
| 猫咪顾客 | 9 | 9 | — |
| 场景背景 | 3 | 3 | — |
| 容器 | 2 | 1 | 1（警戒线） |
| UI 图标 | 15 | 15 | — |
| 按钮 | 4 | 4 | — |
| 气泡/弹窗 | 3 | 2 | 1（遮罩） |
| 特效粒子 | 3 | 3 | — |
| Logo/其他 | 2 | 2 | — |
| 音频 | 4 | — | — |
| **总计** | **53** | **47 张图** | **2 个程序生成** |

---

## 生成注意事项

1. **统一风格前缀**：所有 prompt 以完整 Style Base 开头（`Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design...`）
2. **白底抠图流程**：Gemini 不保证透明背景，所有 prompt 使用 `isolated on pure white background`。生成后用 remove.bg 或 Photoshop 魔棒工具去白底，导出为透明 PNG
3. **尺寸处理**：Gemini 不严格遵守像素尺寸，prompt 中使用宽高比约束（如 `square aspect ratio 1:1`）。生成后统一裁剪缩放到目标尺寸
4. **猫咪一致性**：同一只猫的 3 个表情在同一会话中连续生成。先生成 idle 确认造型满意后，再生成 happy 和 bye，prompt 中加 `same character as the previous image`
5. **甜品圆形约束**：所有甜品 prompt 包含 `round circular shape`，确保与圆形物理碰撞体匹配
6. **甜品无阴影**：甜品在容器中由物理引擎驱动移动，固定阴影会导致视觉不自然，所有甜品 prompt 包含 `no shadow`
7. **文字不入图**：所有按钮、Logo 的 prompt 包含 `no text at all`，文字完全由程序叠加
8. **批量一致性**：同类资产（如 15 个图标）建议在同一会话中连续生成
9. **包体限制**：总资产控制在 20MB 以内，图片使用 PNG-8 或压缩 PNG（TinyPNG）
