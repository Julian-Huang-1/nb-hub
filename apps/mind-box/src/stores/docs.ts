import { defineStore } from "pinia";
import { ref } from "vue";

export const useDocsStore = defineStore("docs", () => {
  const documentId = ref<number | null>(null);
  const title = ref("未命名文档");

  function setMeta(id: number | null, nextTitle: string) {
    documentId.value = id;
    title.value = nextTitle;
  }

  function reset() {
    documentId.value = null;
    title.value = "未命名文档";
  }

  return { documentId, title, setMeta, reset };
});
