# Phase 1：资产准备与集成

> 依赖：无
> 可并行：Phase 5（后端更新）
> 产出：全部 47 张图片 + 4 个音频就位于 `client/assets/` 目录
> 参考：[09-assets.md](../plans/09-assets.md)

---

## Task 1-1：生成甜品图片（8 张）

**操作**：使用 Gemini 按 `09-assets.md` 中的 prompt 生成 8 级甜品图片。

**文件**：
```
client/assets/textures/desserts/
├── dessert_lv1_cookie.png       (40×40)
├── dessert_lv2_cookie2.png      (56×56)
├── dessert_lv3_puff.png         (72×72)
├── dessert_lv4_dorayaki.png     (92×92)
├── dessert_lv5_taiyaki.png      (112×112)
├── dessert_lv6_swissroll.png    (136×136)
├── dessert_lv7_cakeroll.png     (160×160)
└── dessert_lv8_cream_cake.png   (188×188)
```

**验收标准**：
- [ ] 8 张图片透明背景，风格统一
- [ ] 尺寸递增明显，缩略图下仍可辨识
- [ ] 颜色按真实食物色区分（米/棕/淡黄/焦糖/金黄/棕白/粉白/白粉）

---

## Task 1-2：生成猫咪顾客图片（9 张）

**操作**：使用 Gemini 生成 3 种猫咪 × 3 表情。同一会话内连续生成以保持风格一致。

**文件**：
```
client/assets/textures/character/
├── cat_orange_idle.png    cat_orange_happy.png    cat_orange_bye.png
├── cat_blue_idle.png      cat_blue_happy.png      cat_blue_bye.png
└── cat_white_idle.png     cat_white_happy.png     cat_white_bye.png
```

**验收标准**：
- [ ] Q 版拟人两脚站立，风格统一
- [ ] 服饰区分：橘猫=白围裙，蓝猫=粉领结，布偶猫=厨师帽
- [ ] 3 种表情明显可辨：等待/开心/挥手

---

## Task 1-3：生成场景背景 + 容器 + Logo（5 张）

**文件**：
```
client/assets/textures/bg/
├── bg_loading.png     (720×1280)
├── bg_home.png        (720×1280)
└── bg_game.png        (720×1280)

client/assets/textures/ui/
├── container.png      (400×600)

client/assets/textures/
└── logo.png           (400×200)
```

**验收标准**：
- [ ] 背景尺寸正确（720×1280），无文字
- [ ] 加载页粉色渐变，主页甜品店门面暖黄，游戏内简洁暖黄
- [ ] 容器透明玻璃感，边框清晰
- [ ] Logo 文字区域留空（程序叠加）

---

## Task 1-4：生成 UI 图标 + 按钮 + 气泡（24 张）

**文件**：
```
client/assets/textures/ui/
├── icon_pause.png       icon_coin.png        icon_catcoin.png
├── icon_hammer.png      icon_shuffle.png     icon_ad.png
├── icon_rank.png        icon_settings.png    icon_share.png
├── icon_home_locked.png icon_star_full.png   icon_star_empty.png
├── icon_prev.png        icon_next.png        icon_close.png
├── btn_start.png        btn_primary.png      btn_secondary.png
├── btn_ad.png
├── bubble.png           panel_popup.png
├── particle_star.png    particle_circle.png   particle_coin.png
└── next_preview_bg.png
```

**验收标准**：
- [ ] 图标风格统一（粉色系），透明背景
- [ ] 按钮无文字（程序叠加），圆角胶囊形
- [ ] 粒子图片简洁，适合缩放

---

## Task 1-5：获取音频资产（4 个）

**操作**：
- BGM：使用 Suno AI 生成，prompt 见 `09-assets.md`
- 音效：从 freesound.org 搜索下载

**文件**：
```
client/assets/audio/
├── bgm_main.mp3
├── sfx_merge.mp3
├── sfx_win.mp3
└── sfx_fail.mp3
```

**验收标准**：
- [ ] BGM 可循环播放，30-60 秒，轻松爵士风
- [ ] 3 个音效时长合适（合成 0.3s，通关 1-2s，失败 1s）
- [ ] 全部音频总大小 ≤ 2MB
