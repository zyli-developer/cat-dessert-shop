# 前后端联调测试

> 启动本地 server (`npm run start:dev`) + 客户端抖音开发者工具预览。
> 客户端走真实 `net/ApiClient.ts` → NestJS。
> 数据库使用内存库或本地 MongoDB 均可，每轮用例前清库。

---

## 环境准备

1. `cd server && npm run start:dev`（监听 `0.0.0.0:3333`）
2. 确认 `client/assets/scenes/scripts/net/ApiConfig.ts` 指向 `http://<局域网IP>:3333`
3. 抖音开发者工具打开 `client/build/bytedance-mini-game` 构建产物
4. 清库：重启 server（内存库自动清）或 `mongo catbakery --eval 'db.dropDatabase()'`

---

## Auth 联调 (TC-API-AUTH)

### TC-API-AUTH-001  首次登录全链路
- **优先级**：P0
- **步骤**：
  1. 客户端启动 → LoadingScene → 自动触发 `tt.login`
  2. `ApiClient.login(code, nickname)` 请求 `POST /auth/login`
- **预期**：
  - 200 返回 `{token, userId}`
  - 客户端持久化 token（localStorage / `tt.setStorageSync`）
  - 进入 HomeScene

### TC-API-AUTH-002  Token 复用
- **优先级**：P0
- **步骤**：重启客户端，检查是否跳过 login
- **预期**：已有有效 token 时直接进入 HomeScene，不重复调用 `/auth/login`

### TC-API-AUTH-003  Token 过期处理
- **优先级**：P1
- **步骤**：手动改小 server token TTL 至 1 秒，等过期再请求受保护接口
- **预期**：401 → 客户端清 token → 重新走登录流程

---

## Progress 联调 (TC-API-USER)

### TC-API-USER-001  通关上传进度
- **优先级**：P0
- **步骤**：
  1. 登录成功
  2. 打过关卡 3（2 星 / 450 分）
  3. 结算页调用 `POST /user/progress`
- **预期**：
  - 200
  - Home 进入时拉取 `GET /user/progress`，显示关卡 3 已 2 星

### TC-API-USER-002  离线通关后联网补传
- **优先级**：P1
- **前置**：关闭网络 → 通关 → 开启网络
- **预期**：GameState 本地缓存成绩；联网后自动重试上传

### TC-API-USER-003  非法 token 被拒
- **优先级**：P1
- **步骤**：篡改 token 后请求 `/user/progress`
- **预期**：401，客户端走重登流程

---

## Rank 联调 (TC-API-RANK)

### TC-API-RANK-001  单关排行榜展示
- **优先级**：P0
- **步骤**：三个不同账号分别通关 3 关并上传分数，账号 A 打开排行榜
- **预期**：
  - 列表按分数降序
  - 当前用户高亮
  - "我的排名" 与列表一致

### TC-API-RANK-002  同分并列
- **优先级**：P1
- **前置**：账号 B、C 同分
- **预期**：排名顺序与 server 约定一致（时间更早优先）

### TC-API-RANK-003  空榜
- **优先级**：P2
- **预期**：UI 显示 "暂无数据"，不报错

---

## 错误路径 (TC-API-ERR)

### TC-API-ERR-001  server 不可达
- **优先级**：P0
- **步骤**：stop server，客户端发起任意请求
- **预期**：ApiClient 超时后抛业务错误；UI 出现"网络异常，请重试"；不崩溃

### TC-API-ERR-002  5xx 处理
- **优先级**：P1
- **步骤**：mock server 返回 500
- **预期**：客户端展示统一错误提示，关键操作（如上传分数）支持重试

### TC-API-ERR-003  返回体字段缺失
- **优先级**：P2
- **步骤**：server 返回 `{}`
- **预期**：ApiClient 走 DTO 校验失败路径，不把 undefined 灌进 GameState

---

## 数据一致性

### TC-API-CON-001  客户端 / 服务端 DTO 对齐
- **优先级**：P0
- **方法**：对比 `client/assets/scenes/scripts/net/ApiTypes.ts` 与 `server/src/*/dto/*.ts` 字段名与类型
- **预期**：完全一致；如有差异需在本文档登记豁免原因

---

## 执行清单

- [ ] 全部 P0 通过
- [ ] 断网/弱网路径可复现且有降级
- [ ] DTO 一致性人工 review 通过
