# 客户端核心玩法单元测试

> 覆盖 `client/assets/scenes/scripts/core/` 下的纯逻辑类。
> UI、资源加载、Cocos 节点依赖通过 mock 隔离；只测业务规则。

---

## 通用约定

- **框架**：Jest（计划与 server 共用 ts-jest 配置）。
- **Mock**：`cc.Node`、`cc.Vec3`、`cc.tween` 通过手写 stub 或 `jest.mock('cc')`。
- **配置数据**：直接复用 `data/DessertConfig.ts` 里的关卡/甜品常量。
- **随机**：涉及随机的逻辑（顾客订单生成）必须支持注入 seed 或 RNG。

---

## MergeManager (TC-MERGE)

### TC-MERGE-001  同级甜品合成升级
- **优先级**：P0
- **前置**：两个 level=1 的相同类型甜品
- **步骤**：
  1. 调用 `MergeManager.tryMerge(a, b)`
- **预期**：
  - 返回新甜品，level=2，type 保持不变
  - a、b 被标记为已销毁（或从集合移除）
  - 得分增量等于 `DessertConfig.mergeScore[2]`

### TC-MERGE-002  不同类型不合成
- **优先级**：P0
- **步骤**：传入类型不同的两个甜品
- **预期**：返回 null，两者状态不变

### TC-MERGE-003  已达最高级不再合成
- **优先级**：P1
- **前置**：两个 level=MAX 甜品
- **预期**：返回 null，不加分

### TC-MERGE-004  三连触发顺序
- **优先级**：P1
- **前置**：三个同级甜品同帧落定
- **预期**：只发生一次合成（两两配对），剩余一个进入下一轮检测

### TC-MERGE-005  合成事件派发
- **优先级**：P2
- **预期**：触发 `onMerge` 事件，payload 包含 `{type, newLevel, position}`

---

## DropController (TC-DROP)

### TC-DROP-001  正常掉落
- **优先级**：P0
- **步骤**：点击屏幕坐标 (x, y)，调用 `drop(x)`
- **预期**：创建甜品节点，世界坐标 x 与入参一致，y 等于起始高度

### TC-DROP-002  连点节流
- **优先级**：P0
- **步骤**：在 cooldown (假设 300ms) 内连续 `drop` 三次
- **预期**：只生成一个甜品；后续两次被忽略

### TC-DROP-003  边界夹紧
- **优先级**：P1
- **步骤**：`drop(x)` 传入超出容器左右边界的 x
- **预期**：实际落点被夹到容器内边缘 ± 甜品半径

### TC-DROP-004  下一颗预告
- **优先级**：P2
- **预期**：`nextDessert` 在 drop 完成后立即刷新为新的随机等级（受关卡配置约束）

---

## Container (TC-CONT)

### TC-CONT-001  容量计算
- **优先级**：P1
- **步骤**：向容器添加 N 个甜品
- **预期**：`getOccupiedHeight()` 随堆叠单调不减

### TC-CONT-002  清空
- **优先级**：P1
- **步骤**：调用 `clear()`
- **预期**：所有甜品节点被销毁；内部集合清空；监听器解绑

---

## OverflowDetector (TC-OVER)

### TC-OVER-001  超线即判失败
- **优先级**：P0
- **前置**：检测线 y = H，延时阈值 dt = 1s
- **步骤**：让一个甜品持续高于 H 超过 dt
- **预期**：触发 `onOverflow` 一次，状态进入 Fail

### TC-OVER-002  短暂超线不判失败
- **优先级**：P0
- **步骤**：甜品短暂高于 H，< dt 后回落
- **预期**：不触发失败

### TC-OVER-003  失败后不重复触发
- **优先级**：P1
- **预期**：一局中 `onOverflow` 至多触发一次

---

## CustomerManager (TC-CUST)

### TC-CUST-001  订单生成受关卡配置约束
- **优先级**：P0
- **前置**：关卡 3 配置 `customers: [{type:A, level:3}, ...]`
- **预期**：按顺序弹出，类型/等级与配置一致

### TC-CUST-002  送餐命中加分
- **优先级**：P0
- **步骤**：将当前订单所需甜品拖到顾客
- **预期**：订单完成、加分 = `customerScore + 剩余时间加成`、顾客离开

### TC-CUST-003  送错甜品
- **优先级**：P1
- **预期**：不加分、不推进订单；可配置扣时或扣耐心值

### TC-CUST-004  订单超时
- **优先级**：P1
- **前置**：订单倒计时到 0
- **预期**：触发 `onCustomerTimeout`，顾客离开，不加分

### TC-CUST-005  全部订单完成
- **优先级**：P0
- **预期**：触发 `onLevelComplete`，传递汇总数据（得分、用时、剩余时间）

---

## ScoreManager (TC-SCORE)

### TC-SCORE-001  单次加分累计
- **优先级**：P0
- **预期**：`addScore(x)` 后 `currentScore` 累加

### TC-SCORE-002  星级评价阈值
- **优先级**：P0
- **测试数据**：关卡 3 阈值 `{1star:100, 2star:300, 3star:600}`
- **步骤**：分别设定分数为 99 / 100 / 299 / 300 / 599 / 600 / 700
- **预期**：对应星数 0 / 1 / 1 / 2 / 2 / 3 / 3

### TC-SCORE-003  roundScores 结构
- **优先级**：P1
- **预期**：结算时产出 `{level, score, stars, duration, timestamp}`，字段类型与 `net/ApiTypes.ts` 中定义一致

### TC-SCORE-004  重置
- **优先级**：P1
- **预期**：`reset()` 后分数归零，历史记录保留在 GameState

---

## 执行清单

- [ ] 所有 P0 用例通过
- [ ] P1 用例通过率 ≥ 95%
- [ ] 覆盖率：core/ 目录行覆盖 ≥ 80%
