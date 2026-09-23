# ---------------------------------------------------------------------------
# JOLENE AFB — THE FIELD'S LIFE (2026-09-23, the user: "add some life into the
# WWII airport ... vehicles, props appropriate in a airport, slight debris and
# containers (realistic, but not very dirty), some people in little scenes,
# some smaller building in the woods, some utilities, some little stories being
# told. You may also further design a parking area for planes, with clear
# ground markings").
#
# A PART of tools/fixtures/island_jolene.json (see merge_parts in
# jolene_author.py): every id carries `af_`, every coordinate is the world's,
# and every entry is ordinary editor data — the user opens WORLD on the flight
# rail, clicks any of it and moves it.
#
# THE FRAME. The club sits at (-190, 690) turned a quarter, so its local axes
# read: world x = -190 + lz, world z = 690 - lx. Its flattened pad covers
# x -230..-120, z 610..770; the apron (the yard) is x -176..-136, z 650..750;
# the buildings stand along x -182..-204, z 642..672; the fence encloses
# x -222..-128, z 618..762 and now stops short of both taxiways. The taxiway V
# leaves the apron's east edge at (-135, 655) and (-115, 655).
#
# NOTHING STANDS WHERE AN AEROPLANE ROLLS. Every object here is outside the
# apron's rolling surface and the taxiways' 24 m width, or on the new parking
# apron where an aeroplane is meant to stop. The user's line: "Nothing that
# prevents the plane from rolling off."
# ---------------------------------------------------------------------------
import math

PREFIX = 'af_'

CLUB = (-190.0, 690.0)


def W(lx, lz):
    """the club's local frame -> the world (its yaw is a quarter turn)"""
    return (round(CLUB[0] + lz, 1), round(CLUB[1] - lx, 1))


def prop(i, key, x, z, yaw=0.0, dy=None):
    e = {'id': PREFIX + i, 'kind': 'prop', 'key': key, 'x': round(x, 1), 'z': round(z, 1),
         'yaw': round(yaw, 3), 'on': 'ground'}
    if dy is not None: e['dy'] = dy
    return e


def plane(i, key, x, z, yaw):
    return {'id': PREFIX + i, 'kind': 'aircraft', 'key': key, 'x': round(x, 1), 'z': round(z, 1), 'yaw': round(yaw, 3)}


E = -math.pi / 2          # a yaw that faces world +x (east, toward the apron)
N = math.pi               # ...and toward world -z
S = 0.0
Wst = math.pi / 2

OBJ = []

# ---- THE PARKING APRON'S OWN AEROPLANES -----------------------------------
# six marked stands, tails to the trees, noses east to the taxi lane; two of them
# taken (the club's own), the rest waiting for whoever the player flies in
STAND_X, STAND_Z0, STAND_PITCH = -207.0, 692.0 + 5.5, 11.0
for i, (k, s) in enumerate([('arch:cub', 1), ('arch:c172', 3)]):
    OBJ.append(plane('park%d' % (i + 1), k, STAND_X - 1.5, STAND_Z0 + s * STAND_PITCH, E + (0.03 if i else -0.02)))

# ---- 1. THE FUEL POINT, by the fuel shed at (-182, 742) --------------------
# the bowser backed up to the shed, its cans out, and somebody signing for it
OBJ += [
    prop('fuel_truck', 'auto_flatbed_unimog', -186.0, 737.0, E + 0.08),
    prop('fuel_can1', 'jerrycan_green', -184.2, 733.4, 0.7),
    prop('fuel_can2', 'jerrycan_green', -183.6, 732.8, 2.2),
    prop('fuel_tin', 'oil_tin', -185.4, 734.6, 1.1),
    prop('fuel_man', 'person_john', -184.6, 735.6, Wst - 0.4),
    prop('fuel_pallet', 'pallet_one', -188.6, 740.2, 0.3),
]

# ---- 2. THE FREIGHT RUN, at the long hangar's door (-193, 672) -------------
# a box truck nose-out at the door, the week's pallets off the back, two men on it
OBJ += [
    prop('frt_truck', 'auto_boxtruck_white', -186.5, 668.0, E - 0.06),
    prop('frt_pallets', 'pallets_stack', -190.0, 664.6, 0.25),
    prop('frt_pallets2', 'pallets_three', -192.2, 663.8, 1.9),
    prop('frt_cement', 'cement_bags', -194.4, 664.4, 0.6),
    prop('frt_man1', 'person_charles', -189.0, 666.6, Wst + 0.3),
    prop('frt_man2', 'person_luke', -191.6, 666.0, -0.6),
]

# ---- 3. THE FIRE COVER -----------------------------------------------------
# the field's one tender, nose out of its shed toward the taxiway, where it can be
# at either runway inside a minute
OBJ += [
    prop('fire_truck', 'truck_fire_small', -170.0, 626.0, E + 0.05),
    prop('fire_cans', 'bags_stack', -176.6, 623.4, 0.9),
]

# ---- 4. THE CLUB'S CORNER, by the clubhouse at (-184, 642) -----------------
# a table in the lee of the building, two people watching the circuit, a planter
# somebody's wife put there
OBJ += [
    prop('club_table', 'picnic_table', -180.4, 646.6, 0.35),
    prop('club_chair1', 'chair_wood', -178.6, 645.2, 2.1),
    prop('club_chair2', 'chair_plastic', -178.8, 648.2, -1.2),
    prop('club_man1', 'person_andrew', -179.6, 644.4, Wst + 0.8),
    prop('club_man2', 'person_koky', -181.2, 648.8, -2.4),
    prop('club_planter', 'planter', -183.2, 644.0, 0.0),
    prop('club_stool', 'stool_wood2', -180.0, 649.6, 0.5),
]

