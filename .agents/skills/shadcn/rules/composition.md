# 组件组合规范（Composition）

## 目录

- Item 必须放在对应 Group 内
- 提示块使用 `Alert`
- 空状态使用 `Empty`
- Toast 使用 `sonner`
- Overlay 组件选择建议
- `Dialog` / `Sheet` / `Drawer` 必须有标题
- `Card` 结构规范
- `Button` 没有 `isPending` / `isLoading` 属性
- `TabsTrigger` 必须放在 `TabsList` 内
- `Avatar` 必须有 `AvatarFallback`
- 用 `Separator` 替代原生 `<hr>` 或分割线 div
- 用 `Skeleton` 做加载占位
- 用 `Badge` 替代手写样式标签

---

## Item 必须放在 Group 组件内

不要把 Item 直接渲染在内容容器里。

**错误：**

```tsx
<SelectContent>
  <SelectItem value="apple">Apple</SelectItem>
  <SelectItem value="banana">Banana</SelectItem>
</SelectContent>
```

**正确：**

```tsx
<SelectContent>
  <SelectGroup>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
  </SelectGroup>
</SelectContent>
```

该规则适用于所有分组型组件：

| Item | Group |
|------|-------|
| `SelectItem`, `SelectLabel` | `SelectGroup` |
| `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSub` | `DropdownMenuGroup` |
| `MenubarItem` | `MenubarGroup` |
| `ContextMenuItem` | `ContextMenuGroup` |
| `CommandItem` | `CommandGroup` |

---

## 提示块使用 `Alert`

```tsx
<Alert>
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>Something needs attention.</AlertDescription>
</Alert>
```

---

## 空状态使用 `Empty` 组件

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><FolderIcon /></EmptyMedia>
    <EmptyTitle>No projects yet</EmptyTitle>
    <EmptyDescription>Get started by creating a new project.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Create Project</Button>
  </EmptyContent>
</Empty>
```

---

## Toast 通知使用 `sonner`

```tsx
import { toast } from "sonner"

toast.success("Changes saved.")
toast.error("Something went wrong.")
toast("File deleted.", {
  action: { label: "Undo", onClick: () => undoDelete() },
})
```

---

## Overlay 组件如何选择

| 场景 | 组件 |
|----------|-----------|
| 需要专注输入的任务 | `Dialog` |
| 危险操作确认 | `AlertDialog` |
| 侧边详情/筛选面板 | `Sheet` |
| 移动端优先的底部面板 | `Drawer` |
| 悬停展示简要信息 | `HoverCard` |
| 点击触发的小型上下文内容 | `Popover` |

---

## `Dialog` / `Sheet` / `Drawer` 必须有标题

出于可访问性要求，必须包含 `DialogTitle`、`SheetTitle`、`DrawerTitle`。如果不想视觉展示，可用 `className="sr-only"`。

```tsx
<DialogContent>
  <DialogHeader>
    <DialogTitle>Edit Profile</DialogTitle>
    <DialogDescription>Update your profile.</DialogDescription>
  </DialogHeader>
  ...
</DialogContent>
```

---

## `Card` 结构

请使用完整组合结构，不要把所有内容都塞进 `CardContent`：

```tsx
<Card>
  <CardHeader>
    <CardTitle>Team Members</CardTitle>
    <CardDescription>Manage your team.</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button>Invite</Button>
  </CardFooter>
</Card>
```

---

## `Button` 没有 `isPending` 或 `isLoading` 属性

使用 `Spinner` + `data-icon` + `disabled` 组合实现加载态：

```tsx
<Button disabled>
  <Spinner data-icon="inline-start" />
  Saving...
</Button>
```

---

## `TabsTrigger` 必须放在 `TabsList` 里

不要直接把 `TabsTrigger` 放在 `Tabs` 下，必须包在 `TabsList` 内：

```tsx
<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">...</TabsContent>
</Tabs>
```

---

## `Avatar` 必须包含 `AvatarFallback`

为避免图片加载失败时空白，始终包含 `AvatarFallback`：

```tsx
<Avatar>
  <AvatarImage src="/avatar.png" alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

---

## 优先使用现有组件，不要手写同类结构

| 不推荐写法 | 推荐组件 |
|---|---|
| `<hr>` or `<div className="border-t">` | `<Separator />` |
| `<div className="animate-pulse">` with styled divs | `<Skeleton className="h-4 w-3/4" />` |
| `<span className="rounded-full bg-green-100 ...">` | `<Badge variant="secondary">` |
