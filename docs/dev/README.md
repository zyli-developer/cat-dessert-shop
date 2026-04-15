# 猫咪甜品店 — 开发计划

> 需求文档：[docs/plans/README.md](../plans/README.md)
> 日期：2026-04-03

---

## 项目状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 项目初始化 | ✅ 完成 | Cocos Creator 3.8 + NestJS + 抖音构建模板 |
| 后端基础 | ✅ 完成 | Auth/User/Rank 模块 + 单元测试 |
| 客户端数据层 | ✅ 完成 | GameTypes、DessertConfig、ApiClient、GameState |
| 核心机制初版 | ✅ 完成 | Container、Dessert、MergeManager、DropController、OverflowDetector、CustomerManager |
| 场景脚本初版 | ✅ 完成 | LoadingScene、HomeScene、GameScene |
| 工具类初版 | ✅ 完成 | ItemManager、AudioManager、DouyinSDK |
| **以下为待开发** | | |
| 资产准备 | ⬜ 待开始 | 47 张图片 + 4 个音频 |
| 核心玩法更新 | ⬜ 待开始 | 容器/甜品/物理/计分/送餐更新 |
| 关卡与顾客 | ⬜ 待开始 | 10 关配置 + 星级评价 |
| UI 与弹窗 | ⬜ 待开始 | 结算页 + 5 个 Prefab 弹窗 |
| 后端更新 | ⬜ 待开始 | roundScores + 本关排名 + 错误处理 |
| 变现与社交 | ⬜ 待开始 | 4 个广告位 + 分享 |
| 集成测试 | ⬜ 待开始 | 全流程 + 抖音 IDE + 包体优化 |

---

## 阶段总览

| 阶段 | 文档 | 核心交付 | 预估 Task 数 |
|------|------|---------|-------------|
| Phase 1 | [phase-1-assets.md](phase-1-assets.md) | 全部美术/音频资产就位 | 5 |
| Phase 2 | [phase-2-core-mechanics.md](phase-2-core-mechanics.md) | 核心玩法可玩 | 6 |
| Phase 3 | [phase-3-levels.md](phase-3-levels.md) | 10 关可通关 | 4 |
| Phase 4 | [phase-4-ui-popups.md](phase-4-ui-popups.md) | 完整 UI 流程 | 6 |
| Phase 5 | [phase-5-backend.md](phase-5-backend.md) | 后端 API 完整 | 5 |
| Phase 6 | [phase-6-monetization.md](phase-6-monetization.md) | 广告 + 分享接入 | 4 |
| Phase 7 | [phase-7-testing.md](phase-7-testing.md) | 可提审版本 | 5 |

---

## 阶段依赖关系

```
Phase 1（资产） ──→ Phase 2（核心玩法） ──→ Phase 3（关卡）
                                              ↓
Phase 5（后端） ──────────────────────→ Phase 4（UI/弹窗）
                                              ↓
                                       Phase 6（变现/社交）
                                              ↓
                                       Phase 7（集成测试）
```

- **可并行**：Phase 1 与 Phase 5（资产准备和后端更新互不依赖）
- **串行关键路径**：Phase 1 → 2 → 3 → 4 → 6 → 7

---

## 里程碑

| 里程碑 | 完成标志 | 依赖阶段 |
|--------|---------|---------|
| **M1: 可玩原型** | 核心合成 + 送餐 + 1 关可通关 | Phase 1 + 2 + 3 部分 |
| **M2: 功能完整** | 10 关 + 结算 + 弹窗 + 后端联调 | Phase 3 + 4 + 5 |
| **M3: 变现就绪** | 广告 + 分享 + 猫币体系完整 | Phase 6 |
| **M4: 提审版本** | 包体 ≤20MB + 全流程测试通过 | Phase 7 |
