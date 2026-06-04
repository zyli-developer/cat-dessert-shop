# 测试策略重设计

> 日期：2026-04-17
> 取代：`docs/plans/2026-04-15-test-automation-design.md` + `-T1/T2/T3-*.md` 共 5 份（保留存档，前置 `[ARCHIVED 2026-04-17]`）
> 目的：把"写了一堆 spec 但关键 key spec 全 skip、覆盖率报 45% 但是假数字"的测试现状重建为可验证用户操作流程完整性 + 功能实际可用性的分层测试体系。

---

## 决策摘要

| 维度 | 决策 |
|------|------|
| 测试重心 | 用户操作流程完整性 + 每个功能都有用；次要：真机/网络稳定性 |
| 验证深度 | **D3** 全链路一致性（UI 反馈 + 状态变化 + 持久化落盘 + 服务端同步） |
| 覆盖范围 | **R3** 主线 + 所有交互 + 异常路径（L1+L2 共 ~58 条，L3 人工 ~18 条） |
| 测试载体 | **L3 分层**：Jest 状态机 harness / Playwright + Cocos web-mobile 冒烟 / 抖音 IDE 人工 |
| 落地节奏 | **方案 C 分层递进**：X1 基建 → X2 主线 → X3 全量 → X4 收口（15–22 天） |
| Cocos 构建 | **预构建产物 commit 到 repo**（方案 A）；pre-commit hook 校验 asset hash 同步 |
| 覆盖率门槛 | 爬坡式：X1 防倒退下限 → X4 server 90% / client core 85% |

---

## 1. 三层职责边界

### 1.1 第 1 层：Jest 状态机 harness（R3 的 ~75%，~48 条）

**测什么**
- 游戏逻辑：合成 / 掉落 cooldown / 溢出判定 / 订单匹配 / 计分 / 星级
- 数据层：GameState 持久化、`levels.json` / `DessertConfig` schema 自检
- 网络层：ApiClient 正常 / 超时 / 401 清 token / 离线队列 / 重试
- 服务端联调：真实 NestJS `AppModule` + `mongodb-memory-server` + supertest
- 异常路径：token 过期重登、断网入队→联网补传、连点防抖、并发提交

**绝不测**：像素、触摸手势、canvas 渲染、真实动画时序（tween 走 fake timer）。

**运行环境**：Linux CI runner、node 环境（client 用 jsdom，server 用 node）。

**关键约束**：harness 必须**直接 import 生产代码**（`client/assets/scenes/scripts/core/*`、`data/*`、`net/*`），不是复刻一份。依赖第 2 节的可测试性改造。

### 1.2 第 2 层：Playwright + Cocos web-mobile 冒烟（R3 的 ~15%，~10 条）

**测什么**：Cocos 场景真的渲染、按钮真的能点、触摸手势真的投放、DOM 上能读到的 UI 状态。
- 主线一条：登录→主页→选关→游戏→合成→送餐→通关→结算→下一关
- 失败→复活（tt 广告 mock）
- 暂停/设置/分享/排行榜弹窗打开关闭
- 后台回前台

**绝不测**：业务正确性（放 L1）、真 `tt` SDK 行为（放 L3）、FPS/heap（默认 R3 不含；如需，单独 nightly）。

**运行环境**：Playwright chromium + mobile project，每 PR 跑。

**关键约束**：Cocos 代码开 `?e2e=1` 测试 hook——一套只在测试态激活的 `window.__e2e.*` 桥接，**只读 + 事件驱动**，不改业务逻辑。

### 1.3 第 3 层：抖音 IDE + 真机人工冒烟（R3 的 ~10%，~18 条）

**测什么**：自动化无法触碰的真实抖音平台行为。
- `tt.login()` 真 code2session、`tt.createRewardedVideoAd` 真 isEnded、`tt.shareAppMessage` 真面板、`tt.getLaunchOptionsSync` share card 拉起
- 真机渲染差异、包体冷启动、iOS 安全区 / 竖屏锁定
- 合规：隐私政策、未成年人保护、广告频次

