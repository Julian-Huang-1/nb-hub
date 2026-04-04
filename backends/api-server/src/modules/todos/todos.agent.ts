/**
 * Todos Agent
 * 提供与待办事项相关的 AI 能力
 *
 * 功能：
 * - 智能解析用户输入，提取待办事项
 * - 提供待办事项管理建议
 * - 批量操作待办事项
 */

import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import {
  createAgent,
  getDefaultModel,
  toolRegistry,
  type AgentRuntimeContext,
  type AgentInstance,
} from "../agent/index.js";
import { todosService } from "./todos.service.js";
import type { TodoDto } from "@nb-hub/contracts";

/**
 * 待办事项相关的工具定义
 */
const listTodosTool: AgentTool = {
  name: "list_todos",
  label: "列出待办事项",
  description: "获取当前用户的所有待办事项列表",
  parameters: Type.Object({
    includeCompleted: Type.Optional(
      Type.Boolean({
        description: "是否包含已完成的待办事项",
        default: false,
      }),
    ),
  }),
  execute: async (
    _toolCallId,
    params,
    _signal,
    onUpdate,
  ): Promise<AgentToolResult<{ todos: TodoDto[]; count: number }>> => {
    // 注意：实际执行时需要 userId，这里通过 context 传递
    // 这个工具需要在 agent 创建时注入 userId
    onUpdate?.({
      content: [{ type: "text", text: "正在查询待办事项..." }],
      details: {},
    });

    // 返回占位数据，实际使用时需要通过 closure 注入 userId
    return {
      content: [{ type: "text", text: "待办事项列表已获取" }],
      details: { todos: [], count: 0 },
    };
  },
};

const createTodoTool: AgentTool = {
  name: "create_todo",
  label: "创建待办事项",
  description: "创建一个新的待办事项",
  parameters: Type.Object({
    title: Type.String({
      description: "待办事项标题",
      minLength: 1,
    }),
  }),
  execute: async (
    _toolCallId,
    params,
  ): Promise<AgentToolResult<{ id: number; title: string }>> => {
    // 实际使用时需要注入 userId
    return {
      content: [
        {
          type: "text",
          text: `待办事项 "${params.title}" 创建成功`,
        },
      ],
      details: { id: 0, title: params.title },
    };
  },
};

const updateTodoTool: AgentTool = {
  name: "update_todo",
  label: "更新待办事项",
  description: "更新待办事项的标题或完成状态",
  parameters: Type.Object({
    id: Type.Number({ description: "待办事项ID" }),
    title: Type.Optional(Type.String({ description: "新标题" })),
    completed: Type.Optional(Type.Boolean({ description: "完成状态" })),
  }),
  execute: async (
    _toolCallId,
    params,
  ): Promise<AgentToolResult<{ id: number; updated: boolean }>> => {
    return {
      content: [
        {
          type: "text",
          text: `待办事项 ${params.id} 更新成功`,
        },
      ],
      details: { id: params.id, updated: true },
    };
  },
};

const deleteTodoTool: AgentTool = {
  name: "delete_todo",
  label: "删除待办事项",
  description: "删除指定的待办事项",
  parameters: Type.Object({
    id: Type.Number({ description: "待办事项ID" }),
  }),
  execute: async (
    _toolCallId,
    params,
  ): Promise<AgentToolResult<{ id: number; deleted: boolean }>> => {
    return {
      content: [
        {
          type: "text",
          text: `待办事项 ${params.id} 已删除`,
        },
      ],
      details: { id: params.id, deleted: true },
    };
  },
};

const batchCompleteTool: AgentTool = {
  name: "batch_complete_todos",
  label: "批量完成待办事项",
  description: "批量将多个待办事项标记为完成",
  parameters: Type.Object({
    ids: Type.Array(Type.Number(), {
      description: "要完成的待办事项ID列表",
    }),
  }),
  execute: async (
    _toolCallId,
    params,
  ): Promise<AgentToolResult<{ completed: number[]; failed: number[] }>> => {
    return {
      content: [
        {
          type: "text",
          text: `已完成 ${params.ids.length} 个待办事项`,
        },
      ],
      details: { completed: params.ids, failed: [] },
    };
  },
};

