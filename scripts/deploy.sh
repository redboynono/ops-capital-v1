#!/usr/bin/env bash
# Deploy ops-alpha to production (188.239.8.157).
# Preserves /opt/ops-alpha/.env.production on the server.
set -euo pipefail

SERVER=root@188.239.8.157
PASS=tzmm.987
export PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin

HERE="$(cd "$(dirname "$0")/.." && pwd)"

echo "--> rsync $HERE -> $SERVER:/opt/ops-alpha/"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude '.env.production' --exclude '.env.local' \
  -e "sshpass -p $PASS ssh" \
  "$HERE"/ $SERVER:/opt/ops-alpha/

echo "--> docker build + restart"
sshpass -p "$PASS" ssh -o ServerAliveInterval=15 "$SERVER" '
  set -e
  cd /opt/ops-alpha
  docker build -t ops-alpha:latest . | tail -3
  docker rm -f ops-alpha >/dev/null || true
  docker run -d --name ops-alpha --restart unless-stopped \
    --network opsa-net --env-file /opt/ops-alpha/.env.production \
    ops-alpha:latest
  sleep 3
  docker logs --tail 5 ops-alpha
'
echo "--> smoke"
for p in / /alpha /login; do
  code=$(sshpass -p "$PASS" ssh -o ServerAliveInterval=15 "$SERVER" \
    "curl -s -o /dev/null -w '%{http_code}' https://opscapital.com$p")
  printf "  %-12s %s\n" "$p" "$code"
done
echo "done."
