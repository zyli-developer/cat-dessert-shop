# 测试自动化落地设计

> 日期：2026-04-15
> 前置：[docs/test/README.md](../test/README.md) 五份测试用例文档
> 目的：将现有手工 test case 100% 落地为可自动化执行的 CI 方案；覆盖 server / client / E2E / scripts 四条链；双 E2E 轨道（Playwright + 抖音 CLI 冒烟）。

---

## 背景与决策记录

| 决策点 | 选择 | 说明 |
|------|------|------|
| 评估目的 | 为写自动化测试做准备 | 聚焦可执行测试，找 doc 里"描述了但没落地"的缺口 |
| 技术栈范围 | 全量四链 | server + client 纯逻辑 + 无头 E2E + scripts |
| 产出形式 | 完整落地设计 | 含目录结构、CI、mock 策略、覆盖率、首批 spec 清单 |
| 覆盖率目标 | 严格线 | server ≥ 90% / service ≥ 95%；client core ≥ 85%；所有 P0+P1 E2E 覆盖 |
| E2E 工具 | 双轨并行 | Playwright 日常 CI；抖音 CLI 提审前人工冒烟 |
| CI 接入 | GitHub Actions + npm scripts 双入口 | 统一 `test:all` 命令；`.github/workflows/test.yml` 调用之 |
| 仓库结构 | npm workspaces 单仓 | 方案 A：根统一编排，各链独立配置 |
| 准确度升级 | A + B 都加 | jsdom + rAF tween；Playwright specs 扩量（long-run / perf） |
| Cocos 构建产物 CI | GitHub Actions 缓存 | `actions/cache` key 绑定 `client/assets/**` hash |

---

## 1. 目录结构（单仓 + npm workspaces）

```
mini-game/
├── package.json                      # workspaces 根 + 统一入口 script
├── tsconfig.base.json                # 共享 strict TS 选项
├── .github/workflows/test.yml        # CI 入口
├── coverage/                         # 合并后的 lcov（gitignored）
│
├── server/                           # 保留 + 新增 test/
│   ├── src/**/*.spec.ts
│   └── test/
│       ├── auth.e2e-spec.ts
│       ├── user.e2e-spec.ts
│       ├── rank.e2e-spec.ts
│       └── jest-e2e.json
│
├── client/
│   ├── assets/scenes/scripts/**      # 生产代码（少量可测试性改造）
│   └── tests/                        # 独立 workspace
│       ├── package.json
│       ├── jest.config.ts
│       ├── setup.ts
│       ├── __mocks__/cc.ts           # 手写 Cocos stub
│       ├── core/
│       │   ├── MergeManager.spec.ts
│       │   ├── DropController.spec.ts
│       │   ├── Container.spec.ts
│       │   ├── OverflowDetector.spec.ts
│       │   ├── CustomerManager.spec.ts
│       │   └── ScoreManager.spec.ts
│       ├── data/
│       │   ├── GameState.spec.ts
│       │   ├── DessertConfig.spec.ts
│       │   └── levels.spec.ts        # levels.json schema 自检
│       └── net/
│           └── ApiClient.spec.ts
│
├── e2e/                              # Playwright workspace
│   ├── package.json
│   ├── playwright.config.ts
│   ├── scripts/build-web-mobile.mjs
│   ├── fixtures/
│   │   ├── tt-mock.ts
│   │   ├── api-helpers.ts
│   │   ├── global-setup.ts
│   │   └── global-teardown.ts
│   ├── specs/
│   │   ├── auth-flow.spec.ts
│   │   ├── playthrough.spec.ts
│   │   ├── fail-retry.spec.ts
│   │   ├── rank.spec.ts
│   │   ├── offline-resubmit.spec.ts
│   │   ├── ad-share.spec.ts
│   │   ├── network.spec.ts
│   │   ├── long-run.spec.ts          # 升级 B
│   │   └── perf.spec.ts              # 升级 B
│   └── smoke-douyin-cli.md           # 提审前人工冒烟
│
└── scripts/
    ├── generate_images.js            # 现有
    ├── process_images.js
    ├── optimize_scenes.js
    ├── cocos-mcp-proxy.mjs
    └── tests/
        ├── package.json
        ├── jest.config.ts
        ├── generate_images.spec.js
        ├── process_images.spec.js
        ├── optimize_scenes.spec.js
        └── cocos-mcp-proxy.spec.mjs
```

