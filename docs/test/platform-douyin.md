# 抖音小游戏平台专项测试

> 覆盖 `tt` SDK 接入、包体限制、真机兼容、提审合规。
> 参考：[TikTok小游戏调研报告.md](../../TikTok小游戏调研报告.md)、[phase-7-testing.md](../dev/phase-7-testing.md)

---

## 环境准备

- 抖音开发者工具（最新稳定版）
- 真机：至少 1 iOS + 1 Android；覆盖一台低端机（2GB 运存级别）
- 测试用 AppID + 广告位 ID（从抖音开放平台申请）

---

## 包体 / 启动 (TC-PLAT-PKG)

### TC-PLAT-PKG-001  主包体积
- **优先级**：P0
- **步骤**：Cocos Creator 构建 bytedance-mini-game → 查看 build/bytedance-mini-game 目录
- **预期**：主包 ≤ 4 MB

### TC-PLAT-PKG-002  总包体积
- **优先级**：P0
- **预期**：主包 + 所有分包 ≤ 20 MB

### TC-PLAT-PKG-003  资源分包
- **优先级**：P1
- **预期**：非启动必需资源（BGM、后续关卡美术）拆入分包；按需加载不卡住主流程

### TC-PLAT-PKG-004  冷启动耗时
- **优先级**：P0
- **步骤**：真机首次启动（清缓存）
- **预期**：首屏可见 ≤ 3 秒，可交互 ≤ 8 秒

---

## `tt` SDK (TC-PLAT-SDK)

### TC-PLAT-SDK-001  登录
- **优先级**：P0
- **步骤**：冷启动 → 触发 `tt.login`
- **预期**：返回 code，透传给后端换 token；失败有重试

### TC-PLAT-SDK-002  授权获取用户信息
- **优先级**：P1
- **步骤**：调用 `tt.createUserInfoButton` 或 `getUserInfo`
- **预期**：首次弹授权、已授权直接返回；拒绝授权有降级昵称

### TC-PLAT-SDK-003  存储 API
- **优先级**：P1
- **步骤**：`tt.setStorageSync` 写入 token，`tt.getStorageSync` 读取
- **预期**：跨冷启动仍可读到；`tt.removeStorageSync` 能清除

### TC-PLAT-SDK-004  非抖音环境兜底
- **优先级**：P1
- **步骤**：浏览器预览（无 `tt` 全局）
- **预期**：`platform/DouyinSDK` 检测到环境缺失后走 mock 分支，不抛异常

---

## 激励视频 (TC-PLAT-AD)

### TC-PLAT-AD-001  正常观看
- **优先级**：P0
- **步骤**：触发"看广告复活"或"看广告双倍奖励"
- **预期**：播放完整 → 回调 `close({isEnded:true})` → 发放奖励

### TC-PLAT-AD-002  中途关闭
- **优先级**：P0
- **步骤**：广告未播完用户关闭
- **预期**：`close({isEnded:false})` → 不发放奖励 → UI 提示"完整观看才能获得奖励"

### TC-PLAT-AD-003  加载失败
- **优先级**：P1
- **步骤**：断网触发广告
- **预期**：UI 显示"暂无广告，请稍后再试"；不卡死；不扣奖励

### TC-PLAT-AD-004  重复触发
- **优先级**：P2
- **步骤**：快速点击广告按钮多次
- **预期**：只起一个 RewardedVideoAd 实例，不重复播放

### TC-PLAT-AD-005  广告位合法
- **优先级**：P0
- **预期**：生产构建使用正式广告位 ID；测试广告位不泄漏到线上

---

## 分享 (TC-PLAT-SHARE)

### TC-PLAT-SHARE-001  主动分享
- **优先级**：P1
- **步骤**：点击分享按钮 → `tt.shareAppMessage`
- **预期**：成功/取消均有对应回调；成功发放分享奖励（如设计要求）

### TC-PLAT-SHARE-002  分享卡片素材
- **优先级**：P2
- **预期**：title、imageUrl、query 参数与设计一致；进入游戏时 `tt.getLaunchOptionsSync().query` 能取到

---

## 兼容性 (TC-PLAT-COMPAT)

### TC-PLAT-COMPAT-001  iOS 真机
- **优先级**：P0
- **检查点**：登录、通关、广告、分享、排行榜全流程无崩溃

### TC-PLAT-COMPAT-002  Android 真机
- **优先级**：P0
- **检查点**：同上；重点关注不同屏幕比例、刘海屏适配

### TC-PLAT-COMPAT-003  低端机性能
- **优先级**：P1
- **预期**：游戏内 ≥ 30 FPS；无明显掉帧

### TC-PLAT-COMPAT-004  分辨率适配
- **优先级**：P1
- **检查点**：Canvas 按 `tt.getSystemInfoSync` 的 screen 适配；UI 不被刘海遮挡

### TC-PLAT-COMPAT-005  横竖屏
- **优先级**：P2
- **预期**：按项目约定锁定竖屏（或横屏）

---

## 网络 (TC-PLAT-NET)

### TC-PLAT-NET-001  弱网
- **优先级**：P1
- **步骤**：开发者工具设置 3G / 丢包 30%
- **预期**：请求有超时重试；UI 有 loading 状态

### TC-PLAT-NET-002  断网
- **优先级**：P0
- **步骤**：切换飞行模式
- **预期**：GameState 本地缓存成绩；恢复网络后补传

### TC-PLAT-NET-003  进程退后台恢复
- **优先级**：P1
- **步骤**：游戏中切后台 10 秒后回前台
- **预期**：计时/音频/动画恢复一致；不丢当前关进度

---

## 合规 / 提审 (TC-PLAT-REVIEW)

### TC-PLAT-REVIEW-001  隐私协议
- **优先级**：P0
- **检查点**：首次启动弹隐私协议；用户同意前不调用 `tt.login`

### TC-PLAT-REVIEW-002  用户协议
- **优先级**：P0
- **检查点**：设置页或首次弹窗可查看

### TC-PLAT-REVIEW-003  敏感词 / 素材
- **优先级**：P0
- **检查点**：UI 文案、分享卡片、商品描述均符合抖音内容规范

### TC-PLAT-REVIEW-004  未成年人保护
- **优先级**：P1
- **检查点**：按抖音要求展示游戏适龄提示；无诱导付费（本项目 IAA，重点核对广告频次）

### TC-PLAT-REVIEW-005  广告频次
- **优先级**：P1
- **预期**：激励视频用户主动触发；无强制插屏

---

## 执行清单

- [ ] 包体 & 启动指标达标
- [ ] iOS / Android 真机全流程通过
- [ ] 广告 & 分享全路径通过
- [ ] 弱网 / 断网 / 后台切换通过
- [ ] 合规清单全部满足，可提审
