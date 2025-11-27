// message-transformer/message-transformer.ts

import type {
  Message,
  ContentBlock,
} from "../ai-provider/aiProvider.interface";
import type {
  ITransformStrategy,
  TransformContext,
  APIMessage,
  APIContentPart,
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
  // 图片详细级别（OpenAI 特有）
  imageDetail?: "auto" | "low" | "high";
}

/**
 * 消息转换器 (Strategy Registry Pattern)
 */
export class MessageTransformer {
  private strategies: Map<string, ITransformStrategy> = new Map();
  private defaultOptions: Required<TransformOptions> = {
    preserveStructure: false,
    includeThinking: false,
    thinkingPrefix: "[Thinking] ",
    imageDetail: "auto",
  };

  constructor(options?: TransformOptions) {
    if (options) {
      this.defaultOptions = { ...this.defaultOptions, ...options };
    }
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
    const finalOptions = { ...this.defaultOptions, ...options };

    return messages.map((message) =>
      this.transformSingleMessage(message, finalOptions)
    );
  }

  /**
   * 转换单个消息
   */
  private transformSingleMessage(
    message: Message,
    options: Required<TransformOptions>
  ): APIMessage {
    const apiMessage: APIMessage = {
      role: message.role,
      content: null,
    };

    // 向后兼容：处理字符串内容
    if (typeof message.content === "string") {
      apiMessage.content = message.content;
      return apiMessage;
    }

    // 处理 ContentBlock[] 数组
    const context: TransformContext = {
      includeThinking: options.includeThinking,
      thinkingPrefix: options.thinkingPrefix,
      preserveStructure: options.preserveStructure,
      imageDetail: options.imageDetail,
    };

    if (options.preserveStructure) {
      // 高级模式：保留结构化内容（使用 content array）
      const result = this.transformToStructured(message.content, context);
      apiMessage.content = result.content;
      if (result.toolCalls && result.toolCalls.length > 0) {
        apiMessage.tool_calls = result.toolCalls;
      }
    } else {
      // 简单模式：转换为纯文本字符串
      apiMessage.content = this.transformToPlainText(message.content, context);
    }

    return apiMessage;
  }

  /**
   * 转换为纯文本格式
   */
  private transformToPlainText(
    blocks: ContentBlock[],
    context: TransformContext
  ): string {
    const textParts: string[] = [];

    for (const block of blocks) {
      const strategy = this.strategies.get(block.type);

      if (!strategy) {
        console.warn(
          `No transform strategy found for block type: ${block.type}`
        );
        continue;
      }

      const text = strategy.toPlainText(block, context);
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join("\n");
  }

  /**
   * 转换为结构化格式（OpenAI content array）
   */
  private transformToStructured(
    blocks: ContentBlock[],
    context: TransformContext
  ): {
    content: string | APIContentPart[] | null;
    toolCalls?: APIMessage["tool_calls"];
  } {
    const allContentParts: APIContentPart[] = [];
    const allToolCalls: APIMessage["tool_calls"] = [];

    for (const block of blocks) {
      const strategy = this.strategies.get(block.type);

      if (!strategy) {
        console.warn(
          `No transform strategy found for block type: ${block.type}`
        );
        continue;
      }

      const result = strategy.toStructuredContent(block, context);

      // 收集内容部分
      if (result.contentParts) {
        allContentParts.push(...result.contentParts);
      }

      // 收集工具调用
      if (result.toolCalls) {
        allToolCalls.push(...result.toolCalls);
      }
    }

    // 优化：合并连续的文本块
    const optimizedParts = this.mergeConsecutiveTextParts(allContentParts);

    // OpenAI 格式优化：
    // 1. 如果只有一个文本块，简化为字符串
    if (optimizedParts.length === 1 && optimizedParts[0].type === "text") {
      return {
        content: optimizedParts[0].text,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      };
    }

    // 2. 如果没有内容但有工具调用，content 设为 null（OpenAI 标准）
    if (optimizedParts.length === 0 && allToolCalls.length > 0) {
      return {
        content: null,
        toolCalls: allToolCalls,
      };
    }

    // 3. 如果没有任何内容，返回空字符串
    if (optimizedParts.length === 0) {
      return {
        content: "",
        toolCalls: undefined,
      };
    }

    // 4. 返回结构化内容数组
    return {
      content: optimizedParts,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    };
  }

  /**
   * 合并连续的文本内容部分
   */
  private mergeConsecutiveTextParts(parts: APIContentPart[]): APIContentPart[] {
    if (parts.length === 0) return [];

    const merged: APIContentPart[] = [];
    let currentText = "";

    for (const part of parts) {
      if (part.type === "text") {
        currentText += part.text;
      } else {
        // 遇到非文本部分，先保存累积的文本
        if (currentText) {
          merged.push({ type: "text", text: currentText });
          currentText = "";
        }
        merged.push(part);
      }
    }

    // 保存最后的文本
    if (currentText) {
      merged.push({ type: "text", text: currentText });
    }

    return merged;
  }
}

/**
 * 便捷函数：转换消息为 OpenAI API 格式
 */
export function transformMessages(
  messages: Message[],
  options?: TransformOptions
): APIMessage[] {
  const transformer = new MessageTransformer(options);
  return transformer.transform(messages);
}
