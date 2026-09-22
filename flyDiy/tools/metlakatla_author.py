#!/usr/bin/env python3
"""metlakatla_author.py - METLAKATLA, the one real town on Annette Island, as the
world editor's record. jolene_author.py imports this and splices its layers into
tools/fixtures/island_jolene.json; run THAT to write the fixture.

    py -3.11 tools/jolene_author.py          # writes the fixture, town and all
    py -3.11 tools/metlakatla_author.py      # prints this module's own layers

WHERE THE COORDINATES COME FROM, honestly. The frame is the game's own
(EPSG:3338 minus the WWII field's origin; north is -z; grid north leans 19.32 deg
east of true). The town sits at x -4300..-2400, z -9150..-7650, about 9.4 km
north-north-west of the field.

Nothing here was eyeballed off a picture in isolation. The user's Google views
were REGISTERED onto the frame by tools/met_fit.py - the rotation pinned at the
convergence, the scale and offset found by cross-correlating the view's own
water/land split against bench/jolene/dem.coast.u8 - and then the street grid was
pulled off the registered views by tools/met_streets.py, which votes every
road-like pixel onto the perpendicular offset of the line it lies on and walks
each peak to its ends. tools/met_trace.py draws this record back over the island's
radar orthoimage, which is how it was checked. The views themselves are Google's
and are not in the repo; the NUMBERS are, here.

THE STREET GRID is two families: the numbered avenues on grid bearing 43 deg
(atan2(z, x) = 133), about 46 m apart, and the named cross streets on 133 deg
(atan2 = 43), 46-100 m apart. Everything else - Walden Point Road, Airport Road,
Skaters Lake Road, the graveyard road, the subdivision loops - is a traced
polyline.
"""
import json, math, os, sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- the DEM, for the levels (the same reader jolene_author.py uses) ----------
BENCH = os.path.join(ROOT, 'bench', 'jolene')
if not os.path.exists(os.path.join(BENCH, 'dem.json')):
    BENCH = 'D:/Dev/DeGaRoR.github.io/flyDiy/bench/jolene'   # a worktree: the main checkout's bake
_J = json.load(open(os.path.join(BENCH, 'dem.json')))
_W, _H, _X0, _Z0, _CELL = _J['w'], _J['h'], _J['x0'], _J['z0'], _J['cell']
_DEM = np.fromfile(os.path.join(BENCH, 'dem.f32'), np.float32).reshape(_H, _W)
_COAST = np.fromfile(os.path.join(BENCH, 'dem.coast.u8'), np.uint8).reshape(_H, _W)


def dem(x, z):
    c = (x - _X0) / _CELL
    r = (z - _Z0) / _CELL
    i, j = int(c), int(r)
    u, v = c - i, r - j
    return float(_DEM[j, i] * (1 - u) * (1 - v) + _DEM[j, i + 1] * u * (1 - v)
                 + _DEM[j + 1, i] * (1 - u) * v + _DEM[j + 1, i + 1] * u * v)


def is_land(x, z):
    return int(_COAST[int(round((z - _Z0) / _CELL)), int(round((x - _X0) / _CELL))]) >= 128


def coast_m(x, z):
    """Metres inland of the island's own waterline (negative at sea).
    dem.coast.u8 is signed m/4 with 128 at the line (bench/jolene/dem.json)."""
    c = (x - _X0) / _CELL
    r = (z - _Z0) / _CELL
    i = min(max(int(c), 0), _W - 2)
    j = min(max(int(r), 0), _H - 2)
    u, v = c - i, r - j
    q = (float(_COAST[j, i]) * (1 - u) * (1 - v) + float(_COAST[j, i + 1]) * u * (1 - v)
         + float(_COAST[j + 1, i]) * (1 - u) * v + float(_COAST[j + 1, i + 1]) * u * v)
    return (q - 128.0) * 4.0


def pull_inland(x, z, margin=30.0, step=14.0, tries=24):
    """THE WATERLINE IS NOT THE BEACH. Metlakatla's shore streets stand on ground
    the 10 m DEM does not have: its zero line lies out on the shelf, so a street
    traced at its true position lands in the sea (jolene_author.py made the same
    note for its village and put the harbour street 35 m inland). Rather than
    invent fill under the whole waterfront - which would cut a step through the
    town behind it - a point that is not far enough inland WALKS up the coast
    field's own gradient until it is."""
    for _ in range(tries):
        if coast_m(x, z) >= margin:
            return x, z
        best, bx, bz = coast_m(x, z), x, z
        for k in range(16):
            a = math.pi * 2 * k / 16
            nx, nz = x + math.cos(a) * step, z + math.sin(a) * step
            c = coast_m(nx, nz)
            if c > best:
                best, bx, bz = c, nx, nz
        if (bx, bz) == (x, z):
            return x, z
        x, z = bx, bz
    return x, z


R = lambda v, n=2: round(float(v), n)
def pt(x, z): return [R(x), R(z)]

