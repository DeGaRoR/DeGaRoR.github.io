#!/usr/bin/env python3
"""totem_table.py — THE DECLARED TOTEM POLES (2026-09-13, the user: "I have
some totem meshes in the asset folder. I'd want them integrated as assets,
and usable by the house generator ... The goal is to generate a patch of
terrain with these poles, inspired by the attached picture [a Saxman-style
totem park: carved poles on a lawn before a painted clan house]. These
assets are photoscans and need to be decimated, at least for generating
LODs").

Seven photogrammetry scans, every one Sketchfab CC-BY-4.0, delivered under
assets/totems/. Same baker as the hangar props and the pier kit
(tools/prop_prep.py), the same one material, the same codec; its own packs
(src/totems/), its own media (media/geo/totems, media/tex/totems), its own
gate (GATE TOTEM reads this table).

THIS TABLE BREAKS THE AS-IS RULE, ON PURPOSE AND BY RULING. A scan is
300-440k triangles for a single carved log with one 1k map: the detail is in
the photograph, the mesh is the scanner's noise floor, and the brick totem
was refused at 145k for less. So the baker's as-is bake is STAGED (bench/
totems/, gitignored) and tools/totem_lod.js cuts what ships: a base at the
sheet's budget and three levels under it, all wearing the delivered map.
The delivered file is never edited; the quality comes back by raising the
budget and re-running.

THE SIX TREPANIER POLES ARE UNIT-LESS. The scanner normalised every one to
1.9 m tall - a house-front pole is not a fence post - so each row declares
the height it stands at (`scale` = height / 1.905), the boats' rule ("sized
by what the hull is"). Heights are set from the reference photograph, 6 to
9 m, the tallest at one end of the arc. The jfactory pole (19.3 m, a real
one) is NOT baked: a one-sided scan, its back a flat sheet (G341.1).

Each row is props_table.py's P(): key, group, label, src, note, place,
scale, rot, tex. `height` is the declared standing height, published for
the gate (scale x delivered height must be it).
"""

GROUPS = [
    ('totem', 'totem poles'),
]

SOURCES = {
    'claws':    ('Claws of the Cloud-Watcher - totem', 'Brian Trepanier', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/claws-of-the-cloud-watcher-totem-6dfdd64d0fb1471fb9236126072235cd'),
    'eyes':     ('Eyes of the Skycaller - totem', 'Brian Trepanier', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/eyes-of-the-skycaller-totem-467240b79a6547fea405e0bd1ba4e8be'),
    'flight':   ('Flight of the Linekeepers - totem', 'Brian Trepanier', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/flight-of-the-linekeepers-totem-04953dee70e94df9bee97546943318c1'),
    'sentinel': ('Sentinel of the Storm-Eyed Kin - totem', 'Brian Trepanier', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/sentinel-of-the-storm-eyed-kin-totem-c68da9e155924fb8b6e7c02e0a3e8c8f'),
    'voice':    ("Voice of the Raven's Descent - totem", 'Brian Trepanier', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/voice-of-the-ravens-descent-totem-44a80dd9dbb041838ba7c9f84a5c0171'),
    'wings':    ('Wings of the Silent Herald - totem', 'Brian Trepanier', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/wings-of-the-silent-herald-totem-a2734e34adf64a65bba3ce591700e40c'),
    'tall':     ('Totem Pole', 'jfactory', 'CC-BY-4.0',
                 'https://sketchfab.com/3d-models/totem-pole-a2b21162ea3f4630b78a4aff893d269e'),
}

# the delivered files, under assets/totems/
FILES = {
    'claws':    'claws_of_the_cloud-watcher_-_totem.glb',
    'eyes':     'eyes_of_the_skycaller_-_totem.glb',
    'flight':   'flight_of_the_linekeepers_-_totem.glb',
    'sentinel': 'sentinel_of_the_storm-eyed_kin_-_totem.glb',
    'voice':    'voice_of_the_ravens_descent_-_totem.glb',
    'wings':    'wings_of_the_silent_herald_-_totem.glb',
    'tall':     'totem_pole.glb',
}
DIRS = {k: '' for k in FILES}

# the scanner's height for the six Trepanier poles, measured off the files
# (bbox y 0.00 .. 1.905 on every one)
SCAN_H = 1.905


def P(key, group, label, src, note, height=None, mats=None, nodes=None,
      place='floor', scale=1.0, rot=(0, 0, 0), tex=1024, slots=None,
      opaque=True, metalCap=None):
    if height is not None:
        scale = round(height / SCAN_H, 4)
    return dict(key=key, group=group, label=label, src=src, file=FILES[src],
                dir=DIRS.get(src, ''), height=height,
                mats=mats, nodes=nodes, place=place, scale=scale, rot=rot,
                tex=tex, note=note, deck=None, float=None, piles=None,
                pilesCut=1.9, slots=slots, opaque=opaque, metalCap=metalCap)


PROPS = [
    # the reference picture, left to right: a stout pole with a figure and
    # a bird's head; a raven with its beak out; a bear holding a small
    # figure; a slim pole with stacked faces; the tall painted one at the
    # right edge with a hat and a copper. The scans do not map one to one
    # on the photograph; each is cast by what it IS.
    P('totem_claws', 'totem', 'Claws of the Cloud-Watcher', 'claws', height=7.0,
      note='a stout pole with a crouched figure under a bird, claws out; 379k '
           'triangles as scanned, one 1k map; stood at 7 m'),
    P('totem_eyes', 'totem', 'Eyes of the Skycaller', 'eyes', height=6.0,
      note='a pole with outstretched wings a third of its height wide; 378k '
           'triangles; stood at 6 m (the wings 3.4 m across)'),
    P('totem_flight', 'totem', 'Flight of the Linekeepers', 'flight', height=7.5,
      note='a pole crowned by a bird with wings half-spread; 339k triangles; 7.5 m'),
    P('totem_sentinel', 'totem', 'Sentinel of the Storm-Eyed Kin', 'sentinel', height=8.0,
      note='a slim watching figure with a long beak forward; 297k triangles; 8 m'),
    P('totem_voice', 'totem', "Voice of the Raven's Descent", 'voice', height=9.0,
      note='the slimmest scan, stacked faces on a straight log; 438k triangles; '
           'the tall one of the six at 9 m'),
    P('totem_wings', 'totem', 'Wings of the Silent Herald', 'wings', height=6.5,
      note='a squat pole with wide wings at its crown; 338k triangles; 6.5 m'),
    # THE JFACTORY POLE IS NOT BAKED (G341.1, the user: "drop the one-sided
    # pole ... Exclude the tall one"): a full-size 19.3 m scan, but the
    # scanner never walked round it - its back is a flat untextured sheet.
    # Its SOURCES/FILES entries stay so the credit and the refusal are on
    # record; the row is gone.
]
