#!/bin/bash
# Daily ratings snapshot — append ticker_ratings + factor grades to history tables.
set -e
SCRIPT="/data/ops-alpha/scripts/snapshot-ratings.mjs"
CONTAINER="ops-alpha"
LOG="/var/log/ops-alpha-snapshot-ratings.log"
ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

echo "[$(ts)] ===== snapshot-ratings START =====" >> "$LOG"
[ -f "$SCRIPT" ] || SCRIPT="/opt/ops-alpha/scripts/snapshot-ratings.mjs"

docker cp "$(dirname "$SCRIPT")/lib" "${CONTAINER}:/app/lib" 2>>"$LOG" || true
docker cp "$SCRIPT" "${CONTAINER}:/app/snapshot-ratings.mjs"
docker exec -w /app "${CONTAINER}" node snapshot-ratings.mjs >> "$LOG" 2>&1
echo "[$(ts)] ===== snapshot-ratings DONE =====" >> "$LOG"