# ---- the street grid, pulled off the registered views (met_streets.py) -------
# (x0, z0, x1, z1, family): A = the named cross streets, C = the numbered avenues
STREETS = [
    (-2600, -8700, -2730, -8561, 'A'),
    (-2779, -8558, -2876, -8454, 'A'),
    (-2700, -8702, -2780, -8616, 'A'),
    (-2869, -8603, -3067, -8391, 'A'),
    (-2850, -8703, -2996, -8546, 'A'),
    (-3122, -8462, -3210, -8368, 'A'),
    (-2898, -8760, -3186, -8452, 'A'),
    (-2994, -8701, -3256, -8420, 'A'),
    (-2909, -8823, -3259, -8449, 'A'),
    (-2898, -8944, -3351, -8458, 'A'),
    (-2933, -8963, -3413, -8448, 'A'),
    (-2969, -8980, -3459, -8455, 'A'),
    (-3109, -8927, -3324, -8696, 'A'),
    (-3597, -8407, -3695, -8302, 'A'),
    (-3493, -8567, -3631, -8419, 'A'),
    (-3324, -8753, -3457, -8611, 'A'),
    (-3612, -8495, -3857, -8232, 'A'),
    (-3143, -9041, -3514, -8643, 'A'),
    (-3554, -8602, -3790, -8349, 'A'),
    (-3503, -8703, -3836, -8346, 'A'),
    (-3275, -8964, -3606, -8609, 'A'),
    (-3671, -8572, -3780, -8455, 'A'),
    (-3317, -8987, -3611, -8671, 'A'),
    (-3355, -9022, -3728, -8622, 'A'),
    (-3918, -8474, -4138, -8237, 'A'),
    (-3340, -9096, -3944, -8448, 'A'),
    (-4003, -8439, -4239, -8186, 'A'),
    (-3438, -9070, -4009, -8459, 'A'),
    (-3878, -8651, -4346, -8149, 'A'),
    (-3964, -8624, -4309, -8254, 'A'),
    (-3982, -8654, -4139, -8486, 'A'),
    (-3813, -8881, -3956, -8727, 'A'),
    (-3060, -8911, -2899, -8761, 'C'),
    (-2837, -8702, -2668, -8544, 'C'),
    (-3222, -9004, -2988, -8785, 'C'),
    (-3252, -8980, -2898, -8650, 'C'),
    (-2997, -8701, -2693, -8418, 'C'),
    (-3458, -9088, -2898, -8566, 'C'),
    (-3515, -9082, -2898, -8507, 'C'),
    (-3136, -8702, -2864, -8448, 'C'),
    (-3574, -9084, -2929, -8482, 'C'),
    (-2869, -8381, -2745, -8265, 'C'),
    (-3561, -9015, -2982, -8475, 'C'),
    (-3208, -8648, -2958, -8415, 'C'),
    (-3577, -8978, -3284, -8705, 'C'),
    (-3601, -8932, -3349, -8697, 'C'),
    (-3305, -8652, -3130, -8489, 'C'),
    (-3625, -8897, -3144, -8448, 'C'),
    (-3322, -8572, -3116, -8380, 'C'),
    (-3648, -8866, -3376, -8613, 'C'),
    (-3679, -8839, -3259, -8448, 'C'),
    (-3401, -8526, -3238, -8373, 'C'),
    (-3854, -8907, -3367, -8452, 'C'),
    (-3701, -8703, -3360, -8385, 'C'),
    (-3623, -8579, -3522, -8485, 'C'),
    (-3470, -8435, -3358, -8331, 'C'),
    (-3893, -8812, -3677, -8610, 'C'),
    (-3924, -8788, -3577, -8464, 'C'),
    (-3921, -8703, -3575, -8381, 'C'),
    (-3887, -8625, -3580, -8338, 'C'),
    (-3828, -8497, -3657, -8337, 'C'),
    (-4045, -8658, -3894, -8518, 'C'),
    (-3866, -8474, -3677, -8298, 'C'),
    (-4104, -8624, -3972, -8501, 'C'),
    (-4114, -8586, -3795, -8289, 'C'),
    (-4123, -8547, -3952, -8388, 'C'),
    (-4135, -8472, -3999, -8346, 'C'),
    (-4176, -8429, -3945, -8213, 'C'),
    (-4201, -8405, -4062, -8276, 'C'),
    (-4236, -8371, -4116, -8259, 'C'),
    (-4262, -8346, -4143, -8235, 'C'),
]

# ---- the traced roads: everything that is not on the grid ---------------------
# Read off the registered views at 0.5-1.7 m per pixel (met_trace.py tiles).
WALDEN_PNT_RD = [(-2954, -8696), (-2854, -8663), (-2687, -8604), (-2537, -8563), (-2370, -8521),
                 (-2237, -8488), (-2104, -8446), (-1970, -8413), (-1837, -8379), (-1687, -8346),
                 (-1570, -8312), (-1437, -8296), (-1362, -8318)]
AIRPORT_RD = [(-2872, -8688), (-2862, -8560), (-2852, -8420), (-2846, -8280), (-2841, -8140),
              (-2836, -8030), (-2820, -7900), (-2796, -7760)]
SKATERS_LAKE_RD = [(-3412, -8432), (-3332, -8402), (-3292, -8300), (-3262, -8180), (-3230, -8090),
                   (-3180, -8035), (-3100, -8025), (-2990, -8022), (-2880, -8028), (-2846, -8030)]
GRAVEYARD_RD = [(-4205, -8486), (-4252, -8420), (-4300, -8300), (-4350, -8180), (-4400, -8060),
                (-4432, -7970), (-4444, -7900)]
RAVEN_ST = [(-3215, -8020), (-3175, -7965), (-3100, -7940), (-3020, -7930), (-2960, -7900),
            (-2930, -7850), (-2900, -7800), (-2862, -7772)]
WOLF_ST = [(-3060, -7975), (-3010, -7950), (-2975, -7915), (-2950, -7880), (-2935, -7840)]
BREAKWATER_RD = [(-3090, -8930), (-3040, -8880), (-3000, -8830), (-2975, -8780), (-2958, -8736)]

TRACED = [
    ('mk_r_walden', 'Walden Point Road', WALDEN_PNT_RD, 6.5, 'paved', 'worn', 0.09, 2),
    ('mk_r_airport', 'Airport Road', AIRPORT_RD, 6.0, 'paved', 'worn', 0.10, 1),
    ('mk_r_skaters', 'Skaters Lake Road', SKATERS_LAKE_RD, 6.0, 'paved', 'worn', 0.10, 1),
    ('mk_r_graveyard', 'Oceanview Graveyard Road', GRAVEYARD_RD, 5.0, 'gravel', None, 0.11, 0),
    ('mk_r_raven', 'Raven Street', RAVEN_ST, 5.5, 'paved', 'worn', 0.10, 0),
    ('mk_r_wolf', 'Wolf Street', WOLF_ST, 5.0, 'gravel', None, 0.10, 0),
    ('mk_r_breakwater', 'Breakwater Road', BREAKWATER_RD, 6.0, 'paved', 'worn', 0.10, 1),
]


DROPPED = []