---

## 2. 四条测试链技术栈与 Mock 策略

### 链 1：Server 单元 + E2E
- **框架**：Jest 30 + supertest
- **DB**：`mongodb-memory-server`；每 spec 独立实例、`afterEach` 清集合
- **Nest 构建**：`@nestjs/testing.TestingModule`
- **E2E**：`server/test/*.e2e-spec.ts` 启动完整 `AppModule` 打真实 HTTP
- **Mock 点**：抖音签名校验通过 `CodeExchanger` provider 注入 stub

### 链 2：Client 纯逻辑单元（jsdom + 手写 cc stub）
- **框架**：Jest 30 + ts-jest + `jest-environment-jsdom`
- **`cc` Mock**：`client/tests/__mocks__/cc.ts` 手写最小表面
  - `Node` / `Component`：空基类，生命周期为空函数
  - `Vec3` / `Vec2`：`add / sub / length / clone`
  - `tween`：链式 `.to / .by / .delay / .call / .start`；升级 A：`call` 通过 `requestAnimationFrame` 触发而非立即执行
  - `director` / `resources`：`jest.fn()` stub
  - `_decorator`：`ccclass` / `property` 返回 no-op
- **覆盖范围**：`core/` 全部、`data/` 全部、`net/ApiClient`
- **不覆盖**：`ui/`（依赖真实节点树）、`platform/`（放 E2E）

### 链 3：E2E Playwright（+ 抖音 CLI 冒烟）
- **Playwright（日常 CI）**
  - 构建产物：Cocos `web-mobile` 输出到 `e2e/dist/web-mobile/`
  - `tt` Mock：`fixtures/tt-mock.ts` 通过 `page.addInitScript` 注入 `window.tt`
  - Server：`globalSetup` 启动真实 NestJS（内存 DB，端口 4568）；静态服务器 4567
  - 网络场景：`page.route()` 模拟弱网 / 断网 / 5xx
  - 投影：`chromium` + `mobile (375x812)` 两个 project
- **抖音 CLI（提审前人工）**
  - `e2e/smoke-douyin-cli.md` 清单：真实 `tt.login` / 激励视频 / 包体 / 真机兼容 / 合规

### 链 4：Scripts 单元
- **框架**：Jest（Node 环境）
- **Mock**：`sharp` 用 `jest.mock('sharp')` 返回 stub；fs 用 `os.tmpdir()` 真实 I/O
- **目标**：每个导出函数 ≥ 1 条 happy path + 1 条错误路径

### Mock 策略总表

| 被 Mock 对象 | 所在链 | 实现方式 |
|------|------|------|
| `cc` 模块 | client 单元 | `moduleNameMapper` → 手写 stub |
| `fetch` | client 单元 | `jest.fn()` 全局替换 |
| `tt` 全局 | client 单元 / E2E | 单元 setup.ts 注入；E2E `addInitScript` |
| MongoDB | server | `mongodb-memory-server` |
| 抖音签名校验 | server | `CodeExchanger` provider |
| `sharp` | scripts | `jest.mock` |
| 文件系统 | scripts | `os.tmpdir()` 真实 I/O |

---

## 3. 测试用例到自动化的映射

> ✅ doc 已描述且可直接自动化；➕ 本设计新增；🔧 doc 有但需改造

### 3.1 Client 单元（链 2）

| 用例 ID | 状态 | 自动化要点 |
|------|:---:|------|
| TC-MERGE-001..005 | ✅ | `MergeManager.spec.ts` |
| TC-DROP-001..004 | 🔧 | `jest.useFakeTimers` + 注入 clock |
| TC-CONT-001..002 | ✅ | — |
| TC-OVER-001..003 | 🔧 | fake timers + 注入 clock |
| TC-CUST-001..005 | 🔧 | 订单生成注入 RNG seed |
| TC-SCORE-001..004 | ✅ | — |
| ➕ TC-STATE-001 | ➕ | GameState 持久化往返 |
| ➕ TC-STATE-002 | ➕ | 离线成绩队列：失败→缓存→重试 |
| ➕ TC-CFG-001 | ➕ | `levels.json` / `DessertConfig` schema 自检 |
| ➕ TC-API-CLIENT-001..004 | ➕ | ApiClient 正常 / 超时 / 5xx / 401 自动清 token |

