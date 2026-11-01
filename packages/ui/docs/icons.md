# 图标

Web 和桌面端通过 `@nb-hub/ui/icons` 共用本地自绘 SVG 图标。源图形、渲染器和生成器位于 `packages/ui/src/icons`，运行时不依赖 Multica 或外部图标库。

```tsx
import { Search, Plus, type IconProps } from "@nb-hub/ui/icons";

<Search size={18} />
<button aria-label="搜索"><Search size={18} /></button>
<Plus size={16} aria-label="添加" role="img" />
```

图标使用 `currentColor`、24×24 网格和默认宽度为 2 的描边。密集列表可用 14px，导航可用 18px，需要突出显示时可用 24px。渲染器透传标准 SVG 属性、`className`、`style` 和 SVG ref。

装饰性图标默认对辅助技术隐藏。如果按钮只有图标，应为按钮提供无障碍名称；如果图标独立传达信息，则为 SVG 提供无障碍名称。加载指示器的动画由使用方添加。

## 新增或修改图形

几何绘制和视觉检查规则见[图标绘制技能](../../../.agents/skills/nb-hub-icons/SKILL.md)。新增前先搜索已有名称，同义名称使用 `ALIASES`。修改 `drawings/drawings.mjs` 后，在仓库根目录运行：

```sh
pnpm --filter @nb-hub/ui icons
pnpm --filter @nb-hub/ui icons --preview Search Plus Settings
pnpm --filter @nb-hub/ui test
pnpm typecheck
```

预览命令会输出 HTML 文件路径。打开后对比 48/18/14px 的效果和轮廓着色效果。源文件与生成文件应一起提交。`test` 检查生成文件是否与源图形一致，不能替代视觉检查。

## 选中状态

生成器将源图形的 `class="b"` 映射为 `.icon-body`，将 `class="k"` 映射为 `.icon-cut`，将实心细节映射为 `.icon-cut-fill`。使用方可以按需为轮廓着色，默认不全局启用：

```css
[aria-current="page"] .icon-body {
  fill: currentColor;
  fill-opacity: 0.2;
}
```

只有闭合轮廓才能标记为主体。选中状态在悬停时也应可辨识。这些 React DOM 组件不能直接用于 React Native；移动端需要原生 SVG 渲染器。
