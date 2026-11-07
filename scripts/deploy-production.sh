#!/usr/bin/env bash
# Invoked over SSH by GitHub Actions. Production config arrives separately from Secrets.
set -euo pipefail
umask 077

if [[ $# != 4 ]]; then
  echo 'Usage: deploy-production.sh <deploy-dir> <release-id> <commit-sha> <platform>' >&2
  exit 1
fi
deploy_root=$1
deploy_id=$2
deploy_sha=$3
deploy_platform=$4
[[ "$deploy_root" =~ ^/[a-zA-Z0-9_./-]+$ && "$deploy_root" != / && "$deploy_root" != *..* ]]
[[ "$deploy_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$deploy_id" =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ && "$deploy_id" == "$deploy_sha"-* ]]
[[ "$deploy_platform" == linux/amd64 ]]
command -v flock > /dev/null
command -v docker > /dev/null
command -v curl > /dev/null
docker compose version > /dev/null
exec 9> "$deploy_root/.deploy.lock"
flock -n 9 || { echo 'Another production deployment is running' >&2; exit 1; }

# A deployment must supply fresh configuration; never silently use a stale file.
deploy_config="$deploy_root/incoming/$deploy_id/production.env"
[[ -f "$deploy_config" && ! -L "$deploy_config" && -s "$deploy_config" ]] || { echo 'Missing production configuration from GitHub Secrets' >&2; exit 1; }
chmod 600 "$deploy_config"
# This is trusted, shell-compatible configuration managed by the repository owner.
# It is never printed, included in release archives, or passed as command arguments.
source "$deploy_config" 2>/dev/null || { echo 'Invalid production configuration' >&2; exit 1; }
[[ "${DEPLOY_PLATFORM:-linux/amd64}" == "$deploy_platform" ]] || { echo 'Server and CI platform differ' >&2; exit 1; }
[[ -n "${DOMAIN:-}" && -n "${JWT_SECRET:-}" && -n "${POSTGRES_PASSWORD:-}" ]]
export API_IMAGE="nb-hub-api:$deploy_id"
export WEB_IMAGE="nb-hub-web:$deploy_id"
export DEPLOY_PLATFORM="$deploy_platform"

deploy_release="$deploy_root/releases/$deploy_id"
deploy_archive="$deploy_root/incoming/$deploy_id/release.tar"
[[ -f "$deploy_archive" ]]
mkdir -p "$deploy_root/releases"
mkdir "$deploy_release"
tar -xf "$deploy_archive" -C "$deploy_release"
printf 'API_IMAGE=%s\nWEB_IMAGE=%s\nDEPLOY_PLATFORM=%s\n' "$API_IMAGE" "$WEB_IMAGE" "$DEPLOY_PLATFORM" > "$deploy_release/images.env"
deploy_compose=(docker compose --project-name nb-hub-prod --env-file "$deploy_config" --env-file "$deploy_release/images.env" -f "$deploy_release/docker-compose.production.yml")
deploy_proxy_mode="${NB_HUB_PROXY_MODE:-bundled}"
[[ "$deploy_proxy_mode" == bundled || "$deploy_proxy_mode" == external ]] || { echo 'Invalid NB_HUB_PROXY_MODE' >&2; exit 1; }
if [[ "$deploy_proxy_mode" == external ]]; then
  deploy_compose+=(-f "$deploy_release/docker-compose.external-proxy.yml")
elif [[ -n "${NB_HUB_CONTENT_DOMAIN:-}" ]]; then
  [[ -r "$deploy_root/deploy/content-tls/fullchain.pem" && -r "$deploy_root/deploy/content-tls/privkey.pem" ]] || { echo 'Missing content TLS certificate' >&2; exit 1; }
  ln -s "$deploy_root/deploy/content-tls" "$deploy_release/deploy/content-tls"
  deploy_compose+=(-f "$deploy_release/docker-compose.sites.yml")
fi
# Validate silently: the rendered config includes credentials.
"${deploy_compose[@]}" config --quiet > /dev/null 2>&1 || { echo 'Invalid production Compose configuration' >&2; exit 1; }
# Install atomically only after configuration validation, preserving existing
# database credentials and file permissions across releases.
mv -f "$deploy_config" "$deploy_root/.env.production"
deploy_compose=("${deploy_compose[@]/$deploy_config/$deploy_root/.env.production}")
gzip -dc "$deploy_release/images.tar.gz" | docker load
"${deploy_compose[@]}" up -d --wait --wait-timeout 90 postgres

# Keep the old application alive while applying compatible migrations. Migration
# errors stop this script before application containers are replaced.
"${deploy_compose[@]}" run --rm --no-deps migrate < /dev/null
"${deploy_compose[@]}" up -d --no-build --no-deps --wait --wait-timeout 120 api web
if [[ "$deploy_proxy_mode" == bundled ]]; then
  "${deploy_compose[@]}" up -d --no-build --no-deps --force-recreate proxy
fi

# Exercise public HTTPS routing and verify the actual domain certificate while
# connecting to this machine, independent of the server's DNS resolver.
for deploy_try in {1..30}; do
  if curl --fail --silent --show-error --noproxy '*' --connect-timeout 5 --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" -o /dev/null &&
     curl --fail --silent --show-error --noproxy '*' --connect-timeout 5 --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" -o /dev/null; then
    break
  fi
  if (( deploy_try == 30 )); then
    echo 'Post-deployment HTTP checks failed; inspect the new release. Database changes are not rolled back automatically.' >&2
    exit 1
  fi
  sleep 2
done

# Record the successful configuration for subsequent manual operations.
ln -sfn "$deploy_release" "$deploy_root/current"
printf '%s\n' "$deploy_sha" > "$deploy_release/commit-sha"
# Image archives are expensive on a 2GB host; imported images and config remain.
rm -f "$deploy_release/images.tar.gz" "$deploy_archive" "$deploy_root/incoming/$deploy_id/deploy-production.sh"
rmdir "$deploy_root/incoming/$deploy_id"
echo "Deployed commit $deploy_sha"
