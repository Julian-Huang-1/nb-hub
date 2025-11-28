// message-transformer/transform-strategies.ts

import type {
  ContentBlock,
  TextContent,
  ToolUseContent,
  ImageContent,
} from "../ai-provider/aiProvider.interface";
import type { ITransformStrategy } from "./message-transformer.interface";

/**
 * 文本块转换策略
 */
export class TextTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "text";
  }

  toPlainText(block: ContentBlock): string {
    const textBlock = block as TextContent;
    return textBlock.text;
  }
}

/**
 * 思考块转换策略
 */
export class ThinkingTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "thinking";
  }

  toPlainText(block: ContentBlock): string {
    return "";
  }
}

/**
 * 工具调用块转换策略
 */
export class ToolUseTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "tool_use";
  }

  toPlainText(block: ContentBlock): string {
    const toolBlock = block as ToolUseContent;
    return `[Tool: ${toolBlock.name}]`;
  }
}

/**
 * 图片块转换策略
 */
export class ImageTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "image";
  }

  toPlainText(block: ContentBlock): string {
    const imageBlock = block as ImageContent;
    return imageBlock.text || "[Image]";
  }
}