def trim_dry(x0, z0, x1, z1):
    """Cut a straight street back to its longest dry run."""
    n = max(2, int(math.hypot(x1 - x0, z1 - z0) / 10))
    dry = [coast_m(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n) >= 0 for k in range(n + 1)]
    best = (0, -1)
    i = 0
    while i <= n:
        if not dry[i]:
            i += 1
            continue
        j = i
        while j + 1 <= n and dry[j + 1]:
            j += 1
        if j - i > best[1] - best[0]:
            best = (i, j)
        i = j + 1
    a, b = best
    return (x0 + (x1 - x0) * a / n, z0 + (z1 - z0) * a / n,
            x0 + (x1 - x0) * b / n, z0 + (z1 - z0) * b / n)


def roads():
    del DROPPED[:]
    """Every street. The grid is `paved`/`worn` where the avenues carry the town
    (the first four and the cross streets that reach the water) and `gravel`
    behind; `smooth` rounds the corners of the traced lines (contract v1.19)."""
    out = []
    for i, (x0, z0, x1, z1, fam) in enumerate(STREETS):
        # A STREET DETECTOR FINDS FLOATS. The marina's finger floats and the
        # cannery's dock read exactly like a bright grey line on a dark ground,
        # so met_streets.py handed back a dozen of them. A candidate whose middle
        # is at sea, or whose ends will not come ashore, is not a street.
        if coast_m((x0 + x1) / 2, (z0 + z1) / 2) < 0:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'its middle is at sea'))
            continue
        # a street that reaches the shore is one the town keeps paved
        paved = min(dem(x0, z0), dem(x1, z1)) < 14.0
        (x0, z0), (x1, z1) = pull_inland(x0, z0, 22.0), pull_inland(x1, z1, 22.0)
        if min(coast_m(x0, z0), coast_m(x1, z1)) < 4.0:
            DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'an end will not come ashore'))
            continue
        # and a straight street may still cross a cove between its two dry ends
        n = max(2, int(math.hypot(x1 - x0, z1 - z0) / 15))
        wet = [k for k in range(n + 1)
               if coast_m(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n) < -3.0]
        if wet:
            x0, z0, x1, z1 = trim_dry(x0, z0, x1, z1)
            if math.hypot(x1 - x0, z1 - z0) < 70:
                DROPPED.append(('mk_s%s%02d' % (fam.lower(), i), 'it crosses the water'))
                continue
        out.append({'id': 'mk_s%s%02d' % (fam.lower(), i), 'pts': [pt(x0, z0), pt(x1, z1)],
                    'w': 6.0 if paved else 5.0, 'cls': 'paved' if paved else 'gravel',
                    'look': 'worn' if paved else None, 'band': 2 if paved else None,
                    'graded': True, 'falloff': 6, 'grade': 0.12, 'smooth': 0,
                    'traffic': 1 if paved else 0})
    for rid, name, pts, w, cls, look, grade, traffic in TRACED:
        out.append({'id': rid, 'pts': [pt(*pull_inland(*p, margin=18.0)) for p in pts], 'w': w, 'cls': cls, 'look': look,
                    'band': 2 if look else None, 'graded': True, 'falloff': 8 if w > 5.5 else 6,
                    'grade': grade, 'smooth': 30, 'traffic': traffic, 'rail': 'auto'})
    return out


# ---- the town's own grid, as a frame ------------------------------------------
# U runs along an avenue (grid bearing 43 deg), V across it, down a cross street.
UAX = (math.cos(math.radians(-47.0)), math.sin(math.radians(-47.0)))
VAX = (math.cos(math.radians(43.0)), math.sin(math.radians(43.0)))


def grect(cx, cz, a, b):
    """A rectangle in the town's own grid: `a` metres along an avenue either side
    of (cx, cz), `b` metres along a cross street."""
    out = []
    for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        out.append(pt(cx + su * a * UAX[0] + sv * b * VAX[0], cz + su * a * UAX[1] + sv * b * VAX[1]))
    return out


def face(dx, dz):
    """A site yaw whose single item faces the direction (dx, dz): the item's world
    yaw is at.yaw + pi (placeSite's convention, 27_premises.js ~:790), and a
    building's front is its +z, which a yaw Y sends to (sin Y, cos Y)."""
    return R(math.atan2(dx, dz) - math.pi, 4)


# ---- the landmarks, read off the registered close views -----------------------
# (id, name, key, x, z, facing) - facing is the direction the front looks
LANDMARKS = [
    ('mk_hall', 'Metlakatla Town Hall', 'house/town hall', -3462, -8724, VAX),
    ('mk_church_presb', 'Metlakatla Presbyterian Church', 'house/church', -3416, -8770, VAX),
    ('mk_church_duncan', 'William Duncan Memorial Church', 'house/church', -3466, -8635, VAX),
    ('mk_church_cong', 'Congregational Church', 'house/village church', -3300, -8620, VAX),
    ('mk_kingdom_hall', 'Kingdom Hall', 'house/chapel', -4128, -8332, VAX),
    ('mk_school_elem', 'Richard Johnson Elementary School', 'house/school', -3310, -8782, VAX),
    ('mk_school_high', 'Metlakatla High School', 'house/school', -3358, -8598, VAX),
    ('mk_store_acc', 'Alaska Commercial Company', 'house/general store', -3470, -8996, VAX),
    ('mk_cafe_als', "Al's American", 'house/cafe', -3466, -8681, VAX),
    ('mk_inn', 'Metlakatla Inn & Suites', 'house/motel', -3365, -8879, VAX),
    ('mk_museum', 'Duncan Cottage Museum', 'house/saltbox cottage', -3209, -8907, VAX),
    ('mk_post', 'United States Postal Service', 'house/post office', -3392, -8560, VAX),
    ('mk_police', 'Metlakatla Police', 'house/police', -3268, -8586, VAX),
    ('mk_clinic', 'Annette Island Service Unit', 'house/clinic', -3230, -8700, VAX),
    ('mk_fire', 'Metlakatla Fire Hall', 'big/fire hall', -3180, -8742, VAX),
    ('mk_credit_union', 'Tongass Federal Credit Union', 'big/technical services', -3224, -8714, VAX),
    ('mk_employment', 'Employment & Training', 'big/terminal', -3259, -8766, VAX),
    ('mk_senior', 'Metlakatla Senior Citizens Center', 'house/clinic', -3560, -8846, VAX),
    ('mk_longhouse', 'Metlakatla Long House', 'house/log cabin', -3672, -8683, VAX),
    ('mk_harbormaster', 'MIC Harbor master', 'house/air taxi office', -3858, -8685, VAX),
    ('mk_se_winds', 'Southeast Winds', 'big/workshop', -3855, -8615, VAX),
    ('mk_marine', 'Tongass Marine Supply', 'house/marine supply', -3820, -8660, VAX),
    ('mk_fuel_float', 'Harbour fuel', 'house/fuel and bait', -3790, -8700, VAX),
    ('mk_boatshed', 'Harbour boat shed', 'big/boat shed', -3800, -8630, VAX),
    ('mk_power', 'Alaska Power & Telephone', 'big/workshop', -3026, -8801, VAX),
    ('mk_minimart', 'Mini-mart', 'big/store', -2916, -8560, VAX),
    ('mk_gardens_shed', 'Metlakatla Indian Community Gardens', 'shed/tool shed', -2812, -8354, VAX),
    ('mk_coffee', 'Shadow Mountain Coffee', 'house/cafe', -1987, -8404, VAX),
    ('mk_gas', 'Annette Island gas fuel storage', 'big/fuel shed', -2379, -8513, VAX),
    ('mk_housing', 'Metlakatla Housing Authority', 'big/technical services', -3271, -7938, VAX),
    ('mk_social', 'MIC Social Services', 'big/terminal', -3279, -7838, VAX),
    ('mk_landscaping', 'Landscaping office', 'shed/tool shed', -2960, -8620, VAX),
    ('mk_wildlife', 'MIC Fish and Wildlife', 'shed/net store', -2980, -8880, VAX),
]

