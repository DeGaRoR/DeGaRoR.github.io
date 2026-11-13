#!/usr/bin/env python3
"""community_author.py - COMMUNITY-AIRPORT (13 Nov 2026): the community field at w7 (New Community Runway) in three stages,
written as data: the strip's rows (w7's `stage.vary` on the `community` track, 76_stages.js STAGE_SITE_TRACKS) and the
scenery that shows the community's progress (sg_ca_ entries, each with its band).

    python3 tools/community_author.py            # writes tools/jolene_stages.json's community rows AND patches the fixture
    python3 tools/community_author.py --dry-run  # prints the counts, writes nothing

The fixture (tools/fixtures/island_jolene.json) is written as tools/scenery_ship.py writes it (indent 1, every other byte
kept); jolene_stages.json is the source jolene_author.py's apply_stages() reads, so a full re-author lands the same rows.
Re-runnable: every sg_ca_ entry and w7's stage are taken out first, then written again.

THE FICTION (the user, 13 Nov): an isolated community that wants to be as autonomous as possible, with little money but time
and hands. What they would do, stage by stage - everything an existing asset (props_table.py / pier_table.py, the house,
shed and hangar generators' presets); trees only by the tree system (an exclude clears the yard, nothing is planted):
  0  THE FIRST STRIP (track 0, before the project): 600 x 8 m of sticky mud (MUD_FIRM) in the middle of today's axis, a
     plain track on that axis to both ends (where the roads to the village and to the east meet it - the axis and the
     ways to it exist from the start). The strip's hut (a trapper's cabin, its stove pipe), a lean-to of split logs, the
     fire barrel with its stools, the garden plot behind an old fence, a salvaged car body. The farm tractor dragging a
     home-made drag of old tyres; four people at the work; oil-drum markers along the mud strip.
  1  ONE PASS (today's strip, 1 020 x 9 m dirt): the woodshed and its cordwood, a tool shed, the smokehouse, the fuel
     point (drums, a tank, cans), a picnic table, an old pickup; a rusty loader the community salvaged and the tractor at
     the far end of the new length with its drag; drum markers along the full length.
  2  THE LAST PASS (the sandbox: 1 020 x 15 m gravel, graded smooth - minimal infrastructure): a small field hangar, the
     outhouse, a gravel apron beside the strip, what is left of the gravel heaps, the skid-steer and the tractor parked,
     the people at rest round the table; the drum markers moved out to the wider edge.
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json')
STAGES = os.path.join(ROOT, 'tools', 'jolene_stages.json')
TRACK = 'community'
PFX = 'sg_ca_'

# ---- THE STRIP ROWS -------------------------------------------------------------------------------------------------
FINAL = {'wid': 15, 'look': 'gravel', 'surface': 6}          # the sandbox (the last pass): gravel, graded smooth (no micro)
VARY = [
    # 0: the first strip - the middle 600 m of the axis, 8 m (the narrowest a strip may be: stageIssues), firm mud, bumpy
    #    (chaos 0.45: ISO class C/D, the ruts the drag leaves; no stones in clay: rocks 0)
    {'show': [0, 0], 'len': 600, 'wid': 8, 'surface': 11, 'look': 'mud', 'micro': {'chaos': 0.45, 'rocks': 0, 'seed': 7}},
    # 1: today's strip - 1 020 x 9 m dirt (gravel's friction, the dirt look), still bumpy (chaos 0.25, w3's class)
    {'show': [1, 1], 'wid': 9, 'look': 'dirt', 'surface': 6, 'micro': {'chaos': 0.25, 'seed': 7}},
]
S0_LEN = 600


def R(v, n=2):
    return round(float(v), n)


def frame(w):
    """w7's frame: u metres from end 0 (the east end) toward end 1, v metres across (+ north, the runway's n)."""
    c, hdg, L = w['c'], w['hdg'], w['len']
    dx, dz = math.cos(hdg), math.sin(hdg)
    nx, nz = -dz, dx
    e0 = (c[0] - dx * L / 2, c[1] - dz * L / 2)
    def P(u, v):
        return [R(e0[0] + dx * u + nx * v), R(e0[1] + dz * u + nz * v)]
    # a yaw that turns an object's own +x along the strip (toward end 1) - the item placement law (27_premises:
    # x = u c + v s, z = -u s + v c) has the local +x at world (cos yaw, -sin yaw)
    yaw_along = math.atan2(-dz, dx)
    return P, yaw_along, (dx, dz)


def st(lo, hi=None):
    return {'track': TRACK, 'show': [lo, hi]}


def author(rec):
    L = rec['layers']
    w = next(e for e in L['runways'] if e.get('id') == 'w7')
    P, ya, d = frame(w)
    adds = {k: [] for k in ('roads', 'sites', 'objects', 'exclude', 'material', 'surface', 'terrain')}
    n = [0]
    def obj(key, u, v, rot, band, **kw):
        n[0] += 1
        p = P(u, v)
        e = {'id': PFX + 'o%d' % n[0], 'kind': 'prop', 'key': key, 'x': p[0], 'z': p[1], 'yaw': R(ya + rot, 4)}
        e.update(kw); e['stage'] = band
        adds['objects'].append(e)

    # ---- the paths on the axis (stage 0 only: at 1 and 2 the strip itself covers them) ----------------------------------
    half = (w['len'] - S0_LEN) / 2
    for tag, a, b in (('e', 0.0, half - 2), ('w', w['len'] - half + 2, w['len'])):
        adds['roads'].append({'id': PFX + 'path_' + tag, 'pts': [P(a, 0), P((a + b) / 2, 0), P(b, 0)], 'w': 3.6, 'cls': 'track', 'look': 'dirt',
                              'graded': False, 'poles': 'off', 'rail': 'off', 'pav': {'marks': 'none'}, 'stage': st(0, 0)})

    # ---- the yard: the middle of the strip, the south side (v < 0), every solid thing 28 m or more off the centreline ----
    UM = w['len'] / 2                                     # the yard's centre along the strip
    yard = P(UM, -50)
    items = []
    def item(iid, key, u, v, rot, band, Pp=None):
        # the site's frame: at the yard's centre, its local +x along the strip (toward end 1), +z the runway's n (north,
        # toward the strip): the placement law's local +z is world (sin yaw, cos yaw) = n
        items.append({'id': iid, 'key': key, 'x': R(u - UM), 'z': R(v + 50), 'yaw': R(rot, 4), 'onRoad': False, 'bottomOnRoad': False,
                      'P': Pp or {}, 'stage': band})
    # 0 (stands from the first day): the strip hut, the lean-to of split logs
    item('hut', 'shed/trapper cabin', UM - 8, -52, math.pi, st(0))
    item('leanto', 'shed/lean-to', UM - 18, -50, math.pi, st(0))
    # 1: the woodshed (cordwood), a tool shed, the smokehouse (the fish shack, its chimney smoking)
    item('woodshed', 'shed/wood shed', UM - 30, -56, math.pi, st(1))
    item('toolshed', 'shed/tool shed', UM + 12, -50, math.pi, st(1))
    item('smokehouse', 'house/fish shack', UM + 26, -62, math.pi / 2, st(1), {'yard': 0, 'lot': False})
    # 2: the small field hangar (one aeroplane under a roof), the outhouse
    item('hangar', 'hangar/field shed, small', UM + 44, -52, math.pi, st(2))
    item('outhouse', 'house/outhouse', UM - 40, -64, math.pi, st(2), {'yard': 0, 'lot': False})
    adds['sites'].append({'id': PFX + 'yard', 'name': 'Community strip yard', 'at': {'x': yard[0], 'z': yard[1], 'yaw': R(ya, 4)},
                          'items': items, 'yard': None,
                          'life': {'clutter': 0, 'rubbish': 0, 'cars': 0, 'traffic': 0, 'small': 0, 'antennas': 0}, 'stage': st(0)})
    # the yard's ground: no tree, no rock, no settlement there (from the first day)
    adds['exclude'].append({'id': PFX + 'x_yard', 'poly': [P(UM - 70, -26), P(UM + 70, -26), P(UM + 70, -86), P(UM - 70, -86)],
                            'what': ['trees', 'rocks', 'settle'], 'stage': st(0)})

    # ---- the props -----------------------------------------------------------------------------------------------------
    # 0 onward: the fire barrel and its stools, the garden behind an old fence, a salvaged car body, cans
    obj('stove_barrel', UM - 2, -40, 0.3, st(0), on='ground')
    for k, (du, dv) in enumerate(((-3.2, -1.0), (-1.0, 2.6), (2.0, 2.2))):
        obj('stool_wood2', UM - 2 + du, -40 + dv, 0.7 * k, st(0), on='ground')
    gu, gv, gw, gd = UM - 4, -70, 12, 8                   # the garden plot: 12 x 8 m, its gate on the strip side
    for (a, b) in (((-gw / 2, 0), (gw / 2, 0)), ((gw / 2, 0), (gw / 2, -gd)), ((gw / 2, -gd), (-gw / 2, -gd)), ((-gw / 2, -gd), (-gw / 2, 0))):
        Ls = math.hypot(b[0] - a[0], b[1] - a[1]); m = max(1, round(Ls / 4.6)); rot = math.atan2(-(b[1] - a[1]), b[0] - a[0])
        for i in range(m):
            if a[1] == 0 and b[1] == 0 and m >= 3 and i == m // 2: continue   # the gate
            t = (i + 0.5) / m
            obj('fence_old', gu + a[0] + (b[0] - a[0]) * t, gv + a[1] + (b[1] - a[1]) * t, rot, st(0))
    obj('planter', gu - 3, gv - 3, 0, st(0), on='ground')
    obj('planter', gu + 1, gv - 3, 0, st(0), on='ground')
    obj('bag_compost', gu + 4, gv - 5.5, 0.4, st(0), on='ground')
    obj('bags_lean', gu + 4.5, gv - 2, 1.2, st(0), on='ground')
    obj('person_koky', gu - 1, gv - 5, 1.9, st(0))       # weeding
    obj('car_junk', UM - 52, -66, 0.5, st(0), on='ground')
    obj('jerrycan_green', UM - 6, -46, 0.2, st(0), on='ground')
    # 0 only: the work on the mud - the tractor with its drag of old tyres at the yard's west side, people at it (the
    # reveal's camera aims at the centre of what changes: the work stays by the yard)
    tu, tv = UM + 36, -30
    obj('tractor_farm', tu, tv, 0, st(0, 0), on='ground')
    for k in range(3):
        obj('tyre', tu + 6 + 1.4 * k, tv + (k - 1) * 1.3, 0.3 * k, st(0, 0), on='ground')
    obj('person_andrew', tu - 4, tv - 3, 2.2, st(0, 0))
    obj('person_john', tu + 10, tv - 3.5, 0.6, st(0, 0))
    obj('person_charles', UM - 10, -38, 1.0, st(0, 0))
    obj('handtruck', UM - 13, -40, 0.4, st(0, 0), on='ground')
    obj('pallets_three', UM - 22, -42, 1.57, st(0, 0), on='ground')
    obj('crate_wood_a', UM - 20, -39, 0.3, st(0, 0), on='ground')
    # 1 onward: the fuel point, the picnic table, the old pickup
    fu, fv = UM + 6, -36
    for k, (du, dv) in enumerate(((0, 0), (1.0, 0.3), (0.5, 1.0), (1.6, 1.1))):
        obj('drum_steel', fu + du, fv + dv, 0.5 * k, st(1), on='ground')
    obj('barrel_plastic', fu + 3, fv + 0.2, 0, st(1), on='ground')
    obj('jerrycan_green', fu - 1.2, fv + 0.6, 0.9, st(1), on='ground')
    obj('picnic_table', UM + 18, -40, 0.15, st(1), on='ground')
    obj('auto_pickup_red', UM - 34, -40, 0.25, st(1), on='ground')
    # 1 only: the rusty loader the community salvaged, the tractor and its drag back from grading the new length, at the
    # yard's east side, two people at it
    ku, kv = UM - 92, -30
    obj('machine_loader_rusty', ku, kv, 0.1, st(1, 1), on='ground')
    obj('tractor_farm', ku + 22, kv - 2, 0, st(1, 1), on='ground')
    for k in range(3):
        obj('tyre', ku + 28 + 1.4 * k, kv - 2 + (k - 1) * 1.3, 0.4 * k, st(1, 1), on='ground')
    obj('person_luke', ku + 8, kv - 4, 2.6, st(1, 1))
    obj('person_charles', ku + 16, kv - 5, 0.8, st(1, 1))
    # 2: at rest - the people round the table, the skid-steer and the tractor parked by the hangar, the gravel heaps
    obj('person_andrew', UM + 16.5, -41.5, 1.4, st(2))
    obj('person_john', UM + 19.5, -38.5, -1.6, st(2))
    obj('machine_skidsteer', UM + 60, -40, 0.2, st(2), on='ground')
    obj('tractor_farm', UM + 66, -46, 0.1, st(2), on='ground')
    # the gravel heaps (what is left of the last pass): a raise of the ground and its gravel, beside the hangar
    for k, (hu, hv, r, dh) in enumerate(((UM + 80, -58, 5.0, 1.3), (UM + 90, -66, 3.6, 0.9))):
        poly = [P(hu + r * math.cos(2 * math.pi * i / 10), hv + r * math.sin(2 * math.pi * i / 10)) for i in range(10)]
        adds['terrain'].append({'id': PFX + 't_heap%d' % k, 'kind': 'raise', 'poly': poly, 'dh': dh, 'falloff': r * 0.9, 'stage': st(2)})
        adds['material'].append({'id': PFX + 'm_heap%d' % k, 'poly': [P(hu + (r + r * 0.9) * math.cos(2 * math.pi * i / 12), hv + (r + r * 0.9) * math.sin(2 * math.pi * i / 12)) for i in range(12)],
                                 'look': 'gravel', 'band': 1, 'z': 1, 'stage': st(2)})
    # the gravel apron beside the strip (the last pass): between the strip's edge and the yard, its wheels' surface too
    ap = [P(UM + 30, -10), P(UM + 62, -10), P(UM + 62, -30), P(UM + 30, -30)]
    adds['material'].append({'id': PFX + 'm_apron', 'poly': ap, 'look': 'gravel', 'band': 2, 'yaw': R(ya, 4), 'z': 1, 'stage': st(2)})
    adds['surface'].append({'id': PFX + 'y_apron', 'poly': ap, 'surface': 6, 'stage': st(2)})

    # ---- the oil-drum markers: every ~100 m along both edges, 5 m off the edge of the strip of the stage ---------------
    def markers(u0, u1, half_w, band):
        m = int(round((u1 - u0) / 100.0))
        for i in range(m + 1):
            u = u0 + (u1 - u0) * i / m
            for s in (1, -1):
                obj('drum_steel', u, s * (half_w + 5), 0.37 * i, band, on='ground')
    markers(half + 4, w['len'] - half - 4, VARY[0]['wid'] / 2, st(0, 0))
    markers(4, w['len'] - 4, VARY[1]['wid'] / 2, st(1, 1))
    markers(4, w['len'] - 4, FINAL['wid'] / 2, st(2))
    return w, adds


def strip_old(rec):
    n = 0
    for k, rows in rec['layers'].items():
        keep = [e for e in rows if not (isinstance(e, dict) and str(e.get('id', '')).startswith(PFX))]
        n += len(rows) - len(keep); rec['layers'][k] = keep
    return n


def main():
    dry = '--dry-run' in sys.argv
    src = open(FIX, encoding='utf-8', newline='').read()
    rec = json.loads(src)
    if json.dumps(rec, indent=1) + '\n' != src: sys.exit('community_author: the fixture does not round-trip as indent-1 JSON - not touched')
    gone = strip_old(rec)
    w = next(e for e in rec['layers']['runways'] if e.get('id') == 'w7')
    w.pop('stage', None)
    for k, v in FINAL.items(): w[k] = v
    w, adds = author(rec)
    stage = {'track': TRACK, 'show': [0, None], 'vary': VARY}
    w['stage'] = stage                                     # (the key LAST, as apply_stages writes it)
    for k, rows in adds.items(): rec['layers'][k].extend(rows)
    nadd = sum(len(v) for v in adds.values())
    # jolene_stages.json: the w7 band and the sg_ca_ entries
    S = json.load(open(STAGES, encoding='utf-8'))
    S['stage']['runways:w7'] = stage
    for k in list(S.get('add', {}).keys()):
        S['add'][k] = [e for e in S['add'][k] if not str(e.get('id', '')).startswith(PFX)]
    for k, rows in adds.items():
        if rows: S.setdefault('add', {}).setdefault(k, []).extend(rows)
    print('community_author: %d old sg_ca_ entries out, %d in (%s); w7 base %s' % (gone, nadd, ', '.join('%s %d' % (k, len(v)) for k, v in adds.items() if v), FINAL))
    if dry: return
    open(FIX, 'w', encoding='utf-8', newline='').write(json.dumps(rec, indent=1) + '\n')
    open(STAGES, 'w', encoding='utf-8', newline='\n').write(json.dumps(S, indent=1) + '\n')
    print('wrote', FIX, 'and', STAGES)


if __name__ == '__main__': main()
