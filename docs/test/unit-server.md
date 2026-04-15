# 后端单元测试

> 覆盖 `server/src/` 下 Auth / User / Rank 三个模块。
> 使用 `@nestjs/testing` 搭建 TestingModule，数据库通过 `mongodb-memory-server` 隔离。

---

## 通用约定

- 每个 `*.spec.ts` 放在被测文件同目录。
- DB：`MongoMemoryServer.create()` 在 `beforeAll` 启动，`afterAll` 停止；每个用例前清空集合。
- DTO 校验：通过 `ValidationPipe` 实例 `transform({...})` 直接断言。
- 外部依赖（抖音签名校验等）一律 mock。

---

## Auth (TC-AUTH)

### TC-AUTH-001  首次登录创建用户
- **优先级**：P0
- **步骤**：`authService.login({code:'xxx', nickname:'n'})`，mock 平台返回 openid=O1
- **预期**：DB 新增 user(openid=O1)；返回 `{token, userId}`

### TC-AUTH-002  已存在用户复用
- **优先级**：P0
- **前置**：DB 已存在 openid=O1
- **预期**：不新增记录；返回同一 userId

### TC-AUTH-003  非法 code
- **优先级**：P1
- **步骤**：mock 平台返回 error
- **预期**：抛 `UnauthorizedException`

### TC-AUTH-004  token 签发与校验
- **优先级**：P0
- **预期**：签发的 token 能被 guard 还原出 userId；过期 token 被拒绝

### TC-AUTH-005  DTO 参数校验
- **优先级**：P1
- **用例矩阵**：
  | 输入 | 期望 |
  |------|------|
  | `{code:''}` | 400 |
  | `{code:null}` | 400 |
  | `{code:'ok', nickname:'a'.repeat(99)}` | 400（长度超限） |
  | `{code:'ok'}` | 200 |

---

## User / Progress (TC-USER)

### TC-USER-001  更新进度
- **优先级**：P0
- **步骤**：`userService.updateProgress(uid, {level:3, stars:2, score:450})`
- **预期**：user 文档中 `progress[level=3]` 的 stars 取较大值、score 取较大值

### TC-USER-002  进度幂等
- **优先级**：P0
- **步骤**：同一 payload 提交 3 次
- **预期**：最终结果与单次提交相同

### TC-USER-003  低于现有成绩不覆盖
- **优先级**：P1
- **前置**：关卡 3 已有 3 星 / 600 分
- **步骤**：提交 2 星 / 400 分
- **预期**：DB 保留 3 星 / 600

### TC-USER-004  非法关卡拒绝
- **优先级**：P1
- **步骤**：提交 `level: 99`（配置只有 10 关）
- **预期**：抛 `BadRequestException`

### TC-USER-005  并发写入
- **优先级**：P2
- **步骤**：并发两次 update（不同分数）
- **预期**：最终保留更高分数（使用 `$max` 原子操作验证）

---

## Rank (TC-RANK)

### TC-RANK-001  提交单关成绩
- **优先级**：P0
- **步骤**：`rankService.submitRound(uid, {level:3, score:500})`
- **预期**：`roundScores` 集合新增记录，字段完整

### TC-RANK-002  查询某关 Top N
- **优先级**：P0
- **前置**：插入 50 条关卡 3 成绩
- **步骤**：查询 `getRank({level:3, limit:20})`
- **预期**：按 score DESC 排序；长度 20；含用户昵称/头像

### TC-RANK-003  分页
- **优先级**：P1
- **步骤**：`limit=10, offset=10`
- **预期**：返回第 11–20 名

### TC-RANK-004  相同分数排序稳定
- **优先级**：P1
- **前置**：两条分数相同，但提交时间不同
- **预期**：时间更早者排名靠前（或按 uid 字典序，取决于约定，需与文档一致）

### TC-RANK-005  我的排名
- **优先级**：P1
- **步骤**：`getMyRank(uid, level)`
- **预期**：返回 `{rank, score, total}`；未提交过返回 `rank=null`

### TC-RANK-006  DTO 校验
- **优先级**：P1
- **用例**：`level < 1` / `level > 10` / `score < 0` / 缺字段 → 全部 400

---

## 通用基础设施

### TC-INFRA-001  DB 自动切换
- **优先级**：P2
- **步骤**：分别在有/无本地 MongoDB 的环境启动 `app.module`
- **预期**：日志分别输出 "Using local MongoDB" 或 "Using in-memory MongoDB"

---

## 执行清单

- [ ] `npm test` 全绿
- [ ] 所有 P0 通过
- [ ] 覆盖率：`src/` 行覆盖 ≥ 80%，auth/user/rank service 层 ≥ 90%
