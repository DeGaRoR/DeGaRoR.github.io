#!/usr/bin/env python3
# waterfront_patch.py - METLAKATLA'S MOLES AND FLOATS AS WATERFRONT LINES (G3038; futureDesigns/WATERFRONT-2026-10-12.md §4).
#
#   py -3.11 tools/waterfront_patch.py [tools/fixtures/island_jolene.json] [--dry]
#
# A SURGICAL PATCH, NOT A RE-AUTHOR. Since SCENERY-SHIP (G3010) the island fixture carries the user's own edits
# (rev25 shipped into it), so re-running jolene_author.py / metlakatla_author.py would undo them. This edits the
# record by id, the way ROAD-GRAPH's road_patch.py does, and dumps it as it was read (json indent 1, '\n'); a record
# that does not round-trip that way is refused untouched.
#
# WHAT GOES:
#   each mole's FOUR hand-authored layers - the terrain flatten (mk_bw_*), the ROCK surface (mk_y_bw_*), the rock
#   ttype (mk_tt_bw_*) and its armour site items (mk_ma_*: MARINE_GEN 'breakwater' boxes, one a segment)
#   the boat harbour floats (mk_mf_harb_a, mk_mf_harb_b, mk_mf_small: MARINE_GEN floats)
# WHAT COMES: layers.waterfront
#   one 'breakwater' line a mole (the footprint, the ground, the surface and the ttype are the composer's from it).
#   The crest is the user's correction (12 Oct, "YES"): the photo's ~8 m on the harbour's two, 7 m on the small two
#   (the author had 2 x half - 1.2 = 16.8 / 14.8 / 12.8 m); the crest height and the slope are the author's.
#   The outer hook runs root first (the author listed it head first; its light is on its head).
#   one 'float' line a float: the same main float (its axis in placeSite's frame), the fingers alternating as
#   MARINE_GEN's did ('alt') at the same pitch and length, now with boats in 3/4 of the slips
# WHAT STAYS: the trestles, the seaplane float, the wharves, the net pens (MARINE_GEN sites; nothing changes for them).
#
# The plots: a mole's footprint is wider than the old flatten polygon (the toe on the shelf vs the crest + falloff),
# so a plot by the shore can be refused where it used to be sown - the GATE PREMISES plots hash (21d) says; read its
# report before accepting the re-cook.
import json
import math
import sys

argv = [a for a in sys.argv[1:] if not a.startswith('--')]
DRY = '--dry' in sys.argv
rec_p = argv[0] if argv else 'tools/fixtures/island_jolene.json'
src = open(rec_p, encoding='utf-8').read()
rec = json.loads(src)
if json.dumps(rec, indent=1) + '\n' != src:
    sys.exit('waterfront_patch: ' + rec_p + ' does not round-trip as indent-1 JSON - not touched')
L = rec.setdefault('layers', {})

# (id, polyline as the author has it, crest, crest over the water, reverse to root-first, light on the head)
MOLES = [
    ('mk_bw_outer', [(-4004, -8912), (-4048, -8864), (-4070, -8837), (-4086, -8801), (-4086, -8760), (-4070, -8719), (-4030, -8682)], 8.0, 4.0, True, 1),
    ('mk_bw_ne', [(-3989, -8814), (-3920, -8868), (-3866, -8910), (-3825, -8873), (-3793, -8837), (-3761, -8792), (-3725, -8714)], 8.0, 3.8, True, 0),
    ('mk_bw_small', [(-3010, -8902), (-2968, -8944), (-2934, -8976)], 7.0, 3.6, False, 0),
    ('mk_bw_bayside', [(-1700, -8500), (-1650, -8466), (-1604, -8448)], 7.0, 3.4, False, 0),
]
FLOATS = ['mk_mf_harb_a', 'mk_mf_harb_b', 'mk_mf_small']
NAMES = {'mk_bw_outer': 'Metlakatla Boat Harbor outer breakwater', 'mk_bw_ne': 'Metlakatla Boat Harbor east breakwater',
         'mk_bw_small': 'Small boat harbour breakwater', 'mk_bw_bayside': 'Bayside breakwater'}

