#!/usr/bin/env bash
# grass_window.sh <gates|cost|stills> <start HH:MM> <end HH:MM> - GRASS-DENSE's booked windows (A0, 10 Oct): waits for the start,
# waits (gates: up to the end) for a clean box, takes its lock as GRASS with an EXIT trap (the lock always dropped, the rig's tree
# killed), hard-stops at the end. Log: reports/evidence/GRASS-DENSE/win_<kind>.log
#   gates   build + run_gates --only=<the grass set> (CPU lock)
#   cost    grass_cost.js --gpu (TIMED): train 42 vs the field's cost variants, gamer + retro (GPU lock)
#   stills  grass_cost.js stills of the chosen variant ($GRASS_EVAL, a page body) with the 'sides' law, gamer (GPU lock)
KIND=$1; START=$2; END=$3
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
W=/d/Dev/DeGaRoR.github.io/.claude/worktrees/determined-saha-ce181a/flyDiy
BEFORE=/d/Dev/DeGaRoR.github.io/.claude/worktrees/gd-before
E=$W/reports/evidence/GRASS-DENSE; mkdir -p $E/cost2 $E/stills2
LOG=$E/win_$KIND.log
log() { echo "$(date +%H:%M:%S) $*" | tee -a $LOG; }
endS=$(date -d "$END" +%s)
while [ "$(date +%s)" -lt "$(date -d "$START" +%s)" ]; do sleep 15; done
# a clean box (no lock, no reservation) - waited for up to the window's end
while [ -n "$(bash $B show)" ]; do [ "$(date +%s)" -ge $((endS - 120)) ] && { log "never clean before $END: $(bash $B show) - SKIPPED"; exit 1; }; sleep 15; done
LK=gpu; [ "$KIND" = gates ] && LK=cpu
bash $B take $LK GRASS "$KIND window $START-$END" >> $LOG 2>&1
PIDS=""
cleanup() { for p in $PIDS; do taskkill //PID $p //T //F >/dev/null 2>&1; done; bash $B drop $LK GRASS >> $LOG 2>&1; log "lock dropped"; }
trap cleanup EXIT
run() { local left=$(( endS - $(date +%s) - 20 )); [ $left -lt 60 ] && { log "no time left: $*"; return 1; }
  ( "$@" >> $LOG 2>&1 ) & local pid=$!; PIDS="$PIDS $pid"
  ( sleep $left; kill -0 $pid 2>/dev/null && { echo "$(date +%H:%M:%S) HARD STOP $END" >> $LOG; taskkill //PID $pid //T //F >/dev/null 2>&1; } ) & local g=$!
  wait $pid; local rc=$?; kill $g 2>/dev/null; return $rc; }
cd $W
case "$KIND" in
  gates)
    run node tools/run_gates.js --only=COVER,FADES,GRASSSIDES,BIOME,PREMISES,PAVEMENT,SPLAT,WORLDRENDER,UISMOKE && log "gates done" ;;
  cost)
    node tools/build.js >> $LOG 2>&1
    V=forest,app10,app30
    ev() { local f=$E/cost2/eval_$1.js; echo "const f = TREE_FILL.grass(); f.set($2); return f.get();" > $f; echo $f; }
    run node tools/perf/grass_cost.js --root $BEFORE --gpu --noshots --out $E/cost2/base_gamer --preset gamer --views $V --udd C:/grc_before_gamer --warm && log "base gamer"
    for spec in "v0:{}" "v1:{variants:2,block:3}" "v2:{variants:2,block:3,tufts:70}" "v3:{variants:2,block:3,near:10}" "v4:{variants:2,block:3,tufts:70,near:10}"; do
      n=${spec%%:*}; o=${spec#*:}
      run node tools/perf/grass_cost.js --gpu --noshots --q grassfield=1 --eval $(ev $n "$o") --out $E/cost2/${n}_gamer --preset gamer --views $V --udd C:/grc_after_gamer --warm && log "$n gamer"
    done
    run node tools/perf/grass_cost.js --root $BEFORE --gpu --noshots --out $E/cost2/base_retro --preset retro --views $V --udd C:/grc_before_retro --warm && log "base retro"
    for spec in "v1:{variants:2,block:3}" "v4:{variants:2,block:3,tufts:42,near:6}"; do
      n=${spec%%:*}; o=${spec#*:}
      run node tools/perf/grass_cost.js --gpu --noshots --q grassfield=1 --eval $(ev ${n}r "$o") --out $E/cost2/${n}_retro --preset retro --views $V --udd C:/grc_after_retro --warm && log "$n retro"
    done ;;
  stills)
    node tools/build.js >> $LOG 2>&1
    run node tools/perf/grass_cost.js --q grassfield=1 --eval "$GRASS_EVAL" --out $E/stills2/after_gamer --preset gamer --views stand,taxi,app10,app30,rwyside,gstrip,gstrip30,forest,muskeg,lot,shore --udd C:/grc_after_gamer --warm && log "stills done" ;;
esac
