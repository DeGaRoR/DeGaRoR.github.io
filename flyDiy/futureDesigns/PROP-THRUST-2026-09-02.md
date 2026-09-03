# THE PROPELLER CEILING — why a garage-built aeroplane barely climbs (2026-09-02)

> **STATUS: DIAGNOSED, RULED, AND LANDED as G158.** The user's ruling, same
> day: *"go ahead with the prop recalibration, also change the coarse
> setting."* §1-§4 are the diagnosis as it was found; §6 is what was changed
> and what each red gate taught. §5 (the registration) was CLOSED as G160.

Written after the user's own finished Cub (`My_finished_Cub.json`, v6) came
back from a playtest climbing at 1 m/s: *"If I did it right, that's a good
design and it should be better than that. I'm wondering if something we have
done has not become too punishing."*

**The build is not the problem.** The propeller model is, and it has been
since G4. Everything below is measured off this repo's own code, headlessly,
with the probe `genShakedown` already uses.

---

## 1 · THE ONE-LINE FINDING

`GEN_RULES.propV0K = 1.10` caps **every generated aeroplane's peak propulsive
efficiency at 42.3 %**, for any engine, any diameter, any number of blades,
any material and any pitch. A real fixed-pitch wooden propeller peaks near
75 %. The other 58 % of the engine is thrown away in the thrust law.

It is one line of algebra. The model is

```
T(V) = Tstatic − kV2·V²        with  V0 = propV0K · P / Tstatic
                                     kV2 = Tstatic / V0²
```

so `Tstatic · V0 = propV0K · P` is a **constant**, and the propulsive power
`T·V` peaks at `V = V0/√3` with

```
P_prop_max = Tstatic · V0 · 2/(3√3) = 0.3849 · propV0K · P = 0.423 · P
```

Raising `Tstatic` (a finer prop) lowers `V0` by exactly as much. The pitch
trade is real inside that budget; the budget itself never moves.

Confirmed in the sweep: the user's Cub, the stock garage build and the J-3
fiche all peak at **20.5 kW of thrust power out of 48.5 kW of shaft power**,
at V = V0/√3, exactly as the algebra says.

### The registry says the same thing

`propV0K` was calibrated on the A-65 row — which is the **worst** row in
`POWERPLANTS`. Peak propulsive efficiency implied by each hand-written row:

| row | P kW | Tstatic N | V0 m/s | ηpeak |
|---|---|---|---|---|
| io360_mccauley (C172) | 134.0 | 2290 | 129.8 | **85.4 %** |
| o200_eprops | 74.6 | 1700 | 98.0 | **86.0 %** |
| r1830_hs23e50 (DC-3) | 895.0 | 11000 | 142.3 | **67.3 %** |
| rotec3600_std | 112.0 | 1950 | 90.1 | 60.4 % |
| rotax277_pusher | 21.0 | 800 | 38.3 | 56.2 % |
| verner7u_wood | 78.0 | 1400 | 74.8 | 51.7 % |
| **a65_sensenich74 (the Cub)** | 48.5 | 900 | 58.8 | **42.0 %** |
| every row derived from `propV0K` | — | — | — | **42.3 %** |

The C172's propeller is allowed 85 %. Every aeroplane the garage builds gets
42 %. The generator's own header says `propV0K` "reproduces the A-65 entry to
under a per cent" — it does, and that is the bug: it reproduces the single
outlier and hands it to the whole garage.

---

## 2 · WHY NOBODY SAW IT — THE SECOND ERROR THAT CANCELLED IT

The A-65 row's `Tstatic = 900 N` was itself fitted so the J-3 fiche would
reproduce the published 433 fpm. But the fiche is **not the published
aeroplane**:

| | fiche (`10_aircraft_cub.js`) | real J-3C-65 |
|---|---|---|
| airframe empty (incl. engine) | **265.4 kg** | **345 kg** (765 lb) |
| + fuel | 36 kg | ~32 kg (45 L) |
| + one pilot | 76 kg | 76 kg |
| **all-up flown** | **377.4 kg** | ~453 kg solo, **550 kg gross** (1220 lb) |

Published figures from the Wikipedia J3C-65 table (empty 765 lb / 345 kg, MTOW
1220 lb / 550 kg, max 140 km/h, cruise 121 km/h, stall 61 km/h, ROC 450 ft/min,
16.58 m², 10.74 m). AOPA's fact sheet quotes a lighter empty of 680 lb (308 kg)
— sources differ by variant and equipment, and the argument below survives
either: even against 308 kg the fiche is 43 kg light.

