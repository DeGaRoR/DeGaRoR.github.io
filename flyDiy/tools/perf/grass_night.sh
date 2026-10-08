#!/usr/bin/env bash
# grass_night.sh - GRASS-DENSE's booked night windows of 9 Oct (A0): BEFORE (train 42, ../gd-before) and AFTER (this branch)
#   01:40-02:15 GPU untimed  the stills, gamer + retro, every view (grass_cost.js, no --gpu)
#   02:20-02:35 GPU TIMED    grass_cost.js --gpu, gamer + retro, the cost views, before and after (quiet box)
#   02:40-02:55 CPU          run_gates --only=<the grass set>
# Each window: waits for its start, refuses to start on a foreign lock (logs it, skips), takes the lock as GRASS, hard-stops
# at the window's end (the rig's tree killed by PID), drops the lock. Usage: bash tools/perf/grass_night.sh  (run_in_background)
B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
W=/d/Dev/DeGaRoR.github.io/.claude/worktrees/determined-saha-ce181a/flyDiy
BEFORE=/d/Dev/DeGaRoR.github.io/.claude/worktrees/gd-before
E=$W/reports/evidence/GRASS-DENSE
LOG=$E/night.log
mkdir -p $E/stills $E/cost
log() { echo "$(date +%H:%M:%S) $*" | tee -a $LOG; }
until_t() { while [ "$(date +%H%M)" != "$1" ]; do sleep 20; done; }
secs_to() { local now=$(date +%s) t=$(date -d "$1" +%s); echo $(( t - now )); }
clean() { local s; s=$(bash $B show); if [ -n "$s" ]; then log "FOREIGN LOCK, window skipped: $s"; return 1; fi; return 0; }
run() { # run <deadline HH:MM> <cmd...>: the command, killed (tree) at the deadline
  local dl=$1; shift; local left=$(secs_to "$dl"); [ $left -lt 60 ] && { log "no time left for: $*"; return 1; }
  ( "$@" >> $LOG 2>&1 ) & local pid=$!
  ( sleep $left; if kill -0 $pid 2>/dev/null; then echo "$(date +%H:%M:%S) HARD STOP $dl" >> $LOG; taskkill //PID $pid //T //F >/dev/null 2>&1; kill $pid 2>/dev/null; fi ) & local guard=$!
  wait $pid; local rc=$?; kill $guard 2>/dev/null; return $rc; }
VIEWS=stand,cockpit,taxi,app10,app30,app60,app150,rwyside,lot,lot20,gstrip,gstrip30,muskeg,forest,shore
CVIEWS=stand,taxi,app10,app30,app60,forest

# ---- 01:40 the stills ----
until_t 0140
if clean; then
  bash $B take gpu GRASS "stills before/after (untimed)" >> $LOG 2>&1
  cd $W
  for P in gamer retro; do
    run 02:14 node tools/perf/grass_cost.js --root $BEFORE --out $E/stills/before_$P --preset $P --views $VIEWS --udd C:/grc_before_$P && log "before $P done"
    run 02:14 node tools/perf/grass_cost.js --out $E/stills/after_$P --preset $P --views $VIEWS --udd C:/grc_after_$P && log "after $P done"
  done
  bash $B drop gpu GRASS >> $LOG 2>&1
fi

# ---- 02:20 the timed cost ----
until_t 0220
if clean; then
  bash $B take gpu GRASS "grass_cost TIMED before/after (quiet)" >> $LOG 2>&1
  cd $W
  for P in gamer retro; do
    run 02:34 node tools/perf/grass_cost.js --root $BEFORE --gpu --noshots --out $E/cost/before_$P --preset $P --views $CVIEWS --udd C:/grc_before_$P --warm && log "timed before $P done"
    run 02:34 node tools/perf/grass_cost.js --gpu --noshots --out $E/cost/after_$P --preset $P --views $CVIEWS --udd C:/grc_after_$P --warm && log "timed after $P done"
  done
  bash $B drop gpu GRASS >> $LOG 2>&1
fi

# ---- 02:40 the gates ----
until_t 0240
if clean; then
  bash $B take cpu GRASS "grass gate set" >> $LOG 2>&1
  cd $W
  run 02:55 node tools/run_gates.js --only=COVER,FADES,GRASSSIDES,BIOME,PREMISES,PAVEMENT,SPLAT,WORLDRENDER,UISMOKE && log "gates done"
  bash $B drop cpu GRASS >> $LOG 2>&1
fi
log "night done"
