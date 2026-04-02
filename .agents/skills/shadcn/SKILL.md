---
name: shadcn
description: Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composing UI. Provides project context, component docs, and usage examples. Applies when working with shadcn/ui, component registries, presets, --preset codes, or any project with a components.json file. Also triggers for "shadcn init", "create an app with --preset", or "switch to --preset".
user-invocable: false
allowed-tools: Bash(npx shadcn@latest *), Bash(pnpm dlx shadcn@latest *), Bash(bunx --bun shadcn@latest *)
---

# shadcn/ui

一个用于构建 UI、组件和设计系统的框架。组件会通过 CLI 以源码形式加入用户项目。

> **重要：** 所有 CLI 命令都要使用项目对应的执行器：`npx shadcn@latest`、`pnpm dlx shadcn@latest` 或 `bunx --bun shadcn@latest`。请根据项目的 `packageManager` 选择。下文示例默认写 `npx shadcn@latest`，实际请替换。

## 当前项目上下文

```json
!`npx shadcn@latest info --json`
```

上方 JSON 包含项目配置和已安装组件。可通过 `npx shadcn@latest docs <component>` 获取组件文档与示例 URL。

## 基本原则

1. **先用现有组件。** 写自定义 UI 前先用 `npx shadcn@latest search` 检索仓库（含社区仓库）。  
2. **优先组合，不重复造轮子。** 设置页 = Tabs + Card + 表单控件；仪表盘 = Sidebar + Card + Chart + Table。  
3. **先用内置 variant，再考虑自定义样式。** 如 `variant="outline"`、`size="sm"`。  
4. **使用语义化颜色。** 如 `bg-primary`、`text-muted-foreground`，不要写 `bg-blue-500` 这类原始色值。

## 关键规则

以下规则**始终生效**。每条都链接到包含错误/正确对照示例的文档。

### 样式与 Tailwind → [styling.md](./rules/styling.md)

- **`className` for layout, not styling.** Never override component colors or typography.
- **No `space-x-*` or `space-y-*`.** Use `flex` with `gap-*`. For vertical stacks, `flex flex-col gap-*`.
- **Use `size-*` when width and height are equal.** `size-10` not `w-10 h-10`.
- **Use `truncate` shorthand.** Not `overflow-hidden text-ellipsis whitespace-nowrap`.
- **No manual `dark:` color overrides.** Use semantic tokens (`bg-background`, `text-muted-foreground`).
- **Use `cn()` for conditional classes.** Don't write manual template literal ternaries.
- **No manual `z-index` on overlay components.** Dialog, Sheet, Popover, etc. handle their own stacking.

### 表单与输入 → [forms.md](./rules/forms.md)

- **Forms use `FieldGroup` + `Field`.** Never use raw `div` with `space-y-*` or `grid gap-*` for form layout.
- **`InputGroup` uses `InputGroupInput`/`InputGroupTextarea`.** Never raw `Input`/`Textarea` inside `InputGroup`.
- **Buttons inside inputs use `InputGroup` + `InputGroupAddon`.**
- **Option sets (2–7 choices) use `ToggleGroup`.** Don't loop `Button` with manual active state.
- **`FieldSet` + `FieldLegend` for grouping related checkboxes/radios.** Don't use a `div` with a heading.
- **Field validation uses `data-invalid` + `aria-invalid`.** `data-invalid` on `Field`, `aria-invalid` on the control. For disabled: `data-disabled` on `Field`, `disabled` on the control.

### 组件结构 → [composition.md](./rules/composition.md)

- **Items always inside their Group.** `SelectItem` → `SelectGroup`. `DropdownMenuItem` → `DropdownMenuGroup`. `CommandItem` → `CommandGroup`.
- **Use `asChild` (radix) or `render` (base) for custom triggers.** Check `base` field from `npx shadcn@latest info`. → [base-vs-radix.md](./rules/base-vs-radix.md)
- **Dialog, Sheet, and Drawer always need a Title.** `DialogTitle`, `SheetTitle`, `DrawerTitle` required for accessibility. Use `className="sr-only"` if visually hidden.
- **Use full Card composition.** `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`. Don't dump everything in `CardContent`.
- **Button has no `isPending`/`isLoading`.** Compose with `Spinner` + `data-icon` + `disabled`.
- **`TabsTrigger` must be inside `TabsList`.** Never render triggers directly in `Tabs`.
- **`Avatar` always needs `AvatarFallback`.** For when the image fails to load.

### 优先组件，不要手写结构 → [composition.md](./rules/composition.md)

- **Use existing components before custom markup.** Check if a component exists before writing a styled `div`.
- **Callouts use `Alert`.** Don't build custom styled divs.
- **Empty states use `Empty`.** Don't build custom empty state markup.
- **Toast via `sonner`.** Use `toast()` from `sonner`.
- **Use `Separator`** instead of `<hr>` or `<div className="border-t">`.
- **Use `Skeleton`** for loading placeholders. No custom `animate-pulse` divs.
- **Use `Badge`** instead of custom styled spans.