The fiche's airframe is **80 kg (23 %) lighter than the real aeroplane's
empty weight**, and the published 450 fpm it was calibrated against is a
**gross-weight** figure. A 23 %-light aeroplane on a propeller giving 69 % of
the thrust reproduces the book. Neither error is visible at that one point.

**The proof, at matched weight.** Fly the repo's own hand-validated J-3 fiche
at the real J-3's gross weight, changing nothing else:

| | all-up | Vs | ROC | published |
|---|---|---|---|---|
| fiche cub, as written | 377 kg | 16.5 m/s | 2.22 m/s (436 fpm) | — |
| **fiche cub at real gross** | **550 kg** | **20.0 m/s** | **0.78 m/s (154 fpm)** | **2.29 m/s (450 fpm)** |
| the user's Cub | 494 kg | 16.0 m/s | 1.07 m/s (212 fpm) | — |

The fiche does WORSE than the user's own aeroplane the moment it carries a
real Cub's weight. (Every sweep here is stall-guarded: a speed at which the
trimmed lift cannot reach W is discarded rather than read, because
`genAlphaForLift` clamps at 0.85·aStall and an unguarded sweep therefore
reads a heavy aeroplane's below-stall speeds as its best climb. Guarding it
moved the 550 kg row from 1.15 to 0.78 m/s — the wrong way, and correctly.) This is not a garage regression — it is a pre-existing calibration
debt that the garage's **honest mass ledger** exposed. The generator bills
288 kg empty for the user's Cub, which is right; the fiche bills 265 kg for a
Cub, which is not.

---

## 3 · THE FOUR-WAY COMPARISON

Everything measured at the datum, world-free, from a probe sweep in 0.25 m/s
steps; ROC is the maximum of `(T−D)·V/W`.

| | mass kg | Tstatic N | T@20 N | ROCmax | Vmax | TO run | L/D cr |
|---|---|---|---|---|---|---|---|
| SIM J-3 fiche (`cub`) | 377 | 900 | 796 | 2.22 m/s / 436 fpm | 120 km/h | 151 m | 8.2 |
| SIM PA-18 fiche | 377 | 900 | 796 | 2.22 m/s / 436 fpm | 120 km/h | 151 m | 8.2 |
| SIM garage default | 405 | 907 | 802 | 1.92 m/s / 378 fpm | 121 km/h | 351 m | 8.3 |
| **SIM the user's Cub** | **494** | **917** | **808** | **1.07 m/s / 212 fpm** | **106 km/h** | **260 m** | **8.3** |
| REAL Piper J-3C-65 (published) | 550 gross | ~1100–1250 | ~1300 | 2.29 m/s / 450 fpm | 140 km/h | ~113 m roll | ~11 |

Two notes on the fleet rows:

- **The PA-18 fiche is the J-3 with flaps.** Same nodes, same 65 hp, same
  377 kg. A real PA-18-150 is 150 hp at 794 kg gross and climbs 960 fpm.
  Whatever is decided about the Cub, "the 3D-model aeroplane" is currently a
  J-3 wearing a Super Cub's skin, and its own gap to the real PA-18 is much
  larger than the Cub's.
- **Vmax is the cleanest thrust test** — it is parasite-dominated and nearly
  mass-independent. The sim's Cub tops out 15 % slow *while flying 32 %
  light*. Only the thrust explains that.

### Where the user's extra drag actually goes (V = 22 m/s)

| | user's Cub | fiche cub |
|---|---|---|
| induced (wing) | 287 N | 176 N |
| fuselage blob | 222 N | 163 N |
| wing profile + tail | ~62 N | ~57 N |
| **total (measured)** | **549 N** | **401 N** |

The induced delta is weight (494 vs 377 kg). The fuselage delta is a real
design consequence and correctly priced: the user's cabin is 1.30 m tall and
0.74 m wide, so `genFusCdA` measures a frontal area of **1.00 m²** against
the stock build's 0.73 m². That is honest — a Cub's fuselage really is about
that big. **Nothing in the drag model is wrong.** L/D at cruise is 8.3 on all
three sim aeroplanes and the fiche's is the validated one.

---

## 4 · THE FIX, AND WHAT IT COSTS

`propV0K = 1.10 → 1.95` puts peak propulsive efficiency at 75 %. Measured on
the user's Cub at its own 494 kg (real J-3 at 550 kg does 2.29 m/s, 140 km/h):

