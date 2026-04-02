# 图标（Icons）

**导入时必须使用项目配置的 `iconLibrary`。** 请从项目上下文读取 `iconLibrary` 字段：`lucide` → `lucide-react`，`tabler` → `@tabler/icons-react`。不要默认使用 `lucide-react`。

---

## Button 中图标使用 `data-icon` 属性

图标需加 `data-icon="inline-start"`（前缀）或 `data-icon="inline-end"`（后缀），且不要写图标尺寸类。

**错误：**

```tsx
<Button>
  <SearchIcon className="mr-2 size-4" />
  Search
</Button>
```

**正确：**

```tsx
<Button>
  <SearchIcon data-icon="inline-start"/>
  Search
</Button>

<Button>
  Next
  <ArrowRightIcon data-icon="inline-end"/>
</Button>
```

---

## 组件内图标不要写尺寸类

组件会通过 CSS 自动处理图标尺寸。不要在 `Button`、`DropdownMenuItem`、`Alert`、`Sidebar*` 等 shadcn 组件里的图标上添加 `size-4`、`w-4 h-4` 等尺寸类（除非用户明确要求自定义尺寸）。

**错误：**

```tsx
<Button>
  <SearchIcon className="size-4" data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <SettingsIcon className="mr-2 size-4" />
  Settings
</DropdownMenuItem>
```

**正确：**

```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <SettingsIcon />
  Settings
</DropdownMenuItem>
```

---

## 以组件对象传图标，不要传字符串 key

请使用 `icon={CheckIcon}`，而不是通过字符串 key 做映射查找。

**错误：**

```tsx
const iconMap = {
  check: CheckIcon,
  alert: AlertIcon,
}

function StatusBadge({ icon }: { icon: string }) {
  const Icon = iconMap[icon]
  return <Icon />
}

<StatusBadge icon="check" />
```

**正确：**

```tsx
// 从项目配置的 iconLibrary 导入（例如 lucide-react、@tabler/icons-react）。
import { CheckIcon } from "lucide-react"

function StatusBadge({ icon: Icon }: { icon: React.ComponentType }) {
  return <Icon />
}

<StatusBadge icon={CheckIcon} />
```
