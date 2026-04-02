# 表单与输入（Forms & Inputs）

## 目录

- 表单布局使用 `FieldGroup + Field`
- `InputGroup` 必须搭配 `InputGroupInput/InputGroupTextarea`
- 输入框内按钮用 `InputGroup + InputGroupAddon`
- 2-7 个选项切换用 `ToggleGroup`
- 相关字段分组用 `FieldSet + FieldLegend`
- 字段校验与禁用状态写法

---

## 表单统一使用 `FieldGroup + Field`

始终使用 `FieldGroup` + `Field`，不要用带 `space-y-*` 的原始 `div` 拼布局：

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" type="email" />
  </Field>
  <Field>
    <FieldLabel htmlFor="password">Password</FieldLabel>
    <Input id="password" type="password" />
  </Field>
</FieldGroup>
```

设置类页面可使用 `Field orientation="horizontal"`。视觉隐藏标签时用 `FieldLabel className="sr-only"`。

**控件选型：**

- 简单文本输入 → `Input`
- 固定选项下拉 → `Select`
- 可搜索下拉 → `Combobox`
- 原生 HTML 下拉（无 JS）→ `native-select`
- 布尔开关 → `Switch`（设置场景）或 `Checkbox`（表单场景）
- 少量单选 → `RadioGroup`
- 2-5 项切换 → `ToggleGroup` + `ToggleGroupItem`
- OTP/验证码输入 → `InputOTP`
- 多行文本 → `Textarea`

---

## `InputGroup` 必须配合专用输入子组件

不要在 `InputGroup` 内直接放原始 `Input` 或 `Textarea`。

**错误：**

```tsx
<InputGroup>
  <Input placeholder="Search..." />
</InputGroup>
```

**正确：**

```tsx
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput placeholder="Search..." />
</InputGroup>
```

---

## 输入框中的按钮使用 `InputGroup + InputGroupAddon`

不要把 `Button` 通过手写定位塞进 `Input` 内或旁边。

**错误：**

```tsx
<div className="relative">
  <Input placeholder="Search..." className="pr-10" />
  <Button className="absolute right-0 top-0" size="icon">
    <SearchIcon />
  </Button>
</div>
```

**正确：**

```tsx
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon>
    <Button size="icon">
      <SearchIcon data-icon="inline-start" />
    </Button>
  </InputGroupAddon>
</InputGroup>
```

---

## 2-7 个选项切换使用 `ToggleGroup`

不要手动循环 `Button` 再自己维护激活态。

**错误：**

```tsx
const [selected, setSelected] = useState("daily")

<div className="flex gap-2">
  {["daily", "weekly", "monthly"].map((option) => (
    <Button
      key={option}
      variant={selected === option ? "default" : "outline"}
      onClick={() => setSelected(option)}
    >
      {option}
    </Button>
  ))}
</div>
```

**正确：**

```tsx
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

<ToggleGroup spacing={2}>
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
  <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
</ToggleGroup>
```

需要标题/标签时，可与 `Field` 组合：

```tsx
<Field orientation="horizontal">
  <FieldTitle id="theme-label">Theme</FieldTitle>
  <ToggleGroup aria-labelledby="theme-label" spacing={2}>
    <ToggleGroupItem value="light">Light</ToggleGroupItem>
    <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
    <ToggleGroupItem value="system">System</ToggleGroupItem>
  </ToggleGroup>
</Field>
```

> **注意：** `defaultValue` 与 `type`/`multiple` 在 base 与 radix 中行为不同，见 [base-vs-radix.md](./base-vs-radix.md#togglegroup)。

---

## 相关字段分组使用 `FieldSet + FieldLegend`

对于相关的复选框、单选框、开关分组，请使用 `FieldSet + FieldLegend`，不要用带标题的普通 `div`：

```tsx
<FieldSet>
  <FieldLegend variant="label">Preferences</FieldLegend>
  <FieldDescription>Select all that apply.</FieldDescription>
  <FieldGroup className="gap-3">
    <Field orientation="horizontal">
      <Checkbox id="dark" />
      <FieldLabel htmlFor="dark" className="font-normal">Dark mode</FieldLabel>
    </Field>
  </FieldGroup>
</FieldSet>
```

---

## 字段校验与禁用状态

这两组属性都需要：`data-invalid`/`data-disabled` 控制字段容器样式（label、description），`aria-invalid`/`disabled` 控制输入控件样式。

```tsx
// 校验失败
<Field data-invalid>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid />
  <FieldDescription>Invalid email address.</FieldDescription>
</Field>

// 禁用
<Field data-disabled>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" disabled />
</Field>
```

适用于所有控件：`Input`、`Textarea`、`Select`、`Checkbox`、`RadioGroupItem`、`Switch`、`Slider`、`NativeSelect`、`InputOTP`。
