#!/usr/bin/env bash
# Install the skill's pinned CLI; stdout contains only its absolute path.
set -euo pipefail
export LC_ALL=C

VERSION=v0.1.0
REPOSITORY=Julian-Huang-1/nb-hub

fail() { printf '%s\n' "$*" >&2; exit 1; }

matches_version() {
  [[ -x "$1" ]] && "$1" --version 2>/dev/null |
    awk -v version="${VERSION#v}" 'NR == 1 { sub(/^v/, "", $2); ok = ($1 == "nb-hub" && $2 == version) } END { exit !ok }'
}

download() {
  local asset=$1
  if command -v gh >/dev/null 2>&1 &&
    gh release download "$VERSION" --repo "$REPOSITORY" --pattern "$asset" --dir "$work" >/dev/null 2>&1; then
    return
  fi
  command -v curl >/dev/null 2>&1 || fail 'Install gh (private repository) or curl (public repository).'
  curl --fail --silent --show-error --location --connect-timeout 15 --max-time 180 \
    "https://github.com/$REPOSITORY/releases/download/$VERSION/$asset" -o "$work/$asset" ||
    fail "Cannot download $asset. Confirm $VERSION is published; private repositories require gh with read access."
}

main() {
  local os arch installed directory asset expected actual
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) fail 'Only macOS and Linux are supported.' ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch=amd64 ;;
    arm64|aarch64) arch=arm64 ;;
    *) fail 'Only amd64 and arm64 are supported.' ;;
  esac
  installed=$(command -v nb-hub || true)
  if [[ -n "$installed" ]] && matches_version "$installed"; then
    printf '%s/%s\n' "$(cd "$(dirname "$installed")" && pwd -P)" "$(basename "$installed")"
    return
  fi
  directory="$HOME/.local/bin"
  mkdir -p "$directory"
  directory=$(cd "$directory" && pwd -P)
  if matches_version "$directory/nb-hub"; then
    printf '%s/nb-hub\n' "$directory"
    return
  fi
  # Stage on the same filesystem; failures leave the existing CLI untouched.
  work=$(mktemp -d "$directory/.nb-hub-install.XXXXXX")
  trap 'rm -rf "$work"' EXIT
  asset="nb-hub_${VERSION#v}_${os}_${arch}.tar.gz"
  printf 'Installing nb-hub %s (%s/%s)\n' "$VERSION" "$os" "$arch" >&2
  download SHA256SUMS
  download "$asset"
  expected=$(awk -v asset="$asset" '$2 == asset { print $1 }' "$work/SHA256SUMS")
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || fail "Missing or duplicate checksum for $asset."
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$work/$asset" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "$work/$asset" | awk '{print $1}')
  else
    fail 'SHA256 verification requires sha256sum or shasum.'
  fi
  [[ "$actual" == "$expected" ]] || fail "SHA256 mismatch for $asset."
  # Stream just the binary into a regular file; never extract archive paths/links.
  [[ "$(tar -tzf "$work/$asset" | awk '$0 == "nb-hub" { n++ } END { print n+0 }')" == 1 ]] ||
    fail 'Release archive must contain exactly one nb-hub entry.'
  tar -xOzf "$work/$asset" nb-hub > "$work/nb-hub"
  [[ -s "$work/nb-hub" ]] || fail 'Release binary is empty.'
  chmod 755 "$work/nb-hub"
  matches_version "$work/nb-hub" || fail 'Downloaded CLI failed version verification.'
  mv -f "$work/nb-hub" "$directory/nb-hub"
  printf '%s/nb-hub\n' "$directory"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
