import type { Editor, JSONContent } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

declare module "@tiptap/core" {
  interface Editor {
    /**
     * Serialize the current selection to Markdown using the same pipeline as
     * `getMarkdown()`. Returns "" when the selection is empty. Falls back to
     * `textBetween` when the Markdown extension is not present.
     */
    getSelectionMarkdown: () => string;
  }
}

type MarkdownManager = NonNullable<Editor["markdown"]>;

function getMarkdownManager(editor: Editor): MarkdownManager | null {
  const fromStorage = (
    editor.storage as { markdown?: { manager?: MarkdownManager } }
  ).markdown?.manager;
  if (fromStorage) return fromStorage;
  return editor.markdown ?? null;
}

function sliceToDocJson(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): JSONContent {
  const slice = doc.slice(from, to);
  const content: JSONContent[] = [];
  slice.content.forEach((node) => {
    content.push(node.toJSON() as JSONContent);
  });
  return { type: "doc", content };
}

/**
 * Selection → Markdown via the same `MarkdownManager` as `editor.getMarkdown()`.
 * Prefer this over `editor.getSelectionMarkdown()` when calling from composables
 * so resolution does not depend on extension hook order.
 */
export function getSelectionMarkdown(editor: Editor): string {
  const { state } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return "";

  const plain = state.doc.textBetween(from, to, "\n", "\n");

  const slice = state.doc.slice(from, to);
  if (slice.size === 0) {
    return plain;
  }

  const manager = getMarkdownManager(editor);
  if (!manager) {
    return plain;
  }

  const docJson = sliceToDocJson(state.doc, from, to);
  if (!docJson.content?.length) {
    return plain;
  }

  try {
    const md = manager.serialize(docJson);
    if (typeof md === "string" && md.replace(/\u00A0/g, " ").trim() !== "") {
      return md;
    }
  } catch {
    /* fall through */
  }

  return plain;
}

/**
 * Registers `editor.getSelectionMarkdown()` for AI / export use.
 * Must be listed **after** `@tiptap/markdown`'s `Markdown` extension.
 */
export const SelectionMarkdownExport = Extension.create({
  name: "selectionMarkdownExport",
  priority: 50,

  onCreate() {
    this.editor.getSelectionMarkdown = () => getSelectionMarkdown(this.editor);
  },
});