# the ball park is a SPORT_GEN entry, not a building
SPORTS = [
    ('mk_ballpark', 'Metlakatla Baseball Field', 'sport/ball park, lit', -3324, -8682),
    ('mk_court', 'Metlakatla hard court', 'sport/hard court', -3252, -8640),
]


def sites():
    out = []
    for sid, name, key, x, z, dirv in LANDMARKS + [(a, b, c, d, e, VAX) for a, b, c, d, e in SPORTS]:
        x, z = pull_inland(x, z, 26.0)
        out.append({'id': sid, 'name': name,
                    'at': {'x': R(x), 'z': R(z), 'yaw': face(dirv[0], dirv[1])},
                    'yard': None,
                    'items': [{'id': sid + '_1', 'key': key, 'x': 0, 'z': 0, 'yaw': 0,
                               'P': {}, 'onRoad': False, 'bottomOnRoad': False}],
                    'fences': []})
    return out


def hull(pts, margin=0.0):
    """The convex hull of these points, pushed out by `margin`, every corner then
    walked ashore. A zone was a rotated RECTANGLE first and it was wrong: the
    town's quarters are not rectangles, and the box around one of them reached
    400 m out to sea and half a kilometre into the muskeg behind."""
    P = sorted(set((round(float(x), 1), round(float(z), 1)) for x, z in pts))
    if len(P) < 3:
        return None
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower = []
    for q in P:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0:
            lower.pop()
        lower.append(q)
    upper = []
    for q in reversed(P):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0:
            upper.pop()
        upper.append(q)
    H = lower[:-1] + upper[:-1]
    cx = sum(q[0] for q in H) / len(H)
    cz = sum(q[1] for q in H) / len(H)
    out = []
    for x, z in H:
        dx, dz = x - cx, z - cz
        L = math.hypot(dx, dz) or 1.0
        out.append(pt(*pull_inland(x + dx / L * margin, z + dz / L * margin, 8.0)))
    return out


def road_belt_raw(pts, half):
    left, right = [], []
    for i, q in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / L, dx / L
        left.append(pt(q[0] + nx * half, q[1] + nz * half))
        right.append(pt(q[0] - nx * half, q[1] - nz * half))
    return left + right[::-1]


def to_waterline(x, z, step=12.0, tries=40):
    """Walk to the island's own waterline from wherever you start."""
    for _ in range(tries):
        c = coast_m(x, z)
        if abs(c) < 5.0:
            return x, z
        best, bx, bz = abs(c), x, z
        for k in range(16):
            a = math.pi * 2 * k / 16
            nx, nz = x + math.cos(a) * step, z + math.sin(a) * step
            v = abs(coast_m(nx, nz))
            if v < best:
                best, bx, bz = v, nx, nz
        if (bx, bz) == (x, z):
            return x, z
        x, z = bx, bz
    return x, z


def street_pts(x0, x1, z0, z1):
    out = []
    for a, b, c, d, fam in STREETS:
        for x, z in ((a, b), (c, d)):
            if x0 <= x <= x1 and z0 <= z <= z1:
                out.append((x, z))
    return out


# (id, kind, the window of streets it is cut from, margin)
ZONE_WINDOWS = [
    ('mk_z_core', 'commercial', (-3560, -3330, -8920, -8660), 26),
    ('mk_z_res_n', 'residential', (-3660, -3200, -9080, -8860), 26),
    ('mk_z_res_e', 'residential', (-3330, -2880, -8860, -8560), 26),
    ('mk_z_res_c', 'residential', (-3660, -3300, -8720, -8500), 26),
    ('mk_z_res_w', 'residential', (-4290, -3620, -8760, -8180), 26),
    ('mk_z_res_s', 'residential', (-3320, -2860, -8560, -8260), 26),
]
# the quarters with no street of their own in the table
ZONE_PTS = [
    ('mk_z_res_sub', 'residential',
     [(-3230, -8030), (-3170, -7960), (-3060, -7930), (-2960, -7900), (-2900, -7800),
      (-2860, -7770), (-3050, -7990), (-2930, -7840), (-3150, -8010)], 45),
    ('mk_z_ind', 'industrial',
     [(-3245, -9075), (-3090, -9080), (-3060, -8955), (-3210, -8945)], 25),
    ('mk_z_park_hayward', 'park', [(-3470, -9095), (-3400, -9105), (-3385, -9040), (-3455, -9030)], 18),
    ('mk_z_park_gardens', 'park', [(-2860, -8390), (-2780, -8380), (-2770, -8310), (-2850, -8320)], 22),
    ('mk_z_bayside', 'industrial',
     [(-1660, -8470), (-1500, -8420), (-1400, -8330), (-1560, -8380)], 40),
]
# the waterfront the harbour zone follows: read from the island's own coast field,
# so the piled houses and their jetties stand on the line the GAME draws, not on
# the one the satellite shows
SHORE_ANCHORS = [(-4120, -8640), (-4010, -8700), (-3900, -8770), (-3780, -8830),
                 (-3660, -8890), (-3560, -8950), (-3470, -9010), (-3400, -9060)]


