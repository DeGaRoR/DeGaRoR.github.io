# PHOTO — pictures of Wingsmith: the scene file, the photo mode, the headless shot

The how-to for any agent or session that has to make a picture of the game, or work on the photo tool, WITHOUT the
conversation that designed it. The design and its reasons: `futureDesigns/PHOTO-MODE-2-2026-11-11.md` (the user's
rulings are in its section 6). **Every phase that lands updates this file**: the status table first.

## 0. What is built, and what is not yet

| piece | status | where |
|---|---|---|
| the scene file (format, checks, the plane-anchored camera, the picture's size, the pose read back) | **BUILT** (P0 11 Nov, P2 12 Nov) | `src/core/89_scene.js`, `tools/scene.js`, GATE SCENE |
| the scene inside a PNG (one compressed `iTXt` chunk) | **BUILT** (P0); every picture the game saves carries one (P2) | same; app.js `photoEmbed` |
| `placePose`: the aeroplane at any heading / pitch / roll, rigid; `FLIGHT_PROBE.place({ at, pose, seat })` on the sim that flies (the page's or the physics worker's) | **BUILT** (P0, P2) | `src/core/39c_placement.js`, `src/viewer/sim_host.js` / `sim_link.js` |
| the photo bar on the top row, shed + flight: camera, light, picture, scene, go to; Done; the floating shutter; the spinner | **BUILT** (P1-P4, 12 Nov) | `src/viewer/photo.js` (the UI), app.js's PHOTO-MODE-2 sections, GATE PHOTO, UISMOKE rows |
| the picture's size (window by default, 1920x1080, 2560x1440, 3840x2160) | **BUILT** (P2) | app.js `photoShoot` |
| scenes in the game: save this scene, the list (load / export / delete), import a `.scene.json` or a picture; `window.SCENE` | **BUILT** (P2) | app.js `sceneGet` / `sceneApply` / ..., GATE SCENEPAGE (the page in node) |
| go to: the start places in photo mode | **BUILT** (P3) | app.js `photoGoTo`, GATE SCENEPAGE |
| the high-quality picture (opt-in; the night hero's settings scaled to the machine, 55 s cap) | **BUILT, NOT TUNED ON A GPU** (P4) | app.js `photoHqSteps`, `gfx_settings.js` `GFX.push / pop` (GATE GFX) |
| `tools/scene_shot.js`: a scene file -> a PNG + a report, headless | **BUILT** (P5); shed scenes run in the cloud, world scenes want the GPU box | tools/ |
| the control surfaces drawn from a scene (held: the linkage snapped to them; cleared when the flight runs) | **BUILT** (P2) | app.js `photoCtl`, GATE SCENEPAGE |
| the prop set from a scene | NOT YET (drawn as the flight left it; the loader says so) | - |
| the camera's roll | NOT YET (the free camera has none; the loader says so) | - |

## 1. The scene file

One JSON document, `"what": "wingsmith-scene", "v": 1`. **A missing field means "leave it as the page has it"**, so
a scene can be six lines. Unknown fields are kept and written back. Units: metres, degrees; the world's axes are x, y
UP, z (as `world.terrainH(x, z)` reads them).

```json
{ "what": "wingsmith-scene", "v": 1, "name": "Cub over the lagoon",
  "site": "flight",
  "camera":  { "anchor": "plane", "eye": [-9.5, 2.1, 6.0], "target": [0.4, 0.2, 0], "roll": 0, "fov": 38 },
  "time":    { "date": "2026-06-21", "localHours": 19.25, "frozen": true },
  "weather": { "cloudType": "cuh", "cloudCover": 0.3, "wind": { "kts": 8, "dirDeg": 250 } },
  "plane":   { "ref": "stock:cub", "build": { "what": "flydiy-build", "v": 10, "name": "Cub", "spec": { } } },
  "pose":    { "where": "air", "at": [1520, null, -840], "agl": 45, "hdg": 250, "pitch": 4, "roll": -18 },
  "quality": { "hq": false, "output": [1920, 1080] } }
```

| section | what it holds | the rules that bite |
|---|---|---|
| `site` | `"flight"` (default) or `"garage"` | a flight scene opened in the garage rolls out first |
| `camera` | `eye`, `target`, `fov` (vertical, 10-100), `roll`, `mode` (the view the bar returns to) | `anchor: "plane"` (default): eye / target in the plane's HEADING frame - x forward along the heading, y up, z RIGHT, origin the CG; the plane's pitch and roll do not turn it. `anchor: "world"`: world metres. The eye may not sit on the target |
| `time` | `date` (YYYY-MM-DD), `localHours` or `utc`, or a `preset` (dawn, morning, noon, afternoon, golden, sunset, dusk, night) | frozen in a scene; in the career the career's clock wins |
| `weather` | `DAY_CLOCK`'s fields (`cloudType`, `cloudCover` 0-1, `cloudSeed`, `wind {kts, dirDeg, gust, refH, breeze}`, `oatC` ...), `clouds` (the cloud dials), `seaT` (the waves' phase) | |
| `plane` | `build`: the garage's export envelope INLINE (`{ what: "flydiy-build", v, name, spec }`, as the garage's Export writes it); `ref` is a readable label only | inline so the scene re-opens exactly; 8-35 KB; never hand-edit the spec inside a scene, export it from the garage |
| `pose` | `where` (`ground`, `water`, `air`, `stand`), `at` [x, y, z] of the CG (y `null` = seated on the ground / water), `agl` (air, when y is null), `hdg`, `pitch`, `roll` (degrees), `controls`, `prop` | see 1.2 for the conventions |
| `quality` | `hq` (the high-quality shot, OFF by default), `output` [w, h] (null = the window's size), `rung`, `overrides` | the largest side is 8192 |

### 1.1 The command line (works today)

```bash
node tools/scene.js check my.scene.json             # ok / REFUSED with the reasons, the clamps, a one-screen summary, the size
node tools/scene.js check picture.png                # the scene inside a picture
node tools/scene.js new --build builds/my.json --name "my shot" > shots/scenes/my.scene.json
node tools/scene.js put picture.png my.scene.json    # -> picture.scene.png, the scene inside (never overwrites)
node tools/scene.js get picture.scene.png            # the scene back out
```

`check` exits 1 on a refused scene: use it in any rig before you spend minutes on a page.

### 1.2 The pose's conventions (measured, GATE SCENE 4)

- `hdg`: the spawn identity's heading, as `placeAtAerodrome` reads it: the nose along `(cos hdg, 0, sin hdg)` in world
  x / z. **It is NOT a compass heading.** HOME's runway heading is 180 (pi in the core).
- `pitch`: nose up is +, about the build's own datum (the fuselage's x axis; the stock build's datum is 0.46° nose-up
  of level).
