# Credits

## Piper PA-18 3D model (`assets/pa18/`, baked and served from media/)

- **Model**: Emmanuel BARANGER (helijah), created for FlightGear
  (Blender 2.77 / GIMP 2.8). Author's site: helijah.free.fr
- **Livery** (`texture.png`): Brett HARRISON, 2010.
- **License** — the author has published this model under two statements:
  - the FlightGear distribution's `Read-Me.txt` (kept verbatim in
    `assets/pa18/Read-Me.txt`): *"This files are GPL."*
  - the author's Sketchfab listing of the same model
    (https://skfb.ly/NvEt): **CC-BY 4.0**.

  Both statements originate from the author. This repo records both honestly:
  visible attribution is carried in the sim's footer (CC-BY's requirement),
  and the complete source model (OBJ + MTL + textures) ships in this public
  repository at `assets/pa18/` (GPL's source-availability requirement for the
  derived baked payload `src/models/pa18_model.js`).

- The baked payload carries a machine-readable provenance header (written by
  `tools/model_prep.py`); the served pages load that payload verbatim.

## Cessna 172SP 3D model (`assetsSketchfab/`, `assets/c172/`, baked and served from media/)

- **Model**: "FREE Cessna 172SP" by **NLM** (https://sketchfab.com/NLM-Group).
  Source listing:
  https://sketchfab.com/3d-models/free-cessna-172sp-c9cadc2f026946da8cf9715a683739e9
- **License**: **CC-BY 4.0** (http://creativecommons.org/licenses/by/4.0/),
  as declared in the GLB's own `asset.extras` block.
- CC-BY requires visible attribution: it is carried in the sim's footer and in
  the provenance header of the baked payload `src/models/c172_model.js`
  (written by `tools/model_prep.py`).
- The GLB as delivered lives at `assetsSketchfab/free_cessna_172sp.glb`,
  which since 2026-09-05 is a LOCAL INPUT rather than a tracked file (the
  external-asset ruling: the shipped store is `media/`, the raw sets are
  re-fetched from the listing above). The model-frame OBJ + MTL + textures at
  `assets/c172/` are *generated* from it by `python tools/glb_extract.py c172`
  — regenerate rather than edit. (Contrast the PA-18, whose OBJ is the
  delivered source and stays committed for GPL source availability.)
- Modifications made, as CC-BY asks to be indicated: axis/scale conversion to
  the sim's model frame, removal of the "remove before flight" ribbons and
  ground tie-downs, splitting the fused flap and aileron meshes into left and
  right, and mirroring the (single, right-hand) wing strut to give the left
  one. The mesh and the textures are otherwise unaltered — no decimation and
  no re-encoding.

## Reference aeroplanes (`assetsSketchfab/`, baked and served from media/)

The garage's REFERENCE PLANE (`src/viewer/refplane.js`) stands a real
aeroplane beside your build. These eleven are all by the same modeller as the
PA-18 above, delivered as Sketchfab GLBs and baked to reference-only payloads
by `python tools/ref_prep.py --all` from the declared table in
`tools/ref_table.py`. They are **display only** — never flown, never an input
to the spec, and GATE REF asserts both. Since the hand-written fleet retired
(2026-09-05) the PA-18 and the C172 above are reference planes too: their
payloads still carry the rigging they were baked with, but nothing flies them.
The delivered GLBs are local inputs (not tracked — see `.gitignore`); each
listing below is where a fresh clone re-fetches its file.

- **Model**: Emmanuel BARANGER (**helijah**, https://sketchfab.com/helijah),
  created for FlightGear.
- **Licence is recorded verbatim.** It is recorded here exactly as
  each GLB's own `asset.extras` block declares it, and each baked payload
  carries its own `lic` field so `tools/_ref_check.js` can hold the artifact
  to it:

  **CC-BY 4.0** — attribution required, carried in the sim's footer:

  | key | title | listing |
  |---|---|---|
  | `d112` | Jodel D.112 (D11 variant) | https://sketchfab.com/3d-models/jodel-d112-d11-variant-747c7684ec8645398ff8e00e280a5f97 |
  | `pio200` | Alpi Pioneer 200 | https://sketchfab.com/3d-models/alpi-pioneer-200-b655fc12d7784997987fdb2a6c8961b0 |
  | `c195` | Cessna 195 Businessliner (wheels version) | https://sketchfab.com/3d-models/cessna-195-businessliner-wheels-version-3cbe7fa4514e48c9a204b5565dfe4dbb |
  | `da40` | Diamond DA40 | https://sketchfab.com/3d-models/diamond-da40-dfda5fad07c24c12be13a23562fe83e3 |
  | `g115` | Grob G 115 | https://sketchfab.com/3d-models/grob-g-115-64bc0e98d56a4f88a2833dbefa2ca975 |
  | `stemme` | Stemme Sky Sportster S6 | https://sketchfab.com/3d-models/stemme-sky-sportster-s6-3444184089ea443bb2ad006e9129a750 |
  | `guepard` | Super Guepard 912 | https://sketchfab.com/3d-models/super-guepard-912-207f2678545f4b66ac1b1e1dbc3904e7 |
  | `yak18t` | Yak 18 T | https://sketchfab.com/3d-models/yak-18-t-zM1VKOfkihgOEdx09hsGd6qnp5q |
  | `draco` | PZL 104 Wilga 2000 "Draco" | https://sketchfab.com/3d-models/pzl-104-wilga-2000-draco-70402e1b9c9147b199d1497ccd0b3e84 |
  | `eiii` | Fokker Eindecker E.III | https://sketchfab.com/3d-models/fokker-eindecker-eiii-bf1ab0a7b7a64f5d9a825ac2fddf35dd |
  | `pa28` | Piper PA-28 "Cadet" | https://sketchfab.com/3d-models/piper-pa-28-cadet-ba310f1e1ba349c7a54ab9db92e48970 |

  All eleven ride in the served pages — see `build.js` MANIFEST.models, which
  is the publish list. The size ceiling that used to hold most of them back
  died when the artifact went multi-file (2026-09-01).

  **"SKETCHFAB Standard" imports were deleted outright** (2026-09-01, user
  ruling): four of helijah's listings (`a22` Aeroprakt A22 Foxbat, `p68`
  Partenavia P.68, `rv8` Van's RV-8, `sr22` Cirrus SR22) carried that licence,
  which does **not** permit redistribution. They could never ship, so their
  GLBs, payloads and presets were removed rather than kept local. GATE REF
  still fails the build if a non-CC-BY payload ever lands on the publish list.

  helijah's FlightGear aircraft are GPL-2.0 at source (the FGMEMBERS
  repositories on GitHub); what a given **Sketchfab listing** carries is a
  separate per-upload choice, and `tools/ref_table.py` records what each file
  actually says rather than what the set as a whole is assumed to say.

- **Modifications made**, as CC-BY asks to be indicated: none to the geometry
  — no decimation, no welding, no parts dropped, and where base-colour maps
  are carried at all (`tex='copy'`) they are carried byte-for-byte as
  delivered. The payload is a re-container:
  positions quantised to 0.2 mm over the model's own bounding box, triangles
  grouped by the source's own materials (and split where a material exceeds
  the container's 65 535-vertex index limit), and constant metalRough maps
  folded into the scalars they already were. The frame is unchanged — these
  exports already arrive in the sim's model frame (x aft, y up, z left).
- **Dimensions checked against published specifications**, which is what makes
  the reference worth measuring against. GATE REF holds each decoded payload
  to the type's published span and length within 1.5%; all but two are inside
  1%. The exceptions are noted on their own rows in `refplane.js`: the Pioneer
  200, whose published figures disagree with *each other* by more than the
  model differs from any of them, and the Super Guépard, where English
  Wikipedia's 8.5 m span is 15% under both the model and every French source.
- **One of the eleven has NO PRESET**: `draco`. Mike Patey's turbine Wilga is
  a one-off with a lengthened nose and a re-spanned wing, and nobody has
  published its dimensions — so nothing can hold its scale, and a reference
  whose scale nothing holds is worse than no reference at all. It is baked and
  credited here; it is not offered as something to measure against.

## Hangar skies and surfaces (`assets/hangar_sky/`, `assets/hangar_walls/`, `assets/concrete_floor_damaged_01/`, baked and served from media/)

**Poly Haven, CC0** — no attribution required, recorded here anyway because a
repository that cannot say where its art came from is a repository that cannot
re-derive it (https://polyhaven.com).

- **Skies** (`assets/hangar_sky/`, 4k HDRIs): `alps_field`, and the Kloppenheim
  time-of-day series — `kloppenheim_05` (noon), `kloppenheim_03` (afternoon,
  covered), `kloppenheim_01` (sunset), `kloppenheim_02` (night). The four
  Kloppenheim panoramas are the same place at four times, which is what lets
  the hangar's moods be one day rather than four unrelated looks.
- **Wall sets** (`assets/hangar_walls/`, 1k PBR): `factory_wall`,
  `rusty_metal_02`, `rusty_metal_sheet`, `concrete_004`, `concrete_008`,
  `concrete_wall_slabs`, `sandstone_blocks`, `brown_planks_09`,
  `raw_plank_wall`.
- **Floor** (`assets/concrete_floor_damaged_01/`, 1k PBR).

Modifications made:

- **Skies: tone-mapped and measured, never geometrically altered.** Each `.hdr`
  is the file as delivered. `tools/sky_prep.py` writes two derivatives from it:
  a display equirect (`<key>.jpg`, 4096x2048, straight exposure into sRGB at
  JPEG q82) for the backdrop sphere, since browsers read no Radiance; and
  `skies.json`, the light rig integrated off the float radiance — sun
  direction, sun colour, sky and ground colour, and how directional the light
  is. The panorama is not cropped, rotated in place, or retouched; the room
  turns its backdrop sphere instead, by a per-sky yaw recorded in that file.
- **Surfaces: converted, not resampled.** The EXR normal and roughness maps
  were converted once to PNG/JPG with ImageMagick — browsers read no EXR — at
  the delivered 1k resolution.

## Airfield ground surfaces (`assets/airfield/`, baked and served from media/)

Ten CC0 PBR sets, from two libraries, for the surfaces of the base aerodrome —
the apron and taxiway, the mown strip, and the field they stand in. They are one
library shared by both scenes: the same material dresses the ground you taxi on
in the world and the ground you see through the hangar door.

**Poly Haven, CC0** (https://polyhaven.com) — `anti_slip_concrete`,
`cracked_concrete_02`, `brushed_concrete_04`, `dirt_floor`, `leafy_grass`,
`asphalt_02`, `aerial_asphalt_01`.

**ambientCG, CC0** (https://ambientcg.com) — `Ground003`, `Grass004`,
`Grass005`.

Neither licence requires attribution; both are recorded for the same reason as
the sets above — a repository that cannot say where its art came from cannot
re-derive it.

Modifications made:

- **Normalised, not retouched.** The three delivered shapes — Poly Haven's
  packed `arm`, Poly Haven's plain `rough`, and ambientCG's own naming — become
  one contract (`diff` / `nor_gl` / `rough`) in `tools/site_tex_import.py`. The
  only channel work is lifting roughness out of `arm`'s GREEN, which is where
  the format puts it; R is ambient occlusion and B is metalness, and both are
  discarded. Nothing is recoloured, sharpened or tiled.
- **Resampled, and reversibly.** Each set is written twice: a 1k archive and a
  512 working copy. The game serves 512 (~3.2 MB of files under
  `media/tex/site/` for all ten against ~15 MB at 1k), because ground read at
  grazing angles across hundreds of metres does not resolve 1k. Raising a
  row's `tex` in `tools/site_tex_prep.js` and re-running it restores the full
  resolution with no re-import — the same budget rule the prop baker uses.
- **Normals stay JPEG**, unlike `assets/hangar_walls/`, which keeps PNG. These
  are ground planes, and PNG would cost about half a megabyte a set for a
  difference nothing in this scene can show.
- **Geometry discarded.** Every Poly Haven set is delivered as a glTF preview
  sphere. Only the maps are imported; the sphere is not.

## Wood detail sheets (`assets/wood/`, baked and served from media/)

Four CC0 PBR wood sets for the AEROSKIN material library (G125) — the scanned
grain the wooden propellers and the wood-construction airframe finishes wear.

**Poly Haven, CC0** (https://polyhaven.com) — `white_maple_veneer` (the
`maple` finish, and the `ply` skin's face), `walnut_veneer_02` (`walnut`),
`natural_walnut_veneer` (`walnutFig`).

**ambientCG, CC0** (https://ambientcg.com) — `Wood091B` (the `laminate`
sheet: `spruce` structure and the beech laminate blade).

Neither licence requires attribution; recorded for the usual reason.

Modifications made:

- **Normalised AND packed.** `tools/wood_tex_import.py` writes the same
  `diff` / `nor_gl` / `rough` contract as the airfield sets, then packs each
  into AEROSKIN's own detail-sheet layout (`aero_*.jpg`): R,G are the normal's
  tangent xy taken verbatim from `nor_gl`, B is the diffuse's luminance
  recentred on the sheet convention's 0.80 mean — wood grain is colour, not
  height (G68), so the diffuse is the grain signal, and the albedo itself
  stays the player's colour picker, exactly as the material system rules.
- **Resampled, and reversibly.** 1k archive beside the 512 working copy, the
  same budget rule as every other import; all four sheets cost 0.15 MB of
  files under `media/tex/wood/`.
- **Geometry discarded.** The Poly Haven sets deliver glTF preview spheres;
  only the maps are imported.

## House materials (`assets/house/`, baked and served from media/)

Twenty-seven CC0 PBR sets for the WOODEN HOUSE library (G230, G234, G236) — the painted planks,
the metal roofing and the weathered timber the generated Alaskan houses wear.
The user delivered nineteen; four were left out with a reason (below).

**Poly Haven, CC0** (https://polyhaven.com) — `box_profile_metal_sheet`
(`boxprof`, the painted metal roof), `worn_corrugated_iron` (`corrworn`),
`rusty_corrugated_iron` (`corrrust`), `grey_roof_01` (`shingle`),
`rust_coarse_01` (`rust`), `blue_painted_planks` (`paintwood`),
`green_rough_planks` (`greenwood`), `wood_cabinet_worn_long` (`board`, the
trim), `wooden_rough_planks` (`roughwood`), `brown_planks_08` (`brownwood`),
`weathered_planks` (`greywood`), `weathered_brown_planks` (`wornwood`),
`wood_floor_deck` (`deckwood`), `concrete_floor_damaged_01` (`concrete`), and
from G234 `cracked_concrete_02` (`concretec`) — the SECOND foundation, coarser
in the grain and darker in every channel than the first, because a footing and
a stem wall are never poured the same day. G236 adds the THREE PLAIN TIMBERS
the frame is made of, delivered by the user for exactly that: `rough_wood`
(`rough`), `moss_wood` (`mossy`) and `fever_tree_bark` (`feverbark`). None of
them has a joint in it, which is the whole point — a post is one stick, and a
plank scan draws three joints across it.

**The sky the house is lit by** (G234) is Poly Haven's `grasslands_sunset`
(CC0), delivered by the user as a 2k Radiance equirect. It is not shipped as
the .hdr: `tools/house_sky_prep.py` writes a 512x256 RGBE PNG for the
environment (lighting and every reflection, kept linear) and a tone-mapped 2k
JPEG for the backdrop, both under `media/tex/house/`, plus the measured sun
vector, its colour and its share of the sphere's light.

**ambientCG, CC0** (https://ambientcg.com) — `Metal037` (`galv`, the
galvanised sheet the gutters, the downpipe and the stove pipe are made of),
and from the second delivery (G232): `Planks025A` (`darkwood`),
`Planks025C` (`stain` — dark stained boards, and from G234 the one set in the
library that is never recoloured: a stain is a finish that shows the wood, and
neutralising it to take a tint is no longer a stain at all),
`WoodSiding010` (`shakes`, the weathered shake siding),
and `Bark015` (`bark`, G232.4 — a driven pile is a tree with its skin still
on, and it is the only `log`-kind set in the library).

**The two VENEERS are not a new import.** `veneer` and `veneerdark` are
`assets/wood/maple` and `assets/wood/walnutfig` — the aeroplane's own CC0
wood library (Poly Haven `white_maple_veneer` and `natural_walnut_veneer`,
credited under *Wood detail sheets* above) — copied into the house contract at
a house scale. A casing, a corner board and a barge board are MILLED stock:
tiling a plank-wall scan onto a 100 mm board puts three plank joints across a
board that has none, which is what made the first cut's finish read as
cladding rather than as trim.

Neither licence requires attribution; recorded for the usual reason.

**Not imported**, and the reason is the theme rather than the quality:
`natural_walnut_veneer` (a cabinet veneer — it is already in `assets/wood/` as
the aeroplane's `walnutFig`, and no Alaskan house is clad in figured walnut),
`clay_roof_tiles` and `roof_3` (Mediterranean tile; southeast Alaska roofs are
metal or shake), and clean `corrugated_iron` (`box_profile_metal_sheet` covers
a new metal roof, and the two worn corrugated sets are the characterful ones).

Modifications made:

- **Normalised.** `tools/house_tex_import.py` writes the same
  `diff` / `nor_gl` / `rough` contract as the airfield and wood sets. The two
  Poly Haven packings (a plain `rough` map, or roughness in `arm`'s green) are
  told apart by looking in the zip, because this delivery mixes them.
- **Neutralised, for the ones the house paints.** `boxprof`, `paintwood`,
  `greenwood` and `board` also leave as a `paint_*.jpg`: hue removed,
  luminance re-based on 0.78 of white with a soft knee, so `map * color`
  reproduces a bright paint colour at any hue instead of the mud a red tint on
  a blue scan gives. The peeling, the knots and the plank shadows survive; only
  the hue leaves.
- **Resampled to a texel density, not to a budget.** Each set declares `tile`,
  the metres of building one repeat covers, and the payload size is the power
  of two nearest 320 px/m — so a 1.2 m plank sheet and a 2 m shingle sheet do
  NOT both land at 512. Achieved: 256-427 px/m, a 1.67:1 spread across the
  library, held by GATE HOUSE. 1k archives stay beside the payload, so
  promoting a set is one number and a re-run.
- **Geometry discarded.** The Poly Haven sets deliver glTF preview spheres;
  only the maps are imported.

## Skin sheets (`assets/skin/`, baked and served from media/)

The CC0 PBR sets the AEROSKIN material library wears that are not wood: the
fireproof sheet on the engine side of the firewall (2026-09-03), and the
dashboard's two surfaces (2026-09-04) — the bare alloy instrument facia and
the dark hide of the coaming round it.

**ambientCG, CC0** (https://ambientcg.com) — `Foil001` (the `foil` sheet, worn
by the `fireFoil` finish), `Metal050C` (the `panel` sheet, worn by
`panelMetal`), `Leather027` (the `leather` sheet, worn by `leatherDark`).

The licence does not require attribution; recorded for the usual reason.

Modifications made:

- **Normalised AND packed.** `tools/skin_tex_import.py` writes the same
  `diff` / `nor_gl` / `rough` contract as the wood sets, then packs the set
  into AEROSKIN's detail-sheet layout (`aero_*.jpg`): R,G are the normal's
  tangent xy taken verbatim from `NormalGL`, B is the ROUGHNESS map recentred
  on the sheet convention's 0.80 mean. B rides roughness rather than the
  diffuse here because Foil001's Color map is flat grey (span 121..134 of
  255) while its roughness follows the crinkle — a metal is the opposite of a
  wood in exactly that respect.
- **Metalness map dropped.** It is 255 everywhere (measured); the finish row's
  own `metal` scalar carries it, and the packed sheet's A channel is the
  drawImage constant.
- **B rides a different map per set, and the choice is measured.** Leather027
  is the mirror image of the foil: its roughness is nearly flat (p1..p99 spans
  0.90..1.12 of its own mean) while its Color carries the crease pattern
  (0.65..1.76), so B rides the diffuse's luminance there, the wood rule.
  Metal050C is a foil's case again — Color 218..254 of 255, roughness
  0.62..1.70 of its mean — so B rides roughness.
- **Resampled, and reversibly.** 1k archive beside every working copy, the
  same budget rule as every other import. `foil` and `leather` ship the 512;
  `panel` ships the 1k, because the instrument facia is the surface the camera
  spends the most time nearest to. 0.47 MB in all under `media/tex/skin/`.

## Vessel surfaces (`assets/vessel/`, baked and served from media/)

The CC0 PBR sets the fuel tanks and battery packs are made of (2026-09-04).
These are NOT aeroskin sheets: a tank is an object in the scene with a
MeshStandardMaterial of its own, so the import writes the hangar props'
three-map recipe instead — `diff` (sRGB), `arm` (R ao, G roughness, B
metalness) and `nor` (GL tangent normal).

**Poly Haven, CC0** (https://polyhaven.com) — `green_metal_rust`, the painted
metal a tank or a case wears, and the one the editor's hue row recolours.

**ambientCG, CC0** (https://ambientcg.com) — `Metal038` (the steel hardware:
filler necks, sender plates, drain sumps, strap buckles, terminal posts),
`Plastic002` (moulded tanks and rubber bladders).

The bare-alloy set is **not a fourth download**: it is built from
`assets/skin/panel/` (ambientCG `Metal050C`), already in store for the
instrument facia. A welded aluminium tank is that same rolled sheet.

The licence does not require attribution; recorded for the usual reason.

Modifications made:

- **Repacked, not re-encoded in kind.** `tools/vessel_tex_import.py` merges
  roughness and metalness into one `arm` image (R is white — none of these
  sets ships a baked occlusion, so no material binds `aoMap`). Metal038's own
  metalness map rides B; the other three declare a constant there.
- **Plastic002's diffuse is renormalised to a pale mean (0.78) and the others
  are not.** A material's `color` MULTIPLIES its map, so a dark map can only
  ever be darkened — Plastic002's measured colour is a dark red-brown
  (48, 39, 38) and no tint reaches natural white polythene from there. The
  painted, steel and alloy sets keep their measured colour, because a hue
  rotation, a steel fitting and bare alloy are all things whose colour is a
  fact of the material.
- **The hue row is a measurement.** `green_metal_rust` puts 94% of its pixels
  in one fifteen-degree hue bin (90–105°) at a saturation of 0.325 ± 0.02 —
  there is no second hue in the sheet to protect — which is why a flat hue
  rotation is enough and needs no mask.
- **Resampled, and reversibly.** 1k archive beside every working copy, the
  usual budget rule; the payload ships the 512. 0.74 MB in all under
  `media/tex/vessel/`.

## Jodel DR1050 structures (`assets/jodel_structure/`, baked and served from media/)

- **Model**: the author of this repository, in Blender 4.0. A DR1050 fuselage
  structure (spruce formers and longerons, welded steel tube cockpit frame) and
  the cranked DR1050 wing structure (32 rib stations on two spars).
- **Licence**: own work. No third-party attribution applies.
- Baked by `tools/jodel_prep.py` into `src/props/props_airframe.js`, in the
  same pack format the Poly Haven / Sketchfab props use.
- Modifications: **geometry none** — no decimation, no welding, no retopology.
  The delivered OBJs are the author's own optimized exports and every triangle
  in them is in the payload; the only transform is the rigid one that puts each
  origin where the piece meets the world. **Materials assigned, not read**: the
  MTL ships `Kd 0 0 0` for `jojo_wood` (Blender writes black when the colour
  lives in a node graph), so the four material names are mapped to spruce and
  three steels in the baker rather than taken at face value.

## Hangar props (`assets/props/`, baked and served from media/)

The shed's furniture. Every row of the declared table in `tools/props_table.py`
names its source folder, and that table's `SOURCES` block is the machine-readable
version of what follows; the baked payloads (`src/props/props_*.js`) each carry
the same title/author/licence/url on every prop, and the prop bench
(`tools/_props.html`) shows it beside whatever is selected.

**Poly Haven, CC0** — no attribution required, recorded here anyway because a
repository that cannot say where its art came from is a repository that cannot
re-derive it: `barrel_02`, `barrel_03`, `barrel_stove`, `bench_vice_01`,
`cardboard_box_01`, `covered_car`, `desk_lamp_arm_01`,
`garden_hose_wall_mounted_01`, `hand_truck`, `hanging_industrial_lamp`,
`industrial_storage_cart`, `metal_office_desk`, `metal_tool_chest`,
`metal_trash_can`, `mid_century_lounge_chair`, `old_drill_press`,
`old_military_compressor`, `old_tyre`, `painted_wooden_stool`,
`painted_wooden_table`, `plastic_jerrycan`, `portable_welding_cart`,
`propane_tank`, `scandinavian_masonry_heater`, `small_lpg_tank`, `tool_cart`,
`vintage_radio_transceiver`, `vintage_spacecraft_instrument`, `wooden_ladder`,
`worn_metal_rack` (https://polyhaven.com).

**Sketchfab, CC-BY 4.0** — attribution REQUIRED, and carried in the sim's
footer alongside the aircraft credits:


- "Tools Pack" by **MadeByYeshe** (https://sketchfab.com/MadeByYeshe) —
  https://sketchfab.com/3d-models/tools-pack-9b5b474257fd4a789353556bf8134b14
- "Wood Table PBR Low-poly" by **Rectan** (https://sketchfab.com/Rectan) —
  https://sketchfab.com/3d-models/wood-table-pbr-low-poly-3b7d4b3081b14517b1fb3a55f8522a31
- "Wood Crate" by **Pedro Silva** (https://sketchfab.com/pxdrosilva) —
  https://sketchfab.com/3d-models/wood-crate-d331f79189704cd49ba013752f2b8d80
- "Complete Tool Pack - Realistic 3D Toolbox" by **GAMICO** (https://sketchfab.com/gamico) —
  https://sketchfab.com/3d-models/complete-tool-pack-realistic-3d-toolbox-1e5dfcb2c0314eb38c105ffc0029b8a1
- "Tool Cart" by **jimbogies** (https://sketchfab.com/jimbogies) —
  https://sketchfab.com/3d-models/tool-cart-16ceecf05f3e453e96c050f4c43f86b5
- "Signed Persian Qum Carpet" by **mfb64** (https://sketchfab.com/mfb64) —
  https://sketchfab.com/3d-models/signed-persian-qum-carpet-3d72e11edc964f21aadbd2d41d699527

The machine shop (added 2026-08-30) — four photogrammetry scans of the same
real workshop, by the same author:

- "Scie a format - Lycee pro de Fourchambault" by **Yannoid** (https://sketchfab.com/y.decouessin) —
  https://sketchfab.com/3d-models/scie-a-format-lycee-pro-de-fourchambault-aac60fce483a4ec0859a802e91a24b46
- "Scie a ruban - Lycee pro de Fourchambault" by **Yannoid** (https://sketchfab.com/y.decouessin) —
  https://sketchfab.com/3d-models/scie-a-ruban-lycee-pro-de-fourchambault-d40ef066d71e4ab8add3c795044e1a40
- "Degauchisseuse - Lycee pro de Fourchambault" by **Yannoid** (https://sketchfab.com/y.decouessin) —
  https://sketchfab.com/3d-models/degauchisseuse-lycee-pro-de-fourchambault-8671b197c39a40a7b654dd37d4600857
- "Raboteuse - Lycee professionnel de Fourchambault" by **Yannoid** (https://sketchfab.com/y.decouessin) —
  https://sketchfab.com/3d-models/raboteuse-lycee-professionnel-de-fourchambault-b0d579ac5d744497b74177d0ee141cbe

**The player's own, no licence needed** — `plan_avion` (added 2026-09-01): the
hand-drawn general-arrangement plan pinned to the shop wall, "Avion de
Plaisance — monomoteur 2 places", plan 78-05-14. Supplied by the player as an
IMAGE, not a model; the two triangles that hold it (`plan_avion.gltf`) are
authored in this repository, which is the one row of the prop table whose
geometry is not an author's mesh.

> **OPEN, and not fixed here.** The line above says this list is "carried in
> the sim's footer". It is not: `#credit` in `src/viewer/body.html` names the
> aircraft authors only, and nothing appends the prop authors to it. That was
> already true before these four scans, and they make it four names worse. It
> is left alone deliberately - `body.html` was being edited by another session
> at the time - but CC-BY's attribution clause is not satisfied by a file in
> the repo, so the footer needs the list (or a credits panel that shows it).

Modifications made, as CC-BY asks to be indicated (and applied to the CC0
assets identically):

- **Geometry: none.** Every triangle, normal and uv the author shipped is in
  the payload. No decimation, no welding, no removal of unseen faces. The only
  transforms are rigid ones declared per row in `tools/props_table.py`: a
  uniform scale where an export arrived in millimetres (`wood_crate`), a
  quarter turn to stand a wheel on the game's axis (`old_tyre`), and a
  translation putting each origin where the prop meets the world. The one
  row with no author's mesh to keep is `plan_avion`, which arrived as a
  picture: its quad is written here, and the picture itself is untouched.
- **Selection.** Where one delivered file holds several objects, whole
  primitives are selected by material name into separate props —
  `metal_trash_can` becomes two bins, `wood_crate` becomes three crates.
  Nothing is cut. The same mechanism leaves one primitive unused: the Persian
  carpet ships 631 556 triangles of which 630 456 are its two 3 cm fringes,
  modelled thread by thread and carrying no texture; `rug_persian` keeps the
  carpet's own 1 100-triangle primitive, whole, and does not instantiate the
  fringe primitive, which is likewise untouched.
- **Textures: re-encoded.** 1k source maps are resampled to 512 (256 for props
  under half a metre) and re-compressed; a map channel found to be constant is
  folded to a scalar and dropped. Spec-gloss materials are converted to
  metallic-roughness. The delivered maps ship unaltered at full resolution in
  `assets/props/`, so the quality comes back by re-running the baker with a
  larger budget.

## Design-tile silhouettes (the birth flow)

- **What**: the inline SVG silhouettes and glyphs on the macro-row tiles
  (`tools/_cage_design.js` — side/front/top-view builders plus the engine,
  gear and scheme glyphs). The section, planform and tip thumbnails are
  GENERATED from the build functions and are not artwork.
- **Licence**: own work. No third-party attribution applies; no icon set was
  imported (deliberately — see the standing footer gap noted above).

Note: this repository has no top-level LICENSE file; the statements above
apply to the PA-18, the C172, the hangar props and their derivatives only.

## Rigged characters (the crew models, G204)

- **What**: the skinned characters the crew layer can seat in place of the
  ATD-01 dummy — `Ch42` so far (`tools/chars_table.py` is the declared list;
  `src/chars/<key>_char.js` + `media/geo/chars/`, `media/tex/chars/`).
- **Source**: Adobe Mixamo (mixamo.com) characters, downloaded as FBX
  ("nonPBR" texture set: diffuse, normal, specular, glossiness).
- **Licence**: the Mixamo terms — royalty-free use of the characters within a
  project, including a published web page; the raw assets are NOT
  redistributed as such (`assets/chars/` is gitignored; what ships is the
  baked payload the game needs).
- **Imported as-is**: Blender headless converts FBX to GLB
  (`tools/fbx_to_glb.py`), `tools/char_prep.py` bakes every primitive, every
  vertex (float32) and the author's PNG textures byte-exact. Nothing is
  decimated or re-encoded; the spec/gloss maps ride along but are not used as
  roughness (a glossiness map is the inverse of one).
- **Clips (G205)**: "Sitting Idle" and "Piloting" animations by Adobe Mixamo
  (mixamo.com), Mixamo licence; baked as sampled joint rotations
  (`src/chars/*_anim.js`, `media/geo/chars/anim_*.bin`). Ch20 is the preview
  character those downloads carry, imported like the others.

## Trees, shrubs and rocks (`assets/treesRaw/`, W0a — candidates, nothing baked yet)

The tree ladder's near asset (`futureDesigns/WORLD-V2.md` §8.3 R1). These are
CANDIDATES under evaluation on `tools/_trees.html`; none has been baked into
`media/` and none ships yet. This section is written now rather than at the
bake, so a chosen asset arrives already attributed.

`assets/*` is gitignored — these are LOCAL INPUTS, re-fetched from the listings
below, exactly as the reference aeroplanes are. What ships is the baked payload.

Every Sketchfab entry's author, licence and source URL below is **read from the
GLB's own `asset.extras` block** by `tools/tree_inspect.js`, not transcribed by
hand — the same provenance route the Cessna 172SP uses above. The subject counts
are that tool's grouping of each pack's node graph (trees / shrubs / cards that
are already billboards / rocks), not the file's mesh count.

### Sketchfab — all CC-BY 4.0 (attribution required)

- **Fir tree** — `fir_tree.glb`
  - author: evolveduk (https://sketchfab.com/evolveduk)
  - licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  - source: https://sketchfab.com/3d-models/fir-tree-3f39aa5485e94477a36b435f7a1a8b54
  - 1 tree · 4,455 tris · tallest 4.4 m

- **Low Poly Forest Tree Pack** — `low_poly_forest_tree_pack.glb`
  - author: 99.Miles (https://sketchfab.com/99.Miles)
  - licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  - source: https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b
  - 4 trees, 13 billboard cards, 9 rocks · 3,747 tris · tallest 25.4 m

- **Pine Tree** — `pine_tree.glb`
  - author: evolveduk (https://sketchfab.com/evolveduk)
  - licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  - source: https://sketchfab.com/3d-models/pine-tree-d45218a3fab349e5b1de040f29e7b6f9
  - 1 tree · 5,627 tris · tallest 5.3 m

- **Pine tree low-poly** — `pine_tree_low-poly.glb`
  - author: Ricardo Sanchez (https://sketchfab.com/380660711785)
  - licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  - source: https://sketchfab.com/3d-models/pine-tree-low-poly-e72f2c31aac544e58b667c13ec718daf
  - 1 tree · 282 tris · tallest 739.6 m

- **Pine trees pack (lowpoly, game ready, LODs)** — `pine_trees_pack_lowpoly_game_ready_lods.glb`
  - author: LOLIPOP (https://sketchfab.com/lolipop_1707)
  - licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  - source: https://sketchfab.com/3d-models/pine-trees-pack-lowpoly-game-ready-lods-e1e9c07b8e2e445c943fec660beefba2
  - 12 trees, 3 shrubs · 127,813 tris · tallest 31.8 m · **12 shipped LOD chains**

- **Realistic Fir Trees Pack (LODS, gameready)** — `realistic_fir_trees_pack_lods_gameready.glb`
  - author: LOLIPOP (https://sketchfab.com/lolipop_1707)
  - licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  - source: https://sketchfab.com/3d-models/realistic-fir-trees-pack-lods-gameready-f58e8b6d733e4b0586e5b7db847b89e7
  - 2 trees, 1 shrub · 36,973 tris · tallest 9.3 m · **2 shipped LOD chains**

- **Vegetation Set Pine** — `vegetation_set_pine.glb`
  - author: falk lochmann (https://sketchfab.com/falk)
  - licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
  - source: https://sketchfab.com/3d-models/vegetation-set-pine-8b5c6203c4f64281a789e55546db64fc
  - 4 trees · 9,107 tris · tallest 29.4 m

### Poly Haven — CC0

Four scanned/offline-render trees, 1.5–17.2 M triangles each in a `.bin` of up
to 900 MB. They are NOT near-asset candidates; their place in §8.3's ladder is
as the bake source for the impostor atlas (R2) and the canopy shell (R3), and
as the reference for what the near asset should look like.

**The licence is not in these files.** Their `.gltf` carries only a Blender
exporter's `asset` block with no `extras`, so CC0 is claimed from Poly Haven's
site-wide licence and not from the file — confirm at the listing before any of
these is baked. Poly Haven asks for no attribution; the row is kept for
provenance.

- `assets/treesRaw/fir_sapling_medium_1k.gltf.zip` — 3 trees, tallest 8.8 m, 1,533,513 tris, 74.44 MB (70.72 MB geometry). Poly Haven, CC0 (unconfirmed in-file).

- `assets/treesRaw/fir_tree_01_1k.gltf.zip` — 3 trees, tallest 18.9 m, 6,982,937 tris, 464.78 MB (456.3 MB geometry). Poly Haven, CC0 (unconfirmed in-file).

- `assets/treesRaw/pine_sapling_medium_1k.gltf.zip` — 3 trees, tallest 11.5 m, 6,038,139 tris, 255.42 MB (251.28 MB geometry). Poly Haven, CC0 (unconfirmed in-file).

- `assets/treesRaw/pine_tree_01_1k.gltf.zip` — 3 trees, tallest 20.4 m, 17,182,252 tris, 913.74 MB (904.89 MB geometry). Poly Haven, CC0 (unconfirmed in-file).

**Modifications intended**, as CC-BY asks to be indicated: none to the geometry
— the project's rule is IMPORT AS-IS, and where a pack ships an LOD chain that
chain is used rather than replaced. The changes planned are material-side and
transform-side only: foliage in `BLEND` converted to alpha test (`MASK`), a
unit-scale correction for any export measured far from a real conifer's height
(`pine_tree_low-poly` measures 739.6 m, about 34x), and textures transcoded by
the bake, as every other `*_prep` tool in `tools/` already does.
