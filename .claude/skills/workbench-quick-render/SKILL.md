---
name: workbench-quick-render
description: Render a flyDiy plane build quickly without booting the world - side/top/front/3-4 views with the pilot, the dash, the controls and the livery, the part-colour view for geometry, a build projected on its blueprint (the drafting table's sheet, the red veil, the score table), garage-look plane pictures, thumbnails and fiche pictures. Use for checking geometry, before/after of a shape edit, a fit against a drawing, or pictures of a plane. Tools - quickshot.js (node) and plane_shot.js (garage look).
---

# Quick renders of a plane

1. **Pictures of a build, everything the player sees: `quickshot.js`.** Node, ~12 s, no browser, no slot.
   `node flyDiy/tools/quickshot.js <build.json | --key k> <out/prefix> --views side,top,front,q [--half] [--over] [--crop] [--gear] [--marks]`
   - It draws the editor's own layers (`_scene_headless.js`), so what you see is what the garage builds: the pilot and
     occupants in their seats, the dash, instruments and controls, the livery (section colours and decals).
   - `--half` cuts the starboard half of the body away: the cabin, the pilot, the controls.
   - `--parts`: the part-colour view (the old quickshot, ~3 s): geometry, before/after of a shape edit, fitting.
   - Doc: `flyDiy/tools/QUICKSHOT.md` (with what node cannot draw, and why).
2. **A build on its blueprint: `quickshot.js --sheet <img.png>`.** The plane file's reference block (or `--ref`), the
   drawing scaled by the drafting table's own `dt_core.toPx`, our render over it, the red veil outside the drawing's
   lines, the score table and the dimensions diff, stacked in `<prefix>_sheet.png`. `--level 0` measures as the table
   does (the garage draws level 2). `table.js check --png` calls the same code. Fitting procedure: `flyDiy/tools/DRAFTING_TABLE.md`.
3. **The plane as the player sees it in the garage's lighting, thumbnails, fiche pictures: `plane_shot.js`.**
   SwiftShader, phone garage profile; `--gpu` only in a GPU slot.
   `node flyDiy/tools/plane_shot.js --build a.json --out <dir> [--views q,s,t,f,hero,profile]`
   thumb_bake.js and fiche_bake.js call it; don't re-implement them.
4. **Load builds with `flyDiy/tools/_load_build.js`**, the one load path. Raw build files fly a different plane from
   the one the load door gives (quickshot `--door` draws the door's).
5. The flown lattice over the pictures: `lattice_overlay.js` (it runs quickshot `--parts`).

Don't use box_render, outline.js, pod_shots, tank_shot, _geoparity_shot, garage_shot or bench_shot (WORKBENCH.md:
deleted or retired; tank_shot only for a tank cutaway).

## Traps (add yours)
- A render of a stale build: run `node flyDiy/tools/build.js` after any src edit.
- Candidate cards load from `builds/candidates/`. Give the path, not a guess.
- The garage's level 2 is not the table's level 0: a fit scored on the draft reads differently on the drawn sheet
  (the PC-6: 136 against 122 of 175). Say which level a score is.
- A sheet renderer maps pixels through `dt_core.toPx` / `fromPx` only, never `V.k` alone (two scales, free tilt).
