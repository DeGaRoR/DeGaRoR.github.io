#!/usr/bin/env bash
# DEADWOOD-BRIGHT 03:20-03:45 untimed stills. Phase 1: gamer golden + gamer noon near sweeps + the far-forest sheet (3 pages).
# Phase 2: potato golden + noon near sweeps. Each logs to log_<tag>.txt.
cd "$(dirname "$0")"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
S=$(bash $L show | grep -E "GPU_BENCH|RESERVED")
if [ -n "$S" ]; then echo "BOX BUSY: $S"; exit 3; fi
bash $L take gpu DEADWOOD "untimed stills + far-forest sheet (03:20-03:45)" || exit 4
date
K="larch,pine_georgeous,spruce,cedar,dead_conifer"
U="http://localhost:8471/flyDiy/dev.html?world=jolene"
DW_TAG=g_golden DW_DAY=golden DW_KEYS=$K timeout 780 node drv.js "$U&gfx=gamer" match2.js out2 > log_g_golden.txt 2>&1 &
DW_TAG=g_noon DW_DAY=noon DW_KEYS=$K timeout 780 node drv.js "$U&gfx=gamer" match2.js out2 > log_g_noon.txt 2>&1 &
DW_TAG=alt timeout 780 node drv.js "$U&gfx=gamer" alt.js out2 > log_alt.txt 2>&1 &
wait
date
DW_TAG=p_golden DW_DAY=golden DW_KEYS=$K timeout 600 node drv.js "$U&gfx=potato" match2.js out2 > log_p_golden.txt 2>&1 &
DW_TAG=p_noon DW_DAY=noon DW_KEYS=$K timeout 600 node drv.js "$U&gfx=potato" match2.js out2 > log_p_noon.txt 2>&1 &
wait
date
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*cdp_dw_*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
bash $L drop gpu DEADWOOD
