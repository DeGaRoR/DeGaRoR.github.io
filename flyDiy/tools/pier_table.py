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
    # THE SCALE REFERENCE (G255, the user: "throw him on the porch so we have
    # an idea"). Two static people from the user's own BlenderKit export, at
    # their delivered height (1.82 and 1.84 m - checked, and right for a man in
    # boots). They are the metre stick every doubt about a deck's width or a
    # pier's planks is settled against.
    ('people', 'people'),
    # THE YARD (G273, the user: "I have added new assets in the asset/propHouse
    # folder. There's also an outdoor lamp that could work as the porch lamp"):
    # what stands around a house rather than in a hangar - a wall lamp by the
    # door, compost bags against the wall, a planter on the deck, a jerrycan.
    # Same baker, same one material; their own group so the generator's yard
    # planner can read them as a set.
    ('yard', 'around the house'),
    # THE CARS (G276, the user: "I have added some game-ready abandoned car
    # assets in asset/abandonedCars ... I would like these to be placed on
    # the property lots, in the backyard preferably"). Sketchfab CC-BY, every
    # one; imported as-is, a rigid scale and a quarter turn where the export
    # needs it, so each lies along z with its nose to +z and its wheels on
    # y = 0. `cars.glb` (eight cars, 577k triangles in one file) is left out.
    ('car', 'abandoned cars'),
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
    # the user's own export from BlenderKit's people; the licence is the one
    # BlenderKit granted for the pack, which this table cannot read
    'andrew': ('Andrew (static)', 'BlenderKit, via blendkitPeople.blend', 'BlenderKit licence',
               'https://www.blenderkit.com/'),
    'john':   ('John (static)', 'BlenderKit, via blendkitPeople.blend', 'BlenderKit licence',
               'https://www.blenderkit.com/'),
    # G280: three more, all in ONE export (charles.glb, koky.glb and luke.glb
    # are byte-identical whole-scene files); selected by node
    'crowd':  ('Charles, Luke, Koky (static)', 'BlenderKit, via blendkitPeople.blend', 'BlenderKit licence',
               'https://www.blenderkit.com/'),
    # the yard, all Poly Haven CC0, delivered under assets/propsHouse/
    'walllamp': ('Industrial Wall Lamp', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/industrial_wall_lamp'),
    'bags':     ('Compost Bags', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/compost_bags'),
    'bag02':    ('Compost Bag 02', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/compost_bag_02'),
    'jerrygreen': ('Metal Jerrycan Green', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/metal_jerrycan_green'),
    'planter':  ('Planter Box 03', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/planter_box_03'),
    # the village's scanned fence (G275), CC-BY: attribution must stay visible
    'oldfence': ('Old fence', 'Yury Misiyuk', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/old-fence-3a98eabc0aa9475db5fcf7fab235751b'),
    # the cars, under assets/abandonedCars/
    'junkcar':  ('Abandoned & junk Car', 'Plexus Game Assets', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/abandoned-junk-car-8bc4f3b8b7d94b6bb1e1ab0b8a2d0f42'),
    'fiat':     ('Abandoned Car - Fiat 132', 'ROH3D', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/abandoned-car-fiat-132'),
    'hudson':   ('Abandoned Car - Hudson Hornet', 'ROH3D', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/abandoned-car-hudson-hornet'),
    'multicab': ('Abandoned car / vehicle (Multicab) 3D Scan', 'Alben Tan', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/abandoned-car-vehicle-multicab-3d-scan'),
    'crashed':  ('Crashed Abandoned Car - Game Ready', 'Rashad Ibrahimli', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/crashed-abandoned-car-game-ready'),
    'buick':    ('FREE Abandoned 1950s American Car (Buick)', 'Libau Media', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/free-abandoned-1950s-american-car-buick'),
    'kcar':     ('Reliant K Car', 'Renafox', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/reliant-k-car'),
}

# the delivered files, under assets/woodenPierBoats/
FILES = {
    'pier':   'modular_wooden_pier_1k.gltf',
    'skiff':  'boat.glb',
    'old':    'old_boat.glb',
    'row':    'wooden_boat.glb',
    'tirola': 'docked_venetian_boat_-_low_poly_from_scan_-_free.glb',
    'grady':  'freedom_325_grady_white.glb',
    'andrew': 'andrew.glb',
    'john':   'john.glb',
    'crowd':  'charles.glb',
    'walllamp': 'industrial_wall_lamp_1k.gltf',
    'bags':     'compost_bags_1k.gltf',
    'bag02':    'compost_bag_02_1k.gltf',
    'jerrygreen': 'metal_jerrycan_green_1k.gltf',
    'planter':  'planter_box_03_1k.gltf',
    'oldfence': 'old_fence.glb',
    'junkcar':  'abandoned__junk_car.glb',
    'fiat':     'abandoned_car_-_fiat_132.glb',
    'hudson':   'abandoned_car_-_hudson_hornet.glb',
    'multicab': 'abandoned_car__vehicle_multicab_3d_scan.glb',
    'crashed':  'crashed_abandoned_car_-_game_ready.glb',
    'buick':    'free_abandoned_1950s_american_car_buick.glb',
    'kcar':     'reliant_k_car.glb',
}
# where each source's file lives, relative to assets/woodenPierBoats/
DIRS = {
    'pier': 'pier', 'andrew': '../blendkitPeople', 'john': '../blendkitPeople',
    'crowd': '../blendkitPeople',
    'walllamp': '../propsHouse/industrial_wall_lamp',
    'bags': '../propsHouse/compost_bags', 'bag02': '../propsHouse/compost_bag_02',
    'jerrygreen': '../propsHouse/metal_jerrycan_green',
    'planter': '../propsHouse/planter_box_03',
    'oldfence': '../propsHouse',
    'junkcar': '../abandonedCars', 'fiat': '../abandonedCars', 'hudson': '../abandonedCars',
    'multicab': '../abandonedCars', 'crashed': '../abandonedCars', 'buick': '../abandonedCars',
    'kcar': '../abandonedCars',
}


def P(key, group, label, src, note, mats=None, nodes=None, place='floor',
      scale=1.0, rot=(0, 0, 0), tex=512, deck=None, float=None, piles=None,
      pilesCut=1.9, slots=None, opaque=False):
    return dict(key=key, group=group, label=label, src=src, file=FILES[src],
                dir=DIRS.get(src, ''),
                mats=mats, nodes=nodes, place=place, scale=scale, rot=rot,
                tex=tex, note=note, deck=deck, float=float, piles=piles,
                pilesCut=pilesCut, slots=slots, opaque=opaque)


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

    # ---- the people ---------------------------------------------------------
    # THE EXPORT WIRED THEIR SLOTS WRONG (G258): the albedo landed in the
    # normal slot and the subsurface map in base colour - Blender's exporter
    # reading a subsurface shader graph - and both men rendered as beaten
    # metal. `slots` says which image is what; the baker refuses the false
    # normal on its own anyway (it is not tangent-space).
    P('person_andrew', 'people', 'Andrew, on his phone', 'andrew',
      note='1.82 m, standing, looking at his phone; 355k triangles as delivered',
      tex=1024, slots={'Andrew': {'bc': 'andrew_albedo', 'nor': None, 'rough': 0.78}}),
    P('person_john', 'people', 'John, with his notes', 'john',
      note='1.84 m, standing, reading; 310k triangles as delivered', tex=1024,
      slots={'John': {'bc': 'John_albedo', 'nor': None, 'rough': 0.78},
             'notes': {'bc': 'notes_albedo', 'nor': None, 'rough': 0.85}}),
    # THE THREE MORE (G280, the user: "I have added new people too. Warning,
    # charles needs to have his back resting on a wall"). One export holds the
    # whole scene - six figures, a campfire prop and a rigged Character
    # Creator body - so each is a NODE out of it, at the delivered height,
    # the same slot rewiring the first two needed. Charles leans: his back is
    # the flat face at his own z = 0 and he stands out to +z, so he is placed
    # with -z against a wall.
    P('person_charles', 'people', 'Charles, leaning on a wall', 'crowd',
      note='1.72 m, back to a wall (his z = 0), 175k triangles', tex=1024,
      nodes=['Charles'], slots={'Charles': {'bc': 'Charles_albedo', 'nor': None, 'rough': 0.8}}),
    P('person_luke', 'people', 'Luke, on his phone', 'crowd',
      note='1.62 m, standing; 129k triangles', tex=1024,
      nodes=['Luke'], slots={'Luke': {'bc': 'Luke_albedo', 'nor': None, 'rough': 0.8}}),
    P('person_koky', 'people', 'Koky', 'crowd',
      note='1.74 m, standing; 332k triangles', tex=1024,
      nodes=['Koky'], slots={'Koky': {'bc': 'koky_albedo', 'nor': None, 'rough': 0.8}}),

    # ---- the yard (G273) ----------------------------------------------------
    # THE WALL LAMP is the porch light now: its origin is the mount plate
    # (place 'wall', left as delivered), the fixture stands 0.14 m off the wall
    # along +z and the glass carries the author's emissive; the generator
    # publishes the bulb's position and the bench stands a real light in it.
    P('lamp_wall', 'yard', 'wall lamp', 'walllamp', place='wall',
      note='cast industrial wall lamp, 0.27 x 0.43 m, emissive glass; +z is off the wall'),
    P('bags_stack', 'yard', 'compost bags, stacked', 'bags',
      note='three bags stacked flat: the pile by the shed door',
      nodes=['compost_bags_floorstacked'], opaque=True),
    P('bags_lean', 'yard', 'compost bags, leaning', 'bags',
      note='two bags leaning against a wall (their back is at -z)',
      nodes=['compost_bags_leaning'], opaque=True),
    P('bags_flat', 'yard', 'compost bag, dropped', 'bags',
      note='one bag dropped flat', nodes=['compost_bags_floor'], opaque=True),
    P('bags_stand', 'yard', 'compost bag, standing', 'bags',
      note='one bag stood on end', nodes=['compost_bags_standing'], opaque=True),
    P('bag_compost', 'yard', 'compost bag', 'bag02',
      note='a half-empty bag slumped on the ground'),
    P('jerrycan_green', 'yard', 'green jerrycan', 'jerrygreen',
      note='20 l steel jerrycan, all five parts', tex=256),
    P('planter', 'yard', 'planter box', 'planter',
      note='0.9 m wooden planter box with a shrub in it'),
    # THE OLD FENCE (G275, the user: "I have added 1 model in the asset folder,
    # propsHouses. It's green. I think it's only one of those you should
    # use"): one 4.6 m stretch of leaning green pickets, delivered in
    # centimetres along x; the village lays it end to end on some plots and
    # draws its own fence on the others
    P('fence_old', 'yard', 'old picket fence, 4.6 m', 'oldfence',
      note='4.6 m run of green pickets on leaning posts, Sketchfab CC-BY; along x, the '
           'origin at its centre on the ground. THE EXPORT CALLED IT METAL (G280): its '
           'metallicFactor is 1 over a map that is really the occlusion, so it mirrored '
           'the sky and read as white - painted wood is metalness 0',
      scale=0.01, tex=512, slots={'Scene_-_Root': {'metal': 0.0, 'rough': 0.9}}),

    # ---- the cars (G276) ----------------------------------------------------
    # THREE OF THEM WERE MIRRORS (G280, the user: "The abandoned cars also
    # appear transparent"): their exports say metallicFactor 1 over a
    # metal-rough map whose blue is mostly white, so a rusted-out body
    # reflected the sky like chrome and read as glass. Rust and old paint are
    # dielectrics: the row sets the metalness to a tenth (times the map).
    P('car_junk', 'car', 'junk car', 'junkcar',
      note='a burnt-out saloon, 29k triangles, five materials; delivered along x, turned to z',
      rot=(0, 90, 0), tex=512),
    P('car_fiat', 'car', 'Fiat 132', 'fiat',
      note='rusted Fiat 132, delivered in millimetres', scale=0.001, tex=512, opaque=True, slots={'LowPoly__Fiat_132_1977carpaint': {'metal': 0.1}}),
    P('car_hudson', 'car', 'Hudson Hornet', 'hudson',
      note='rusted 1950s Hudson, delivered in millimetres', scale=0.001, tex=512, opaque=True, slots={'Body': {'metal': 0.1}}),
    P('car_multicab', 'car', 'multicab', 'multicab',
      note='a photogrammetry scan of a small utility truck', tex=512),
    P('car_crashed', 'car', 'crashed car', 'crashed',
      note='a wreck with its bonnet up, ten parts; delivered half as big again as a car '
           '(7.6 m long) - 0.6 makes it 4.6', scale=0.6, tex=512, slots={'Material': {'metal': 0.1}}),
    P('car_buick', 'car', 'Buick', 'buick',
      note='1950s Buick, 94k triangles and 29 materials: the big one, used rarely; 5.9 m '
           'as delivered, 0.92 for a 5.4 m car', scale=0.92, tex=512),
    P('car_kcar', 'car', 'Reliant K', 'kcar',
      note='an 80s K-car, 2k triangles; 5.3 m as delivered, 0.86 for the 4.5 m it was',
      scale=0.86, tex=512),
]
