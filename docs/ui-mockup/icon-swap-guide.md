# 图标替换指南

## ✅ 本次已执行：buttons-sheet 那套扁平图标 → 统一线条风（原地替换）

通过 `scripts/swap_button_icons.js`，已把 buttons-sheet 涉及的 **17 个旧扁平单图原地覆盖**
为统一线条图标，并 **重建了 `buttons-sheet.png` 本身**（1536×838，4×2，统一暖棕线条）：

| 已覆盖（`textures/ui/`） | 来源图标 | 备注 |
|---|---|---|
| `pause.png` `icon_pause.png` | icon_pause | |
| `hammer.png` `icon_hammer.png` | icon_hammer | |
| `shuffle.png` `icon_shuffle.png` | icon_shuffle | |
| `settings.png` `icon_settings.png` | icon_settings | |
| `home.png` | icon_home | **被 Home/Loading 场景引用，刷新后立即生效** |
| `icon_next.png` `btn_next.png` | icon_next | |
| `icon_prev.png` `btn_prev.png` | icon_prev | |
| `star_on.png` `icon_star_full.png` | icon_star（金 `#F2B53B`） | 实心金星 |
| `star_off.png` `icon_star_empty.png` | icon_star（灰 `#CBB89E`） | 实心灰星 |
| `buttons-sheet.png` | 8 图标重组 | 4×2 图集整体重建为统一线条风 |

### 第二批：剩余非 buttons-sheet 的扁平图标（同次脚本一并原地覆盖）

| 已覆盖（`textures/ui/`） | 来源图标 | 备注 |
|---|---|---|
| `ad.png` `icon_ad.png` | icon_ad | 看广告 |
| `icon_close.png` | icon_close | 弹窗关闭 / 锤子模式 ✕ |
| `icon_rank.png` | icon_rank | 排行入口 |
| `icon_share.png` | icon_share | 分享 |
| `icon_coin.png` `icon_catcoin.png` | icon_coin（金色爪印币，多色不染色） | HUD 金币 / 猫币 |
| `icon_home_locked.png` | icon_lock | 锁定关卡 → 统一锁图标 |

> 这 8 个目前在工程里均**无场景/prefab 引用**（与 `buttons-sheet` 同属孤立资源），已就地统一为备用；
> 后续在编辑器里指定到对应节点即可，无需再找新文件。

**只改像素、不动 `.png.meta`/UUID** —— 所以场景/prefab 的所有引用不断链，Cocos 下次 Refresh
会按同 UUID 重新导入新图。两批共 **25 个单图 + 1 张图集**原件已全部备份到
**`backup/buttons-sheet-swap-2026-06-04/`**，可随时回退。

**程序侧只需两步：**
1. Cocos 编辑器 Assets 面板右键 `textures/ui` → **Refresh**，确认图标变为统一线条风。
2. `buttons-sheet.png` 在工程里已是孤立资源（无任何场景/prefab/脚本引用），已重建为统一风格备用；
   若确认用不到，可在编辑器搜索引用为空后删除。

> 重跑：`node scripts/swap_button_icons.js`（幂等，会再次从备份外的当前 SVG 渲染并覆盖）。

---

## 附：另一套 26 枚图标（icons-v2/，按需在编辑器手动替换其余图标）

> `scripts/rasterize_icons.js` 已把 `icons-export/svg/` 全部 26 枚图标栅格化到
> **`client/assets/textures/ui/icons-v2/`**（144²，暖棕 `#5A4636` 线条，透明底），用于替换
> buttons-sheet 之外的其余图标（金币/分享/关闭/客服/音乐…）。这批是非破坏式新目录，需在编辑器手动指定 SpriteFrame。

```bash
node scripts/rasterize_icons.js
# HUD 大图标想要更清晰可整体跑 192：
ICON_SIZE=192 node scripts/rasterize_icons.js
```

跑完在 Cocos 编辑器 **Assets 面板右键 `textures/ui/icons-v2` → Refresh**，让编辑器导入并生成 SpriteFrame。

---

## 1. 通用替换步骤（每个图标节点都一样）

