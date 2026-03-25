import { randomUUID } from "node:crypto";
import { assistOrchestrator } from "../ai/assist-orchestrator.js";
import type { AssistFeature, AssistFeedbackAction, SelectionIntent } from "./assist.types.js";

const VALID_INTENTS: SelectionIntent[] = [
  "shorten",
  "expand",
  "academic",
  "casual",
  "codeify",
  "custom",
];

const parseOptionalDocumentId = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("invalid documentId");
  return n;
};

const parseCursor = (body: Record<string, unknown>) => {
  const c = body.cursor;
  if (c && typeof c === "object" && c !== null) {
    const o = c as Record<string, unknown>;
    if (typeof o.offset === "number" && Number.isInteger(o.offset) && o.offset >= 0) {
      return { offset: o.offset, line: o.line, column: o.column };
    }
    if (typeof o.line === "number" && typeof o.column === "number") {
      return { line: o.line, column: o.column, offset: o.offset };
    }
  }
  return undefined;
};

export const assistService = {
  inlineCompletions(body: Record<string, unknown>) {
    parseOptionalDocumentId(body.documentId);
    const prefixText = typeof body.prefixText === "string" ? body.prefixText : "";
    const suffixText = typeof body.suffixText === "string" ? body.suffixText : "";
    const recentChatContext =
      typeof body.recentChatContext === "string" ? body.recentChatContext : undefined;
    const t0 = performance.now();
    const out = assistOrchestrator.inlineCompletions({
      prefixText,
      suffixText,
      recentChatContext,
    });
    const latencyMs = Math.round(performance.now() - t0);
    return {
      requestId: randomUUID(),
      documentId: body.documentId,
      cursor: parseCursor(body),
      ...out,
      latencyMs,
    };
  },

  acknowledgeCancel(body: Record<string, unknown>) {
    const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
    return { ok: true as const, cancelled: Boolean(requestId), requestId };
  },

  selectionTransform(body: Record<string, unknown>) {
    parseOptionalDocumentId(body.documentId);
    const selectedText = typeof body.selectedText === "string" ? body.selectedText : "";
    if (!selectedText.trim()) throw new Error("selectedText is required");
    const intent = body.intent as string;
    if (!VALID_INTENTS.includes(intent as SelectionIntent)) {
      throw new Error(`intent must be one of: ${VALID_INTENTS.join(", ")}`);
    }
    if (intent === "custom") {
      const instr = body.customInstruction;
      if (typeof instr !== "string" || !instr.trim()) {
        throw new Error("customInstruction is required when intent is custom");
      }
    }
    const customInstruction =
      typeof body.customInstruction === "string" ? body.customInstruction : undefined;
    const surroundingContext =
      typeof body.surroundingContext === "string" ? body.surroundingContext : undefined;
    const t0 = performance.now();
    const out = assistOrchestrator.selectionTransform({
      selectedText,
      intent: intent as SelectionIntent,
      customInstruction,
      surroundingContext,
    });
    const latencyMs = Math.round(performance.now() - t0);
    return {
      requestId: randomUUID(),
      documentId: body.documentId,
      selection: body.selection,
      ...out,
      latencyMs,
    };
  },

  cursorGenerations(body: Record<string, unknown>) {
    parseOptionalDocumentId(body.documentId);
    const intent = typeof body.intent === "string" ? body.intent.trim() : "";
    if (!intent) throw new Error("intent is required");
    const documentOutline =
      typeof body.documentOutline === "string" ? body.documentOutline : undefined;
    const currentSectionContext =
      typeof body.currentSectionContext === "string" ? body.currentSectionContext : undefined;
    const dl = body.desiredLength;
    const desiredLength =
      dl === "short" || dl === "medium" || dl === "long" ? dl : undefined;
    const t0 = performance.now();
    const out = assistOrchestrator.cursorGenerations({
      intent,
      documentOutline,
      currentSectionContext,
      desiredLength,
    });
    const latencyMs = Math.round(performance.now() - t0);
    return {
      requestId: randomUUID(),
      documentId: body.documentId,
      cursor: parseCursor(body),
      ...out,
      latencyMs,
    };
  },

  recordFeedback(body: Record<string, unknown>) {
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const action = body.action as AssistFeedbackAction;
    const feature = body.feature as AssistFeature;
    const validActions: AssistFeedbackAction[] = ["accept", "reject", "edit_after_accept"];
    const validFeatures: AssistFeature[] = ["inline", "selection", "cursor_generation"];
    if (!requestId) throw new Error("requestId is required");
    if (!validActions.includes(action)) {
      throw new Error(`action must be one of: ${validActions.join(", ")}`);
    }
    if (!validFeatures.includes(feature)) {
      throw new Error(`feature must be one of: ${validFeatures.join(", ")}`);
    }
    return { ok: true as const, requestId, action, feature };
  },

  modelCapabilities() {
    return {
      models: [
        {
          id: "stub-assist-v1",
          label: "Stub (replace with real model)",
          capabilities: {
            inlineCompletion: true,
            selectionTransform: true,
            cursorGeneration: true,
            streaming: true,
            maxOutputTokens: 2048,
          },
        },
      ],
      defaultModel: "stub-assist-v1",
    };
  },
};
