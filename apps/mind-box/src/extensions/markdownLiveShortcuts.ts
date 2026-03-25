import { Extension, InputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/**
 * Extra Markdown-style input rules on top of StarterKit (headings, lists,
 * **bold**, *italic*, `code`, blockquote, `---`, ``` code fences, etc.).
 *
 * Adds: `[label](url)` at end of line → linked label text.
 */
export const MarkdownLiveShortcuts = Extension.create({
  name: "markdownLiveShortcuts",

  addInputRules() {
    return [
      new InputRule({
        find: /(^|\s)(\[([^\]]+)]\(([^)]+)\))$/,
        handler: ({ state, range, match }) => {
          const link = state.schema.marks.link;
          if (!link) return null;

          const bracketPart = match[2];
          const label = match[3];
          let href = match[4].trim();
          if (!label || !href) return null;

          if (
            !/^([a-z][a-z0-9+.-]*:|\/|#|mailto:)/i.test(href) &&
            /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(href)
          ) {
            href = `https://${href}`;
          }

          const to = range.to;
          const from = to - bracketPart.length;

          const code = state.schema.marks.code;
          if (code && state.doc.rangeHasMark(from, to, code)) {
            return null;
          }

          if (state.doc.resolve(from).parent.type.spec.code) {
            return null;
          }

          const { tr } = state;
          tr.delete(from, to);
          tr.insert(from, state.schema.text(label, [link.create({ href })]));
          tr.setStoredMarks([]);
          const end = from + label.length;
          tr.setSelection(TextSelection.create(tr.doc, end));
        },
      }),
    ];
  },
});
