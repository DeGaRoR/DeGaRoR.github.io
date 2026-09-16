#!/usr/bin/env python3
"""jolene_author.py - JOLENE AFB, ANNETTE DOCK, THE VILLAGE, THE HILL STRIP AND
THE ROADS, written as the world editor's record (tools/fixtures/island_jolene.json).

    py -3.11 tools/jolene_author.py            # writes the fixture
    py -3.11 tools/jolene_author.py --print    # prints it

HONEST ABOUT THE METHOD (G404's own line): the record is written here, in the
editor's file format, off the satellite views the user handed over and the
island's own rasters (bench/jolene/dem.*: the runways and the taxiway V read
off the radar ORI and the Landsat albedo, the levels off the DEM); the editor
opens and edits it like any premises. Every coordinate is the game frame
(EPSG:3338 minus the field's origin, north = -z; the frame's grid north is
19.3 deg off true, which is why the satellite's 150 deg runway is 131 here).

WHAT IS WRITTEN (contract v1.14, G434):
  runways   w2  Jolene AFB 02/20 (the crossing WWII arm, no lights, no stand)
            HOME Jolene AFB 13/31 - the long one, worn concrete, VASI both ends,
                 the club HANGAR (the garage's shell) on the pad west of the
                 junction, the stand on the apron, the way out up the NE arm of
                 the taxiway V to the centreline
            w3  Tamgas Hill Strip - 520 x 18 m gravel on a 2.3 % rise 2.5 km NW,
                 a PROFILE (the touchdown fifths eased), landed uphill (approach
                 over end 0), a PAPI at the downhill end, a field shed and a hut
            SEA Annette Dock - the sea lane off the dock, 1.5 km NW into the
                 channel (searched on the coast field: water 220 m either side)
  roads     the taxiway V (two paved arms, no ribbon: the concrete polygon is
            the surface), Airport Rd along the SW side of 13/31 to the club,
            the road from 02/20's NE end to the village, the village's streets,
            the track to the hill strip
  surfaces  paved pad / taxiways / turnarounds, gravel shoulders beside both
            runways (the 140 m cleared band of the WWII field)
  materials cracked concrete on the paving, dry ground on the shoulders
  sites     the flying club (VILLAGE_GEN's 'airport s' row less the club
            hangar, which is the garage's shell), the hill strip's field shed
  zones     the village: a harbour zone at the dock, a residential zone on the
            headland
"""
import json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json')

# ---- the DEM, for the levels -------------------------------------------------
J = json.load(open(os.path.join(ROOT, 'bench', 'jolene', 'dem.json')))
W, H, X0, Z0, CELL = J['w'], J['h'], J['x0'], J['z0'], J['cell']
DEM = np.fromfile(os.path.join(ROOT, 'bench', 'jolene', 'dem.f32'), np.float32).reshape(H, W)
def dem(x, z):
    c = (x - X0) / CELL; r = (z - Z0) / CELL; i = int(c); j = int(r); u = c - i; v = r - j
    return float(DEM[j, i] * (1 - u) * (1 - v) + DEM[j, i + 1] * u * (1 - v) + DEM[j + 1, i] * (1 - u) * v + DEM[j + 1, i + 1] * u * v)

R = lambda v, n=2: round(float(v), n)
def pt(x, z): return [R(x), R(z)]

# ---- the runways --------------------------------------------------------------
HOME_C, HOME_HDG, HOME_LEN, HOME_WID = (-301.0, 221.0), 0.7156, 2325.0, 45.0
W2_C, W2_HDG, W2_LEN = (584.0, -94.0), 1.9897, 1835.0
def ends(c, hdg, L):
    d = (math.cos(hdg), math.sin(hdg)); n = (-d[1], d[0])
    return d, n, (c[0] - d[0] * L / 2, c[1] - d[1] * L / 2), (c[0] + d[0] * L / 2, c[1] + d[1] * L / 2)
def box(c, hdg, L, hw, margin=0.0):
    d, n, e0, e1 = ends(c, hdg, L)
    a = (e0[0] - d[0] * margin, e0[1] - d[1] * margin); b = (e1[0] + d[0] * margin, e1[1] + d[1] * margin)
    return [pt(a[0] + n[0] * hw, a[1] + n[1] * hw), pt(b[0] + n[0] * hw, b[1] + n[1] * hw), pt(b[0] - n[0] * hw, b[1] - n[1] * hw), pt(a[0] - n[0] * hw, a[1] - n[1] * hw)]
