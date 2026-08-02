# SKIN-PROC — 3D model skinning over the soft-body sim

Status: **prototype, off main branch**. This is a working procedure, meant to be
edited as the approach evolves. Sections marked ⚙ are the tunable decisions;
sections marked ⏳ are consciously deferred.

---

## 0. Principle

The sim is the truth; the model is a passive skin. The skin never feeds back
into physics. Two layers of motion:

1. **Rigid mount** — the whole model follows the body frame (CG + `sim.axes()`).
2. **Flex overlay** — wing-band vertices additionally follow the sim's spar
   stations, interpolated along span. Everything else stays rigid.

## 1. Pipeline

```
pa18.obj + texture.png
   │  tools/model_prep.py          (offline, rerun only if source model changes)
   ▼
pa18_model.js                      (base64 payload: skin/glass/prop groups)
   │  model_codec.js: decodeModel  (shared JS — same code in artifact and gates)
   ▼
typed arrays ──► THREE geometry    (template: buildModel)
   │  model_codec.js: makeSkinBinding   (once, at model build)
   ▼
binding ──► per frame: sparDeltas + applySkinDeform   (template: poseModel)
```

Gates: `test_model.js` (payload + mount calibration), `test_skin.js`
(binding + deformation). Both in `run_gates.sh`. flight_core.js untouched.

## 2. Bake (tools/model_prep.py)

- Exterior meshes only — 46 of 79 objects; cockpit gauges/seats/panel dropped.
  Edit the `EXTERIOR` / `GLASS` / `PROP` sets to change the cut.
- Positions int16-quantized over the model bbox (~0.2 mm), uv uint16,
  indices uint16 (⚙ hard limit 65 535 verts per group — split groups if a
  future model exceeds it).
- Texture recompressed to 1024 px JPEG q80 (⚙ trade size vs. sharpness).
- Payload: 525 KB. Artifact total 628 KB.

## 3. Rigid mount

Model frame orientation = body frame with **z left** (`zL = xAft × yUp`),
which keeps the basis proper — no mirrored livery. The PA-18 OBJ is already
nose −x / y up / z spanwise at true scale, so no rotation or scaling.

⚙ Mount offset, solved numerically against the settled sim (main-wheel
contact match): `SKIN_CFG.cub.off = [1.690, −0.070, 0]`.
Residuals: mains within 1 cm of the sim contact plane, tailwheel floats
~3 cm (the model's longer real tail absorbs the wheelbase mismatch,
sim 4.47 m vs model 5.10 m).

## 4. Flex overlay

### Driver signal
Per side, per station |z| ∈ {1.9, 3.4, 5.0}: mean of the WF (front spar) and
WR (rear spar) node positions, expressed in the body frame, minus the same
quantity in the **as-built def pose** (def.nodes relative to def mass CG).
Averaging both spars halves node noise; the def-based rest reference is
deterministic (no settle-dependent capture) and means static sag is *shown* —
at rest the tip droops ~5 cm, in climb it rides ~10 cm up: ~15 cm of visible
travel tip-to-tip through a circuit.

### Binding (once, at model build)
A vertex joins the wing band iff `|z| ≥ zRoot` **and** `x ≤ xMax`
(model frame). ⚙ Cub: `zRoot 1.30`, `xMax 1.5`.
- zRoot excludes fuselage/gear/wheels (all |z| < 1.0).
- xMax excludes the tail surfaces (stabilizer starts at x 2.1) which span
  |z| up to 1.44 and would otherwise catch wing deltas.
- Struts and bracing cables are deliberately *in*: their |z| ramp means the
  wing end follows the spar while the fuselage end stays put.

Each bound vertex stores (segment k, weight w, side). w interpolates between
station k−1 (root = zero delta) and k; **w > 1 past the last station
extrapolates linearly** (model tip 5.36 m vs outer spar 5.0 m).
Cub: 4 696 of 15 993 verts bound, exactly symmetric L/R.

### Per frame (CPU path)
`sparDeltas` (6 stations, ~2 µs) then `applySkinDeform` over 4 696 verts —
negligible next to the sim step. Position attribute re-uploaded each frame.

⚙ `SKIN_GAINS = [1, 4]` — the Skin button cycles
**Skin (×1) → Flex ×4 (exaggerated, for reading the flex) → Frame**
(strain view, deform loop skipped).

### 4b. Control surface hinges (e3)

Payload v2: the skin group carries a per-vertex **surface id** (uint8) and the
payload a **hinge table** measured from the mesh (forward-edge profiles):

| surface | drive | hinge point | axis | note |
|---|---|---|---|---|
| aileronG | −da | (−0.718, 0.620, 0) | z | +da → TE down (left wing lifts) |
| aileronD | +da | (−0.718, 0.620, 0) | z | antisymmetric |
| profondeur | +de | (2.834, 0.292, 0) | z | +de → TE up (pitch up) |
| direction | −dr | (2.905, 0, 0) | y | +dr → TE left (nose-left, per core comment) |

Signs were derived from `flight_core` strip math and verified empirically
(+da probe → right wing drops). Rotation is per-vertex Rodrigues about the
hinge line, driven 1:1 by `sim.ctl` radians (matches the HUD readout).

