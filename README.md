# 一起开猫店 / Cat Bakery

抖音小游戏 — 合成类玩法（拖放/合并甜品以满足顾客订单）。全栈项目：Cocos Creator 客户端 + NestJS / MongoDB 服务端。

- 平台：抖音小游戏（Bytedance Mini Game）
- 变现：IAA（激励视频广告）
- 包体限制：主包 ≤ 4 MB，总包 ≤ 20 MB

---

## 仓库结构

```
client/    Cocos Creator 3.8.8 项目（TypeScript），构建目标 bytedance-mini-game
           assets/scenes/scripts/
             core/      核心玩法（Container、Dessert、MergeManager、DropController …）
             data/      GameTypes、DessertConfig、GameState
             net/       ApiClient / ApiTypes（对接 server）
             platform/  抖音 `tt` SDK 封装
             ui/        场景控制器（Loading / Home / Game）
server/    NestJS 11 + Mongoose，模块：auth / user / rank
scripts/   Node + Sharp 图片处理与 cocos-mcp-proxy
e2e/       Playwright 端到端测试
docs/      dev/（分阶段开发计划） + plans/（设计文档）
```

更详细的项目背景与平台约束见 [CLAUDE.md](./CLAUDE.md)；平台调研见 [TikTok小游戏调研报告.md](./TikTok小游戏调研报告.md)。

---

## 快速开始

### 服务端

```bash
cd server
npm install
npm run start:dev    # 监听 0.0.0.0:${PORT:-3333}
```

未设置 `MONGODB_URI` 时，服务端会：先探测 `127.0.0.1:27017`，否则回退到 `mongodb-memory-server`（内存数据库，重启即丢）。需要持久化时显式设置 `MONGODB_URI`。

### 客户端

用 **Cocos Creator 3.8.8** 打开 `client/` 目录。无 CLI 构建命令，请使用编辑器的「构建」面板，目标平台选择 **字节小游戏（bytedance-mini-game）**。构建模板位于 `client/build-templates/bytedance-mini-game/`。

### 一键起完整环境

```bash
docker-compose up
```

启动 MongoDB + server（端口 3333，DB URI `mongodb://mongodb:27017/catbakery`）。

---

## 常用命令

仓库根（npm workspaces）：

| 命令 | 说明 |
|------|------|
| `npm run test:all` | server 单测 + server e2e + client 单测 + scripts 单测 |
| `npm run test:e2e` | Playwright 端到端 |
| `npm run coverage:merge` | 合并各 workspace 覆盖率为统一报告 |
| `npm run build:e2e-bundle` | 构建 e2e 测试用 bundle |
| `npm run lint:skips` | 校验 test.skip 是否携带原因 |

## 抖音正式配置与发布门禁

仓库中的客户端配置默认用于开发：`API_BASE_URL` 指向 `http://localhost:3333`，
`REWARDED_AD_UNIT_ID` 是不可投放的占位值。不要把临时隧道地址提交为默认配置。

正式构建前先写入已加入抖音合法域名白名单的 HTTPS API，并在
`client/assets/scenes/scripts/platform/AdConfig.ts` 中填写一个真实激励视频广告位：

```bash
node scripts/set_api_base.mjs --url https://api.example.cn
npm run config:check:release
npm --workspace e2e run build:tt:release
```

`config:check:release` 会拒绝 HTTP、localhost、私网/临时隧道、模拟广告及广告占位值。
正式构建还会校验产物是否包含当前配置，防止上传缓存旧包。`npm --workspace e2e run upload:tt -- <version> "<changelog>"`
会重复执行该检查，失败时不会调用 `tmg upload`。

`server/`：

| 命令 | 说明 |
|------|------|
| `npm run start:dev` | 监听模式启动 |
| `npm run build` / `npm run start:prod` | 生产构建与启动 |
| `npm test` | Jest 单元测试 |
| `npm run test:e2e` | e2e（`test/jest-e2e.json`） |
| `npm run lint` / `npm run format` | ESLint / Prettier |

---

## 客户端 ↔ 服务端契约

`client/assets/scenes/scripts/net/ApiClient.ts` 与 `net/ApiTypes.ts` 镜像 `server/src/*/dto/` 下的 DTO。**改接口时两侧需同步更新**。

平台 API（登录、广告、支付）走全局 `tt`，统一通过 `client/.../platform/` 封装访问，避免非抖音环境运行时报错。

---

## 开发计划与里程碑

按阶段拆分，进度表与详情见 [docs/dev/README.md](./docs/dev/README.md)：

- Phase 1 资产 → Phase 2 核心玩法 → Phase 3 关卡 → Phase 4 UI/弹窗
- Phase 5 后端（与 1 可并行）→ Phase 6 变现/社交 → Phase 7 集成测试

里程碑：M1 可玩原型 → M2 功能完整 → M3 变现就绪 → M4 提审版本。

---

## 提交规范

约定式提交（Conventional Commits）：`feat:`、`fix:`、`refactor:`、`chore:`、`test:`、`docs:` …
