# Agent 模块

基于 `@mariozechner/pi-agent-core` 封装的通用 Agent 基础设施，支持各业务模块创建自定义 Agent。

## 架构

```
src/modules/
├── agent/                    # 通用 Agent 模块
│   ├── index.ts             # 模块导出
│   ├── agent.types.ts       # 类型定义
│   ├── agent.module.ts      # 核心封装（createAgent, toolRegistry）
│   └── agent.tools.ts       # 通用工具
│
├── todos/                    # 示例：业务模块
│   ├── todos.agent.ts       # 模块特定的 Agent 定义
│   ├── todos.agent.routes.ts # Agent API 路由
│   ├── todos.service.ts
│   └── todos.routes.ts
│
└── [other-module]/
    └── [module].agent.ts    # 其他模块的 Agent 定义
```

## API Key 配置

支持三种配置方式（详见 [API_KEY_CONFIG.md](./API_KEY_CONFIG.md)）：

### 1. 环境变量（默认）
```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
# 或
export OPENAI_API_KEY="sk-xxxxx"
```

### 2. 静态配置
```typescript
const agent = await createAgent({
  systemPrompt: "...",
  model,
  apiKey: {
    type: "static",
    key: "sk-xxxxx",
  },
}, context);
```

### 3. 动态获取（OAuth 等）
```typescript
const agent = await createAgent({
  systemPrompt: "...",
  model,
  apiKey: {
    type: "dynamic",
    getter: async () => await refreshToken(userId),
  },
}, context);
```

## 快速开始

### 1. 创建模块 Agent

在业务模块目录下创建 `[module].agent.ts`：

```typescript
import {
  createAgent,
  getDefaultModel,
  toolRegistry,
  type AgentRuntimeContext,
  type AgentInstance,
} from "../agent/index.js";
import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { myService } from "./my.service.js";

// 定义工具
const myTool: AgentTool = {
  name: "my_operation",
  label: "我的操作",
  description: "执行某个操作",
  parameters: Type.Object({
    input: Type.String({ description: "输入参数" }),
  }),
  execute: async (_toolCallId, params): Promise<AgentToolResult<any>> => {
    const result = await myService.doSomething(params.input);
    return {
      content: [{ type: "text", text: result }],
      details: { result },
    };
  },
};

// Agent 工厂
export const myAgent = {
  name: "my-agent",
  description: "我的智能助手",

  async create(userId: string, sessionId?: string): Promise<AgentInstance> {
    const context: AgentRuntimeContext = {
      userId,
      requestId: `my-${Date.now()}`,
    };

    const model = await getDefaultModel();

    // 可以包装工具以注入 userId
    const tools = [
      {
        ...myTool,
        execute: async (toolCallId, params, signal, onUpdate) => {
          // 注入 userId，执行业务逻辑
          const result = await myService.doSomethingForUser(userId, params.input);
          return {
            content: [{ type: "text", text: result }],
            details: { result },
          };
        },
      },
    ];

    return createAgent(
      {
        systemPrompt: "你是...",
        model,
        tools,
        thinkingLevel: "medium",
        sessionId,
      },
      context
    );
  },

  // 快速问答方法
  async quickAsk(userId: string, prompt: string): Promise<string> {
    const agent = await this.create(userId);
    const result = await agent.prompt(prompt);
    if (!result.success) throw new Error(result.error);
    
    const message = result.message;
    if (message.role === "assistant" && typeof message.content === "string") {
      return message.content;
    }
    return "处理完成";
  },
};
```

### 2. 创建 API 路由

创建 `[module].agent.routes.ts`：

```typescript
import { Router } from "express";
import { myAgent } from "./my.agent.js";

const router = Router();

// 非流式接口
router.post("/agent/chat", async (req, res) => {
  const { prompt, sessionId } = req.body;
  const userId = req.user?.id;
  
  const agent = await myAgent.create(userId, sessionId);
  const result = await agent.prompt(prompt);
  
  res.json({
    status: "ok",
    data: {
      response: result.message.content,
      messages: result.allMessages,
    },
  });
});

// 流式接口 (SSE)
router.post("/agent/chat/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  
  const { createStreamingAgent, getDefaultModel } = await import("../agent/index.js");
  const model = await getDefaultModel();
  
  const agent = await createStreamingAgent(
    { systemPrompt: "...", model },
    { userId, requestId: "..." },
    async (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "agent_end") res.end();
    }
  );
  
  await agent.prompt(req.body.prompt);
});

export { router as myAgentRouter };
```

### 3. 注册路由

在 `index.ts` 中注册：

```typescript
import { myAgentRouter } from "./modules/my/my.agent.routes.js";
app.use("/my", requireSession, myAgentRouter);
```

## 配置环境变量

```bash
# AI 提供商配置
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-20250514
# 或
AI_PROVIDER=openai
AI_MODEL=gpt-4o
```

## 工具定义

使用 `@sinclair/typebox` 定义参数：

```typescript
import { Type } from "@sinclair/typebox";

const tool: AgentTool = {
  name: "tool_name",
  label: "工具显示名",
  description: "工具描述",
  parameters: Type.Object({
    param1: Type.String({ description: "参数说明" }),
    param2: Type.Optional(Type.Number({ default: 10 })),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    // onUpdate 用于流式更新进度
    onUpdate?.({ content: [{ type: "text", text: "处理中..." }], details: {} });
    
    // 返回最终结果
    return {
      content: [{ type: "text", text: "完成" }],
      details: { /* 结构化数据 */ },
    };
  },
};
```

## 通用工具

Agent 模块提供了一些通用工具：

- `currentTimeTool` - 获取当前时间
- `calculatorTool` - 数学计算
- `stringTool` - 字符串操作
- `jsonTool` - JSON 处理

```typescript
import { commonTools, toolRegistry } from "../agent/index.js";

// 注册到全局
toolRegistry.registerMany(commonTools);

// 或在创建 agent 时使用
const agent = await createAgent({
  tools: [...commonTools, myCustomTool],
  // ...
});
```

## 事件处理

订阅 Agent 事件用于日志、监控或调试：

```typescript
const unsubscribe = agent.subscribe((event, context) => {
  console.log(`[${context.requestId}] ${event.type}`);
  
  if (event.type === "tool_execution_start") {
    console.log(`  Tool: ${event.toolName}`);
  }
  
  if (event.type === "message_update") {
    // 流式文本更新
    console.log(event.assistantMessageEvent.delta);
  }
});

// 取消订阅
unsubscribe();
```

## 类型参考

### CreateAgentOptions

```typescript
interface CreateAgentOptions {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  tools?: AgentTool<any>[];
  initialMessages?: AgentMessage[];
  sessionId?: string;
}
```

### AgentInstance

```typescript
interface AgentInstance {
  getState: () => AgentState;
  prompt: (content: string, attachments?) => Promise<AgentExecutionResult>;
  continue: () => Promise<AgentExecutionResult>;
  subscribe: (handler: AgentEventHandler) => () => void;
  abort: () => void;
  reset: () => void;
}
```

## 更多示例

参考 `src/modules/todos/todos.agent.ts` 完整实现。
