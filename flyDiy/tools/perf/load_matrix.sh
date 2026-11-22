#!/bin/bash
# load_matrix.sh - A LIST OF TIMED LOADS, RUN BACK TO BACK IN ONE BOX SLOT (PERF-LEAD, 22 Nov 2026)
#
# The user, 22 Nov: "we have to be very efficient with using these slots and having prepared as much as we can". A slot
# is spent well when every load in it was decided before it began. This runs a ROWS FILE top to bottom: each row is one
# load through tools/boot_perf.js (a visible Chrome at the user's 5120x1440 unless the row says otherwise), in a NEW
# Chrome process that closes itself, with the CPU package under 80 C at its start, and one summary line per row.
#
# ROWS FILE: one row a line, fields split by ';' (blank lines and # comments skipped):
#     TAG ; BUILT DIR ; QUERY ; PROFILE ; MODE ; EXTRA
#   TAG      one word, the row's name (its log is <out>/<TAG>.log)
#   BUILT DIR  a BUILT flyDiy parent dir (served read-only), e.g. D:/Dev/perfcodex-built
#   QUERY    the page's query without '?', or '-' (e.g. mode=sandbox&pace=16)
#   PROFILE  'new' = a fresh Chrome profile (a COLD load), or a name: the profile <out>/profile_<name> is kept, so the
#            first row that names it is cold and the next ones are a returning player's (WARM)
#   MODE     H5K = headed, window 5120,1440 (default) | HL = headless 1920,1080 (the old ledger's way) | HxW,H = headed W,H
#   EXTRA    more boot_perf arguments, or '-' (e.g. --chrome --gpu-program-cache-size-kb=1048576)
#            --rollout presses Go after the load and times the departure (the roll-out screen, flying, the programs
#            before -> after); --pre-rollout-file <js> runs one expression in the garage first (the clock set to noon)
#
# Usage:  bash tools/perf/load_matrix.sh <rows file> <out dir> [minutes: the hard cap, default 55]
#   LM_DRY=<a boot_perf log>  a dry run: no lock, no tokens, no Chrome; every row "runs" by copying that log, so the rows
#                             file, the order and the summary's parsing are proved BEFORE the slot
#   LM_SECS=300               the cap on one load (boot_perf --secs); LM_AFTER=20: each load ends 20 s after its loading
#                             screen is gone (boot_perf --after), so a row costs its load + ~35 s, not a fixed watch
#   LM_EVAL=<js file>         one expression read in the page at the end of each load, printed in the row (boot_perf
#                             --eval-file); default tools/perf/load_matrix_eval.js
#   LM_DUMP=<js file>         a LARGE page result saved per row as <out>/<TAG>.flightlog.json (boot_perf --dump-file);
#                             default tools/perf/load_matrix_dump.js = the flight recorder's log, on which PERF-TRACE's
#                             tools/load_brief.js is run: its ten lines per row collect in <out>/briefs.txt
#   LM_HELD=1                 the caller already holds the GPU lock and the CPU tokens for a longer window (a slot
#                             script running several parts): this run takes and frees neither, it only refreshes
#                             the token files before each load
#   LM_EST=170                the seconds one row is expected to take (the planning figure for the cap)
# Takes the GPU lock and ALL the box's CPU tokens for its window (a TIMING run: nothing else may start beside it), frees
# both on exit, kills only its own servers, never starts a row that could not end inside the cap. A MEASUREMENT, not a gate.
ROWS=$1; OUT=$2; MIN=${3:-55}
[ -f "$ROWS" ] && [ -n "$OUT" ] || { echo "usage: load_matrix.sh <rows file> <out dir> [minutes]"; exit 2; }
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
T="$(cd "$(dirname "$0")/.." && pwd)"
TK="D:/Dev/flydiy-notes/cpu_tokens"; NTOK=${CPU_TOKENS:-4}; WHO=${LM_WHO:-PERF-LEAD}
SECS=${LM_SECS:-300}; AFTER=${LM_AFTER:-20}; PER=${LM_EST:-170}; END=$(( $(date +%s) + MIN * 60 )); PORT0=${LM_PORT:-8793}
mkdir -p "$OUT"; SUM="$OUT/summary.txt"
EVALF=${LM_EVAL:-$T/perf/load_matrix_eval.js}; [ -f "$EVALF" ] || EVALF=
DUMPF=${LM_DUMP:-$T/perf/load_matrix_dump.js}; [ -f "$DUMPF" ] || DUMPF=
trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; printf '%s' "$s"; }
TEMP() { curl -s -m 5 localhost:8085/data.json | grep -o '"Text":"CPU Package","Min":"[^"]*","Value":"[0-9]*' | tail -1 | grep -o '[0-9]*$'; }
COOL() {    # a load starts under 80 C; no reading for 2 min, or 15 min too hot = stop, never run blind
  local t n=0; while :; do t=$(TEMP); [ -n "$t" ] && [ "$t" -lt 80 ] && { echo $t; return 0; }
    n=$((n + 1)); [ -z "$t" ] && [ $n -ge 6 ] && return 1; [ $n -ge 45 ] && return 1; sleep 20; done; }
