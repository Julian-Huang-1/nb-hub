<script setup lang="ts">
/**
 * ChatBox 完整演示应用
 * 展示如何在实际应用中集成 ChatBox 组件
 */
import { ref, computed } from "vue";
import ChatBox from "../ChatBox.vue";
import { MockAIPlugin } from "../plugins/MockAIPlugin";
import { OpenAIPlugin } from "../plugins/OpenAIPlugin";
import type { Message, ChatStatus, ChatBoxPlugin } from "../types";

// 可用的插件
const availablePlugins = {
  mock: {
    name: "Mock AI (测试)",
    plugin: new MockAIPlugin(),
    config: {
      delay: 1000,
      streaming: true,
    },
    requiresApiKey: false,
  },
  openai: {
    name: "OpenAI GPT",
    plugin: new OpenAIPlugin(),
    config: {
      apiKey: "",
      model: "gpt-3.5-turbo",
      stream: true,
    },
    requiresApiKey: true,
  },
};

// 状态
const selectedPluginKey = ref<"mock" | "openai">("mock");
const apiKey = ref("");
const chatBoxRef = ref();
const errorMessage = ref("");
const messageCount = ref(0);
const currentStatus = ref<ChatStatus>("idle");

// 计算属性
const currentPluginInfo = computed(
  () => availablePlugins[selectedPluginKey.value]
);
const currentPlugin = computed(() => currentPluginInfo.value.plugin);
const currentConfig = computed(() => {
  const config = { ...currentPluginInfo.value.config };
  if (selectedPluginKey.value === "openai" && apiKey.value) {
    config.apiKey = apiKey.value;
  }
  return config;
});

const canUsePlugin = computed(() => {
  if (!currentPluginInfo.value.requiresApiKey) {
    return true;
  }
  return apiKey.value.trim().length > 0;
});

const statusText = computed(() => {
  const statusMap: Record<ChatStatus, string> = {
    idle: "空闲",
    loading: "加载中...",
    streaming: "正在输入...",
    error: "错误",
  };
  return statusMap[currentStatus.value] || "未知";
});

const statusColor = computed(() => {
  const colorMap: Record<ChatStatus, string> = {
    idle: "#4caf50",
    loading: "#ff9800",
    streaming: "#2196f3",
    error: "#f44336",
  };
  return colorMap[currentStatus.value] || "#999";
});

// 事件处理
const handleMessageSent = (message: Message) => {
  messageCount.value++;
  console.log("Message sent:", message);
};

const handleMessageReceived = (message: Message) => {
  console.log("Message received:", message);
};

const handleError = (error: Error) => {
  errorMessage.value = error.message;
  setTimeout(() => {
    errorMessage.value = "";
  }, 5000);
};

const handleStatusChange = (status: ChatStatus) => {
  currentStatus.value = status;
};

// 操作方法
const clearChat = () => {
  if (chatBoxRef.value) {
    chatBoxRef.value.clearMessages();
    messageCount.value = 0;
  }
};

const switchPlugin = (pluginKey: "mock" | "openai") => {
  if (pluginKey === "openai" && !apiKey.value) {
    errorMessage.value = "请先输入 OpenAI API Key";
    setTimeout(() => {
      errorMessage.value = "";
    }, 3000);
    return;
  }
  selectedPluginKey.value = pluginKey;
  clearChat();
};
</script>

<template>
  <div class="demo-app">
    <!-- 头部 -->
    <header class="header">
      <div class="header-content">
        <h1>🤖 AI ChatBox Demo</h1>
        <p>插件化架构的 Vue 聊天组件演示</p>
      </div>
    </header>

    <!-- 主体内容 -->
    <div class="main-content">
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-section">
          <h3>插件选择</h3>
          <div class="plugin-list">
            <button
              v-for="(info, key) in availablePlugins"
              :key="key"
              :class="['plugin-item', { active: selectedPluginKey === key }]"
              @click="switchPlugin(key as 'mock' | 'openai')"
            >
              <span class="plugin-name">{{ info.name }}</span>
              <span v-if="selectedPluginKey === key" class="check-icon">✓</span>
            </button>
          </div>
        </div>

        <div v-if="currentPluginInfo.requiresApiKey" class="sidebar-section">
          <h3>API 配置</h3>
          <input
            v-model="apiKey"
            type="password"
            placeholder="输入 API Key"
            class="api-key-input"
          />
          <p class="hint">需要 OpenAI API Key 才能使用</p>
        </div>

        <div class="sidebar-section">
          <h3>统计信息</h3>
          <div class="stats">
            <div class="stat-item">
              <span class="stat-label">状态</span>
              <span class="stat-value" :style="{ color: statusColor }">
                {{ statusText }}
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">消息数</span>
              <span class="stat-value">{{ messageCount }}</span>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <h3>操作</h3>
          <button @click="clearChat" class="action-btn">清空对话</button>
        </div>

        <div class="sidebar-section">
          <h3>特性</h3>
          <ul class="feature-list">
            <li>✅ 插件化架构</li>
            <li>✅ UI/逻辑分离</li>
            <li>✅ 流式响应</li>
            <li>✅ TypeScript</li>
            <li>✅ 易于测试</li>
          </ul>
        </div>
      </aside>

      <!-- 聊天区域 -->
      <main class="chat-area">
        <div v-if="!canUsePlugin" class="warning-banner">
          ⚠️ 请先配置 API Key
        </div>

        <div v-if="errorMessage" class="error-banner">
          ❌ {{ errorMessage }}
        </div>

        <div class="chat-wrapper">
          <ChatBox
            ref="chatBoxRef"
            :key="selectedPluginKey"
            :plugin="currentPlugin"
            :plugin-config="currentConfig"
            placeholder="输入消息开始聊天..."
            max-height="calc(100vh - 250px)"
            @message-sent="handleMessageSent"
            @message-received="handleMessageReceived"
            @error="handleError"
            @status-change="handleStatusChange"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.demo-app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
}

.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 24px;
  text-align: center;
}

.header-content h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  color: #333;
}

.header-content p {
  margin: 0;
  color: #666;
  font-size: 16px;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 24px;
  padding: 24px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

.sidebar {
  width: 300px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: calc(100vh - 150px);
  overflow-y: auto;
}

.sidebar-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f5f5f5;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.plugin-item:hover {
  background: #e8e8e8;
}

.plugin-item.active {
  background: #e3f2fd;
  border-color: #2196f3;
  color: #1976d2;
}

.check-icon {
  font-size: 16px;
  color: #2196f3;
}

.api-key-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.api-key-input:focus {
  outline: none;
  border-color: #2196f3;
}

.hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #999;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.action-btn {
  width: 100%;
  padding: 10px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #d32f2f;
}

.feature-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.feature-list li {
  padding: 6px 0;
  font-size: 14px;
  color: #666;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.warning-banner,
.error-banner {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}

.warning-banner {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.error-banner {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-wrapper {
  flex: 1;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    max-height: none;
  }
}

/* 滚动条样式 */
.sidebar::-webkit-scrollbar {
  width: 6px;
}

.sidebar::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: #b0b0b0;
}
</style>
