/**
 * 消息类型
 */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * 聊天状态
 */
export type ChatStatus = "idle" | "loading" | "error" | "streaming";

/**
 * 插件配置
 */
export interface PluginConfig {
  [key: string]: any;
}

/**
 * 发送消息的选项
 */
export interface SendMessageOptions {
  content: string;
  metadata?: Record<string, any>;
}

/**
 * 插件上下文 - 提供给插件的运行时环境
 */
export interface PluginContext {
  messages: Message[];
  status: ChatStatus;
  setStatus: (status: ChatStatus) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
}

/**
 * ChatBox 插件接口
 */
export interface ChatBoxPlugin {
  /**
   * 插件名称
   */
  name: string;

  /**
   * 插件版本
   */
  version?: string;

  /**
   * 插件初始化
   * @param config 插件配置
   */
  init?(config?: PluginConfig): void | Promise<void>;

  /**
   * 发送消息到 AI
   * @param options 发送选项
   * @param context 插件上下文
   */
  sendMessage(
    options: SendMessageOptions,
    context: PluginContext
  ): Promise<void>;

  /**
   * 插件销毁
   */
  destroy?(): void | Promise<void>;

  /**
   * 中断当前请求
   */
  abort?(): void;
}

/**
 * ChatBox 事件类型
 */
export interface ChatBoxEvents {
  "message-sent": (message: Message) => void;
  "message-received": (message: Message) => void;
  error: (error: Error) => void;
  "status-change": (status: ChatStatus) => void;
}
