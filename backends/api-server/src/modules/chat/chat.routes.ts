import type { Request, Response } from "express";
import type { AskBody, CreateChatSessionBody } from "@nb-hub/contracts";
import { Router } from "express";
import { chatService } from "./chat.service.js";

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

export const chatRouter = Router();

chatRouter.get("/sessions", (_req: Request, res: Response) => {
  const data = chatService.listSessions(requireUserId(_req));
  res.status(200).json({ status: "ok", data });
});

chatRouter.post(
  "/sessions",
  (req: Request<unknown, unknown, CreateChatSessionBody>, res: Response) => {
    try {
      const data = chatService.createSession(requireUserId(req), req.body ?? {});
      res.status(201).json({ status: "ok", data });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

chatRouter.get("/sessions/:id/messages", (req: Request<IdParams>, res: Response) => {
  try {
    const data = chatService.getSessionMessages(requireUserId(req), parseId(req.params.id));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "session not found" ? 404 : 400).json({ status: "error", message });
  }
});

chatRouter.post(
  "/sessions/:id/ask",
  (req: Request<IdParams, unknown, AskBody>, res: Response) => {
    try {
      const data = chatService.ask(requireUserId(req), parseId(req.params.id), req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(message === "session not found" ? 404 : 400).json({ status: "error", message });
    }
  },
);