**不自动化**，走 `docs/test/manual-douyin-smoke.md` checklist + `catbakery-douyin` MCP 辅助 preview。**提审前必过**。

### 1.4 三层的硬边界（决策表）

任何新用例按此决策表归属：

| 疑问 | 归属层 |
|------|:------:|
| "合成规则错了" | L1 |
| "按钮点了没反应" | L2（业务断言仍在 L1） |
| "`tt.login` 返回 code 格式变了" | L3 |
| "离线补传丢了一条" | L1 |
| "iPhone 安全区 UI 被挡" | L3 |
| "合成动画期间快速连点会 crash" | L1（防抖状态） + L2（动画期间按钮失活） |
| "分数刷新数字不对" | L1 |
| "激励视频 isEnded 回调时机" | L3 |
| "持久化到 storage 又读回来" | L1 |

### 1.5 边界取舍

**取**：L1 吃 75% 意味着大部分用例跑在 Jest 里而非 Playwright 里 → 秒级反馈、极少 flaky。
**舍**：L1 抓不到 Cocos 渲染层 bug（L2 兜）；L2 抓不到抖音 runtime 特有 bug（L3 兜）。L3 **必须存在**，不是可选项。

---

## 2. 生产代码可测试性改造清单

~385 行改动，全部向后兼容、非测试态零副作用。

### 2.1 A 类：依赖注入（7 文件，~70 行，纯 refactor）

| 文件 | 改造 | 默认行为 |
|------|------|------|
| `core/CustomerManager.ts` | 可选 `rng?: () => number` | `Math.random` |
| `core/DropController.ts` | 可选 `clock?: () => number` | `Date.now` |
| `core/OverflowDetector.ts` | 可选 `clock?: () => number` | 同上 |
| `net/ApiClient.ts` | 可选 `fetchImpl?: typeof fetch` | `globalThis.fetch` |
| `data/GameState.ts` | 可选 `storage?: IKVStorage` | 探测 `tt` / `localStorage` |
| `server/src/auth/code-exchanger.ts` | ✅ 已完成（`DouyinCodeExchanger` + `StubCodeExchanger`） | — |
| `server/src/db/mongo-uri.ts` | ✅ 已完成（`getMongoUri` 可测） | — |

### 2.2 B 类：脚手架补实现（4 处，~150 行）

这些是 D3 + "每个功能都有用"的隐含要求；测试只是倒逼它们从 no-op 变成真功能。

| 功能 | 现状 | 改造 | 触发用例 |
|------|------|------|------|
| **B-1 GameState 持久化** | `storage` 已抽但 production code 不 call | `saveProgress()` / `loadProgress()` 真读写 | TC-STATE-002 退出回断点 |
| **B-2 ApiClient 离线队列** | 无 | 写路径失败入队 `pending_queue`；`tt.onNetworkStatusChange` + foreground 触发 `flushQueue()` | TC-NET-001 断网补传 |
| **B-3 ApiClient 401 清 token** | 401 不处理 | 拦截 401 → 清 token → emit `onUnauthorized` | TC-AUTH-003 / TC-NET-004 |
| **B-4 CustomerManager 订单超时** | 无 per-order timeout | `order.deadline` + tick 检查 → `onOrderTimeout` 回调 | TC-CUST-003 |

### 2.3 C 类：E2E 测试 hook（~80 行新文件）

新增 `client/assets/scenes/scripts/testing/e2eBridge.ts`：

```ts
if (new URL(location.href).searchParams.get('e2e') === '1') {
  (window as any).__e2e = {
    drop: (type: DessertType, x: number) => ...,
    getState: () => snapshot(gameState),
    completeRound: () => ...,
    openPopup: (name: PopupName) => ...,
    tick: (ms: number) => tween.update(ms),
  };
}
```

严格**只读 + 事件驱动**，不修改业务；`CC_DEBUG` 开关可进一步 tree-shake。

### 2.4 D 类：Server 补齐（~10 行）

