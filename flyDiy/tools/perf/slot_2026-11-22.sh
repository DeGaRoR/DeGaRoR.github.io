#!/bin/bash
# slot_2026-11-22.sh - THE BIG PERF SLOT, Sun 22 Nov 2026 14:00-17:00, IN ONE COMMAND (PERF-LEAD)
#
# The whole window under one hold: the GPU lock and every CPU token of the box are taken once and kept (refreshed every
# 5 min) until the last part ends, so no other session starts a run between two parts. The parts, in the order of what
# must not be lost if the window runs short:
#   1. PASS 1 of the load matrix: every question once                       (tools/perf/rows/slot-2026-11-22-pass1.txt)
#   2. THE JOURNEY with the registry on, then its freeze ledger             (PERF-TRACE: objectives 8 and 9)
#   2b. the alpine rock scatter's orbit, on then off                        (MOUNTAIN-VEG)
#   3. AUDIO-ROBUST's recordings (a cold load from the menu click, the stall blocks in flight)
#   4. PASS 2 of the load matrix: the questions again, the other order, in the time that is left
# Usage (from flyDiy/, at 14:00, once A0 has dropped the lock):
#   bash tools/perf/slot_2026-11-22.sh [out dir] [minutes, default 175]
#   SLOT_DRY=<a boot_perf log>: the matrix parts run dry, the journey and audio parts are only printed
OUT=${1:-D:/Dev/flydiy-notes/evidence/perf-slot-2026-11-22}; MIN=${2:-175}
LAB=${SLOT_LAB:-D:/Dev/perf-lab-built}
T="$(cd "$(dirname "$0")/.." && pwd)"; B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
TK="D:/Dev/flydiy-notes/cpu_tokens"; NTOK=${CPU_TOKENS:-4}; WHO=PERF-LEAD
START=$(date +%s); END=$(( START + MIN * 60 )); left() { echo $(( (END - $(date +%s)) / 60 )); }
mkdir -p "$OUT"; LOG="$OUT/slot.log"; say() { echo "[$(date +%H:%M)] $*" | tee -a "$LOG"; }
HOLD() { for i in $(seq 1 $NTOK); do echo "$WHO $(date +%H:%M:%S) the 14:00 perf slot (timing: all tokens)" > "$TK/${WHO}_$i.tok"; done; }
REF=
if [ -z "$SLOT_DRY" ]; then
  [ -f "$LAB/flyDiy/dev.html" ] || { echo "slot: no lab build at $LAB"; exit 2; }
  mkdir -p "$TK"; HOLD; ( while :; do sleep 300; HOLD; done ) & REF=$!
  trap 'kill $REF 2>/dev/null; rm -f "$TK"/${WHO}_[0-9].tok; bash $B drop gpu $WHO' EXIT
  bash $B take gpu $WHO "the 14:00 perf slot" || { echo "no gpu lock"; exit 3; }
fi
say "slot start, $MIN min, lab $LAB ($(cat "$LAB/flyDiy/version.json" 2>/dev/null))"

# 1. pass 1 (its own cap: what the journey, audio and a useful pass 2 leave it)
P1=${SLOT_P1_MIN:-95}
say "part 1: pass 1, cap $P1 min"
LM_HELD=1 LM_DRY=$SLOT_DRY LM_BRIEF_ARGS="${LM_BRIEF_ARGS:---steps compile,frames,worldCompile --miss 1}" LM_BRIEF_LINES=${LM_BRIEF_LINES:-40} bash "$T/perf/load_matrix.sh" "$T/perf/rows/slot-2026-11-22-pass1.txt" "$OUT/pass1" $P1 2>&1 | tee -a "$LOG"

