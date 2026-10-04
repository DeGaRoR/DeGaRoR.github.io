# MOBILE-GARAGE: build the aeroplane on the phone, fly it at home (2026-10-04, G1510-G1519, a study)

**The user (4 Oct):** *"A garage slider revamp is incoming, and I'd want to do that allowing for a mobile-compatible
approach. Main idea is to let a simplified garage version run on phones, but maybe not the world, so one can do its
plane on its phone on the train back from work, then upload and play with it in full HD on the computer at home."*

This is a STUDY. It contains this document, throwaway mock-ups (`futureDesigns/mobile-garage/`), three rigs
(`tools/perf/mobile_*.js`) and their measurements (`reports/evidence/MOBILE-GARAGE/`). It does not change the shipped
game.

Where the numbers come from: **node** = the page in node (`tools/_page_node.js`: real three.js and real game code
over a recording GL, real ms, ~1.6x the box's JS). **SwiftShader** = headless Chromium 141 in the cloud with no GPU
(frames take seconds; only JS times and bytes are meaningful there). **box / phone** = A0's to take, with the rig in
§1.6. Every number below says which of these it is.

---

## 0. THE RECOMMENDATION, IN SEVEN LINES

1. **A garage-only mode of the same page** (`?mode=garage`, which the welcome's phone gate offers as "build on this
   phone"). It boots the garage's 10 steps and none of the world's 14. The island (37.3 MB) is never fetched, and the
   roll-out button becomes **Send to computer**. Measured with a prototype (§1.3-1.4): 0 errors, the sliders work
   as in the full game. Node: boot ~300 s → 33-37 s, 230 → 43-47 MB read, memory after GC 2.9 → 0.48-0.53 GB.
   SwiftShader: 215 → 58 MB on the wire, **JS heap peak 1,530 → 365 MB** (the S20 FE's budget is 700).
2. **No garage on a phone: a black studio** (the user's ruling). The aeroplane in a pool of light on black, key /
   fill / rim, studio reflections, nothing else. Measured with a crude proxy in node: 42.6 → 3.2 MB of media and
   441 → 323 MB of memory. One frame is 7,021 draws today (the shed's shadow and glass passes) against ≈ the
   aeroplane's ~545 in a studio. It is a scene profile of the same code, so it is also on the desktop (§1.5).
3. **One row model, two renderers.** Today's row tuple gains six optional fields (`unit`, `group`, `tier`, `fine`,
   `detents`, `help`). A desktop renderer and a touch renderer read it, and both emit the same `tick` / `release`
   events GARAGE-INSTANT already keys on. On touch **only the knob moves a value**; a finger anywhere else on a
   slider scrolls the list (R4, the user's ruling). The parts tree holds only the aeroplane; the reference plane and
   the hangar move to the rail (R24, the user's ruling). **The slider revamp must decide this now** (§2.9). The rest of the phone
   UI can come later without a rewrite.
4. **Phone → computer by link**: `#build=<base64url(deflate-raw(JSON))>` in the URL fragment, so GitHub Pages stays
   static and no server sees the build. The payload is a **patch over a frozen stock base** (20 changed rows = 401
   characters, which fits a QR). A whole spec is the fallback (about 9.6 k characters: a link, but not a QR). It is
   sent through the phone's share sheet (Web Share API). Copy, QR and today's .json file are the fallbacks.
   **No cloud store in v1.**
5. **The phone does not fly.** It shows the bench check (the shakedown runs without a world) and marks the plaque
   "not yet flown". The computer opens the link on an arrival card: checked, built, bench, then the full-HD flown bake
   and the world at roll-out.
6. **One trunk** (the user's ruling): the phone is a subtract-only PROFILE of the desktop trunk, with the same page,
   build, rows and aeroplane. GATE MOBILE checks it in node at every release (§6).
7. **Order:** decide the row model inside the revamp now (M3) → `?mode=garage` on the desktop (M1) → the share link
   (M5, useful between two computers too) → the black studio (M2) → the touch UI (M4) → the phone soak and an iPhone
   check (M6). §5 has the sessions, G-blocks and gates.

---

## 1. WHAT RUNS ON THE PHONE

### 1.1 Today: a phone loads the world, and the world kills it

- Since B9 (G1020) there is **one loading** of 24 steps (`app.js:11770-12451`, `BOOT.run`). The garage is up at step 5
  (seed); then the world, town, parking, trees, ring, settle, parked cook, snapshot, flown bake, spec, images, upload,
  world compile, compile, first light, the world's frames, the craft's programs, and recheck.
- **S20 FE, 2 Oct (FRIENDLY-WELCOME-BUDGETS §1):** heap ~2.0 GB and renderer 2.8 GB on gamer; potato was the same
  curve. **Android killed Chrome at "building the field"** (57/137 and 66/137). MEM-BUDGET (G1230) halved potato's
  peak (2265 → 1141 MB on SwiftShader) and said so: *"the floor BEFORE the world is ~450 MB ... no lever here
  touches it"*. The S20 FE's own budget is **≤ 700 MB heap, ≤ 500 MB GPU, ≤ 300 draws / 0.6 M triangles**.
- The welcome's device gate (`welcome.js:103-108, 152`) tells a phone "flyDiy is made for a computer, for now", with
  "try anyway (experimental)", which loads potato. `?gfx=` and localhost skip the gate.

### 1.2 The garage is already separable from the world

The editor has its own scene (`garageScene()`, app.js:1024; "NO AERODROME ... the last thread tying the editor to the
world", app.js:6766), and GATE ROUNDTRIP holds that nothing ticks the world in the shed. The world's boot steps are
TRIP_STEPS rows. The first roll-out of a visit builds whichever ones did not run (boot.js:289: "world: Only the first
roll-out of a visit"). That is the LOADING-S3 path the game had before B9: a garage-only boot (18.5 s cold on
2026-09-15, `tools/perf/boot_perf_s4_cold.json`). So **a garage-only mode removes rows; it is not a new engine**:

| step (B9 table) | garage-only | why |
|---|---|---|
| treeBins | off | the forest's models |
| aircraft, garage, editor, seed | **kept** | the editor and its aeroplane |
| world, town, parking, trees, ring, settle | off | the world |
| parked (the parked cook) | off | the world's aeroplanes |
| snapshot, spec | kept (M1); **lazy** on a phone (M2) | the flown model is a roll-out's |
| bake (C4a flown bake, 2048² atlas) | off | roll-out only; the computer does it |
| restore (the certificate) | kept | the plaque |
| images, upload, worldCompile, frames, craft | off | the world's pictures and programs |
| compile, firstFrame | kept | the shed's programs |
| recheck (the aircraft's keyed steps re-planned) | kept, **re-planning nothing** | with bake and craft out it would run the flown bake (§1.3) |
| sim worker prewarm (after the boot) | off | flight |
| the island download (ISLAND_LOADER, 37.3 MB; raster 5.6-19.5 MB) | **never fetched** | `?world=none` in the prototype; a real mode skips the loader |

### 1.3 Measured: the garage without the world (node, prototype)

`tools/perf/mobile_garage_node.js --mode garage` applies the table to app.js as a source transform **in the rig
only**. It wraps `vm.runInContext`; the ten replacements must each match exactly once, or the rig stops. It then
boots dev.html with `?world=none` on the validated builds. Tree: train 30 + RELEASE-FAST (G1450) + SOFT-GPU (G1460),
merged locally, unpushed: the garage A0 is about to have. The rig ran on the cloud's 4 cores, one run at a time.

| run (node, 4 cores, one at a time) | boot (real s) | boot steps run | read from disk (MB) | heap + ArrayBuffers after GC (MB) | GL programs linked | page errors |
|---|---:|---:|---:|---:|---:|---:|
| full / Cub | 295.1 | 21 | 229.6 | 827.5 + 2027.6 = **2855** | 406 | 53 (the impostor bakes' blank reads: the harness has no pixels) |
| **garage-only / Cub** | **33.1** | 8 | **43.2** | 208.7 + 266.0 = **475** | 127 | **0** |
| full / metal Cessna | 302.9 | 21 | 233.5 | 861.5 + 2052.7 = **2914** | 406 | 53 (same) |
| **garage-only / metal** | **37.1** | 9 | **47.1** | 240.8 + 292.4 = **533** | 123 | **0** |

"Read" means the page's fetches and image loads, measured on disk. The page's own scripts are not counted (dev.html's are about 12.5 MB, see §1.4). By kind, the full Cub reads world 54.4 + geo 50.7 + tex 82.5 MB. The garage-only Cub reads world 0, geo 10.6 and tex 26.7 MB. Where the full boot's time goes, in node: settle 119 s, world 35 s, bake 28 s, town 26 s, snapshot 17 s, ring 16 s and parking 16 s. The garage-only boot's longest steps are compile (6.3 s), aircraft (3.6 s), seed (3.5 s) and editor (3.4 s).

The drags (node real ms, median of 2 reps after a warm-up, 4 ticks each; `tick` = one input handler, `release` = change + pointerup):

| row | full Cub tick / release | garage-only Cub | full metal | garage-only metal | the release |
|---|---:|---:|---:|---:|---|
| wgSpan (wing span) | 137 / 343 | 112 / 354 | 139 / 463 | 128 / 414 | planned (RELEASE-FAST) |
| wgChord | 139 / 349 | 113 / 313 | 150 / 552 | 132 / 426 | planned |
| stSpan (tail) | 16 / 300 | 15 / 277 | 20 / 327 | 19 / 312 | planned |
| s1X (gear) | 127 / 384 | 109 / 283 | 122 / 339 | 112 / 280 | planned |
| paxLen (bay length) | 32 / 1573 | 36 / 1556 | 40 / 2410 | 30 / 2183 | whole ("a deformed drag") |
| halfW (fuselage width) | 24 / 1465 | 19 / 1080 | 44 / 2716 | 37 / 2199 | whole ("a deformed drag") |
| seatH (seat height) | 217 / 1081 | 190 / 872 | 315 / 1466 | 279 / 1578 | whole ("the crew moved in the drag") |

What it shows:
- **The garage-only boot works.** 0 page errors, the editor seeded, the drags preview and release exactly as in the
  full boot (the `CAGE_UI.release` reasons are the same).
- **The memory floor is about 6× lower:** 475-533 MB against 2.86-2.91 GB in the same harness. That is the
  same order as MEM-BUDGET's browser floor ("the garage up" ~414 MB on potato, *with* the island loaded); §1.4 has
  the browser's own number. The ArrayBuffers the world held (~1.75 GB) are simply never made.
- **Boot time and bytes fall by 5-9×.** The boot drops from ~300 s to 33-37 s in node (the box is ~1.6× faster).
  Bytes read fall from 230 MB to 43-47 MB, and GL programs from 406 to 123-127.
- **A drag costs the same in both modes,** a little less in garage-only (less GC pressure). The garage mode does not
  make sliders faster; GARAGE-INSTANT and RELEASE-FAST do. **The phone's worst feel will be the whole-build
  releases**: the cage rows (paxLen, halfW: 1.1-2.2 s in node, so ~0.7-1.4 s on the box and perhaps 3-6 s on a
  phone) and the crew rows (seatH). R19 (the release never blanks the view) and taking the cage rows into
  RELEASE-FAST's plan are the two answers. Box and phone numbers are A0's (§1.6).
- **The prototype's lesson:** the boot's last step (`recheck`) re-plans the aircraft's keyed steps. With `bake`
  and `craft` taken out, it ran the **flown bake** there: SwiftShader's first garage-only run spent 140 → 340 s
  in it (`swift_garage_cub_v1_recheck_baked.json`). A real garage mode must take the re-plan out too (the tenth
  replacement).

### 1.4 Measured: the same in a real browser (SwiftShader)

`tools/perf/mobile_garage_swift.js` drives headless Chromium on SwiftShader at the phone's viewport (412 × 915) with
Playwright. In garage mode it serves app.js through `page.route` with the same ten replacements. It records the heap
per boot step (CDP), the bytes on the wire by kind (CDP `encodedDataLength`; `_serve.js` does not compress, so these
are the bytes **before** GitHub Pages' gzip), and a still of the garage.

| run (SwiftShader, Chromium 141, the 'software' rung = potato) | bytes on the wire, uncompressed (MB) | of which | requests | JS heap peak (V8 + backing stores, MB) | after GC (MB) | programs | errors |
|---|---:|---|---:|---:|---:|---:|---:|
| full / Cub | **214.7** | tex 103.7, world 54.5, geo 43.1, scripts 12.5, audio 2.8 | 1,325 | **1,530** (at "upload") | 203 + 1,016 = **1,219** | 349 | 0 |
| **garage-only / Cub** | **57.8** | tex 33.8, scripts 12.5, geo 10.6, audio 2.8, **world 0** | 639 | **365** (at "first light") | 69 + 228 = **297** | 123 | 0 |
| (the first prototype, whose `recheck` ran the flown bake) | 58.0 | same | 641 | 560 | 73 + 457 = 530 | 126 | 0 |

- **The browser's garage-only peak is 365 MB: 4.2× below the full boot's 1,530 MB**, under the S20 FE's 700 MB
  budget (FRIENDLY-WELCOME-BUDGETS' "good smartphone") and the "pocket" phone's 400 MB. That is the JS side only.
  The GPU's share (textures, the shed's 6,402 draws' buffers) is the phone rig's PSS column to read (§1.6).
- **The wire.** 57.8 MB before Pages' compression. The 12.5 MB of scripts gzip to ~3-4 MB (index.html: 10.9 MB →
  3.6 MB gzip, 2.8 MB brotli). KTX2, JPEG and the binary geometry barely shrink. So a first visit is **~48 MB**: ~20 s
  at 20 Mbit/s on 4G, against ~85 s for the full game's ~205 MB. The shed's props are most of the garage's tex + geo;
  without them (§1.5, M2) the estimate is **~25-30 MB** (to measure in M2). After the first visit `sw.js` serves
  /media/ from its cache (content-hashed): ~0 MB.
- **Times on SwiftShader are not a phone's.** The garage-only boot took 364 s and the full one 417 s, because every
  frame and program link takes seconds in software. The garage-only boot's last 217 s were "the last pieces landing"
  (the shed's frames). Only bytes and memory are read off this table; the drag handlers (wgSpan 144 / 389 ms, stSpan
  18 / 270 ms garage-only; full 129 / 578 and 19 / 249) agree with node's.
- The still at the phone's size (`swift_garage_cub.jpg`, also `swift_today_editor_at_412px.jpg`) is today's desktop
  editor squeezed to 412 px: the columns cover the view (§2).

### 1.5 No garage on a phone: a black studio (the user's ruling, M2)

**The user (4 Oct):** *"Why not do a dedicated environment for phones? No garage, just studio black. Saves more, does
not take the experience away."* Agreed, and measured. The phone gets **no shed at all**: no room shell, props,
transmission glass, floor or outside (grass, sky, the door). The aeroplane stands in a pool of light on black, like a
product shot. It is lit by a key, a fill and a rim (directional lights, no shadow maps), shows reflections from a
**procedural studio environment** (softboxes, made once into a PMREM, no textures: so the metal Cessna still reads as
metal), and casts one soft contact shadow under the gear. The aeroplane itself is unchanged: the editor's meshes,
materials and livery. The subject of the garage is the aeroplane, and that is all the studio keeps.

**Measured (node, the Cub, garage-only).** `--studio-proxy` makes the shed's dressed assets answer 404 (props and
their LODs, the bench airframes, the floor, the grass, the wall photos, the crew's characters). It is a CRUDE proxy:
the room's procedural shell still builds, so a real studio saves more. `--census` lists every file read;
`node_census_*` and `node_scene_*` in the evidence hold the numbers.

| (node, Cub, garage-only) | the shed (today's garage) | studio proxy (shed assets 404, shell kept) |
|---|---:|---:|
| media read during the boot | **42.6 MB**: props tex 23.3 + geo 6.2 + LODs 2.3 + bench airframes 0.6; crew 4.6; floor / grass / photos 2.4; **the aeroplane's own 3.2** | **3.2 MB** (the aeroplane's: panel, skin, vessel, cabin) |
| boot (real s, node) | 31-36 | 22-25 |
| heap + ArrayBuffers after GC | 230 + 211 = **441 MB** | 214 + 109 = **323 MB** |
| the garage scene's visible meshes / triangles | room 871 / 858 k + aeroplane and crew 551 / 397 k | room shell 705 / 130 k + aeroplane 545 / 342 k |
| **one frame**: draws / triangles (the recording GL) | **7,021 / 6.13 M** | 6,564 / 2.83 M |

What the numbers say:
- **The bytes are the shed's.** 39 of the garage's 42.6 MB of media are the room's dressing and the crew. A studio
  reads **~3 MB of media**. With the scripts (~3-4 MB gzipped) a phone's first visit is **~7 MB instead of ~48**
  (~3 s on 4G).
- **The frame is the shed's passes.** 1,423 visible meshes become 7,021 draws because each is drawn ~5 times: the
  shed's shadow-casting lamps (each shadow map redraws the casters) and the glass's transmission pre-pass. A studio
  with no shadow maps and no transmission draws each mesh once, so **≈ the aeroplane's ~545 draws and ~0.35 M
  triangles**. That is under the S20 FE's 0.6 M triangles, and nearer its 300-draw budget than anything the shed
  allows (the flown model's folding, C4b 261 → 90, is the lever if 545 is too many).
- **The heap drops with the dressing** (−118 MB with the shell still standing). The browser's garage-only peak of
  365 MB (§1.4) should land near or under 300 MB in a studio. To measure in M2.
- **It does not take the experience away.** On a phone the experience is the aeroplane taking shape under your
  thumb. The shed is the desktop's place, and the world is the desktop's reward.

| item | on a phone (the studio) |
|---|---|
| the shed (shell, props, glass, floor, outside, lamps) | **none**: black, a pool of light on the floor |
| lighting | key + fill + rim, directional, **no shadow maps**; one contact shadow under the gear |
| reflections | a procedural studio PMREM (made once, no textures; SOFT-GPU's sky-probe NaN on SwiftShader says to test it in the software rung) |
| AA / resolution | canvas MSAA off, pixel ratio ≤ 1.5 (a 412 × 330 view at 1.5 = 0.31 MP) |
| the crew | **not loaded** (4.6 MB); their seat points come from the spec, not the meshes. To verify: GATE INSTANT holds the crew's points, and the tank layer reads them |
| the flown bake, the snapshot | never (a roll-out's; the link carries the spec) |
| subdivision | level 2 as everywhere (level 1 as a view LOD stays a later lever) |
| inspector readouts | the bench tab only, on demand, in its worker |
| expert dials (materials lab, energy) | the expert tier, off unless asked |
| reference plane | the blueprint image only, in v1 (REF on the view rail) |
| sound | lazy (the garage boot fetches 2.8 MB of audio it never plays in the shed) |

**One trunk:** the studio is a **scene profile of the same code**, not a phone file. It is offered on the desktop
too, as a "studio" mood beside the shed's, so every release's desktop gates exercise it (§6).

A slider tick on the phone is GARAGE-INSTANT's preview path. It keys on `pointerdown` on the row, so a touch drag
takes it (§2.4). On the box a tick is 5-25 ms of handler and a release 240-520 ms (RELEASE-FAST cuts wing, tail and
gear releases to an estimated 50-130 ms). **On a phone, multiply by ~3-5 (to measure).** A release near 1-2 s on the
cage rows (paxLen, halfW, seatH) would be the phone's worst feel. R19 (§2.6) hides it behind the preview: the release keeps
the last preview on screen until the exact build lands.

### 1.6 The phone rig (A0, the box, the S20 FE)

`tools/perf/mobile_phone_cdp.js` needs no dependencies: node ≥ 22 (global WebSocket and fetch) and adb.

```
# once: USB debugging on, Chrome open on the phone; the tree served on the box and reversed to the phone
node tools/_serve.js 8700 D:/Dev/DeGaRoR.github.io
adb reverse tcp:8700 tcp:8700
# today's game on potato (the "try anyway" path), the Cub, warm (run it twice; the first one warms):
node tools/perf/mobile_phone_cdp.js --url "http://localhost:8700/flyDiy/index.html?gfx=potato" --build cub
# cold, the metal Cessna, no soak:
node tools/perf/mobile_phone_cdp.js --url "http://localhost:8700/flyDiy/index.html?gfx=potato" --build metal --cold --soak 0
# once M1 exists: the same rig on the garage-only entry
node tools/perf/mobile_phone_cdp.js --url "http://localhost:8700/flyDiy/index.html?mode=garage" --build cub --soak 10
```

It writes `tools/perf/phone_<build>_<stamp>.json` and prints:
- **boot**: navigation → BOOT gone, the step table, the JS heap per step (V8 + backing stores), and Chrome's renderer
  and GPU-process PSS from `dumpsys meminfo` every 5 s. **A renderer Android kills is caught**
  (`Inspector.targetCrashed`) and reported with the step it died in.
- **drag**: each `--rows` slider dragged the player's way in the page (pointerdown, 4 ticks, change + pointerup),
  timed to the handler and **to the second frame after it** (what the eye waits for).
- **frames**: 10 s of rAF intervals at rest, and 10 s while a one-finger orbit is injected
  (`Input.dispatchTouchEvent`): fps, p50 / p95 / p99, frames over 50 ms.
- **soak**: 10 minutes of a slider scrubbed (a tick every 100 ms, a release every 2 s). Every 30 s it records fps,
  battery temperature (`dumpsys battery`), the thermal status and HAL temperatures (`dumpsys thermalservice`, no
  root on Android 10+), and the heap. Throttling shows as fps falling while the temperature climbs.

Smoke-tested in the cloud against desktop headless Chromium (CDP, drag timing, frames, the soak loop). **The adb parts
(meminfo, thermals) and every phone number are the box's to take.** Today's game on the phone will likely die in the
world; that crash row (the step, the heap, the PSS) is the baseline M1 is measured against.

---

## 2. TOUCH-FIRST SLIDER RULES (for the revamp)

What the editor is today (the digest of `tools/_cage_ui.js` / `src/viewer/editor.js`):
- **Rows.** 649 parameters (SLIDER-TRUNK census: 488 sliders, 114 checkboxes, 38 selects, 15 steppers), claimed by 34
  parts under 8 assemblies. On a given aeroplane 213-223 sliders are visible (the GARAGE-INSTANT census), plus
  414-461 materials-lab and energy dials.
- **Row shape.** 30 px high, label 113 px (ellipsised, with the full text only in `title=`), an 11 px thumb on a 3 px
  track, and a typed value 64 px wide.
- **Layout.** Three columns: 280 + 390 + 250 px.
- **Touch support.** No `touch-action`, no `(pointer: coarse)` or `(hover: none)` rules.
- **Hover-only information.** The pin and frame highlight, the tree-to-geometry glow, full labels, the reset hint
  (double-click a label), and the design tiles' reasons.
- **Undo.** None (`design_flow.js:19`), apart from the starter's single slot.
- **At a phone's width today** (SwiftShader, 412 × 915: `reports/evidence/MOBILE-GARAGE/swift_today_editor_at_412px.jpg`),
  the properties and tree columns fill the whole screen and **the 3D view is not visible at all**. The desktop layout
  does not shrink to a phone; it needs its own chrome (§2.7).

### 2.1 Target sizes
- **R1.** Every target is **≥ 48 × 48 CSS px** (Material's 48 dp; WCAG 2.5.5 AAA asks 44). A drawn control may be
  smaller (the help ring is 28 px) only if its hit area is 48 (`::after { inset: -10px }`).
- **R2. A phone row has two lines.** A label line (28 px: label, help, value chip) sits over a control line (the scale
  with its 48 px knob hit area, and the steppers). Measured in the prototype: a slider row is **94 px**, a select
  (chips) 82 px, a toggle 56 px. A portrait sheet below a 330 px view is ~386 px, which is **about 4 slider rows**;
  landscape's is 305 px, about 3. That is why the tiers (R14) matter as much as the sizes. The desktop row stays
  30 px; the row model makes that difference, not a fork of the code.
- **R3.** Adjacent targets are ≥ 8 px apart (chips 6 px apart, plus their own padding).

### 2.2 Drag, tap-to-edit and steppers: all three, on every slider
- **R4. ONLY THE KNOB MOVES THE VALUE** (the user's ruling, 2026-10-04: *"move sliders only by dragging the
  [knob], NOT by touching the position on the scale, otherwise it conflicts with simply scrolling through the slider
  list"*). The knob is drawn 26 px with a **48 px hit area** (R1). A finger that lands anywhere else on the scale
  (track, fill, ticks) **does nothing to the value**, whatever its direction: the sheet scrolls. Native
  `<input type=range>` jumps to the touched position and grabs the gesture, which is why the touch renderer draws its
  own scale.
- **R5. The knob takes the finger at once, the scale never does.** The knob has `touch-action: none` and captures the
  pointer on `pointerdown`, so no direction guessing is needed. The scale and the row have `touch-action: pan-y` and
  no pointer listener. The knob's drag is **relative**: the value moves by the finger's travel (the full range over
  the scale's width) and never jumps to where the finger pressed. A 550-row sheet scrolls without editing anything,
  even when every swipe starts on a slider. The cost is a 48 px square per row (the knob's hit area) from which a
  swipe drags the knob instead of scrolling. A vertical swipe there moves nothing, and the list scrolls from
  everywhere else.
  Checked on the prototype with CDP touch events (`reports/evidence/MOBILE-GARAGE/rowkit_touch_check.txt`): a tap,
  a horizontal drag and a vertical swipe on the scale leave the value at 1.60 m, and the vertical swipe scrolls the
  sheet (300 → 394 px). A drag from the knob moves it to 1.85 m and opens one undo entry.
- **R6. − / + steppers** (48 px) move one `step`; held, they repeat (400 ms, then every 80 ms). A held run is **one**
  undo entry and **one** release.
- **R7. Tap the value chip to type.** A decimal keypad (`inputmode="decimal"`), clamped and snapped like today's
  `v_<key>`. Enter commits; Escape and blur keep or restore.
- **R8.** Checkboxes become toggles. Selects become **chips** (or a bottom sheet past 6 options). Steppers (integer,
  ≤ 8 stops) become chips. The widget is **still inferred from the range**, as `_cage_ui.js:2148` does.

### 2.3 Coarse and fine on a small screen
- **R9. Fine = press and hold the knob 0.35 s still, then drag:** ×0.1 gain, shown by an amber knob and "fine ×0.1". It needs
  no second finger and no mode button.
- **R10. Detents.** Named values (the archetype's, the loaded design's, the stock base's) pull within 2 % of the
  range in coarse mode, and not in fine. This replaces double-click-to-reset on a phone, together with "reset" in the
  row's ⋯ menu.
- **R11.** A **live bubble above the finger** shows the value while dragging: the finger hides the knob.
- At 412 CSS px, a span row (6.5-18 m, step 0.1, 115 steps) has a scale ~260 px wide: **2.3 px per step coarse,
  23 px per step fine**. A finger's ~7 mm (~45 px) contact patch cannot hit 2.3 px. Fine and the steppers are
  therefore not optional. Typing is the fallback for an exact number.

### 2.4 The two events stay the editor's
- **R12. A touch drag is the same `tick` → `release` as a mouse drag.** GARAGE-INSTANT keys its previews on
  `pointerdown` on the row (`DRAG_ON`), `input` (`DRAG_TICK`) and `change` / `pointerup` (`dragSettle`). The touch
  knob emits exactly those (pointerdown on the knob = `DRAG_ON`). Steppers and typing emit `tick`s then one `release` (today's keyboard and typed path is a
  plain whole build, 200-260 ms on the box; the stepper's repeat must use the tick path or a held + costs a whole
  build every 80 ms).
- **R13. Ticks are paced to frames.** At most one tick per rAF; pointer moves in between are coalesced, keeping the
  last value. A phone's touch digitiser reports at 120-240 Hz, and every event building would starve the frame.

### 2.5 Grouping and progressive disclosure (the ~550 rows)
- **R14. Four levels, each one tap.**
  1. **design tab tiles** (the birth flow's ~25 choices: class, layout, engine family...)
  2. **assembly → part chips** (8 assemblies, 34 parts)
  3. **the part's TRUNK** (fitted / type / position / size, SLIDER-TRUNK) plus its *basic* rows
  4. **"N more rows · show"** (the *more* tier)

  *Expert* (today's `level:'expert'`, the materials lab, the energy dials, the polycount rows) is hidden on a phone
  unless "expert" is on in ⋯.
- **R15.** Today's fold rule (a group with ≤ 5 visible rows open, longer ones rolled) carries over unchanged: it is a
  rule, not stored state.
- **R16. Tap a part in the 3D view = select it** (today's 4 px / 500 ms tap rule, app.js:4706). The chips scroll to it
  and the sheet shows its trunk. **A long press (500 ms) on a part opens its sheet at full height.**
- Budget: a part's basic tier should be ≤ 8 rows (one screen). The largest parts (cowl 91, engine 73, main gear 50)
  need their basic tiers chosen by the revamp's per-slider review (SLIDER-TRUNK §"still owed"), not by a rule.

### 2.6 No hover-only information
- **R17.** Everything `title=` or hover says today becomes **visible or one tap away**:
  - the full label wraps on a phone, never ellipsised
  - help: an *i* button opens the row's one line under it
  - notes stay inline (amber)
  - the pin (the dot on the vertex the row moves) shows **while the row is being dragged** and for 1 s after, not on
    hover
  - tree-to-geometry glow: on chip press
  - design tiles' "why not" reasons: under the greyed tile on tap
- **R18.** A **gate** (a new GATE NOHOVER, node) lists every `title=`, `onmouseenter`, `pointerover` and `:hover`
  rule in the editor that carries information, and fails on any without a touch twin.
- **R19. The release never blanks the view.** While the exact build runs (RELEASE-FAST: 50-520 ms on the box, ~×4 on a
  phone), the last preview stays on screen and the value chip shows a thin progress ring. A frozen frame after
  letting go reads as "it broke".

### 2.7 Portrait and landscape
- **Portrait** (`mock_1_portrait.png`): top bar (name, Send) / **3D view 36 %** (330 px) with the three pre-plaque
  numbers / part chips / breadcrumb / the sheet / bottom bar (undo, redo, design · shape · finish, ⋯). Undo and the
  tabs sit in the thumb zone.
- **Landscape** (`mock_2_landscape.png`): left rail (tabs, undo) / 3D view / a 380 px sheet on the right, which is the
  desktop's 390 px column. A `@media (orientation)` rule chooses the layout; **the rows do not know which one they
  are in**.
- The desktop keeps its three columns. The row model is shared; the chrome around it is per form factor.

### 2.8 The 3D view's gestures vs a slider drag
- **R20. The view and the sheet never share a gesture.**
  - In the view: 1 finger orbits, 2 fingers pinch-zoom **and pan** (two-finger pan is new; pan is mouse-only today,
    app.js:4556), tap picks, double-tap frames the part.
  - In the sheet: any swipe scrolls, except one that starts on a knob, which drags that knob (R4).
  - The view has `touch-action: none`; the sheet has `pan-y`. A finger that starts in one stays in it until it lifts
    (pointer capture).
- **R21. No edit by dragging in the 3D view in v1** (no handle-dragging on the model). It is tempting, but on a small
  screen it fights the orbit. The pin (R17) shows *where*; the knob changes *how much*.

### 2.8b The tree is the aeroplane: the reference plane and the hangar leave it
- **R24 (the user's ruling, 2026-10-04): the parts tree drops its two non-aeroplane roots.** *"Take out the
  reference plane and hangar entries from the parts tree to simplify, and have those in the rails, or at the top."*
  - Today the tree's top level is a registry of peers (`CAGE_TREE_ROOTS`, `editor.js:173-330`): `craft` ("My Plane",
    the 8 assemblies), `ref` ("Reference plane", with G573's two rows, 3D model and Blueprint) and `shed`
    ("The shed", the hangar group's rows).
  - **The tree.** It holds only the aeroplane: its heading is the build's name, and selecting the heading shows every
    row, as the craft root does now. Its rows are the 8 assemblies (Design & construction, Fuselage, Wings, Tail,
    Control hardware, Powerplant, Running gear, Build) and their parts.
  - **Desktop.** The reference plane and the hangar become **entries on the view's icon rail** (the G78 rail:
    camera, display, night, explode, ...), each with its own flyout. They are display and room state, never in the
    spec, and the rail is where "how you look" lives. The reference flyout keeps 3D model / Blueprint as a segmented
    switch. The hangar flyout carries the shed's size, parts and mood, and the *night* flyout keeps borrowing the
    light rows. (The ribbon at the top is the alternative the user allowed; the rail keeps the ribbon for the build's
    verbs.)
  - **Phone.** The same two entries sit on the 3D view's own rail (REF, ⌂: `mock_1_portrait.png`; the left rail in
    landscape: `mock_2_landscape.png`), each opening a bottom sheet. In v1 a phone's REF offers the blueprint image
    only (the 3D reference models are large payloads). There is no hangar on a phone (§1.5): the phone rail's second
    entry is ☀, the studio light (the key's angle, the mood).
  - **The mechanism.** The registry gains `place: 'tree' | 'rail' | 'top'`; `ref` and `shed` declare `'rail'`, and
    the rail renders a root's `panel()` as its flyout. A stored selection of `ref`, `ref.model`, `ref.bp` or `shed`
    (`flydiy.edPart`) migrates to `craft`. GATE VIEW's label finds keep working (the rows are the same elements,
    moved). Sketch: `mock_5_desktop_tree_rail.png` (`desktop.html`).

### 2.9 Undo, and the row model built once
- **R22. Undo / redo, one entry per gesture.** A drag's ticks fold into its press; a held stepper run is one entry; a
  typed value is one entry. Entries are `{key, from, to}` on the spec's P. They are tiny: 1,000 entries would be
  ~40 KB, kept in memory for the session plus the last 50 in `flydiy.undo`. The starter's single-slot undo
  (`design_flow.js:68`) becomes one entry that carries many keys. This is a desktop win as much as a phone one: the
  project has no undo today.
- **R23. ONE ROW MODEL** (prototype: `futureDesigns/mobile-garage/rowkit.js`, live in `rowmodel.html`). Today's tuple
  `[key, label, lo, hi, step, names?, opts?]` stays, and `opts` gains:

  | field | default (from today's tuple) | used by |
  |---|---|---|
  | `unit` | from `dim` ('m' / 'len'); else none | both: value chip and bubble |
  | `group` | from the part table's `groups` (`_cage_parts.js`) | both: headings |
  | `tier` | `'expert'` if `level:'expert'`, else `'basic'` (the revamp promotes / demotes rows) | phone: disclosure |
  | `fine` | `step / 10` | touch: fine drag |
  | `detents` | the archetype's and the loaded design's value (BASELINE) | touch: pull; desk: a tick mark |
  | `help` | none (today's `title=` text) | both: one line, no hover |
  | `cost` | measured (`'preview'` / `'whole'`, GARAGE-INSTANT's census) | both: whether to expect a pause |

  **The renderers:**
  - `mkRow` becomes a **descriptor** plus two renderers, `deskRow` (today's 30 px row, unchanged behaviour) and
    `touchRow` (§2.1-2.4).
  - Both emit `tick(key, v)` and `release(key, v)`. Neither knows the part tables, the build or the undo stack.
  - The DOM contract (`div.r[data-k]`, `#p_<key>` holding the value) is kept for the gates. On touch, `#p_<key>`
    becomes a hidden `<input type=range>` carrying the value and its events, so GATE INSTANT and the census drive
    both renderers the same way.

  **What the revamp must decide NOW, so mobile is not a rewrite later:**
  1. **Rows are data, rendered by a function of (descriptor, P, mode)**, never hand-built DOM per part.
  2. **`tier` on every row**, decided in the per-slider review (SLIDER-TRUNK's owed pass), with a basic tier of
     ≤ 8 rows per part.
  3. **`help` text instead of `title=`**: write the line once and both renderers show it.
  4. **The edit events are `tick` / `release` from any widget**: steppers and typing included, so keyboard, stepper
     and typed edits take the preview path too.
  5. **An undo history** at the `GARAGE_SPEC.update` boundary, one entry per gesture.
  6. **No information only in hover**: every new hover affordance needs a tap twin (R17-R18).
  7. **The knob is the slider's only handle on touch** (R4-R5): no jump-to-position, so the revamp's slider is
     its own element (not a styled native range on a phone) and the scale stays scrollable.
  8. **Sizes come from CSS tokens** (`--row`, `--tap`, `--lab`), switched by `(pointer: coarse)`. No pixel
     constants in JS. (`layoutRight()`'s 390 / 250 / 46 are the ones to move.)
  9. **The tree holds only the aeroplane** (R24): the reference plane and the hangar are rail entries
     (`CAGE_TREE_ROOTS` `place`), on the desktop and the phone alike.
 10. **The phone is a profile, not a product** (§6): no device branches in the revamp's code. Anything that
     differs on a phone asks the profile table, and the profile may only subtract.

  The layout chrome (chips vs tree, sheet vs column, rail vs ribbon) can come in M4 without touching a row.

---

## 3. PHONE → COMPUTER: HOW A BUILD TRAVELS

### 3.1 What travels

A build is the envelope `{what:'flydiy-build', v, name, spec, plaque, log, images?}` (garage.js:610-619). The spec is
**numbers and short strings**. `spec.cage` is ~70 % of it (G377: every slider row is written, not just the
deviations, because template defaults move). The only blobs are up to two livery PNG data-URLs (`images`, ≤ 512 px
each, G207), and none of the stock builds carries one. Reference planes and blueprints never enter a save. The
computer rebuilds everything else from the spec (the editor's join, the snapshot, the bench, the flown bake). **No
mesh ever travels.**

Measured (node, `tools/perf/mobile_share_size.js` → `share_size.json`):

| build | envelope | spec (min JSON) | gzip -9 | deflate-raw | brotli | **base64url (deflate-raw)** | cage share |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cub (validated) | 19,394 | 19,305 | 7,177 | 7,159 | 6,220 | **9,546** | 73 % |
| Jodel | 20,043 | 19,422 | 7,206 | 7,188 | 6,219 | **9,584** | 73 % |
| Cessna 172 | 21,137 | 20,001 | 7,581 | 7,563 | 6,609 | **10,084** | 70 % |
| metal Cessna | 20,801 | 19,793 | 7,453 | 7,435 | 6,501 | **9,914** | 71 % |
| Cessna floats | 20,522 | 19,514 | 7,377 | 7,359 | 6,413 | **9,812** | 72 % |
| twin-582 (v7 fixture) | 8,745 | 5,540 | 2,549 | 2,531 | 2,270 | **3,375** | 33 % |

**The frozen base + patch.** The user's phone build almost always starts from a card (a stock design or an
archetype) and moves some rows. As a patch over a **frozen** copy of that card (`{b: <base id>, h: <content hash>,
v, n: name, p: [[path, value], ...]}`):

| rows moved | patch JSON | deflate-raw | **base64url** | QR (byte mode, level L) |
|---:|---:|---:|---:|---|
| 5 | 167 | 129 | **172** | v15 or lower |
| 20 | 493 | 291 | **388** | v15 (the real 20-row link, with its URL: 401 chars → **v13**, `qr_patch20.svg`) |
| 60 | 1,500 | 678 | **904** | v25 |
| 150 | 3,654 | 1,438 | **1,918** | v40 only (print size) |
| whole Cub | n/a | 7,159 | **9,546** (9,586 with the URL) | **does not fit** (v40-L holds 2,953 B) |

The base must be **frozen** (a content-addressed copy shipped with the game: `media/bases/<hash>.json`), never "the
current default". Defaults move; that is the exact reason G377 stopped saving slim cages. A live archetype re-baked by
`designBake` on another code version gives another spec (the digest's version-skew note). A link whose base the
receiver does not have falls back to "please send the whole build" (the `0.` form).

### 3.2 The transports, weighed

| transport | how | for | against | verdict |
|---|---|---|---|---|
| **today's .json file** | ribbon Export / Import (`#gExport`, `#gFile`, drop on the rack) | exists; whole envelope incl. livery images; offline | moving a file between a phone and a computer is the hard part (mail it to yourself, a cloud drive, a cable) | **keep**: the fallback, and the only way for builds with images |
| **share link** (`#build=` fragment) | `location.hash` read before the boot; deflate-raw + base64url (`CompressionStream('deflate-raw')`: Chrome 103+, Safari 16.4+, Firefox 113+; the island loader already uses `DecompressionStream`) | no server (a fragment is never sent to Pages); a link is something a phone already moves well (mail, chat, notes); 0.2-10 k chars | a whole-spec link is long (~9.6 k) and some chats cut long links; livery images do not fit | **v1** |
| **QR** | the phone shows a QR of the link; the computer's webcam or another phone scans it | no account, no cable, instant | the computer needs a camera and a scanner in the page (`BarcodeDetector` is Chromium-only and not on desktop Windows, so a JS decoder, ~40 KB); only patch links fit (≤ ~60 rows) | **v1.1**: shown when the link fits v25 |
| **Web Share API** (`navigator.share({title, url})`) | the phone's share sheet: Gmail, WhatsApp, Notes, Nearby Share, AirDrop | the phone's own way of moving things; files too (`navigator.share({files})`, Chrome Android and Safari) for builds with images | needs a user gesture (the Send button is one); desktop support varies (fine: the phone shares, the computer opens) | **v1** (the transport the link rides on) |
| **cloud: the user's Google Drive** | Google Identity Services in the page, `drive.file` / appDataFolder scope, a "flyDiy" folder | real sync, both ways, many builds | a Google Cloud project, an OAuth consent screen and its review before strangers can use it, tokens in a static page, the user's data in a store we answer for | **not v1**; revisit if people other than the user play |
| **cloud: a GitHub gist** | the gists API | public builds, history | needs a token: device flow or a personal token pasted in; no anonymous gists since 2018 | **no** |
| **cloud: nothing (Pages static)** | n/a | nothing to run, nothing to secure, no data held | no sync | **v1 is this**: the link *is* the store |

### 3.3 Recommendation for v1

**The share link, through the share sheet.**

- **Payload.** `https://degaror.github.io/flyDiy/#build=1.<b64url>` is a patch over a frozen base. `#build=0.<b64url>`
  is a whole spec, used when the build has no known base or the patch would be larger. The JSON is
  `{fmt:1, b, h, v: GEN_SPEC_V, core: FLYDIY_CORE_SHA, n, p | spec}`. `plaque` and `log` stay home (a test result is
  not a design input, G63), and so do `images` (a build with images offers the file share instead).
- **The phone's Send button.**
  1. Commit (today's `commit()`).
  2. Make the payload.
  3. `navigator.share({title: 'flyDiy: ' + name, url})`.
  4. Fallbacks: **Copy link**; **QR** when it fits v25; **Save .json** (today's export).
  5. Mark the slot "sent" with the time.
- **The computer.**
  - It reads `location.hash` **before the welcome** (a link from a phone opened on the computer is the expected case).
  - It runs the boot, then shows the **arrival card** (`mock_3_handoff.png` §6):
    1. Checked: format version, base found and hash equal, every value in range. This is today's import path,
       `genNormaliseSpec` → `genMigrateSpec` → `clampSpec`. A clamp is *reported*, not silent.
    2. Built in the garage (the editor's own build).
    3. The bench check (the shakedown, ~0.5 s).
    4. At roll-out: the flown bake (2048² atlas, ~2 s) and the world.
  - It opens as a **new slot** (`flydiy.build.<name>`), never over the user's current build. "Made on a newer flyDiy"
    is a warning, not a refusal.
  - Then it clears the hash (`history.replaceState`), so a reload does not import twice.
- **The same link works computer → computer and phone → phone**, and can be posted for a friend. It is a feature of
  the desktop game before the phone UI exists. That is why M5 can come early.
- **Security posture.** The payload is data only. It goes through the same normalise / migrate / clamp as a file; no
  code and no URLs are taken from it. Unknown keys are dropped by `genNormaliseSpec`. The decompression is capped
  (refuse > 256 KB inflated).

---

## 4. WHAT THE PHONE MAY NOT SEE

| feature | needs | the phone shows instead |
|---|---|---|
| taxi, roll-out, flight, the roll-out shot | the world (island, ground, town), the sim worker, the flown model | **"Fly it at home"**: the Send button where Roll out is, and the stand's place in the build card ("will roll out at HOME") |
| bench **test flight** (`flight`, "flown": a real circuit) | the world and the sim worker | "not yet flown": the plaque's flight row greyed, with "fly it at home to earn it" |
| bench **crosswind** (`xwind`) | `makeWorld()` in bench_worker | greyed, "on your computer" |
| bench **sandbag rig** (`load`, live, its worker) | no world, but a worker run of seconds | **v2** (it could run; its heat and time on a phone are to be measured first) |
| bench **check** (`shake`: the shakedown) | **no world**: `genShakedown` on a flat plane, pure core JS | **shown**: mass, Vs, cruise, best L/D, climb, take-off run, static margin, stance, `flyableCircuit` (a verdict) |
| density altitude (`dalt`) | none | shown |
| the hydro test (floats) | water | greyed |
| the flown bake, the world look | the GPU and the world | nothing; the garage's own look is enough on a phone |

**How the hand-off feels.**
1. On the phone, the bench tab shows the plaque as **"bench-checked, not yet flown"**, with the flyable-circuit
   verdict in plain words ("likely flyable: stable trim, take-off 142 m, climb 3.1 m/s").
2. The Send button carries the build away. The slot says "sent 18:42".
3. At home, the link opens the game *on that aeroplane*: the arrival card, then the garage with the build on the
   stand and **Roll out & fly** pulsing (as G1064's FLY pulse does after a setup change).
4. The first flight earns the plaque on the computer. Nothing flows back to the phone in v1. The phone's slot is a
   draft, and the computer's is the aeroplane.

---

## 5. THE PHASED PLAN

The G-blocks are suggestions for A0 to assign. Each session ends with its own HANDOVER entry, gates green, and its
numbers.

| session | scope | G-block | gates | where |
|---|---|---|---|---|
| **M3 ROW-MODEL** (inside the slider revamp; **first**) | the descriptor fields (§2.9 table); the tree holds only the aeroplane, with the reference plane and the hangar on the rail (R24); `mkRow` → descriptor + `deskRow` (pixel-identical to today); `tier` / `help` written during the per-slider review; the undo history at `GARAGE_SPEC.update` (one entry per gesture, ⌘Z / Ctrl+Z, ribbon arrows); steppers and typing on the tick path | G1520-G1529 | GATE PARTS (every row claimed), GATE INSTANT (unchanged), **new GATE ROWS** (every row has tier / group; ≤ 8 basic per part; no `title=` without `help`; the tree's roots are `craft` alone), **new GATE UNDO** (undo × N returns the boot hash) | cloud (node) + box (the look) |
| **M1 GARAGE-MODE** | **the PROFILES table** (§6: the phone as a declared, subtract-only profile of the trunk) and `?mode=garage` as its first entry: the boot's world rows off (§1.2 table), the recheck re-planning nothing, no ISLAND_LOADER fetch, no sim worker; on a desktop the roll-out builds the world lazily (the LOADING-S3 path, kept beside B9's one loading); the mode is **not** shown on a desktop unless asked; **GATE MOBILE's skeleton** in the release battery from this session on | G1530-G1534 | GATE ROUNDTRIP (both modes), GATE INSTANT, **new GATE MOBILE** (§6; first rows: no world step ran, 0 island bytes, heap ≤ the measured floor + 10 %, the same resolved-spec hash as the desktop boot), FRAMECOST (garage profile unchanged) | cloud (node), then box: heap_steps + the phone rig |
| **M5 SHARE** | `#build=` links (patch over frozen bases + whole spec), `media/bases/` content-addressed, the arrival card, Send (Web Share, copy, QR when it fits), new-slot import, hash cleared | G1535-G1539 | **new GATE SHARE** (node: export → link → import byte-identical spec on the 5 validated builds, patch and whole; a corrupted / oversized / future-version link refused or warned; a 60-row patch ≤ 1.3 KB); GATE BUILD, GATE SAVE | cloud |
| **M2 PHONE-STUDIO** | the black studio (§1.5): a scene profile beside the shed (no room, key / fill / rim without shadow maps, a procedural studio PMREM, a contact shadow), the shed's assets and the crew never fetched, pixel ratio ≤ 1.5, readouts on demand, audio lazy; **also a desktop "studio" mood**; the welcome's phone gate offers "Build on this phone" | G1540-G1544 | GATE GFX (no desktop preset changes), FRAMECOST's garage profile **in the studio** (draws ≤ 600, triangles ≤ 0.6 M, 0 shadow passes), GATE SOFTGPU (the studio PMREM on the software rung), GATE MOBILE's studio rows | cloud + **phone** (heap ≤ 700 MB, no kill, drag drawn ≤ 150 ms p50) |
| **M4 TOUCH-UI** | `touchRow` (§2.1-2.4), portrait and landscape chrome (chips, sheet, rail, bottom bar), view gestures (two-finger pan, long-press), no-hover twins | G1545-G1554 | **new GATE NOHOVER** (R18), GATE INSTANT driven through the touch renderer, a Playwright touch run at 412 × 915 (hasTouch) | cloud + phone (the user's thumb) |
| **M6 PHONE-SOAK** | the rig's 10-min soak on the S20 FE (heat, fps, heap), the cold load on 4G-like throttling, and **an iPhone** (Safari: borrowed, or a cloud device farm) | G1555-G1559 | the numbers vs FRIENDLY-WELCOME-BUDGETS' good-smartphone row | box + phone |

### 5.1 Risks

- **Memory.** The garage-only floor (§1.3-1.4) must fit 700 MB on the S20 FE *with* the GPU's share. The shed is most
  of the bytes and, through its passes, of the draws, and the studio removes it (§1.5). M2 measures on the phone
  before M4 builds UI on top.
- **Drift: two products where there should be one.** A phone UI maintained by hand next to the desktop's falls behind
  within two trains: a new part, row or archetype lands on the desktop, and the phone lacks it or breaks on it. §6
  is the contract against that, and GATE MOBILE runs it at every release.
- **Heat.** A train ride is 30-60 minutes of scrubbing, and a release is a few hundred ms of full CPU. The soak (§1.6)
  says whether the S20 FE throttles. The levers: ticks paced to frames (R13), the render loop paused when nothing
  moves (the garage redraws every frame today), the 30 fps cap kept.
- **Safari / iOS.**
  - WebGL2: since iOS 15, OK.
  - Texture formats: the KTX2 transcoder must target ASTC / ETC2, not BC7 (three's KTX2Loader picks per device: to
    verify).
  - Memory: Safari kills a tab well below desktop Chrome's limits, and there is no `performance.memory` and no
    `userAgentData`.
  - **Script-writable storage is evicted after 7 days without a visit (ITP).** A build left on an iPhone for a
    week can vanish. Send it, or install the page to the home screen.
  - The welcome must treat iPadOS (which reports as a Mac) by its touch points.
  - Cloud sessions cannot test Safari at all.
- **Touch precision.** 2.3 px per step coarse on a 412 px screen (§2.3). Fine mode, steppers and typing are the answer,
  and the user's thumb is the test (M4).
- **The revamp's timing.** If the revamp ships rows as hand-built DOM with hover-only help and no `tier`, mobile becomes
  a second editor. The ten decisions in §2.9 cost the revamp little now and save the rewrite.
- **Two boots.** B9 made one loading on purpose (no world builds under the player's nose). A garage mode brings back
  "the first roll-out builds the world" on any computer that opens it. Keep the mode out of the desktop's default path
  (only a phone, or `?mode=garage`), and the link's arrival on a computer boots the **full** game.
- **Version skew.** A phone holding an old cached page sends a spec from an older `GEN_SPEC_V`. The migrators handle
  that, and the arrival card says so. A newer phone and an older computer: warn, open with defaults for unknown rows.

---

## 6. ONE TRUNK: THE PHONE IS DERIVED FROM THE DESKTOP, AUTOMATICALLY, AT EVERY RELEASE

**The user (4 Oct), a warning to maintenance:** *"We should maintain a single trunk; the mobile experience has to
derive entirely from the desktop trunk, automatically at each release."* This is the contract every MOBILE session
works under.

**6.1 What "one trunk" means here.**
- **One page, one build, one deploy.** The phone loads the same `index.html` that `tools/build.js` makes for the
  desktop, from the same Pages origin, through the same `sw.js`. There is no `mobile.html`, no second bundle, no
  mobile branch and no separate release step. A train that ships the desktop ships the phone.
- **One source for every row, part, archetype and material.** The phone's controls are rendered from the same row
  descriptors (§2.9) by the touch renderer. Its tree is the same part table (`_cage_parts.js`). Its design tiles are
  the same declaration (`_cage_design.js`). Its aeroplane is built by the same editor pipeline. **No list of rows,
  parts or presets exists only for the phone.** A row added on the desktop appears on the phone at the next release.
  If it has no `tier`, it lands in "more", reachable rather than lost.
- **The phone is a PROFILE, and a profile only subtracts.** One table, beside `GFX.PRESETS` and the software rung
  (SOFT-GPU's `GFX.soft()` is the precedent), declares the phone as switches over the trunk:

  ```
  PROFILES.phone = {
    boot:   'garage',        // the world's boot rows off (§1.2), the recheck re-planning nothing
    scene:  'studio',        // the black studio (§1.5) - a scene profile the desktop also offers
    ui:     'touch',         // the touch renderer + the phone chrome (§2.7) over the SAME descriptors
    tiers:  'basic',         // the disclosure start point; 'more' / 'expert' one tap away, never removed
    fly:    'send',          // Roll out -> Send to computer (§3); the bench check stays
    assets: ['crew', 'shed', 'audio:lazy'],   // never fetched
  }
  ```

  Every switch removes, defers or re-renders something the desktop has. **None adds a feature the desktop lacks.** The
  three things the phone shows first all exist on the desktop too:
  - the share link (computer to computer)
  - undo (§2.9, R22)
  - the studio (a desktop mood)

  So every one of them is exercised by the desktop's own gates and play.
- **No ad-hoc phone branches.** Code asks the profile (`PROFILE.is('scene', 'studio')`), never the device
  (`/Android/.test(navigator.userAgent)`, `innerWidth < 600`). Device detection lives in one place (welcome.js,
  which picks the profile, as it picks the preset today). A lint row in GATE MOBILE fails on any user-agent,
  `userAgentData`, `pointer: coarse` or width test outside welcome.js and the profile table.
- **CSS from tokens.** The phone's sizes are the same stylesheet switched by `(pointer: coarse)` tokens (`--row`,
  `--tap`, §2.9 decision 8), not a second stylesheet.

**6.2 "Automatically at each release": GATE MOBILE in the release battery.** It is node-only (the page in node), so it
runs in every cloud session and every train like FRAMECOST and INSTANT. Its rows grow with the sessions (M1 first):
1. **The phone profile boots on the train's own tree.** `?mode=garage` plus the studio and the touch UI on the five
   validated builds: 0 page errors, no world step ran, 0 island / world / shed / crew bytes.
2. **Same aeroplane by construction.** The resolved spec's hash after the phone boot equals the desktop boot's on
   every validated build. The phone builds the same aeroplane, not an approximation.
3. **Every desktop row is reachable on the phone.** Every row in the part table renders in the touch renderer at some
   tier, and none is desktop-only. A new row with no `tier` lands in "more" and the gate prints it as a reminder.
   Rows hidden by design (bench instruments: `subsurf`, G106.1) are named in one exemption list.
4. **The edit path is the desktop's.** GATE INSTANT's rows driven through the touch renderer: knob drag → ticks →
   release equals the long-way build, byte for byte (the same fingerprint).
5. **The hand-off round-trips.** A phone build → `#build=` link → desktop import gives the same spec (GATE SHARE's
   rows, from the phone profile).
6. **Budgets, ratcheted like FRAMECOST.** In the studio: heap after GC, bytes read, the frame's draws and triangles,
   0 shadow passes. A train that grows them past the ratchet fails, the same way a desktop frame-cost regression does.
7. **No device branches** (the lint row above).

A train is green only with GATE MOBILE green. The phone is then not a port to keep up: it is the desktop trunk, run
under a profile and checked at every release.

**6.3 What stays per form factor (and is allowed to).** The chrome around the rows:
- **desktop:** three columns, the ribbon, the icon rail
- **phone:** chips, sheet, view rail, bottom bar
- **both:** the pixel ratio and the gestures (§2.8)

This chrome is small, it renders the same descriptors, and GATE MOBILE row 3 keeps it honest: a part the phone's
chrome cannot reach fails the train.

---

## 7. FILES OF THIS STUDY

- `futureDesigns/mobile-garage/`:
  - mock-ups: `index.html`, `portrait.html`, `landscape.html`, `handoff.html`, `rowmodel.html`, `desktop.html` (the tree and the rail, R24)
  - the prototype renderer: `rowkit.js`
  - the wing's real rows in the proposed descriptor: `mock_rows.js`
  - `mock.css` and a real QR: `qr_patch20.svg`
- `tools/perf/mobile_share_size.js`: the build on the wire (node) → `reports/evidence/MOBILE-GARAGE/share_size.json`,
  `share_link_example.txt`.
- `tools/perf/mobile_garage_node.js`: full vs garage-only in the page in node (boot steps, bytes, heap, drags, one
  frame's draws and the scene's meshes; `--census` lists every file read; `--studio-proxy` 404s the shed's assets) →
  `node_<mode>_<build>.json`, `node_census_*.json`, `node_scene_*.json`.
- `tools/perf/mobile_garage_swift.js`: the same in headless Chromium on SwiftShader (heap, wire bytes, a still) →
  `swift_<mode>_<build>.json/.jpg`.
- `tools/perf/mobile_phone_cdp.js`: the S20 FE rig (A0, adb + CDP): boot, drag, frames, a 10-min soak.
- `reports/evidence/MOBILE-GARAGE/`: the mock-up screenshots (`mock_*.png`), the measurements.