def side_strips(c, hdg, L, inner, outer, margin=0.0):
    """the cleared band either side of a runway, as two polygons that never cover the strip itself"""
    d, n, e0, e1 = ends(c, hdg, L)
    a = (e0[0] - d[0] * margin, e0[1] - d[1] * margin); b = (e1[0] + d[0] * margin, e1[1] + d[1] * margin)
    out = []
    for s in (1, -1):
        out.append([pt(a[0] + n[0] * s * inner, a[1] + n[1] * s * inner), pt(b[0] + n[0] * s * inner, b[1] + n[1] * s * inner),
                    pt(b[0] + n[0] * s * outer, b[1] + n[1] * s * outer), pt(a[0] + n[0] * s * outer, a[1] + n[1] * s * outer)])
    return out
def fan(c, hdg, L, k, near, far, reach):
    """THE APPROACH FAN past end k: no tree from `near` wide at the threshold to `far` wide `reach` metres out -
    24_world_aero.js keeps the analytic strips' fans clear; a premises strip draws its own (G422)"""
    d, n, e0, e1 = ends(c, hdg, L)
    e = e0 if k == 0 else e1; s = -1 if k == 0 else 1
    a = (e[0] - d[0] * s * 10, e[1] - d[1] * s * 10); b = (e[0] + d[0] * s * reach, e[1] + d[1] * s * reach)
    return [pt(a[0] + n[0] * near, a[1] + n[1] * near), pt(b[0] + n[0] * far, b[1] + n[1] * far), pt(b[0] - n[0] * far, b[1] - n[1] * far), pt(a[0] - n[0] * near, a[1] - n[1] * near)]
def octagon(c, r):
    return [pt(c[0] + r * math.cos(a), c[1] + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)]

# 02/20's profile off the DEM: the strip's own centre is the elevation, the ends relative to it
d2, n2, w2e0, w2e1 = ends(W2_C, W2_HDG, W2_LEN)
w2c = dem(*W2_C)
W2_PROFILE = [[0, R(dem(*w2e0) - w2c, 1)], [0.5, 0.0], [1, R(dem(*w2e1) - w2c, 1)]]

# THE HILL STRIP: the rise 2.5 km NW of the field (searched on the DEM for a 520 m run of 2-4 % with
# under 3 m of deviation from a ramp and no water); the profile eases the touchdown fifths
# (the pilot's limits: 5 % anywhere, 2.5 % in the fifths, 1.5 % change over 30 m)
W3_C, W3_HDG, W3_LEN, W3_WID = (-800.0, -2400.0), math.radians(165.0), 520.0, 18.0
d3, n3, w3e0, w3e1 = ends(W3_C, W3_HDG, W3_LEN)
# ...and the uphill end held at the DEM's own height (the ground crests 5 m higher 90 m past it: an end cut
# 4 m into the hill asked the go-around a 12.8 % climb; at the DEM's height it asks 8)
# eleven knots: 2 % in the touchdown fifths, 3.6 % between, the ramps between the two spread over 60 m so
# the monotone cubic never crests past the 1.5 %-per-30 m rule (five knots did: the cubic overshot 3.3 %
# in the upper fifth)
W3_PROFILE = [[0, -5.5], [0.1, -4.45], [0.2, -3.4], [0.3, -2.01], [0.4, -0.14], [0.5, 1.75], [0.6, 3.64], [0.7, 5.51], [0.8, 6.9], [0.9, 7.95], [1, 9.0]]

# THE SEA LANE: from the dock (the pier at x 900-925, z -3100..-2850) north-west into the channel; the
# search on the coast field asked water 220 m either side of a 1500 m lane and 300 m past its far end
SEA_E0, SEA_HDG, SEA_LEN, SEA_WID = (900.0, -3140.0), math.radians(224.0), 1500.0, 200.0
SEA_C = (SEA_E0[0] + math.cos(SEA_HDG) * SEA_LEN / 2, SEA_E0[1] + math.sin(SEA_HDG) * SEA_LEN / 2)

