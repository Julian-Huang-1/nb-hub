import type {
  AIResponseChunk,
  ContentBlock,
} from "../ai-provider/aiProvider.interface";
import {
  ImageParser,
  TextParser,
  ThinkingParser,
  ToolUseParser,
  type IContentBlockParser,
} from "./default-parser";

export class ContentBlockParser {
  private parsers: IContentBlockParser[];

  constructor() {
    // 注意顺序：优先级从高到低
    // 先检查特殊类型，最后检查文本
    this.parsers = [
      new ThinkingParser(),
      new ImageParser(),
      new ToolUseParser(),
      new TextParser(),
    ];
  }

  // 解析 AI 响应块为内容块数组
  parse(chunk: AIResponseChunk): ContentBlock[] | undefined {
    for (const parser of this.parsers) {
      if (parser.canParse(chunk)) {
        const blocks = parser.parse(chunk);
        if (blocks.length > 0) {
          return blocks;
        }
      }
    }
  }

  // 添加自定义解析器（用于动态扩展）
  addParser(
    parser: IContentBlockParser,
    priority: "high" | "low" = "low"
  ): void {
    if (priority === "high") {
      this.parsers.unshift(parser);
    } else {
      this.parsers.push(parser);
    }
  }
}
