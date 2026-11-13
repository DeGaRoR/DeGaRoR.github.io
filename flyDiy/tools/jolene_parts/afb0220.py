# ---------------------------------------------------------------------------
# JOLENE AFB 02/20 - THE DERELICT CROSSWIND STRIP (AFB-0220, 13 Nov 2026; the user via A0):
#   "an UNMAINTAINED, DEGRADED strip divided into several runways": a NARROW CENTRAL BAND where the old concrete
#   still shows (a clean but narrow landing: the Aero Club's spot landing and the plane-vs-car drag race need it
#   straight), one SIDE very BUMPY but carefully landable (STOL practice), the OTHER SIDE a CRASH PLAYGROUND
#   ("plenty of exotic stuff to crash into"), further out the FOREST TAKING OVER; "should look GOOD and NATURALLY
#   OVERGROWN", a GRADUAL surface change - dirt over the sides AND the middle concrete, soft blends, broken edges,
#   cracks with weeds and moss, patches, no hard lines. Reference: futureDesigns/refs/AFB-0220-real-runway-satellite.webp
#   (the real strip today; this is it a few years on).
#
# A PART of tools/fixtures/island_jolene.json (jolene_author.py merge_parts; tools/afb0220_splice.py splices it into
# the shipped fixture in place, ED-2's way, and patches w2 through scenery_ship_afb19.json fieldPatches). Every entry is
# ordinary editor data: open WORLD on the flight rail, click it, move it.
#
# THE FRAME: the strip's own. u along 02/20 from its NE end (end 0, the turnaround) toward 13/31 (end 1, u = 1757.8);
# v across, + toward the WEST (runwayEnds' n = (-sin hdg, cos hdg); the micro field's +v). The real pond at (241, 599)
# reads u 1690, v +29 - the playground is the west side, the pond's side; the bumpy lane the east.
#
# THE LAYOUT (v, metres):
#   east forest    v < -48               tree-system vegetation (areas, `cover.veg`), denser outward
#   east scrub     -48 .. -27            young spruce / saplings / shrubs; two dirt side tracks to clearings
#   ROUGH LANE     -26.25 .. -8.25       xw_rough, 18 m FIRM MUD, micro chaos 0.55 (u 330 .. 1330) - Pilot-vetted
#   gap            -8.25 .. -7.5         0.75 m of graded ground (two strips' boxes must not overlap: issues())
#   CENTRAL BAND   -7.5 .. +7.5          w2 itself, 15 m of the old concrete (fieldPatch: wid 45 -> 15, falloff 60 -> 8),
#                                        crumbled to dirt but a CLEAN CORE 3-5 m down the middle (the user's choice, 13 Nov)
#   playground     +7.5 .. ~55           a soft-mud floor, heaved slabs, wrecks, the blowdown, the pond
#   west scrub     42 .. 58              (overlapping the playground's outer edge: the fence line stands in it)
#   west forest    58 .. 100
# Nothing over 0.5 m tall stands inside |v| < 18 (a DC-3's half span 14.5 m off the band's edge, 3.5 m to spare); the
# fallen trees (about 1 m) keep v >= 13; nothing at all past the strip's ends but the turnaround's saplings, 28 m+ off
# the extended centreline (the approach is the user's: no fan on 02/20 since rev 28).
# ---------------------------------------------------------------------------
import math

PREFIX = 'xw_'

HDG = 1.9908
D = (math.cos(HDG), math.sin(HDG))           # along, end 0 -> end 1
W = (-D[1], D[0])                            # across, + west
LEN = 1757.8
C = (598.7, -129.73)
END0 = (C[0] - D[0] * LEN / 2, C[1] - D[1] * LEN / 2)
YAW_RW = math.atan2(D[0], D[1])              # a prop's local +z along the strip (rotation.y = atan2(dx, dz))

BAND_W = 15.0                                # the central concrete
LANE_W, LANE_GAP = 18.0, 0.75
LANE_V = -(BAND_W / 2 + LANE_GAP + LANE_W / 2)
LANE_U0, LANE_U1 = 330.0, 1330.0


def P(u, v):
    return (round(END0[0] + D[0] * u + W[0] * v, 2), round(END0[1] + D[1] * u + W[1] * v, 2))


