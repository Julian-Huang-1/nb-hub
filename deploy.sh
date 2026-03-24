#!/bin/bash
set -e

# -----------------------------
# 配置
# -----------------------------
FRONTEND_BASE="apps"
BACKEND_BASE="backends"
DEPLOY_BASE="/opt/myapp"
PM2_CMD="pm2"

# SSH 配置（只在远程环境需要）
ECS_HOST="${ECS_HOST:-}"
ECS_USER="${ECS_USER:-}"
ECS_SSH_KEY="${ECS_SSH_KEY:-}"

# -----------------------------
# 判断环境
# -----------------------------
if [ -z "$ECS_HOST" ] || [ -z "$ECS_USER" ] || [ -z "$ECS_SSH_KEY" ]; then
  ENVIRONMENT="local"
  echo "🌱 Running in local environment – only building"
else
  ENVIRONMENT="remote"
  echo "🚀 Running in remote environment – will build and deploy"
fi

# -----------------------------
# 获取改动的前端和后端目录
# -----------------------------
CHANGED_DIRS=$(git diff --name-only origin/main HEAD | cut -d/ -f1-2 | sort | uniq)

echo "$CHANGED_DIRS" | while IFS= read -r dir; do
  echo "Checking directory: $dir"
  if [[ $dir == "$FRONTEND_BASE/"* ]]; then
    FRONTENDS+=("$dir")
  elif [[ $dir == "$BACKEND_BASE/"* ]]; then
    BACKENDS+=("$dir")
  fi
done

echo "Frontends: ${FRONTENDS[@]}"
echo "Backends: ${BACKENDS[@]}"


# -----------------------------
# 构建前端
# -----------------------------
for app in "${FRONTENDS[@]}"; do
  app_name=$(echo "$app" | cut -d'/' -f2)
  echo "🚀 Building frontend: $app_name "
  pnpm --filter $app_name install 
  pnpm --filter $app_name build
done

# -----------------------------
# 构建后端
# -----------------------------
for service in "${BACKENDS[@]}"; do
  service_name=$(echo "$service" | cut -d'/' -f2)
  echo "🚀 Building backend: $service_name "
  pnpm --filter $service_name install
  pnpm --filter $service_name build
done

# -----------------------------
# 如果是本地环境，停止到这里
# -----------------------------
if [ "$ENVIRONMENT" = "local" ]; then
  echo "✅ Local build completed, skipping deployment"
  exit 0
fi

# -----------------------------
# 部署前端
# -----------------------------
for app in "${FRONTENDS[@]}"; do
  echo "=== Deploying frontend: $app ==="
  rsync -avz -e "ssh -i $ECS_SSH_KEY" "$app/out/" "$ECS_USER@$ECS_HOST:$DEPLOY_BASE/$app/out/"
done

# -----------------------------
# 部署后端
# -----------------------------
for service in "${BACKENDS[@]}"; do
  echo "=== Deploying backend: $service ==="
  rsync -avz -e "ssh -i $ECS_SSH_KEY" "$service/" "$ECS_USER@$ECS_HOST:$DEPLOY_BASE/$service/"
  ssh -i "$ECS_SSH_KEY" "$ECS_USER@$ECS_HOST" "$PM2_CMD restart $service"
done

echo "✅ Deployment completed!"