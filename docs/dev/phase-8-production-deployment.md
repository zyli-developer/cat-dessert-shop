# Phase 8：生产环境部署

- 生产域名：`jingjingyeye.vip`
- 公网 HTTPS 端口：`8099`
- 宿主机内部代理端口：`18099`
- 客户端 API 根地址：`https://jingjingyeye.vip:8099`

## 架构

```text
抖音小游戏
  -> HTTPS jingjingyeye.vip:8099
  -> Nginx 独立监听 8099
  -> 127.0.0.1:18099
  -> NestJS
  -> Docker 内网 MongoDB:27017
```

公网只新增 HTTPS `8099`。NestJS 容器仅映射到服务器回环地址 `127.0.0.1:18099`，
MongoDB 不映射宿主机端口。现有 80/443/8000/8088 服务不变。

## 服务器前置条件

- Linux 服务器，域名 A/AAAA 记录已指向该服务器
- Docker Engine 与 Docker Compose v2
- Nginx
- `jingjingyeye.vip` 现有 HTTPS 站点与证书可用
- 已备案、可配置到抖音开放平台的域名

## 首次部署

1. 将仓库上传或克隆到服务器。
2. 创建生产环境文件：

   ```bash
   cp deploy/.env.production.example deploy/.env.production
   chmod 600 deploy/.env.production
   ```

3. 填写 MongoDB 密码、抖音 App ID/Secret 和随机 `AUTH_TOKEN_SECRET`：

   ```bash
   openssl rand -hex 32
   ```

   如果服务器上已有只包含抖音凭据的临时环境文件，也可以执行：

   ```bash
   bash deploy/init-production-env.sh /tmp/catbakery-source.env
   ```

   脚本会在服务器本地生成随机 MongoDB 密码和会话密钥，成功后删除临时凭据文件。

4. 启动后端：

   ```bash
   bash deploy/deploy.sh
   curl http://127.0.0.1:18099/health
   ```

   `deploy.sh` 会先检查容器内部健康状态，再检查公网 HTTPS；公网检查失败时部署会返回非零状态，
   避免出现“容器已启动但 Nginx、证书或安全组仍不可访问”的假成功。

5. 安装独立的 `8099` Nginx 站点配置，不修改现有站点文件：

   ```bash
   sudo cp deploy/nginx/catbakery-8099.conf /etc/nginx/conf.d/catbakery-8099.conf
   ```

6. 检查并重载 Nginx：

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   curl https://jingjingyeye.vip:8099/health
   ```

   也可以在开发机或 CI 执行 `npm run deploy:check`，从外网验证 DNS、TLS、响应码和健康响应体。

7. 在抖音开放平台的“开发设置”中，将 `https://jingjingyeye.vip` 添加为 request 合法域名。
8. 在 Cocos Creator 3.8.8 中重新构建 `bytedance-mini-game`，确保正式域名编译进入小游戏包。

## 更新部署

以下命令适用于生产配置和后端改动已经提交并推送到当前分支的情况；
远端工作树有未提交改动时，先同步/提交这些改动，不要强制覆盖。

```bash
git pull --ff-only
bash deploy/deploy.sh
curl https://jingjingyeye.vip:8099/health
```

## 回滚与排查

```bash
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml ps
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml logs --tail=200 server
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml logs --tail=200 mongodb
```

不要执行 `docker compose down -v`，该命令会删除生产 MongoDB 数据卷。
