#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
# noclobber also prevents accidental replacement of an existing credentials file.
set -o noclobber
password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 32)"
sed -e "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$password/" -e "s/^JWT_SECRET=$/JWT_SECRET=$jwt_secret/" .env.production.example > .env.production
echo "Created .env.production with independent database and JWT secrets. Set DOMAIN and a login provider before deploying."
