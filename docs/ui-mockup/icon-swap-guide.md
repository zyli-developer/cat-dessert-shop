# 图标替换指南（编辑器手动步骤）

> 配套脚本：`scripts/rasterize_icons.js` 已把 `icons-export/svg/` 的 26 枚统一线条图标
> 栅格化为 PNG，输出到 **`client/assets/textures/ui/icons-v2/`**（144²，暖棕 `#5A4636` 线条，透明底）。
>
> 这些 PNG 不会自动替换场景里的贴图——SpriteFrame 的指定必须在 Cocos 编辑器手动完成。
> 故意放到 `icons-v2/` 新目录而非覆盖旧 `icon_*.png`，**便于回退**。

---

## 0. 生成 / 刷新 PNG

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
| `buttons-sheet.png`（图集） | 拆成上面各 `icon_*` | 该扁平图集整体弃用，逐个换成线条图标 |

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
