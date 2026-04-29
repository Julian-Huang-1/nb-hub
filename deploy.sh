#!/bin/bash
set -euo pipefail

PROJECT_DIR="/opt/myapp/nb-hub"
PM2_CMD="pm2"

ECS_HOST="${ECS_HOST:-}"
ECS_USER="${ECS_USER:-}"
ECS_SSH_KEY="${ECS_SSH_KEY:-}"

if [ -z "$ECS_HOST" ] || [ -z "$ECS_USER" ] || [ -z "$ECS_SSH_KEY" ]; then
  echo "Missing ECS connection info, skipping deploy"
  exit 0
fi

# 准备 SSH 密钥
SSH_KEY_FILE=$(mktemp)
trap 'rm -f "$SSH_KEY_FILE"' EXIT

printf "%s" "$ECS_SSH_KEY" | tr -d '\r' > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"

SSH_CMD="ssh -i $SSH_KEY_FILE -o StrictHostKeyChecking=no"

# SSH 到服务器，一次性完成：拉代码 → 安装依赖 → 构建 → 重启服务
$SSH_CMD "$ECS_USER@$ECS_HOST" bash -s -- "$OPENROUTER_API_KEY" "$BETTER_AUTH_SECRET" << 'REMOTE_SCRIPT'
  set -euo pipefail

  PROJECT_DIR="/opt/myapp/nb-hub"
  PM2_CMD="pm2"
  ENV_FILE="$PROJECT_DIR/.env.production"

  # 将 GitHub Secrets 写入服务器 .env.production（持久化）
  cat > "$ENV_FILE" << ENVEOF
OPENROUTER_API_KEY=${1}
BETTER_AUTH_SECRET=${2}
ENVEOF
  chmod 600 "$ENV_FILE"

  cd "$PROJECT_DIR"

  echo "=== Pulling latest code ==="
  git fetch origin main
  git reset --hard origin/main

  echo "=== Building all packages ==="
  pnpm run ci:full

  echo "=== Restarting services via ecosystem ==="
  # delete + start 确保 ecosystem.config.js 被重新执行，loadEnvFile 每次都能读到最新的 .env.production
  $PM2_CMD delete "$PROJECT_DIR/ecosystem.config.js" 2>/dev/null || true
  $PM2_CMD start "$PROJECT_DIR/ecosystem.config.js"

  $PM2_CMD save

  echo "=== Deploy complete ==="
REMOTE_SCRIPT