# 仓库边界

nb-hub 是一个多客户端工作区。平台专属 API 应保留在对应应用中。

| 路径 | 职责 |
| --- | --- |
| `apps/web` | Next.js 路由和浏览器专属代码 |
| `apps/desktop` | Electron 主进程、预加载脚本、桌面端路由和原生集成 |
| `apps/mobile` | Expo Router、React Native 界面和移动端独立管理的状态 |
| `packages/core` | 共享类型、API 客户端和不含界面的业务逻辑 |
| `packages/ui` | UI 基础组件；不得依赖 `@nb-hub/core` 或包含业务概念 |
| `packages/views` | Web/桌面端共享业务页面；依赖 core 和 ui |
| `server/cmd` | API 和 CLI 入口 |
| `server/internal` | 传输层、领域服务、守护进程和持久化边界 |
| `server/pkg/agent` | AI CLI 提供方适配器 |

依赖方向为 `views -> core + ui`；core 与 ui 保持独立。移动端可以从 core 导入类型和纯工具函数，但独立维护原生页面和查询状态。Web 和桌面端路由文件应保持精简。

## Web/桌面端图标

- 从 `@nb-hub/ui/icons` 导入图标，使用项目自绘图形；不要添加第三方图标库、在视图中内联 SVG，或用 emoji 替代图标。
- 新增或修改图形前，阅读 `.agents/skills/nb-hub-icons/SKILL.md`。源图形位于 `packages/ui/src/icons/drawings/drawings.mjs`；不要手动修改生成的 `glyphs.ts` 和 `index.ts`。
- 修改图形后运行 `pnpm --filter @nb-hub/ui icons`，以 14/18/48px 预览，再运行 `pnpm --filter @nb-hub/ui test` 和 `pnpm typecheck`。
- 此 SVG 渲染器仅用于 Web/桌面端。移动端独立维护原生渲染器，不要在 React Native 中导入这些 DOM 组件。

## Web/桌面端 UI

- 使用 shadcn 的 Base UI + Nova 风格（`base-nova`）和中性色板。共享组件放在 `packages/ui/src/components`，应用业务组合放在 `packages/views`。
- 两端均加载 `@nb-hub/ui/styles/globals.css`。共享颜色、排版和圆角变量统一放在此处；视图使用语义化 Tailwind 工具类，不要硬编码颜色。
- 在仓库根目录运行 `pnpm ui:add <component>` 添加基础组件。检查对已有文件的修改，并将生成的图标导入改为 `@nb-hub/ui/icons`；不要安装外部图标库。
- 配置、深色模式和验证方式见 `packages/ui/docs/theme.md`。移动端保留独立的原生样式体系。

引入首批领域功能时，HTTP 请求应依次经过路由、中间件、处理器、服务、sqlc 查询和 PostgreSQL。面向用户的实时连接与守护进程连接应分离。产品行为尚未确定前，不要添加占位领域模型。

## 数据库与部署

- 登录与令牌规则见 `docs/authentication.md`。Web 使用同源 API、HttpOnly Cookie 和 CSRF；原生端注入安全存储。个人令牌不得换取会话或管理凭据。业务 API 必须挂载后端认证及对应业务授权。

- 本地命令默认使用 `.env.development`；生产 Compose 显式使用 `.env.production`。不要将生产凭据放进开发配置或镜像。
- 统一开发入口为 `make up/down/status`：默认管理 API 和 Web；down 保留数据库。不要按端口杀死不明进程，或将手动服务当作本命令启动的服务。脚本行为测试使用 `make test-dev-env`。
- 两套 Compose 的项目名和持久化卷保持独立。数据库迁移放在 `server/migrations`，使用 `make migrate`；生产先执行迁移，成功后启动 API。
- 开发库重置只允许 `APP_ENV=development`、字面量回环地址和 `nbhub_dev`，必须显式传入 `CONFIRM=nbhub_dev`。不要放宽这些限制来处理生产库。
- 操作命令、部署、备份和数据库集成测试见 `docs/deployment.md`。

## 测试

- 单测与实现相邻：共享逻辑放 core，基础组件放 ui，共享业务组件放 views，平台接线放对应应用；E2E 放 `e2e/`。不要在应用测试中重复验证共享包行为。
- Vitest 使用 Node 环境测试纯逻辑，使用 jsdom 和 Testing Library 测试组件。无 DOM 的 `.test.ts` 文件保留 `// @vitest-environment node` 指令。
- 组件测试使用真实 QueryClient，并在 API 客户端边界模拟请求；关闭查询自动重试，测试后清理客户端和 DOM。按需补充浏览器 API 模拟，不要预置与当前功能无关的桩。
- E2E 使用 Playwright 和 `TestApiClient`，验证真实前后端联通；新增数据准备和清理操作放入该客户端。不要搬入尚不存在的认证、工作区或任务模型。
- 默认测试不得解析或执行用户安装的智能体 CLI，不得访问真实智能体账户。
- `pnpm test` 运行 Web/桌面及共享包单测；`pnpm test:coverage` 生成共享包覆盖率；`make test` 运行类型检查、前端单测、开发环境生命周期测试和 Go 测试。原生移动端测试独立配置。
- E2E 前显式启动 API 和 Web，再运行 `pnpm test:e2e`；测试不自动启动或复用不明服务。环境变量、调试命令和报告路径见 `docs/testing.md`。
