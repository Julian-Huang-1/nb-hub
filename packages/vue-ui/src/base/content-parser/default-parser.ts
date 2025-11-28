import type {
  AIResponseChunk,
  ContentBlock,
} from "../ai-provider/aiProvider.interface";

export interface IContentBlockParser {
  canParse(chunk: AIResponseChunk): boolean;
  parse(chunk: AIResponseChunk): ContentBlock[];
}
/**
 * 思考内容解析器
 */
export class ThinkingParser implements IContentBlockParser {
  canParse(chunk: AIResponseChunk): boolean {
    return chunk.reasoning !== undefined && chunk.reasoning !== null;
  }

  parse(chunk: AIResponseChunk): ContentBlock[] {
    return [
      {
        type: "thinking",
        reasoning: chunk.reasoning!,
      },
    ];
  }
}

/**
 * 图片内容解析器
 */
export class ImageParser implements IContentBlockParser {
  canParse(chunk: AIResponseChunk): boolean {
    return (
      chunk.images !== undefined &&
      chunk.images !== null &&
      chunk.images.length > 0
    );
  }

  parse(chunk: AIResponseChunk): ContentBlock[] {
    const blocks: ContentBlock[] = [];

    if (chunk.content) {
      blocks.push({
        type: "text",
        text: chunk.content,
      });
    }

    // 添加图片块
    if (chunk.images && chunk.images.length > 0) {
      blocks.push(...chunk.images);
    }

    return blocks;
  }
}

/**
 * 工具调用解析器
 */
export class ToolUseParser implements IContentBlockParser {
  canParse(chunk: AIResponseChunk): boolean {
    return (
      chunk.tool_calls !== undefined &&
      chunk.tool_calls !== null &&
      chunk.tool_calls.length > 0
    );
  }

  parse(chunk: AIResponseChunk): ContentBlock[] {
    if (!chunk.tool_calls) return [];

    return chunk.tool_calls.map((tool) => ({
      type: "tool_use",
      id: tool.id,
      name: tool.function.name,
      arguments: tool.function.arguments,
    }));
  }
}

/**
 * 文本内容解析器（默认处理器）
 */
export class TextParser implements IContentBlockParser {
  canParse(chunk: AIResponseChunk): boolean {
    // 文本是默认类型，只要有 text 字段就处理
    return chunk.content !== undefined && chunk.content !== null;
  }

  parse(chunk: AIResponseChunk): ContentBlock[] {
    // 如果已经被 ImageParser 处理过（有 images），不要重复处理 text
    if (chunk.images && chunk.images.length > 0) {
      return [];
    }

    return [
      {
        type: "text",
        text: chunk.content!,
      },
    ];
  }
}
