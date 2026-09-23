#!/usr/bin/env python3
"""jolene_author.py - JOLENE AFB, ANNETTE DOCK, THE VILLAGE, THE HILL STRIP AND
THE ROADS, written as the world editor's record (tools/fixtures/island_jolene.json).

    py -3.11 tools/jolene_author.py            # writes the fixture
    py -3.11 tools/jolene_author.py --print    # prints it
    py -3.11 tools/jolene_author.py --absorb <exported.json> [--dry-run]
                                               # the editor's export back INTO tools/jolene_parts/

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
  animals   eight HOTSPOTS (2026-09-22, contract v1.17): elk NE of 02/20, does
            on the headland, gulls over the dock; THE TAMGAS SANCTUARY (a bear,
            an elk herd and a deer herd either side of the hill strip, which is
            how you get to them); and the whale watching - a pod of five orca ON the
            sea lane and a blue whale 8.7 km out in Dixon Entrance. Every site
            searched on the DEM, see ANIMALS below
"""
import json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json')

# ---- the DEM, for the levels -------------------------------------------------
# THE SHIPPED SOURCE (2026-09-23): the 10 m grid header and the 5 m float DEM
# come out of media/world/jolene, named by src/core/world_packs.json - so the
# premises can be re-authored in a worktree, a fresh clone or a cloud session.
# This used to read bench/jolene (gitignored) and fall back to a hard-coded
# 'D:/Dev/DeGaRoR.github.io/flyDiy/bench/jolene', which is to say: on one
# machine, or not at all. bench/ is still read FIRST when it is there, so the
# island's author can iterate a re-prep without baking the shipped asset.
# The bytes are the same either way, so the fixture does not move.
import gzip
def _pack_src(key, section='files'):
    p = os.path.join(ROOT, 'src', 'core', 'world_packs.json')
    if not os.path.exists(p): return None
    for w in json.load(open(p)).get('islands', []):
        if w['id'] == 'jolene':
            r = w.get(section, {}).get(key)
            if r and r.get('src'): return os.path.join(ROOT, *r['src'].split('/'))
            if r and 'json' in r: return r['json']
    return None

BENCH = os.path.join(ROOT, 'bench', 'jolene')
if os.path.exists(os.path.join(BENCH, 'dem.json')):
    J = json.load(open(os.path.join(BENCH, 'dem.json')))
    DEM_BYTES = open(os.path.join(BENCH, 'dem.f32'), 'rb').read()
else:
    meta, f32 = _pack_src('grid.meta'), _pack_src('f32', 'authoring')
    if meta is None or f32 is None:
        sys.exit('jolene_author: no DEM - neither bench/jolene nor the shipped media/world/jolene '
                 '(run tools/world_prep.js, or point at a bench with the island baked)')
    J = meta if isinstance(meta, dict) else json.loads(gzip.decompress(open(meta, 'rb').read()))
    DEM_BYTES = gzip.decompress(open(f32, 'rb').read())
W, H, X0, Z0, CELL = J['w'], J['h'], J['x0'], J['z0'], J['cell']
DEM = np.frombuffer(DEM_BYTES, np.float32).reshape(H, W)
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

