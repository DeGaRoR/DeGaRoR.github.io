# PHOTO — pictures of Wingsmith: the scene file, the photo mode, the headless shot

The how-to for any agent or session that has to make a picture of the game, or work on the photo tool, WITHOUT the
conversation that designed it. The design and its reasons: `futureDesigns/PHOTO-MODE-2-2026-11-11.md` (the user's
rulings are in its section 6). **Every phase that lands updates this file**: the status table first.

## 0. What is built, and what is not yet

| piece | status | where |
|---|---|---|
| the scene file (format, checks, the plane-anchored camera, the picture's size) | **BUILT** (P0, 11 Nov) | `src/core/89_scene.js`, `tools/scene.js`, GATE SCENE |
| the scene inside a PNG (one compressed `iTXt` chunk) | **BUILT** (P0) | same |
| `placePose`: the aeroplane at any heading / pitch / roll, rigid | **BUILT** (P0) | `src/core/39c_placement.js` |
| the JSON Schema of the scene | **BUILT** | `futureDesigns/photo-mode-2/scene.schema.json` |
| the photo bar on the flight's top bar, garage + flight, the floating shutter | not yet (P1) | will be `src/viewer/photo.js` |
| Save / Load a scene in the game, `window.SCENE` | not yet (P2) | photo.js |
| "go to" the start places in photo mode | not yet (P3) | photo.js + `FLYDIY_ROUTE.spawn` |
| the high-quality shot (spinner, steps, cap 55 s) | not yet (P4, needs the GPU box) | photo.js + `gfx_settings.js` |
| `tools/scene_shot.js`: a scene file -> a PNG, headless | not yet (P5, needs the GPU box) | tools/ |

Until P2 and P5 land, a picture of the running game is made the old way (section 4), and the scene file is what you
WRITE DOWN for it, so the same picture can be made again by the tool when it exists.

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
rewrites. Until P2 gives `SCENE.apply`, a page places with `FLIGHT_PROBE.place({ at, zeroV: true })` (translation only).

### 1.3 Where scenes live

- `shots/scenes/<name>.scene.json`: scenes we keep. GATE SCENE checks every file there, so a broken one is red.
- Pictures go to `screenshots/` (gitignored), never into the repo.
- Every picture the game saves (P1 on) carries its scene: `node tools/scene.js get` recovers it.

## 2. The photo mode in the game (P1-P4; how it will work)

On the flight's TOP BAR (the flight interface design, `futureDesigns/design_handoff_flight_interface/`): the PHOTO
plate at the left with five slots (camera · light · picture · scene · go to), `Done` at the right; the rest of the
chrome leaves; a round half-transparent shutter floats bottom centre. The same bar in the garage. **Save this scene**
takes the screen as it is (no posing tools: the user's ruling); **Load** puts it back; **go to** sets the start place
(`FLYDIY_ROUTE.spawn`) and restarts there. **High quality** is opt-in: a spinner in the middle with the % and one short
line, at most 55 s (`SCENE_HQ_CAP_S`), the settings back after.

## 3. Shooting a scene headless (P5; how it will work)

```bash
node tools/scene_shot.js shots/scenes/my.scene.json screenshots/scenes/my.png --gpu   # not built yet
```

It will wait for the page (`SCENE.ready()`), apply the scene in its fixed order (site -> build -> time and weather ->
pose -> camera -> hold -> the world streamed round the EYE -> checks), shoot, and write the PNG with a
`.report.json`; any check warning fails the run.

## 4. Until then: a picture of the running game, by hand

- **A picture of a build alone, in seconds, no browser**: `node tools/quickshot.js` (`tools/QUICKSHOT.md`). Use it for
  shapes, not for looks.
- **In a page**: `tools/plane_shot.js` is the reference rig (the garage, the build through `#gFile`, the camera, the
  asserts). Copy its order, not its numbers. The hooks: `FLIGHT_PROBE` (app.js: `camSet(az, el, dist)`, `camSettle()`,
  `camMode(m)`, `devFree(x, y, z, yaw, pitch)`, `camGet()`, `pan`, `place`), `SHOT_MODE.enter()` (the interface off),
  `DAY_CLOCK.set({...})` / `.rate(0)`, `GARAGE_SPEC.set(spec)`, `FLYDIY_ROUTE.spawn(id)` (the next roll-out's start),
  `GFX.get()`, `window.FLYDIY_PHOTO.take()` (today's shutter: a PNG download of the next presented frame).

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
what exists). Write the scene as `flyDiy/shots/scenes/<name>.scene.json`, check it with `node flyDiy/tools/scene.js check`,
and shoot it the way section 3 (or, until P5, section 4) says. World pictures need a LOCAL session and a GPU box slot
from A0." Attach the build file if the picture is of a build that is not in the repo.
