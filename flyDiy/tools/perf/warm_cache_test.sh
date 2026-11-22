#!/bin/bash
# warm_cache_test.sh - WHY IS A WARM LOAD NOT FASTER THAN A COLD ONE? (PERF-LEAD, 22 Nov 2026; mission 1, test b)
#
# One build, one Chrome profile per series, three loads each, every load in a NEW Chrome process that closes itself
# (boot_perf --udd): load 1 fills the profile's GPU shader cache, loads 2 and 3 are a returning player's.
#   series P: Chrome as shipped (its GPU program cache is 6 MiB by default, gpu/config/gpu_preferences.h)
#   series Q: the same with a 1 GiB program cache (--gpu-program-cache-size-kb, --gpu-disk-cache-size-kb)
# If P's loads 2-3 compile as long as load 1 and Q's do not, the cache is too small for ~450 large programs, and no
# shader source is at fault. If neither gets faster, the sources change between boots (test a, src_diff) or the
# cache is not written at all. After each load: the size of every cache folder of the profile.
# THE BROWSER (the user, 22 Nov: "the only reliable timing comes from an actual in-browser test", some at the big
# screen's 5120x1440): series P and Q run HEADED, a visible Chrome window of WCT_SIZE (default 5120,1440), nothing
# emulated; each row prints the canvas really drawn and whether the page was visible and focused. Series H is the
# old way for comparison: one cold + one warm load HEADLESS at 1920,1080, run last and only if the window has time.
#
# Usage:  bash tools/perf/warm_cache_test.sh <BUILT flyDiy parent dir> <out dir> [port] [series: PQH | P | Q | H ...]
# Takes and drops the GPU lock itself (PERF-LEAD); kills only its own server; hard cap: WCT_MIN minutes (default 55):
# a load that could not end inside it is not started.
# A MEASUREMENT, not a gate. Needs a QUIET box (a timing run): ask A0 for the slot.
DIR=$1; OUT=$2; PORT=${3:-8793}; SERIES=${4:-PQH}
END=$(( $(date +%s) + ${WCT_MIN:-55} * 60 )); SIZE=${WCT_SIZE:-5120,1440}
[ -n "$DIR" ] && [ -n "$OUT" ] || { echo "usage: warm_cache_test.sh <built dir> <out dir> [port] [PQH|P|Q|H]"; exit 2; }
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
T="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$OUT"
TEMP() { curl -s -m 5 localhost:8085/data.json | grep -o '"Text":"CPU Package","Min":"[^"]*","Value":"[0-9]*' | tail -1 | grep -o '[0-9]*$'; }
COOL() {    # start a load only under 80 C (A0's thermal rule, 22 Nov); no reading for 2 min = stop, never run blind
  local t n=0; while :; do t=$(TEMP); [ -n "$t" ] && [ "$t" -lt 80 ] && { echo $t; return 0; }
    n=$((n + 1)); [ -z "$t" ] && [ $n -ge 6 ] && return 1; [ $n -ge 45 ] && return 1; sleep 20; done; }
# THE BOX'S CPU TOKENS (A0, 22 Nov: at most 3 CPU runs on the box, D:/Dev/flydiy-notes/cpu_token.sh). A TIMING run
# holds ALL of them for its whole window, so no other session starts a run beside it: NTOK token files under this name,
# touched before every load (a token older than 45 min is ignored), removed on exit. It first waits (10 min at
# most) for the runs other sessions already have going.
TK="D:/Dev/flydiy-notes/cpu_tokens"; mkdir -p "$TK"
NTOK=${CPU_TOKENS:-4}
HOLD() { for i in $(seq 1 $NTOK); do echo "PERF-LEAD $(date +%H:%M:%S) warm_cache_test (timing: all tokens)" > "$TK/PERF-LEAD_$i.tok"; done; }
OTHERS() { local n=0 f a; for f in "$TK"/*.tok; do [ -e "$f" ] || continue; case "$f" in */PERF-LEAD_[0-9].tok) continue ;; esac
  local pid=$(grep -o 'pid=[0-9]*' "$f" 2>/dev/null | head -1 | cut -d= -f2)   # cpu_token.sh v2: a token lives as long as its run's pid
  if [ -n "$pid" ]; then [ -e "/proc/$pid" ] && n=$((n + 1)); continue; fi
  a=$(( ($(date +%s) - $(stat -c %Y "$f")) / 60 )); [ $a -le 45 ] && n=$((n + 1)); done; echo $n; }