def zones():
    out = []
    for zid, kind, win, margin in ZONE_WINDOWS:
        p = street_pts(*win)
        h = hull(p, margin) if len(p) >= 3 else None
        if h:
            out.append({'id': zid, 'kind': kind, 'poly': h, 'density': 1})
    for zid, kind, pts, margin in ZONE_PTS:
        h = hull(pts, margin)
        if h:
            out.append({'id': zid, 'kind': kind, 'poly': h, 'density': 1})
    # the harbour: a band astride the waterline - 45 m of beach inland, 55 m of
    # water in front, so KIND_RULES.harbour (waterOnly) can cut its plots
    line = [to_waterline(x, z) for x, z in SHORE_ANCHORS]
    out.append({'id': 'mk_z_harbour', 'kind': 'harbour',
                'poly': road_belt_raw(line, 50.0), 'density': 1})
    return out


# ---- the ground the town needs cut --------------------------------------------
# Every flatten is absolute, its level read off the DEM under its own middle.
def flat(fid, cx, cz, a, b, falloff=16, drop=0.0):
    return {'id': fid, 'kind': 'flatten', 'poly': grect(cx, cz, a, b),
            'level': R(dem(cx, cz) + drop, 2), 'falloff': falloff, 'abs': True, 'order': 0}


# The moles, read off the registered close view of the harbour at 0.45 m/px.
# (id, polyline, crest half width, crest height over the water)
BREAKWATERS = [
    # the outer hook: its head carries the entrance light
    ('mk_bw_outer', [(-4004, -8912), (-4048, -8864), (-4070, -8837), (-4086, -8801),
                     (-4086, -8760), (-4070, -8719), (-4030, -8682)], 9.0, 4.0),
    # the north-east L, and the entrance between the two
    ('mk_bw_ne', [(-3989, -8814), (-3920, -8868), (-3866, -8910), (-3825, -8873),
                  (-3793, -8837), (-3761, -8792), (-3725, -8714)], 8.0, 3.8),
    ('mk_bw_small', [(-3010, -8902), (-2968, -8944), (-2934, -8976)], 7.0, 3.6),
    ('mk_bw_bayside', [(-1700, -8500), (-1650, -8466), (-1604, -8448)], 7.0, 3.4),
]


def breakwater_poly(pts, half):
    """A mound along a line, as one simple polygon: the line offset both ways."""
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / L, dx / L
        left.append(pt(p[0] + nx * half, p[1] + nz * half))
        right.append(pt(p[0] - nx * half, p[1] - nz * half))
    return left + right[::-1]


def terrain():
    out = []
    # the mounds first: a breakwater is ground, raised out of the sea floor
    for bid, pts, half, h in BREAKWATERS:
        out.append({'id': bid, 'kind': 'flatten', 'poly': breakwater_poly(pts, half),
                    'level': R(h, 2), 'falloff': R(half * 2.2, 1), 'abs': True, 'order': 0})
    out += [
        # NOT the ball park, nor either school yard: a catalogue entry that says
        # ground.need 'flatten' cuts its OWN (SPORT_GEN and HOUSE_GEN both do), and
        # an authored one beside it is a second flatten at a different level over
        # the same ground - which the validator refuses (27_premises.js ~:1343).
        flat('mk_f_harbour_apron', -3840, -8680, 80, 40, 14),
        # the cannery's yard on the point - kept OFF the water, because a flatten
        # that reached out there raised the ground under its own wharf
        flat('mk_f_cannery', -3168, -9002, 58, 38, 16),
        flat('mk_f_gas', -2379, -8513, 55, 40, 14),
        # ON LAND: at its first position the level came off a cell the DEM clamps to 0
        # over the sea, and the flatten laid a sand-coloured table on the water
        flat('mk_f_bayside', *(lambda c: (c[0], c[1]))(pull_inland(-1520, -8398, 45.0)), 52, 34, 16),
        flat('mk_f_ferry_apron', -3520, -9060, 60, 35, 14),
    ]
    return out


def surface():
    S_PAVED, S_GRAVEL = 5, 6
    out = [
        {'id': 'mk_y_harbour', 'poly': grect(-3840, -8680, 80, 40), 'surface': S_PAVED, 'z': 0},
        {'id': 'mk_y_cannery', 'poly': grect(-3168, -9002, 58, 38), 'surface': S_PAVED, 'z': 0},
        {'id': 'mk_y_ferry', 'poly': grect(-3520, -9060, 60, 35), 'surface': S_GRAVEL, 'z': 0},
        {'id': 'mk_y_gas', 'poly': grect(-2379, -8513, 55, 40), 'surface': S_GRAVEL, 'z': 0},
        {'id': 'mk_y_bayside', 'poly': grect(*pull_inland(-1520, -8398, 45.0), 52, 34), 'surface': S_GRAVEL, 'z': 0},
    ]
    for bid, pts, half, h in BREAKWATERS:
        out.append({'id': bid.replace('mk_bw', 'mk_y_bw'), 'poly': breakwater_poly(pts, half),
                    'surface': 1, 'z': 1})          # SURFACE.ROCK: armour stone underfoot
    return out


