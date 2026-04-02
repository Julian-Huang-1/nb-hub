# 样式与定制（Styling & Customization）

主题、CSS 变量与自定义颜色请参考 [customization.md](../customization.md)。

## 目录

- 语义化颜色
- 优先使用内置 variants
- `className` 仅用于布局
- 禁用 `space-x-* / space-y-*`
- 宽高相等时优先 `size-*`
- 优先使用 `truncate`
- 不要手动写 `dark:` 颜色覆盖
- 条件类名使用 `cn()`
- Overlay 组件不要手动 `z-index`

---

## 语义化颜色

**错误：**

```tsx
<div className="bg-blue-500 text-white">
  <p className="text-gray-600">Secondary text</p>
</div>
```

**正确：**

```tsx
<div className="bg-primary text-primary-foreground">
  <p className="text-muted-foreground">Secondary text</p>
</div>
```

---

## 状态/指标颜色不要直接写原生色值

正负状态、状态标签等场景应使用 Badge variant、语义 token（如 `text-destructive`）或自定义 CSS 变量，不要直接套原生 Tailwind 颜色。

**错误：**

```tsx
<span className="text-emerald-600">+20.1%</span>
<span className="text-green-500">Active</span>
<span className="text-red-600">-3.2%</span>
```

**正确：**

```tsx
<Badge variant="secondary">+20.1%</Badge>
<Badge>Active</Badge>
<span className="text-destructive">-3.2%</span>
```

如果你需要语义 token 里没有的成功色，优先用 Badge variant，或在主题中新增 CSS 变量（见 [customization.md](../customization.md)）。

---

## 优先使用内置 variants

**错误：**

```tsx
<Button className="border border-input bg-transparent hover:bg-accent">
  Click me
</Button>
```

**正确：**

```tsx
<Button variant="outline">Click me</Button>
```

---

## `className` 只做布局

`className` 应用于布局（如 `max-w-md`、`mx-auto`、`mt-4`），**不要**用它去覆盖组件颜色和字体风格。改颜色应通过语义 token、内置 variant 或 CSS 变量。

**错误：**

```tsx
<Card className="bg-blue-100 text-blue-900 font-bold">
  <CardContent>Dashboard</CardContent>
</Card>
```

**正确：**

```tsx
<Card className="max-w-md mx-auto">
  <CardContent>Dashboard</CardContent>
</Card>
```

定制组件外观时，优先顺序如下：
1. **内置 variants**：`variant="outline"`、`variant="destructive"` 等  
2. **语义颜色 token**：`bg-primary`、`text-muted-foreground`  
3. **CSS 变量**：在全局 CSS 中定义自定义颜色（见 [customization.md](../customization.md)）

---

## 禁用 `space-x-* / space-y-*`

请使用 `gap-*`：`space-y-4` → `flex flex-col gap-4`，`space-x-2` → `flex gap-2`。

```tsx
<div className="flex flex-col gap-4">
  <Input />
  <Input />
  <Button>Submit</Button>
</div>
```

---

## 宽高相等时优先 `size-*`

使用 `size-10`，不要写 `w-10 h-10`。适用于图标、头像、骨架屏等。

---

## 优先使用 `truncate`

使用 `truncate`，不要手写 `overflow-hidden text-ellipsis whitespace-nowrap`。

---

## 不要手动写 `dark:` 颜色覆盖

请使用语义 token，它们已通过 CSS 变量处理明暗主题。推荐 `bg-background text-foreground`，不推荐 `bg-white dark:bg-gray-950`。

---

## 条件类名使用 `cn()`

条件类名或类名合并请使用项目内的 `cn()` 工具，不要在 `className` 字符串里手写模板三元表达式。

**错误：**

```tsx
<div className={`flex items-center ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
```

**正确：**

```tsx
import { cn } from "@/lib/utils"

<div className={cn("flex items-center", isActive ? "bg-primary text-primary-foreground" : "bg-muted")}>
```

---

## Overlay 组件不要手动设置 z-index

`Dialog`、`Sheet`、`Drawer`、`AlertDialog`、`DropdownMenu`、`Popover`、`Tooltip`、`HoverCard` 会自行管理层级，不要额外加 `z-50` 或 `z-[999]`。
