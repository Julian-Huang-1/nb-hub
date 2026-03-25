import { Router } from "express";
import { chatService } from "./chat.service.js";

const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid id");
  return id;
};

export const chatRouter = Router();

chatRouter.get("/sessions", (_req, res) => {
  const data = chatService.listSessions();
  res.status(200).json({ status: "ok", data });
});

chatRouter.post("/sessions", (req, res) => {
  try {
    const data = chatService.createSession(req.body ?? {});
    res.status(201).json({ status: "ok", data });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

chatRouter.get("/sessions/:id/messages", (req, res) => {
  try {
    const data = chatService.getSessionMessages(parseId(req.params.id));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "session not found" ? 404 : 400).json({ status: "error", message });
  }
});

chatRouter.post("/sessions/:id/ask", (req, res) => {
  try {
    const data = chatService.ask({
      sessionId: parseId(req.params.id),
      question: req.body?.question,
    });
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "session not found" ? 404 : 400).json({ status: "error", message });
  }
});
