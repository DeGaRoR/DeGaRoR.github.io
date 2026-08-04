# tools/models/c172.py — bake config for the Cessna 172SP (assets/c172/).
# The OBJ is generated: tools/glb_extract.py c172 (config c172_src.py) turns
# the Sketchfab GLB into model-frame OBJ + MTL + textures. Everything below is
# measured on that OBJ with tools/model_inspect.py; procedure in
# docs/MODEL-IMPORT-PROC.md, runtime contract in docs/SKIN-PROC.md.

# Exterior structure on the Body atlas (short names). Control surfaces are in
# here too — they are skin verts carrying a sid tag, exactly like the PA-18.
EXTERIOR = {
    'fin', 'fintip', 'rudder', 'stab', 'elevator',
    'wing', 'wingroot', 'flapG', 'flapD', 'aileronG', 'aileronD',
    'strutG', 'strutD', 'fuselage', 'doorG', 'doorD',
    'gearleg', 'pants', 'nosepant', 'nosefork',
    'cowlface',          # cowling front panel: the ring AROUND the spinner.
                         # Fixed structure — it does NOT turn with the prop.
}

FLAP_MAX = 0.524   # rad (30 deg), 172S full notch; ctl.flap is a 0..1 fraction
NW_STEER = 0.35    # rad per rad of rudder — |twSteer| of the c172 fiche

# Nose-gear steering axis: vertical through the strut, between the fork centre
# (x -2.849) and the wheel centre (x -2.987). Every part that swivels with it
# gets its own row (sid is per object, and these span four materials).
NW = dict(drive='dr', sgn=+1, k=NW_STEER, p=(-2.85, 0.25, 0), ax=(0, 1, 0))

# Control surfaces (model frame). Hinge lines are the least-squares fits from
#   python tools/model_inspect.py assets/c172/c172.obj --edge <obj> --span z|y
# — this airframe needs them: the wing has dihedral (flap/aileron hinges tilt
# ~4.7 deg), the ailerons taper (hinge sweeps 7 deg) and the rudder hinge rakes
# 24 deg. The payload's Rodrigues pass takes an arbitrary unit axis, so these
# go in verbatim rather than being rounded to a cardinal axis.
#
# Signs follow flight_core conventions, derived not guessed (see SKIN-PROC 4b):
#   +de = pitch up  -> elevator TE up
#   +da = right roll -> aileronG (model +z = LEFT wing) TE down
#   +dr = nose left -> rudder TE toward +z
#   +flap (0..1)    -> both flaps TE down; k is the full-throw angle
#   nose wheel: solver rotates the rolling direction by -twSteer*dr about +y,
#   and the fiche's twSteer is -0.35, so the wheel turns +0.35*dr about model
#   +y — i.e. left for nose-left. (The fiche comment called this sign
#   unverified; it is correct.)
# APPEND new rows only — sid order (index+1) is baked into gates and payloads.
SURFACES = [
    ('aileronG',  dict(drive='da', sgn=-1, p=(-0.795, 2.010,  3.929),
                       ax=(-0.1224,  0.0479, 0.9913))),
    ('aileronD',  dict(drive='da', sgn=+1, p=(-0.795, 2.010, -3.929),
                       ax=( 0.1224, -0.0479, 0.9913))),
    ('elevator',  dict(drive='de', sgn=+1, p=(3.263, 1.296, 0), ax=(0, 0, 1))),
    ('rudder',    dict(drive='dr', sgn=-1, p=(3.429, 1.793, 0),
                       ax=(0.4109, 0.9117, 0))),
    ('flapG',     dict(drive='flap', sgn=-1, k=FLAP_MAX, p=(-0.658, 1.886,  1.524),
                       ax=(0,  0.0826, 0.9966))),
    ('flapD',     dict(drive='flap', sgn=-1, k=FLAP_MAX, p=(-0.658, 1.886, -1.524),
                       ax=(0, -0.0826, 0.9966))),
    ('nosepant',  dict(**NW)),
    ('nosefork',  dict(**NW)),
    ('tyreN',     dict(**NW)),
    ('hubN',      dict(**NW)),
    ('noseaxle',  dict(**NW)),
]

