import {
  Router,
  type Request,
  type Response,
} from "express";
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

export const documentsRouter = Router();

documentsRouter.post("/", (req: Request<unknown, unknown, CreateDocumentBody>, res: Response) => {
  try {
    const data = documentsService.createDocument(req.body ?? {});
    res.status(201).json({ status: "ok", data });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

documentsRouter.put(
  "/:id/draft",
  (req: Request<IdParams, unknown, SaveDraftBody>, res: Response) => {
    try {
      const documentId = parseDocumentId(req.params.id);
      const data = documentsService.saveDraft(documentId, req.body ?? {});
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
      const documentId = parseDocumentId(req.params.id);
      const data = documentsService.publishDocument(documentId, req.body ?? {});
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
    const documentId = parseDocumentId(req.params.id);
    const data = documentsService.getDocument(documentId);
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message === "document not found" ? 404 : 400;
    res.status(statusCode).json({ status: "error", message });
  }
});

documentsRouter.get("/:id/versions", (req: Request<IdParams>, res: Response) => {
  try {
    const documentId = parseDocumentId(req.params.id);
    const data = documentsService.listVersions(documentId);
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message === "document not found" ? 404 : 400;
    res.status(statusCode).json({ status: "error", message });
  }
});
