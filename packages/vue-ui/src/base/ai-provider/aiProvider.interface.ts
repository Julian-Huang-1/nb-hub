export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
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
