import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { chatMessages, chatSessions } from "../../db/schema.js";

export const chatRepository = {
  createSession: (userId: string, title: string) => {
    const now = new Date();
    const [session] = db
      .insert(chatSessions)
      .values({ userId, title, status: "active", createdAt: now, updatedAt: now })
      .returning()
      .all();
    return session;
  },

  findSessionById: (userId: string, sessionId: number) => {
    return db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .get();
  },

  listSessions: (userId: string) => {
    return db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.id))
      .all();
  },

  updateSessionUpdatedAt: (userId: string, sessionId: number) => {
    const [session] = db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
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
