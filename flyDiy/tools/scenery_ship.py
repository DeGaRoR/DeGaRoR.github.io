# SCENERY SHIP (G3010): a tools/scenery_ship.js patch into a Python-written record, every other byte kept.
#   python tools/scenery_ship.py PATCH.json [tools/fixtures/island_jolene.json]
# ops: { layer, op: 'set', entry } replaces the entry of that id in place (appends when new); { layer, op: 'del', id }
# removes it. A number the record already had in an entry being replaced is NOT kept (the save's entry is shipped as the
# save wrote it). rec: the record's own fields to set. Dumped as read (indent 1, '\n').
import json, sys

patch_p = sys.argv[1]
rec_p = sys.argv[2] if len(sys.argv) > 2 else 'tools/fixtures/island_jolene.json'
src = open(rec_p, encoding='utf-8', newline='').read()
rec = json.loads(src)
if json.dumps(rec, indent=1) + '\n' != src:
    sys.exit('scenery_ship: ' + rec_p + ' does not round-trip as indent-1 JSON - not touched')
P = json.load(open(patch_p, encoding='utf-8'))
R = rec['premises'] if 'premises' in rec else rec
L = R['layers']
n_set = n_add = n_del = 0
for op in P['ops']:
    arr = L.setdefault(op['layer'], [])
    if op['op'] == 'set':
        e = op['entry']
        k = next((i for i, x in enumerate(arr) if isinstance(x, dict) and x.get('id') == e['id']), None)
        if k is None:
            arr.append(e); n_add += 1
        else:
            arr[k] = e; n_set += 1
    elif op['op'] == 'del':
        k = next((i for i, x in enumerate(arr) if isinstance(x, dict) and x.get('id') == op['id']), None)
        if k is not None:
            del arr[k]; n_del += 1
for k, v in (P.get('rec') or {}).items():
    R[k] = v
open(rec_p, 'w', encoding='utf-8', newline='').write(json.dumps(rec, indent=1) + '\n')
print('scenery_ship: %d replaced, %d added, %d removed -> %s' % (n_set, n_add, n_del, rec_p))
