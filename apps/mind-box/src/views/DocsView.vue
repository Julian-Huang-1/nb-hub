<script setup lang="ts">
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { storeToRefs } from "pinia";
import { RouterLink } from "vue-router";
import { ref, watch } from "vue";
import { documentsApi } from "../api/documents.js";
import { useEditorAssist } from "../composables/useEditorAssist.js";
import { useDocsStore } from "../stores/docs.js";

const docsStore = useDocsStore();
const { documentId } = storeToRefs(docsStore);

const titleInput = ref(docsStore.title);
const saveMsg = ref<string | null>(null);
const saveErr = ref<string | null>(null);

const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: "用 Markdown 写作…（侧栏可从光标处请求内联补全并直接插入）",
    }),
    Markdown,
  ],
  content: "# 未命名\n\n",
  contentType: "markdown",
  editorProps: {
    attributes: {
      class: "docs-editor__content tiptap",
      spellcheck: "false",
    },
  },
});

const {
  assistLoading,
  inlineCompletionLoading,
  assistError,
  requestInlineCompletion,
  transformSelection,
  generateAtCursor,
} = useEditorAssist(editor);

const cursorIntent = ref("在这里写一段承上启下的过渡");

watch(titleInput, (v) => {
  docsStore.title = v;
});

async function newDoc() {
  saveErr.value = null;
  saveMsg.value = null;
  try {
    const data = await documentsApi.create({
      title: titleInput.value.trim() || "未命名",
      contentMd: editor.value?.getMarkdown() ?? "",
    });
    docsStore.setMeta(data.id, data.title);
    titleInput.value = data.title;
    editor.value
      ?.chain()
      .setContent("# " + data.title + "\n\n", { contentType: "markdown" })
      .run();
    saveMsg.value = "已创建文档";
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : String(e);
  }
}

async function saveDraft() {
  const id = documentId.value;
  if (!id) {
    saveErr.value = "请先新建或打开文档";
    return;
  }
  saveErr.value = null;
  saveMsg.value = null;
  try {
    await documentsApi.saveDraft(id, {
      title: titleInput.value.trim(),
      contentMd: editor.value?.getMarkdown() ?? "",
    });
    saveMsg.value = "草稿已保存";
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : String(e);
  }
}

