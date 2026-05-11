#!/bin/bash
# OPS Alpha · 价格提醒检查 cron wrapper
# 安装：/usr/local/bin/ops-alpha-alerts-check.sh
# 推荐 crontab（每 15 分钟，仅美股交易时段：北京时间 22:00-05:00 周一到周五）：
#   */15 22-23,0-4 * * 1-5 /usr/local/bin/ops-alpha-alerts-check.sh
# 也可以全天每 15 分钟跑（盘后 quote 不会触发现价类规则）：
#   */15 * * * * /usr/local/bin/ops-alpha-alerts-check.sh

set -e
SCRIPT="/data/ops-alpha/scripts/check-alerts.mjs"
CONTAINER="ops-alpha"
LOG="/var/log/ops-alpha-alerts.log"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(ts)] ERROR: container ${CONTAINER} not running" >> "$LOG"
  exit 1
fi
[ -f "$SCRIPT" ] || { echo "[$(ts)] ERROR: script not found: $SCRIPT" >> "$LOG"; exit 1; }

docker cp "$(dirname "$SCRIPT")/lib" "${CONTAINER}:/app/lib" 2>>"$LOG"
docker cp "$SCRIPT" "${CONTAINER}:/app/check-alerts.mjs" >/dev/null
echo "[$(ts)] ===== alerts check =====" >> "$LOG"
docker exec -w /app "${CONTAINER}" node check-alerts.mjs >> "$LOG" 2>&1 || {
  echo "[$(ts)] ERROR: node exec failed (exit $?)" >> "$LOG"
  exit 1
}