| propeller | Tstatic | V0 | ηpeak | ROC | Vmax |
|---|---|---|---|---|---|
| cruise pitch, `propV0K` 1.10 *(as built)* | 917 | 58.2 | 42 % | 1.07 m/s (212 fpm) | 106 km/h |
| cruise pitch, `propV0K` 1.95 | 917 | 103.2 | 75 % | 1.52 m/s (299 fpm) | 116 km/h |
| standard pitch, 1.10 | 1171 | 45.5 | 42 % | 1.61 m/s (317 fpm) | 106 km/h |
| **standard pitch, 1.95** | **1171** | **80.7** | **75 %** | **2.52 m/s (496 fpm)** | **125 km/h** |
| climb pitch, 1.10 | 1477 | 36.1 | 42 % | 1.96 m/s (385 fpm) | 100 km/h |
| climb pitch, 1.95 | 1477 | 64.0 | 75 % | 3.52 m/s (692 fpm) | 129 km/h |

A Cub-shaped aeroplane on a standard prop then climbs 496 fpm at 494 kg —
against a real Cub's 450 fpm at 550 kg. Correct, and correct in the right
direction for being lighter. Vmax stays ~11 % low, which is the model's
slightly generous parasite drag and is a separate, much smaller question.

**HOW MUCH THRUST IS MISSING, measured.** Scale `thrustAt` on the fiche at
the real gross weight until the published figure comes back:

| fiche @ 550 kg | ROC | ηpeak | Vmax |
|---|---|---|---|
| as written | 0.78 m/s (154 fpm) | 42 % | 113 km/h |
| thrust × 1.30 | 1.78 m/s (350 fpm) | 55 % | 128 km/h |
| **thrust × 1.45** | **2.28 m/s (450 fpm)** | **61 %** | **133 km/h** |
| thrust × 1.50 | 2.45 m/s (483 fpm) | 63 % | 135 km/h |

× 1.45 lands the published climb AND takes Vmax from 113 to 133 km/h against
a published 140 — two independent figures recovered by one correction, which
is what says the deficit is thrust and not drag.

Note `propV0K` alone does **not** get there for the fiches: their `Tstatic`
comes from the registry, not from the synthesis, so the A-65 row's 900 N
(figure of merit 0.36 against a real fixed-pitch prop's 0.45–0.50) has to move
too — to about 1150–1250 N. The generator's own `GEN_PROP_PITCH.fm` column
already reaches 0.46 at `standard`, which is why the standard-pitch row above
lands so well; it is the `cruise` row's 0.36 and the shared ceiling that are
wrong.

**THE PRICE, AND IT IS THE WHOLE POINT.** The two errors cancel, so they
were fixed **as a pair** (see §6):

1. `propV0K` 1.10 → ~1.95, and the static thrusts re-read against real
   figures of merit — the A-65 registry row 900 → ~1200 N, and
   `GEN_PROP_PITCH.fm` `cruise` 0.36 → ~0.42 (`standard` 0.46 and `climb`
   0.58 already sit in the real band).
2. The hand fiches' masses raised to their real empty weights (+82 kg on the
   J-3, and the PA-18 needs its own engine and gross weight settled).
3. Every anchor in the battery re-read: GATE GEN's SHAKEDOWN line, the fiche
   `ap` tables (`VClimb`, `TORun`, `thrCruise`), GATE XCTY's circuit times,
   GATE HONEST's stock deltas.

That is a calibration chantier across the whole fleet, not a one-line change.
It was the user's ruling to make, and they made it the same day. §6 records
what it actually cost.

### What the user can do today, without any of that

- **`prop.pitch: 'cruise'` → `'standard'`** on their own build: 1.07 → 1.61
  m/s and the take-off run 260 → 181 m. A Cub does not wear a coarse prop.
- The build is otherwise sound: prop clearance 0.19 m (rule 0.229 m is the
  *derivation* floor, the built stance is measured and healthy), the cowl
  encloses the engine with nothing sticking out, the cooling duty is 21.8 kW
  by fins on a 48.5 kW four, and every gear/bracing choice is the reference
  set so `genGearCdADelta` is ~0.011 m² — a rounding error.

### One real fault in the build, unrelated to climb

**Static margin −4.0 % MAC with two aboard, −8.4 % at reserves.** The
aeroplane is statically unstable in pitch as loaded, and the shakedown panel
already paints that row red. The rear seat sits aft of the neutral point:
solo it reads +8.2 %. Measured cure — move the wing aft, `wings[0].xLE`
0.285 → 0.45 m gives +3.8 %, → 0.60 m gives +10.7 %, at ~0.04 m/s of climb
per 0.15 m. It is shipped **as the user drew it** (see §5) and left for their
ruling.

---

## 5 · THE REGISTRATION NEVER LEAVES THE GARAGE (FIXED 2026-09-03, G160)