# ---- THE CLUB: the pad west of the junction (the satellite's circled building) ------------------
# the site's frame: +z the strip side = EAST (the apron and the taxiway V lie east of the row),
# so yaw = pi/2 (local x runs north); VILLAGE_GEN 'airport s' places the row at local x -52..48
CLUB_AT = (-190.0, 690.0); CLUB_YAW = math.pi / 2
def club_world(lx, lz):
    c, s = math.cos(CLUB_YAW), math.sin(CLUB_YAW)
    return (CLUB_AT[0] + lx * c + lz * s, CLUB_AT[1] - lx * s + lz * c)
PAD_LEVEL = R(dem(*CLUB_AT), 1)
# the 'airport s' row, the club hangar's slot (-22, 0) taken by the garage's shell (the runway's `hangar`)
CLUB_ITEMS = [
    {'id': 'hangar_long', 'key': 'hangar/club hangar, long', 'x': 18, 'z': -3, 'yaw': R(math.pi, 4)},
    {'id': 'clubhouse', 'key': 'house/flying club', 'x': 48, 'z': 6, 'yaw': R(math.pi, 4)},
    {'id': 'fuel', 'key': 'big/fuel shed', 'x': -52, 'z': 8, 'yaw': R(math.pi, 4)},
    {'id': 'tools', 'key': 'shed/tool shed', 'x': 40, 'z': -14, 'yaw': 0.4},
]
for it in CLUB_ITEMS: it.update({'P': {}, 'onRoad': False, 'bottomOnRoad': False})
HANGAR_LOCAL = (-22.0, 0.0)
HANGAR_W = club_world(*HANGAR_LOCAL)
CLUB_YARD = {'x0': -60, 'x1': 40, 'z0': 14, 'z1': 54}                       # the apron, in the site's frame
CLUB_FENCES = [{'a': [-72, -32], 'b': [72, -32], 'gap': [60, 84]}, {'a': [72, -32], 'b': [72, 62]}, {'a': [72, 62], 'b': [-72, 62]}, {'a': [-72, 62], 'b': [-72, -32]}]
def club_fences():
    out = []
    for f in CLUB_FENCES:
        a = club_world(*f['a']); b = club_world(*f['b'])
        out.append({'a': pt(*a), 'b': pt(*b), 'gap': f.get('gap'), 'style': 'rail'})
    return out
yard_poly = [pt(*club_world(CLUB_YARD['x0'], CLUB_YARD['z0'])), pt(*club_world(CLUB_YARD['x1'], CLUB_YARD['z0'])), pt(*club_world(CLUB_YARD['x1'], CLUB_YARD['z1'])), pt(*club_world(CLUB_YARD['x0'], CLUB_YARD['z1']))]
pad_poly = [pt(*club_world(-80, -40)), pt(*club_world(80, -40)), pt(*club_world(80, 70)), pt(*club_world(-80, 70))]
# THE STAND on the apron in front of the shell's door (the door faces +z of the site = east), nose toward the
# first taxi point; THE WAY OUT: the NE arm of the taxiway V to 13/31's edge (the pattern projects the last
# point onto the centreline)
STAND = club_world(-22, 36)
TAXI_NE = [(-135.0, 655.0), (-133.0, 590.0), (-120.0, 500.0), (-92.0, 442.0)]
TAXI_E = [(-115.0, 655.0), (0.0, 655.0), (130.0, 672.0), (205.0, 690.0)]
TAXI_W = 24.0

# ---- THE HILL STRIP'S SHED: 'airport xs' beside the downhill end, its +z toward the strip ----------
# ...on the strip's LOWER side (the ground there is within a metre of the strip's own; the uphill side
# stands 5-7 m over it and a shed pad there was a cut terrace with a 14 % taxi)
STRIP_AT = (w3e0[0] + d3[0] * 150 - n3[0] * 75, w3e0[1] + d3[1] * 150 - n3[1] * 75)
STRIP_YAW = math.atan2(n3[0], n3[1])            # +z of the site = (sin yaw, cos yaw) = +n (toward the strip)
def strip_world(lx, lz):
    c, s = math.cos(STRIP_YAW), math.sin(STRIP_YAW)
    return (STRIP_AT[0] + lx * c + lz * s, STRIP_AT[1] - lx * s + lz * c)
