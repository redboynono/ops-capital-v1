#!/bin/bash
# OPS Alpha · 「卡点 / 价值链」franchise 内容生成 cron wrapper
# 安装位置：/usr/local/bin/ops-alpha-chokepoint.sh
# 用法：
#   /usr/local/bin/ops-alpha-chokepoint.sh        # 默认生成 2 篇上游卡点深度
#   /usr/local/bin/ops-alpha-chokepoint.sh 3      # 指定篇数

set -e
COUNT="${1:-2}"
SCRIPT="/data/ops-alpha/scripts/daily-content.mjs"
CONTAINER="ops-alpha"
LOG="/var/log/ops-alpha-chokepoint.log"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== chokepoint START (count=$COUNT) =====" >> "$LOG"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[$(ts)] ERROR: container ${CONTAINER} not running" >> "$LOG"
  exit 1
fi

if [ ! -f "$SCRIPT" ]; then
  echo "[$(ts)] ERROR: script not found: $SCRIPT" >> "$LOG"
  exit 1
fi

docker cp "$(dirname "$SCRIPT")/lib" "${CONTAINER}:/app/lib" 2>>"$LOG"
docker cp "$SCRIPT" "${CONTAINER}:/app/daily-content.mjs"
docker exec -w /app "${CONTAINER}" node daily-content.mjs --mode=chokepoint --count="$COUNT" >> "$LOG" 2>&1 || {
  echo "[$(ts)] ERROR: node exec failed (exit $?)" >> "$LOG"
  exit 1
}

echo "[$(ts)] ===== chokepoint DONE =====" >> "$LOG"
