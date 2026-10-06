#!/usr/bin/env bash
# DEADWOOD-BRIGHT: the shadow-keyed default (uILit 0.9 + shade x1.38 where trees cast shadows) - hand-over + stills
cd "$(dirname "$0")"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
S=$(bash $L show | grep -E "GPU_BENCH|RESERVED")
if [ -n "$S" ]; then echo "BOX BUSY: $S"; exit 3; fi
bash $L take gpu DEADWOOD "untimed: shadow-keyed tree level, hand-over + stills" || exit 4
date
B=D:/Dev/DeGaRoR.github.io/.claude/worktrees/upbeat-williams-52587e
( cd $B && node flyDiy/tools/_serve.js 8471 . --fallback "D:/Dev/DeGaRoR.github.io" > /dev/null 2>&1 ) &
sleep 3
U="http://localhost:8471/flyDiy/dev.html?world=jolene"
K="larch,pine_georgeous,spruce,cedar,dead_conifer"
OLD='"barkWrap":1,"barkSSS":1,"barkFlat":1.3,"barkSolid":1,"barkCut":0'
NEW='"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":0,"barkCut":0.4,"barkLit":0.9'
DW_VARS="{\"master\":{\"lit\":1.242,\"shade\":1,$OLD,\"barkLit\":1.242},\"final\":{\"lit\":0.9,\"shade\":1.38,$NEW}}" DW_CTX='["master","final"]' \
  DW_TAG=S_g_golden DW_DAY=golden DW_KEYS=$K timeout 600 node drv.js "$U&gfx=gamer" match3.js out6 > log6_g_golden.txt 2>&1 &
sleep 20
DW_TAG=sh timeout 580 node drv.js "$U&gfx=gamer" alt2.js out6 > log6_alt.txt 2>&1 &
wait %2 %3 2>/dev/null
date
DW_VARS="{\"master\":{\"lit\":1.242,\"shade\":1,$OLD,\"barkLit\":1.242},\"final\":{\"lit\":0.9,\"shade\":1.38,$NEW}}" DW_CTX='["master","final"]' \
  DW_TAG=S_g_noon DW_DAY=noon DW_KEYS=$K timeout 420 node drv.js "$U&gfx=gamer" match3.js out6 > log6_g_noon.txt 2>&1 &
sleep 20
DW_VARS="{\"master\":{\"lit\":1.242,\"shade\":1,$OLD,\"barkLit\":1.242},\"final\":{\"lit\":1.242,\"shade\":1,$NEW}}" DW_CTX='[]' \
  DW_TAG=S_p_golden DW_DAY=golden DW_KEYS=larch,spruce timeout 400 node drv.js "$U&gfx=potato" match3.js out6 > log6_p_golden.txt 2>&1 &
wait %4 %5 2>/dev/null
date
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*cdp_dw_*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
bash $L drop gpu DEADWOOD
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*_serve.js 8471*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