# 2. the journey + the freeze ledger, run from the LAB build's own tools (page_rig serves the tree it runs in).
#    PERF-TRACE's command (22 Nov); headed at the user's canvas is asked through page_rig's options in the script's env
JOURNEY_MIN=${SLOT_JOURNEY_MIN:-42}
if [ $(left) -ge $(( JOURNEY_MIN + 5 )) ]; then
  say "part 2: the journey, cap $JOURNEY_MIN min"
  if [ -z "$SLOT_DRY" ]; then
    ( cd "$LAB/flyDiy" && timeout $(( JOURNEY_MIN * 60 )) nice -n 19 node tools/flight_script.js tools/flight_scripts/perf/main_journey.json --runner page --headed --live --size 5120x1271 --q "recring=131072" --out "$OUT/journey" --cap 2400 ) 2>&1 | tail -40 | tee -a "$LOG"
    J=$(ls -t "$OUT"/journey/*.flightlog.json 2>/dev/null | head -1)
    [ -n "$J" ] && ( cd "$LAB/flyDiy" && nice -n 19 node tools/freeze_ledger.js "$J" --md "$OUT/journey/freezes.md" --show 60 ) 2>&1 | tail -20 | tee -a "$LOG"
  fi
else say "part 2 SKIPPED: $(left) min left"; fi

# 2b. MOUNTAIN-VEG's alpine rock scatter IN FLIGHT: the same two-minute orbit off the altiport, the scatter on (the
#     build's default) then off (?alprocks=0). A load at the stand never goes above the tree line; this does.
ORBIT_MIN=${SLOT_ORBIT_MIN:-9}
for oq in on off; do
  if [ $(left) -ge $(( ORBIT_MIN + 5 )) ]; then
    say "part 2b: the alpine orbit, rocks $oq, cap $ORBIT_MIN min"
    if [ -z "$SLOT_DRY" ]; then
      OQ=; [ $oq = off ] && OQ="alprocks=0"
      ( cd "$LAB/flyDiy" && timeout $(( ORBIT_MIN * 60 )) nice -n 19 node tools/flight_script.js tools/flight_scripts/perf/alp_rocks_orbit.json --runner page --headed --live --size 5120x1271 ${OQ:+--q "$OQ"} --out "$OUT/orbit_rocks_$oq" --cap $(( ORBIT_MIN * 60 - 30 )) ) 2>&1 | tail -15 | tee -a "$LOG"
      J=$(ls -t "$OUT"/orbit_rocks_$oq/*.flightlog.json 2>/dev/null | head -1)
      [ -n "$J" ] && ( cd "$LAB/flyDiy" && nice -n 19 node tools/freeze_ledger.js "$J" --md "$OUT/orbit_rocks_$oq/freezes.md" --show 20 ) 2>&1 | tail -12 | tee -a "$LOG"
    fi
  else say "part 2b ($oq) SKIPPED: $(left) min left"; fi
done

# 3. AUDIO-ROBUST's recordings: its exact command goes in SLOT_AUDIO_CMD (run from the lab build's flyDiy/)
AUDIO_MIN=${SLOT_AUDIO_MIN:-15}
if [ -n "$SLOT_AUDIO_CMD" ] && [ $(left) -ge $(( AUDIO_MIN + 5 )) ]; then
  say "part 3: audio, cap $AUDIO_MIN min: $SLOT_AUDIO_CMD"
  [ -z "$SLOT_DRY" ] && ( cd "$LAB/flyDiy" && timeout $(( AUDIO_MIN * 60 )) bash -c "$SLOT_AUDIO_CMD" ) 2>&1 | tail -20 | tee -a "$LOG"
else say "part 3 not run (no SLOT_AUDIO_CMD, or $(left) min left)"; fi

# 4. pass 2, in what is left (it skips the rows that do not fit, in file order)
R=$(( $(left) - 2 ))
if [ $R -ge 6 ]; then say "part 4: pass 2, cap $R min"
  LM_HELD=1 LM_DRY=$SLOT_DRY LM_BRIEF_ARGS="${LM_BRIEF_ARGS:---steps compile,frames,worldCompile --miss 1}" LM_BRIEF_LINES=${LM_BRIEF_LINES:-40} bash "$T/perf/load_matrix.sh" "$T/perf/rows/slot-2026-11-22-pass2.txt" "$OUT/pass2" $R 2>&1 | tee -a "$LOG"
else say "part 4 SKIPPED: $R min left"; fi
say "slot end"
