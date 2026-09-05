# TURBOPROPS AS AN ENGINE CATEGORY — a study (2026-09-05)

The user: "turboprops; let's study what it would take for us to have
turboprops as a special engine category?"

This document is the study asked for. It states what exists that the arc can
stand on, the three rulings the user gave while it was written, the laws, the
rows, the gates, the session split, and what is deliberately left out. Nothing
here is built. The one-paragraph costing in HANDOVER G176 ("two sessions",
ROADMAP Phase 6 item 7) is superseded by this file.

**The three rulings (2026-09-05):**
1. The deliverable of this session is THIS STUDY, no code.
2. The bench derives a turboprop's power FROM ITS GEOMETRY — the electric
   can's precedent (torque is geometry, `elecResolve`), not a declared-kW fiche.
3. ONE layout: the PT6 REVERSE-FLOW (rear inlet under a chin scoop, exhaust
   stacks at the front beside the gearbox). Straight-through engines (TPE331,
   Walter M601, Allison 250) are a later style row.

Without this arc a Caravan/Kodiak-alike is an R-985 with a long nose: right
power, wrong mass (twice), wrong lapse (a piston's), wrong fuel, and a radial
cowl round a can.

## 0. What already exists

Every engine in the game is described by THREE INDEPENDENT KEYS, and nothing
in source knows the word `turbine` — every hit is prose in a doc or a comment.

- **`aspiration`** (physics; `src/core/00_registry.js:25-32`): `'na' |
  'electric'`. "The only thing in this table the atmosphere reads." One
  switch point: `atmosPowerRatio(sig, aspiration)` at `src/core/05_atmos.js:110-115`
  (Gagg-Ferrar for a piston, 1 for a motor) and `atmosPropScale` at `:135-139`.
  Read by the solver at `src/core/30_solver.js:44-45` (`ASP`), `:201`, `:605`
  (`probeAir`), `:611` (`thrustAt`), and by GATE ATMOS (`tools/test_atmos.js`).
  `'turbo'` is RESERVED and unread (`:46-48`): "a field that lies quietly is
  worse than one that is missing."
- **`family`** (thermo; `GEN_ENG_THERMO` `00_registry.js:271-275`): `four |
  two | electric`, each `{sfcKgKWh, eta, cool:{air, liquid}}`. ONE reader,
  `genEngineThermo` `:281-298`, whose legacy fallback at `:283-284` turns any
  unknown family into `'four'` — the exact trap where a turboprop silently
  becomes a piston. `genEnginePrice` `:305-312` branches on family too.
- **`arch`** (bench geometry; `ENG_ARCH` `tools/_eng_gen.js:100-159`): `flat |
  inline | vee | radial | electric`. A registry row never carries `arch`; the
  R-1830 radial is `family: 'four'`. The mesh refuses anything else at
  `tools/_eng_mesh.js:215-219`.
- **The electric precedent** — the closest thing to "an engine with no
  cylinders": `elecResolve(P, spec)` `_eng_gen.js:284-360` returns the same
  contract as the combustion resolve (`env` with a 16-point circular hull,
  `cgZ`, `items`, `place` with `caseR/zAft/zOf/nSt` satisfied trivially, plus
  its own `canR/zCanF/zCanB`), every dimension a ratio of `canD/canL`, no
  metre constants. The mesh's electric branch is self-contained
  (`_eng_mesh.js:894-1276`, early return at `:1273`), and the mesh gate's
  `caseSDF`/`zTailOf` (`tools/_eng_mesh_check.js:163-202`) branch on
  `arch === 'electric'` reading `place.zCanF/zCanB/canR`.
- **The thrust model** reads `engine.aspiration`, `engine.mass`,
  `prop.D/Tstatic/kV2` and nothing else. There is NO shaft rpm anywhere
  (`src/core/60_gen_spec.js:1100-1102`); `ENG_DEFAULT.gearRatio` (`_eng_gen.js:244`)
  is a dead field nobody reads; `ctl.thr` is a plain 0..1 on thrust.
- **The burn model does not exist.** SFC is a plaque readout only
  (`src/core/64_gen_build.js:466-473`, `src/viewer/app.js:3476-3485`, which
  hardcodes avgas at `burnKgH / 0.72`). `GEN_FUELS` (`src/core/60c_gen_energy.js:172-179`)
  has `avgas100LL` and `mogas`, no kerosene. The fuel/battery split is one
  discriminator in `genVesselResolve` `:240-278`.
- **The cowl follows the engine** (G154): `COWL_BY_ARCH` `tools/_cage_cowl.js:525-544`
  — `flat/inline/electric: null` (a decision recorded), `radial` styled and
  sized off `env.radius`. `CAGE_COWL_FOR_ENGINE` `:550-585` is pure; GATE COWL
  §3 (`tools/_cowl_check.js:345-350, 376-380`) asserts "exactly one
  architecture changes anything".
- **The editor**: `engPower` 'powertrain' is a BINARY row `['piston','electric']`
  (`tools/_cage_eng.js:255`); `archOf` `:82-84` short-circuits the arch drop
  on it; `CAGE_ENG_FACTS` `:157-203` DERIVES family (`:171`) and aspiration
  (`:170`) from the arch with the binary hardcoded four times; the design tile
  read at `tools/_cage_design.js:853-854` is the same binary; `applyEngPreset`
  `:458` writes it.
- **Sound: none.** No AudioContext anywhere outside vendor three.js. Nothing
  keys on cylinders or rpm. A turboprop needs no sound work.
- **DRACO** (a PT6 Wilga) exists as a reference-plane mesh with no preset
  (`src/viewer/refplane.js:133`) — a stance to measure against, later.

## 1. The shape of the category — three keys, one new number

A turboprop needs a value in each of the three keys, and ONE number no engine
has had before.

- `aspiration: 'turbine'`. Keep `'turbo'` reserved: a supercharger holds a
  piston's power to a critical altitude by a different mechanism, and the DC-3
  is still owed that model; a turbine is not a blower.
- `family: 'turbine'` in `GEN_ENG_THERMO`:
  `{ sfcKgKWh: 0.35, eta: null, cool: { air: 0.05, liquid: 0.05 } }`.
  A PT6 at rated power burns 0.33-0.37 kg/kWh (0.55-0.60 lb/shp-h); a turbine
  sheds its heat BY THE PIPE — the cowl only cools the oil, ~5 % of shaft
  power, which is why a turboprop nacelle is closed where a radial's is a ring.
  `genEngineThermo` needs no change (the lookup at `:283` finds the row); GATE
  ENGINE's piston branch (`tools/_engcustom_check.js:45-50`, burns-not-draws)
  passes it as written.
- `arch: 'turbine'` in `ENG_ARCH`, the electric row's shape (`:155-158`):
  `{ name: 'Turboprop', counts: [], kM: 1, bmep: 0, angles: () => [],
  stations: () => [], nStations: () => 1 }`. `counts: []` so the shape loop
  in `tools/_eng_check.js:111-135` (which `continue`s only for electric at
  `:113`) has nothing to iterate — or add `|| key === 'turbine'` there.
- **`flatK`** — the flat-rating margin, thermodynamic power over rated power,
  1.0-1.6, on the ENGINE dict (registry row and custom row alike). It is the
  one number that makes a turbine's altitude behaviour different from a
  piston's, and it is per engine: a PT6A-114A is rated 675 shp from a core
  good for ~850; a -34 is rated 750 from ~1000. Carried through the custom-row
  clamp at `60_gen_spec.js:2404-2417` as `cu.flatK = genClamp(cu.flatK ?? 1, 1, 2)`.

## 2. The physics law — flat rating (05_atmos)

A turbine's THERMODYNAMIC power falls with mass flow, which falls with
density (~sigma at constant turbine inlet temperature). Its RATED power is
held flat below that by the fuel control, so the aeroplane sees rated power
until the two lines meet, then the lapse:

```
atmosPowerRatio(sig, aspiration, flat = 1)
  if (aspiration === 'electric') return 1;
  if (aspiration === 'turbine')  return Math.min(1, flat * sig);
  return Math.max(0, 1 - 1.132 * (1 - sig));            // Gagg-Ferrar
atmosPropScale(sig, aspiration, flat = 1)   // passes `flat` through
```

- Exactly 1 at sigma = 1 for every family, so GATE ATMOS's sea-level identity
  (`tools/test_atmos.js:60-65`) stands. With flatK 1.26 the -114A holds rated
  power to sigma 0.79 (~2 300 m ISA, or a 35 °C day at 1 200 m), then lapses
  ~sigma. A piston at sigma 0.79 has already lost 24 %.
- `kT`/`kV` in `atmosPropScale` are DERIVED from the same three prop lines the
  file's header re-derives (`:117-134`); nothing there changes — the turbine
  is one more `pr`.
- **Callers** (the engine dict is already in scope at every one): `30_solver.js:44-45`
  gains `const FLAT = (EN && EN.flatK) || 1;` and passes it at `:201`, `:605`,
  `:611`. `tools/test_atmos.js:166,171` (§8, "every value is 'na' or
  'electric'") widens the enum; §6 (`:116-126`) gains "flat band, then
  lapses". `60_gen_spec.js:2411` (`cu.aspiration` two-way) becomes three-way.
- **GATE HOTHIGH** (`tools/test_hothigh.js` §3 `:150-193`, tier full): a third
  sheet through `genDensityAlt` (`64_gen_build.js:876-901`): `tur.hot.aspiration
  === 'turbine'`, `tur.hot.power === 1` at the hot-day sigma (~0.93, inside
  the flat band), `tur.ratio < pis.ratio`, and a new thin-air case above the
  flat-rating density altitude where `tur.power < 1` (the `sim.setAtmos` +
  `probeAir()` pattern `genDensityAlt` itself uses at `:886-889`).

**Honest cuts, declared here so nobody has to wonder:**
- Flat rating is really TURBINE-INLET-TEMPERATURE limited: a hot day bites a
  turbine through temperature more than through density. `sigma` alone is the
  first cut; the sign is right (hot and high both thin the air) and the
  magnitude is close enough for the game's density-altitude sheet. A second
  cut would split `sigma` into its pressure and temperature halves, which
  `makeAtmos` already has.
- Residual JET THRUST from the stacks (~5 % of prop thrust on a PT6) is not
  modelled. It would be a `jetN` per kW on the row and one term at
  `30_solver.js:242`; the propeller synthesis would then be 5 % generous. Owed.
- PART-LOAD SFC: a turbine at 50 % power burns ~1.3x its rated SFC per kWh, a
  piston ~1.05x. The thermo row is quoted at RATED power like the others
  (`00_registry.js:251-253`), and the burn model that would read the shape
  does not exist. When it lands, `GEN_ENG_THERMO` wants an `sfcPartK` curve
  per family; the turbine is the family that makes it matter.
- No beta / reverse pitch, no start sequence, no ITT. A turbine that idles at
  20 % fuel flow is a burn-model fact, not a thrust-model one.

## 3. The bench law — power from geometry (ruling 2)

`turbResolve(P, spec)` beside `elecResolve` (`_eng_gen.js:284-360`), dispatched
at `:367` where the arch is read, returning the SAME CONTRACT: `env` (a
16-point circular hull of the enclosing radius — the inlet plenum on a PT6),
`cgZ`, `items`, and a `place` that satisfies the combustion keys trivially
(`caseR/zAft/zOf/nSt/pitch/r0/cylLen/rTip/headR/sump`) AND carries the
electric-style `canR/zCanF/zCanB` so the mesh gate's `caseSDF`/`zTailOf`
(`_eng_mesh_check.js:163-202`) read it through the branch they already have.

**1. Mass flow is inlet geometry.** The gas generator's first compressor
stage is an annulus inside the can:

```
dTip = kD * canD          // PT6: the first axial stage is ~0.55 of the can
dHub = kH * dTip          // hub/tip ~0.5
mdot = RHO * Vax * (PI/4) * (dTip^2 - dHub^2)     // kg/s, Vax ~100 m/s
```
Anchor: a PT6A-34's can is ~0.40 m across, published airflow 6.8 lb/s =
3.1 kg/s; the three constants give 3.4. `kD`, `kH`, `Vax` are CLASS constants
of the reverse-flow style, exactly as `ELEC_STYLE.sigma` is (`:211-215`) —
one `TURB_STYLE` row today, a second when straight-through arrives.

**2. Thermodynamic power is mass flow.** `Pthermo = specKW * mdot`, with
`specKW` ~180-200 kW per kg/s at pressure ratio 7-8 and ~1000 °C turbine
inlet. FITTED AS ONE PRODUCT with `Vax` (the kM lesson at `_eng_gen.js:118-125`:
two anchors cannot honestly move two constants), on the -114A and the -34.

**3. Rated power is the flat rating.** `powerW = Pthermo / P.flatK`. The dial
is the builder's: turn it down and the same core gives more power and less
altitude margin, which is exactly the trade the PT6A ladder is (-21 / -27 /
-34 share a core).

**4. Mass tracks THERMODYNAMIC power, sub-linearly.** Five PT6As, dry, with
gearbox (a PT6 is always geared — no `+3 kg` declared addition, the bell is
in the law):

| engine | rated kW | kg |
|---|---|---|
| PT6A-21 | 410 | 149 |
| PT6A-114A | 503 | 160 |
| PT6A-34 | 560 | 150 |
| PT6A-42 | 634 | 181 |
| PT6A-67 | 895 | 232 |

`m = a * kWthermo^b`; on rated power the fit is b ~0.57, a ~4.8, and the -34
sits 15 % light. CORRECTED AT SESSION 2: the study first claimed fitting on
core power "explains the light -34" — it does not, the -34 is lighter than
the -114A on core power too (150 kg at 743 kWth against 160 at 629). The law
reads `Pthermo` because that is what sizes the metal, the exponent is
DECLARED at 0.57 and `a` fitted at 3.75, and the residuals are -8 % / +8 %:
two engines disagreeing about how heavy a gearbox is, left declared rather
than fudged (the kM lesson). Two-anchor discipline: fit `a`, declare `b`,
band the residuals.

**5. rpm and the gearbox.** N1 ~37 500 (a readout, like `kv` on the electric
sheet), prop rpm ~2 200 as the dial (`propRpm`), `gearRatio = N2 / propRpm`
DERIVED — the first live reader of the dead `ENG_DEFAULT.gearRatio`
(`:244`), which the study proposes retiring in favour of the derived value.
The flight model has no shaft rpm, so this is fiche and readout; the cowl's
`cw_rpm` design-point row (`tools/_cowl_rows.js:116`, "Cruise RPM" 600-3200)
already accepts 2 200.

**6. Envelope and CG.** `env.radius` = the inlet plenum's radius (~1.1 x
canR); `env.length` = flange + gearbox + can + accessory case (~1.5-1.6 m on
a -34). `items`: gearbox (~35 % of the mass, just behind the flange), gas
generator (~55 %, mid-can), accessories (~10 %, aft). `cgZ` lands ~0.6-0.7 m
behind the flange — see §8 for why the frame cannot use it yet.

**7. The dials** — a `['turbine', rows, isTurbine]` group at
`tools/_eng_page.js:150`, rendered by the engine layer's `BENCH_SUBS`
(`_cage_eng.js:233-251`) like every other group:

| key | label | range |
|---|---|---|
| `canD` | gas generator dia mm | 0.25-0.60 |
| `canL` | gas generator length mm | 0.50-1.20 |
| `gearK` | gearbox dia / can | 0.9-1.4 |
| `flatK` | flat rating (thermo / rated) | 1.0-1.6 |
| `propRpm` | prop rpm | 1500-2700 |
| `stackStyle` | stacks | drop: `paired` / `none (bare)` |

`canD`/`canL` share their keys with the electric group (both are "the can");
a preset writes the ones its arch reads. NO AIM ROW: a PT6's two stacks are
left AND right by construction, so nothing new is generated from `ENG_AIM`
and the `tools/_eng_check.js:344-355` scan ("exactly 2 generated drops")
stays untouched — the cheapest possible answer to a check that would
otherwise go red.

**8. Presets** (`_eng_page.js:68-138`): `'P&W PT6A-114A'` (Caravan) and
`'P&W PT6A-34'` (Kodiak), each with `arch: 'turbine'`, its can, its `flatK`,
and a firewall sized off the plenum the resolve builds (the radial presets'
own discipline, `:84-89`). BOTH get a `CAGE_JOIN_ENGINES` row
(`tools/_cage_join.js:22-42`), because four registry rows today have none
(`mikron3_wood`, `gipsymajor1_wood`, `outrunner3548_12x6`, `sp260d_class`)
and fly as an A-65 through the `:111` fallback — a turboprop preset without
its join row would fly as an A-65 too.

## 4. The registry rows

Two rows in `POWERPLANTS` (`00_registry.js:49-249`), with `family: 'turbine',
aspiration: 'turbine', cooling: 'air'`, the new `flatK`, and an optional
`length` (metres, for §8's box):

- `pt6a114a_hartzell3` — P&W PT6A-114A, 503 kW (675 shp), 160 kg, flatK
  1.26; prop Hartzell 3-blade 2.69 m (the Caravan's 106 in), synthesised by
  `genPropSynth` (`60_gen_spec.js:1064-1092`): fm 0.477 x 1.055 = 0.503,
  A 5.7 m2, Tstatic ~7.7 kN — a Caravan's published static thrust is in that
  band. `kV2` from `propV0K` as every generated row.
- `pt6a34_hartzell4` — P&W PT6A-34, 560 kW (750 shp), 150 kg, flatK 1.33;
  prop 4-blade 2.44 m (the Kodiak's 96 in).
- **Price.** `genEnginePrice` (`:305-312`) falls to the four-stroke curve for
  an unknown family: 60 x 560^1.3 = ~22 000 credits for a -34, where the used
  market puts it at 5-7x an R-985 (48 000 credits in the table). GATE ENGINE's
  band (x0.3..3.0, `_engcustom_check.js:51-56`) goes red unless a `turbine`
  curve exists: `~250 * kW^1.1` (~260 000 credits at 560 kW) fitted on the
  two rows, or both keys waived at `:37` with a reason. Fit, don't waive.
- `genEngineThermo` on either row: `burnKgH` = 0.35 x 503 = 176 kg/h at
  rated, which the plaque divides by 0.72 today (see §5).

## 5. Fuel — Jet-A, and the one keeper of "a turbine burns kerosene"

- `GEN_FUELS.jetA = { name: 'Jet A-1', kgL: 0.80, MJkg: 43.0, price: 1.30,
  note: 'kerosene; a turbine burns nothing else' }` at `60c_gen_energy.js:172-179`.
  Every reader is ADDITIVE: `genVesselResolve :254` (falls back to avgas),
  the clamp `60_gen_spec.js:2427`, the plaque name `64_gen_build.js:580`, the
  editor select `tools/_cage_energy.js:129` (lists the keys), GATE ENERGY
  `tools/_energy_check.js:839,939` (counts keys, uses avgas's own kgL).
- **ONE KEEPER: the spec clamp at `60_gen_spec.js:2427`.** After the
  fuel-key guard (`if (!GEN_FUELS[E.fuel]) E.fuel = 'avgas100LL'`), derive the
  family (the custom row's, else `POWERPLANTS[engines[0].type].engine.family`)
  and coerce: a turbine gets `'jetA'`, a piston never does. The clamp already
  coerces `E.kind` from the vessels (`:2426`, `:2481-2482`) under the file's
  own "readings, not settings" ruling (`:2445-2448`), so a derived medium is in
  character. The editor select (`_cage_energy.js:1432-1440`) then DISPLAYS the
  coerced value (it reads the spec back at `:65`); filtering its options by
  family is a courtesy, not the law. GATE DESIGN is NOT the home — its
  coherence/fidelity families (`tools/_design_check.js:388, :427`) know
  nothing of engines and fuel.
- **The plaque's hardcode** `app.js:3482` (`n1(s.burnKgH / 0.72, 0) + ' L/h'`)
  reads the medium's `kgL` — Jet-A is 0.80, and 176 kg/h is 220 L/h, not 244.
  The shakedown sheet (`64_gen_build.js:577-586`) adds `energyKgL` next to
  the medium name it already carries.
- Plumbing mass rides `GEN_OUTFIT.fuelKgL` (`60_gen_spec.js:956`) unchanged;
  the exhaust's `exhaustKgKW` (`:951`) over-charges a turbine (two short
  stacks, not a collector) — small, noted, not fixed.
- **A DECISION OWED TO THE USER — the 400-litre cap.** `S.fuel.litres` is
  clamped 0..140 before the vessels (`:2421`), each vessel 0..400 (`:2456`),
  the total 0..400 (`:2482`). A Caravan carries 1 250 L, a Kodiak 1 200. Any
  turboprop card declaring its real fuel is bitten, and GATE ARCHETYPES
  `checkClamp` (`tools/_arch_check.js:104-107`) fails a card whose declared
  litres are clamped. The study recommends raising the vessel cap to 1 000 and
  the total to 2 000 in session 2; every saved file sits inside the old range
  so no fixture moves. The balance chart (`src/viewer/balance.js`) draws the
  burn line to whatever the total is.

## 6. The mesh — the PT6 reverse-flow (ruling 3)

A `turb` branch in `_eng_mesh.js` AFTER the electric block (`:894-1276`),
same early-return shape (`:1273`: `{V, F, parts, ports, arteries, resolved,
P, edgeTarget, stats}`), the refusal at `:215-219` admitting `'turbine'`. From
the flange aft, along -z:

1. **Prop flange** — the electric flange verbatim (`:908-919`).
2. **Reduction gearbox** — a bell, `gearK x canD` across, ~0.35 canL long;
   the biggest diameter on the engine (a PT6's gearbox is fatter than its
   core, which is why the nacelle's nose is not a taper). `ENGM_MAT.case`.
3. **Two exhaust stacks** — left and right, just behind the gearbox, each an
   elbow swept from the case wall outward and aft (`sweep`, `:410`), rims
   flared. `part`s named `stackL`/`stackR`, NOT arteries: the artery matcher
   (`_eng_mesh_check.js:318-415`) holds every artery's ends to the port
   table by name regex, and a stack is a casting, not a route. `ENGM_MAT.exhaust`.
4. **Gas generator can** — `lathe` canD x canL, a shallow waist where the
   combustor liner sits. `ENGM_MAT.case`.
5. **Accessory gearbox** — a flattened box on the rear face (starter-
   generator, fuel control, oil pump as `bolt`/`prism` details under the
   `detail` side-count group). `ENGM_MAT.acc`.
6. **Inlet plenum + screen** — a short annular ring ~1.1 canD, its aft face
   open (openness is absence of geometry, the outrunner's own rule `:936-942`),
   a `ring` of spokes as the inlet screen. `ENGM_MAT.intake`.
7. **Mount** — a PT6 hangs from a RING at the rear of the can and cantilevers
   forward; four `mountTube\d` from `ports.lugs` on that ring to `ports.fwPts`
   on the firewall plate, the electric mount's own ports (`:1211-1256`),
   `mountGap` from `ENGM_DEFAULT` (`:143-154`). `ENGM_MAT.mount/puck/firewall`.
8. **Arteries** — `fuel` and `throttle` only (existing names, existing
   regex), from the accessory gearbox to the firewall.

Every dimension a ratio of `canD`/`canL` — the SCALE-INVARIANCE claim
(`_eng_mesh_check.js:839-858` for electric: 2x every length in, exactly 2x
every coordinate out) gets a turbine case beside it. Materials reuse `case,
acc, exhaust, intake, flange, mount, puck, firewall` (`:160-174`) so the
section map `ENG_SEC` (`_cage_eng.js:307-315`) and the parts table's
`sections` (`tools/_cage_parts.js:570`) DO NOT GROW — GATE PARTS asserts
every emitted material name is claimed exactly once. GATE ENGMESH: two
`CASES` entries at `:127` (both presets), `'turbine builds'` beside
`'electric builds'` at `:866`, and the "no combustion parts" regex of the
electric block (`:479-480`) gets a turbine twin (no barrels, no plugs, no
magnetos).

## 7. The cowl — a slim nacelle with a chin inlet

`COWL_BY_ARCH.turbine` at `_cage_cowl.js:525-544`, the radial row as the
template but the OPPOSITE at the front:

- sealed and round: `fitNose: 2`, every `cw_sq*: 0.5`, no rise, no sweep, no
  waist — the radial's own rows;
- a CLOSED nose: `cw_apMode` for the smallest annulus the tool has, round the
  spinner only (gearbox cooling), where the radial has a big ring;
- the CHIN SCOOP ON (`cw_scoopOn: 1`) — and AFT, because a PT6 breathes at
  the back of the can. `g_scoop` (`tools/_cowl_rows.js:147-160`) has length,
  width, height, drop, rake, mouth and duct rows but NO STATION ROW: the scoop
  sits at the lip today. Session 2 adds `scoopZ` (0 = at the lip, 1 = at the
  firewall) to `_cowl_gen.js`'s `buildScoop` (`:615`) and `P` (`:22-61`) —
  one new `cw_` row, which GATE SAVE's MOVABLE walk picks up by itself;
- the side aperture PAIR (`pairX/Y/W/H/Sq`, `g_ap` `:73-86`) as the two stack
  exits, just behind the lid;
- `cw_lobeN: 0`, no bulges; `cw_cowlLen = env.length x 1.10` — the `:567` cap
  of 2 m holds at 1.6 m.

Fix the `'radial'` literal in the note at `:580` to `arch`. GATE COWL §3:
the header at `_cowl_check.js:345-350` and the assertion at `:376-380` ("a
boxer keeps the bench default ... and so do inline and electric") become
"exactly TWO architectures (radial, turbine) change anything"; a turbine
block mirroring `:382-404` asserts sealed + round + closed nose + scoop on +
`r.front >= r.need`; the proportion band `:424-434` compares against the
radial preset and is skipped for the turbine (there is no approved turbine
preset to compare against — the user draws the first one). A PT6 fixture in
`CASES` (`:112-121`) buys the "cowl clears the engine" table for free.

The wing-mount case is already in place: the nacelle rows (`g_aft`,
`_cage_cowl.js:93-96`) exist on `engMount >= 2`, `cw_aftMode 1` draws the
tail cone (`:751-754`), and a twin turboprop is a `da62`-shaped card with a
different family — nothing new below the cowl.

## 8. The spec, the frame, the box

- **No `GEN_SPEC_V` bump** (currently 7, `60_gen_spec.js:1480`). `flatK` and
  `length` are NULLABLE additions (the "adding a nullable field costs no
  version" rule at `:1644`); widening `engPower` from 0..1 to 0..2 keeps every
  saved 0 and 1 byte-identical (`cageToSpec` writes deviations only,
  `tools/_cage_gen.js:6465-6478`; the v5 fixture carries `engPower: 0`).
- **Clamp enums**: `:2411` `cu.aspiration` three-way; `:2412-2413` `cu.family`
  is guarded by `GEN_ENG_THERMO` and admits `turbine` the moment the row
  exists; `cu.flatK` clamped 1..2.
- **The engine box** `S.engBox` (`:3113-3124`) is cube-root-of-mass:
  `k = cbrt(160/80) = 1.26` gives a 160 kg / 1.6 m turbine a 0.35 m box with
  phantom cylinders reaching 0.38 m either side. Readers: the nacelle drag of
  an off-nose engine (`src/core/62_gen_aero.js:809-815`, `2 max(halfW,
  cylReach) x 2 halfH`) — over-charged on a wing-mounted turbine twin; the
  cowl-floor clearance (`:3145-3147`) — under-sized. Branch on family:
  `cylZ = halfW` (no cylinders), `xA = engX + 0.5 x (length || 1.4)`. Piston
  and electric stay BYTE-IDENTICAL (GATE GEN compares the built spec).
- **OWED, NAMED HONESTLY — the engine's CG arm.** The frame hangs
  `0.5 x (engine.mass + prop.mass)` on each of two nodes AT THE MOUNT RING
  (`src/core/61_gen_frame.js:324, :333-334`); `S.engX` is prop radius and
  block offset only (`60_gen_spec.js:3078`). A PT6's CG is ~0.7 m ahead of
  its mount ring (the bench computes `cgZ`, the frame ignores it — the
  electric precedent at `_eng_gen.js:329-339` has the same unread number).
  160 kg x 0.7 m is the largest CG error this category introduces, and it is
  the one that would make a Caravan-alike's envelope read wrong by a seat.
  Proposal: a per-row `cgFwd` (metres ahead of the mount) used to offset the
  engine nodes, then the same field on every registry row (a radial's CG is
  behind its mount, a boxer's about on it). Not in the two sessions; a
  half-session of its own, with GATE MOUNT's sag/ring numbers re-measured.
  **LANDED as G198 (2026-09-05)** — as `cgAft`, the CG AFT OF THE FLANGE
  (engine-intrinsic; the study's "ahead of the mount" folded the mount gap
  and the nose rule into an engine property), a measured table
  `GEN_ENG_CG` per registry row (39 rows, the bench's own `cgZ`, ENGID §10
  re-measures it), a `CGE` mass node off the mount on all four mounts, the
  blades left on the flange, and the nose rule reading a declared engine
  length. The shifts, measured on every card, are in HANDOVER G198.

## 9. The editor and the design tab

- `engPower` 'powertrain' 0..1 -> 0..2 `['piston', 'electric', 'turbine']`
  (`_cage_eng.js:255`). GATE SAVE's `altValue` (`tools/_save_check.js:251-262`)
  is purely numeric on the row's range and moves it to 1 either way — verified,
  nothing breaks.
- The binary lives in SIX places and every one becomes three-way through ONE
  helper (`familyOf(arch, spec)` -> `'turbine' | 'electric' | 'two' | 'four'`):
  `archOf` `:82-84` (`[null, 'electric', 'turbine'][round] || VALS.arch[...]`);
  `presetSpecOf` `:131-132`; `CAGE_ENG_FACTS` `:170-173` and the identity
  expressions at `:183-184`, `:191-192` — today a turbine preset would be
  classed `'four'` on BOTH sides, compare equal, and pass GATE ENGID BY
  ACCIDENT; `applyEngPreset` `:458`; the group predicates `:241-248`
  (`isPiston` must exclude the turbine too — `_eng_page.js:147-148` gains
  `isTurbine`, and `isPiston` becomes "not electric and not turbine"); the
  design tile's `read` at `_cage_design.js:853-854`.
- **The tile**: `designEngineFamilies` (`:534-548`) gains `{ value: 'turbine',
  label: 'Turboprop', icon: ICON.engTurbine, writes: { cage: { engPower: 2 } } }`;
  models self-classify through `designPresetFamily` (`:551-555`, reads
  `p.arch`). The `vee` tile's `inactive` string is the precedent for a family
  that is declared before it can be built — the turbine tile ships live only
  with session 2.
- **The archetype** — a `'caravan'` utility single, the reason the user asked:
  class `n23` (the `util` class is `inactive` with `UTIL_REASON`,
  `_cage_design.js:383-385` — "no airframe the clamps allow can carry it"; the
  R-1830 was that test, a 560 kW turbine at ~3.6 t is the real one — leave
  `util` inactive in session 2, make it live once the card flies), role
  touring, `seatLayout 1, paxCount 7-9` (bays follow `paxCount`,
  `tools/_cage_crew.js:1410`; seats clamp 0..24), `engFamily 'turbine',
  engModel 'P&W PT6A-114A', engMount 'nose'`, `gearLayout 'trike', suspension
  'oleo'`, strutted high wing (`wgBrace 1, wgPos 0`), `over.cage` span ~15.9,
  chord ~1.8 (inside the 6.5-18 m / 0.80-2.10 m box at `60_gen_spec.js:2498-2500`),
  `spec.prop { D: 2.7, blades: 3 }`, fuel = the cap (§5). GATE ARCHETYPES
  (tier full, `_arch_check.js:160-188`) flies it through the test pilot's
  circuit inside 420 s; the R-1830 finding ("cannot be landed",
  `:1253-1261`) is the risk and `blocked` (`:1611`) the documented hatch.
  MEASURED AT SESSION 2: the risk was real on the C172 plan's wing (cruise
  61.9 m/s on a 50 target, two terrain go-arounds, still going around at
  420 s) and the answer was the WING, not the hatch — the slider's full
  14 m at a 1.9 m chord cruises 50.3, stalls 22.5 and lands with a full
  stop at 334 s. The card carries that wing.
- GATE PARTS: the new `eng_canD`-style rows are rendered by `BENCH_SUBS`
  automatically, but the engine PART must list the `turbine` group under its
  `groups` (`_cage_parts.js:571-584`) or the gate reports them unrendered;
  `place.type` (`:561`) needs no change (no aim row).
- GATE STARTER: `applyEngPreset` writing `engPower: 2` is the same
  applies-once path; `PAGE.load` still silences it.

## 10. Gates — the whole list, so nothing is discovered red

| gate | file | what changes |
|---|---|---|
| ATMOS | `tools/test_atmos.js` | §8 enum admits `turbine`; §6 flat band then lapse; identity at sigma 1 unchanged |
| HOTHIGH (full) | `tools/test_hothigh.js` | §3 third sheet: power 1 on the hot day, < 1 above the flat-rating DA, ratio under the piston's |
| ENGINE | `tools/_engcustom_check.js` | thermo row exists, burns-not-draws passes; PRICE needs the turbine curve; §3 custom turbine row carries `flatK` |
| GEN / BUILD | `tools/test_gen.js`, `tools/test_build.js` | registry walk sees two more rows; GEN's envelope check now bounds mass NET OF FUEL (the caps rose); this arc adds no migrator (the UltraLight session's own 7->8 bump landed the same day, unrelated) |
| ENERGY / ENERGYBASE | `tools/_energy_check.js`, `_energy_base.js` | additive on `jetA`; a turbine fixture optional |
| ENGMESH | `tools/_eng_mesh_check.js` | two CASES, scale case, `'turbine builds'`, no-combustion-parts twin |
| COWL | `tools/_cowl_check.js` | §3 "exactly two"; turbine block; PT6 fixture |
| ENGID | `tools/_engid_check.js` | untouched PT6A-34 -> null; a dial -> `modified P&W PT6A-34`; `aspiration === 'turbine'` |
| STARTER | `tools/_starter_check.js` | unchanged behaviour, one more preset in the replay |
| DESIGN | `tools/_design_check.js` | tile writes and reads back `'turbine'` (fidelity); model list resolves |
| PARTS / SAVE / JOIN | `_parts_check.js`, `_save_check.js`, `_join_check.js` | groups listed; rows auto-MOVABLE; join map total |
| ARCHETYPES (full) | `tools/_arch_check.js` | one more card; `checkClamp` vs the fuel cap |
| MOUNT / LOAD | `_mount_check.js`, `test_load.js` | unchanged unless `cgFwd` lands |
| `_eng_check.js` (by hand) | | `ENG_ARCH` loop skips the turbine; the ENG_AIM scan untouched |

## 11. Order of work

**Session 1 — THE TURBINE FLIES (code only, nothing drawn) — LANDED as G186
(2026-09-05, HANDOVER G186 has the measurements and five traps).** §1 the three
keys and `flatK`; §2 the law, the three solver call sites, ATMOS §6/§8,
HOTHIGH §3; §4 the two rows and the price curve; §5 Jet-A, the clamp keeper,
the plaque's kgL; §8 the clamp enums and the engine box branch. Reachable
through `engines: [{ type }]` exactly as HOTHIGH builds its sheets; the editor
untouched. Gates: ATMOS, HOTHIGH, ENGINE, GEN, BUILD, ENERGY, plus a cold
`buildGen` of a spec with `pt6a114a_hartzell3` on the current C172 card to
read the plaque. Ends with a Caravan-shaped spec that climbs like a turbine
and burns kerosene, drawn as a boxer.

**Session 2 — THE TURBINE IS DRAWN — LANDED as G192 (2026-09-05, the same
day; HANDOVER G192 has the measurements, seven traps and the owed list —
the preset-to-cowl one-build lag it found and fixed was older than the
turbine).** §3 `turbResolve`, `TURB_STYLE`, the
group, the two presets, the join rows; §6 the mesh branch; §7 the cowl style
and `scoopZ`; §9 the six three-ways, the tile, the archetype; the fuel cap if
the user rules it. Gates: ENGMESH, COWL, ENGID, STARTER, DESIGN, PARTS, SAVE,
JOIN, then ARCHETYPES on the card. The user's eye on the first drawn PT6 and
its nacelle before the cowl block in GATE COWL is written — the radial's
"approved preset" pattern.

**A half-session, if the card fights or the user wants it right:** `cgFwd`
on every row (§8); the `util` class live; straight-through as `TURB_STYLE[1]`.

**No new file.** `turbResolve` beside `elecResolve`, the mesh branch beside
the electric one, the group beside the electric group: the load order
`_eng_gen -> _eng_mesh -> _eng_page -> _cage_eng` is restated in FOUR loaders
(`tools/build.js:229`, `_arch_check.js:57-64`, `_design_check.js`,
`_engid_check.js:24-26`), and a file that is not added is a file that cannot
be missed from one of them.

## 12. Not in scope, said plainly

- Straight-through turboprops (TPE331, Walter M601, Allison 250): front inlet
  under the spinner, exhaust aft — a second `TURB_STYLE` row, a second inlet
  aperture mode on the cowl. Ruling 3.
- Jets and the SubSonex: far backlog (ROADMAP), a thrust law with no
  propeller.
- The blower model behind `'turbo'`: the DC-3's own debt, a different
  mechanism.
- The burn model, part-load SFC, beta, ITT, the start: burn-model facts.
- Sound: there is none to key.

## 13. Questions that changed the work — ANSWERED (2026-09-05, the user:
## "agree with your recommendations")

1. The 400 L fuel cap (§5): RAISED — 1 000 L per vessel, 2 000 L total.
   Landed with session 1 (it is a clamp, not a drawing).
2. `cgFwd` (§8): its OWN half-session, after the user has seen the drawn
   engine, with GATE MOUNT re-measured.
3. The `util` class: the card stays on `n23` until it lands its circuit.

**Parallel sessions (the user: "have a strategy to avoid conflicts and
reserve G numbers if needed").** ROADMAP's own protocol (line ~1284) says a
number is taken WHEN THE CHANTIER LANDS by re-reading the last `## G`
heading, and at most the one being written is reserved — so no numbers are
reserved here. What is held instead is FILES: session 1 owns
`src/core/00_registry.js`, `05_atmos.js`, `30_solver.js`, `60c_gen_energy.js`,
the engine/fuel clamps and the engine box in `60_gen_spec.js`, the sheet in
`64_gen_build.js`, the plaque line in `src/viewer/app.js`, and the gates
`test_atmos.js`, `test_hothigh.js`, `_engcustom_check.js`; the live peer
sessions were told so by message; the built outputs are touched only by the
one `build.js` at the end; nothing is reverted with git; the number is read
off the last heading at the moment the HANDOVER entry is written.
