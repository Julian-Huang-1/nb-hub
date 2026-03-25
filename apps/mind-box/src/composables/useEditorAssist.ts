import type { Editor } from "@tiptap/core";
import type { Ref } from "vue";
import type { SelectionIntent } from "@nb-hub/contracts";
import { ref } from "vue";
import { assistApi } from "../api/assist.js";
import { useDocsStore } from "../stores/docs.js";

function getAroundSelection(editor: Editor) {
  const { from } = editor.state.selection;
  const doc = editor.state.doc;
  const before = doc.textBetween(0, from, "\n", "\n");
  const after = doc.textBetween(from, doc.content.size, "\n", "\n");
  return {
    prefixText: before.slice(-2000),
    suffixText: after.slice(0, 2000),
  };
}

export function useEditorAssist(editor: Ref<Editor | undefined>) {
  const docs = useDocsStore();
  const assistLoading = ref(false);
  const inlineCompletionLoading = ref(false);
  const assistError = ref<string | null>(null);
  let reqSeq = 0;

  function requestInlineCompletion() {
    const ed = editor.value;
    if (!ed) return;
    assistError.value = null;
    const my = ++reqSeq;
    inlineCompletionLoading.value = true;
    const { prefixText, suffixText } = getAroundSelection(ed);
    assistApi
      .inlineCompletions({
        documentId: docs.documentId ?? undefined,
        prefixText,
        suffixText,
      })
      .then((data) => {
        if (my !== reqSeq) return;
        const edNow = editor.value;
        const text = data.candidates[0]?.text ?? "";
        if (!edNow || !text.trim()) return;
        edNow
          .chain()
          .focus()
          .insertContentAt(edNow.state.selection.from, text, {
            contentType: "markdown",
          })
          .run();
      })
      .catch((e: unknown) => {
        if (my !== reqSeq) return;
        assistError.value = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        if (my !== reqSeq) return;
        inlineCompletionLoading.value = false;
      });
  }

  async function transformSelection(intent: SelectionIntent) {
    const ed = editor.value;
    if (!ed) return;
    const { from, to, empty } = ed.state.selection;
    if (empty) {
      assistError.value = "请先选中要改写的文本";
      return;
    }
    const selectedText = ed.state.doc.textBetween(from, to, "\n");
    assistLoading.value = true;
    assistError.value = null;
    try {
      const data = await assistApi.selectionTransform({
        documentId: docs.documentId ?? undefined,
        selectedText,
        intent,
        surroundingContext: ed.getMarkdown().slice(0, 8000),
      });
      ed.chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, data.replacementText, {
          contentType: "markdown",
        })
        .run();
    } catch (e) {
      assistError.value = e instanceof Error ? e.message : String(e);
    } finally {
      assistLoading.value = false;
    }
  }

  async function generateAtCursor(intent: string) {
    const ed = editor.value;
    if (!ed || !intent.trim()) return;
    assistLoading.value = true;
    assistError.value = null;
    try {
      const data = await assistApi.cursorGenerate({
        documentId: docs.documentId ?? undefined,
        intent: intent.trim(),
        documentOutline: ed
          .getMarkdown()
          .split("\n")
          .filter((line: string) => line.startsWith("#"))
          .join("\n"),
        currentSectionContext: getAroundSelection(ed).prefixText.slice(-1200),
        desiredLength: "medium",
      });
      const block = data.blocks[0]?.markdown ?? "";
      if (!block) return;
      ed.chain().focus().insertContentAt(ed.state.selection.from, block).run();
    } catch (e) {
      assistError.value = e instanceof Error ? e.message : String(e);
    } finally {
      assistLoading.value = false;
    }
  }

  return {
    assistLoading,
    inlineCompletionLoading,
    assistError,
    requestInlineCompletion,
    transformSelection,
    generateAtCursor,
  };
}
