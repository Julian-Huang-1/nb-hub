# Nova 主题

Web 和桌面端使用 shadcn 的 **Base UI + Nova**（`base-nova`）及其中性色板。配置位于 `packages/ui/components.json`，两端应用配置均指向同一共享包。此主题用于 Web/桌面端，不用于 React Native。

- `src/styles/globals.css`：共享 Tailwind v4 入口、明暗语义色、圆角和支持中文的系统字体栈。
- `src/components`：UI 基础组件。初始 Button 来自官方 Nova 组件源，保留其变体、尺寸和 Base UI 交互行为。
- `src/lib/utils.ts`：通过 `cn` 组合条件类名并合并 Tailwind 冲突类。

Next.js 在根布局中加载共享 CSS，通过 `@tailwindcss/postcss` 处理；Electron 在渲染进程中加载，通过 `@tailwindcss/vite` 处理。CSS 显式声明了共享组件、业务视图和两端应用的源码路径，确保工作区包中的类名也能生成样式。

## 添加组件

```sh
pnpm ui:add input
```

检查生成文件和覆盖提示。使用组件前，将外部图标导入替换为 `@nb-hub/ui/icons` 中的本地图标。UI 包不得包含业务 Hook 或平台专属 API。

```tsx
import { Button } from "@nb-hub/ui/button";
import { Plus } from "@nb-hub/ui/icons";

<Button><Plus data-icon="inline-start" />添加</Button>
<Button variant="outline" size="sm">取消</Button>
```

`@nb-hub/ui/button` 直接导出 `src/components/button.tsx`。其他生成的基础组件可通过 `@nb-hub/ui/components/*` 导入。

## 调整外观

修改 `:root` 和 `.dark` 中的语义变量可调整配色。组件尺寸和间距位于 Nova 组件源码中。在文档根元素添加 `.dark` 类即可启用深色配色；当前未添加主题切换控件或持久化逻辑，页面默认使用浅色主题。

正文使用 14px 字号和 1.6 倍行高。字体栈包含苹方、微软雅黑和 Noto Sans CJK SC，无需下载远程字体。

## 验证

```sh
pnpm typecheck
pnpm test
pnpm build:web
pnpm build:desktop
```

## 上游来源

- [Nova Button 源码](https://ui.shadcn.com/r/styles/base-nova/button.json)
- [Nova 风格配置](https://ui.shadcn.com/r/styles/base-nova/style.json)
- [中性色板](https://ui.shadcn.com/r/colors/neutral.json)
- [shadcn 许可证原文](./shadcn-license.txt)
