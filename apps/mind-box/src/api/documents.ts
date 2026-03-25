import type {
  CreateDocumentBody,
  CreateDocumentResponseData,
  GetDocumentResponseData,
  ListDocumentVersionsResponseData,
  PublishDocumentBody,
  SaveDraftBody,
  SaveOrPublishDocumentResponseData,
} from "@nb-hub/contracts";
import { apiOkData } from "./http.js";

export const documentsApi = {
  create(body: CreateDocumentBody) {
    return apiOkData<CreateDocumentResponseData>("/documents", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  saveDraft(id: number, body: SaveDraftBody) {
    return apiOkData<SaveOrPublishDocumentResponseData>(
      `/documents/${id}/draft`,
      { method: "PUT", body: JSON.stringify(body) },
    );
  },

  publish(id: number, body: PublishDocumentBody) {
    return apiOkData<SaveOrPublishDocumentResponseData>(
      `/documents/${id}/publish`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  get(id: number) {
    return apiOkData<GetDocumentResponseData>(`/documents/${id}`);
  },

  listVersions(id: number) {
    return apiOkData<ListDocumentVersionsResponseData>(
      `/documents/${id}/versions`,
    );
  },
};
