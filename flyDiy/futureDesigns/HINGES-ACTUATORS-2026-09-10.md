# HINGES AND ACTUATORS — the audit (2026-09-10)

The user: *"audit the model to check what hinges and actuators are modelled
visually. We will need high quality ones, animated and coherent with the
control surfaces, proper materials and geometry, options in the sliders for
size and positioning (at least positioning), aerodynamic covers optional,
ability to be affected by liveries, etc. It's a narrow scope, let's do it
thoroughly."*

This is the audit half. It says what exists today, measured; what is missing,
against each clause of that list; and how the missing part should be built so
it lands the way the fittings arc (G81-G85) and the lift-strut foot (G86-G88 /
G108) landed — a declared table of requirements resolved against real
geometry, with a gate that can fail.

**The one-line answer: the aeroplane has no hinge and no actuator geometry at
all.** Every control surface on every build is a floating slab that rotates
about an invisible line, and on the wing it rotates *through* the wing. The
only drawn hinge on the whole aeroplane is the one on the cowl's oil door.

---

## METHOD — what was read and what was measured

Read: `src/core/63_gen_wing.js` (the wing and its surfaces), `50_model_codec.js`
(`applyHinges`, `makeLinkage`), `60_gen_spec.js` (`controls`, `GEN_FLAPS`,
`GEN_ACCESS`, `GEN_OUTFIT`), `src/viewer/app.js` (`surfParts`, the per-frame
pose), `aeroskin.js` (`AERO_SEC`), `tools/_cage_join.js` (`cageSurfHinge`, the
part walk), `_fin_gen.js` (`finCutMesh`, `finThicken`), `_cage_fin.js`,
`_cage_stab.js`, `_cage_wing.js`, `_fit_gen.js` (`FORMS`), `_gear_kit.js`,
`_cowl_gen.js`.

Measured, headless, in node:
- `buildGen(GEN_DEFAULT)` → `genWing(def)` → the `ailR` / `flapR` groups
  rotated about their own published pivot and axis, and the depth of the
  deepest vertex **forward of the hinge plane** — i.e. inside the fixed wing.
- `_tail_headless.js` `tailBuild(designFull('Cub-alike'))` → the fin's cut,
  thickened solid, split by `f.part`, the rudder turned about the declared
  hinge line, and the clearance to the fin's cut face.

Not done here: a render. Every number below is geometry, not pixels; the first
step of the build chantier is the pixel pass the fittings arc used
(`WebGLRenderTarget` + `readRenderTargetPixels`), because that is the only
instrument in this project that has ever caught a part being invisible.

---

## 1 · THE INVENTORY — what is modelled visually today

| what moves | drawn at its hinge | hardware | animated |
|---|---|---|---|
| aileron L/R (per plane) | a cut in the loft: fixed skin lofted `[0..h]`, surface lofted `[h..1]`, **the same points** — no gap at all (`63_gen_wing.js:196`) | **none** | yes, `da` |
| flap L/R (per plane) | same cut, same construction | **none** | yes, `flap` |
| rudder | a real **slot**: the drawn guard band is deleted, each part keeps its own cut face, the parts shift apart by `finCutGap` (`_fin_gen.js:521+`) | **none** | yes, `dr` |
| elevator L/R | the same cutter on the stab (`stCut` / `stCutGap`) | **none** | yes, `de` |
| ruddervator (V-tail) | as the elevator, two drives (G209) | **none** | yes, `de`+`dr` |
| trim tabs | **do not exist** — not drawn, not in `spec.controls`, not in the solver | — | — |
| cowl oil door | a hinge strip on the forward edge + a quarter-turn latch (`_cowl_gen.js:911-935`) | **the only drawn hinge on the aeroplane** | no (static) |
| baggage door / oil filler flap (fitting) | `doorHinged` form: piano-hinge knuckles down the forward edge + a latch boss (`_fit_gen.js:225`) | knuckles only | no |
| cabin door | a cut panel with a 3 mm step and a seal strip (G207), explodable in the editor | **none** | no |
| undercarriage | lugs, clevises, an oleo, a bronze castor pivot, bolts (`_gear_kit.js`, `_gear_gen.js`) | **real, and the quality bar** | legs stretch, castor yaws, wheels spin |
| lift struts / cabane | a bolted doubler + a clevis at all four ends (G86-G88, G108) | real | ride their nodes |
| engine | rocker covers, pushrod tubes, leads — cosmetic dress | real-looking, static | — |
| propeller | spins about the hub | — | yes |
| cockpit stick, pedals, throttle, flap lever | drawn per station (`_cage_crew.js:1523+`) | — | **no — dead sticks** |

