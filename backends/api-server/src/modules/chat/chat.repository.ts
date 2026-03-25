import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { chatMessages, chatSessions } from "../../db/schema.js";

export const chatRepository = {
  createSession: (title: string) => {
    const now = new Date();
    const [session] = db
      .insert(chatSessions)
      .values({ title, status: "active", createdAt: now, updatedAt: now })
      .returning()
      .all();
    return session;
  },

  findSessionById: (sessionId: number) => {
    return db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).get();
  },

  listSessions: () => {
    return db.select().from(chatSessions).orderBy(desc(chatSessions.id)).all();
  },

  updateSessionUpdatedAt: (sessionId: number) => {
    const [session] = db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId))
      .returning()
      .all();
    return session;
  },

  createMessage: (payload: {
    sessionId: number;
    role: "user" | "assistant";
    content: string;
    metadataJson?: string;
  }) => {
    const [message] = db
      .insert(chatMessages)
      .values({
        sessionId: payload.sessionId,
        role: payload.role,
        content: payload.content,
        metadataJson: payload.metadataJson ?? null,
      })
      .returning()
      .all();
    return message;
  },

  listMessagesBySessionId: (sessionId: number) => {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.id)
      .all();
  },
};