1. 在 Hierarchy 选中目标 `Sprite` 节点。
2. Inspector → `cc.Sprite` → **Sprite Frame** 字段。
3. 从 `textures/ui/icons-v2/<name>.png` 拖入对应 SpriteFrame（PNG 导入后展开取其 spriteFrame 子资源）。
4. 若图标偏大/偏小，调 `UITransform` 的 ContentSize（圆形图标按钮建议 64²，HUD 图标按设计）。
5. 线条图标本身是暖棕，**不要再叠黑描边/染色**；禁用态可把 `Sprite.color` 设为 `#B59C80`（弱文字色）。

---

## 2. 旧贴图 → 新图标 对照表

> 注：下表中 `pause/hammer/shuffle/settings/home/next/prev/star/ad/close/rank/share/coin/catcoin/home_locked`
> 这些**已由 `swap_button_icons.js` 原地替换完成**（见顶部 ✅ 两批清单），无需再手动指定；
> 本表保留作语义对照与「出现位置」参考。其余未列入脚本的节点仍可按本表手动替换。

| 旧贴图（`textures/ui/`） | 新图标（`icons-v2/`） | 出现位置 |
|---|---|---|
| `icon_hammer.png` / `hammer.png` | `icon_hammer.png` | GameScene 道具栏 锤子 |
| `icon_shuffle.png` / `shuffle.png` | `icon_shuffle.png` | GameScene 道具栏 洗牌 |
| `ad.png` / `btn_ad.png` | `icon_ad.png` | 道具栏「看广告 +10」、Home 猫币广告 |
| `icon_pause.png` / `pause.png` | `icon_pause.png` | GameScene 顶部 暂停 |
| `icon_settings.png` / `settings.png` | `icon_settings.png` | Home 设置入口 |
| `icon_prev.png` / `btn_prev.png` | `icon_prev.png` | Home 关卡翻页 ← |
| `icon_next.png` / `btn_next.png` | `icon_next.png` | Home 关卡翻页 → |
| `icon_rank.png` / `btn_rank.png` / `rank.png` | `icon_rank.png` | Home 排行入口、RankPopup |
| `icon_share.png` | `icon_share.png` | WinPopup 分享 |
| `icon_close.png` | `icon_close.png` | 各弹窗关闭、锤子模式 ✕ |
| `icon_coin.png` | `icon_coin.png` | HUD 金币、价格挂签 |
| `icon_catcoin.png` | `icon_coin.png` | Home / Win 猫币（如需区分可用 `icon_gift.png`） |
| `icon_home_locked.png` | `icon_lock.png` | Home 锁关 |
| `home.png` | `icon_home.png` | 弹窗「返回主页」 |
| `icon_star_full.png` | `icon_star.png` | Win 三星（亮：`color` 用 `#FFC53D`） |
| `icon_star_empty.png` / `star_off.png` | `icon_star.png` | Win 三星（暗：`color` 用 `#DCC197`） |
| `buttons-sheet.png`（图集） | 已重建为统一线条风（见顶部 ✅ 节） | 孤立资源，已就地统一；确认无引用后可删 |

---

## 3. 本次新增、可直接用上的图标

设计稿带来一批旧工程没有的图标，落到对应位置能补齐 `states.html` / `settings.html` 的细节：

| 新图标 | 建议用途 |
|---|---|
| `icon_music.png` | SettingsPopup / PausePopup 音乐开关 |
| `icon_sound.png` | 音效开关 |
| `icon_vibe.png` | 震动开关 |
| `icon_bell.png` | 提醒 / 通知 |
| `icon_chat.png` | 客服 |
| `icon_info.png` | 隐私政策 / 说明 |
| `icon_heart.png` | 好评 / 喜欢 |
| `icon_invite.png` / `icon_gift.png` | 邀请好友 / 礼包入口 |
| `icon_play.png` | FailPopup 再试一次 / 继续 |
| `icon_restart.png` | 重新开始 |
| `icon_wifioff.png` | 断网空态提示 |

---

## 4. 验收对照

替换后在编辑器 Preview 跑一遍，对照浏览器打开的 `docs/ui-mockup/index.html` 画廊：
- 所有图标为统一暖棕线条，无黑色描边、无玻璃高光残留。
- 圆形图标按钮（暂停/设置/关闭）= 白底 `#FFFDF8` + 暖棕线条，命中区 ≥ 88²。
- `buttons-sheet.png` 不再被任何节点引用（可在编辑器搜索引用确认后删除）。
