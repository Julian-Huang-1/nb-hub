// message-transformer/transform-strategies.ts

import type {
  ContentBlock,
  TextContent,
  ThinkingContent,
  ToolUseContent,
  ImageContent,
} from "../ai-provider/aiProvider.interface";
import type {
  ITransformStrategy,
  TransformContext,
  TransformResult,
  APIContentPart,
  APITextContent,
  APIImageContent,
} from "./message-transformer.interface";

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

  toStructuredContent(block: ContentBlock): TransformResult {
    const textBlock = block as TextContent;

    const textContent: APITextContent = {
      type: "text",
      text: textBlock.text,
    };

    return {
      text: textBlock.text,
      contentParts: [textContent],
    };
  }
}

/**
 * 思考块转换策略
 */
export class ThinkingTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "thinking";
  }

  toPlainText(block: ContentBlock, context: TransformContext): string {
    if (!context.includeThinking) {
      return "";
    }

    const thinkingBlock = block as ThinkingContent;
    return `${context.thinkingPrefix}${thinkingBlock.reasoning}`;
  }

  toStructuredContent(
    block: ContentBlock,
    context: TransformContext
  ): TransformResult {
    if (!context.includeThinking) {
      return { text: "", contentParts: [] };
    }

    const thinkingBlock = block as ThinkingContent;
    const text = `${context.thinkingPrefix}${thinkingBlock.reasoning}`;

    const textContent: APITextContent = {
      type: "text",
      text,
    };

    return {
      text,
      contentParts: [textContent],
    };
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

  toStructuredContent(block: ContentBlock): TransformResult {
    const toolBlock = block as ToolUseContent;

    return {
      text: "",
      contentParts: [],
      toolCalls: [
        {
          id: toolBlock.id,
          type: "function",
          function: {
            name: toolBlock.name,
            arguments: toolBlock.arguments, // 应该是 JSON 字符串
          },
        },
      ],
    };
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

  toStructuredContent(
    block: ContentBlock,
    context: TransformContext
  ): TransformResult {
    const imageBlock = block as ImageContent;
    const contentParts: APIContentPart[] = [];

    // 转换所有图片为 OpenAI 格式
    for (const image of imageBlock.images) {
      let url: string;

      if (image.url) {
        url = image.url;
      } else if (image.base64) {
        // OpenAI 支持 data URL 格式
        const mediaType = image.media_type || "image/jpeg";
        url = `data:${mediaType};base64,${image.base64}`;
      } else {
        continue; // 跳过无效图片
      }

      const imageContent: APIImageContent = {
        type: "image_url",
        image_url: {
          url,
        },
      };

      contentParts.push(imageContent);
    }

    // 如果有文字说明，添加为文本内容
    if (imageBlock.text) {
      const textContent: APITextContent = {
        type: "text",
        text: imageBlock.text,
      };
      contentParts.push(textContent);
    }

    return {
      text: imageBlock.text || "",
      contentParts,
    };
  }
}
