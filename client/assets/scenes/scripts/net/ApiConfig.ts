/**
 * 后端 API 根地址（不要以 / 结尾）
 *
 * - **浏览器 / Cocos 网页预览**：可用 `http://localhost:3333`
 * - **抖音真机预览 / 真机调试**：`localhost` 无效，必须改为 **你电脑的局域网 IP**，
 *   例如 `http://192.168.1.8:3333`，且手机与电脑在同一 WiFi
 * - **上线**：改为 **HTTPS** 正式域名，并在抖音开放平台「开发设置」里配置 **request 合法域名**
 *
 * 登录：`tt.login` → 服务端 `code2Session`，支持 `code` 与 `anonymousCode`（二选一）。
 * 请在服务器配置 `DOUYIN_APP_ID` / `DOUYIN_APP_SECRET`（见 `server` 环境变量）。
 *
 * 修改后需重新构建小游戏并导入开发者工具。
 */
// ⚠ 此值由根目录 .env 的 CLIENT_API_BASE_URL 生成，不要手改这一行：
//   修改 .env 后执行: npm run config:sync
// 也可用脚本一键切换（脚本会同时更新 .env，写完后仍需 Cocos 重新构建）：
//   真机预览/调试: node scripts/set_api_base.mjs --tunnel   （cloudflared HTTPS 隧道→localhost:3333；真机禁明文 HTTP，局域网 IP 无效）
//   浏览器/模拟器: node scripts/set_api_base.mjs --lan      （自动探测本机 IPv4）
//   正式上线:     node scripts/set_api_base.mjs --url <https 域名>
// 临时隧道和正式域名可由 set_api_base.mjs 按需写入。
// 上传前 scripts/release-config.mjs 会拒绝 localhost、临时隧道和非 HTTPS 地址。
export const API_BASE_URL = "https://jingjingyeye.vip:8099";
