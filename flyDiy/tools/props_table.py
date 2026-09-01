#!/usr/bin/env python3
"""props_table.py — THE DECLARED PROP TABLE.

One row per prop the game may place in the hangar. This file is the single
authority: `tools/prop_prep.py` bakes exactly these rows, `tools/_prop_check.js`
asserts the baked payload against them, and the asset editor lists them in this
order. Nothing downstream discovers props by scanning a directory.

Each row:
  key     the game-side name. lowercase, `<what>_<qualifier>`, stable forever
          (a saved hangar layout will reference it). NOT the vendor's name.
  group   editor section, one of GROUPS below
  label   what the editor shows a human
  src     folder under assets/props/ (the DELIVERED asset, never edited)
  file    the glTF/GLB inside it
  mats    material names to keep; None = all. This is how one delivered file
          that holds two objects (metal_trash_can) becomes two props. It selects
          WHOLE primitives — no mesh is ever cut ([[import-models-as-is]]).
  place   where the prop meets the world, and therefore how the origin is moved:
            'floor'   centre x/z, drop min-y to 0   (default)
            'surface' same, but it stands on a bench/shelf, not the slab
            'wall'    origin left as delivered (the mount point is the origin)
            'ceiling' origin left as delivered (it hangs from y=0)
            'mount'   origin left as delivered (it bolts onto something)
  scale   uniform metres-per-unit on the delivered geometry (Sketchfab exports
          arrive in centimetres or worse). 1 unless stated.
  rot     degrees about x,y,z applied before centring — used to stand an asset
          on the axis the game uses, never to reshape it.
  tex     texture budget in px. The baker never upscales, so a 256 source
          stays 256. Props are 0.2-4 m objects seen across a 36 m shed: 512
          is the working default, 256 for anything under half a metre.
  note    why it is here / what to watch.
"""

# Editor sections, in display order.
GROUPS = [
    ('bench',    'benches & tables'),
    ('storage',  'storage'),
    ('machine',  'machines'),
    ('handling', 'handling'),
    ('vessel',   'drums & bins'),
    ('tools',    'tools'),
    ('curio',    'curios'),
    ('vehicle',  'vehicles & wheels'),
    ('fixture',  'fixtures'),
]

