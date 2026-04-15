# Phase 6：变现与社交

> 依赖：Phase 4（UI/弹窗就位）
> 产出：4 个广告位接入 + 分享功能
> 参考：[04-economy.md](../plans/04-economy.md)

---

## Task 6-1：接入激励视频广告

**修改文件**：`client/assets/scripts/platform/DouyinSDK.ts`

**内容**：
- 封装 `tt.createRewardedVideoAd` 调用
- 创建广告实例（需要抖音后台申请广告位 ID）
- 统一接口：`DouyinSDK.showRewardedAd(adId): Promise<boolean>`
- Dev 环境 fallback：模拟广告完成，返回 true

**验收标准**：
- [ ] Dev 环境下调用不报错，模拟成功
- [ ] 接口返回 Promise，成功/失败/关闭三种状态处理正确

---

## Task 6-2：接入 4 个广告位

**修改文件**：
- `client/assets/scripts/ui/GameScene.ts`（道具栏广告）
- `client/assets/scripts/ui/popups/FailPopup.ts`（复活广告）
- `client/assets/scripts/ui/HomeScene.ts`（主页猫币广告）
- `client/assets/scripts/ui/popups/WinPopup.ts`（通关翻倍广告）

**4 个广告位**：

| 广告位 | 触发 | 奖励 | 限制 |
|--------|------|------|------|
| 道具栏 | 点击 📺 按钮 | +10 金币 | 无限制 |
| 复活 | 点击失败弹窗"看广告复活" | 清除容器上半部分甜品 | 每关 1 次 |
| 主页猫币 | 点击主页广告按钮 | +10 猫币 | 无限制 |
| 通关翻倍 | 点击通关弹窗"翻倍" | 猫币奖励 x2 | 每关 1 次 |

**验收标准**：
- [ ] 4 个广告位均可触发（Dev 环境模拟）
- [ ] 奖励正确发放
- [ ] 限制正确执行（复活和翻倍每关限 1 次）
- [ ] 前 2 关不显示广告（首次体验保护）

---

## Task 6-3：实现分享功能

**修改文件**：
- `client/assets/scripts/platform/DouyinSDK.ts`
- `client/assets/scripts/ui/popups/WinPopup.ts`

**内容**：
- 通关结算页"分享"按钮
- 调用 `tt.shareAppMessage`：
  - title："我在猫咪甜品店第 N 关获得了 ⭐⭐⭐，快来挑战！"
  - imageUrl：游戏截图或预设分享图
  - query：`round=N&score=XXX`（用于追踪来源）
- Dev 环境 fallback：console.log 分享内容

**验收标准**：
- [ ] 分享按钮可点击
- [ ] 分享文案正确拼接关卡号和星级
- [ ] Dev 环境不报错

---

## Task 6-4：猫币广告体系联调

**修改文件**：
- `client/assets/scripts/data/GameState.ts`
- `client/assets/scripts/net/ApiClient.ts`

**内容**：
- 主页看广告 +10 猫币 → 本地更新 + 上报服务端
- 通关翻倍 → 猫币 x2 后上报
- 确保猫币数据在 GameState、主页显示、后端三处一致
- 网络断开时本地缓存，恢复后同步

**验收标准**：
- [ ] 猫币变化在 UI 上实时更新
- [ ] 服务端猫币与本地一致
- [ ] 离线看广告后恢复网络能同步
