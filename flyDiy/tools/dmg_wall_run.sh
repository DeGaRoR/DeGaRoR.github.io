#!/usr/bin/env bash
# G1858 (DMG-WALL): one box session of tools/dmg_wall_census.js - the GPU lock taken, a live_driver page up on the user's
# Cub (?damage=1&simw=0 plus $Q2), the census run, the page closed, the lock dropped (whatever happens).
#   bash tools/dmg_wall_run.sh <out-subdir> [census args...]
ROOT=${ROOT:-D:/Dev/dmgwall}; LK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
SUB=$1; shift
bash $LK take gpu DMG-WALL "yellow census, the user's Cub (~25 min)" || exit 1
grep -q "^DMG-WALL " D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/GPU_BENCH.lock || exit 1
DRV=
cleanup() { [ -n "$DRV" ] && kill $DRV 2>/dev/null; sleep 2; powershell -NoProfile -Command "Get-CimInstance Win32_Process | ? { \$_.CommandLine -like '*user-data-dir=C:/dmgwall*' -or \$_.CommandLine -like '*_serve.js 8691*' } | % { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"; grep -q "^DMG-WALL " D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/GPU_BENCH.lock && bash $LK drop gpu DMG-WALL; }
trap cleanup EXIT
cd $ROOT/flyDiy
SPORT=8691 DPORT=9591 UDD=C:/dmgwall Q="damage=1${SIMW-&simw=0}${Q2}" node tools/live_driver.js $ROOT builds/cub_2026-09-20_corrected.json dev.html 8692 > $ROOT/flyDiy/reports/evidence/DMG-WALL/driver_$SUB.log 2>&1 &
DRV=$!
sleep 8
node tools/dmg_wall_census.js --cmd 8692 --boot --out reports/evidence/DMG-WALL/$SUB "$@"
