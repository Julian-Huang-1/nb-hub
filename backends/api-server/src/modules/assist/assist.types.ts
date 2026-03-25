export type InlineCompletionCandidate = {
  text: string;
  confidence: number;
  stopReason?: string;
};

export type InlineCompletionsResult = {
  candidates: InlineCompletionCandidate[];
  model: string;
  latencyMs: number;
};

export type SelectionIntent =
  | "shorten"
  | "expand"
  | "academic"
  | "casual"
  | "codeify"
  | "custom";

export type SelectionTransformResult = {
  replacementText: string;
  diff?: string;
  alternatives?: string[];
  explanation?: string;
  model: string;
  latencyMs: number;
};

export type CursorBlock = {
  markdown: string;
};

export type CursorGenerationsResult = {
  blocks: CursorBlock[];
  insertMode: "insert" | "replaceSelection" | "appendSection";
  model: string;
  latencyMs: number;
};

export type AssistFeedbackAction = "accept" | "reject" | "edit_after_accept";

export type AssistFeature = "inline" | "selection" | "cursor_generation";
