---
name: workbench-quick-render
description: Render a flyDiy plane build quickly without booting the world - side/top/front/3-4 views, overlays on blueprints, garage-look plane pictures, thumbnails and fiche pictures. Use for checking geometry, before/after of a shape edit, or pictures of a plane. Tools - quickshot.js (node, ~3 s) and plane_shot.js (garage look).
---

# Quick renders of a plane

1. **Geometry, overlays, before/after of an edit: `quickshot.js`.** Node, about 3 s, no browser, no slot.
   `node flyDiy/tools/quickshot.js <build.json | --key k> <out/prefix> --views side,top,front,q [--over] [--crop] [--gear] [--marks]`
   - It draws the editor's own layers (`_scene_headless.js`), so what you see is what the garage builds.
   - Doc: `flyDiy/tools/QUICKSHOT.md`.
   - To draw the flown lattice over the same pictures, use `lattice_overlay.js`.
2. **The plane as the player sees it in the garage, thumbnails, fiche pictures: `plane_shot.js`.** SwiftShader, phone garage profile; `--gpu` only in a GPU slot.
   `node flyDiy/tools/plane_shot.js --build a.json --out <dir> [--views q,s,t,f,hero,profile]`
   thumb_bake.js and fiche_bake.js call it; don't re-implement them.
3. **Load builds with `flyDiy/tools/_load_build.js`**, the one load path. Raw build files fly a different plane from the one the load door gives.

Don't use box_render, tank_shot, _geoparity_shot, pod_shots, garage_shot or bench_shot. They are folded into the two tools above (WORKBENCH.md).

## Traps (add yours)
- A render of a stale build: run `node flyDiy/tools/build.js` after any src edit.
- Candidate cards load from `builds/candidates/`. Give the path, not a guess.
