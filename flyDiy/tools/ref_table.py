#!/usr/bin/env python3
"""ref_table.py — THE DECLARED REFERENCE-AEROPLANE TABLE.

One row per aeroplane that may stand beside your build in the garage. This
file is the single authority for the BAKE; `tools/ref_prep.py` bakes exactly
these rows and nothing discovers a model by scanning a directory.

WHY THIS IS NOT tools/models/<key>.py.
The model_prep pipeline (glb_extract -> OBJ -> model_prep) exists to make an
aeroplane FLYABLE: it needs every control surface as its own named object, a
hinge line fitted to it, a sid tag per vertex, a propeller hub to spin about
and a wing band to bind to the spar. All of that is hand work per airframe,
identified node by node off a contact sheet.

A REFERENCE aeroplane needs none of it. It is rigid, it never moves a vertex,
it has no controls and no propeller — refplane.js says so in its own first
paragraph and GATE REF asserts it. So the bake it needs is the short one:
geometry through untouched, grouped by the source's own materials, textures
verbatim, in the model frame. That is `ref_prep.py`, and this is its table.

The two are not rivals. A reference that later earns a cockpit and a control
column graduates to the long pipeline; until then it does not pay for one.

Each row:
  key     the payload's game-side name. Becomes MODELS3D.<key>, the payload
          global MODEL_<KEY>, and the file src/models/<key>_model.js. It is
          what refplane.js's REF_PRESETS row names in its `model` field, so it
          is stable forever. NOT the vendor's file name.
  glb     the delivered source, under assetsSketchfab/. Committed, never
          edited ([[import-models-as-is]]).
  title   the modeller's own title for the listing.
  author  who made it.
  lic     the licence the LISTING carries, verbatim from the GLB's own
          asset.extras. Drives what CREDITS.md must say, and whether the
          payload may be published at all — see LICENCES below.
  url     the listing.
  axes    which way the source's axes point (see AXES in ref_prep.py). All
          seven of helijah's exports are 'xaft' — the FlightGear frame, which
          IS the model frame — but a table row that assumed that silently
          would be the kind of thing that is only discovered by a mirrored
          livery three sessions later.
  scale   metres per source unit. 1 unless stated.
  tex     'none' (default) or 'copy'. Whether to carry the source's own
          base-colour maps, byte-for-byte. DECLINED by default and the reason
          is in ref_prep.py's read_material: a reference opens in white clay,
          the maps are only ever sampled in `as authored`, and on these models
          they are three quarters of the payload — mostly a cockpit you cannot
          see from beside the aeroplane. Without them the materials still carry
          their authored flat colour, roughness, metalness and opacity, so the
          glazing is still glazing. The bake prints what the livery WOULD have
          cost every run, so turning one back on is an informed choice.
  note    what the eye should know about this particular model.

LICENCES, and why the column is verbatim rather than tidied.
helijah's aeroplanes are FlightGear aircraft, GPL-2.0 at source (FGMEMBERS on
GitHub). What the SKETCHFAB LISTING carries is a separate decision he makes per
upload, and it is not the same on all seven: three say CC-BY-4.0 and four say
"SKETCHFAB Standard", which does not permit redistribution. This table records
what each file actually says, so the question "may this ship?" has an answer
here rather than an assumption.
"""

