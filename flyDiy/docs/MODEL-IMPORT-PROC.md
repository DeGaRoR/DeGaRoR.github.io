# MODEL-IMPORT-PROC — adding a 3D model to a garage-flight aircraft

Editable working procedure. Executed once for the PA-18 → Super Cub fiche
(reference implementation, including the full interior); follow it for the
drone / DC-3 / Jodel / C172 / Chinook.
Companion: SKIN-PROC.md (how the runtime works), tools/model_prep.py (the
bake), tools/models/<key>.py (per-model config), tools/model_inspect.py
(the measuring tool).

Ported from the flexbody branch 2026-08 with corrections; the original
described a hardcoded single-model bake and referenced a throwaway
inventory script that never existed — both replaced by real tooling.

---

## Step 0 — Source model requirements

- **Format**: OBJ + MTL + textures (FlightGear models are ideal: GPL, true
  scale, sensible part naming — helijah's hangar is a goldmine).
- **License**: record author + license in the config `credit` (the bake
  writes it into the payload header) AND add a visible credit + an entry in
  `flyDiy/CREDITS.md`. If the model exists under several license statements
  (the PA-18 is GPL per its Read-Me and CC-BY 4.0 per the author's
  Sketchfab listing), record all of them honestly and keep the source
  files in `assets/<key>/`.
- **Axes**: target convention is *nose −x, y up, z spanwise*. FlightGear/
  Blender exports usually match. Verify with `model_inspect.py` bounds —
  do NOT trust the file, measure. If rotated, add a fixed rotation in the
  bake (not yet needed, so not yet implemented).
- **Scale**: true meters. Check span/length against the real aircraft.
- **Home**: source files live in `flyDiy/assets/<key>/`.

## Step 1 — Inventory the parts

```
python tools/model_inspect.py assets/<key>/<model>.obj
```

One row per object: full name | short name | material | verts | faces |
bbox | center | size, plus per-material totals. Sort every object into:

| bucket | selected by | goes to | examples (PA-18) |
|---|---|---|---|
| exterior structure | object short names | `groups.skin` | fuselage, ailes, capot, structure, roues, cables |
| exterior glass | object short names | `groups.glass` | vitres (material `transparentExt`) |
| propeller | object short names | `groups.prop` | helice (spun visually from throttle) |
| control surfaces | (in skin) **+ `SURFACES` row** | sid tags | ailerons, profondeur, direction, volets, tailwheel |
| interior | **materials** | one group per material | planchet/interieur, seats, panel, 6 gauges, covers |

**Interior groups select by `usemtl`, not by object name**: `short()`
collapses `needle.002_needle.mesh.002` → `needle` across *different*
gauges — the material is the unambiguous boundary, and it is also the
texture boundary (one group = one texture bind). Per-instrument gauge
groups also preserve the option of future needle animation (per-group
sid tags, no format change).

Heuristics: gauge-texture materials (`*_asi.png` etc.) → one group per
instrument. `interior.png`, `seat.png`, `panel` → interior groups.
Untextured `transparent` → the translucent covers group. Ambiguously
named meshes (`trous`): scatter their bounds/three projections before
deciding — for the PA-18 it was exterior tube detail, worth keeping.

**Separation requirements for a new/edited model (e.g. authored in Blender):**
- each control surface = its own object, its own vertex island (no shared
  verts with the parent surface);
- fin+rudder or stab+elevator fused is workable via a hinge weight ramp
  (see Step 4) but separate objects are cleaner;
- wheels as separate objects (main wheels feed mount calibration; tailwheel
  can become a steering surface);
- one exterior texture atlas; interior on separate materials so the bake
  can group it per texture.

## Step 2 — Mount calibration (match to nodes)

The model mounts **rigidly in the body frame** (origin = mass CG, x aft,
y up, z LEFT). Calibrate the offset numerically, never by eye:

1. Node-side: build the sim, `reset(0)`, settle 10 s, then express the
   reference nodes in the body frame:
   `r_body = R^T (p_node − cg)` with `R = [xAft yUp (xAft×yUp)]` from
   `sim.axes()`. Reference nodes: main axle (`AXLE*`), tailwheel (`TW`).
2. Model-side: centers of the wheel meshes (Step 1 bounds).
3. Offset `off = axle_body − wheel_model` (x,y); z should be ~0 by symmetry.
   Adjust y so wheel *bottoms* (center − radius) match — sim wheel radius is
   `node.r`, model radius from the mesh.
4. Check the other wheel(s) against the ground line; accept a few cm float
   or sink. Scale stays 1.0 unless the model is not true scale — prefer the
   real aircraft's proportions over the sim's stylized frame (PA-18: model
   wheelbase 5.10 m vs sim 4.47 m, absorbed by the longer tail, tailwheel
   floats 3 cm — invisible).
5. Record in `SKIN_CFG.<key>.off` (src/viewer/app.js) and assert in
   `tools/test_model.js` (wheel-contact within ±5 cm).

## Step 3 — Flex binding (match to beams via node tags)

Driver = spar node tags, per side, grouped by |z| station:
- PA-18/Cub: `WF` + `WR` averaged at |z| ∈ {1.9, 3.4, 5.0}. Check the
  target aircraft's fiche for its tags and stations first
  (`src/core/1*_aircraft_*.js` — NOT tools/flight_core.js, which is
  generated).
- `zRoot`: just inboard of the first station, outboard of everything that
  must stay rigid (fuselage, gear; PA-18: 1.30).
- `xMax`: forward of the tail surfaces (PA-18: 1.5; stab starts at x 2.1).
  Watch for tail spans exceeding zRoot — that's what xMax is for.
- Verify with `tools/test_skin.js`: bound count, L/R symmetry, band
  containment, rest deltas (static sag — real, keep), fuselage immobility,
  tip tracking.

Rest reference is the **as-built def pose** (def.nodes − def mass CG):
deterministic, and static sag becomes visible, which is a feature.

## Step 4 — Control surfaces (hinge table)

Per surface, measure from the mesh:

```
python tools/model_inspect.py assets/<key>/<model>.obj --edge <object> --span z --bands 6
```

The probe prints per-band forward-edge x, mid-thickness y, and a suggested
hinge point; it warns if the edge rakes > 5 mm (non-axis-aligned hinge).

- **hinge point** = forward edge, mid-thickness (the probe's suggestion);
- **axis** = span direction (z for ailerons/elevator/flaps, y for
  rudder/tailwheel); ignore sub-degree rake;
- **drive + sign** from flight_core conventions — derive, don't guess:
  read the strip math (`ctl.de/da/dr/flap` application) and confirm
  empirically with a probe run. PA-18 reference: +de → elevator TE up;
  +da → +z-side aileron TE down; +dr → rudder TE +z (nose-left),
  tailwheel k=0.5 same sense; +flap → both flaps TE down (sgn −1 both
  sides — symmetric, unlike the antisymmetric ailerons);
- **gain k**: geared surfaces (tailwheel = twSteer from the core), and
  fraction-driven channels — `ctl.flap` is 0..1, so a flap row's `k` is
  the full-throw angle in radians (PA-18: 0.87 ≈ 50°);
- **ramp** `(x0, x1)` if the surface is fused with a fixed part
  (fin+rudder): smoothstep hinge weight over that x band. Verify the fixed
  part stays < 2 mm in the gate.

**APPEND rows to `SURFACES`** in tools/models/<key>.py — never insert:
sid = row index + 1 is baked into payloads and gate predicates.
Rebake, extend `tools/test_ctrl.js` (sign, magnitude ≈ arm·sin θ,
antisymmetry or symmetry as appropriate, leak = 0, composition with flex).

## Step 5 — Bake, wire, gate

1. Create/update the config `tools/models/<key>.py` (`CFG`: id, src, obj,
   credit, hub, surfaces, mats with per-texture settings, groups).
   Texture settings: jpeg with max px + quality per texture; **png
   passthrough for any texture with real alpha** (check before converting —
   the PA-18's asi.png carries the needle cutout mask; ai.png looked RGBA
   but its alpha is uniformly 255, so jpeg was safe).
2. `python tools/model_prep.py <key>` → writes `src/models/<key>_model.js`
   (generated — never hand-edit) and prints per-group/per-texture sizes.
3. Wire the build: add the file to `MANIFEST.models` in `tools/build.js`
   (inlined into index.html's MODELS slot, `<script src>` in dev.html).
4. Wire the viewer (src/viewer/app.js): add to `MODELS3D` and `SKIN_CFG`.
5. `node tools/run_gates.js` — must be all green, including UISMOKE (which
   executes the built artifact and catches wiring errors `node --check`
   cannot).
6. Eyeball in browser: mount fit at rest, flex at ×4, each surface
   direction, texture under scene lighting, interior through the glass.

## Budget note

The PA-18 payload is 781 KB (27 k tris exterior + 4.5 k verts interior +
1024 px atlas + 10 interior/gauge textures); the single-file artifact is
~1.65 MB (github.io serves gzip; base64 gzips to roughly ¾ of that).
Six aircraft ≈ +4–5 MB artifact. Before importing all six, decide whether
to split payloads into lazily-fetched files (breaks the single-file
artifact) or accept the size. ⏳ open question.