CFG = dict(
    id='MODEL_C172',
    src='assets/c172',
    obj='c172.obj',
    credit='"FREE Cessna 172SP" by NLM (sketchfab.com/NLM-Group), CC-BY-4.0; '
           'extracted from free_cessna_172sp.glb by tools/glb_extract.py',
    hub=[-3.699, 1.229, 0],          # propeller centre (blades mesh centroid)
    surfaces=SURFACES,
    # Textures are embedded VERBATIM (fmt='copy'): the source file's own bytes
    # at its own resolution. Same principle as the mesh — the model arrives as
    # the author made it. Payload size is a load-time problem, not a reason to
    # re-encode someone's atlas.
    mats=dict(
        # textured
        skin=dict(tex='Body.png', fmt='copy'),
        tyre=dict(tex='Tyre.png', fmt='copy'),
        metal=dict(tex='Metal.png', fmt='copy'),
        front=dict(tex='Front.png', fmt='copy'),
        pedal=dict(tex='Material_004.png', fmt='copy'),
        radio=dict(tex='Material_006.jpg', fmt='copy'),
        screen=dict(tex='Material_007.jpg', fmt='copy'),
        dials=dict(tex='Material_009.jpg', fmt='copy'),
        gaugeA=dict(tex='material.jpg', fmt='copy'),
        gaugeB=dict(tex='material_19.jpg', fmt='copy'),
        gaugeC=dict(tex='material_20.jpg', fmt='copy'),
        # glazing: the source's own tint map, at the source's own alpha (the
        # glTF material is rgba 0.14/0.14/0.14/0.37 over Window.png)
        glass=dict(tex='Window.png', fmt='copy', opacity=0.37),
        # flat (opacity 1 = opaque; the viewer only goes transparent below 1)
        hub=dict(opacity=1, color=0xcccccc),
        blades=dict(opacity=1, color=0x121212),
        prophub=dict(opacity=1, color=0xbcbcbc),
        black=dict(opacity=1, color=0x0a0a0a),
        gearmetal=dict(opacity=1, color=0x2e2e2e),
        cabin=dict(opacity=1, color=0x853817),      # Interior   (tan leather)
        cabin2=dict(opacity=1, color=0x1a0f08),     # Interior_2 (dark trim)
        panel=dict(opacity=1, color=0x141414),      # Black
        cockpit=dict(opacity=1, color=0x0b0b0b),
        chair=dict(opacity=1, color=0x0a0a0a),
        trim=dict(opacity=1, color=0x1f1f1f),       # Material.003
        bezel=dict(opacity=1, color=0x0d0d0d),      # Material.005
        knob=dict(opacity=1, color=0x1a1a1a),       # Metal.001
        yoke=dict(opacity=1, color=0xb0b0b0),       # material_0
    ),
    # Exterior selects by object short name; the interior selects by MATERIAL
    # (same reason as the PA-18: material is the unambiguous texture boundary).
    # Groups named prop* are spun about `hub` by the viewer.
    groups=dict(
        skin=dict(objects=EXTERIOR, mat='skin', sid=True),
        glass=dict(objects={'glass', 'dglassG', 'dglassD'}, mat='glass'),
        tyre=dict(objects={'tyreM', 'tyreN'}, mat='tyre', sid=True),
        hub=dict(objects={'hubM', 'hubN'}, mat='hub', sid=True),
        metal=dict(objects={'fuelcap', 'strutfit', 'dhingeG', 'dhingeD'}, mat='metal'),
        gear=dict(objects={'noseaxle'}, mat='gearmetal', sid=True),
        # prop* groups all turn about `hub`. The spinner assembly (backplate +
        # cone) and the blades turn; `cowlface` does not and lives in `skin`.
        prop=dict(objects={'blades'}, mat='blades'),
        propface=dict(objects={'propface'}, mat='prophub'),
        propcap=dict(objects={'spincap'}, mat='black'),
        proptip=dict(objects={'spintip'}, mat='metal'),
        # ---- interior, by material
        cabin=dict(materials={'Interior'}, mat='cabin'),
        cabin2=dict(materials={'Interior_2'}, mat='cabin2'),
        glareshield=dict(materials={'Front'}, mat='front'),
        pedals=dict(materials={'Material.004'}, mat='pedal'),
        ipanel=dict(materials={'Black'}, mat='panel'),
        icockpit=dict(materials={'Cockpit'}, mat='cockpit'),
        ichair=dict(materials={'Chair'}, mat='chair'),
        itrim=dict(materials={'Material.003'}, mat='trim'),
        ibezel=dict(materials={'Material.005'}, mat='bezel'),
        iknob=dict(materials={'Metal.001'}, mat='knob'),
        iyoke=dict(materials={'material_0'}, mat='yoke'),
        iradio=dict(materials={'Material.006'}, mat='radio'),
        iscreen=dict(materials={'Material.007'}, mat='screen'),
        idials=dict(materials={'Material.009'}, mat='dials'),
        igaugeA=dict(materials={'material'}, mat='gaugeA'),
        igaugeB=dict(materials={'material_19'}, mat='gaugeB'),
        igaugeC=dict(materials={'material_20'}, mat='gaugeC'),
    ),
)
