# TANK-FIT — STATUS (cloud, 2026-11-03)

Branch `claude/tank-fit` (rebased 3 Nov 08:32 UTC on `origin/master` 1db22c8a = train 1B: FINISH-4 + PHONE-1b; first
cut on 0fcf54ef = PH1A). Not rebased on FINISH-4 / CABIN-CRAFT / PHONE-1b yet
(they were not on master when this was cut: the user's builds were read from `origin/claude/ready/candidates-4b`).
Generated files are NOT committed (the train builds): `node tools/build.js` before any page or gate.

Commits, in landing order:
1. **the clearance revamp + perf + the strut rule + the twin's cowl (case A)** — lands alone;
2. **the nose auto-fit (Part 2)** — new nose tanks only;
3. this file and the renders (round 1);
4. **the user's rulings of 3 Nov**: an unfit tank refuses certification (still flies); the auto-fit stands 15 cm
   ahead of the panel (cases + 5 cm to connect them) with its floor above the feet; applied to the validated Cub and
   Jodel, the floatplane card and the twin floatplane (screenshots in `refit/`).

Probe tables: `probe/` (the sweeps behind the false-red table, the auto-fit flag table).
Tools added: `tools/tank_fit_probe.js` (the verdict swept along a slider, master's verdict beside it, timed),
`tools/tank_shot.js` (a cutaway render of the tanks with the page's own load door, no browser; `--legacy` draws
master's verdict). Every number below is from those two, re-runnable.

## The verdict, now (Part 4)

Red is a real contact or a real lack of room between the DRAWN tank and what is DRAWN round it, and nothing else:

| red when | measured as | e.g. |
|---|---|---|
| a surface goes into the tank | the deepest sample of the surface inside the drawn solid (its rounded corners included) | `12 mm into the skin (plywood), left` |
| no room for the pads | a surface within 5 mm of the drawn solid | `no room for the pads: 3 mm to the frame (woodFrame), right (needs 5)` |
| the crew | a point of the seated, posed body (the pickBody), a seat, the controls or the panel within 10 mm | `20 mm into the panel`, `46 mm into a crew member` |

* "Surfaces" = the whole sheet (skin, frame tubes, glazing, dash, firewall, bulkheads, floor) + the engine + the cowl.
  The surfaces round a tank are SAMPLED every 8 mm (refined only within 5 mm of the tank's box) and each sample asked
  of the tank's exact solid — the old tests asked the shell's 396 vertices, and a flat face is two triangles 0.4 m
  long: a frame tube between them read clear.
* The standoff pieces (filler, vent, outlet, sump) are drawn only where they clear, on the same instrument.
* NOT red any more (they were rules, not geometry, and nothing drawn was there): the bay fit's 18-30 box corners at a
  **35 mm** wall, "outside the bay's band", "N corners past the bay", "the bay holds N L" (body tanks).
* The red sits on the contact: a red bead (`edTankClash_*`, a marker: the join skips it) at the deepest point of
  each contact named.
* The readout says the clearance even when it fits: `✓ fits · 17 mm to the bulkhead`.
* `window.TANK_FIT_LEGACY = true` is master's four tests, byte for byte the old paths (the A/B of every table here).

**"A tank that does not fit does not fly"** — master already flies an unfit tank as drawn (G3877, the user 29 Oct:
the red is the editor's warning). Kept exactly so; only the verdict got honest. (Open question 1.)

## The three cases (+ D)

### A. The twin's cowl (Twin_busher_floats_4b) — `A_twin_cowl_*`
* **Cause**: bays are measured on the body sheet's field, and the pod's sheet ends at the bulkhead the pusher engine
  stands behind; the cowl over the engine is the cowl layer. The "behind the cabin" bay (1.85-2.15 m aft of the datum)
  is wholly inside that cowl: the layer clamped it to nothing (`bay.x1 = 1.84 < x0 = 1.85`), its room read **0 L**
  (the capacity slider topped at 1 L) and every tank there read "past the body". Not the engine block, not the stand,
  not the prop: the bay never reached the cowl.
* **Fix**: where the body goes on as a cowl (the cowl layer's own triangles reaching aft of the field), the bay goes on
  into it: its section measured by four rays from the cowl's axis against the cowl alone, its room the cowl's
  (313 L of shell, the slider's top), a new tank there stands against the bulkhead, mid-height; the engine is the
  clearance's business like any surface.
* **Measured**: a 0.25 x 0.45 x 0.25 m tank, **24 L**, fits at 2.00 m, level 0.30, 21 mm from the firewall
  (`A_twin_cowl_after_side.png`; master: "past the body at 2.00 m", nothing drawn). A 30 L catalogue box at 1.9-2.3 m
  is honestly red (into the engine, or 56 mm into the cowl where it curves up). The CABIN-CRAFT change (body-face cowls
  from the firewall) should only help; to re-measure after the rebase: `tank_fit_probe.js` on the twin.

### B. The nose tank, "twitchy on all" — `B_ugly_nose_*`, `ugly_caseB.json`
Three causes, all measured on ugly_bi's 60 L nose tank:
1. **The tank jumped**: `lv` places a tank as a fraction of the band AT ITS OWN STATION, and at the windscreen base the
   section opens into the cabin. 4 cm of fore/aft (−0.20 → −0.16 m) lifted it from y −0.128 to −0.083 m (it reached
   −0.032 at −0.14): into the cowl top, red, then the dash. **Fix**: the fore/aft hand keeps the tank's height
   (`lvKeepingHeight`: it writes the level that keeps it where it is); a saved tank, carrying its own lv, is placed
   exactly as before.
2. **The crew box**: the crew was tested against the BOX + 1 cm, not the drawn solid: "through the crew (4 points)"
   at −0.20 and −0.19 m with the drawn tank 24 mm from anything. **Fix**: the drawn solid (+10 mm).
3. **The 35 mm wall** at the box's corners and "corners past the bay" (rules): red at −0.32 / −0.31 / −0.16 / −0.15 m
   with the drawn tank 5-10 mm clear.
* Master, the slider swept 1 cm at a time over −0.35..0 m: fits / RED / fits / RED / fits / RED flipping inside 5 cm
  (−0.20 crew, −0.17 fits, −0.16 skin 12 mm). Now (height kept): one transition, at −0.18 m: "within 10 mm of a crew
  member" (the pilot's feet), deepening into the panel (−0.08) and the dash (−0.03). Stable under small moves.
* The pose is the seated pose as built (pickBody posed once per build); nothing animates it between layouts. The leg-IK
  knee fix (~08:30) changes the pose, not the test.

### C. ugly_bi's rear tank — `C_ugly_rear_*`
* The 0.19 x 0.91 x 0.43 m (63 L) cabin tank raised to level 0.51: master "**through the skin by 6 mm**" — the box's
  corners against the section inset by the bay fit's **35 mm wall**: the drawn shell was **17 mm** from the nearest
  surface (a bulkhead). Lowered, master red from level 0.21 ("through the skin by 33 mm": the corner 2 mm from the
  skin, the rounded drawn corner clear).
* Now: fits from level 0.21 to 0.54 (master 0.24-0.48), red at 0.55 "no room for the pads: 3 mm to the frame
  (woodFrame), left", 0.57+ "7 mm into the frame" — the real longeron, named, with its distance.

### D. The validated twin floatplane's header tank (A0's addition) — `D_twinfloats_header_*`
* `tools/fixtures/build_v7_ultralight_2026-09-05.json` + floats (the validated "twin floatplane"): its 19 L nose tank's
  aft face stands **25 mm aft of the dash's cabin face** (117 mm aft of its forward face), into the cabin; now red:
  "**15 mm into the frame (tube), left; 20 mm into the panel**" (master: red too — "runs out of the body; 10 corners
  past the bay; through the crew (7885 points); through the dash (56 points)").
* NOT moved (validated). The auto-fit (Part 2) would stop it at the panel's plane by design; the user's call.

## The false-red table (master red, the drawn tank clear) — re-run: `node tools/tank_fit_probe.js <build> --json f`

| build, slider | positions | master red, now fits | master fits, now red | e.g. (master → now) |
|---|---|---|---|---|
| ugly_bi, both tanks, lv + fore/aft | 135 | 9 | 0 | lv 0.60: "through the skin by 24 mm" → 6.3 mm to the skin; fore/aft 1.52-1.64: "through the skin by 7-27 mm" → 5-5.5 mm clear |
| ugly_bi nose, the hand's fore/aft (case B) | 72 | 10 | 0 | −0.20: "through the crew (4 points)" → 24 mm to the skin |
| metal Cessna (C172) nose, lv + fore/aft | 44 | 5 | 0 | lv 0.70: "through the skin by 28 mm" → 5.4 mm to the toe board; −0.05: "through the crew (16 points)" → over 30 mm clear |
| twin 4b, the cowl's candidates (fore/aft, level) | 42 | the bay opened (A): every one was "past the body" | 0 | → 24 L fits; catalogue 30 L honestly red (engine, cowl) |

Verdict changes on SAVED and STOCK tanks (their own tanks, as built):

| tank | master | now |
|---|---|---|
| ugly_bi nose 60 L, cabin 63 L | fits, fits | fits, fits |
| metal Cessna nose 25 L | fits | fits |
| Cub nose (shaped 28 L) | red (crew) | red: 46 mm into a crew member |
| Jodel nose 45 L | red (crew 227 points) | red: 20 mm into a crew member |
| twin floatplane (validated) nose 19 L | red | red: 15 mm into a tube, 20 mm into the panel (case D) |
| floatplane-alike CARD's refitted 13 L deck tank | **fits** | **red: 3 mm into the frame (tube), left** — honest (the tube passes between the shell's vertices). GATE TANKMOUNT's row holds it as KNOWN (≤ 4 mm), any other stock tank turning red is red. Not refitted without the user. |
| Chinook (card + saved) strut pod 38 L | the card's pod became a **3 L nose box** (KNOWN_REMAP) | stays on its struts (the remap is gone, see Part 3) |
| pusherPod card: the vent | drawn 34.7 mm through the skin | not drawn (the piece check now asks every vertex) |

## The strut tanks (Part 3)
* **No struts → not offered**: the bay list carries "On the lift struts" only where the wing layer drew struts (as
  before); a tank still on struts where there are none sees its bay named "· this wing has none", disabled.
* **A saved build carrying one, without struts**: it is NOT sent to the nose any more (that remap shaped the Chinook-
  alike's 38 L pod into a 3 L nose box and wrote it back — fuel dropped silently, and for good when the struts had
  not been drawn yet on that build). It keeps its bay, is drawn nowhere, reads red with the reason ("this aeroplane has
  no lift struts to hang it on: the pod is not fitted and carries no fuel ..."), the stat line says so, the totals
  leave it out. **The core**: `unmounted` — not billed (master billed it on the wing's spar pair at 0.3 of the span:
  a phantom tank) and not in `fuel.litres`. Put the struts back and it hangs again.
  - measured: Jodel + a 40 L strut tank: fuel aboard 32.4 kg = the 45 L nose tank only.
* **Builds carrying strut tanks** (every JSON under flyDiy/, scanned): `builds/chinook_2026-09-21_corrected.json` (38 L,
  bracing strut: fitted), `builds/chinook_2026-09-21.edits.json` (38 L, no bracing written → strut by default:
  fitted). **No saved build carries a strut tank on a strutless wing**: no fuel is dropped by this.
* **Mount**: the pod hangs UNDER the strut on a 4 cm pylon with a clamp band round the strut (it was drawn centred ON
  the strut's axis, the strut through it) — `S_c172_strut_pods_*`. Billing stays on the strut's two end nodes by lever
  (the pod's centre is D/2 + 4 cm below: ~1 cm of CG height on a light aeroplane).
* **Drag (new)**: each pod Raymer 12.5 (Cf 0.0045 x FF(fineness) x Q 1.3 x Swet 0.75·π·D·L); `gen.drag.strutPods`.
  Metal Cessna + a 40 L pair: **0.0097 m²**. Physics changes only for builds with strut pods (the Chinooks).
* **Clearance**: the foot / top checks kept, plus the drawn spindle against the sheet, the engine and the cowl.

## The nose auto-fit (Part 2) — `N_*`, and the user's rulings of 3 Nov (`refit/`)
The user, 3 Nov, on the four questions:
1. an unfit tank: "**red warning and refusal of certification, but flies**";
2. the 10 cm: "**space dash firewall. Could be 5.** I'm thinking you need to connect the dash instruments, how much
   do you need for that?";
3. the floor below the dash: "**yes it may, it should just not hit the pilot's feet or legs**";
4. apply to the validated tanks: "**yes, with screenshot using the simplified renderer**".

**1 - refusal of certification** (commit 4): the bench's check (bench.js, the 'shake' row) adds the editor's own tank
verdict as design-check FAIL rows (`wb.tank<i>`: "Tank 1 fits (Nose bay)" with the reason and the fix) - a FAIL row
withholds the certificate (G2640's rule); the aeroplane still flies as drawn (G3877). The core adds the same row for
a strut pod on a strutless wing (64b genDesignCheck, `unmounted`), so the core's own readers refuse it too. The
editor's readout says "it flies, but the bench will not certify it".

**The overall rule** (the user, 3 Nov): "you can fly an uncertified plane, but you cannot engage it in any mission in
the story mode". The tank's side of it holds: an unfit tank is a bench FAIL, so no certificate, and it flies. **The
mission side is NOT enforced anywhere today** (measured in the code, not changed here): the career map judges a
player's own build by its shakedown (75_career_wire.js certOf -> app.js careerCerts: "the saved build's shakedown"),
and careerAccept / the departure never ask the bench whether it passed (BENCH_STATE is the stand's build only; the
bench keeps no certificate per fleet slot). **For A0: a story/career chantier** - a per-slot bench certificate (the
f3 fingerprint the bench signs) and a refusal at careerAccept / the leg's departure for a build without one; out of
TANK-FIT's scope (it touches the career's record and the map).

**2 - how much the instruments need.** Our instruments are drawn as their FACES on the panel (no cases; measured: the
Cub's gauges all within 2.155-2.249 m of the panel face at 2.181 m). A real 3-1/8" instrument's case is 8-17 cm deep
behind the panel (ASI and altimeter ~8-9 cm, VSI / turn ~10-12 cm, attitude / DG gyros ~17 cm), and its pitot /
static fittings, the hoses' turn or a harness plug want **~4-5 cm more**. So the tank stands **15 cm** ahead of the
panel's face (`NOSE_CASE_DEPTH` 10 cm of cases + `NOSE_PANEL_ROOM` 5 cm, your figure, a row "room behind the panel",
0-20 cm); a gyro panel wants 22 cm (the row). Above that, OUR dash's glare-shield (the sheet's `dash` arch) runs
forward to the windscreen base - 28 cm ahead of the Cub's panel face, 16.7 cm from its firewall: the tank sits under
it (its top then the shield's) or starts 5 cm ahead of its front edge, whichever holds more (searched).

**3 - the floor**: just above the pilot's feet and legs, the pedals and the controls under the tank's own footprint
(+ 10 mm), never below the keel's inner skin; the floor that holds the most, 2 cm a step, is kept (something low in
the front of the bay - the cowl's lower panel behind the firewall - can make a higher floor hold more). The gap under
the deck is 2 cm (a row).

**Measured (the rules above)**:

| build | the nose tank before | auto now | firewall to the panel face / to the shield's front |
|---|---|---|---|
| Cub (validated) | 28 L shaped, red (46 mm into a crew member) | **44 L** fits (0.275 x 0.605 x 0.352 m) | 0.445 / 0.167 m |
| Jodel (validated) | 45 L shaped, red (21 mm into a crew member) | **55 L** fits (**53 L** on 1B: the knee fix raised the legs, the floor 11 mm) | 0.483 / 0.246 m |
| metal Cessna (C172) | 25 L, its own box (fits) | 76 L fits (not applied: its own box) | 0.478 / 0.225 m |
| ugly_bi | 60 L, its own box (fits) | 104 L fits (not applied: its own box) | 0.572 / 0.213 m |
| floatplane CARD | 13 L deck, red (3 mm into a tube) | **16 L** fits | - |
| twin floatplane (validated, case D) | 19 L, red (15 mm into a tube, 20 mm into the panel) | no auto shape (the legs reach the nose tip, the screen slopes over them); a 10 L refit fits but was withdrawn (see below) | - |

References: J-3 Cub 12 US gal = **45 L** here (ours: 44 L); a Jodel D11 ~60 L behind the panel (ours: 55 L); a
C172 has no nose tank.

**4 - applied** (commit 4):
* the saves' nose tanks with no station and no box of their own now take the auto shape by default
  (`window.TANK_NOSE_AUTO_ALL = false` = the old shaping, the A/B);
* the floatplane card's STOCK_TANKS entry is `fit: 'auto'` (hand-edited: tank_refit_apply.js generated the table);
* the validated twin floatplane's header tank: **applied, 19 → 10 L** (round 3, A0's T1, the user's answer of 3 Nov
  08:40: "the 10 L refit goes in as soon as the FLOATS idle-taxi NaN is fixed"). The NaN was NOT the sim: GATE FLOATS
  flew its landing for a FIXED 45 s and reads the taxi 20 s after the touch - master's touched at 24.90 s (0.1 s
  inside), the refitted aeroplane (6.5 kg lighter) floats longer in the ground effect and touched at 26.38 s, so the
  read never came and the row printed its NaN sentinel (every frame finite). The gate now flies until the taxi is
  read (90 s cap): PASS, the taxi 3.0 m/s 20 s after a 0.42 m/s touch. No physics changed. The history, round 2: Nothing larger than 10 L
  fits the open pod's nose (searched: 0.8-1.0 of its size, every station and level, both turns; a second tank behind
  the seat did not clear at the bay rule's spots), and the 10 L refit (the same cylinder at 0.8, 2 cm forward, 5 mm
  clear) made **GATE FLOATS' idle water taxi diverge** (NaN 20 s after the touch; master passes) - a sim fragility the
  6.5 kg lighter tank exposes, not a tank fault. So the tank stays as saved: red, it flies, the bench refuses it.
  Owed: the taxi's divergence (the sim), then the 10 L refit (its numbers above; `refit/twinfloats_*` shows it).

Every save this changes (the master spec's own tank vs this tree's, on today's core: the tank isolated):

| build | before (master) | after | CG move x / y (model frame, + aft / up) | mass (fuel) |
|---|---|---|---|---|
| builds/cub_2026-09-20_corrected (validated) | 28 L | 44 L deck | −20.7 / +59.3 mm | 461.7 → 476.9 kg (20.2 → 31.7 kg) |
| builds/jodel_2026-09-20_corrected (validated) | 45 L | 55 L deck | −14.9 / +8.2 mm | 464.2 → 473.7 kg (32.4 → 39.6 kg) |
| builds/composite_jodel_2026-10-07 | 45 L | 56 L deck | −14.5 / +8.1 mm | 514.4 → 525.4 kg |
| tools/fixtures/camel_2026-10 | 44 L (red: 61 mm into the engine) | **25 L** deck, fits | +13.3 / −11.5 mm | 716.0 → 696.9 kg (31.7 → 18.0 kg) — **19 L less: flag it** |
| tools/fixtures/cub_fittings_hand_2026-10, cub_quadwin_2026-10, stol_cub_kit | 28 L | 44 L deck | −20.1..−20.7 / +56..59 mm | +15 kg |
| validated twin floatplane (its VALIDATED patch, _load_build.js) | 19 L cyl, red | 10 L cyl, fits (5 mm clear), 2 cm forward | the tank's 6.5 kg of fuel less | — |
| every other saved tank (its own place or box) | unchanged | | | |

Screenshots (`refit/`, the simplified renderer tools/tank_shot.js, the near half of the skin cut away):
`cub_before_after.png`, `jodel_before_after.png`, `floatplane_card_before_after.png`, `twinfloats_before_after.png`
(+ each `_after_front.png`).

## Performance (node, this box; ms) — re-run: `tank_fit_probe.js` (now) and the master worktree probe (before)

| build | full layout (a release) master → now | a drag tick master → now (the drag frame) | first layout after a rebuild, now |
|---|---|---|---|
| twin 4b (wing tank) | 161 → **15** (the wing slicer kept; was re-sliced every layout) | 161 → 15 | — |
| ugly_bi (2 body tanks) | 308 → **3.6** | 357 → **1.5** (max 27) | 28 (the surface index 20 + the soup 9) |
| metal Cessna (C172) | 334 → **4.9** | 337 → **1.7** (max 6.8) | — |

* What was slow on master: the crew's points regathered (~27 000 a seat, two matrices each) and the engine/cowl walked
  vertex by vertex, on EVERY relayout — every drag tick; the standoff pieces' bay profiles per tick; geometry rebuilt
  per tick. Now: the surface soup and a two-level grid (40 cm blocks dealt once, 5 cm cells built on the first ask)
  and the crew's points are kept while what they were built off is the same object in the same place; a drag asks
  ONE frame (requestAnimationFrame) that places, judges and redraws only the tank in the hand (`dragLayout`); the
  release runs the full layout. Kept geometry per solid buffer (no per-tick BufferGeometry).
* Judging one tank: 0.1-3 ms clear, ≤ 10-15 ms deep in a surface at release (a budget, coarse once it is known red);
  a drag frame's budget is lower (600 pieces, 120 once red).
* Node's vm made `Math.*` a slow global lookup inside the layers (the gates' and tools' numbers): the layer binds
  Math and the typed arrays locally — the same objects, nothing else changes (and master's numbers above are master
  as it is, in the same harness).
* NOT within 4 ms on a phone yet: the nose auto-fit's first shaping (270-760 ms here, once per body change, cached);
  the first layout after a rebuild (28 ms here). Owed: the auto-fit's search off the main thread (open question 4).

## Gates (node, the tree built; 3 Nov, round 2 - two container restarts, so run gate by gate where they died)
PASS (28 asked): TANKMOUNT, ENERGY, ENERGYBASE, PARTS, DESIGN, SAVE, CAGEFIT, JOIN, FLOATKIT, COWL, STARTER, LIGHT,
DASH, ACCEPT, DESIGNCHECK, TAKEOFF, CGBAND, HONESTY, PROCURE (+ FLOATS and JOINPARITY: see below).
Rows updated with the reason (the applied refit, the user's "Yes"): ACCEPT reads the Cub's fitted 44 L (was 28);
DASH asks its box-vs-arch question of the bay-rule tank and adds "the fitted nose tank clears either dash";
TANKMOUNT skips the contact markers (and still holds a KNOWN row for the floatplane card, now refitted: unused).
FAIL, **standing on master** (the same lines on an origin/master worktree):
* TECH ("[pitch:seaplane]"), NODUMMY (`edDum` in three tools), STOL (the stol null-record rows, Vref, the lift-off),
  HANDLE (Twin_busher_floats_2's door handles), BENCHTIME (the bench check 6.5-8.8 s vs 6 s on master here - a timing
  gate on a shared box);
* ENGCONFIG: pinned hashes off an older master. This tree's differ from master's on three builds only, all intended:
  the Chinook (the strut pods' drag), the Cub and the Jodel (the applied nose tanks);
* JOINPARITY: master fails 4 rows (the metal Cessna, the Cessna floats, the v10 fixture, the "no tool flies raw"
  list); this tree adds **the Cub and the Jodel** (node vs the page's capture of 27 Oct: mass 476.9 vs 461.7 kg, 473.7
  vs 464.2 kg) - the applied tanks, intended. **Owed: a re-capture** (`node tools/join_parity_page.js`, the page) when
  the train lands this.
* PROFILE: timed out (1800 s) under the battery's load, on master too in the same run; not judged.
* FLOATS: red with the twin floatplane's 10 L refit (NaN in the idle taxi), green on master -> the refit withdrawn;
  re-run: **PASS**. JOINPARITY re-run after it: 6 FAIL = master's 4 + the Cub and the Jodel (the re-capture owed).
Not run: the full tier (ARCHETYPES, PILOTMATRIX, SEAPLANE, HOTHIGH) and the browser gates (UISMOKE...); the editor's
new rows (auto-fit, the gap and room rows, dragLayout) and the bench's tank rows are untested in a page: a look owed.

## Round 3 (A0, the user's answers of 3 Nov 08:40)
* T1 the twin floatplane's 10 L: applied (above); GATE FLOATS' landing flies until its taxi is read (a gate fix, not
  the sim: nothing in the core).
* T2 the camel fixture's 25 L: accepted. T3: 10 cm of instrument cases everywhere (NOSE_CASE_DEPTH, unchanged).
* T4 THE FIRST SHAPING OFF THE MAIN THREAD (the phone): sliced, not a Worker (the shaping asks this thread's own
  surfaces, crew points and solids; a slice of the same code is the same answer, bit for bit). On a page it runs one
  ~4 ms slice a frame (noseAutoGen, NOSE_JOB); the tank reads "fitting the tank to the nose" meanwhile, is neither
  drawn nor written back, and the slice that ends lays the tanks out again. Node (the gates) runs it whole, as before.
  The search judges a LIGHT solid (VESSEL_MESH.mkShape, no mesh: building a drawn tank per candidate was 20-60 ms),
  stops at the first contact, and a deck's top bounds the surfaces above its shoulders (the box bound refined the
  whole deck skin: 100 ms a judgement). Measured (node, the page's slicing emulated - frames queued, drained, timed):

  | build | slices | median / p90 | the long ones | wall | before (synchronous) |
  |---|---|---|---|---|---|
  | Cub | 29 | 4.7 / 5.1 ms | the last (the layout that builds the drawn tank): 25 ms; the start 15 ms | 131 ms | 646 ms in one block |
  | Jodel | 57 | 5.5 / 7.7 ms | the last two 10, 34 ms; the start 13 ms | 327 ms | 754 ms |
  | metal Cessna (a new auto tank) | 104 | 5.5 / 8.5 ms | the start 96 ms; the last four 28-59 ms | 718 ms | 1128 ms |

  Owed: the start (the bay's first measurement before the first yield) and the drawn tank's build at the end still
  run whole (up to ~100 ms on the C172 here); a layout of fitted tanks is 8-11 ms (was 105 with the deck's box bound).
* T5 the story's mission gate: Game's (A0 briefs them).

## For DESIGN-AIDS (A0: "tell DESIGN-AIDS the row ids")
TANK-FIT adds design-check rows, both `group: 'wb'`, `tier: 'safe'` (the AIRWORTHINESS certificate: a FAIL withholds
it; never `proposed`), id **`wb.tank<i>`** (i = the vessel's index in spec.energy.vessels):
* bench.js `benchTankRows()`: one FAIL per tank the editor's drawn clearance refuses ("Tank 1 fits (Nose bay)", the
  reason in `why`, "move or resize the tank ... or pick the nose bay's auto-fit" in `fix`), pushed into the shake
  test's `dsg.rows` before `dFail` is taken - the same lines DESIGN-AIDS rewrites (allRows / TI.safeFail): merge so
  the tank rows stay in the list the airworthiness verdict reads;
* 64b `genDesignCheck`: one FAIL per strut pod on a strutless wing (`unmounted`), at the end of the row list.
GEN_CERT_TIER's default ('safe' for an unknown id) already reads them right; a prefix entry (`wb.tank*`) would say so.

## Open questions for the user
0. For A0 (not the user's): the story mode's mission gate on the certificate is not built (see the overall rule above).
1. The validated twin floatplane: 10 L that fits, or the 19 L red (flies, no certificate)? Or a second tank (where)?
2. The camel fixture loses 19 L (44 → 25 L) under the same rule: keep, or give it its own box?
3. The instruments' cases: 10 cm assumed (a VFR set). A gyro panel wants ~17 cm of case + 5 cm: should the case depth
   follow the panel's own instruments (the panel layer knows which it drew)?
4. (answered: sliced off the main thread, round 3)
