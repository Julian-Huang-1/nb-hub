import type {
  CursorGenerationsResult,
  InlineCompletionsResult,
  SelectionIntent,
  SelectionTransformResult,
} from "@nb-hub/contracts";

const MODEL_STUB = "stub-assist-v1";

export const assistOrchestrator = {
  inlineCompletions(input: {
    prefixText: string;
    suffixText: string;
    recentChatContext?: string;
  }): Omit<InlineCompletionsResult, "latencyMs"> {
    const tail = input.prefixText.slice(-120);
    const hint = tail.trim().length > 0 ? `继续：${tail.slice(-40)}` : "从这里开始写下去";
    const withChat =
      input.recentChatContext?.trim()
        ? `\n\n（参考近期对话要点）${input.recentChatContext.slice(0, 200)}`
        : "";
    return {
      model: MODEL_STUB,
      candidates: [
        { text: `${hint}——先列出要点，再展开论证。${withChat}`, confidence: 0.72, stopReason: "length" },
        { text: "下一步可以补充一个具体例子或反例，增强说服力。", confidence: 0.55, stopReason: "length" },
      ],
    };
  },

  selectionTransform(input: {
    selectedText: string;
    intent: SelectionIntent;
    customInstruction?: string;
    surroundingContext?: string;
  }): Omit<SelectionTransformResult, "latencyMs"> {
    const { selectedText, intent, customInstruction } = input;
    let replacement = selectedText;
    switch (intent) {
      case "shorten":
        replacement = selectedText.replace(/\s+/g, " ").trim().slice(0, Math.max(20, selectedText.length / 2));
        break;
      case "expand":
        replacement = `${selectedText}\n\n（展开）可以进一步说明背景、约束与可验证的结论。`;
        break;
      case "academic":
        replacement = `本文指出：${selectedText.replace(/\.$/, "")}。该表述需在理论与实证层面加以论证。`;
        break;
      case "casual":
        replacement = selectedText.replace(/。/g, "～").replace(/，/g, "，");
        break;
      case "codeify":
        replacement = `\`\`\`text\n${selectedText}\n\`\`\``;
        break;
      case "custom":
        replacement = customInstruction?.trim()
          ? `[按指令改写] ${customInstruction}\n\n${selectedText}`
          : selectedText;
        break;
      default:
        replacement = selectedText;
    }
    return {
      model: MODEL_STUB,
      replacementText: replacement,
      diff: undefined,
      alternatives: [replacement],
      explanation: `intent=${intent}`,
    };
  },

  cursorGenerations(input: {
    intent: string;
    documentOutline?: string;
    currentSectionContext?: string;
    desiredLength?: "short" | "medium" | "long";
  }): Omit<CursorGenerationsResult, "latencyMs"> {
    const len = input.desiredLength ?? "medium";
    const outline = input.documentOutline?.trim() ? `\n\n大纲：\n${input.documentOutline.slice(0, 500)}` : "";
    const section = input.currentSectionContext?.trim()
      ? `\n\n当前段落：\n${input.currentSectionContext.slice(0, 400)}`
      : "";
    const body =
      len === "short"
        ? `- 要点一\n- 要点二`
        : len === "long"
          ? `## 章节草稿\n\n${input.intent}\n\n### 背景\n（简述问题与动机）\n\n### 论证\n（分步推理）\n\n### 小结\n（可执行结论）`
          : `## 段落\n\n${input.intent}\n\n此处可衔接上文，补充定义与例子。`;
    return {
      model: MODEL_STUB,
      blocks: [{ markdown: `${body}${outline}${section}` }],
      insertMode: "insert",
    };
  },
};
