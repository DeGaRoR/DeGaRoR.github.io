---
name: workbench-quick-render
description: Render a flyDiy plane build quickly without booting the world - side/top/front/3-4 views with the pilot, the dash, the controls and the livery, the part-colour view for geometry, a build projected on its blueprint (the drafting table's sheet, the red veil, the score table), garage-look plane pictures, thumbnails and fiche pictures. Use for checking geometry, before/after of a shape edit, a fit against a drawing, or pictures of a plane. Tools - quickshot.js (node) and plane_shot.js (garage look).
---

# Quick renders of a plane

1. **Pictures of a build, everything the player sees: `quickshot.js`.** Node, ~12 s, no browser, no slot.
   `node flyDiy/tools/quickshot.js <build.json | --key k> <out/prefix> --views side,top,front,q [--half] [--over] [--crop] [--gear] [--marks]`
   - It draws the editor's own layers (`_scene_headless.js`), so what you see is what the garage builds: the pilot and
     occupants in their seats, the dash, instruments and controls, the livery (section colours and decals).
   - **Cut views (fitting the cabin to the drawing):** `--cut side|top|front[@metres]` clips the whole aeroplane (the
     sheet, the wing, the struts, the gear, the glass) on a section plane and draws the pilot, the seated occupants,
     the seats, the controls (stick or yoke, pedals, throttle, levers) and the dash with its instruments WHOLE, with a
     dark section line on the cut faces. side = the centreline (x = 0, the camera's side removed; the other front
     seat's occupant and yoke left out whole, the pilot's never); top = above the pilot's shoulder (0.17 m under the
     eye); front = ahead of the pilot's eye station. The picture is the cut's own view unless `--views` says otherwise.
     `--cutq` = the side cut, three-quarter from above-behind, framed on the cabin: the view you want most.
     `--focus cabin` frames any view on the pilot, the pilot's seat and the panel. `--half` = `--cut side`.
     `node flyDiy/tools/quickshot.js builds/cub_2026-09-20_corrected.json out/cub --cutq`
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
- The craft's +x is the PILOT's side on a side-by-side (the 172's left seat is +x): `--cut side` removes +x, so the
  pilot stands whole in front of the section; the occupant you see behind is the right-seat one.
- A cut's top / front defaults need a seated pilot (the crew layer's eye); with none, give `--cut top@0.3`.
- A sheet renderer maps pixels through `dt_core.toPx` / `fromPx` only, never `V.k` alone (two scales, free tilt).