- `server/src/main.ts` 的 `ValidationPipe` 加 `whitelist: true, forbidNonWhitelisted: true`（FU-T1-05）
- `progress.dto.ts` 的 `round` 加 `@Min(1) @Max(10)`、`score` 加 `@Min(0)`（FU-T1-06/07）

**注意**：严格化 pipe 可能拒掉当前客户端某些请求 → X1 诊断阶段先跑一遍历史请求看有无误伤。

### 2.5 E 类：覆盖率仪器化修复（~15 行配置）

- Server e2e：Jest `--coverage-provider=v8`（FU-T1-01）
- Scripts ESM：同上（FU-T1-02）

修完后当前 "45% 假数字" 会变成真值作为 X1 基线。

### 2.6 F 类：Jest harness 入口包（~60 行新文件）

新增 `client/tests/harness/gameHarness.ts`：

```ts
export function createGameHarness(opts?: {
  rng?: () => number;
  clock?: () => number;
  storage?: IKVStorage;
  fetchImpl?: typeof fetch;
}) {
  // 组合 core/data/net 全部生产模块 + 注入的 fake 外部依赖
  // 返回一个可驱动的"无 Cocos 场景图游戏实例"
}
```

L1 所有 spec 基于同一 harness，避免 init 漂移。

### 2.7 向后兼容保证

- A 类全部可选参数、默认行为不变
- B 类补的是原本 no-op 的方法、API 签名不变
- C/F 类是新文件、不改现有路径
- D 类严格化需 X1 诊断确认无误伤
- E 类只改 config

---

## 3. R3 用例到三层的分配

### 3.1 用例总表

| 层 | 数量 | 执行频率 |
|---|:---:|---|
| **L1 Jest** | ~48 | 每 PR，~40s |
| **L2 Playwright** | ~10 | 每 PR，~3min |
| **L3 人工** | ~18 | 提审前，半天 |

### 3.2 按功能域

**① 登录/认证（6）**
- TC-AUTH-001 首次 login 链路（L1）
- TC-AUTH-002 token 免登（L1）
- TC-AUTH-003 token 过期→重登（L1，⚠ B-3）
- TC-AUTH-004 伪造/缺失 token 拦截（L1）
- TC-AUTH-005 登录态切换 UI（L2）
- TC-AUTH-006 真 `tt.login` code 交换（L3）

**② 核心循环：投放/合成/送餐（12）**
- TC-DROP-001..004（L1）
- TC-MERGE-001..005（L1）
- TC-CUST-001..002 RNG 确定性 + 匹配（L1）
- TC-CUST-003 订单超时（L1，⚠ B-4）

**③ 失败/复活/重试（5）**
- TC-OVER-001..003（L1，fake timer）
- TC-FAIL-001 复活广告（L1 mock + L2 视觉）
- TC-FAIL-002 重新挑战（L1）

**④ 结算/星级/进度（6）**
- TC-SCORE-001..003 分数/星级/猫币（L1）
- TC-SCORE-004 历史刷星（L1）
- TC-PROG-001..002 解锁 / 第 10 关回主页（L1）

**⑤ 持久化/重进（5，D3 核心）**
- TC-STATE-001 序列化往返（L1）
- TC-STATE-002 退出→重进（L1 + L2，⚠ B-1）
- TC-STATE-003 storage 清空降级（L1）
- TC-STATE-004 schema 版本降级（L1）
- TC-STATE-005 `levels.json` / `DessertConfig` schema 自检（L1）

**⑥ UI/弹窗/设置（8）**
- TC-UI-HOME 主页展示（L2）
- TC-UI-PAUSE 暂停 + 继续/重开/回主页（L1 + L2）
- TC-UI-SETTINGS 音效/BGM 持久化（L1）
- TC-UI-RANK 排行榜加载 + 渲染（L1 + L2）
- TC-UI-SHARE 分享按钮（L2）
- TC-UI-ITEM-001..002 锤子 / 洗牌（L1）

**⑦ 广告位（5）**
- TC-AD-REVIVE / COIN / CATCOIN / DOUBLE（L1 mock）
- TC-AD-REAL-001..002 真激励视频 + 生产 ad unit（L3）

