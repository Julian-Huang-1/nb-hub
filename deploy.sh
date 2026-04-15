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
  # ${1:-} 兼容 -u 模式：$1 未传入时视为空字符串而非报错
  OPENROUTER_API_KEY="${1:-}"
  if [ -n "$OPENROUTER_API_KEY" ]; then
    touch "$SERVER_ENV_FILE"
    # 更新或追加到 server env 文件
    if grep -q '^OPENROUTER_API_KEY=' "$SERVER_ENV_FILE" 2>/dev/null; then
      sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$OPENROUTER_API_KEY|" "$SERVER_ENV_FILE"
    else
      echo "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" >> "$SERVER_ENV_FILE"
    fi
    chmod 600 "$SERVER_ENV_FILE"

    # 写入 /etc/profile.d/ 确保所有用户、所有 shell（bash/zsh）登录时都能加载
    PROFILED_FILE="/etc/profile.d/nb_hub_env.sh"
    if grep -q '^export OPENROUTER_API_KEY=' "$PROFILED_FILE" 2>/dev/null; then
      sed -i "s|^export OPENROUTER_API_KEY=.*|export OPENROUTER_API_KEY=$OPENROUTER_API_KEY|" "$PROFILED_FILE"
    else
      echo "export OPENROUTER_API_KEY=$OPENROUTER_API_KEY" >> "$PROFILED_FILE"
    fi
    chmod 644 "$PROFILED_FILE"

    # 同时注入到 root 的 rc 文件（文件不存在则创建），供非登录交互式 shell 使用
    for RC_FILE in "$HOME/.zshrc" "$HOME/.bashrc"; do
      if grep -q '^export OPENROUTER_API_KEY=' "$RC_FILE" 2>/dev/null; then
        sed -i "s|^export OPENROUTER_API_KEY=.*|export OPENROUTER_API_KEY=$OPENROUTER_API_KEY|" "$RC_FILE"
      else
        echo "export OPENROUTER_API_KEY=$OPENROUTER_API_KEY" >> "$RC_FILE"
      fi
    done
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

  echo "=== OPENROUTER_API_KEY is set: $([ -n "${OPENROUTER_API_KEY:-}" ] && echo YES || echo NO) ==="

  echo "=== Restarting services via ecosystem ==="
  if $PM2_CMD describe "api-server" >/dev/null 2>&1; then
    $PM2_CMD restart "$PROJECT_DIR/ecosystem.config.js" --update-env
  else
    $PM2_CMD start "$PROJECT_DIR/ecosystem.config.js"
  fi

  $PM2_CMD save

  echo "=== Deploy complete ==="
REMOTE_SCRIPT