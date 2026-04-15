# Phase 5：后端更新

> 依赖：无（可与 Phase 1 并行）
> 产出：后端 API 完整，支持本关排名和错误处理
> 参考：[06-backend.md](../plans/06-backend.md)

---

## Task 5-1：更新 User Schema

**修改文件**：`server/src/user/schemas/user.schema.ts`

**内容**：
- 新增 `roundScores` 字段：`Record<string, number>`，存储每关最高分
- 预留 v2.0 字段（暂不实现）：`homeItems`、`cats`、`skins`

**验收标准**：
- [ ] 现有用户数据兼容（roundScores 默认空对象）
- [ ] 新用户创建时包含 roundScores 字段

---

## Task 5-2：更新 Progress API

**修改文件**：
- `server/src/user/dto/progress.dto.ts`
- `server/src/user/user.service.ts`
- `server/src/user/user.controller.ts`

**内容**：
- Request 增加 `score` 和 `catCoinsEarned` 字段
- 服务端逻辑：
  - `stars[round]` 只取历史最高
  - `roundScores[round]` 只取历史最高
  - `highScore` 取全局最高
  - `currentRound` 只增不减
  - `catCoins` 累加
- Response 返回更新后的数据 + `isNewBest` 标志
- 幂等处理：相同关卡重复提交不会重复加猫币

**验收标准**：
- [ ] 重复提交同一关只保留最高分/星级
- [ ] catCoins 正确累加
- [ ] isNewBest 正确判断

---

## Task 5-3：实现本关好友排名 API

**修改文件**：
- `server/src/rank/rank.service.ts`
- `server/src/rank/rank.controller.ts`

**内容**：
- `GET /api/rank/friends?round=N`
  - 不传 round：按 currentRound 排名（总排行）
  - 传 round：按 `roundScores[round]` 排名（本关排名）
- 返回好友列表 + 自己的排名
- MVP 阶段好友关系模拟：返回全部用户作为"好友"（正式上线再接抖音关系链）

**验收标准**：
- [ ] 传 round 参数时按本关分数排序
- [ ] 不传时按最高关卡排序
- [ ] 自己的排名 myRank 正确

---

## Task 5-4：统一 API 响应格式与错误处理

**修改/新建文件**：
- `server/src/common/filters/http-exception.filter.ts`
- `server/src/common/interceptors/response.interceptor.ts`

**内容**：
- 统一成功响应格式：`{ code: 0, data: {...} }`
- 统一错误响应格式：`{ code: number, message: string }`
- 错误码定义：
  - 401：openId 无效
  - 404：用户不存在
  - 500：服务端异常
- 请求超时：客户端 5 秒超时
- 鉴权：通过 `X-Open-Id` header 识别用户（MVP 简单鉴权）

**验收标准**：
- [ ] 所有 API 返回格式统一
- [ ] 无效 openId 返回 401
- [ ] 服务端异常不暴露内部错误信息

---

## Task 5-5：更新后端单元测试

**修改文件**：
- `server/src/auth/auth.service.spec.ts`
- `server/src/user/user.service.spec.ts`
- `server/src/rank/rank.service.spec.ts`

**内容**：
- 补充 progress API 测试：星级只升不降、分数只取最高、重复提交幂等
- 补充本关排名测试：传 round 参数时按本关分数排序
- 补充错误处理测试：无效 openId、缺少必填字段

**验收标准**：
- [ ] 所有测试通过
- [ ] 覆盖核心业务逻辑的边界情况
