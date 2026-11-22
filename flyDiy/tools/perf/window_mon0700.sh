#!/bin/bash
# window_mon0700.sh - MONDAY 23 Nov 2026, 07:00-08:00 (PERF-LEAD), IN ONE COMMAND
#   bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-LEAD --gpu -- bash tools/perf/window_mon0700.sh [minutes, default 57]
# (A0's wrapper starts it when PERF-LEAD is the first line of gpu_queue.txt; the GPU lock is taken INSIDE, every CPU token
# is held for the window and all of it is freed on exit.) The lab build must stand first (tools/perf/lab_build.sh).
# The parts, in the order of what a decision waits for; each has its own cap and is skipped if it does not fit:
#   0. A REAL SMOKE LOAD, every switch on, with a departure watched to the flight: if it does not load, nothing else runs
#   1. ?latelinks=bg with Go 6 s after the reveal, watched 60 s: the cost of an early Go, or a hang (the train waits for it)
#   2. the best load twice beside the base, Go after 45 s; then the best load with Go after 12 s
#   2c. THE CRASH (row 14, new): the Cub into the ground from its climb, as today and with ?latelinks=bg
#   3. the journey's first 8 minutes with the flight switches and the far terrain at 2 px (?fartol=2): the detail choice
#   4. PERF-WORLDBUILD's three workers again (their queue's fix, if it is in the build)
W="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$W" || exit 9          # flyDiy/
OUT=${MON_OUT:-D:/Dev/flydiy-notes/evidence/perf-mon0700-2026-11-23}; mkdir -p "$OUT"; LOG="$OUT/window.log"
LAB=${MON_LAB:-D:/Dev/perf-lab-built}; B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
TK="D:/Dev/flydiy-notes/cpu_tokens"; WHO=PERF-LEAD; MIN=${1:-57}
END=$(( $(date +%s) + MIN * 60 )); left() { echo $(( (END - $(date +%s)) / 60 )); }
say() { echo "[$(date +%H:%M)] $*" | tee -a "$LOG"; }
HOLD() { local hk; for hk in 1 2 3 4; do echo "$WHO $(date +%H:%M:%S) the Monday 07:00 perf window (timing: all tokens)" > "$TK/${WHO}_$hk.tok"; done; }
BR="--steps compile,frames,worldCompile --miss 1"
# before anything is taken: this tree's tools must load (a stale generated core refused every load at 14:00), and the
# lab build must be the one with tonight's switches
nice -n 19 node -e "require('./tools/_core_fresh.js').assertFresh(require('path').resolve('tools/flight_core.js'))" || { say "REFUSED: tools/flight_core.js is not this tree's (run tools/perf/lab_build.sh)"; exit 4; }
[ -f "$LAB/flyDiy/dev.html" ] || { say "REFUSED: no lab build at $LAB"; exit 2; }
# (index.html holds the inlined scripts, src/viewer/ the ones it loads by name: dev.html holds neither)
for k in farslots mirpace latelinks=bg roadw pavefirst fartol rollout-watch; do grep -rqs "$k" "$LAB/flyDiy/tools/boot_perf.js" "$LAB/flyDiy/index.html" "$LAB/flyDiy/src/viewer/render_premises.js" || { say "REFUSED: the lab build has no $k (rebuild first)"; exit 2; }; done
[ -f "$LAB/flyDiy/tools/flight_scripts/perf/journey_first8.json" ] || { say "REFUSED: the lab build has no journey_first8.json"; exit 2; }
HOLD; ( while :; do sleep 300; HOLD; done ) & REF=$!
trap 'kill $REF 2>/dev/null; rm -f "$TK"/${WHO}_[0-9].tok; bash $B drop gpu $WHO' EXIT
bash $B take gpu $WHO "the Monday 07:00 perf window" || { echo "no gpu lock"; exit 3; }
say "window start, $MIN min, lab $(head -1 "$LAB/LAB-BUILD.txt" 2>/dev/null | cut -c1-110)"

# 0. the smoke load
say "part 0: smoke"
LM_HELD=1 LM_STOP_FIRST=1 LM_AFTER=8 LM_SECS=330 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=12 bash tools/perf/load_matrix.sh tools/perf/rows/smoke-mon.txt "$OUT/smoke" 7 2>&1 | tee -a "$LOG"
if [ "${PIPESTATUS[0]}" = 5 ]; then
  if [ -d "$LAB-prev" ]; then say "FALLBACK: the smoke load failed on the lab build; the previous build takes its place"
    mv "$LAB" "$LAB-failed" && mv "$LAB-prev" "$LAB" || { say "ABORT: the folders could not be swapped"; exit 5; }
    LM_HELD=1 LM_STOP_FIRST=1 LM_AFTER=8 LM_SECS=330 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=12 bash tools/perf/load_matrix.sh tools/perf/rows/smoke-mon.txt "$OUT/smoke_prev" 7 2>&1 | tee -a "$LOG"
    [ "${PIPESTATUS[0]}" = 5 ] && { say "ABORT: the smoke load did not load on the previous build either; the box is freed"; exit 5; }
  else say "ABORT: the smoke load did not load; the box is freed, nothing else runs"; exit 5; fi
fi
grep -h "^SMOKE_MON" "$OUT"/smoke*/summary.txt | grep -o 'rollout: [^|]*' | tee -a "$LOG"

