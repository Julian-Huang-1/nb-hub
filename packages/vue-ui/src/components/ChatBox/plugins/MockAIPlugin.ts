import type {
  ChatBoxPlugin,
  PluginConfig,
  PluginContext,
  SendMessageOptions,
} from "../types";

/**
 * Mock AI 插件配置
 */
export interface MockAIPluginConfig extends PluginConfig {
  /**
   * 响应延迟（毫秒）
   */
  delay?: number;

  /**
   * 是否启用流式响应
   */
  streaming?: boolean;

  /**
   * 自定义响应生成器
   */
  responseGenerator?: (input: string) => string;
}

/**
 * Mock AI 插件 - 用于测试和演示
 * 模拟 AI 响应，支持流式输出
 */
export class MockAIPlugin implements ChatBoxPlugin {
  name = "MockAIPlugin";
  version = "1.0.0";

  private config: MockAIPluginConfig = {
    delay: 1000,
    streaming: false,
  };

  private abortController: AbortController | null = null;

  init(config?: MockAIPluginConfig): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    console.log("[MockAIPlugin] Initialized with config:", this.config);
  }

  async sendMessage(
    options: SendMessageOptions,
    context: PluginContext
  ): Promise<void> {
    const { content } = options;

    // 创建 abort controller
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // 模拟延迟
      await this.delay(this.config.delay || 1000, signal);

      if (signal.aborted) {
        console.log("[MockAIPlugin] Request aborted");
        return;
      }

      // 生成响应
      const response = this.generateResponse(content);

      if (this.config.streaming) {
        // 流式输出
        await this.streamResponse(response, context, signal);
      } else {
        // 一次性输出
        context.addMessage({
          role: "assistant",
          content: response,
        });
      }
    } catch (error) {
      if (signal.aborted) {
        console.log("[MockAIPlugin] Request aborted");
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
    console.log("[MockAIPlugin] Destroyed");
  }

  /**
   * 生成响应内容
   */
  private generateResponse(input: string): string {
    if (this.config.responseGenerator) {
      return this.config.responseGenerator(input);
    }

    // 默认响应生成逻辑
    const responses = [
      `收到你的消息："${input}"`,
      `这是一个模拟的 AI 响应。你说的是：${input}`,
      `我理解你的意思了。关于"${input}"，这是我的看法...`,
      `有趣的问题！让我想想关于"${input}"的回答...`,
    ];

    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }

  /**
   * 流式输出响应
   */
  private async streamResponse(
    response: string,
    context: PluginContext,
    signal: AbortSignal
  ): Promise<void> {
    context.setStatus("streaming");

    // 创建一个新消息
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    context.addMessage({
      role: "assistant",
      content: "",
      metadata: { id: messageId },
    });

    // 逐字输出
    const words = response.split("");
    let currentContent = "";

    for (const word of words) {
      if (signal.aborted) {
        break;
      }

      currentContent += word;

      // 更新消息内容
      const messageIndex = context.messages.findIndex(
        (msg) => msg.metadata?.id === messageId
      );

      if (messageIndex !== -1) {
        context.messages[messageIndex].content = currentContent;
      }

      // 模拟打字延迟
      await this.delay(30, signal);
    }

    context.setStatus("idle");
  }

  /**
   * 延迟函数（支持中断）
   */
  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);

      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Aborted"));
      });
    });
  }
}