# ---- THE ANIMALS (2026-09-22) -------------------------------------------------------------------
# Six HOTSPOTS, each ONE `animal` record (contract v1.17): the species, how many, and the radius
# they live over. Every site was SEARCHED on the island's own DEM rather than picked off a map -
# the land ones for a patch with no water in it and the gentlest slope over the herd's own radius,
# the sea ones for the widest circle of open water. What each search returned is in the comment.
#   a1  four elk on the flattest 120 m of the bench NE of 02/20's north end (max slope 9.6 % over
#       the patch, ground at 26 m) - seen on the base leg for 02, and a real reason to look
#   a2  ONE bear (they are solitary) on the flat below the Tamgas hill strip, 100 m from the strip's
#       own downhill end (max slope 7.3 %, ground at 22 m)
#   a3  five does on the headland above the village (max slope 13.6 %, which a deer does not notice)
#   a4  a pod of FIVE orca in the channel off Annette Dock, on the sea lane itself: the widest open
#       water within the premises (550 m clear at (0, -3750)), so you meet them on the approach
#   a5  ONE blue whale in Dixon Entrance, 8.7 km SW - the widest open water in the whole raster
#       (3.9 km clear). Deliberately far: it is the one you go and look for. A hotspot is placed in
#       WORLD coordinates and is not bounded by the premises' extent (GATE ANIMALS holds that).
#   a6  a flock of gulls over the dock, at 45 m
#   a7/a8  THE TAMGAS SANCTUARY (2026-09-22, the user: "a place on the island for an animal
#       sanctuary thing"). a2's bear was already 100 m off the hill strip; these two put an elk
#       herd and a deer herd on the benches either side of it, so the strip IS the way in: land
#       uphill at Tamgas, walk west, and there are bear, elk and deer inside a kilometre. Both
#       sites searched the same way - the flattest dry 110 m patch within 700 m of the strip and
#       no nearer than 90 m to it (a7 mean slope 4.1 %, ground 31 m; a8 5.4 %, ground 26 m).
#       THE WHALE WATCHING is a4 and a5: the pod is ON the sea lane, so a floatplane meets it on
#       every approach to Annette Dock, and the blue whale is the expedition out in Dixon Entrance.
ANIMALS = [
    {'id': 'a1', 'kind': 'animal', 'key': 'elk',   'x': 1180.0, 'z': -1080.0, 'yaw': 0, 'n': 4, 'r': 120, 'dy': 0},
    {'id': 'a2', 'kind': 'animal', 'key': 'bear',  'x': -800.0, 'z': -2300.0, 'yaw': 0, 'n': 1, 'r': 70, 'dy': 0},
    {'id': 'a3', 'kind': 'animal', 'key': 'doe',   'x': 740.0, 'z': -2500.0, 'yaw': 0, 'n': 5, 'r': 110, 'dy': 0},
    {'id': 'a4', 'kind': 'animal', 'key': 'orca',  'x': 0.0, 'z': -3750.0, 'yaw': 0, 'n': 5, 'r': 300, 'dy': 0},
    {'id': 'a5', 'kind': 'animal', 'key': 'whale', 'x': -8600.0, 'z': 2400.0, 'yaw': 0, 'n': 1, 'r': 450, 'dy': 0},
    {'id': 'a6', 'kind': 'animal', 'key': 'bird',  'x': 900.0, 'z': -2980.0, 'yaw': 0, 'n': 7, 'r': 200, 'dy': 45},
    # THE TAMGAS SANCTUARY - the two herds either side of the hill strip (with a2's bear)
    {'id': 'a7', 'kind': 'animal', 'key': 'elk',   'x': -1300.0, 'z': -2350.0, 'yaw': 0, 'n': 6, 'r': 150, 'dy': 0},
    {'id': 'a8', 'kind': 'animal', 'key': 'doe',   'x': -1420.0, 'z': -2520.0, 'yaw': 0, 'n': 7, 'r': 130, 'dy': 0},
]

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
# ---------------------------------------------------------------------------
# THE PARTS (2026-09-23): FIVE sessions author this one record at once - the
# airfield, Metlakatla, and the three landmark scenes - so each writes its OWN
# file under tools/jolene_parts/ and this merges them in. A part is either
#
#   <name>.py     a MODULE, executed here, free to compute (read the island's
#                 rasters, walk streets ashore, print what it dropped and why),
#                 leaving  PREFIX = 'xx_'  and  PART = {'objects': [...], ...}
#   <name>.json   { "prefix": "xx_", "layers": { "objects": [...], ... } }
#                 - which is what the WORLD EDITOR exports, so a scene authored
#                 in the editor round-trips without a human in the middle
#
# THE RULES, agreed between the five sessions:
#   * every entry's id carries its part's PREFIX (af_ airfield, mk_ Metlakatla,
#     nv_ native area, mn_ mining, tw_ tramway). An id that does not, or one
#     another part already used, fails LOUDLY here: the record is generated, so
#     a silent drop is a village that vanishes and a gate that calls the result
#     clean, because the gate checks the record it is given.
#   * py parts first, then json, each alphabetical; and a part's OWN ORDER
#     inside a layer is preserved - zones are sown in array order and a
#     catch-all zone placed last is load-bearing for the town.
#   * THE FIXTURE IS OUTPUT, NEVER SOURCE. On a merge conflict in
#     island_jolene.json, take either side and RE-RUN this script.
#   * BUMP `rev` WHEN YOU LAND. app.js shadows the fixture with the player's
#     saved WIP unless rev goes up, so a rebaser who forgets it tests against a
#     stale record in their own browser and sees none of their work.
# ---------------------------------------------------------------------------
PART_DIR = os.path.join(ROOT, 'tools', 'jolene_parts')

