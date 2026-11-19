# @nb-hub/machine

最小同步状态机及 Vue 3 适配层。不依赖 XState，按工作区惯例直接导出 TypeScript 源码，不需要预先构建。

## 业务接入

业务模块导出 `useXXXMachine()`，页面提供一次作用域，组件通过 `send` 修改数据、通过 `useSelector` 读取数据。

## 1. 添加依赖

在应用的 `package.json` 中添加工作区依赖，再执行 `pnpm install`。应用需使用 Vue `^3.3.0`。

```json
{
  "dependencies": {
    "@nb-hub/machine": "workspace:*"
  }
}
```

## 2. 定义业务 machine 和 Hook

普通表单输入统一使用 `CHANGE + patch`；预览、返回编辑等操作使用独立事件。联动计算放在 `assign` 中，不放到组件里。

```ts
// salary-machine.ts
import type { MachineDefinition } from "@nb-hub/machine";
import { assign } from "@nb-hub/machine";
import { useMachine } from "@nb-hub/machine/vue";

interface SalaryContext {
  salary: number;
  bonusMonths: number;
  yearEndBonus: number;
}

// 只允许修改输入字段，计算结果由 machine 更新。
export type SalaryPatch = Partial<Pick<SalaryContext, "salary" | "bonusMonths">>;

type SalaryEvent = { type: "CHANGE"; patch: SalaryPatch } | { type: "PREVIEW" } | { type: "EDIT" };

export const salaryDefinition: MachineDefinition<
  "editing" | "previewing",
  SalaryContext,
  SalaryEvent
> = {
  initial: "editing",
  context: () => ({ salary: 10000, bonusMonths: 2, yearEndBonus: 20000 }),
  states: {
    editing: {
      on: {
        CHANGE: {
          actions: [
            assign(({ context, event }) => {
              const salary = event.patch.salary ?? context.salary;
              const bonusMonths = event.patch.bonusMonths ?? context.bonusMonths;
              return { salary, bonusMonths, yearEndBonus: salary * bonusMonths };
            }),
          ],
        },
        PREVIEW: {
          guard: ({ context }) => context.salary > 0 && context.bonusMonths >= 0,
          target: "previewing",
        },
      },
    },
    previewing: {
      on: {
        EDIT: { target: "editing" },
      },
    },
  },
};

export const useSalaryMachine = () => useMachine(salaryDefinition);
```

`context()` 每次返回独立初始数据。当前状态未配置的事件会被忽略，因此预览状态不会接受 `CHANGE`。

## 3. 页面提供作用域

在页面父组件的同步 setup 中调用一次，后代组件共享这个作用域内的实例：

```vue
<!-- SalaryPage.vue -->
<script setup lang="ts">
import { provideMachineScope } from "@nb-hub/machine/vue";
import SalaryForm from "./SalaryForm.vue";
import SalarySummary from "./SalarySummary.vue";

provideMachineScope();
</script>

<template>
  <SalaryForm />
  <SalarySummary />
</template>
```

同一作用域可以使用多个业务 machine，无需逐个注册。每个定义在首次使用时创建实例，之后复用。两份独立表单分别提供作用域即可。

## 4. 表单组件读取和修改数据

在表单组件的 setup 中，从业务 Hook 解构所需接口：

```ts
import type { SalaryPatch } from "./salary-machine";
import { useSalaryMachine } from "./salary-machine";

const { send, useSelector } = useSalaryMachine();
const model = useSelector((s) => s.context);
const editable = useSelector((s) => s.value === "editing");

function change(patch: SalaryPatch) {
  send({ type: "CHANGE", patch });
}
```

输入区块订阅一份 model 即可，不需要为每个字段单独订阅。AntD 输入组件使用受控绑定：

```vue
<InputNumber
  :value="model.salary"
  :disabled="!editable"
  @update:value="(value) => change({ salary: Number(value ?? 0) })"
/>
```

多个字段可以一次更新，联动按最终输入计算：

```ts
change({ salary: 20000, bonusMonths: 3 });
// model.value.yearEndBonus 更新为 60000。
```

表单校验仍由 AntD Form 管理。校验成功后再发送 `PREVIEW`；返回编辑时发送 `EDIT`。

```ts
async function preview() {
  const form = formRef.value;
  if (!form) return;

  try {
    await form.validateFields();
  } catch {
    return;
  }

  send({ type: "PREVIEW" });
}

function edit() {
  send({ type: "EDIT" });
}
```

model 为只读数据，写入统一走 `change()`。不要用可写 `v-model` 或 `resetFields()` 直接修改 model；需要重置时，定义业务 `RESET` 事件，处理后通过 `clearValidate()` 清除校验错误。

## 5. 其他组件共享数据

只读汇总组件仍使用同一个业务 Hook，按自身需要选择数据：

```ts
const { useSelector } = useSalaryMachine();
const bonus = useSelector((s) => s.context.yearEndBonus);
```

选择多个字段并返回新对象时，可指定比较器，避免无关变化更新该订阅结果：

```ts
const amounts = useSelector(
  (s) => ({ salary: s.context.salary, bonus: s.context.yearEndBonus }),
  (a, b) => a.salary === b.salary && a.bonus === b.bonus,
);
```

消费组件卸载时自动取消订阅，实例和已编辑数据仍保留；页面作用域销毁时统一停止实例。嵌套作用域中的实例相互独立，不向外层借用。

提供作用域的组件自身若也需要使用 machine，通过返回值获取：

```ts
const scope = provideMachineScope();
const { send, useSelector } = scope.getOrCreate(salaryDefinition);
```
