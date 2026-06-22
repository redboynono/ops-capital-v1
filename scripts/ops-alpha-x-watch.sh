#!/bin/bash
# OPS Alpha · 监听 X 账号新帖并生成回复草稿（分批拉取 + 分批 AI 分析）
# 安装：/usr/local/bin/ops-alpha-x-watch.sh

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ops-alpha/.env.production}"
LOG="${LOG:-/var/log/ops-alpha-x-watch.log}"
BASE_URL="${BASE_URL:-https://opscapital.com}"
LOCK_FILE="${LOCK_FILE:-/var/run/ops-alpha-x-watch.lock}"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "[$(ts)] SKIP: previous x-watch still running" >> "$LOG"
  exit 0
fi

echo "[$(ts)] ===== x-watch START =====" >> "$LOG"

if [ ! -f "$ENV_FILE" ]; then
  echo "[$(ts)] ERROR: env file not found: $ENV_FILE" >> "$LOG"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[$(ts)] ERROR: CRON_SECRET missing" >> "$LOG"
  exit 1
fi

HTTP_CODE=$(curl -sS -o /tmp/ops-alpha-x-watch.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/cron/x-watch" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 120)

echo "[$(ts)] HTTP ${HTTP_CODE} $(cat /tmp/ops-alpha-x-watch.json)" >> "$LOG"

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "[$(ts)] ERROR: request failed" >> "$LOG"
  exit 1
fi

echo "[$(ts)] ===== x-watch DONE =====" >> "$LOG"
