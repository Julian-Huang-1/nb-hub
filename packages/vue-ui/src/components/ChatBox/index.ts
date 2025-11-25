/**
 * ChatBox 组件 - 导出
 */

export { default as ChatBox } from "./ChatBox.vue";
export { PluginManager } from "./plugin";
export { MockAIPlugin } from "./plugins/MockAIPlugin";
export { OpenAIPlugin } from "./plugins/OpenAIPlugin";

export type {
  Message,
  ChatStatus,
  PluginConfig,
  SendMessageOptions,
  PluginContext,
  ChatBoxPlugin,
  ChatBoxEvents,
} from "./types";

export type { MockAIPluginConfig } from "./plugins/MockAIPlugin";
export type { OpenAIPluginConfig } from "./plugins/OpenAIPlugin";
