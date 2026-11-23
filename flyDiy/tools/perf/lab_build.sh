#!/bin/bash
# lab_build.sh - GATE THE LAB TREE, BUILD IT ONCE, STAND THE BUILT COPY (PERF-LEAD, 22 Nov 2026)
# The committed HEAD of this worktree is what is built and archived (commit first). The built copy stands at
# D:/Dev/perf-lab-built (A0's fixed path); the one it replaces is kept beside it as perf-lab-built-prev.
#   bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-LEAD --prio -- bash tools/perf/lab_build.sh [gates, default PROGRAMS,LIGHT,HULLWARM,FLIGHTREC]
# THE BUILT FILES STAY IN THE WORKTREE (dev.html, index.html, sw.js, version.json, tools/flight_core.js: modified, never
# committed here): the slot of 14:00 lost an hour because the earlier script put them back from git, and boot_perf in
# this tree then refused its stale tools/flight_core.js for every load.
T="$(cd "$(dirname "$0")/.." && pwd)"; cd "$T/.." || exit 9
W="$(git rev-parse --show-toplevel)"; DEST="${LAB_DEST:-D:/Dev/perf-lab-built}"; NEW="$DEST.new"; GATES=${1:-PROGRAMS,LIGHT,HULLWARM,FLIGHTREC}
BUILT='^ M flyDiy/(dev\.html|index\.html|sw\.js|version\.json|tools/flight_core\.js)$'
echo "== start $(date +%H:%M) branch $(git branch --show-current) $(git log --oneline -1 | cut -c1-9)"
DIRTY=$(git status --porcelain | grep -v '^??' | grep -Ev "$BUILT")
[ -z "$DIRTY" ] || { echo "TREE NOT CLEAN (beyond the built files): stop"; echo "$DIRTY" | head; exit 3; }
BAD=0
for f in tools/boot_perf.js tools/load_brief.js tools/flight_script.js tools/perf/load_matrix_eval.js tools/perf/init_longtasks.js \
         src/viewer/app.js src/viewer/shader_warm.js src/viewer/skin_scuff.js src/viewer/water.js src/viewer/render_premises.js \
         src/viewer/render_world.js src/viewer/cover_ring.js src/viewer/house_worker.js src/viewer/flight_recorder.js src/viewer/pavement.js; do
  [ -f "$f" ] || continue
  if nice -n 19 node --check "$f"; then echo "syntax ok $f"; else echo "SYNTAX FAIL $f"; BAD=1; fi; done
[ $BAD = 0 ] || { echo "syntax failed: no build"; exit 4; }
if [ "$GATES" = none ]; then nice -n 19 node tools/build.js; echo "== build exit $?"
else nice -n 19 node tools/run_gates.js --only=$GATES --jobs=1; echo "== run_gates exit $?"; fi   # (run_gates builds the tree first)
[ -s dev.html ] && [ -s index.html ] || { echo "no built page: stop"; exit 5; }
nice -n 19 node -e "require('./tools/_core_fresh.js').assertFresh(require('path').resolve('tools/flight_core.js'))" || { echo "the core is not this tree's: stop"; exit 5; }
BUILD=$(cat version.json)
rm -rf "$NEW"; mkdir -p "$NEW" || exit 6
( cd "$W" && git archive HEAD flyDiy | tar -x -C "$NEW" ) || { echo "archive failed"; exit 7; }
cp index.html dev.html sw.js version.json "$NEW/flyDiy/" && cp tools/flight_core.js "$NEW/flyDiy/tools/" || { echo "copy failed"; exit 8; }
for f in *.js; do [ -f "$f" ] && cp "$f" "$NEW/flyDiy/"; done        # the hashed side bundles of this build (career_core.*.js, route_draw.*.js)
echo "lab build: branch $(git branch --show-current) $(git log --oneline -1 | cut -c1-9), $BUILD, built $(date '+%Y-%m-%d %H:%M'), gates $GATES" > "$NEW/LAB-BUILD.txt"
git log --oneline -30 >> "$NEW/LAB-BUILD.txt"
if [ -d "$DEST" ]; then rm -rf "$DEST-prev"; mv "$DEST" "$DEST-prev"; fi
mv "$NEW" "$DEST" && echo "== stood at $DEST: $(head -1 "$DEST/LAB-BUILD.txt")"
for k in farslots mirpace latelinks=bg roadw; do grep -rqs "$k" "$DEST/flyDiy/index.html" "$DEST/flyDiy/src/viewer/render_premises.js" && echo "switch in the build: $k" || echo "SWITCH MISSING from the build: $k"; done
echo "== end $(date +%H:%M)"