**⑧ 社交/排行榜（3）**
- TC-RANK-001 `$max` 原子性（L1 supertest）
- TC-RANK-002 并发提交（L1）
- TC-RANK-003 好友排名（L1 + L2）

**⑨ 网络异常/离线（6，D3 核心）**
- TC-NET-001 **断网→入队→联网→补传**（L1，⚠ B-2）
- TC-NET-002 弱网超时重试（L1）
- TC-NET-003 5xx 错误提示（L1）
- TC-NET-004 401 自动重登（L1，⚠ B-3）
- TC-NET-005 连点防抖（L1 + L2）
- TC-NET-006 后台→前台（L2 + L3）

**⑩ 服务端安全/校验（4）**
- TC-SEC-001 token 拦截（L1）
- TC-SEC-002 超大 body / 非法 JSON（L1）
- TC-VALID-001 ValidationPipe 白名单（L1）
- TC-VALID-002 DTO 边界（L1，⚠ D）

**⑪ 抖音平台专项（L3 × 18）**
- TC-PLAT-SDK-001..004 tt.login/storage/share/launchOptions
- TC-PLAT-AD-001..005 真激励视频
- TC-PLAT-COMPAT-001..005 iOS/Android/低端/刘海/竖屏
- TC-PLAT-PKG-001..004 主包≤4MB / 总包≤20MB / 冷启动

### 3.3 前置依赖速查

L1 层 6 条用例的绿灯需要生产代码先补完，对应 X2 阶段的实际工作单元：

| 依赖 | 位置 | 解锁用例 |
|---|---|---|
| FU-T2-01 GameState 持久化 | §2.2 B-1 | TC-STATE-002 |
| FU-T2-02 离线队列 | §2.2 B-2 | TC-NET-001 |
| FU-T2-03 401 清 token | §2.2 B-3 | TC-AUTH-003 / TC-NET-004 |
| FU-T2-04 订单超时 | §2.2 B-4 | TC-CUST-003 |
| FU-T1-06/07 DTO 边界 | §2.4 D | TC-VALID-002 |

### 3.4 显式删除

- 删 `e2e/specs/long-run.spec.ts` 里 `test.skip('TC-E2E-LONG-001')`（fallback-shell-only）
- 删 `e2e/specs/playthrough.spec.ts` 里 `test.skip('TC-E2E-001 real playthrough')`（fallback-shell-only）
- 删 `e2e/static/`、`e2e/fixtures/shell-compat.ts`（fallback shell 整体废弃）
- 合并 `docs/dev/phase-7-testing.md` 的 Task 7-1..7-5 手工清单到 L3 手册

---

## 4. Cocos 构建 + CI 策略

### 4.1 Cocos web-mobile 构建策略：方案 A（预构建产物 commit）

- 新增 `npm run build:e2e-bundle` → 调用 Cocos Creator CLI 构建 web-mobile
- 产物 commit 到 `e2e/dist/web-mobile/`（预计 5–10 MB，直接进 git，无需 LFS）
- 产物根目录维护 `__asset-hash`（= `assets/**` + `settings/**` hash）
- pre-commit hook `scripts/check-e2e-bundle-freshness.mjs`：
  - 扫 `assets/**` 变更
  - 若 hash 与 `__asset-hash` 不匹配 → block commit，提示"请跑 `npm run build:e2e-bundle`"
- 责任清晰：谁改 asset 谁本地 rebuild + commit；纯代码贡献者不受影响

### 4.2 CI workflow 结构

```
server ─┐
client ─┼──→ e2e ──→ coverage
scripts ┘
```

| Job | 跑什么 | 时长 | 失败行为 |
|---|---|:---:|---|
| server | `test:server` + `test:server:e2e` | ~40s | 阻塞 |
| client-unit | `test:client`（harness + jsdom） | ~20s | 阻塞 |
| scripts-unit | `test:scripts` | ~15s | 阻塞 |
| e2e | Playwright chromium + mobile | ~3min | 阻塞；保存 trace/video 14 天 |
| coverage | nyc 合并 + 阈值检查 | ~20s | 阈值低于门槛 fail |