def h01(i, s):
    """a deterministic hash in [0, 1)"""
    x = math.sin(i * 12.9898 + s * 78.233) * 43758.5453
    return x - math.floor(x)


def wob(t, s, amp, waves=(1.0, 2.3, 5.1)):
    """a smooth deterministic wobble in [-amp, amp]: three sines of seeded phase"""
    a = sum(math.sin(t * w * 2 * math.pi + h01(k, s) * 6.283) / (k + 1) for k, w in enumerate(waves))
    return amp * a / sum(1.0 / (k + 1) for k in range(len(waves)))


def band_poly(u0, u1, vin, vout, step=12.0):
    """a polygon between two wobbling edges v = vin(u) .. vout(u), u from u0 to u1 (simple: vin < vout everywhere)"""
    n = max(2, int(math.ceil((u1 - u0) / step)))
    us = [u0 + (u1 - u0) * k / n for k in range(n + 1)]
    pts = [P(u, vin(u)) for u in us] + [P(u, vout(u)) for u in reversed(us)]
    return [list(p) for p in pts]


def blob(u, v, ru, rv, s, n=14, rough=0.28, rot=0.0):
    """an irregular closed blob round (u, v): radii ru (along) x rv (across), the outline pushed in and out by a
    seeded noise (star-shaped about its centre, so always simple)"""
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        r = 1.0 + rough * (wob(k / n, s, 1.0, (1.0, 3.0)) * 0.7 + (h01(k, s + 7) - 0.5) * 0.6)
        du, dv = math.cos(a) * ru * r, math.sin(a) * rv * r
        du, dv = du * math.cos(rot) - dv * math.sin(rot), du * math.sin(rot) + dv * math.cos(rot)
        pts.append(list(P(u + du, v + dv)))
    return pts


def rect(u, v, lu, lv, rot=0.0):
    """a rectangle lu (along) x lv (across) round (u, v), turned `rot` off the strip's grid"""
    c, s = math.cos(rot), math.sin(rot)
    out = []
    for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        du, dv = a * lu / 2, b * lv / 2
        out.append(list(P(u + du * c - dv * s, v + du * s + dv * c)))
    return out


def area(i, poly, **props):
    return {'id': PREFIX + 'a_' + i, 'poly': poly, 'props': props}


def prop(i, key, u, v, yaw=0.0, dy=None):
    x, z = P(u, v)
    e = {'id': PREFIX + 'o_' + i, 'kind': 'prop', 'key': key, 'x': x, 'z': z, 'yaw': round(YAW_RW + yaw, 3), 'on': 'ground'}
    if dy is not None: e['dy'] = dy
    return e


def tree(i, key, u, v, yaw=0.0, size=1.0):
    x, z = P(u, v)
    e = {'id': PREFIX + 't_' + i, 'kind': 'tree', 'key': key, 'x': x, 'z': z, 'yaw': round(YAW_RW + yaw, 3)}
    if abs(size - 1) > 1e-3: e['size'] = round(size, 3)
    return e


# ---- the tree pack's subjects (src/viewer/trees_pack.js; collection|subject) ---------------------------------------
FALLEN = {   # whole fallen trees with their branches: 21-27 m long and 2.8-5.5 m high in the pack, placed at 0.5-0.6 (13-14 m)
    'a': 'lowpoly_sticks.glb|stick_04', 'b': 'lowpoly_sticks.glb|stick_05', 'c': 'lowpoly_sticks.glb|stick_06',
    'd': 'lowpoly_sticks.glb|stick_11', 'e': 'lowpoly_sticks.glb|stick_03'}
TRUNK = 'dead_tree_trunk_02.glb|dead_tree_trunk_02'           # a bare 4 m trunk (sized up)
STUMP = 'tree_stump_01.glb|tree_stump_01'
LODGE = 'lowpoly_sticks.glb|stick_07'                          # the big branch heap: the beavers' lodge
SNAG_C = 'dead_conifer|Coniferous Dead Tree 2_14'              # standing dead spruce, 9.8 m
SNAG_D = 'dead_deciduous|DeciduousDead2_28'                    # standing dead alder-ish, 13.5 m
ROCK = {'grp': 'coast_rocks_05|coast_rocks_05', 'small': 'sand_rocks_small_01|sand_rocks_small_01', 'long': 'coast_land_rocks_03|coast_land_rocks_03'}
YOUNG = {'spruce': 'realistic_fir_trees_pack_lods_gameready.glb|Christmas tree_2', 'pine': 'pine_evolveduk.glb|Tree_0',
         'sap': 'sapling_deciduous|DeciduousSapling_32', 'sap2': 'sapling_deciduous|DeciduousSapling2_33'}

