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
      },
    },
  ],
};