### 图标 → [icons.md](./rules/icons.md)

- **Icons in `Button` use `data-icon`.** `data-icon="inline-start"` or `data-icon="inline-end"` on the icon.
- **No sizing classes on icons inside components.** Components handle icon sizing via CSS. No `size-4` or `w-4 h-4`.
- **Pass icons as objects, not string keys.** `icon={CheckIcon}`, not a string lookup.

### CLI 规则

- **不要手动解析或抓取 preset code。** 直接传给 `npx shadcn@latest init --preset <code>`。

## 关键模式

以下是最常见、最能区分正确写法的模式。边界情况请查看上方规则文件。

```tsx
// Form layout: FieldGroup + Field, not div + Label.
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" />
  </Field>
</FieldGroup>

// Validation: data-invalid on Field, aria-invalid on the control.
<Field data-invalid>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid />
  <FieldDescription>Invalid email.</FieldDescription>
</Field>

// Icons in buttons: data-icon, no sizing classes.
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

// Spacing: gap-*, not space-y-*.
<div className="flex flex-col gap-4">  // correct
<div className="space-y-4">           // wrong

// Equal dimensions: size-*, not w-* h-*.
<Avatar className="size-10">   // correct
<Avatar className="w-10 h-10"> // wrong

// Status colors: Badge variants or semantic tokens, not raw colors.
<Badge variant="secondary">+20.1%</Badge>    // correct
<span className="text-emerald-600">+20.1%</span> // wrong
```

## 组件选型

| 需求 | 组件 |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| 按钮/动作 | `Button`（选择合适 variant） |
| 表单输入 | `Input`、`Select`、`Combobox`、`Switch`、`Checkbox`、`RadioGroup`、`Textarea`、`InputOTP`、`Slider` |
| 2-5 项切换 | `ToggleGroup` + `ToggleGroupItem` |
| 数据展示 | `Table`、`Card`、`Badge`、`Avatar` |
| 导航 | `Sidebar`、`NavigationMenu`、`Breadcrumb`、`Tabs`、`Pagination` |
| 覆盖层 | `Dialog`（模态）、`Sheet`（侧边）、`Drawer`（底部）、`AlertDialog`（确认） |
| 反馈 | `sonner`（toast）、`Alert`、`Progress`、`Skeleton`、`Spinner` |
| 命令面板 | `Dialog` 内放 `Command` |
| 图表 | `Chart`（封装 Recharts） |
| 布局 | `Card`、`Separator`、`Resizable`、`ScrollArea`、`Accordion`、`Collapsible` |
| 空状态 | `Empty` |
| 菜单 | `DropdownMenu`、`ContextMenu`、`Menubar` |
| 提示/信息 | `Tooltip`、`HoverCard`、`Popover` |

## 关键字段

注入的项目上下文中重点关注这些字段：

- **`aliases`**：导入必须使用真实别名前缀（如 `@/`、`~/`），不要硬编码。  
- **`isRSC`**：为 `true` 时，使用 `useState`、`useEffect`、事件处理或浏览器 API 的组件必须加 `"use client"`。  
- **`tailwindVersion`**：`"v4"` 用 `@theme inline`，`"v3"` 用 `tailwind.config.js`。  
- **`tailwindCssFile`**：全局 CSS 文件，自定义变量必须改这里，不要新建。  
- **`style`**：组件视觉风格（如 `nova`、`vega`）。  
- **`base`**：底层库（`radix` 或 `base`），会影响组件 API。  
- **`iconLibrary`**：决定图标导入包，不要默认 `lucide-react`。  
- **`resolvedPaths`**：组件、utils、hooks 等的精确文件路径。  
- **`framework`**：路由与目录规范（如 Next.js App Router / Vite SPA）。  
- **`packageManager`**：安装非 shadcn 依赖时必须遵循。

See [cli.md — `info` command](./cli.md) for the full field reference.

## 组件文档、示例与使用

使用 `npx shadcn@latest docs <component>` 获取组件文档、示例和 API 参考 URL，再访问 URL 查看实际内容。

```bash
npx shadcn@latest docs button dialog select
```

**在新建、修复、调试或使用组件前，先执行 `npx shadcn@latest docs` 并读取对应 URL。** 这样可确保你基于真实 API 与用法，而不是猜测。

## 工作流

