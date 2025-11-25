import { defineConfig } from "tsup";
import vue from "esbuild-plugin-vue-next";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false,
  clean: true,
  external: ["vue"],
  sourcemap: false,
  minify: false,
  splitting: false,
  treeshake: true,
  esbuildPlugins: [vue() as any],
});
