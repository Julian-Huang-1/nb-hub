import { Router } from "express";
import { confusionsService } from "./confusions.service.js";

const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid id");
  return id;
};

export const confusionsRouter = Router();

confusionsRouter.get("/", (req, res) => {
  const data = confusionsService.list(req.query.status);
  res.status(200).json({ status: "ok", data });
});

confusionsRouter.post("/:id/resolve", (req, res) => {
  try {
    const data = confusionsService.markResolved({
      confusionId: parseId(req.params.id),
      answer: req.body?.answer,
      question: req.body?.question,
      resolvedByMessageId: req.body?.resolvedByMessageId,
    });
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "confusion not found" ? 404 : 400).json({ status: "error", message });
  }
});

confusionsRouter.get("/:id/resolutions", (req, res) => {
  try {
    const data = confusionsService.getResolutions(parseId(req.params.id));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "confusion not found" ? 404 : 400).json({ status: "error", message });
  }
});
