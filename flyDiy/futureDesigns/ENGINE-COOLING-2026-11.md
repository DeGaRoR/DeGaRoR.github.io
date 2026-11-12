# ENGINE COOLING — a study (12 Nov 2026)

Study only: nothing in `src/` or `tools/` changed. The published page (pictures, charts, mock-ups) is the
reading copy; this file is the record. Probes: `node` on the real cards, scripts kept in the session's scratchpad
(listed in §9 so the next session can re-run them).

The user (12 Nov ~02:30): "We're really accurate on a lot of things, but engine cooling we could do better … the
Mustang has this huge protrusion and it has to serve a purpose; I'd rather that be encoded in physics." A0 relayed
(~02:45): "the cooling requirements will need to be part of the CERTIFICATE as well, and if something fails for it,
it should be CLEAR."

---------------------------------------------------------------------------------------------------------------------

## 0. The answer in one screen

- **Today nothing drawn is read.** Cooling costs a fixed drag area per kW of heat (`GEN_DRAG.kCool` ×
  `genEngineThermo().coolKW`), whatever the cowl's openings, the chin scoop or the wing radiators look like.
  The oil temperature needle is a constant 82 °C whenever the engine runs.
- **One small model fixes it:** heat → the air it needs (Q = ṁ·cp·ΔT) → the air the drawn openings pass
  (inlet area × speed × a velocity ratio, capped by the outlet) → a **margin** at the hot-day climb, a **drag**
  from the momentum the air loses, and a **live temperature**. Three measured areas per installation
  (forward-facing inlet, outlet, exposed cylinders), no fins, no CFD.
- **For the light air-cooled cards almost nothing moves** (cooling drag within ±0.005 m², under 1 km/h). The
  model **fixes two real errors**: the per-kW law charges a high-power liquid engine 5× too much (the Spitfire
  WIP pays 0.32 m² today; the momentum figure is ~0.06), and **a cowled pusher has no forward-facing inlet at
  all** (list:6 Twin busher floats 4b: 0.004 m², facing backwards).
- **The certificate gets a cooling row** (hot-day climb, safety tier) and a taxi row (commercial tier), landing
  as `proposed` (the existing door: a warning until the user rules), with existing signatures kept under R3.
- **The pusher gap closes with one switch on the existing scoop**: "faces the flight" (the mouth at the other
  end on a pusher) plus where it sits round the cowl (belly, cheeks as a pair, dorsal). The pusher's own aft
  face aperture becomes its outlet, which the propeller's inflow helps.
- **Size:** ~900 lines over ~10 files, two or three sessions; a new GATE COOL; GEN / DESIGN / AIDS / CERT /
  DRAG re-read.

---------------------------------------------------------------------------------------------------------------------

## 1. What exists (verified, file:line)

| Piece | Where | What it does |
|---|---|---|
| `GEN_ENG_THERMO` | `src/core/00_registry.js:796` | per family: `cool` = fraction of SHAFT power rejected through fins or radiator: four-stroke 0.45 air / 0.42 liquid, two-stroke 0.55 / 0.50, electric 0.11 (1/η − 1), turbine 0.05 (oil only) |
| `genEngineThermo(engine)` | `00_registry.js:817` | → `coolKW = cool × kW` at RATED power (the comment names "a climb at Vy, full throttle, on a hot day" as the sizing case, and an "arc 4 ventilation model" as the planned consumer) |
| `GEN_DRAG.kCool` | `src/core/60_gen_spec.js:1941-1951` | lumped m² per kW of heat: pressureCowl 0.0004, liquid 0.0006, turbine 0.0002, radialBare 0.0030, radialRing 0.0009 (Hoerner ch. 9) |
| the drag build-up's `cool` | `src/core/62_gen_aero.js:636-656` | `cool = k × th.coolKW`; plus `heads` (cylinders outside the cowl, Cd 0.9 on their frontal) |
| off-nose engines | `62_gen_aero.js:1557-1572` | a nacelle's frontal × 0.30 cowled / 0.90 bare ("cylinders, radiator, exhaust, the lot") |
| `GEN_INTAKES` | `60_gen_spec.js:2606-2619` | none / chin / twin cheek / ring: **"Texture only, deliberately"** — louvres drawn on the cover; `S.cowl.intake` is read by nothing in the physics (`60_gen_spec.js:4271`: "texture only, for now") |
| the cowl's apertures | `tools/_cowl_gen.js:628-644` `apertureList` | `apMode` 0 none / 1 central / 2 pair (nostrils) / 3 both; superellipse half-widths `apW/apH`, `pairW/pairH`; fitted inside 0.8 of the barrel-end section |
| the chin scoop | `_cowl_gen.js:994` `buildScoop` | `scoopW/H/Len/Ap/Z…`; `scoopZ` slides the mouth back to the firewall "where a reverse-flow turbine takes its air" — the mouth ALWAYS faces the cowl's +z, the propeller's side |
| the exits | `_cowl_gen.js:499` `exitAt` (the lowered bottom, `exitGap`), `:511` exhaust cut / ramp, `:1119` `gillsFit` / `buildGills` (side louvres, off unless `gillOn`) | geometry only |
| the wing radiators | `tools/_cage_wing.js:346-360` (`radMode` none / a pair / starboard + oil cooler, `radX radAt radLen radW radH radFlap radOilK`), `_cage_parts.js:699` | the row's own comment: **"Its cost is the liquid engine's cooling drag (GEN_DRAG.kCool) - drawn here, billed once."** No `src/core` file reads a `rad*` row |
| the engine's radiator | `tools/_eng_mesh.js:2948`, `_cage_eng.js:557-562` | drawn on liquid engines; geometry only |
| the plaque | `src/viewer/app.js:12925-12933` | "cooling duty  N kW · by radiator / by fins" |
| the solver | `src/core/30_solver.js:2195` | reads `genEngineThermo` for the BURN only |
| `64_gen_build.js:604-616` | the shakedown | carries `coolKW` "until the ventilation-sizing arc consumes it … an honest number on the plaque" |
| the oil temperature | `src/viewer/cockpit.js:356` | `raw.oilT = E.running ? 82 : …` — **a constant**, no simulated temperature |
| cowl flaps | — | none anywhere (`grep -i "cowl flap"`: no hit) |

