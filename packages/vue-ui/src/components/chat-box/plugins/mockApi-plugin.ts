import type { MessagePlugin, MessagePluginnUiContext } from "./types";

/**
 * 模拟 API 插件 - 支持普通流式输出
 * 流式输出（Streaming）：逐步传输数据的通用方式
 */
export class MokeApiPlugin implements MessagePlugin {
  name = "MokeApiPlugin";
  version = "1.0.0";
  abortRef?: AbortController;

  /**
   * 模拟流式输出 (类似 ReadableStream 或 Fetch Stream)
   */
  async sendMessage(uiContext: MessagePluginnUiContext): Promise<void> {
    const { messages, addMessage, updateMessage, setStatus } = uiContext;
    const lastMessage = messages[messages.length - 1];

    // 创建新的 AbortController 用于中断
    this.abortRef = new AbortController();

    // 准备流式输出的完整内容
    const userMessage = lastMessage?.content || "无消息";
    const fullResponse = `这是一个模拟的流式回复（Stream）。我正在逐字输出内容，模拟真实的流式传输效果。你发送的消息是: "${userMessage}"。现在让我们继续输出更多内容，以便你能看到流式效果的完整演示。`;

    // 创建消息ID
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // 添加初始空消息
    addMessage({
      id: messageId,
      content: "",
      timestamp: Date.now(),
    });

    // 设置为流式状态
    setStatus("streaming");

    try {
      // 模拟流式输出
      await this.simulateStream(
        fullResponse,
        messageId,
        updateMessage,
        this.abortRef.signal
      );

      // 流式输出完成，设置为成功状态
      if (!this.abortRef.signal.aborted) {
        setStatus("success");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Stream aborted");
        setStatus("idle");
      } else {
        console.error("Stream error:", error);
        setStatus("error");
      }
    }
  }

  /**
   * 模拟普通流式输出（类似 ReadableStream）
   * @param fullText 完整文本
   * @param messageId 消息ID
   * @param updateMessage 更新消息的回调
   * @param signal AbortSignal 用于中断
   */
  private async simulateStream(
    fullText: string,
    messageId: string,
    updateMessage: (id: string, message: any) => void,
    signal: AbortSignal
  ): Promise<void> {
    let currentText = "";
    const chunkSize = 2; // 每次输出的字符数
    const delayMs = 50; // 每次输出的延迟时间（毫秒）

    for (let i = 0; i < fullText.length; i += chunkSize) {
      // 检查是否被中断
      if (signal.aborted) {
        throw new Error("AbortError");
      }

      // 获取下一块文本
      const chunk = fullText.slice(i, i + chunkSize);
      currentText += chunk;

      // 更新消息内容
      updateMessage(messageId, {
        id: messageId,
        content: currentText,
        timestamp: Date.now(),
      });

      // 模拟网络延迟
      await this.delay(delayMs);
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 中断流式输出
   */
  async abort(): Promise<void> {
    if (this.abortRef) {
      this.abortRef.abort();
    }
  }
}

/**
 * SSE 事件类型
 */
interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * 模拟 SSE (Server-Sent Events) 插件
 * SSE：HTML5 标准的服务器推送技术，使用 EventSource API
 * 特点：
 * - 单向通信（服务器到客户端）
 * - 基于 HTTP 协议
 * - 支持事件类型、事件ID、自动重连
 * - 数据格式：event:, data:, id:, retry:
 */
export class MockSSEPlugin implements MessagePlugin {
  name = "MockSSEPlugin";
  version = "1.0.0";
  abortRef?: AbortController;

  /**
   * 模拟 SSE 流式输出
   */
  async sendMessage(uiContext: MessagePluginnUiContext): Promise<void> {
    const { messages, addMessage, updateMessage, setStatus } = uiContext;
    const lastMessage = messages[messages.length - 1];

    // 创建新的 AbortController 用于中断
    this.abortRef = new AbortController();

    // 准备流式输出的完整内容
    const userMessage = lastMessage?.content || "无消息";

    // 创建消息ID
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // 添加初始空消息
    addMessage({
      id: messageId,
      content: "",
      timestamp: Date.now(),
    });

    // 设置为流式状态
    setStatus("streaming");

    try {
      // 模拟 SSE 事件流
      await this.simulateSSE(
        userMessage,
        messageId,
        updateMessage,
        this.abortRef.signal
      );

      // 流式输出完成，设置为成功状态
      if (!this.abortRef.signal.aborted) {
        setStatus("success");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("SSE aborted");
        setStatus("idle");
      } else {
        console.error("SSE error:", error);
        setStatus("error");
      }
    }
  }

  /**
   * 模拟 SSE 事件流
   * SSE 格式示例:
   * event: message
   * data: {"content": "hello"}
   * id: 1
   *
   * event: ping
   * data: {"timestamp": 1234567890}
   *
   */
  private async simulateSSE(
    userMessage: string,
    messageId: string,
    updateMessage: (id: string, message: any) => void,
    signal: AbortSignal
  ): Promise<void> {
    let currentContent = "";

    // 模拟多个 SSE 事件
    const sseEvents: SSEEvent[] = [
      {
        event: "start",
        data: JSON.stringify({ type: "start", message: "开始处理..." }),
        id: "1",
      },
      {
        event: "message",
        data: JSON.stringify({ content: "这是一个模拟的 " }),
        id: "2",
      },
      {
        event: "message",
        data: JSON.stringify({ content: "SSE (Server-Sent Events) " }),
        id: "3",
      },
      {
        event: "message",
        data: JSON.stringify({ content: "流式回复。" }),
        id: "4",
      },
      {
        event: "message",
        data: JSON.stringify({
          content: `你发送的消息是: "${userMessage}"。`,
        }),
        id: "5",
      },
      {
        event: "message",
        data: JSON.stringify({ content: "SSE 支持事件类型、" }),
        id: "6",
      },
      {
        event: "message",
        data: JSON.stringify({ content: "事件 ID 和重连机制。" }),
        id: "7",
      },
      {
        event: "ping",
        data: JSON.stringify({ type: "ping", timestamp: Date.now() }),
        id: "8",
      },
      {
        event: "message",
        data: JSON.stringify({ content: "这是模拟的最后一部分内容。" }),
        id: "9",
      },
      {
        event: "done",
        data: JSON.stringify({ type: "done", message: "完成" }),
        id: "10",
      },
    ];

    // 逐个发送 SSE 事件
    for (const sseEvent of sseEvents) {
      // 检查是否被中断
      if (signal.aborted) {
        throw new Error("AbortError");
      }

      // 模拟 SSE 事件处理
      console.log(`[SSE Event] ${sseEvent.event || "message"}:`, sseEvent.data);

      // 只处理 message 类型的事件来更新内容
      if (sseEvent.event === "message") {
        try {
          const parsed = JSON.parse(sseEvent.data);
          if (parsed.content) {
            currentContent += parsed.content;

            // 更新消息内容
            updateMessage(messageId, {
              id: messageId,
              content: currentContent,
              timestamp: Date.now(),
            });
          }
        } catch (e) {
          console.error("Failed to parse SSE data:", e);
        }
      }

      // 模拟 SSE 事件间隔
      await this.delay(300);
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 中断 SSE
   */
  async abort(): Promise<void> {
    if (this.abortRef) {
      this.abortRef.abort();
    }
  }
}