# ---- the vegetation mixes (the tree system's own planting: an area's `cover.veg`, mode 'new') ----------------------
DEBRIS_FLOOR = {   # the forest floor's litter, as a16 (the user's own wood) plants it - drawn by the cover ring
    'lowpoly_sticks.glb': {'proportion': 0.3, 'tilt': 1, 'bury': 0.2, 'cluster': 1, 'hollow': 0.55, 'tint': 0.3, 'dim': 0.72},
    'tree_stump_01.glb': {'proportion': 0.08, 'tilt': 0.5, 'bury': 0.2, 'tint': 0.3, 'dim': 0.95},
    'dead_tree_trunk_02.glb': {'proportion': 0.06, 'tilt': 1, 'bury': 0.2, 'cluster': 1, 'hollow': 0.5, 'tint': 0.3, 'dim': 0.9},
}
SCRUB = {'mode': 'new', 'density': 45, 'under': 4, 'cover': 1, 'species': dict({
    'sapling_deciduous': {'proportion': 1.0}, 'shrub_deciduous': {'proportion': 1.0},
    'realistic_fir_trees_pack_lods_gameready.glb': {'proportion': 0.7, 'size': 0.6},
    'pine_evolveduk.glb': {'proportion': 0.35}, 'dead_conifer': {'proportion': 0.05},
    'grass_reed': {'proportion': 0.4, 'density': 0.5, 'patch': 0, 'size': 0.75},
    'flower_fireweed': {'proportion': 1, 'density': 0.5, 'patch': 6}}, **DEBRIS_FLOOR)}
WOOD = {'mode': 'new', 'density': 190, 'under': 3, 'cover': 1, 'species': dict({
    'spruce_tree.glb': {'proportion': 1.0, 'dead': 0.06}, 'cedar_tree.glb': {'proportion': 0.45, 'dead': 0.04},
    'realistic_fir_trees_pack_lods_gameready.glb': {'proportion': 0.7}, 'pine_lampi.glb': {'proportion': 0.25},
    'dead_conifer': {'proportion': 0.1}, 'birch': {'proportion': 0.15}, 'shrub_deciduous': {'proportion': 0.6},
    'sapling_deciduous': {'proportion': 0.5}, 'flower_bunchberry': {'proportion': 1, 'density': 0.5, 'patch': 5}}, **DEBRIS_FLOOR)}

AREAS, OBJ = [], []

# ---- 1. THE GROUND: the old band crumbled into dirt, a clean concrete core, mud on the sides --------------------------
# THE USER (13 Nov ~19:00 via A0, choosing this variant): "the CLEAN concrete part narrower: between 3 and 5 metres, so you
# can put the wheels, not much more. The rest of the old band crumbles into dirt/moss with the gradual transitions", and MUD
# from SNOW-MUD (claude/snow-mud-surfaces: looks 'mud' firm / 'softmud' soft) on the sides.
# HOW: w2 stays the 15 m strip of old concrete (its record, its aerodrome, its contracts and gear rules unchanged) and is
# dressed in three layers over it:
#   CRUMBLE  one dirt polygon over the whole old band (|v| <= ~9, its outer edge wandering out over the sides' mud): a soft
#            look, its torn edge ~8 m (PAVE_SIDE_SOFT) - the band's own straight edge never shows
#   CORE     the clean concrete on top, a 'worn' polygon down the centreline whose half width wanders 1.5..2.5 m (3-5 m across,
#            GATE AFB0220 holds it): a paved polygon's edge is the crisp chipped one (edgeChip), so the core keeps its width
#            where a soft edge's noise would close it - the wheels' strip
#   REMNANTS broken slabs of the old concrete showing through the dirt either side of the core (small 'worn' polygons, off
#            the grid): the band does not end at the core's edge, it breaks up toward the sides
# The paved polygons feel PAVED and the crumble GRAVEL (a look's surface, its z over the strip's): the wheels feel the core
CORE_HW = lambda u: 2.0 + wob(u / 260, 120, 0.5)          # 1.5 .. 2.5 m: the core 3..5 m across
AREAS.append(area('crumble', band_poly(2, LEN - 60, lambda u: -9.0 + wob(u / 170, 121, 1.5), lambda u: 9.0 + wob(u / 190, 122, 1.5), step=10),
                  draw={'look': 'dirt', 'band': 0.5, 'z': 2}))
