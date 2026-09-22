"""coast_rocks_tune.py - the coast scans' `bury` from their own ground level (THE ROCKY SHORE, 2026-09-22).

tree_prep.py floors every subject on its lowest point; a foreshore scan's lowest point is its bumpy
underside, 6-170 cm below the sand it carries. coast_rocks_prep.py measures that (assets/vegetation/
rocks/coast_rocks_ground.json) and this writes bury = (below + SINK) / h into the species' tuning rows
and every mix row that names them, so the scan's ground sits SINK metres under the terrain and its rocks
stand above. Run after coast_rocks_prep.py, before tree_prep.py:  python tools/coast_rocks_tune.py
"""
import json, os, io
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SINK = 0.08
CUT = 0.10
for root in (os.path.join(ROOT, 'assets'), 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'):
    gp = os.path.join(root, 'vegetation', 'rocks', 'coast_rocks_ground.json')
    if os.path.exists(gp): break
G = json.load(open(gp))
tp = os.path.join(HERE, '_trees_tuning.json')
t = json.loads(io.open(tp, 'r', encoding='utf-8', newline='').read())
n = 0
for name, g in G.items():
    bury = round((g['below'] + SINK) / g['h'], 3)
    cut = round(g['below'] + CUT, 3)   # the skirt's cut, metres above the subject's floor (the sand round the rocks is the ground's job)
    if name in t['tuning']: t['tuning'][name]['bury'] = bury; t['tuning'][name]['cut'] = cut; n += 1
    for mix in t['mixes'].values():
        row = mix.get('species', {}).get(name)
        if row is not None: row['bury'] = bury; n += 1
    print('%-22s below %.2f of %.2f m -> bury %.3f, cut %.2f' % (name, g['below'], g['h'], bury, cut))
io.open(tp, 'w', encoding='utf-8', newline='').write(json.dumps(t, indent=1, ensure_ascii=False))
print('%d rows set in tools/_trees_tuning.json' % n)
