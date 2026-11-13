#!/usr/bin/env python3
"""afb0220_author.py - JOLENE AFB 02/20 GONE WILD, AND THE GLIDER WINCH ON 13/31 (AFB-0220, 13 Nov 2026).

    python3 tools/afb0220_author.py            # splices the layout into tools/fixtures/island_jolene.json
    python3 tools/afb0220_author.py --print    # prints the layout table (the numbers, in the strip's frame) and stops
    python3 tools/afb0220_author.py --check    # exits 1 when the fixture is not what this script writes (GATE AFB0220 runs it)

THE USER (13 Nov, via A0): 02/20, the crosswind runway nobody uses, becomes an UNMAINTAINED, DEGRADED strip "divided into
several runways": a NARROW CENTRAL BAND of the old concrete (clean landings; the Aero Club's spot landing and the
plane-vs-car drag race), one SIDE very BUMPY but landable (STOL practice), the OTHER SIDE full of MUD, ROCKS and FALLEN
TREES you can crash into, the FOREST TAKING OVER further out. And the glider winch installed for good on 13/31.
A0 (17:15): "plenty of EXOTIC stuff to crash into", few strong pieces, naturally overgrown, GRADUAL transitions.

HOW IT IS WRITTEN (the island record's convention since ED-2 / G3663: spliced in place, json.dumps indent 1, no trailing
newline, no rev bump; the world editor opens and edits every entry this writes). IDEMPOTENT: every entry it owns has an
id starting `afb_` (objects, areas) or is `w2r` (the rough strip); a run removes them and writes them again, and sets
w2's own fields from W2 below. Every number is in 02/20's FRAME: u along the strip from its centre (+ toward the SW end,
13/31's), v across (+ toward the NW side), metres; yaw in degrees from the strip's own +u, measured as the house frame
turns (a yaw turns +x toward -z). The winch is in 13/31's frame (s along from its centre, + toward the SE end; v + SW).

THE RE-COOK after a run (the island's documented chain, HANDOVER G3010 / GATE PREMCOOK's hint):
    node tools/premises_cook.js --island jolene
    node tools/city_cook.js --island jolene
    node tools/fleet_spots.js --cook
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json')

# ---- 02/20 ---------------------------------------------------------------------------------------------------------
# THE CENTRAL BAND (w2, kept as 'Jolene AFB 02/20': the names table, the coordinator's events): the old concrete, 45 m
# (the user 13 Nov: "wavy, progressive blending, only 2-3 meters of real clean concrete, tops, irregular": tearIn 8: a median 2 m of clean concrete, irregular -
# the concrete torn inward from both edges by the soft edge's noise, pavement.js; the wheels still roll on the old
# concrete over its whole 18 m: the drawn cover is dirt and grass over it, the surface under them PAVED)
# -> 18 m (a Cub's 10.7 m span with 3.6 m either side; the C172's 11 m), its whole 1 758 m, straight. Moss and grass
# creep in from both edges (mossEdge, grassReach), the edge chipped and ragged (edgeChip, bandNoise), heavy cracking with
# weeds in the joints (crackK, jointDirt, mossJoint) and old patches (patchK); no rubber, no paint left to speak of
W2 = {'wid': 18, 'band': 5, 'falloff': 60,
      'pav': {'rubberK': 0, 'laneW': 6.0, 'mossK': 1.0, 'crackK': 0.9, 'patchK': 0.22, 'paintAge': 1.15, 'wet': 0.5,
              'mossEdge': 7.0, 'grassReach': 6.0, 'edgeChip': 1.6, 'bandNoise': 0.95, 'jointDirt': 0.85, 'mossJoint': 0.9,
              'damageK': 0.85, 'stainK': 0.7, 'sideW': 6.0, 'sideA': 0.2, 'tearIn': 8.0},
      'clear': {'side': 4, 'beyond': 5, 'taper': 0, 'bushes': False}}
# THE ROUGH SIDE (w2r, 'Jolene AFB 02R/20L': on the RIGHT of a pilot landing 02 - toward the NE end - the SE side, v < 0):
# FIRM MUD (SNOW-MUD's surface 11, 'a drying clay strip') with the DIRT-STRIP micro-relief at chaos 0.65 (ISO 8608 class
# D-E: ruts, lumps, holes with puddles, 2 avoidable hazards per 100 m), 820 x 15 m, its edges 7.5 m off the concrete's
W2R = {'id': 'w2r', 'name': 'Jolene AFB 02R/20L', 'u': -160.0, 'v': -24.0, 'len': 820.0, 'wid': 15,
       'look': 'mud', 'surface': 11, 'band': 3, 'falloff': 30,
       'micro': {'chaos': 0.65, 'seed': 220, 'puddles': 0.7, 'hazards': 2},
       'pav': {'marks': 'none', 'mossK': 0.7, 'wet': 0.6},
       'clear': {'side': 4, 'beyond': 40, 'taper': 0, 'bushes': False}}
# THE MUD SIDE (NW, v > 0): SOFT MUD (12, 'wet clay after rain - the wheels go in'), from v 10 (1 m off the concrete) to a
# ragged outer edge round v 50, the whole strip but the last stretch before 13/31 (u <= 740) and a gap where road r4
# meets the old runway (u -582 .. -512: its gravel track runs across the gap to the concrete). Keeps the trees out
# (a mud area is a hard surface to the forest: FEEL_HARD)
MUD = {'v0': 10.0, 'v1': 50.0, 'u0': -860.0, 'u1': 740.0, 'gap': (-582.0, -512.0), 'look': 'softmud', 'surface': 12, 'band': 7, 'fade': 6}
TRACK = {'u': -547.0, 'w': 7.0, 'v0': 9.0, 'v1': 26.0}       # r4's end (u -547, v 22.6) to the concrete's edge
# THE FOREST TAKING OVER: the tree system's own fill on two cover polygons (27_premises vegOf 'new': the species, their
# share, the dead fraction; render_world's fill plants them, its trunks are TREE_HITS 'fill:*' - solid), young growth
# (saplings, shrubs, fireweed) nearest the strip, conifers and their dead (the snags: dead_conifer) behind; the fallen
# wood of the floor is the cover ring's. NW from the mud's edge, SE from 8 m past the rough strip
VEG_NW = {'v0': 47.0, 'v1': 135.0, 'u0': -880.0, 'u1': 720.0}
VEG_SE = {'v0': -40.0, 'v1': -135.0, 'u0': -880.0, 'u1': 720.0}
SCRUB_SE = {'v0': -12.0, 'v1': -40.0}                        # where the rough strip is not: grass, shrubs, saplings
WOOD = {'mode': 'new', 'density': 70, 'under': 6, 'cover': 1, 'species': {
    'spruce_tree.glb': {'proportion': 1.2, 'dead': 0.18}, 'realistic_fir_trees_pack_lods_gameready.glb': {'proportion': 2.0, 'dead': 0.12},
    'cedar_tree.glb': {'proportion': 0.6, 'dead': 0.15}, 'dead_conifer': {'proportion': 0.25},
    'sapling_deciduous': {'proportion': 1.2}, 'shrub_deciduous': {'proportion': 1.0}, 'birch': {'proportion': 0.5, 'dead': 0.1},
    'flower_fireweed': {'proportion': 1, 'density': 0.6, 'patch': 6}, 'grass_reed': {'proportion': 0.5, 'density': 0.5, 'patch': 0, 'size': 0.8},
    'rocks': {'proportion': 1, 'size': 14},
    'lowpoly_sticks.glb': {'proportion': 0.35, 'tilt': 1, 'bury': 0.2, 'cluster': 1, 'hollow': 0.55, 'tint': 0.3, 'dim': 0.72},
    'tree_stump_01.glb': {'proportion': 0.1, 'tilt': 0.5, 'bury': 0.2, 'tint': 0.3, 'dim': 0.95},
    'dead_tree_trunk_02.glb': {'proportion': 0.08, 'tilt': 1, 'bury': 0.2, 'cluster': 1, 'hollow': 0.5, 'tint': 0.3, 'dim': 0.9},
    'log.glb': {'proportion': 0.06, 'size': 0.0085, 'tilt': 1, 'bury': 0.2, 'cluster': 1, 'hollow': 0.5, 'tint': 0.3, 'dim': 0.5}}}
SCRUB = {'mode': 'new', 'density': 14, 'under': 10, 'cover': 1, 'species': {
    'sapling_deciduous': {'proportion': 1.5}, 'shrub_deciduous': {'proportion': 1.2}, 'spruce_tree.glb': {'proportion': 0.25, 'dead': 0.1},
    'flower_fireweed': {'proportion': 1, 'density': 0.8, 'patch': 6}, 'flower_foam': {'proportion': 1, 'density': 0.5, 'patch': 5},
    'grass_dry': {'proportion': 1, 'density': 0.8, 'patch': 0}, 'grass_reed': {'proportion': 0.4, 'density': 0.5, 'patch': 0, 'size': 0.8},
    'rocks': {'proportion': 1, 'size': 10}}}

# ---- THE THINGS TO HIT on the mud side (u, v, kind / key, yaw deg from +u, scale) ------------------------------------
# DEBRIS (kind 'debris', 26c_wild.js: the tree pack's own models, solid as TREE_HITS 'wild'): a laid tree's butt is at
# (u, v), its length along its yaw - the windthrow falls OUT of the forest toward the strip and stops short of it.
# THE YAW'S SIGN: the house frame's, so +90 points a model's +x at -v (toward the strip from the NW side); a model whose
# length is its own z (the log, the props) lies along yaw - 90
DEBRIS = [
    ('fallen_spruce', -640, 49, 70, 1.0),  ('fallen_spruce', -205, 46, 4, 1.0),  ('fallen_spruce', 262, 49, 125, 1.0),
    ('fallen_spruce', 610, 47, 40, 0.9),   ('fallen_snag', 482, 41, 95, 1.0),   ('fallen_snag', -425, 33, 178, 1.0),
    ('fallen_snag', -60, 47, 110, 1.1),
    ('trunk', -700, 22, 15, 1.4),   ('trunk', -92, 19, -72, 1.3),  ('trunk', 652, 25, 33, 1.5),   ('trunk', 120, 15, 8, 1.2),
    ('log', -495, 19, 92, 1.0),     ('log', 80, 28, 120, 1.1),     ('log', 342, 17.5, 90, 1.0),   ('log', -300, 18, 60, 0.9),
    ('stump', -762, 40, 0, 1.2),    ('stump', -600, 40, 40, 1.0),  ('stump', -330, 42, 80, 1.3),  ('stump', -150, 30, 10, 1.1),
    ('stump', 40, 41, 200, 1.4),    ('stump', 190, 24, 120, 1.0),  ('stump', 410, 39, 300, 1.2),  ('stump', 702, 33, 70, 1.1),
    ('rocks_slide', -300, 34, 12, 1.0), ('rocks_bank', -738, 31, 95, 0.9), ('rocks_pile', 150, 37, 30, 1.0),
    ('rocks_pile', 560, 21, -20, 0.8),  ('rocks_low', -612, 16, 40, 1.0), ('rocks_low', -18, 24, -15, 1.0), ('rocks_low', 455, 27, 70, 1.2),
]
# PROPS (kind 'prop', PROP_REG keys - solid in the page by their drawn mesh, hitAdd 'prop'): what a remote base leaves
# behind - a gate-guardian F-104G gone to the weeds, the old crash tender, a wheel loader that cleared the snow, another
# rusting where it died, two cars, the oil drums, a tyre dump, a works dump by the loader, the old edge-line poles (some
# gone), a collapsed picket fence at the forest's edge
PROPS = [
    ('starfighter', -20, 36, 160), ('truck_fire_small', 380, 33, -15), ('loader_wreck', -380, 25, 70), ('machine_loader_rusty', -785, 24, 200),
    ('car_crashed', -655, 30, 40), ('car_junk', 522, 37, 100),
    ('drum_steel', 214, 20, 0), ('drum_steel', 215.4, 21.1, 30), ('drum_steel', 216.9, 20.2, 70), ('drum_steel', 218, 23.4, 10),
    ('drum_steel', 213.1, 22.6, 50), ('bin_metal_rust', 220.5, 21.7, 15), ('bin_metal_rust', 211.4, 24.8, 80), ('drum_steel', 226, 27, 20),
    ('tyre', -470, 23, 0), ('tyre', -470.2, 23.1, 40), ('tyre', -468.6, 24.2, 75), ('tyre', -471.5, 21.8, 20),
    ('pallets_stack', -362, 35, 20), ('cinder_pallet', -354, 38, -10), ('cement_bags', -347, 31.5, 35),
    ('pole_b', -760, 46, 0), ('pole_b', -688, 47, 3), ('pole_b', -470, 46.5, -4), ('pole_b', -330, 47, 2), ('pole_b', -110, 46, 0),
    ('pole_b', 105, 47, 5), ('pole_b', 318, 46.5, -3), ('pole_b', 540, 47, 1), ('pole_b', 680, 46, 0),
    ('fence_old', 300, 44, 4), ('fence_old', 305.5, 44.4, 12), ('fence_old', 316, 43.6, -9), ('fence_old', 321.4, 42.9, 25),
]
# THE CLEAR BAND: nothing of the above may stand closer than this to the centreline (the central band is |v| < 9): the
# gate holds every hit cylinder, every prop's footprint and every fill tree outside it over the strip's whole length
CLEAR_V = 11.0

# ---- 13/31: THE WINCH ------------------------------------------------------------------------------------------------
# One winch for good (WINCH_GEN, the club look; tools/_winch_gen.js), at the NW end of 13/31: 37 m in from the end, on the
# old concrete's NE edge (v -24.3: 1.8 m off the 45 m pavement; its fairlead 23.8 m off the centreline - the launch takes a
# winch within 25 m of it), facing the SE (its cable side toward the launch point). The day's calm launches go on 31
# (toward the NW, G772's calm departure), so the winch stands at the end of 31's launch line; a launch the other way (a NW
# wind) gets winch_mode's own winch set up at the far end for the launch. `cable`: the launch line - 1 100 m of cable, so
# the glider is lined up at the launch point 1 100 m short of the winch (mid-field), not at the threshold 2.3 km away.
WINCH = {'id': 'afb_winch', 's': -1125.0, 'v': -24.3, 'cable': 1100}
# THE LAUNCH POINT (the club's camp beside the runway where the gliders line up): a frame tent, a table, chairs, a picnic
# bench, on the same side, 45 m off the centreline at the launch line
LAUNCH = [('tent_frame', 0, -46, 90), ('camp_table', 4, -44, 0), ('camp_chair', 5.5, -43, 200), ('camp_chair', 3, -42.6, 160),
          ('picnic_table', -6, -45, 90), ('jerrycan_green', 1.5, -43.5, 30)]


def frame(r):
    """a runway record's frame: (u, v) -> world (x, z), and the direction's yaw"""
    cx, cz = r['c']; h = r['hdg']; ux, uz = math.cos(h), math.sin(h)
    return (lambda u, v: (cx + u * ux - v * uz, cz + u * uz + v * ux)), -h


def R(v, n=2):
    return round(v, n)


def ragged(pts_uv, seed, amp, keep=()):
    """a polygon in (u, v) with its long edges broken every ~35 m by up to `amp` m (no straight lines on the ground);
    the edges whose index is in `keep` stay straight (an edge laid against a strip)"""
    out = []
    k = 0
    for i in range(len(pts_uv)):
        if i in keep:
            out.append(pts_uv[i]); continue
        a, b = pts_uv[i], pts_uv[(i + 1) % len(pts_uv)]
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(L // 35))
        nx, nz = -(b[1] - a[1]) / (L or 1), (b[0] - a[0]) / (L or 1)
        for j in range(n):
            t = j / n
            k += 1
            j1 = (math.sin(k * 12.9898 + seed * 78.233) * 43758.5453) % 1.0
            off = 0 if j == 0 else (j1 - 0.5) * 2 * amp
            out.append((a[0] + (b[0] - a[0]) * t + nx * off, a[1] + (b[1] - a[1]) * t + nz * off))
    return out


def build(rec):
    L = rec['layers']
    rws = L['runways']
    w2 = next(r for r in rws if r['id'] == 'w2')
    home = next(r for r in rws if r['id'] == 'HOME')
    P, yaw0 = frame(w2)
    # -- w2: the central band
    w2['wid'] = W2['wid']; w2['band'] = W2['band']; w2['falloff'] = W2['falloff']
    w2['pav'] = dict(W2['pav']); w2['clear'] = dict(W2['clear'])
    # -- w2r: after w2, before HOME (13/31's grade wins at the crossing, as before)
    rws[:] = [r for r in rws if r['id'] != 'w2r']
    i2 = next(i for i, r in enumerate(rws) if r['id'] == 'w2')
    cx, cz = P(W2R['u'], W2R['v'])
    # its profile: w2's own grade at the same stations, relative to its centre (the two strips one plane across)
    prof = w2.get('profile') or [[0, 0], [1, 0]]
    def w2dh(t):
        for a, b in zip(prof, prof[1:]):
            if a[0] <= t <= b[0]: return a[1] + (b[1] - a[1]) * (t - a[0]) / ((b[0] - a[0]) or 1)
        return prof[-1][1]
    tw = lambda uu: (uu + w2['len'] / 2) / w2['len']
    u0r, u1r = W2R['u'] - W2R['len'] / 2, W2R['u'] + W2R['len'] / 2
    mid = w2dh(tw(W2R['u']))
    profile = [[0, R(w2dh(tw(u0r)) - mid)], [0.5, 0], [1, R(w2dh(tw(u1r)) - mid)]]
    w2r = {'id': W2R['id'], 'name': W2R['name'], 'c': [R(cx), R(cz)], 'hdg': w2['hdg'], 'len': W2R['len'], 'wid': W2R['wid'],
           'surface': W2R['surface'], 'look': W2R['look'], 'band': W2R['band'], 'micro': dict(W2R['micro']), 'pav': dict(W2R['pav']),
           'crossfall': 0, 'disp': [0, 0], 'papi': [False, False], 'falloff': W2R['falloff'], 'site': None, 'pattern': None,
           'profile': profile, 'approach': None, 'clear': dict(W2R['clear'])}
    rws.insert(i2 + 1, w2r)
    # -- the areas
    L['areas'] = [a for a in L['areas'] if not str(a.get('id', '')).startswith('afb_')]
    W = lambda pts: [[R(x), R(z)] for (x, z) in (P(u, v) for (u, v) in pts)]
    g0, g1 = MUD['gap']
    mudP = {'draw': {'look': MUD['look'], 'z': 0, 'band': MUD['band'], 'fade': MUD['fade']}, 'wheels': {'surface': MUD['surface']}}
    # the mud's inner edge straight-ish (1 m off the concrete, the concrete's own side fade does the blend), its outer ragged
    for k, (a, b) in enumerate([(MUD['u0'], g0), (g1, MUD['u1'])]):
        pts = [(a, MUD['v0']), (b, MUD['v0']), (b, MUD['v1'] - 4), (a, MUD['v1'])]
        poly = ragged(pts, 11 + k, 5.0, keep=(0,))   # the inner edge (0) straight along the concrete
        L['areas'].append({'id': 'afb_mud%d' % k, 'name': '02/20 mud side %s' % ('NE' if k == 0 else 'SW'), 'poly': W(poly), 'props': json.loads(json.dumps(mudP))})
    T = TRACK
    L['areas'].append({'id': 'afb_track', 'name': '02/20 track to road r4', 'poly': W([(T['u'] - T['w'] / 2, T['v0']), (T['u'] + T['w'] / 2, T['v0']), (T['u'] + T['w'] / 2 + 1, T['v1']), (T['u'] - T['w'] / 2 - 1, T['v1'])]),
                       'props': {'draw': {'look': 'dirt', 'z': 1, 'band': 2, 'fade': 3}, 'wheels': {'surface': 6}}})
    # the forest taking over (cover polygons: the tree system's fill)
    for k, (V, mix, nm) in enumerate([(VEG_NW, WOOD, '02/20 forest NW'), (VEG_SE, WOOD, '02/20 forest SE')]):
        pts = ragged([(V['u0'], V['v0']), (V['u1'], V['v0']), (V['u1'], V['v1']), (V['u0'], V['v1'])], 31 + k, 7.0)
        L['areas'].append({'id': 'afb_wood%d' % k, 'name': nm, 'poly': W(pts), 'props': {'cover': {'code': None, 'veg': json.loads(json.dumps(mix))}}})
    # the young growth on the SE side where the rough strip is not (both ends), up to the wood
    ua, ub = u0r - 15, u1r + 15
    for k, (a, b) in enumerate([(VEG_SE['u0'], ua), (ub, VEG_SE['u1'])]):
        pts = ragged([(a, SCRUB_SE['v0']), (b, SCRUB_SE['v0']), (b, SCRUB_SE['v1']), (a, SCRUB_SE['v1'])], 41 + k, 3.0, keep=(0,))
        L['areas'].append({'id': 'afb_scrub%d' % k, 'name': '02/20 young growth SE', 'poly': W(pts), 'props': {'cover': {'code': None, 'veg': json.loads(json.dumps(SCRUB))}}})
    # -- the objects
    L['objects'] = [o for o in L['objects'] if not str(o.get('id', '')).startswith('afb_')]
    for i, (key, u, v, yd, s) in enumerate(DEBRIS):
        x, z = P(u, v)
        o = {'id': 'afb_d%02d' % i, 'kind': 'debris', 'key': key, 'x': R(x), 'z': R(z), 'yaw': R(yaw0 + math.radians(yd), 4)}
        if abs(s - 1) > 1e-6: o['s'] = s
        L['objects'].append(o)
    for i, (key, u, v, yd) in enumerate(PROPS):
        x, z = P(u, v)
        o = {'id': 'afb_p%02d' % i, 'kind': 'prop', 'key': key, 'x': R(x), 'z': R(z), 'yaw': R(yaw0 + math.radians(yd), 4), 'dy': 0, 'on': 'ground'}
        if key.startswith('pole_'): o['trunk'] = True   # a pole is a trunk too (26c_wild.js POLES: the wing's beams meet it)
        L['objects'].append(o)
    # -- the winch on 13/31 and its launch point
    Ph, yawH = frame(home)
    x, z = Ph(WINCH['s'], WINCH['v'])
    hx, hz = math.cos(home['hdg']), math.sin(home['hdg'])
    # WINCH_GEN's frame: the cable leaves at -z, so -z faces the launch point (SE, +s): rotation.y = atan2(dx, dz) with
    # (dx, dz) the direction from the glider toward the winch (-s)
    L['objects'].append({'id': WINCH['id'], 'kind': 'winch', 'x': R(x), 'z': R(z), 'yaw': R(math.atan2(-hx, -hz), 4), 'cable': WINCH['cable']})
    sL = WINCH['s'] + WINCH['cable']
    for i, (key, ds, v, yd) in enumerate(LAUNCH):
        x, z = Ph(sL + ds, v)
        L['objects'].append({'id': 'afb_l%02d' % i, 'kind': 'prop', 'key': key, 'x': R(x), 'z': R(z), 'yaw': R(yawH + math.radians(yd), 4), 'dy': 0, 'on': 'ground'})
    return rec


def table(rec):
    L = rec['layers']; w2 = next(r for r in L['runways'] if r['id'] == 'w2')
    print('02/20 frame: c', w2['c'], 'hdg', w2['hdg'], 'len', w2['len'])
    print('  w2  (central concrete)  |v| <= %.1f, the whole length' % (W2['wid'] / 2))
    print('  w2r (rough, firm mud)   v %.1f .. %.1f, u %.0f .. %.0f, micro chaos %.2f' % (W2R['v'] - W2R['wid'] / 2, W2R['v'] + W2R['wid'] / 2, W2R['u'] - W2R['len'] / 2, W2R['u'] + W2R['len'] / 2, W2R['micro']['chaos']))
    print('  mud (soft mud)          v %.1f .. ~%.1f, u %.0f .. %.0f, gap %s for road r4' % (MUD['v0'], MUD['v1'], MUD['u0'], MUD['u1'], MUD['gap']))
    print('  forest NW v %.0f .. %.0f; SE v %.0f .. %.0f; young growth SE v %.0f .. %.0f' % (VEG_NW['v0'], VEG_NW['v1'], VEG_SE['v0'], VEG_SE['v1'], SCRUB_SE['v0'], SCRUB_SE['v1']))
    print('  %d debris, %d props on the mud side; clear band |v| < %.1f' % (len(DEBRIS), len(PROPS), CLEAR_V))
    print('13/31: the winch at s %.0f v %.1f, launch line %d m (launch point s %.0f)' % (WINCH['s'], WINCH['v'], WINCH['cable'], WINCH['s'] + WINCH['cable']))


def dump(rec):
    return json.dumps(rec, indent=1)


# THE SHIP MANIFEST (GATE SCENERYED 15 holds the fixture to the user's AFB(19) save entry by entry): w2's changed fields
# are declared there as a field patch, written from W2 above so the two never drift; the new entries (w2r, afb_*) are
# not in the save and stand as the manifest's 'pending' ones
SHIP = os.path.join(ROOT, 'tools', 'fixtures', 'scenery_ship_afb19.json')
SHIP_WHY = ('AFB-0220 (13 Nov, the user via A0): 02/20 unmaintained and degraded - the central band of the old concrete 45 -> 18 m, '
            'its edges overgrown (the pav knobs mossEdge .. sideA, pavement.js ENTRY_KNOBS), the trees let in to 4 m past it; written by '
            'tools/afb0220_author.py, which also writes w2r (the rough strip 02R/20L), the afb_* areas (the mud side, the forest) and objects '
            '(the debris, the derelicts, the winch on 13/31)')


def ship(man):
    fp = man.setdefault('fieldPatches', {})
    fp['w2'] = {'wid': W2['wid'], 'band': W2['band'], 'falloff': W2['falloff'], 'pav': dict(W2['pav']), 'clear': dict(W2['clear'])}
    man['fieldPatchesWhyAfb0220'] = SHIP_WHY
    return man


def main():
    raw = open(FIX, encoding='utf8').read()
    rec = json.loads(raw)
    if '--print' in sys.argv: table(rec); return 0
    out = dump(build(json.loads(raw)))
    sraw = open(SHIP, encoding='utf8').read()
    sout = json.dumps(ship(json.loads(sraw)), indent=1, ensure_ascii=False) + '\n'   # (the manifest's own form)
    if '--check' in sys.argv:
        ok = out == raw and sout == sraw
        print('afb0220_author --check: ' + ('the fixture and the ship manifest are what this script writes' if ok else 'the fixture or the ship manifest DIFFERS from what this script writes (run it)'))
        return 0 if ok else 1
    with open(FIX, 'w', encoding='utf8', newline='\n') as f: f.write(out)
    with open(SHIP, 'w', encoding='utf8', newline='\n') as f: f.write(sout)
    print('wrote', FIX, len(out), 'bytes'); table(rec)
    return 0


if __name__ == '__main__':
    sys.exit(main())