bash $B take gpu PERF-LEAD "warm-cache test, 6-8 loads, headed $SIZE" || { echo "no gpu lock"; exit 3; }
SRV=
trap '[ -n "$SRV" ] && kill $SRV 2>/dev/null; rm -f "$TK"/PERF-LEAD_[0-9].tok; bash $B drop gpu PERF-LEAD' EXIT
HOLD
for w in $(seq 1 30); do [ "$(OTHERS)" = 0 ] && break; echo "  $(OTHERS) other CPU run(s) still going: waiting"; sleep 20; done
[ "$(OTHERS)" = 0 ] || echo "NOTE: $(OTHERS) other CPU run(s) beside these loads: the timings are not from a quiet box" | tee -a "$OUT/summary.txt"
nice -n 19 node "$T/_serve.js" $PORT "$DIR" > "$OUT/srv.log" 2>&1 & SRV=$!
sleep 3
SHA=$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null)
echo "warm_cache_test $SHA $(date '+%a %d %b %H:%M')" | tee "$OUT/summary.txt"
sizes() {   # every cache folder of the profile, in KiB
  for d in GPUCache GrShaderCache GraphiteDawnCache ShaderCache Default/GPUCache Default/DawnGraphiteCache Default/DawnWebGPUCache "Default/Code Cache" Default/Cache; do
    [ -d "$1/$d" ] && printf '%s %s KiB; ' "$d" "$(du -sk "$1/$d" | cut -f1)"; done; }
st() { grep -o "step:$2@[0-9]* ([0-9]*" "$1" | head -1 | sed 's/.*(//' | awk '{printf "%.1f", $1/1000}'; }   # log, step id -> s
mine() {    # a Chrome this script started and a timeout left behind: found by ITS profile folder, killed by PID tree
  local W=$(cygpath -w "$1" | sed 's/\\/\\\\/g')
  for p in $(powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*--user-data-dir=$W *' } | ForEach-Object { \$_.ProcessId }" 2>/dev/null | tr -d '\r'); do
    echo "  leftover chrome $p: killed"; taskkill //PID $p //T //F > /dev/null 2>&1; done; }
run() {     # series, n, profile, extra flags...
  local S=$1 N=$2 UDD=$3; shift 3
  [ $(( $(date +%s) + 200 )) -le $END ] || { echo "$S$N: NOT RUN - it could not end inside the window" | tee -a "$OUT/summary.txt"; return 0; }
  local t; t=$(COOL) || { echo "$S$N: NOT RUN - the package stayed at 80 C or more for 15 min, or the sensor feed is gone" | tee -a "$OUT/summary.txt"; exit 4; }
  local L="$OUT/${S}${N}.log"
  HOLD
  timeout 390 node "$T/boot_perf.js" --url http://localhost:$PORT/flyDiy/dev.html --udd "$UDD" --secs 300 --after 20 --tag ${S}${N} --out "$OUT/${S}${N}.json" "$@" > "$L" 2>&1 || mine "$UDD"
  local g=$(grep -o 'overlay gone [0-9]*' "$L" | awk '{printf "%.1f", $3/1000}')
  echo "$S$N: load ${g:-FAILED} s | world $(st "$L" world) | settle $(st "$L" settle) | worldCompile $(st "$L" worldCompile) | compile $(st "$L" compile) | programs $(grep -o 'programs [0-9]*' "$L" | head -1 | cut -d' ' -f2) | $(grep -o 'network [0-9.]* MB' "$L" | head -1) | $(grep -o 'chrome .*' "$L" | tail -1) | $(grep -o '\(HEADED\|headless\) window.*' "$L" | head -1) | package ${t} C at the start, $(TEMP) C at the end | $(sizes "$UDD")" | tee -a "$OUT/summary.txt"
}
BIG="--chrome --gpu-program-cache-size-kb=1048576 --chrome --gpu-disk-cache-size-kb=1048576"
case "$SERIES" in *P*) P="$OUT/profile_P"; rm -rf "$P"; for n in 1 2 3; do run P $n "$P" --headed --size $SIZE; done ;; esac
case "$SERIES" in *Q*) Q="$OUT/profile_Q"; rm -rf "$Q"; for n in 1 2 3; do run Q $n "$Q" --headed --size $SIZE $BIG; done ;; esac
case "$SERIES" in *H*) H="$OUT/profile_H"; rm -rf "$H"; for n in 1 2; do run H $n "$H" --size 1920,1080; done ;; esac
echo "done $(date '+%H:%M')" | tee -a "$OUT/summary.txt"
