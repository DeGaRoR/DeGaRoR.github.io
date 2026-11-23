#!/bin/bash
# crew_cut/check.sh - THE ONE-COMMAND COCKPIT CHECK (16 Nov 2026): dump a build (rows over it optional), cut it, and
# say what pokes through the skin, what of the pilot clashes with the dash and panel, the reach misses, the head.
#   tools/crew_cut/check.sh <build.json> <out-dir> <name> ['{"seatZ":-0.4,"dashBack":0.7}']
# -> <out-dir>/<name>.png (the cut), <name>_outside.png (the hull whole, side + below), <name>.poke, and a summary
set -e
H=$(cd "$(dirname "$0")" && pwd); B=$1; O=$2; N=$3; OV=${4:-'{}'}
[ -n "$N" ] || { echo "usage: tools/crew_cut/check.sh <build.json> <out-dir> <name> [rows-json]"; exit 2; }
mkdir -p "$O"
node "$H/dump.js" "$B" "$O/$N" --over "$OV" | grep CREW_CUT_DUMP | cut -c1-400
python3 "$H/cut.py" "$O/$N.json" "$O/${N}_sheet.json" "$O/$N.png" --label "$N $OV" >/dev/null
python3 "$H/cut.py" "$O/$N.json" "$O/${N}_sheet.json" "$O/${N}_side.png" -0.3 2.9 -0.6 0.6 400 --whole --label "$N outside" >/dev/null
python3 "$H/poke.py" "$O/$N.json" "$O/${N}_sheet.json" > "$O/$N.poke"
python3 "$H/clash.py" "$O/$N.json" "$O/${N}_sheet.json"
python3 - "$O/$N.json" <<'PY'
import json,sys,numpy as np
d=json.load(open(sys.argv[1]))
S=[np.array(m['P']).reshape(-1,3) for m in d['meshes'] if m['skinned']]
if S:
    P=np.concatenate(S)/1000; t=P[np.argmax(P[:,1])]
    print('pilot: head top y %.3f at z %.3f; body z %.2f..%.2f; reach misses %s'%(t[1],t[2],P[:,2].min(),P[:,2].max(),d.get('reach')))
PY
grep "PARTS OUT" "$O/$N.poke"; grep -v "1000mm\|PARTS OUT\|^part" "$O/$N.poke" | head -8