def part_files():
    """every part, in the order merge_parts applies them: the .py parts first (they may compute
    what a .json part can only state), then the .json parts, alphabetical within each kind."""
    if not os.path.isdir(PART_DIR): return []
    names = sorted(f for f in os.listdir(PART_DIR) if f.endswith('.py') and not f.startswith('_'))
    names += sorted(f for f in os.listdir(PART_DIR) if f.endswith('.json'))
    return [os.path.join(PART_DIR, f) for f in names]


def load_part(path):
    """one reader for both kinds, so merge_parts and --absorb can never disagree about what a part
    says. A .py part is RUN (its `PREFIX`, `PART`, optional `EXTENT`); a .json part is read, and its
    whole object is kept as `raw` so --absorb can write it back with its other keys untouched."""
    f = os.path.basename(path)
    if f.endswith('.py'):
        import runpy
        tools_dir = os.path.join(ROOT, 'tools')
        if tools_dir not in sys.path: sys.path.insert(0, tools_dir)
        ns = runpy.run_path(path, run_name='jolene_part')
        return {'file': f, 'path': path, 'kind': 'py', 'prefix': ns.get('PREFIX'),
                'layers': ns.get('PART') or {}, 'extent': ns.get('EXTENT'), 'raw': None}
    with open(path, encoding='utf8') as fh: o = json.load(fh)
    return {'file': f, 'path': path, 'kind': 'json', 'prefix': o.get('prefix'),
            'layers': o.get('layers') or {}, 'extent': o.get('extent'), 'raw': o}


def merge_parts(rec):
    ids = {}
    for k, rows in rec['layers'].items():
        for e in rows:
            if isinstance(e, dict) and e.get('id'): ids[e['id']] = 'the field'
    for path in part_files():
        P = load_part(path)
        f, prefix, layers = P['file'], P['prefix'], P['layers']
        if not prefix: raise SystemExit('part %s: no PREFIX / "prefix"' % f)
        n = 0
        for k, rows in layers.items():
            if k not in rec['layers']: raise SystemExit('part %s: no layer %r (%s)' % (f, k, ', '.join(sorted(rec['layers']))))
            for e in rows:
                i = e.get('id')
                if not i or not str(i).startswith(prefix): raise SystemExit('part %s: id %r does not carry its prefix %r' % (f, i, prefix))
                if i in ids: raise SystemExit('part %s: id %r is already %s' % (f, i, ids[i]))
                ids[i] = f
                rec['layers'][k].append(e); n += 1          # the part's own order, preserved
        grow_extent(rec, layers, P['extent'])
        print('  part %-26s %-4s %4d entries' % (f, prefix, n))


PART_MARGIN = 250.0          # a runway's shoulder, a flatten's falloff, a road's band


