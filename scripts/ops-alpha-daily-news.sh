#!/bin/bash
# OPS Alpha · 每日市场快讯 cron wrapper
# 安装位置：/usr/local/bin/ops-alpha-daily-news.sh
# 用法：
#   /usr/local/bin/ops-alpha-daily-news.sh          # 默认生成 2 篇
#   /usr/local/bin/ops-alpha-daily-news.sh 3        # 指定篇数

set -e
COUNT="${1:-2}"
SCRIPT="/data/ops-alpha/scripts/daily-news.mjs"
CONTAINER="ops-alpha"
LOG="/var/log/ops-alpha-daily-news.log"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== daily-news START (count=$COUNT) =====" >> "$LOG"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(ts)] ERROR: container ${CONTAINER} not running" >> "$LOG"
  exit 1
fi

if [ ! -f "$SCRIPT" ]; then
  echo "[$(ts)] ERROR: script not found: $SCRIPT" >> "$LOG"
  exit 1
fi

docker cp "$SCRIPT" "${CONTAINER}:/app/daily-news.mjs"
docker exec -w /app "${CONTAINER}" node daily-news.mjs --count="$COUNT" >> "$LOG" 2>&1 || {
  echo "[$(ts)] ERROR: node exec failed (exit $?)" >> "$LOG"
  exit 1
}

echo "[$(ts)] ===== daily-news DONE =====" >> "$LOG"