- `roll`: the RIGHT wing down is +. (+z is the aeroplane's LEFT: HANDOVER "AXES & SIGNS".)
- `at`: the mass centre. On the ground leave `y` null: the loader seats it (`seatOnGround`: the third wheel pitched
  onto the ground, the lowest contact 1 cm above it).
- The pose is the AS-BUILT shape turned as one rigid piece: a banked aeroplane held in the air shows its wing at rest,
  not loaded.

In node (a gate, a rig's own numbers):

```js
const C = require('./tools/flight_core.js');
const def = C.buildGen(spec), sim = C.makeSim(def, null);
sim.reset(0);
C.placePose(sim, def, { at: [x, y, z], hdg, pitch, roll, speed });   // radians here; returns the CG
C.seatOnGround(sim, world.terrainH, def.refs);                        // on the ground
```

In a page, **never write `sim.p` by hand**: under the physics worker the page's sim is a view the next snapshot
rewrites. Use `SCENE.apply(scene)`, or `FLIGHT_PROBE.place({ at: [x, y | null, z], pose: { hdg, pitch, roll }, seat })`
(radians; `seat`: let it down onto the ground under it) - it runs on the sim that flies and answers a promise of the CG.

### 1.3 Where scenes live

- `shots/scenes/<name>.scene.json`: scenes we keep. GATE SCENE checks every file there, so a broken one is red.
- Pictures go to `screenshots/` (gitignored), never into the repo.
- Every picture the game saves (from P2 on) carries its scene: `node tools/scene.js get` recovers it.

## 2. The photo mode in the game

- **Open it:** in flight, the corner camera button (top left); in the shed, the camera flyout's `photo mode` pill; from
  code, `window.FLYDIY_PHOTO.open()`. Every panel goes (body.shot); the flight pauses.
- **The bar** is the TOP ROW (the flight interface's grammar): the PHOTO plate with one slot per question, each opening
  its flyout UNDER the slot, and `Done` at the right. Esc closes the open flyout first, then photo mode.
  - `camera`: the views (free with Dev on or in photo mode), the field of view, level, lead; the shed: the field of view
    25-80, "frame the aeroplane".
  - `light`: in flight the day panel (the hour, the date; `time` in the career, whose clock is the career's); the shed:
    its moods (only when the room has them).
  - `go to` (flight, not the career): the island's aerodromes and strips this gear may use; a pick restarts the flight on
    that place's stand, held. The next roll-out starts there too, until `home` is picked.
  - `picture`: the size (the window's by default) and **high quality** (OFF by default, remembered).
  - `scene`: save this scene (a name, then save: the screen as it is - no posing tools), the scenes saved in this browser
    (load / export / delete), import a `.scene.json` or a picture this game saved.
- **The shutter:** the round half-transparent button at the bottom centre. Flash and sound at the press; the picture is
  the 3D frame alone, at the picture slot's size, downloaded as `wingsmith-<date>-<time>.png` WITH its scene inside.
- **The spinner** (a picture that takes longer than 0.4 s, and every high-quality one): in the middle, a ring that fills
  with the real %, one short line per step, the time so far after 8 s; ✕ or Esc cancels and puts everything back.
- **Done** gives back what photo mode changed: the camera's mode and field of view, the pause, the hour (only when the
  light slot moved it, never the career's), the shed's field of view and mood. A loaded scene or a "go to" stays.
- **For a rig:** `SHOT_MODE.enter()` is still the render ALONE (no photo bar). `FLYDIY_PHOTO`: `open()`, `take()`,
  `on()`, `done()`, `slots()`. `window.SCENE`:

| call | what it does |
|---|---|
| `SCENE.ready(maxMs)` | -> Promise: the loading screen gone, no trip running, 8 presented frames |
| `SCENE.get(name)` | -> the scene on the screen now (what "save this scene" stores) |
| `SCENE.apply(scene, { photo: true, settle: 30 })` | -> Promise<{ ok, steps, warnings }>: the ONE ordered loader - the site and the build (to the shed and a roll-out when they differ, AWAITED), the hour and the weather, the pose, the camera (the free camera at the exact eye), photo mode open, the world settled round the eye, the checks |
| `SCENE.check()` | -> warnings: the eye under the ground / water / in a tree, the aeroplane out of the frame or the eye inside it, the loading screen up |
| `SCENE.shoot({ output, hq, name })` | -> Promise<{ png (base64, the scene inside), w, h, ms, notes, warnings }> |
| `SCENE.save(name)`, `SCENE.list()`, `SCENE.load(i)`, `SCENE.remove(i)`, `SCENE.importFile(file)` | the scenes saved in this browser (`flydiy.scenes`, 40 at most) |
| `SCENE.size([w, h] or null)`, `SCENE.hq(bool)` | the picture slot's two settings |
| `SCENE.places()`, `SCENE.goTo(id or null)` | go to (null: home) |

### 2.1 The high-quality picture (P4) - built, not yet tuned on a GPU

Opt-in. For ONE picture: `GFX.push` (a transient layer - the player's settings are never written) of the night hero's
reference (ultra rows, density 200, `TREE_LOD` [150, 1000, 1000] fade 60, live mirror, full clouds) on a gamer / ultra
/ current page; on potato / laptop / retro only the shadows, clouds and mist (their forest is their budget's). Steps:
getting ready -> the trees (the fill's queue to empty, its real %) -> 8 frames for the shaders -> 20 for the clouds ->
the size -> the grab; ONE cap, 55 s from the shutter (`SCENE_HQ_CAP_S`): past it the picture is taken as it is and the
notes say how far it got. The governors held (`GFX.hw.hold`, the auto render scale), the long main-thread tasks measured
(`notes`), a lost WebGL context cancels. Everything comes back in the shot's `finally`.
**THE GPU CHECK (A0's box; a LOCAL session; `tools/perf/boxlock.sh take gpu photo-mode-2`, drop after) - ~45 min:**
1. The flight scene, window size, plain then high quality (the report's `shotMs`, `notes`, `hq`):
   `node tools/scene_shot.js shots/scenes/flight_home.scene.json --out screenshots/scenes --check --gpu --no-hq`
   then the same with `--hq` (out to another folder: `--out screenshots/scenes/hq`).
2. The same at 3840x2160: copy the scene, set `"quality": { "hq": true, "output": [3840, 2160] }`, shoot with `--gpu`.
   Read: the note on the AA target (it must say the 2x smooths it), no `contextLost`, the picture's size.
3. Read in each report: `shotMs` (want under 55 000, the cap; the tree step is most of it), the longest main-thread task
   in `notes` (want under 200 ms; SwiftShader reads 16 s, which is software drawing, not this), any "the cap" note (the
   trees did not finish: the cap held).
4. Look at the pictures: the HQ one has the far trees, the sharper shadows, the water's reflection; the plain one the
   player's settings. And, in the browser by hand: photo mode in flight (the corner camera), the bar on the top row,
   the shutter, a scene saved and loaded, go to, high quality on with its spinner, Done.
5. Write the numbers here (this section) and adjust in app.js `photoHqSteps` if the frame counts (8 shaders, 20 clouds)
   or the tree fill budget (20 ms) want changing.

## 3. Shooting a scene headless: `tools/scene_shot.js` (P5)

```bash
node tools/scene_shot.js shots/scenes/my.scene.json --out screenshots/scenes --check        # the cloud (SwiftShader)
node tools/scene_shot.js shots/scenes/my.scene.json --out screenshots/scenes --check --gpu  # A0's box, a LOCAL session
node tools/scene_shot.js --capture shots/scenes/new.scene.json [--rollout] --name "..."      # the page's scene, to edit
```

It serves the tree, opens the page (`?intro=0&idle=0&welcome=0&mode=sandbox`; a shed scene in the cloud on the phone's
garage page, the fastest boot), awaits `SCENE.ready()`, `SCENE.apply(scene)` and `SCENE.shoot()`, and writes `<name>.png`
(the scene inside) and `<name>.report.json` (the loader's steps and warnings, the shot's ms and notes, the boot's
seconds, `hiddenDiff`: the share of pixels that change with the aeroplane hidden - under 0.2 % is "the aeroplane is not
in the picture"). Any warning fails the run (exit 1) unless `--draft` (the controls / prop note does not count).
Measured in the cloud (12 Nov, SwiftShader, 1280x720): a shed scene on the phone page - boot 33 s, the shot 18 s, 102 s in
all; the picture right (the Cub under the shed's lamp), its scene inside.

## 4. By hand, and what every rig before this one tripped on

- **A picture of a build alone, in seconds, no browser**: `node tools/quickshot.js` (`tools/QUICKSHOT.md`). Use it for
  shapes, not for looks. `node tools/quickshot.js --scene my.scene.json /tmp/draft` draws the scene's aeroplane from the
  scene camera's direction (level, ~6 s): the framing's draft before the real picture.
- **In a page**: `tools/plane_shot.js` is the reference rig (the garage, the build through `#gFile`, the camera, the
  asserts). Copy its order, not its numbers. The hooks: `FLIGHT_PROBE` (app.js: `camSet(az, el, dist)`, `camSettle()`,
  `camMode(m)`, `devFree(x, y, z, yaw, pitch)`, `camGet()`, `pan`, `place`), `SHOT_MODE.enter()` (the interface off),
  `DAY_CLOCK.set({...})` / `.rate(0)`, `GARAGE_SPEC.set(spec)`, `FLYDIY_ROUTE.spawn(id)` (the next roll-out's start),
  `GFX.get()`, `window.FLYDIY_PHOTO.take()` (the shutter: a PNG download of the next presented frame - the 3D frame alone, whatever is on the page).

The pitfalls every rig has hit (each one cost runs; the files that record them):

| pitfall | what to do |
|---|---|
| shot under the loading overlay: dimmed, an A/B sheet thrown away (`island_shot.js:13-17`) | wait for `BOOT.state === 'gone'` and the set loaded (`plane_shot.js:422`), then 3 s more |
| Roll out clicked while the garage chain still ran (the 120 s timeout lifts the overlay early) | wait on BOOT's step chain (`BOOT.stepI >= steps.length && !BOOT.current`), not on the overlay |
| "the roll-out never happened" (`cloud_shot.js:78-91`); CONTINUE ANYWAY clicked early gave blank shots | wait for the flight phase itself; dismiss popups only once they are up |
| the streamers read the camera before the rig placed its eye (`lake_holes_shot.js:3-6`) | place the camera FIRST, then wait for the world round the eye, then shoot |
| eye in the trees / under the ground, plane out of the frame | read the eye back (`camGet`) and diff a frame with the craft hidden (`plane_shot.js` asserts 5 and 6) |
| the near plane cuts the skin under ~0.8 m (`plane_shot.js:20`) | keep the eye 0.8 m or more from the skin |
| a frame `held` (a shader still compiling) shows nothing new | count presented frames, not rAFs; today's shutter already waits for a presented frame |
| each rig's own camera presets disagree | write the camera into a scene file instead |
| SwiftShader (the cloud) draws the world black (the PMREM probe) and takes minutes a frame | world pictures need a LOCAL session on A0's GPU box: `tools/perf/boxlock.sh take gpu <who>`, drop after |
| `FLIGHT_PROBE.place(...)` then `sim().cgPos()` returns the old spot (HANDOVER, NIGHT-LOOK) | read the placed answer the promise returns |

## 5. Handing this to a new session

Paste: "Make a picture of Wingsmith with the photo tool. Read `flyDiy/tools/PHOTO.md` first (its status table says
what exists). Start from `node flyDiy/tools/scene_shot.js --capture` or from a scene the user saved in the game (the
scene slot's export, or any picture the game took: `node flyDiy/tools/scene.js get picture.png`), keep it as
`flyDiy/shots/scenes/<name>.scene.json`, check it with `node flyDiy/tools/scene.js check`, and shoot it with
`node flyDiy/tools/scene_shot.js <it> --check` (section 3). World pictures need a LOCAL session and a GPU box slot from
A0 (`--gpu`)." Attach the build file if the picture is of a build that is not in the repo.
