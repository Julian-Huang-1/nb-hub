import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["cjs"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  bundle: true,
  // 与 express 一并打进单文件，运行时不再 require 外部 node_modules
  noExternal: ["express", "cors"],
});
