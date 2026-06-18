#!/bin/bash
# OPS Alpha · AI 周选 Pro 邮件（发布后）
# 安装：/usr/local/bin/ops-alpha-ai-signals-email.sh
# 建议：周二 08:30 北京时间（admin 周一复核发布后）  30 0 * * 2

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ops-alpha/.env.production}"
LOG="${LOG:-/var/log/ops-alpha-ai-signals-email.log}"
BASE_URL="${BASE_URL:-https://opscapital.com}"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== ai-signals-email START =====" >> "$LOG"

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

HTTP_CODE=$(curl -sS -o /tmp/ops-alpha-ai-signals-email.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/cron/ai-signals-email" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json")

echo "[$(ts)] HTTP ${HTTP_CODE} $(cat /tmp/ops-alpha-ai-signals-email.json)" >> "$LOG"

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "[$(ts)] ERROR: request failed" >> "$LOG"
  exit 1
fi

echo "[$(ts)] ===== ai-signals-email DONE =====" >> "$LOG"
