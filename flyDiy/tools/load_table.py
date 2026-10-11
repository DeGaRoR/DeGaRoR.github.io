#!/usr/bin/env python3
"""load_table.py — THE DECLARED LOADS: the freight's own models (FREIGHT-ASSETS,
G2405-G2409; futureDesigns/game/FREIGHT-2026-10-07.md §4/§4b).

The user (7 Oct): "The loads will need their own models. You are allowed to use
polyhaven if you find matching assets, otherwise I'll scout sketchfab."

A THIRD LIBRARY ON THE ONE BAKER, the pier kit's pattern (tools/pier_table.py):
same baker (tools/prop_prep.py via tools/load_prep.py), same as-is geometry,
same one material, same codec; its own packs (src/loads/), its own media
(media/geo/loads, media/tex/loads, media/geo/loads_lod), its own gate (GATE
LOADS, tools/_load_check.js). Not rows in props_table.py: GATE HANGAR rule 4
makes every hangar prop be claimed by exactly one hangar kit, and a mail bag
is not hangar furniture.

THE SOURCES are Poly Haven CC0, fetched as delivered by
`python tools/polyhaven_fetch.py <main checkout>/flyDiy/assets/loads <id>...`
into assets/loads/<id>/ (gitignored; a worktree reads the main checkout's,
media_lib.asset_src). Anything Poly Haven does not have is on the GAP LIST
(futureDesigns/game/FREIGHT-ASSETS-2026-10-07.md) for the user's Sketchfab
scouting - nothing from Sketchfab is downloaded without the user's OK.

GEOMETRY IS AS-IS ([[import-models-as-is]]): the bake is the delivered mesh, a
node or material SELECTION at most (the open tote's two lids are left out, the
camp set's table and chair are two props), a rigid turn where a node is
delivered at an angle. THE BUDGET (≤ ~2k triangles where a load is strapped
in a cabin, ≤ 512² maps) is met by the LEVELS, not by the bake:
`node tools/prop_lod.js --kit loads` cuts each prop's `_l1` (≤ 2 000 tris,
the in-cabin level, from 2 m) and `_l2` (400, from 15 m) beside the as-is,
which the loading view's close-up keeps. Textures: 512, 256 under half a
metre (the props rule).

Each row is pier_table.P() plus nothing: rows bake like any prop. What makes
a prop a FREIGHT ITEM is the CATALOGUE below, which also maps the EXISTING
props (props_table.py, pier_table.py) to the item kinds - existing first.
"""

GROUPS = [
    ('load', 'freight loads'),
    # §4b's mission dressing (camping, medevac): placed AT a site, not loaded
    ('camp', 'camp & mission'),
]

PH = 'https://polyhaven.com/a/'
SOURCES = {
    'medical_box':                 ('Medical Box', 'Poly Haven (Ulan Cabanilla)', 'CC0', PH + 'medical_box'),
    'plastic_crate_02':            ('Plastic Crate 02', 'Poly Haven (Fabi_G)', 'CC0', PH + 'plastic_crate_02'),
    'industrial_pastic_container': ('Industrial Plastic Container', 'Poly Haven (Galo Benivegna)', 'CC0', PH + 'industrial_pastic_container'),
    'plastic_container':           ('Plastic Container', 'Poly Haven (PierreB3D)', 'CC0', PH + 'plastic_container'),
    'wooden_crate_01':             ('Wooden Crate 01', 'Poly Haven (James Ray Cock)', 'CC0', PH + 'wooden_crate_01'),
    'ammo_box':                    ('Ammo Box', 'Poly Haven (DanKit)', 'CC0', PH + 'ammo_box'),
    'cement_bag':                  ('Cement Bag', 'Poly Haven (PierreB3D)', 'CC0', PH + 'cement_bag'),
    'portable_generator':          ('Portable Generator', 'Poly Haven (James Ray Cock)', 'CC0', PH + 'portable_generator'),
    'vintage_suitcase':            ('Vintage Suitcase', 'Poly Haven (Maximilian Schuster)', 'CC0', PH + 'vintage_suitcase'),
    'life_jacket':                 ('Life Jacket', 'Poly Haven (PierreB3D)', 'CC0', PH + 'life_jacket'),
    'stone_fire_pit':              ('Stone Fire Pit', 'Poly Haven (Sebastian Platen)', 'CC0', PH + 'stone_fire_pit'),
    'outdoor_table_chair_set_01':  ('Outdoor Table Chair Set 01', 'Poly Haven (James Ray Cock)', 'CC0', PH + 'outdoor_table_chair_set_01'),
    'wooden_lantern_01':           ('Wooden Lantern 01', 'Poly Haven (James Ray Cock)', 'CC0', PH + 'wooden_lantern_01'),
}


