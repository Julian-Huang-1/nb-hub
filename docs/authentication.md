# 登录、会话与个人访问令牌

本阶段参照 Multica 的登录和凭据机制独立实现：邮箱验证码、Google 网页登录、JWT 会话、Cookie/CSRF、会话续期与撤销、个人访问令牌（PAT）。未引入工作区、成员、任务、守护进程令牌、任务令牌或 Multica Cloud 服务。

## 本地运行

新的 `.env.development.example` 包含：

```dotenv
APP_ENV=development
NB_HUB_DEV_VERIFICATION_CODE=888888
AUTH_TOKEN_TTL=720h
ALLOW_SIGNUP=true
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

已有 `.env.development` 不会自动覆盖，请补入所需变量。运行 `make down`、`make up`，自动应用数据库迁移并重新编译 API。Web 打开 `http://127.0.0.1:3000`，填写邮箱、点击 Send code，再输入 `888888`。必须先发送，验证码行才会创建；固定开发码同样受有效期、重试次数和一次性消费限制。

开发码仅在 `APP_ENV=development` 时读取，不发送真实邮件，在生产中无效。未配置 `JWT_SECRET` 时，显式开发环境使用开发专用密钥；生产必须配置独立随机密钥。不要把线上凭据或数据库连接复制到本地配置。

Web 同源 `/api/auth/*` 由 `apps/web/proxy.ts` 使用 Next.js rewrite 转发，`NB_HUB_API_URL` 在请求时读取（仅开发环境默认 `http://127.0.0.1:8080`）；生产由 Caddy 直接路由到 API，未配置该变量时 Next.js 不猜测后端地址。Web 登录不再依赖 `NEXT_PUBLIC_API_URL`。代理仅开放 auth 和 health，拒绝 daemon 路径和异常路径段，筛选认证相关请求头；请求体和后端响应（包括登录 Cookie）由 Next.js 转发。认证 JSON 请求体的 8KB 限制由 Go 处理器执行，超限返回 400。代理不再手动读取请求体，也不再定义 20 秒 fetch 超时或自定义 502 JSON 响应。

桌面端、移动端复用 API 客户端，但独立处理凭据存储和平台生命周期。桌面端使用 Electron safeStorage 加密后保存到应用数据目录；不支持加密或 Linux 仅有 basic_text 后端时拒绝保存。移动端使用 Expo SecureStore。没有把令牌放进共享业务包的 localStorage，也没有在 React Native 中导入 DOM 组件。

## 邮箱验证码

生产可配置 SMTP 或 Resend（两者都配置时使用 Resend）：

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=noreply@example.com
```

SMTP 使用 STARTTLS，生产拒绝没有 STARTTLS 的服务器；当前不提供 465 隐式 TLS 模式。也可设置 `RESEND_API_KEY`、`RESEND_FROM_EMAIL`。发件地址需要在邮件提供商完成验证。没有可用邮件配置时，API 返回明确的 provider_unavailable 错误，页面不显示可用的邮箱登录表单。

验证码使用安全随机六位数字，有效期 10 分钟；同邮箱 60 秒内不能重发，最多输入错误 5 次。数据库保存与邮箱绑定的 HMAC 摘要，不保存明文验证码。校验与消费在同一事务中锁行执行，不能重复登录。邮件发送失败后删除本次未送达验证码，方便重试。

认证公共入口还有每实例每分钟 60 次的请求上限，适用于当前小规模自托管部署；并非多节点共享的分布式限流器。

## Google 登录

Google 登录目前接入 Web；桌面和移动端使用邮箱验证码，尚未实现系统浏览器 OAuth 回跳。

在 Google 控制台创建 Web OAuth 客户端，配置：

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FRONTEND_ORIGIN=https://hub.example.com
GOOGLE_REDIRECT_URI=https://hub.example.com/api/auth/google/callback
```

本地开发使用对应的 HTTP origin；必须使用与 `FRONTEND_ORIGIN` 相同的站点访问登录页。回调 URI 默认从 FRONTEND_ORIGIN 推导，必须与 Google 控制台配置一致。

服务器生成短期 state 和 PKCE 校验值，放入签名的 HttpOnly/Lax Cookie；回调先验证 state，再兑换授权码、读取 Google 的已验证邮箱。Google secret 和 access token 均不交给前端。未配置的 Google 入口返回不可用，页面隐藏按钮。真实 Google 账户和真实邮件不参与默认测试。

## 会话与 CSRF

