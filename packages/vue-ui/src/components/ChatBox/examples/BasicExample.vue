<script setup lang="ts">
import { ref } from "vue";
import ChatBox from "../ChatBox.vue";
import { MockAIPlugin } from "../plugins/MockAIPlugin";
import type { Message } from "../types";

// 创建插件实例
const plugin = new MockAIPlugin();

// 插件配置
const pluginConfig = {
  delay: 1000,
  streaming: true,
};

// 引用
const chatBoxRef = ref();

// 事件处理
const handleMessageSent = (message: Message) => {
  console.log("Message sent:", message);
};

const handleMessageReceived = (message: Message) => {
  console.log("Message received:", message);
};

const handleError = (error: Error) => {
  console.error("Error:", error);
  alert(`发生错误：${error.message}`);
};

const handleStatusChange = (status: string) => {
  console.log("Status changed:", status);
};

// 清空对话
const clearChat = () => {
  if (chatBoxRef.value) {
    chatBoxRef.value.clearMessages();
  }
};
</script>

<template>
  <div class="example-container">
    <div class="header">
      <h1>ChatBox 基础示例</h1>
      <p>使用 MockAIPlugin 模拟 AI 对话</p>
      <button @click="clearChat" class="clear-btn">清空对话</button>
    </div>

    <div class="chat-container">
      <ChatBox
        ref="chatBoxRef"
        :plugin="plugin"
        :plugin-config="pluginConfig"
        placeholder="输入你想说的话..."
        max-height="500px"
        @message-sent="handleMessageSent"
        @message-received="handleMessageReceived"
        @error="handleError"
        @status-change="handleStatusChange"
      />
    </div>

    <div class="footer">
      <p>💡 提示：按 Enter 发送消息，Shift+Enter 换行</p>
    </div>
  </div>
</template>

<style scoped>
.example-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.header h1 {
  font-size: 28px;
  margin-bottom: 8px;
  color: #333;
}

.header p {
  color: #666;
  margin-bottom: 16px;
}

.clear-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #e0e0e0;
}

.chat-container {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.footer {
  text-align: center;
  margin-top: 16px;
  color: #999;
  font-size: 14px;
}
</style>
