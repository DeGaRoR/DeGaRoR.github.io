#!/usr/bin/env bash
# SHADER-GUARD G1340 r7: a day start, night falling in the shed, the roll-out (the user's 97 s roll-out after an hour in the shed)
LK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
LOCK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/GPU_BENCH.lock
cd /d/Dev/DeGaRoR.github.io/.claude/worktrees/wonderful-kapitsa-035312/flyDiy
D=tools/perf/shader_guard
until grep -q "r6 done" $D/queue.log; do sleep 5; done
bash $LK take gpu SHADER-GUARD "r7: day start, night in the shed (~7 min)" || exit 1
trap 'grep -q "^SHADER-GUARD " $LOCK && bash $LK drop gpu SHADER-GUARD' EXIT
grep -q "^SHADER-GUARD " $LOCK || { echo "LOCK NOT MINE"; exit 1; }
node tools/perf/shader_guard.js --port 8741 --udd D:/sg1 --fly 90 --day 2026-06-21T16:00 --shed-dusk --out $D/r7_fix_day_then_shed_night.json > $D/r7.log 2>&1; echo r7 done
