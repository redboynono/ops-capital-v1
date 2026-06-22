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
echo "--> db migrations"
for mig in 015_entitlement_brief.sql 016_social_content_type_chokepoint.sql 022_content_feedback.sql 023_ai_weekly_signals.sql 024_x_watch.sql 025_x_watch_reply_zh.sql 026_x_watch_auto_quote.sql 027_x_watch_quality_metrics.sql; do
  sshpass -p "$PASS" ssh -o ServerAliveInterval=15 "$SERVER" \
    'PW=$(grep -m1 "^MYSQL_URL=" /opt/ops-alpha/.env.production | sed -n "s#.*root:\([^@]*\)@.*#\1#p" | sed "s/%21/!/g"); docker exec -i ops-mysql mysql -uroot -p"$PW" ops_alpha' \
    < "$HERE/mysql/migrations/$mig" 2>/dev/null || echo "  ($mig skipped or already applied)"
done

echo "--> install cron (chokepoint + track-record X + warm cache)"
sshpass -p "$PASS" ssh -o ServerAliveInterval=15 "$SERVER" \
  "REPO=/opt/ops-alpha bash /opt/ops-alpha/scripts/install-cron.sh"

echo "--> smoke"
for p in / /alpha /login; do
  code=$(sshpass -p "$PASS" ssh -o ServerAliveInterval=15 "$SERVER" \
    "curl -s -o /dev/null -w '%{http_code}' https://opscapital.com$p")
  printf "  %-12s %s\n" "$p" "$code"
done
echo "done."
