# MODEL-IMPORT-PROC — adding a 3D model to a garage-flight aircraft

Editable working procedure. Executed once for the PA-18 → Cub (reference
implementation); follow it for the drone / DC-3 / Jodel / C172 / Chinook.
Companion: SKIN-PROC.md (how the runtime works), tools/model_prep.py (the bake).

---

## Step 0 — Source model requirements

- **Format**: OBJ + MTL + textures (FlightGear models are ideal: GPL, true
  scale, sensible part naming — helijah's hangar is a goldmine).
- **License**: record author + license in the payload header (bake does this).
- **Axes**: target convention is *nose −x, y up, z spanwise*. FlightGear/Blender
  exports usually match. Verify with per-object bounds (Step 1) — do NOT trust
  the file, measure. If rotated, add a fixed rotation in the bake (not yet
  needed, so not yet implemented).
- **Scale**: true meters. Check span/length against the real aircraft.

## Step 1 — Inventory the parts

Run per-object bounds + materials (throwaway script, see chat history or
rewrite: parse `o`/`v`/`usemtl`, print center + size + material per object).
Sort every object into:

| bucket | goes to | examples (PA-18) |
|---|---|---|
| exterior structure | `EXTERIOR` | fuselage, ailes, capot, structure, roues, cables |
| exterior glass | `GLASS` | vitres (material `transparentExt`) |
| propeller | `PROP` | helice (spun visually from throttle) |
| control surfaces | `EXTERIOR` **+ `SURFACES` row** | ailerons, profondeur, direction, tailwheel |
| cockpit / interior | *dropped* | gauges, needles, seats, panel, interior glass |

Heuristics: gauge-texture materials (`*_asi.png` etc.) → interior. `interior.png`,
`seat.png`, `panel` → interior. Ambiguously named meshes (`trous`): scatter-plot
their vertices in three projections before deciding — for the PA-18 it was
exterior tube detail (wingtip bows, frames), worth keeping.

**Separation requirements for a new/edited model (e.g. authored in Blender):**
- each control surface = its own object, its own vertex island (no shared
  verts with the parent surface);
- fin+rudder or stab+elevator fused is workable via a hinge weight ramp
  (see Step 4) but separate objects are cleaner;
- wheels as separate objects (main wheels feed mount calibration; tailwheel
  can become a steering surface);
- one exterior texture atlas; interior on separate materials so the bake
  can drop it wholesale.

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
5. Record in `SKIN_CFG.<key>.off` and assert in `test_model.js`
   (wheel-contact within ±5 cm).

## Step 3 — Flex binding (match to beams via node tags)

Driver = spar node tags, per side, grouped by |z| station:
- Cub: `WF` + `WR` averaged at |z| ∈ {1.9, 3.4, 5.0}. Check the target
  aircraft's build function for its tags and stations first
  (`grep "tag" flight_core.js` around its `build*`).
- `zRoot`: just inboard of the first station, outboard of everything that
  must stay rigid (fuselage, gear; PA-18: 1.30).
- `xMax`: forward of the tail surfaces (PA-18: 1.5; stab starts at x 2.1).
  Watch for tail spans exceeding zRoot — that's what xMax is for.
- Verify with `test_skin.js`: bound count, L/R symmetry, band containment,
  rest deltas (static sag — real, keep), fuselage immobility, tip tracking.

Rest reference is the **as-built def pose** (def.nodes − def mass CG):
deterministic, and static sag becomes visible, which is a feature.

## Step 4 — Control surfaces (hinge table)

Per surface, measure from the mesh (forward-edge profile per span band):
- **hinge point** = forward edge, mid-thickness;
- **axis** = span direction (z for ailerons/elevator, y for rudder/tailwheel);
  ignore sub-degree rake;
- **drive + sign** from flight_core conventions — derive, don't guess:
  read the strip math (`ctl.de/da/dr` application) and confirm empirically
  with a probe run (e.g. +da pulse → which wing drops). Cub reference:
  +de → elevator TE up; +da → +z-side aileron TE down; +dr → rudder TE +z
  (nose-left), tailwheel k=0.5 same sense;
- **gain k** for geared surfaces (tailwheel = twSteer from the core);
- **ramp** `(x0, x1)` if the surface is fused with a fixed part
  (fin+rudder): smoothstep hinge weight over that x band. Verify the fixed
  part stays < 2 mm in the gate.

Add rows to `SURFACES` in tools/model_prep.py, rebake, extend `test_ctrl.js`
(sign, magnitude ≈ arm·sin θ, antisymmetry, leak = 0, composition with flex).

## Step 5 — Bake, wire, gate

1. `python3 tools/model_prep.py <src_dir> <model>.js`
2. Template: add to `MODELS3D` and `SKIN_CFG`.
3. `sh run_gates.sh` — must be all green, including UI SMOKE (which executes
   the built artifact and catches wiring errors `node --check` cannot).
4. Eyeball in browser: mount fit at rest, flex at ×4, each surface direction,
   texture under scene lighting.

## Budget note

Each model costs its payload (~550 KB for 27 k tris + 1024 px texture).
Six aircraft ≈ +3 MB artifact. Before importing all six, decide whether to
split payloads into lazily-fetched files (breaks the single-file artifact) or
accept the size. ⏳ open question.
