import type {
  AnkiNoteDto,
  ImportAnkiPlainTextBody,
  ImportAnkiPlainTextResponseData,
  ListAnkiNotesResponseData,
  ListAnkiDecksResponseData,
  ReviewAnkiNoteBody,
  ReviewAnkiNoteResponseData,
} from "@nb-hub/contracts";
import { apiOkData } from "./http";

export async function importAnkiPlainText(
  body: ImportAnkiPlainTextBody,
): Promise<ImportAnkiPlainTextResponseData> {
  return apiOkData<ImportAnkiPlainTextResponseData>("/anki/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listAnkiNotes(params: {
  deck?: string;
  limit?: number;
  offset?: number;
  dueOnly?: boolean;
}): Promise<ListAnkiNotesResponseData> {
  const sp = new URLSearchParams();
  if (params.deck) sp.set("deck", params.deck);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  if (params.dueOnly) sp.set("due", "1");
  const q = sp.toString();
  return apiOkData<ListAnkiNotesResponseData>(`/anki/notes${q ? `?${q}` : ""}`);
}

export async function listAnkiDecks(): Promise<ListAnkiDecksResponseData> {
  return apiOkData<ListAnkiDecksResponseData>("/anki/decks");
}

export async function reviewAnkiNote(
  id: number,
  body: ReviewAnkiNoteBody,
): Promise<ReviewAnkiNoteResponseData> {
  return apiOkData<ReviewAnkiNoteResponseData>(`/anki/notes/${id}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type { AnkiNoteDto };