Two more facts that belong in the inventory because they are what a builder
sees:

- **`GEN_ACCESS.inspAileron` — "Aileron bellcrank cover"** (`60_gen_spec.js:687`)
  is a plate on the lower wing, two per aeroplane, that *serves "the aileron
  bellcrank and its cable ends"*. There is no bellcrank and there are no cable
  ends. The fittings arc's own acceptance test — *point at any hatch and say
  what is behind it* — is failed by this one row, and it is failed because the
  thing behind it was never built.
- **`inspTail` — "Tail inspection ring"** serves *"the elevator and rudder
  cable runs at the tailpost"*. Same: the runs are declared and not drawn.

## 2 · THE NUMBERS

**The wing's surfaces rotate through the wing.** The aileron and flap sections
are lofted from the same chord fraction as the fixed skin's cut, so the
surface's nose is a flat wall and the fixed skin's cove is the matching flat
wall, sharing a plane. The pivot sits at mid-thickness on that plane
(`63_gen_wing.js:747`). Every degree of deflection therefore buries the nose's
lower (or upper) corner in the fixed skin:

| deflection | aileron nose inside the fixed wing | flap |
|---|---|---|
| 10° | 8.3 mm | 8.3 mm |
| 20° | 15.9 mm | 16.0 mm |
| 25° | 19.5 mm | 19.6 mm |
| 30° | 23.0 mm | 23.1 mm |
| 57.3° (full stick — see below) | 38.4 mm | 38.5 mm |

Stock wing, 1.6 m chord, NACA 2412, surface chord 0.353 m, nose thickness
90.8 mm. The depth is exactly `½ × thickness × sin θ`, which is what a flat
nose on a mid-thickness hinge must do. It is invisible on a still, and it is
what a hinge line looks like when nothing holds the two parts apart.

