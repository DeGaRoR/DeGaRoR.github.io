#!/usr/bin/env bash
# G2592 IMPOSTOR-LOOK test, A0's untimed GPU window 2026-10-09 02:57-03:45 (gpu as IMPMATCH, hard drop 03:45).
# Variants (one boot each, the test branch claude/imp-toplit-test): A today | D fine AO at ao^4 | S supersampled bake |
# DSc D + S + coverage-preserving mips | B ao^4 - in that order (A0's), a gamer + potato pair each, golden then noon.
cd "$(dirname "$0")"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
B=D:/Dev/DeGaRoR.github.io/.claude/worktrees/upbeat-williams-52587e
END=$(date -d "2026-10-09 03:45" +%s)
left() { echo $(( END - $(date +%s) )); }
# 02:45: on master after train 42 if it landed (a conflict aborts the merge: the test runs on its own base, said in the log)
until [ "$(date +%Y%m%d%H%M)" -ge 202610090245 ]; do sleep 20; done
cd $B && git fetch -q origin && echo "origin/master $(git rev-parse --short origin/master): $(git log -1 --format=%s origin/master | cut -c1-80)"
if git merge-base --is-ancestor origin/master HEAD; then echo "master already in"; else
  if git merge -q --no-edit origin/master -m "Merge origin/master into claude/imp-toplit-test (the test on the night's master)"; then echo "merged master: $(git rev-parse --short HEAD)";
  else git merge --abort; echo "MERGE CONFLICT - aborted; the test runs on $(git rev-parse --short HEAD)"; fi; fi
for f in flyDiy/src/viewer/render_world.js flyDiy/src/viewer/trees.js; do node --check $f || { echo "SYNTAX $f - stop"; exit 5; }; done
cd "$(dirname "$0")"
until [ "$(date +%Y%m%d%H%M)" -ge 202610090257 ]; do sleep 10; done
while S=$(bash $L show | grep -E "GPU_BENCH|RESERVED"); [ -n "$S" ]; do
  if [ "$(date +%Y%m%d%H%M)" -ge 202610090310 ]; then echo "BOX BUSY, gave up at 03:10: $S"; exit 3; fi; sleep 15; done
bash $L take gpu IMPMATCH "untimed: impostor look test A/D/S/DSc/B (02:57-03:45, hard drop 03:45)" || exit 4
date
( cd $B && exec node flyDiy/tools/_serve.js 8471 . --fallback "D:/Dev/DeGaRoR.github.io" > /dev/null 2>&1 ) & SRV=$!
sleep 3
U="http://localhost:8471/flyDiy/dev.html?world=jolene"
K="cedar,larch,spruce,pine_georgeous"
export DW_KEYS=$K DW_DAY=golden DW_DAYS=golden,noon DW_SIDES=away,side
for V in "A|" "D|&impaoD=1&impao=4" "S|&impss=2" "DSc|&impaoD=1&impao=4&impss=2&impcov=1" "B|&impao=4"; do
  N=${V%%|*}; Q=${V#*|}
  t=$(( $(left) - 60 )); if [ $t -lt 420 ]; then echo "$(date +%H:%M) no time left for $N - stopped"; break; fi; [ $t -gt 600 ] && t=600
  DW_TAG=L_${N}_g timeout $t node drv.js "$U&gfx=gamer$Q" match5.js out10 > log10_${N}_g.txt 2>&1 & P1=$!
  sleep 20
  DW_TAG=L_${N}_p timeout $(( t - 20 )) node drv.js "$U&gfx=potato$Q" match5.js out10 > log10_${N}_p.txt 2>&1 & P2=$!
  wait $P1 $P2; echo "$(date +%H:%M:%S) $N done"
done
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*cdp_dw_*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
kill $SRV 2>/dev/null
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*_serve.js 8471*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
bash $L drop gpu IMPMATCH
date
