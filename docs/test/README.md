# 猫咪甜品店 — 测试用例总览

> 关联文档：[开发计划](../dev/README.md) · [需求文档](../plans/README.md)
> 最后更新：2026-04-15

---

## 文档结构

| 文档 | 范围 | 主要执行方 |
|------|------|-----------|
| [unit-core.md](unit-core.md) | 客户端核心玩法单元测试 | 开发 |
| [unit-server.md](unit-server.md) | 后端 NestJS 模块单元测试 | 开发 |
| [integration-api.md](integration-api.md) | 前后端联调（Auth / Progress / Rank） | 开发 + QA |
| [e2e-playthrough.md](e2e-playthrough.md) | 完整通关 E2E 流程 | QA |
| [platform-douyin.md](platform-douyin.md) | 抖音小游戏平台专项 | QA |

---

## 用例 ID 规范

`TC-<模块>-<三位编号>`

| 前缀 | 模块 |
|------|------|
| TC-MERGE | 合成 MergeManager |
| TC-DROP | 掉落 DropController |
| TC-CONT | 容器 Container |
| TC-OVER | 超限 OverflowDetector |
| TC-CUST | 顾客 CustomerManager |
| TC-SCORE | 计分 ScoreManager |
| TC-UI | UI / 场景流转 |
| TC-AUTH | 登录鉴权 |
| TC-USER | 用户进度 |
| TC-RANK | 排行榜 |
| TC-API | 前后端联调 |
| TC-E2E | 端到端流程 |
| TC-PLAT | 平台专项 |

---

## 优先级

| 级别 | 含义 | 阻塞发布 |
|------|------|---------|
| P0 | 核心玩法 / 登录 / 上传分数 | 是 |
| P1 | 主流程 / 结算 / 排行榜 | 是 |
| P2 | UI 细节 / 次要弹窗 | 否 |
| P3 | 极端边缘场景 | 否 |

---

## 用例字段模板

```markdown
### TC-XXX-001  <用例标题>

- **优先级**：P0
- **类型**：单元 / 集成 / E2E / 手工
- **前置条件**：...
- **测试数据**：...
- **步骤**：
  1. ...
  2. ...
- **预期结果**：
  - ...
- **实际结果**：（执行时填）
- **状态**：Pass / Fail / Blocked
- **关联**：docs/dev/phase-N-xxx.md#yyy / Issue #NN
```

---

## 覆盖率矩阵

| 模块 | 单元 | 集成 | E2E | 平台 |
|------|:----:|:----:|:---:|:----:|
| MergeManager | ✅ | — | ✅ | — |
| DropController | ✅ | — | ✅ | — |
| Container / OverflowDetector | ✅ | — | ✅ | — |
| CustomerManager | ✅ | — | ✅ | — |
| ScoreManager | ✅ | ✅ | ✅ | — |
| Auth 模块 | ✅ | ✅ | — | ✅ |
| User / Progress | ✅ | ✅ | ✅ | — |
| Rank | ✅ | ✅ | ✅ | — |
| 抖音 `tt` SDK | — | — | — | ✅ |
| 包体 / 启动 | — | — | — | ✅ |

---

## 执行与统计

- 单元：`cd server && npm test`；客户端建议后续接入 Cocos + Jest。
- 集成：启动本地 server，运行 `integration-api.md` 用例。
- E2E / 平台：抖音开发者工具真机预览（iOS + Android）。
- Bug 登记：在用例行附 Issue 链接，同步更新 `docs/dev/README.md` 状态表。
