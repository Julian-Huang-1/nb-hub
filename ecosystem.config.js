// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "api-server",
      script: "dist/index.cjs",
      cwd: "/opt/myapp/nb-hub/backends/api-server",
      env: {
        NODE_ENV: "production",
        DB_DIR: "/opt/myapp/data",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: "https://api.hjxgogogo.me/auth",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://hjxgogogo.me,https://editor.hjxgogogo.me,https://mindbox.hjxgogogo.me",
        CORS_ALLOWED_ORIGINS:
          "https://hjxgogogo.me,https://editor.hjxgogogo.me,https://mindbox.hjxgogogo.me",
      },
    },
  ],
};