REF_MODELS = {
    # ---- CC-BY-4.0 listings ------------------------------------------------
    'd112': dict(
        key='d112',
        glb='assetsSketchfab/jodel_d.112_d11_variant.glb',
        title='Jodel D.112 (D11 variant)',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/jodel-d112-d11-variant-747c7684ec8645398ff8e00e280a5f97',
        axes='xaft', scale=1.0, tex='none',
        note='taildragger, drawn fuselage-level; the flyable jodel fiche '
             '(14_aircraft_jodel.js) is the same family, so this is the '
             'reference that fiche never had.',
    ),
    'pio200': dict(
        key='pio200',
        glb='assetsSketchfab/alpi_pioneer_200.glb',
        title='Alpi Pioneer 200',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/alpi-pioneer-200-b655fc12d7784997987fdb2a6c8961b0',
        axes='xaft', scale=1.0, tex='none',
        note='drawn with the canopy OPEN, which is why its height reads ~0.8 m '
             'over the published figure. Height is measured and not checked '
             '(see refplane.js), so this costs nothing but would be a mystery '
             'if it were not written down.',
    ),
    'c195': dict(
        key='c195',
        glb='assetsSketchfab/cessna_195_businessliner_wheels_version.glb',
        title='Cessna 195 Businessliner (wheels version)',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/cessna-195-businessliner-wheels-version-3cbe7fa4514e48c9a204b5565dfe4dbb',
        axes='xaft', scale=1.0, tex='none',
        note='the big one: 169 k verts, and a taildragger. Radial-engined '
             'cabin monoplane — the shape nothing else in the reference set has.',
    ),

    # ---- "SKETCHFAB Standard" listings ------------------------------------
    # NOT redistributable on the strength of the listing alone. They bake and
    # they stand in the shed locally; whether they ship is the user's call, and
    # the payload carries its own `lic` so GATE REF can hold the artifact to it
    # rather than leaving it to whoever next edits build.js.
    'a22': dict(
        key='a22',
        glb='assetsSketchfab/aeroprakt_a22_foxbat.glb',
        title='Aeroprakt A22 Foxbat',
        author='helijah (Emmanuel BARANGER)',
        lic='SKETCHFAB Standard',
        url='https://sketchfab.com/3d-models/aeroprakt-a22-foxbat-23496a87a16d417caeeae4e3fccda43d',
        axes='xaft', scale=1.0, tex='none',
        note='high-wing, tricycle, enormous glazing — the modern microlight '
             'silhouette.',
    ),
    'p68': dict(
        key='p68',
        glb='assetsSketchfab/partenavia_p_68.glb',
        title='Partenavia P.68',
        author='helijah (Emmanuel BARANGER)',
        lic='SKETCHFAB Standard',
        url='https://sketchfab.com/3d-models/partenavia-p-68-93029ea2884e489a8fda5e709373d580',
        axes='xaft', scale=1.0, tex='none',
        note='the only TWIN in the set, and the only aeroplane here whose '
             'engines are not on the nose.',
    ),
    'rv8': dict(
        key='rv8',
        glb='assetsSketchfab/vans_aircraft_rv-8_tail_gear.glb',
        title="Van's Aircraft RV-8 (tail gear)",
        author='helijah (Emmanuel BARANGER)',
        lic='SKETCHFAB Standard',
        url='https://sketchfab.com/3d-models/vans-aircraft-rv-8-tail-gear-5352bfd36d5f4525aa2173be53a21402',
        axes='xaft', scale=1.0, tex='none',
        note='taildragger, tandem, the homebuilt the garage is closest to '
             'being able to make.',
    ),
    'sr22': dict(
        key='sr22',
        glb='assetsSketchfab/cirrus_sr_22.glb',
        title='Cirrus SR22',
        author='helijah (Emmanuel BARANGER)',
        lic='SKETCHFAB Standard',
        url='https://sketchfab.com/3d-models/cirrus-sr-22-f0f1089f374f4d398f0483403fe6af7a',
        axes='xaft', scale=1.0, tex='none',
        note='composite, cantilever, faired fixed gear — the far end of the '
             'design space from the Cub.',
    ),

    # ---- the second batch (G142), all CC-BY-4.0 -----------------------------
    # Chosen by the user for coverage the first set had none of: a diesel/glass
    # composite trainer, a fully-aerobatic glider-trainer, an 18 m motorglider,
    # a fabric high-wing on a Rotax, a Soviet four-seat tourer, a turbine
    # bush-plane, a 1915 monoplane, and the trainer half the world learned on.
    'da40': dict(
        key='da40',
        glb='assetsSketchfab/diamond_da40.glb',
        title='Diamond DA40',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/diamond-da40-dfda5fad07c24c12be13a23562fe83e3',
        axes='xaft', scale=1.0, tex='none',
        note='composite, T-tail, long slender wing — the modern trainer.',
    ),
    'g115': dict(
        key='g115',
        glb='assetsSketchfab/grob_g_115.glb',
        title='Grob G 115',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/grob-g-115-64bc0e98d56a4f88a2833dbefa2ca975',
        axes='xaft', scale=1.0, tex='none',
        note='side-by-side composite trainer; the model is the LONGER-nosed '
             'G115E/Tutor, which is why its length reads past the plain G115.',
    ),
    'stemme': dict(
        key='stemme',
        glb='assetsSketchfab/stemme_sky_sportster_s6.glb',
        title='Stemme Sky Sportster S6',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/stemme-sky-sportster-s6-3444184089ea443bb2ad006e9129a750',
        axes='xaft', scale=1.0, tex='none',
        note='THE OUTLIER, and that is why it earns its place: 18 m of span on '
             '8.5 m of length, an aspect ratio nothing else in the set comes '
             'near. Also the cheapest payload of the sixteen.',
    ),
    'guepard': dict(
        key='guepard',
        glb='assetsSketchfab/super_guepard_912.glb',
        title='Super Guepard 912',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/super-guepard-912-207f2678545f4b66ac1b1e1dbc3904e7',
        axes='xaft', scale=1.0, tex='none',
        # THE ONLY ROW IN SIXTEEN THAT NEEDS AN ORIGIN. This export is drawn in
        # a corner-origin frame: x 0..5.998, z -9.790..0, so its plane of
        # symmetry is at z = -4.895 and it would stand half a wingspan to one
        # side of the build with its own half-clip cutting through a wing. The
        # numbers are the measured box centres in x and z; y is left as
        # delivered (see offset_of in ref_prep.py). GATE REF re-derives the
        # symmetry from the baked payload and fails if this is wrong.
        off=(-2.999, 0.0, 4.895),
        note='fabric high-wing on a Rotax 912 — a Humbert Guepard, the closest '
             'thing in the set to what the garage actually builds. Delivered '
             'in a corner-origin frame; see `off`.',
    ),
    'yak18t': dict(
        key='yak18t',
        glb='assetsSketchfab/yak_18_t.glb',
        title='Yak 18 T',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/yak-18-t-zM1VKOfkihgOEdx09hsGd6qnp5q',
        axes='xaft', scale=1.0, tex='none',
        note='the only RETRACTABLE in the set, and the only radial-adjacent '
             'four-seater besides the 195. Soviet, and it looks it.',
    ),
    'draco': dict(
        key='draco',
        glb='assetsSketchfab/pzl_104_wilga_2000_draco.glb',
        title='PZL 104 Wilga 2000 "Draco"',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/pzl-104-wilga-2000-draco-70402e1b9c9147b199d1497ccd0b3e84',
        axes='xaft', scale=1.0, tex='none',
        note="DRACO, not a stock Wilga: Mike Patey's PT6 turbine conversion, "
             'so the nose is long and the tyres are enormous. Its published '
             "figures are the CONVERSION's, not PZL's — see the pub.note.",
    ),
    'eiii': dict(
        key='eiii',
        glb='assetsSketchfab/fokker_eindecker_e.iii.glb',
        title='Fokker Eindecker E.III',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/fokker-eindecker-eiii-bf1ab0a7b7a64f5d9a825ac2fddf35dd',
        axes='xaft', scale=1.0, tex='none',
        note='1915, wing-warping, rotary engine, tailskid. The oldest shape in '
             'the set by forty years and the only one with no ailerons.',
    ),
    'pa28': dict(
        key='pa28',
        glb='assetsSketchfab/piper_pa_28_cadet.glb',
        title='Piper PA-28 "Cadet"',
        author='helijah (Emmanuel BARANGER)',
        lic='CC-BY-4.0',
        url='https://sketchfab.com/3d-models/piper-pa-28-cadet-ba310f1e1ba349c7a54ab9db92e48970',
        axes='xaft', scale=1.0, tex='none',
        note='the PA-28-161 Cadet: the low-wing half of what most people learn '
             "on, and the Cub's descendant three decades later.",
    ),
}

# Every baked payload carries its own `lic` string, copied from the row above.
# The list of licences the ARTIFACT may carry lives in tools/_ref_check.js
# (PUBLISHABLE), because the gate is what enforces it — one authority, and it
# is the one that can go red.