**Confirmed:** the drawn intakes, outlets and radiators are not read by the physics. Cooling drag is a fixed
per-kW figure, chosen only by the engine's family, its cooling medium, a radial's cowl switch, and whether the
cylinders stand outside the cowl.

---------------------------------------------------------------------------------------------------------------------

## 2. The physics, kept simple

### 2.1 Heat to reject
`Q = coolKW × (power now / rated)`. `coolKW` stays `genEngineThermo`'s (0.45 × shaft for an air-cooled
four-stroke is in the literature's 0.4-0.5 band; a Merlin's 0.42 × 1283 kW = 539 kW matches the order of the
coolant + oil figures quoted for that class of engine).

### 2.2 The air it needs
`ṁ_need = Q / (cp · ΔT)`, cp = 1005 J/kg K. ΔT is the temperature rise the air may take, and it shrinks on a hot
day because the hot side has a limit:

`ΔT = ε · (T_limit − T_ambient)`

| path | T_limit | ε | ΔT at 15 °C | at 38 °C |
|---|---|---|---|---|
| fins (air-cooled heads, baffled) | 160 °C (effective fin wall) | 0.30 | 43.5 K | 36.6 K |
| radiator (glycol / water, pressurised) | 110 °C | 0.55 | 52 K | 40 K |
| electric (motor, controller, pack) | 70 °C | 0.50 | 27.5 K | 16 K |
| turbine oil cooler | 90 °C | 0.50 | 37.5 K | 26 K |

ε (how close the air gets to the hot wall) and T_limit are the two constants per path, PROPOSED; they are
calibrated on the reference-fitted cowls (§3) so that real aeroplanes pass their hot climb with a real margin.
This one line is what makes a hot day bite, and why electric packs are the most hot-day-sensitive.

### 2.3 The air the drawn openings pass
`ṁ_pass = κ · ρ · V_inlet · A_in`, capped by the outlet: `ṁ ≤ κ_out · ρ_hot · V · A_out`.

- `A_in` = the **forward-facing** openings, measured off the drawing (the cowl's face apertures net of the spinner,
  a scoop's mouth when it faces the flight, a radiator duct's mouth). Exposed cylinders count as a bare inlet
  (`A = heads frontal`, κ 0.5: the free stream cools them, and the `heads` drag term already bills them).
- `κ` = the inlet velocity ratio V_in/V_free: 0.3-0.5 for a diffusing inlet with a fixed exit (0.45 used), up to
  0.6-0.7 with the exit opened wide (cowl flaps, a radiator's exit flap).
- `V_inlet` = the true airspeed × the slipstream share. From the actuator disc,
  `f = ½(1 + √(1 + 2T/(ρAV²)))` at the disc; a nose inlet sits behind the propeller's roots, which work less, so
  it gets 60 % of that: 1.09-1.27 in the probed climbs. A pusher's inlets ahead of the wing get 1.0 (no
  slipstream), except an inlet within half a diameter ahead of the disc, which the prop's inflow helps.
- On the ground (taxi, run-up) the slipstream is all there is: `v_disc = √(T/2ρA)` with the static thrust of
  momentum theory. A pusher's forward inlets get nothing then: the classic pusher ground-overheating story.
- **The outlet.** Heated air is less dense, so the classic rule is an outlet ≈ 1.3 × the inlet. The outlet, not the
  inlet, sets the flow: an inlet bigger than needed spills (a good lip makes that cheap); an outlet too small
  throttles everything. Today's cowls mostly draw no outlet (only the Tiger Moth-alike has an `exitGap`): the
  default is an outlet **sized for you** (§5.3).

### 2.4 Cooling drag from the momentum
The air enters at V and leaves at r·V (r < 1: it lost total pressure in the fins or the matrix):

`D = ṁ · V · (1 − r)` → `CdA_cool = 2 ṁ (1 − r) / (ρ V)`

With `ṁ = κ ρ V A`: **`CdA_cool = 2 κ A (1 − r)`** — independent of speed for a fixed geometry. r ≈ 0.7 for a
baffled cowl's exit, 0.8 for a radiator duct with a diffuser. This is the same order as Hoerner's internal-flow
chapter and NACA's cowl work: cooling drag 5-10 % of a light aeroplane's.

The reason radiators sit in big ducts falls out of the same line: the matrix's pressure loss goes as the square of
the velocity through it (`r² ≈ 1 − K (v_core/V)²`), so a big face with slow air (a diffuser ahead of it) keeps r
near 1 and the drag low. **That is what the Mustang's protrusion is for**: a big, deep duct with a diffuser, its
mouth held off the fuselage's boundary layer by a gap, and a variable exit flap.

### 2.5 The Meredith effect
The heat added to the air in a duct is a little ramjet: ideal efficiency `η = 1 − 1/(1 + ½(γ−1)M²) ≈ 0.2 M²`,
about half recovered in a real duct. F. W. Meredith (RAE, 1935) described it, and the Spitfire's ducted
radiators were among the first to use it; the Mustang's belly duct is its refined form. Size of the term:

| | Mach | η (½ ideal) | thrust power recovered | against the duct's drag |
|---|---|---|---|---|
| a Rotax pusher at 45 m/s | 0.13 | 0.2 % | 0.1 kW | < 1 % — nothing |
| Spitfire-class at 150 m/s, 75 % power | 0.44 | 1.9 % | ~7.5 kW (50 N) | ~6 % of ~830 N |
| Mustang-class at 200 m/s, altitude | 0.65 | 4 % | ~20 kW (100 N) | a large share of the duct's drag at high speed |

