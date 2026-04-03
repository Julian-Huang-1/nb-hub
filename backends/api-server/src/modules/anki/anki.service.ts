import type { AnkiNoteDto, ReviewAnkiNoteBody } from "@nb-hub/contracts";
import { parseAnkiPlainText } from "./anki.parse.js";
import { ankiRepository, type AnkiNoteRow } from "./anki.repository.js";

const MIN_EASE = 1300;

const toDto = (row: AnkiNoteRow): AnkiNoteDto => ({
  id: row.id,
  deckName: row.deckName,
  front: row.front,
  back: row.back,
  tagsJson: row.tagsJson,
  ease: row.ease,
  intervalDays: row.intervalDays,
  reps: row.reps,
  dueAt: row.dueAt ? row.dueAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
});

const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
};

const addMinutes = (d: Date, minutes: number) => {
  const x = new Date(d);
  x.setUTCMinutes(x.getUTCMinutes() + minutes);
  return x;
};

function applyReview(row: AnkiNoteRow, rating: ReviewAnkiNoteBody["rating"]): {
  ease: number;
  intervalDays: number;
  reps: number;
  dueAt: Date | null;
} {
  const now = new Date();
  let ease = row.ease;
  let intervalDays = row.intervalDays;
  let reps = row.reps;

  switch (rating) {
    case "again":
      ease = Math.max(MIN_EASE, ease - 200);
      reps = 0;
      intervalDays = 0;
      return { ease, intervalDays, reps, dueAt: addMinutes(now, 10) };
    case "hard":
      ease = Math.max(MIN_EASE, ease - 150);
      if (reps === 0 && row.intervalDays === 0) {
        intervalDays = 1;
      } else {
        intervalDays = Math.max(1, Math.round(intervalDays * 1.2 || 1));
      }
      reps += 1;
      return { ease, intervalDays, reps, dueAt: addDays(now, intervalDays) };
    case "good":
      if (reps === 0 && row.intervalDays === 0) {
        intervalDays = 1;
      } else if (reps === 1 && row.intervalDays <= 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.max(1, Math.round(intervalDays * (ease / 1000)));
      }
      reps += 1;
      return { ease, intervalDays, reps, dueAt: addDays(now, intervalDays) };
    case "easy":
      ease += 150;
      if (reps === 0 && row.intervalDays === 0) {
        intervalDays = 4;
      } else {
        intervalDays = Math.max(1, Math.round(intervalDays * (ease / 1000) * 1.3));
      }
      reps += 1;
      return { ease, intervalDays, reps, dueAt: addDays(now, intervalDays) };
    default:
      return {
        ease: row.ease,
        intervalDays: row.intervalDays,
        reps: row.reps,
        dueAt: row.dueAt ?? null,
      };
  }
}

export const ankiService = {
  importPlainText: (userId: string, text: string) => {
    const parsed = parseAnkiPlainText(text);
    const skipped = 0;
    const rows = parsed.map((line) => ({
      deckName: line.deckName,
      front: line.front,
      back: line.back,
      tagsJson: JSON.stringify(line.tags),
    }));
    const inserted = ankiRepository.insertMany(userId, rows);
    const decks = [...new Set(parsed.map((l) => l.deckName))];
    return {
      imported: inserted.length,
      skipped,
      decks,
    };
  },

  listNotes: (
    userId: string,
    query: { deck?: string; limit: number; offset: number; dueOnly: boolean },
  ) => {
    return ankiRepository.listByUser(userId, query).map(toDto);
  },

  listDecks: (userId: string) => ankiRepository.listDeckNames(userId),

  review: (userId: string, id: number, body: ReviewAnkiNoteBody) => {
    const row = ankiRepository.findById(userId, id);
    if (!row) throw new Error("note not found");
    const next = applyReview(row, body.rating);
    const updated = ankiRepository.updateScheduling(userId, id, next);
    if (!updated) throw new Error("note not found");
    return { note: toDto(updated) };
  },
};