gone = {}


def drop(layer, pred):
    keep, out = [], []
    for e in L.get(layer, []):
        (out if pred(e) else keep).append(e)
    if out:
        L[layer] = keep
        gone.setdefault(layer, []).extend(e.get('id') for e in out)
    return out


ids = set(m[0] for m in MOLES)
drop('terrain', lambda e: e.get('id') in ids)
drop('surface', lambda e: e.get('id') in set(i.replace('mk_bw', 'mk_y_bw') for i in ids))
drop('ttype', lambda e: e.get('id') in set(i.replace('mk_bw', 'mk_tt_bw') for i in ids))
drop('sites', lambda e: str(e.get('id', '')).startswith('mk_ma_'))
floats = drop('sites', lambda e: e.get('id') in FLOATS)

W = L.setdefault('waterfront', [])
have = set(e.get('id') for e in W)


def R(v, n=2):
    return round(v, n)


for bid, pts, crest, h, rev, light in MOLES:
    fid = bid.replace('mk_bw', 'mk_wf')
    if fid in have:
        continue
    P = pts[::-1] if rev else pts
    W.append({'id': fid, 'kind': 'breakwater', 'name': NAMES[bid], 'pts': [[float(x), float(z)] for x, z in P],
              'P': {'crest': crest, 'crestH': h, 'slopeL': 1.5, 'slopeR': 1.5, 'block': 1.8 if crest >= 8 else 1.5, 'light': light},
              'src': {'author': bid}})

for st in floats:
    fid = st['id'].replace('mk_mf', 'mk_wf')
    if fid in have:
        continue
    it = st['items'][0]
    MP = it.get('P', {})
    fl = float(MP.get('floatL', 34))
    # placeSite's frame (27_premises.js): local +x -> (cos psi, -sin psi), psi = at.yaw + PI + item.yaw; the item at
    # (it.x, it.z) in the site's frame (the site's own toLocal: rotated by at.yaw)
    a = st['at']
    ca, sa = math.cos(a.get('yaw', 0)), math.sin(a.get('yaw', 0))
    ix, iz = it.get('x', 0), it.get('z', 0)
    cx, cz = a['x'] + ix * ca + iz * sa, a['z'] - ix * sa + iz * ca
    psi = a.get('yaw', 0) + math.pi + it.get('yaw', 0)
    ux, uz = math.cos(psi), -math.sin(psi)
    p0 = [R(cx - ux * fl / 2), R(cz - uz * fl / 2)]       # the gangway end (MARINE_GEN's gangway is at -x)
    p1 = [R(cx + ux * fl / 2), R(cz + uz * fl / 2)]
    W.append({'id': fid, 'kind': 'float', 'name': st.get('name', 'floats'), 'pts': [p0, p1],
              'P': {'fingers': 'alt', 'pitch': MP.get('pitch', 7.5), 'fingerL': MP.get('fingerL', 9), 'fingerW': MP.get('fingerW', 1.25),
                    'w': MP.get('floatW', 2.6), 'gangway': MP.get('gangway', 1), 'boats': 0.75},
              'src': {'site': st['id']}})

print('waterfront_patch: ' + rec_p)
for k, v in gone.items():
    print('  dropped %-8s %2d  %s' % (k, len(v), ', '.join(v[:6]) + (' ...' if len(v) > 6 else '')))
print('  waterfront   %2d  %s' % (len(W), ', '.join(e['id'] for e in W)))
missing = [m[0] for m in MOLES if m[0] not in gone.get('terrain', [])] + [f for f in FLOATS if f not in [s['id'] for s in floats]]
if missing:
    print('  NOTE: not found (edited away?): ' + ', '.join(missing))
if DRY:
    print('  --dry: nothing written')
else:
    open(rec_p, 'w', encoding='utf-8', newline='').write(json.dumps(rec, indent=1) + '\n')
    print('  written; now: re-cook (premises_cook --island jolene) in a CPU window, then GATE PREMISES 21d (the plots hash)')