### 3.2 Server 单元 + E2E（链 1）

| 用例 ID | 状态 | 位置 |
|------|:---:|------|
| TC-AUTH-001..005 | ✅ | `auth.service.spec.ts` + `auth.e2e-spec.ts` |
| TC-USER-001..005 | ✅ | 同上 |
| TC-RANK-001..006 | ✅ | 同上 |
| TC-INFRA-001 | 🔧 | `getMongoUri()` 提成可注入函数后单测 |
| ➕ TC-AUTH-E2E-001 | ➕ | `POST /auth/login` → token → `GET /user/progress` 链路 |
| ➕ TC-RANK-E2E-001 | ➕ | 多账号并发提交、`$max` 原子性 |
| ➕ TC-SEC-001 | ➕ | 未携带 / 伪造 / 过期 token 一律 401 |
| ➕ TC-SEC-002 | ➕ | 超大 body / 非法 JSON 拒绝 |
| ➕ TC-VALID-001 | ➕ | ValidationPipe 白名单：多余字段剥离 |

### 3.3 E2E（链 3，Playwright）

| 用例 ID | 状态 | spec 文件 |
|------|:---:|------|
| TC-E2E-001 新玩家通关 | ✅ | `playthrough.spec.ts` |
| TC-E2E-002 失败重试 | ✅ | `fail-retry.spec.ts` |
| TC-E2E-003 排行榜刷新 | ✅ | `rank.spec.ts` |
| TC-E2E-004 连续 3 关 | ✅ | `playthrough.spec.ts` |
| TC-E2E-005 退出回断点 | 🔧 | `context.close()` 模拟 |
| TC-E2E-006 星级上限 | ✅ | `rank.spec.ts` |
| TC-E2E-008..010 Home/设置/分享 | ✅ | `ad-share.spec.ts` |
| TC-API-ERR-001..003 | ✅ | `network.spec.ts`（`route()`） |
| TC-API-USER-002 离线补传 | ✅ | `offline-resubmit.spec.ts` |
| TC-PLAT-AD-001..004 激励视频 | ✅ | `ad-share.spec.ts`（tt mock 模拟回调） |
| TC-PLAT-SHARE-001..002 分享 | ✅ | 同上 |
| TC-PLAT-NET-001..003 弱网/断网/后台 | ✅ | `network.spec.ts` |
| ➕ TC-E2E-ASSET-001 | ➕ | 首屏资源加载失败 → 错误页不白屏 |
| ➕ TC-E2E-CONCUR-001 | ➕ | 快速连点 drop / 分享按钮防抖 |
| ➕ TC-E2E-STATE-001 | ➕ | localStorage 被清 → 自动重登 |
| ➕ TC-E2E-LONG-001 | ➕ | 连续 5 关无内存泄漏（升级 B） |
| ➕ TC-E2E-PERF-001 | ➕ | 关卡主循环 FPS ≥ 45（Playwright tracing，升级 B） |

### 3.4 Scripts 单元（链 4）

| 用例 ID | 覆盖点 |
|------|------|
| ➕ TC-SCR-GEN-001..003 | `generate_images.js`：正常 / 尺寸配置错 / 输出路径冲突 |
| ➕ TC-SCR-PROC-001..004 | `process_images.js`：4MB 压缩 / alpha 保留 / sharp 报错 / 空目录 |
| ➕ TC-SCR-OPT-001..002 | `optimize_scenes.js`：幂等 / scene JSON schema |
| ➕ TC-SCR-MCP-001 | `cocos-mcp-proxy.mjs`：端口占用降级 / 请求转发 |

### 3.5 抖音 CLI 冒烟（链 3 A 轨，人工）

- TC-PLAT-PKG-001..004 包体 / 启动
- TC-PLAT-SDK-001..004 真实 tt API
- TC-PLAT-COMPAT-001..005 真机兼容
- TC-PLAT-REVIEW-001..005 合规

### 3.6 覆盖缺口（doc 原先完全没有，本设计补）

