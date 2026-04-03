import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { ankiNotes } from "../../db/schema.js";

export type AnkiNoteRow = typeof ankiNotes.$inferSelect;

export const ankiRepository = {
  insertMany: (
    userId: string,
    rows: {
      deckName: string;
      front: string;
      back: string;
      tagsJson: string;
    }[],
  ) => {
    if (rows.length === 0) return [] as AnkiNoteRow[];
    const now = new Date();
    return db
      .insert(ankiNotes)
      .values(
        rows.map((r) => ({
          userId,
          deckName: r.deckName,
          front: r.front,
          back: r.back,
          tagsJson: r.tagsJson,
          ease: 2500,
          intervalDays: 0,
          reps: 0,
          dueAt: null,
          createdAt: now,
        })),
      )
      .returning()
      .all();
  },

  listByUser: (
    userId: string,
    opts: { deck?: string; limit: number; offset: number; dueOnly: boolean },
  ) => {
    const conditions = [eq(ankiNotes.userId, userId)];
    if (opts.deck) {
      conditions.push(eq(ankiNotes.deckName, opts.deck));
    }
    if (opts.dueOnly) {
      const now = new Date();
      conditions.push(or(isNull(ankiNotes.dueAt), lte(ankiNotes.dueAt, now)));
    }
    return db
      .select()
      .from(ankiNotes)
      .where(and(...conditions))
      .orderBy(desc(ankiNotes.id))
      .limit(opts.limit)
      .offset(opts.offset)
      .all();
  },

  listDeckNames: (userId: string) => {
    const rows = db
      .selectDistinct({ deckName: ankiNotes.deckName })
      .from(ankiNotes)
      .where(eq(ankiNotes.userId, userId))
      .orderBy(ankiNotes.deckName)
      .all();
    return rows.map((r) => r.deckName);
  },

  findById: (userId: string, id: number) => {
    return db
      .select()
      .from(ankiNotes)
      .where(and(eq(ankiNotes.userId, userId), eq(ankiNotes.id, id)))
      .get();
  },

  updateScheduling: (
    userId: string,
    id: number,
    patch: {
      ease: number;
      intervalDays: number;
      reps: number;
      dueAt: Date | null;
    },
  ) => {
    const [row] = db
      .update(ankiNotes)
      .set(patch)
      .where(and(eq(ankiNotes.userId, userId), eq(ankiNotes.id, id)))
      .returning()
      .all();
    return row;
  },
};
