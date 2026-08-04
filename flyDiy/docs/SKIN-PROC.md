# SKIN-PROC — 3D model skinning over the soft-body sim

Status: **in trunk** (ported from the flexbody branch 2026-08, then extended
with flaps + full interior). This is a working procedure, meant to be edited
as the approach evolves. Sections marked ⚙ are the tunable decisions;
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
assets/pa18/pa18.obj + textures
   │  tools/model_prep.py <key>       (offline; config in tools/models/<key>.py)
   ▼
src/models/pa18_model.js              (base64 payload v3: 13 groups, 10 textures)
   │  build.js MODELS slot            (inlined in index.html, <script src> in dev.html)
   │  src/core/50_model_codec.js: decodeModel   (shared JS — artifact and node gates)
   ▼
typed arrays ──► THREE geometry       (src/viewer/app.js: buildModel — generic loop,
   │                                   per-group material from the payload's mats table)
   │  makeSkinBinding                  (once, at model build)
   ▼
binding ──► per frame: applyHinges + sparDeltas + applySkinDeform   (poseModel)
```

Gates (tools/run_gates.js battery): `MODEL` (payload + mount calibration),
`SKIN` (binding + deformation), `CTRL` (hinges, signs, linkage), `UISMOKE`
(executes the built artifact headless), `PA18` (full circuit with the AP
deploying flaps). flight_core physics untouched except the codec's
visual-only linkage.

## 2. Bake (tools/model_prep.py + tools/models/pa18.py)

- All 72 objects baked into 13 groups: `skin` (30 exterior objects incl.
  control surfaces), `glass`, `prop`, and the interior per material —
  `cabin`, `seat`, `panel`, `gauge_ai/asi/alt/turn/hdg/vsi`, `covers`.
  (Pre-interior reference: 32 of 72 objects.)
- Positions int16-quantized over the union bbox (~0.2 mm), uv uint16
  (clamped + rounded), indices uint16 (⚙ hard limit 65 535 verts per group —
  split groups if a future model exceeds it; largest today: skin 15 993).
- Textures per config: exterior atlas 1024 px JPEG q80 (75 KB), gauge dials
  native 256 px JPEG (5–13 KB each), seat 512 px, panel 128 px.
  **asi.png stays PNG passthrough — it carries real cutout alpha** (needle
  mask); jpeg would destroy it. ai.png is RGBA but its alpha is uniformly
  255, so jpeg is safe.
- Payload: 781 KB (was 546 KB exterior-only). Artifact total ~1.65 MB.

## 2b. The c172 (GLB source, 2026-08-04)

Second model, and the one that generalised the machinery. Source is a
Sketchfab GLB (NLM, CC-BY 4.0) rather than a FlightGear OBJ — see
MODEL-IMPORT-PROC.md Step 0b for the conversion, `tools/glb_extract.py` and
`tools/models/c172_src.py` for the part table.

- **27 groups, 120 k verts / 186 k tris, 12 textures, 6.2 MB.** The mesh is
  imported AS-IS — no decimation — and the textures are embedded verbatim.
  Exterior on the Body atlas (`skin`), glazing, tyres, hubs, metal fittings,
  nose axle, four `prop*` groups, and the interior split per material.
  Load cost is carried by the boot splash, not by degrading the model.
- **Rig list.** `SKIN_CFG.c172.rig = ['skin','metal','tyre','hub','gear']`.
  The nose gear steers and its parts carry four materials, so four groups
  need the hinge pass; `metal` is rigged only for flex (strut fittings).
  Default is `['skin']`, so the pa18 path is byte-for-byte what it was.
- **Non-cardinal hinges.** Wing dihedral tilts the flap and aileron hinges,
  aileron taper sweeps them 7 deg, and the rudder hinge rakes 24 deg. The
  axes are least-squares fits from `model_inspect.py --edge` (which now
  prints them); the Rodrigues pass took them unchanged.
- **Flat colour goes opaque.** `matFor` used to force `transparent:true,
  depthWrite:false` on every untextured material — right for the pa18's two
  translucent groups, wrong for a cabin. Now it keys off `opacity < 1`.
- **Glazing keeps its own tint map** (Window.png at opacity 0.37) — payload
  materials may now carry tex + opacity + color together, where before a
  material was either textured or flat-translucent.
- **Mount** `off = [1.694, -1.420, 0]`, calibrated at both gear ends:
  mains 0.2 cm and nose 0.8 cm off the sim's settled contact plane.

## 3. Rigid mount

Model frame orientation = body frame with **z left** (`zL = xAft × yUp`),
which keeps the basis proper — no mirrored livery. The PA-18 OBJ is already
nose −x / y up / z spanwise at true scale, so no rotation or scaling.

⚙ Mount offset, solved numerically against the settled sim (main-wheel
contact match): `SKIN_CFG.pa18.off = [1.690, −0.070, 0]`.
The skin is mounted on the **pa18 fiche** (`src/core/16_aircraft_pa18.js`),
a byte-copy of the cub geometry plus flap physics — so the calibration
measured on the cub carries unchanged. The J-3 stays wireframe.
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
(model frame). ⚙ pa18: `zRoot 1.30`, `xMax 1.5`.
- zRoot excludes fuselage/gear/wheels (all |z| < 1.0).
- xMax excludes the tail surfaces (stabilizer starts at x 2.1) which span
  |z| up to 1.44 and would otherwise catch wing deltas.
- Struts and bracing cables are deliberately *in*: their |z| ramp means the
  wing end follows the spar while the fuselage end stays put.
- The **flap tips reach |z| 2.06 — outboard flap verts ARE flex-bound**
  and compose with their hinge rotation exactly like the ailerons do.

Each bound vertex stores (segment k, weight w, side). w interpolates between
station k−1 (root = zero delta) and k; **w > 1 past the last station
extrapolates linearly** (model tip 5.36 m vs outer spar 5.0 m).
pa18: 4 696 of 15 993 verts bound, exactly symmetric L/R.

### Per frame (CPU path)
`sparDeltas` (6 stations, ~2 µs) then `applySkinDeform` over 4 696 verts —
negligible next to the sim step. Position attribute re-uploaded each frame.

⚙ `SKIN_GAINS = [1, 4]` — the Skin button cycles
**Skin (×1) → Flex ×4 (exaggerated, for reading the flex) → Frame**
(strain view, deform loop skipped; the shadow proxy takes over the sun
shadow, the skin casts it otherwise).

### 4b. Control surface hinges

The skin group carries a per-vertex **surface id** (uint8) and the payload a
**hinge table** measured from the mesh (tools/model_inspect.py --edge):

| surface | drive | sgn | k | hinge point | axis | note |
|---|---|---|---|---|---|---|
| aileronG | da | −1 | 1 | (−0.718, 0.620, 0) | z | +da → TE down (left wing lifts) |
| aileronD | da | +1 | 1 | (−0.718, 0.620, 0) | z | antisymmetric |
| profondeur | de | +1 | 1 | (2.834, 0.292, 0) | z | +de → TE up (pitch up) |
| direction | dr | −1 | 1 | (2.905, 0, 0) | y | ramp (2.85, 2.95) — see below |
| roueA | dr | −1 | 0.5 | (3.14, −0.10, 0) | y | tailwheel steers at twSteer=0.5 |
| voletG | flap | −1 | 0.87 | (−0.824, 0.592, 0) | z | +flap → TE down, symmetric |
| voletD | flap | −1 | 0.87 | (−0.824, 0.592, 0) | z | ctl.flap is 0..1, k = full throw |

Signs were derived from flight_core strip math and verified empirically.
Rotation is per-vertex Rodrigues about the hinge line, driven through
`makeLinkage(LINK_TAU 0.15)` — a two-pole low-pass between `sim.ctl`
(channels de/da/dr/flap) and the drawn surfaces, NOT 1:1: real cable runs
filter exactly like this, and it attenuates the AP's ~3.7 Hz limit cycle
6.5× (see §8 e4). The HUD keeps showing raw `sim.ctl`.

⚙ **Fin/rudder ramp.** `direction` is fin+rudder *fused* (one connected
component; forward edge x≈2.90 below y≈0.89 = hinge post, jumping to x≈2.5
above = fin). A smoothstep hinge weight over x ∈ [2.85, 2.95] leaves the fin
static and lets the shared fabric shear gently at the hinge instead of
tearing. Cost: ~1 cm of D-nose distortion at full deflection.

**Composition order** per frame: hinge pass writes surface verts from base;
flex pass then *adds* its delta in place for hinged-and-bound verts
(ailerons and outboard flap corners bend with the wing while deflected).

Gate: `tools/test_ctrl.js` — hinge-arm magnitude, aileron antisymmetry,
flap symmetry, fin immobility (< 2 mm), band leak (0 non-surface verts
moved), hinge+flex composition, tailwheel gearing, linkage DC gain / step
speed / attenuation ≥5× / flap channel.

## 5. Interior (v3)

- 13-group payload with per-material `mats`/`texs` tables; the viewer's
  `buildModel` is a generic loop resolving one material per group (v2
  payloads still decode via a shim).
- Opaque interior renders in the opaque pass — correct through the cabin
  glass. The two nested translucents are ordered deterministically:
  `renderOrder` covers=1 < glass=2, both `depthWrite:false` (r128's
  transparent-pass distance sort is unreliable for nested shells).
- All materials DoubleSide: interior faces point inward, the camera sees
  their backs through the glass.
- Gauge needles are separate objects in per-instrument groups — needle
  animation is a ⏳ future increment (per-group sid tags, no format change).

## 6. Known limits / ⏳ deferred

- **Normals not recomputed** after deform — flex is ≤ ~5° so lighting error
  is invisible; recomputing 27 k tris/frame isn't worth it.
- **No twist**: stations use the WF+WR *mean*, discarding the front/rear
  difference. Next increment if wanted: per-station rotation from
  `(WF − WR)` vs rest.
- **Tail, gear, fuselage rigid.** The sim's aft fuselage rides ~6–7 cm in
  the body frame at rest — a second binding along fuselage stations would
  be the same mechanism, another ⏳ increment.
- **Glass and prop rigid** (prop spins visually from throttle only; no RPM
  is exposed by the core).
- **Hinge about the undeformed line**: hinge rotation then flex-add is
  geometrically inconsistent at large flex gains — invisible at ×1, visible
  only at ×4.
- **Ported as-is, deliberately unfixed** (flagged, not bugs today):
  `makeSkinBinding` derives station keys from the P side only (exact for
  mirrored fiches; a non-mirrored aircraft would need a union+assert);
  prop rotation accumulates unbounded; linkage + prop spin hardcode 1/60
  (matches both render loops — never change one without the other).
- **Two models (pa18, c172).** The machinery is per-aircraft via `MODELS3D` /
  `SKIN_CFG`; adding a model = bake + offset calibration + cfg entry.
- **c172 residual mismatches, known and accepted**: the model's wing sits
  ~25 cm below the sim's spar nodes in the body frame (invisible — the flex
  overlay is delta-driven — but the FRAME view shows it), and the model's
  front spar is ~0.46 m aft of the sim's. Moving the sim's wing to match
  would rewrite the static margin and every AP tune with it; the calibration
  anchors on the wheels instead, which is what a viewer can actually see.
- **Gear compression is not drawn.** The skin is rigid below the wing, so
  when the sim's gear deflects, the drawn wheels sink with the airframe.
  Static deflection is 4.4 cm (c172) — invisible; a hard arrival is not.
  Articulating the gear would be the same mechanism as the hinges (a
  prismatic drive instead of a rotary one) — ⏳.

## 7. Gate summary

| gate | checks |
|---|---|
| MODEL | 13-group decode integrity + vert counts ±10%, true span/length, wheel-contact calibration ±5 cm |
| SKIN | station structure, band containment, L/R symmetry, rest deltas < 12 cm, climb deltas 0.2–60 cm, fuselage immobile, tip tracks extrapolated spar within 1 cm |
| CTRL | 7 surfaces, hinge magnitudes/signs, aileron antisymmetry, flap symmetry, fin ramp leak < 2 mm, zero band leak, hinge+flex composition, tailwheel k=0.5, linkage DC/step/attenuation/flap |
| UISMOKE | executes the built artifact's core+models+app blocks headless: 180 frames of the loop incl. deform, every button, dropdown aircraft switch |
| PA18 | full circuit: AP deploys flaps on approach (max > 0.95) and retracts for rollout, td sink < 1.5, three-point attitude, no noseover |
| C172M | c172 payload decode, span/length, tricycle mount calibration at BOTH ends, non-cardinal hinge axes (unit, correct signs), nose-gear steering across four groups, flex band containment/symmetry, strut fittings bound but fuel caps not |
| GE…TREE | physics battery unchanged |

## 8. Incident log

- **e2 · `MODEL_OFF` ReferenceError.** The mount-offset table was renamed to
  `SKIN_CFG` during the flex work; `poseModel` kept the old name. `node --check`
  passes on unresolved identifiers, so the syntax gate was blind to it.
  Fix: reference corrected, and a new **UI SMOKE GATE** now *executes* the
  built artifact's app block headless (DOM + THREE stubs).

- **e3 · control surfaces.** Payload v2 (sid + hinge table), Rodrigues hinge
  pass composed under the flex pass, CTRL gate added.

- **e4 · linkage filter + tailwheel steering.** Measured the visible surface
  waggle: not jitter but an AP **limit cycle** — da ±4.6° / dr ±2.2° at
  ~3.7 Hz in cruise. Root cause (for a future flight_core session, NOT fixed
  here): `c.da = rollP·(phCA−ph) − rollD·p` with `p` finite-differenced from
  soft-body attitude — the derivative term amplifies structural vibration and
  the loop self-sustains. Candidate core fixes: stronger/notched rate filter,
  lower rollD, or a mass-weighted multi-node attitude frame.
  Prototype fix (visual only): **two-pole linkage low-pass**, ⚙ `LINK_TAU`
  0.15 s/pole — 6.5× attenuation (residual ±0.7°), 90% step in 0.53 s.
  **CLOSED core-side in W16 (2026-08-04)**: fiche `rollD: 0.8` on cub/pa18
  kills the cycle at the source (aileron 7.9° → 0.2° p2p measured); the
  "lower rollD" candidate above was the right one — a faster rate filter
  made it worse. The linkage low-pass stays for actuation realism.
  **Tailwheel steering**: one SURFACES row, k=0.5 rudder ratio.

- **e5 · trunk port + flaps + interior (2026-08).** Re-homed onto the src/
  split: codec → `src/core/50_model_codec.js` (byte-identical except the
  flap linkage channel), payload → `src/models/` via a new build MODELS
  slot, viewer block → `src/viewer/app.js`, gates on the trunk verdict
  contract. The branch's `flight_core.js` was a fork of the initial commit
  and was discarded. Flaps rigged (voletG/D rows, measured hinge; the old
  §4b claim that they "sit inboard of zRoot" was wrong — tips reach 2.06)
  and the interior baked in full (payload v3). New `pa18` fiche carries
  flap physics (tunnel-calibrated to the POH Vs ratio 0.90) and the skin;
  its AP flies flapped approaches: throttle-cut flares arrived at sink 2.0
  with flap drag ×2, so the fiche carries `flareThr 0.12`, approach 20.5,
  gentler brakes, and `VTailDown 99` (new optional AP param): the taildragger
  tail-up rollout hold nosed it over at −25° under flap lift + dCm0 in the
  crosswind gate — a flapped Super Cub pins the tail from touchdown.
