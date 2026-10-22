# ROAD PATCH (G2954 ROAD-GRAPH): a road_review.js --join patch written into a Python-written record, every other byte kept.
#   python tools/road_patch.py PATCH.json [tools/fixtures/island_jolene.json]
# The patch: { roads: { <id>: { pts, nodes } }, junctions: [ { id, name?, conn? } ] }. A road's points are the patch's,
# each one the record already had kept as it was written (its 2600.0 stays 2600.0); `nodes` set (or dropped when null);
# the junctions layer's entries of the patch put in (by id). The record is dumped as it was read: json indent 1, '\n'.
import json, sys

patch_p = sys.argv[1]
rec_p = sys.argv[2] if len(sys.argv) > 2 else 'tools/fixtures/island_jolene.json'
src = open(rec_p, encoding='utf-8', newline='').read()
rec = json.loads(src)
if json.dumps(rec, indent=1) + '\n' != src:
    sys.exit('road_patch: ' + rec_p + ' does not round-trip as indent-1 JSON - not touched')
P = json.load(open(patch_p, encoding='utf-8'))
L = rec['premises']['layers'] if 'premises' in rec else rec['layers']
by_id = {r['id']: r for r in L['roads']}
n = 0
for rid, q in P.get('roads', {}).items():
    r = by_id.get(rid)
    if r is None:
        sys.exit('road_patch: no road ' + rid)
    old = r['pts']
    def keep(p):
        for o in old:
            if len(o) == len(p) and all(a == b for a, b in zip(o, p)):
                return o
        return p
    r['pts'] = [keep(p) for p in q['pts']]
    if q.get('nodes'):
        r['nodes'] = q['nodes']
    elif 'nodes' in r:
        del r['nodes']
    n += 1
J = P.get('junctions') or []
if J:
    have = L.setdefault('junctions', [])
    for j in J:
        k = next((i for i, x in enumerate(have) if x.get('id') == j['id']), None)
        if k is None:
            have.append(j)
        else:
            have[k] = j
open(rec_p, 'w', encoding='utf-8', newline='').write(json.dumps(rec, indent=1) + '\n')
print('road_patch: %d road(s), %d junction entr%s -> %s' % (n, len(J), 'y' if len(J) == 1 else 'ies', rec_p))