HOLD() { for i in $(seq 1 $NTOK); do echo "$WHO $(date +%H:%M:%S) load_matrix (timing: all tokens)" > "$TK/${WHO}_$i.tok"; done; }
OTHERS() { local n=0 f a pid; for f in "$TK"/*.tok; do [ -e "$f" ] || continue; case "$f" in */${WHO}_[0-9].tok) continue ;; esac
  pid=$(grep -o 'pid=[0-9]*' "$f" 2>/dev/null | head -1 | cut -d= -f2)
  if [ -n "$pid" ]; then [ -e "/proc/$pid" ] && n=$((n + 1)); continue; fi
  a=$(( ($(date +%s) - $(stat -c %Y "$f")) / 60 )); [ $a -le 45 ] && n=$((n + 1)); done; echo $n; }
sizes() { for d in GPUCache GrShaderCache GraphiteDawnCache ShaderCache Default/GPUCache Default/DawnGraphiteCache Default/DawnWebGPUCache; do
    [ -d "$1/$d" ] && printf '%s %s KiB; ' "$d" "$(du -sk "$1/$d" | cut -f1)"; done; }
st() { grep -o "step:$2@[0-9]* ([0-9]*" "$1" | head -1 | sed 's/.*(//' | awk '{printf "%.1f", $1/1000}'; }
mine() { local W=$(cygpath -w "$1" | sed 's/\\/\\\\/g')    # a Chrome of this script a timeout left: found by ITS profile, killed by PID tree
  for p in $(powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*--user-data-dir=$W *' } | ForEach-Object { \$_.ProcessId }" 2>/dev/null | tr -d '\r'); do
    echo "  leftover chrome $p: killed"; taskkill //PID $p //T //F > /dev/null 2>&1; done; }

# the rows, read and checked BEFORE anything is locked
N=0; declare -a R_TAG R_DIR R_Q R_PROF R_MODE R_EXTRA
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"; case "$(trim "$line")" in ''|'#'*) continue ;; esac
  IFS=';' read -r a b c d e f <<< "$line"
  a=$(trim "$a"); b=$(trim "$b"); c=$(trim "$c"); d=$(trim "$d"); e=$(trim "$e"); f=$(trim "$f")
  [ -n "$a" ] && [ -n "$b" ] || { echo "load_matrix: a row needs a TAG and a BUILT DIR: $line"; exit 2; }
  [ -n "$LM_DRY" ] || [ -f "$b/flyDiy/dev.html" ] || { echo "load_matrix: no built page at $b/flyDiy/dev.html (row $a)"; exit 2; }
  case " ${R_TAG[*]} " in *" $a "*) echo "load_matrix: the tag $a is used twice"; exit 2 ;; esac
  R_TAG[$N]=$a; R_DIR[$N]=$b; R_Q[$N]=${c:--}; R_PROF[$N]=${d:-new}; R_MODE[$N]=${e:-H5K}; R_EXTRA[$N]=${f:--}; N=$((N + 1))
done < "$ROWS"
[ $N -gt 0 ] || { echo "load_matrix: no rows in $ROWS"; exit 2; }
echo "load_matrix $(date '+%a %d %b %H:%M'): $N rows, about $(( N * PER / 60 )) min of loads, cap $MIN min${LM_DRY:+, DRY RUN}" | tee "$SUM"
[ $(( N * PER )) -le $(( MIN * 60 )) ] || echo "NOTE: the rows do not all fit the cap: the last ones will be skipped, in file order" | tee -a "$SUM"

SRV=; SRVDIR=
serve() {   # one static server at a time, restarted when the row's built dir changes
  [ "$1" = "$SRVDIR" ] && return 0
  [ -n "$SRV" ] && kill $SRV 2>/dev/null; SRV=
  nice -n 19 node "$T/_serve.js" $PORT0 "$1" > "$OUT/srv.log" 2>&1 & SRV=$!; SRVDIR=$1; sleep 3; }
if [ -z "$LM_DRY" ] && [ -n "$LM_HELD" ]; then
  trap '[ -n "$SRV" ] && kill $SRV 2>/dev/null' EXIT
elif [ -z "$LM_DRY" ]; then
  mkdir -p "$TK"; HOLD                                   # the tokens first, then the lock (THERMAL-RULE, 22 Nov)
  trap '[ -n "$SRV" ] && kill $SRV 2>/dev/null; rm -f "$TK"/${WHO}_[0-9].tok; bash $B drop gpu $WHO' EXIT
  bash $B take gpu $WHO "load matrix, $N rows" || { echo "no gpu lock"; exit 3; }
  for w in $(seq 1 30); do [ "$(OTHERS)" = 0 ] && break; echo "  $(OTHERS) other CPU run(s) still going: waiting"; sleep 20; done
  [ "$(OTHERS)" = 0 ] || echo "NOTE: $(OTHERS) other CPU run(s) beside these loads: the timings are not from a quiet box" | tee -a "$SUM"
fi

for i in $(seq 0 $((N - 1))); do
  TAG=${R_TAG[$i]}; DIR=${R_DIR[$i]}; Q=${R_Q[$i]}; PROF=${R_PROF[$i]}; MODE=${R_MODE[$i]}; EXTRA=${R_EXTRA[$i]}
  L="$OUT/$TAG.log"
  [ $(( $(date +%s) + PER )) -le $END ] || { echo "$TAG: NOT RUN - it could not end inside the cap" | tee -a "$SUM"; continue; }
  if [ "$PROF" = new ]; then UDD="$OUT/profile_new_$TAG"; rm -rf "$UDD"; KIND=cold
  else UDD="$OUT/profile_$PROF"; if [ -d "$UDD" ]; then KIND=warm; else KIND=cold; fi; fi
  case "$MODE" in H5K) M="--headed --size 5120,1440" ;; HL) M="--size 1920,1080" ;; H*) M="--headed --size ${MODE#H}" ;; *) echo "$TAG: NOT RUN - unknown MODE $MODE" | tee -a "$SUM"; continue ;; esac
  URL="http://localhost:$PORT0/flyDiy/dev.html"; [ "$Q" = - ] || URL="$URL?$Q"
  X=; [ "$EXTRA" = - ] || X=$EXTRA
  if [ -n "$LM_DRY" ]; then t=dry; cp "$LM_DRY" "$L"; mkdir -p "$UDD"
  else
    t=$(COOL) || { echo "$TAG: NOT RUN - the package stayed at 80 C or more for 15 min, or the sensor feed is gone: STOP" | tee -a "$SUM"; exit 4; }
    serve "$DIR"; HOLD
    timeout $(( SECS + 90 )) node "$T/boot_perf.js" --url "$URL" --udd "$UDD" --secs $SECS --after $AFTER --tag $TAG --out "$OUT/$TAG.json" ${EVALF:+--eval-file "$EVALF"} ${DUMPF:+--dump-file "$DUMPF" "$OUT/$TAG.flightlog.json"} $M $X > "$L" 2>&1 || mine "$UDD"
  fi
  # PERF-TRACE's ten lines on the row's flight log (the step's kind, the programs that held it, first uses, long tasks)
  if [ -z "$LM_DRY" ] && [ -s "$OUT/$TAG.flightlog.json" ] && [ -f "$T/load_brief.js" ]; then
    { echo "=== $TAG  q=$Q${X:+  $X}"; nice -n 19 node "$T/load_brief.js" "$OUT/$TAG.flightlog.json" --label "$TAG" 2>&1 | head -14; } >> "$OUT/briefs.txt"; fi
  g=$(grep -o 'overlay gone [0-9]*' "$L" | awk '{printf "%.1f", $3/1000}')
  echo "$TAG [$KIND]: load ${g:-FAILED} s | world $(st "$L" world) | settle $(st "$L" settle) | worldCompile $(st "$L" worldCompile) | compile $(st "$L" compile) | programs $(grep -o 'programs [0-9]*' "$L" | head -1 | cut -d' ' -f2) | $(grep -o 'network [0-9.]* MB' "$L" | head -1) | $(grep -o '\(HEADED\|headless\) window.*' "$L" | head -1) | $(grep -o 'chrome .*' "$L" | tail -1) | package ${t} C -> $(TEMP) C | q=$Q${X:+ | $X} | $(grep -o '^  eval .*' "$L" | head -1 | cut -c3-) | $(grep -o '^  rollout: .*' "$L" | head -1 | cut -c3-) | $(sizes "$UDD")" | tee -a "$SUM"
done
echo "done $(date '+%H:%M')" | tee -a "$SUM"
