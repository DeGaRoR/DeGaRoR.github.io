#!/usr/bin/env python3
"""animals_table.py — THE DECLARED ANIMAL TABLE.

The fourth table of the asset pipeline (props, chars, totems, animals), and it
follows the same law as the other three: THIS FILE IS THE ONLY AUTHORITY.
`tools/animal_prep.py` bakes exactly these rows; `tools/animal_lod.js` cuts
exactly the levels the SHEET here declares; GATE ANIMALS (tools/_animal_check.js)
reads this source and asserts the SHIPPED payload against it. Nothing
downstream discovers an animal by scanning a directory.

    assets/animals/<file>.glb       the delivered asset, byte-for-byte (gitignored)
    tools/animal_prep.py            the baker  -> media/geo/animals, media/tex/animals,
                                                 src/animals/<key>_animal.js
    tools/animal_lod.js             the levels -> src/animals/animals_lods.js (a PROP pack)
    src/core/55_animal_codec.js     the decoder (pure JS: page and node)
    src/viewer/animals.js           the ONE factory (skinned instance + ladder)
    src/viewer/animal_run.js        the behaviours (herd / pod / flock)
    futureDesigns/ANIMALS-2026-09-22.md   why any of it is shaped this way

FIVE THINGS ARE DECLARED HERE THAT CANNOT BE READ OFF A FILE
------------------------------------------------------------
1. `length` — the animal's REAL length in metres, nose to tail (a bird: its
   span across the wings). Every one of these exports is in a different unit;
   a `scale: 0.01` row is a fact about an exporter, a `length: 2.2` row is a
   fact about a bear. The baker MEASURES the rest mesh along `axis` and scales
   it to this, and prints both, so a re-export in other units changes nothing.

2. `forward` — which way the animal FACES in its own frame, as [dx, dz]. For
   anything with a gait this is measured, not believed: the baker compares it
   with the walk clip's own direction of travel and refuses a row that
   disagrees. For the three without one (both whales, the bird) it was read off
   an orthographic render of the rest mesh with the small parts coloured — the
   whales' eyes are at +z, the bird's beak at -z.

3. `spread` — how much the individuals of one hotspot differ in size, as a
   fraction either side of the declared length. A herd of identical animals is
   a tell, and a POD is not even meant to be uniform: an orca pod is a bull, a
   matriarch and calves, so the bull at 8.5 x 1.17 is ~10 m and a calf ~7. The
   payload is untouched - this is one scale on each individual at runtime.

4. `clips` — which of the delivered clips fills which ROLE. The bear ships 81
   and the elk 53, under names that are the vendor's own and not the same
   between them (the bear has `Stand_Idle_01`, the elk has only
   `Stand_Breathing_01`); the behaviour asks for a role, never for a name.
   The user's ruling, 2026-09-22: "don't author anything for the 2 first ones,
   they're great and complete, just do animations chaining clips."

5. `lodPose` — the (clip, second) the STATIC levels are skinned at. A bind
   pose is not a pose the animal is ever seen in (the bear's is up on its hind
   legs), and the level has to wear the silhouette it stands in for.

THE ROOT MOTION. The WildMesh locomotion clips walk the rig forward along +z
on the joint named by `rootJoint` (a bear's Walk travels 159 units in 1.67 s =
0.95 m/s at the measured scale — the right speed for a bear, which is what
confirms the unit). The baker EXTRACTS that translation into the clip's own
`travel` and zeroes it in the sampled frames, so the game drives the world
position and the feet do not skate. A row with `rootJoint=None` has clips that
run in place (both whales, the bird).
"""

# ---------------------------------------------------------------------------
# the roles the behaviour asks for, and what each one means. A row's `clips`
# maps role -> a delivered clip name, or a LIST of names (the behaviour picks
# one at random per bout, which is what makes six elk in a meadow not one elk
# six times). A role a row does not fill is simply absent; the behaviour falls
# back down this list.
# ---------------------------------------------------------------------------
ROLES = [
    ('idle',    'standing, doing nothing much'),
    ('browse',  'head down, feeding'),
    ('walk',    'the slow walk the herd wanders at'),
    ('trot',    'the hurried gait (a startled animal)'),
    ('lie',     'lying down, resting'),
    ('rear',    'up on the hind legs (the bear alone)'),
    ('toWalk',  'the transition idle -> walk'),
    ('toLie',   'the transition idle -> lying'),
    ('fromLie', 'the transition lying -> idle'),
    ('swim',    'the sea animals\' one loop'),
    ('flap',    'the bird\'s one loop'),
]

