import type { Request, Response } from "express";
import type {
  ImportAnkiPlainTextBody,
  ListAnkiNotesQuery,
  ReviewAnkiNoteBody,
} from "@nb-hub/contracts";
import { Router } from "express";
import { ankiService } from "./anki.service.js";

type IdParams = { id: string };

const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid id");
  return id;
};

const requireUserId = (req: Request) => {
  const userId = req.auth?.userId;
  if (!userId) throw new Error("unauthorized");
  return userId;
};

const parseLimit = (raw: string | undefined, fallback: number) => {
  const n = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(500, Math.floor(n));
};

const parseOffset = (raw: string | undefined) => {
  const n = raw === undefined ? 0 : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

export const ankiRouter = Router();

ankiRouter.post(
  "/import",
  (req: Request<unknown, unknown, ImportAnkiPlainTextBody>, res: Response) => {
    try {
      const text = typeof req.body?.text === "string" ? req.body.text : "";
      if (!text.trim()) {
        res.status(400).json({ status: "error", message: "text is required" });
        return;
      }
      const data = ankiService.importPlainText(requireUserId(req), text);
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ status: "error", message });
    }
  },
);

ankiRouter.get(
  "/notes",
  (req: Request<unknown, unknown, unknown, ListAnkiNotesQuery>, res: Response) => {
    try {
      const dueOnly = req.query.due === "1" || req.query.due === "true";
      const data = ankiService.listNotes(requireUserId(req), {
        deck: req.query.deck,
        limit: parseLimit(req.query.limit, 100),
        offset: parseOffset(req.query.offset),
        dueOnly,
      });
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ status: "error", message });
    }
  },
);

ankiRouter.get("/decks", (req: Request, res: Response) => {
  try {
    const data = ankiService.listDecks(requireUserId(req));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ status: "error", message });
  }
});

ankiRouter.post(
  "/notes/:id/review",
  (req: Request<IdParams, unknown, ReviewAnkiNoteBody>, res: Response) => {
    try {
      const rating = req.body?.rating;
      if (rating !== "again" && rating !== "hard" && rating !== "good" && rating !== "easy") {
        res.status(400).json({ status: "error", message: "invalid rating" });
        return;
      }
      const data = ankiService.review(requireUserId(req), parseId(req.params.id), { rating });
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(message === "note not found" ? 404 : 400).json({ status: "error", message });
    }
  },
);