# Source provenance, keyed by the assets/props/<src> folder. `lic` drives what
# CREDITS.md must carry: CC0 needs nothing, CC-BY needs visible attribution.
SOURCES = {
    'barrel_02':                   ('Barrel 02', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/Barrel_02'),
    'barrel_03':                   ('Barrel 03', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/barrel_03'),
    'bench_vice_01':               ('Bench Vice 01', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/bench_vice_01'),
    'covered_car':                 ('Covered Car', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/covered_car'),
    'hand_truck':                  ('Hand Truck', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/hand_truck'),
    'hanging_industrial_lamp':     ('Hanging Industrial Lamp', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/hanging_industrial_lamp'),
    'industrial_storage_cart':     ('Industrial Storage Cart', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/industrial_storage_cart'),
    'metal_office_desk':           ('Metal Office Desk', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/metal_office_desk'),
    'metal_tool_chest':            ('Metal Tool Chest', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/metal_tool_chest'),
    'metal_trash_can':             ('Metal Trash Can', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/metal_trash_can'),
    'old_drill_press':             ('Old Drill Press', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/old_drill_press'),
    'old_military_compressor':     ('Old Military Compressor', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/old_military_compressor'),
    'old_tyre':                    ('Old Tyre', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/old_tyre'),
    'painted_wooden_stool':        ('Painted Wooden Stool', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/painted_wooden_stool'),
    'painted_wooden_table':        ('Painted Wooden Table', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/painted_wooden_table'),
    'portable_welding_cart':       ('Portable Welding Cart', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/portable_welding_cart'),
    'tool_cart':                   ('Tool Cart', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/tool_cart'),
    'vintage_radio_transceiver':   ('Vintage Radio Transceiver', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/vintage_radio_transceiver'),
    'vintage_spacecraft_instrument': ('Vintage Spacecraft Instrument', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/vintage_spacecraft_instrument'),
    'wooden_ladder':               ('Wooden Ladder', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/wooden_ladder'),
    'worn_metal_rack':             ('Worn Metal Rack', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/worn_metal_rack'),
    # second batch (2026-08-28), bought to retire the drawn fittings
    'barrel_stove':                ('Barrel Stove', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/barrel_stove'),
    'scandinavian_masonry_heater': ('Scandinavian Masonry Heater', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/scandinavian_masonry_heater'),
    'desk_lamp_arm_01':            ('Desk Lamp Arm 01', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/desk_lamp_arm_01'),
    'garden_hose_wall_mounted_01': ('Garden Hose Wall Mounted 01', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/garden_hose_wall_mounted_01'),
    'cardboard_box_01':            ('Cardboard Box 01', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/cardboard_box_01'),
    'plastic_jerrycan':            ('Plastic Jerrycan', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/plastic_jerrycan'),
    'propane_tank':                ('Propane Tank', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/propane_tank'),
    'small_lpg_tank':              ('Small LPG Tank', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/small_lpg_tank'),
    'mid_century_lounge_chair':    ('Mid Century Lounge Chair', 'Poly Haven', 'CC0', 'https://polyhaven.com/a/mid_century_lounge_chair'),
    'tool_cart_cab':               ('Tool Cart', 'jimbogies', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/tool-cart-16ceecf05f3e453e96c050f4c43f86b5'),
    'persian_carpet':              ('Signed Persian Qum Carpet', 'mfb64', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/signed-persian-qum-carpet-3d72e11edc964f21aadbd2d41d699527'),
    'work_trestle':                ('Cavalete de obra', 'Gato_Ze', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/cavalete-de-obra-d6cffcf8ff4f4a2c9614d829686d15a6'),
    'tools_pack':                  ('Tools Pack', 'MadeByYeshe', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/tools-pack-9b5b474257fd4a789353556bf8134b14'),
    'wood_table':                  ('Wood Table PBR Low-poly', 'Rectan', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/wood-table-pbr-low-poly-3b7d4b3081b14517b1fb3a55f8522a31'),
    'wood_crate':                  ('Wood Crate', 'Pedro Silva', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/wood-crate-d331f79189704cd49ba013752f2b8d80'),
    'cardboard_box_set':           ('Cardboard Box Set - Low Poly', 'Pixel_Monster', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/cardboard-box-set-low-poly-5d3d508061e544739e37c685af235684'),
    'tool_pack_box':               ('Complete Tool Pack - Realistic 3D Toolbox', 'GAMICO', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/complete-tool-pack-realistic-3d-toolbox-1e5dfcb2c0314eb38c105ffc0029b8a1'),
    # third batch (2026-08-30): the machine shop. All four are photogrammetry
    # scans of the same workshop by the same author, which is why they sit
    # together and why they look like each other.
    'panel_saw':                   ('Scie a format - Lycee pro de Fourchambault', 'Yannoid', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/scie-a-format-lycee-pro-de-fourchambault-aac60fce483a4ec0859a802e91a24b46'),
    'bandsaw':                     ('Scie a ruban - Lycee pro de Fourchambault', 'Yannoid', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/scie-a-ruban-lycee-pro-de-fourchambault-d40ef066d71e4ab8add3c795044e1a40'),
    'jointer':                     ('Degauchisseuse - Lycee pro de Fourchambault', 'Yannoid', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/degauchisseuse-lycee-pro-de-fourchambault-8671b197c39a40a7b654dd37d4600857'),
    'thicknesser':                 ('Raboteuse - Lycee professionnel de Fourchambault', 'Yannoid', 'CC-BY-4.0', 'https://sketchfab.com/3d-models/raboteuse-lycee-professionnel-de-fourchambault-b0d579ac5d744497b74177d0ee141cbe'),
    # THE ONE ROW WHOSE GEOMETRY IS AUTHORED HERE. Everything else in this
    # table is a delivered model; the plan is a delivered IMAGE, and the only
    # geometry a sheet of paper needs is the quad that holds it. So
    # `plan_avion.gltf` is two triangles written by hand (1.40 x 1.05 m, the
    # image's own 4:3, origin at the top edge where it is pinned) and
    # `plan_avion.webp` is the picture byte-for-byte. Rule 1 is unbroken: the
    # asset is still imported as-is, there simply is no author's mesh to keep.
    'plan_avion':                  ('Avion de Plaisance - monomoteur 2 places, plan 78-05-14', 'the player', 'own work', ''),
}


def P(key, group, label, src, file, note, mats=None, place='floor',
      scale=1.0, rot=(0, 0, 0), tex=512):
    return dict(key=key, group=group, label=label, src=src, file=file,
                mats=mats, place=place, scale=scale, rot=rot, tex=tex, note=note)


PROPS = [
    # ---- benches & tables --------------------------------------------------
    P('workbench_wood', 'bench', 'painted work table', 'painted_wooden_table',
      'painted_wooden_table_1k.gltf',
      '2.4 m painted trestle table, the replacement for the drawn bench() top. '
      'It is grey-blue paint, not bare wood - table_wood is the bare one'),
    P('table_wood', 'bench', 'plain wood table', 'wood_table',
      'wood_table_pbr_low-poly.glb',
      '132 tris: the one to use when a room needs six of something'),
    P('desk_metal', 'bench', 'metal office desk', 'metal_office_desk',
      'metal_office_desk_1k.gltf', 'the paperwork corner'),
    P('stool_wood', 'bench', 'painted stool', 'painted_wooden_stool',
      'painted_wooden_stool_1k.gltf', 'seat for the bench and the stove corner'),
    P('chair_lounge', 'bench', 'lounge chair', 'mid_century_lounge_chair',
      'mid_century_lounge_chair_1k.gltf',
      'the stove corner\'s armchair - replaces the drawn box-and-leather chair'),

    # ---- storage -----------------------------------------------------------
    P('rack_steel', 'storage', 'worn steel shelving', 'worn_metal_rack',
      'worn_metal_rack_1k.gltf', '1.9 m rack — replaces the drawn shelving()'),
    P('toolchest_metal', 'storage', 'metal tool chest', 'metal_tool_chest',
      'metal_tool_chest_1k.gltf', 'replaces the drawn toolChest()'),
    P('cart_tool', 'storage', 'rolling tool cart', 'tool_cart',
      'tool_cart_1k.gltf', 'replaces the drawn partsTrolley()'),
    P('cart_storage', 'storage', 'industrial storage cart', 'industrial_storage_cart',
      'industrial_storage_cart_1k.gltf', 'the big shelved trolley; u wraps to 2.0'),
    # One delivered file, three crates side by side, in millimetres.
    P('crate_wood_a', 'storage', 'wooden crate', 'wood_crate', 'wood_crate.glb',
      'replaces the drawn crate stack', mats=['Wood_Crate_A'], scale=0.001, tex=512),
    P('crate_wood_b', 'storage', 'tall wooden crate', 'wood_crate', 'wood_crate.glb',
      'the tall one of the three, 0.41 x 0.82 x 0.42 m', mats=['Wood_Crate_B'], scale=0.001, tex=512),
    P('crate_wood_c', 'storage', 'long wooden crate', 'wood_crate', 'wood_crate.glb',
      'the long one of the three, 1.01 x 0.41 x 0.42 m', mats=['Wood_Crate_C'], scale=0.001, tex=512),
    P('box_cardboard', 'storage', 'taped cardboard box', 'cardboard_box_01',
      'cardboard_box_01_1k.gltf',
      'the scanned single box - the one to stack, where boxes_cardboard is a set'),
    # Delivered in INCHES (41 x 35 x 23 units = 1.05 x 0.90 x 0.58 m), and with
    # decorative `edge_color...` materials that own no triangles at all.
    P('cart_tool_cab', 'storage', 'tool cabinet cart', 'tool_cart_cab',
      'tool_cart.glb',
      'the closed drawer cabinet, next to cart_tool\'s open shelves. 80 k tris '
      'and 10 materials: the most expensive way to own a box on wheels here',
      scale=0.0254),

    # ---- machines ----------------------------------------------------------
    P('drillpress', 'machine', 'pillar drill', 'old_drill_press',
      'old_drill_press_1k.gltf', 'stands against the back wall'),
    P('compressor', 'machine', 'piston compressor', 'old_military_compressor',
      'old_military_compressor_1k.gltf',
      'the heaviest prop at 79 k tris; delivered 4 m off its origin'),
    P('weldingcart', 'machine', 'oxy-acetylene cart', 'portable_welding_cart',
      'portable_welding_cart_1k.gltf', 'replaces the drawn bottleRack()'),
    P('vice_bench', 'machine', 'bench vice', 'bench_vice_01',
      'bench_vice_01_1k.gltf',
      'replaces the vice drawn inside bench(); origin is the mounting face, '
      'so it sits on a bench top by placing it AT the top', place='mount', tex=256),

    # The four woodworking machines from the Lycee Pro de Fourchambault, which
    # are PHOTOGRAMMETRY SCANS and behave unlike everything above them:
    #   - they arrive in metres, standing on Y, min-y already ~0.1 -> scale 1,
    #     rot 0. Nothing needs turning; this is measured, not assumed.
    #   - their materials are UDIM TILES (u1_v1, u2_v1, ...), one material and
    #     one 4k JPEG per tile, which is why one machine is 4-8 materials.
    #   - they are exported KHR_materials_unlit with a baseColorTexture and
    #     nothing else: no normal map, no roughness map, the scan's own
    #     lighting baked into the albedo. The baker drops the unlit flag, so
    #     they light like everything else in the shed and merely read a little
    #     flat. An unlit material would have been a fifth self-lit thing with
    #     no switch, one section after G65 closed that hole.
    #   - they are HEAVY: 80-137 k tris each, 453 k for the set, against 79 k
    #     for the compressor that used to be the worst. Not decimated, on
    #     purpose ([[import-models-as-is]]): the geometry IS the asset, and
    #     the cost is a loading screen.
    P('panelsaw', 'machine', 'sliding panel saw', 'panel_saw', 'panel_saw.glb',
      '4.4 x 3.6 m sliding-table saw, the biggest machine in the shed and the '
      'one that needs clear floor on two sides'),
    P('bandsaw', 'machine', 'band saw', 'bandsaw', 'bandsaw.glb',
      '2.8 m tall; goes against a wall since only its front face is worked'),
    P('jointer', 'machine', 'surface planer', 'jointer', 'jointer.glb',
      '2.7 m of table, wants length along a wall, not across the floor'),
    P('thicknesser', 'machine', 'thicknesser', 'thicknesser', 'thicknesser.glb',
      'the pair to the jointer - one flattens a face, the other brings it to '
      'thickness, so they stand together'),

    # ---- handling ----------------------------------------------------------
    P('handtruck', 'handling', 'sack truck', 'hand_truck',
      'hand_truck_1k.gltf', 'leans against a wall'),
    P('stepladder', 'handling', 'wooden step ladder', 'wooden_ladder',
      'wooden_ladder_1k.gltf', 'replaces the drawn stepladder()'),
    P('work_trestle', 'handling', 'work trestle', 'work_trestle',
      'cavalete_de_obra.glb',
      'the stand every workshop piece rests on. 0.82 m to the top, 336 tris, '
      'so a piece can have four of them without thinking about it'),

    # ---- drums & bins ------------------------------------------------------
    P('drum_steel', 'vessel', 'steel oil drum', 'barrel_03',
      'barrel_03_1k.gltf', 'replaces the drawn drum(); 1473 tris'),
    P('barrel_plastic', 'vessel', 'plastic barrel', 'barrel_02',
      'Barrel_02_1k.gltf', 'the blue-plastic one, for variety'),
    # One delivered file, two bins standing side by side.
    P('bin_metal', 'vessel', 'metal bin', 'metal_trash_can',
      'metal_trash_can_1k.gltf', 'clean of the pair',
      mats=['metal_trash_can']),
    P('bin_metal_rust', 'vessel', 'rusted metal bin', 'metal_trash_can',
      'metal_trash_can_1k.gltf', 'rusted of the pair',
      mats=['metal_trash_can_rust']),
    P('bottle_propane', 'vessel', 'propane bottle', 'propane_tank',
      'propane_tank_1k.gltf',
      'the tall grey one - with bottle_lpg it replaces the drawn bottleRack() '
      'cylinders, now standing in weldingcart\'s company'),
    P('bottle_lpg', 'vessel', 'LPG bottle', 'small_lpg_tank',
      'small_lpg_tank_1k.gltf', 'the squat domed one'),
    P('jerrycan', 'vessel', 'plastic jerrycan', 'plastic_jerrycan',
      'plastic_jerrycan_1k.gltf', 'fuel for the aeroplane, by the drums'),

    # ---- tools -------------------------------------------------------------
    P('toolrack_wall', 'tools', 'wall tool rack', 'tools_pack', 'scene.gltf',
      'a shadow board with fourteen tools on it — replaces the drawn '
      'pegboard(). Delivered as a flat panel in xy with the back face at '
      'z = 0.015, so it hangs by sitting AT the wall', place='wall'),
    P('toolbox_open', 'tools', 'open toolbox', 'tool_pack_box',
      'complete_tool_pack__realistic_3d_toolbox.glb',
      'toolbox with the lid up and its tools laid out; its parts are named '
      '(toolbox/hammer/screwdriver/...) if it ever wants splitting',
      place='surface'),

    # ---- curios ------------------------------------------------------------
    P('radio_bench', 'curio', 'vintage transceiver', 'vintage_radio_transceiver',
      'vintage_radio_transceiver_1k.gltf',
      'replaces the drawn box-and-disc shop radio', place='surface'),
    P('instrument_panel', 'curio', 'vintage instrument', 'vintage_spacecraft_instrument',
      'vintage_spacecraft_instrument_1k.gltf', 'shelf curio', place='surface'),
    P('plan_wall', 'curio', 'hand-drawn aeroplane plan', 'plan_avion',
      'plan_avion.gltf',
      'a 1.4 x 1.05 m general-arrangement drawing to pin on a shed wall. Flat '
      'in xy facing +z with its back at z = 0.004, exactly as toolrack_wall '
      'hangs; the origin is the TOP EDGE, so the sheet hangs BELOW y=0 and a '
      'site places it at PIN height, not at its lower edge. tex is 1024 (not '
      'the 512 default) because the point of a plan is that you can lean in '
      'and read it', place='wall', tex=1024),

    # ---- vehicles & wheels -------------------------------------------------
    P('car_covered', 'vehicle', 'car under a dust sheet', 'covered_car',
      'covered_car_1k.gltf', 'fills the far corner of a 36 m shed'),
    # Delivered standing on its edge (disc in xy, axis z): a quarter turn about
    # x lays it flat so a stack is a stack.
    P('tyre', 'vehicle', 'old tyre', 'old_tyre', 'old_tyre_1k.gltf',
      'replaces the torus in the drawn tyreStack()', rot=(90, 0, 0)),

    # ---- fixtures ----------------------------------------------------------
    P('lamp_pendant', 'fixture', 'industrial pendant lamp', 'hanging_industrial_lamp',
      'hanging_industrial_lamp_1k.gltf',
      'hangs BELOW its origin (y -1.34..0.015): place it at the ceiling. '
      'Carries an emissive map and a transmissive glass material',
      place='ceiling'),
    P('lamp_desk', 'fixture', 'anglepoise desk lamp', 'desk_lamp_arm_01',
      'desk_lamp_arm_01_1k.gltf',
      'clamps to a table edge, so the origin is the CLAMP (y -0.09..0.81) and '
      'it is placed at the top of the bench, not on the floor. Its shade '
      'carries a warm emissive - light the plan table with it',
      place='mount'),
    P('hosereel_wall', 'fixture', 'wall hose reel', 'garden_hose_wall_mounted_01',
      'garden_hose_wall_mounted_01_1k.gltf',
      'replaces the drawn torus hose reel; hangs from a wall bracket, so the '
      'origin is the BRACKET and the coil hangs below it', place='wall'),
    P('stove_masonry', 'fixture', 'masonry heater', 'scandinavian_masonry_heater',
      'scandinavian_masonry_heater_1k.gltf',
      '2.36 m of stove with its own flue stub - the body of the cosy corner. '
      'The flue still has to be drawn on up through the roof: this is a '
      'domestic heater, and the shed is 8.4 m to the eaves'),
    P('stove_barrel', 'fixture', 'barrel stove', 'barrel_stove',
      'barrel_stove_1k.gltf',
      'the shed-built drum stove, for when the masonry heater is too grand'),
    # THE FRINGE. The delivered carpet is 631 556 triangles, and 630 456 of
    # them are the two 3 cm fringes at the ends, modelled thread by thread and
    # carrying no texture at all; the carpet ITSELF is 1 100 triangles and
    # holds the whole pattern. `mats` keeps that primitive whole and leaves the
    # fringe primitive whole and unused - selection, exactly like the two bins,
    # not a cut. Add 'VELVET-GREEN__Budapest' to this list to get it back, and
    # accept 1.76x the entire rest of the library for two strips of thread.
    P('rug_persian', 'fixture', 'persian carpet', 'persian_carpet',
      'signed_persian_qum_carpet.glb',
      'the stove corner\'s rug; 3.12 x 2.06 m', mats=['material']),
]

# Kept out of PROPS on purpose. Written down so the next session does not
# re-import them thinking they were missed.
DISCARDED = [
    ('boxes.glb', 'Boxes (Hamidreza Oloumi, CC-BY-4.0)',
     '166 820 tris and 21.6 MB of maps for cardboard boxes. boxes_cardboard '
     '(110 tris) and crate_wood_a/b/c cover the same need. Decimation is off '
     'the table, so it cannot be made affordable.'),
    # (the masonry heater was discarded in the first batch for shipping as a
    # .blend only; it was re-delivered as glTF and is now `stove_masonry`.)
    ('cardboard_box_set-_low_poly.glb', 'Cardboard Box Set - Low Poly '
     '(Pixel_Monster, CC-BY-4.0)',
     'DISMISSED by the user 2026-08-28 after seeing it in the room: at 110 '
     'triangles for a whole group of boxes it has no lids and no thickness, so '
     'from anywhere but dead ahead it reads as flat card standing on the floor. '
     'box_cardboard (the Poly Haven scan) and crate_wood_a/b/c do the job, and '
     'they stack.'),
    ('signed_persian_qum_carpet.glb / VELVET-GREEN__Budapest',
     "the carpet's FRINGE (mfb64, CC-BY-4.0)",
     '630 456 of that file\'s 631 556 triangles, for the two 3 cm fringes at '
     'the ends of the rug — modelled thread by thread and carrying no texture '
     'at all. The carpet ITSELF is the other 1 100 triangles and is kept whole '
     'as `rug_persian`. Adding this material name back to that row\'s `mats` '
     'buys 1.76x the entire rest of the library, in thread.'),
    ('exterior_aircon_unit_1k.gltf', 'Exterior Aircon Unit (Poly Haven, CC0)',
     'delivered as TWO variants of the same mesh (clean + rusted) = 19 k tris '
     'and 6.8 MB, the heaviest map set in the batch, and the only asset whose '
     'grille needs a separate opacity map. An exterior air-conditioner is also '
     'the least hangar-shaped thing in the batch. Overrule freely: it is one '
     'row here plus an alpha path in the baker.'),
]
