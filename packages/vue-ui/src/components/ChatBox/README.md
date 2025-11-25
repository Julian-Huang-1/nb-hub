# ChatBox 组件

一个采用插件架构设计的 Vue 聊天组件，UI 与逻辑完全分离，易于测试和扩展。

## ✨ 特性

- 🔌 **插件架构** - UI 与业务逻辑完全分离
- 🧪 **易于测试** - 插件可独立测试，UI 组件测试简单
- 🔄 **可扩展** - 轻松添加新的 AI 服务支持
- 💬 **流式输出** - 支持流式响应，提升用户体验
- 🎨 **现代 UI** - 美观的聊天界面，响应式设计
- ⚡ **TypeScript** - 完整的类型定义

## 📦 安装

```bash
npm install vue-ui
```

## 🚀 快速开始

### 基础使用（Mock 插件）

```vue
<script setup lang="ts">
import { ChatBox, MockAIPlugin } from "@/components/ChatBox";

const mockPlugin = new MockAIPlugin();
</script>

<template>
  <ChatBox
    :plugin="mockPlugin"
    :plugin-config="{ delay: 1000, streaming: true }"
  />
</template>
```

### 使用 OpenAI 插件

```vue
<script setup lang="ts">
import { ChatBox, OpenAIPlugin } from "@/components/ChatBox";

const openaiPlugin = new OpenAIPlugin();
const config = {
  apiKey: "your-api-key",
  model: "gpt-3.5-turbo",
  stream: true,
};
</script>

<template>
  <ChatBox :plugin="openaiPlugin" :plugin-config="config" />
</template>
```

## 🔧 API

### ChatBox Props

| 属性           | 类型            | 默认值          | 说明               |
| -------------- | --------------- | --------------- | ------------------ |
| `plugin`       | `ChatBoxPlugin` | -               | 必需，聊天插件实例 |
| `pluginConfig` | `PluginConfig`  | `{}`            | 插件配置           |
| `placeholder`  | `string`        | `'输入消息...'` | 输入框占位符       |
| `maxHeight`    | `string`        | `'600px'`       | 最大高度           |
| `autoScroll`   | `boolean`       | `true`          | 自动滚动到底部     |

### ChatBox Events

| 事件               | 参数                   | 说明               |
| ------------------ | ---------------------- | ------------------ |
| `message-sent`     | `(message: Message)`   | 用户发送消息时触发 |
| `message-received` | `(message: Message)`   | 收到 AI 响应时触发 |
| `error`            | `(error: Error)`       | 发生错误时触发     |
| `status-change`    | `(status: ChatStatus)` | 状态变化时触发     |

### ChatBox Methods

通过 `ref` 可以访问组件方法：

```vue
<script setup>
import { ref } from "vue";

const chatBoxRef = ref();

// 发送消息
chatBoxRef.value.sendMessage();

// 清空消息
chatBoxRef.value.clearMessages();

// 中断请求
chatBoxRef.value.abort();
</script>

<template>
  <ChatBox ref="chatBoxRef" :plugin="plugin" />
</template>
```

## 🔌 插件开发

### 插件接口

```typescript
interface ChatBoxPlugin {
  name: string;
  version?: string;

  // 初始化
  init?(config?: PluginConfig): void | Promise<void>;

  // 发送消息（核心方法）
  sendMessage(
    options: SendMessageOptions,
    context: PluginContext
  ): Promise<void>;

  // 销毁
  destroy?(): void | Promise<void>;

  // 中断
  abort?(): void;
}
```

### 插件上下文

插件可以通过 `PluginContext` 与 UI 交互：

```typescript
interface PluginContext {
  messages: Message[]; // 消息列表
  status: ChatStatus; // 当前状态
  setStatus: (status: ChatStatus) => void; // 设置状态
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void; // 添加消息
  updateMessage: (id: string, updates: Partial<Message>) => void; // 更新消息
  clearMessages: () => void; // 清空消息
}
```

### 自定义插件示例

