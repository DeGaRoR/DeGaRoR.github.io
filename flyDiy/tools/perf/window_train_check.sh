#!/bin/bash
# window_train_check.sh - THE PERF CHECK OF A TRAIN'S BUILD, IN ONE COMMAND (PERF-LEAD, 23 Nov 2026; first: L40J 03:15)
#   bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-LEAD --gpu -- bash tools/perf/window_train_check.sh [minutes, default 72]
#   TC_TREE=<the parent dir of the built flyDiy, default D:/Dev/wt-t42>  TC_OUT=<evidence dir>  TC_NAME=<L40J>
# A0, 23 Nov: "its PERF CHECK is owed before the push, and your tools are the right ones (rows 13-15 included)". The build
# is SERVED from its tree (read only); the tools are THIS tree's (the screen's recording, the page step, the readers).
# Every run HEADED in a visible Chrome at the user's 5K. The parts, each with its own cap, skipped if it does not fit:
#   1. the loads (tools/perf/rows/l40j-check.txt): cold x2 (the roll-out shot skipped, then played), then a returning
#      player's - the FIRST is the smoke: if it does not load, nothing else runs and the box is freed
#   2. the journey's first 8 minutes with the screen recorded (rows 8, 9, 13, 15)
#   3. the Cub's nose-down crash from 50 m with the screen recorded (rows 14, 15), twice if the time is there
W="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$W" || exit 9          # flyDiy/
TREE=${TC_TREE:-D:/Dev/wt-t42}; NAME=${TC_NAME:-L40J}
OUT=${TC_OUT:-D:/Dev/flydiy-notes/evidence/perf-check-$NAME-$(date +%Y-%m-%d)}; mkdir -p "$OUT"; LOG="$OUT/window.log"
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh; TK="D:/Dev/flydiy-notes/cpu_tokens"; WHO=PERF-LEAD; MIN=${1:-72}
END=$(( $(date +%s) + MIN * 60 )); left() { echo $(( (END - $(date +%s)) / 60 )); }
say() { echo "[$(date +%H:%M)] $*" | tee -a "$LOG"; }
HOLD() { local hk; for hk in 1 2 3 4; do echo "$WHO $(date +%H:%M:%S) the $NAME perf check (timing: all tokens)" > "$TK/${WHO}_$hk.tok"; done; }
BR="--steps compile,frames,worldCompile --miss 1"
nice -n 19 node -e "require('./tools/_core_fresh.js').assertFresh(require('path').resolve('tools/flight_core.js'))" || { say "REFUSED: tools/flight_core.js is not this tree's (run tools/perf/lab_build.sh)"; exit 4; }
[ -f "$TREE/flyDiy/dev.html" ] && [ -f "$TREE/flyDiy/index.html" ] || { say "REFUSED: no built page at $TREE/flyDiy"; exit 2; }
ROWS="$OUT/rows.txt"; sed "s#D:/Dev/wt-t42#$TREE#" tools/perf/rows/l40j-check.txt > "$ROWS"
HOLD; ( while :; do sleep 300; HOLD; done ) & REF=$!
trap 'kill $REF 2>/dev/null; rm -f "$TK"/${WHO}_[0-9].tok; bash $B drop gpu $WHO' EXIT
bash $B take gpu $WHO "the $NAME perf check" || { echo "no gpu lock"; exit 3; }
say "$NAME perf check start, $MIN min, HEADED 5120x1440, the tree $TREE, build $(cut -c1-70 "$TREE/flyDiy/version.json"), tools $(git log --oneline -1 | cut -c1-9)"

# 1. the loads; the first is the smoke
say "part 1: the loads (cold, the shot skipped; cold, the shot played; warm)"
LM_HELD=1 LM_STOP_FIRST=1 LM_AFTER=12 LM_SECS=330 LM_EST=250 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=14 bash tools/perf/load_matrix.sh "$ROWS" "$OUT/loads" 18 2>&1 | tee -a "$LOG"
[ "${PIPESTATUS[0]}" = 5 ] && { say "ABORT: the first load did not load; the box is freed, nothing else runs"; exit 5; }
grep -h "^TRAIN_" "$OUT/loads/summary.txt" | grep -o '^[A-Z0-9_]*\|rollout: [^|]*' | paste - - | cut -c1-400 | tee -a "$LOG"

fly() {   # fly <tag> <scenario> <cap min> <step for the picture reader, or ->
  local tag=$1 sc="$W/tools/flight_scripts/perf/$2.json" cm=$3 stp=$4
  say "$tag: $2, the screen recorded, cap $cm min"
  ( timeout $(( cm * 60 )) nice -n 19 node tools/flight_script.js "$sc" --runner page --headed --live --size 5120x1271 --repo "$TREE" --q "recring=131072" --screencast "$OUT/$tag/screen" --out "$OUT/$tag" --cap $(( cm * 60 - 40 )) ) > "$OUT/$tag.out" 2>&1
  grep "  ok  \|  FAIL\|WHY\|^PASS\|^FAIL\|page: \|screencast:" "$OUT/$tag.out" | cut -c1-700 | tee -a "$LOG"
  local J; J=$(ls -t "$OUT/$tag"/*.flightlog.json 2>/dev/null | head -1)
  if [ -n "$J" ]; then nice -n 19 python tools/perf/user_log.py "$J" --md "$OUT/$tag/against-objectives.md" 2>&1 | grep -v "^    t+" | tail -45 | cut -c1-400 | tee -a "$LOG"
    for t in big_uploads.js freeze_ledger.js; do [ -f "tools/$t" ] && nice -n 19 node tools/$t "$J" > "$OUT/$tag/${t%.js}.txt" 2>&1; done
  else say "NO FLIGHT LOG for $tag"; fi
  if [ "$stp" = - ]; then nice -n 19 python tools/perf/screen_read.py "$OUT/$tag/screen" --md "$OUT/$tag/screen.md" 2>&1 | cut -c1-300 | tee -a "$LOG"
  else nice -n 19 python tools/perf/screen_read.py "$OUT/$tag/screen" --step "$stp" --md "$OUT/$tag/screen.md" 2>&1 | cut -c1-300 | tee -a "$LOG"; fi
}
# 2. the journey
if [ $(left) -ge 15 ]; then fly journey journey_first8_picture 14 -; else say "part 2 SKIPPED: $(left) min left"; fi
# 3. the crash, twice if the time is there
for n in 1 2; do
  if [ $(left) -ge 9 ]; then fly crash$n crash_cub_nosedown_magenta 8 "nose down"; else say "part 3 (crash $n) SKIPPED: $(left) min left"; fi
done
say "$NAME perf check end"
