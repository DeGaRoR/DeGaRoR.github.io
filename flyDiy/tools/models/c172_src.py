# tools/models/c172_src.py — GLB extraction config for the Cessna 172SP.
# Consumed by tools/glb_extract.py (Step 0/1 of docs/MODEL-IMPORT-PROC.md);
# its OBJ output is then measured by model_inspect.py and baked by
# model_prep.py with tools/models/c172.py.
#
# Source: "FREE Cessna 172SP" by NLM (sketchfab.com/NLM-Group), CC-BY-4.0.
#
# The export has generic node names ("Plane.002_1"), so every part below was
# identified from tools/glb_render.py contact sheets (side | top | front
# silhouettes with the part highlighted) — see docs/MODEL-IMPORT-PROC.md §0b.
#
# The mesh is carried through AS-IS: no decimation, no welding, no clipping.
# All this table does is name parts, drop staging props, and fix the two
# places where the source's object split does not match what the rig needs.

# glTF axes here: +y up, +z nose, +x LEFT (right-handed, so x = up x nose).
# Target model frame: x aft, y up, z left => (x,y,z)_model = (-z, y, x)_gltf.
#
# Scale: the export is ~1/3 scale. Wing bbox spans 3.690 gltf units; the real
# 172S span is 11.00 m (36 ft 1 in), so s = 11.00/3.690. Cross-checks at that
# scale: length 8.23 m (real 8.28), height 2.68 m (real 2.72) — within 1%.
SCALE = 11.00 / 3.690      # 2.98103

# Staging props that must not fly: the four "remove before flight" ribbons
# (wing tie-downs and the pitot cover), the ribbons' own hardware, and the
# ground tie-down anchors with their concrete pads.
#
# 'split': one mesh fuses the left and right surface — split it by triangle
# centroid z (model frame: +z is LEFT), giving <name>G / <name>D.
# 'mirror': the source only models ONE wing strut (right); mirror it.
PARTS = {
    # ---- empennage
    4:   dict(name='fin'),
    6:   dict(name='fintip'),
    8:   dict(name='rudder'),
    26:  dict(name='stab'),
    28:  dict(name='elevator'),
    # ---- wing + surfaces
    10:  dict(name='wing'),
    42:  dict(name='wingroot'),
    44:  dict(name='flap',     split=True),
    46:  dict(name='aileron',  split=True),
    48:  dict(name='fuelcap'),                     # Metal, wing upper surface
    74:  dict(name='strutfit'),                    # Metal, strut/tie-down fitting
    112: dict(name='strutD', mirror='strutG'),     # only the right strut exists
    # ---- fuselage + doors
    54:  dict(name='fuselage'),
    32:  dict(name='doorG'),
    120: dict(name='doorD'),
    33:  dict(name='dhingeG'),
    121: dict(name='dhingeD'),
    # ---- glazing
    37:  dict(name='glass'),
    34:  dict(name='dglassG'),
    123: dict(name='dglassD'),
    # ---- nose. Only the spinner assembly and the blades turn; `cowlface` is
    # the cowling's front panel (the ring AROUND the spinner) and is fixed
    # structure — it must stay in the skin group, not in a prop* group.
    12:  dict(name='cowlface'),
    13:  dict(name='spincap'),                     # spinner backplate
    30:  dict(name='spintip'),                     # spinner cone
    39:  dict(name='blades'),
    40:  dict(name='propface'),                    # blade faces, at the disc
    # ---- main gear (rigid)
    15:  dict(name='gearleg'),
    17:  dict(name='pants'),
    19:  dict(name='tyreM'),
    20:  dict(name='hubM'),
    # ---- nose gear: steers with the rudder channel
    22:  dict(name='nosepant'),
    24:  dict(name='nosefork'),
    109: dict(name='tyreN'),
    110: dict(name='hubN'),
    118: dict(name='noseaxle'),
    # ---- staging props: skipped
    72:  dict(skip=True, name='ribbon-wing'),
    76:  dict(skip=True, name='ribbon-pitot'),
    78:  dict(skip=True, name='ribbon-strut'),
    79:  dict(skip=True, name='ribbon-ring'),
    114: dict(skip=True, name='tiedown-anchor'),
    116: dict(skip=True, name='tiedown-pad'),
    # ---- interior (baked, not animated). Named intNN; the bake groups the
    # interior BY MATERIAL, so these names only have to be unique.
    35:  dict(name='int35'),    # door trim G
    122: dict(name='int122'),   # door trim D
    50:  dict(name='int50'),    # glareshield
    52:  dict(name='int52'),
    56:  dict(name='int56'),    # cabin lining
    58:  dict(name='int58'),
    60:  dict(name='int60'),
    62:  dict(name='int62'),
    64:  dict(name='int64'),
    66:  dict(name='int66'),
    68:  dict(name='int68'),
    70:  dict(name='int70'),
    81:  dict(name='int81'),
    83:  dict(name='int83'),    # panel face
    84:  dict(name='int84'),
    85:  dict(name='int85'),
    86:  dict(name='int86'),
    87:  dict(name='int87'),
    88:  dict(name='int88'),
    90:  dict(name='int90'),
    92:  dict(name='int92'),    # yoke G
    94:  dict(name='int94'),    # yoke D
    96:  dict(name='int96'),    # seats
    98:  dict(name='int98'),
    100: dict(name='int100'),
    102: dict(name='int102'),
    104: dict(name='int104'),
    105: dict(name='int105'),
    107: dict(name='int107'),
}

SRC = dict(
    glb='assetsSketchfab/free_cessna_172sp.glb',
    out='assets/c172',
    obj='c172.obj',
    scale=SCALE,
    parts=PARTS,
)
