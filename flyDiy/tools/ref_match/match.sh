#!/bin/bash
# match.sh <key> [over JSON] [out-prefix] - THE WHOLE COMPARISON IN ONE COMMAND (tools/REF_MATCH.md, section 2):
# births the archetype card <key> as the shed does (rows laid over it when given), measures it against
# refs/<key>.json (or the config whose "card" is <key>) - the headline, the profile, step 1's openings and nose, step 2's planforms, the wings, the gear -
# prints the cowl fitting table (starboard when the config says the exhaust is to port: "exhaust": "port"), writes
# the side / top / front overlays and keeps the born spec for the fitters. Every number in one place, ~15 s.
#   tools/ref_match/match.sh camel
#   tools/ref_match/match.sh tigermoth '{"cw_lidRise": -0.05}' /tmp/try
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
KEY="$1"; OVER="${2:-}"; OUT="${3:-${TMPDIR:-/tmp}/rm_$1}"
REF="$HERE/refs/$KEY.json"
# a config named otherwise says which card it measures: "card": "<key>" (refs/moth.json measures the tigermoth card)
[ -f "$REF" ] || REF=$(python3 -c "import json,glob,sys
for f in sorted(glob.glob(sys.argv[1] + '/refs/*.json')):
    if json.load(open(f)).get('card') == sys.argv[2]: print(f); break" "$HERE" "$KEY")
[ -n "$REF" ] && [ -f "$REF" ] || { echo "no reference config for $KEY (tools/REF_MATCH.md section 1)"; exit 1; }
cd "$ROOT"
if [ -n "$OVER" ]; then node tools/ref_match/dump_build.js --key "$KEY" "$OUT" --over "$OVER" --save "${OUT}_born.json"
else node tools/ref_match/dump_build.js --key "$KEY" "$OUT" --save "${OUT}_born.json"; fi
python3 -I tools/ref_match/refmatch.py "$REF" "$OUT" --png "$OUT"
SB=$(python3 -c "import json,sys; print('--starboard' if json.load(open(sys.argv[1])).get('exhaust') == 'port' else '')" "$REF")
python3 -I tools/ref_match/cowl_sections.py "$REF" "$OUT" $SB
echo "born spec: ${OUT}_born.json  (fit_tail.js / fit_tips.py / fit_cowl.py / cowl_clip.js take it)"
