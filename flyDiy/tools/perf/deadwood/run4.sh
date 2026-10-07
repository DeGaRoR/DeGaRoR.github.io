#!/usr/bin/env bash
# DEADWOOD-BRIGHT 2026-10-07 09:45-10:00 untimed: the user's mix-dead screenshots (off vs ?mixdead=1, gamer)
cd "$(dirname "$0")"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
until [ "$(date +%Y%m%d%H%M)" -ge 202610070945 ]; do sleep 20; done
date; bash $L show
S=$(bash $L show | grep -E "GPU_BENCH|RESERVED")
if [ -n "$S" ]; then echo "BOX BUSY at the slot: $S"; exit 3; fi
bash $L take gpu DEADWOOD "untimed: mix-dead screenshots for the user (09:45-10:00)" || exit 4
B=C:/Users/denis/AppData/Local/Temp/claude/D--Dev-DeGaRoR-github-io--claude-worktrees-upbeat-williams-52587e/7cac7812-f729-4524-a80f-a6f828a982ef/scratchpad/mdtree   # the committed dd8d77a4: today's look, the switch as landed
( cd "$B" && node flyDiy/tools/_serve.js 8471 . --fallback "D:/Dev/DeGaRoR.github.io" > /dev/null 2>&1 ) & SRV=$!
sleep 3
U="http://localhost:8471/flyDiy/dev.html?world=jolene&gfx=gamer"
DW_TAG=off timeout 660 node drv.js "$U" mixd2.js out5 > log5_off.txt 2>&1 &
sleep 20
DW_TAG=on timeout 640 node drv.js "$U&mixdead=1" mixd2.js out5 > log5_on.txt 2>&1 &
wait %2 %3 2>/dev/null
date
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*cdp_dw_*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
bash $L drop gpu DEADWOOD
kill $SRV 2>/dev/null
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*_serve.js 8471*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
cat log5_off.txt log5_on.txt | grep -v "^page error: THREE"
ls out5/raw | wc -l
