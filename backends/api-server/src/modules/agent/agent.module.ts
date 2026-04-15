/**
 * Agent 核心模块
 * 提供 Agent 创建、管理和工具注册的基础设施
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type {
  AgentMessage,
  AgentTool,
  AgentEvent,
} from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import type {
  CreateAgentOptions,
  AgentRuntimeContext,
  AgentExecutionResult,
  AgentInstance,
  ToolRegistry,
  AgentEventHandler,
  ApiKeyConfig,
} from "./agent.types.js";

/**
 * 全局工具注册表
 * 允许各模块注册共享工具
 */
class GlobalToolRegistry implements ToolRegistry {
  private tools = new Map<string, AgentTool<any>>();

  register(tool: AgentTool<any>): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool<any> | undefined {
    return this.tools.get(name);
  }

  getAll(): AgentTool<any>[] {
    return Array.from(this.tools.values());
  }

  registerMany(tools: AgentTool<any>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }
}

// 导出单例
export const toolRegistry: ToolRegistry = new GlobalToolRegistry();

/**
 * 解析 API Key 配置
 */
async function resolveApiKey(
  config: ApiKeyConfig | undefined,
  provider: string,
): Promise<string | undefined> {
  if (!config || config.type === "env") {
    // 从环境变量读取
    const { getEnvApiKey } = await import("@mariozechner/pi-ai");
    return getEnvApiKey(provider);
  }

  if (config.type === "static") {
    return config.key;
  }

  if (config.type === "dynamic") {
    return await config.getter();
  }

  return undefined;
}

/**
 * 创建 Agent 实例
 * 封装 @mariozechner/pi-agent-core 的 Agent 类
 */
