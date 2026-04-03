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
$SSH_CMD "$ECS_USER@$ECS_HOST" bash -s << 'REMOTE_SCRIPT'
  set -euo pipefail

  PROJECT_DIR="/opt/myapp/nb-hub"
  PM2_CMD="pm2"

  cd "$PROJECT_DIR"

  echo "=== Pulling latest code ==="
  git fetch origin main
  git reset --hard origin/main

  echo "=== Building all packages ==="
  pnpm run ci:full

echo "=== Reloading backend services ==="
echo "=== Reloading services via ecosystem ==="
if $PM2_CMD describe "api-server" >/dev/null 2>&1; then
  $PM2_CMD reload "$PROJECT_DIR/ecosystem.config.js" --update-env
else
  $PM2_CMD start "$PROJECT_DIR/ecosystem.config.js"
fi

$PM2_CMD save

  echo "=== Deploy complete ==="
REMOTE_SCRIPT