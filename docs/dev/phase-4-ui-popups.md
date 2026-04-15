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

**验收标准**：
- [ ] 所有 UI 元素按 `03-ui.md` §2 布局正确
- [ ] 关卡切换正确（不可选未解锁关卡）
- [ ] 点击开始按钮进入对应关卡

---

## Task 4-2：更新游戏内 HUD

**修改文件**：`client/assets/scripts/ui/GameScene.ts` + Game.scene

**内容**：
- 第一行 HUD：暂停按钮 | 金币数 | 回合数 | NEXT 预览
- 第二行道具栏：锤子(15) | 洗牌(15) | 看广告(+10金币)
- 金币数实时更新
- 分数显示（可选位置）
- 溢出倒计时 UI

**验收标准**：
- [ ] HUD 不遮挡游戏区域
- [ ] 金币/分数实时更新
- [ ] 道具按钮金币不足时置灰

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

**暂停弹窗**：继续 | 重新开始 | 返回主菜单
**排行榜弹窗**：好友排名列表 + 我的排名（调用 `/api/rank/friends`）
**设置弹窗**：BGM 开关 + 音效开关

**验收标准**：
- [ ] 暂停时游戏物理暂停，继续后恢复
- [ ] 排行榜正确加载并显示
- [ ] 音效/BGM 开关即时生效并持久化

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