1. GameState 持久化与离线队列
2. `levels.json` / `DessertConfig` schema 自检
3. ApiClient 异常路径单元测试
4. Server 安全（伪造 token / 超大 body / 非法 JSON）
5. ValidationPipe 白名单行为
6. Scripts 全部（原 doc 零覆盖）
7. 资源加载失败 E2E 路径
8. 防抖 / 并发点击（分享、drop 等）
9. 长时运行稳定性（内存 / FPS）
10. MongoDB 连接降级（`getMongoUri` 三分支）

---

## 4. 配置与 npm scripts

### 4.1 根 `package.json`

```json
{
  "name": "catbakery",
  "private": true,
  "workspaces": ["server", "client/tests", "e2e", "scripts/tests"],
  "scripts": {
    "test": "npm run test:all",
    "test:all": "npm run test:server && npm run test:client && npm run test:scripts && npm run test:e2e",
    "test:server": "npm --workspace server run test:ci",
    "test:server:e2e": "npm --workspace server run test:e2e",
    "test:client": "npm --workspace client/tests run test:ci",
    "test:e2e": "npm --workspace e2e run test:ci",
    "test:e2e:headed": "npm --workspace e2e run test:headed",
    "test:scripts": "npm --workspace scripts/tests run test:ci",
    "coverage:merge": "nyc merge coverage/raw coverage/merged.json && nyc report -t coverage --reporter=lcov --reporter=text-summary"
  },
  "devDependencies": {
    "nyc": "^17.0.0",
    "sharp": "^0.34.5"
  }
}
```

### 4.2 `server/package.json` 增量

```jsonc
{
  "scripts": {
    "test:ci": "jest --coverage --coverageDirectory=../coverage/raw/server",
    "test:e2e": "jest --config ./test/jest-e2e.json --coverage --coverageDirectory=../coverage/raw/server-e2e"
  }
}
```

### 4.3 `client/tests/jest.config.ts`

```ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^cc$': '<rootDir>/__mocks__/cc.ts',
    '^cc/env$': '<rootDir>/__mocks__/cc-env.ts',
  },
  setupFilesAfterEach: ['<rootDir>/setup.ts'],
  collectCoverageFrom: [
    '../assets/scenes/scripts/{core,data,net}/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 90, lines: 85, statements: 85 },
  },
};
```

### 4.4 `e2e/playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  globalSetup: './fixtures/global-setup.ts',
  globalTeardown: './fixtures/global-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:4567',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true } },
  ],
});
```

### 4.5 `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 4.6 `.gitignore` 增量

```
coverage/
playwright-report/
test-results/
e2e/dist/
```

---

## 5. CI workflow

### 5.1 `.github/workflows/test.yml`

```yaml
name: test
on:
  pull_request: { branches: [main] }
  push: { branches: [main] }
concurrency:
  group: test-${{ github.ref }}
  cancel-in-progress: true

jobs:
  server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:server
      - run: npm run test:server:e2e
      - uses: actions/upload-artifact@v4
        with: { name: coverage-server, path: coverage/raw/ }

  client-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:client
      - uses: actions/upload-artifact@v4
        with: { name: coverage-client, path: coverage/raw/ }

  scripts-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:scripts
      - uses: actions/upload-artifact@v4
        with: { name: coverage-scripts, path: coverage/raw/ }

  e2e:
    runs-on: ubuntu-latest
    needs: [server, client-unit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: e2e/dist/web-mobile
          key: cocos-web-mobile-${{ hashFiles('client/assets/**', 'client/settings/**') }}
      - run: npm --workspace e2e run build:client
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: |
            e2e/playwright-report/
            e2e/test-results/

  coverage:
    runs-on: ubuntu-latest
    needs: [server, client-unit, scripts-unit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { pattern: coverage-*, path: coverage/raw, merge-multiple: true }
      - run: npm run coverage:merge
      - uses: codecov/codecov-action@v5
        with: { files: coverage/lcov.info, fail_ci_if_error: true }
```

### 5.2 执行时长预算

| Job | 预期耗时 | 并行 |
|------|:---:|:---:|
| server | ~40s | ✅ |
| client-unit | ~20s | ✅ |
| scripts-unit | ~15s | ✅ |
| e2e | ~3–4min | 依赖上游 |
| coverage | ~20s | 依赖上游 |
| **总 wall-clock** | **~5min** | |

### 5.3 Cocos web-mobile 构建策略

