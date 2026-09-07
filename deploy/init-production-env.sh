#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_file="${1:-/tmp/catbakery-source.env}"
target_file="$repo_dir/deploy/.env.production"

if [[ ! -f "$source_file" ]]; then
  echo "Missing credential source: $source_file" >&2
  exit 1
fi

read_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$source_file" | head -n 1
}

douyin_app_id="$(read_value DOUYIN_APP_ID)"
douyin_app_secret="$(read_value DOUYIN_APP_SECRET)"

if [[ -z "$douyin_app_id" || -z "$douyin_app_secret" ]]; then
  echo "DOUYIN_APP_ID or DOUYIN_APP_SECRET is missing" >&2
  exit 1
fi

umask 077
temp_file="$(mktemp "$repo_dir/deploy/.env.production.XXXXXX")"
trap 'rm -f "$temp_file"' EXIT

{
  printf 'MONGO_ROOT_USERNAME=catbakery_admin\n'
  printf 'MONGO_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'DOUYIN_APP_ID=%s\n' "$douyin_app_id"
  printf 'DOUYIN_APP_SECRET=%s\n' "$douyin_app_secret"
  printf 'AUTH_TOKEN_SECRET=%s\n' "$(openssl rand -hex 32)"
  printf 'AUTH_TOKEN_TTL_SECONDS=604800\n'
} >"$temp_file"

mv "$temp_file" "$target_file"
trap - EXIT
chmod 600 "$target_file"
rm -f "$source_file"
echo "Created $target_file with mode 600; secrets were not printed."
