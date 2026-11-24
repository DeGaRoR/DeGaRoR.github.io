#!/bin/bash
# window_mon1300.sh - MONDAY 23 Nov 2026, 13:00-14:30 (PERF-LEAD): GARAGE FIRST, ROUND 1, IN ONE COMMAND
#   bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-LEAD --gpu -- bash tools/perf/window_mon1300.sh [minutes, default 86]
# The user, 23 Nov: "I revise my target of world loading time to 1 minute, including the background loading (so ideally 1
# minute spent in the garage)". The prototype (?boot=garagefirst) ran once at 06:06 on a busy box; this is its first table.
# The lab build must stand first (tools/perf/lab_build.sh): master (L40J) + perf-worldbuild-next + perf-trace-7 +
# audio-robust-1 (+ Deform's crash-prelink if its ref is in) merged into the lab. Every run HEADED, 5120x1440, quiet box.
# The parts, in the order of what a decision waits for; each has its cap and is skipped if it does not fit:
#   A. garage first with Go after 150 s (rows/gf-1300-a.txt): everything on, today's order beside it, the prototype
#      alone, a returning player twice
#   B. Go pressed at once (rows/gf-1300-b.txt)
#   D. THE CRASH on the screen (rows 14, 15): ?holdframe=all (the old default) and ?holdframe=ground
#   E. AUDIO-ROBUST's two runs (row 11): old against new, and a garage-first load recorded
#   C. the journey's first 8 minutes with the flight switches + ?coverbudget=50, the screen recorded (rows 8, 9, 13, 15)
#   F. the budget's two ends and the warm draws left to Go (rows/gf-1300-c.txt), in what is left
W="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$W" || exit 9          # flyDiy/
OUT=${MON_OUT:-D:/Dev/flydiy-notes/evidence/perf-mon1300-2026-11-23}; mkdir -p "$OUT"; LOG="$OUT/window.log"
LAB=${MON_LAB:-D:/Dev/perf-lab-built}; B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
AUD=${MON_AUDIO:-D:/Dev/DeGaRoR.github.io/.claude/worktrees/vigorous-mclean-30f022/flyDiy}
TK="D:/Dev/flydiy-notes/cpu_tokens"; WHO=PERF-LEAD; MIN=${1:-86}
END=$(( $(date +%s) + MIN * 60 )); left() { echo $(( (END - $(date +%s)) / 60 )); }
say() { echo "[$(date +%H:%M)] $*" | tee -a "$LOG"; }
HOLD() { local hk; for hk in 1 2 3 4; do echo "$WHO $(date +%H:%M:%S) the Monday 13:00 window (timing: all tokens)" > "$TK/${WHO}_$hk.tok"; done; }
BR="--steps compile,frames,worldCompile --miss 1"
nice -n 19 node -e "require('./tools/_core_fresh.js').assertFresh(require('path').resolve('tools/flight_core.js'))" || { say "REFUSED: tools/flight_core.js is not this tree's (run tools/perf/lab_build.sh)"; exit 4; }
[ -f "$LAB/flyDiy/dev.html" ] || { say "REFUSED: no lab build at $LAB"; exit 2; }
for k in "boot=garagefirst" "FLYDIY_STILL" "holdframe=(0|ground)" "coverbudget"; do grep -qsE "$k" "$LAB/flyDiy/index.html" || { say "REFUSED: the lab build has no $k (rebuild first)"; exit 2; }; done
for k in compsteps loadingBehind; do grep -rqs "$k" "$LAB/flyDiy/index.html" "$LAB/flyDiy/src/viewer" || say "NOTE: the lab build has no $k (its branch is not merged): the rows that ask for it run without"; done
HOLD; ( while :; do sleep 300; HOLD; done ) & REF=$!
trap 'kill $REF 2>/dev/null; rm -f "$TK"/${WHO}_[0-9].tok; bash $B drop gpu $WHO' EXIT
bash $B take gpu $WHO "the Monday 13:00 window: garage first, round 1" || { echo "no gpu lock"; exit 3; }
say "window start, $MIN min, lab $(head -1 "$LAB/LAB-BUILD.txt" 2>/dev/null | cut -c1-110)"
rows() {   # rows <tag> <rows file> <after s> <cap min>
  LM_HELD=1 LM_AFTER=$3 LM_SECS=$(( $3 + 280 )) LM_EST=$(( $3 + 130 )) LM_BRIEF_ARGS="$BR" LM_BRIEF_LINES=14 bash tools/perf/load_matrix.sh "$2" "$OUT/$1" $4 2>&1 | cut -c1-2800 | tee -a "$LOG"
  grep -h "^[A-Z0-9_]* \[" "$OUT/$1/summary.txt" 2>/dev/null | grep -o '^[A-Z0-9_]*\|load [0-9.]* s\|"gf":{[^}]*}\|rollout: [^|]*' | paste -s -d' ' | sed 's/ \([A-Z][A-Z0-9_]* load\)/\n\1/g' | cut -c1-900 | tee -a "$LOG"
}
fly() {   # fly <tag> <scenario> <query> <cap min> <step for the picture reader, or ->
  local tag=$1 sc="$W/tools/flight_scripts/perf/$2.json" q=$3 cm=$4 stp=$5
  say "$tag: $2 ($q), the screen recorded, cap $cm min"
  ( timeout $(( cm * 60 )) nice -n 19 node tools/flight_script.js "$sc" --runner page --headed --live --size 5120x1271 --repo "$LAB" --q "$q" --screencast "$OUT/$tag/screen" --out "$OUT/$tag" --cap $(( cm * 60 - 40 )) ) > "$OUT/$tag.out" 2>&1
  grep "  FAIL\|WHY\|^PASS\|^FAIL\|page: \|screencast:" "$OUT/$tag.out" | cut -c1-2600 | tee -a "$LOG"
  local J; J=$(ls -t "$OUT/$tag"/*.flightlog.json 2>/dev/null | head -1)
  if [ -n "$J" ]; then nice -n 19 python tools/perf/user_log.py "$J" --md "$OUT/$tag/against-objectives.md" 2>&1 | grep -v "^    t+" | tail -48 | cut -c1-400 | tee -a "$LOG"
    for t in big_uploads.js freeze_ledger.js crash_window.js; do [ -f "tools/$t" ] && nice -n 19 node tools/$t "$J" > "$OUT/$tag/${t%.js}.txt" 2>&1; done
  else say "NO FLIGHT LOG for $tag"; fi
  if [ "$stp" = - ]; then nice -n 19 python tools/perf/screen_read.py "$OUT/$tag/screen" --md "$OUT/$tag/screen.md" 2>&1 | cut -c1-300 | tee -a "$LOG"
  else nice -n 19 python tools/perf/screen_read.py "$OUT/$tag/screen" --step "$stp" --md "$OUT/$tag/screen.md" 2>&1 | cut -c1-300 | tee -a "$LOG"; fi
}

# A. garage first, Go after 150 s
say "part A: garage first, Go 150 s after the garage shows (5 rows)"
rows gfA tools/perf/rows/gf-1300-a.txt 150 27
grep -q "^GF_[A-Z0-9_]* \[[a-z]*\]: load [0-9]" "$OUT/gfA/summary.txt" 2>/dev/null || say "NOTE: no garage-first row of part A loaded - parts B and F are skipped, the rest runs"
GFOK=$(grep -c "^GF_[A-Z0-9_]* \[[a-z]*\]: load [0-9]" "$OUT/gfA/summary.txt" 2>/dev/null)

# B. Go pressed at once
if [ "${GFOK:-0}" -gt 0 ] && [ $(left) -ge 8 ]; then say "part B: Go 5 s after the garage shows"; rows gfB tools/perf/rows/gf-1300-b.txt 5 8
else say "part B SKIPPED: $(left) min left, or no garage-first row loaded"; fi

# D. the crash on the screen: as the build is (Deform's prelink in it, if merged), then with the guard's floor
#    (both named in the address, so the rows read the same on a build before or after the default moved to 'ground', 23 Nov)
for cq in all ground; do
  if [ $(left) -ge 6 ]; then Q="recring=131072&recscene=1&holdframe=$cq"   # (recscene=1: the scene slot split - pose / contact / damage / camera / meshes / water - one frame in 31: PERF-TRACE 23 Nov, the 13 fps after a crash is JS in that slot)
    fly crash_$cq crash_cub_nosedown_magenta "$Q" 6 "nose down"
  else say "part D ($cq) SKIPPED: $(left) min left"; fi
done

# E. AUDIO-ROBUST's two runs (their rig, their worktree, read before it was run; it takes no lock or token of its own)
if [ $(left) -ge 12 ] && [ -f "$AUD/tools/audio/stall_rig.js" ]; then say "part E: AUDIO-ROBUST, old against new (cap 12 min)"
  ( cd "$AUD" && timeout 720 nice -n 19 node tools/audio/stall_rig.js --out D:/Dev/flydiy-notes/evidence/audio-robust-2026-11-23/stream --live --headed --cap 660 --passes before,after --menu --air 300 --stream 8 ) > "$OUT/audio_stream.out" 2>&1
  tail -8 "$OUT/audio_stream.out" | cut -c1-300 | tee -a "$LOG"
  if [ $(left) -ge 8 ] && [ "${GFOK:-0}" -gt 0 ] && grep -qs "loadingBehind" "$LAB/flyDiy/index.html"; then say "part E2: a garage-first load recorded (cap 7 min)"
    ( cd "$AUD" && timeout 420 nice -n 19 node tools/audio/stall_rig.js --out D:/Dev/flydiy-notes/evidence/audio-robust-2026-11-23/garagefirst --live --headed --cap 380 --repo "$LAB" --passes gf:boot=garagefirst --menu --behind --air 300 --stream 8 ) > "$OUT/audio_gf.out" 2>&1
    tail -6 "$OUT/audio_gf.out" | cut -c1-300 | tee -a "$LOG"
  else say "part E2 SKIPPED: $(left) min left, or the build has no loadingBehind, or garage first did not load"; fi
else say "part E SKIPPED: $(left) min left or no rig at $AUD"; fi

# C. the journey with the flight switches and the cover's work halved
if [ $(left) -ge 13 ]; then fly journey_cover journey_first8_picture "recring=131072&farslots=1&mirpace=1&mirlean=1&coverbudget=50" 12 -
else say "part C SKIPPED: $(left) min left"; fi

# F. the budget's two ends, the warm draws left to Go
R=$(( $(left) - 1 ))
if [ "${GFOK:-0}" -gt 0 ] && [ $R -ge 6 ]; then say "part F: the budget's two ends and the warm draws left to Go, cap $R min"; rows gfC tools/perf/rows/gf-1300-c.txt 150 $R
else say "part F SKIPPED: $R min left, or no garage-first row loaded"; fi
say "window end"
