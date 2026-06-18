#!/bin/bash
# OPS Alpha · 周一 AI 周选生成（draft）
# 安装：/usr/local/bin/ops-alpha-ai-weekly-signals.sh
# 建议：周一 09:00 北京时间  0 1 * * 1

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ops-alpha/.env.production}"
LOG="${LOG:-/var/log/ops-alpha-ai-weekly-signals.log}"
BASE_URL="${BASE_URL:-https://opscapital.com}"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== ai-weekly-signals START =====" >> "$LOG"

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

HTTP_CODE=$(curl -sS -o /tmp/ops-alpha-ai-weekly-signals.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/cron/ai-weekly-signals" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json")

echo "[$(ts)] HTTP ${HTTP_CODE} $(cat /tmp/ops-alpha-ai-weekly-signals.json)" >> "$LOG"

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "[$(ts)] ERROR: request failed" >> "$LOG"
  exit 1
fi

echo "[$(ts)] ===== ai-weekly-signals DONE =====" >> "$LOG"
