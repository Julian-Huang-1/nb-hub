import type {
  Message,
  ContentBlock,
} from "../ai-provider/aiProvider.interface";
import type {
  ITransformStrategy,
  APIMessage,
} from "./message-transformer.interface";
import {
  TextTransformStrategy,
  ThinkingTransformStrategy,
  ToolUseTransformStrategy,
  ImageTransformStrategy,
} from "./transformer-strategies";

/**
 * 转换配置
 */
export interface TransformOptions {
  // 是否保留结构化内容（使用 content array）
  preserveStructure?: boolean;
  // 是否包含思考内容
  includeThinking?: boolean;
  // 思考内容的前缀
  thinkingPrefix?: string;
}

/**
 * 消息转换器 (Strategy Registry Pattern)
 */
export class MessageTransformer {
  private strategies: Map<string, ITransformStrategy> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * 注册默认的转换策略
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy(new TextTransformStrategy());
    this.registerStrategy(new ThinkingTransformStrategy());
    this.registerStrategy(new ToolUseTransformStrategy());
    this.registerStrategy(new ImageTransformStrategy());
  }

  /**
   * 注册新的转换策略（对扩展开放）
   */
  registerStrategy(strategy: ITransformStrategy): void {
    this.strategies.set(strategy.getSupportedType(), strategy);
  }

  /**
   * 转换消息数组为 OpenAI API 格式
   */
  transform(messages: Message[], options?: TransformOptions): APIMessage[] {
    return messages.map((message) => this.transformSingleMessage(message));
  }

  /**
   * 转换单个消息
   */
  private transformSingleMessage(message: Message): APIMessage {
    const apiMessage: APIMessage = {
      role: message.role,
      content: null,
    };

    // 简单模式：转换为纯文本字符串
    apiMessage.content = this.transformToPlainText(message.content);

    return apiMessage;
  }

  /**
   * 转换为纯文本格式
   */
  private transformToPlainText(blocks: ContentBlock[]): string {
    const textParts: string[] = [];

    for (const block of blocks) {
      const strategy = this.strategies.get(block.type);

      if (!strategy) {
        console.warn(
          `No transform strategy found for block type: ${block.type}`
        );
        continue;
      }

      const text = strategy.toPlainText(block);
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join("\n");
  }
}

/**
 * 便捷函数：转换消息为 OpenAI API 格式
 */
export function transformMessages(messages: Message[]): APIMessage[] {
  const transformer = new MessageTransformer();
  return transformer.transform(messages);
}