def part_points(o, key=None, out=None):
    """every world coordinate a part entry carries. Geometry lives in `poly`, `pts`, `c`, `a`, `b`
    and in any dict with an x and a z (an object, a site's `at`, a site item); everything else is
    walked through. A stray pair from somewhere harmless only ever pulls the extent toward the
    island, which already covers it - the failure this guards is the opposite one."""
    if out is None: out = []
    if isinstance(o, dict):
        x, z = o.get('x'), o.get('z')
        if isinstance(x, (int, float)) and isinstance(z, (int, float)): out.append((float(x), float(z)))
        for k, v in o.items(): part_points(v, k, out)
    elif isinstance(o, (list, tuple)):
        if len(o) == 2 and all(isinstance(v, (int, float)) for v in o) and key in ('c', 'a', 'b', 'end0', 'end1'):
            out.append((float(o[0]), float(o[1])))
        elif key in ('poly', 'pts'):
            for e in o:
                if isinstance(e, (list, tuple)) and len(e) >= 2 and all(isinstance(v, (int, float)) for v in e[:2]): out.append((float(e[0]), float(e[1])))
                else: part_points(e, key, out)
        else:
            for e in o: part_points(e, key, out)
    return out


def grow_extent(rec, layers, explicit=None):
    """THE EXTENT FOLLOWS THE PARTS (2026-09-23, the mining village session, who are putting a mine
    6 km out: "render_premises builds the game's patch chunks and paints the material map only
    inside extentWorld() - a part 6-12 km out gets its road cuts/flattens composed in physics but NO
    ground drawn over them"). They were right: the extent is authored here and a part that lands
    outside it is invisible. Every coordinate a part carries grows it, plus a margin for the
    shoulders and falloffs the coordinates do not state; a JSON part may also name its own
    `extent` (a .py part an `EXTENT`) as [x0, z0, x1, z1] and that is unioned as given."""
    E = rec['frame']['extent']
    if explicit and len(explicit) == 4:
        E['x0'] = min(E['x0'], explicit[0]); E['z0'] = min(E['z0'], explicit[1])
        E['x1'] = max(E['x1'], explicit[2]); E['z1'] = max(E['z1'], explicit[3])
    for k, rows in layers.items():
        for e in rows:
            reach = PART_MARGIN
            if k == 'runways': reach += float(e.get('len', 0)) / 2 + float(e.get('wid', 0))
            elif k == 'sites': reach += 160.0                       # a yard and its items, in the site's own frame
            for (x, z) in part_points(e):
                E['x0'] = min(E['x0'], x - reach); E['z0'] = min(E['z0'], z - reach)
                E['x1'] = max(E['x1'], x + reach); E['z1'] = max(E['z1'], z + reach)
    for k in ('x0', 'z0', 'x1', 'z1'): E[k] = round(E[k], 1)

# ---------------------------------------------------------------------------
# --absorb: THE WAY BACK (2026-09-23, asked for by three sessions and by the
# user's own line, "I would like all of this to be built with the world editor,
# so I can edit it further myself later on").
#
# merge_parts carries a part INTO the record. This carries the record back OUT
# into the parts, so an afternoon of dragging things about in the game's WORLD
# editor survives the next regeneration instead of being overwritten by it.
#
#     py -3.11 tools/jolene_author.py --absorb <exported.json> [--dry-run]
#
# The export is whatever the editor saves - {what:'flydiy-premises',premises}
# or a bare record. Every entry is bucketed by the LONGEST matching prefix (so
# mn_ and a later mn_x_ cannot fight over an id), and then:
#
#   a .json part   is rewritten in place - its `layers` replaced, its own other
#                  keys (part, prefix, note, extent) untouched;
#   a .py part     is NOT written. It is a PROGRAM: jolene_parts/airfield.py
#                  computes its positions from the club's quarter-turned frame
#                  and names its scenes, and absorbing flat coordinates over
#                  that would throw away every reason the numbers are what they
#                  are. The diff is printed instead, for a human to apply;
#   the author's   own entries are diffed and REPORTED, never dropped - they
#                  live in this file's literals and only a human can move them;
#   an entry that  matches no prefix is a NEW thing drawn in the editor. It is
#                  reported with the prefixes it could join. Nothing is dropped
#                  silently, ever: that is the whole contract of this command.
#
# Afterwards the record is rebuilt from the parts on disk and checked entry by
# entry against the export. That check is the proof the absorb was lossless,
# and it is why this is safe to run on work you cannot reproduce.
# ---------------------------------------------------------------------------
def _canon(o):
    return json.dumps(o, indent=1, ensure_ascii=False)


