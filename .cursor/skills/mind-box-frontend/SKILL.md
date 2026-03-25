---
name: mind-box-frontend
description: Vue 3 + Vite 前端约定：vue-router 按需懒加载、从 @nb-hub/contracts 引入 API 类型、Pinia 管共享状态、组合式函数抽重复逻辑。在 apps/mind-box 下写页面/路由/API/状态时，或用户提到 mind-box、Vue 前端、组合式 API 时使用。
---

# Mind-box 前端（Vue 3 + Vite）

## 路由（按需加载）

- 路由 **`component` 使用动态导入**，勿对页面级视图写顶层静态 `import`，以便按路由分包。

```ts
// ✅ 推荐
{
  path: '/',
  name: 'home',
  component: () => import('../views/HomeView.vue'),
}

// ❌ 避免（首屏打进同一 chunk）
import HomeView from '../views/HomeView.vue'
```

- 保持 **`name`** 稳定，便于 `RouterLink`、`scrollBehavior` 与导航守卫。

## API 与类型（`@nb-hub/contracts`）

- 请求体、响应 `data`、`ApiSuccess`、`ApiError` 等一律 `import type { ... } from '@nb-hub/contracts'`（纯类型）。
- 在 **`src/api/`** 集中封装 HTTP：统一 base URL、解析 JSON、`status === 'error'` 时抛错或返回 Result 类型。
- Base URL 使用 **`import.meta.env.VITE_API_BASE_URL`**，并在 `.env.example` 中说明；禁止把生产域名写死在组件里。

## 状态（Pinia）

- **跨视图 / 跨流程**的共享状态用 Pinia；仅在单组件内的用 `ref` / `reactive`。
- Store 放在 **`src/stores/`**，推荐 **Composition 风格** `defineStore`（`ref` / `computed` + 方法），与 `<script setup>` 一致。
- 若尚未安装 Pinia：在 `apps/mind-box` 执行 `pnpm add pinia`，在 `main.ts` 中 `app.use(createPinia())`。

## 重复逻辑 → Composables

- 放在 `src/composables/useXxx.ts`，命名以 **`use`** 开头。
- 适合：分页、防抖请求、loading / error 处理、与路由 query 同步、contracts DTO 与表单字段的映射等。

## 其它约定

- 页面放 **`src/views/`**，可复用块放 **`src/components/`**；优先 **`<script setup lang="ts">`**。
- 纯函数放 **`src/utils/`**（与现有 `format.ts` 一致）。
- 站点级常量可用 **`src/site.ts`** 或 **`src/constants.ts`**，避免魔法字符串。
- 样式：全局 `style.css`；组件用 `scoped`；少用大块行内样式。
- 静态资源：`src/assets/` 或 `public/`，大图注意体积与懒加载。
- 修改 **`packages/contracts`** 后执行：`pnpm --filter @nb-hub/contracts build`，保证 `dist` 类型最新。

## 与全仓规则

- Monorepo、contracts 为唯一 DTO 源等见 **`.cursor/rules/nb-hub-monorepo.mdc`**；本 skill 只细化 **mind-box 实现层**。
