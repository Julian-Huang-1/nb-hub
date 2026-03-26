import { Router, type Request, type Response } from "express";
import type {
  CreateDocumentBody,
  PublishDocumentBody,
  SaveDraftBody,
} from "@nb-hub/contracts";
import { documentsService } from "./documents.service.js";

type IdParams = { id: string };

const parseDocumentId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("invalid document id");
  }
  return id;
};
const requireUserId = (req: Request) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new Error("unauthorized");
  }
  return userId;
};

export const documentsRouter = Router();

documentsRouter.get("/", (_req: Request, res: Response) => {
  try {
    const data = documentsService.listDocuments(requireUserId(_req));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

documentsRouter.post(
  "/",
  (req: Request<Record<string, never>, unknown, CreateDocumentBody>, res: Response) => {
    try {
      const data = documentsService.createDocument(requireUserId(req), req.body ?? {});
      res.status(201).json({ status: "ok", data });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

documentsRouter.put(
  "/:id/draft",
  (req: Request<IdParams, unknown, SaveDraftBody>, res: Response) => {
    try {
      const userId = requireUserId(req);
      const documentId = parseDocumentId(req.params.id);
      const data = documentsService.saveDraft(userId, documentId, req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "document not found" ? 404 : 400;
      res.status(statusCode).json({ status: "error", message });
    }
  },
);

documentsRouter.post(
  "/:id/publish",
  (req: Request<IdParams, unknown, PublishDocumentBody>, res: Response) => {
    try {
      const userId = requireUserId(req);
      const documentId = parseDocumentId(req.params.id);
      const data = documentsService.publishDocument(userId, documentId, req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "document not found" ? 404 : 400;
      res.status(statusCode).json({ status: "error", message });
    }
  },
);

documentsRouter.get("/:id", (req: Request<IdParams>, res: Response) => {
  try {
    const userId = requireUserId(req);
    const documentId = parseDocumentId(req.params.id);
    const data = documentsService.getDocument(userId, documentId);
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message === "document not found" ? 404 : 400;
    res.status(statusCode).json({ status: "error", message });
  }
});

documentsRouter.get(
  "/:id/versions",
  (req: Request<IdParams>, res: Response) => {
    try {
      const userId = requireUserId(req);
      const documentId = parseDocumentId(req.params.id);
      const data = documentsService.listVersions(userId, documentId);
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "document not found" ? 404 : 400;
      res.status(statusCode).json({ status: "error", message });
    }
  },
);

documentsRouter.delete("/:id", (req: Request<IdParams>, res: Response) => {
  try {
    const userId = requireUserId(req);
    const documentId = parseDocumentId(req.params.id);
    const data = documentsService.deleteDocument(userId, documentId);
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message === "document not found" ? 404 : 400;
    res.status(statusCode).json({ status: "error", message });
  }
});
