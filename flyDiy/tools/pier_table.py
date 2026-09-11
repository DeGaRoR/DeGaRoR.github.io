#!/usr/bin/env python3
"""pier_table.py — THE DECLARED PIER KIT: the modular wooden pier and the
boats that tie up to it (G252, the user: "build more pier structure in front
of the houses ... A modular wooden pier system, please try and understand it
well, and a few boats. Please sanitize all of it, and make it game ready").

This is the hangar props' contract applied to a second library, and it is a
second TABLE rather than more rows in the first for one reason: the hangar's
registry is claimed row by row by its kits (GATE HANGAR rule 4), and a pier is
not in the hangar. Same baker (tools/prop_prep.py), same as-is rule, same one
material; its own packs (src/pier/), its own media (media/geo/pier,
media/tex/pier), its own gate (GATE HOUSE reads this table).

THE KIT, READ OFF THE FILE. Poly Haven's modular_wooden_pier ships SEVEN nodes
in one glTF sharing two materials — planks and poles — laid out end to end
down -z as the author's showcase. Measured in the delivered file:

    section_01  3.48 m long   the HEAD: the wide landing with a lower step
                              down toward the water (its planks reach 0.73)
    section_02  2.92 m        the PLAIN run
    section_03  2.93 m        a run with a lower ledge on one side
    section_04  3.04 m        a run whose deck steps down along its length
    section_05  0.46 m deep   the GATE: two 7 m poles and a crossbar — it sat
                              across the 02/03 joint in the showcase
    poles       3.08 m        a cluster of bare piles — a mooring dolphin
    planks      2.20 m        a bare deck plate — a filler between runs

Every section is ~2.5 m wide (x) and its deck top sits ~2.6-2.7 m above its
own pile bottoms; the four runs abut at their z ends with the planks
continuous, which is the whole meaning of "modular". So a module is selected
by NODE (all of them share both materials), placed by its DECK (`deck` names
the walking surface's material and the baker measures where its top sits
above the origin), and the placer strings them along z at each one's own
length.

THE BOATS are Sketchfab CC-BY exports and arrive every way an FBX can: one in
centimetres, one at a 40th of size, one along x, one spec-gloss, one skinned
to bones for an animation the game never plays. Every one of those is a RIGID
correction declared here — a scale, a quarter turn — or a conversion the baker
already knows (spec-gloss to metal-rough; a skin baked at its bind pose). No
geometry is cut, decimated or welded. A boat is placed by its WATERLINE, which
no exporter records: `float` is the fraction of the hull's height that sits
under water, declared per hull, and the placer does the subtraction.

Each row is props_table.py's P() plus:
  nodes   node names to keep (whole nodes; the pier kit's modules)
  deck    the walking surface's material name — the baker publishes deckY
  float   fraction of height below the waterline (boats)
"""

GROUPS = [
    ('pier', 'pier modules'),
    ('boat', 'boats'),
]

# `lic` drives what CREDITS.md must carry. Every boat is CC-BY-4.0 and needs
# visible attribution; the pier is CC0.
SOURCES = {
    'pier':  ('Modular Wooden Pier', 'Poly Haven', 'CC0',
              'https://polyhaven.com/a/modular_wooden_pier'),
    'skiff': ('boat', 'rohithbunty', 'CC-BY-4.0',
              'https://sketchfab.com/3d-models/boat-4af3074fb1224751b0758be164a66f9b'),
    'old':   ('Old Boat', 'donnichols', 'CC-BY-4.0',
              'https://sketchfab.com/3d-models/old-boat-a9ce4ca0cac14f448c72bb94ad193437'),
    'row':   ('Wooden Boat', 'usedm', 'CC-BY-4.0',
              'https://sketchfab.com/3d-models/wooden-boat-e5ee1cfb648549b78b374ae706bfc121'),
    'tirola': ('Docked venetian boat - low poly from scan - free', 'boat_dfk', 'CC-BY-4.0',
               'https://sketchfab.com/3d-models/docked-venetian-boat-low-poly-from-scan-free-53af885edaf044ac8d375b29305fe9ac'),
    'grady': ('Freedom 325 Grady White', 'BoatUS Foundation', 'CC-BY-4.0',
              'https://sketchfab.com/3d-models/freedom-325-grady-white-71ca8a73f97d44a98f92dd785e151b93'),
}

# the delivered files, under assets/woodenPierBoats/
FILES = {
    'pier':   'modular_wooden_pier_1k.gltf',
    'skiff':  'boat.glb',
    'old':    'old_boat.glb',
    'row':    'wooden_boat.glb',
    'tirola': 'docked_venetian_boat_-_low_poly_from_scan_-_free.glb',
    'grady':  'freedom_325_grady_white.glb',
}


