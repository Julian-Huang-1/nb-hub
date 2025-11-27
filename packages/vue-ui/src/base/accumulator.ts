import type {
  ContentBlock,
  ImageContent,
  TextContent,
  ThinkingContent,
  ToolUseContent,
} from "./ai-provider/aiProvider.interface";

/**
 * 内容块累积器 - 负责合并和管理流式内容块
 */
export class ContentBlockAccumulator {
  private blocks: ContentBlock[] = [];
  private prevBlock: ContentBlock | null = null;

  /**
   * 添加新的内容块（增量更新）
   */
  add(block: ContentBlock): void {
    switch (block.type) {
      case "text":
        this.addTextBlock(block);
        break;
      case "thinking":
        this.addThinkingBlock(block);
        break;
      case "tool_use":
        this.addToolUseBlock(block);
        break;
      case "image":
        this.addImageBlock(block);
        break;
    }
  }

  /**
   * 获取内容块数组
   */
  getBlocks(): ContentBlock[] {
    return this.blocks;
  }

  private addTextBlock(block: TextContent): void {
    if (this.prevBlock && this.prevBlock.type === "text") {
      this.prevBlock.text += block.text;
    } else {
      // 保持对象引用
      this.blocks.push(block);
      this.prevBlock = block;
    }
  }

  private addThinkingBlock(block: ThinkingContent): void {
    if (this.prevBlock && this.prevBlock.type === "thinking") {
      this.prevBlock.reasoning += block.reasoning;
    } else {
      // 保持对象引用
      this.blocks.push(block);
      this.prevBlock = block;
    }
  }

  private addToolUseBlock(block: ToolUseContent): void {
    // 工具块不需要增量更新
    this.blocks.push(block);
    this.prevBlock = block;
  }

  private addImageBlock(block: ImageContent): void {
    // 图片块不需要增量更新
    this.blocks.push(block);
    this.prevBlock = block;
  }
}
