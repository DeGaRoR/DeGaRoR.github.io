#!/usr/bin/env bash
# DEADWOOD-BRIGHT verification: master vs the final defaults (and cut 0.5), gamer + potato, golden then noon; 2 pages at a time
cd "$(dirname "$0")"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
S=$(bash $L show | grep -E "GPU_BENCH|RESERVED")
if [ -n "$S" ]; then echo "BOX BUSY: $S"; exit 3; fi
bash $L take gpu DEADWOOD "untimed: snag fix verification (master vs final)" || exit 4
date
export DW_VARS='{"master":{"lit":1.242,"barkWrap":1,"barkSSS":1,"barkFlat":1.3,"barkSolid":1,"barkCut":0,"barkLit":1},"final":{"lit":1.242,"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":0,"barkCut":0.4,"barkLit":0.725},"cut5":{"lit":1.242,"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":0,"barkCut":0.5,"barkLit":0.725}}'
export DW_CTX='["master","final"]'
K="larch,pine_georgeous,spruce,dead_conifer"
U="http://localhost:8471/flyDiy/dev.html?world=jolene"
for d in golden noon; do
  DW_TAG=F_g_$d DW_DAY=$d DW_KEYS=$K timeout 420 node drv.js "$U&gfx=gamer" match2.js out4 > log4_g_$d.txt 2>&1 &
  sleep 20
  DW_TAG=F_p_$d DW_DAY=$d DW_KEYS=$K timeout 400 node drv.js "$U&gfx=potato" match2.js out4 > log4_p_$d.txt 2>&1 &
  wait; date
done
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*cdp_dw_*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
bash $L drop gpu DEADWOOD
