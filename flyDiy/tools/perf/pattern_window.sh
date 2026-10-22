#!/usr/bin/env bash
# pattern_window.sh - LIVERY-PATTERNS G2870's GPU window (A0: Tue 13 Oct 04:15-04:40, untimed): waits for the epoch,
# refuses a busy box, takes the lock, a live_driver on <root> with the user's Cub, pattern_checks (NUMBERS ONLY - no stills), the lock dropped on
# EXIT whatever happens, hard stop at the window end.
# Usage: bash pattern_window.sh <root> <outDir> <tag> <startEpoch> <endEpoch> [steps]
ROOT="$1"; OUT="$2"; TAG="$3"; T0="$4"; T1="$5"; STEPS="${6:-fit,atlas,render,flight}"
HERE="$(cd "$(dirname "$0")" && pwd)"
LOCK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
mkdir -p "$OUT"
while [ "$(date +%s)" -lt "$T0" ]; do sleep 20; done
# the slot before mine gets three minutes to drop its lock, then I stand down
while bash "$LOCK" show | grep -qE 'GPU|RESERVED|CPU_BATTERY'; do
  [ "$(date +%s)" -gt $((T0 + 180)) ] && { echo "BOX BUSY at $(date +%H:%M:%S) - not run"; bash "$LOCK" show; exit 3; }
  sleep 10; done
for p in 8761 8762 9761; do if netstat -ano | grep -q ":$p .*LISTEN"; then echo "port $p taken - not run"; exit 4; fi; done
bash "$LOCK" take gpu LIVERY-PATTERNS "G2870 pattern checks (numbers only) $TAG (untimed)" || exit 1
DRV=
cleanup() {
  curl -s -m 3 http://127.0.0.1:8762/quit >/dev/null 2>&1
  sleep 1; [ -n "$DRV" ] && taskkill //PID "$DRV" //T //F >/dev/null 2>&1
  bash "$LOCK" drop gpu LIVERY-PATTERNS
  echo "window closed $(date +%H:%M:%S)"
}
trap cleanup EXIT
echo "window open $(date +%H:%M:%S)"
SPORT=8761 DPORT=9761 UDD=C:/lps node "$ROOT/flyDiy/tools/live_driver.js" "$ROOT" builds/cub_2026-09-20_corrected.json dev.html 8762 > "$OUT/${TAG}_driver.log" 2>&1 &
DRV=$!
for i in $(seq 1 90); do grep -q "cmd on" "$OUT/${TAG}_driver.log" 2>/dev/null && break; sleep 1; done
LEFT=$(( T1 - $(date +%s) - 30 ))
[ "$LEFT" -gt 60 ] || { echo "no time left"; exit 5; }
timeout "$LEFT" node "$HERE/pattern_checks.js" 8762 "$OUT" "$TAG" "$STEPS"
echo "checks exit $?"
