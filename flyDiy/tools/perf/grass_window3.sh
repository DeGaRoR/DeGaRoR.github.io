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
# master first (A0: 44.4 touches the vegetation exclusion beside these rules): merged; a conflict in the HANDOVER alone is the two
# appended sections (both kept); any other conflict aborts the merge and the gates run on the branch as it was (logged)
git -C $W fetch -q origin master >> $LOG 2>&1
if ! git -C $W merge --no-edit origin/master >> $LOG 2>&1; then
  U=$(git -C $W diff --name-only --diff-filter=U)
  if [ "$U" = "flyDiy/HANDOVER.md" ]; then
    python -c "
p='$W/HANDOVER.md'; b=open(p,'rb').read().decode('utf8'); nl='\r\n' if '\r\n' in b else '\n'
out=[('' if l=='=======' else l) for l in b.split(nl) if not (l.startswith('<<<<<<< ') or l.startswith('>>>>>>> '))]
open(p,'wb').write(nl.join(out).encode('utf8'))" && git -C $W add HANDOVER.md && git -C $W commit -q --no-edit && log "merged master (HANDOVER union)"
  else git -C $W merge --abort; log "MERGE CONFLICT outside the HANDOVER ($U) - aborted, gates on the branch as it was"; fi
else log "merged master"; fi
log "tree $(git -C $W log --oneline -1)"
# FRAMECOST first (its census: the rises the user accepted 11 Oct get their ALLOW entries written while the rest runs), then the
# set, then FRAMECOST again on whatever ALLOW list the tree holds by then
node tools/build.js >> $LOG 2>&1
run node tools/_framecost_check.js --json $E/framecost_44_3.json; log "framecost census rc $?"
run node tools/run_gates.js --no-build --only=COVER,FADES,GRASSSIDES,BIOME,PREMISES,PAVEMENT,SPLAT,WORLDRENDER,UISMOKE,RWYTREES,TAKEOFF,TAXICLEAR,TREEHIT,OBSTACLE,LINEUP,PILOT,SCENERYED,VILLAGE; log "run_gates rc $?"
run node tools/_framecost_check.js; log "framecost (with the ALLOW list) rc $?"
