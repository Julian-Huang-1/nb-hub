#!/bin/bash
set -euo pipefail

PROJECT_DIR="/opt/myapp/nb-hub"
PM2_CMD="pm2"

ECS_HOST="${ECS_HOST:-}"
ECS_USER="${ECS_USER:-}"
ECS_SSH_KEY="${ECS_SSH_KEY:-}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"

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
# 通过位置参数将敏感 key 传入远端（heredoc 单引号不展开本地变量）
$SSH_CMD "$ECS_USER@$ECS_HOST" bash -s -- "$OPENROUTER_API_KEY" << 'REMOTE_SCRIPT'
  set -euo pipefail

  PROJECT_DIR="/opt/myapp/nb-hub"
  PM2_CMD="pm2"
  SERVER_ENV_FILE="/opt/myapp/.server_env"

  # 接收 GitHub 传入的 key 并持久化，以便服务重启后仍可用
  OPENROUTER_API_KEY="$1"
  if [ -n "$OPENROUTER_API_KEY" ]; then
    touch "$SERVER_ENV_FILE"
    # 更新或追加
    if grep -q '^OPENROUTER_API_KEY=' "$SERVER_ENV_FILE" 2>/dev/null; then
      sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$OPENROUTER_API_KEY|" "$SERVER_ENV_FILE"
    else
      echo "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" >> "$SERVER_ENV_FILE"
    fi
    chmod 600 "$SERVER_ENV_FILE"
  fi

  # 将持久化的 env 导出到当前 shell，pm2 reload --update-env 会读取
  if [ -f "$SERVER_ENV_FILE" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$SERVER_ENV_FILE"
    set +a
  fi

  cd "$PROJECT_DIR"

  echo "=== Pulling latest code ==="
  git fetch origin main
  git reset --hard origin/main

  echo "=== Building all packages ==="
  pnpm run ci:full

  echo "=== Reloading services via ecosystem ==="
  if $PM2_CMD describe "api-server" >/dev/null 2>&1; then
    $PM2_CMD reload "$PROJECT_DIR/ecosystem.config.js" --update-env
  else
    $PM2_CMD start "$PROJECT_DIR/ecosystem.config.js"
  fi

  $PM2_CMD save

  echo "=== Deploy complete ==="
REMOTE_SCRIPT