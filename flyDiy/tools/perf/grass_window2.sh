#!/usr/bin/env bash
# grass_window2.sh <gates|cost> <start> <end> - GRASS-DENSE's Sun 11 Oct windows (A0): the size fade's cap at 1.0.
#   gates  build + COVER + FADES, and the BASE worktree made fresh at origin/master (kept: .claude/worktrees/grass-base)  (CPU lock)
#   cost   grass_cost.js --gpu: the base (master) and the cap-1.0 variants, gamer then retro, in the SAME window      (GPU lock, TIMED)
# Lock taken inside the window, EXIT trap (dropped always, the rig's tree killed), hard stop at the end.
KIND=$1; START=$2; END=$3
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
W=/d/Dev/DeGaRoR.github.io/.claude/worktrees/determined-saha-ce181a/flyDiy
BASE=/d/Dev/DeGaRoR.github.io/.claude/worktrees/grass-base
E=$W/reports/evidence/GRASS-DENSE; mkdir -p $E/cost3
LOG=$E/win2_$KIND.log
log() { echo "$(date +%H:%M:%S) $*" | tee -a $LOG; }
endS=$(date -d "$END" +%s)
while [ "$(date +%s)" -lt "$(date -d "$START" +%s)" ]; do sleep 10; done
while [ -n "$(bash $B show)" ]; do [ "$(date +%s)" -ge $((endS - 90)) ] && { log "never clean before $END: $(bash $B show) - SKIPPED"; exit 1; }; sleep 10; done
LK=gpu; [ "$KIND" = gates ] && LK=cpu
bash $B take $LK GRASS "$KIND window $START-$END" >> $LOG 2>&1
PIDS=""
cleanup() { for p in $PIDS; do taskkill //PID $p //T //F >/dev/null 2>&1; done; bash $B drop $LK GRASS >> $LOG 2>&1; log "lock dropped"; }
trap cleanup EXIT
run() { local left=$(( endS - $(date +%s) - 15 )); [ $left -lt 45 ] && { log "no time left: $*"; return 1; }
  ( "$@" >> $LOG 2>&1 ) & local pid=$!; PIDS="$PIDS $pid"
  ( sleep $left; kill -0 $pid 2>/dev/null && { echo "$(date +%H:%M:%S) HARD STOP $END" >> $LOG; taskkill //PID $pid //T //F >/dev/null 2>&1; } ) & local g=$!
  wait $pid; local rc=$?; kill $g 2>/dev/null; return $rc; }
cd $W
case "$KIND" in
  gates)
    git -C $W fetch -q origin master >> $LOG 2>&1
    if [ -d $BASE ]; then git -C $BASE checkout -q --detach origin/master >> $LOG 2>&1; else git -C $W worktree add -q --detach $BASE origin/master >> $LOG 2>&1; fi
    log "base: $(git -C $BASE log --oneline -1)"
    node tools/build.js >> $LOG 2>&1
    run node tools/_cover_check.js && log "COVER ok"
    run node tools/_fades_check.js && log "FADES ok" ;;
  cost)
    V=forest,app10,app30
    ev() { local f=$E/cost3/eval_$1.js; echo "const f = TREE_FILL.grass(); f.set($2); return f.get();" > $f; echo $f; }
    run node tools/perf/grass_cost.js --root $BASE --gpu --noshots --out $E/cost3/base_gamer --preset gamer --views $V --udd C:/grc_base_gamer && log "base gamer"
    for spec in "c1:{sizeMax:1}" "c2:{sizeMax:1,variants:2}" "c3:{sizeMax:1,variants:2,block:3}" "c4:{sizeMax:1,variants:2,tufts:70}"; do
      n=${spec%%:*}; o=${spec#*:}
      run node tools/perf/grass_cost.js --gpu --noshots --q grassfield=1 --eval $(ev $n "$o") --out $E/cost3/${n}_gamer --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "$n gamer"
    done
    run node tools/perf/grass_cost.js --root $BASE --gpu --noshots --out $E/cost3/base_retro --preset retro --views $V --udd C:/grc_base_retro && log "base retro"
    for spec in "c2:{sizeMax:1,variants:2}" "c4:{sizeMax:1,variants:2,tufts:42}"; do
      n=${spec%%:*}; o=${spec#*:}
      run node tools/perf/grass_cost.js --gpu --noshots --q grassfield=1 --eval $(ev ${n}r "$o") --out $E/cost3/${n}_retro --preset retro --views $V --udd C:/grc_after_retro --warm && log "$n retro"
    done ;;
esac
