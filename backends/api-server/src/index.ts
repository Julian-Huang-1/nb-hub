import cors from "cors";
import express, { type Response } from "express";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { desc, sql } from "drizzle-orm";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { ApiSuccess, AuthSessionResponseData } from "@nb-hub/contracts";
import { db } from "./db/index.js";
import { posts } from "./db/schema.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { chatRouter } from "./modules/chat/chat.routes.js";
import { confusionsRouter } from "./modules/confusions/confusions.routes.js";
import { assistRouter } from "./modules/assist/assist.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { ankiRouter } from "./modules/anki/anki.routes.js";
import { todosRouter } from "./modules/todos/todos.routes.js";
import { auth } from "./modules/auth/auth.js";
import { requireSession } from "./modules/auth/auth.middleware.js";

// 初始化 Agent 模块（自动注册通用工具）
import "./modules/agent/index.js";
import { todosAgentRouter } from "./modules/todos/todos.agent.routes.js";

const app = express();
const port = Number(process.env.PORT ?? 9999);

// dist/index.cjs 运行时，默认迁移目录指向源码目录：../src/db/migrations
// 你也可以用 MIGRATIONS_DIR 覆盖
const defaultMigrationsDir = path.resolve(__dirname, "../src/db/migrations");
const migrationsFolder = process.env.MIGRATIONS_DIR ?? defaultMigrationsDir;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const toAuthSessionResponseData = (
  value: Awaited<ReturnType<typeof auth.api.getSession>>,
): AuthSessionResponseData => {
  if (!value) {
    return null;
  }
  return {
    session: {
      ...value.session,
      expiresAt: value.session.expiresAt.toISOString(),
      createdAt: value.session.createdAt.toISOString(),
      updatedAt: value.session.updatedAt.toISOString(),
      ipAddress: value.session.ipAddress ?? null,
      userAgent: value.session.userAgent ?? null,
    },
    user: {
      ...value.user,
      image: value.user.image ?? null,
      createdAt: value.user.createdAt.toISOString(),
      updatedAt: value.user.updatedAt.toISOString(),
    },
  };
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.all("/auth/*", toNodeHandler(auth));
app.use(express.json());
app.get(
  "/auth/session",
  async (_req, res: Response<ApiSuccess<AuthSessionResponseData>>) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(_req.headers) });
    res.status(200).json({
      status: "ok",
      data: toAuthSessionResponseData(session),
    });
  },
);
app.use("/documents", requireSession, documentsRouter);
app.use("/chat", requireSession, chatRouter);
app.use("/confusions", requireSession, confusionsRouter);
app.use("/anki", requireSession, ankiRouter);
app.use("/todos", requireSession, todosRouter);
app.use("/todos", requireSession, todosAgentRouter);
app.use("/analytics", analyticsRouter);
app.use("/assist", assistRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "api-server!!",
    uptime: process.uptime(),
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Hello from @nb-hub/api-server!!!",
  });
});

async function bootstrap() {
  // 1) 启动前执行迁移（幂等：已执行过的不会重复执行）

  migrate(db, { migrationsFolder });

  // 2) 迁移成功后再启动服务
  app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
    console.log(`Using migrations folder: ${migrationsFolder}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to migrate/start server:", err);
  process.exit(1);
});
