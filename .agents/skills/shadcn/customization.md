# 自定义与主题（Customization & Theming）

组件依赖语义化 CSS 变量 token。修改变量即可全局影响相关组件。

## 目录

- 工作原理（CSS 变量 → Tailwind 工具类 → 组件）
- 颜色变量与 OKLCH
- 暗色模式配置
- 更换主题（preset、CSS 变量）
- 新增自定义颜色（Tailwind v3/v4）
- 圆角
- 组件定制（variant、className、wrapper）
- 更新检查

---

## 工作原理

1. 在 `:root`（亮色）和 `.dark`（暗色）中定义 CSS 变量。  
2. Tailwind 将变量映射到工具类：`bg-primary`、`text-muted-foreground` 等。  
3. 组件使用这些工具类，因此修改变量会联动所有相关组件。

---

## 颜色变量

每种颜色遵循 `name` / `name-foreground` 约定：前者用于背景，后者用于该背景上的文字/图标。

| 变量 | 作用 |
| -------------------------------------------- | -------------------------------- |
| `--background` / `--foreground` | 页面背景与默认文字 |
| `--card` / `--card-foreground` | 卡片表面 |
| `--primary` / `--primary-foreground` | 主按钮与主操作 |
| `--secondary` / `--secondary-foreground` | 次级操作 |
| `--muted` / `--muted-foreground` | 弱化/禁用状态 |
| `--accent` / `--accent-foreground` | hover 与强调状态 |
| `--destructive` / `--destructive-foreground` | 错误与破坏性操作 |
| `--border` | 默认边框色 |
| `--input` | 输入框边框色 |
| `--ring` | 焦点环颜色 |
| `--chart-1` 到 `--chart-5` | 图表/数据可视化 |
| `--sidebar-*` | 侧边栏专用颜色 |
| `--surface` / `--surface-foreground` | 次级表面色 |

颜色采用 OKLCH，例如 `--primary: oklch(0.205 0 0)`，参数分别是明度（0-1）、彩度（0 为灰）、色相（0-360）。

---

## 暗色模式

通过根节点上的 `.dark` 类切换主题。在 Next.js 中通常使用 `next-themes`：

```tsx
import { ThemeProvider } from "next-themes"

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

---

## 更换主题

```bash
# 使用 ui.shadcn.com 的 preset code
npx shadcn@latest init --preset a2r6bw --force

# 切换为命名 preset
npx shadcn@latest init --preset radix-nova --force
npx shadcn@latest init --reinstall  # update existing components to match

# 使用自定义主题 URL
npx shadcn@latest init --preset "https://ui.shadcn.com/init?base=radix&style=nova&theme=blue&..." --force
```

也可以直接编辑 `globals.css` 中的 CSS 变量。

---

## 新增自定义颜色

请在 `npx shadcn@latest info` 返回的 `tailwindCssFile`（通常是 `globals.css`）里添加变量，不要新建额外 CSS 文件。

```css
/* 1. 在全局 CSS 文件中定义变量 */
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}
.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}
```

```css
/* 2a. 在 Tailwind v4 中注册（@theme inline） */
@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

当 `tailwindVersion` 为 `"v3"`（可通过 `npx shadcn@latest info` 查看）时，需要在 `tailwind.config.js` 注册：

```js
// 2b. 在 Tailwind v3 中注册（tailwind.config.js）
module.exports = {
  theme: {
    extend: {
      colors: {
        warning: "oklch(var(--warning) / <alpha-value>)",
        "warning-foreground":
          "oklch(var(--warning-foreground) / <alpha-value>)",
      },
    },
  },
}
```

```tsx
// 3. 在组件中使用
<div className="bg-warning text-warning-foreground">Warning</div>
```

---

## 圆角

`--radius` 控制全局圆角。组件会基于它推导（例如 `rounded-lg = var(--radius)`，`rounded-md = calc(var(--radius) - 2px)`）。

---

## 组件定制

另见 [rules/styling.md](./rules/styling.md) 中的错误/正确示例。

推荐按以下顺序定制：

### 1. 内置 variants

```tsx
<Button variant="outline" size="sm">Click</Button>
```

### 2. 通过 `className` 添加布局类

```tsx
<Card className="max-w-md mx-auto">...</Card>
```

### 3. 增加新 variant

在组件源码里通过 `cva` 增加 variant：

```tsx
// components/ui/button.tsx
warning: "bg-warning text-warning-foreground hover:bg-warning/90",
```

### 4. 封装 wrapper 组件

将 shadcn/ui 基础组件组合成更高层组件：

```tsx
export function ConfirmDialog({ title, description, onConfirm, children }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## 检查更新

```bash
npx shadcn@latest add button --diff
```

更新前可使用 `--dry-run` 与 `--diff` 预览具体变更：

```bash
npx shadcn@latest add button --dry-run          # 查看受影响文件
npx shadcn@latest add button --diff button.tsx  # 查看指定文件 diff
```

完整的智能合并流程见 [SKILL.md 的 Updating Components](./SKILL.md#updating-components)。
