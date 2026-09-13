"""cabin_table.py — THE DECLARED TRAM CABIN (G343, the user: "I've got a cabin
model. It needs new materials from our library ... Use the same technique
for the windows as for the houses. Build a smooth joint on the window
contour, with higher resolution than the base mesh ... I also attach 2 images
we can project on each side as liveries").

The user's cable_car.glb, delivered under assets/cabin/. Same baker as the
hangar props, the pier kit and the totems (tools/prop_prep.py), the same
codec, the same as-is rule for the geometry: nothing is cut or welded, the
author's normals ship. Its own pack (src/cabin/), its own media
(media/geo/cabin, media/tex/cabin), its own gate (GATE CABIN reads this
table).

WHAT IS NOT AS-IS is the DRESSING, which is the point of the row: the file
ships seven flat-colour materials and no map, and the cabin wears the house
library instead - src/viewer/cabin.js reads the baked parts by their
MATERIAL NAME (the baker keeps parts per material, world-space) and gives
each a set: the body painted steel with the livery projected on its flanks,
the trim charcoal steel, the floor decking, the hanger bare steel, the glass
the house's own glass, and a smooth gasket swept round every window's
contour at a finer resolution than the mesh. The delivered file is never
edited.

THE ROPES ARE LEFT IN THE FILE. The author modelled 17 m of track and haul
rope with the cabin (nodes `Rope base_13`, `Ropes (ins)_14`); the tram draws
its own ropes from the station's hooks, so those two nodes are not baked -
`nodes` names every node that is.

THE SCALE IS DECLARED, the boats' rule ("sized by what the hull is"): the
file's world transform leaves the whole thing 0.42 m wide and 1.06 m tall,
a toy. A sixty-seat tram cabin is 3.4 m across, so `scale` = 8.1 puts the
body at that width, ~5.2 m long and the carriage's wheels ~8.6 m over the
floor. cabin.js's BANNER and HANG are in these baked metres, y up, the
cabin's length along z.
"""
GROUPS = [
    ('cabin', 'tram cabins'),
]
SOURCES = {
    # the user's file; provenance to be completed by the user (CREDITS.md)
    'cable_car': ('cable car cabin', 'delivered by the user', 'see CREDITS.md', ''),
}
FILES = {
    'cable_car': 'cable_car.glb',
}
DIRS = {k: '' for k in FILES}

CABIN_NODES = ['Cabin_0', 'Door holders_1', 'Legs_2', 'Stand_3', 'Neck_4', 'Handle_5',
               'mainstay_6', 'Handle (stand)_7', 'Wheels_8', 'Sticks_9',
               'Handle (outside)_10', 'Head_11', 'Insurance_12', 'Doors_15', 'Windows_16']

# the seven materials the file ships, and the role cabin.js gives each
ROLES = {
    'Yellow': 'body', 'Black_Yellow': 'trim', 'Yellow_dirt': 'floor', 'material': 'hanger',
    'Red_dark': 'detail', 'Metallic': 'rail', 'Windows': 'glass',
}


def P(key, group, label, src, note, mats=None, nodes=None, place='floor',
      scale=1.0, rot=(0, 0, 0), tex=256):
    return dict(key=key, group=group, label=label, src=src, file=FILES[src],
                dir=DIRS.get(src, ''), mats=mats, nodes=nodes, place=place,
                scale=scale, rot=rot, tex=tex, note=note, deck=None, float=None,
                piles=None, pilesCut=1.9, slots=None, opaque=False, metalCap=None)


PROPS = [
    P('tram_cabin', 'cabin', 'tram cabin',  'cable_car',
      note='the cabin with its hanger and carriage, without the modelled ropes; '
           'dressed by src/viewer/cabin.js from the house library, the livery on its flanks',
      nodes=CABIN_NODES, place='floor', scale=8.1),
]