AREAS.append(area('core', band_poly(0, LEN - 40, lambda u: -CORE_HW(u), lambda u: CORE_HW(u), step=8),
                  draw={'look': 'worn', 'band': 0, 'z': 3, 'yaw': HDG}))
for k in range(26):
    u = 40 + k * 63 + h01(k, 130) * 40
    if u > LEN - 70: break
    side = 1 if h01(k, 131) < 0.5 else -1
    v = side * (3.4 + 3.6 * h01(k, 132))                    # either side of the core, inside the old band
    lu, lv = 2.5 + 5.0 * h01(k, 133), 1.8 + 2.4 * h01(k, 134)
    AREAS.append(area('remnant%d' % k, rect(u, v, lu, lv, (h01(k, 135) - 0.5) * 0.5), draw={'look': 'worn', 'band': 0, 'z': 3, 'yaw': round(HDG + (h01(k, 135) - 0.5) * 0.5, 4)}))
# THE SIDES, MUD: the west playground's floor soft mud (the wheels go in: a crash playground's ground) from the old band's edge
# out to 18-30 m; the east verges where the lane is not firm mud
AREAS.append(area('west_mud', band_poly(70, 1665, lambda u: 7.0 + wob(u / 400, 3, 1.5), lambda u: 23.0 + wob(u / 260, 4, 7.0)),
                  draw={'look': 'softmud', 'band': 1, 'z': 1}))
AREAS.append(area('east_verge_n', band_poly(40, LANE_U0 + 20, lambda u: -21.0 + wob(u / 120, 8, 4.0), lambda u: -7.0 + wob(u / 90, 9, 1.0)),
                  draw={'look': 'mud', 'band': 1, 'z': 1}))
AREAS.append(area('east_verge_s', band_poly(LANE_U1 - 20, 1660, lambda u: -22.0 + wob(u / 130, 10, 4.0), lambda u: -7.0 + wob(u / 95, 11, 1.0)),
                  draw={'look': 'mud', 'band': 1, 'z': 1}))

# ---- 2. THE HEAVED SLABS: frost has lifted the old concrete in blocks (u 330-430, v 14-34) --------------------------
# Each a `raise` of 0.25-0.55 m with a 0.4 m feather - a step in the ground itself, which the wheels and the gear's
# damage meet as they meet any ground - wearing the cracked concrete, turned off the strip's grid as the frost left it.
for k, (u, v, lu, lv, dh, rot) in enumerate([(338, 16, 6.0, 5.0, 0.30, 0.10), (346, 23, 5.5, 5.0, 0.45, -0.18), (358, 17, 6.0, 4.5, 0.25, 0.22),
                                             (371, 30, 5.0, 5.5, 0.55, 0.30), (384, 21, 6.0, 5.0, 0.35, -0.08), (397, 27, 5.5, 4.5, 0.50, 0.15),
                                             (412, 18, 6.0, 5.0, 0.28, -0.25), (424, 32, 5.0, 5.0, 0.40, 0.05)]):
    AREAS.append(area('slab%d' % k, rect(u, v, lu, lv, rot), terraform={'kind': 'raise', 'dh': dh, 'falloff': 0.4, 'abs': False, 'order': 0},
                      draw={'look': 'worn', 'band': 0, 'z': 3, 'yaw': round(HDG + rot, 4)}))

