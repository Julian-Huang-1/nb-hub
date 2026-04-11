import { Router } from "express";
import type { Request, Response } from "express";
import { generateShellCommand } from "./hi.module.js";

export const hiRouter = Router();

type CommandBody = {
  query: string;
  shell?: string;
  cwd?: string;
};

hiRouter.post("/command", async (req: Request<unknown, unknown, CommandBody>, res: Response) => {
  try {
    const { query, shell = "zsh", cwd = process.cwd() } = req.body ?? {};

    if (!query || typeof query !== "string" || query.trim() === "") {
      res.status(400).json({ status: "error", message: "query is required" });
      return;
    }

    const command = await generateShellCommand(query.trim(), shell, cwd);
    res.status(200).json({ status: "ok", command });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: "error", message });
  }
});
