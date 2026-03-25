import type { Editor } from "@tiptap/core";
import type { Ref } from "vue";
import type { SelectionIntent } from "@nb-hub/contracts";
import { ref } from "vue";
import { assistApi } from "../api/assist.js";
import { getSelectionMarkdown } from "../extensions/selectionMarkdownExport.js";
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
  let transformReqSeq = 0;

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
    /** 请求发出前固定选区；异步返回后仍替换这一段（不读当前光标）。 */
    const savedRange = { from, to };
    const selectedText = getSelectionMarkdown(ed);
    const my = ++transformReqSeq;
    assistLoading.value = true;
    assistError.value = null;
    try {
      const data = await assistApi.selectionTransform({
        documentId: docs.documentId ?? undefined,
        selectedText,
        intent,
        surroundingContext: ed.getMarkdown().slice(0, 8000),
      });
      if (my !== transformReqSeq) return;
      const edNow = editor.value;
      if (!edNow) return;
      const maxPos = edNow.state.doc.content.size;
      let replaceFrom = Math.max(0, Math.min(savedRange.from, maxPos));
      let replaceTo = Math.max(0, Math.min(savedRange.to, maxPos));
      if (replaceFrom > replaceTo) {
        [replaceFrom, replaceTo] = [replaceTo, replaceFrom];
      }
      if (replaceFrom >= replaceTo) {
        assistError.value = "选区已失效，请重新选择后再试";
        return;
      }
      edNow
        .chain()
        .focus()
        .deleteRange({ from: replaceFrom, to: replaceTo })
        .insertContentAt(replaceFrom, data.replacementText, {
          contentType: "markdown",
        })
        .run();
    } catch (e) {
      assistError.value = e instanceof Error ? e.message : String(e);
    } finally {
      if (my === transformReqSeq) {
        assistLoading.value = false;
      }
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
      ed.chain()
        .focus()
        .insertContentAt(ed.state.selection.from, block, {
          contentType: "markdown",
        })
        .run();
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
