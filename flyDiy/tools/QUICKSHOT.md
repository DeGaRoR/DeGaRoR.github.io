# QUICKSHOT — a picture of any build in seconds, no browser

The cage 8 bench in a headless browser takes minutes per picture in a cloud box (software WebGL). `tools/quickshot.js`
builds the same aeroplane with the editor's own layers in node (`_scene_headless.js`, the garage's PAGE.post chain)
and rasterises it itself: no GPU, no browser, nothing to install beyond node.

**One picture, everything the player sees (QUICKSHOT-ONE, 15 Nov).** The user: "Quickshot was missing rendering of
pilot, dash positions and controls, and texture preview ... Unify it, not 3 modes." By default quickshot draws:
- **the pilot and the seated occupants**, posed in their seats by the crew and character layers (`_cage_crew.js`,
  `_cage_char.js`; the characters' meshes read off the disk);
- **the dash**: its place, the instruments (the panel layer's dial faces, painted on a software canvas and textured),
  the controls (stick or yoke, throttle, pedals, flap lever, trim) where the crew layer puts them;
- the cabin linings, seen through **translucent glass**;
- **the livery as the garage paints it**: each section's colour by the garage's own rule (AEROSKIN `aeroSecResolve`
  over the build's `finish`, a finish's base under no tint), and **the decals**: the kit patterns, the stickers, the
  text pieces and the registration, painted by `aeroskin.js`'s own painters (`aeroDecalsFor`) on a software canvas
  (`_canvas_soft.js`) and laid on the surfaces by a port of its shader's decal loop (field / side / plan boxes, sides,
  mirrors, the surface classes).

About 10–15 s a build (three builds: the panel's column seeds, the characters land). `--parts` is the old part-colour
view (~3 s, byte for byte the old quickshot): the sheet orange, the layers' own colours, no cabin, no livery. Fitting
and the geometry tools (`lattice_overlay.js`, `retract_battery.js`, `table.js --png`) use it.

```
node tools/quickshot.js builds/cessna172r_2026-11-08.json /tmp/c172 --views side,top,front,q
node tools/quickshot.js builds/cessna172r_2026-11-08.json /tmp/cab --views side --half --crop 0.5,3.8,-0.9,1.0   # the cabin, cut away
node tools/quickshot.js --key camel /tmp/camel --views q                 # an archetype card, born as the shed births it
node tools/quickshot.js my_build.json /tmp/try --over '{"halfW": 0.6}' --parts   # try a slider, geometry only
node tools/quickshot.js --key ttail /tmp/tt --views front,side --over '{"gearRetract":1}' --gear 0.5 --parts   # the gear half up
node tools/quickshot.js builds/candidates/pc6_drafting_2026-11-11.json /tmp/pc6 --sheet pc6_3view.png   # on the drawing
```

Writes `<out-prefix>_<view>.png`. Views:
- `side`: from starboard, the nose to the left.
- `top`: from above.
- `front`: head on.
- `q`: three-quarter from ahead, starboard and above.
- `bottom`: from below, the nose to the left (RETRACT G4: the wells).
- `qb`: three-quarter from ahead, starboard and below.
- `qr`: three-quarter from behind, starboard and above.
- `qp`: three-quarter from ahead, port and above.
- `qrb`: three-quarter from behind, starboard and below.
- `none`: no picture (with `--sheet` or `--measure`).

## The projection on the drawing: `--sheet [img.png]`

Quickshot hosts the drafting table's projection (A0, 15 Nov: one renderer, one projection). It reads the plane's
reference block (`ref.views` / `ref.marks` in the plane file, or `--ref ref.json`) and writes `<out>_sheet.png`:
side, top and front stacked, each view the drawing scaled exactly as the table does it (`dt_core` `toPx`: the
quarter turns, the free tilt `rot`/`rotAt`, the two scales `k`/`ky`), with:
- the drawing faded, **our render over it** (the same shaded picture, mapped through `toPx`), the ink kept on top;
- **the red veil**: our parts where they fall OUTSIDE the drawing's lines (the paper reached from the view box's edge
  without crossing ink; the idea of photo_match's `ovls_threeview.py`), its area in m2 on the view's label;
- our outline in the parts' colours (`dt_core.edges`), the drawing's marks as crosses;
- **the key-measurement score table** (`dt_core.compare`, the table's own rows) and **the dimensions diff**
  (length / span / height against the reference's figures, `outline.js`'s job).
The table's numbers are the table's rules on the geometry quickshot draws (`dt_build.collect` on its own scene).
The code is `tools/drafting/dt_sheet.js`; `table.js check --png` calls `quickshot.js --sheet --parts` at the table's
level, so the table, quickshot and the in-game page (`drafting.html`, the same `dt_core`) agree. With no image the
views are drawn on white paper, without a veil.

**Levels.** The garage draws the sheet at subdivision level 2; the drafting table fits and measures its level-0 draft.
Quickshot draws level 2 by default (what the player sees); `--level 0` gives the table's. On the PC-6: 136 / 175 at
level 0 (the table's exact score), 122 / 175 at level 2. GATE QSPARITY holds the level-0 agreement and prints the
level-2 moves.

## Options

| option | what it does |
|---|---|
| `--parts` | the part-colour view (no cabin, no livery; the old quickshot, ~3 s) |
| `--crew` | with `--parts`: the crew layer too (the seat, the stick, the pedals); the whole view draws the crew always. A build with `skinOn 0` is an OPEN FRAME in both views: the glass, the joints and the bare structure, plus the nose deck when `noseDeck` is on (the editor's ZERO SKIN) |
| `--sheet [img]` | the projection on the drawing, `<out>_sheet.png` (above) |
| `--ref ref.json` | the reference block from its own file (a `--key` card has none) |
| `--measure out.json` | the table's key measurements of what was drawn, as JSON (GATE QSPARITY) |
| `--level n` | the sheet's subdivision (default the garage's 2; the table measures 0) |
| `--door` | the build through the game's load door (`_load_build.js`: the join's clamps), not the file as written |
| `--over JSON` | panel rows laid over the build before it is drawn |
| `--crop z0,z1,y0,y1` | the side view's window, metres |
| `--around x,y,z,r` | any view framed on a point (layer metres), r either way of it |
| `--half` | the cutaway: the body's starboard half left out (the cabin shows) |
| `--w px` | picture width |
| `--marks fittings` / `corners` / `reg` | rings on the placed fittings / quad window corners / the registration's footprint white |
| `--gear 0..1` | a retractable gear's position (1 down, 0 up): the gear layer's own rule, as in flight (`--over '{"gearRetract":1}'` on a low-wing tricycle) |
| `--nowells` / `--noedges` | the retractable gear's wells drawn whole / the reserved wells' boxes not drawn |
| `--focus gear`, `--frames JSON` | frame on the gear / give each view's frame (every frame used is printed) |
| `--wire` | the lofts' grids over the picture |
| `--flat` | flat facets instead of smooth shading |
| `--fit` | the gear layer's fit verdict |

## What it is and is not
- Shapes, layers, fittings, the cabin and the occupants are exact: the same meshes the garage draws, skinned
  characters posed by their bones (`applyBoneTransform`).
- Colours are the garage's albedo: the material factory's colour half (`_scene_headless.js` wholeContext replaces
  `aeroMaterial` / `aeroHardMat` / `aeroGlass` with their colour and opacity) and the editor's section door
  (`CAGE_SECMAT`, `_cage_ui.js` secMat's resolution).

**What cannot be drawn in node, and why:**
- **The detail sheets** (each finish's normal, roughness and metal maps; the weathering; the metal flake; the clear
  coat; reflections): they are GPU shading (`aeroskin.js`'s onBeforeCompile program over the hangar's environment
  map). Quickshot shades with one light, smoothly, and draws the albedo; the procedural sheets are not even baked
  (8 s a build of canvases a flat raster never samples).
- **The registration's and the text pieces' typeface**: node has no font rasteriser (no canvas, no FreeType). The
  letters are drawn in a 5 x 7 block face (`_canvas_soft.js`) at the game's place, size, colour and slant, through
  the game's own distance-field step; the face itself is a stand-in. Characters outside A-Z 0-9 - . / draw as a dash.
- **The occupants' skin and clothes textures**: JPEG / WebP maps (and KTX2 for the budget set); node has no image
  decoder for them. The characters are drawn in their materials' colour.
- **Perspective from the pilot's eye**: quickshot's views are orthographic (the retired `box_render.js` had a
  cockpit camera; `plane_shot.js` / `page_rig.js` take the player's own view).
- **The tanks** (the energy layer, inside): left out of quickshot's picture; `tank_shot.js` keeps the tank cutaway.

Matching a build to a reference model is a separate guide: `tools/REF_MATCH.md`. Fitting to a blueprint: the drafting
table, `tools/DRAFTING_TABLE.md`.
