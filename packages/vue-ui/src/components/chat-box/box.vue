<script setup lang="ts">
import type { Message, Status } from "./types";

import { ref, computed } from "vue";

// 状态管理
const messages = ref<Message[]>([]);
const input = ref<string>("");
const status = ref<Status>("idle");

// 计算属性
const isLoading = computed(
  () => status.value === "loading" || status.value === "streaming"
);
const canSend = computed(
  () => !isLoading.value && input.value.trim().length > 0
);

// 添加消息
const addMessage = (message: Message) => {
  messages.value.push(message);
};

// 发送消息
const sendMessage = () => {
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content: input.value,
    timestamp: Date.now(),
  };

  addMessage(message);
  input.value = "";

  status.value = "loading";
  setTimeout(() => {
    addMessage({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: "回复: " + message.content,
      timestamp: Date.now(),
    });
    status.value = "idle";
  }, 1000);
};

// 终止发送

//
</script>

<template>
  <div class="chat-box">
    <div
      v-for="message in messages"
      :key="message.id"
      class="chat-box-messages"
    >
      <div class="avatar"></div>
      <div class="bubble">
        <div class="content">{{ message.content }}</div>
        <div class="time">{{ message.timestamp }}</div>
      </div>
    </div>
    <div class="chat-box-input-area">
      <input type="text" v-model="input" />
      <button @click="sendMessage" :disabled="!canSend">发送</button>
    </div>
  </div>
</template>