def material():
    """Paved polygons only (`look`), never a `set`: the four-slot material map is
    painted over the union of the SET polygons, and Metlakatla is 9 km from the
    field - one map over both would give every yard three texels
    (render_premises.js ~:124). pavement.js draws a `look` polygon as geometry."""
    return [
        {'id': 'mk_m_harbour', 'poly': grect(-3840, -8680, 80, 40), 'look': 'worn', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_cannery', 'poly': grect(-3168, -9002, 58, 38), 'look': 'worn', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_ferry', 'poly': grect(-3520, -9060, 60, 35), 'look': 'gravel', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_gas', 'poly': grect(-2379, -8513, 55, 40), 'look': 'gravel', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
        {'id': 'mk_m_bayside', 'poly': grect(*pull_inland(-1520, -8398, 45.0), 52, 34), 'look': 'gravel', 'band': 4,
         'yaw': R(math.atan2(UAX[1], UAX[0]), 4), 'z': 1},
    ]


SKATERS_LAKE = [(-3200, -8400), (-3120, -8420), (-3010, -8405), (-2930, -8340), (-2900, -8250),
                (-2930, -8160), (-3010, -8105), (-3110, -8120), (-3180, -8200), (-3205, -8300)]


def exclude():
    return [
        {'id': 'mk_x_lake', 'poly': [pt(*p) for p in SKATERS_LAKE], 'what': ['trees', 'plots', 'settle']},
        {'id': 'mk_x_ballpark', 'poly': grect(-3324, -8682, 70, 60), 'what': ['trees', 'plots']},
        {'id': 'mk_x_quarry', 'poly': grect(-2660, -7740, 90, 70), 'what': ['trees', 'plots']},
    ]


# ---- the lusher vegetation, as a terrain type of its own ----------------------
# The layer is `ttype`, not `cover`: `coverAt` on the overlay already means what the
# COVER RING may plant at a point, and two unrelated things may not share a word.
# The user: "you will notice some more lush vegetation ... identify this as a new
# terrain type and give them the border biome for now ... that's where we have to
# use the border biome exactly", pointing at the bright green that borders Walden
# Point Road and fills the old cuts beside it. The `ttype` layer stamps terrain
# type 15 (`lush`) into the island's ttype grid at composition; 15 maps to the
# `borders` mix - deciduous shrubs, holly, raspberry, a birch here and there -
# which had been left orphaned when codes 7 and 14 were re-pointed on 2026-09-21.
LUSH_CUTS = [
    [(-2600, -8480), (-2380, -8420), (-2300, -8300), (-2480, -8250), (-2620, -8340)],
    [(-2150, -8380), (-1960, -8330), (-1900, -8220), (-2080, -8190), (-2180, -8280)],
    [(-1820, -8320), (-1620, -8270), (-1560, -8160), (-1740, -8130), (-1850, -8230)],
    [(-3080, -8620), (-2960, -8600), (-2900, -8500), (-3010, -8480), (-3090, -8540)],
]


def road_belt(pts, half):
    """A belt either side of a traced road - the corridor the alder takes."""
    return road_belt_raw(pts, half)


def ttype_stamps():
    out = [{'id': 'mk_tt_walden', 'poly': road_belt(WALDEN_PNT_RD, 55.0), 'code': 15},
           {'id': 'mk_tt_airport', 'poly': road_belt(AIRPORT_RD, 40.0), 'code': 15},
           {'id': 'mk_tt_skaters', 'poly': road_belt(SKATERS_LAKE_RD, 35.0), 'code': 15}]
    for i, poly in enumerate(LUSH_CUTS):
        out.append({'id': 'mk_tt_cut%d' % i, 'poly': [pt(*p) for p in poly], 'code': 15})
    # A MOLE IS ROCK. The terrain layer raises it out of the sea, but its cells
    # still carry ttype 0 and the ground would be drawn as water four metres up
    # in the air. Code 6 is `rock`, the island's own.
    for bid, pts, half, h in BREAKWATERS:
        out.append({'id': bid.replace('mk_bw', 'mk_tt_bw'), 'poly': breakwater_poly(pts, half + 2), 'code': 6})
    return out


# ---- the seaplane base --------------------------------------------------------
# Metlakatla's own is a float off the north point; the lane runs north-west of the
# town, parallel to the shore, where the channel is open. `surface: 4` makes it a
# SEA LANE: nothing graded, nothing painted, and the seaplanes spawn on it.
SEA_C = (-3980, -9420)
SEA_HDG = math.atan2(UAX[1], UAX[0])       # along the shore, grid bearing 43 deg
SEA_LEN, SEA_WID = 1500.0, 200.0


def runways():
    return [{'id': 'MKSEA', 'name': 'Metlakatla Seaplane Base', 'c': pt(*SEA_C), 'hdg': R(SEA_HDG, 4),
             'len': SEA_LEN, 'wid': SEA_WID, 'surface': 4, 'look': 'none', 'crossfall': 0,
             'disp': [0, 0], 'papi': [False, False], 'falloff': None, 'site': None,
             'pattern': None, 'profile': None, 'approach': None}]


def objects():
    """Poles down the paved avenues, and the town's own aeroplane on the float."""
    out = []
    n = 0
    for rid, name, pts, w, cls, look, grade, traffic in TRACED:
        if traffic < 1:
            continue
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            steps = max(1, int(L / 70))
            for k in range(steps):
                u = (k + 0.5) / steps
                x, z = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
                dx, dz = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                off = w / 2 + 2.5
                n += 1
                out.append({'id': 'mk_o_pole%d' % n, 'kind': 'prop',
                            'key': ['pole_a', 'pole_b', 'pole_c'][n % 3],
                            'x': R(x - dz * off), 'z': R(z + dx * off),
                            'yaw': R(math.atan2(dx, dz), 3), 'dy': 0, 'on': 'ground'})
    return out


# ---- what jolene_author.py splices in -----------------------------------------
def layers():
    return {'terrain': terrain(), 'surface': surface(), 'material': material(),
            'exclude': exclude(), 'roads': roads(), 'runways': runways(),
            'zones': zones(), 'sites': sites() + marine_sites(), 'links': [],
            'objects': objects(), 'ttype': ttype_stamps()}


def extent():
    """The town's own box, for the record's union."""
    xs, zs = [], []
    for L in layers().values():
        for e in L:
            for p in (e.get('poly') or e.get('pts') or []):
                xs.append(p[0])
                zs.append(p[1])
            if e.get('c'):
                xs += [e['c'][0] - e['len'] / 2, e['c'][0] + e['len'] / 2]
                zs += [e['c'][1] - e['len'] / 2, e['c'][1] + e['len'] / 2]
            if e.get('at'):
                xs.append(e['at']['x'])
                zs.append(e['at']['z'])
            if e.get('x') is not None and not e.get('poly'):
                xs.append(e['x'])
                zs.append(e['z'])
    return {'x0': math.floor(min(xs) - 120), 'z0': math.floor(min(zs) - 120),
            'x1': math.ceil(max(xs) + 120), 'z1': math.ceil(max(zs) + 120)}


def report():
    L = layers()
    print('METLAKATLA')
    for k, v in L.items():
        print('  %-9s %3d' % (k, len(v)))
    print('  extent   ', extent())
    bad = []
    for r in L['roads']:
        for i in range(len(r['pts'])):
            p = r['pts'][i]
            if coast_m(p[0], p[1]) < 0:
                bad.append((r['id'], p, round(coast_m(*p), 1)))
            if i + 1 < len(r['pts']):
                a, b = p, r['pts'][i + 1]
                n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 15))
                for k in range(1, n):
                    q = (a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)
                    if coast_m(*q) < -3.0:
                        bad.append((r['id'] + ' (mid)', [round(q[0], 1), round(q[1], 1)], round(coast_m(*q), 1)))
                        break
    print('  streets dropped:', len(DROPPED))
    for b in DROPPED:
        print('     ', b[0], '-', b[1])
    print('  road points off the land mask:', len(bad))
    for b in bad[:12]:
        print('     ', b)
    dry = [s['id'] for s in L['sites'] if not is_land(s['at']['x'], s['at']['z'])]
    print('  sites off the land mask:', dry)
    for r in L['runways']:
        print('  %s at %s, water under the ends:' % (r['id'], r['c']),
              [is_land(r['c'][0] + math.cos(r['hdg']) * s * r['len'] / 2,
                       r['c'][1] + math.sin(r['hdg']) * s * r['len'] / 2) for s in (-1, 1)])


