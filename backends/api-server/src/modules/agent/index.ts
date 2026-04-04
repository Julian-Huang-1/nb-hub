/**
 * Agent 模块
 * 提供通用的 Agent 能力和基础设施
 * 
 * 使用方式：
 * 1. 在业务模块中创建 xxx.agent.ts 文件
 * 2. 使用 createAgent 或 createStreamingAgent 创建实例
 * 3. 定义模块特定的工具和系统提示词
 * 
 * 示例见 todos/todos.agent.ts
 */

// 核心功能
export {
  createAgent,
  createStreamingAgent,
  getDefaultModel,
  toolRegistry,
} from "./agent.module.js";

// 工具
export {
  commonTools,
  currentTimeTool,
  calculatorTool,
  stringTool,
  jsonTool,
} from "./agent.tools.js";

// 类型
export type {
  CreateAgentOptions,
  AgentRuntimeContext,
  AgentExecutionResult,
  AgentInstance,
  ToolRegistry,
  AgentEventHandler,
  ModuleAgent,
  AgentStreamChunk,
  ApiKeyConfig,
} from "./agent.types.js";

// 重新导出 pi-agent-core 的核心类型（方便使用）
export type {
  AgentMessage,
  AgentState,
  AgentTool,
  AgentEvent,
  AgentToolResult,
} from "@mariozechner/pi-agent-core";

// 初始化：注册通用工具
import { toolRegistry } from "./agent.module.js";
import { commonTools } from "./agent.tools.js";

// 自动注册通用工具
toolRegistry.registerMany(commonTools);
console.log(`[Agent Module] 已注册 ${commonTools.length} 个通用工具`);
