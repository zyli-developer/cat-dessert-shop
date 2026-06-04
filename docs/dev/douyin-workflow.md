# Douyin Mini-Game 构建 / 预览 / 上传 工作流

> 实现于 2026-04-15，B/D 阶段测试自动化落地。

---

## 前置

1. **Cocos Creator 3.8.x 已安装**（`COCOS_CREATOR_PATH` 指向 CocosCreator.exe）
2. **`tt-minigame-ide-cli` 已全局安装**
   ```bash
   npm install -g tt-minigame-ide-cli
   ```
3. **已用 `tmg login -m` 手机号交互登录**（session 本地缓存）

## 本地命令（npm scripts）

```bash
# 1. 只构建（Cocos 无头，~30s 增量 / ~3min 冷启）
npm --workspace e2e run build:tt

# 2. 构建 + 生成抖音体验版 QR（不上传）
npm --workspace e2e run preview:tt
# → e2e/dist/bytedance-mini-game.preview.png
# → stdout 末尾带 https://t.zijieimg.com/... URL

# 3. 上传体验版到抖音开放平台（需版本 + 可选 changelog）
npm --workspace e2e run upload:tt 0.0.1 "first automation upload"
```

## 通过 Claude / MCP 调用

`.mcp.json` 已注册 `catbakery-douyin` MCP server。Claude Code 重启 / 新对话后自动挂载，可直接用工具：

| 工具名 | 作用 |
|--------|------|
| `cocos_build_bytedance` | 触发 Cocos 无头构建 |
| `tmg_preview` | build-if-missing + 生成 QR |
| `tmg_upload` | build-if-missing + 上传版本 |
| `tmg_login_status` | 探测 tmg 是否登录 |
| `build_status` | 查看构建产物 |

示例对话：
> "帮我出一个抖音体验版二维码"
> → Claude 调 `tmg_preview` → 返回 QR URL + 图片路径

## CI 现状

**CI 上 tmg preview / upload 不可行**：
- `tmg` 只支持交互式 `tmg login -m/-e`（手机短信 / 邮箱密码）
- **没有** token / env var / service account 方式做无人值守登录
- GitHub Actions runner 里没法扫短信/读邮件

**CI 仍然能做的**（参见 `.github/workflows/test.yml`）：
- `npm run test:all`（server + client + scripts 单元 + server e2e + Playwright）
- 带 `COCOS_CREATOR_PATH` 的 self-hosted runner 上，可执行 `npm --workspace e2e run build:tt` 验证构建产物不回归

**真实抖音 preview / upload 的 CI 替代方案**：
1. **手工触发**：发版前在本机 `npm --workspace e2e run upload:tt <version>`
2. **半自动**：发 PR 时 CI 触发 build，把产物 artifact 传给开发者本机，再手动 `tmg upload`
3. **若 tt-minigame-ide-cli 未来加 token auth**：直接接进 CI job

参见 `e2e/smoke-douyin-cli.md` 的人工冒烟清单。

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `COCOS_CREATOR_PATH not set` | 环境变量未设置 | 设置为 Cocos Creator.exe 绝对路径 |
| `EPERM: ...project.log` / `port 3334 in use` | 残留 Cocos 实例 | `tasklist -FI "IMAGENAME eq CocosCreator.exe"` → 杀掉所有 |
| `tmg preview` 卡住 / 超时 | session 失效 | `tmg logout` + `tmg login -m` 重新登录 |
| `Invalid project: project.config.json` | `tmg` 指向的是源码目录 | 改为指向 `e2e/dist/bytedance-mini-game/` 构建产物 |
| Cocos 退出码非零但产物已生成 | MCPServer port 冲突等噪音 | 已在 `build-bytedance.mjs` 里容错（看 `game.json` 标记而非 exit code） |
