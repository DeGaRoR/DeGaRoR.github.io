#!/usr/bin/env bash
# grass_window3.sh <start> <end> - GRASS-DENSE's train-44.3 gate window (A0, Sun 11 Oct 18:00-18:30, CPU): the grass set, the trees by
# the runways and the pilot's paths, then FRAMECOST's census written (--json) for the PREPARED re-baseline (not applied: the user's).
# Lock taken inside the window, EXIT trap (dropped always, the tree killed), hard stop at the end. Log: win3_gates.log
START=$1; END=$2
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
W=/d/Dev/DeGaRoR.github.io/.claude/worktrees/determined-saha-ce181a/flyDiy
E=$W/reports/evidence/GRASS-DENSE
LOG=$E/win3_gates.log
log() { echo "$(date +%H:%M:%S) $*" | tee -a $LOG; }
endS=$(date -d "$END" +%s)
while [ "$(date +%s)" -lt "$(date -d "$START" +%s)" ]; do sleep 10; done
while [ -n "$(bash $B show)" ]; do [ "$(date +%s)" -ge $((endS - 300)) ] && { log "never clean before $END: $(bash $B show) - SKIPPED"; exit 1; }; sleep 10; done
bash $B take cpu GRASS "train 44.3 grass gates $START-$END" >> $LOG 2>&1
PIDS=""
cleanup() { for p in $PIDS; do taskkill //PID $p //T //F >/dev/null 2>&1; done; bash $B drop cpu GRASS >> $LOG 2>&1; log "lock dropped"; }
trap cleanup EXIT
run() { local left=$(( endS - $(date +%s) - 15 )); [ $left -lt 45 ] && { log "no time left: $*"; return 1; }
  ( "$@" >> $LOG 2>&1 ) & local pid=$!; PIDS="$PIDS $pid"
  ( sleep $left; kill -0 $pid 2>/dev/null && { echo "$(date +%H:%M:%S) HARD STOP $END" >> $LOG; taskkill //PID $pid //T //F >/dev/null 2>&1; } ) & local g=$!
  wait $pid; local rc=$?; kill $g 2>/dev/null; return $rc; }
cd $W
log "tree $(git -C $W log --oneline -1)"
# FRAMECOST first (its census: the rises the user accepted 11 Oct get their ALLOW entries written while the rest runs), then the
# set, then FRAMECOST again on whatever ALLOW list the tree holds by then
node tools/build.js >> $LOG 2>&1
run node tools/_framecost_check.js --json $E/framecost_44_3.json; log "framecost census rc $?"
run node tools/run_gates.js --no-build --only=COVER,FADES,GRASSSIDES,BIOME,PREMISES,PAVEMENT,SPLAT,WORLDRENDER,UISMOKE,RWYTREES,TAKEOFF,TAXICLEAR,TREEHIT,OBSTACLE,LINEUP,PILOT,SCENERYED,VILLAGE; log "run_gates rc $?"
run node tools/_framecost_check.js; log "framecost (with the ALLOW list) rc $?"
