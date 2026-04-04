# API Key 配置指南

Agent 模块支持三种 API Key 配置方式，满足不同场景需求。

## 三种配置方式

### 1. 环境变量（默认）

最简单的配置方式，无需修改代码。

**环境变量名：**
| 供应商 | 环境变量 |
|--------|----------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google | `GOOGLE_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| 其他 | 参见 `@mariozechner/pi-ai` 文档 |

**使用示例：**
```bash
# 启动时设置
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
pnpm start

# 或在 .env 文件中
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
```

**代码中使用（无需额外配置）：**
```typescript
const agent = await createAgent({
  systemPrompt: "你是助手",
  model,
  // 不传 apiKey 字段，自动从环境变量读取
}, context);
```

---

### 2. 固定 API Key（静态）

适合使用特定密钥的场景，如测试环境、特定租户等。

**代码中使用：**
```typescript
import { createAgent } from "../agent/index.js";

const agent = await createAgent({
  systemPrompt: "你是助手",
  model,
  apiKey: {
    type: "static",
    key: "sk-ant-xxxxx", // 直接传入密钥
  },
}, context);
```

**实际场景 - 多租户配置：**
```typescript
// 从数据库获取租户特定的 API key
const tenantConfig = await getTenantConfig(tenantId);

const agent = await createAgent({
  systemPrompt: "你是助手",
  model,
  apiKey: {
    type: "static",
    key: tenantConfig.aiApiKey,
  },
}, context);
```

---

### 3. 动态获取（函数）

适合 OAuth、临时令牌、需要刷新密钥的场景。

**基本用法：**
```typescript
const agent = await createAgent({
  systemPrompt: "你是助手",
  model,
  apiKey: {
    type: "dynamic",
    getter: async () => {
      // 从缓存、数据库或 token 服务获取
      return await getApiKeyFromCache();
    },
  },
}, context);
```

**实际场景 - GitHub Copilot OAuth：**
```typescript
// 用于 GitHub Copilot 等需要 OAuth token 的场景
const agent = await createAgent({
  systemPrompt: "你是编程助手",
  model: getModel("github-copilot", "gpt-4o"),
  apiKey: {
    type: "dynamic",
    getter: async () => {
      // Token 可能过期，需要刷新
      const token = await refreshGitHubCopilotToken(userId);
      return token;
    },
  },
}, context);
```

**实际场景 - AWS Bedrock 临时凭证：**
```typescript
const agent = await createAgent({
  systemPrompt: "你是助手",
  model: getModel("amazon-bedrock", "claude-sonnet-4"),
  apiKey: {
    type: "dynamic",
    getter: async () => {
      // AWS 使用临时凭证，需要动态获取
      const credentials = await getAwsCredentials();
      return credentials.sessionToken;
    },
  },
}, context);
```

---

## 完整示例：封装自定义 Agent 工厂

```typescript
// my-module/my-module.agent.ts
import { createAgent, getDefaultModel, type ApiKeyConfig } from "../agent/index.js";
import { myService } from "./my.service.js";

interface MyAgentConfig {
  userId: string;
  // 支持传入自定义 API key 配置
  apiKey?: ApiKeyConfig;
  // 或者从环境变量读取特定密钥
  envKeyName?: string;
}

export const myAgent = {
  async create(config: MyAgentConfig) {
    const { userId, apiKey, envKeyName } = config;
    
    // 确定 API key 配置
    let apiKeyConfig: ApiKeyConfig | undefined;
    
    if (apiKey) {
      // 使用传入的配置
      apiKeyConfig = apiKey;
    } else if (envKeyName) {
      // 从特定环境变量读取
      apiKeyConfig = {
        type: "static",
        key: process.env[envKeyName] || "",
      };
    }
    // 否则默认从环境变量自动读取
    
    const model = await getDefaultModel();
    
    return createAgent({
      systemPrompt: "你是智能助手",
      model,
      apiKey: apiKeyConfig,
      tools: [/* ... */],
    }, {
      userId,
      requestId: `my-${Date.now()}`,
    });
  },
};

// 使用方式

// 方式1: 默认（环境变量）
const agent1 = await myAgent.create({ userId: "user-123" });

// 方式2: 静态密钥
const agent2 = await myAgent.create({
  userId: "user-123",
  apiKey: { type: "static", key: "sk-xxxxx" },
});

// 方式3: 动态密钥（OAuth）
const agent3 = await myAgent.create({
  userId: "user-123",
  apiKey: {
    type: "dynamic",
    getter: () => refreshToken(userId),
  },
});

// 方式4: 特定环境变量
const agent4 = await myAgent.create({
  userId: "user-123",
  envKeyName: "MY_CUSTOM_API_KEY",
});
```

---

## 环境变量优先级

如果使用 `type: "env"` 或不传 `apiKey`，库会按以下优先级查找：

1. 标准环境变量名（如 `ANTHROPIC_API_KEY`）
2. 供应商特定的其他变量名

**建议：** 生产环境使用标准环境变量，开发和测试可以使用静态或动态配置。

---

## 安全配置建议

### 生产环境
```bash
# 使用标准环境变量
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### 多租户场景
```typescript
// 每个租户使用不同的密钥
apiKey: {
  type: "static",
  key: await getTenantApiKey(tenantId),
}
```

### OAuth 场景
```typescript
// Token 会过期，需要动态刷新
apiKey: {
  type: "dynamic",
  getter: async () => {
    const token = await tokenCache.get(userId);
    if (token.expiresAt < Date.now() + 60000) {
      // 提前1分钟刷新
      return await refreshToken(userId);
    }
    return token.value;
  },
}
```

### 密钥管理最佳实践
1. **永远不要硬编码密钥**在代码中
2. **使用环境变量**或密钥管理服务
3. **定期轮换** API key
4. **最小权限原则** - 只给必要的权限
5. **监控和审计** API key 的使用

---

## 常见问题

### Q: 如何验证 API key 是否生效？
```typescript
// 创建一个测试 agent
const agent = await createAgent({
  systemPrompt: "Say hello",
  model,
  apiKey: { type: "static", key: "your-key" },
}, context);

const result = await agent.prompt("Hi");
if (!result.success) {
  console.error("API Key 无效:", result.error);
}
```

### Q: 不同模型使用不同密钥？
```typescript
// 根据模型选择不同的 key
const getApiKeyForModel = (modelId: string): ApiKeyConfig => {
  if (modelId.startsWith("claude")) {
    return { type: "static", key: process.env.ANTHROPIC_API_KEY! };
  }
  if (modelId.startsWith("gpt")) {
    return { type: "static", key: process.env.OPENAI_API_KEY! };
  }
  return { type: "env" };
};
```

### Q: 流式 Agent 也支持吗？
是的，`createStreamingAgent` 同样支持 `apiKey` 配置：
```typescript
const agent = await createStreamingAgent(
  {
    systemPrompt: "...",
    model,
    apiKey: { type: "static", key: "..." },
  },
  context,
  (event) => console.log(event)
);
```
