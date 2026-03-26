import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { documents, documentVersions } from "../../db/schema.js";

type CreateDocumentInput = {
  title: string;
  slug: string;
};

type SaveDraftInput = {
  documentId: number;
  title: string;
  contentMd: string;
};

export const documentsRepository = {
  listDocuments: (userId: string) => {
    return db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.updatedAt))
      .all();
  },

  createDocument: ({ userId, title, slug }: CreateDocumentInput & { userId: string }) => {
    const now = new Date();
    const [document] = db
      .insert(documents)
      .values({
        userId,
        title,
        slug,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    return document;
  },

  createVersion: ({ documentId, title, contentMd }: SaveDraftInput) => {
    const [version] = db
      .insert(documentVersions)
      .values({
        documentId,
        title,
        contentMd,
        source: "manual",
      })
      .returning()
      .all();
    return version;
  },

  updateDocumentMeta: (
    userId: string,
    documentId: number,
    values: Partial<typeof documents.$inferInsert>,
  ) => {
    const [document] = db
      .update(documents)
      .set(values)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .returning()
      .all();
    return document;
  },

  findDocumentById: (userId: string, documentId: number) => {
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .get();
  },

  findDocumentBySlug: (userId: string, slug: string) => {
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.slug, slug), eq(documents.userId, userId)))
      .get();
  },

  findDocumentBySlugGlobal: (slug: string) => {
    return db.select().from(documents).where(eq(documents.slug, slug)).get();
  },

  listDocumentVersions: (documentId: number) => {
    return db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.id))
      .all();
  },

  deleteDocumentVersions: (documentId: number) => {
    return db
      .delete(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .run();
  },

  deleteDocument: (userId: string, documentId: number) => {
    const [document] = db
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .returning()
      .all();
    return document;
  },
};