- 会话 JWT 采用 HS256，固定校验算法、issuer、audience、到期时间和会话 ID。默认有效期 30 天，`AUTH_TOKEN_TTL` 可设为 1 分钟至 90 天之间的 Go duration。
- Web 会话 Cookie 为 HttpOnly、SameSite=Strict、host-only；生产使用 `__Host-nbhub_auth` 并设置 Secure、Path=/，开发使用 `nbhub_auth`。浏览器登录响应不含可读 JWT。
- CSRF Cookie（生产 `__Host-nbhub_csrf`，开发 `nbhub_csrf`）是与稳定会话 ID 绑定的 HMAC；Cookie 认证的写操作要求匹配的 `X-CSRF-Token`。续期保留会话 ID，因此不会让其他标签页已有的 CSRF 值失效。
- 后端会话表保存有效期和撤销时间。每次认证检查会话仍有效；退出、结束某个会话后，旧 JWT 即使尚未到期也会被拒绝。这比只清除浏览器 Cookie 的退出方式多了服务端撤销。
- 剩余有效期不足一半时续期；Web 安全读请求可自动续期，各客户端也按服务端返回的间隔刷新，并在回到前台时检查。过期或已撤销的会话不能复活。
- `Authorization: Bearer` 优先于 Cookie；PAT 使用 Bearer，不接受当作 Cookie 会话，也不能换取 JWT、续期会话或管理令牌。
- 用户身份放在服务端 context；客户端传来的用户、智能体和任务身份头会被剥离。

## PAT

登录后可在账户页面创建、查看元数据、撤销个人令牌。令牌前缀为 `nbp_`，包含 32 字节安全随机数。完整值只在创建响应中返回一次；数据库保存 SHA-256 摘要和可展示前缀。有效期为 1–365 天，页面默认 90 天。

PAT 代表用户本人，可用于已支持的账户读取及本人站点的管理/部署 API；尚无工作区或细分 scope，不要将其描述为工作区/任务授权凭据。站点访问票据、令牌管理和会话管理仅接受交互式 JWT 会话，防止机器凭据升级权限。

```bash
curl -H "Authorization: Bearer <个人令牌>" https://你的域名/api/auth/me
```

撤销按用户 ID 与令牌 ID 同时过滤，不能撤销他人的令牌。当前不使用 Redis 缓存，撤销后下次请求立即失效。

## API

所有路径均以 `/api/auth` 开头。Web 默认 Cookie；桌面/移动在验证码请求中携带 `X-Auth-Mode: bearer`，登录响应才返回 JWT。

| 方法与路径              | 行为                                     |
| ----------------------- | ---------------------------------------- |
| `GET /config`           | 可用登录方式                             |
| `POST /send-code`       | 发送验证码，JSON `{email}`               |
| `POST /verify-code`     | 登录，JSON `{email, code}`               |
| `GET /google/start`     | 启动 Google 登录                         |
| `GET /google/callback`  | Google 回调                              |
| `GET /me`               | 当前用户、凭据类型和会话有效期           |
| `POST /refresh`         | 续期交互式会话                           |
| `POST /logout`          | 撤销当前会话、清 Cookie                  |
| `GET /sessions`         | 当前用户有效会话                         |
| `DELETE /sessions/{id}` | 结束指定的本人会话                       |
| `GET /tokens`           | PAT 元数据列表                           |
| `POST /tokens`          | 创建 PAT，JSON `{name, expires_in_days}` |
| `DELETE /tokens/{id}`   | 撤销本人 PAT                             |

`/api/health` 保持公开，用于部署就绪检查。HTTP 请求通过 router → middleware → handler → service → sqlc → PostgreSQL。后续业务 API 需显式挂载同一个认证中间件，并补上对应业务授权，不能仅凭前端登录页保护数据。

## 部署与测试

`make prod-env` 现在分别生成数据库密码和 JWT_SECRET。已有生产环境文件需补充 `JWT_SECRET`（可用 `openssl rand -hex 32`），并配置邮件或 Google 登录。更换 JWT_SECRET 会使所有已有 JWT 失效；OTP 摘要、CSRF 和 OAuth state 也依赖它。`ALLOW_SIGNUP=false` 禁止创建新用户；`ALLOWED_EMAILS`、`ALLOWED_EMAIL_DOMAINS` 以逗号分隔，限制新用户注册。已有用户仍能登录。

`make sqlc` 重新生成查询；不要手改 generated 目录。迁移与备份按部署指南执行。

默认测试覆盖 JWT、Google state/PKCE 的模拟 HTTP 流程、客户端传输和账户组件，不联系真实邮件、Google 或智能体 CLI。真实数据库测试仅在提供独立测试库时运行：

```bash
cd server
NB_HUB_AUTH_TEST_DATABASE_URL='postgres://user:pass@127.0.0.1:5432/nbhub_test_auth?sslmode=disable' \
  go test ./internal/api -run TestAuthPostgres -v
```

该库名必须以 `nbhub_test_` 开头。测试应用认证迁移，创建随机测试账号并清理自己的账号、会话、令牌和验证码。E2E 显式启动服务后运行 `pnpm test:e2e`；需要相同的开发验证码配置，测试会创建随机邮箱账号并结束会话，建议指向一次性测试数据库，测试结束后整体删除该测试库。移动端仍需要真机或模拟器验证原生凭据存储；默认 Web/桌面测试不声称覆盖原生运行时。

生产 Google OAuth state 也使用 `__Host-` Cookie，避免用户内容的兄弟子域通过
Domain Cookie 注入后台凭据。升级到这些名称后，旧浏览器 Cookie 不再用于生产认证，
需要重新登录；Bearer 凭据和数据库中的会话记录不受名称变更影响。
