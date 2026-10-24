# dmg-looks: node prototypes for DMG-LOOKS-STUDY-2026-10.md

These files are node only, with no dependency. Nothing in `src/` loads them. Run them from this folder.

| File | What it does | Output |
|---|---|---|
| `tear_proto.js` | The material tear path per finish (alloy rivet-line unzip, fabric along the weave, composite crack, ply splinters) on a 3.5 cm-triangle panel. Triangles are only removed, the rim is jittered, there is a curl field, and an edge-distance field gives a rim band. `--erode` adds sub-triangle erosion. `--perf` runs the event on 85 k places. | `tear_panels.png`, `tear_panels_erode.png` |
| `bend_proto.js` | A crushed member drawn kinked at its rest length instead of telescoped. | `bend_members.svg` and a length table |
| `crack_proto.js` | Acrylic window states (S1 crazing, S2 star, S3 failed), written as one GLSL-portable function. Also bakes an optional 512² RGB atlas. | `crack_states.png`, `crack_atlas.png` |
| `png.js`, `noise.js` | Helpers: a minimal PNG writer, and seeded hash noise that maps 1:1 onto GLSL. | |

All images are generated here and are our own work, so there is nothing to credit.
