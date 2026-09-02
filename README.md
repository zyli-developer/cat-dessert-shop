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
| `npm run config:init` | 在根目录 `.env` 补齐缺少的配置键 |
| `npm run config:sync` | 将 `.env` 中允许公开的配置同步到客户端 |

## 抖音正式配置与发布门禁

本地配置统一放在仓库根目录 `.env`。先复制 `.env.example`，填写服务端密钥、API 地址和
真实激励视频广告位 ID，再把允许公开的三项配置同步进 Cocos 客户端：

```bash
cp .env.example .env
npm run config:sync
npm run config:check:release
npm --workspace e2e run build:tt:release
```

`DOUYIN_APP_SECRET`、`AUTH_TOKEN_SECRET`、`MONGODB_URI` 等服务端私密值只由 NestJS 读取，
不会被同步到客户端。生产 Docker 继续使用服务器上的 `deploy/.env.production` 注入私密值。
`server/` 下不再维护第二份 `.env`，避免配置来源冲突。
`config:check:release` 会拒绝 HTTP、localhost、私网/临时隧道、模拟广告及广告占位值。
正式构建还会校验产物是否包含当前配置、客户端 App ID 是否与后端配置一致，防止上传缓存旧包。
`npm --workspace e2e run upload:tt -- <version> "<changelog>"` 默认只上传已在开发者工具中测试过的
`client/build/bytedance-mini-game`；检查失败时不会调用 `tmg upload`。

`build:tt`（包括命中缓存时）会自动把 `audio`、`main` Bundle 整理为抖音分包；
后处理检测到主包仍超过 4 MB 时会立即失败，禁止继续预览或上传。
执行 `FORCE=1` 无头重建前请关闭同一项目的 Creator；脚本检测到 MCP 端口 `3334`
已被 GUI 占用时会提前退出，避免第二个 Editor 损坏项目缓存。

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

## 2026-08-28 Review 修复记录

- API 改为服务端签名 Bearer 会话；401 清理客户端会话，生产环境必须配置 `AUTH_TOKEN_SECRET`。
- 奖励改为服务端固定金额、原子幂等和频率限制；稳定 claim ID 支持丢失回包后的安全重试。
- 进度接口拒绝越界、跳关和伪造星级；离线档案及按账号隔离的补传队列可持久恢复。
- 修复异步资源旧回调、暂停弹窗失败卡死、失败态溢出检测继续运行和构建并发问题。
- 全量回归通过：server unit 41、server e2e 21、client 132、scripts 43，共 237 条测试。

---

## 提交规范

约定式提交（Conventional Commits）：`feat:`、`fix:`、`refactor:`、`chore:`、`test:`、`docs:` …
