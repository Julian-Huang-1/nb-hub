#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
# noclobber also prevents accidental replacement of an existing credentials file.
set -o noclobber
password="$(openssl rand -hex 32)"
sed "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$password/" .env.production.example > .env.production
echo "Created .env.production with a random database password. Set DOMAIN before deploying."