STRIP_ITEMS = [
    {'id': 'shed', 'key': 'hangar/field shed', 'x': -12, 'z': 0, 'yaw': R(math.pi, 4)},
    {'id': 'hut', 'key': 'house/pilot hut', 'x': 26, 'z': -4, 'yaw': R(math.pi + 0.2, 4)},
    {'id': 'tools', 'key': 'shed/tool shed', 'x': -28, 'z': -6, 'yaw': -0.3},
]
for it in STRIP_ITEMS: it.update({'P': {}, 'onRoad': False, 'bottomOnRoad': False})
STRIP_YARD = {'x0': -26, 'x1': 24, 'z0': 10, 'z1': 34}
strip_yard_poly = [pt(*strip_world(STRIP_YARD['x0'], STRIP_YARD['z0'])), pt(*strip_world(STRIP_YARD['x1'], STRIP_YARD['z0'])), pt(*strip_world(STRIP_YARD['x1'], STRIP_YARD['z1'])), pt(*strip_world(STRIP_YARD['x0'], STRIP_YARD['z1']))]
strip_pad_poly = [pt(*strip_world(-44, -22)), pt(*strip_world(44, -22)), pt(*strip_world(44, 44)), pt(*strip_world(-44, 44))]
STRIP_STAND = strip_world(0, 26)
STRIP_TAXI = [strip_world(0, 40), (w3e0[0] + d3[0] * 150, w3e0[1] + d3[1] * 150)]
# the shed's pad between the ground and the strip's profile abeam it (the strip runs 4 m below the site's
# natural ground; the taxi road below grades between at 4 % at most)
strip_pad_level = R(dem(*W3_C) + W3_PROFILE[2][1] + (W3_PROFILE[3][1] - W3_PROFILE[2][1]) * (150 / W3_LEN - 0.2) / 0.1 + 0.4, 1)

# ---- THE ROADS (traced off the satellite views and the albedo) ---------------------------------------
ROADS = [
    # the taxiway V: paved, wide, no ribbon (the cracked-concrete polygon is the surface), a gentle bank
    {'id': 'r_taxi_ne', 'pts': [pt(*p) for p in TAXI_NE], 'w': TAXI_W, 'cls': 'paved', 'graded': True, 'falloff': 14, 'ribbon': False, 'grade': 0.025},
    {'id': 'r_taxi_e', 'pts': [pt(*p) for p in TAXI_E], 'w': TAXI_W, 'cls': 'paved', 'graded': True, 'falloff': 14, 'ribbon': False, 'grade': 0.025},
    # Airport Rd: along the SW side of 13/31, 150 m off it, from the north down to the club's gate
    {'id': 'r_airport', 'pts': [pt(-1330, -1300), pt(-1300, -820), pt(-1283, -767), pt(-980, -440), pt(-620, -40), pt(-380, 220), pt(-215, 470), pt(-250, 600), pt(-262, 690)], 'w': 6, 'cls': 'gravel', 'graded': True, 'falloff': 8, 'traffic': 1},
    # the road from 02/20's NE end north to the village (the straight line on the albedo)
    {'id': 'r_village', 'pts': [pt(940, -950), pt(760, -1150), pt(675, -1300), pt(610, -1800), pt(600, -2000), pt(470, -2200), pt(440, -2400), pt(430, -2500), pt(480, -2560), pt(600, -2590), pt(700, -2690), pt(800, -2780), pt(850, -2815)], 'w': 6, 'cls': 'gravel', 'graded': True, 'falloff': 8, 'traffic': 1},
    # the village's streets
    {'id': 'v_shore_e', 'pts': [pt(600, -2590), pt(840, -2610), pt(1040, -2670), pt(1280, -2710), pt(1380, -2650)], 'w': 5, 'cls': 'gravel', 'graded': True, 'falloff': 6},
    {'id': 'v_west', 'pts': [pt(430, -2500), pt(300, -2570), pt(250, -2760)], 'w': 5, 'cls': 'gravel', 'graded': True, 'falloff': 6},
    # the harbour street: 30-40 m inland of the waterline (the sower's water side wants the water between the
    # riparian 28 m and the plot's 44 m depth from the road)
    # (the GAME's waterline, walked on the composed ground - the DEM's 0 line sits 40 m out on the shelf)
    {'id': 'v_north', 'pts': [pt(850, -2815), pt(900, -2790), pt(960, -2764), pt(1040, -2797), pt(1120, -2805), pt(1200, -2770), pt(1280, -2714)], 'w': 4, 'cls': 'gravel', 'graded': True, 'falloff': 6},
    # the track from Airport Rd's north end to the hill strip's shed
    {'id': 'r_strip', 'pts': [pt(-1330, -1300), pt(-1150, -1800), pt(-900, -2200), pt(-720, -2380), pt(*strip_world(-40, 44))], 'w': 4, 'cls': 'track', 'graded': True, 'falloff': 6},
    # the hill strip's own taxi: the yard to the strip's edge, gravel, graded to 4 % at most
    {'id': 'r_strip_taxi', 'pts': [pt(*strip_world(0, 34)), pt(*strip_world(0, 52)), pt(w3e0[0] + d3[0] * 150 + n3[0] * 10, w3e0[1] + d3[1] * 150 + n3[1] * 10)], 'w': 8, 'cls': 'gravel', 'graded': True, 'falloff': 8, 'grade': 0.04},
]

