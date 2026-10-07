#!/usr/bin/env bash
# DEADWOOD-BRIGHT 12:20-12:35 untimed: the landing pair + the bark alpha sweep (gamer + potato golden), the mix-dead A/B
cd "$(dirname "$0")"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
S=$(bash $L show | grep -E "GPU_BENCH|RESERVED")
if [ -n "$S" ]; then echo "BOX BUSY: $S"; exit 3; fi
bash $L take gpu DEADWOOD "untimed: snag landing pair + alpha sweep + mix-dead A/B (12:20-12:35)" || exit 4
date
export DW_VARS='{"master":{"lit":1.242,"barkWrap":1,"barkSSS":1,"barkFlat":1.3,"barkSolid":1,"barkCut":0},"land":{"lit":1.242,"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":1,"barkCut":0},"s0":{"lit":1.242,"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":0,"barkCut":0},"s0c3":{"lit":1.242,"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":0,"barkCut":0.3},"s0c5":{"lit":1.242,"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":0,"barkCut":0.5},"c3":{"lit":1.242,"barkWrap":1,"barkSSS":0,"barkFlat":1,"barkSolid":1,"barkCut":0.3}}'
export DW_CTX='["master","land","s0c3"]'
K="larch,pine_georgeous,spruce,dead_conifer"
U="http://localhost:8471/flyDiy/dev.html?world=jolene"
DW_TAG=L_g_golden DW_DAY=golden DW_KEYS=$K timeout 780 node drv.js "$U&gfx=gamer" match2.js out3 > log3_g_golden.txt 2>&1 &
DW_TAG=L_p_golden DW_DAY=golden DW_KEYS=$K timeout 780 node drv.js "$U&gfx=potato" match2.js out3 > log3_p_golden.txt 2>&1 &
DW_TAG=mix_off timeout 780 node drv.js "$U&gfx=gamer" mixd.js out3 > log3_mix_off.txt 2>&1 &
DW_TAG=mix_on timeout 780 node drv.js "$U&gfx=gamer&mixdead=1" mixd.js out3 > log3_mix_on.txt 2>&1 &
wait
date
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*cdp_dw_*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
bash $L drop gpu DEADWOOD