def P(key, group, label, src, note, mats=None, nodes=None, place='floor',
      scale=1.0, rot=(0, 0, 0), tex=512, deck=None, float=None, piles=None,
      pilesCut=1.9):
    return dict(key=key, group=group, label=label, src=src, file=FILES[src],
                dir='pier' if src == 'pier' else '',
                mats=mats, nodes=nodes, place=place, scale=scale, rot=rot,
                tex=tex, note=note, deck=deck, float=float, piles=piles,
                pilesCut=pilesCut)


PLANKS = 'modular_wooden_pier_planks'
# EVERY MODULE KEEPS THE AUTHOR'S LEVEL (`place='level'`): the kit was
# registered to one deck at y 2.64 in the delivered file, with the stair
# module's low end at 1.24 - the two levels the path can be on - and each
# module's piles as long as its author cut them. `deck` publishes the walking
# level at each z end, which is what the planner joins.
POLES = 'modular_wooden_pier_poles'
# `piles` names the material the piles are made of; the baker finds each
# pile's foot so the generator can carry it on down to the seabed it stands
# over (`pilesCut` is the height below which a pole vertex is a pile and not a
# bearer - lower for the stair, whose deck is lower)
PIER = dict(src='pier', deck=PLANKS, tex=1024, place='level', piles=POLES)

PROPS = [
    # ---- the pier, module by module ------------------------------------------
    P('pier_run', 'pier', 'plain run',
      note='2.92 m of plain deck on four piles: the module most of a pier is',
      nodes=['modular_wooden_pier_section_02'], **PIER),
    P('pier_ledge', 'pier', 'run with a ladder',
      note='2.93 m run with a ladder down to the water across its z- end',
      nodes=['modular_wooden_pier_section_03'], **PIER),
    P('pier_step', 'pier', 'stair',
      note='3.05 m of stair: the deck at 2.62 at its z+ end and a landing at 1.24 at '
           'its z- end - the module that takes the path UP OR DOWN one level',
      nodes=['modular_wooden_pier_section_04'], **dict(PIER, pilesCut=0.6)),
    P('pier_head', 'pier', 'pier head',
      note='3.48 m landing with a ladder down at its z+ end and a tall post: the END '
           'of a pier, joined at its z- end',
      nodes=['modular_wooden_pier_section_01'], **PIER),
    P('pier_gate', 'pier', 'gate arch',
      note='two 7 m poles, a crossbar and a low kerb either side: the doorway, stood '
           'OVER a joint on the deck (the showcase has it astride the 02/03 seam)',
      nodes=['modular_wooden_pier_section_05'], src='pier', tex=1024, place='level',
      piles=POLES, pilesCut=0.6),
    P('pier_piles', 'pier', 'mooring piles',
      note='a cluster of bare piles: a dolphin to tie a boat to',
      nodes=['modular_wooden_pier_poles'], src='pier', tex=1024, place='level',
      piles=POLES),
    P('pier_deck', 'pier', 'deck plate',
      note='2.2 m of bare deck: a filler between two runs',
      nodes=['modular_wooden_pier_planks'], **PIER),

    # ---- the boats ------------------------------------------------------------
    # WHAT EACH ONE IS, looked at rather than read off its title (G254.2, the
    # user: "please understand what model is what, and resize accordingly").
    # "boat" is a painted open rowing boat with thwarts; "Old Boat" a clinker
    # rowing boat with its oars shipped; "Wooden Boat" is the one with a
    # windscreen and a flat transom - a small outboard runabout, delivered
    # WITHOUT its motor (the generator hangs one on it). Sizes are set from
    # what the hull is: a rowing boat is four metres, a runabout a bit more.
    P('boat_painted', 'boat', 'painted rowing boat', 'skiff',
      note='4.0 m open rowing boat with thwarts, painted; delivered at a 30th of size',
      scale=30.0, float=0.28, tex=1024),
    P('boat_clinker', 'boat', 'clinker rowing boat', 'old',
      note='4.2 m clinker rowing boat with its oars shipped; the export is in no '
           'known unit (6 m at a hundredth) - sized by its oars, 2.75 m',
      scale=0.007, float=0.30, tex=1024),
    P('boat_runabout', 'boat', 'outboard runabout', 'row',
      note='4.3 m runabout with a windscreen and a flat transom, delivered along x; '
           'turned to lie along z, bow to +z. No motor in the model: buildOutboard '
           'hangs one on the transom',
      scale=105.0, rot=(0, 90, 0), float=0.30, tex=512),
    P('boat_tirola', 'boat', 'scanned wooden boat', 'tirola',
      note='4.8 m boat from a photogrammetry scan; spec-gloss, converted by the baker',
      scale=1.0, float=0.30, tex=1024),
    P('boat_grady', 'boat', 'sport fisher', 'grady',
      note='9.8 m twin-outboard sport fisher, skinned to bones for propellers and wheel - '
           'baked at rest. 370k triangles: the big boat, for a long pier and rarely',
      scale=1.0, float=0.22, tex=512),
]