def _restore(before):
    """put every part back to the bytes it had. --absorb writes first and proves afterwards, because
    the proof is a real rebuild through merge_parts; if that rebuild refuses the result, the run must
    leave the working tree exactly as it found it - a half-absorbed part is worse than none."""
    for path, blob in before.items():
        with open(path, 'wb') as fh: fh.write(blob)


def absorb(own, path, write=True):
    import difflib
    try:
        with open(path, encoding='utf8') as fh: o = json.load(fh)
    except Exception as e:
        raise SystemExit('--absorb %s: %s' % (path, e))
    rec = o.get('premises') if isinstance(o, dict) and o.get('what') == 'flydiy-premises' else o
    if not isinstance(rec, dict) or not isinstance(rec.get('layers'), dict):
        raise SystemExit('--absorb %s: not a flyDiy premises export (no `layers`)' % path)

    parts = [load_part(q) for q in part_files()]
    for P in parts:
        if not P['prefix']: raise SystemExit('part %s: no PREFIX / "prefix"' % P['file'])
    longest = sorted(parts, key=lambda P: -len(P['prefix']))          # the longest prefix wins
    own_by_id = {}
    for k, rows in own['layers'].items():
        for e in rows:
            if isinstance(e, dict) and e.get('id'): own_by_id[e['id']] = (k, e)

    before = {}                      # a json part's bytes before this run, so a failed check leaves nothing behind
    bucket = dict((P['file'], {}) for P in parts)
    mine, orphan, unknown_layer = [], [], set()
    for k, rows in rec['layers'].items():
        if k not in own['layers']: unknown_layer.add(k); continue
        for e in rows:
            if not isinstance(e, dict): continue
            i = str(e.get('id') or '')
            hit = next((P for P in longest if i and i.startswith(P['prefix'])), None)
            if hit: bucket[hit['file']].setdefault(k, []).append(e)
            elif i in own_by_id: mine.append((k, i, e))
            else: orphan.append((k, i or '(no id)'))

    print('--absorb %s' % path)
    if unknown_layer:
        print('  ! the export carries layers this author does not know: %s' % ', '.join(sorted(unknown_layer)))
    wrote, refused, unchanged = [], [], []
    for P in parts:
        got = bucket[P['file']]
        keys = list(P['layers'].keys()) + [k for k in got if k not in P['layers']]
        new = dict((k, got.get(k, [])) for k in keys)
        n = sum(len(v) for v in new.values())
        if _canon(new) == _canon(P['layers']):
            unchanged.append((P, n)); continue
        if P['kind'] == 'py':
            refused.append(P)
            was = sum(len(v) for v in P['layers'].values())
            print('  REFUSED %-26s %-4s %d -> %d entries: a .py part is a PROGRAM, not data.' % (P['file'], P['prefix'], was, n))
            print('          Its numbers are computed and its scenes are named; writing flat coordinates')
            print('          over it would throw the reasons away. The diff, for a human to apply:')
            d = difflib.unified_diff(_canon(P['layers']).splitlines(), _canon(new).splitlines(),
                                     fromfile=P['file'] + ' (now)', tofile=P['file'] + ' (the editor)', lineterm='', n=2)
            for j, line in enumerate(d):
                if j > 400:
                    print('          ... (truncated; redirect the output for the whole diff)'); break
                print('          ' + line)
            continue
        raw = dict(P['raw']); raw['layers'] = new
        if write:
            with open(P['path'], 'rb') as fh: before[P['path']] = fh.read()
            with open(P['path'], 'w', encoding='utf8', newline='\n') as fh: fh.write(_canon(raw) + '\n')
        wrote.append((P, n))
        print('  %s %-26s %-4s %4d entries' % ('wrote ' if write else 'WOULD ', P['file'], P['prefix'], n))
    for P, n in unchanged:
        print('  same   %-26s %-4s %4d entries' % (P['file'], P['prefix'], n))

    if mine:
        changed = set(i for (k, i, e) in mine if _canon(e) != _canon(own_by_id[i][1]))
        if not changed:
            print('  %d entries belong to THIS FILE rather than to a part, all unchanged' % len(mine))
        else:
            print('  %d entr%s in the export belong to THIS FILE, not to a part:' % (len(mine), 'y' if len(mine) == 1 else 'ies'))
            for k, i, e in mine:
                if i in changed: print('    EDITED %-10s %s' % (k, i))
        if changed:
            print('  %d of them were EDITED and CANNOT be absorbed - they live in this file\'s own' % len(changed))
            print('  literals. Move them here by hand, or give them a part. The diffs:')
            shown = 0
            for k, i, e in mine:
                if i not in changed: continue
                shown += 1
                if shown > 10: print('    ... and %d more' % (len(changed) - 10)); break
                for line in difflib.unified_diff(_canon(own_by_id[i][1]).splitlines(), _canon(e).splitlines(),
                                                 fromfile=i + ' (this file)', tofile=i + ' (the editor)', lineterm='', n=1):
                    print('    ' + line)
    if orphan:
        pref = ', '.join(sorted(P['prefix'] for P in parts)) or '(no parts)'
        print('  %d entr%s no part prefix - NEW work drawn in the editor, kept nowhere by this run:'
              % (len(orphan), 'y carries' if len(orphan) == 1 else 'ies carry'))
        for k, i in orphan[:40]: print('    %-10s %s' % (k, i))
        if len(orphan) > 40: print('    ... and %d more' % (len(orphan) - 40))
        print('  Give each an id starting with one of: %s - then run --absorb again.' % pref)

    # THE PROOF: rebuild from the parts on disk and check every absorbed entry against the export
    if refused:
        print('  no lossless check: a .py part was refused, so the parts on disk cannot reproduce this')
        print('  export until its diff is applied by hand. What WAS written above is still written.')
    if write and not refused and wrote:
        import copy
        check = copy.deepcopy(own)
        keep, sys.stdout = sys.stdout, open(os.devnull, 'w')
        try:
            merge_parts(check)
        except SystemExit as e:
            sys.stdout.close(); sys.stdout = keep
            _restore(before)
            raise SystemExit('  %s\n  THE PARTS WERE PUT BACK - nothing on disk changed. The export itself is at fault.' % e)
        finally:
            if sys.stdout is not keep: sys.stdout.close(); sys.stdout = keep
        after = {}
        for k, rows in check['layers'].items():
            for e in rows:
                if isinstance(e, dict) and e.get('id'): after[e['id']] = (k, e)
        bad = []
        for P in parts:
            for k, rows in bucket[P['file']].items():
                for e in rows:
                    i = e.get('id')
                    if i not in after: bad.append('%s: lost' % i)
                    elif after[i][0] != k: bad.append('%s: landed in %s, not %s' % (i, after[i][0], k))
                    elif _canon(after[i][1]) != _canon(e): bad.append('%s: differs' % i)
        if bad:
            _restore(before)
            raise SystemExit('  ABSORB IS NOT LOSSLESS - %d entr%s did not come back: %s\n  THE PARTS WERE PUT BACK - nothing on disk changed.'
                             % (len(bad), 'y' if len(bad) == 1 else 'ies', ', '.join(bad[:8])))
        print('  checked: every absorbed entry rebuilds identically from the parts on disk')
    if wrote and write:
        print('  now re-run this author to write the fixture, and BUMP `rev` if anything moved -')
        print('  a player\'s browser keeps its own WIP under flydiy.premises.game.jolene and shadows')
        print('  the shipped record until the rev says otherwise.')
    return 0