def main():
    rec = {
        'v': 1, 'id': 'jolene-field', 'name': 'Jolene AFB', 'seed': 7, 'theme': 'alaska',
        'frame': {'kind': 'free', 'extent': {'x0': -1700, 'z0': -4300, 'x1': 2600, 'z1': 1400}, 'anchors': {'*': {'x': 0, 'z': 0, 'yaw': 0}}},
        'layers': {
            'terrain': [
                {'id': 't_pad', 'kind': 'flatten', 'poly': pad_poly, 'level': PAD_LEVEL, 'falloff': 30, 'abs': True, 'order': 0},
                {'id': 't_strip_pad', 'kind': 'flatten', 'poly': strip_pad_poly, 'level': strip_pad_level, 'falloff': 14, 'abs': True, 'order': 1},
            ],
            'surface': [
                # what the wheels feel: the club's apron, the pad, the taxiways, the turnarounds
                {'id': 'y_pad', 'poly': pad_poly, 'surface': 5, 'apron': True},
                {'id': 'y_taxi_ne', 'poly': road_poly(TAXI_NE, TAXI_W), 'surface': 5},
                {'id': 'y_taxi_e', 'poly': road_poly(TAXI_E, TAXI_W), 'surface': 5},
                {'id': 'y_turn_nw', 'poly': octagon(past_end(HOME_C, HOME_HDG, HOME_LEN, 0, 45), 55), 'surface': 5},
                {'id': 'y_turn_se', 'poly': octagon(past_end(HOME_C, HOME_HDG, HOME_LEN, 1, 45), 55), 'surface': 5},
                {'id': 'y_turn_ne', 'poly': octagon(past_end(W2_C, W2_HDG, W2_LEN, 0, 45), 55), 'surface': 5},
                {'id': 'y_strip_yard', 'poly': strip_yard_poly, 'surface': 6},
            ] + [{'id': 'y_sh13_' + str(k), 'poly': p, 'surface': 6} for k, p in enumerate(side_strips(HOME_C, HOME_HDG, HOME_LEN, 24, 70, 40))]
              + [{'id': 'y_sh02_' + str(k), 'poly': p, 'surface': 6} for k, p in enumerate(side_strips(W2_C, W2_HDG, W2_LEN, 24, 70, 40))],
            'material': [
                {'id': 'm_sh13', 'poly': box(HOME_C, HOME_HDG, HOME_LEN, 70, 40), 'set': 'dry', 'tile': None, 'fade': 30, 'z': 0},
                {'id': 'm_sh02', 'poly': box(W2_C, W2_HDG, W2_LEN, 70, 40), 'set': 'dry', 'tile': None, 'fade': 30, 'z': 0},
                {'id': 'm_pad', 'poly': pad_poly, 'set': 'cracked', 'tile': None, 'fade': 4, 'z': 1},
                {'id': 'm_taxi_ne', 'poly': road_poly(TAXI_NE, TAXI_W), 'set': 'cracked', 'tile': None, 'fade': 3, 'z': 1},
                {'id': 'm_taxi_e', 'poly': road_poly(TAXI_E, TAXI_W), 'set': 'cracked', 'tile': None, 'fade': 3, 'z': 1},
                {'id': 'm_turn_nw', 'poly': octagon(past_end(HOME_C, HOME_HDG, HOME_LEN, 0, 45), 55), 'set': 'cracked', 'tile': None, 'fade': 4, 'z': 1},
                {'id': 'm_turn_se', 'poly': octagon(past_end(HOME_C, HOME_HDG, HOME_LEN, 1, 45), 55), 'set': 'cracked', 'tile': None, 'fade': 4, 'z': 1},
                {'id': 'm_turn_ne', 'poly': octagon(past_end(W2_C, W2_HDG, W2_LEN, 0, 45), 55), 'set': 'cracked', 'tile': None, 'fade': 4, 'z': 1},
                {'id': 'm_strip_yard', 'poly': strip_yard_poly, 'set': 'pebble', 'tile': None, 'fade': 4, 'z': 1},
            ],
            'exclude': [
                # the approach fans: 60 m wide at the bar, 320 m wide 450 m out (a 20 m tree at 25 m off a
                # threshold asked A3 a 38 deg approach, G422)
                {'id': 'x_fan13_0', 'poly': fan(HOME_C, HOME_HDG, HOME_LEN, 0, 60, 160, 450), 'what': ['trees']},
                {'id': 'x_fan13_1', 'poly': fan(HOME_C, HOME_HDG, HOME_LEN, 1, 60, 160, 450), 'what': ['trees']},
                {'id': 'x_fan02_0', 'poly': fan(W2_C, W2_HDG, W2_LEN, 0, 60, 160, 450), 'what': ['trees']},
                {'id': 'x_fan02_1', 'poly': fan(W2_C, W2_HDG, W2_LEN, 1, 60, 160, 450), 'what': ['trees']},
                {'id': 'x_fan3_0', 'poly': fan(W3_C, W3_HDG, W3_LEN, 0, 40, 140, 400), 'what': ['trees']},
                {'id': 'x_fan3_1', 'poly': fan(W3_C, W3_HDG, W3_LEN, 1, 40, 140, 400), 'what': ['trees']},
                {'id': 'x_club', 'poly': [pt(*club_world(-90, -50)), pt(*club_world(90, -50)), pt(*club_world(90, 80)), pt(*club_world(-90, 80))], 'what': ['trees', 'rocks', 'settle']},
                {'id': 'x_strip', 'poly': strip_pad_poly, 'what': ['trees', 'rocks', 'settle']},
            ],
            'roads': ROADS,
            'runways': [
                # 02/20 FIRST: two strips cross at the junction and the later grade wins there - 13/31, the one
                # flown, keeps its own profile through the crossing
                {'id': 'w2', 'name': 'Jolene AFB 02/20', 'c': pt(*W2_C), 'hdg': W2_HDG, 'len': W2_LEN, 'wid': HOME_WID, 'surface': 5, 'look': 'worn', 'crossfall': 0,
                 'disp': [0, 0], 'papi': [False, False], 'falloff': 60, 'site': None, 'pattern': None, 'profile': W2_PROFILE, 'approach': None},
                {'id': 'HOME', 'name': 'Jolene AFB 13/31', 'c': pt(*HOME_C), 'hdg': HOME_HDG, 'len': HOME_LEN, 'wid': HOME_WID, 'surface': 5, 'look': 'worn', 'crossfall': 0,
                 'disp': [0, 0], 'papi': ['vasi', 'vasi'], 'falloff': 60, 'site': None, 'pattern': None, 'profile': [[0, 5.2], [0.5, 0.0], [1, -5.1]], 'approach': None,
                 'stand': {'x': R(STAND[0]), 'z': R(STAND[1]), 'hdg': None}, 'taxiOut': [pt(*p) for p in TAXI_NE],
                 'hangar': {'x': R(HANGAR_W[0]), 'z': R(HANGAR_W[1]), 'hdg': 0.0}},
                {'id': 'w3', 'name': 'Tamgas Hill Strip', 'c': pt(*W3_C), 'hdg': R(W3_HDG, 4), 'len': W3_LEN, 'wid': W3_WID, 'surface': 6, 'look': 'gravel', 'crossfall': 0,
                 'disp': [0, 0], 'papi': [True, False], 'falloff': None, 'site': None, 'pattern': None, 'profile': W3_PROFILE, 'approach': 0,
                 'stand': {'x': R(STRIP_STAND[0]), 'z': R(STRIP_STAND[1]), 'hdg': None}, 'taxiOut': [pt(*p) for p in STRIP_TAXI]},
                {'id': 'SEA', 'name': 'Annette Dock', 'c': pt(*SEA_C), 'hdg': R(SEA_HDG, 4), 'len': SEA_LEN, 'wid': SEA_WID, 'surface': 4, 'look': 'none', 'crossfall': 0,
                 'disp': [0, 0], 'papi': [False, False], 'falloff': None, 'site': None, 'pattern': None, 'profile': None, 'approach': None},
            ],
            'zones': [
                {'id': 'z_harbour', 'kind': 'harbour', 'poly': [pt(700, -2960), pt(1000, -2960), pt(1350, -2850), pt(1350, -2680), pt(760, -2740)], 'density': 1},
                {'id': 'z_village', 'kind': 'residential', 'poly': [pt(200, -2900), pt(700, -2960), pt(1000, -2900), pt(1450, -2800), pt(1450, -2550), pt(1100, -2450), pt(600, -2400), pt(350, -2450)], 'density': 1},
            ],
            'sites': [
                {'id': 's_club', 'name': 'Jolene AFB flying club', 'at': {'x': CLUB_AT[0], 'z': CLUB_AT[1], 'yaw': R(CLUB_YAW, 4)}, 'yard': CLUB_YARD, 'items': CLUB_ITEMS, 'fences': club_fences()},
                {'id': 's_strip', 'name': 'Tamgas Hill', 'at': {'x': R(STRIP_AT[0]), 'z': R(STRIP_AT[1]), 'yaw': R(STRIP_YAW, 4)}, 'yard': STRIP_YARD, 'items': STRIP_ITEMS},
            ],
            'links': [],
            'objects': [
                # the parked aeroplanes on the club's apron (GATE PARKED rule 7 reads them)
                {'id': 'o1', 'kind': 'aircraft', 'key': 'arch:cub', 'x': R(club_world(20, 40)[0]), 'z': R(club_world(20, 40)[1]), 'yaw': R(-math.pi / 2, 4)},
                {'id': 'o2', 'kind': 'aircraft', 'key': 'arch:c172', 'x': R(club_world(36, 42)[0]), 'z': R(club_world(36, 42)[1]), 'yaw': R(-math.pi / 2 + 0.2, 4)},
                {'id': 'o3', 'kind': 'aircraft', 'key': 'arch:jodel', 'x': R(club_world(-48, 44)[0]), 'z': R(club_world(-48, 44)[1]), 'yaw': R(math.pi / 2 - 0.3, 4)},
            ],
        },
        'budget': {'tris': 400000, 'lights': 24, 'smoke': 6, 'people': 40},
        'rev': 4,
    }
    txt = json.dumps(rec, indent=1)
    if '--print' in sys.argv: print(txt); return
    with open(OUT, 'w', newline='\n') as f: f.write(txt + '\n')
    print('wrote', OUT, len(txt), 'bytes')

def road_poly(pts, w):
    """a polygon round a polyline, half the width either side (mitred at the corners by the average normal)"""
    P = [np.array(p, float) for p in pts]
    n = []
    for i in range(len(P)):
        a = P[max(0, i - 1)]; b = P[min(len(P) - 1, i + 1)]
        t = b - a; t = t / max(1e-9, np.linalg.norm(t)); n.append(np.array([-t[1], t[0]]))
    left = [pt(*(P[i] + n[i] * w / 2)) for i in range(len(P))]
    right = [pt(*(P[i] - n[i] * w / 2)) for i in range(len(P))]
    return left + right[::-1]

def past_end(c, hdg, L, k, off):
    d, n, e0, e1 = ends(c, hdg, L)
    e = e0 if k == 0 else e1; s = -1 if k == 0 else 1
    return (e[0] + d[0] * s * off, e[1] + d[1] * s * off)

if __name__ == '__main__': main()
