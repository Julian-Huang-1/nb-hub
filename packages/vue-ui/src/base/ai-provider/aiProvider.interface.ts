// 定义各种内容类型
export type ContentBlock =
  | TextContent
  | ThinkingContent
  | ToolUseContent
  | ImageContent
  | FileContent;

export interface TextContent {
  type: "text";
  text: string;
}

export interface ThinkingContent {
  type: "thinking";
  reasoning: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  arguments: string;
}

export interface ImageContent {
  type: "image_url";
  imageUrl: {
    url: string;
  };
}

export interface FileContent {
  type: "file";
  file: {
    filename: string;
    file_data: string;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  // 保留string 兼容旧逻辑
  content: ContentBlock[];
  timestamp: number;
}

// AI 返回的原始数据结构
export interface AIResponseChunk {
  role?: "assistant";
  reasoning?: string; // ThinkingContent 标识
  images?: any[]; // ImageContent 标识
  content?: string; // 文本内容
  tool_calls?: Array<{
    // ToolUseContent 标识
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  done?: boolean;
}

export interface StreamChunk {
  done: boolean;
  choices: any[];
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}
export interface IAiProvider {
  // 流式聊天
  chatStream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterableIterator<StreamChunk>;

  // 非流式聊天
  chat(messages: Message[], options?: ChatOptions): Promise<Message[]>;
}
