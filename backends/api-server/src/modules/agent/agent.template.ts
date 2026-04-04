/**
 * Agent 模板文件
 * 复制此文件到业务模块目录下，重命名为 [module].agent.ts
 * 然后按照 TODO 注释进行修改
 */

import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import {
  createAgent,
  getDefaultModel,
  toolRegistry,
  commonTools, // 可选：导入通用工具
  type AgentRuntimeContext,
  type AgentInstance,
} from "../agent/index.js";

// TODO: 导入你的 service
// import { myService } from "./my.service.js";

// TODO: 定义你的工具
const exampleTool: AgentTool = {
  name: "example_operation",
  label: "示例操作",
  description: "这是一个示例工具，请根据业务需求修改",
  parameters: Type.Object({
    input: Type.String({
      description: "输入参数",
      minLength: 1,
    }),
    option: Type.Optional(
      Type.Boolean({
        description: "可选参数",
        default: false,
      })
    ),
  }),
  execute: async (
    _toolCallId,
    params,
    _signal,
    onUpdate
  ): Promise<AgentToolResult<{ input: string; processed: boolean }>> => {
    // 可选：发送进度更新
    onUpdate?.({
      content: [{ type: "text", text: "正在处理..." }],
      details: {},
    });

    // TODO: 实现工具逻辑
    const result = {
      input: params.input,
      processed: params.option,
    };

    return {
      content: [{ type: "text", text: `处理完成: ${params.input}` }],
      details: result,
    };
  },
};

// TODO: 定义更多工具...

/**
 * [Module] Agent 工厂
 * TODO: 修改名称和描述
 */
export const myAgent = {
  name: "my-agent", // TODO: 修改为你的 agent 名称
  description: "我的智能助手", // TODO: 修改为你的 agent 描述

  /**
   * 创建 Agent 实例
   * @param userId - 当前用户ID
   * @param sessionId - 可选的会话ID（用于缓存）
   */
  async create(
    userId: string,
    sessionId?: string
  ): Promise<AgentInstance> {
    // 创建运行时上下文
    const context: AgentRuntimeContext = {
      userId,
      requestId: `my-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };

    // 获取默认模型
    const model = await getDefaultModel();

    // TODO: 定义工具列表
    // 如果需要注入 userId，可以包装工具
    const tools: AgentTool[] = [
      {
        ...exampleTool,
        execute: async (toolCallId, params, signal, onUpdate) => {
          // TODO: 在这里调用你的 service，注入 userId
          // const result = await myService.doSomething(userId, params.input);

          return {
            content: [{ type: "text", text: `User ${userId}: ${params.input}` }],
            details: { userId, input: params.input },
          };
        },
      },
      // 可以使用通用工具
      // ...commonTools,
    ];

    // 可选：注册工具到全局注册表
    for (const tool of tools) {
      toolRegistry.register(tool);
    }

    // TODO: 修改系统提示词
    const systemPrompt = `你是一个智能助手。

你可以帮助用户：
1. 执行示例操作
2. 其他功能...

请使用提供的工具来操作数据。`;

    // TODO: 配置 API Key（三种方式选一种）
    // 方式1: 从环境变量读取（默认）
    // const apiKey = undefined;

    // 方式2: 使用静态 API key
    // const apiKey = { type: "static" as const, key: process.env.MY_API_KEY || "" };

    // 方式3: 动态获取（如 OAuth）
    // const apiKey = {
    //   type: "dynamic" as const,
    //   getter: async () => await refreshToken(userId),
    // };

    // 创建 Agent 实例
    const agent = await createAgent(
      {
        systemPrompt,
        model,
        tools,
        thinkingLevel: "medium", // TODO: 调整思考级别
        sessionId,
        // apiKey, // TODO: 取消注释以启用自定义 API key
      },
      context
    );

    return agent;
  },

  /**
   * 快速执行单次提示词
   * 用于简单的单次交互场景
   */
  async quickAsk(
    userId: string,
    prompt: string,
    sessionId?: string
  ): Promise<string> {
    const agent = await this.create(userId, sessionId);
    const result = await agent.prompt(prompt);

    if (!result.success) {
      throw new Error(result.error || "Agent execution failed");
    }

    // 提取文本内容
    const message = result.message;
    if (message.role === "assistant" && typeof message.content === "string") {
      return message.content;
    }

    return "处理完成";
  },
};

// TODO: 导出类型
export type MyAgent = typeof myAgent;
