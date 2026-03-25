import { documentsRepository } from "./documents.repository.js";

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-|-$)/g, "");

const requireTitle = (title: unknown) => {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("title is required");
  }
  return title.trim();
};

const requireContent = (content: unknown) => {
  if (typeof content !== "string") {
    throw new Error("contentMd is required");
  }
  return content;
};

export const documentsService = {
  createDocument(payload: { title: unknown; contentMd?: unknown }) {
    const title = requireTitle(payload.title);
    const contentMd = typeof payload.contentMd === "string" ? payload.contentMd : "";
    const baseSlug = toSlug(title) || "untitled";

    let slug = baseSlug;
    let counter = 1;
    while (documentsRepository.findDocumentBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    const document = documentsRepository.createDocument({ title, slug });
    const firstVersion = documentsRepository.createVersion({
      documentId: document.id,
      title,
      contentMd,
    });

    documentsRepository.updateDocumentMeta(document.id, {
      currentVersionId: firstVersion.id,
    });

    return {
      ...document,
      currentVersionId: firstVersion.id,
    };
  },

  saveDraft(documentId: number, payload: { title?: unknown; contentMd: unknown }) {
    const existing = documentsRepository.findDocumentById(documentId);
    if (!existing) {
      throw new Error("document not found");
    }

    const title =
      payload.title === undefined ? existing.title : requireTitle(payload.title);
    const contentMd = requireContent(payload.contentMd);
    const now = new Date();
    const version = documentsRepository.createVersion({
      documentId,
      title,
      contentMd,
    });

    const updated = documentsRepository.updateDocumentMeta(documentId, {
      title,
      status: "draft",
      currentVersionId: version.id,
      updatedAt: now,
    });

    return {
      document: updated,
      version,
    };
  },

  publishDocument(documentId: number, payload: { title?: unknown; contentMd?: unknown }) {
    const existing = documentsRepository.findDocumentById(documentId);
    if (!existing) {
      throw new Error("document not found");
    }

    const versions = documentsRepository.listDocumentVersions(documentId);
    const latestVersion = versions[0];
    if (!latestVersion && payload.contentMd === undefined) {
      throw new Error("cannot publish empty document");
    }

    const title =
      payload.title === undefined
        ? latestVersion?.title ?? existing.title
        : requireTitle(payload.title);
    const contentMd =
      payload.contentMd === undefined
        ? latestVersion?.contentMd ?? ""
        : requireContent(payload.contentMd);

    const now = new Date();
    const publishVersion = documentsRepository.createVersion({
      documentId,
      title,
      contentMd,
    });

    const updated = documentsRepository.updateDocumentMeta(documentId, {
      title,
      status: "published",
      currentVersionId: publishVersion.id,
      updatedAt: now,
      publishedAt: now,
    });

    return {
      document: updated,
      version: publishVersion,
    };
  },

  getDocument(documentId: number) {
    const document = documentsRepository.findDocumentById(documentId);
    if (!document) {
      throw new Error("document not found");
    }
    const versions = documentsRepository.listDocumentVersions(documentId);
    const currentVersion =
      versions.find((version) => version.id === document.currentVersionId) ?? versions[0] ?? null;

    return {
      document,
      currentVersion,
    };
  },

  listVersions(documentId: number) {
    const document = documentsRepository.findDocumentById(documentId);
    if (!document) {
      throw new Error("document not found");
    }
    return documentsRepository.listDocumentVersions(documentId);
  },
};
