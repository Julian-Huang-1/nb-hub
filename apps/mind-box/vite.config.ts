import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    include: [
      "@mariozechner/pi-web-ui",
      "@mariozechner/pi-agent-core",
      "@mariozechner/pi-ai",
      "lit",
      "@mariozechner/mini-lit",
    ],
  },
});