def seg_dist(p, pts):
    """distance from p to a polyline"""
    best = 1e18
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l2 = dx * dx + dy * dy
        t = 0.0 if l2 < 1e-12 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
        best = min(best, math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)))
    return best

def clip_fences(fences, avoid, least=4.0):
    """THE FENCE STOPS AT THE MOVEMENT AREA (2026-09-23, the user: "there's a fence going through the
    taxiways. There should be no fence whatsoever there, remove it"). A club's fence surrounds its
    yard; where it meets a taxiway it ends, because an aeroplane goes through there. Clipped by RULE
    rather than by moving coordinates, so it stays right if a taxiway ever moves: each segment is
    walked at a metre and the runs that lie outside every movement area survive. A run under `least`
    metres is not a fence, it is a post."""
    out = []
    for f in fences:
        a, b = f['a'], f['b']
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 1e-6: continue
        n = max(2, int(L))
        hit = []
        for i in range(n + 1):
            t = i / n
            q = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            hit.append(any(seg_dist(q, pts) < hw for pts, hw in avoid))
        i = 0
        while i <= n:
            if hit[i]: i += 1; continue
            j = i
            while j <= n and not hit[j]: j += 1
            t0, t1 = i / n, (j - 1) / n
            if (t1 - t0) * L >= least:
                whole = t0 < 1e-9 and t1 > 1 - 1e-9
                out.append({'a': pt(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
                            'b': pt(a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1),
                            'gap': f.get('gap') if whole else None, 'style': f.get('style', 'rail')})
            i = j
    return out

def club_fences():
    out = []
    for f in CLUB_FENCES:
        a = club_world(*f['a']); b = club_world(*f['b'])
        out.append({'a': pt(*a), 'b': pt(*b), 'gap': f.get('gap'), 'style': 'rail'})
    # ...and never across the taxiways: their own width and four metres of margin
    return clip_fences(out, [(TAXI_NE, TAXI_W / 2 + 4), (TAXI_E, TAXI_W / 2 + 4)])
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
    # THE PAVEMENT (contract v1.16): the taxiway V is worn concrete drawn by the pavement module (a ribbon again;
    # the material polygons that stood in for it are gone), a 3 m band of the cleared ground beside it
    {'id': 'r_taxi_ne', 'pts': [pt(*p) for p in TAXI_NE], 'w': TAXI_W, 'cls': 'paved', 'look': 'worn', 'band': 3, 'graded': True, 'falloff': 14, 'grade': 0.025},
    {'id': 'r_taxi_e', 'pts': [pt(*p) for p in TAXI_E], 'w': TAXI_W, 'cls': 'paved', 'look': 'worn', 'band': 3, 'graded': True, 'falloff': 14, 'grade': 0.025},
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
        'pavement': {'wet': 0.45, 'puddleCover': 0.35, 'mossK': 0.6},   # the pavement's character here (contract v1.16): a damp coast - the user: "everything seems always sort of wet over there" - the concrete mossed
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
                # THE PAVED POLYGONS (contract v1.16): the club's apron and the three turnarounds are worn concrete drawn by
                # the pavement module, their lanes turned with the strip; the cleared bands beside the strips are the
                # strips' own `band` now, the taxiway V its roads' - those five material polygons are gone
                {'id': 'm_pad', 'poly': pad_poly, 'look': 'worn', 'band': 3, 'yaw': R(CLUB_YAW, 4), 'z': 1},
                {'id': 'm_turn_nw', 'poly': octagon(past_end(HOME_C, HOME_HDG, HOME_LEN, 0, 45), 55), 'look': 'worn', 'band': 6, 'yaw': HOME_HDG, 'z': 1},
                {'id': 'm_turn_se', 'poly': octagon(past_end(HOME_C, HOME_HDG, HOME_LEN, 1, 45), 55), 'look': 'worn', 'band': 6, 'yaw': HOME_HDG, 'z': 1},
                {'id': 'm_turn_ne', 'poly': octagon(past_end(W2_C, W2_HDG, W2_LEN, 0, 45), 55), 'look': 'worn', 'band': 6, 'yaw': W2_HDG, 'z': 1},
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
                {'id': 'w2', 'name': 'Jolene AFB 02/20', 'c': pt(*W2_C), 'hdg': W2_HDG, 'len': W2_LEN, 'wid': HOME_WID, 'surface': 5, 'look': 'worn', 'band': 40, 'pav': {'rubberK': 0, 'laneW': 6.1}, 'crossfall': 0,
                 'disp': [0, 0], 'papi': [False, False], 'falloff': 60, 'site': None, 'pattern': None, 'profile': W2_PROFILE, 'approach': None},
                {'id': 'HOME', 'name': 'Jolene AFB 13/31', 'c': pt(*HOME_C), 'hdg': HOME_HDG, 'len': HOME_LEN, 'wid': HOME_WID, 'surface': 5, 'look': 'worn', 'band': 40, 'pav': {'rubberK': 0, 'laneW': 6.1}, 'crossfall': 0,
                 'disp': [0, 0], 'papi': ['vasi', 'vasi'], 'falloff': 60, 'site': None, 'pattern': None, 'profile': [[0, 5.2], [0.5, 0.0], [1, -5.1]], 'approach': None,
                 'stand': {'x': R(STAND[0]), 'z': R(STAND[1]), 'hdg': None}, 'taxiOut': [pt(*p) for p in TAXI_NE],
                 'hangar': {'x': R(HANGAR_W[0]), 'z': R(HANGAR_W[1]), 'hdg': 0.0}},
                {'id': 'w3', 'name': 'Tamgas Hill Strip', 'c': pt(*W3_C), 'hdg': R(W3_HDG, 4), 'len': W3_LEN, 'wid': W3_WID, 'surface': 6, 'look': 'gravel', 'band': 4, 'crossfall': 0,
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
            # the ttype layer (contract v1.27): polygons that stamp a terrain-type code
            # into the island's own grid - the town's lush verges and its wood belt
            'ttype': [],
            'objects': [
                # the parked aeroplanes on the club's apron (GATE PARKED rule 7 reads them)
                {'id': 'o1', 'kind': 'aircraft', 'key': 'arch:cub', 'x': R(club_world(20, 40)[0]), 'z': R(club_world(20, 40)[1]), 'yaw': R(-math.pi / 2, 4)},
                {'id': 'o2', 'kind': 'aircraft', 'key': 'arch:c172', 'x': R(club_world(36, 42)[0]), 'z': R(club_world(36, 42)[1]), 'yaw': R(-math.pi / 2 + 0.2, 4)},
                {'id': 'o3', 'kind': 'aircraft', 'key': 'arch:jodel', 'x': R(club_world(-48, 44)[0]), 'z': R(club_world(-48, 44)[1]), 'yaw': R(math.pi / 2 - 0.3, 4)},
            ] + ANIMALS,
        },
        'budget': {'tris': 400000, 'lights': 24, 'smoke': 6, 'people': 40},
        'rev': 19,         # 8 the airfield's life, the parking apron, the fence off the taxiways; 9 JUMBO MINE (jolene_parts/mn_mine.json); 10 the Skyline tramway + altiport (jolene_parts/tramway.json); 11 the East Point native grounds (jolene_parts/native.json); 12 Jumbo Mine moved to the wooded knoll; 13 the mine's school, clinic and chapel on posts; 14 East Point quiet (no mast, cars, rubbish); 15 the tramway's top on the plateau + its square; 16 East Point's trees cut back to the user's lines; 17 East Point's footpaths lie on the ground; 18 the altiport's head one platform, the tram's terminal on it; 19 METLAKATLA, the island's one real town (jolene_parts/metlakatla.py) (2026-09-23)
    }
    if '--absorb' in sys.argv:
        k = sys.argv.index('--absorb')
        if k + 1 >= len(sys.argv): raise SystemExit("--absorb needs the editor's exported json")
        return absorb(rec, sys.argv[k + 1], write='--dry-run' not in sys.argv)
    merge_parts(rec)
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
