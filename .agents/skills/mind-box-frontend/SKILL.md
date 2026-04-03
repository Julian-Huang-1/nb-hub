---
name: mind-box-frontend
description: React 19 + Vite 前端约定：React Router 7（createBrowserRouter）按需 lazy、从 @nb-hub/contracts 引入 API 类型、共享状态用轻量方案（Zustand/Context）。在 apps/mind-box 下写页面/路由/API/状态时，或用户提到 mind-box、React 前端时使用。
---

# Mind-box 前端（React 19 + Vite + React Router 7）

## 路由（按需加载）

- 在 **`src/router.tsx`** 用 **`createBrowserRouter`**；子路由用路由对象的 **`lazy`** 返回 `{ Component }`，勿对页面做顶层静态 `import`，以便按路由分包。
- 布局壳（如 `BlogLayout`）可静态导入；**页面级**组件走 `lazy`。
- **`basename: import.meta.env.BASE_URL`** 与 Vite `base` 对齐。
- 保持路径与 **`<Link to>`** 稳定；首页区块仍可用 **hash**（如 `/#about`），滚动逻辑集中在 **`ScrollBehavior`**（或等价 composable）。

## API 与类型（`@nb-hub/contracts`）

- 请求体、响应 `data`、`ApiSuccess`、`ApiError` 等一律 `import type { ... } from '@nb-hub/contracts'`（纯类型）。
- 在 **`src/api/`** 集中封装 HTTP：统一 base URL、解析 JSON、`status === 'error'` 时抛错或返回 Result 类型。
- Base URL 使用 **`import.meta.env.VITE_API_BASE_URL`**，并在 `.env.example` 中说明；禁止把生产域名写死在组件里。

## 状态

- **跨视图 / 跨流程**的共享状态用 **Zustand** 或 **React Context**；仅在单组件内的用 `useState` / `useReducer`。
- 与路由强相关的片段优先 **`useSearchParams` / `useParams`**，避免重复存一份 URL 状态。

## 重复逻辑

- 可抽成 **`src/hooks/useXxx.ts`**（`use` 开头）或小组件。
- 适合：分页、防抖请求、loading / error 处理、与路由 query 同步、contracts DTO 与表单字段的映射等。

## 其它约定

- 页面放 **`src/pages/`**，布局 **`src/layouts/`**，可复用块 **`src/components/`**。
- 纯函数放 **`src/utils/`**（与现有 `format.ts` 一致）。
- 站点级常量用 **`src/site.ts`** 或 **`src/constants.ts`**。
- 样式：全局 `style.css`；组件优先语义化 class + 现有 BEM 式命名。
- 静态资源：`src/assets/` 或 `public/`。
- 修改 **`packages/contracts`** 后执行：`pnpm --filter @nb-hub/contracts build`，保证 `dist` 类型最新。

## 与全仓规则

- Monorepo、contracts 为唯一 DTO 源等见 **`.agents/rules/nb-hub-monorepo.mdc`**；本 skill 只细化 **mind-box 实现层**。
