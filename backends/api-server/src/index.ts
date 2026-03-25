import cors from "cors";
import express from "express";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db/index.js";
import { posts } from "./db/schema.js";
import { desc, sql } from "drizzle-orm";

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

// 健康检查 + 数据库连通性测试
app.get("/db-test", async (_req, res) => {
  try {
    // 1) 测试连接是否可用
    const ping = db.run(sql`select 1 as ok`);

    // 2) 插入一条测试数据
    const inserted = db
      .insert(posts)
      .values({
        title: "db-test",
        content: `created at ${new Date().toISOString()}`,
      })
      .returning()
      .all();

    // 3) 读取最近 5 条
    const latest = db
      .select()
      .from(posts)
      .orderBy(desc(posts.id))
      .limit(5)
      .all();

    res.status(200).json({
      status: "ok",
      ping,
      inserted,
      latest,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "DB test failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
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
