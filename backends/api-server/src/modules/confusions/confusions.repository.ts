import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { confusionResolutions, confusions, solutionDocs } from "../../db/schema.js";

export const confusionsRepository = {
  createConfusion: (payload: {
    userId: string;
    sessionId: number;
    sourceMessageId: number;
    title: string;
    description: string;
    tags: string[];
  }) => {
    const [row] = db
      .insert(confusions)
      .values({
        userId: payload.userId,
        sessionId: payload.sessionId,
        sourceMessageId: payload.sourceMessageId,
        title: payload.title,
        description: payload.description,
        status: "open",
        tagsJson: JSON.stringify(payload.tags),
      })
      .returning()
      .all();
    return row;
  },

  listConfusions: (userId: string, status?: string) => {
    if (status) {
      return db
        .select()
        .from(confusions)
        .where(and(eq(confusions.userId, userId), eq(confusions.status, status)))
        .orderBy(desc(confusions.id))
        .all();
    }
    return db
      .select()
      .from(confusions)
      .where(eq(confusions.userId, userId))
      .orderBy(desc(confusions.id))
      .all();
  },

  findConfusionById: (userId: string, confusionId: number) => {
    return db
      .select()
      .from(confusions)
      .where(and(eq(confusions.id, confusionId), eq(confusions.userId, userId)))
      .get();
  },

  updateConfusionResolved: (userId: string, confusionId: number) => {
    const [row] = db
      .update(confusions)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(confusions.id, confusionId), eq(confusions.userId, userId)))
      .returning()
      .all();
    return row;
  },

  createResolution: (payload: {
    confusionId: number;
    resolvedByMessageId?: number;
    resolutionMd: string;
    confidence: number;
  }) => {
    const [row] = db
      .insert(confusionResolutions)
      .values({
        confusionId: payload.confusionId,
        resolvedByMessageId: payload.resolvedByMessageId ?? null,
        resolutionMd: payload.resolutionMd,
        confidence: payload.confidence,
      })
      .returning()
      .all();
    return row;
  },

  listResolutionsByConfusionId: (confusionId: number) => {
    return db
      .select()
      .from(confusionResolutions)
      .where(eq(confusionResolutions.confusionId, confusionId))
      .orderBy(desc(confusionResolutions.id))
      .all();
  },

  countAll: () => db.select().from(confusions).all().length,

  countByStatus: (status: "open" | "resolved") =>
    db.select().from(confusions).where(eq(confusions.status, status)).all().length,

  countCreatedAfter: (after: Date) =>
    db.select().from(confusions).where(gte(confusions.createdAt, after)).all().length,

  listResolvedInPeriod: (after: Date) =>
    db
      .select()
      .from(confusions)
      .where(and(eq(confusions.status, "resolved"), gte(confusions.resolvedAt, after)))
      .orderBy(desc(confusions.id))
      .all(),

  upsertSolutionDoc: (payload: {
    periodKey: string;
    title: string;
    contentMd: string;
    statsJson: string;
  }) => {
    const existing = db
      .select()
      .from(solutionDocs)
      .where(eq(solutionDocs.periodKey, payload.periodKey))
      .get();

    if (!existing) {
      const [created] = db
        .insert(solutionDocs)
        .values(payload)
        .returning()
        .all();
      return created;
    }

    const [updated] = db
      .update(solutionDocs)
      .set({
        title: payload.title,
        contentMd: payload.contentMd,
        statsJson: payload.statsJson,
      })
      .where(eq(solutionDocs.id, existing.id))
      .returning()
      .all();
    return updated;
  },

  listSolutionDocs: () => {
    return db.select().from(solutionDocs).orderBy(desc(solutionDocs.id)).all();
  },
};
