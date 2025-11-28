import { ContentBlockAccumulator } from "./accumulator";
import type { IAiProvider, Message } from "./ai-provider/aiProvider.interface";
import { ContentBlockParser } from "./content-parser/content-block-parser";
import { SessionManager } from "./session-manager";
import { v4 as uuid } from "uuid";

export type MessageCallback = (message: Message) => void;

export class MessageManager {
  private sessionManager: SessionManager;
  private aiProvider: IAiProvider;
  private contentParser: ContentBlockParser;

  constructor(sessionManager: SessionManager, aiProvider: IAiProvider) {
    this.sessionManager = sessionManager;
    this.aiProvider = aiProvider;
    this.contentParser = new ContentBlockParser();
  }

  // 发送消息
  async send(
    sessionId: string,
    message: Message,
    onStream?: MessageCallback
  ): Promise<Message> {
    const userMessage = message;

    await this.sessionManager.update(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage],
    }));

    // 创建 AI 消息
    const aiMessage: Message = {
      id: uuid(),
      role: "assistant",
      content: [],
      timestamp: Date.now(),
    };

    // 获取会话历史
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 用来发送消息用
    const messages = [...session.messages];

    // 流式生成
    try {
      // 用于增量内容块（用于流式更新）
      const blockAccumulators = new ContentBlockAccumulator();

      for await (const chunk of this.aiProvider.chatStream(messages)) {
        if (!chunk.done) {
          const contentBlocks = this.contentParser.parse(
            chunk.choices[0].delta
          );

          if (contentBlocks) {
            blockAccumulators.add(contentBlocks);
          }
          // 处理增量更新
          aiMessage.content = blockAccumulators.getBlocks();
          onStream?.({ ...aiMessage });
        }
      }

      return { ...aiMessage };
    } catch (error) {
      // 错误处理
      aiMessage.content = [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ];

      throw error;
    } finally {
      // 保存AI 回复消息
      await this.sessionManager.update(sessionId, (session) => ({
        ...session,
        messages: [...session.messages, aiMessage],
      }));
    }
  }

  // 重新生成消息
  async regenerate(
    sessionId: string,
    messageId: string,
    onStream?: MessageCallback
  ): Promise<Message> {
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 找到消息位置
    const index = session.messages.findIndex((m) => m.id === messageId);
    if (index === -1) {
      throw new Error(`Message ${messageId} not found`);
    }

    // 截断该消息及之后
    const messages = session.messages.slice(0, index + 1);

    // 创建新的 AI 消息
    const aiMessage: Message = {
      id: uuid(),
      role: "assistant",
      content: [],
      timestamp: Date.now(),
    };

    // 用于增量内容块（用于流式更新）
    const blockAccumulators = new ContentBlockAccumulator();

    // 流式生成
    for await (const chunk of this.aiProvider.chatStream(messages)) {
      if (!chunk.done) {
        const contentBlocks = this.contentParser.parse(chunk.choices[0].delta);
        if (contentBlocks) {
          blockAccumulators.add(contentBlocks);
        }
        // 处理增量更新
        aiMessage.content = blockAccumulators.getBlocks();
        onStream?.({ ...aiMessage });
      }
    }

    // 替换消息
    await this.sessionManager.update(sessionId, (session) => ({
      ...session,
      messages: [...messages, aiMessage],
    }));

    return { ...aiMessage };
  }

  // 删除消息
  async delete(sessionId: string, messageId: string): Promise<void> {
    await this.sessionManager.update(sessionId, (session) => ({
      ...session,
      messages: session.messages.filter((m) => m.id !== messageId),
    }));
  }
}
