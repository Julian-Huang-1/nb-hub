import type { IsoDateString } from "./common.js";

export type CreateDocumentBody = {
  title: string;
  contentMd?: string;
};

export type SaveDraftBody = {
  title?: string;
  contentMd: string;
};

export type PublishDocumentBody = {
  title?: string;
  contentMd?: string;
};

export type DocumentDto = {
  id: number;
  title: string;
  slug: string;
  status: string;
  currentVersionId: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  publishedAt: IsoDateString | null;
};

export type DocumentVersionDto = {
  id: number;
  documentId: number;
  title: string;
  contentMd: string;
  source: string;
  createdAt: IsoDateString;
};

/** `POST /documents` */
export type CreateDocumentResponseData = DocumentDto;

/** `PUT /documents/:id/draft` | `POST /documents/:id/publish` */
export type SaveOrPublishDocumentResponseData = {
  document: DocumentDto | undefined;
  version: DocumentVersionDto;
};

/** `GET /documents/:id` */
export type GetDocumentResponseData = {
  document: DocumentDto;
  currentVersion: DocumentVersionDto | null;
};

/** `GET /documents/:id/versions` */
export type ListDocumentVersionsResponseData = DocumentVersionDto[];