⚙ **Fin/rudder ramp.** `direction` is fin+rudder *fused* (one connected
component; forward edge x≈2.90 below y≈0.89 = hinge post, jumping to x≈2.5
above = fin). A smoothstep hinge weight over x ∈ [2.85, 2.95] leaves the fin
static and lets the shared fabric shear gently at the hinge instead of
tearing. Cost: ~1 cm of D-nose distortion at full deflection.

**Composition order** per frame: hinge pass writes surface verts from base;
flex pass then *adds* its delta in place for hinged-and-bound verts (ailerons
bend with the wing while deflected). `voletG/D` (flaps — it's a PA-18) stay
parked: the sim has no flap channel; they sit inboard of zRoot so they don't
flex either. Wire them to a future `ctl.fl` by adding two rows to `SURFACES`
in the bake.

Gate: `test_ctrl.js` — hinge-arm magnitude, antisymmetry, fin immobility
(< 2 mm), band leak (0 non-surface verts moved), hinge+flex composition.

## 5. Known limits / ⏳ deferred

- **Normals not recomputed** after deform — flex is ≤ ~5° so lighting error
  is invisible; recomputing 27 k tris/frame isn't worth it. Revisit only if a
  gain > 4 mode is added.
- **No twist**: stations use the WF+WR *mean*, discarding the front/rear
  difference. The twist signal is already available in the same nodes —
  next increment if wanted: per-station rotation about the local span axis
  from `(WF − WR)` vs rest.
- **Tail, gear, fuselage rigid.** The diagnosis run showed the sim's aft
  fuselage rides ~6–7 cm in the body frame at rest (tailwheel suspension +
  chassis flex) — a second binding along fuselage stations (tags S0..S6/TP)
  would be the same mechanism, another ⏳ increment.
- **Glass and prop rigid** (prop spins visually from throttle only; no RPM
  is exposed by the core).
- ~~Ailerons/elevator/rudder don't deflect~~ — **implemented, e3** (see §4b).
- **One model (Cub).** The machinery is per-aircraft via `MODELS3D` /
  `SKIN_CFG`; adding a model = bake + offset calibration + cfg entry.

## 6. UI notes

- Bottom bar now wraps (`flex-wrap`) with a gradient backdrop; legend hidden
  under 760 px — "Fly the circuit" is reachable on phone.
- Skin button appears only for aircraft that have a model.

## 7. Gate summary (all green at time of writing)

| gate | checks |
|---|---|
| MODEL | payload decode integrity, true span/length, wheel-contact calibration ±5 cm |
| SKIN | station structure, band containment, L/R symmetry, rest deltas < 12 cm, climb deltas 0.2–60 cm, fuselage immobile, tip tracks extrapolated spar within 1 cm |
| M3…TREE | unchanged, flight_core untouched |

## 8. Incident log

- **e2 · `MODEL_OFF` ReferenceError.** The mount-offset table was renamed to
  `SKIN_CFG` during the flex work; `poseModel` kept the old name. `node --check`
  passes on unresolved identifiers, so the syntax gate was blind to it.
  Fix: reference corrected, and a new **UI SMOKE GATE** (`test_ui_smoke.js`)
  now *executes* the built artifact's app block headless (DOM + THREE stubs):
  boot, setAircraft with real payload binding, 180 frames of the loop incl.
  deform, Fly press, every button handler, aircraft switch. Runs first in
  `run_gates.sh`, which therefore now builds before gating.

- **e3 · control surfaces.** Payload v2 (sid + hinge table), Rodrigues hinge
  pass composed under the flex pass, CTRL gate added. Battery now 12 gates.
  Note: aileron rotation is applied about the *undeformed* hinge line, then
  flexed — geometrically inconsistent at large flex gains, invisible at ×1.

- **e4 · linkage filter + tailwheel steering.** Measured the visible surface
  waggle: not jitter but an AP **limit cycle** — da ±4.6° / dr ±2.2° at
  ~3.7 Hz in cruise. Root cause (for a future flight_core session, NOT fixed
  here): `c.da = rollP·(phCA−ph) − rollD·p` with `p` finite-differenced from
  soft-body attitude — the derivative term amplifies structural vibration and
  the loop self-sustains. Candidate core fixes: stronger/notched rate filter,
  lower rollD, or a mass-weighted multi-node attitude frame.
  Prototype fix (visual only): **two-pole linkage low-pass**, ⚙ `LINK_TAU`
  0.15 s/pole, between `sim.ctl` and the drawn surfaces — 6.5× attenuation of
  the limit cycle (residual ±0.7°), 90% step tracking in 0.53 s (well inside
  the AP's own 0.18 rad/s bank slew). HUD still shows raw ctl; physics
  untouched. Gated in test_ctrl (DC gain, step speed, attenuation ≥5×).
  **Tailwheel steering**: physics already existed in the core
  (`twSteer·ctl.dr`, nose-left); the visual is one SURFACES row — roueA
  swivels about the fork post at k=0.5 rudder ratio. Gated (sign + throw <
  rudder). Import procedure generalized in **MODEL-IMPORT-PROC.md**.
