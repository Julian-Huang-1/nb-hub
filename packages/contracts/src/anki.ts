import type { IsoDateString } from "./common.js";

export type AnkiNoteDto = {
  id: number;
  deckName: string;
  front: string;
  back: string;
  tagsJson: string;
  ease: number;
  intervalDays: number;
  reps: number;
  dueAt: IsoDateString | null;
  createdAt: IsoDateString;
};

export type ImportAnkiPlainTextBody = {
  /** Raw `.txt` content (Anki plain text: tab-separated fields per line). */
  text: string;
};

export type ImportAnkiPlainTextResponseData = {
  imported: number;
  skipped: number;
  /** Distinct deck names present in the imported rows. */
  decks: string[];
};

export type ListAnkiNotesQuery = {
  deck?: string;
  limit?: string;
  offset?: string;
  /** When `1`, only notes that are new or due now or earlier. */
  due?: string;
};

export type ListAnkiNotesResponseData = AnkiNoteDto[];

export type ListAnkiDecksResponseData = string[];

export type ReviewAnkiNoteBody = {
  rating: "again" | "hard" | "good" | "easy";
};

export type ReviewAnkiNoteResponseData = {
  note: AnkiNoteDto;
};
