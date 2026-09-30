#!/usr/bin/env bash
# lc_queue.sh - LOAD-COMPILE's (G1085) measurement queue: one GPU lock hold, runs in sequence, ownership checked
# before every run (a queue must never run without its lock: gpu-lock-noclobber).
#   bash lc_queue.sh <note> <run-spec> [<run-spec> ...]
# run-spec = "tree|label|extra rollout_perf args" (the args split on spaces; a build path with a space is written with %20)
# Every run: --port 8617, --fallback the main checkout, --out D:/Dev/wt-loadcompile/flyDiy/tools/perf/lc/<label>.json
LOCK=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
LF=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/GPU_BENCH.lock
note="$1"; shift 1; OUTD=D:/Dev/wt-loadcompile/flyDiy/tools/perf/lc
mine() { grep -q "^LCOMP " "$LF" 2>/dev/null; }
drop() { if mine; then bash "$LOCK" drop gpu LCOMP; fi; }
trap drop EXIT
bash "$LOCK" take gpu LCOMP "$note" || exit 1
mine || { echo "lc_queue: the lock is not mine - stop"; exit 1; }
mkdir -p "$OUTD"
for spec in "$@"; do
  mine || { echo "lc_queue: lost the lock - stop"; exit 1; }
  tree="${spec%%|*}"; spec="${spec#*|}"; label="${spec%%|*}"; rest="${spec#*|}"
  args=(); for a in $rest; do args+=("${a//%20/ }"); done
  echo "=== $label $(date +%H:%M:%S) ${args[*]}"
  (cd "$tree/flyDiy" && node tools/rollout_perf.js --port 8617 --fallback D:/Dev/DeGaRoR.github.io --label "$label" --out "$OUTD/$label.json" "${args[@]}" 2>&1 | grep -v "^  +" | cut -c1-300 )
done
echo "=== done $(date +%H:%M:%S)"
