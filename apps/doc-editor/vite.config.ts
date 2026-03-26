// apps/doc-editor/vite.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  // 生产走子路径；本地开发保持根路径，避免 dev 不方便
  base: mode === "production" ? "/doc-editor/" : "/",
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      plugins: [
        visualizer({
          filename: "dist/stats.html",
          template: "treemap", // 也可 sunburst/network
          gzipSize: true,
          brotliSize: true,
          open: false, // 想自动打开就改 true
        }),
      ],
    },
  },
}));
