#!/usr/bin/env python3
"""panel_table.py — THE DECLARED PANEL HARDWARE KIT: the switches, knobs,
buttons and the key the cockpit's panel is fitted with (the panel arc,
session 4c, 2026-09-12; the user: "I added assets in the asset folder. There
are a lot of knobs for aircrafts ... I have attached a key as well").

The hangar props' contract applied to a third library (after the pier kit,
G252): a second table rather than more rows in the first, because the
hangar's registry is claimed row by row by its kits (GATE HANGAR rule 4) and
a toggle switch is not in the hangar. Same baker (tools/prop_prep.py), same
as-is rule, same codec; its own packs (src/panelhw/), its own media
(media/geo/panelhw, media/tex/panelhw).

THE KIT, READ OFF THE FILES (tools/glb_render + a per-object sheet):

  aircraft_knobs_and_dials.glb — a Sketchfab pack of 46 pieces on a grid, no
  textures, five flat materials (SILVER, BLACK, GRAY, a red 'material',
  AMBER). Every piece stands on the y = 0 plane along +y. The pack's unit
  is not one size: a 20 mm knob is 2.0 units, a miniature toggle's bat 1.2 —
  so each row declares its own scale, chosen to make the piece its real
  aircraft size. Who is who:
    TOGGLE SWITCH 4 (+ SMALL TOGGLE SWITCH BASE)  a long round bat with a ball
        tip on a small round bushing — the standard MS-type toggle
    TOGGLE SWITCH 1 (+ BASE.001)  a flat tapered PADDLE bat on a square base
    TOGGLE SWITCH 2 (+ SWITCH GUARD, BASE.024)  the same paddle under a red
        hinged GUARD — a guarded switch (a master, a fuel pump)
    TOGGLE SWITCH.023  the paddle bat alone;  TOGGLE SWITCH BASE.023 a base
        alone;  TOGGLE SWITCH BASE.002 + TOGGLE SWITCH 5  a stubby bat in a
        tall round base;  Cube.001  a red guard alone
    DIAL 1  a large flat knurled wheel (a trim wheel);  DIAL 2  a thin disc on
        a stem (a thumbwheel);  Cylinder.084  a wide knurled ring dial
    KNOB 1, 2, 4, 5, 6, 10, 17, 19, 21, 22  the POINTER ("chicken-head")
        family — a skirted cone with a pointed nose; 6 is the knurled one
        (5 685 vertices), 19 flares at the base, 2 stands on a round base
    KNOB 3  a plain short cylinder;  KNOB 7, 9  small plain cylinders;
    KNOB 8  a rounded push-pull knob;  KNOB 11  a flat bar knob (a fuel
        selector);  KNOB 12  a domed stepped knob (a vernier throttle's head);
    KNOB 13  a small cylinder on a round base;  KNOB 14  DUAL CONCENTRIC
        (a radio's tuning knob);  KNOB 15  a wide short ridged knob;
    KNOB 16 (+ SQUARE KNOB BASE)  a square pull knob;  KNOB 18  a low dome
        with a nipple;  KNOB 20  a knurled cylinder
    BUTTON 1, 9  small round push buttons;  BUTTON 2, 7  flat mushroom caps;
    BUTTON 3, 8  round push buttons with an AMBER lens (press-to-test);
    BUTTON 4, 5, 10  square buttons with a red face;  BUTTON 6  a big round
        button with a red centre;  CAP 1  a switch boot
    T-HANDLE 1 (+ ENGINE 1 FIRE EXTINGUISH LIGHT)  the fire handle;
    Cylinder.087 (+ Cube.086, Cylinder.086)  a small lever with a silver bar;
    LNDG GEAR LVR KNOB (+ lever, bracket, base)  the landing-gear lever

  door_key.glb — one textured key (base / metallic-roughness / normal), a
  flat oval bow with a hole and a bitted blade, ~50 mm long.

WHAT THE PANEL TAKES from it, this session: the round-bat toggle for the
lights, the paddle for master / alternator (guarded for the master), the
pointer knob for the dimmers, the dual-concentric knob and the amber button
for the radios to come, and the key. The rest stays declared here for the
sessions that need a fuel selector, a throttle head or a gear lever.

Each row is props_table.py's P() plus `nodes` (node names to keep, whole
subtrees) and `up` (the axis the piece stands along in the delivered file —
always +y here; the layer turns it onto the panel's normal).
"""

GROUPS = [
    ('switch', 'switches'),
    ('knob', 'knobs'),
    ('button', 'buttons'),
    ('key', 'the key'),
]

SOURCES = {
    'knobs': ('Aircraft Knobs and Dials', 'Sketchfab (user-supplied export)', 'see assets/interior',
              'https://sketchfab.com/'),
    'key':   ('Door Key', 'Sketchfab (user-supplied export)', 'see assets/interior',
              'https://sketchfab.com/'),
}

FILES = {
    'knobs': 'aircraft_knobs_and_dials.glb',
    'key':   'door_key.glb',
}


def P(key, group, label, src, note, nodes, scale, mats=None, place='floor',
      rot=(0, 0, 0), tex=512, up='y'):
    return dict(key=key, group=group, label=label, src=src, file=FILES[src], dir='',
                mats=mats, nodes=nodes, place=place, scale=scale, rot=rot, tex=tex,
                note=note, up=up)


PROPS = [
    # ---- switches ------------------------------------------------------------
    P('hw_toggle', 'switch', 'toggle, round bat', 'knobs',
      note='the MS-type toggle: a 29 mm round bat with a ball tip on its bushing',
      nodes=['TOGGLE SWITCH 4_1'], scale=0.024),
    P('hw_paddle', 'switch', 'toggle, paddle bat', 'knobs',
      note='a flat tapered bat on a square base — master / alternator',
      nodes=['TOGGLE SWITCH 1_6'], scale=0.014),
    P('hw_guarded', 'switch', 'toggle, guarded', 'knobs',
      note='the paddle under a red hinged guard — a master switch',
      nodes=['TOGGLE SWITCH 2_4'], scale=0.014),
    # ---- knobs ---------------------------------------------------------------
    P('hw_knob', 'knob', 'pointer knob', 'knobs',
      note='the skirted pointer knob, 20 mm across — a dimmer',
      nodes=['KNOB 5_20'], scale=0.010),
    P('hw_knob_knurl', 'knob', 'pointer knob, knurled', 'knobs',
      note='the same knob with its knurl modelled',
      nodes=['KNOB 6_21'], scale=0.010),
    P('hw_knob_dual', 'knob', 'dual concentric knob', 'knobs',
      note='a small knob on a large one — a radio\'s tuning knob',
      nodes=['KNOB 14_29'], scale=0.012),
    # ---- buttons -------------------------------------------------------------
    P('hw_button_amber', 'button', 'push button, amber lens', 'knobs',
      note='a round push-to-test button with an amber lens',
      nodes=['BUTTON 3_43'], scale=0.015),
    P('hw_button_red', 'button', 'push button, red square', 'knobs',
      note='a square button with a red face',
      nodes=['BUTTON 5_45'], scale=0.012),
    # ---- the key -------------------------------------------------------------
    # the delivered key lies flat in its own x-y plane, 50 mm long along x with
    # the bow at +x; the layer stands it in the lock. Kept at its own size.
    P('hw_key', 'key', 'the key', 'key',
      note='a flat key, oval bow with a hole, bitted blade; textured',
      nodes=None, scale=0.001, place='level', rot=(104.6, 23.5, -146.0), tex=512),
]
