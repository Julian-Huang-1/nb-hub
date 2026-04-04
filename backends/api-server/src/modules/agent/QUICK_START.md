# Agent 模块快速开始

## 已创建的文件结构

```
src/modules/
├── agent/                          # 通用 Agent 模块
│   ├── index.ts                   # 模块入口，导出所有功能
│   ├── agent.types.ts             # TypeScript 类型定义
│   ├── agent.module.ts            # 核心封装（createAgent, createStreamingAgent, toolRegistry）
│   ├── agent.tools.ts             # 通用工具（时间、计算器、字符串、JSON）
│   ├── agent.template.ts          # 模板文件（复制到其他模块）
│   └── README.md                  # 详细文档
│
└── todos/                          # 示例：Todos Agent
    ├── todos.agent.ts             # Todos 专用 Agent 实现
    └── todos.agent.routes.ts      # Agent API 路由
```

## 已添加的 API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `POST /todos/agent/chat` | 非流式 | 完整响应一次性返回 |
| `POST /todos/agent/chat/stream` | SSE 流式 | 实时返回事件流 |
| `POST /todos/agent/quick` | 快速问答 | 无状态单次交互 |

## 在其他模块创建 Agent

### 1. 复制模板

```bash
cp src/modules/agent/agent.template.ts src/modules/[your-module]/[your-module].agent.ts
```

### 2. 修改模板（关键 TODO）

```typescript
// 1. 修改 agent 名称和描述
export const myAgent = {
  name: "my-agent",
  description: "我的智能助手",

  // 2. 定义业务工具（注入 userId）
  async create(userId: string, sessionId?: string) {
    const tools = [{
      ...myTool,
      execute: async (id, params) => {
        // 使用 userId 调用 service
        const result = await myService.doSomething(userId, params);
        return { content: [{ type: "text", text: result }], details: {} };
      }
    }];

    // 3. 创建 agent
    return createAgent({ systemPrompt: "...", model, tools }, context);
  }
};
```

### 3. 创建路由（可选）

```typescript
// [your-module].agent.routes.ts
import { Router } from "express";
import { myAgent } from "./my.agent.js";

const router = Router();

router.post("/agent/chat", async (req, res) => {
  const agent = await myAgent.create(req.auth.userId);
  const result = await agent.prompt(req.body.prompt);
  res.json({ status: "ok", data: { response: result.message.content } });
});

export { router as myAgentRouter };
```

### 4. 注册路由

```typescript
// index.ts
import { myAgentRouter } from "./modules/[your-module]/[your-module].agent.routes.js";
app.use("/[your-module]", requireSession, myAgentRouter);
```

## 环境变量配置

```bash
# AI 模型配置
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-20250514

# 或 OpenAI
# AI_PROVIDER=openai
# AI_MODEL=gpt-4o

# API Key（方式1: 环境变量 - 推荐）
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
# 或
OPENAI_API_KEY=sk-xxxxx
```

### API Key 三种配置方式

**方式1: 环境变量（默认，最简单）**
```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
```

**方式2: 静态配置（代码中指定）**
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

**方式3: 动态获取（OAuth、临时令牌）**
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

详见 [API_KEY_CONFIG.md](./API_KEY_CONFIG.md)

## 快速测试

```bash
# 启动服务器
pnpm start

# 测试快速问答
curl -X POST http://localhost:9999/todos/agent/quick \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{"prompt": "帮我创建一个叫\"学习Agent\"的待办"}'

# 测试完整对话
curl -X POST http://localhost:9999/todos/agent/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{"prompt": "列出我的待办事项", "sessionId": "test-session"}'

# 测试流式输出
curl -X POST http://localhost:9999/todos/agent/chat/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{"prompt": "帮我把前两个待办标记为完成"}'
```

## 核心概念

### AgentRuntimeContext
```typescript
interface AgentRuntimeContext {
  userId: string;      // 当前用户
  requestId: string;   // 请求追踪ID
  [key: string]: any;  // 可扩展
}
```

### AgentTool 定义
```typescript
{
  name: "tool_name",
  label: "显示名称",
  description: "工具描述",
  parameters: Type.Object({...}),  // @sinclair/typebox
  execute: async (toolCallId, params, signal, onUpdate) => {
    onUpdate?.({ content: [{ type: "text", text: "进度..." }], details: {} });
    return { content: [...], details: {} };
  }
}
```

### 事件订阅
```typescript
const unsubscribe = agent.subscribe((event, context) => {
  if (event.type === "message_update") {
    console.log(event.assistantMessageEvent.delta);
  }
});
```

## 参考文件

- 完整文档：`src/modules/agent/README.md`
- 模板文件：`src/modules/agent/agent.template.ts`
- 完整示例：`src/modules/todos/todos.agent.ts`