/**
 * Todos Agent 工厂
 */
export const todosAgent = {
  name: "todos-agent",
  description: "智能待办事项管理助手",

  /**
   * 创建 Todos Agent 实例
   * @param userId - 当前用户ID
   * @param sessionId - 可选的会话ID（用于缓存）
   */
  async create(userId: string, sessionId?: string): Promise<AgentInstance> {
    // 创建运行时上下文
    const context: AgentRuntimeContext = {
      userId,
      requestId: `todos-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };

    // 获取默认模型
    const model = await getDefaultModel();

    // 创建带有 userId 闭包的工具
    const tools: AgentTool[] = [
      {
        ...listTodosTool,
        execute: async (toolCallId, params, signal, onUpdate) => {
          const todos = todosService.list(userId);
          const filtered = params.includeCompleted
            ? todos
            : todos.filter((t) => !t.completed);

          onUpdate?.({
            content: [
              {
                type: "text",
                text: `找到 ${filtered.length} 个待办事项`,
              },
            ],
            details: {},
          });

          const todoList = filtered
            .map((t) => `[${t.completed ? "x" : " "}] ${t.id}: ${t.title}`)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: todoList || "暂无待办事项",
              },
            ],
            details: { todos: filtered, count: filtered.length },
          };
        },
      },
      {
        ...createTodoTool,
        execute: async (toolCallId, params) => {
          const todo = todosService.create(userId, params.title);
          return {
            content: [
              {
                type: "text",
                text: `✓ 已创建: "${todo.title}" (ID: ${todo.id})`,
              },
            ],
            details: { id: todo.id, title: todo.title },
          };
        },
      },
      {
        ...updateTodoTool,
        execute: async (toolCallId, params) => {
          const todo = todosService.update(userId, params.id, {
            title: params.title,
            completed: params.completed,
          });
          return {
            content: [
              {
                type: "text",
                text: `✓ 已更新: "${todo.title}" (ID: ${todo.id}, 完成: ${todo.completed})`,
              },
            ],
            details: { id: todo.id, updated: true },
          };
        },
      },
      {
        ...deleteTodoTool,
        execute: async (toolCallId, params) => {
          todosService.remove(userId, params.id);
          return {
            content: [
              {
                type: "text",
                text: `✓ 已删除 ID: ${params.id}`,
              },
            ],
            details: { id: params.id, deleted: true },
          };
        },
      },
      {
        ...batchCompleteTool,
        execute: async (toolCallId, params) => {
          const completed: number[] = [];
          const failed: number[] = [];

          for (const id of params.ids) {
            try {
              todosService.update(userId, id, { completed: true });
              completed.push(id);
            } catch {
              failed.push(id);
            }
          }

          return {
            content: [
              {
                type: "text",
                text: `批量完成: ${completed.length} 成功${failed.length > 0 ? `, ${failed.length} 失败` : ""}`,
              },
            ],
            details: { completed, failed },
          };
        },
      },
    ];

    // 注册工具到全局注册表（可选）
    for (const tool of tools) {
      toolRegistry.register(tool);
    }

    // 创建 Agent 实例
    const agent = await createAgent(
      {
        systemPrompt: `你是一个智能待办事项管理助手。

你可以帮助用户：
1. 查看待办事项列表
2. 创建新的待办事项
3. 更新待办事项（修改标题或标记完成）
4. 删除待办事项
5. 批量完成多个待办事项

请使用提供的工具来操作数据。如果用户请求不明确，请主动询问以获取更多信息。

操作原则：
- 创建待办事项时，确保标题清晰明确
- 批量操作前，先确认列表内容
- 删除操作前，建议用户确认`,
        model,
        tools,
        thinkingLevel: "low",
        sessionId,
      },
      context,
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
    sessionId?: string,
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

// 导出类型
export type TodosAgent = typeof todosAgent;
