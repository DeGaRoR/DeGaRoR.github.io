# DRAFTING TABLE — spec (design, 11 Nov 2026)

The design of the light tool for MATCHED planes, from the FIT-PROCEDURE session with the user (11 Nov 2026). Design
only: nothing here is built yet. A snapshot of the user's editable spec doc; that doc is the master until the build
starts. It sits beside `tools/REF_MATCH.md` (the old 3D-model method) and `tools/FIT_AND_VALIDATE.md` (REAL-FIGURES'
method, on its own branch until it lands).

## What it is

The Drafting Table is a light page that takes a real aeroplane from its references to a matched shape and a balanced
plane file, then hands that file to the garage. It is a tech app, not a game: it opens in under a second on a phone,
and nothing heavy loads unless a step needs it.

The lines it holds:

- **A matching tool, not a light garage.** It covers references, architecture, sections, wings, drivetrain, a 3D
  check, light checks and save. The finish (lamps, seats, interior, controls, livery, cowl openings) is done in the
  real garage.
- **One file, one generator.** It writes the same plane file the garage loads, through the garage's own body
  generator, wing loft, join and engine model. It never has its own geometry or physics.
- **Visual at every step.** The three views with our live outline over the blueprint are always on screen; the quick
  3D is a tap away.
- **Same tool for the user and Claude.** Its logic is a plain module that runs in the browser and in node, so a cloud
  session drives the same steps headless.
- **Anything heavy for a cloud session is not fit for this tool.** Flight tests, the structural certificate and
  REAL-FIGURES' full runs stay outside it.

## What we learned from the old tools

The old tool's method is right; it broke on the start, the architecture and on being cloud-only. The Drafting Table
keeps the method and fixes those three.

| Keep (REF_MATCH, FIT_AND_VALIDATE) | Broke, and the fix here |
| --- | --- |
| The user's order: side proportions, then the plan, then the parts. Each step finished before the next. | The Spitfire started from a card too far from the type; the fit turned into building features (elliptic wing, radiators, Merlin) and stopped at step 1. **Fix:** the architecture step before any fitting, with the 2 closest presets drawn over the blueprint. Missing controls are logged as gaps, the closest option is taken, and the gaps are built after the plane. |
| Sources prevail over the model: each axis scaled on a published figure, the datum checked on two markers. | The Spitfire GLB was one mesh, its parts cut out by hand with boxes. Most types have no good model. **Fix:** blueprints first; a GLB or photos are optional overlays. |
| Every change is a garage row. | The body type is make-or-break and no tool helped (two drawn for the Spitfire; the Archaeopteryx's cabin "dramatic" despite a good score). **Fix:** the architecture is chosen by the user, by eye, over the blueprint. |
| Measured station by station, fitters kept to the rows of the step in hand. | IoU searches over rows that move each other drifted (0.173 to 0.164 on the Spitfire) on drawing lines ~4 cm thick. **Fix:** the key-measurements table and outline features (windows, seams) to match points, not silhouettes. |
| QuickShot: a true picture in 3 s. | Everything ran in the cloud; the user saw PNGs and corrected by text, a day per plane. **Fix:** the same steps on the phone, live. |
| References carry their conditions; unknown weights become ranges; CG computed with the pilot in (FIT_AND_VALIDATE). | Shape and numbers lived in separate tools; the Spitfire was never balanced or flown. **Fix:** mass, CG and the light checks beside the shape at every step. |
| The in-game blueprint desk (`src/viewer/blueprint.js`): scale, views, orient, ground, place. | It lives in the 17 MB game and by rule never writes the plane. **Fix:** the same five steps in the light page, writing the cage rows. |

## The steps

Eight steps in the tool, then the garage and REAL-FIGURES. Each step is finished before the next starts, and a later
step never moves an earlier step's rows without re-measuring them. The step order is the user's, with the architecture
placed after the references and before the sections, because which sections exist depends on it.

1. **New reference plane.** The plane file is born at once and holds a reference block from the first tap.
   - The name, then the exact variant and its engine, locked before any figure is entered ("LS is not XP").
   - Optional start: an earlier matched plane.
2. **References.** Published figures in three groups, each with its conditions and source:
   - geometry: span, length, height, wing area, chords, track;
   - specs: empty and gross mass, fuel, engine power and mass, seats;
   - performance: stall, cruise, top speed, climb, take-off and landing runs.
   - Images: a blueprint sheet or three separate views; a GLB and photos are optional overlays.
   - Done when the variant is locked and at least span and length are entered.
3. **Sanitise and scale.** One standard set of views from whatever came in.
   - Cut a sheet into views (box or lasso), or take the three images; rotate, mirror, level.
   - Scale each view on its own figure: side by length, top and front by span. A second figure checks each one.
   - The datum: the nose and the fuselage reference line set level. We design in flying stance; the side view's
     ground line is kept for the parked check.
   - Each view shows its span or length dimensioned, as a visual reference.
   - Done when every view's check figure is within 1 %.
4. **Architecture.** Only the choices that change the cage or the mass:
   - the fuselage architecture: open cockpit, car (windshield and fastback), full bubble, hanging nacelle, pod and
     rod, twin boom;
   - the engine: a catalogue pick, or the auto-fit from type, power and mass (it says what it could not reach); its
     mount and count;
   - the wings: how many, where, braced or not;
   - the gear layout; the seats (tandem, side by side, 1+2); the structure materials; land, floats or hull.
   - The 2 closest presets are drawn over the blueprint before the user picks.
   - Left for later: doors, window sills, struts, float details.
5. **Sections and pillars.** The fuselage first.
   - Drag each station on the side and top views: nose, cabin, pax, taper, boom, tail post.
   - Per pillar: top, bottom, half-width, roundness top and bottom, the waistline height and its softness.
   - The drawn windows are placed here. Their outlines, with the seams, are the best match points on a blueprint.
   - Only the short list of rows shows; the hacky ones stay in the garage.
6. **Wings and tail.**
   - Span, root and tip chords, the LE station and height, the crank's station and chord (its own view shows the
     crank line), sweep, dihedral, incidence, twist, tip type.
   - Fin and stabs from the presets plus a global scale and a station.
