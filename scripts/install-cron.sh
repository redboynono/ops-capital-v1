#!/usr/bin/env bash
# Install OPS Alpha cron wrappers on the production host.
# Run on server as root after deploy sync.
set -euo pipefail

REPO="${REPO:-/data/ops-alpha}"
if [ ! -d "$REPO/scripts" ]; then
  REPO="/opt/ops-alpha"
fi

install -m 755 "$REPO/scripts/ops-alpha-daily-briefing.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-daily-content.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-daily-news.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-alerts-check.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-snapshot-ratings.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-social-x.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-chokepoint.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-warm-track-record.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-ai-weekly-signals.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-ai-signals-email.sh" /usr/local/bin/
install -m 755 "$REPO/scripts/ops-alpha-x-watch.sh" /usr/local/bin/

if [ -f "$REPO/scripts/ops-alpha-earnings-cron.sh" ]; then
  install -m 755 "$REPO/scripts/ops-alpha-earnings-cron.sh" /usr/local/bin/
fi

CRON_MARKER="# ops-alpha-cron"
TMP=$(mktemp)
crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | grep -v ops-alpha- > "$TMP" || true

cat >> "$TMP" <<EOF
$CRON_MARKER
30 8 * * * /usr/local/bin/ops-alpha-daily-briefing.sh >> /var/log/ops-alpha-daily-briefing.log 2>&1
15 */6 * * * /usr/local/bin/ops-alpha-daily-content.sh 1 >> /var/log/ops-alpha-daily-content.log 2>&1
30 9 * * * /usr/local/bin/ops-alpha-daily-content.sh 3 >> /var/log/ops-alpha-daily-content.log 2>&1
0 */4 * * * /usr/local/bin/ops-alpha-daily-news.sh 2 >> /var/log/ops-alpha-daily-news.log 2>&1
*/15 * * * * /usr/local/bin/ops-alpha-alerts-check.sh >> /var/log/ops-alpha-alerts.log 2>&1
30 16 * * 1-5 /usr/local/bin/ops-alpha-snapshot-ratings.sh >> /var/log/ops-alpha-snapshot-ratings.log 2>&1
0 9 * * * /usr/local/bin/ops-alpha-social-x.sh >> /var/log/ops-alpha-social-x.log 2>&1
0 7 * * 1,3,5 /usr/local/bin/ops-alpha-chokepoint.sh 2 >> /var/log/ops-alpha-chokepoint.log 2>&1
30 10 * * 1,3,5 /usr/local/bin/ops-alpha-social-x.sh chokepoint >> /var/log/ops-alpha-social-x.log 2>&1
0 13 * * 1 /usr/local/bin/ops-alpha-social-x.sh record >> /var/log/ops-alpha-social-x.log 2>&1
35 16 * * 1-5 /usr/local/bin/ops-alpha-warm-track-record.sh >> /var/log/ops-alpha-warm-track-record.log 2>&1
0 1 * * 1 /usr/local/bin/ops-alpha-ai-weekly-signals.sh >> /var/log/ops-alpha-ai-weekly-signals.log 2>&1
30 0 * * 2 /usr/local/bin/ops-alpha-ai-signals-email.sh >> /var/log/ops-alpha-ai-signals-email.log 2>&1
*/30 * * * * /usr/local/bin/ops-alpha-x-watch.sh >> /var/log/ops-alpha-x-watch.log 2>&1
EOF

crontab "$TMP"
rm -f "$TMP"
echo "Installed cron entries:"
crontab -l | grep ops-alpha
