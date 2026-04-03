import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { todos } from "../../db/schema.js";

export type TodoRow = typeof todos.$inferSelect;

export const todosRepository = {
  listByUser: (userId: string) => {
    return db
      .select()
      .from(todos)
      .where(eq(todos.userId, userId))
      .orderBy(desc(todos.updatedAt))
      .all();
  },

  insert: (userId: string, title: string) => {
    const now = new Date();
    const [row] = db
      .insert(todos)
      .values({
        userId,
        title,
        completed: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    return row;
  },

  findById: (userId: string, id: number) => {
    return db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.id, id)))
      .get();
  },

  update: (
    userId: string,
    id: number,
    patch: { title?: string; completed?: boolean },
  ) => {
    const row = todosRepository.findById(userId, id);
    if (!row) return undefined;
    const nextTitle = patch.title !== undefined ? patch.title.trim() : row.title;
    if (!nextTitle) return undefined;
    const nextCompleted =
      patch.completed !== undefined ? patch.completed : row.completed;
    const [updated] = db
      .update(todos)
      .set({
        title: nextTitle,
        completed: nextCompleted,
        updatedAt: new Date(),
      })
      .where(and(eq(todos.userId, userId), eq(todos.id, id)))
      .returning()
      .all();
    return updated;
  },

  delete: (userId: string, id: number) => {
    const row = todosRepository.findById(userId, id);
    if (!row) return false;
    db.delete(todos).where(and(eq(todos.userId, userId), eq(todos.id, id))).run();
    return true;
  },
};
