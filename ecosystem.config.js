// ecosystem.config.js
const fs = require("fs");
const path = require("path");

// 从服务器上的 .env.production 文件读取敏感变量（不依赖 PM2 daemon 的继承环境）
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const env = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      env[key] = val;
    }
    return env;
  } catch {
    return {}; // 文件不存在时静默跳过（本地开发场景）
  }
}

const serverEnv = loadEnvFile("/opt/myapp/nb-hub/.env.production");

module.exports = {
  apps: [
    {
      name: "api-server",
      script: "dist/index.cjs",
      cwd: "/opt/myapp/nb-hub/backends/api-server",
      env: {
        NODE_ENV: "production",
        DB_DIR: "/opt/myapp/data",
        BETTER_AUTH_SECRET: serverEnv.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
        OPENROUTER_API_KEY: serverEnv.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY,
        BETTER_AUTH_URL: "https://api.hjxgogogo.me/auth",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://hjxgogogo.me,https://editor.hjxgogogo.me,https://mindbox.hjxgogogo.me",
        CORS_ALLOWED_ORIGINS:
          "https://hjxgogogo.me,https://editor.hjxgogogo.me,https://mindbox.hjxgogogo.me",
      },
    },
  ],
};