# the sampling grid per role, in frames a second. A breathing animal at 10 is
# indistinguishable from one at 30 and a third of the bytes; a gait is not.
FPS = {'idle': 10, 'browse': 10, 'lie': 10, 'rear': 10,
       'walk': 20, 'trot': 24, 'swim': 15, 'flap': 24,
       'toWalk': 15, 'toLie': 12, 'fromLie': 12}

# NOT BAKED, and why: the vendors' `Trans_TurnL/R` turn the BODY inside the
# clip, and the baker extracts a clip's translation but never its rotation. A
# machine that played one AND turned the heading would turn twice; one that
# played it and did not would leave the animal facing the old way. A walking
# animal arcs instead (animal_run.js `mood.turn`), which is what a quadruped
# does anyway. The clips are still in the delivered file if a later session
# wants them with rotation extraction behind it.
TURNS_NOT_BAKED = ['Trans_TurnL', 'Trans_TurnR']

WILDMESH = ('%s by WildMesh 3D (%s), licensed under Creative Commons '
            'Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/)')

ANIMALS = [
    # ---- THE LAND ANIMALS -------------------------------------------------
    dict(key='bear', label='Brown bear', kind='land',
         glb='assets/animals/realistic_animated_bear_3d_model.glb',
         src='realistic_animated_bear_3d_model.glb',
         credit=WILDMESH % ('"Realistic Animated Bear 3D Model"', 'https://skfb.ly/pwvXN'),
         length=2.20, axis='z', forward=[0, 1], spread=0.10, rootJoint='RigRoot_01',
         lodPose=('Stand_Idle_01', 0.0), tex=1024,
         # a bear is solitary and heavy: it wanders little and lies down often
         mood=dict(idle=0.50, browse=0.28, walk=0.14, lie=0.08, turn=0.5),
         clips=dict(idle=['Stand_Idle_01', 'Stand_Idle_02', 'Stand_Breathing_01'],
                    browse='Stand_Eating_01',
                    walk='WalkSlow', trot='Trot',
                    lie=['Lying_Breathing_01', 'Lying_Idle_01'],
                    rear='StandHind_Idle_01',
                    toWalk='Trans_Stand_to_WalkSlow',
                    toLie='Trans_Stand_to_Lying', fromLie='Trans_Lying_to_Stand')),

    dict(key='elk', label='Roosevelt elk', kind='land',
         glb='assets/animals/realistic_animated_elk_3d_model.glb',
         src='realistic_animated_elk_3d_model.glb',
         credit=WILDMESH % ('"Realistic Animated Elk 3D Model"', 'https://skfb.ly/pFGDA'),
         length=2.50, axis='z', forward=[0, 1], spread=0.11, rootJoint='RigRoot_01',
         lodPose=('Stand_Breathing_01', 0.0), tex=1024,
         mood=dict(idle=0.34, browse=0.34, walk=0.26, lie=0.06, turn=0.6),
         clips=dict(idle='Stand_Breathing_01', browse='Stand_Eating_01',
                    walk='WalkSlow', trot='Trot',
                    lie=['Lying_Breathing_01', 'Lying_Idle_02'],
                    toWalk='Trans_Stand_to_WalkSlow',
                    toLie='Trans_Stand_to_Lying', fromLie='Trans_Lying_to_Stand')),

    dict(key='doe', label='Sitka doe', kind='land',
         glb='assets/animals/realistic_animated_doe_3d_model.glb',
         src='realistic_animated_doe_3d_model.glb',
         credit=WILDMESH % ('"Realistic Animated Doe 3D Model"', 'https://skfb.ly/pKFFs'),
         length=1.60, axis='z', forward=[0, 1], spread=0.12, rootJoint='RigRoot_01',
         lodPose=('Stand_Idle_02', 0.0), tex=1024,
         # a doe browses nearly all the time and is quick to move on
         mood=dict(idle=0.26, browse=0.42, walk=0.28, lie=0.04, turn=0.7),
         clips=dict(idle=['Stand_Idle_02', 'Stand_Breathing_01'], browse='Stand_Eating_01',
                    walk='WalkSlow', trot='Trot',
                    lie=['Lying_Breathing_01', 'Lying_Idle_02'],
                    toWalk='Trans_Stand_to_WalkSlow',
                    toLie='Trans_Stand_to_Lying', fromLie='Trans_Lying_to_Stand')),

    # ---- THE SEA ANIMALS --------------------------------------------------
    # One loop each, and it is the BODY's loop only: the dive, the surfacing
    # and the circuit are root motion (ANIMALS-2026-09-22 §2.2). `sea` carries
    # the numbers the behaviour swims by.
    dict(key='orca', label='Killer whale', kind='sea',
         glb='assets/animals/killer_whale.glb', src='killer_whale.glb',
         credit='"Killer Whale" by Trouvaille (https://skfb.ly/6SI7C), licensed under '
                'Creative Commons Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/)',
         # 8.5 m is a mature BULL - the length a pod is read by (a male runs 8-9.8 m, a
         # female 5.5-6.6; `spread` below gives the pod its own range either side of this).
         # 7.5 was a female's length used for every animal in the pod, which made a pod of
         # small orca. The declared length is the measure; the baker scales the mesh to it.
         length=8.50, axis='z', forward=[0, 1], rootJoint=None, spread=0.17,
         lodPose=('Take 001', 0.0), tex=1024,
         sea=dict(speed=3.4, depth=12, cycle=48, surface=0.22, blow=1.0, beam=1.8, float=0.8),
         clips=dict(swim='Take 001')),

    dict(key='whale', label='Blue whale', kind='sea',
         glb='assets/animals/blue_whale_-_textured.glb', src='blue_whale_-_textured.glb',
         credit='"Blue Whale - Textured" by Bohdan Lvov (https://skfb.ly/67RFV), licensed under '
                'Creative Commons Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/)',
         length=25.0, axis='z', forward=[0, 1], spread=0.07, rootJoint=None,
         lodPose=('Swimming', 1.0), tex=1024,
         sea=dict(speed=2.6, depth=28, cycle=90, surface=0.20, blow=2.6, beam=4.2, float=1.6),
         clips=dict(swim='Swimming')),

    # ---- THE BIRD ---------------------------------------------------------
    # The delivered file is ALREADY A FLOCK: five armatures, five skins, one
    # shared 0.67 s flap. `skin` and `meshes` select the first bird; the V is
    # the runtime's business (animal_run.js). No maps at all — the author gave
    # the body a flat black and the beak a flat yellow, which against the sky
    # at 200 m is the whole of what a bird is.
    dict(key='bird', label='Gull', kind='air',
         glb='assets/animals/bird.glb', src='bird.glb',
         credit='"Bird" by Blender Artist (Sketchfab), licensed under Creative Commons '
                'Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/)',
         length=1.10, axis='x', forward=[0, -1], spread=0.09, rootJoint=None, skin=0, meshes=[9, 10],
         lodPose=None, tex=512,
         air=dict(speed=11.0, flapHz=1.0, glide=0.35),
         clips=dict(flap='Scene')),
]

