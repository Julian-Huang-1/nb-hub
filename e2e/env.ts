import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

// 优先读取工作区环境，已有进程变量始终优先。
for (const filename of [".env.worktree", ".env"]) {
  const path = resolve(process.cwd(), filename);
  if (existsSync(path)) {
    config({ path, quiet: true });
    break;
  }
}
