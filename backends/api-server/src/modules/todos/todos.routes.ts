import type { Request, Response } from "express";
import type { CreateTodoBody, UpdateTodoBody } from "@nb-hub/contracts";
import { Router } from "express";
import { todosService } from "./todos.service.js";

type IdParams = { id: string };

const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid id");
  return id;
};

const requireUserId = (req: { auth?: { userId?: string } }) => {
  const userId = req.auth?.userId;
  if (!userId) throw new Error("unauthorized");
  return userId;
};

export const todosRouter = Router();

todosRouter.get("/", (req: Request, res: Response) => {
  try {
    const data = todosService.list(requireUserId(req));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ status: "error", message });
  }
});

todosRouter.post("/", (req: Request<unknown, unknown, CreateTodoBody>, res: Response) => {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    const data = todosService.create(requireUserId(req), title);
    res.status(201).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ status: "error", message });
  }
});

todosRouter.patch(
  "/:id",
  (req: Request<IdParams, unknown, UpdateTodoBody>, res: Response) => {
    try {
      const data = todosService.update(requireUserId(req), parseId(req.params.id), {
        title: typeof req.body?.title === "string" ? req.body.title : undefined,
        completed:
          typeof req.body?.completed === "boolean" ? req.body.completed : undefined,
      });
      res.status(200).json({ status: "ok", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res
        .status(message === "todo not found" ? 404 : 400)
        .json({ status: "error", message });
    }
  },
);

todosRouter.delete("/:id", (req: Request<IdParams>, res: Response) => {
  try {
    const data = todosService.remove(requireUserId(req), parseId(req.params.id));
    res.status(200).json({ status: "ok", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res
      .status(message === "todo not found" ? 404 : 400)
      .json({ status: "error", message });
  }
});
