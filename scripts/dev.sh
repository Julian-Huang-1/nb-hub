#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
env_file="${ENV_FILE:-.env.development}"
if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Run: cp .env.development.example .env.development" >&2
  exit 1
fi
set -a
# This is a trusted, local shell-compatible configuration file.
source "$env_file"
set +a
if [[ "${APP_ENV:-}" != development ]]; then
  echo "Development commands require APP_ENV=development." >&2
  exit 1
fi
exec "$@"
