import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import type { AuthContext } from "./auth.types.js";

export const requireSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.session || !session.user) {
      res.status(401).json({
        status: "error",
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return;
    }
    const authContext: AuthContext = {
      userId: String(session.user.id),
      sessionId: String(session.session.id),
    };
    req.auth = authContext;
    next();
  } catch {
    res.status(401).json({
      status: "error",
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }
};
