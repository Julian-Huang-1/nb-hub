# nb-hub

基于 Multica 架构搭建的多客户端工作区，包含独立的最小实现，尚未包含 Multica 的业务功能。

## 目录结构

| 路径 | 职责 |
| --- | --- |
| `apps/web` | 基于 Next.js App Router 的 Web 客户端 |
| `apps/desktop` | 基于 Electron 和 React Router 的桌面客户端 |
| `apps/mobile` | 基于 Expo Router 的移动客户端 |
| `packages/core` | 共享类型、API 客户端和不含界面的查询逻辑 |
| `packages/ui` | 不依赖业务的 UI 基础组件 |
| `packages/views` | Web/桌面端共享业务视图 |
| `server` | Go API、CLI、守护进程和数据库边界 |

依赖方向为 `views -> core + ui`。Web 和桌面端独立管理路由及平台行为；移动端独立维护 React Native 视图，并按仓库边界复用 core 中的类型和纯工具函数。

## 运行

环境要求：Node.js 22、pnpm 10、Go 1.26.9、Docker Compose，以及 `ps`、`lsof`（macOS 自带；Linux 按发行版安装）。

```bash
make up
make status
make down
```

`make up` 首次创建 `.env.development`，准备数据库、执行迁移，按需安装前端依赖，再后台启动 API 和 Web，并等待服务就绪。默认 Web 地址为 `http://127.0.0.1:3000`。重复执行会复用已确认属于当前环境的健康进程；只需 API 时运行 `make up C=api`。

`make status` 显示数据库状态、应用地址、进程身份和日志路径。`make down` 仅停止本命令管理的应用进程，保留 PostgreSQL 和数据；需要停止数据库时另行运行 `make db-down`。已有手动服务占用端口时会报告冲突，不会自动接管或杀死它们。

桌面端、移动端和守护进程仍分别通过 `make dev-desktop`、`make dev-mobile`、`make daemon` 在前台启动；它们不由当前 `up/down` 管理。也可使用 `make api`、`make dev-web` 单独前台调试。开发命令默认加载根目录 `.env.development`，使用 `ENV_FILE=路径` 显式指定另一份开发配置；同一环境的 up/down/status 应使用相同路径。已有 `.env` 不会自动加载。

客户端默认连接 `http://localhost:8080`，可按需设置 `NEXT_PUBLIC_API_URL`、`NB_HUB_API_URL` 或 `EXPO_PUBLIC_API_URL`。真机移动端需要在 `EXPO_PUBLIC_API_URL` 中使用电脑的局域网地址。

服务当前提供 `/api/health` 和仅供本机连接的 `/api/daemon/ws`。数据库迁移机制已就绪，尚未添加业务表；sqlc 查询、认证和任务执行将随首个实际业务流程实现。

本地数据库、生产部署、备份和开发库重置见[部署指南](docs/deployment.md)。

## UI 与图标

Web/桌面端使用 Base UI + Nova 主题和自绘图标，说明见 [Nova 主题](packages/ui/docs/theme.md)和[图标文档](packages/ui/docs/icons.md)。

## 测试

运行 `pnpm test` 执行前端单测，运行 `make test` 执行类型检查、前端单测、开发环境生命周期测试和 Go 测试。运行 `make up` 显式启动 API 与 Web 后执行 `pnpm test:e2e`。覆盖率、E2E 环境变量与调试方式见[测试指南](docs/testing.md)。