if __name__ == '__main__':
    if '--json' in sys.argv:
        print(json.dumps(layers(), indent=1))
    else:
        report()


# ---- the harbour: what MARINE_GEN stands in the water -------------------------
# A marine item is NEVER pulled ashore - it is meant to be over the water - and it
# cuts no ground (`ground.need` is 'none'), so its piles reach the real seabed.
def axis(dx, dz):
    """A site yaw whose single item runs its +x along (dx, dz). An item's world
    yaw is at.yaw + pi, and a yaw Y sends the model's +x to (cos Y, -sin Y)."""
    return R(math.atan2(-dz, dx) - math.pi, 4)


def to_water(x, z, want=-14.0, step=9.0, tries=30):
    """Walk out until the point is `want` metres SEAWARD of the island's own
    waterline. The test is the coast field, not the DEM: the DTM is clamped at 0
    over the sea (there is no bathymetry in it - the seabed is synthesised by
    28_island.js seaFloor), so `dem <= -1` is never true anywhere and a float
    slid until it gave up. A float or a wharf traced at its true position starts
    on dry DEM for the same reason a shore street does: the 10 m grid's coastline
    sits some 30 m inland of the real one here."""
    for _ in range(tries):
        if coast_m(x, z) <= want:
            return x, z
        best, bx, bz = coast_m(x, z), x, z
        for k in range(16):
            a = math.pi * 2 * k / 16
            nx, nz = x + math.cos(a) * step, z + math.sin(a) * step
            c = coast_m(nx, nz)
            if c < best:
                best, bx, bz = c, nx, nz
        if (bx, bz) == (x, z):
            return x, z
        x, z = bx, bz
    return x, z


def seaward(x, z, r=40.0):
    """Which way the land ends here - the direction a pier has to run."""
    best, bc = None, 1e9
    for k in range(32):
        a = math.pi * 2 * k / 32
        c = coast_m(x + math.cos(a) * r, z + math.sin(a) * r)
        if c < bc:
            bc, best = c, (math.cos(a), math.sin(a))
    return best or (0.0, -1.0)


def wet_span(c, dirv, L, want=-6.0):
    """Slide a thing that floats until BOTH its ends are over water."""
    x, z = c
    for _ in range(26):
        a = (x - dirv[0] * L / 2, z - dirv[1] * L / 2)
        b = (x + dirv[0] * L / 2, z + dirv[1] * L / 2)
        if coast_m(*a) <= want and coast_m(*b) <= want:
            return x, z
        nx, nz = to_water(x, z, coast_m(x, z) - 8.0, 7.0, 1)
        if (nx, nz) == (x, z):
            break
        x, z = nx, nz
    return x, z