# ---- 3. THE SIDE TRACKS (the satellite view's): dirt paths off the strip into the scrub, a clearing at each end -----
for k, (u, rc) in enumerate([(640, 11.0), (1120, 9.0)]):
    left = [list(P(u - 1.7 + wob(t / 6, 40 + k, 1.2), -27.0 - 51.0 * t / 6)) for t in range(7)]
    right = [list(P(u + 1.7 + wob(t / 6, 40 + k, 1.2), -27.0 - 51.0 * t / 6)) for t in reversed(range(7))]
    AREAS.append(area('track%d' % k, left + right, draw={'look': 'dirt', 'band': 0.5, 'z': 1}, exclude={'what': ['trees']}))
    AREAS.append(area('clearing%d' % k, blob(u, -78.0 - rc * 0.8, rc, rc, 50 + k, n=14, rough=0.3), draw={'look': 'dirt', 'band': 1, 'z': 1}, exclude={'what': ['trees']}))

# ---- 4. THE FOREST TAKING OVER: the tree system's planting, scrub first, then the wood ------------------------------
# (from u 90: w2's own tie-down rings round its NE end stay clear of it - fleet_spots.js --cook)
AREAS.append(area('east_scrub', band_poly(90, 1660, lambda u: -48.0 + wob(u / 300, 60, 5.0), lambda u: (-27.5 if LANE_U0 - 10 < u < LANE_U1 + 10 else -15.0) + wob(u / 150, 61, 1.5), step=20),
                  cover={'code': None, 'veg': SCRUB}))
AREAS.append(area('east_wood', band_poly(90, 1660, lambda u: -95.0 + wob(u / 280, 62, 6.0), lambda u: -48.0 + wob(u / 300, 60, 5.0), step=20),
                  cover={'code': None, 'veg': WOOD}))
AREAS.append(area('west_scrub', band_poly(90, 1640, lambda u: 42.0 + wob(u / 260, 63, 5.0), lambda u: 58.0 + wob(u / 320, 64, 5.0), step=20),
                  cover={'code': None, 'veg': SCRUB}))
AREAS.append(area('west_wood', band_poly(90, 1640, lambda u: 58.0 + wob(u / 320, 64, 5.0), lambda u: 100.0 + wob(u / 280, 65, 6.0), step=20),
                  cover={'code': None, 'veg': WOOD}))

# ---- 5. THE CRASH PLAYGROUND, NE to SW (the west side) --------------------------------------------------------------
# (a) THE BONEYARD (u ~190): the stripped F-104G (the scenery kit's photoscan) dragged off the strip nose-first into the
#     scrub by whoever stripped it, its tyres heaped, the drums it was drained into
OBJ += [prop('boneyard_jet', 'starfighter', 196, 31, 0.95),
        prop('boneyard_tyre1', 'tyre', 177.5, 21.0, 0.0), prop('boneyard_tyre2', 'tyre', 177.5, 21.0, 0.6, dy=0.21),
        prop('boneyard_tyre3', 'tyre', 177.6, 21.1, 1.4, dy=0.42),
        prop('boneyard_drum1', 'drum_steel', 208.0, 22.5, 0.2), prop('boneyard_drum2', 'drum_steel', 208.7, 23.2, 1.1)]