def P(key, group, label, src, note, mats=None, nodes=None, place='floor',
      scale=1.0, rot=(0, 0, 0), tex=512, opaque=False, slots=None,
      metalCap=None, roughMin=None):
    return dict(key=key, group=group, label=label, src=src,
                file=src + '_1k.gltf', dir=src,
                mats=mats, nodes=nodes, place=place, scale=scale, rot=rot,
                tex=tex, note=note, deck=None, float=None, piles=None,
                pilesCut=1.9, slots=slots, opaque=opaque, metalCap=metalCap,
                tone=None, roughMin=roughMin)


PROPS = [
    # ---- freight loads -------------------------------------------------------
    P('load_case_medical', 'load', 'medical case', 'medical_box',
      'the medevac\'s medical case: a green steel first-aid case, lid shut, '
      '0.52 x 0.10 x 0.35 m, 3.7k tris as delivered (five nodes, one map)'),
    P('load_fishbox', 'load', 'fish box', 'plastic_crate_02',
      'the cannery\'s stacking fish box - a vented yellow plastic crate, '
      '0.51 x 0.25 x 0.41 m; 5.8k tris (the vents are modelled)'),
    # The delivered tote stands with BOTH hinged lids flung open (rotated
    # nodes at +-100 deg). A rigid row cannot close them, so the body alone is
    # the tote - an open-topped fish tote, which is what a cannery's is.
    P('load_tote', 'load', 'plastic tote', 'industrial_pastic_container',
      'a blue attached-lid tote, the body only (its lids are delivered '
      'open and are left out): an open fish / supply tote, 0.35 x 0.42 x 0.63 m, 2.4k tris',
      nodes=['industrial_pastic_container']),
    P('load_tub', 'load', 'lidded storage tub', 'plastic_container',
      'a black tub with a red snap lid, 0.90 x 0.43 x 0.63 m: camping gear, '
      'groceries - the stand-in for a cooler until a real one is scouted'),
    P('load_crate_samples', 'load', 'sample crate', 'wooden_crate_01',
      'a lidded plank crate with a hasp, 0.83 x 0.34 x 0.41 m: the mine\'s '
      'ore samples (dense: heavy for its size)'),
    P('load_can_steel', 'load', 'steel ammo can', 'ammo_box',
      'a small steel ammunition can, 0.09 x 0.17 x 0.26 m: the hunting '
      'camp\'s, or a core-sample tin', tex=256),
    P('load_bag_cement', 'load', 'cement bag', 'cement_bag',
      'ONE 25 kg bag lying flat, 0.46 x 0.18 x 0.70 m, 844 tris - the unit a '
      'bulk load splits into (the user: "bulk loads split into bags")'),
    P('load_generator', 'load', 'portable generator', 'portable_generator',
      'a yellow 2.5 kVA generator in its tube frame, 0.82 x 0.58 x 0.56 m: '
      'cabin supply. 26k tris as delivered - the _l1 level carries it in a '
      'cabin. The dial glass is its own material'),
    # Delivered as TWO suitcases side by side, each node turned 180 deg about
    # x and scaled 1.59; the nodes of the first make one bag.
    P('load_suitcase', 'load', 'suitcase', 'vintage_suitcase',
      'a vintage green hard suitcase with travel stickers - passenger '
      'baggage; the first of the delivered pair',
      nodes=['vintage_suitcase_01_bottom', 'vintage_suitcase_01_top',
             'vintage_suitcase_01_clasp', 'vintage_suitcase_01_handle']),
    P('load_lifejacket', 'load', 'life jacket', 'life_jacket',
      'an orange keyhole life jacket, a floatplane\'s required kit and the '
      'camping trip\'s, 9k tris. Delivered standing up (0.99 m in y, front '
      'to +z); a quarter turn about x lays it face-up', rot=(-90, 0, 0)),

    # ---- camp & mission dressing (§4b) ---------------------------------------
    P('camp_firepit', 'camp', 'stone fire pit', 'stone_fire_pit',
      'a ring of stones round a bed of ash, 1.45 m across: the campfire '
      '(the smoke is the game\'s, not the model\'s)'),
    # one delivered file, a table and two chairs; the chairs are turned
    # 13.9 / 15.4 deg about y in the file - the row turns the first back square
    P('camp_table', 'camp', 'folding camp table', 'outdoor_table_chair_set_01',
      'a slatted folding table on steel legs, 0.69 x 0.73 x 0.69 m',
      nodes=['outdoor_table_chair_set_01_table']),
    P('camp_chair', 'camp', 'folding camp chair', 'outdoor_table_chair_set_01',
      'the folding slatted chair of the set, squared up',
      nodes=['outdoor_table_chair_set_01_chair_01'], rot=(0, -13.91, 0)),
    P('camp_lantern', 'camp', 'storm lantern', 'wooden_lantern_01',
      'a wooden storm lantern, 0.22 x 0.53 m with its handle, glass panes', tex=256),
]


