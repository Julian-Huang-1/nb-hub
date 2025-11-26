<script setup lang="ts">
import type { Message } from "../../base/ai-provider/aiProvider.interface";
import { ChatEvent } from "../../base/event-bus";
import type { SessionMeta } from "../../base/session-manager";
import { getChatBox } from "./chatbox.service";
import type { Status } from "./plugins/types";
import SessionList from "./session-list.vue";
import { ref, computed, onMounted, watch } from "vue";
import { v4 as uuid } from "uuid";
import Bubble from "./bubble.vue";
// 状态管理
const messages = ref<Message[]>([]);
const sessions = ref<SessionMeta[]>([]);
const currentSessionId = ref<string>("");
const input = ref<string>("");
const status = ref<Status>("idle");

const chatbox = getChatBox();

// 计算属性
const isLoading = computed(
  () => status.value === "loading" || status.value === "streaming"
);
const canSend = computed(() => {
  return (
    !isLoading.value &&
    input.value.trim().length > 0 &&
    currentSessionId.value !== ""
  );
});

// 发送消息
const sendMessage = async () => {
  if (!canSend.value) return;

  const message: Message = {
    id: uuid(),
    content: input.value,
    timestamp: Date.now(),
    role: "user",
  };

  input.value = "";

  const aiMessage: Message = {
    id: uuid(),
    content: "",
    timestamp: Date.now(),
    role: "assistant",
  };

  messages.value.push(message);
  messages.value.push(aiMessage);

  const onStream = (chunk: string) => {
    if (messages.value) {
      messages.value[messages.value.length - 1].content += chunk;
    }
  };

  const res = await chatbox.sendMessage(
    currentSessionId.value,
    message,
    onStream
  );
  messages.value[messages.value.length - 1] = res;
};

const createSession = () => {
  chatbox.createSession(`新会话-${uuid()}`);
};

// 终止发送
const abort = () => {
  if (isLoading.value) {
    messageManagerInstance.abort();
  }
  setStatus("idle");
};

const deleteSession = async (id: string) => {
  await chatbox.deleteSession(id);
  sessions.value = await chatbox.listSessions();
  if (currentSessionId.value === id) {
    currentSessionId.value = "";
    messages.value = [];
  }
};
onMounted(async () => {
  sessions.value = await chatbox.listSessions();

  if (sessions.value.length === 0) {
    const session = await chatbox.createSession(`新会话-${uuid()}`);
    currentSessionId.value = session.id;
    messages.value = [];
  } else {
    currentSessionId.value = sessions.value[0].id;
    const session = await chatbox.getSession(currentSessionId.value);
    if (session) {
      messages.value = session.messages;
    }
  }

  chatbox.on(ChatEvent.SESSION_CREATED, (session: SessionMeta) => {
    sessions.value.push(session);
    currentSessionId.value = session.id;
    messages.value = [];
  });

  chatbox.on(ChatEvent.SESSION_UPDATED, (session: SessionMeta) => {
    const index = sessions.value.findIndex((s) => s.id === session.id);
    if (index !== -1) {
      sessions.value[index] = session;
    }
  });

  chatbox.on(ChatEvent.SESSION_DELETED, (session: SessionMeta) => {
    const index = sessions.value.findIndex((s) => s.id === session.id);
    if (index !== -1) {
      sessions.value.splice(index, 1);
    }
  });
});

watch(currentSessionId, async (newVal, oldVal) => {
  if (newVal !== oldVal) {
    const session = await chatbox.getSession(newVal);
    if (session) {
      messages.value = session.messages;
    }
  }
});

const saveEditingContent = async (id: string, content: string) => {
  const session = await chatbox.updateSession(
    currentSessionId.value,
    (session) => ({
      ...session,
      messages: session.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    })
  );
  if (session) {
    sessions.value = await chatbox.listSessions();
    messages.value = session.messages;
  }
};

const regenerateMessage = async (messageId: string, content: string) => {
  // 先保存
  await saveEditingContent(messageId, content);

  const index = messages.value.findIndex((m) => m.id === messageId);
  messages.value = messages.value.slice(0, index + 1);

  const aiMessage: Message = {
    id: uuid(),
    content: "",
    timestamp: Date.now(),
    role: "assistant",
  };

  messages.value.push(aiMessage);
  const onStream = (chunk: string) => {
    if (messages.value) {
      messages.value[messages.value.length - 1].content += chunk;
    }
  };
  await chatbox.regenerateMessage(currentSessionId.value, messageId, onStream);
  const session = await chatbox.getSession(currentSessionId.value);

  if (session) {
    sessions.value = await chatbox.listSessions();
    messages.value = session.messages;
  }
};
</script>

<template>
  <div>
    <div class="session-list">
      <SessionList
        :sessions="sessions"
        v-model:current-session-id="currentSessionId"
        @delete-session="deleteSession"
      />
      <button @click="createSession">创建会话</button>
    </div>
    <div>--------------------------------</div>
    currentSessionId: {{ currentSessionId }}
    <div class="chat-box">
      <div
        v-for="message in messages"
        :key="message.id"
        class="chat-box-messages"
      >
        <div class="avatar"></div>
        <div class="bubble">
          <Bubble
            :message="message"
            @save-editing-content="saveEditingContent"
            @regenerate-message="regenerateMessage"
          />
        </div>
      </div>
      <div class="chat-box-input-area">
        <input type="text" v-model="input" />
        <button @click="sendMessage" :disabled="!canSend">发送</button>
      </div>
    </div>
  </div>
</template>
