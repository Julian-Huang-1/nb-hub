import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type {
  ApiSuccess,
  AssistFeedbackBody,
  AssistModelsCapabilitiesResponseData,
  CursorGenerationsBody,
  InlineCompletionsBody,
  InlineCompletionsCancelBody,
  SelectionTransformBody,
} from "@nb-hub/contracts";
import { Router } from "express";
import { assistOrchestrator } from "../ai/assist-orchestrator.js";
import { assistService } from "./assist.service.js";

export const assistRouter = Router();

assistRouter.get(
  "/models/capabilities",
  (_req: Request, res: Response<ApiSuccess<AssistModelsCapabilitiesResponseData>>) => {
    res.status(200).json({ status: "ok", data: assistService.modelCapabilities() });
  },
);

assistRouter.post(
  "/inline-completions",
  (req: Request<unknown, unknown, InlineCompletionsBody>, res: Response) => {
    try {
      const data = assistService.inlineCompletions(req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

assistRouter.post(
  "/inline-completions/cancel",
  (req: Request<unknown, unknown, InlineCompletionsCancelBody>, res: Response) => {
    const data = assistService.acknowledgeCancel(req.body ?? {});
    res.status(200).json({ status: "ok", data });
  },
);

assistRouter.post(
  "/selection-transforms",
  (req: Request<unknown, unknown, SelectionTransformBody>, res: Response) => {
    try {
      const data = assistService.selectionTransform(req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

assistRouter.post(
  "/cursor-generations",
  (req: Request<unknown, unknown, CursorGenerationsBody>, res: Response) => {
    try {
      const data = assistService.cursorGenerations(req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

assistRouter.post(
  "/cursor-generations/stream",
  (
    req: Request<unknown, unknown, CursorGenerationsBody & { requestId?: string }>,
    res: Response,
  ) => {
    const body = req.body ?? {};
    const started = performance.now();
    const requestId =
      typeof body.requestId === "string" && body.requestId ? body.requestId : randomUUID();

    try {
      const intent = typeof body.intent === "string" ? body.intent.trim() : "";
      if (!intent) {
        res.status(400).json({ status: "error", message: "intent is required" });
        return;
      }
      const documentOutline =
        typeof body.documentOutline === "string" ? body.documentOutline : undefined;
      const currentSectionContext =
        typeof body.currentSectionContext === "string" ? body.currentSectionContext : undefined;
      const dl = body.desiredLength;
      const desiredLength =
        dl === "short" || dl === "medium" || dl === "long" ? dl : undefined;

      const out = assistOrchestrator.cursorGenerations({
        intent,
        documentOutline,
        currentSectionContext,
        desiredLength,
      });
      const text = out.blocks[0]?.markdown ?? "";
      const chunks =
        text.length === 0 ? [""] : text.match(/[\s\S]{1,64}/g) ?? [text];

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let i = 0;
      const writeChunk = () => {
        if (i < chunks.length) {
          res.write(
            `data: ${JSON.stringify({ type: "chunk", text: chunks[i++] })}\n\n`,
          );
          setImmediate(writeChunk);
          return;
        }
        const latencyMs = Math.round(performance.now() - started);
        res.write(
          `data: ${JSON.stringify({
            type: "done",
            requestId,
            model: out.model,
            latencyMs,
            insertMode: out.insertMode,
          })}\n\n`,
        );
        res.end();
      };
      writeChunk();
    } catch (error) {
      if (!res.headersSent) {
        res.status(400).json({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      res.end();
    }
  },
);

assistRouter.post(
  "/feedback",
  (req: Request<unknown, unknown, AssistFeedbackBody>, res: Response) => {
    try {
      const data = assistService.recordFeedback(req.body ?? {});
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
