#!/bin/bash
# OPS Alpha · 每日自动发 X 长文
# 安装：/usr/local/bin/ops-alpha-social-x.sh
# 依赖：/opt/ops-alpha/.env.production 中的 CRON_SECRET 与 X_API_* 凭据

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ops-alpha/.env.production}"
LOG="${LOG:-/var/log/ops-alpha-social-x.log}"
BASE_URL="${BASE_URL:-https://opscapital.com}"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== social-x START =====" >> "$LOG"

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

HTTP_CODE=$(curl -sS -o /tmp/ops-alpha-social-x.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/cron/social-x" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json")

echo "[$(ts)] HTTP ${HTTP_CODE} $(cat /tmp/ops-alpha-social-x.json)" >> "$LOG"

if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
  echo "[$(ts)] ERROR: request failed" >> "$LOG"
  exit 1
fi

echo "[$(ts)] ===== social-x DONE =====" >> "$LOG"
