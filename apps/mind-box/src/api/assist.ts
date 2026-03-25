import type {
  CursorGenerationsBody,
  CursorGenerationsResponseData,
  InlineCompletionsBody,
  InlineCompletionsResponseData,
  SelectionTransformBody,
  SelectionTransformResponseData,
} from "@nb-hub/contracts";
import { apiOkData } from "./http.js";

export const assistApi = {
  inlineCompletions(body: InlineCompletionsBody) {
    return apiOkData<InlineCompletionsResponseData>(
      "/assist/inline-completions",
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  selectionTransform(body: SelectionTransformBody) {
    return apiOkData<SelectionTransformResponseData>(
      "/assist/selection-transforms",
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  cursorGenerate(body: CursorGenerationsBody) {
    return apiOkData<CursorGenerationsResponseData>(
      "/assist/cursor-generations",
      { method: "POST", body: JSON.stringify(body) },
    );
  },
};
