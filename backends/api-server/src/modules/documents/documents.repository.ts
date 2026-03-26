import { desc, eq } from "drizzle-orm";
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
  listDocuments: () => {
    return db.select().from(documents).orderBy(desc(documents.updatedAt)).all();
  },

  createDocument: ({ title, slug }: CreateDocumentInput) => {
    const now = new Date();
    const [document] = db
      .insert(documents)
      .values({
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

  updateDocumentMeta: (documentId: number, values: Partial<typeof documents.$inferInsert>) => {
    const [document] = db
      .update(documents)
      .set(values)
      .where(eq(documents.id, documentId))
      .returning()
      .all();
    return document;
  },

  findDocumentById: (documentId: number) => {
    return db.select().from(documents).where(eq(documents.id, documentId)).get();
  },

  findDocumentBySlug: (slug: string) => {
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
};
