# 猫咪顾客资产 · 第一批（MVP 7 品种 × 3 表情 = 21 张）

> 从 `cat-asset-prompts.md`（全 30 品种）抽出的**优先出图清单**。
> 目标：在现有 3 只（布偶 / 英短 / 大橘）基础上补 7 只，凑齐 **10 只一眼可辨的核心顾客阵容**。
> 风格与 `docs/plans/09-assets.md` 完全一致（Style Base 前缀 + chibi 拟人 + 同会话连续生成）。

## 为什么是这 7 只
按「Q 版小尺寸下不撞脸」原则挑的，体型 / 毛色 / 服饰差异最大：
缅因(大长毛虎斑) · 波斯(扁脸长毛) · 无毛(粉皮无毛) · 折耳(垂耳) · 暹罗(重点色) · 孟加拉(豹纹) · 曼基康(矮脚)。

## 出图流程（每只猫务必照做）
1. **同一只猫的 3 个表情必须在同一会话中连续生成**：先出 `idle`，再用 `happy` / `bye` 的 prompt（已带 `Same character as the previous image`），保证三态是同一只。
2. 生成 **200×200 → 抠白底**。
3. 命名 `cat_<slug>_{idle,happy,bye}.png`，放进 `client/assets/resources/textures/character/`（与现有 `cat_orange/blue/white` 同目录）。
4. 出完一只勾掉一行，方便追踪。

## 进度勾选
- [ ] 1. 缅因猫 Maine Coon（`cat_maine_coon_*`）
- [ ] 2. 波斯猫 Persian（`cat_persian_*`）
- [ ] 3. 无毛猫 Sphynx（`cat_sphynx_*`）
- [ ] 4. 折耳猫 Scottish Fold（`cat_scottish_fold_*`）
- [ ] 5. 暹罗猫 Siamese（`cat_siamese_*`）
- [ ] 6. 孟加拉猫 Bengal（`cat_bengal_*`）
- [ ] 7. 曼基康 Munchkin（`cat_munchkin_*`）

---

## 1. 缅因猫 Maine Coon　|　服饰：松饼厨师帽　|　性格：超耐心
**cat_maine_coon_idle.png**
```
Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Maine Coon cat, large fluffy brown tabby fur with lynx-tipped ears and a bushy tail standing on two legs, wearing a small muffin-shaped chef hat, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_maine_coon_happy.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Maine Coon cat, large fluffy brown tabby fur with lynx-tipped ears and a bushy tail, wearing a small muffin-shaped chef hat, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_maine_coon_bye.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Maine Coon cat, large fluffy brown tabby fur with lynx-tipped ears and a bushy tail, wearing a small muffin-shaped chef hat, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```

## 2. 波斯猫 Persian　|　服饰：蕾丝蝴蝶结　|　性格：耐心
**cat_persian_idle.png**
```
Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Persian cat, long silky silver-white fur, flat round face and snub nose standing on two legs, wearing a lace bow hair accessory, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_persian_happy.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Persian cat, long silky silver-white fur, flat round face and snub nose, wearing a lace bow hair accessory, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_persian_bye.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Persian cat, long silky silver-white fur, flat round face and snub nose, wearing a lace bow hair accessory, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```

## 3. 斯芬克斯无毛猫 Sphynx　|　服饰：针织小毛衣　|　性格：普通
**cat_sphynx_idle.png**
```
Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Sphynx hairless cat, wrinkled pinkish skin, very large ears and no fur standing on two legs, wearing a small knitted sweater, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_sphynx_happy.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Sphynx hairless cat, wrinkled pinkish skin, very large ears and no fur, wearing a small knitted sweater, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_sphynx_bye.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Sphynx hairless cat, wrinkled pinkish skin, very large ears and no fur, wearing a small knitted sweater, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```

## 4. 苏格兰折耳 Scottish Fold　|　服饰：草莓贝雷帽　|　性格：普通
**cat_scottish_fold_idle.png**
```
Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Scottish Fold cat, folded ears lying flat against a round head, plush cream coat and big round eyes standing on two legs, wearing a strawberry beret, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_scottish_fold_happy.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Scottish Fold cat, folded ears lying flat against a round head, plush cream coat and big round eyes, wearing a strawberry beret, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_scottish_fold_bye.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Scottish Fold cat, folded ears lying flat against a round head, plush cream coat and big round eyes, wearing a strawberry beret, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```

## 5. 暹罗猫 Siamese　|　服饰：丝绒小斗篷　|　性格：急躁
**cat_siamese_idle.png**
```
Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Siamese cat, cream body with dark seal-brown points on face ears and paws, blue almond eyes and a slender body standing on two legs, wearing a small velvet cape, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_siamese_happy.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Siamese cat, cream body with dark seal-brown points on face ears and paws, blue almond eyes and a slender body, wearing a small velvet cape, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_siamese_bye.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Siamese cat, cream body with dark seal-brown points on face ears and paws, blue almond eyes and a slender body, wearing a small velvet cape, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```

## 6. 孟加拉豹猫 Bengal　|　服饰：探险家帽　|　性格：急躁
**cat_bengal_idle.png**
```
Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Bengal cat, golden coat with dark rosette leopard spots and an athletic body standing on two legs, wearing a little explorer hat, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_bengal_happy.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Bengal cat, golden coat with dark rosette leopard spots and an athletic body, wearing a little explorer hat, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_bengal_bye.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Bengal cat, golden coat with dark rosette leopard spots and an athletic body, wearing a little explorer hat, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```

## 7. 曼基康（矮脚） Munchkin　|　服饰：杯子蛋糕帽　|　性格：普通
**cat_munchkin_idle.png**
```
Cute cartoon hand-drawn style, soft rounded outlines, warm pastel colors, kawaii aesthetic, flat design with soft shadows, game asset for a cat bakery mobile game, a chibi-style anthropomorphic Munchkin cat, very short stubby legs, round gray-and-cream body and a normal-sized round head standing on two legs, wearing a cupcake-shaped hat, round head with big eyes, head-to-body ratio 1:1.5, neutral waiting expression, arms at sides, full body view, kawaii character design, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_munchkin_happy.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Munchkin cat, very short stubby legs, round gray-and-cream body and a normal-sized round head, wearing a cupcake-shaped hat, same body proportions, very happy excited expression, both paws raised in joy, sparkling eyes, mouth open smiling, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```
**cat_munchkin_bye.png**
```
Same character as the previous image, only change facial expression and arm pose. Cute cartoon hand-drawn style, chibi-style anthropomorphic Munchkin cat, very short stubby legs, round gray-and-cream body and a normal-sized round head, wearing a cupcake-shaped hat, same body proportions, satisfied gentle smile, one paw waving goodbye, eyes closed contentedly, full body view, isolated on pure white background, centered, square aspect ratio 1:1
```

---
## 出完这批之后
- 阵容达到 **10 只一眼可辨**（已有布偶 / 英短 / 大橘 + 本批 7 只），足够支撑前中期关卡的顾客新鲜感。
- 第二批（剩余 20 品种）见 `cat-asset-prompts.md`，按需再排。
- 接入玩法：每只猫的「性格」已在 `cat-breeds.html` 映射成顾客**耐心**（耐心 / 普通 / 急躁），可直接挂进 PRD 的顾客耐心环。
