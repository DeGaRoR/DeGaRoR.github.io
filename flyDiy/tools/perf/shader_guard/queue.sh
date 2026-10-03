#!/usr/bin/env bash
# SHADER-GUARD G1340 GPU queue: the fix at dusk, the two bisect trees at dusk, the fix with dusk falling in the shed
LK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
LOCK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/GPU_BENCH.lock
cd /d/Dev/DeGaRoR.github.io/.claude/worktrees/wonderful-kapitsa-035312/flyDiy
D=tools/perf/shader_guard
bash $LK take gpu SHADER-GUARD "4 runs: fix+bisect at dusk (~30 min)" || exit 1
trap 'grep -q "^SHADER-GUARD " $LOCK && bash $LK drop gpu SHADER-GUARD' EXIT
mine() { grep -q "^SHADER-GUARD " $LOCK || { echo "LOCK NOT MINE"; exit 1; }; }
mine; node tools/perf/shader_guard.js --port 8741 --udd D:/sg1 --fly 200 --day 2026-06-22T06:30Z --out $D/r3_fix_dusk.json > $D/r3.log 2>&1; echo r3 done
mine; node tools/perf/shader_guard.js --port 8741 --udd D:/sg4 --tree _sg_3da1 --fly 200 --day 2026-06-22T06:30Z --out $D/r4_3da1_dusk.json > $D/r4.log 2>&1; echo r4 done
mine; node tools/perf/shader_guard.js --port 8741 --udd D:/sg5 --tree _sg_8f8d --fly 200 --day 2026-06-22T06:30Z --out $D/r5_8f8d_dusk.json > $D/r5.log 2>&1; echo r5 done
mine; node tools/perf/shader_guard.js --port 8741 --udd D:/sg1 --fly 120 --shed-dusk --out $D/r6_fix_shed_dusk.json > $D/r6.log 2>&1; echo r6 done
