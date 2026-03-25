import type { Request, Response } from "express";
import type { ListConfusionsQuery, ResolveConfusionBody } from "@nb-hub/contracts";
import { Router } from "express";
import { confusionsService } from "./confusions.service.js";

type IdParams = { id: string };

const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid id");
  return id;
};

export const confusionsRouter = Router();

confusionsRouter.get(
  "/",
  (req: Request<unknown, unknown, unknown, ListConfusionsQuery>, res: Response) => {
    const data = confusionsService.list(req.query.status);
    res.status(200).json({ status: "ok", data });
  },
);

confusionsRouter.post(
  "/:id/resolve",
  (req: Request<IdParams, unknown, ResolveConfusionBody>, res: Response) => {
    try {
      const data = confusionsService.markResolved(parseId(req.params.id), req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(message === "confusion not found" ? 404 : 400).json({ status: "error", message });
    }
  },
);

confusionsRouter.get("/:id/resolutions", (req: Request<IdParams>, res: Response) => {
  try {
    const data = confusionsService.getResolutions(parseId(req.params.id));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "confusion not found" ? 404 : 400).json({ status: "error", message });
  }
});