1. **获取项目上下文**：上方已注入，必要时重新执行 `npx shadcn@latest info` 刷新。  
2. **Check installed components first** — before running `add`, always check the `components` list from project context or list the `resolvedPaths.ui` directory. Don't import components that haven't been added, and don't re-add ones already installed.
3. **Find components** — `npx shadcn@latest search`.
4. **Get docs and examples** — run `npx shadcn@latest docs <component>` to get URLs, then fetch them. Use `npx shadcn@latest view` to browse registry items you haven't installed. To preview changes to installed components, use `npx shadcn@latest add --diff`.
5. **Install or update** — `npx shadcn@latest add`. When updating existing components, use `--dry-run` and `--diff` to preview changes first (see [Updating Components](#updating-components) below).
6. **Fix imports in third-party components** — After adding components from community registries (e.g. `@bundui`, `@magicui`), check the added non-UI files for hardcoded import paths like `@/components/ui/...`. These won't match the project's actual aliases. Use `npx shadcn@latest info` to get the correct `ui` alias (e.g. `@workspace/ui/components`) and rewrite the imports accordingly. The CLI rewrites imports for its own UI files, but third-party registry components may use default paths that don't match the project.
7. **Review added components** — After adding a component or block from any registry, **always read the added files and verify they are correct**. Check for missing sub-components (e.g. `SelectItem` without `SelectGroup`), missing imports, incorrect composition, or violations of the [Critical Rules](#critical-rules). Also replace any icon imports with the project's `iconLibrary` from the project context (e.g. if the registry item uses `lucide-react` but the project uses `hugeicons`, swap the imports and icon names accordingly). Fix all issues before moving on.
8. **Registry must be explicit** — When the user asks to add a block or component, **do not guess the registry**. If no registry is specified (e.g. user says "add a login block" without specifying `@shadcn`, `@tailark`, etc.), ask which registry to use. Never default to a registry on behalf of the user.
9. **Switching presets** — Ask the user first: **reinstall**, **merge**, or **skip**?
   - **Reinstall**: `npx shadcn@latest init --preset <code> --force --reinstall`. Overwrites all components.
   - **Merge**: `npx shadcn@latest init --preset <code> --force --no-reinstall`, then run `npx shadcn@latest info` to list installed components, then for each installed component use `--dry-run` and `--diff` to [smart merge](#updating-components) it individually.
   - **Skip**: `npx shadcn@latest init --preset <code> --force --no-reinstall`. Only updates config and CSS, leaves components as-is.
   - **Important**: Always run preset commands inside the user's project directory. The CLI automatically preserves the current base (`base` vs `radix`) from `components.json`. If you must use a scratch/temp directory (e.g. for `--dry-run` comparisons), pass `--base <current-base>` explicitly — preset codes do not encode the base.

## 更新组件

当用户要求同步上游组件且保留本地修改时，使用 `--dry-run` + `--diff` 做智能合并。**不要手动抓取 GitHub 原始文件，始终用 CLI。**

1. Run `npx shadcn@latest add <component> --dry-run` to see all files that would be affected.
2. For each file, run `npx shadcn@latest add <component> --diff <file>` to see what changed upstream vs local.
3. Decide per file based on the diff:
   - No local changes → safe to overwrite.
   - Has local changes → read the local file, analyze the diff, and apply upstream updates while preserving local modifications.
   - User says "just update everything" → use `--overwrite`, but confirm first.
4. **Never use `--overwrite` without the user's explicit approval.**

## 快速参考

```bash
# 创建新项目
npx shadcn@latest init --name my-app --preset base-nova
npx shadcn@latest init --name my-app --preset a2r6bw --template vite

# 创建 monorepo 项目
npx shadcn@latest init --name my-app --preset base-nova --monorepo
npx shadcn@latest init --name my-app --preset base-nova --template next --monorepo

# 初始化已有项目
npx shadcn@latest init --preset base-nova
npx shadcn@latest init --defaults  # shortcut: --template=next --preset=base-nova

# 添加组件
npx shadcn@latest add button card dialog
npx shadcn@latest add @magicui/shimmer-button
npx shadcn@latest add --all

# 添加/更新前预览变更
npx shadcn@latest add button --dry-run
npx shadcn@latest add button --diff button.tsx
npx shadcn@latest add @acme/form --view button.tsx

# 搜索仓库
npx shadcn@latest search @shadcn -q "sidebar"
npx shadcn@latest search @tailark -q "stats"

# 获取组件文档和示例 URL
npx shadcn@latest docs button dialog select

# 查看仓库条目详情（未安装条目）
npx shadcn@latest view @shadcn/button
```

**Named presets:** `base-nova`, `radix-nova`
**Templates:** `next`, `vite`, `start`, `react-router`, `astro` (all support `--monorepo`) and `laravel` (not supported for monorepo)
**Preset codes:** Base62 strings starting with `a` (e.g. `a2r6bw`), from [ui.shadcn.com](https://ui.shadcn.com).

## 详细参考

- [rules/forms.md](./rules/forms.md) — FieldGroup, Field, InputGroup, ToggleGroup, FieldSet, validation states
- [rules/composition.md](./rules/composition.md) — Groups, overlays, Card, Tabs, Avatar, Alert, Empty, Toast, Separator, Skeleton, Badge, Button loading
- [rules/icons.md](./rules/icons.md) — data-icon, icon sizing, passing icons as objects
- [rules/styling.md](./rules/styling.md) — Semantic colors, variants, className, spacing, size, truncate, dark mode, cn(), z-index
- [rules/base-vs-radix.md](./rules/base-vs-radix.md) — asChild vs render, Select, ToggleGroup, Slider, Accordion
- [cli.md](./cli.md) — Commands, flags, presets, templates
- [customization.md](./customization.md) — Theming, CSS variables, extending components
