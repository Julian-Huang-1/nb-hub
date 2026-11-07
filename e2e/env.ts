import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

// 与开发入口使用同一份配置，已有进程变量始终优先。
const path = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(path)) {
  config({ path, quiet: true });
}
