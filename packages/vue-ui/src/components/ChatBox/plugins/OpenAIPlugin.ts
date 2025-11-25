import type {
  ChatBoxPlugin,
  PluginConfig,
  PluginContext,
  SendMessageOptions,
} from "../types";

/**
 * OpenAI 插件配置
 */
export interface OpenAIPluginConfig extends PluginConfig {
  /**
   * API 密钥
   */
  apiKey: string;

  /**
   * API 基础 URL
   */
  baseURL?: string;

  /**
   * 模型名称
   */
  model?: string;

  /**
   * 温度参数
   */
  temperature?: number;

  /**
   * 最大 tokens
   */
  maxTokens?: number;

  /**
   * 是否启用流式响应
   */
  stream?: boolean;
}

/**
 * OpenAI API 插件
 * 实际调用 OpenAI API 的插件实现
 */
export class OpenAIPlugin implements ChatBoxPlugin {
  name = "OpenAIPlugin";
  version = "1.0.0";

  private config: Required<OpenAIPluginConfig> = {
    apiKey: "",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 2000,
    stream: true,
  };

  private abortController: AbortController | null = null;

  init(config?: OpenAIPluginConfig): void {
    if (!config?.apiKey) {
      throw new Error("[OpenAIPlugin] API key is required");
    }

    this.config = { ...this.config, ...config };
    console.log("[OpenAIPlugin] Initialized");
  }

  async sendMessage(
    options: SendMessageOptions,
    context: PluginContext
  ): Promise<void> {
    const { content } = options;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // 构建消息历史
      const messages = context.messages
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      if (this.config.stream) {
        await this.streamRequest(messages, context, signal);
      } else {
        await this.normalRequest(messages, context, signal);
      }
    } catch (error) {
      if (signal.aborted) {
        console.log("[OpenAIPlugin] Request aborted");
        return;
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  destroy(): void {
    this.abort();
    console.log("[OpenAIPlugin] Destroyed");
  }

  /**
   * 普通请求（非流式）
   */
  private async normalRequest(
    messages: any[],
    context: PluginContext,
    signal: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "API request failed");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    context.addMessage({
      role: "assistant",
      content,
    });
  }

  /**
   * 流式请求
   */
  private async streamRequest(
    messages: any[],
    context: PluginContext,
    signal: AbortSignal
  ): Promise<void> {
    context.setStatus("streaming");

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "API request failed");
    }

    // 创建消息
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    context.addMessage({
      role: "assistant",
      content: "",
      metadata: { id: messageId },
    });

    // 处理流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let currentContent = "";

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done || signal.aborted) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || "";

            if (content) {
              currentContent += content;

              // 更新消息内容
              const messageIndex = context.messages.findIndex(
                (msg) => msg.metadata?.id === messageId
              );

              if (messageIndex !== -1) {
                context.messages[messageIndex].content = currentContent;
              }
            }
          } catch (error) {
            console.error("[OpenAIPlugin] Error parsing SSE data:", error);
          }
        }
      }
    }

    context.setStatus("idle");
  }
}
