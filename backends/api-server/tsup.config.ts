import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { dependencies?: Record<string, string> };

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["cjs"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  external: ["better-sqlite3", "drizzle-orm"],
});
