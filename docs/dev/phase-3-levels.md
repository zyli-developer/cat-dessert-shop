# Phase 3：关卡与顾客系统

> 依赖：Phase 2（核心玩法可运行）
> 产出：10 关可通关，星级评价正常
> 参考：[02-levels.md](../plans/02-levels.md)

---

## Task 3-1：创建 10 关 JSON 配置

**新建文件**：`client/assets/resources/configs/levels.json`

**内容**：按 `02-levels.md` 完整关卡配置表，创建 10 关 JSON 数据：

```json
[
  {
    "round": 1,
    "customers": [
      { "demands": [{ "level": 2, "count": 1 }] },
      { "demands": [{ "level": 2, "count": 4 }] }
    ],
    "dropRange": [1, 1],
    "star2Score": 150,
    "star3Score": 300
  },
  ...
]
```

**验收标准**：
- [ ] 10 关数据完整，与 `02-levels.md` 配置表一致
- [ ] LoadingScene 可正确加载 JSON 到 GameState.allLevels

---

## Task 3-2：更新顾客系统

**修改文件**：`client/assets/scripts/core/CustomerManager.ts`

**内容**：
- 根据当前关卡配置生成顾客队列
- 每个顾客显示对应猫咪形象（随机选择橘猫/蓝猫/布偶猫）
- 需求气泡显示目标甜品图标 + 数量
- 需求进度更新（合成即飞时 +1）
- 全部顾客服务完 → 触发通关事件
- 猫咪表情切换：idle → happy（收到甜品）→ bye（离开动画）

**验收标准**：
- [ ] 顾客按关卡配置依次出场
- [ ] 猫咪形象随机但不连续重复
- [ ] 需求气泡正确显示并更新进度
- [ ] 表情切换自然流畅

---

## Task 3-3：实现星级评价

**修改文件**：`client/assets/scripts/data/GameState.ts`

**内容**：
- 通关时读取当前关卡的 `star2Score` / `star3Score`
- 比较得分，计算星级（1/2/3）
- 更新本关星级记录（只保留最高）
- 计算猫币奖励（1星=5, 2星=10, 3星=20）

**验收标准**：
- [ ] 分数 < star2Score → 1 星
- [ ] 分数 ≥ star2Score → 2 星
- [ ] 分数 ≥ star3Score → 3 星
- [ ] 猫币正确累加

---

## Task 3-4：实现溢出检测更新

**修改文件**：`client/assets/scripts/core/OverflowDetector.ts`

**内容**：
- 警戒线位于容器顶部下方 10%（Y 坐标）
- 检测任意甜品超过警戒线 → 开始 5 秒倒计时
- 倒计时内所有甜品降回 → 取消倒计时
- 倒计时结束 → 触发失败事件
- HUD 显示倒计时数字 + 警戒线闪烁

**验收标准**：
- [ ] 溢出后准确 5 秒倒计时
- [ ] 降回后倒计时正确取消
- [ ] 倒计时 UI 反馈明确
