#!/bin/bash
# OPS Alpha · 每日简报 cron wrapper
# 安装：/usr/local/bin/ops-alpha-daily-briefing.sh
# 建议时段：08:30 CST（北京时间），覆盖美股盘后 + 港股盘前
#   30 8 * * * /usr/local/bin/ops-alpha-daily-briefing.sh

set -e
SCRIPT="/data/ops-alpha/scripts/daily-briefing.mjs"
CONTAINER="ops-alpha"
LOG="/var/log/ops-alpha-daily-briefing.log"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== daily-briefing START =====" >> "$LOG"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(ts)] ERROR: container ${CONTAINER} not running" >> "$LOG"
  exit 1
fi

if [ ! -f "$SCRIPT" ]; then
  echo "[$(ts)] ERROR: script not found: $SCRIPT" >> "$LOG"
  exit 1
fi

docker cp "$SCRIPT" "${CONTAINER}:/app/daily-briefing.mjs"
docker exec -w /app "${CONTAINER}" node daily-briefing.mjs >> "$LOG" 2>&1 || {
  echo "[$(ts)] ERROR: node exec failed (exit $?)" >> "$LOG"
  exit 1
}

echo "[$(ts)] ===== daily-briefing DONE =====" >> "$LOG"
