<script setup lang="ts">
import type { ChatPanel } from "@mariozechner/pi-web-ui";
import { onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  setupChatPanel,
  teardownChatPanel,
} from "../pi/setupChatPanel.js";

const root = ref<HTMLElement | null>(null);
const error = ref<string | null>(null);
let panel: ChatPanel | undefined;

onMounted(async () => {
  if (!root.value) return;
  try {
    panel = await setupChatPanel(root.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});

onUnmounted(() => {
  teardownChatPanel(panel, root.value);
  panel = undefined;
});
</script>

<template>
  <div class="chat-page">
    <header class="chat-page__header">
      <p class="chat-page__back">
        <RouterLink :to="{ name: 'home', hash: '#posts' }">← 返回博客</RouterLink>
      </p>
      <h1 class="chat-page__title">AI 对话</h1>
      <p class="chat-page__hint">
        使用 Pi 聊天面板；首次使用需在界面中配置模型提供商与 API Key（OpenAI 等）。
      </p>
    </header>
    <div v-if="error" class="chat-page__error" role="alert">
      {{ error }}
    </div>
    <div ref="root" class="chat-page__panel" />
  </div>
</template>

<style scoped>
.chat-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
}

.chat-page__header {
  margin-bottom: 1rem;
}

.chat-page__back {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}

.chat-page__back a {
  color: #475569;
  text-decoration: none;
}

.chat-page__back a:hover {
  text-decoration: underline;
}

.chat-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.35rem;
}

.chat-page__hint {
  margin: 0;
  color: var(--color-muted, #64748b);
  font-size: 0.9rem;
}

.chat-page__error {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  margin-bottom: 1rem;
}

.chat-page__panel {
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  min-height: 72vh;
  background: var(--color-surface, #fff);
}
</style>