# (b) THE PLOUGH (u ~375): the field's snow loader, its blade still down, left where it died among the heaved slabs
OBJ += [prop('plough', 'loader_wreck', 374, 39, 1.35)]
# (c) THE FUEL DUMP (u ~560): the bowser is a cabover flatbed by its drums (no bowser asset: the flatbed + the drums it
#     carried), a rusted bin, pallets rotting under them
OBJ += [prop('fuel_flatbed', 'auto_flatbed_cabover', 548, 31, 0.25)]
for k in range(7):
    OBJ.append(prop('fuel_drum%d' % k, 'drum_steel', 560 + (k % 4) * 1.25 + h01(k, 5) * 0.5, 22.5 + (k // 4) * 1.6 + h01(k, 6) * 0.6, h01(k, 7) * 6.28))
OBJ += [prop('fuel_bin', 'bin_metal_rust', 575.5, 27.0, 0.7), prop('fuel_pallets', 'pallets_three', 555.0, 23.8, 0.35)]
# (d) THE OLD POWER LINE (u ~715): the field's dead line marching off the strip - the middle pole gone, two left standing
#     (26 k triangles each at full detail: two, not three) - wingtips
OBJ += [prop('line_pole1', 'pole_b', 703, 24, 0.55), prop('line_pole3', 'pole_b', 725, 50, 0.6)]
for o in OBJ[-2:]: o['trunk'] = True   # a trunk too (29_obstacles TREE_HITS.pole): the beams meet it, as v1 found the nodes alone miss a pole
# (e) THE TRAILER CAMP (u ~880): a box trailer someone lived in, across the old shoulder; the car that brought them; the
#     fire ring and the barrel stove they kept
OBJ += [prop('camp_trailer', 'auto_semi_box', 886, 35, 1.45), prop('camp_car', 'car_crashed', 864, 26, 2.4),
        prop('camp_fire', 'camp_firepit', 870, 41, 0.0)]
# (f) THE BLOWDOWN (u ~1045): a winter storm's work, the trees down across each other, stumps, two snags still standing
OBJ += [tree('blow1', FALLEN['b'], 1030, 21, 0.45, size=0.5), tree('blow2', FALLEN['d'], 1046, 28, -0.85, size=0.6), tree('blow3', FALLEN['c'], 1061, 20, 1.6, size=0.55),
        tree('blow4', TRUNK, 1025, 34, 2.0, size=1.8), tree('blow5', FALLEN['a'], 1056, 39, 0.15, size=0.6),
        tree('blow_stump1', STUMP, 1036, 41, 0.3, size=1.2), tree('blow_stump2', STUMP, 1069, 33, 1.7), tree('blow_stump3', STUMP, 1019, 27, 2.6, size=1.1),
        tree('blow_stump4', STUMP, 1049, 45, 0.9, size=1.3), tree('blow_snag1', SNAG_C, 1073, 47, 0.4), tree('blow_snag2', SNAG_D, 1017, 48, 1.9)]
# (g) THE SLIDE (u ~1225): boulders down off the knoll and the loader that came to clear them and never did
OBJ += [tree('slide_rock1', ROCK['grp'], 1206, 26, 0.3), tree('slide_rock2', ROCK['small'], 1215, 20, 1.2),
        tree('slide_rock3', ROCK['long'], 1231, 35, 2.1, size=0.8), tree('slide_rock4', ROCK['grp'], 1241, 24, 0.9, size=0.7),
        prop('slide_loader', 'machine_loader_rusty', 1254, 37, 2.0)]
# (h) THE BEAVER POND (u ~1380-1490): the old runway's low corner, ungraded now (w2's falloff 8 m), holds water again -
#     the DEM's own pond; the lodge, the trees they dropped into it, the chewed stumps, the drowned snags
OBJ += [tree('pond_lodge', LODGE, 1440, 33, 0.7, size=0.4), tree('pond_trunk', TRUNK, 1396, 20, 0.8, size=1.5),
        tree('pond_fallen', FALLEN['e'], 1471, 23, -1.1, size=0.6), tree('pond_snag1', SNAG_D, 1421, 29, 2.2), tree('pond_snag2', SNAG_C, 1456, 45, 1.1)]
for k, (u, v) in enumerate([(1382, 41), (1404, 47), (1431, 50), (1462, 52), (1489, 43)]):
    OBJ.append(tree('pond_stump%d' % k, STUMP, u, v, h01(k, 70) * 6.28, size=0.8 + 0.4 * h01(k, 71)))
# (i) THE JUNK CORNER (u ~1590), short of 13/31: a rusted saloon, pallets, a tyre
OBJ += [prop('junk_car', 'auto_sedan_rusty', 1584, 27, 1.1), prop('junk_pallets', 'pallets_three', 1576, 24, 0.9),
        prop('junk_tyre1', 'tyre', 1597, 26, 0.4)]
# (j) THE COLLAPSED FENCE LINES: the old boundary along v ~52, in broken runs - panels gone, others askew or turned
#     (the user's own rule AFB-NO-FENCES, 26 Oct, held fences off the WWII site; this playground asks for collapsed ones)
fk = 0
for u0, n in [(232, 4), (468, 3), (610, 4), (930, 3), (1140, 4), (1300, 3)]:
    for j in range(n):
        if h01(fk, 80) < 0.22: fk += 1; continue                      # a panel gone
        turn = (h01(fk, 81) - 0.5) * 0.5 + (1.3 if h01(fk, 82) < 0.15 else 0.0)
        OBJ.append(prop('fence%d' % fk, 'fence_old', u0 + j * 4.7 + h01(fk, 83) * 0.6, 52.0 + wob(u0 / 200 + j * 0.1, 84, 1.5), math.pi / 2 + turn))
        fk += 1

# ---- 6. THE TURNAROUND GOING BACK TO THE WOOD (the NE end, the satellite's bushes on the pad) ------------------------
# young trees on the pad's far sides only: 28 m+ off the extended centreline, none over 5.3 m
for k, (u, v, kk) in enumerate([(-40, 30, 'sap'), (-55, 36, 'spruce'), (-72, 31, 'sap2'), (-86, 40, 'pine'), (-48, 44, 'sap'),
                                (-38, -32, 'pine'), (-60, -29, 'sap2'), (-78, -38, 'sap'), (-92, -30, 'sap2'), (-66, -46, 'pine')]):
    OBJ.append(tree('pad%d' % k, YOUNG[kk], u, v, h01(k, 90) * 6.28, size=0.8 + 0.2 * h01(k, 91)))
# and the band's own verge, east of it short of 13/31 where no lane runs (the satellite's bushes inside the old width)
for k, (u, v, kk) in enumerate([(1505, -20, 'sap'), (1532, -23, 'sap2'), (1561, -21, 'sap'), (1603, -24, 'sap2'), (1622, -19.5, 'sap')]):
    OBJ.append(tree('verge%d' % k, YOUNG[kk], u, v, h01(k, 92) * 6.28, size=0.7 + 0.25 * h01(k, 93)))

# ---- 7. THE ROUGH LANE: the second runway, east of the band -------------------------------------------------------
LANE_C = P((LANE_U0 + LANE_U1) / 2, LANE_V)
# its centreline on w2's: the lane's grade levels at its own centre's ground, so the profile's points carry the offset
# that lays it on the band's heights - read off the composed island by tools/afb0220_measure.js (0 mm at all five points
# after two passes), then held. Its falloff 6 m stops 2.25 m short of the band's centreline (10 m moved the band too)
LANE_PROFILE = [[0, -1.085], [0.25, -0.936], [0.5, -0.804], [0.75, -0.699], [1, -0.615]]
RUNWAYS = [{'id': PREFIX + 'rough', 'name': 'Jolene AFB 02R/20L', 'c': list(LANE_C), 'hdg': HDG, 'len': LANE_U1 - LANE_U0, 'wid': LANE_W,
            'surface': 11, 'look': 'mud', 'band': 1.5, 'pav': {'wet': 0.7}, 'crossfall': 0, 'disp': [0, 0], 'papi': [False, False],
            'falloff': 6, 'site': None, 'pattern': None, 'profile': LANE_PROFILE, 'approach': None,
            'clear': {'side': 3, 'beyond': 10, 'taper': 0, 'bushes': True},
            # unmaintained: no windsock on its mast (the user's toppled one), no tie-down spots (the fleet's cook put them on the
            # heaved slabs) - the stage keys 27_premises stageAero reads off any runway entry
            'sock': False, 'ties': False,
            # the bumps (26b_strip_micro.js): chaos 0.55 - between w8's 0.4 (Pilot-vetted) and a rough bush strip's 0.8; class
            # D roughness, ruts ~6.6 cm, lumps ~4.4 cm, two hazards to see and avoid, the swell's long rolls ~16 cm. FIRM MUD
            # (SNOW-MUD's 'mud' look, surface 11 MUD_FIRM - the user 13 Nov: mud on the sides)
            'micro': {'chaos': 0.55, 'seed': 20}}]

# ---- 8. w2 ITSELF (the user's entry): applied by the splice as a fieldPatch, never a part entry ---------------------
W2_PATCH = {'wid': BAND_W, 'band': 1.5, 'falloff': 8,
            # the old concrete at its worst: cracks everywhere, moss over it, patched, the paint nearly gone, damp
            'pav': {'rubberK': 0, 'laneW': 5, 'crackK': 1, 'mossK': 1, 'patchK': 0.3, 'paintAge': 1.2, 'wet': 0.6}}

PART = {'runways': RUNWAYS, 'areas': AREAS, 'objects': OBJ}