**The tail is better, because the slot is real.** Cub-alike, `finCutGap`
0.012 (17.6 mm at the build's scale), rudder 43.7 mm thick:

| rudder deflection | clearance to the fin's cut face |
|---|---|
| 15° | 11.7 mm |
| 25° | 7.6 mm |
| 30° | 5.5 mm |
| 40° | 1.5 mm |
| 57.3° | **−4.8 mm — it crosses** |

So the tail's slot is sized for a real travel and nothing else. The elevator is
built by the same cutter with `stCutGap` 0.012 and `stThick` 0.05.

**Full command draws 57.3°.** `applyHinges` and `app.js`'s `surfParts` both
compute `ang = sgn · k · ctl`, with `ctl ∈ [−1, 1]` and `k = 1` for every
surface except the flap (`k = 0.70`) — so a full-scale roll command turns the
aileron **one radian**. There is no declared travel per surface anywhere in the
spec: `spec.controls` (`60_gen_spec.js:2190`) carries chord and span fractions
and nothing else, and the physics reads chord only, through `genTauAt`. A real
aileron travels ±20-25°, an elevator +25/−20, a rudder ±25-30, a flap 0-40.
**No hinge hardware that is drawn honestly can survive 57°**, so this number
has to be fixed before the hardware goes on, not after.

**A Fowler flap is drawn as a plain flap.** `GEN_FLAPS` (`60_gen_spec.js:1093`)
is a physics table — `dCl`, `cd`, `rate`. The loft reads only `dCl > 0` to
decide whether a flap band exists, and the hinge is `1 − chord` in all four
cases. A Fowler neither translates aft nor has a track, and flap tracks with
their carriage fairings are the single most visible piece of actuator hardware
on any aeroplane that has them.

---

## 3 · AGAINST YOUR LIST

| what you asked for | today |
|---|---|
| hinges modelled visually | none, anywhere on a flying surface |
| actuators modelled visually | none — no horn, no pushrod, no bellcrank, no cable, no torque tube, no flap track |
| animated | the surfaces are; the hardware does not exist; the cockpit's own stick and pedals are dead |
| coherent with the control surfaces | the surfaces themselves are coherent since G209 (hinge, axis, drive, sign all measured from the surface's own geometry) — but the wing's surfaces pass through the wing, and full travel is 57° |
| proper materials | the vocabulary exists and is right (`AERO_HARD`: `steelTube`, `bareAlu`, `castAlu`, `bronze`, `chrome`, `trim`) and nothing uses it here |
| proper geometry | the kit exists and is right (`_gear_kit.js`: `sweep`, `revolve`, `lug`, `bolt`, `boxIn`, filleted paths, `secBlade`) and nothing uses it here |
| sliders for size and positioning | none. The surfaces have chord/span (wing), cut mode / slot width / hinge chord / thickness (tail). No hinge count, no hinge station, no horn side, no horn length |
| aerodynamic covers optional | none. No hinge fairing, no gap seal, no pushrod fairing, no flap-track fairing |
| affected by liveries | the mechanism is exactly right and unused: `AERO_SEC` + `aeroSecResolve`, with `wears: 'parent'` and a pinned `fin` — the idiom the spats and the strut fittings already use |

---

## 4 · THE FINDINGS, ranked

1. **F1 — the wing's surfaces interpenetrate the wing** (measured above). The
   cure is geometric and belongs in `63_gen_wing`: give the surface's nose a
   **radius about the hinge point** (radius = local half-thickness) and open
   the fixed skin's cove to match with a declared gap. That is what a real
   plain hinge looks like in section, and after it *no* deflection can foul.
   Cost: `GATE WINGSPLIT` re-blessed, with the diff as the record — the gate
   has `--bless` for exactly this case and says so in its header.
2. **F2 — full command draws 57°.** A declared travel per surface, visual-only
   (it is already a scale factor `k`), read from one table so the editor, the
   join and the codec agree. Everything downstream of the hardware depends on
   it.
3. **F3 — no hinge hardware.** Nothing holds any surface on.
4. **F4 — no actuator hardware.** Nothing moves any surface, and two fittings
   already advertise the parts that are missing (`inspAileron`, `inspTail`).
5. **F5 — the cockpit's controls are dead.** The stick, the pedals and the flap
   lever are drawn, the crew's IK reaches them (G204/G205), and none of them
   answers `ctl`. This is the same coherence question at the human end of the
   run, and it is the cheapest of the five.
6. **F6 — flap type is invisible.** Fowler = plain, drawn.
7. **F7 — no trim tabs**, in the drawing or in the model. Out of scope unless
   you want them; named so it is a decision and not an omission.

---

## 5 · THE DESIGN — how it should be built

### 5.1 The mechanism, which is the only genuinely new thing

Three kinds of geometry, and the existing part system already answers two of
them for free:

- **What turns with the surface** — the surface half of the hinge, the control
  horn, a mass balance arm, the rod end that hangs on the horn. Parent it under
  the layer's `edSurf_<nm>` object and it is done: the join's part walk climbs
  the parent chain (`_cage_join.js:1548-1551`), so any mesh under that name
  joins that part, is rebased about its pivot, and is turned by the same
  Rodrigues pass as the skin.
- **What stays with the airframe** — the structure half of the bracket, the
  bellcrank, a flap track, a fairlead, the pulley bracket at the tailpost. Draw
  it in the fixed group. Also free.
- **What spans the two** — the pushrod, the cable, the flap carriage. Neither
  group can carry it: its length and angle change every frame. **Reuse G179.2's
  `members` contract** — a `stretch` part whose vertices are each a point on the
  line between a `pin` and a `tip`, which is how every lift strut, cabane leg
  and bracing wire already follows two moving ends. The extension is one idea
  wide: today an end rides a *physics node*; here the `tip` end must ride a
  *control surface's hinge rotation*. One new end-kind, published by the join,
  read in `app.js` beside the existing strut follow.

That is the whole animation problem. Everything else is drawing.

### 5.2 The declared table

`GEN_HINGE` in `60_gen_spec.js`, shaped like `GEN_ACCESS`: one row per
requirement, each saying what it serves, `need(R)` deciding whether the
aeroplane has it, resolved against built geometry by a placer. Rows:

- `hingeAil`, `hingeFlap`, `hingeRud`, `hingeElev` — the hinge line itself:
  **count** from the surface's own span (one per ~0.7 m, minimum two, ends
  inset), **family** from the construction (`tubeFabric`/`wood` → discrete
  pin brackets; `alloy` → continuous piano hinge; `carbon` → either, default
  piano), **size** from the local section thickness.
- `hornAil`, `hornRud`, `hornElev`, `hornFlap` — the control horn: which side
  (aileron below, rudder port, elevator above on a fabric tail), the station
  along the span, the reach.
- `linkAil` — the pushrod from the bellcrank (which is what the existing
  `inspAileron` cover is over) to the aileron horn; `cableRud` / `cableElev` —
  the runs from the tailpost fairlead to the horns, which is what `inspTail`
  is for. These are the `members` parts of 5.1.
- `trackFlap` — the external track + carriage fairing, `need` = the flap type
  is `fowler` (and F6 falls out of it: a Fowler finally looks like one).
- `balanceRud` / `balanceElev` — a mass balance arm ahead of the hinge, needed
  by speed/construction, not by taste.
- `fairHinge`, `fairLink` — the optional aerodynamic covers: a hinge fairing
  strip and a pushrod fairing, off by default on a fabric aeroplane, on by
  default on a clean alloy one.

**Acceptance test, stated before the code** (the fittings arc's discipline):
*you can point at any control surface and see what holds it on and what moves
it; nothing is hidden inside a wing that the aeroplane does not have; and no
hatch covers a mechanism that was never built.*

### 5.3 Geometry and materials

Drawn with `GEAR_KIT` — `sweep` for a knuckle and a pushrod, `revolve` for a
pin and a rod-end eye, `lug` for a bracket tang, `bolt` for the fasteners,
`secBlade` for a horn plate. Nothing is a `BoxGeometry` with a rotation; the
kit's own header says why.

Materials, into `AERO_HARD` beside `gear`: knuckles and brackets `bareAlu` on
an alloy wing, `steelTube` on a tube-and-fabric one; pins `chrome`; bushes
`bronze`; the horn plate `steelTube`; a fairing `trim` (it is painted, whatever
it is made of — the spat rule).

### 5.4 The sliders — the common trunk

New rows under the wing / fin / stab parts, presented through the trunk's own
headings (`tools/_cage_parts.js`'s `place` table, `SLIDER-TRUNK-2026-09-03`):

| heading | rows |
|---|---|
| `type` | hinge family (bracket / piano / offset) · **count** (2-6) |
| `position` | hinge inset from the surface ends (`out`) · horn station (`out`) · horn side (a select) |
| `size` | knuckle length / bracket size (`wide`) · horn reach (`len`) |
| `fitted` | hinge fairing · pushrod fairing · mass balance |

Which satisfies "at least positioning" with room to spare, and — the reason for
routing it through the trunk rather than a new group — GATE PARTS then holds
every one of them to a part, and GATE PARTS REACHABLE holds every switch that
can hide one.

### 5.5 Livery

New `AERO_SEC` rows, claimed in `_cage_parts.js` (the step G113.4 nearly
missed — an unclaimed section paints and persists while being reachable from
nowhere):

```
ctlHinge : parent the surface's own section, fin 'bareAlu' pinned
ctlHorn  : parent 'ctlHinge',               fin 'steelTube' pinned
ctlLink  : parent 'ctlHinge',               fin 'steelTube' pinned
ctlFair  : parent the surface's section,    fin 'trim', wears: 'parent'
```

Pinned `fin` + walked tint is the established answer to "hardware that borrows
the aeroplane's colour but never its finish"; `wears: 'parent'` is G207's, and
a fairing is exactly the case it was written for.

### 5.6 What must NOT change

- **Mass and price.** `GEN_OUTFIT.ctlKgM` (`60_gen_spec.js:1161-1165`) already
  bills *"sticks, torque tube, pedals, cables, pulleys, bellcranks and horns"*
  by reach. Drawing them must not bill them a second time. This is the G84
  lesson and it is worth stating in the code.
- **The aerodynamics**, except by an explicit ruling: external horns and
  fairings are a real ΔCd0, and GATE HONEST has the gear-drag precedent, but
  adding drag here without a measurement would be the kind of number this
  project has spent three chantiers removing.
- **`cageSurfHinge`.** G209's measurement of pivot, axis, drive and sign from
  the surface's own vertices is the thing the hardware hangs off. The hardware
  reads it; it does not get a second opinion.

### 5.7 The gate

`GATE HINGE`, core tier, negative-first (`--selftest` breaks each rule):

1. Every surface on every build in the shape set has at least two hinges, and
   they lie **on** the measured hinge line (distance to the line < 1 mm).
2. **The clearance sweep**: every surface swept through its declared travel,
   both ways, no vertex of the surface (or of its hardware) forward of the
   fixed part's own face — F1 and F2 as one assertion that cannot be argued
   with.
3. Every horn is on the surface's part (turns with it), every bracket is not,
   and every link's two ends are the horn's eye and the airframe's fitting —
   at rest and at both travel stops.
4. Declared-vs-drawn: `need` says two aileron hinges and two are drawn; a
   `fowler` flap has a track and a `plain` one does not; no bellcrank cover
   without a bellcrank (which closes the `inspAileron` finding).
5. The pixel pass, at 0.55 m: every new part reads a nonzero fraction of frame
   from a standing viewpoint. Cross-layer occlusion is the failure GATE FIT
   could not see and pixels could.

---

## 6 · THE RULINGS — GIVEN, AND WHAT WAS BUILT ON THEM

The user, same day: **"fixed table for travel, radiused nose, Fowler in,
cockpit in, no tabs"**. All five, in order, and the arc that followed is
G237-G241 (HANDOVER is canonical for what landed; this section is what the
rulings turned into).

1. **Travel — a fixed table.** `GEN_TRAVEL` in 60_gen_spec.js: aileron 25,
   elevator 28, rudder 27, flap 40 (the type's own where it has one — a Fowler
   runs out further than it turns down, so 35). Not a slider: it is what the
   stops are set to. Symmetric, and the code says why. `k` is read from it by
   the generator, published per surface by the join, and read in app.js with
   the old pair as a fallback so an older payload still flies.
2. **The cove — a radiused nose.** `genAfHinge` / `genAfSegNose` /
   `genAfSegCove` in 63_gen_wing.js. The nose is a cylinder about the hinge,
   the cove is the same cylinder plus the rigging gap, and the fixed skins are
   cut back to where they meet it. A rotation does not change a radius, so
   **the clearance is 3.9 mm at every deflection** — a property of the
   construction, not of the angle. GATE WINGSPLIT re-blessed.
3. **Fowler — in.** `GEN_FLAPS.fowler` carries `slide`/`drop`; the flap
   translates as well as turning (241 mm on a stock wing), and its track and
   carriage are drawn — the track with the wing, the carriage with the flap.
4. **The cockpit — in.** The stick, the yoke and the pedals are named moving
   parts driven by the same linkage. One declared gap, stated in HANDOVER: a
   seated dummy's hand does not follow the stick, because the crew is posed by
   IK at build time and the flown model has no skeleton.
5. **Trim tabs — out.** F7 stays open, and stays named.

Everything else in section 5 was built as designed, with two corrections the
work itself forced:
- **A strap hinge's eye is inside the aeroplane and its tails are outside it.**
  The first cut had the two halves reaching from the eye in the same plane and
  fouling each other; they are offset along the hinge line now, which is what
  a piano hinge's alternating knuckles are doing too.
- **The clearance has to be measured STATION BY STATION.** A tapered wing's
  nose radius shrinks along the hinge line, and the widest nose anywhere
  against the tightest cove anywhere reads a 2:1 taper as a 4 mm foul that is
  not there. The binning is also what would catch a cranked panel, where the
  real hinge locus bends away from the straight axis the surface turns about.

## 6b · THE RULINGS AS THEY WERE ASKED (kept for the record)

1. **Travel** — do you want the declared travel per surface as a *builder's*
   row (a slider, "aileron travel ±°"), or one honest table in the spec that
   nobody edits? (Recommendation: the table, with the tail's slot width
   derived from it, so a wide-travel rudder cuts its own slot.)
2. **The wing's cove** — radiused nose about the hinge (any travel is clean,
   the wing changes shape by a millimetre or two, WINGSPLIT is re-blessed), or
   hinge moved to the lower surface with the gap opening on top (the Cessna
   answer, a bigger visual change)? (Recommendation: the radiused nose.)
3. **Fowler** — is F6 in this chantier (a track and a carriage that translate
   the flap aft) or a later one? It is the largest single piece of work in the
   list and the most visible.
4. **The cockpit end (F5)** — in or out? The stick and pedals answering `ctl`,
   with the crew's hands already on them, is a day's work and it is the same
   coherence you are asking for at the other end of the cable.
5. **Trim tabs (F7)** — out, I assume, but they are the one thing a builder
   looking at a real tail will ask for after this lands.

---

## 7 · SCOPE

Arc numbers to claim in HANDOVER before starting (the protocol): **G237-G241**
— (1) travel + the wing's cove, F1/F2, with WINGSPLIT re-blessed; (2) the
declared table and the hinge geometry; (3) the horns and the link mechanism;
(4) sliders, livery sections, fairings; (5) `GATE HINGE` and the pixel pass.

Files that move: `60_gen_spec.js` (the table, travel, `AERO_HARD` rows),
`63_gen_wing.js` (the cove), `_cage_wing.js` / `_cage_fin.js` / `_cage_stab.js`
(drawing, under the existing `edSurf_*` names), a new `tools/_hinge_gen.js`
(the shapes, over `GEAR_KIT`), `_cage_join.js` (the link part's ends),
`app.js` (following them), `aeroskin.js` + `_cage_parts.js` (sections and
claims), `tools/_hinge_check.js` (the gate).

Nothing in the solver. Nothing in the mass ledger. One re-blessed baseline,
with the diff as the record.
