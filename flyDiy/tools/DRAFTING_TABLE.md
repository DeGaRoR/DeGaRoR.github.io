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