# 1. the early Go, watched to the flight
if [ $(left) -ge 12 ]; then say "part 1: Go 6 s after the reveal, watched 60 s"
  LM_HELD=1 LM_AFTER=6 LM_SECS=330 LM_EST=200 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=20 bash tools/perf/load_matrix.sh tools/perf/rows/mon-0700-go.txt "$OUT/go6" 11 2>&1 | tee -a "$LOG"
  grep -h "^GO6" "$OUT/go6/summary.txt" | grep -o '^[A-Z0-9_]*\|rollout: [^|]*' | paste - - | tee -a "$LOG"
else say "part 1 SKIPPED: $(left) min left"; fi

# 2. the best load twice beside the base (Go after 45 s), then Go after 12 s
if [ $(left) -ge 16 ]; then say "part 2: the best load, twice, beside the base"
  LM_HELD=1 LM_AFTER=45 LM_SECS=330 LM_EST=215 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=30 bash tools/perf/load_matrix.sh tools/perf/rows/mon-0700-best.txt "$OUT/best" 15 2>&1 | tee -a "$LOG"
else say "part 2 SKIPPED: $(left) min left"; fi
if [ $(left) -ge 6 ]; then say "part 2b: the best load, Go 12 s after the reveal"
  LM_HELD=1 LM_AFTER=12 LM_SECS=330 LM_EST=200 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=20 bash tools/perf/load_matrix.sh tools/perf/rows/mon-0700-go12.txt "$OUT/go12" 5 2>&1 | tee -a "$LOG"
else say "part 2b SKIPPED: $(left) min left"; fi

# 2c. ROW 14 (the user, 22 Nov eve: "less than 250 ms freeze on crash, and no sky blue screen"): the Cub put into the
#     ground from its climb, as the game is today and with ?latelinks=bg (the scuff's programs are what that switch moves).
#     On the LAB build: the Deform Coordinator owns the crashes and has a later version - this is the lab's baseline only.
for cq in base latebg; do
  if [ $(left) -ge 9 ]; then
    Q="recring=131072"; [ $cq = latebg ] && Q="$Q&latelinks=bg"
    say "part 2c: the crash, $cq ($Q), cap 9 min, crash_cub_nosedown (the nose put down from 50 m by the hand: the user, 22 Nov - the 45 m drop is not representative)"
    ( timeout 520 nice -n 19 node tools/flight_script.js "$W/tools/flight_scripts/perf/crash_cub_nosedown.json" --runner page --headed --live --size 5120x1271 --repo "$LAB" --q "$Q" --out "$OUT/crash_$cq" --cap 480 ) 2>&1 | tail -12 | tee -a "$LOG"
    J=$(ls -t "$OUT"/crash_$cq/*.flightlog.json 2>/dev/null | head -1)
    if [ -n "$J" ]; then nice -n 19 python tools/perf/user_log.py "$J" --md "$OUT/crash_$cq/against-objectives.md" 2>&1 | sed -n '/^## Row 14/,/^## /p' | head -30 | tee -a "$LOG"
    else say "NO FLIGHT LOG for the $cq crash"; fi
  else say "part 2c ($cq) SKIPPED: $(left) min left"; fi
done

# 3. the flight with the far terrain at 2 px
JM=${MON_JOURNEY_MIN:-12}
if [ $(left) -ge $(( JM + 1 )) ]; then
  Q="recring=131072&recup=1&farslots=1&mirpace=1&mirlean=1&fartol=2"
  say "part 3: the journey's first 8 minutes, the flight switches + fartol=2, cap $JM min"
  ( cd "$LAB/flyDiy" && timeout $(( JM * 60 )) nice -n 19 node tools/flight_script.js tools/flight_scripts/perf/journey_first8.json --runner page --headed --live --size 5120x1271 --q "$Q" --out "$OUT/journey_fartol2" --cap $(( JM * 60 - 40 )) ) 2>&1 | tail -25 | tee -a "$LOG"
  J=$(ls -t "$OUT"/journey_fartol2/*.flightlog.json 2>/dev/null | head -1)
  if [ -n "$J" ]; then nice -n 19 python tools/perf/user_log.py "$J" --md "$OUT/journey_fartol2/against-objectives.md" 2>&1 | grep -v "^    t+" | tail -40 | tee -a "$LOG"
    for t in big_uploads.js "slot_frames.js --slot mirror"; do set -- $t; [ -f "$LAB/flyDiy/tools/$1" ] && ( cd "$LAB/flyDiy" && nice -n 19 node tools/$t "$J" ) > "$OUT/journey_fartol2/${1%.js}.txt" 2>&1; done
  else say "NO FLIGHT LOG for the fartol journey"; fi
else say "part 3 SKIPPED: $(left) min left"; fi

# 4. the world build's three workers again, in what is left
R=$(( $(left) - 1 ))
if [ $R -ge 4 ]; then say "part 4: the roads in the worker, cap $R min"
  LM_HELD=1 LM_AFTER=12 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=20 bash tools/perf/load_matrix.sh tools/perf/rows/eve-world-2026-11-22.txt "$OUT/world" $R 2>&1 | tee -a "$LOG"
else say "part 4 SKIPPED: $R min left"; fi
say "window end"