async function publishDoc() {
  const id = documentId.value;
  if (!id) {
    saveErr.value = "请先新建或打开文档";
    return;
  }
  saveErr.value = null;
  saveMsg.value = null;
  try {
    await documentsApi.publish(id, {
      title: titleInput.value.trim(),
      contentMd: editor.value?.getMarkdown() ?? "",
    });
    saveMsg.value = "已发布";
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div class="docs-page">
    <p class="docs-back">
      <RouterLink :to="{ name: 'home', hash: '#posts' }">← 返回博客</RouterLink>
    </p>
    <header class="docs-toolbar">
      <input
        v-model="titleInput"
        class="docs-toolbar__title"
        type="text"
        aria-label="文档标题"
      />
      <div class="docs-toolbar__actions">
        <button type="button" class="btn" @click="newDoc">新建</button>
        <button type="button" class="btn" @click="saveDraft">保存草稿</button>
        <button type="button" class="btn btn--primary" @click="publishDoc">
          发布
        </button>
      </div>
    </header>
    <p v-if="documentId" class="docs-meta">文档 ID: {{ documentId }}</p>
    <p v-if="saveMsg" class="docs-flash docs-flash--ok">{{ saveMsg }}</p>
    <p v-if="saveErr" class="docs-flash docs-flash--err">{{ saveErr }}</p>
    <div class="docs-layout">
      <main class="docs-main">
        <div class="docs-editor-wrap">
          <EditorContent v-if="editor" :editor="editor" />
        </div>
      </main>
      <aside class="docs-assist" aria-label="创作辅助">
        <h2 class="docs-assist__title">创作模式</h2>
        <p class="docs-assist__note">
          点击「从光标处补全」会根据当前光标上下文请求建议，并在返回后直接插入编辑器。
        </p>
        <div v-if="assistError" class="docs-assist__err">{{ assistError }}</div>
        <section class="docs-assist__block">
          <h3>内联补全</h3>
          <button
            type="button"
            class="btn"
            :disabled="inlineCompletionLoading || assistLoading"
            @click="requestInlineCompletion"
          >
            {{ inlineCompletionLoading ? "请求中…" : "从光标处补全" }}
          </button>
        </section>
        <section class="docs-assist__block">
          <h3>选中改写</h3>
          <div class="docs-assist__row">
            <button
              type="button"
              class="btn btn--small"
              :disabled="assistLoading"
              @click="transformSelection('shorten')"
            >
              精简
            </button>
            <button
              type="button"
              class="btn btn--small"
              :disabled="assistLoading"
              @click="transformSelection('expand')"
            >
              扩写
            </button>
            <button
              type="button"
              class="btn btn--small"
              :disabled="assistLoading"
              @click="transformSelection('casual')"
            >
              口语化
            </button>
            <button
              type="button"
              class="btn btn--small"
              :disabled="assistLoading"
              @click="transformSelection('academic')"
            >
              学术化
            </button>
          </div>
        </section>
        <section class="docs-assist__block">
          <h3>光标处生成</h3>
          <textarea
            v-model="cursorIntent"
            class="docs-assist__textarea"
            rows="3"
            placeholder="描述想插入的段落或章节…"
          />
          <button
            type="button"
            class="btn"
            :disabled="assistLoading"
            @click="generateAtCursor(cursorIntent)"
          >
            插入内容
          </button>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.docs-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem 1rem 3rem;
}

.docs-back {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}

.docs-back a {
  color: #475569;
  text-decoration: none;
}

.docs-back a:hover {
  text-decoration: underline;
}

.docs-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.docs-toolbar__title {
  flex: 1;
  min-width: 200px;
  font-size: 1.25rem;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}

.docs-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn {
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, #cbd5e1);
  background: #fff;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn:hover:not(:disabled) {
  background: #f8fafc;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--primary {
  background: #0f172a;
  color: #fff;
  border-color: #0f172a;
}

.btn--small {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
}

.docs-meta {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0 0 0.5rem;
}

.docs-flash {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}
.docs-flash--ok {
  color: #047857;
}
.docs-flash--err {
  color: #b91c1c;
}

.docs-layout {
  display: grid;
  grid-template-columns: 1fr minmax(260px, 320px);
  gap: 1.25rem;
  align-items: start;
}

@media (max-width: 900px) {
  .docs-layout {
    grid-template-columns: 1fr;
  }
}

.docs-main {
  min-width: 0;
}

.docs-editor-wrap {
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  background: #fff;
  position: relative;
}

.docs-assist {
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 1rem;
  background: #fafafa;
  font-size: 0.9rem;
}

.docs-assist__title {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}

.docs-assist__note {
  margin: 0 0 0.75rem;
  color: #64748b;
  line-height: 1.45;
}

.docs-assist__err {
  color: #b91c1c;
  margin-bottom: 0.75rem;
}

.docs-assist__block {
  margin-bottom: 1rem;
}
.docs-assist__block h3 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.docs-assist__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.docs-assist__textarea {
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font: inherit;
  resize: vertical;
}

</style>

<style>
/* TipTap 根节点在子组件内，用非 scoped 控制编辑器外观 */
.docs-editor-wrap .tiptap {
  min-height: 55vh;
  padding: 1rem 1.25rem;
  outline: none;
  line-height: 1.65;
}

.docs-editor-wrap .tiptap p {
  margin: 0.5em 0;
}

.docs-editor-wrap .tiptap h1,
.docs-editor-wrap .tiptap h2,
.docs-editor-wrap .tiptap h3 {
  margin-top: 1em;
  margin-bottom: 0.35em;
  font-weight: 700;
}
</style>
