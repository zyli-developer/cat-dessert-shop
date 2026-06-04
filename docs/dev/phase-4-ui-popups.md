# Phase 4：UI 界面与弹窗

> 依赖：Phase 3（关卡系统）+ Phase 5（后端排名 API）
> 产出：完整 UI 流程，所有弹窗可用
> 参考：[03-ui.md](../plans/03-ui.md)

---

## Task 4-1：更新主页界面

**修改文件**：`client/assets/scripts/ui/HomeScene.ts` + Home.scene

**内容**：
- 替换背景为 bg_home.png
- Logo 展示
- 当前关卡号 + 星级显示（⭐⭐☆）
- 左右箭头切换已解锁关卡
- 开始游戏大按钮
- 猫币余额显示 + 总星数进度（如 "18/30 ⭐"）
- 悬浮按钮：排行榜、设置
- 家园预告按钮（灰色，不可点击）
- 猫币广告按钮（看广告 +10 猫币）
- 底部三入口：排行榜 / **每日礼包**（每日 1 次，见 Task 4-7，M3）/ 免费猫币（看广告 +10）

**验收标准**：
- [ ] 所有 UI 元素按 `03-ui.md` §2 布局正确
- [ ] 关卡切换正确（不可选未解锁关卡）
- [ ] 点击开始按钮进入对应关卡

---

## Task 4-2：更新游戏内 HUD

**修改文件**：`client/assets/scripts/ui/GameScene.ts` + Game.scene

**内容（M1：以设计稿 game.html 为准）**：
- 顶部 HUD：暂停按钮（左）| 订单进度面板（第N关 + 已服务/总数 + 进度条）| 金币芯片（右）| 下方居中分数
- 顾客区：容器**上方横排**同时最多 3 位活跃顾客 + 各自需求气泡（图标 + x/y 进度），离场补位
- 容器：杯型 400×600 居中 + 警戒线；当前元素顶部居中 + 落点引导线；**NEXT 预览在容器右上侧**
- **底部道具栏**：锤子(15) | 洗牌(15) | 看广告(+10金币)（金币购买制，无次数角标）
- 起手金币 **15**（用一次道具即归零 → 引导看广告，B1）
- 溢出倒计时 UI（边缘红光 + 中央 5→1）

**验收标准**：
- [ ] HUD 不遮挡游戏区域
- [ ] 金币/分数实时更新
- [ ] 道具按钮金币不足时置灰（去色 + 锁 + 引导看广告）
- [ ] NEXT 在容器右上侧、道具栏在底部、顾客在容器上方（与 game.html 一致）

---

## Task 4-3：创建通关结算弹窗 Prefab

**新建文件**：
- `client/assets/prefabs/popups/WinPopup.prefab`
- `client/assets/scripts/ui/popups/WinPopup.ts`

**内容**：
- 星级评价展示（1-3 星动画）
- 得分显示
- 猫币奖励
- 本关好友排名列表（调用 `/api/rank/friends?round=N`）
- 按钮：看广告翻倍 | 分享 | 下一关

**验收标准**：
- [ ] 星级动画正确（星星逐个亮起）
- [ ] 好友排名正确显示，自己高亮
- [ ] 下一关按钮正确切换关卡
- [ ] 最后一关时显示"返回主页"而非"下一关"

---

## Task 4-4：创建失败结算弹窗 Prefab

**新建文件**：
- `client/assets/prefabs/popups/FailPopup.prefab`
- `client/assets/scripts/ui/popups/FailPopup.ts`

**内容**：
- 显示当前分数（不结算星级和猫币）
- 看广告复活按钮（清除容器 Y > 50% 高度的甜品，每关限 1 次）
- 重新挑战 / 返回主页按钮

**验收标准**：
- [ ] 复活正确清除上半部分甜品
- [ ] 复活后继续当前关卡
- [ ] 每关只能复活 1 次，已用过则按钮隐藏

---

## Task 4-5：创建暂停/排行榜/设置弹窗 Prefab

**新建文件**：
- `client/assets/prefabs/popups/PausePopup.prefab` + `PausePopup.ts`
- `client/assets/prefabs/popups/RankPopup.prefab` + `RankPopup.ts`
- `client/assets/prefabs/popups/SettingsPopup.prefab` + `SettingsPopup.ts`

**暂停弹窗**：继续 | 重新开始 | 返回主菜单（含音乐/音效就地开关）
**排行榜弹窗**：好友 / 全国切换 + **本周最佳（周榜）** + 前三领奖台 + 我的高亮行 + 空态邀请入口
  （调用 `/api/rank/friends`(默认按分数) / `/api/rank/global` / `/api/rank/weekly`，M6）
**设置弹窗**：音乐 / 音效 / 震动 开关 + 联系客服 / 给个好评 / 隐私政策（**无"营业提醒/体力"开关**，M5）

**验收标准**：
- [ ] 暂停时游戏物理暂停，继续后恢复
- [ ] 排行榜支持好友/全国/周榜切换，空榜显示邀请入口，"我"高亮
- [ ] 音效/BGM/震动 开关即时生效并持久化

---

## Task 4-6：实现弹窗管理器

**新建文件**：`client/assets/scripts/ui/PopupManager.ts`

**内容**：
- 统一管理弹窗的加载/显示/销毁
- `PopupManager.show('WinPopup', data)` → 加载 Prefab → 实例化 → 显示
- 弹出时添加半透明黑色遮罩
- 关闭时销毁节点
- 防止重复弹出

**验收标准**：
- [ ] 所有弹窗通过 PopupManager 统一调用
- [ ] 遮罩正确显示/隐藏
- [ ] 不可同时显示多个弹窗

---

## Task 4-7：每日礼包弹窗 Prefab（M3 · MVP 新增）

**新建文件**：`client/assets/prefabs/popups/DailyGiftPopup.prefab` + `client/assets/scripts/ui/popups/DailyGiftPopup.ts`

**内容**：
- 主页"每日礼包"入口（按 `profile.dailyGiftAvailable` 显示红点）→ 点击弹出
- 每日免费领 **+20 猫币**（免广告）→ `POST /api/user/daily-gift/claim`
- 领取后可选**看广告翻倍** → 当日 +20→+40（第 5 广告位）→ 广告成功后 `POST /api/user/daily-gift/double`；该入口仅在**通关第 2 关后**（currentRound>2）出现
- server-authoritative：服务端按 Asia/Shanghai 0 点刷新；**必须联网领取**（离线只提示，不本地发放）
- 领取后红点消失，猫币飞入 + Toast

**验收标准**：
- [ ] 每日仅可领 1 次，跨自然日(CST)刷新
- [ ] 翻倍仅在「当日已领且未翻倍」且广告成功时入账
- [ ] 改设备时钟无法重复领取（服务端判定）
- [ ] 离线不发放，联网后可领

---

## Task 4-8：加载页登录状态 + 激励视频失败反馈（M8）

**修改文件**：`client/assets/scripts/ui/LoadingScene.ts` + 各广告调用方

**内容**：
- 加载页：登录成功 → Home；**登录失败 / 授权拒绝 → "重新登录"重试 + "离线模式"兜底**（参考 loading.html / states.html D4）
- 激励视频**无填充 / 加载失败**：不扣道具、不发奖励，顶部 Toast"暂无广告，请稍后再试"，按钮保持可点重试（states.html D3）

**验收标准**：
- [ ] 登录失败有重试与离线兜底，不卡死在加载页
- [ ] 广告拉取失败时道具/奖励状态不被错误改动
