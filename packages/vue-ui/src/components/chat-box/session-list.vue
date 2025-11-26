<script setup lang="ts">
import { type SessionMeta } from "../../base/session-manager";

const props = withDefaults(
  defineProps<{
    sessions: SessionMeta[];
  }>(),
  {
    sessions: () => [],
  }
);

const modelValue = defineModel<string>("current-session-id");

const emit = defineEmits<{
  'delete-session': [id: string];
}>();

const deleteSession = (id:string)=>{
  emit('delete-session', id);
}

</script>

<template>
  <div class="session-list">
    <div
      v-for="session in props.sessions"
      :key="session.id"
      class="session-list-item"
    >
      <div class="session-list-item-name">
        <button @click="modelValue = session.id">
          {{ session.name }}
        </button>
        <button @click="deleteSession(session.id)">删除</button>
      </div>
    </div>
  </div>
</template>
