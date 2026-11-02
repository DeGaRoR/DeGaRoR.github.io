# TANK-FIT — STATUS (cloud, 2026-11-03)

Branch `claude/tank-fit` (base `origin/master` 0fcf54ef = PH1A). Not rebased on FINISH-4 / CABIN-CRAFT / PHONE-1b yet
(they were not on master when this was cut: the user's builds were read from `origin/claude/ready/candidates-4b`).
Generated files are NOT committed (the train builds): `node tools/build.js` before any page or gate.

Commits, in landing order:
1. **the clearance revamp + perf + the strut rule + the twin's cowl (case A)** — lands alone;
2. **the nose auto-fit (Part 2)** — new nose tanks only; saved tanks untouched; the validated ones behind a flag;
3. this file and the renders.

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

## The nose auto-fit (Part 2) — `N_*`
A DECK tank (G1150's form: flat floor, a top following a profile across the width) fitted to what is drawn:
floor = the bottom of the dash + 1 cm (never into the footwell); back = the dash and the instruments standing forward
of it (the crew layer's panel) + 2 cm; front = the firewall − 2 cm; top = each column's lowest ceiling over the length
− the GAP (default **10 cm**, the user's figure; a row 0-20 cm); width = the narrowest inner width − 2 cm a side; then
placed by its own numbers and judged like any tank, smaller until it clears. Capacity = its own volume (the deck
form's: section area x length x the shell's 0.90 fill). It is the shape of a nose tank marked `fit: 'auto'`: a new
nose tank, a tank moved to the nose, or the panel's "auto-fit (behind the panel)"; a size, fore/aft, up/down or turn
row makes it the player's (free). The cabin, boom and other bays stay free-size.

**Measured (auto, 10 cm / 5 cm / 3 cm gap)**:

| build | today's nose tank | auto 10 cm | auto 5 cm | auto 3 cm | what limits it |
|---|---|---|---|---|---|
| metal Cessna (C172) | 25 L box (fits) | **26 L** fits | 41 L | 41 L | firewall → panel back 0.18-0.20 m |
| Cub | 28 L shaped (red: crew) | **11 L** fits | 15 L | 15 L | the instruments' cans hang ~10 cm forward of the panel: 0.13 m firewall → cans |
| Jodel | 45 L shaped (red: crew) | **5 L** | 10 L | 12 L | 0.07-0.14 m from the dash's bottom to the deck |
| ugly_bi | 60 L box (fits) | **19 L** | 29 L | 32 L | the deck height above the dash bottom |
| twin pusher (pod nose) | — | no fit | — | — | 55 mm from the dash bottom to the nose top |

References: J-3 Cub 12 US gal = **45 L** in exactly this place (behind the panel, under the deck — but its tank comes
down past the instruments, which are few and shallow); C172 has NO nose tank (2 x ~100 L in the wings); a Jodel D11
carries ~60 L behind the panel. Our noses as drawn, with the floor at the dash's bottom and a 10 cm gap, hold far less
than those: the shapes are honest, the numbers say the nose geometry (the dash height, the instrument cans' depth)
or the gap is what is short (Open questions 2-3).

**Saved builds — nose litres before/after and the CG move, ONLY under `window.TANK_NOSE_AUTO_ALL = true`** (default:
nothing moves; the flag also fits a save's nose tank that has no station and no box of its own):

| build | before (as the game shapes it) | after (auto, 10 cm) | CG move x / y | empty+fuel mass |
|---|---|---|---|---|
| builds/cub_2026-09-20_corrected (validated) | 28 L, red (46 mm into crew) | 11 L, fits | +15.9 / +36.9 mm | 461.7 → 445.2 kg |
| builds/jodel_2026-09-20_corrected (validated) | 45 L, red (21 mm into crew) | 5 L, fits | +28.8 / −37.2 mm | 464.2 → 425.4 kg |
| builds/composite_jodel_2026-10-07 | 45 L, red | 5 L | +27.2 / −33.4 mm | 514.4 → 473.3 kg |
| tools/fixtures/camel_2026-10 | 44 L, red (57 mm into the engine) | 44 L, red (61 mm into the engine) — no auto shape clears | −0.2 / 0 mm | 716 → 716 kg |
| tools/fixtures/cub_fittings_hand_2026-10 | 28 L, red | 11 L | +15.9 / +36.9 mm | 461.7 → 445.2 kg |
| tools/fixtures/cub_quadwin_2026-10 | 28 L, red | 11 L | +15.9 / +36.9 mm | 461.2 → 444.8 kg |
| tools/fixtures/stol_cub_kit | 28 L, red | 11 L | +15.5 / +36.2 mm | 482.3 → 466.0 kg |
| validated C172 (metal Cessna) | 25 L, its own box: **not eligible**, never changed | — | — | — |
| every other saved tank (29 with their own place or box) | unchanged | — | — | — |

(CG x is the core's model frame, + = aft of where it was. These are NOT applied: the user's OK first.)

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

## Gates (node, this tree built with `node tools/build.js`; `run_gates.js --only=... --jobs=4`, 3 Nov)
PASS: TANKMOUNT, ENERGY, ENERGYBASE, PARTS, DESIGN, SAVE, CAGEFIT, JOIN, FLOATKIT, COWL, STARTER, DASH, LIGHT.
(DASH, LIGHT, NODUMMY, PARTS, TANKMOUNT, ENERGY are the gates that read `_cage_energy.js`.)
FAIL, **standing on master** (the same run on an origin/master worktree, the same lines):
* TECH: "every option of every covered table has a segment [pitch:seaplane]";
* NODUMMY: `edDum` references in tools/_crew_head_probe.js, tools/newshapes_build.js, tools/quickshot.js;
* ENGCONFIG: its pinned hashes (off an older master) differ for 17 builds and 3 cards on master too. This tree's
  hashes are master's for every one EXCEPT `builds/chinook_2026-09-21_corrected.json` (bf6854b8… → 0ce32059…, the
  def hash 9a62a6a6…): the strut pods' drag (Part 3), intended.
Row updates (the honest verdict): TANKMOUNT's stock-tank row holds the floatplane card's deck tank as KNOWN (3 mm into
a tube, ≤ 4 mm), and its raycast skips the contact markers; DASH reads "N mm into the dash". The Chinook's
KNOWN_REMAP line no longer prints (the pod stays on its struts).
Not run here: the full tier (ARCHETYPES, PILOTMATRIX, SEAPLANE, HOTHIGH) and the browser gates (UISMOKE...). The
editor's rows (the auto-fit select, the gap row, dragLayout on input) are untested in a page: a look is owed.

## Open questions for the user
1. "A tank that does not fit does not fly": master flies it as drawn since G3877 (your 29 Oct call). Kept. Do you
   want the drop back (the coordinator's wording), or is the red warning enough?
2. The auto nose tank's gap: 10 cm (your figure, as A0 read it) gives 11 L on the Cub, 26 L on the C172. Was the
   "10 cm gap" the gap under the deck, or the space between the dash and the firewall?
3. Its floor at the dash's bottom: the Cub's and the Jodel's real tanks come down below their panels' tops; ours stop
   at the bottom of the dash — and the Cub's instrument cans take 10 cm of the length. Allow the tank under the cans /
   lower floor (above the feet), or keep it strictly behind the dash?
4. Apply the auto-fit to the validated Cub / Jodel nose tanks (the table above), the floatplane card's tank (3 mm into
   a tube), and the twin floatplane's header tank (case D)?
