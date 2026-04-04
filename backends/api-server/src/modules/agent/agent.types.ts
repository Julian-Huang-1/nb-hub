/**
 * Agent 模块类型定义
 * 提供通用的 Agent 类型和接口，供其他模块扩展
 */

import type {
  AgentMessage,
  AgentState,
  AgentTool,
  AgentEvent,
} from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";

/**
 * API Key 配置方式
 */
export type ApiKeyConfig =
  | { type: "env" }                    // 从环境变量读取（默认）
  | { type: "static"; key: string }    // 使用固定 API key
  | { type: "dynamic"; getter: () => Promise<string | undefined> | string | undefined }; // 动态获取

/**
 * Agent 配置选项
 */
export interface CreateAgentOptions {
  /** 系统提示词 */
  systemPrompt: string;
  /** 使用的模型 */
  model: Model<any>;
  /** 思考级别 */
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  /** 可用工具列表 */
  tools?: AgentTool<any>[];
  /** 初始消息 */
  initialMessages?: AgentMessage[];
  /** 会话ID（用于缓存） */
  sessionId?: string;
  /** API Key 配置 */
  apiKey?: ApiKeyConfig;
}

/**
 * Agent 运行时上下文
 * 包含执行过程中需要共享的数据
 */
export interface AgentRuntimeContext {
  /** 当前用户ID */
  userId: string;
  /** 请求ID（用于追踪） */
  requestId: string;
  /** 其他自定义数据 */
  [key: string]: unknown;
}

/**
 * Agent 执行结果
 */
export interface AgentExecutionResult {
  /** 完整的响应消息 */
  message: AgentMessage;
  /** 执行过程中产生的所有消息（包括工具调用结果） */
  allMessages: AgentMessage[];
  /** 是否成功完成 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * Agent 事件处理器
 */
export type AgentEventHandler = (event: AgentEvent, context: AgentRuntimeContext) => void | Promise<void>;

/**
 * 模块级 Agent 定义接口
 * 各模块在 xxx.agent.ts 中实现此接口
 */
export interface ModuleAgent {
  /** Agent 名称 */
  name: string;
  /** Agent 描述 */
  description: string;
  /** 创建 Agent 实例的工厂方法 */
  create: (context: AgentRuntimeContext) => Promise<AgentInstance>;
}

/**
 * Agent 实例接口
 */
export interface AgentInstance {
  /** 获取当前状态 */
  getState: () => AgentState;
  /** 发送提示词并执行 */
  prompt: (content: string, attachments?: Array<{ type: "image"; data: string; mimeType: string }>) => Promise<AgentExecutionResult>;
  /** 从当前状态继续执行 */
  continue: () => Promise<AgentExecutionResult>;
  /** 订阅事件 */
  subscribe: (handler: AgentEventHandler) => () => void;
  /** 中止执行 */
  abort: () => void;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 工具注册表
 * 用于跨模块共享工具
 */
export interface ToolRegistry {
  /** 注册工具 */
  register: (tool: AgentTool<any>) => void;
  /** 获取工具 */
  get: (name: string) => AgentTool<any> | undefined;
  /** 获取所有工具 */
  getAll: () => AgentTool<any>[];
  /** 批量注册工具 */
  registerMany: (tools: AgentTool<any>[]) => void;
}

/**
 * Agent 流式响应块
 */
export interface AgentStreamChunk {
  /** 块类型 */
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  /** 块数据 */
  data: unknown;
  /** 时间戳 */
  timestamp: number;
}
