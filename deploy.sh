#!/bin/bash
# 用法：
# - 本地：不传 ECS_*，仅按 git 变更做构建（冒烟）。
# - CI：设置 GIT_BEFORE / GIT_SHA（如 GitHub: github.event.before / github.sha），
#       并设置 ECS_*，先在 runner 上构建校验，再 SSH 到服务器拉取同一次提交并构建、重启 PM2。
# 服务器需已 clone 本仓库到 REMOTE_REPO_ROOT（默认与 DEPLOY_BASE 相同），且可 git fetch 该远程。
set -euo pipefail

FRONTEND_BASE="apps"
BACKEND_BASE="backends"
DEPLOY_BASE="/opt/myapp"
REMOTE_REPO_ROOT="${REMOTE_REPO_ROOT:-$DEPLOY_BASE}"
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
  echo "🚀 Running in remote environment – CI build check, then deploy on server"
fi

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

echo "📦 pnpm install --frozen-lockfile (repo root)"
pnpm install --frozen-lockfile

for app in "${FRONTENDS[@]}"; do
  app_name=$(basename "$app")
  echo "🚀 [CI/local] Building frontend: $app_name"
  pnpm --filter "./$app" build

  if [ ! -d "$app/dist" ]; then
    echo "❌ Frontend build output not found: $app/dist"
    exit 1
  fi
done

for service in "${BACKENDS[@]}"; do
  service_name=$(basename "$service")
  echo "🚀 [CI/local] Building backend: $service_name"
  pnpm --filter "./$service" build

  if [ ! -d "$service" ]; then
    echo "❌ Backend directory not found: $service"
    exit 1
  fi
done

if [ "$ENVIRONMENT" = "local" ]; then
  echo "✅ Local build completed, skipping deployment"
  exit 0
fi

echo "✅ CI build check passed, connecting to server..."

SSH_KEY_FILE=$(mktemp)
printf "%s" "$ECS_SSH_KEY" | tr -d '\r' > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"

SSH_OPTS="-i $SSH_KEY_FILE -o StrictHostKeyChecking=no"
SSH_CMD="ssh $SSH_OPTS"

fronts_b64=$(printf '%s\n' "${FRONTENDS[@]}" | base64 | tr -d '\n')
backs_b64=$(printf '%s\n' "${BACKENDS[@]}" | base64 | tr -d '\n')

$SSH_CMD "$ECS_USER@$ECS_HOST" bash -s -- \
  "$REMOTE_REPO_ROOT" \
  "$GIT_SHA" \
  "$PM2_CMD" \
  "$fronts_b64" \
  "$backs_b64" <<'REMOTE_SCRIPT'
set -euo pipefail
REMOTE_REPO_ROOT="$1"
GIT_SHA="$2"
PM2_CMD="$3"
FRONTENDS_B64="$4"
BACKENDS_B64="$5"

if [ ! -d "$REMOTE_REPO_ROOT/.git" ]; then
  echo "❌ REMOTE_REPO_ROOT is not a git repo: $REMOTE_REPO_ROOT"
  exit 1
fi

cd "$REMOTE_REPO_ROOT"
echo "📥 Fetch + reset to $GIT_SHA"
git fetch origin
git reset --hard "$GIT_SHA"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ pnpm not found on server. Install pnpm or run: corepack enable && corepack prepare pnpm@latest --activate"
  exit 1
fi

echo "📦 pnpm install --frozen-lockfile (server)"
pnpm install --frozen-lockfile

while IFS= read -r app || [ -n "${app:-}" ]; do
  [ -z "${app:-}" ] && continue
  app_name=$(basename "$app")
  echo "🚀 [server] Building frontend: $app_name"
  pnpm --filter "./$app" build
  if [ ! -d "$app/dist" ]; then
    echo "❌ Frontend build output not found: $app/dist"
    exit 1
  fi
done < <(echo "$FRONTENDS_B64" | base64 -d)

while IFS= read -r service || [ -n "${service:-}" ]; do
  [ -z "${service:-}" ] && continue
  service_name=$(basename "$service")
  echo "🚀 [server] Building backend: $service_name"
  pnpm --filter "./$service" build
done < <(echo "$BACKENDS_B64" | base64 -d)

while IFS= read -r service || [ -n "${service:-}" ]; do
  [ -z "${service:-}" ] && continue
  service_name=$(basename "$service")
  echo "🔁 PM2: $service_name"
  cd "$REMOTE_REPO_ROOT/$service"
  if $PM2_CMD describe "$service_name" >/dev/null 2>&1; then
    $PM2_CMD restart "$service_name" --update-env
  else
    $PM2_CMD start dist/index.cjs --name "$service_name"
  fi
  cd "$REMOTE_REPO_ROOT"
done < <(echo "$BACKENDS_B64" | base64 -d)

echo "✅ Remote deploy finished"
REMOTE_SCRIPT