- `e2e/scripts/build-web-mobile.mjs`：优先调用 `CocosCreator --project client --build "platform=web-mobile"`
- CI runner 未装编辑器 → `actions/cache` 以 `client/assets/**` 和 `client/settings/**` 的 hash 为 key；命中时跳过构建
- 首次或缓存失效：需要本地构建后推一次，或在另一条 workflow（定时）里触发并提交缓存

### 5.4 失败策略

- 单元链失败 → PR 阻塞，E2E 不启动
- E2E 失败 → 保存 trace/video/screenshot artifact
- 覆盖率未达标 → Jest `coverageThreshold` 直接 fail
- flaky E2E → `retries: 2`，异步等待全用 `expect.poll`

---

## 6. 生产代码必要改动（可测试性）

| 文件 | 改动 | 原因 |
|------|------|------|
| `core/CustomerManager.ts` | 构造器接受可选 `rng: () => number` | 订单生成确定性 |
| `core/DropController.ts` | 接受可选 `clock: () => number` | 节流 fake timers |
| `core/OverflowDetector.ts` | 同上 | 延时阈值 |
| `net/ApiClient.ts` | 接受可选 `fetchImpl: typeof fetch` | mock 不污染全局 |
| `data/GameState.ts` | 抽 `Storage` 接口（`get/set/remove`） | 持久化可测 |
| `server/src/auth/auth.service.ts` | 抽 `CodeExchanger` provider | 替换 stub |
| `server/src/app.module.ts` | `getMongoUri()` 提成导出函数 | 测 3 分支降级 |

约 7 文件、每处 ≤ 20 行，全部向后兼容。

---

## 7. 落地分期

### Phase T1：后端与脚本闭环（1–2 天）
- 根 `package.json` 升级 workspaces，`tsconfig.base.json` 与 `.gitignore` 增量
- server `test:ci` + `test:e2e` 配置 + supertest specs（auth / user / rank）
- `scripts/tests/` 4 个脚本单测
- CI 的 server / scripts-unit / coverage 三 job
- **验收**：`test:server && test:scripts` 全绿；server 行覆盖 ≥ 90%

### Phase T2：Client 单元（2–3 天）
- 生产代码可测试性改造（7 文件）
- `client/tests/__mocks__/cc.ts` 手写 stub + jsdom（升级 A）
- `core` / `data` / `net` spec 套件 + `levels.json` schema 自检
- CI 加 client-unit job
- **验收**：`test:client` 全绿；core/data/net 行覆盖 ≥ 85%

### Phase T3：E2E（3–5 天）
- `e2e/` workspace + Playwright + fixtures
- `build-web-mobile.mjs` + Actions 缓存策略
- 9 条 spec（含升级 B 的 long-run / perf）
- CI 加 e2e job（依赖 server + client-unit）
- `smoke-douyin-cli.md` 冒烟清单
- **验收**：`test:e2e` 全绿；P0+P1 全覆盖；CI wall-clock ≤ 6min

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Cocos web-mobile CI 构建复杂 | Actions 缓存；无头构建作为后续优化 |
| `cc` stub 维护成本 | 清单化"新 API 补 stub"；spec 缺啥补啥 |
| Playwright flaky | retries + trace + `expect.poll` |
| jsdom 不支持 canvas/WebGL | 玩法 E2E 放 Playwright；jsdom 只跑纯逻辑 |
| 覆盖率阈值过严阻塞 PR | 爬坡期首次 75%，一周稳定后升到目标 |
| 抖音 CLI 冒烟无人执行 | 清单化并列入提审前必过关卡 |

---

## 9. 验收标准

- [ ] `npm run test:all` 空仓 clone 后一条命令跑通
- [ ] server ≥ 90% / service ≥ 95%；client core ≥ 85%；scripts ≥ 80%
- [ ] E2E 覆盖 `docs/test/` 所有 P0 + P1
- [ ] CI 单 PR wall-clock ≤ 6 分钟
- [ ] Codecov 徽章接入 `README.md`
- [ ] 3.6 节 10 项新增缺口全部有对应 spec

---

## 10. 下一步

本设计通过评审后，调用 `superpowers:writing-plans` 生成分 Phase 实施计划（T1 / T2 / T3 各一份 tracked plan）。
