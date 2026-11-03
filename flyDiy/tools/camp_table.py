#!/usr/bin/env python3
"""camp_table.py - THE DECLARED CAMPING KIT (ASSETS-OCT G3145, 2026-10-13): the user's four tents,
"add these tent models, after slicing through the new import workflow" (through A0). The FIRST
CUSTOMERS of the asset pipeline's spine (D:/Dev/flydiy-notes/ASSET-PIPELINE-PLAN-2026-10.md §3), run
by hand this once: licence -> scale -> route -> levels -> maps to budget -> KTX2 -> the registry -> the
budget gate.

LICENCE (each file's own asset.extras, read 13 Oct): all four Sketchfab CC BY 4.0, an author's own
upload (Sketchfab exporter, Collada / FBX sources, low-poly game assets - nothing ripped from a game).
`credit` is the line the credits screen carries.

ROUTE: CUT (the totem route), degenerate - every tent is already game-ready (0.55-3.4 k triangles, ONE
material on ONE set of 1024 maps), so it is baked AS-IS ([[import-models-as-is]]) and only the far levels
are cut (node tools/prop_lod.js --kit camp: prop_lod's 'camp' ladder, 1 200 past 20 m and 400 past 60 m;
the 553-triangle tent is under the ladder's floor and gets none). No REPROJECT: nothing here is a scan.

SCALE (the first bake, 14 Oct 06:17, GATE ASSETBUDGET's catch): three files are NORMALISED to a 2 m box (an
extent of exactly 2.00 m), not metres - so each is scaled by its type: the hiking tent x1.45 (a 2-person
tunnel with its vestibule, 2.9 m long, 0.93 m tall), the frame tent x1.7 (2 m tall: the cot inside must be
cot-sized), the small ridge tent as delivered (2 x 2 x 1.29 m). The big tent arrived 10.9 x 6.2 x 9.3 m with a
lamp hung near 4 m: x0.5 (a 3.1 m family / army tent, the lamp at head height). The user's look decides.

The sources: assets/camp/ (gitignored; delivered to D:/Dev/flydiy-notes/inbox/tents/, the names kept).
"""

GROUPS = [
    ('camp', 'camping and leisure'),
]

SRC = 'camp'


def C(title, author, handle, url):
    return dict(title=title, author=author, licence='CC BY 4.0',
                source='https://sketchfab.com/3d-models/' + url,
                line='"%s" by %s (sketchfab.com/%s), CC BY 4.0' % (title, author, handle))


def P(key, label, file, note, credit, tris, scale=1.0, opaque=False):
    row = dict(key=key, group='camp', label=label, src=key, dir=SRC, file=file, mats=None,
               place='floor', scale=scale, rot=(0, 0, 0), tex=1024, note=note, credit=credit,
               route='cut', tris=tris)
    if opaque:
        row['opaque'] = True
    return row


PROPS = [
    P('tent_hiking', 'hiking tent', 'hiking_tent.glb',
      'Low-poly hiking tent (fly, poles, side bits), 3.4 k tris, one material on 1024 maps. The material says '
      'alpha BLEND (the export\'s default, not a mesh door): baked OPAQUE so the fly does not sort as glass.',
      C('Hiking Tent', 'rileylane', 'rileylane', 'hiking-tent-441cd8395bf84bf9908375c35e07f809'), 3434, scale=1.45, opaque=True),
    P('tent_frame', 'frame tent with a cot', 'tent (1).glb',
      'Low-poly frame tent: the frame, the walls, the door and a camp bed inside; 3.2 k tris, one material.',
      C('Tent', 'alexxx_xarchenko', 'alexxx_xarchenko', 'tent-f6fef44f1e11487e8aec68123042cf03'), 3172, scale=1.7),
    P('tent_big', 'large camp tent with kit', 'tent (2).glb',
      'Low-poly large camp tent with its kit (a bag, a lamp and its battery, the holder); 2.1 k tris, '
      'one material, 15 meshes in the delivered file.',
      C('Tent', 'marsh_tt', 'marsh_tt', 'tent-e85539fc03a24eb3abc7cdb8699e52f2'), 2112, scale=0.5),
    P('tent_small', 'small ridge tent', 'tent.glb',
      'Low-poly ridge tent, 553 tris, one material: under every level\'s floor, no levels.',
      C('Tent', 'Tactical_Gamer', 'Tactical_Beard', 'tent-9006af5d7af4491dbb573fdddaf8b30b'), 553),
]

# prop_prep.py's provenance lookup: key -> (title, author, licence, source)
SOURCES = {r['key']: (r['credit']['title'], r['credit']['author'], 'CC-BY-4.0', r['credit']['source'])
           for r in PROPS}

# the spine's budget for the category (the plan's §3.2: a 'prop medium' - <= 10 k tris at L0, maps <= 1024)
BUDGET = dict(l0=10000, tex=1024, height=(0.8, 5.0), length=(1.2, 12.0))