# THE SHEET — the levels, by kind: [[target triangles or a share, metres], ...].
# These are GAME assets, not photoscans (the heaviest is 7 886 triangles), so
# the base ships AS-IS, exactly as the props and the chars do, and only the
# levels are cut. What the ladder is for here is COUNT, not weight: nine elk
# and four flocks are many instances of a small mesh. A level whose target is
# not well under its parent (< 0.7) is not cut at all, so the bird (162
# triangles a bird) gets none.
SHEET = {
    'land': [[0.30, 40], [0.09, 140]],
    'sea':  [[0.35, 90], [0.10, 320]],     # a whale is 25 m long: it is still a shape at 300 m
    'air':  [],
}

SOURCES = [
    dict(key='bear', title='Realistic Animated Bear 3D Model', author='WildMesh 3D',
         url='https://skfb.ly/pwvXN', licence='CC-BY 4.0'),
    dict(key='elk', title='Realistic Animated Elk 3D Model', author='WildMesh 3D',
         url='https://skfb.ly/pFGDA', licence='CC-BY 4.0'),
    dict(key='doe', title='Realistic Animated Doe 3D Model', author='WildMesh 3D',
         url='https://skfb.ly/pKFFs', licence='CC-BY 4.0'),
    dict(key='whale', title='Blue Whale - Textured', author='Bohdan Lvov',
         url='https://skfb.ly/67RFV', licence='CC-BY 4.0'),
    dict(key='orca', title='Killer Whale', author='Trouvaille',
         url='https://skfb.ly/6SI7C', licence='CC-BY 4.0'),
    # the listing's short url is the one thing still owed on this row (the page
    # was read off the author's own download dialog: title, author, licence)
    dict(key='bird', title='Bird', author='Blender Artist',
         url='sketchfab.com (listing url owed)', licence='CC-BY 4.0'),
]

# nothing was discarded from this batch — every delivered file is in the table
DISCARDED = []
