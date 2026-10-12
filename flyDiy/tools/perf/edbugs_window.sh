#!/usr/bin/env bash
# edbugs_window.sh - EDITOR-BUGS G2780's GPU window (A0: Tue 13 Oct 05:15-05:40, hard drop 05:40): waits for the epoch,
# refuses a busy box, takes the GPU lock, then
#   1. the flood dimmer's first notches (G2782) - tools/perf/garage_lag.js --only flood on master (f353a0f89, an
#      archived copy under <worktree>/_ab/) and on this branch, the user's Cub, dev.html (the source layers, no build):
#      the master tree should show the long busy/settle of the re-keyed programs, this one should not;
#   2. the armed lights' frame cost (the question G2782 leaves) - tools/perf/garage_fps.js --lights on this branch,
#      ABBA 'none' / 'armed' in one page, the user's Cub and the metal Cessna;
# the lock dropped on EXIT whatever happens, every step bounded by the window's end.
# Usage: bash edbugs_window.sh <outDir> <startEpoch> <endEpoch>
OUT="$1"; T0="$2"; T1="$3"
HERE="$(cd "$(dirname "$0")" && pwd)"
FLY="$(cd "$HERE/../.." && pwd)"; WT="$(cd "$FLY/.." && pwd)"
LOCK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
BASE=f353a0f89
mkdir -p "$OUT"
exec >> "$OUT/window.log" 2>&1
echo "armed $(date '+%F %T'), opens at epoch $T0, closes at $T1"
while [ "$(date +%s)" -lt "$T0" ]; do sleep 20; done
if bash "$LOCK" show | grep -qE 'GPU_BENCH|RESERVED|CPU_BATTERY'; then echo "BOX BUSY at $(date +%T) - not run"; bash "$LOCK" show; exit 3; fi
for p in 8783 8584 9484; do if netstat -ano | grep -q ":$p .*LISTEN"; then echo "port $p taken - not run"; exit 4; fi; done
bash "$LOCK" take gpu G2780 "EDITOR-BUGS dimmer drag + armed-light cost (05:15-05:40)" || exit 1
cleanup() { bash "$LOCK" drop gpu G2780; echo "window closed $(date +%T)"; }
trap cleanup EXIT
echo "window open $(date +%T)"
left() { echo $(( T1 - $(date +%s) - 20 )); }
# the master tree, served beside this one (git archive: no checkout anywhere)
if [ ! -d "$WT/_ab/$BASE/flyDiy" ]; then mkdir -p "$WT/_ab/$BASE" && git -C "$WT" archive "$BASE" flyDiy | tar -x -C "$WT/_ab/$BASE"; fi
cd "$FLY"
L=$(left); [ "$L" -gt 120 ] || { echo "no time left"; exit 5; }
echo "--- 1. garage_lag flood (left ${L}s) $(date +%T)"
timeout $(( L > 600 ? 600 : L )) node tools/perf/garage_lag.js --port 8783 --udd C:/ugl2780 --trees base=_ab/$BASE/flyDiy,here=flyDiy \
  --builds cub --only flood --reps 3 --page dev.html --out "$OUT/garage_lag_flood.json"
echo "garage_lag exit $?"
for B in cub_2026-09-20_corrected cessna172_2026-09-20_corrected; do
  L=$(left); [ "$L" -gt 150 ] || { echo "no time left for $B"; break; }
  echo "--- 2. garage_fps --lights $B (left ${L}s) $(date +%T)"
  timeout $(( L > 420 ? 420 : L )) node tools/perf/garage_fps.js --lights --page dev.html --build builds/$B.json --q '' --secs 8 \
    --sport 8584 --dport 9484 --udd C:/gfps2780 --out "$OUT/garage_fps_lights_$B.json"
  echo "garage_fps exit $?"
done