export async function createAgent(
  options: CreateAgentOptions,
  context: AgentRuntimeContext,
): Promise<AgentInstance> {
  // 验证必要参数
  if (!options.model) {
    throw new Error(
      "[Agent] options.model is required. Did getDefaultModel() return undefined? " +
        "Check AI_PROVIDER and AI_MODEL environment variables.",
    );
  }

  const eventHandlers: AgentEventHandler[] = [];

  // 解析 API key
  const apiKey = await resolveApiKey(options.apiKey, options.model.provider);

  const agent = new Agent({
    initialState: {
      systemPrompt: options.systemPrompt,
      model: options.model,
      thinkingLevel: options.thinkingLevel ?? "medium",
      tools: options.tools ?? [],
      messages: options.initialMessages ?? [],
    },
    // 转换消息以适应 LLM
    convertToLlm: (messages: AgentMessage[]) => {
      return messages.filter((m) =>
        ["user", "assistant", "toolResult"].includes(m.role),
      );
    },
    sessionId: options.sessionId,
    // 动态 API key 支持
    getApiKey: apiKey ? () => apiKey : undefined,
  });

  // 包装为标准 AgentInstance 接口
  const instance: AgentInstance = {
    getState: () => agent.state,

    prompt: async (content: string, attachments?) => {
      const allMessages: AgentMessage[] = [];
      let finalMessage: AgentMessage | null = null;
      let success = true;
      let error: string | undefined;

      try {
        // 创建 Promise 来等待执行完成
        await new Promise<void>((resolve, reject) => {
          const unsubscribe = agent.subscribe((event: AgentEvent) => {
            // 调用外部处理器
            for (const handler of eventHandlers) {
              try {
                handler(event, context);
              } catch (e) {
                console.error("Agent event handler error:", e);
              }
            }

            // 收集消息
            if (event.type === "agent_end") {
              allMessages.push(...event.messages);
              unsubscribe();
              resolve();
            }

            // 记录最后一个消息
            if (
              event.type === "message_end" &&
              event.message.role === "assistant"
            ) {
              finalMessage = event.message;
            }

            // 处理错误
            if (event.type === "agent_end" && agent.state.error) {
              error = agent.state.error;
              success = false;
            }
          });

          // 执行 prompt
          agent.prompt(content, attachments).catch(reject);
        });

        return {
          message: finalMessage ?? allMessages[allMessages.length - 1],
          allMessages,
          success,
          error,
        };
      } catch (e) {
        return {
          message: agent.state.messages[agent.state.messages.length - 1],
          allMessages: agent.state.messages,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },

    continue: async () => {
      const allMessages: AgentMessage[] = [];
      let finalMessage: AgentMessage | null = null;
      let success = true;
      let error: string | undefined;

      try {
        await new Promise<void>((resolve, reject) => {
          const unsubscribe = agent.subscribe((event: AgentEvent) => {
            for (const handler of eventHandlers) {
              try {
                handler(event, context);
              } catch (e) {
                console.error("Agent event handler error:", e);
              }
            }

            if (event.type === "agent_end") {
              allMessages.push(...event.messages);
              unsubscribe();
              resolve();
            }

            if (
              event.type === "message_end" &&
              event.message.role === "assistant"
            ) {
              finalMessage = event.message;
            }

            if (event.type === "agent_end" && agent.state.error) {
              error = agent.state.error;
              success = false;
            }
          });

          agent.continue().catch(reject);
        });

        return {
          message: finalMessage ?? allMessages[allMessages.length - 1],
          allMessages,
          success,
          error,
        };
      } catch (e) {
        return {
          message: agent.state.messages[agent.state.messages.length - 1],
          allMessages: agent.state.messages,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },

    subscribe: (handler: AgentEventHandler) => {
      eventHandlers.push(handler);
      return () => {
        const index = eventHandlers.indexOf(handler);
        if (index > -1) {
          eventHandlers.splice(index, 1);
        }
      };
    },

    abort: () => {
      agent.abort();
    },

    reset: () => {
      agent.reset();
    },
  };

  return instance;
}

/**
 * 创建流式 Agent 实例
 * 通过回调函数实时返回事件
 */
export async function createStreamingAgent(
  options: CreateAgentOptions,
  context: AgentRuntimeContext,
  onEvent: (event: AgentEvent) => void | Promise<void>,
): Promise<AgentInstance> {
  // 验证必要参数
  if (!options.model) {
    throw new Error(
      "[Agent] options.model is required. Did getDefaultModel() return undefined? " +
        "Check AI_PROVIDER and AI_MODEL environment variables.",
    );
  }

  // 解析 API key
  const apiKey = await resolveApiKey(options.apiKey, options.model.provider);

  const agent = new Agent({
    initialState: {
      systemPrompt: options.systemPrompt,
      model: options.model,
      thinkingLevel: options.thinkingLevel ?? "medium",
      tools: options.tools ?? [],
      messages: options.initialMessages ?? [],
    },
    convertToLlm: (messages: AgentMessage[]) => {
      return messages.filter((m) =>
        ["user", "assistant", "toolResult"].includes(m.role),
      );
    },
    sessionId: options.sessionId,
    // 动态 API key 支持
    getApiKey: apiKey ? () => apiKey : undefined,
  });

  // 订阅所有事件并转发
  agent.subscribe(async (event: AgentEvent) => {
    try {
      await onEvent(event);
    } catch (e) {
      console.error("Streaming agent event handler error:", e);
    }
  });

  const instance: AgentInstance = {
    getState: () => agent.state,

    prompt: async (content: string, attachments?) => {
      try {
        await agent.prompt(content, attachments);
        return {
          message: agent.state.messages[agent.state.messages.length - 1],
          allMessages: agent.state.messages,
          success: !agent.state.error,
          error: agent.state.error,
        };
      } catch (e) {
        return {
          message: agent.state.messages[agent.state.messages.length - 1],
          allMessages: agent.state.messages,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },

    continue: async () => {
      try {
        await agent.continue();
        return {
          message: agent.state.messages[agent.state.messages.length - 1],
          allMessages: agent.state.messages,
          success: !agent.state.error,
          error: agent.state.error,
        };
      } catch (e) {
        return {
          message: agent.state.messages[agent.state.messages.length - 1],
          allMessages: agent.state.messages,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },

    subscribe: (handler: AgentEventHandler) => {
      // 流式 agent 已经有一个全局订阅器
      // 这里添加额外的处理器
      agent.subscribe((event: AgentEvent) => {
        handler(event, context);
      });
      return () => {}; // 简化处理，实际需要更复杂的取消订阅逻辑
    },

    abort: () => {
      agent.abort();
    },

    reset: () => {
      agent.reset();
    },
  };

  return instance;
}

/**
 * 获取默认模型配置
 * 从环境变量读取或使用默认值
 */
export async function getDefaultModel(): Promise<Model<any>> {
  const { getModel, getProviders, getModels } =
    await import("@mariozechner/pi-ai");

  const provider = process.env.AI_PROVIDER ?? "openrouter";
  const modelName = process.env.AI_MODEL ?? "qwen/qwen3.6-plus";

  try {
    const model = getModel(provider, modelName);
    if (!model) {
      const availableProviders = getProviders();
      throw new Error(
        `Model "${modelName}" not found for provider "${provider}". ` +
          `Available providers: ${availableProviders.join(", ")}. ` +
          `Please check AI_PROVIDER and AI_MODEL environment variables.`,
      );
    }
    return model;
  } catch (error) {
    console.error("[Agent] Failed to get model:", error);
    throw new Error(
      `Failed to initialize AI model: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// 重新导出类型
export type {
  CreateAgentOptions,
  AgentRuntimeContext,
  AgentExecutionResult,
  AgentInstance,
  ToolRegistry,
  AgentEventHandler,
  ApiKeyConfig,
} from "./agent.types.js";
