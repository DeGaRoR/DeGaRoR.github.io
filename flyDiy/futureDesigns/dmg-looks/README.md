# dmg-looks: node prototypes for DMG-LOOKS-STUDY-2026-10.md

These files are node only, with no dependency. Nothing in `src/` loads them. Run them from this folder.

| File | What it does | Output |
|---|---|---|
| `tear_proto.js` | The material tear path per finish (alloy rivet-line unzip, fabric along the weave, composite crack, ply splinters) on a 3.5 cm-triangle panel. Triangles are only removed, the rim is jittered, there is a curl field, and an edge-distance field gives a rim band. `--erode` adds sub-triangle erosion. `--perf` runs the event on 85 k places. | `tear_panels.png`, `tear_panels_erode.png` |
| `bend_proto.js` | A crushed member drawn kinked at its rest length instead of telescoped. | `bend_members.svg` and a length table |
| `crack_proto.js` | Acrylic window states (S1 crazing, S2 star, S3 failed), written as one GLSL-portable function. Also bakes an optional 512² RGB atlas. | `crack_states.png`, `crack_atlas.png` |
| `structure_census.js` | Brief 2: the treecrash rig's four standard crashes on the Cub, the Jodel and the metal Cessna (certificate on); each member's end state and how it broke. Takes about 2 minutes. | `structure_census.json` |
| `structure_mesh.js` | Brief 2: how the flown snapshot meshes the frame members (rings per metre), and the cost of baking rings in. | `structure_mesh.txt` |
| `structure_proto.js` (+ `raster3d.js`) | Brief 2: the member pool's pose functions per material (steel hinge and torn stubs, alloy crimps and rivet-line tear, wood slivers, greenstick and crush), drawn rest / today / proposed at the slot budget. Uses Chromium for the labels. | `steel_cage.png`, `alloy_frames.png`, `wood_members.png`, `structure_cost_proto.txt` |
| `alloy_proto.js` | Stretch (26 Oct): the alloy pool slot. Progressive crimps sized from H ≈ (b²t)^(1/3), a kink past 3 folds, and the tear through the rivet line (net section, link-up, elongated holes), with the vertex and fragment passes. | `alloy_slot.png`, `alloy_slot.txt` |
| `rim_overlay_proto.js` | Stretch: the P2 rim overlay (option B), shown as base / overlay alone / both for 2024 skin, fabric, composite and ply. | `rim_overlay.png`, `rim_overlay.txt` |
| `rim_census.js` | Stretch: the overlay's real size on the headless snapshot ridden by skin_break (DMGWALL's rig), one build per process. | `rim_census.txt` |
| `STRETCH-ALLOY-RIM-2026-10-26.md` | The stretch write-up: the alloy slot, the overlay, the triangle and draw counts, and the one-draw variant B3. | |
| `png.js`, `noise.js` | Helpers: a minimal PNG writer, and seeded hash noise that maps 1:1 onto GLSL. | |

All images are generated here and are our own work, so there is nothing to credit.
