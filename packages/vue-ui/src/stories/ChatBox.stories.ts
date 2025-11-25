import type { Meta, StoryObj } from "@storybook/vue3";
import ChatBox from "../components/ChatBox/ChatBox.vue";
import { MockAIPlugin } from "../components/ChatBox/plugins/MockAIPlugin";
import { ref } from "vue";

const meta = {
  title: "Components/ChatBox",
  component: ChatBox,
  tags: ["autodocs"],
  argTypes: {
    placeholder: {
      control: "text",
      description: "输入框占位符",
    },
    maxHeight: {
      control: "text",
      description: "最大高度",
    },
    autoScroll: {
      control: "boolean",
      description: "自动滚动到底部",
    },
  },
} satisfies Meta<typeof ChatBox>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 基础示例 - 使用 Mock 插件
 */
export const Default: Story = {
  render: (args) => ({
    components: { ChatBox },
    setup() {
      const plugin = new MockAIPlugin();
      const pluginConfig = {
        delay: 1000,
        streaming: false,
      };

      return { args, plugin, pluginConfig };
    },
    template: `
      <div style="max-width: 600px; margin: 0 auto;">
        <ChatBox 
          v-bind="args"
          :plugin="plugin"
          :plugin-config="pluginConfig"
        />
      </div>
    `,
  }),
  args: {
    placeholder: "输入消息...",
    maxHeight: "500px",
    autoScroll: true,
  },
};

/**
 * 流式响应 - 模拟打字效果
 */
export const Streaming: Story = {
  render: (args) => ({
    components: { ChatBox },
    setup() {
      const plugin = new MockAIPlugin();
      const pluginConfig = {
        delay: 800,
        streaming: true,
      };

      return { args, plugin, pluginConfig };
    },
    template: `
      <div style="max-width: 600px; margin: 0 auto;">
        <ChatBox 
          v-bind="args"
          :plugin="plugin"
          :plugin-config="pluginConfig"
        />
      </div>
    `,
  }),
  args: {
    placeholder: "试试流式响应...",
    maxHeight: "500px",
    autoScroll: true,
  },
};

/**
 * 自定义响应 - 带有自定义逻辑
 */
export const CustomResponse: Story = {
  render: (args) => ({
    components: { ChatBox },
    setup() {
      const plugin = new MockAIPlugin();
      const pluginConfig = {
        delay: 500,
        streaming: true,
        responseGenerator: (input: string) => {
          const lowerInput = input.toLowerCase();

          if (lowerInput.includes("你好") || lowerInput.includes("hello")) {
            return "你好！很高兴见到你！👋";
          }

          if (lowerInput.includes("天气")) {
            return "今天天气不错，阳光明媚！🌞";
          }

          if (lowerInput.includes("笑话")) {
            return "为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 == Dec 25！😄";
          }

          return `你说："${input}"。试试问我"天气"、"笑话"或说"你好"！`;
        },
      };

      return { args, plugin, pluginConfig };
    },
    template: `
      <div style="max-width: 600px; margin: 0 auto;">
        <ChatBox 
          v-bind="args"
          :plugin="plugin"
          :plugin-config="pluginConfig"
        />
      </div>
    `,
  }),
  args: {
    placeholder: '试试说"你好"、"天气"或"笑话"...',
    maxHeight: "500px",
    autoScroll: true,
  },
};

/**
 * 快速响应 - 无延迟
 */
export const FastResponse: Story = {
  render: (args) => ({
    components: { ChatBox },
    setup() {
      const plugin = new MockAIPlugin();
      const pluginConfig = {
        delay: 0,
        streaming: false,
      };

      return { args, plugin, pluginConfig };
    },
    template: `
      <div style="max-width: 600px; margin: 0 auto;">
        <ChatBox 
          v-bind="args"
          :plugin="plugin"
          :plugin-config="pluginConfig"
        />
      </div>
    `,
  }),
  args: {
    placeholder: "即时响应...",
    maxHeight: "500px",
    autoScroll: true,
  },
};

/**
 * 带事件监听
 */
export const WithEvents: Story = {
  render: (args) => ({
    components: { ChatBox },
    setup() {
      const plugin = new MockAIPlugin();
      const pluginConfig = {
        delay: 500,
        streaming: false,
      };

      const logs = ref<string[]>([]);

      const handleMessageSent = (message: any) => {
        logs.value.push(`📤 发送: ${message.content}`);
      };

      const handleMessageReceived = (message: any) => {
        logs.value.push(`📥 接收: ${message.content}`);
      };

      const handleError = (error: Error) => {
        logs.value.push(`❌ 错误: ${error.message}`);
      };

      const handleStatusChange = (status: string) => {
        logs.value.push(`🔄 状态: ${status}`);
      };

      return {
        args,
        plugin,
        pluginConfig,
        logs,
        handleMessageSent,
        handleMessageReceived,
        handleError,
        handleStatusChange,
      };
    },
    template: `
      <div style="max-width: 800px; margin: 0 auto;">
        <div style="display: flex; gap: 16px;">
          <div style="flex: 1;">
            <ChatBox 
              v-bind="args"
              :plugin="plugin"
              :plugin-config="pluginConfig"
              @message-sent="handleMessageSent"
              @message-received="handleMessageReceived"
              @error="handleError"
              @status-change="handleStatusChange"
            />
          </div>
          <div style="flex: 1; background: #f5f5f5; padding: 16px; border-radius: 8px; max-height: 500px; overflow-y: auto;">
            <h3 style="margin-top: 0;">事件日志</h3>
            <div v-for="(log, index) in logs" :key="index" style="font-size: 12px; margin: 4px 0; font-family: monospace;">
              {{ log }}
            </div>
            <div v-if="logs.length === 0" style="color: #999;">暂无事件</div>
          </div>
        </div>
      </div>
    `,
  }),
  args: {
    placeholder: "发送消息查看事件...",
    maxHeight: "500px",
    autoScroll: true,
  },
};
