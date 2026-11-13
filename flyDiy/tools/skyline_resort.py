#!/usr/bin/env python3
"""skyline_resort.py - SKYLINE-RESORT (the user 13 Nov 2026): Skyline Altiport (tw_ski) as a PROJECT - the tired ski
station's summit becomes the Jolene Aero Club's summer altiport (recreational flying, gliders, small planes; launch by
a PUSH only). The record's entries, written into the shipped fixture (tools/fixtures/island_jolene.json) by id - an
entry this script owns is REPLACED when it is there and APPENDED when it is not, so a re-run is idempotent and a
rebased fixture takes the same data again:

    python3 tools/skyline_resort.py            # patch the fixture in place
    python3 tools/skyline_resort.py --check    # exit 1 when the fixture differs from what this writes

Every entry is ordinary editor data (strip, areas, roads, objects, cover polygons, a site's items) - the world editor
opens, moves and deletes it like any other. THE RESORT TRACK (CONTRACT_TRACKS.resort, max 3; the Game coordinator's
step list): 0 a tired station - 1 the deal (maintenance: the strip reworked, the paths, the foot-launch pad) - 2 the
summer altiport (the restaurant and its terrace, the parking area; the glider hangar's building site) - 3 the glider
hangar. The sandbox is every track at its max: what has no upper band is today's island.

THE FRAME: the strip's axis. d = (cos hdg, sin hdg) = uphill (end 0, the threshold, to end 1, the top); n = (-d.z, d.x)
across (+ the side away from the tram station). P(a, c) = the top end - a d + c n: `a` metres DOWN from the top end,
`c` metres across. The top end stays where it was (352.00, -7872.01): the flat top, the platform, the stand and the way
out are untouched.
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json')
R = lambda v, n=2: round(float(v), n)

HDG = -1.0472
D = (math.cos(HDG), math.sin(HDG))
N = (-D[1], D[0])
TOP = (351.9996, -7872.0051)          # end 1 of the strip as it stood (380 m about c (257, -7707.46)) - kept
def P(a, c=0.0): return [R(TOP[0] - a * D[0] + c * N[0]), R(TOP[1] - a * D[1] + c * N[1])]
def rect(a0, a1, c0, c1): return [P(a0, c0), P(a1, c0), P(a1, c1), P(a0, c1)]
def st(lo, hi=None, **kw):
    o = {'track': 'resort', 'show': [lo, hi]}
    o.update(kw); return o

# ---- 1 THE STRIP: half the length, half the width -----------------------------------------------------------------
LEN, WID = 190, 9
C = P(LEN / 2)
# the profile: the old strip's upper half as it was composed (its ground, metres MSL, `a` from the top) - the flat top
# (~1 %), the ease, the 9 % at the threshold. dy is relative to the strip's elevation (the ground at its new centre
# before it is graded: ELEV, read off the composed world - tools/skyline_resort.js --elev).
ELEV = 709.08
PROF_MSL = [(190, 698.76), (120, 705.00), (70, 708.07), (30, 708.69), (0, 708.82)]

def runway(old, elev):
    r = dict(old)
    tn = lambda v: int(v) if v == int(v) else v          # the ends as 0 and 1, as the editor writes them
    prof = [[tn(R((LEN - a) / LEN, 4)), R(h - elev)] for a, h in PROF_MSL]
    # the shoulder (the grade's falloff) 30 -> 12 m: half the strip, a narrower cut - and the parking terrace beside it keeps
    # its own grade (a 30 m shoulder pulled it 0.4 m across toward the strip: its spots were not flat)
    r.update({'len': LEN, 'wid': WID, 'c': C, 'profile': prof, 'band': 3, 'falloff': 12})
    # the stage: one strip at every value (its ground is physics, composed with the stage); the tired station's strip
    # has no windsock and no tie-down spots - the deal (resort 1) puts them back. (The 320 -> 380 m growth step is gone.)
    r.pop('stage', None)
    r['stage'] = st(0, None, vary=[{'show': [0, 0], 'sock': False, 'ties': False}])
    return r

def put(layer_rows, e):
    for i, q in enumerate(layer_rows):
        if isinstance(q, dict) and q.get('id') == e['id']:
            layer_rows[i] = e; return
    layer_rows.append(e)

def patch(rec, elev):
    L = rec['layers']
    rw = next(q for q in L['runways'] if q['id'] == 'tw_ski')
    put(L['runways'], runway(rw, elev))
    for e in ENTRIES():
        layer = e.pop('_layer')
        put(L[layer], e)
    site = next(q for q in L['sites'] if q['id'] == 'tw_s_summit')
    for it in ITEMS():
        put(site['items'], it)
    for o in REMOVE:
        for k, rows in L.items():
            L[k] = [q for q in rows if not (isinstance(q, dict) and q.get('id') == o)]
    return rec

# ---- 2 THE FOOT-LAUNCH PAD (resort 1): 2 m of concrete beside the strip's top end, on the side away from the station,
# from the top end down the flat top and a few metres into the slope (the slope starts ~60 m down) - a sailplane's
# pilot runs down it; it is ground (no solid), so it is no obstacle to a wing
LAUNCH = rect(0, 72, 6.5, 8.5)
# ---- 5 THE PARKING AREA (resort 2): the ridge west of the strip, north of the platform - the old strip's west half -
# a terrace for 2 aeroplanes, one behind the other, noses up the hill (PARKING-AREA: the area's `parking` draw; the
# fleet fills it). The ground there falls ~7 % along the strip (> STAND_PAD.grade 2 %), so it is TERRAFORMED - the
# stand pad's law (level across, following the strip's gradient along it), the grade eased to 4.5 % so a parked box's
# corners stay inside FLEET_SPOT.flatTol (9.2 m deep x 4.5 % = 0.41 m < 0.6) - from the platform's north edge (a 92)
PARK = rect(92.5, 128, -12.75, -29.25)
PARK_SLOPE, PARK_TOP = 0.045, 707.0   # its height at a 92.5 (the strip's centreline there: 707.0)
# ---- the restaurant's TERRACE (resort 2): north of the Summit Lodge (the cafe, resort 2), between the outhouse and the
# patrol cabin, looking down the strip
TERRACE = rect(72.5, 82, -30.5, -39.0)
# ---- 6 THE GLIDER HANGAR (resort 3; its building site at resort 2): HANGAR_GEN's club hangar cut to a glider's
# shape - 19 m of door for a 15-18 m span, 11 m deep - on the ridge north of the parking area, its door (+z) toward
# the strip so a glider is PUSHED out across the grass to the top
HANGAR_AC = (142, -21.5)
HANGAR_P = {'HW': 9.5, 'HD': 5.5, 'EAVE': 4.4, 'lot': False, 'name': 'Glider hangar'}
SITE_AT = (277, -7868)                # tw_s_summit's `at` (yaw 0): an item's x, z are the world's less this

def prop(id_, key, a, c, yaw, stage=None, **kw):
    x, z = P(a, c)
    e = {'_layer': 'objects', 'id': id_, 'kind': 'prop', 'dy': 0, 'on': 'ground', 'key': key, 'x': x, 'z': z, 'yaw': R(yaw, 4)}
    e.update(kw)
    if stage: e['stage'] = stage
    return e
def sign(id_, text, a, c, yaw, stage):
    x, z = P(a, c)
    return {'_layer': 'objects', 'id': id_, 'kind': 'billboard', 'key': 'rwy:' + text, 'x': x, 'z': z, 'yaw': R(yaw, 4), 'w': 0.9, 'stage': stage}
def path(id_, pts, stage):
    return {'_layer': 'roads', 'id': id_, 'pts': [P(a, c) for a, c in pts], 'w': 1.6, 'cls': 'track', 'look': 'dirt', 'graded': False,
            'poles': 'off', 'rail': 'off', 'pav': {'marks': 'none'}, 'surface': 6, 'stage': stage}
# a cover polygon of the tree system (contract v1.31 `veg`): no terrain code stamped, only what grows - the island's
# own fill plants it with its LODs, impostors and stand cards (no hand-placed tree); the aerodrome's tree box still
# keeps every tree off the strip's clearance (render_world polyGround: treeAeroBlocked)
GROVE = {'mode': 'new', 'species': {'realistic_fir_trees_pack_lods_gameready.glb': {'proportion': 2},
                                    'spruce_tree.glb': {'proportion': 1.5}, 'pine_georgeous.glb': {'proportion': 0.8},
                                    'dead_conifer': {'proportion': 0.25}, 'shrub_deciduous': {'proportion': 1}},
         'density': 70, 'under': 6, 'cover': 1}
def grove(id_, poly): return {'_layer': 'ttype', 'id': id_, 'poly': poly, 'code': None, 'veg': GROVE}
# the LARGE ROCKS: the scree biome (the tree pack's rock subjects, 'rocks' at size 22, the cover ring's) on patches
def rocks(id_, poly): return {'_layer': 'ttype', 'id': id_, 'poly': poly, 'code': None, 'veg': {'mode': 'biome', 'mix': 'scree'}}

TERR_YAW = HDG + math.pi / 2          # a terrace table square to the strip
def ENTRIES():
    out = [
        # (v1 layers, as the platform's own entries: a staged entry keeps its stage through the editor's save)
        {'_layer': 'surface', 'id': 'tw_y_launch', 'poly': LAUNCH, 'surface': 5, 'stage': st(1)},
        {'_layer': 'material', 'id': 'tw_m_launch', 'poly': LAUNCH, 'look': 'concrete', 'band': 0.3, 'yaw': HDG, 'z': 1, 'stage': st(1)},
        {'_layer': 'terrain', 'id': 'tw_t_park', 'kind': 'ramp', 'poly': PARK, 'level': R(PARK_TOP - PARK_SLOPE * ((92.5 + 128) / 2 - 92.5)),
         'slope': PARK_SLOPE, 'hdg': R(math.degrees(math.atan2(D[0], D[1])), 2), 'falloff': 5, 'abs': True, 'order': 0, 'stage': st(2)},
        {'_layer': 'surface', 'id': 'tw_y_park', 'poly': PARK, 'surface': 6, 'stage': st(2)},
        {'_layer': 'material', 'id': 'tw_m_park', 'poly': PARK, 'look': 'gravel', 'band': 0.6, 'yaw': HDG, 'z': 0,
         'parking': {'gap': 2, 'max': 2}, 'stage': st(2)},
        {'_layer': 'material', 'id': 'tw_m_terrace', 'poly': TERRACE, 'look': 'concrete', 'band': 0.2, 'yaw': HDG, 'z': 1, 'stage': st(2)},
        # 3 THE FOOTPATHS (resort 1; few points - the map's projection carries every road, GATE MAPBAKE's 20 KB): the ridge walk north along the west flank to the ski piste; the top path round the
        # strip's top end to the launch pad; the lookout path down the east flank
        path('tw_p_ridge', [(83, -40), (122, -31), (180, -31), (250, -42)], st(1)),
        path('tw_p_launch', [(30, -6.5), (4, -6.5), (-6, 0), (-1, 7.5)], st(1)),
        path('tw_p_lookout', [(73, 9.5), (114, 30)], st(1)),
        sign('tw_g_ridge', 'RIDGE', 85, -41.5, HDG, st(1)),
        sign('tw_g_launch', 'LAUNCH', 74, 11.5, HDG + math.pi, st(1)),
        sign('tw_g_lookout', 'LOOKOUT', 116, 32.5, HDG + math.pi, st(1)),
        sign('tw_g_piste', 'PISTE', 248, -45, HDG + math.pi, st(1)),
        # the terrace's furniture (existing props)
        prop('tw_o21', 'table_wood', 75.5, -33.5, TERR_YAW, st(2)),
        prop('tw_o22', 'chair_wood', 75.5, -32.2, TERR_YAW + math.pi, st(2)),
        prop('tw_o23', 'chair_wood', 75.5, -34.8, TERR_YAW, st(2)),
        prop('tw_o24', 'table_wood', 79.5, -33.5, TERR_YAW, st(2)),
        prop('tw_o25', 'chair_wood', 79.5, -32.2, TERR_YAW + math.pi, st(2)),
        prop('tw_o26', 'chair_wood', 79.5, -34.8, TERR_YAW, st(2)),
        prop('tw_o27', 'table_wood', 77.5, -37.2, TERR_YAW, st(2)),
        prop('tw_o28', 'chair_wood', 76.3, -37.2, TERR_YAW + math.pi / 2, st(2)),
        prop('tw_o29', 'planter', 73.2, -38.4, 0, st(2)),
        prop('tw_o30', 'planter', 81.3, -38.4, 0, st(2)),
        prop('tw_o31', 'person_koky', 81.0, -36.0, TERR_YAW + 0.6, st(2)),
        prop('tw_o32', 'person_andrew', 73.6, -31.8, TERR_YAW + math.pi - 0.4, st(2)),
        # 4 THE TREES: groves on the flanks (never on the ridge's top: the strip, its approach and its way out stay open)
        grove('tw_k_grove_e', rect(18, 112, 34, 72)),
        grove('tw_k_grove_w', rect(12, 62, -82, -118)),
        grove('tw_k_grove_nw', rect(98, 176, -50, -84)),
        grove('tw_k_grove_se', rect(-30, -95, 28, 70)),
        grove('tw_k_grove_sw', rect(-30, -95, -40, -80)),
        grove('tw_k_grove_le', rect(205, 300, 62, 105)),
        grove('tw_k_grove_lw', rect(205, 300, -62, -105)),
        rocks('tw_k_rocks_e', rect(24, 46, 20, 33)),
        rocks('tw_k_rocks_n', rect(150, 172, -40, -56)),
        rocks('tw_k_rocks_s', rect(-18, -40, 14, 32)),
        rocks('tw_k_rocks_ne', rect(62, 84, 28, 42)),
        # the glider hangar's building site (resort 2): the kit on its footprint
        {'_layer': 'objects', 'id': 'sg_k_glider', 'kind': 'kit', 'kit': 'build', 'x': P(*HANGAR_AC)[0], 'z': P(*HANGAR_AC)[1],
         'yaw': R(math.atan2(N[0], N[1]), 4), 'w': 20, 'd': 12, 'stage': st(2, 2)},
    ]
    return out

def ITEMS():
    x, z = P(*HANGAR_AC)
    return [{'id': 'glider', 'key': 'hangar/club hangar', 'x': R(x - SITE_AT[0]), 'z': R(z - SITE_AT[1]),
             'yaw': R(math.atan2(N[0], N[1]), 4), 'P': dict(HANGAR_P), 'stage': st(3)}]
REMOVE = []

def main():
    txt = open(FX, encoding='utf8').read()
    rec = json.loads(txt)
    elev = float(os.environ.get('SKY_ELEV', ELEV if ELEV is not None else 708.0))
    out = json.dumps(patch(rec, elev), indent=1) + '\n'
    if '--check' in sys.argv:
        print('skyline_resort: the fixture is ' + ('as written' if out == txt else 'NOT as written'))
        sys.exit(0 if out == txt else 1)
    with open(FX, 'w', newline='\n', encoding='utf8') as f: f.write(out)
    print('skyline_resort: wrote', FX)

if __name__ == '__main__':
    main()
