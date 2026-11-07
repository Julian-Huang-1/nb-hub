# 测试指南

测试体系沿用 Multica 的分层方式：Vitest 测试共享逻辑和组件，Testing Library 验证用户交互，Playwright 验证真实前后端联通，Go 保留标准 `testing` 测试。当前仅迁入 nb-hub 已有功能所需的配置和用例。

## 测试边界

| 目录 | 环境与职责 |
| --- | --- |
| `packages/core` | Node；API 请求、响应契约和纯逻辑 |
| `packages/ui` | jsdom；基础组件、自绘图标无障碍和生成一致性 |
| `packages/views` | jsdom；共享首页的加载、失败和手动重试 |
| `apps/web`、`apps/desktop` | jsdom；预留平台接线测试，当前允许没有用例 |
| `e2e` | Chromium；真实 API 健康检查、页面展示和手动刷新 |
| `server` | Go；HTTP、守护进程 WebSocket 和开发库重置保护；数据库集成测试需显式启用 |

移动端独立维护原生测试，不共用 Web/桌面的 jsdom 配置。共享逻辑的输入矩阵只在 core 中测试，组件测试关注接线、无障碍和交互，E2E 关注完整链路。

## 单测

在仓库根目录运行：

```sh
pnpm test
pnpm --filter @nb-hub/core test
pnpm --filter @nb-hub/views test:watch
pnpm test:coverage
make test
```

`pnpm test` 无需启动 API、数据库或浏览器。组件测试在 `@nb-hub/core/api` 边界模拟请求，使用关闭自动重试的独立 QueryClient；测试后清理 DOM 和客户端。不要模拟路由框架来测试共享业务组件。

覆盖率报告写入各共享包的 `coverage/`，包括终端摘要、HTML 和 LCOV；覆盖率统计排除测试文件和自动生成的图标文件。当前不设置无依据的覆盖率门槛。

`make test` 依次运行类型检查、前端单测、开发环境生命周期测试和 `go test ./...`。默认测试不运行真实智能体 CLI，也不访问用户的智能体账户。

## E2E

首次安装 Chromium：

```sh
pnpm exec playwright install chromium
```

显式启动并确认当前开发环境：

```sh
make up
make status
```

然后在仓库根目录运行：

```sh
pnpm test:e2e
pnpm test:e2e:ui
pnpm exec playwright show-report
```

Playwright 默认不启动服务，使用一个 Chromium 工作进程，不自动重跑失败用例。失败时保留 trace 和截图；结果保存在 `test-results/`，HTML 报告保存在 `playwright-report/`。调试 trace 可运行 `pnpm exec playwright show-trace <trace.zip 路径>`。

完成后执行 `make down` 停止受管理应用，数据库和数据保留。生命周期脚本测试可单独运行 `make test-dev-env`；用临时目录、假 Docker/Go/pnpm 和真实临时 HTTP 进程验证身份检查、幂等启动、失败清理及端口占用保护，不连接用户数据库。

测试通过 `TestApiClient` 检查真实 API，不依赖应用构建产物。当前健康检查不写数据，无需数据库或清理操作；后续有数据写入时，在客户端增加准备和清理方法，不直接在测试中操作数据库。

### 环境变量

测试默认读取 `.env.development`，可通过 `ENV_FILE` 指定另一份开发配置；不覆盖已有进程变量。

| 变量 | 用途与默认值 |
| --- | --- |
| `PLAYWRIGHT_BASE_URL` | 测试页面地址；其次取 `FRONTEND_ORIGIN`，默认 `http://localhost:3000` |
| `E2E_API_URL` | 测试 API 地址；其次取 `NEXT_PUBLIC_API_URL`，默认 `http://localhost:8080` |
| `NEXT_PUBLIC_API_URL` | Web 客户端的 API 地址，必须与 E2E API 地址一致 |
| `NB_HUB_LISTEN_ADDR` | Go 服务监听地址，默认 `127.0.0.1:8080` |

使用自定义端口时，在 `.env.development` 中设置 `NB_HUB_LISTEN_ADDR` 和匹配的 `NEXT_PUBLIC_API_URL`，并为测试设置匹配的 `PLAYWRIGHT_BASE_URL` 和 `E2E_API_URL`。生产构建中的客户端地址在构建时写入，修改后需重新构建。

通过生产反向代理测试时，将 `PLAYWRIGHT_BASE_URL` 和 `E2E_API_URL` 都设为站点地址；生产镜像的 Web 使用同源 `/api`。

若环境设置了 `DATABASE_URL`，服务会尝试连接数据库；仅验证当前健康检查时可以不设置该变量。不要连接不明数据库或自动清理已有数据。

迁移的真实 PostgreSQL 测试使用显式的 `NB_HUB_TEST_DATABASE_URL` 和独立空数据库，运行方式见[部署指南](deployment.md#验证数据库集成)。