7. **Drivetrain, cowl and gear.**
   - The engine placed by its outline; the prop's plane and diameter; the thrust line.
   - The cowl from its preset: the front face's station and size, the taper over the length.
   - The wheels at their exact place: mains, nose or tail wheel, track.
8. **Check and save.** The quick 3D (true geometry, flat shading), the key-measurements table, the light checks. Save
   the plane file.

Then, outside the tool:

- **The garage** opens the same file: the finish (lamps, seats, interior, controls, livery, cowl openings, aero nose),
  and flight.
- **REAL-FIGURES** scores it against the reference block, run by a cloud session (section "Handover").

## The screens, phone first

It is the garage's own interface with its 3D scene swapped for the 2D views: the garage's controls, sliders and
panels, organised as steps. On the phone the drawing sits on top, the step's panel below, the numbers in a strip
between them; the desktop uses the same parts in the garage's desktop layout.

- **The drawing (top, about 60 % of the height).** One large view and two thumbnails: side, top, front. Tap a
  thumbnail to swap it in. Pinch to zoom, one finger to drag a mark, two fingers to pan.
- **The live outline over the blueprint.** Not one silhouette but its parts, each in its own colour and each
  switchable:
  - the fuselage outline;
  - the wing outlines, with the crank line;
  - the tail outlines;
  - the engine, prop disc and cowl;
  - the windows;
  - the important seams: the pillars, the waistline, the cowl's back edge.
  - Blueprint opacity is one slider; the paper can be made transparent.
- **The marks.** The step's handles sit on the drawing: a pillar's top, bottom and width, a wing's LE and TE, a
  wheel. Dragging one moves its garage row; the outline follows within a frame.
- **The numbers strip.** The step's key measurements: ours, the reference's, and the difference, green inside
  tolerance. Plus mass and CG, always visible.
- **The step panel (bottom).** The step's short list of rows as sliders and pickers, with garage labels and ranges. A
  step bar shows where you are; Next is enabled when the step is done.
- **The quick 3D (one tap).** Replaces the drawing until tapped away. True geometry, flat shading, no textures or
  detail shaders; drag to turn.
- **Pictures for Claude sessions.** The same screen renders headless to a PNG, so a session sends the user what they
  would see.

```
+------------------------------+
| 1 2 3 4 [5 Sections] 6 7 8   |   step bar
+------------------------------+
|  ours / blueprint / windows  |
|    ___====___                |   the drawing: one large view, the blueprint under
|   /  [] []   \_______/|      |   our outline in parts (body, windows, wings, seams);
|   \__o_______o_______|       |   drag a handle (o): its garage row moves
|      O          [top][front] |   thumbnails: tap to swap
+------------------------------+
| pillar 2 top ours 1.42 ref 1.44 -2 cm |   numbers: ours, reference, difference;
| mass 1 220 kg  CG 24 % MAC   |   mass and CG always shown
+------------------------------+
| pillar 2 top   ----o-----    |   the step panel: the step's short list
| half-width     ------o---    |   of garage rows
| waist softness --o-------    |
+------------------------------+
| [3D]                  [Next] |   3D on one tap
+------------------------------+
```

## The reference block

The reference lives in the plane file as a `ref` block, beside `spec`. The game's join never reads it. The garage
shows it in its reference plane section, display only, under the same rule the reference plane and blueprint desk keep
today: it never writes the plane.

| Part | Holds | Notes |
| --- | --- | --- |
| identity | name, maker, exact variant, engine variant, year | locked before figures; a sister type's figure is a note, never a row |
| figures | geometry, specs, performance rows | REAL-FIGURES' row format (`tools/real_refs.js`): value or range, tolerance, weight, flaps, surface, which distance or speed, source URL, date read, confidence |
| views | each view's cut, rotation, mirror, scale, extent, datum, ground line | the blueprint desk's state format, so the garage desk reads it too |
| images | content hashes and file names only | the images stay on the device (IndexedDB), never in git; a session gets them from the user, never from the file |
| silhouettes | optional, per view, 1 cm | the extracted measurement, not the drawing, as the Archaeopteryx committed |
| marks | the reference's own key measurements (next section) | measured once on the blueprint, kept for every later check |
| architecture | the choices of step 4 and the preset started from | so a later session knows why |
| gaps | controls the shape needed and the garage lacked | the closest option taken, each logged for REF_MATCH section 7 |
| history | step, date, who (the user or a session), a short line | append only |

With only a three-view and a span, every step still runs: a missing figure is a row left empty, never a guess.

## The key-measurements table

This table is the backbone: what the user checks, what Claude fits to, and what scores the geometry. It is measured
once on the reference and every time on our plane, through the generator. Our value minus the reference's is the
score; there is no silhouette search. The tolerances below are proposals taken from REF_MATCH's done-when column, to be
tuned on the first plane.

| Group | Measurements | Tolerance (proposed) | Step |
| --- | --- | --- | --- |
| whole | span, length, height (flying stance) | 1 % | 3 |
| sections | station of each section's ends: nose, firewall, cabin, pax, taper, boom, tail post | 2 cm; tail post 1 cm | 5 |
| pillars | per pillar: top, bottom, half-width; roundness top and bottom; waist height | 2 cm; roundness 0.05 | 5 |
| openings and windows | each window's corners; each cockpit's fore and aft edge | 3 cm | 5 |
| wings | per wing: span, root and tip chord, LE station and height at root, crank and tip, sweep, dihedral, incidence, twist | 2 cm; angles 0.5 deg | 6 |
| tail | fin height and chord, stab span and chord, their stations | 3 cm | 6 |
| drivetrain | thrust line height, prop plane station and diameter, engine station | 2 cm | 7 |
| cowl | front face station, width and height; back edge station | 2 cm | 7 |
| gear | each wheel's centre station and height, track, wheel diameter | 1 cm | 7 |
| areas | wing area, tail areas (as computed vs published) | 2 % | 6 |

