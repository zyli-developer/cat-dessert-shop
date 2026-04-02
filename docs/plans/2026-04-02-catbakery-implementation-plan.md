# 猫咪甜品店 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a merge-puzzle mini game for Douyin (抖音) where players drop desserts into a container, merge same-level items, and serve cat customers.

**Architecture:** Cocos Creator 3.x TypeScript frontend with Box2D physics for merge mechanics. NestJS + MongoDB backend for user data, progress, and leaderboards. JSON-driven level configuration. Three scenes: Loading, Home, Game.

**Tech Stack:** Cocos Creator 3.8 + TypeScript (client), NestJS + Mongoose + MongoDB (server), Docker (deployment)

---

## Phase 0: 开发环境初始化与抖音平台配置

### Task 0-1: 开发环境搭建

**前置条件：**
- Node.js >= 18.x
- Cocos Creator 3.8 (LTS) — 从 [Cocos Dashboard](https://www.cocos.com/creator-download) 下载安装
- 抖音开发者工具 (IDE) — 从 [抖音开放平台](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/developer-instrument/developer-instrument-update-and-download) 下载安装（版本 >= 2.0.6，< 3.0.0）
- MongoDB >= 7.x（本地开发用）
- Git

**Step 1: 注册抖音开放平台账号**

1. 前往 https://developer.open-douyin.com/ 注册开发者账号
2. 完成个人实名认证（身份证）
3. 创建小游戏应用
4. **开发阶段使用测试账号**：
   - AppID：`tt_test_appid`（占位，后续替换为正式 AppID）
   - AppSecret：`tt_test_secret`（占位，后续替换为正式 AppSecret）
   - 测试账号无需审核，可直接在开发者工具中预览调试
5. 正式上线前再替换为真实 AppID 和 AppSecret

**Step 2: 安装抖音开发者工具**

1. 下载并安装抖音开发者工具 IDE
2. 使用抖音账号登录
3. 确认调试基础库版本 >= 1.88.0

**Step 3: 验证环境**

```bash
node --version    # >= 18.x
npm --version     # >= 9.x
git --version
mongod --version  # >= 7.x
```

**Step 4: 初始化 Git 仓库**

```bash
cd D:/workspace/tiktok/mini-game
git init
```

**Step 5: 创建 .gitignore**

```
# Node
node_modules/
dist/

# Cocos Creator
client/library/
client/local/
client/temp/
client/build/
client/profiles/
*.meta

# IDE
.idea/
.vscode/
*.iml

# OS
.DS_Store
Thumbs.db

# Env
.env
.env.local

# 抖音开发者工具
**/bytedance-mini-game/
```

**Step 6: 创建项目说明文件**

```bash
# 创建基本项目结构
mkdir -p client server docs/plans
```

**Step 7: Commit**

```bash
git add .gitignore docs/
git commit -m "chore: initialize project repo with gitignore and design docs"
```

---

### Task 0-2: 创建 Cocos Creator 项目（适配抖音小游戏）

**Files:**
- Create: `client/` (Cocos Creator project root)

**Step 1: 通过 Cocos Dashboard 创建项目**

1. 打开 Cocos Dashboard → 新建项目
2. 选择模板：**Empty(2D)**
3. 项目路径：`D:/workspace/tiktok/mini-game/client`
4. 引擎版本：**Cocos Creator 3.8.x (LTS)**
5. 点击创建

**Step 2: 配置项目设置（Project Settings）**

在 Cocos Creator 编辑器中：

1. **项目 → 项目设置 → 项目数据**
   - 设计分辨率宽度：`720`
   - 设计分辨率高度：`1280`
   - 适配屏幕宽度：`false`
   - 适配屏幕高度：`true`

2. **项目 → 项目设置 → 功能裁剪**
   - 勾选 **2D Physics: Box2D**（物理引擎）
   - 取消不需要的 3D 模块（减小包体）：
     - 取消 3D Physics
     - 取消 3D Particle
     - 取消 Terrain
     - 取消 Tween（保留，我们需要缓动）

3. **项目 → 项目设置 → 脚本**
   - 启用 TypeScript 严格模式

**Step 3: 配置构建发布（Build Settings）**

1. **项目 → 构建发布 → 新建构建任务**
2. 发布平台：**字节跳动小游戏 (ByteDance Mini Game)**
3. 配置项：
   - **AppID**：填入 `tt_test_appid`（测试阶段占位，上线前替换）
   - **设备方向**：`portrait`（竖屏）
   - **远程服务器地址**：留空（后续配置 CDN）
   - **初始场景分包**：勾选（优化首包加载）
   - **主包压缩类型**：`ZIP`

**Step 4: 创建抖音小游戏构建模板**

```
client/build-templates/bytedance-mini-game/
├── game.json
└── project.config.json
```

game.json:
```json
{
  "deviceOrientation": "portrait",
  "openDataContext": "",
  "navigateToMiniProgramAppIdList": [],
  "networkTimeout": {
    "request": 10000,
    "connectSocket": 10000,
    "uploadFile": 10000,
    "downloadFile": 10000
  }
}
```

project.config.json:
```json
{
  "setting": {
    "urlCheck": false,
    "es6": true,
    "minified": true
  },
  "appid": "tt_test_appid",
  "projectname": "catbakery",
  "condition": {}
}
```

**Step 5: 创建 tt API 类型声明文件**

```typescript
// client/assets/scripts/types/tt.d.ts

/**
 * 抖音小游戏 tt 全局 API 类型声明
 * 文档：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/overview
 */
declare namespace tt {
  // --- 登录 ---
  function login(options: {
    force?: boolean;
    success?: (res: { code: string; anonymousCode?: string }) => void;
    fail?: (err: any) => void;
    complete?: () => void;
  }): void;

  // --- 用户信息 ---
  function getUserInfo(options: {
    withCredentials?: boolean;
    success?: (res: {
      userInfo: {
        nickName: string;
        avatarUrl: string;
        gender: number;
      };
      rawData: string;
    }) => void;
    fail?: (err: any) => void;
  }): void;

  // --- 系统信息 ---
  function getSystemInfoSync(): {
    platform: string;
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    pixelRatio: number;
    SDKVersion: string;
    appName: string;
  };

  // --- 生命周期 ---
  function onShow(callback: (res: { query: Record<string, string> }) => void): void;
  function onHide(callback: () => void): void;
  function offShow(callback: Function): void;
  function offHide(callback: Function): void;
  function getLaunchOptionsSync(): { query: Record<string, string>; scene: string };

  // --- 存储 ---
  function setStorageSync(key: string, data: any): void;
  function getStorageSync(key: string): any;
  function removeStorageSync(key: string): void;

  // --- 网络请求 ---
  function request(options: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    header?: Record<string, string>;
    success?: (res: { data: any; statusCode: number; header: Record<string, string> }) => void;
    fail?: (err: any) => void;
    complete?: () => void;
  }): void;

  // --- 激励视频广告 ---
  function createRewardedVideoAd(options: { adUnitId: string }): RewardedVideoAd;
  interface RewardedVideoAd {
    load(): Promise<void>;
    show(): Promise<void>;
    onLoad(callback: () => void): void;
    offLoad(callback: () => void): void;
    onError(callback: (err: { errMsg: string; errCode: number }) => void): void;
    offError(callback: Function): void;
    onClose(callback: (res: { isEnded: boolean }) => void): void;
    offClose(callback: Function): void;
  }

  // --- 插屏广告 ---
  function createInterstitialAd(options: { adUnitId: string }): InterstitialAd;
  interface InterstitialAd {
    load(): Promise<void>;
    show(): Promise<void>;
    onLoad(callback: () => void): void;
    onError(callback: (err: any) => void): void;
    onClose(callback: () => void): void;
  }

  // --- Banner 广告 ---
  function createBannerAd(options: {
    adUnitId: string;
    style: { left: number; top: number; width: number };
  }): BannerAd;
  interface BannerAd {
    show(): Promise<void>;
    hide(): void;
    destroy(): void;
    onResize(callback: (size: { width: number; height: number }) => void): void;
    onLoad(callback: () => void): void;
    onError(callback: (err: any) => void): void;
  }

  // --- 分享 ---
  function shareAppMessage(options: {
    title?: string;
    desc?: string;
    imageUrl?: string;
    query?: string;
    success?: () => void;
    fail?: (err: any) => void;
  }): void;

  // --- 震动 ---
  function vibrateShort(options?: { success?: () => void; fail?: (err: any) => void }): void;
  function vibrateLong(options?: { success?: () => void; fail?: (err: any) => void }): void;

  // --- 支付（抖币） ---
  function requestGamePayment(options: {
    mode: 'game';
    env: number;
    currencyType: 'DIAMOND';
    platform: 'android' | 'ios';
    buyQuantity: number;
    customId: string;
    extraInfo?: string;
    success?: (res: any) => void;
    fail?: (err: any) => void;
  }): void;

  // --- 录屏 ---
  function getGameRecorderManager(): GameRecorderManager;
  interface GameRecorderManager {
    start(options?: { duration?: number }): void;
    stop(): void;
    onStart(callback: () => void): void;
    onStop(callback: (res: { videoPath: string }) => void): void;
    onError(callback: (err: any) => void): void;
  }
}
```

**Step 6: 创建 assets 目录结构**

```
client/assets/
├── prefabs/              # Prefab 预制体
│   ├── desserts/         # 8 个甜品预制体
│   ├── ui/               # UI 组件预制体
│   └── effects/          # 粒子/动画预制体
├── resources/            # 动态加载资源（会被打入 resources 包）
│   ├── configs/          # JSON 关卡配置
│   ├── textures/         # 动态加载的图片
│   └── audio/            # BGM 和音效
├── scenes/               # 场景文件
│   ├── Loading.scene
│   ├── Home.scene
│   └── Game.scene
├── scripts/              # TypeScript 源码
│   ├── core/             # 核心游戏逻辑
│   ├── ui/               # UI 控制器
│   ├── data/             # 数据模型 & 管理器
│   ├── net/              # 网络/API 层
│   ├── platform/         # 平台适配层（抖音 SDK 封装）
│   ├── types/            # 类型声明文件（tt.d.ts 等）
│   └── utils/            # 工具类
└── textures/             # 静态纹理（打入主包）
    ├── desserts/         # 甜品图片
    ├── ui/               # UI 图标
    ├── bg/               # 背景图
    └── cat/              # 猫咪角色图
```

**Step 7: Commit**

```bash
git add .
git commit -m "feat: initialize Cocos Creator project with Douyin mini-game configuration"
```

---

### Task 0-3: 包体优化策略配置

**抖音小游戏包体限制：**
- 首包（主包）：**不超过 4MB**
- 总包（含分包）：**不超过 20MB**
- 远程资源：无限制

**Step 1: 资源分包策略**

| 分类 | 位置 | 处理方式 |
|------|------|---------|
| 核心脚本 + 首场景 | `assets/scripts/`, `Loading.scene` | 打入**主包**（< 4MB） |
| 关卡配置 JSON | `assets/resources/configs/` | 打入 **resources 分包** |
| 游戏场景 (Home, Game) | `assets/scenes/` | 使用**场景分包**按需加载 |
| 甜品/UI 纹理 | `assets/textures/` | 小图打入主包，大图用**远程 CDN** |
| 音频文件 | `assets/resources/audio/` | 使用**远程 CDN**加载 |

**Step 2: 配置 Asset Bundle（在 Cocos Creator 中）**

1. 选中 `assets/resources/audio/` 文件夹
2. 在属性检查器中设置为 **Asset Bundle**
3. Bundle 名称：`audio`
4. 优先级：低
5. 压缩类型：`ZIP`
6. 勾选「配置为远程包」

**Step 3: 图片压缩规范**

- 所有纹理使用 **TinyPNG** 或 Cocos 内置压缩
- 甜品图片：每个不超过 **50KB**（8 个 = ~400KB）
- 背景图：不超过 **200KB**（使用 JPG 压缩）
- UI 图标：使用 **Auto Atlas** 自动图集合并
- 总静态纹理目标：**< 1.5MB**

**Step 4: 构建后包体检查脚本**

```bash
# 检查构建产物大小
du -sh client/build/bytedance-mini-game/          # 总包大小
du -sh client/build/bytedance-mini-game/game.js   # 主入口
du -sh client/build/bytedance-mini-game/assets/    # 资源目录
```

**Step 5: Commit**

```bash
git add .
git commit -m "docs: add package size optimization strategy for Douyin limits"
```

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Cocos Creator Project（已合并到 Task 0-2）

本任务内容已合并到 Phase 0 的 Task 0-2 中。

---

---

### Task 2: Initialize Backend Project

**Files:**
- Create: `server/` (NestJS project root)

**Step 1: Scaffold NestJS project**

```bash
cd server
npx @nestjs/cli new . --package-manager npm --skip-git
```

**Step 2: Install dependencies**

```bash
npm install @nestjs/mongoose mongoose
npm install class-validator class-transformer
npm install --save-dev @types/mongoose
```

**Step 3: Create module structure**

```
server/src/
├── auth/             # Auth module (Douyin login)
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── dto/
├── user/             # User module (profile, progress)
│   ├── user.module.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── schemas/user.schema.ts
│   └── dto/
├── rank/             # Rank module (leaderboard)
│   ├── rank.module.ts
│   ├── rank.controller.ts
│   └── rank.service.ts
└── app.module.ts
```

**Step 4: Configure MongoDB connection**

```typescript
// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RankModule } from './rank/rank.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/catbakery'),
    AuthModule,
    UserModule,
    RankModule,
  ],
})
export class AppModule {}
```

**Step 5: Commit**

```bash
git add server/
git commit -m "feat: initialize NestJS backend with module structure"
```

---

## Phase 2: Backend Core

### Task 3: User Schema & Auth

**Files:**
- Create: `server/src/user/schemas/user.schema.ts`
- Create: `server/src/auth/auth.controller.ts`
- Create: `server/src/auth/auth.service.ts`
- Create: `server/src/auth/dto/login.dto.ts`

**Step 1: Write User schema**

```typescript
// server/src/user/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true, index: true })
  openId: string;

  @Prop({ default: '' })
  nickname: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: 0 })
  catCoins: number;

  @Prop({ default: 1 })
  currentRound: number;

  @Prop({ default: 0 })
  highScore: number;

  @Prop({ type: Map, of: Number, default: {} })
  stars: Map<string, number>;  // { "1": 3, "2": 2, ... }
}

export const UserSchema = SchemaFactory.createForClass(User);
```

**Step 2: Write login DTO**

```typescript
// server/src/auth/dto/login.dto.ts
import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  code: string;  // Douyin login code from tt.login()
}
```

**Step 3: Write auth service**

```typescript
// server/src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async login(code: string): Promise<User> {
    // TODO: Exchange code for openId via Douyin server API
    // For now, use code as openId for development
    const openId = code;

    let user = await this.userModel.findOne({ openId });
    if (!user) {
      user = await this.userModel.create({ openId });
    }
    return user;
  }
}
```

**Step 4: Write auth controller**

```typescript
// server/src/auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.login(dto.code);
    return { success: true, data: user };
  }
}
```

**Step 5: Run tests and commit**

```bash
npm run test
git add . && git commit -m "feat: add user schema and auth login endpoint"
```

---

### Task 4: User Profile & Progress APIs

**Files:**
- Create: `server/src/user/user.controller.ts`
- Create: `server/src/user/user.service.ts`
- Create: `server/src/user/dto/progress.dto.ts`

**Step 1: Write progress DTO**

```typescript
// server/src/user/dto/progress.dto.ts
import { IsNumber, Min, Max } from 'class-validator';

export class ProgressDto {
  @IsNumber()
  round: number;

  @IsNumber()
  score: number;

  @IsNumber()
  @Min(1) @Max(3)
  stars: number;
}
```

**Step 2: Write user service**

```typescript
// server/src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { ProgressDto } from './dto/progress.dto';

const CAT_COIN_REWARDS = { 1: 5, 2: 10, 3: 20 };

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getProfile(openId: string): Promise<User> {
    return this.userModel.findOne({ openId });
  }

  async updateProgress(openId: string, dto: ProgressDto): Promise<User> {
    const user = await this.userModel.findOne({ openId });
    const catCoinReward = CAT_COIN_REWARDS[dto.stars] || 0;

    // Update best stars for this round
    const currentStars = user.stars.get(String(dto.round)) || 0;
    if (dto.stars > currentStars) {
      user.stars.set(String(dto.round), dto.stars);
    }

    // Update high score
    if (dto.score > user.highScore) {
      user.highScore = dto.score;
    }

    // Advance round if needed
    if (dto.round >= user.currentRound) {
      user.currentRound = dto.round + 1;
    }

    // Add cat coins
    user.catCoins += catCoinReward;

    return user.save();
  }
}
```

**Step 3: Write user controller**

```typescript
// server/src/user/user.controller.ts
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { ProgressDto } from './dto/progress.dto';

@Controller('api/user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@Query('openId') openId: string) {
    const user = await this.userService.getProfile(openId);
    return { success: true, data: user };
  }

  @Post('progress')
  async updateProgress(
    @Query('openId') openId: string,
    @Body() dto: ProgressDto,
  ) {
    const user = await this.userService.updateProgress(openId, dto);
    return { success: true, data: user };
  }
}
```

**Step 4: Run tests and commit**

```bash
npm run test
git add . && git commit -m "feat: add user profile and progress endpoints"
```

---

### Task 5: Leaderboard API

**Files:**
- Create: `server/src/rank/rank.controller.ts`
- Create: `server/src/rank/rank.service.ts`

**Step 1: Write rank service**

```typescript
// server/src/rank/rank.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';

@Injectable()
export class RankService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getGlobalRank(limit = 100) {
    return this.userModel
      .find()
      .sort({ highScore: -1 })
      .limit(limit)
      .select('nickname avatar highScore currentRound')
      .lean();
  }
}
```

**Step 2: Write rank controller**

```typescript
// server/src/rank/rank.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { RankService } from './rank.service';

@Controller('api/rank')
export class RankController {
  constructor(private rankService: RankService) {}

  @Get('global')
  async getGlobalRank(@Query('limit') limit: number) {
    const list = await this.rankService.getGlobalRank(limit || 100);
    return { success: true, data: list };
  }
}
```

**Step 3: Run tests and commit**

```bash
npm run test
git add . && git commit -m "feat: add global leaderboard endpoint"
```

---

### Task 6: Docker Setup

**Files:**
- Create: `server/Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Write Dockerfile**

```dockerfile
# server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/main"]
```

**Step 2: Write docker-compose**

```yaml
# docker-compose.yml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo-data:/data/db

  server:
    build: ./server
    ports:
      - '3000:3000'
    environment:
      MONGODB_URI: mongodb://mongodb:27017/catbakery
    depends_on:
      - mongodb

volumes:
  mongo-data:
```

**Step 3: Commit**

```bash
git add . && git commit -m "feat: add Docker setup for server and MongoDB"
```

---

## Phase 3: Client Core Systems

### Task 7: Game Data Models & Configs

**Files:**
- Create: `client/assets/scripts/data/GameTypes.ts`
- Create: `client/assets/scripts/data/DessertConfig.ts`
- Create: `client/assets/scripts/data/LevelConfig.ts`
- Create: `client/assets/resources/configs/levels.json`

**Step 1: Define game types**

```typescript
// client/assets/scripts/data/GameTypes.ts

/** Dessert level 1-8 */
export interface DessertData {
  level: number;
  name: string;
  radius: number;     // Physics body radius
  score: number;      // Score when created via merge
}

/** Single customer demand */
export interface Demand {
  level: number;
  count: number;
}

/** Customer config */
export interface CustomerData {
  demands: Demand[];
}

/** Level/round config */
export interface LevelData {
  round: number;
  customers: CustomerData[];
  dropRange: [number, number];  // min/max dessert level to drop
}
```

**Step 2: Define dessert config**

```typescript
// client/assets/scripts/data/DessertConfig.ts

import { DessertData } from './GameTypes';

export const DESSERTS: DessertData[] = [
  { level: 1, name: '饼干',     radius: 25,  score: 1 },
  { level: 2, name: '曲奇',     radius: 32,  score: 2 },
  { level: 3, name: '泡芙',     radius: 40,  score: 4 },
  { level: 4, name: '铜锣烧',   radius: 50,  score: 8 },
  { level: 5, name: '鲷鱼烧',   radius: 60,  score: 16 },
  { level: 6, name: '瑞士卷',   radius: 72,  score: 32 },
  { level: 7, name: '蛋糕卷',   radius: 85,  score: 64 },
  { level: 8, name: '奶油蛋糕', radius: 100, score: 128 },
];

export function getDessert(level: number): DessertData {
  return DESSERTS[level - 1];
}
```

**Step 3: Create first 10 level configs**

```json
// client/assets/resources/configs/levels.json
[
  {
    "round": 1,
    "customers": [{ "demands": [{ "level": 2, "count": 1 }] }],
    "dropRange": [1, 2]
  },
  {
    "round": 2,
    "customers": [
      { "demands": [{ "level": 2, "count": 1 }] },
      { "demands": [{ "level": 3, "count": 1 }] }
    ],
    "dropRange": [1, 2]
  },
  {
    "round": 3,
    "customers": [
      { "demands": [{ "level": 3, "count": 1 }] },
      { "demands": [{ "level": 3, "count": 1 }] }
    ],
    "dropRange": [1, 2]
  },
  {
    "round": 4,
    "customers": [
      { "demands": [{ "level": 3, "count": 2 }] },
      { "demands": [{ "level": 4, "count": 1 }] }
    ],
    "dropRange": [1, 3]
  },
  {
    "round": 5,
    "customers": [
      { "demands": [{ "level": 4, "count": 1 }] },
      { "demands": [{ "level": 3, "count": 2 }] },
      { "demands": [{ "level": 4, "count": 1 }] }
    ],
    "dropRange": [1, 3]
  },
  {
    "round": 6,
    "customers": [
      { "demands": [{ "level": 4, "count": 2 }] },
      { "demands": [{ "level": 3, "count": 1 }] }
    ],
    "dropRange": [1, 3]
  },
  {
    "round": 7,
    "customers": [
      { "demands": [{ "level": 4, "count": 2 }] },
      { "demands": [{ "level": 4, "count": 1 }] },
      { "demands": [{ "level": 3, "count": 2 }] }
    ],
    "dropRange": [1, 3]
  },
  {
    "round": 8,
    "customers": [
      { "demands": [{ "level": 5, "count": 1 }] },
      { "demands": [{ "level": 4, "count": 2 }] },
      { "demands": [{ "level": 5, "count": 1 }] }
    ],
    "dropRange": [1, 3]
  },
  {
    "round": 9,
    "customers": [
      { "demands": [{ "level": 5, "count": 2 }] },
      { "demands": [{ "level": 4, "count": 3 }] },
      { "demands": [{ "level": 5, "count": 1 }] }
    ],
    "dropRange": [1, 3]
  },
  {
    "round": 10,
    "customers": [
      { "demands": [{ "level": 5, "count": 2 }] },
      { "demands": [{ "level": 5, "count": 1 }] },
      { "demands": [{ "level": 4, "count": 2 }] },
      { "demands": [{ "level": 5, "count": 1 }] }
    ],
    "dropRange": [1, 3]
  }
]
```

**Step 4: Commit**

```bash
git add . && git commit -m "feat: add game data models and level configs"
```

---

### Task 8: Network Layer (API Client)

**Files:**
- Create: `client/assets/scripts/net/ApiClient.ts`
- Create: `client/assets/scripts/net/ApiTypes.ts`

**Step 1: Define API response types**

```typescript
// client/assets/scripts/net/ApiTypes.ts

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface UserProfile {
  openId: string;
  nickname: string;
  avatar: string;
  catCoins: number;
  currentRound: number;
  highScore: number;
  stars: Record<string, number>;
}

export interface RankItem {
  nickname: string;
  avatar: string;
  highScore: number;
  currentRound: number;
}
```

**Step 2: Write API client**

```typescript
// client/assets/scripts/net/ApiClient.ts

import { ApiResponse, UserProfile, RankItem } from './ApiTypes';

const BASE_URL = 'https://your-server.com';  // TODO: replace with real URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

export class ApiClient {
  private static openId: string = '';

  static setOpenId(id: string) { this.openId = id; }

  static login(code: string): Promise<UserProfile> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  static getProfile(): Promise<UserProfile> {
    return request(`/api/user/profile?openId=${this.openId}`);
  }

  static updateProgress(round: number, score: number, stars: number): Promise<UserProfile> {
    return request(`/api/user/progress?openId=${this.openId}`, {
      method: 'POST',
      body: JSON.stringify({ round, score, stars }),
    });
  }

  static getGlobalRank(limit = 100): Promise<RankItem[]> {
    return request(`/api/rank/global?limit=${limit}`);
  }
}
```

**Step 3: Commit**

```bash
git add . && git commit -m "feat: add network API client layer"
```

---

### Task 9: Game State Manager

**Files:**
- Create: `client/assets/scripts/data/GameState.ts`

**Step 1: Write GameState singleton**

```typescript
// client/assets/scripts/data/GameState.ts

import { LevelData } from './GameTypes';
import { UserProfile } from '../net/ApiTypes';

export class GameState {
  private static _instance: GameState;
  static get instance(): GameState {
    if (!this._instance) this._instance = new GameState();
    return this._instance;
  }

  // User data (from server)
  userProfile: UserProfile | null = null;

  // Current round state
  currentRound: number = 1;
  gold: number = 15;           // Reset each round
  score: number = 0;
  mergeCount: number = 0;
  startTime: number = 0;

  // Level configs (loaded from JSON)
  allLevels: LevelData[] = [];

  /** Reset round-scoped state */
  resetRound() {
    this.gold = 15;
    this.score = 0;
    this.mergeCount = 0;
    this.startTime = Date.now();
  }

  /** Add gold (from Lv8 merge or ad) */
  addGold(amount: number) {
    this.gold += amount;
  }

  /** Spend gold, returns false if insufficient */
  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  /** Calculate star rating based on score thresholds */
  calcStars(round: number): number {
    // Simple formula: based on merge count efficiency
    if (this.mergeCount >= round * 5) return 3;
    if (this.mergeCount >= round * 3) return 2;
    return 1;
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add GameState singleton for round state management"
```

---

## Phase 4: Game Scene - Core Mechanics

### Task 10: Container & Physics Setup

**Files:**
- Create: `client/assets/scripts/core/Container.ts`

**Step 1: Write Container component**

Container is a Cocos Creator component that sets up the glass container with Box2D physics walls and the warning line.

```typescript
// client/assets/scripts/core/Container.ts

import { _decorator, Component, Node, UITransform, RigidBody2D, BoxCollider2D,
         ERigidBody2DType, PhysicsSystem2D, EPhysics2DDrawFlags, Graphics, Color } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Container')
export class Container extends Component {
  @property containerWidth: number = 360;
  @property containerHeight: number = 600;
  @property wallThickness: number = 20;
  @property warningLineY: number = 240;  // relative to container center

  onLoad() {
    PhysicsSystem2D.instance.enable = true;
    PhysicsSystem2D.instance.gravity = { x: 0, y: -800 };

    this.createWall('bottom', 0, -this.containerHeight / 2, this.containerWidth, this.wallThickness);
    this.createWall('left', -this.containerWidth / 2, 0, this.wallThickness, this.containerHeight);
    this.createWall('right', this.containerWidth / 2, 0, this.wallThickness, this.containerHeight);

    this.drawWarningLine();
  }

  private createWall(name: string, x: number, y: number, w: number, h: number) {
    const wall = new Node(name);
    wall.parent = this.node;
    wall.setPosition(x, y);

    const body = wall.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Static;

    const collider = wall.addComponent(BoxCollider2D);
    collider.size.width = w;
    collider.size.height = h;
    collider.apply();
  }

  private drawWarningLine() {
    const gfx = this.node.addComponent(Graphics);
    gfx.strokeColor = new Color(255, 80, 80, 150);
    gfx.lineWidth = 2;
    const halfW = this.containerWidth / 2 - 10;
    const y = this.warningLineY;
    // Dashed line
    for (let x = -halfW; x < halfW; x += 20) {
      gfx.moveTo(x, y);
      gfx.lineTo(Math.min(x + 12, halfW), y);
    }
    gfx.stroke();
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add Container component with physics walls and warning line"
```

---

### Task 11: Dessert Prefab & Merge Logic

**Files:**
- Create: `client/assets/scripts/core/Dessert.ts`
- Create: `client/assets/scripts/core/MergeManager.ts`

**Step 1: Write Dessert component**

```typescript
// client/assets/scripts/core/Dessert.ts

import { _decorator, Component, RigidBody2D, CircleCollider2D,
         ERigidBody2DType, Sprite, SpriteFrame, UITransform } from 'cc';
import { DessertData } from '../data/GameTypes';
import { getDessert } from '../data/DessertConfig';
const { ccclass, property } = _decorator;

@ccclass('Dessert')
export class Dessert extends Component {
  level: number = 1;
  isMerging: boolean = false;

  init(level: number) {
    this.level = level;
    const data = getDessert(level);

    // Set size based on radius
    const ui = this.getComponent(UITransform);
    ui.setContentSize(data.radius * 2, data.radius * 2);

    // Configure physics body
    const body = this.getComponent(RigidBody2D);
    body.type = ERigidBody2DType.Dynamic;
    body.gravityScale = 1;

    // Configure circular collider
    const collider = this.getComponent(CircleCollider2D);
    collider.radius = data.radius;
    collider.density = 1;
    collider.friction = 0.5;
    collider.restitution = 0.3;
    collider.apply();

    // TODO: Set sprite frame based on level
  }
}
```

**Step 2: Write MergeManager**

```typescript
// client/assets/scripts/core/MergeManager.ts

import { _decorator, Component, Node, instantiate, Prefab, Contact2DType,
         Collider2D, IPhysics2DContact, Vec3, tween } from 'cc';
import { Dessert } from './Dessert';
import { getDessert, DESSERTS } from '../data/DessertConfig';
import { GameState } from '../data/GameState';
const { ccclass, property } = _decorator;

@ccclass('MergeManager')
export class MergeManager extends Component {
  @property(Prefab) dessertPrefab: Prefab = null;
  @property(Node) containerNode: Node = null;

  private pendingMerges: Set<string> = new Set();

  onLoad() {
    // Listen for collisions globally
    PhysicsSystem2D.instance.on(Contact2DType.BEGIN_CONTACT, this.onContact, this);
  }

  onContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact) {
    const dessertA = selfCollider.node.getComponent(Dessert);
    const dessertB = otherCollider.node.getComponent(Dessert);

    if (!dessertA || !dessertB) return;
    if (dessertA.isMerging || dessertB.isMerging) return;
    if (dessertA.level !== dessertB.level) return;

    // Prevent duplicate merge
    const key = [selfCollider.node.uuid, otherCollider.node.uuid].sort().join('-');
    if (this.pendingMerges.has(key)) return;
    this.pendingMerges.add(key);

    this.merge(dessertA, dessertB, key);
  }

  private merge(a: Dessert, b: Dessert, key: string) {
    a.isMerging = true;
    b.isMerging = true;

    const level = a.level;
    const midPos = new Vec3();
    Vec3.lerp(midPos, a.node.worldPosition, b.node.worldPosition, 0.5);

    // Animate both into center
    tween(a.node).to(0.15, { worldPosition: midPos }).call(() => {
      a.node.destroy();
    }).start();

    tween(b.node).to(0.15, { worldPosition: midPos }).call(() => {
      b.node.destroy();
      this.pendingMerges.delete(key);

      if (level >= DESSERTS.length) {
        // Two Lv8 merged -> award 50 gold
        GameState.instance.addGold(50);
        // TODO: play gold effect
        return;
      }

      // Spawn next level dessert
      this.spawnDessert(level + 1, midPos);
      GameState.instance.score += getDessert(level + 1).score;
      GameState.instance.mergeCount++;
      // TODO: check if customer wants this dessert
    }).start();
  }

  spawnDessert(level: number, worldPos: Vec3): Node {
    const node = instantiate(this.dessertPrefab);
    node.parent = this.containerNode;
    node.worldPosition = worldPos;
    node.getComponent(Dessert).init(level);
    return node;
  }
}
```

**Step 3: Commit**

```bash
git add . && git commit -m "feat: add Dessert component and MergeManager with collision-based merging"
```

---

### Task 12: Drop Controller (Player Input)

**Files:**
- Create: `client/assets/scripts/core/DropController.ts`

**Step 1: Write DropController**

```typescript
// client/assets/scripts/core/DropController.ts

import { _decorator, Component, Node, EventTouch, input, Input, Vec3,
         UITransform, Vec2 } from 'cc';
import { MergeManager } from './MergeManager';
import { GameState } from '../data/GameState';
const { ccclass, property } = _decorator;

@ccclass('DropController')
export class DropController extends Component {
  @property(MergeManager) mergeManager: MergeManager = null;
  @property(Node) previewNode: Node = null;     // Shows current dessert above container
  @property(Node) guideLineNode: Node = null;   // Dotted vertical guide line
  @property containerLeft: number = -180;
  @property containerRight: number = 180;
  @property dropY: number = 280;

  private currentLevel: number = 1;
  private nextLevel: number = 1;
  private canDrop: boolean = true;
  private dropCooldown: number = 0.5;  // seconds

  onLoad() {
    this.generateNext();
    this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  private onTouchMove(event: EventTouch) {
    if (!this.canDrop) return;
    const uiTransform = this.node.getComponent(UITransform);
    const localPos = uiTransform.convertToNodeSpaceAR(
      new Vec3(event.getUILocation().x, event.getUILocation().y, 0)
    );
    // Clamp X within container bounds
    const x = Math.max(this.containerLeft, Math.min(this.containerRight, localPos.x));
    this.previewNode.setPosition(x, this.dropY);
    // Update guide line position
    if (this.guideLineNode) {
      this.guideLineNode.setPosition(x, 0);
    }
  }

  private onTouchEnd(event: EventTouch) {
    if (!this.canDrop) return;
    this.canDrop = false;

    const dropPos = new Vec3(this.previewNode.position.x, this.dropY, 0);
    const worldPos = this.node.getComponent(UITransform).convertToWorldSpaceAR(dropPos);

    // Drop current dessert
    this.mergeManager.spawnDessert(this.currentLevel, worldPos);

    // Prepare next
    this.currentLevel = this.nextLevel;
    this.generateNext();

    // Cooldown
    this.scheduleOnce(() => { this.canDrop = true; }, this.dropCooldown);
  }

  private generateNext() {
    const state = GameState.instance;
    const levelConfig = state.allLevels[state.currentRound - 1];
    const [min, max] = levelConfig?.dropRange || [1, 2];
    this.nextLevel = min + Math.floor(Math.random() * (max - min + 1));
    // TODO: update NEXT preview UI
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add DropController for player touch input and dessert dropping"
```

---

### Task 13: Overflow Detection

**Files:**
- Create: `client/assets/scripts/core/OverflowDetector.ts`

**Step 1: Write OverflowDetector**

```typescript
// client/assets/scripts/core/OverflowDetector.ts

import { _decorator, Component, Node, Label } from 'cc';
import { Dessert } from './Dessert';
const { ccclass, property } = _decorator;

@ccclass('OverflowDetector')
export class OverflowDetector extends Component {
  @property(Node) containerNode: Node = null;
  @property(Label) countdownLabel: Label = null;
  @property warningLineY: number = 240;
  @property countdownTime: number = 5;

  private overflowing: boolean = false;
  private timer: number = 0;
  onGameOver: () => void = null;

  update(dt: number) {
    const isOver = this.checkOverflow();

    if (isOver && !this.overflowing) {
      this.overflowing = true;
      this.timer = this.countdownTime;
      this.countdownLabel.node.active = true;
    } else if (!isOver && this.overflowing) {
      this.overflowing = false;
      this.countdownLabel.node.active = false;
    }

    if (this.overflowing) {
      this.timer -= dt;
      this.countdownLabel.string = Math.ceil(this.timer).toString();
      if (this.timer <= 0) {
        this.overflowing = false;
        this.countdownLabel.node.active = false;
        this.onGameOver?.();
      }
    }
  }

  private checkOverflow(): boolean {
    const desserts = this.containerNode.getComponentsInChildren(Dessert);
    for (const d of desserts) {
      if (d.isMerging) continue;
      if (d.node.position.y > this.warningLineY) return true;
    }
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add OverflowDetector with countdown timer"
```

---

## Phase 5: Customer System

### Task 14: Customer Manager

**Files:**
- Create: `client/assets/scripts/core/CustomerManager.ts`

**Step 1: Write CustomerManager**

```typescript
// client/assets/scripts/core/CustomerManager.ts

import { _decorator, Component, Node, Label, Sprite, tween, Vec3 } from 'cc';
import { CustomerData, Demand } from '../data/GameTypes';
const { ccclass, property } = _decorator;

@ccclass('CustomerManager')
export class CustomerManager extends Component {
  @property(Node) catNode: Node = null;           // Cat sprite node
  @property(Node) bubbleNode: Node = null;        // Speech bubble
  @property(Node) demandContainer: Node = null;   // Parent for demand icons

  private customers: CustomerData[] = [];
  private currentIndex: number = 0;
  private currentDemands: Map<number, number> = new Map();  // level -> remaining count

  onRoundComplete: () => void = null;

  /** Initialize with round's customer list */
  initRound(customers: CustomerData[]) {
    this.customers = customers;
    this.currentIndex = 0;
    this.showCustomer(0);
  }

  /** Called when a dessert of given level is merged */
  onDessertMerged(level: number): boolean {
    if (!this.currentDemands.has(level)) return false;

    const remaining = this.currentDemands.get(level) - 1;
    if (remaining <= 0) {
      this.currentDemands.delete(level);
    } else {
      this.currentDemands.set(level, remaining);
    }

    this.updateDemandUI();

    // Check if current customer is satisfied
    if (this.currentDemands.size === 0) {
      this.onCustomerSatisfied();
      return true;
    }
    return true;
  }

  private onCustomerSatisfied() {
    // Play satisfied animation
    tween(this.catNode)
      .by(0.1, { position: new Vec3(0, 10, 0) })
      .by(0.1, { position: new Vec3(0, -10, 0) })
      .start();

    // Next customer or round complete
    this.currentIndex++;
    if (this.currentIndex >= this.customers.length) {
      this.scheduleOnce(() => { this.onRoundComplete?.(); }, 0.8);
    } else {
      this.scheduleOnce(() => { this.showCustomer(this.currentIndex); }, 0.8);
    }
  }

  private showCustomer(index: number) {
    const customer = this.customers[index];
    this.currentDemands.clear();
    for (const demand of customer.demands) {
      this.currentDemands.set(demand.level, demand.count);
    }

    // Animate cat entrance
    this.catNode.setPosition(-400, this.catNode.position.y);
    tween(this.catNode).to(0.4, { position: new Vec3(-80, this.catNode.position.y, 0) }).start();

    this.updateDemandUI();
  }

  private updateDemandUI() {
    // TODO: Update bubble UI to show remaining demands
    // Each demand: dessert icon + "x count"
  }

  /** Get current demands (for checking auto-serve) */
  getCurrentDemands(): Map<number, number> {
    return this.currentDemands;
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add CustomerManager for customer queue and demand tracking"
```

---

## Phase 6: UI Scenes

### Task 15: Loading Scene

**Files:**
- Create: `client/assets/scripts/ui/LoadingScene.ts`

**Step 1: Write LoadingScene controller**

```typescript
// client/assets/scripts/ui/LoadingScene.ts

import { _decorator, Component, Label, director, resources, JsonAsset } from 'cc';
import { ApiClient } from '../net/ApiClient';
import { GameState } from '../data/GameState';
const { ccclass, property } = _decorator;

@ccclass('LoadingScene')
export class LoadingScene extends Component {
  @property(Label) statusLabel: Label = null;

  async onLoad() {
    this.statusLabel.string = '正在登录中...';

    try {
      // Step 1: Douyin login
      // In real environment: const res = await tt.login();
      const code = 'dev-test-code';  // TODO: replace with tt.login()
      const user = await ApiClient.login(code);
      ApiClient.setOpenId(user.openId);
      GameState.instance.userProfile = user;
      GameState.instance.currentRound = user.currentRound;

      // Step 2: Load level configs
      this.statusLabel.string = '加载资源中...';
      await this.loadLevelConfigs();

      // Step 3: Go to home
      director.loadScene('Home');
    } catch (e) {
      this.statusLabel.string = '登录失败，点击重试';
      this.node.on(Node.EventType.TOUCH_END, () => this.onLoad());
    }
  }

  private loadLevelConfigs(): Promise<void> {
    return new Promise((resolve, reject) => {
      resources.load('configs/levels', JsonAsset, (err, asset) => {
        if (err) { reject(err); return; }
        GameState.instance.allLevels = asset.json as any;
        resolve();
      });
    });
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add LoadingScene with auto-login and resource loading"
```

---

### Task 16: Home Scene

**Files:**
- Create: `client/assets/scripts/ui/HomeScene.ts`

**Step 1: Write HomeScene controller**

```typescript
// client/assets/scripts/ui/HomeScene.ts

import { _decorator, Component, Label, Node, director } from 'cc';
import { GameState } from '../data/GameState';
const { ccclass, property } = _decorator;

@ccclass('HomeScene')
export class HomeScene extends Component {
  @property(Label) roundLabel: Label = null;
  @property(Label) catCoinLabel: Label = null;
  @property(Node) starNodes: Node[] = [];       // 3 star nodes
  @property(Node) btnStart: Node = null;
  @property(Node) btnPrev: Node = null;
  @property(Node) btnNext: Node = null;
  @property(Node) btnRank: Node = null;
  @property(Node) btnSettings: Node = null;

  private viewingRound: number = 1;

  onLoad() {
    const state = GameState.instance;
    this.viewingRound = state.currentRound;
    this.updateDisplay();

    this.btnStart.on(Node.EventType.TOUCH_END, this.onStartGame, this);
    this.btnPrev.on(Node.EventType.TOUCH_END, this.onPrevRound, this);
    this.btnNext.on(Node.EventType.TOUCH_END, this.onNextRound, this);
  }

  private onStartGame() {
    GameState.instance.currentRound = this.viewingRound;
    GameState.instance.resetRound();
    director.loadScene('Game');
  }

  private onPrevRound() {
    if (this.viewingRound > 1) {
      this.viewingRound--;
      this.updateDisplay();
    }
  }

  private onNextRound() {
    const maxRound = GameState.instance.userProfile?.currentRound || 1;
    if (this.viewingRound < maxRound) {
      this.viewingRound++;
      this.updateDisplay();
    }
  }

  private updateDisplay() {
    const state = GameState.instance;
    this.roundLabel.string = `第 ${this.viewingRound} 关`;
    this.catCoinLabel.string = `${state.userProfile?.catCoins || 0}`;

    // Show stars for this round
    const stars = state.userProfile?.stars?.[String(this.viewingRound)] || 0;
    for (let i = 0; i < 3; i++) {
      this.starNodes[i].active = i < stars;
    }

    // Disable next button if at max unlocked round
    const maxRound = state.userProfile?.currentRound || 1;
    this.btnNext.active = this.viewingRound < maxRound;
    this.btnPrev.active = this.viewingRound > 1;
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add HomeScene with level selection and display"
```

---

### Task 17: Game Scene Controller

**Files:**
- Create: `client/assets/scripts/ui/GameScene.ts`

**Step 1: Write GameScene orchestrator**

This is the main game scene that wires together all core systems.

```typescript
// client/assets/scripts/ui/GameScene.ts

import { _decorator, Component, Label, Node, director } from 'cc';
import { MergeManager } from '../core/MergeManager';
import { DropController } from '../core/DropController';
import { OverflowDetector } from '../core/OverflowDetector';
import { CustomerManager } from '../core/CustomerManager';
import { GameState } from '../data/GameState';
import { ApiClient } from '../net/ApiClient';
const { ccclass, property } = _decorator;

@ccclass('GameScene')
export class GameScene extends Component {
  @property(MergeManager) mergeManager: MergeManager = null;
  @property(DropController) dropController: DropController = null;
  @property(OverflowDetector) overflowDetector: OverflowDetector = null;
  @property(CustomerManager) customerManager: CustomerManager = null;

  // HUD
  @property(Label) goldLabel: Label = null;
  @property(Label) roundLabel: Label = null;
  @property(Label) scoreLabel: Label = null;

  // Popups
  @property(Node) pausePopup: Node = null;
  @property(Node) winPopup: Node = null;
  @property(Node) losePopup: Node = null;
  @property(Label) winStarsLabel: Label = null;
  @property(Label) winCatCoinLabel: Label = null;

  private state = GameState.instance;

  onLoad() {
    this.state.resetRound();
    const round = this.state.currentRound;
    const levelData = this.state.allLevels[round - 1];

    // Init HUD
    this.roundLabel.string = `第 ${round} 关`;
    this.updateGoldDisplay();

    // Init customer queue
    this.customerManager.initRound(levelData.customers);
    this.customerManager.onRoundComplete = () => this.onWin();

    // Init overflow detection
    this.overflowDetector.onGameOver = () => this.onLose();

    // Hide popups
    this.pausePopup.active = false;
    this.winPopup.active = false;
    this.losePopup.active = false;
  }

  update() {
    this.goldLabel.string = `${this.state.gold}`;
    this.scoreLabel.string = `${this.state.score}`;
  }

  // --- Popup handlers ---

  onPauseClicked() {
    this.pausePopup.active = true;
    director.pause();
  }

  onResumeClicked() {
    this.pausePopup.active = false;
    director.resume();
  }

  onRestartClicked() {
    director.resume();
    director.loadScene('Game');
  }

  onHomeClicked() {
    director.resume();
    director.loadScene('Home');
  }

  private async onWin() {
    const stars = this.state.calcStars(this.state.currentRound);
    const catCoinRewards = { 1: 5, 2: 10, 3: 20 };
    const catCoins = catCoinRewards[stars];

    this.winStarsLabel.string = '⭐'.repeat(stars);
    this.winCatCoinLabel.string = `+${catCoins}`;
    this.winPopup.active = true;

    // Report to server
    await ApiClient.updateProgress(this.state.currentRound, this.state.score, stars);
  }

  private onLose() {
    this.losePopup.active = true;
  }

  onNextRoundClicked() {
    this.state.currentRound++;
    director.loadScene('Game');
  }

  onRetryClicked() {
    director.loadScene('Game');
  }

  onAdReviveClicked() {
    // TODO: Show rewarded video ad, then clear top half of container
    this.losePopup.active = false;
  }

  private updateGoldDisplay() {
    this.goldLabel.string = `${this.state.gold}`;
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add GameScene controller wiring all systems together"
```

---

## Phase 7: Item System & UI Polish

### Task 18: Item System (Hammer & Shuffle)

**Files:**
- Create: `client/assets/scripts/core/ItemManager.ts`

**Step 1: Write ItemManager**

```typescript
// client/assets/scripts/core/ItemManager.ts

import { _decorator, Component, Node, Label, Vec3 } from 'cc';
import { Dessert } from './Dessert';
import { GameState } from '../data/GameState';
const { ccclass, property } = _decorator;

enum ItemMode { None, Hammer, Shuffle }

@ccclass('ItemManager')
export class ItemManager extends Component {
  @property(Node) containerNode: Node = null;
  @property(Label) goldLabel: Label = null;

  private mode: ItemMode = ItemMode.None;
  private state = GameState.instance;

  /** Called by Hammer button */
  onHammerClicked() {
    if (!this.state.spendGold(15)) return;  // Not enough gold
    this.mode = ItemMode.Hammer;
    // Wait for player to tap a dessert
    this.containerNode.on(Node.EventType.TOUCH_END, this.onContainerTap, this);
  }

  /** Called by Shuffle button */
  onShuffleClicked() {
    if (!this.state.spendGold(20)) return;
    const desserts = this.containerNode.getComponentsInChildren(Dessert);
    // Collect all positions, shuffle, reassign
    const positions = desserts.map(d => d.node.position.clone());
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    desserts.forEach((d, i) => d.node.setPosition(positions[i]));
  }

  /** Called by Ad button */
  onAdClicked() {
    // TODO: Show rewarded video ad via tt.createRewardedVideoAd()
    // On success:
    this.state.addGold(10);
  }

  private onContainerTap(event: any) {
    if (this.mode !== ItemMode.Hammer) return;
    this.containerNode.off(Node.EventType.TOUCH_END, this.onContainerTap, this);
    this.mode = ItemMode.None;

    // Find closest dessert to tap position
    const tapPos = event.getUILocation();
    const desserts = this.containerNode.getComponentsInChildren(Dessert);
    let closest: Dessert = null;
    let minDist = Infinity;
    for (const d of desserts) {
      const dist = Vec3.distance(d.node.worldPosition, new Vec3(tapPos.x, tapPos.y, 0));
      if (dist < minDist) {
        minDist = dist;
        closest = d;
      }
    }
    if (closest && minDist < 100) {
      closest.node.destroy();
    }
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add ItemManager with hammer, shuffle, and ad gold"
```

---

### Task 19: Audio Manager

**Files:**
- Create: `client/assets/scripts/utils/AudioManager.ts`

**Step 1: Write AudioManager singleton**

```typescript
// client/assets/scripts/utils/AudioManager.ts

import { _decorator, AudioSource, AudioClip, resources, director, Node } from 'cc';

export class AudioManager {
  private static _instance: AudioManager;
  static get instance(): AudioManager {
    if (!this._instance) this._instance = new AudioManager();
    return this._instance;
  }

  private bgmSource: AudioSource = null;
  private sfxSource: AudioSource = null;
  private bgmEnabled: boolean = true;
  private sfxEnabled: boolean = true;

  init(node: Node) {
    this.bgmSource = node.addComponent(AudioSource);
    this.sfxSource = node.addComponent(AudioSource);
    this.bgmSource.loop = true;
  }

  playBGM(clipPath: string) {
    if (!this.bgmEnabled) return;
    resources.load(clipPath, AudioClip, (err, clip) => {
      if (err) return;
      this.bgmSource.clip = clip;
      this.bgmSource.play();
    });
  }

  stopBGM() { this.bgmSource?.stop(); }

  playSFX(clipPath: string) {
    if (!this.sfxEnabled) return;
    resources.load(clipPath, AudioClip, (err, clip) => {
      if (err) return;
      this.sfxSource.playOneShot(clip);
    });
  }

  toggleBGM(): boolean { this.bgmEnabled = !this.bgmEnabled; if (!this.bgmEnabled) this.stopBGM(); return this.bgmEnabled; }
  toggleSFX(): boolean { this.sfxEnabled = !this.sfxEnabled; return this.sfxEnabled; }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add AudioManager singleton for BGM and SFX"
```

---

## Phase 8: Integration & Polish

### Task 20: Wire MergeManager to CustomerManager

**Files:**
- Modify: `client/assets/scripts/core/MergeManager.ts`

**Step 1: Add customer check after merge**

In `MergeManager.merge()`, after spawning the next level dessert, check if any customer wants it. If yes, instead of placing it in the container, fly it to the customer.

```typescript
// Add to MergeManager class:
@property(CustomerManager) customerManager: CustomerManager = null;

// In merge() method, replace the TODO comment:
const newLevel = level + 1;
if (this.customerManager.onDessertMerged(newLevel)) {
  // Dessert was served to customer - fly animation
  const dessertNode = this.spawnDessert(newLevel, midPos);
  const catWorldPos = this.customerManager.catNode.worldPosition;
  tween(dessertNode)
    .to(0.5, { worldPosition: catWorldPos, scale: new Vec3(0.3, 0.3, 1) })
    .call(() => dessertNode.destroy())
    .start();
} else {
  this.spawnDessert(newLevel, midPos);
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: wire merge system to customer demand checking with fly animation"
```

---

### Task 21: Scene Setup in Cocos Editor

**Files:**
- Modify: `client/assets/scenes/Loading.scene`
- Modify: `client/assets/scenes/Home.scene`
- Modify: `client/assets/scenes/Game.scene`

**Step 1: Set up Loading scene in Cocos Editor**

- Create Canvas (720x1280)
- Add background sprite (solid warm color placeholder)
- Add Label "猫咪甜品店" centered, font size 48
- Add Label "正在登录中..." below, font size 24
- Add LoadingScene script to Canvas

**Step 2: Set up Home scene in Cocos Editor**

- Create Canvas (720x1280)
- Add background sprite (bakery storefront placeholder)
- Add round Label centered "第 1 关"
- Add 3 star sprites below round label
- Add "开始游戏" button (large, centered bottom)
- Add prev/next arrow buttons
- Add floating buttons: 🏆 (left-top), ⚙️ (right-top), 🛒 (left-mid)
- Add cat coin label (bottom-left)
- Add HomeScene script to Canvas

**Step 3: Set up Game scene in Cocos Editor**

- Create Canvas (720x1280)
- HUD row 1: pause button, gold label, round label, NEXT preview sprite
- HUD row 2: hammer btn, shuffle btn, ad btn
- Container node (360x600) centered, with Container script
- Cat customer node (left side) with CustomerManager
- Warning line Graphics in container
- Countdown label (hidden by default)
- Popup prefabs: pause, win, lose
- Add GameScene, MergeManager, DropController, OverflowDetector, ItemManager scripts

**Step 4: Create dessert prefab**

- Create a prefab with: Node + Sprite + UITransform + RigidBody2D + CircleCollider2D + Dessert script
- Save to `prefabs/desserts/DessertPrefab.prefab`

**Step 5: Commit**

```bash
git add . && git commit -m "feat: set up Loading, Home, and Game scenes in editor"
```

---

### Task 22: Placeholder Art Assets

**Files:**
- Create: `client/assets/textures/desserts/` (8 placeholder images)
- Create: `client/assets/textures/ui/` (buttons, icons)
- Create: `client/assets/textures/bg/` (backgrounds)

**Step 1: Create placeholder textures**

Use simple colored circles for 8 dessert levels:
- Lv1: Small beige circle (50px)
- Lv2: Medium brown circle (64px)
- Lv3: Light yellow circle (80px)
- Lv4: Orange circle (100px)
- Lv5: Pink circle (120px)
- Lv6: Green circle (144px)
- Lv7: Light brown circle (170px)
- Lv8: White/cream circle (200px)

Create placeholder UI icons:
- pause.png, hammer.png, shuffle.png, ad.png
- star_on.png, star_off.png
- arrow_left.png, arrow_right.png

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add placeholder art assets for desserts and UI"
```

---

## Phase 9: Douyin Platform Integration

### Task 23: Douyin SDK Integration

**Files:**
- Create: `client/assets/scripts/platform/DouyinSDK.ts`

**Step 1: Write Douyin platform wrapper**

```typescript
// client/assets/scripts/platform/DouyinSDK.ts

declare const tt: any;  // Douyin mini-game global

export class DouyinSDK {
  /** Login and get code */
  static login(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof tt === 'undefined') {
        // Dev environment fallback
        resolve('dev-test-code');
        return;
      }
      tt.login({
        success: (res: any) => resolve(res.code),
        fail: (err: any) => reject(err),
      });
    });
  }

  /** Get user info (needs authorization) */
  static getUserInfo(): Promise<{ nickName: string; avatarUrl: string }> {
    return new Promise((resolve, reject) => {
      tt.getUserInfo({
        success: (res: any) => resolve(res.userInfo),
        fail: (err: any) => reject(err),
      });
    });
  }

  /** Show rewarded video ad */
  static showRewardedAd(adUnitId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof tt === 'undefined') { resolve(true); return; }
      const ad = tt.createRewardedVideoAd({ adUnitId });
      ad.onClose((res: any) => resolve(res?.isEnded ?? false));
      ad.show().catch(() => {
        ad.load().then(() => ad.show());
      });
    });
  }

  /** Show interstitial ad */
  static showInterstitialAd(adUnitId: string) {
    if (typeof tt === 'undefined') return;
    const ad = tt.createInterstitialAd({ adUnitId });
    ad.show().catch(() => {});
  }

  /** Share to Douyin */
  static share(title: string, imageUrl?: string) {
    if (typeof tt === 'undefined') return;
    tt.shareAppMessage({ title, imageUrl });
  }
}
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: add Douyin SDK wrapper for login, ads, and sharing"
```

---

### Task 24: Build & Deploy Configuration

**Files:**
- Create: `client/build-templates/bytedance-mini-game/game.json`
- Modify: `server/Dockerfile`
- Create: `.gitignore`

**Step 1: Configure Douyin mini-game build template**

```json
// client/build-templates/bytedance-mini-game/game.json
{
  "deviceOrientation": "portrait",
  "openDataContext": "openDataContext",
  "navigateToMiniProgramAppIdList": []
}
```

**Step 2: Create .gitignore**

```
# Node
node_modules/
dist/

# Cocos Creator
client/library/
client/local/
client/temp/
client/build/
*.meta

# IDE
.idea/
.vscode/

# OS
.DS_Store
Thumbs.db

# Env
.env
```

**Step 3: Commit**

```bash
git add . && git commit -m "feat: add Douyin build template and .gitignore"
```

---

## Phase 10: Testing & Launch Prep

### Task 25: Backend E2E Tests

**Files:**
- Create: `server/test/app.e2e-spec.ts`

**Step 1: Write E2E tests**

```typescript
// server/test/app.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('CatBakery API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('POST /api/auth/login → creates user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ code: 'test-user-1' })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.openId).toBe('test-user-1');
  });

  it('GET /api/user/profile → returns user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/user/profile?openId=test-user-1')
      .expect(200);
    expect(res.body.data.catCoins).toBe(0);
    expect(res.body.data.currentRound).toBe(1);
  });

  it('POST /api/user/progress → updates progress', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/user/progress?openId=test-user-1')
      .send({ round: 1, score: 150, stars: 3 })
      .expect(201);
    expect(res.body.data.catCoins).toBe(20);
    expect(res.body.data.currentRound).toBe(2);
    expect(res.body.data.highScore).toBe(150);
  });

  it('GET /api/rank/global → returns leaderboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/rank/global?limit=10')
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests**

```bash
cd server && npm run test:e2e
```

**Step 3: Commit**

```bash
git add . && git commit -m "test: add backend E2E tests for auth, profile, progress, and rank"
```

---

### Task 26: Client Playtest & Build

**Step 1: Playtest in Cocos Creator preview**

- Run in browser preview mode
- Verify: desserts drop, merge, overflow detection works
- Verify: customer demands and satisfaction flow
- Verify: gold spending on items, ad button placeholder

**Step 2: Build for Douyin**

In Cocos Creator:
- Project → Build → Select "ByteDance Mini Game"
- Set AppId (from Douyin developer portal)
- Build & preview in Douyin developer tools

**Step 3: Commit final build config**

```bash
git add . && git commit -m "chore: configure Douyin mini-game build settings"
```

---

## Summary: Task Dependency Graph

```
Phase 0: 环境初始化 & 抖音配置
  Task 0-1 (开发环境) ─────┐
  Task 0-2 (Cocos+抖音配置)┤
  Task 0-3 (包体优化策略) ─┤
                            ▼
Phase 1: Scaffolding        │
  Task 1 (已合并到0-2) ─── │
  Task 2 (Server init) ────┤
                            ▼
Phase 2: Backend            │
  Task 3 (Auth) ────────────┤
  Task 4 (User APIs) ───────┤
  Task 5 (Rank API) ────────┤
  Task 6 (Docker) ──────────│
                            ▼
Phase 3: Client Core        │
  Task 7 (Data Models) ─────┤
  Task 8 (API Client) ──────┤
  Task 9 (GameState) ───────┤
                            ▼
Phase 4: Game Mechanics     │
  Task 10 (Container) ──────┤
  Task 11 (Merge Logic) ────┤
  Task 12 (Drop Input) ─────┤
  Task 13 (Overflow) ───────┤
                            ▼
Phase 5: Customer           │
  Task 14 (CustomerMgr) ────┤
                            ▼
Phase 6: UI Scenes          │
  Task 15 (Loading) ────────┤
  Task 16 (Home) ───────────┤
  Task 17 (Game Scene) ─────┤
                            ▼
Phase 7: Items & Audio      │
  Task 18 (Items) ──────────┤
  Task 19 (Audio) ──────────┤
                            ▼
Phase 8: Integration        │
  Task 20 (Wire Systems) ───┤
  Task 21 (Scene Setup) ────┤
  Task 22 (Placeholder Art) │
                            ▼
Phase 9: Platform           │
  Task 23 (Douyin SDK) ─────┤
  Task 24 (Build Config) ───┤
                            ▼
Phase 10: Testing           │
  Task 25 (Backend Tests) ──┤
  Task 26 (Playtest) ───────┘
```

**Parallel opportunities:**
- Phase 0: Task 0-1 先行，Task 0-2 和 Task 0-3 在环境就绪后执行
- Phase 1: Task 2 (Server init) 可与 Phase 0 的 Task 0-2 并行
- Phase 2: Tasks 3-6 are sequential
- Phase 3: Tasks 7-9 can run in parallel after Phase 0
- Phase 4: Tasks 10-13 are sequential (each builds on prior)
- Phase 7: Tasks 18-19 can run in parallel
- Phase 9: Tasks 23-24 can run in parallel

## 抖音小游戏关键限制速查

| 限制项 | 要求 |
|--------|------|
| 首包（主包） | ≤ **4MB** |
| 总包（含分包） | ≤ **20MB** |
| 单个分包 | ≤ **20MB** |
| 远程资源 | 无限制（CDN 加载） |
| 设备方向 | `portrait`（竖屏） |
| 调试基础库 | ≥ **1.88.0** |
| 开发者工具版本 | ≥ **2.0.6**，< 3.0.0 |
| 必须文件 | `game.json` + `project.config.json` + `game.js` |
| 全局 API | `tt` 对象（非浏览器环境，无 DOM/BOM） |