# ---------------------------------------------------------------------------
# THE CATALOGUE: what each prop IS as freight. Read by GATE LOADS (which
# measures every prop's dims off its BAKED bin and asserts the row against
# them) and written out with the measured dims to src/loads/loads_catalogue.json
# by tools/load_prep.py - the file FREIGHT-MODEL reads for an item's dims.
#
#   key    a prop in props_table.py, pier_table.py or this table
#   kind   the packer's class (FREIGHT §1): crate | box | bag | drum | long | bulk
#   item   what the goods are, in a contract's words
#   kg     a sensible loaded mass (the contract may scale it)
#   rigid  holds its shape (a bag does not); stack: may carry another on top
#   fragile  goes on top / never under
# Existing props first (the user's ruling); the new ones after.
# ---------------------------------------------------------------------------
def C(key, kind, item, kg, rigid=True, stack=True, fragile=False, note=''):
    return dict(key=key, kind=kind, item=item, kg=kg, rigid=rigid, stack=stack,
                fragile=fragile, note=note)


CATALOGUE = [
    # ---- existing props (props_table.py: the hangar library) ----------------
    C('crate_wood_a', 'crate', 'crated parts', 25, note='0.41 m cube crate'),
    C('crate_wood_b', 'crate', 'crated parts, tall', 40),
    C('crate_wood_c', 'crate', 'crated parts, long', 45, note='1.01 m long: a long item\'s crate'),
    C('box_cardboard', 'box', 'groceries / mail parcel', 12),
    C('drum_steel', 'drum', '200 l fuel drum, full', 165, stack=False,
      note='0.93 m tall: an avgas / diesel drum (144 kg of fuel + 20 kg of steel)'),
    C('barrel_plastic', 'drum', 'water / food barrel', 120, stack=False),
    C('jerrycan', 'box', '10 l fuel can', 9),
    C('bottle_propane', 'drum', 'propane bottle (11 kg)', 23, stack=False),
    C('bottle_lpg', 'drum', 'propane bottle (15 kg)', 33, stack=False),
    C('toolchest_metal', 'crate', 'tool chest', 45),
    # ---- existing props (pier_table.py: the yard) ----------------------------
    C('bags_flat', 'bag', 'sack of soil / feed', 20, rigid=False),
    C('bag_compost', 'bag', 'sack, slumped', 20, rigid=False),
    C('jerrycan_green', 'box', '20 l fuel can', 19),
    C('oil_tin', 'box', '4 l oil tin', 4),
    C('pallet_one', 'bulk', 'empty pallet', 25, note='OVERSIZE as delivered: 1.72 x 1.17 m, against '
      'a 1.2 x 0.8 EUR pallet - no light aeroplane\'s door takes it; a belly-pod / Caravan item'),
    # ---- new (this table) ------------------------------------------------------
    C('load_case_medical', 'box', 'medical case', 6, fragile=True),
    C('load_fishbox', 'crate', 'box of fish on ice', 25),
    C('load_tote', 'crate', 'fish tote', 30, note='open-topped: carries nothing on top', stack=False),
    C('load_tub', 'box', 'camping gear / groceries tub', 30),
    C('load_crate_samples', 'crate', 'ore samples', 60),
    C('load_can_steel', 'box', 'ammunition / sample can', 7,
      note='small and dense: ~1 700 kg/m3, a can of cartridges or of core chips'),
    C('load_bag_cement', 'bag', 'cement bag', 25, rigid=False),
    C('load_generator', 'crate', 'portable generator', 70, stack=False),
    C('load_suitcase', 'box', 'passenger suitcase', 15),
    C('load_lifejacket', 'bag', 'life jacket', 1, rigid=False),
]
