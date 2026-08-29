# Credits

## Piper PA-18 3D model (`assets/pa18/`, baked into the artifact)

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

- The baked payload and the built artifact carry a machine-readable
  provenance header (written by `tools/model_prep.py`).

## Cessna 172SP 3D model (`assetsSketchfab/`, `assets/c172/`, baked into the artifact)

- **Model**: "FREE Cessna 172SP" by **NLM** (https://sketchfab.com/NLM-Group).
  Source listing:
  https://sketchfab.com/3d-models/free-cessna-172sp-c9cadc2f026946da8cf9715a683739e9
- **License**: **CC-BY 4.0** (http://creativecommons.org/licenses/by/4.0/),
  as declared in the GLB's own `asset.extras` block.
- CC-BY requires visible attribution: it is carried in the sim's footer and in
  the provenance header of the baked payload `src/models/c172_model.js`
  (written by `tools/model_prep.py`).
- The GLB as delivered ships at `assetsSketchfab/free_cessna_172sp.glb` in this
  public repository. The model-frame OBJ + MTL + textures at `assets/c172/`
  are *generated* from it by `python tools/glb_extract.py c172` and are
  gitignored — regenerate rather than edit. (Contrast the PA-18, whose OBJ is
  the delivered source and is committed.)
- Modifications made, as CC-BY asks to be indicated: axis/scale conversion to
  the sim's model frame, removal of the "remove before flight" ribbons and
  ground tie-downs, splitting the fused flap and aileron meshes into left and
  right, and mirroring the (single, right-hand) wing strut to give the left
  one. The mesh and the textures are otherwise unaltered — no decimation and
  no re-encoding.

## Hangar skies and surfaces (`assets/hangar_sky/`, `assets/hangar_walls/`, `assets/concrete_floor_damaged_01/`, baked into the artifact)

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

## Hangar props (`assets/props/`, baked into the artifact)

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

Modifications made, as CC-BY asks to be indicated (and applied to the CC0
assets identically):

- **Geometry: none.** Every triangle, normal and uv the author shipped is in
  the payload. No decimation, no welding, no removal of unseen faces. The only
  transforms are rigid ones declared per row in `tools/props_table.py`: a
  uniform scale where an export arrived in millimetres (`wood_crate`), a
  quarter turn to stand a wheel on the game's axis (`old_tyre`), and a
  translation putting each origin where the prop meets the world.
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

Note: this repository has no top-level LICENSE file; the statements above
apply to the PA-18, the C172, the hangar props and their derivatives only.
