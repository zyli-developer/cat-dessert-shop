# 后端架构

> 所属项目：猫咪甜品店
> 总文档：[README.md](README.md)

---

## 1. 技术栈

- **服务端**：Node.js + NestJS + TypeScript
- **数据库**：MongoDB
- **部署**：Docker 容器化

---

## 2. API 接口

### 2.1 登录

```
POST /api/auth/login

Request:
{
  "code": "string"          // 抖音登录凭证（tt.login 返回的 code）
}

Response:
{
  "openId": "string",       // 用户唯一标识
  "nickname": "string",
  "avatar": "string",       // 头像 URL
  "catCoins": 0,
  "currentRound": 1,
  "highScore": 0,
  "stars": {}               // { "1": 3, "2": 2, ... } 每关星级
}
```

> 首次登录自动创建用户，返回初始数据。

### 2.2 获取用户数据

```
GET /api/user/profile
Header: X-Open-Id: <openId>

Response:
{
  "openId": "string",
  "nickname": "string",
  "avatar": "string",
  "catCoins": 128,
  "currentRound": 5,
  "highScore": 3200,
  "stars": { "1": 3, "2": 2, "3": 3, "4": 1 }
}
```

### 2.3 上报通关结果

```
POST /api/user/progress
Header: X-Open-Id: <openId>

Request:
{
  "round": 5,               // 关卡号
  "score": 850,             // 本局得分
  "stars": 3,               // 本局星级（1-3）
  "catCoinsEarned": 20      // 本局获得的猫币（含翻倍后的值）
}

Response:
{
  "catCoins": 148,           // 更新后的猫币总额
  "currentRound": 6,        // 更新后的当前进度（如果是新最高关）
  "highScore": 3200,        // 更新后的最高分
  "isNewBest": true         // 本关是否刷新了最高分
}
```

> 服务端校验：stars 只取历史最高值（不降级），currentRound 只增不减。

### 2.4 好友排行榜

```
GET /api/rank/friends?round=5
Header: X-Open-Id: <openId>

参数：
  round (可选): 指定关卡号，返回该关的好友分数排名
  不传 round: 返回按最高关卡数排名的好友总排行

Response:
{
  "list": [
    { "openId": "xxx", "nickname": "小明", "avatar": "url", "score": 1200, "rank": 1 },
    { "openId": "yyy", "nickname": "你", "avatar": "url", "score": 850, "rank": 2 },
    { "openId": "zzz", "nickname": "小红", "avatar": "url", "score": 620, "rank": 3 }
  ],
  "myRank": 2
}
```

### 2.5 全局排行榜

```
GET /api/rank/global?limit=100

Response:
{
  "list": [
    { "openId": "xxx", "nickname": "玩家A", "avatar": "url", "highScore": 12000, "rank": 1 },
    ...
  ],
  "total": 100
}
```

---

## 3. 鉴权机制

- 登录流程：客户端调用 `tt.login` 获取 code → 发送到服务端 → 服务端用 code + AppSecret 调用抖音服务端 API 换取 openId
- 后续请求：客户端在 Header 中携带 `X-Open-Id` 标识身份
- MVP 阶段使用 openId 简单鉴权，不做 token/session 机制
- 正式上线前升级为 JWT token 鉴权（生成 token → 客户端存储 → 后续请求携带 Authorization header）

---

## 4. 数据模型

```
User {
  openId        // 抖音用户标识（唯一索引）
  nickname      // 昵称
  avatar        // 头像 URL
  catCoins      // 猫币（永久累积）
  currentRound  // 当前最高关卡进度
  highScore     // 全局最高分
  stars         // 每关星级记录 { "1": 3, "2": 2, ... }
  roundScores   // 每关最高分记录 { "1": 300, "2": 900, ... }（用于本关好友排名）
  createdAt
  updatedAt
}
```

> 预留字段（v2.0）：`homeItems: []`（家园家具）、`cats: []`（已购买猫咪品种）、`skins: []`（皮肤）

---

## 5. 排行榜

- **好友排行**：基于抖音关系链，按最高回合数排名
- **全局排行**：按最高分数排名，取 Top 100
- **本关排名**：按 `roundScores[round]` 排名，用于通关结算页好友排名

---

## 6. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 网络断开 | 客户端本地缓存通关结果，恢复网络后自动重传 |
| 请求超时 | 5 秒超时，自动重试 1 次，仍失败则提示玩家 |
| 重复提交同一关 | 服务端幂等处理：比较分数，只保留最高分和最高星级 |
| openId 无效 | 返回 401，客户端重新调用 tt.login |
| 服务端异常 | 返回 500 + 错误码，客户端显示"网络异常，请稍后重试" |
