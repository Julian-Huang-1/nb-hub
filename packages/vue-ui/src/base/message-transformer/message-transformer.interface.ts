// message-transformer/transform-strategy.interface.ts

import type { ContentBlock } from "../ai-provider/aiProvider.interface";

/**
 * OpenAI API 内容格式
 * @see https://platform.openai.com/docs/api-reference/chat/create
 */
export type APIContentPart = APITextContent | APIImageContent | APIFileContent;

/**
 * 文本内容部分
 */
export interface APITextContent {
  type: "text";
  text: string;
}

/**
 * 图片内容部分
 */
export interface APIImageContent {
  type: "image_url";
  imageUrl: {
    url: string;
  };
}

/**
 * 文件内容部分
 */
export interface APIFileContent {
  type: "file";
  file: {
    filename: string;
    file_data: string;
  };
}
/**
 * OpenAI 消息格式
 */
export interface APIMessage {
  role: "system" | "user" | "assistant" | "tool";

  // content 可以是字符串或内容部分数组
  content: null | APIContentPart[];

  // 可选：助手的名称
  name?: string;

  // 可选：工具调用（仅 assistant 角色）
  tool_calls?: APIToolCall[];

  // 可选：工具调用 ID（仅 tool 角色）
  tool_call_id?: string;
}

/**
 * 工具调用格式
 */
export interface APIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON 字符串
  };
}

/**
 * 内容块转换策略接口
 */
export interface ITransformStrategy {
  /**
   * 获取策略支持的内容块类型
   */
  getSupportedType(): string;

  /**
   * 转换为纯文本（简单模式）
   */
  transform(block: ContentBlock): APIContentPart;
}