# ---- 5. THE CAR PARK, outside the fence off the club road ------------------
# four cars nose-in to the trees: whoever is flying today
CAR_ROW = [('auto_pickup_white', 0.0), ('auto_suv_blue', -0.04), ('auto_hatch_red', 0.03), ('auto_estate_white', -0.02)]
for i, (k, j) in enumerate(CAR_ROW):
    OBJ.append(prop('car%d' % (i + 1), k, -226.0, 700.0 + i * 6.0, N + j))

# ---- 6. THE WORKS CORNER, behind the hangars, west ------------------------
# where a field keeps what it might still need: pallets, blocks, drums, and the
# car that came apart in 1994 and never left. Slight, not squalid.
OBJ += [
    prop('wk_pallets', 'pallets_three', -214.0, 662.0, 1.2),
    prop('wk_cinder', 'cinder_pallet', -216.6, 658.6, 0.4),
    prop('wk_tin1', 'oil_tin', -212.4, 659.2, 2.6),
    prop('wk_tin2', 'oil_tin', -211.8, 658.4, 0.9),
    prop('wk_bags', 'bags_lean', -217.4, 663.6, 1.7),
    prop('wk_junk', 'car_junk', -220.0, 651.0, N + 0.5),
    prop('wk_fence', 'fence_old', -210.0, 655.0, S),
]

# ---- 7. THE TAXIWAY'S FURNITURE -------------------------------------------
# a works van at the hold, a pallet of markers, a man walking the edge lights
OBJ += [
    prop('tx_van', 'auto_van_connect', -104.0, 700.0, E + 0.2),
    prop('tx_pallet', 'pallet_one', -100.0, 703.0, 0.8),
    prop('tx_man', 'person_john', -97.0, 700.6, Wst),
]

# ---- 8. THE BALISAGE ------------------------------------------------------
# the user's photograph: a weathered enamel plate on two posts at each runway's
# hold, the numerals stencilled - 13/31 in red, 02/20 in black. A billboard with
# a generated key (BIG_GEN.rwySign), so the editor stands, turns, widens and
# deletes it like any other sign. Both sit ~50 m off their centreline, clear of
# the graded band and 26 m back from the hold, facing the taxiing pilot.
OBJ += [
    {'id': 'af_sign_13', 'kind': 'billboard', 'key': 'rwy:13/31:r', 'x': -88.9, 'z': 472.4, 'yaw': -0.45, 'w': 2.0},
    {'id': 'af_sign_02', 'kind': 'billboard', 'key': 'rwy:02/20', 'x': 176.0, 'z': 699.5, 'yaw': -1.806, 'w': 2.0},
]

PART = {
    # ---- THE PARKING APRON ------------------------------------------------
    # 22 x 66 m of worn concrete on the flat pad north of the hangars, inside the
    # fence, with SIX MARKED STANDS: a yellow lead-in line each and a nose-stop bar
    # across it. `stands` is the material polygon's own row - the editor shows it and
    # the pavement module paints it (PAVEMENT.standMarks).
    'material': [
        {'id': 'af_m_park', 'poly': [[-218.0, 692.0], [-196.0, 692.0], [-196.0, 758.0], [-218.0, 758.0]],
         'look': 'worn', 'band': 3, 'yaw': 0.0, 'z': 2, 'pav': {'paintAge': 0.45},
         'stands': {'n': 6, 'pitch': 11.0, 'lead': 10.0, 'bar': 2.8, 'u0': -7.0}},
    ],
    # the sim rolls on it: paved, and an apron (the stand finder may use it)
    'surface': [
        {'id': 'af_y_park', 'poly': [[-218.0, 692.0], [-196.0, 692.0], [-196.0, 758.0], [-218.0, 758.0]], 'surface': 5, 'apron': True},
    ],
    # ---- THE SMALL BUILDINGS IN THE WOODS ---------------------------------
    # not another compound: two lone sheds off the taxiway, the kind a field grows -
    # a pump house on the water line and a store for the markers and the mower
    'sites': [
        {'id': 'af_s_pump', 'name': 'Jolene AFB pump house', 'at': {'x': -96.0, 'z': 742.0, 'yaw': round(-math.pi / 2, 4)},
         'yard': {'x0': -9, 'x1': 9, 'z0': -7, 'z1': 9},
         'items': [{'id': 'pump', 'key': 'shed/tool shed', 'x': 0, 'z': 0, 'yaw': 0.0, 'P': {}, 'onRoad': False, 'bottomOnRoad': False},
                   {'id': 'wood', 'key': 'shed/wood shed', 'x': 12, 'z': -2, 'yaw': round(math.pi / 2, 4), 'P': {}, 'onRoad': False, 'bottomOnRoad': False}]},
        {'id': 'af_s_fire', 'name': 'Jolene AFB fire point', 'at': {'x': -176.0, 'z': 622.0, 'yaw': round(-math.pi / 2, 4)},
         'yard': {'x0': -11, 'x1': 11, 'z0': -8, 'z1': 10},
         'items': [{'id': 'bay', 'key': 'hangar/field shed, small', 'x': 0, 'z': 0, 'yaw': 0.0, 'P': {}, 'onRoad': False, 'bottomOnRoad': False}]},
    ],
    'objects': OBJ,
}
