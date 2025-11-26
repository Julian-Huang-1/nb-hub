<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  watch,
} from "vue";
import { PluginManager } from "./plugin";
import type {
  Message,
  ChatStatus,
  ChatBoxPlugin,
  PluginConfig,
  PluginContext,
} from "./types";

/**
 * ChatBox 组件属性
 */
interface Props {
  plugin: ChatBoxPlugin;
  pluginConfig?: PluginConfig;
  placeholder?: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

/**
 * ChatBox 组件事件
 */
interface Emits {
  (e: "message-sent", message: Message): void;
  (e: "message-received", message: Message): void;
  (e: "error", error: Error): void;
  (e: "status-change", status: ChatStatus): void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "输入消息22...",
  maxHeight: "600px",
  autoScroll: true,
});

const emit = defineEmits<Emits>();

// 状态管理
const messages = ref<Message[]>([]);
const inputText = ref("");
const status = ref<ChatStatus>("idle");
const messagesContainer = ref<HTMLElement>();
const pluginManager = new PluginManager();

// 计算属性
const isLoading = computed(
  () => status.value === "loading" || status.value === "streaming"
);
const canSend = computed(
  () => !isLoading.value && inputText.value.trim().length > 0
);

// 设置状态
const setStatus = (newStatus: ChatStatus) => {
  status.value = newStatus;
  emit("status-change", newStatus);
};

// 添加消息
const addMessage = (message: Omit<Message, "id" | "timestamp">) => {
  const newMessage: Message = {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  messages.value.push(newMessage);

  if (message.role === "user") {
    emit("message-sent", newMessage);
  } else if (message.role === "assistant") {
    emit("message-received", newMessage);
  }

  if (props.autoScroll) {
    scrollToBottom();
  }
};

// 更新消息
const updateMessage = (id: string, updates: Partial<Message>) => {
  const index = messages.value.findIndex((msg) => msg.id === id);
  if (index !== -1) {
    messages.value[index] = { ...messages.value[index], ...updates };
  }
};

// 清空消息
const clearMessages = () => {
  messages.value = [];
};

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// 创建插件上下文
const createPluginContext = (): PluginContext => ({
  messages: messages.value,
  status: status.value,
  setStatus,
  addMessage,
  updateMessage,
  clearMessages,
});

// 发送消息
const sendMessage = async () => {
  if (!canSend.value) return;

  const content = inputText.value.trim();
  inputText.value = "";

  try {
    setStatus("loading");

    const context = createPluginContext();

    // 添加用户消息
    addMessage({
      role: "user",
      content,
    });

    // 通过插件管理器发送消息
    await pluginManager.sendMessage({ content }, context);

    setStatus("idle");
  } catch (error) {
    setStatus("error");
    const err = error instanceof Error ? error : new Error(String(error));
    emit("error", err);
    console.error("[ChatBox] Error sending message:", err);
  }
};

// 中断请求
const abort = () => {
  pluginManager.abort();
  setStatus("idle");
};

// 处理回车发送
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 初始化插件
onMounted(async () => {
  try {
    await pluginManager.use(props.plugin, props.pluginConfig);
  } catch (error) {
    console.error("[ChatBox] Error initializing plugin:", error);
    emit("error", error instanceof Error ? error : new Error(String(error)));
  }
});

// 监听插件变化
watch(
  () => props.plugin,
  async (newPlugin) => {
    try {
      await pluginManager.use(newPlugin, props.pluginConfig);
    } catch (error) {
      console.error("[ChatBox] Error switching plugin:", error);
      emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }
);

// 清理
onBeforeUnmount(async () => {
  await pluginManager.destroy();
});

// 暴露方法给父组件
defineExpose({
  sendMessage,
  clearMessages,
  abort,
  messages,
  status,
});
</script>

<template>
  <div class="chat-box">
    <!-- 消息列表 -->
    <div
      ref="messagesContainer"
      class="messages-container"
      :style="{ maxHeight }"
    >
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', `message-${message.role}`]"
      >
        <div class="message-header">
          <span class="message-role">
            {{ message.role === "user" ? "你" : "AI" }}
          </span>
          <span class="message-time">{{ formatTime(message.timestamp) }}</span>
        </div>
        <div class="message-content">{{ message.content }}</div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-indicator">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>

      <!-- 空状态 -->
      <div v-if="messages.length === 0 && !isLoading" class="empty-state">
        <p>开始与 AI 对话吧！</p>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-container">
      <textarea
        v-model="inputText"
        :placeholder="placeholder"
        :disabled="isLoading"
        class="message-input"
        rows="1"
        @keydown="handleKeydown"
      />
      <div class="input-actions">
        <button
          v-if="isLoading"
          @click="abort"
          class="btn btn-abort"
          type="button"
        >
          停止
        </button>
        <button
          v-else
          @click="sendMessage"
          :disabled="!canSend"
          class="btn btn-send"
          type="button"
        >
          发送
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="status === 'error'" class="error-banner">发送失败，请重试</div>
  </div>
</template>

<style scoped>
.chat-box {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #b0b0b0;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 80%;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-user {
  align-self: flex-end;
}

.message-assistant,
.message-system {
  align-self: flex-start;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
}

.message-role {
  font-weight: 600;
}

.message-time {
  color: #999;
}

.message-content {
  padding: 12px 16px;
  border-radius: 8px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-user .message-content {
  background: #1976d2;
  color: white;
}

.message-assistant .message-content,
.message-system .message-content {
  background: #f5f5f5;
  color: #333;
}

.loading-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  align-self: flex-start;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}

.input-container {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
}

.message-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  outline: none;
  transition: border-color 0.2s;
}

.message-input:focus {
  border-color: #1976d2;
}

.message-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  align-items: flex-end;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send {
  background: #1976d2;
  color: white;
}

.btn-send:hover:not(:disabled) {
  background: #1565c0;
}

.btn-abort {
  background: #f44336;
  color: white;
}

.btn-abort:hover {
  background: #d32f2f;
}

.error-banner {
  padding: 12px 16px;
  background: #ffebee;
  color: #c62828;
  text-align: center;
  font-size: 14px;
  border-top: 1px solid #ef9a9a;
}
</style>
