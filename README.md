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

环境要求：Node.js 22、pnpm 10、Go 1.26.9。先运行 `pnpm install`，再通过 `make api` 启动 API。在另一终端运行 `make dev-web`、`make dev-desktop` 或 `make dev-mobile`。连接守护进程可运行 `make daemon`。

客户端默认连接 `http://localhost:8080`，可按需设置 `NEXT_PUBLIC_API_URL`、`NB_HUB_API_URL` 或 `EXPO_PUBLIC_API_URL`。真机移动端需要在 `EXPO_PUBLIC_API_URL` 中使用电脑的局域网地址。

服务当前提供 `/api/health` 和 `/api/daemon/ws`。PostgreSQL、sqlc 查询、认证和任务执行目前仅保留架构边界，将随首个实际业务流程实现。

## UI 与图标

Web/桌面端使用 Base UI + Nova 主题和自绘图标，说明见 [Nova 主题](packages/ui/docs/theme.md)和[图标文档](packages/ui/docs/icons.md)。

## 测试

运行 `pnpm test` 执行前端单测，运行 `make test` 执行类型检查、前端单测和 Go 测试。启动 API 与 Web 后运行 `pnpm test:e2e`。覆盖率、E2E 环境变量与调试方式见[测试指南](docs/testing.md)。