**总 wall-clock ≤ 6min**。

### 4.3 覆盖率门槛（爬坡式）

| 阶段 | server 行 | client core 行 |
|---|:---:|:---:|
| X1 末 | 实测基线（防倒退下限） | 实测基线 |
| X2 末 | 75% | 70% |
| X3 末 | 85% | 80% |
| X4 末 | **90%** | **85%** |

**原则**：每次只升 5–10 点；必须在上阶段 CI 稳定一周后才升。Scripts 不上数值门槛，改为"每个导出函数 ≥ 1 条 spec"。

### 4.4 Skip 纪律

**禁止裸 skip**。所有 `test.skip(...)` / `describe.skip(...)` 必须带 reason 注释：

```ts
// SKIP-REASON: FU-T2-01 GameState persistence pending, tracked in
//   docs/plans/2026-04-17-testing-strategy-design.md §2.2 B-1
test.skip('TC-STATE-002 exit→resume restores progress', ...);
```

**CI lint**：`scripts/lint-skip-reasons.mjs` 扫无 reason 的 skip → fail。

**允许的 skip**：
- 依赖未完成的生产代码（指向 FU-TX-XX）
- 依赖 L3 人工
- 已知 flaky 被隔离到 nightly（指向 Issue）

**不允许**："暂时先 skip 待定"。

**Skip 清单**：`npm run skip-report` 生成 `docs/test/skip-inventory.md`，每周 review。

### 4.5 Flaky 应对

| 工具 | 策略 |
|---|---|
| Playwright retries | CI 2 / 本地 0（`process.env.CI`） |
| Trace / Video | `retain-on-failure` |
| 异步等待 | 禁 `page.waitForTimeout()`，全用 `expect.poll()` / `toPass()` |
| 连续 flake ≥ 3/10 次 | 自动打 `nightly-only` 标签、对应 Issue |
| L1 状态机 | 时间全走 fake timer，从根上排除时序 flaky |

**Nightly workflow**：`.github/workflows/nightly.yml` 跑 `nightly-only` 标签 + 全量 Playwright（未来 heap/FPS 位预留）。

---

## 5. X1–X4 分期交付物

### 5.1 X1 — 基建 + 诊断（3–5 天）

**交付物**
1. `docs/test/2026-04-17-baseline.md` 诊断报告（34 个 spec 红/绿/skip 清单 + 真实覆盖率）
2. 覆盖率仪器化修复（FU-T1-01/02）
3. Jest harness 入口包（§2.6 F）
4. `npm run build:e2e-bundle` + 首次产物 commit + pre-commit hook
5. 删除 fallback shell 路径（`e2e/static/`、`shell-compat.ts`、两条 test.skip）
6. Skip 纪律工具 + 所有现存 skip 补 reason 或删除
7. CI 覆盖率"防倒退下限"

**验收**：`npm run test:all` 一条命令跑通；CI 全绿；基线报告合入。

**合入闸门**：X1 一次性合入 main（或短命集成分支）。

### 5.2 X2 — 主线 + 高优异常（5–7 天，6 个 PR）

| PR | 用例（红） | 生产改动（绿） |
|---|---|---|
| P1 | TC-STATE-001..005 | FU-T2-01 持久化（§2.2 B-1） |
| P2 | TC-NET-001 | FU-T2-02 离线队列（§2.2 B-2） |
| P3 | TC-AUTH-003 / TC-NET-004 | FU-T2-03 401 清 token（§2.2 B-3） |
| P4 | TC-CUST-003 | FU-T2-04 订单超时（§2.2 B-4） |
| P5 | TC-DROP/MERGE/OVER/SCORE | §2.1 A 依赖注入 |
| P6 | TC-AUTH / TC-RANK / TC-SEC / TC-VALID | FU-T1-05/06/07（§2.4 D） |

