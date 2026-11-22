#!/bin/bash
# window_eve_2026-11-22.sh - THE EVENING PERF WINDOW (PERF-LEAD, 22 Nov 2026), 60 min after L40J's push, IN ONE COMMAND
#   bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-LEAD --gpu -- bash tools/perf/window_eve_2026-11-22.sh [minutes, default 58]
# (A0's wrapper starts it when PERF-LEAD is the first line of gpu_queue.txt; the GPU lock is taken INSIDE, every CPU token
# is held for the window and all of it is freed on exit.) The lab build must stand first (tools/perf/lab_build.sh).
# The parts, in the order of what a decision waits for; each has its own cap and is skipped if it does not fit:
#   0. A REAL SMOKE LOAD, every new switch on, with a departure: if it does not load, nothing else runs (the 14:00 lesson)
#   1. ?latelinks=bg against the base and ?latelinks=1: the load, the long tasks after the reveal, the departure   (A0: L40K)
#   2. the journey's first 8 minutes twice: the base, then ?farslots=1 + ?mirpace=1 + ?mirlean=1                  (rows 8, 9)
#   3. PERF-WORLDBUILD's roads / aprons / material map in the worker (?roadw=1)
W="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$W" || exit 9          # flyDiy/
OUT=${EVE_OUT:-D:/Dev/flydiy-notes/evidence/perf-eve-2026-11-22}; mkdir -p "$OUT"; LOG="$OUT/window.log"
LAB=${EVE_LAB:-D:/Dev/perf-lab-built}; B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
TK="D:/Dev/flydiy-notes/cpu_tokens"; WHO=PERF-LEAD; MIN=${1:-58}
END=$(( $(date +%s) + MIN * 60 )); left() { echo $(( (END - $(date +%s)) / 60 )); }
say() { echo "[$(date +%H:%M)] $*" | tee -a "$LOG"; }
HOLD() { local hk; for hk in 1 2 3 4; do echo "$WHO $(date +%H:%M:%S) the evening perf window (timing: all tokens)" > "$TK/${WHO}_$hk.tok"; done; }
BR="--steps compile,frames,worldCompile --miss 1"
# before anything is taken: this tree's tools must load (a stale generated core refused every load at 14:00), and the
# lab build must be the one with tonight's switches
nice -n 19 node -e "require('./tools/_core_fresh.js').assertFresh(require('path').resolve('tools/flight_core.js'))" || { say "REFUSED: tools/flight_core.js is not this tree's (run tools/perf/lab_build.sh)"; exit 4; }
[ -f "$LAB/flyDiy/dev.html" ] || { say "REFUSED: no lab build at $LAB"; exit 2; }
for k in farslots mirpace latelinks=bg; do grep -q "$k" "$LAB/flyDiy/dev.html" || { say "REFUSED: the lab build has no $k (rebuild first)"; exit 2; }; done
[ -f "$LAB/flyDiy/tools/flight_scripts/perf/journey_first8.json" ] || { say "REFUSED: the lab build has no journey_first8.json"; exit 2; }
HOLD; ( while :; do sleep 300; HOLD; done ) & REF=$!
trap 'kill $REF 2>/dev/null; rm -f "$TK"/${WHO}_[0-9].tok; bash $B drop gpu $WHO' EXIT
bash $B take gpu $WHO "the evening perf window" || { echo "no gpu lock"; exit 3; }
say "window start, $MIN min, lab $(head -1 "$LAB/LAB-BUILD.txt" 2>/dev/null | cut -c1-110)"

# 0. the smoke load: every new switch on, a departure 8 s after the reveal
say "part 0: smoke"
LM_HELD=1 LM_STOP_FIRST=1 LM_AFTER=8 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=12 bash tools/perf/load_matrix.sh tools/perf/rows/smoke-eve.txt "$OUT/smoke" 6 2>&1 | tee -a "$LOG"
[ "${PIPESTATUS[0]}" = 5 ] && { say "ABORT: the smoke load did not load; the box is freed, nothing else runs"; exit 5; }
grep -q "^SMOKE_NEW \[" "$OUT/smoke/summary.txt" 2>/dev/null || { say "ABORT: no smoke row in the summary; the box is freed"; exit 5; }
grep "^SMOKE_NEW" "$OUT/smoke/summary.txt" | grep -o '"farslots":{[^}]*}\|"bg":{[^}]*}\|"mirror":{[^}]*}\|"roadw":{[^}]*}\|rollout: [^|]*' | tee -a "$LOG"

# 1. latelinks=bg (45 s in the garage, then Go), then the worst case (Go after 6 s)
P1=${EVE_P1_MIN:-19}; [ $(left) -lt $(( P1 + 2 )) ] && P1=$(( $(left) - 2 ))
if [ $P1 -ge 4 ]; then say "part 1: the late links, cap $P1 min"
  LM_HELD=1 LM_AFTER=45 LM_EST=215 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=30 bash tools/perf/load_matrix.sh tools/perf/rows/eve-2026-11-22.txt "$OUT/loads" $P1 2>&1 | tee -a "$LOG"
fi
if [ $(left) -ge 34 ]; then say "part 1b: Go 6 s after the reveal"
  LM_HELD=1 LM_AFTER=6 LM_EST=190 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=30 bash tools/perf/load_matrix.sh tools/perf/rows/eve-go6-2026-11-22.txt "$OUT/loads_go6" 4 2>&1 | tee -a "$LOG"
else say "part 1b SKIPPED: $(left) min left"; fi

# 2. the journey's first 8 minutes, the base then the three flight switches (run from the LAB build's own tools)
JM=${EVE_JOURNEY_MIN:-12}
for v in base new; do
  if [ $(left) -ge $(( JM + 1 )) ]; then
    Q="recring=131072&recup=1"; [ $v = new ] && Q="$Q&farslots=1&mirpace=1&mirlean=1"
    say "part 2: the journey's first 8 minutes, $v ($Q), cap $JM min"
    ( cd "$LAB/flyDiy" && timeout $(( JM * 60 )) nice -n 19 node tools/flight_script.js tools/flight_scripts/perf/journey_first8.json --runner page --headed --live --size 5120x1271 --q "$Q" --out "$OUT/journey_$v" --cap $(( JM * 60 - 40 )) ) 2>&1 | tail -25 | tee -a "$LOG"
    J=$(ls -t "$OUT"/journey_$v/*.flightlog.json 2>/dev/null | head -1)
    if [ -n "$J" ]; then
      ( cd "$LAB/flyDiy" && nice -n 19 node tools/freeze_ledger.js "$J" --md "$OUT/journey_$v/freezes.md" --show 30 ) 2>&1 | tail -14 | tee -a "$LOG"
      for t in big_uploads.js "slot_frames.js --slot mirror"; do set -- $t; [ -f "$LAB/flyDiy/tools/$1" ] && ( cd "$LAB/flyDiy" && nice -n 19 node tools/$t "$J" ) > "$OUT/journey_$v/${1%.js}.txt" 2>&1; done
    else say "NO FLIGHT LOG for the $v journey"; fi
  else say "part 2 ($v) SKIPPED: $(left) min left"; fi
done

# 3. the world build's three workers, in what is left
R=$(( $(left) - 1 ))
if [ $R -ge 4 ]; then say "part 3: the roads in the worker, cap $R min"
  LM_HELD=1 LM_AFTER=12 LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=20 bash tools/perf/load_matrix.sh tools/perf/rows/eve-world-2026-11-22.txt "$OUT/world" $R 2>&1 | tee -a "$LOG"
else say "part 3 SKIPPED: $R min left"; fi
say "window end"
