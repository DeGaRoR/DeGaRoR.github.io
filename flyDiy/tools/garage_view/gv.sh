#!/bin/bash
# gv.sh - THE GARAGE-VIEW TOOLSET'S ONE COMMAND (tools/GARAGE_VIEW.md). One site = one airfield's hangars.
#
#   bash tools/garage_view/gv.sh <pack> survey  <out>   CPU ~4 min: measure, census, maps, schematic views, the page (out/page.html)
#   bash tools/garage_view/gv.sh <pack> capture <out>   GPU slot, 25 min: the references, the ground tiles, props, far band, sheets
#   bash tools/garage_view/gv.sh <pack> build   <out>   CPU ~2 min: ground_merge, cook, install (media/garage_view/<pack>/)
#   bash tools/garage_view/gv.sh <pack> shoot   <out>   GPU slot, 20 min: the garage from the same eyes, today_* then gview_*
#   bash tools/garage_view/gv.sh <pack> status  <out>   what exists, and GATE GARAGEVIEW's verdict
# <out> holds the evidence (measure/, capture/, scene/, garage_today/, garage_gview/): keep it out of the repository
# (D:/Dev/flydiy-notes/evidence/GARAGE-VIEW/<pack>). WHO=<session> names the box's token and lock (default GARAGE-VIEW).
# Every run goes through the box's CPU tokens; a GPU stage takes its token with --gpu and the gpu lock inside (A0's rule:
# never hold the lock while waiting for a token). PRIO=1 uses the steered session's lane.
set -u
PACK="${1:-}"; STAGE="${2:-}"; OUT="${3:-}"; WHO="${WHO:-GARAGE-VIEW}"
[ -n "$PACK" ] && [ -n "$STAGE" ] && [ -n "$OUT" ] || { sed -n 2,12p "$0"; exit 2; }
HERE="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || cd "$(dirname "$0")/.." && pwd)"; FLY="$(dirname "$HERE")"
TOK="D:/Dev/flydiy-notes/cpu_token.sh"; LOCK="D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh"
LANE=""; [ "${PRIO:-0}" = 1 ] && LANE="--prio"
mkdir -p "$OUT"; cd "$FLY" || exit 9
G="tools/garage_view"
case "$STAGE" in
  survey)
    bash "$TOK" run "$WHO" $LANE -- bash -c "node --max-old-space-size=4096 $G/measure.js --site $PACK --out '$OUT/measure' && node --max-old-space-size=6144 $G/census.js --out '$OUT/measure' --site $PACK; node $G/map.js --in '$OUT/measure' && node --max-old-space-size=4096 $G/sketch.js --in '$OUT/measure' --w 1280" || exit 1
    python $G/page.py --in "$OUT/measure" --out "$OUT/page.html" ;;
  capture|shoot)
    S="$OUT/slot_$STAGE.sh"
    { echo '#!/bin/bash'; echo "cd '$FLY' || exit 9"
      echo "node --check $G/capture.js || exit 6"
      echo "bash '$LOCK' take gpu $WHO '$PACK $STAGE' || exit 8"; echo "trap \"bash '$LOCK' drop gpu $WHO\" EXIT"
      if [ "$STAGE" = capture ]; then echo "timeout 1500 node --max-old-space-size=4096 $G/capture.js --measure '$OUT/measure' --out '$OUT/capture' --cap 1380 --page dev.html"
      else echo "timeout 620 node $G/capture.js --measure '$OUT/measure' --out '$OUT/garage_today' --do garage --tag today --cap 560 --page dev.html"
           echo "timeout 620 node $G/capture.js --measure '$OUT/measure' --out '$OUT/garage_gview' --do garage --tag gview --q gview=1 --cap 560 --page dev.html"; fi; } > "$S"
    bash "$TOK" run "$WHO" --gpu -- bash "$S" ;;
  build)
    bash "$TOK" run "$WHO" $LANE -- bash -c "node --max-old-space-size=6144 $G/ground_merge.js --cap '$OUT/capture' --measure '$OUT/measure' --out '$OUT/capture' && node --max-old-space-size=6144 $G/cook.js --measure '$OUT/measure' --cap '$OUT/capture' --ground '$OUT/capture' --out '$OUT/scene' && node $G/install.js --scene '$OUT/scene'" ;;
  status)
    for d in measure/measure.json measure/census.json capture/capture.json capture/ground.json scene/scene.json garage_today/capture.json garage_gview/capture.json; do [ -e "$OUT/$d" ] && echo "  have  $d  ($(date -r "$OUT/$d" '+%d %b %H:%M'))" || echo "  none  $d"; done
    bash "$TOK" run "$WHO" $LANE -- node tools/_garageview_check.js ;;
  *) sed -n 2,12p "$0"; exit 2 ;;
esac
