#!/usr/bin/env bash
# finish_window.sh - FINISH-FIX G2750's GPU window: the lock, a live_driver on <root>, finish_stills, the lock dropped on
# EXIT whatever happens. Usage: bash finish_window.sh <root> <outDir> <tag> <minutes> [steps]
ROOT="$1"; OUT="$2"; TAG="$3"; MIN="${4:-23}"; STEPS="${5:-garage,flight,reg}"
HERE="$(cd "$(dirname "$0")" && pwd)"
LOCK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
mkdir -p "$OUT"
bash "$LOCK" take gpu FINISH-FIX "G2750 stills $TAG" || exit 1
DRV=
cleanup() {
  curl -s -m 3 http://127.0.0.1:8752/quit >/dev/null 2>&1
  sleep 1; [ -n "$DRV" ] && kill "$DRV" 2>/dev/null
  bash "$LOCK" drop gpu FINISH-FIX
  echo "window closed $(date +%H:%M:%S)"
}
trap cleanup EXIT
echo "window open $(date +%H:%M:%S)"
SPORT=8751 DPORT=9751 UDD=C:/ffs node "$ROOT/flyDiy/tools/live_driver.js" "$ROOT" tools/fixtures/repro/mosquito_3.json dev.html 8752 > "$OUT/${TAG}_driver.log" 2>&1 &
DRV=$!
for i in $(seq 1 60); do grep -q "cmd on" "$OUT/${TAG}_driver.log" 2>/dev/null && break; sleep 1; done
timeout $(( MIN * 60 )) node "$HERE/finish_stills.js" 8752 "$OUT" "$TAG" "$STEPS"
echo "stills exit $?"
