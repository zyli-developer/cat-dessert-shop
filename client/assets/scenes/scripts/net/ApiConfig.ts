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
export const API_BASE_URL = 'http://192.168.77.240:3333';