def along(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def pier(pid, name, preset, root, tip, P=None):
    """A pier is authored by its ROOT (at the beach) and its TIP (out in the
    water); the item's own frame wants the centre and the axis."""
    dx, dz = tip[0] - root[0], tip[1] - root[1]
    L = math.hypot(dx, dz)
    # A PIER STARTS AT THE BEACH THE GAME DRAWS. Traced at its true root it began
    # eight metres up the shore, because the 10 m DEM's waterline sits that far
    # inland of the real one - and the trestle then hung its deck below the ground
    # it grew out of, because the composer measures the water at the ITEM. The root
    # walks to the island's own waterline; the tip walks out until there is water.
    ux, uz = dx / L, dz / L
    root = to_waterline(root[0], root[1])
    tip = (root[0] + ux * L, root[1] + uz * L)
    while coast_m(*tip) > -8.0 and L < 260:
        L += 8.0
        tip = (root[0] + ux * L, root[1] + uz * L)
    dx, dz = tip[0] - root[0], tip[1] - root[1]
    return {'id': pid, 'name': name,
            'at': {'x': R((root[0] + tip[0]) / 2), 'z': R((root[1] + tip[1]) / 2), 'yaw': axis(dx / L, dz / L)},
            'yard': None, 'fences': [],
            'items': [{'id': pid + '_1', 'key': preset, 'x': 0, 'z': 0, 'yaw': 0,
                       'P': dict({'L': R(L, 1)}, **(P or {})), 'onRoad': False, 'bottomOnRoad': False}]}


def spot(sid, name, preset, c, dirv, P=None, wet=0.0):
    if wet:
        c = wet_span(c, dirv, wet)
    return {'id': sid, 'name': name,
            'at': {'x': R(c[0]), 'z': R(c[1]), 'yaw': axis(dirv[0], dirv[1])},
            'yard': None, 'fences': [],
            'items': [{'id': sid + '_1', 'key': preset, 'x': 0, 'z': 0, 'yaw': 0,
                       'P': dict(P or {}), 'onRoad': False, 'bottomOnRoad': False}]}


def marine_sites():
    out = []
    # THE NORTH POINT: the freight pier and, beside it, the trestle out to the
    # seaplane float - Metlakatla's own base, and the reason the SEA lane is here.
    out.append(pier('mk_mp_west', 'Metlakatla dock', 'marine/trestle pier, long',
                    (-3525, -9055), (-3571, -9110), {'w': 3.6, 'head': 1, 'headL': 20, 'headW': 13, 'deck': 3.4}))
    out.append(pier('mk_mp_air', 'Seaplane base trestle', 'marine/trestle pier',
                    (-3404, -9033), (-3356, -9106), {'w': 2.6, 'head': 0, 'deck': 2.6, 'lampSpc': 22}))
    out.append(spot('mk_mf_air', 'Metlakatla seaplane float', 'marine/seaplane float',
                    (-3351, -9114), UAX, {'gangway': 0, 'fingers': 2, 'fingerL': 13, 'floatL': 26}, wet=26))
    # THE BOAT HARBOUR: two rafts of finger floats behind the moles, the gangway
    # down from the apron on the shore side
    out.append(spot('mk_mf_harb_a', 'Metlakatla Boat Harbor floats', 'marine/boat harbour floats',
                    (-3905, -8790), VAX, {'floatL': 110, 'fingers': 12, 'fingerL': 13, 'pitch': 8.5, 'gangL': 18}, wet=110))
    out.append(spot('mk_mf_harb_b', 'Metlakatla Boat Harbor floats, inner', 'marine/boat harbour floats',
                    (-3878, -8776), VAX, {'floatL': 80, 'fingers': 9, 'fingerL': 12, 'pitch': 8.5, 'gangway': 0}, wet=80))
    # THE CANNERY: Annette Island Packing and the Maintenance Department stand on a
    # pile deck over the tide - the thing BIG_GEN cannot do (it has no stance).
    cw = seaward(-3124, -9042, 60)
    # THE MAINTENANCE DEPARTMENT AND THE PACKING PLANT STAND ON THE DECK. The user,
    # of the real thing: "a pack of warehouses on a floating structure". They are
    # BIG_GEN buildings, and BIG_GEN is the one generator that honours a `floorY`
    # handed in (27_premises.js placeItem keeps `Math.max(0.3, P.floorY)` for it),
    # which is how a shed gets to stand on a wharf instead of on the seabed.
    DECK = 3.4
    wharf = spot('mk_mw_cannery', 'Annette Island Packing', 'marine/wharf deck',
                 (-3124 + cw[0] * 46, -9042 + cw[1] * 46), (-cw[1], cw[0]),
                 {'L': 62, 'w': 30, 'deck': DECK, 'pilesPerBent': 8, 'rail': 0}, wet=62)
    for i, (key, lx, lz, P) in enumerate([
            ('big/cannery', -6, 1, {'L': 30, 'w': 14, 'eaveH': 6.2, 'signText': 'ANNETTE ISLAND PACKING'}),
            ('big/warehouse', 20, -6, {'L': 20, 'w': 11, 'eaveH': 5.0, 'dock': 0}),
            ('big/warehouse', 20, 7, {'L': 18, 'w': 10, 'eaveH': 4.6, 'dock': 0}),
            ('big/boat shed', -22, -5, {'L': 15, 'w': 9})]):
        wharf['items'].append({'id': 'mk_mw_cannery_b%d' % i, 'key': key, 'x': lx, 'z': lz, 'yaw': 0,
                               'P': dict({'floorOverWater': DECK + 0.22, 'plinth': 0, 'yard': 0}, **P),
                               'onRoad': False, 'bottomOnRoad': False})
    out.append(wharf)
    # the small harbour under Breakwater Road, by Alaska Power & Telephone
    out.append(spot('mk_mw_small', 'Metlakatla small boat dock', 'marine/wharf deck, small',
                    (-2946, -8902), VAX, {'L': 30, 'w': 14, 'deck': 3.0}, wet=30))
    out.append(spot('mk_mf_small', 'Small boat harbour floats', 'marine/boat harbour floats',
                    (-2995, -8862), VAX, {'floatL': 56, 'fingers': 6, 'fingerL': 9, 'pitch': 8, 'gangL': 12}, wet=56))
    # BAYSIDE, at the end of Walden Point Road: the dock, and the fish farm
    bd = seaward(-1540, -8398)
    out.append(pier('mk_mp_bayside', 'Bayside dock', 'marine/trestle pier',
                    (-1540, -8398), (-1540 + bd[0] * 55, -8398 + bd[1] * 55),
                    {'w': 3.2, 'head': 1, 'headL': 14, 'headW': 8}))
    out.append(spot('mk_mn_bayside', 'Bayside net pens', 'marine/net pens',
                    (-1392, -8360), VAX, {'rows': 2, 'cols': 4, 'pen': 13, 'netD': 10}, wet=54))
    # the armour on each mole: one straight run per segment, riding 0.3 m proud of
    # the mound the terrain layer raised, so the rubble reads as rubble
    for bid, pts, half, h in BREAKWATERS:
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            dx, dz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dz)
            if L < 12:
                continue
            last = (i == len(pts) - 2)
            out.append(spot(bid.replace('mk_bw', 'mk_ma') + '_%d' % i,
                            'breakwater armour', 'marine/breakwater' + (', light' if (last and bid == 'mk_bw_outer') else ''),
                            along(a, b, 0.5), (dx / L, dz / L),
                            {'L': R(L + 6, 1), 'crest': R(half * 2 - 1.2, 1), 'crestH': R(h + 0.3, 2),
                             'slope': 1.5, 'stones': 1, 'beacon': 1 if (i == 0 and bid == 'mk_bw_outer') else 0}))
    return out
