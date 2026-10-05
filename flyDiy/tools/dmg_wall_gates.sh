#!/usr/bin/env bash
# G1855-G1859 (DMG-WALL): the worker's targeted gate set (DEFORM-AND-BREAK §11.3) under the CPU lock - GATE DMGWALL, and
# for "damage off = the base's bytes" DMGSKIN, UISMOKE, BUILD, JOIN on this branch AND on the base (a `git archive` of it),
# each output diffed with every number masked.
#   bash tools/dmg_wall_gates.sh <base-dir (holds flyDiy/)> <out-dir>
BASE=$1; OUT=$(cd "$2" 2>/dev/null && pwd || (mkdir -p "$2" && cd "$2" && pwd)); ROOT=D:/Dev/dmgwall/flyDiy; LK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
mkdir -p $OUT
# (take cpu does not wait for another owner's CPU lock: wait by hand for no CPU_BATTERY_* lock and no GPU lock but mine)
P=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf
until ! ls $P/CPU_BATTERY_*.lock >/dev/null 2>&1 && { [ ! -e $P/GPU_BENCH.lock ] || grep -q "^DMG-WALL " $P/GPU_BENCH.lock; }; do sleep 20; done
bash $LK take cpu DMG-WALL "gates DMGWALL DMGSKIN UISMOKE BUILD JOIN, branch + base (~15 min)" || exit 1
trap 'bash $LK drop cpu DMG-WALL' EXIT
( cd $BASE/flyDiy && node tools/build.js > $OUT/build_base.log 2>&1 )
( cd $ROOT && node tools/build.js > $OUT/build_branch.log 2>&1 )
export GATES_CORE=1
( cd $ROOT && node tools/_dmg_wall_check.js > $OUT/gate_dmgwall.txt 2>&1 ) &
( cd $ROOT && node tools/_dmg_skin_check.js > $OUT/gate_dmgskin.txt 2>&1 ) &
( cd $BASE/flyDiy && node tools/_dmg_skin_check.js > $OUT/gate_dmgskin_base.txt 2>&1 ) &
( for g in test_ui_smoke.js test_build.js _join_check.js; do ( cd $ROOT && node tools/$g > $OUT/gate_${g%.js}.txt 2>&1 ); ( cd $BASE/flyDiy && node tools/$g > $OUT/gate_${g%.js}_base.txt 2>&1 ); done ) &
wait
mask() { sed -E 's/[0-9]+(\.[0-9]+)?/#/g' "$1"; }
for f in gate_dmgskin gate_test_ui_smoke gate_test_build gate__join_check; do
  if diff <(mask $OUT/$f.txt) <(mask $OUT/${f}_base.txt) > /dev/null; then echo "$f: IDENTICAL to the base (numbers masked)"; else echo "$f: DIFFERS from the base"; fi
done > $OUT/gates_vs_base.txt
for f in $OUT/gate_*.txt; do echo "$(basename $f): $(grep -E 'GATE [A-Z]+: (PASS|FAIL)|PASS|FAIL' $f | tail -1)"; done >> $OUT/gates_vs_base.txt
cat $OUT/gates_vs_base.txt
