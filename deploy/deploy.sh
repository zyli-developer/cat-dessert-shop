#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$repo_dir/deploy/.env.production"
compose_file="$repo_dir/docker-compose.prod.yml"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Copy deploy/.env.production.example and fill all secrets." >&2
  exit 1
fi

cd "$repo_dir"
docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" up -d --build --remove-orphans
docker compose --env-file "$env_file" -f "$compose_file" ps

local_health_url="http://127.0.0.1:18099/health"
public_health_url="${PUBLIC_HEALTH_URL:-https://jingjingyeye.vip:8099/health}"

for attempt in {1..30}; do
  if curl --fail --silent --show-error --max-time 5 "$local_health_url" | grep -q '"status":"ok"'; then
    echo "Cat Bakery API is healthy on 127.0.0.1:18099"
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    echo "Internal health check failed. Recent server logs:" >&2
    docker compose --env-file "$env_file" -f "$compose_file" logs --tail=100 server >&2
    exit 1
  fi
  sleep 2
done

for attempt in {1..12}; do
  if curl --fail --silent --show-error --max-time 8 "$public_health_url" | grep -q '"status":"ok"'; then
    echo "Public API is healthy: $public_health_url"
    exit 0
  fi
  sleep 2
done

echo "Container is healthy, but public HTTPS is unavailable: $public_health_url" >&2
echo "Check the Nginx 8099 site, certificate, firewall/security group and DNS." >&2
exit 1