The user, in the same report: *"the registration did not make it in-game
intact, my settings affected only the garage."*

Diagnosed, not repaired. **The decal system has exactly two write doors and
both of them are in the editor.** Counted in the shipped `index.html`:

```
aeroSetDecals(  →  2 call sites, both `A.aeroSetDecals(` in tools/_cage_ui.js
aeroSetCraft(   →  1 call site,       `A0.aeroSetCraft(` in tools/_cage_ui.js
```

`src/viewer/app.js` — which builds the aeroplane that actually flies — calls
neither. Two consequences:

1. **The list is never applied to the flown build.** `aeroskin.js`'s own
   comment claims otherwise ("the editor's marking and its wear arrive on the
   flown build without travelling through anything") and it is true only
   because the uniforms are shared by reference — so the marking is whatever
   `applyDecals` last wrote, IF the editor booted at all. It is lazy
   (`CAGE_UI_LAZY`, `openEditor`), so a player who loads a build off the
   shelf and flies it gets `uDecN = 0` and no registration whatsoever.
   `spec.finish.decals` — the height, station, width and lock the user set —
   is stored, migrated and gated, and read by nothing outside the editor.

2. **The craft frame is stale, and in flight it has to be live.**
   `uCraftInv` is set once per editor build off `CAGE_UI_SCENE`'s matrix.
   The flying aeroplane's model matrix moves every frame and `uCraftInv` does
   not follow, so `vCraftPos` is effectively WORLD position. For the
   registration's `field` mode that still places the glyph correctly (the
   coordinate is the surface field), but the flank-mirroring term
   `aeroSideF = (aeroA.x < 0.0)` reads world X — so which side reads
   backwards depends on where the aeroplane is over the map, not on which
   flank you are looking at. Any `side`/`plan`-mode decal is wrong outright.

   The same applies to `aeroSetWear`: one caller, in the editor.

**The shape of the fix** (a chantier, not a patch): lift `applyDecals` out of
`_cage_ui.js` into a spec-driven function — it already reads only `DEC`,
`spec.meta.reg` and `spec.paint`, so `aeroApplySpecDecals(THREE, spec)` in
`aeroskin.js` can serve both doors and keep one declaration; call it from
`app.js` where the generated payload's textures are baked (beside
`genRegDataURI`, which is the *legacy* sheet from the pre-cage skin and is
itself now dead for cage payloads); and drive `aeroSetCraft` from the
aeroplane's root once per frame in the render loop. Then add the gate that
does not exist: nothing in the battery asserts a decal reaches the flown
aeroplane.

### 5.1 What was actually done (G160), and the half this section missed

The fix above was built as written, with one correction and one addition.

**On `aeroSetCraft`: this section was right and my first attempt was wrong.**
I set it once per BUILD off `craft`, reasoning that craft and the meshes move
together so `inv(craftWorld)·meshWorld` would be invariant. It is not, because
**`craft` is never posed**: it sits at identity, and the aeroplane's motion
lives in the vertex buffers and in `model.grp.matrix`, which is rebuilt from
the solver's basis and CG on every frame. Handing over an identity matrix made
`uCraftInv` the identity and `vCraftPos` the WORLD position — which is exactly
the defect described above, reached from a new direction and dressed as an
optimisation.

Corrected (G160.2): the call lives in the pose loop beside
`model.grp.matrix.copy(mBasis)` and inverts `model.grp.matrixWorld`, once per
frame, with axes `{lateral:'z', along:'x', up:'y', aft:false}` — model.grp's
local x is the solver's along-axis, y is up, z the cross.

**Why it stayed invisible through every check:** `field` mode does not read
`vCraftPos` at all (it rides the surface field baked into aStruct), and the
registration defaults to field. Only `side` and `plan` projections touch it, so
the whole registration chain verified green with the frame wrong. The gate now
pins the object *and* its neighbourhood, and separately forbids `craft`.

**The addition, and it is the half this section did not see: nothing ever wrote
`meta.reg`.** This section assumed the registration was in the spec and only
the *painting* was garage-only. It was not. The panel row's own label reads
"the spec carries it as meta.reg and this edits it", and that was false:
`oninput` set `DEC.reg` — an editor-local cache — and `decSavePrefs()`, a
per-browser localStorage key. The letters never entered the spec, so they were
never saved with the build and could not have reached the flown aeroplane even
after the painting was fixed.

The user's own file is the proof: `My_finished_Cub.json` carries
`meta.reg: "F-PGAR"` — the untouched default — under a thoroughly customised
aeroplane, while their PLACEMENT (`regH 0.6, regL 3.15, regC 0.14`) saved
perfectly. Their report was exact: the settings affected only the garage.

One fact had three owners and the only one that is saved and flown was the one
nothing wrote. Now:

- the row commits on `change`, not `input` — `GARAGE_SPEC.update` rebuilds the
  cage, and committing per keystroke would rebuild it for every letter;
- `finishFromSpec` CLEARS `DEC.reg` on load. It used to carry it across, on the
  reasoning that it belonged to `meta.reg` and was "not ours to clear" — but
  since nothing wrote `meta.reg`, that cache was the only copy, and preserving
  it made the previous aeroplane's registration follow you onto the next one;
- `reg` is stripped from the browser preference on the way out and ignored on
  the way in. Everything else in `DEC` is a placement a builder may reasonably
  carry between sessions; a registration is the aeroplane's identity.

**The gate now exists** — seven checks in GATE SKINMAT: the keeper is present,
the flight calls it, the craft frame is set, the editor has not grown a second
copy of the translation, and the three ways the registration could acquire a
second owner again. `aeroDecalMerge` is exported to node so the MERGE is proven
by *running* it rather than by a regex: `finish.decals` stores deviations, so
an absent field must fall back to the default — a missing `regH` read as 0
gives a marking no height, which on screen is this very bug one layer down.

**Verified live**, not only by gates: typed in the garage → spec → saved file →
flown aeroplane, placement intact; and the glyph atlas re-rasterises per
registration (6 chars → aspect 4.87, 4 → 3.17, 2 → 1.61, back to 4.87 with
byte-identical ink). NOT verified: the final composite onto the fuselage. The
main canvas is 0×0 in the agent browser pane and the offscreen-renderer
workaround cannot read colour off `onBeforeCompile` materials, which is exactly
what a decal is.

**STILL OPEN: `aeroSetWear`.** Same single-caller shape, but genuinely not a
bolt-on. `applyWear` places soot and splash through `window.CAGE_ENG.exhaustAt`,
`window.CAGE_GEAR.contacts` and `wearFieldAt(mesh, FS, …)` — all editor-scene
data that the flight side has no access to when the editor never booted. Doing
it properly means publishing those anchors into the snapshot the way G155
published `ports.exhaustOut`. Half-doing it would put the streaks in the wrong
place, which is worse than leaving the aeroplane clean.

---

## 6 · G158 — WHAT WAS ACTUALLY CHANGED

### 6.1 The propeller

- **`GEN_RULES.propV0K` 1.10 -> 1.95.** Peak propulsive efficiency 42.3 % ->
  75.1 %. Two independent anchors agree on it and neither was fitted to the
  other: it is a real fixed-pitch propeller's peak, AND it is what makes the
  J-3's own geometry climb the published 450 fpm at the published 550 kg on a
  static thrust inside the published 250-280 lbf band.
- **`GEN_PROP_PITCH.fm` 0.58/0.46/0.36 -> 0.530/0.477/0.420** (climb /
  standard / coarse). The column is a static figure of merit and had been
  back-fitted through the broken constant until it sat below the physical
  band; a real fixed-pitch propeller is 0.40-0.55, and 0.36 is a propeller
  that does not exist. The trade survives and is measurable: at the A-65,
  fine out-pulls coarse below ~42 m/s (1335 N vs 1058 N standing) and coarse
  wins above ~48 m/s.
- **`GEN_DEFAULT.prop.pitch` 'cruise' -> 'standard'.** Not cosmetic: GATE GEN
  requires the SYNTHESIS to reproduce the powerplant row the default build
  flies on to 2 %, so the default's pitch IS the pitch the A-65 row states.
  Left at 'cruise' the two were 12 % apart and G4.7 went red.
- **`POWERPLANTS.a65_sensenich74`** 900 N / 0.26 -> **1202 N / 0.1941**, the
  synthesis's own answer at standard pitch. **Eleven more rows re-derived** --
  the four middle-market and the seven in the electric ladder, every one the
  file already declared as derived from this anchor -- by running the
  synthesis, not by re-fitting opinions. The two 3-blade rows also gained the
  +5.5 %/blade solidity bonus the first pass had left out.
- **UNTOUCHED ON PURPOSE:** the hand-fitted flying anchors (io360, r1830,
  o200, rotax277, rotec3600, verner7u, outrunner2212). They carry the C172,
  DC-3, Jodel, Chinook and Drone, whose fiches are therefore bit-identical.
  Their implied peak efficiencies still scatter 39-86 % and that inconsistency
  is now the visible one -- recorded here, not fixed.

### 6.2 The two Cub fiches

Only `cub` and `pa18` change, because only the A-65 row moved.

- **+80 kg of airframe**, split into what it actually is and **solved so the
  CG does not move**: structure x1.16 (+29.7 kg), firewall +22.8 kg (mount,
  exhaust, oil, battery low; cowl and panel high), cabin +27.5 kg (seat pans,
  controls, floor low; glazing, doors, seat backs high). 265 kg empty ->
  345 kg; all-up 377.4 -> 457.4 kg. **cgX 0.7987 and cgY 0.4997 before and
  after.**
- **`K_GR` 2.8e4 -> 4.07e4, `C_GR` 900 -> 1308** (c/k held at the fiche's own
  0.0321). Set by a window squeezed from both sides, not by the mass ratio --
  see 6.4.
- **`flareRate` 0.062 -> 0.134 on the PA-18**, its rule value from
  62_gen_aero; the cub keeps 0.062, measured. **The cub gains the W13.2 hop
  guard** it never needed before (`VTailDown: 99`, `VPinFull: 20.0` -- not the
  PA-18's 17.6, and read off two gates at once). Both in 6.4.
- **The AP tables re-anchored by method:** V-speeds scale with the stall
  (14.97 -> 16.35 m/s); `VCruise` re-solved by 64_gen_build's own rule to
  33.9 m/s = 122 km/h against a published 121; throttles rescaled by
  900/1202 to keep the THRUST they were tuned with rather than the lever
  position (G4.9's own ruling); `TORun` re-integrated to 172 m; `stabTrim`
  re-solved by tunnel pitch balance.

### 6.3 Two latent bugs the recalibration exposed

Neither was caused by it; both had been waiting for a number to move.

- **`genTORunAt` rounded the total and its two parts independently**, so the
  plaque could print `151 + 72 = 224`. GATE HONEST asserts that identity and
  had never caught it, because no anchored build had landed a part near a
  half-metre. Now: round once, then sum.
- **GATE HOTHIGH was not measuring what it claimed.** Its two "unstick" checks
  read the speed at the 2.5 m SCREEN, which is the unstick speed plus whatever
  the aeroplane accelerated by on the way up -- a density-dependent term,
  because excess thrust is. It stayed inside the band only while the propeller
  had almost no excess to accelerate on. It now reads the speed at the frame
  the wheels leave (`sim.wheelsOnGround()`), and the PA-18 went 1.094 -> 0.996
  while the untouched C172 reads 1.018, which is what says the new instrument
  is right rather than merely permissive.

### 6.4 The six things that went wrong on the way, and what they taught

- **A uniform mass scale is not a mass fix.** Scaling every structural node by
  one factor preserves the STRUCTURE's CG and moved the AEROPLANE's 136 mm
  aft, because engine, fuel and pilot do not scale and are all forward. The
  mains came off the ground, the legs went over-centre at 19.6 % strain and
  latched, and it settled on its tailwheel with the wheels 0.57 m in the air.
- **And preserving cgX is only half of it.** The corrected split hung all the
  equipment on the lower longerons, held x exactly, and dropped cgY 4.2 cm.
  GATE MODEL caught it immediately: the PA-18's 3D wheels are calibrated
  against the gear contact height measured FROM THE CG. Both stations put
  their top and bottom nodes at the same x, so the vertical share solves for
  cgY without disturbing cgX at all.
- **The gear rate is squeezed from both sides, and the mass ratio is not the
  answer to either.** Too soft and the leg latches over-centre: at 1.21x the
  static stance was right to the millimetre and the LANDING was not -- XCTY4's
  arrival peaked at 20.5 % member strain and latched, and XCTY3 never rolled
  at all because the spawn settle latched it first. Too stiff and the spring
  hands its load to the BRACE instead (the fiche's own G4.7 lesson) and bounces
  harder on arrival -- at 1.82x GATE HOTHIGH's chassis strain went to 10.3 % on
  an 8 % bound, and at 2.0x its touchdown sink failed outright. **1.454x** is
  what fits, and it fits tightly: HOTHIGH lands at 8.0 % chassis against that
  8 % bound, which is thin and is recorded as thin. Above ~2.2x the solver
  diverges outright.
- **The obvious cure for a hard arrival made it worse.** 62_gen_aero's own
  rule says flareAgl = 3.2 x VAppr x gs, and VAppr moved with the stall, so
  starting the flare higher looked like the principled fix. It softens HOME
  (PA-18 touched at 1.17 m/s instead of 1.40) and it makes the hot-and-high
  strip WORSE, 8.0 % chassis to 8.8 %: up there the true airspeed behind the
  same equivalent one is higher, and the extra height buys float rather than
  cushion. The fiches are not density-adaptive, so flareAgl stayed where it
  was tuned.
- **The flare RAMP was the real one, for the PA-18.** The same file sizes
  `flareRate` to reach the flare attitude in 1.5 s, and the fiches' 0.062 was
  tuned at an approach alpha the heavier aeroplane no longer flies: the rule
  now asks 0.102 (cub) and 0.134 (PA-18). Giving the PA-18 its rule value took
  its touchdown from 1.40 to 0.72 m/s and its hot-and-high chassis strain from
  8.0 % to 2.8 %, with GATE WIND's own arrival following it down. That single
  number is why the gear-rate window stopped being a knife edge.
- **AND THE LAST RED WAS NOT THE ARRIVAL AT ALL.** GATE WIND's Cub kept
  failing `chassis<8%` through every combination of flare and gear rate, and
  the measurement is what named it: a faster flare took the touchdown from
  1.62 to 1.15 m/s while the nose dug in HARDER (rollout pitch -11.6 ->
  -23.2 deg), and a stiffer leg made it worse again (-43 deg). Sink was
  improving and the damage was growing, so the load was not coming from the
  arrival -- it was coming from the ROLLOUT. Left alone, `VTailDown` falls
  back to `VTailUp`, so the J-3 actively held its tail UP (de -0.05) down to
  13.2 m/s and then pinned FULL aft, and W13.2 had already recorded that the
  full pin at touch speed is itself a re-launch impulse. It used to be slow
  enough to absorb that; 80 kg of real airframe raised its rollout speed with
  its stall. With the W13.2 guard the arrival is unchanged and the rollout is
  a different event: 4.7 % chassis, nose +3.2 deg, and it stops on the
  centreline instead of 11 m downwind. It keeps its hand-tuned 0.062 flare,
  because with the guard in place the rule's 0.102 still leaves 8.1 % against
  that 4.7 %.
- **And the guard's speed is NOT the PA-18's, even though the wing is.** Set
  to 17.6 it fixed GATE WIND and broke GATE M3, whose noseover bound
  (`rolloutPitchMin > 1`) caught the nose dipping to -2.7 deg. The curve is
  not monotonic, because there is a latch cliff inside it: pinned at 17.0 the
  Cub balloons and lands on a latched leg (M3 finished nose 5.6 deg DOWN,
  sitting 0.9 m low, 23.5 % gear strain); 17.6 and 18.5 clear the latch and
  still dip the nose below the horizon; **20.0** holds +5.9 deg with gear
  strain back to 7.8 %; 22.0 passes and is worse again (13.0 %). This
  aeroplane has no flaps and touches at 23.4 m/s, so full aft simply has to
  wait longer than a Super Cub's. Read off M3 and GATE WIND together -- either
  gate alone picks a different number, and the one M3 alone picks is a
  latched undercarriage.

### 6.5 Four gate fixtures that had quietly stopped testing anything

A negative fixture that has become a positive one gates nothing, so each was
re-solved for the SAME BEHAVIOUR rather than having its check relaxed.

- **GATE PILOT / HOVER** -- `rotax582 + 260 kg` was a build that lifts into
  ground effect and can climb no further. The 582's propeller is one of the
  derived rows, so it gained 41 % of its static thrust and simply flew away
  (125 m and still climbing at the bound). At **360 kg** it reaches 9.0 m,
  says `wont-climb`, and is back down and stopped at 72 s.
- **GATE PILOT / HEAVY** -- `rotax277 + 400 kg` must be condemned *in
  seconds*. With an honest propeller 21 kW under 400 kg became a creeper and
  the reject came at 66 s against a 60 s bound; `cargo.kg` clamps at 400 and
  adding the 60 kg of baggage bought 8 s. The bound was not what had gone
  wrong -- the fixture had stopped being hopeless. A **12 kW e-PPG** under
  460 kg of payload is condemned at 8 s.
- **GATE PILOT / CARD** -- the one place the recalibration changed what the
  aeroplane can be ASKED for. The stock build's circuit geometry derives from
  its own VCruise and climb gradient, so the pattern grew and a 60 m circuit
  now crosses rising ground on final. The pilot went around for terrain twice
  and then said `gave-up -- out of patience, not out of sky`, holding the card
  perfectly the whole time (58 m of 60, 25.0 of 25). That is the terrain guard
  WORKING. The ask moved to **70 m**, which completes at 289 s with no
  go-around, and the time bound stayed where it was.
- **GATE PILOT / FAST** -- `VFlown < 40` was a literal that only meant
  anything while the aeroplane could not reach 40. It now reaches 40.2 and the
  check went red on the aeroplane getting better. It asserts the claim
  instead: `cd.V - cd.VFlown > 2`, short of the ask by a real margin, which
  cannot rot again.

### 6.6 Where it lands

| | before | after | published |
|---|---|---|---|
| **J-3 fiche @ 550 kg gross** | 0.78 m/s (154 fpm) | **2.42 m/s (477 fpm)** | **2.29 m/s (450 fpm)** |
| J-3 fiche Vmax @ gross | 113 km/h | **147 km/h** | **140 km/h** |
| J-3 fiche, own load state | 377 kg, 2.22 m/s | 457 kg, 3.35 m/s | -- |
| **the user's Cub (coarse prop)** | 1.07 m/s (212 fpm) | **2.13 m/s (420 fpm)** | -- |
| garage default | 1.92 m/s | 4.02 m/s | -- |

Both published figures recovered, from opposite ends of the speed range, by
one constant. The remaining ~5 % on Vmax is the drag model reading slightly
clean at speed, and is a separate and much smaller question.

---

## 7 · WHAT WAS CHANGED IN THE STOCK DESIGN

Only the stock design. **A stock design is now a whole aeroplane, not a
shape.**

- `tools/_cage_page5.js` — `presets['piper cub']` is the user's finished
  Cub's cage, and a new sibling map `builds` carries everything a cage
  cannot: wing, tail, undercarriage, powerplant, propeller, paint, finish,
  fuel, cabin and registration. Sections only, never a cage — one declaration
  of the shape.
- `presets` rows may now declare **`_base: 'template'`**. A saved build's
  `spec.cage` is deviations from CAGE_PARAMS, not from this page's defaults,
  so laying one over `defaults` leaked 32 cage keys and 267 layer keys onto
  the aeroplane. The old row worked around it by restating each one by hand —
  which is what the sailplane row still does and what goes stale the next
  time `defaults` moves. Honoured by both consumers: `applyPreset`
  (`tools/_cage_ui.js`) and the shelf's stock bake (`src/viewer/garage.js`).
- `tools/test_build.js` — section C learns `_base` (so the gate catches the
  leak instead of asserting it), and a new **section C2** proves a declared
  build's engine, wing, paint, registration and finish survive the bake and
  the normaliser, on the resolved spec.

Verified: the stock `piper cub` row now resolves **bit-identically** to
`My_finished_Cub.json` — cage keys 0 differing, and mass, Vs, L/D, climb,
static margin, CG, neutral point, cost, deck angle, prop clearance and
weathervane all exact.

### GATE STATE AT DELIVERY — `node tools/run_gates.js --all`, 2920 s

**72 PASS. One red, and it is not this chantier's.**

- **GATE WIND / W-DC3**, on `|tdDrift| < 1.8` — the DC-3 crosswind touchdown
  drift **delivered red on purpose at G72** and standing in the debt register
  §1 ("two stacked pre-existing faults... fixing either is arrival work on a
  calibrated fleet, WITH the user"). It is not an assertion of innocence: the
  W-DC3 trace is **byte-identical** to the run taken before a line of this
  chantier was written — same stop position, same 0.6 % chassis and 5 % gear
  strain, same failing check — and the DC-3 flies `r1830_hs23e50`, one of the
  hand-fitted rows deliberately left alone. GATE DC3 itself passes, as before.
- Every other case in GATE WIND is green, including **W-CUB and W-PA18**,
  which this chantier broke and then fixed (6.4).
- **GATE MEDIA's three orphan terrain files, red in the first run, are gone** —
  another session's Admiralty Island work removed them mid-chantier. Not this
  one's doing either way.

`index.html` measures 4.03 MiB against the 6 MiB budget.

## 8 · SOURCES FOR THE PUBLISHED FIGURES

- [Piper J-3 Cub — Wikipedia](https://en.wikipedia.org/wiki/Piper_J-3_Cub) (the
  J3C-65 specification table used throughout)
- [Piper J3 Cub — AOPA fact sheet](https://www.aopa.org/go-fly/aircraft-and-ownership/aircraft-fact-sheets/piper-j3-cub)
  (the lighter 680 lb empty weight)
- Static thrust for an A-65 on a Sensenich 74 is **not** a published figure;
  the 1100–1250 N band quoted in §3 is momentum theory at a fixed-pitch
  propeller's real static figure of merit (0.45–0.50 of the 2517 N ideal for
  a 1.88 m disc absorbing 48.5 kW), not a measurement.
