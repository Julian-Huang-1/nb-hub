# @nb-hub/nb-ui

一个基于 Vue 3 + TypeScript 的简单 UI 组件库，使用 tsup 打包。

## ✨ 特性

- 🎨 简洁美观的 UI 设计
- 📦 使用 tsup 打包，支持 ESM 和 CJS
- 💪 完整的 TypeScript 类型支持
- 🎯 按需引入，减小打包体积
- ⚡️ 开发模式支持热更新

## 📦 安装

```bash
# 在项目中安装依赖
pnpm install

# 开发模式（监听文件变化）
pnpm dev

# 构建生产版本
pnpm build
```

## 📚 使用方法

### 方式一：全局注册

```typescript
import { createApp } from "vue";
import NbUI from "@nb-hub/nb-ui";
import "@nb-hub/nb-ui/dist/index.css";
import App from "./App.vue";

const app = createApp(App);
app.use(NbUI);
app.mount("#app");
```

### 方式二：按需引入（推荐）

```vue
<script setup lang="ts">
import { Button } from "@nb-hub/nb-ui";
import "@nb-hub/nb-ui/dist/index.css";
import type { ButtonProps } from "@nb-hub/nb-ui";

const handleClick = (e: MouseEvent) => {
  console.log("Button clicked!", e);
};
</script>

<template>
  <Button type="primary" @click="handleClick"> 点击我 </Button>
</template>
```

## 🎨 组件

### Button 按钮

基础的按钮组件，支持多种类型、尺寸和状态。

#### Props

| 参数     | 说明         | 类型      | 可选值                                                            | 默认值    |
| -------- | ------------ | --------- | ----------------------------------------------------------------- | --------- |
| type     | 按钮类型     | `string`  | `primary` / `success` / `warning` / `danger` / `info` / `default` | `default` |
| size     | 按钮尺寸     | `string`  | `large` / `default` / `small`                                     | `default` |
| disabled | 是否禁用     | `boolean` | -                                                                 | `false`   |
| loading  | 是否加载中   | `boolean` | -                                                                 | `false`   |
| round    | 是否圆角按钮 | `boolean` | -                                                                 | `false`   |
| circle   | 是否圆形按钮 | `boolean` | -                                                                 | `false`   |

#### Events

| 事件名 | 说明           | 回调参数              |
| ------ | -------------- | --------------------- |
| click  | 点击按钮时触发 | `(event: MouseEvent)` |

#### 示例

```vue
<template>
  <div class="demo">
    <!-- 不同类型 -->
    <Button type="default">默认按钮</Button>
    <Button type="primary">主要按钮</Button>
    <Button type="success">成功按钮</Button>
    <Button type="warning">警告按钮</Button>
    <Button type="danger">危险按钮</Button>
    <Button type="info">信息按钮</Button>

    <!-- 不同尺寸 -->
    <Button size="large" type="primary">大按钮</Button>
    <Button size="default" type="primary">默认按钮</Button>
    <Button size="small" type="primary">小按钮</Button>

    <!-- 不同状态 -->
    <Button type="primary" disabled>禁用按钮</Button>
    <Button type="primary" loading>加载中...</Button>
    <Button type="primary" round>圆角按钮</Button>
    <Button type="primary" circle>A</Button>
  </div>
</template>
```

查看 `example.vue` 获取完整示例。

## 🛠 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - JavaScript 的超集，提供类型支持
- **tsup** - 基于 esbuild 的快速打包工具
- **esbuild-plugin-vue-next** - Vue SFC 编译支持

## 📂 项目结构

```
packages/nb-ui/
├── src/
│   ├── components/
│   │   └── Button/
│   │       ├── Button.vue      # 组件实现
│   │       ├── index.ts        # 组件导出
│   │       └── types.ts        # 类型定义
│   ├── index.ts               # 主入口
│   └── shims-vue.d.ts         # Vue 类型声明
├── dist/                      # 构建输出
│   ├── index.js              # ESM 格式
│   ├── index.cjs             # CommonJS 格式
│   ├── index.css             # 样式文件
│   └── index.d.ts            # TypeScript 声明
├── package.json
├── tsconfig.json
├── tsup.config.ts            # tsup 配置
├── example.vue               # 示例文件
└── README.md
```

## 🔨 构建说明

本项目使用 tsup 进行打包：

- ✅ 支持 ESM 和 CommonJS 双格式输出
- ✅ 自动提取和合并 CSS
- ✅ 自动生成 TypeScript 类型声明
- ✅ Tree-shaking 支持
- ✅ Vue SFC 编译支持

构建输出：

- `dist/index.js` - ESM 格式（适用于现代打包工具）
- `dist/index.cjs` - CommonJS 格式（适用于 Node.js）
- `dist/index.css` - 样式文件
- `dist/index.d.ts` - TypeScript 类型声明

## 📄 License

MIT
