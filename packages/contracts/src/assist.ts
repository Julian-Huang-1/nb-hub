import type {
  AssistFeature,
  AssistFeedbackAction,
  CursorGenerationsResult,
  InlineCompletionsResult,
  SelectionIntent,
  SelectionTransformResult,
} from "./assist-domain.js";

export type AssistCursorDto = {
  offset?: number;
  line?: number;
  column?: number;
};

/** `POST /assist/inline-completions` */
export type InlineCompletionsBody = {
  documentId?: number;
  cursor?: AssistCursorDto;
  prefixText?: string;
  suffixText?: string;
  recentChatContext?: string;
  maxTokens?: number;
  temperature?: number;
};

export type InlineCompletionsResponseData = InlineCompletionsResult & {
  requestId: string;
  documentId?: unknown;
  cursor?: AssistCursorDto;
  latencyMs: number;
};

export type InlineCompletionsCancelBody = {
  requestId?: string;
};

export type InlineCompletionsCancelResponseData = {
  ok: true;
  cancelled: boolean;
  requestId?: string;
};

/** `POST /assist/selection-transforms` */
export type SelectionTransformBody = {
  documentId?: number;
  selection?: unknown;
  selectedText: string;
  intent: SelectionIntent;
  customInstruction?: string;
  surroundingContext?: string;
};

export type SelectionTransformResponseData = SelectionTransformResult & {
  requestId: string;
  documentId?: unknown;
  selection?: unknown;
  latencyMs: number;
};

/** `POST /assist/cursor-generations` */
export type CursorGenerationsBody = {
  documentId?: number;
  cursor?: AssistCursorDto;
  intent: string;
  documentOutline?: string;
  currentSectionContext?: string;
  desiredLength?: "short" | "medium" | "long";
};

export type CursorGenerationsResponseData = CursorGenerationsResult & {
  requestId: string;
  documentId?: unknown;
  cursor?: AssistCursorDto;
  latencyMs: number;
};

/** SSE `data:` payloads for `POST /assist/cursor-generations/stream` */
export type CursorGenerationStreamChunk = {
  type: "chunk";
  text: string;
};

export type CursorGenerationStreamDone = {
  type: "done";
  requestId: string;
  model: string;
  latencyMs: number;
  insertMode: "insert" | "replaceSelection" | "appendSection";
};

export type AssistFeedbackBody = {
  requestId: string;
  action: AssistFeedbackAction;
  feature: AssistFeature;
};

export type AssistFeedbackResponseData = {
  ok: true;
  requestId: string;
  action: AssistFeedbackAction;
  feature: AssistFeature;
};

export type AssistModelCapabilityDto = {
  id: string;
  label: string;
  capabilities: {
    inlineCompletion: boolean;
    selectionTransform: boolean;
    cursorGeneration: boolean;
    streaming: boolean;
    maxOutputTokens: number;
  };
};

/** `GET /assist/models/capabilities` */
export type AssistModelsCapabilitiesResponseData = {
  models: AssistModelCapabilityDto[];
  defaultModel: string;
};