**验收**：L1 ~40 条全绿；覆盖率升至 server 75% / client core 70%；每个脚手架补实现对应一条 spec。

**合入闸门**：6 个 PR 独立 review & 合入。

### 5.3 X3 — R3 全量 + 次优异常（5–7 天）

**交付物**
- L1 扩展 ~8 条（广告 mock / 弱网 / 5xx / 防抖 / 道具 / 设置）
- L2 Playwright 冒烟 ~10 条（登录态切换 / 弹窗 / 重进读档 / 排行榜 / 复活 / 后台前台 / 主线通关 / 失败→复活通关）
- L3 执行手册重写：新 `docs/test/manual-douyin-smoke.md`（合并 `e2e/smoke-douyin-cli.md` + `docs/dev/phase-7-testing.md` 平台项，18 条 TC-PLAT-xxx）

**验收**：L1+L2 共 ~58 条全绿；CI wall-clock ≤ 6min；覆盖率升至 server 85% / client core 80%。

**合入闸门**：2–3 个 PR。

### 5.4 X4 — 收口（2–3 天）

**交付物**
1. 覆盖率门槛最终值：server 90% / client core 85%（需 X3 稳定一周后才升）
2. 文档清理
   - `docs/dev/phase-7-testing.md` 重写为 L3 三层执行手册
   - `docs/dev/README.md` 状态表更新
   - `README.md` 加 Codecov 徽章 + `npm run test:all` 段
3. `.github/workflows/nightly.yml`（nightly-only 标签 + 全量 Playwright）
4. `docs/test/README.md` 贡献者指引（新用例归属决策表、cc stub 扩展、skip 审查流程）

**验收**：覆盖率门槛达标；新贡献者按 `docs/test/README.md` 能独立添加 R3 用例。

---

## 6. 文档清理总览

| 现状 | 动作 | 去向 |
|---|---|---|
| `docs/dev/phase-7-testing.md`（手工清单 Task 7-1..7-5） | 重写 | L3 执行手册的"自动化触发 + 人工章节" |
| `e2e/smoke-douyin-cli.md` | 合并 | `docs/test/manual-douyin-smoke.md` |
| `docs/plans/2026-04-15-test-automation-*.md`（5 份） | 归档标记 | 前置 `[ARCHIVED 2026-04-17 — 取代见 2026-04-17-testing-strategy-design.md]` |
| 本文档 | 新建 | 唯一权威测试设计 |
| `docs/test/README.md` | 新建 | 开发者日常入口 |

---

## 7. 整体时长

| 阶段 | 天数 |
|---|:---:|
| X1 基建 | 3–5 |
| X2 主线 | 5–7 |
| X3 全量 | 5–7 |
| X4 收口 | 2–3 |
| **合计** | **15–22 天**（1 人全投入） |

并行开发其他 Phase 时 × 1.5。

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 严格化 ValidationPipe 拒掉历史客户端请求 | X1 诊断阶段先跑历史请求（从 e2e 产物抓 network trace），确认无误伤再切 |
| Cocos 构建产物 commit 让 repo 变大 | 预估 5–10 MB、可接受；若超 30 MB 再评估 LFS |
| B 类 4 个脚手架补实现引新 bug | X2 拆成 4 个独立 PR，每 PR 配套 spec 作为 regression guard |
| Playwright + Cocos WebGL flaky | 减少 L2 用例数量（只保 10 条）、全部使用 `expect.poll`、fake timer 控制 tween |
| L3 人工冒烟没人执行 | 列入提审闸门 + `docs/test/manual-douyin-smoke.md` 的 Sign-off 表强制三角色签名 |
| 覆盖率门槛一把拉满阻塞 PR | 分 4 期爬坡，每期稳定一周后再升 |

---

## 9. 下一步

本设计通过后：
1. commit 本文档到 `docs/plans/2026-04-17-testing-strategy-design.md`
2. 调用 `superpowers:writing-plans` 生成 X1 / X2 / X3 / X4 四份可执行实施计划
3. 从 X1 开始按顺序执行
