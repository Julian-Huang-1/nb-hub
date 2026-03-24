#!/bin/bash
set -euo pipefail

FRONTEND_BASE="apps"
BACKEND_BASE="backends"
DEPLOY_BASE="/opt/myapp"
PM2_CMD="pm2"

ECS_HOST="${ECS_HOST:-}"
ECS_USER="${ECS_USER:-}"
ECS_SSH_KEY="${ECS_SSH_KEY:-}"

GIT_BEFORE="${GIT_BEFORE:-}"
GIT_SHA="${GIT_SHA:-HEAD}"

FRONTENDS=()
BACKENDS=()
SSH_KEY_FILE=""

cleanup() {
  if [ -n "$SSH_KEY_FILE" ] && [ -f "$SSH_KEY_FILE" ]; then
    rm -f "$SSH_KEY_FILE"
  fi
}
trap cleanup EXIT

if [ -z "$ECS_HOST" ] || [ -z "$ECS_USER" ] || [ -z "$ECS_SSH_KEY" ]; then
  ENVIRONMENT="local"
  echo "🌱 Running in local environment – only building"
else
  ENVIRONMENT="remote"
  echo "🚀 Running in remote environment – will build and deploy"
fi

# -----------------------------
# 获取改动目录
# -----------------------------
if [ -n "$GIT_BEFORE" ] && [ "$GIT_BEFORE" != "0000000000000000000000000000000000000000" ]; then
  echo "Comparing commits: $GIT_BEFORE -> $GIT_SHA"
  CHANGED_DIRS=$(git diff --name-only "$GIT_BEFORE" "$GIT_SHA" | cut -d/ -f1-2 | sort -u)
else
  echo "Fallback to HEAD^ -> HEAD"
  CHANGED_DIRS=$(git diff --name-only HEAD^ HEAD | cut -d/ -f1-2 | sort -u)
fi

echo "Changed dirs raw:"
echo "$CHANGED_DIRS"

while IFS= read -r dir; do
  [ -z "$dir" ] && continue
  echo "Checking directory: $dir"

  if [[ $dir == $FRONTEND_BASE/* ]]; then
    FRONTENDS+=("$dir")
  elif [[ $dir == $BACKEND_BASE/* ]]; then
    BACKENDS+=("$dir")
  fi
done <<< "$CHANGED_DIRS"

echo "Frontends: ${FRONTENDS[*]}"
echo "Backends: ${BACKENDS[*]}"

if [ ${#FRONTENDS[@]} -eq 0 ] && [ ${#BACKENDS[@]} -eq 0 ]; then
  echo "ℹ️ No changed frontend/backend projects detected, exiting."
  exit 0
fi

# -----------------------------
# 构建前端
# -----------------------------
for app in "${FRONTENDS[@]}"; do
  app_name=$(basename "$app")
  echo "🚀 Building frontend: $app_name"
  pnpm --filter "$app_name" install
  pnpm --filter "$app_name" build

  if [ ! -d "$app/dist" ]; then
    echo "❌ Frontend build output not found: $app/dist"
    exit 1
  fi
done

# -----------------------------
# 构建后端
# -----------------------------
for service in "${BACKENDS[@]}"; do
  service_name=$(basename "$service")
  echo "🚀 Building backend: $service_name"
  pnpm --filter "$service_name" install
  pnpm --filter "$service_name" build

  if [ ! -d "$service" ]; then
    echo "❌ Backend directory not found: $service"
    exit 1
  fi
done

if [ "$ENVIRONMENT" = "local" ]; then
  echo "✅ Local build completed, skipping deployment"
  exit 0
fi

# -----------------------------
# 将私钥内容写入临时文件
# -----------------------------
SSH_KEY_FILE=$(mktemp)
printf "%s" "$ECS_SSH_KEY" | tr -d '\r' > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"

SSH_OPTS="-i $SSH_KEY_FILE -o StrictHostKeyChecking=no"
SSH_CMD="ssh $SSH_OPTS"
RSYNC_RSH="ssh $SSH_OPTS"

# -----------------------------
# 部署前端
# 远程不存在则创建，存在则同步替换
# -----------------------------
for app in "${FRONTENDS[@]}"; do
  app_name=$(basename "$app")
  local_dist_dir="$app/dist"
  remote_dir="$DEPLOY_BASE/$app/dist"

  echo "=== Deploying frontend: $app ==="
  echo "Local dist: $local_dist_dir"
  echo "Remote dir: $remote_dir"

  $SSH_CMD "$ECS_USER@$ECS_HOST" "mkdir -p '$remote_dir'"

  rsync -avz --delete -e "$RSYNC_RSH" \
    "$local_dist_dir/" "$ECS_USER@$ECS_HOST:$remote_dir/"
done

# -----------------------------
# 部署后端
# 远程不存在则创建，存在则同步替换
# -----------------------------
for service in "${BACKENDS[@]}"; do
  service_name=$(basename "$service")
  remote_dir="$DEPLOY_BASE/$service"

  echo "=== Deploying backend: $service ==="
  echo "Remote dir: $remote_dir"

  $SSH_CMD "$ECS_USER@$ECS_HOST" "mkdir -p '$remote_dir'"

  rsync -avz --delete -e "$RSYNC_RSH" \
    "$service/" "$ECS_USER@$ECS_HOST:$remote_dir/"

  $SSH_CMD "$ECS_USER@$ECS_HOST" "
    set -e
    cd '$remote_dir'
    if $PM2_CMD describe '$service_name' >/dev/null 2>&1; then
      echo '🔄 Restarting existing PM2 service: $service_name'
      $PM2_CMD restart '$service_name' --update-env
    else
      echo '🆕 Starting new PM2 service: $service_name'
      $PM2_CMD start dist/index.cjs --name '$service_name'
    fi
  "
done