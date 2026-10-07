#!/usr/bin/env bash
# G2590 IMPOSTOR-MATCH, A0's untimed GPU window 2026-10-08 13:40-14:35 (lock IMPMATCH, hard drop 14:35).
# PHASE=12: golden then noon, gamer + potato (the measurement); PHASE=3: the verification on the code's defaults.
cd "$(dirname "$0")"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
B=D:/Dev/DeGaRoR.github.io/.claude/worktrees/upbeat-williams-52587e
HARD=202610081435
now() { date +%Y%m%d%H%M; }
left() { echo $(( $(date -d "2026-10-08 14:35" +%s) - $(date +%s) )); }
while S=$(bash $L show | grep -E "GPU_BENCH|RESERVED"); [ -n "$S" ]; do
  if [ "$(now)" -ge 202610081400 ]; then echo "BOX BUSY, gave up at 14:00: $S"; exit 3; fi; sleep 15; done
bash $L take gpu IMPMATCH "untimed: impostor trunk + level stills (13:40-14:35, hard drop 14:35)" || exit 4
date
( cd $B && exec node flyDiy/tools/_serve.js 8471 . --fallback "D:/Dev/DeGaRoR.github.io" > /dev/null 2>&1 ) & SRV=$!
sleep 3
U="http://localhost:8471/flyDiy/dev.html?world=jolene"
K="cedar,larch,spruce,pine_georgeous,dead_conifer"
pair() {   # $1 tag suffix, $2 day, $3 timeout (s)
  local t=$3; [ $t -gt $(( $(left) - 60 )) ] && t=$(( $(left) - 60 )); [ $t -lt 60 ] && { echo "no time left for $1"; return; }
  DW_TAG=I_g_$1 DW_DAY=$2 DW_KEYS=$K timeout $t node drv.js "$U&gfx=gamer" match4.js out8 > log8_g_$1.txt 2>&1 & local P1=$!
  sleep 20
  DW_TAG=I_p_$1 DW_DAY=$2 DW_KEYS=$K timeout $t node drv.js "$U&gfx=potato" match4.js out8 > log8_p_$1.txt 2>&1 & local P2=$!
  wait $P1 $P2; date
}
if [ "${PHASE:-12}" = "12" ]; then pair golden golden 480; pair noon noon 420
else pair v3 golden 420; fi
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*cdp_dw_*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
kill $SRV 2>/dev/null
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*_serve.js 8471*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
bash $L drop gpu IMPMATCH
date