Recommendation: **one line**, `thrust += 0.1 M² · Q / V` on a duct whose exit is drawn as a nozzle (radiator ducts
with the exit flap trimmed), nothing for cowls. It costs nothing, it is right, and it is why the fighters' ducts
look the way they look. For everything the garage flies today it rounds to zero.

---------------------------------------------------------------------------------------------------------------------

## 3. The cases, measured on the cards

Probes: `probe2.js` (a build file → the joined spec → `buildGen` → the drag build-up, the engine, the cage's
cowl rows) and `cowlarea.js` (the cowl's own `_cowl_gen.js` `apertureList` / `fitAperture` on the saved `cw_` rows,
superellipse areas, net of the spinner disc; the scoop's mouth after its lip and inset), then `margins.js` /
`margins_far.js` (the model above). Liquid / turbine / electric rows marked "hand" use assumed areas.

Cases: **hot-day climb** = FAR 23.1043's standard, 38 °C (100 °F) at sea level, full power at Vy; **cruise** = ISA
sea level, 75 % power at the card's VCruise; **taxi** = the hot strip, 5 m/s, 20 % power, slipstream only.
Margin = air passed / air needed (1.0 = exactly enough).

| plane (list row) | engine | heat kW (hot climb) | inlet drawn m² | inlet needed m² | hot climb | cruise | taxi | note |
|---|---|---|---|---|---|---|---|---|
| list:1 Piper Cub | A-65 air | 20.0 | 0.052 (nostrils) | 0.039 | **1.33** | 2.6 | 2.7 | real Cubs run warm in hot climbs |
| list:50 V2-172 | 5.9 L flat, air | 48.8 | 0.099 | 0.063 | **1.58** | 3.1 | 2.5 | |
| list:2 Jodel D112 | A-65 air | 20.0 | 0.117 | 0.035 | **3.36** | 6.4 | 6.1 | big round face: drag if the exit is not sized (§5.3) |
| list:10 Tiger Moth-alike | Gipsy Major air | 40.0 | 0.0075 + heads 0.099 bare | 0.065 | **~1.8** with the heads | | | the inverted heads stand in the wind (heads drag 0.089 m², already billed) |
| list:47 Carbon Cub SS | CC340 air | 55.3 | 0.041 + heads 0.092 bare | 0.091 | **~1.6** with the heads (0.45 without) | | | the heads poke out of the cowl in the build |
| list:6 Twin busher floats 4b | 916 iS liquid, **cowled pusher** | 49.1 | **0.004, facing aft** | 0.068 | **0 — FAILS** | 0 | 0 | the user's gap |
| list:41 Super Petrel LS | 912 iS liquid, cowled pylon | 28.3 | **0** | 0.047 | **0 — FAILS** | | | closed cowl, no opening at all |
| list:7 Rufus | 912 UL, no cowl | 22.9 | (bare engine) | | **passes** (bare) | | | cowl off = the engine in the wind |
| list:21 pusherLight, list:8 Chinook | 582 liquid, uncowled pushers | 24.0 | (bare) | | **pass** (bare) | | | |
| Stearman-alike (list:9) | W-670 bare radial | 67.6 | the cylinders | | **passes, at a price** | | | `radialBare` already charges 0.22 m² = 19 % of its drag |
| Spitfire-alike (WIP, card) | Merlin 66 liquid, wing radiators (hand) | 539 | 2 × 0.42 × 0.24 × 0.8 = 0.16 | 0.34 (κ 0.45) / 0.25 (flap open) | **0.48** (0.65 flap open) | 1.2 | **0.54** | Spitfires were known to overheat waiting on the ground |
| Caravan card | PT6A-114A, oil (hand) | 23.3 | 0.014 (scoop) | 0.033 | 0.43 | 1.3 | 0.6 | the oil path's constants need their own calibration |
| E-811-class electric (hand) | 58 kW, 6.4 kW heat | 6.4 | 0.010 (assumed) | 0.022 | 0.45 | 1.5 | 0.8 | the pack is the hot-day weak point |

Readings:
- **The reference-fitted air-cooled cowls (Cub, V2-172, Jodel) pass with 1.3-3.4**: the constants put real
  aeroplanes where real aeroplanes are, which is the calibration target. GATE COOL holds them there.
- **Cruise margins of 2.6-6.4** are the excess air a fixed exit pays for: the reason fast aeroplanes have cowl flaps.
- **Turbocharged / supercharged engines get worse with altitude** (power held to the critical altitude, the air
  thinner): a gameplay hook (§6). A naturally aspirated engine loses power faster than its air, so it cools
  better high up.
- **Hand rows** (Spitfire, Caravan, electric) are indicative: the Spitfire's areas are the WIP card's rows, its Vy
  (72 m/s EAS) a type figure; the Caravan's and the electric's areas are assumed.

### 3.1 The drag: today's lumped figure against the momentum figure
With an outlet sized for the hot climb (the default for every plane that draws none):
`CdA = 2 κ A_needed (1 − r)`.

| plane | today (kCool × kW) | momentum, outlet sized | change | effect |
|---|---|---|---|---|
| list:1 Cub | 0.0087 | 0.0106 | +0.002 | −0.1 % speed |
| list:50 V2-172 | 0.0213 | 0.0169 | −0.004 | +0.4 % (~+1 km/h) |
| list:2 Jodel | 0.0087 | 0.0094 | +0.001 | nil |
| list:47 Carbon Cub SS | 0.0241 | 0.0245 | 0 | nil |
| list:6 Twin busher 4b (r 0.8) | 0.0295 | 0.0122 | −0.017 | +1 % (~+2 km/h) |
| list:41 Super Petrel (r 0.8) | 0.0185 | 0.0085 | −0.010 | +0.7 % |
| Caravan card | 0.0050 | 0.0089 | +0.004 | −0.3 % |
| Spitfire WIP (r 0.8) | **0.3234** | **0.060** | **−0.26** | the lumped law's error |

With a fixed outlet drawn too big (or the Jodel's face with no outlet drawn and the "no exit sizing" variant), the
flow is what the inlet passes: Jodel 0.033 m², V2-172 0.028 m², Cub 0.015 m². That is why the default must be
"outlet sized for you", not "outlet = inlet".

**Why the per-kW law fails at high power:** the air needed per kW goes as 1/(ρ V_climb ΔT); the drag per kg/s of air
goes as (1 − r)/ρV. A fast-climbing aeroplane needs a far smaller inlet per kW. One constant per kW, tuned on
light aeroplanes climbing at 25-35 m/s, charges a fighter climbing at 70+ m/s about five times too much.

---------------------------------------------------------------------------------------------------------------------

## 4. What the player sees

The minimum that is coherent and fun, not a sim of fins:

1. **In the garage** — a cooling line on the cowl page (and the wing's radiator page): "hot-day climb 1.58 ×
   the air it needs" with the garage's red / orange / green, beside the openings that set it. A design aid when it
   is short, with the size to draw.
2. **On the certificate** — the cooling rows (§7).
3. **In flight** — the oil temperature becomes real: `T_engine → T_amb + (Q / cp ṁ_flow) / ε`, a first-order lag
   (oil ~3 min). Green under the limit; amber at the limit ("engine hot"); above the red line the engine
   **pulls back power** (detonation margin: 2 % per K over, to 30 %) — the player feels it in the climb, levels
   off, lowers the nose, opens the flaps. **No damage in v1**; a later arc may route sustained over-temperature to
   the drive's existing `overhaul` state (`30_solver.js` GEN_DRIVE `os`).
4. **Cowl flaps** — v1: none as a control; the exit is what is drawn (or sized for you). v2: one row on the cowl
   (`cw_flapOn` + an angle) that the pilot opens on the ground and in the climb and closes in cruise, auto by
   default (the autopilot / the game's pilot does it), a cockpit lever only on aeroplanes that have one. The
   radiators' `radFlap` row already exists and becomes the radiator's exit opening.

Too small an inlet = the engine runs hot in a hot climb and the power drops; too big an outlet = drag in cruise.
The player sees both: the climb rate on a hot day and the cruise speed.

---------------------------------------------------------------------------------------------------------------------

## 5. The pusher gap, and the inputs

### 5.1 Why a cowled pusher has no inlet
On a pusher the cowl is built from the firewall towards the propeller, i.e. backwards (`_cage_cowl.js:444-466`,
the pusher's face on the aft bulkhead). Every opening the cowl generator cuts faces its +z, the propeller's side:
the face apertures and the chin scoop's mouth all face **aft**. On list:6 Twin busher 4b the face aperture nets
0.004 m² round the spinner, facing aft, and the scoop's 0.006 m² faces aft too. `scoopZ` slides the mouth along
the cowl but never turns it round. A cowled pylon (list:41 Super Petrel) draws nothing.

What real pushers do: Rotax pushers put the radiator in a scoop or in the pylon's leading edge (amphibians), the
Long-EZ / Cozy take air through NACA flush inlets or "armpit" scoops under the strakes and dump it at the
propeller, where the prop's inflow sucks it out. **The aft face is the natural outlet.**

### 5.2 The smallest editor addition
On the existing chin scoop (`_cowl_gen.js buildScoop`, the cage's `cw_scoop*` rows):
- **`cw_scoopFace`** 0 = faces the propeller (today, byte-identical), 1 = faces the flight: on a pusher the mouth is
  drawn at the scoop's firewall end. On a tractor 0 and 1 are the same. A pusher born from now gets 1.
- **`cw_scoopAz`** where round the cowl: belly (270°, today's), a cheek pair (± an angle, mirrored), dorsal (90°).
- Optional, later: **a NACA flush inlet** as a scoop style (a cut, no protrusion: lower recovery, ~1.5 × the area).

That is two rows and ~100 lines in `buildScoop` (the lip and the throat move to the other end). With them the
Twin busher needs ~0.07 m² of forward-facing mouth in all (a belly scoop of about 30 × 25 cm, or two cheek
scoops; ~0.05 m² with the exit opened wide), and its aft face aperture becomes its outlet.

### 5.3 The measured inputs (the join)
The join measures a `spec.cooling` block off the drawing (never the player's own rows; listed in `CERT_MEASURED`):
`{ in: [{A, faces:'fwd'|'aft', where:'nose'|'wing'|'pylon', inDisc}], out: [{A}], bare: m², exitSized: bool }`
- inlets: the cowl's face apertures (net of the spinner) when the cowl faces the flight, a scoop's mouth when it
  faces the flight, the radiators' mouths (`radW × radH × 0.8` each), exposed heads (from `S.engBox`, as `heads`);
- outlets: `exitGap` × the bottom's width, the gills' slots, a radiator's exit flap opening, a pusher's aft face;
- **`exitSized`**: true when no outlet is drawn — the outlet is taken as exactly what the hot climb needs. Every
  saved build reads this way, so a saved build's drag moves by the §3.1 column only, and its margin is set by its
  inlet alone.
- a cowl switched off = the engine in the wind: the cooling passes, the `heads` / nacelle drag pays for it (today's
  bill, unchanged).

---------------------------------------------------------------------------------------------------------------------

## 6. What it would bring

- **The honest look.** The Mustang's belly duct, the Spitfire's radiators, a Cessna's nostrils, a Cub's cheeks, a
  Tiger Moth's bare heads: each becomes the answer to a number the player can see. A cowl with no opening stops
  being free.
- **Design aids.** "Your inlet passes 0.6 of what a hot-day climb needs: draw it at 0.09 m²." "The outlet is a
  third of the inlet: the air cannot leave." "This pusher's openings face backwards."
- **The fiche.** The Physics page's powerplant block (`app.js:12925`) gains: cooling air needed / passed at the hot
  climb, the margin, the cooling drag (and the Drag page's `cool` row says where it came from: inlet, outlet, κ, r).
- **Gameplay.** Hot days (the climate's `dISA` already exists, 09_climate): a heavy climb out of a summer strip
  runs hot. **Altitude with a turbo**: a turbocharged Rotax or a supercharged radial climbing high runs hot (power
  held, air thinner) — a step-climb or open flaps. Taxiing a pusher on a hot day. Ferry jobs to hot places.
  Electric: a hot day shortens a hard climb.

---------------------------------------------------------------------------------------------------------------------

## 7. The certificate (A0's addition)

### 7.1 The rows
Read where the bench reads the design check (`64b_gen_design.js genDesignCheck` rows → `genCertTiers`;
`GEN_CERT_TIER` at `64b_gen_design.js:536`):

| id | group | label | value | limit | tier |
|---|---|---|---|---|---|
| `cool.climb` | engine | Engine cooling, hot-day climb (38 °C at sea level, full power at Vy) | 1.58 × the air needed | fail < 1.00; warn 1.00-1.15; pass ≥ 1.15 | **safe** (an engine that overheats in the climb is not safe) |
| `cool.taxi` | engine | Engine cooling on the ground (hot strip, taxi power) | 2.5 × | warn < 1.0 | **comm** (runs hot on the ground: impractical, not unsafe; the Spitfire's own story) |
| (cruise) | — | the cruise margin and the cooling drag | | | no row: the Drag page, not the certificate |

The hot case: FAR 23.1041-1047 flies the climb cooling test corrected to 100 °F (38 °C) at sea level. Default: use
it, not `GEN_DA_CASES.hot` (1000 m ISA+20), because it is the regulation's own number and the player can read it.
The bench's climb is analytic (no flight needed): the margin comes from the joined spec, the shakedown's Vy and the
atmosphere — milliseconds, cached with the rest.

### 7.2 What a FAIL looks like (the garage's style: what, by how much, what to draw)
- *Engine cooling (hot-day climb): the inlets pass 0.45 of the air a 38 °C climb needs. Enlarge the nose inlets to
  about 0.09 m² (now 0.041), or let the cylinders' heads stand in the air.*
- *Engine cooling (hot-day climb): no opening faces the air. This cowl's openings face the propeller, which on a
  pusher is backwards: in a hot climb the engine gets none of the 1.23 kg/s of air it needs. Turn the scoop to face
  the flight (cowl page: scoop faces → the flight) and size it to about 0.07 m², for example a mouth of 30 × 25 cm.*
- *Engine cooling (hot-day climb): the radiators pass 0.48 of the air. Grow each radiator's mouth to about
  0.17 m², or open the exit flaps (exit flap → 20°).*
- *Engine cooling (hot-day climb): the inlet is big enough but the outlet is not: the air cannot leave (outlet
  0.02 m², 0.08 needed). Lower the cowl's bottom (exit gap) or add gills.*

Where it appears: the bench's certificate sheet (the row, with the tag "not safe to fly" once ruled), the key
issues (`64c_gen_aids.js genKeyIssues`, ranked with the safety tier), the cowl page's cooling line, the fiche's
Physics page (margin + the line in plain words).

### 7.3 Existing certificates (R3: "a game update is not a change to the aeroplane")
How it works today: a certificate is the signature `{fp, safe, comm}` on the airframe (`74_career.js:350
careerCertOf`); the fingerprint `f3` hashes only the design's MAJOR rows, no version tag (`66b_cert_rule.js:7-16`);
a maker's plane keeps the maker's certificate unless modified; **the bench re-signs at every roll-out**
(`74_career.js:361`) — so a new failing row would withdraw a certificate the next time the plane rolls out, which
is exactly what R3 forbids.

Proposal (Default):
1. **Land the rows `proposed: true`** — the existing door (`64b_gen_design.js:527`, `bench.js:84-85`): a new safe
   check is "safety · proposed: a warning for now". The user rules after GATE COOL's fleet sweep.
2. **After the ruling, a signature is kept**: the signature records the rule set it was signed under
   (`sign.rules: 'cool1'` absent = before). At roll-out, an airframe whose `f3` equals its signed `f3` and whose
   signature predates the cooling rule keeps its pass. Its certificate carries a **notice** — an operating limit in
   R2's sense, not a withdrawal: *"Certified before the cooling rule. In a hot climb this engine gets 0.6 of the air
   it needs: climb at reduced power on hot days, watch the oil temperature."* The live gauge tells the same truth
   in flight.
3. **Any MAJOR change** (the cowl, the engine, the structure: R4) re-runs the bench, and then the cooling row judges
   like every other row.
4. **Maker planes** (`76_procure.js` catalogue): the catalogue must pass before it ships (a GATE COOL row over
   `procureCatalogue`); if one fails, its catalogue entry gets the scoop, not the player's plane.
5. Who is affected today: **list:6 Twin busher floats 4b** (official, a cowled pusher) and **list:41 Super Petrel
   LS** (internal, cowled pylon). Everything else in the probe passes.

---------------------------------------------------------------------------------------------------------------------

## 8. What it would take

| file | what | ~lines |
|---|---|---|
| `src/core/60_gen_spec.js` | `GEN_COOL` (the per-path T_limit / ε, κ, r, the slipstream share, the FAR case, the Meredith factor); `GEN_INTAKES`' comment retired (the louvres stay a texture on top of a measured opening) | 60 |
| `src/core/62d_gen_cool.js` (new) | `genCooling(S, def, case)` → `{need, pass, margin, inA, outA, flowKgS, cda, meredithN, tempC}`; the three cases | 220 |
| `src/core/62_gen_aero.js:636-656` | the `cool` term = the momentum figure from `genCooling` (kCool kept only for a spec with no `cooling` block) | 40 |
| the join: `tools/_cage_cowl.js`, `_cage_wing.js`, the load chain | measure `spec.cooling` (§5.3) | 160 |
| `tools/_cowl_gen.js` `buildScoop` + `_cage_cowl.js` rows | `cw_scoopFace`, `cw_scoopAz` (+ the pair) | 120 |
| `src/core/64b_gen_design.js`, `64c_gen_aids.js` | `cool.climb`, `cool.taxi`, tiers, the remedies in sizes | 90 |
| `src/core/66b_cert_rule.js`, `74_career.js`, `bench.js` | `CERT_MEASURED.cooling`; the signature's rule set; the kept-signature notice | 60 |
| `src/core/30_solver.js` + `src/viewer/cockpit.js:356`, `gps_face.js` | the engine temperature state, the power pull-back; the gauge reads it | 80 |
| `src/viewer/app.js` (fiche), the cowl page | the cooling lines | 60 |
| `tools/_cool_check.js` (GATE COOL) | the fleet sweep, the calibration rows, the pusher with and without the scoop, the Spitfire drag sanity, R3's kept-signature test | 150 |

About 1 000 lines; **two to three sessions** (1: the model + the measured block + GATE COOL with the cert rows
proposed; 2: the scoop's facing + the pusher cards + the gauge; 3: cowl flaps, if wanted).

Gates that move: **GEN** (the shakedown anchors move with the drag: re-read, never hand-edit), **DRAG** (the build-up's
`cool` row), **DESIGN** and **AIDS** (two new rows), **CERT** (proposed rows withdraw nothing; the kept signature),
**ARCHETYPES / HOTHIGH** (full tier: the hot cases), PRICE untouched (no new parts billed in v1).
What moves in certified numbers: cruise and Vmax by under 1 % on the air-cooled cards, +1-2 % on the liquid
pushers (they were overcharged), nothing on the bare engines; the Spitfire WIP's drag falls by 0.26 m².

---------------------------------------------------------------------------------------------------------------------

## 9. Questions for the user (each with its default)

1. **The hot case.** FAR's 38 °C at sea level, full power at Vy — or the game's own 1000 m strip at ISA+20?
   Default: FAR's 38 °C (the regulation's number; the strip case stays the performance page's).
2. **The tier.** Hot-day climb cooling = safety (no airworthiness certificate if it fails); ground cooling =
   commercial. Default: yes, both, landing `proposed` first.
3. **Existing certificates.** Kept until the design's major rows change, with a notice — or re-checked at the next
   roll-out? Default: kept with the notice (R3).
4. **In flight.** A live oil temperature and a power pull-back over the red line, no damage — or also engine damage
   after minutes over the limit? Default: no damage in v1.
5. **Cowl flaps.** v1 without (the exit is what is drawn, or sized for you), v2 as a cowl row, auto by default?
   Default: v2.
6. **The pusher scoop.** "Faces the flight" + belly / cheeks / dorsal on the existing scoop, NACA flush later?
   Default: yes; NACA flush later.
7. **Undrawn outlets.** An undrawn outlet counts as sized for the hot climb (old builds' drag barely moves) — or as
   nothing (a cowl with no drawn exit fails)? Default: sized for you, with a design aid saying "draw it".
8. **Meredith.** The one-line thrust credit on drawn radiator ducts? Default: yes (rounds to zero on everything we fly).

Probe scripts (the session's scratchpad, not committed): `probe2.js` (build files), `probe3.js` (archetype births —
the node birth lacks the engine page, so its engines are placeholders: not used for figures), `cowlarea.js` (the
cowl's openings via `_cowl_gen.js`), `margins.js` (1000 m ISA+20), `margins_far.js` (38 °C sea level).

---------------------------------------------------------------------------------------------------------------------

## 10. IMPLEMENTED (12 Nov, same day; the user: "OK with your defaults ... code that")

The user's correction first: **list:41 Super Petrel has a forward inlet, modelled through the nacelle** (the tail cone's
inlet, G3914 `cw_inletOn`: on a pusher the cone is the nacelle's NOSE). It is now measured and counted: 0.038 m2, which
at 38 C gives 0.81 x the air its 912 iS needs (a proposed warning, sized remedy: 0.054 m2). The Twin busher has nothing.

What landed (the study's §8, session 1 + the scoop of session 2):

| piece | where |
|---|---|
| `GEN_COOL` (the constants, as §2) | `src/core/60_gen_spec.js`, after GEN_DRAG |
| `genHeadsFrontal`, `genCoolOpen` (which way each measured opening faces), `genCooling` (the cases, the drag, Meredith), `genCoolSummary` | `src/core/62_gen_aero.js`, before genFusCdA |
| the drag build-up's `cool` = the momentum figure when the cowl is MEASURED (or radiators are drawn); bare and unmeasured engines keep the per-kW figure bit for bit; the climb / cruise speeds GEN_VRATIO x Vs (genFusCdA gets Vs: no circularity); one engine on the body row as before (wing nacelles pay in the nacelle rule); never less than the needed air's drag (a starved engine does not fly faster); `drag.coolBy` says which | `62_gen_aero.js` genFusCdA |
| the measurement: `CW.coolOpenings()` (face apertures net of the spinner, the scoop's mouth, `scoopRev`, the nacelle cone's inlet, the lowered bottom, the gills) published as `window.CAGE_COOL_OPEN` by the cowl layer; the join writes `spec.cooling` (every key, every time) | `tools/_cowl_gen.js`, `tools/_cage_cowl.js` cowlPlace, `tools/_cage_join.js` |
| R3: `spec.cooling` is a MEASURED block - `CERT_MEASURED_BLOCKS` in certStrip, `BENCH_COSMETIC` (the old f2 body), `PROCURE_READOUTS` (p1) | `66b_cert_rule.js`, `bench.js`, `76_procure.js` |
| the scoop turned round: `cw_scoopRev` (absent 0, bit for bit), the mouth at the firewall end, rings reversed so the skin stays outward; the row "mouth faces: the propeller / the firewall (a pusher: into the air)" | `_cowl_gen.js` buildScoop, `_cowl_rows.js`, `_cage_cowl.js` ABSENT_AT, `_cage_parts.js` |
| `cool.climb` (safe) and `cool.taxi` (comm), PROPOSED, with the remedy sized to the pass line (1.15 x): which openings, how big, a mouth in cm, the outlet when the air cannot leave | `64c_gen_aids.js` genCoolRows (in genDesignAids), `64b` GEN_CERT_TIER |
| `genCertTiers`: a PROPOSED fail is a warning on BOTH certificates (it failed the commercial one before; no row was proposed until these) | `64b_gen_design.js` |
| the fiche's powerplant block: hot-day climb air, the openings, the cooling drag | `64_gen_build.js` (shakedown `cooling`), `src/viewer/app.js` |
| GATE COOL (core) | `tools/_cool_check.js`, `run_gates.js` |

Measured after (the load door, 38 C at sea level): list:1 Cub 1.63, list:50 V2-172 1.66, list:2 Jodel 5.18, list:10 Tiger
Moth-alike 1.81 (heads), list:47 Carbon Cub SS 1.65 (heads), list:41 Super Petrel 0.81, list:6 Twin busher 0 (and the
remedy's own steps take it to a pass: turn the scoop, size it, draw an exit), list:7 Rufus bare. Cooling drag: Cub 0.0087
-> 0.0114, V2-172 0.0213 -> 0.0178, Jodel 0.0087 -> 0.0100 m2.

Not in this landing (said, not hidden):
- **the power pull-back over the red line** (default 4): it would change how the official list:6 flies on every flight;
  it lands with the user's ruling on the proposed rows. The oil needle is live (display only): parked until the gate
  battery had run, then landed with the same GATE COOL section (THE NEEDLE: list:1 Cub 60 C in the cruise, 95 C in a
  38 C climb, under the 118 C red line; list:6 Twin busher 168 C, the needle on its stop).
- **the kept signature** (§7.3 step 2: `sign.rules`): not needed while the rows are proposed (they withdraw nothing);
  it lands with the ruling.
- **cowl flaps** (default: v2), the scoop's azimuth (cheeks / dorsal) and a NACA flush inlet (default: later).
- **radials**: a cowled radial is judged on its drawn front; the DC-3-alike candidate's saved front is a 0.70 x 0.24 m
  slot (0.10 m2 for two 895 kW engines' worth: 0.25 x) - the card's drawing, not the model.

## 11. THE SECOND LANDING (12 Nov; the user: "we can make the row, but we have to modify the twin busher and the superpetrel at once ... let's have at least a top scoop ... the superpetrel, it has quite a large opening now. Let's fix that")

What landed:

- **A pusher's propeller sucks on its outlet** (`GEN_COOL.suck` 0.6). The Petrel's opening was measured right: its
  throat is 0.038 m2, the drawn hole, about 24 x 22 cm in a 57 cm nacelle. What the model missed is the pusher's own
  help. The cowl's outlet sits just ahead of the disc, where the static pressure falls by rho/2 ((V + v)^2 - V^2) of
  the induced velocity v. The pressure driving the air through the engine grows, and the flow grows with its root:
  V_in = V sqrt(1 + suck (f^2 - 1)). This applies in flight only; the ground keeps its `pushInflow` law. The Petrel's
  air runs at 1.18 x its climb speed, which takes it from 0.81 to 0.96.
- **list:41 Super Petrel LS**: its nose inlet goes from 0.42 to 0.47 of the nacelle (0.048 m2). It now passes the hot
  climb at 1.20, and its cooling drag is unchanged (the outlet is sized for you).
- **list:6 Twin busher floats 4b**: the chin scoop is turned to face the flight and rides the bottom line, with
  half-sizes 0.20 x 0.15 m and a 0.9 mouth opening, and the cowl's bottom is lowered with an exit gap of 0.22. It goes
  from 0 to 1.22. Its oil reads 108 C in the hot climb, against 168 C before. Its cooling drag rises 0.018 -> 0.021 m2.
  A top scoop is no use on this plane: the cowl's top sits under the wing.
- **The top scoop** (`cw_scoopTop`, row "sits: under the cowl (a chin scoop) / on top of the cowl"). It is the same
  scoop mirrored above the spine: the rake lifts the mouth away from the skin, and when it follows, it follows the
  deck line. Absent means the chin scoop, bit for bit.
- **Only the open part of a mouth is measured** (`coolOpenings`): the scoop's opening is sampled against the cowl's
  own section at the mouth's station. The first sizing of the Twin busher's scoop showed why this matters. Its rows
  said 0.07 m2, but the scoop was drawn inside the deep cowl, so the drawing had a notch. The row now says so ("the
  scoop is drawn inside the cowl's skin"), and the pusher remedy says to stand the scoop out of the skin.

**Not landed: the rows going real.** A sweep of every card on the lists and every archetype the shed births finds
more fails than the two planes (38 C, full-power climb, after this landing):

| | fails |
|---|---|
| official | list:13 STOL Cub 0.65, list:26 Client Cub 0.97 |
| candidates / internal | list:12 DC-3-alike, list:22/31 twinBoomFail, list:23 B-ITES 0.94, list:27 Ultralight twin on floats, list:28 Single-seat ultralight, list:38 sailPlane, list:33-36 the older Twin bushers, list:42-46 the older Petrels (0.94-0.96) |
| archetypes (a new player's first design) | rv 0.57, spitfire 0.39, caravan 0.05, beaver 0.66, sesqui 0.89, ul1 0.86, motorglider 0.88, ttail 0.95, vtail 0.99; and the wing-nacelle twins da62, twinBush, p38, fourEngine, floatplane at 0, because their nacelle cowls are drawn closed (`cw_apMode` 0: no front at all) |

Going real today would withdraw two official certificates and leave nine of the archetypes, plus the five wing
twins, uncertifiable from birth.

The tractor fails also raise a calibration doubt. The rv archetype draws 0.039 m2 for 134 kW, about what a real RV
has, and real RVs cool in a hot climb (marginally). A single inlet velocity ratio (`kappa` 0.45) is likely too harsh
on small, efficient pressure-cowl inlets. Their velocity ratio climbs well above 0.45 at climb speeds, and the
baffles' resistance, not the inlet, limits the flow.

The proposal, for the user's ruling:
1. calibrate on an RV-class cowl (the inlet ratio rising as the inlet shrinks, the baffle limit);
2. re-sweep;
3. open the wing twins' nacelle faces and re-draw whatever still fails among the official cards and the archetypes;
4. then rule the rows real, with `sign.rules` for kept signatures.

## 12. THE THIRD LANDING: THE ROWS RULED (12 Nov; the user: "you can just add a rule and regenerate them ... the client cub, you have the cylinder heads themselves sticking out of the cowl ... check Rufus ... the twin engine on floats ... recalibrate ... coefficients around the opening ... pusher-puller inline should allow for a scoop on the aft engine")

**What the user asked, and what was found:**

- **The Client Cub (list:26, official, was 0.97).** Its heads do poke through its cowl. The generator's covers-the-sides test
  read its own loft, not the drawing. The heads are now MEASURED against the drawn skin: the engine layer maps each
  cylinder's frontal strip into the cowl's frame (`COWL_GEN.coolHeads`, `spec.cooling.headsOut / headsAll`). The Client
  Cub has 0.046 m2 of heads in the wind and passes at 2.77 with its card unchanged.
  A proper Cub-style CUT round each head is a garage gap: the cowl has a sector "horseshoe" (the Camel's), not head
  cut-outs. It is proposed, not built.
- **Rufus (list:7, no cowl).** It gets its own figure now: 0.097 m2 of cylinders in the wind, 2.54 x what a 38 C climb
  needs. An electric motor in the open air passes without a figure.
- **The Tiger Moth-alike candidate (list:10).** The same measurement found its cylinders INSIDE its drawn cowl, where the
  generator's loft had said 0.099 m2 out. With a 0.007 m2 front it fails at 0.17. It is a reference-fitted card, left as
  drawn.
- **The Ultralight twin on floats (list:27).** Its chin scoops were counted (0.014 m2 each, facing the flight). They were
  mostly buried in the nacelles (0.16 m tall). Riding the bottom line at 0.14 x 0.11 takes it from 0.62 to 1.50.
- **A FACING ERROR, found on the way.** The lowered bottom's crescent and the gills' hoods open towards the cowl's FIREWALL
  end. On a pusher, whose cowl is turned round, that end faces the flight, so they are inlets there. A pusher's way out
  is its face, round the spinner. The second landing's Twin busher "exit gap" (0.22, outside the row's 0-0.08 range)
  was therefore an inlet. The Twin busher is redrawn: no exit gap, and the face round the spinner opened (0.2 m
  half-sizes) as the way out, behind the turned scoop. It passes at 1.35.

**The recalibration, on the opening's own coefficients (the user's words).** Three resistances in series replace one
inlet ratio (kappa 0.45):

    mdot = 1 / sqrt(1/(ivr rho V A_in)^2 + 1/(passages x need)^2 + 1/(ivr rho V A_out / 1.3)^2)

- `ivr` 0.8 is the inlet's best velocity ratio: a small inlet runs near it.
- `passages` 3.0 is the engine's own fins and baffles, at its hot climb: a big inlet spills past them.

The reference cowls now read: the Cub 2.08, the V2-172 2.11, the Jodel 2.85. The rv archetype goes from 0.57 to 3.21;
its heads stick out too. The drag is unchanged wherever the outlet is sized for you: it is the needed air's momentum,
the same expression.

**The Super Petrel goes back to the user's drawing (0.42 of the nacelle).** Under the series law and the pusher's
suction it passes at 1.48; the second landing's 0.47 was not needed.

**The push-pull.** Every engine on the body is judged, and the worst answers. The rear engine wears the nose cowl turned
round, so the new row `cw_scoopAft` ("the rear engine's scoop: as the nose cowl's / turned: into the air") turns the
aft cowl's scoop on its own. The cowl layer rebuilds that scoop on the aft clone, and the measurement carries the
scoop's other end (`scoopAlt`) and each unit's area factor. The Skymaster-alike: nose 3.03, rear 2.78.

**The archetypes (the user: "add a rule and regenerate them").** `_cage_design.js designCoolBirth` opens each archetype
at birth to 1.4 x its engine's need at a climb speed that grows with its power (32 m/s at 100 kW, x kW^0.3, 28-75 m/s).
It never shrinks what a card draws:
- a puller opens its front round the spinner, plus a chin scoop where the face cannot hold it (wing nacelles, inline
  and vee engines);
- a pusher gets its scoop turned and riding the bottom line, and its face opened as the way out;
- a nacelle cone opens its inlet;
- a layout's rear engine gets `scoopAft`;
- a liquid engine with wing radiators gets bigger radiators (net of the nose). The Spitfire-alike's grow to 0.57 x
  0.33 m, a Spitfire IX's own;
- a turbine gets its oil cooler's scoop. The turbine cowl style's scoop now stands out of the skin, at 0.55 x 0.40 of
  the barrel.

All 32 archetypes pass.

**THE RULING.** Both rows are real (no longer `proposed`); the `proposed` door stays in genCertTiers for the next new
check. Every official card passes; the STOL Cub warns at 1.08 (the user: "we really don't care about that one").
A certificate already signed keeps its stored bench check until the aeroplane changes or the bench runs again (R3:
nothing here bumps GEN_SPEC_V or PHYSICS_V).

Still failing (not official):
- list:10 Tiger Moth-alike, 0.17;
- list:22/31 twinBoomFail;
- list:28 Single-seat ultralight, 0.6;
- list:33-36 the older Twin busher reviews.

**Open.**
1. The Cub-style head cut-outs (a garage gap).
2. The power pull-back over the oil's red line (default 4): not built. It changes how an overheating aeroplane flies,
   and no official card overheats now.
3. Cowl flaps (v2).
4. A NACA flush inlet.
