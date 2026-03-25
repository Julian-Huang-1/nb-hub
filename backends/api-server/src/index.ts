import cors from "cors";
import express from "express";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db/index.js";

const app = express();
const port = Number(process.env.PORT ?? 9999);

app.use(cors());
app.use(express.json());

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
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ??
    path.resolve(process.cwd(), "./src/db/migrations");

  migrate(db, { migrationsFolder });

  // 2) 迁移成功后再启动服务
  app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to migrate/start server:", err);
  process.exit(1);
});