```typescript
import type {
  ChatBoxPlugin,
  PluginContext,
  SendMessageOptions,
} from "@/components/ChatBox";

export class CustomPlugin implements ChatBoxPlugin {
  name = "CustomPlugin";

  private abortController: AbortController | null = null;

  async init(config?: any): Promise<void> {
    // 初始化逻辑
    console.log("Plugin initialized with config:", config);
  }

  async sendMessage(
    options: SendMessageOptions,
    context: PluginContext
  ): Promise<void> {
    const { content } = options;
    this.abortController = new AbortController();

    try {
      // 调用你的 AI 服务
      const response = await fetch("your-api-endpoint", {
        method: "POST",
        body: JSON.stringify({ message: content }),
        signal: this.abortController.signal,
      });

      const data = await response.json();

      // 添加 AI 响应
      context.addMessage({
        role: "assistant",
        content: data.reply,
      });
    } catch (error) {
      if (this.abortController.signal.aborted) {
        return;
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  destroy(): void {
    this.abort();
  }
}
```

## 🧪 测试

### 测试插件

插件可以独立测试，无需 UI：

```typescript
import { describe, it, expect, vi } from "vitest";
import { MockAIPlugin } from "@/components/ChatBox";
import type { PluginContext } from "@/components/ChatBox";

describe("MockAIPlugin", () => {
  it("should send message", async () => {
    const plugin = new MockAIPlugin();
    await plugin.init({ delay: 0 });

    const mockContext: PluginContext = {
      messages: [],
      status: "idle",
      setStatus: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
    };

    await plugin.sendMessage({ content: "Hello" }, mockContext);

    expect(mockContext.addMessage).toHaveBeenCalled();
  });
});
```

### 测试 UI 组件

UI 组件可以使用 Mock 插件测试：

```typescript
import { mount } from "@vue/test-utils";
import { ChatBox, MockAIPlugin } from "@/components/ChatBox";

describe("ChatBox", () => {
  it("should render", () => {
    const plugin = new MockAIPlugin();
    const wrapper = mount(ChatBox, {
      props: { plugin },
    });

    expect(wrapper.find(".chat-box").exists()).toBe(true);
  });
});
```

## 📝 内置插件

### MockAIPlugin

模拟 AI 响应的插件，用于开发和测试。

**配置选项：**

```typescript
interface MockAIPluginConfig {
  delay?: number; // 响应延迟（毫秒），默认 1000
  streaming?: boolean; // 是否启用流式响应，默认 false
  responseGenerator?: (input: string) => string; // 自定义响应生成器
}
```

**示例：**

```typescript
const plugin = new MockAIPlugin();
const config = {
  delay: 500,
  streaming: true,
  responseGenerator: (input) => `你说的是：${input}`,
};
```

### OpenAIPlugin

OpenAI API 插件，支持 GPT 模型。

**配置选项：**

```typescript
interface OpenAIPluginConfig {
  apiKey: string; // API 密钥（必需）
  baseURL?: string; // API 基础 URL，默认 'https://api.openai.com/v1'
  model?: string; // 模型名称，默认 'gpt-3.5-turbo'
  temperature?: number; // 温度参数，默认 0.7
  maxTokens?: number; // 最大 tokens，默认 2000
  stream?: boolean; // 是否启用流式响应，默认 true
}
```

**示例：**

```typescript
const plugin = new OpenAIPlugin();
const config = {
  apiKey: "sk-...",
  model: "gpt-4",
  temperature: 0.8,
  stream: true,
};
```

## 🎨 样式自定义

组件使用 scoped CSS，你可以通过 CSS 变量或深度选择器自定义样式：

```vue
<style>
.chat-box {
  /* 自定义样式 */
}
</style>
```

## 📚 完整示例

查看 `examples/` 目录获取更多示例：

- `BasicExample.vue` - 基础使用
- `CustomPluginExample.vue` - 自定义插件
- `StreamingExample.vue` - 流式响应
- `TestExample.vue` - 测试示例

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT
