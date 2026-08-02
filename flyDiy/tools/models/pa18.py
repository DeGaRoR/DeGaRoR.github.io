# tools/models/pa18.py — bake config for the Piper PA-18 (assets/pa18/).
# All numbers measured with tools/model_inspect.py; procedure in
# docs/MODEL-IMPORT-PROC.md, runtime contract in docs/SKIN-PROC.md.

# Exterior objects (short names) — everything on the DefaultWhite atlas that
# is not the prop; wheels/gear kept for the mount calibration and looks.
EXTERIOR = {
    'fuselage', 'ailes', 'ailes2', 'profondeur', 'direction',
    'aileronG', 'aileronD', 'voletG', 'voletD', 'capot', 'structure',
    'montants', 'bouchons', 'reservoirs', 'echappe', 'bol',
    'roueG', 'roueD', 'roueA', 'axes', 'axeA',
    'axesGB', 'axesDB', 'axesGH', 'axesDH',
    'cableGB', 'cableDB', 'cableGH', 'cableDH', 'trous',
}

FLAP_MAX = 0.87   # rad (~50 deg), PA-18 full notch; ctl.flap is a 0..1 fraction

# Control surfaces (model frame). Hinge lines measured from the mesh
# (model_inspect.py --edge forward-edge profiles); signs follow flight_core
# conventions:
#   +de = pitch up  -> elevator TE up
#   +da = right roll (more lift model +z side) -> aileronG TE down, aileronD TE up
#   +dr = nose left -> rudder TE toward +z
#   +flap (0..1)    -> both flaps TE down; k is the full-throw angle in rad
# 'direction' is fin+rudder fused: ramp smoothsteps the hinge weight over x
# so the fin (fwd of the hinge) stays put without tearing the shared fabric.
# APPEND new rows only — sid order (index+1) is baked into gates and payloads.
SURFACES = [
    ('aileronG',   dict(drive='da', sgn=-1, p=(-0.718, 0.620, 0), ax=(0, 0, 1))),
    ('aileronD',   dict(drive='da', sgn=+1, p=(-0.718, 0.620, 0), ax=(0, 0, 1))),
    ('profondeur', dict(drive='de', sgn=+1, p=(2.834, 0.292, 0),  ax=(0, 0, 1))),
    ('direction',  dict(drive='dr', sgn=-1, p=(2.905, 0.0, 0),    ax=(0, 1, 0),
                        ramp=(2.85, 2.95))),
    # tailwheel steering: linked to rudder at twSteer=0.5 (flight_core cub),
    # swivels about the fork post just ahead of the wheel; spring (axeA) static
    ('roueA',      dict(drive='dr', sgn=-1, k=0.5, p=(3.14, -0.10, 0), ax=(0, 1, 0))),
    # flaps: symmetric TE-down for +flap (sgn -1 both sides, same convention
    # that gives aileronG TE-down); hinge measured across both end ribs:
    #   python tools/model_inspect.py assets/pa18/pa18.obj --edge voletG --span z
    ('voletG',     dict(drive='flap', sgn=-1, k=FLAP_MAX, p=(-0.824, 0.592, 0), ax=(0, 0, 1))),
    ('voletD',     dict(drive='flap', sgn=-1, k=FLAP_MAX, p=(-0.824, 0.592, 0), ax=(0, 0, 1))),
]

CFG = dict(
    id='MODEL_PA18',
    src='assets/pa18',
    obj='pa18.obj',
    credit='pa18 by BARANGER Emmanuel (helijah), GPL, for FlightGear; '
           'livery Brett Harrison 2010; Sketchfab listing (skfb.ly/NvEt) CC-BY 4.0',
    hub=[-3.371, -0.0705, 0],
    surfaces=SURFACES,
    # textures: gauge dials are small — native sizes already; asi.png carries
    # real cutout alpha (needle mask) and MUST stay png, jpeg would destroy it
    mats=dict(
        skin=dict(tex='texture.png', max=1024, fmt='jpeg', q=80),
        glass=dict(opacity=0.28, color=0xaad4ea),
        cabin=dict(tex='interior.png', max=256, fmt='jpeg', q=80),
        seat=dict(tex='seat.png', max=512, fmt='jpeg', q=80),
        panel=dict(tex='panel.png', max=128, fmt='jpeg', q=80),
        ai=dict(tex='ai.png', max=256, fmt='jpeg', q=80),      # alpha uniformly 255: jpeg-safe
        asi=dict(tex='asi.png', max=256, fmt='png'),           # REAL cutout alpha
        alt=dict(tex='alt.png', max=256, fmt='jpeg', q=80),
        turn=dict(tex='turn.png', max=256, fmt='jpeg', q=80),
        hdg=dict(tex='hdg.png', max=256, fmt='jpeg', q=80),
        vsi=dict(tex='vsi.png', max=256, fmt='jpeg', q=80),
        covers=dict(opacity=0.15),
    ),
    # groups: exterior selected by object short name; interior selected by
    # MATERIAL — short() collapses needle.002/needle etc across different
    # gauges, the usemtl is the unambiguous (and texture) boundary.
    # Per-instrument gauge groups keep future needle animation possible
    # (per-group sid tags) without a format change.
    groups=dict(
        skin=dict(objects=EXTERIOR, mat='skin', sid=True),
        glass=dict(objects={'vitres'}, mat='glass'),
        prop=dict(objects={'helice'}, mat='skin'),
        cabin=dict(materials={'DefaultWhite_interior.png'}, mat='cabin'),
        seat=dict(materials={'DefaultWhite_seat.png'}, mat='seat'),
        panel=dict(materials={'DefaultWhite_panel.png'}, mat='panel'),
        gauge_ai=dict(materials={'DefaultWhite_ai.png'}, mat='ai'),
        gauge_asi=dict(materials={'DefaultWhite_asi.png'}, mat='asi'),
        gauge_alt=dict(materials={'DefaultWhite_alt.png'}, mat='alt'),
        gauge_turn=dict(materials={'DefaultWhite_turn.png'}, mat='turn'),
        gauge_hdg=dict(materials={'DefaultWhite_hdg.png'}, mat='hdg'),
        gauge_vsi=dict(materials={'DefaultWhite_vsi.png'}, mat='vsi'),
        covers=dict(materials={'transparent'}, mat='covers'),
    ),
)
