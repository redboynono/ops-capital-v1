#!/bin/bash
# OPS Alpha · 每日精选内容 cron wrapper
# 安装位置：/usr/local/bin/ops-alpha-daily-content.sh
# 用法：
#   /usr/local/bin/ops-alpha-daily-content.sh          # 默认生成 3 篇
#   /usr/local/bin/ops-alpha-daily-content.sh 2        # 指定篇数

set -e
COUNT="${1:-3}"
SCRIPT="/data/ops-alpha/scripts/daily-content.mjs"
CONTAINER="ops-alpha"
LOG="/var/log/ops-alpha-daily-content.log"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== daily-content START (count=$COUNT) =====" >> "$LOG"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(ts)] ERROR: container ${CONTAINER} not running" >> "$LOG"
  exit 1
fi

if [ ! -f "$SCRIPT" ]; then
  echo "[$(ts)] ERROR: script not found: $SCRIPT" >> "$LOG"
  exit 1
fi

docker cp "$SCRIPT" "${CONTAINER}:/app/daily-content.mjs"
docker exec -w /app "${CONTAINER}" node daily-content.mjs --count="$COUNT" >> "$LOG" 2>&1 || {
  echo "[$(ts)] ERROR: node exec failed (exit $?)" >> "$LOG"
  exit 1
}

echo "[$(ts)] ===== daily-content DONE =====" >> "$LOG"