On the reference, each value comes from a mark the user or Claude places on the blueprint, or from a published figure
when one exists (sources prevail). On our plane, each value is read off the generator's output, never off the row: a
clamp that silently moved a row shows up here.

## The light checks

Static checks only: numbers and positions, no physics engine and no flight. They use the garage's own mass bookkeeping
(the join's billing and the lattice's CG), not copies, so they agree with the garage by construction. The structural
certificate (`src/core/66_gen_cert.js`, 8-24 s a build), the design check's wind-tunnel probe and every flight stay
outside the tool.

| Check | What it computes | Passes when (proposed) |
| --- | --- | --- |
| mass | empty mass against the published figure | inside the reference's range, or flagged with the difference |
| CG with the pilot | CG at min, typical and MTOW loads (REAL-FIGURES' three loads), in % of the mean chord | all three inside the type's published CG range, or 15-35 % MAC when none is published |
| standing, nose and tail | the angle from the main axle to the CG, against the vertical | taildragger: CG ahead of the axle by 15-25 deg; tricycle: CG ahead of the mains, 5-15 % of the weight on the nose wheel |
| standing, sideways | the overturn angle from the track and the CG height | under 63 deg |
| margin (estimate) | the neutral point from the tail volume and the wing; the static margin | 5-20 % MAC; labelled ESTIMATE |
| water | buoyancy of the floats or hull against the weight; CG over the centre of buoyancy; tip floats clear | 80 % reserve buoyancy (FAR 23.751, from memory: to confirm); CG within the float's middle third |

One figure needs a guard: the margin. The game measures the neutral point in its virtual wind tunnel
(`src/core/64b_gen_design.js`), and a formula can drift from it. A new gate compares the light estimate with the full
design check on every plane in the fleet and goes red past a set gap (proposed: 3 % MAC).

The standing and water checks are new to the game too. The user wants them in the certificates themselves; the tool
then calls the same function.

## Loading budget

The first screen is up in under a second on a phone; everything else loads behind it, in tiers, and is cached after
the first visit. The whole tool is about 1.4 MB gzipped against the game's 17 MB page. Sizes below are today's
modules, gzipped, measured 11 Nov.

| Tier | When | What | Size |
| --- | --- | --- | --- |
| 0 | first paint | the page, the 2D canvas, the reference block, the numbers table | 100 KB target |
| 1 | right after, in the background | the body generator with its window cutter and shoulders (`_cage_gen`, `_knife_gen`, `_shoulder_gen`): the live body outline, windows and seams | 250 KB |
| 2 | right after tier 1 | the wing loft, the join, the core's generator files (60-64), the engine model: wing outlines, mass, CG, light checks | about 550 KB |
| 3 | first tap on the 3D view | the 3D geometry library and the part meshes: cowl, gear, fin, stab, engine | about 500 KB |

- A body rebuild takes about 2 ms (`buildCage2(CAGE_DEFAULT)` in node), so the outline follows a finger. The full
  rebuild with the join is to be measured before the build starts; the target is under 50 ms.
- The page never loads the game's world, flight core, audio, characters or career. The controls are the garage's own
  (`_cage_ui`, 116 KB): reused, not rewritten; if they are too heavy for tier 0, the step panel arrives with tier 1.
- The 2D view and the 3D view draw on a plain canvas: no shaders, no textures.
- To be proven first: that these modules run in a page without the garage around them. QuickShot already runs them
  headless in node, which is a good sign.

## The headless API for Claude sessions

A session drives the same module as the page, one command per step, on the plane file. Every command prints the step's
key-measurements table and can write the screen as a PNG, so the user sees exactly what they would see on the phone.

```bash
node tools/drafting/table.js new <plane.json> --name "Pilatus PC-6/B2-H4" --variant "B2-H4, PT6A-27"
node tools/drafting/table.js ref <plane.json> --add geometry.span=15.87 --src "<url>" --cond "..."
node tools/drafting/table.js views <plane.json> --sheet <image> --cut side:x0,y0,x1,y1 --scale side=length
node tools/drafting/table.js arch <plane.json> --pick fuselage=car,engine=pt6a-27,gear=tail,...
node tools/drafting/table.js step sections <plane.json> --set pilot.top=1.42,... --png <out>
node tools/drafting/table.js check <plane.json> [--json]
```

- **One module, two front ends.** The page and the command call the same functions. The command line is a thin layer
  that only parses arguments.
- **Marks, not search, by default.** A session places marks on the blueprint from what it reads off the image and the
  figures, and the rows follow from the marks. A search over a step's rows (the old `fit_body` way) stays available as
  `--fit`, limited to that step's rows.
- **Images are passed by path.** They come from the user in the session; the file only carries their hashes.
- **Every command appends a line to the reference block's history**, so the user sees on the phone what a session did
  and can undo it.
- **Names above are placeholders** (and the figures in the example are illustrative) for the build session to settle.

## Handover to the garage and to REAL-FIGURES

The tool's output is one plane file: `spec` (the cage rows and what the join made of them) plus the `ref` block.
Nothing else moves between the tools.

- **To the garage.** Open the file as any saved build. The garage flies `spec` and shows `ref` in its reference plane
  section: the blueprint views pinned around the plane, the figures, the key-measurements table. The finish happens
  there. Coming back to the Drafting Table after a garage edit is allowed: the tool re-measures and shows what the
  garage moved.
- **To REAL-FIGURES.** A cloud session runs its command on the file. It exists today on the practical-cerf branch, not
  yet on master:

```bash
node tools/real_check.js --build=plane.json --ref=<row> --quick
```

- `--quick` takes about 20 s: geometry, specs and analytic performance bands. Without it, the full flights take
  10-45 min a plane.
- One addition is wanted: `--ref` should accept the plane file's own `ref` block, so the reference is never typed
  twice.
- The score comes back into the `ref` block's history, so the phone shows it next to the plane.

## What it needs, build order, decisions

The tool is mostly new screens over existing code. What it needs from the game:

| Need | Where it lives | Status |
| --- | --- | --- |
| the outline from the generator, in parts: body, windows (the window cutter's own loops), seams (the pillars, the waist), wings, tail, engine, cowl | a projection function beside the generator | new, small |
| the short row list per step | a table beside the garage's row definitions | new; also gives the garage a "basic mode" |
| the `ref` block carried through save and load, and shown in the reference plane section | plane file, garage | new |
| the engine auto-fit from type, power and mass | a garage function over the engine model (`ENG_GEN.engResolve`, the ENGINE-GAP scaling from a catalogue engine) | new, about a day |
| the standing and water checks | the certificates / design check | new, game-side |
| the margin consistency gate | gates | new |
| `real_check --ref` reading the file's `ref` block | REAL-FIGURES | small, after it lands on master |
| the fuselage architecture revamp (open cockpit, car, bubble, hanging nacelle, pod and rod, twin boom) | garage | separate project; the picker maps onto today's rows until then |

Build order:

1. **Proof (go / no-go).** The tier 1 and 2 modules load in a bare page with the garage's step panel; rebuild time
   measured; the parted outline with windows of an existing build drawn over a blueprint (the C172: high wing, struts
   and windows, the stock plane nearest the PC-6).
2. **References, sanitise and scale**, the `ref` block, the headless `new`, `ref` and `views` commands.
3. **Architecture** from today's archetype cards, then **sections and pillars** with the key-measurements table.
4. **Wings and tail, drivetrain, cowl and gear.**
5. **The light checks and their gate; save; the garage shows `ref`; the main-menu button.**
6. **The quick 3D**, then the engine auto-fit.
7. **First run: the PC-6 Porter, from blueprints only**, with the user; the tolerances tuned on it.

Decided with the user, 11 Nov:

- **Where it lives:** its own page on the same site, opened instantly from a "New reference plane" button in the main
  menu.
- **Players:** no gating; it goes straight into the menu.
- **The interface:** the garage's own controls and panels, organised as steps; only the 3D scene is replaced, by the
  2D views and the quick 3D. The desktop works the same way.
- **Tolerances:** the proposals above, tuned on the PC-6.
- **Windows:** every window the generator cuts is outlined in its own colour, rectangles and quads alike.
- **First run:** the PC-6 Porter, blueprints only. The DC-3 stays manual (re-injecting it into the tool is a later
  test); the Archaeopteryx waits for its new architecture; the Tiger Moth is not re-run.
- **This spec in the repo:** this file, branch `claude/fit-procedure-drafting-table`.

## BUILT (11 Nov 2026, session FIT-PROCEDURE, branch claude/fit-procedure-drafting-table)

The first cut, run end to end on the PC-6 (below). What exists:

| file | what |
|---|---|
| `flyDiy/drafting.html` | the page: one file, no game, no 3D engine. Steps, the view (side / top / front over the sheet, the outline in parts, the marks), the numbers strip, the step's garage rows, the quick 3D, save. The sheet image stays in the browser's IndexedDB (by its SHA-256). Opened from the main menu ("New reference plane"). |
| `tools/drafting/dt_worker.js` | the page's worker: loads `dt_manifest.js` (the core's generator files + the editor's layers, minus crew, panel, characters, energy, lamps, hinges, fittings, the UI and the join) and answers init / birth / build (rasters of the outline per view, the measurements, the 3D picture). |
| `tools/drafting/dt_build.js` | a plane file through the garage's generator: triangles tagged by part (body, glass, screen, pillar, waist, wing, strut, fin, stab, cowl, engine, gear, float), in the table frame. Two passes by default (some layers read what a later layer published). |
| `tools/drafting/dt_core.js` | pure: the views, the raster and its edges, slices, our key measurements, the probes, the comparison (`KM`). |
| `tools/drafting/dt_steps.js` | each step's garage rows (labels and ranges come from the garage at run time) and its key measurements. |
| `tools/drafting/table.js` | the CLI: `new`, `check` (+ overlays), `set`, `fit` (scoped search), `weigh` (the light checks), `rows`, `compare`. |
| `tools/drafting/refs/pc6.json` | the PC-6/B2-H4 reference block. |
| `builds/candidates/pc6_drafting_2026-11-11.json` | the PC-6, the garage's save format with its `ref` block. |

Measured (headless Chromium, local server): first paint 0.13 s; the garage ready in the worker 0.5 s; a build 0.33 s;
a slider round trip 0.66 s. In node a build is ~0.8 s (two passes); `weigh` ~20 s (the garage's whole load door).

### Lessons the first run taught (fold into the steps)

- **Two passes.** The garage's layers read what a later layer published on the previous build: the first build in a
  fresh context is one pass stale (the Caravan read 11.29 m long, then 11.03). Headless checks build twice.
- **The coupling (REF_MATCH section 4) bites the fitter.** The cowl's axis rise moves the thrust line, and every height
  is measured from it: a cowl fit scored on the nose alone moved the whole aeroplane 4 cm. Score every profile, and
  carry `engY` in the cowl's search.
- **Follow rows.** A frame row that follows the reference section is `null`: the fitter now leaves it out (it read as
  0 and collapsed the nose).
- **Measure what the garage draws.** The body sheet starts at the firewall (the cowl is its own layer); a 3-blade
  prop's box is 13 % short of its disc (read the tip radius); a tyre measured top to bottom catches the legs (read its
  chord near the ground); a window crossed by a strut splits in two (measure the fuselage alone); the windscreen
  touches the cockpit window (its own part).
- **Points on the outline (probes).** Where no row has a number (the fin's edges, the strut), mark a point on the
  drawing's outline and compare ours at the same height. General, and it gives the fitter something true to aim at.
- **A drawing is not consistent with itself.** The Commons PC-6 sheet's front view puts the wheels ~5 cm lower than
  its side view: heights are read on the side view, and the views are scaled each on its own figure.
- **The variant trap is real.** Three of the sources were for other PC-6 models or another aeroplane altogether (the
  15.2 m span of the pre-H4 tips, a 2.67 m propeller, the Marabu's type certificate): the reference step locks the
  variant first.

### The PC-6 log (11 Nov 2026)

Reference: FOCA TCDS F 56-10 (the B2-H4 column), the Pilatus factsheet, NZ CAA TAR 1/21B/14; the Commons sheet
(Kaboldy, CC BY-SA 4.0, kept off git) scaled per view, 36 marks. Started from the Caravan-alike with a tail wheel
(`--sel gearLayout:tail`): the Beaver-alike read 3/48, the Caravan 8/52.

| step | rows (how) | result |
|---|---|---|
| wing | `wgSpan 15.87 wgChord 1.93 wgChordTip 1.93 wgCrankChord 1.93 wgDihedral 1 wgDihedralOut 1 wgDy 0.08` (figures, the front view) | span, chord, LE (1 mm), top, dihedral in |
| nose | `eng_mountGap 4.85 cw_cowlLen 1.815 cw_lidLen 0.325` (arithmetic: the PT6 sits forward) | cowl face 3 mm, firewall 3 mm |
| sections | `noseLen 0.77 boomLen 4.114` (arithmetic) | wing LE, cockpit, tail post exact |
| body heights | `fit`: `engY roofY keelY aftRoofY aftKeelY tailRoofY tailKeelY halfW tailHalfW`, then `frPaxTopY frPaxBotY` | the boom's profiles within 1-3 cm |
| tail | `stSpan 1.935 stZ -0.153 stChord 1.06 stSweep 0 stChordTip 1 finHeight 1.57`; `fit` on the fin's corners against two probes | stab span exact, fin top 1 cm, fin LE / TE at 2.15 m within 2-4 cm |
| gear | `s1Z 2.652 s1Drop 0.832 s1X 1.5 s1R 0.335 s2_twLegDrop 0.087` | wheel, track, tail wheel height exact |
| windows | `paxWin*` (two door windows), `win2*` (the round one), by arithmetic from the marks | door 2 and the round window within 3 cm |
| struts | `wgStruts 1 wgStrutZ 0.1` | the strut at the door post, 1.5 cm |
| cowl | `cw_taperW 0.7 cw_taperH 1.0 engY -0.115` (`fit` with the coupling; taperH held at 1: never the inverted cone) | nose profiles within ~5 cm |

**40 / 60 key measurements inside tolerance.** Light checks (`weigh`): CG 30.1 % MAC (3572 mm, inside the TCDS
envelope 11-38 % at 1219 kg), static margin 19.3 %, wing area 30.6 m2 (30.15), chord 1.93; empty mass 1035 kg
against the factsheet's 1250 (-17 %, the mass model, as REAL-FIGURES found on the DC-3); main axle to CG 36 deg (the
game's taildragger band is 12-25: the PC-6 carries its mains far forward); prop clearance 0.15 m.

**Open on the PC-6 (next round):** door 1's front 20 cm behind the cabin pillar (the cabin frame's station); the cockpit
door window's shape (the native pilot window, not a drawn one); the nose profiles (the firewall section, the chin);
the max half-width; the engine (below).

### Garage gaps the PC-6 found (also REF_MATCH section 7)

| gap | what was done |
|---|---|
| the flown tail envelope: a 5.13 m stab and a 2.5 m fin on a 15.9 m span fly clamped (hSpan 1.5-4.5, vHeight 0.6-2.2; the big envelope is for spans past 18 m) | drawn true, flies clamped: the join says so |
| a fin station: the fin cannot stand ahead of the tail post (the DC-3's gap again) | the fin's corners at their forward limits; the rudder's foot 0.3 m aft |
| the tail wheel's station is held at the tail post (`s2Z` does nothing) | 0.21 m forward of the sheet's |
| the stab's station `stZ` stops at -0.6 | reached by the chord instead |
| the engine auto-fit: no PT6A-27 in the catalogue (550 shp, 149 kg) | flies the Caravan's PT6A-114A (675 hp, 160 kg) |
| the empty mass of an all-metal utility type reads 17 % light | flagged, not fixed |

### Still to build (in order)

1. The light checks in the page: the join and the solver in the worker at the check step (today `table.js weigh`).
2. Editing in the page: marks are placed; rows change by slider; the views' boxes and origins are placed by tap. Not
   yet: dragging a mark ON the outline to set a row (the handles), the sheet cut by lasso, a re-scale by two points.
3. The architecture step's `sel` choices in the page (today a re-birth from a candidate card).
4. The engine auto-fit (a garage function).
5. `real_check --ref` reading the plane file's own `ref` block.

## ROUND 2 (11 Nov, evening): the user's critique, turned into what the table looks for

The user's verdict on round 1: "you miss real big trends, important key data points". Their comments were taken "not
so much to match the PC-6, but to sharpen what you look for automatically". Each became a check every plane gets:

| the user saw | the check now | where |
|---|---|---|
| "not enough reference points ... it's clearly a slope downward on top" | **traced lines**: the drawing's outline followed densely off the sheet (`table.js trace`, `dt_core.trace`), top / bottom / plan / the windscreen, every 2-5 cm; per named stretch the mean offset, the worst point and **the slope** (the cowl read 3.6 deg where the drawing rises 9.8) | `ref.lines`, `lineRows` |
| "the bottom ... is broken where the wheel anchors, you have a bump" | **the sharpest turn** along a line, ours against the drawing's (a kink the drawing does not have); **folds**: a depth jump inside the fuselage's own side view (a frame pulled through its neighbours dents the skin while the outline stays straight) - also a penalty in the fitter | `lineRows` kink, `folds` |
| "the fin is actually incredibly straight ... the stabilizer/elevator assembly is super straight" | **the bow** of each stretch (its largest departure from its own chord), ours against the drawing's; lines may run UP the sheet (a fin edge: traced on the transposed sheet, compared by slicing at heights) or ALONG the span (a stab edge, top view) | `trace` vertical, `lineCompare` along / read |
| "your windows are upside down in shape" | **the window's shape**: the fullness of its top and bottom quarters, off the sheet (the window's interior filled from its centre) and off ours | `shapeFill`, `window.*.shape` |
| "you need finer sampling at the base of the windshield" | the windscreen and the cowl-to-windscreen line traced every 2-3 px (2.5-4 cm) | trace `step` |
| "you should adopt a brand new cowl and fit only the side profile" | `table.js unset '^cw_' --keep ...`: the cowl back to the garage's own, its details off, only its taper and droop fitted on the lines | `unset` |
| "why is your plane showing through?" | a bug of the table's: the skin's sheet-metal panels (`toele`) had been taken for the inside | `dt_build` INSIDE |
| "in the UI, we don't need the table with the numbers" | the page draws the sheet, our outline, the marks and the traced lines; the numbers stay in `table.js` | `drafting.html` |

Also learned: the fitter is a coordinate search and gets stuck when two rows must move together (the fin forward AND
its corners): start it from a geometric guess (the fin moved to the rudder's line first), then let it search.
Follow rows (frames that follow the reference section) now start from the generator's own value
(`dt_node.followValue`), and a row the plane never set starts at 0.

### Found in the garage this round

| finding | done |
|---|---|
| a fin station: the fin could not stand ahead of the tail cone (the PC-6's rudder ends 0.1 m ahead of it; the DC-3's hinge 0.5 m) | **built: `finZ`** "fore / aft (on the deck, + forward)" (`_fin_gen.js` buildFin2's anchor, `_cage_fin.js`, the part tree); absent = 0, every saved fin to the bit (GATE FIN, GATE PARTS pass) |
| the drawn windows' corner radii: R1 / R2 ("fwd top", "aft top") round the window's BOTTOM corners as measured (and as the user saw), R3 / R4 the top | OPEN: flagged; the PC-6 uses R3 / R4 for its rounded tops |
| the stab's height `stY` stops at 0.8: the PC-6's sits 7.6 cm higher | OPEN |
| the dorsal: `finRootFwd` reaches 1.5 m ahead of the fin's LE; the PC-6's starts 1.9 m ahead | OPEN |

## ROUND 3 (11 Nov, night): the square cabin and the nose

The user: "you have a blind spot ... on the front view ... the cabin is actually totally squared, and yours is a
narrower roof ... It's a square so that you can load square boxes in it", and asked for the nose in good definition
("there seems to be a complex assembly there"). What the table looks for now, on every plane:

| the user saw | the check now | where |
|---|---|---|
| a narrow, pitched roof the table never noticed: it read the front view's outline only as an extent | **front-view lines**: the cabin's walls traced on the front view (`ref.lines` `front.wall`, upper and lower wall) and scored like every other line; where the tracer veers off at a strut, the points are set by hand on the sheet | `refs/pc6.json`, `lineRows` |
| "a complex assembly" at the nose: a round cowl in a square cabin front left an open ring with the frames inside showing | **the inside shows**: the inside faces (`dt_build` part `inside`: bulkheads, the firewall, tubes, the dash, the seats...) kept in the raster as their own part, and any of them seen from outside in any view is reported with its area and place (`table.js check`), penalised in `fit` (`--noinside` to drop) and failed by GATE DRAFTING | `dt_core.insideShows` |
| | **the fitter walks the garage's steps**: it rounded its result to each row's step AFTER the search, and one roof fit ended on 89.5 deg, written as 90, which folded the roof (a value never scored); every trial is now on the row's step | `table.js fit` |

### Garage lessons this round (REF_MATCH section 7)

- **A square cabin**: the cabin rows (`halfW`, `roofHalfW`, every frame's top / waist / bottom widths) at one width,
  `topAngRoof` ~88, `topAngCeil` ~70, and `topRound` 0.05 - **`topRound` 0 is not a sharp corner but the PITCHED
  roof mode**.
- **A cowl on a square fuselage**: `fitNose` 1 (fitted) rounds the section and leaves a ring at the firewall;
  `fitNose` 2 (sealed: the size from the body, the section the cowl's own) with `cw_sqAftTop` / `cw_sqAftBot` ~0.9
  closes it.
- **A square cowl's split line**: in its default mode (`cw_partLevel` 0) the groove is a width in the section's own
  parameter, which on a boxy section opens to centimetres near the waist - a dark wedge along the side (the inside
  check does not see it: it is the strip, not the inside). `cw_partLevel` 1 (level, a fixed width in metres) is the
  garage's own answer.
- **The spinner** of a turbine card is small (the Caravan's 0.20 m): sized from the drawing (the PC-6's 0.40 m across,
  0.45 m long), its base sunk into the nose bowl by the same length (`cw_noseOff`), so the spinner tip - the table's
  datum - and every station stay put.
- **Squaring the roof moves the windscreen's side outline** (3 deg steeper here): `wsRun` and `noseLen` moved
  together (+0.08 / -0.08 m) bring it back without moving the wing, the gear or the tail.

The PC-6 after round 3: 122 / 175 (floor raised to 120), no fold, the inside never shows, the walls within 5 mm.
Still open: the chin intake, the cockpit door window, the tail wheel's station, the engine (-114A, not -27) and the
empty mass, the static margin.

## ROUND 4 (11 Nov, late): the turbine inside its cowl; the windows' flank bug fixed in the garage

- **The turbine poked out of its cowl** (the user: "the turbine is longer than the cowl"): the Caravan card's PT6 stood
  4.85 case radii (0.98 m) off the firewall, its reduction gearbox ahead of the nose bowl. The propeller rides the
  engine's flange plus `cw_noseOff` (the shaft), so the fix moves nothing the drawing fixed: `eng_mountGap` 4.85 ->
  3.35 (the turbine 0.30 m aft; one unit = the case radius, 0.203 m) and `cw_noseOff` -0.24 -> +0.065 (the shaft
  0.30 m longer). The spinner tip, the cowl front and every station stay put. Lesson: **moving an engine fore / aft
  without moving its propeller is the stand-off and the shaft moved together.**
- **A clean, straight nose** (the user: "just something straight", no chin): the nose ring's bottom stood proud of the
  bowl - `cw_keelSweep` 0 and `cw_lidRBot` 0.15 take it away; the bowl squared to the barrel (`cw_lidSqTop` /
  `cw_lidSqBot` 0.8, `cw_lidShoulder` 0.9, `cw_lidRound` 0.6).
- **The windows' "top" radii rounded the bottom**: not a label but a garage bug - `_knife_gen.js` knifeCut cut a window
  that is not symmetric top to bottom upside down on the starboard flank only. Fixed on its own branch for A0
  (`claude/fit-procedure-garage-windows`, with rows 4-6 of drawn windows), merged here; the PC-6's radii now sit on
  their own labels (R1 / R2 the tops).
- **A sliver is not a window**: `dt_core.windows` leaves out glazed patches under 6 cm; the cockpit window had been
  paired with a 3 cm strip. The PC-6 reads 119 / 175 (its two cockpit-edge passes were that pairing's luck); the floor
  follows.

## ROUND 5 (11 Nov, night): the user's look over the drawing - wing, windscreen, door, sill, a straight tail

The user, on the renders (their word over the drawing where the two differ):

| asked | done | rows |
|---|---|---|
| "the wing needs to go down, without touching the cabin height; the centre section top only, so the cabin fits below it" | the wing 0.13 m down (its lower skin now 0.13 m under the roof), the centre section `open` (the upper skin alone, the Cub's); the windscreen frame's top brought down to the roof (it had been lifted to 1.24 m, into the old wing) | `wgDy` 0.08 -> -0.05, `wgCentre` 2, `frWinTopY` 1.155 -> 0.95 |
| "the run of the windshield is longer, so the A pillar is about 45 degrees in side view" | 61.5 -> 44.9 deg; the nose shorter by the same so no station moves | `wsRun` 0.75 -> 0.99, `noseLen` 0.97 -> 0.73 |
| "the door is much thinner, so it does not intersect with the back window" | the pilot door is the quarter bay PLUS the pilot bay; 0.92 m -> 0.77 m, its aft edge 3.995 (the window at 4.06); the pilot bay below the slider's old 0.30 (garage gap -> `claude/fit-procedure-garage-windows` dc87d793, A0 told), the length given to the pax bays so the tail stays | `pilotLen` 0.10, `paxLen` 1.0767 |
| "decrease the sill, so it dips below the waistline" | the pilot's glass carried down past the waistband (the drawing's cockpit door window) | `winSillPilot` 0.14 |
| "the fin has an ugly little wave at the top" | the template's LE SHOULDER sat 0.35 forward of the tip and 0.10 ABOVE it (the earlier fit's way of standing the LE upright): the shoulder back on its template offsets, the top pair's bulge 0, the rudder's TE bulges 0; the tip and the LE refitted (`finTipZ` 0.44) and both top corners raised together (the top had hung on the hump) | `finShoulderZ/Y` 0.035 / 0.0205, `finTopY` 0, `finTE*` 0, `finTipY` = `finAftY` -0.29 |
| "same for the stabs from top view, and the elevators; full straight" | the same shoulder hump at the tips, and -3 deg of sweep bending the hinge line: shoulder on template, sweep 0, the LE / tips refitted on the drawing's straight edges | `stShoulderZ` 0.075, `stSweep` 0, `stLEZ` -0.355, `stTipZ` 0.335, `stChordTip` 0.99 |
| "do some 3/4 views" | quickshot gained `qr` (behind, above) and `qp` (ahead, port, above) | `tools/quickshot.js` |

Lessons for the table: **a corner the fitter moves to satisfy a line can make a bump the line does not see** (the fin's
shoulder stood the LE upright and humped the top): a straight surface is fitted with its shoulder ON the template and
the line rows scored; and the table's lines are the drawing's, but **the user's eye wins where they differ** - GATE
DRAFTING now holds the user's 45 deg A-pillar instead of the drawing's windscreen line, and its floor follows (118).

## ROUND 6 (12 Nov): the base geometry to the drawing's own lines; the chin scoop; the doors

| the user | done | rows |
|---|---|---|
| "fore of this [the cabin's end], everything at the bottom is straight and horizontal ... aft straight, at an angle ... no break, no curving of the boom, no annular thing" | the pod ring off, the taper section off (the boom longer by its length, the tail held); every frame's bottom set to the drawing's flat line (-0.484 m) - each frame moves its own stretch about 1:1, measured, then set; the boom's root bottom on the straight line to the tail | `boomMidOn` 0, `taperOn` 0, `fr*BotY`, `aftKeelY`, `tailKeelY`, `frPaxTopY` / `aftRoofY` / `tailRoofY` |
| "3 pax sections, like I drew them ... exactly from and to where I pointed" | the drawing's own pillar lines read off the sheet (column darkness: 3.911, 4.82, 5.58, 6.207); the bays are counted from the AFT one; the cabin 7 cm forward of the nose (the cockpit bay already at 0.02) with the wing, the mains, the tail and the drawn windows held | `paxLen` / `paxLen2` / `paxLen3` (garage: per-bay lengths), `noseLen`, `wgDx`, `s1Z`, `boomLen`, `paxWinZ` / `win3Z` |
| "your round window is placed too much aft" | the reference's own marks were 0.17 m aft of the circle (re-read off the sheet: 5.761-6.071); the window put on it | `refs/pc6.json` `window.round`, `win2Z` |
| "an ugly break between the pax section and the boom ... 'Match to cabin size'" | garage: `boomMatch` - with no taper, the boom root is the cabin's aft frame itself | `boomMatch` 1 |
| "the waistline shows in the boom ... top, waist and bottom widths exactly the same" | the cabin's three widths equal (0.77), the tail section's too | `frTailTopW` = `tailHalfW` = `frTailBotW` 0.204 |
| the chin scoop "very square and large, runs all along the cowl ... follow the cowl's taper seen from below" | garage: `scoopHold` (the full section held along the length) and `scoopWFit` (the half-width a share of the cowl's own); the scoop straight and level (`scoopFollow` 0, `scoopRake` 0) at the fuselage's bottom (`scoopDrop` 0.9) | `cw_scoop*` |
| "the bottom of the door further up, 20 cm, the blueprint's line" | the door no longer to the floor; the floor line lowered so its bottom is at -0.27 (20 cm above the keel) | `doorDeep` 0, `floorY` -0.97 |
| "pax doors only for the 2 first sections" | garage: `doorPaxFront` (doors on the N bays nearest the cockpit) | `doorPax` 1, `doorPaxFront` 2 |
| "the anchor point of the strut on the wing further aft; control both ends" | they exist: the foot on a picked pillar (`pilSnap`, `wgStrutPil`) and in/out (`wgStrutX`); the wing fittings fore/aft (`wgStrutZ`), clamped by the wing's structural band (the rear fitting not behind the aileron hinge) - at -0.2 it is at the band's limit and on the drawing's strut | `pilSnap` 1, `wgStrutPil` 2, `wgStrutZ` -0.2 |

Gaps still open: the main gear's shock strut up the fuselage side (no leg kind draws it); a bubble for the cabin's own
glazing band (bubbles are the drawn windows'); the tail wheel's station. The PC-6: 121 / 175, no fold, no inside showing.

## ROUND 7 (12 Nov): the chin scoop's taper and station, the PT6 stacks, the Cub-style main gear

| the user | done | rows |
|---|---|---|
| the chin scoop "would need a taper ... more options ... goes a little too far forward" | garage: `scoopTaperH` / `scoopTaperW`, the aft end's height / width as a share of the mouth's (1 / absent: none); the mouth back to the drawing's (0.88 m behind the spinner tip): the scoop ends at the firewall (`scoopZ` 1) and is shorter by the difference | `cw_scoopLen` 1.756, `cw_scoopZ` 1, `cw_scoopTaperH` 0.85 |
| "these pipes going out of the turboprop ... stick a bit more ... flat at the end ... an option in the engine generator" | the PT6's stacks were hard-coded: five installation rows (_eng_page.js turbine group; _cage_eng.js INSTALL_ROWS, never the maker's): reach out, run aft, thickness, outlet drop, flattened outlet (the tube sweep's section an ellipse over the last third); 1 / 1 / 1 / 0 / 0 draw them bit for bit as before | `eng_stackOut` 2.2, `eng_stackLen` 1.4, `eng_stackR` 1.5, `eng_stackDrop` 0.6, `eng_stackFlat` 0.55 |
| the gear "like the Cub ... two leg supports ... a little triangle, and on top the shock ... anchored much further up, almost below the windshield" | it was the OLEO leg (`s1Leg` 2) - whose shock rows do nothing; the LINK leg (1) with the V (`linkVee`), the shocks on their own side (`linkX` 0 - the Cub's crossed X off), the shock's top fitting at 125 deg round the section from the keel (up the flank, under the wing); the slider to 170 (garage, a range); the wheel back on its mark through the axle's offset | `s1Leg` 1, `s1_linkVee` 1, `s1_linkX` 0, `s1_shockKind` 0, `s1_shockAng` 125, `s1_shockZ` 0.1, `s1AxZ` -0.19 |

Lesson: **a row that moves nothing is often the row of another mode** (the shock rows belong to the link leg, not the
oleo): read the mode first (`s1Leg`), then the rows. The PC-6: 123 / 175.

### The garage branch and A0's trains (12 Nov)

Garage changes the table needs go on their own branch, `claude/fit-procedure-garage-windows`, for A0 (the coordinator)
to train in; the drafting branch merges it. A0's rules for it (12 Nov): L39a takes the branch as it stands at Thu 12 Nov
11:30; L39b (Thu 19:00) is the last feature train before the perf round - push nothing to it after Thu 17:30; later
garage work waits for the week of 16 Nov, on a NEW branch. Keep it rebased on master (a fast merge), LF line endings
only. L38c already took it at dc87d793 (rebased since: 31bd4c47).

## ROUND 8 (12 Nov): the PC-6's own cockpit window, drawn

The user: "the option of having drawn window for the pilot window is not possible, right? ... make it a full panel
where the window part is actually just a panel and we cut through". It was not: the cockpit's side glass is the pilot
bay's glazed band. Garage (`claude/fit-procedure-garage-windows` fc4bb9ed): `winPilotPanel` turns that band into skin
before the knife (the passengers' band already turns when a drawn window exists), and every drawn-window row gained
a FIFTH corner (`Q5On`, `Q5Z`, `Q5Y`, radius `R5`) between the fwd-bottom and fwd-top ones. The PC-6's window read off
the sheet's overlay (the first try traced the sliding vent inside it - check the drawing's OUTER line): a vertical
front, the top along the A-pillar, a big arc from the aft-top corner down to the bottom (`win4R3` 0.45), on row 4, cut
through the door. The PC-6: 125 / 175.
