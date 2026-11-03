#!/usr/bin/env bash
# grass_split.sh <start> <end> - GRASS-DENSE G2569: what made 44.3's light strict gate red at HOME (A0, 11 Oct). One TIMED window:
#   a) the field on + the 'sides' law (44.3 as it was)   b) the field on + law 'today' (the band bare again)   c) ?grassfield=0
# at the stand, in the cockpit and at the taxi view, gamer: grass GPU ms (a query round every grass draw), the frame GPU, fps, dt p99,
# the cover rings' CPU slot (their planting) and render - grass_cost.js --gpu. Lock inside the window, EXIT trap, hard stop.
START=$1; END=$2
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
W=/d/Dev/DeGaRoR.github.io/.claude/worktrees/determined-saha-ce181a/flyDiy
E=$W/reports/evidence/GRASS-DENSE; mkdir -p $E/split
LOG=$E/split/split.log
log() { echo "$(date +%H:%M:%S) $*" | tee -a $LOG; }
endS=$(date -d "$END" +%s)
while [ "$(date +%s)" -lt "$(date -d "$START" +%s)" ]; do sleep 10; done
while [ -n "$(bash $B show)" ]; do [ "$(date +%s)" -ge $((endS - 90)) ] && { log "never clean before $END: $(bash $B show) - SKIPPED"; exit 1; }; sleep 10; done
bash $B take gpu GRASS "split a/b/c TIMED $START-$END" >> $LOG 2>&1
PIDS=""
cleanup() { for p in $PIDS; do taskkill //PID $p //T //F >/dev/null 2>&1; done; bash $B drop gpu GRASS >> $LOG 2>&1; log "lock dropped"; }
trap cleanup EXIT
run() { local left=$(( endS - $(date +%s) - 15 )); [ $left -lt 45 ] && { log "no time left: $*"; return 1; }
  ( "$@" >> $LOG 2>&1 ) & local pid=$!; PIDS="$PIDS $pid"
  ( sleep $left; kill -0 $pid 2>/dev/null && { echo "$(date +%H:%M:%S) HARD STOP $END" >> $LOG; taskkill //PID $pid //T //F >/dev/null 2>&1; } ) & local g=$!
  wait $pid; local rc=$?; kill $g 2>/dev/null; return $rc; }
cd $W
node tools/build.js >> $LOG 2>&1
log "tree $(git -C $W log --oneline -1)"
V=stand,cockpit,taxi
echo "PREMISES_GEN.grassSides({ law: 'today' }); TREE_FILL.cover().replant(); TREE_FILL.grass().replant(); return PREMISES_GEN.grassSides();" > $E/split/eval_b.js
run node tools/perf/grass_cost.js --gpu --noshots --q grassfield=1 --out $E/split/a_sides --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "a done"
run node tools/perf/grass_cost.js --gpu --noshots --q grassfield=1 --eval $E/split/eval_b.js --out $E/split/b_today --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "b done"
run node tools/perf/grass_cost.js --gpu --noshots --q grassfield=0 --out $E/split/c_off --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "c done"
# THE LOOP AT THE CAP (A0: "report the loop"): the same three without --gpu - the preset's own 30 cap, no per-draw queries, the CPU
# slots' medians (grass_cost frame().slots: script / solver / world / prem / cover / fill / scene / ... / render) as the gate sees them
run node tools/perf/grass_cost.js --noshots --q grassfield=1 --out $E/split/a_sides_cap --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "a cap done"
run node tools/perf/grass_cost.js --noshots --q grassfield=1 --eval $E/split/eval_b.js --out $E/split/b_today_cap --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "b cap done"
run node tools/perf/grass_cost.js --noshots --q grassfield=0 --out $E/split/c_off_cap --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "c cap done"
# d) the trees: the branch's rwyTrees 'map' default against 'today' (the page parses ?rwytrees), everything else as a) - the woods nearer
# HOME's stand are the other candidate for a loop rise (the fill, the scene, the shadow)
run node tools/perf/grass_cost.js --noshots --q "grassfield=0&rwytrees=today" --out $E/split/d_off_today_cap --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "d cap done"
