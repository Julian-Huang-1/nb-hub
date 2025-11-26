<script setup lang="ts">
import { ref } from "vue";
import type { Message } from "../../base/ai-provider/aiProvider.interface";

const props = defineProps<{
  message: Message;
}>();

const isEditing = ref<boolean>(false);
const editingContent = ref<string>("");

const emit = defineEmits<{
  "save-editing-content": [id: string, content: string];
  "cancel-editing-content": [id: string];
  "regenerate-message": [id: string, content: string];
}>();

const saveEditingContent = (id: string, content: string) => {
  emit("save-editing-content", id, content);
  isEditing.value = false;
};

const cancelEditingContent = (id: string) => {
  emit("cancel-editing-content", id);
  isEditing.value = false;
};

const regenerateMessage = (id: string, content: string) => {
  emit("regenerate-message", id, content);
  isEditing.value = false;
};

// 新增：开始编辑
const startEdit = () => {
  if (props.message.role === "user") {
    isEditing.value = true;
    editingContent.value = props.message.content;
  }
};
</script>

<template>
  <div class="bubble">
    <div v-if="isEditing">
      <textarea v-model="editingContent" />
      <div>
        <button @click="saveEditingContent(props.message.id, editingContent)">
          保存
        </button>
        <button @click="cancelEditingContent(props.message.id)">取消</button>
        <button @click="regenerateMessage(props.message.id, editingContent)">
          重新生成
        </button>
      </div>
    </div>
    <div v-else @dblclick="startEdit">
      <div class="content">{{ props.message.content }}</div>
      <div class="time">{{ props.message.timestamp }}</div>
    </div>
  </div>
</template>
