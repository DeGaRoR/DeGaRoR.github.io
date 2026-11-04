# AFT-BULKHEAD-SHOTS: the aft wall's new rows, through the glass and inside (4 Nov 2026, cloud, for CABIN-CRAFT)

Evidence only. No game code moved, and nothing built is committed.

- **Code shot:** origin/claude/aft-bulkhead **02220cf3** (the branch head at the start: c4a9bc305 + "the wall's LED strip runs straight"),
  on train L30c e6bcfb368.
  - Checked out into a scratch worktree and built there with `node tools/build.js` (build **96a26c444113**). The page is that tree's
    built `index.html`.
- **Branch:** claude/aft-bulkhead-shots, off origin/claude/aft-bulkhead-look 560b68078 (the study's rig, README and BEFORE stills in
  `../stills/`).
- **Files** (all JPG q85):
  - `before/`, `full/` (FULL, TWIN-A, TWIN-B and the `li_pax 0` twins `...PAX0`), `flat/`, `sling/`, `relief/` (RELIEF1-3 and
    RIVETS): `<build>_<SET>_<day|dusk>_<view>.jpg`;
  - `pairs/`: BEFORE | AFTER side by side, `li_pax 0 | 1`, screws | rivets, and this run's BEFORE next to the study's (check 5);
  - `details/`: the crops for the checks (the FAIL, the Mosquito's deck, the row-change sheets);
  - `probe/`: the headless probe's output per set (JSON); `rig/`: this run's scripts.

## THE VERDICT IN SHORT

- **What sells it:** the light upper panel + the LED strip **through the rear side glass**, day and above all dusk (the twin, the
  Cub FLAT), and the Jodel's lined recess with its arched strip and dome. The wall stops being a black card.
- **One FAIL:** the Cub **SLING**. The rear seat's back frame goes through the canvas sling, up to 20.8 cm, and it shows
  (`details/FAIL_cub_SLING_seat_through_sling.jpg`). See check 3.
- **Reads weakly:**
  - the relief on the Cub: it lands only on the near-black lower wall, and the light upper panel gets none;
  - the fasteners: invisible at q34Fwd on every build;
  - the Cub FULL's net: it stands in front of the strip, which reads as a grille over the lamp again.
- **Page errors:** one, verbatim below. It comes from the train (TANK-FIT 4), not these rows: it fires on the twin and the C172,
  BEFORE included.

## The run

**Renderer**, verbatim, the same on every page (66 lines):

    ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)

Chrome/153.0.8010.12 headless (`/opt/pw-browsers/chromium-1243`). No frame time is quoted.

**Page settings** (the study's):
- `index.html?profile=phone&gfx=laptop&intro=0&idle=0&phmat=full`, plus `&day=dusk` and the rig's dim (x 0.12) for dusk;
- the phone's black studio, preset laptop;
- 1800 x 1000 window, 3D canvas 900 x 1000 at DPR 1;
- one page per build per set: each build is the first and only load of its page, so G3358's flood is on in every frame, as in
  the study.

**Page errors, verbatim** (the rig's `PLANE_SHOT` `errors`, then the stack from this run's added log line):

    TypeError: Cannot read properties of null (reading 'grid')
        at crewEach (<anonymous>:939:15) | at crewTop (<anonymous>:1907:7) | at shapeAt (<anonymous>:1940:34)
        | at evalBack (<anonymous>:1970:18) | at noseAutoGen (<anonymous>:1885:22) | at tick (<anonymous>:1822:53)

- **Where:** `tools/_cage_energy.js:1906`. `crewTop` calls `crewEach(CREW_PTS, ...)` while `CREW_PTS` is null, and it throws at
  `:939` (`const G = P.grid`). It is the nose tank's auto-fit, TANK-FIT 4 455f502fd (on the train, not on this branch).
- **Which pages:** every twin page and every C172 page, **BEFORE included** (c172_BEFORE, twin_BEFORE). It is not from the
  aft-wall rows. The study (L30b) had none on its C172.
- **Every other page:** `"errors": []` (Cub, Jodel and Mosquito, all sets, day, dusk, detail and flip).
- The rig exits 7 on a page error after writing its stills, so every still is there.

**Import:** every build loads through the fleet's Import (plane_shot's own door). Cage rows equal to the file, as the page
clamps them:

| build | rows equal |
|---|---|
| Cub | 879/905 … 886/912 (the new rows add keys) |
| twin 4b | 1027/1027 … 1033/1033 |
| Jodel | 880/906 … 886/912 |
| Mosquito | 973/987, 978/992 |
| C172 | 879/905 |

**The rig:** the study's (`../rig/plane_shot_bk.diff`). It did not apply cleanly to the branch's plane_shot.js (CRLF, and the
pillar-anchors `at:`/`fit:` views are not on this branch), so it was re-applied by hand. `rig/plane_shot_bk.diff` is the result
against the branch's file. Added:
- `bk:inside/<deg>`: inSide;
- `bk:pt/<x>/<y>/<z>/<az>/<el>/<d>`: aim at a point of the layers' frame (the details);
- `rows:<name>`: a row change in the page (`CAGE_UI.setParam` + `CAGE_UI.build()`), then the wall's counts again;
- the full stack of a page exception in the log.

**The face the views aim at:** the study's face (the forward sheet of `bulkhead`) is a thin strip on a stepped wall. So the box
is **every vertex of `bulkhead` + `bulkTrim` within 0.7 m of the forward-most one** (`baggage` for the sling, which has no wall):
- its x/y middle at its forward z;
- the same rule for BEFORE and AFTER;
- on the Mosquito, whose wall leans, this moves the frame a little against the study's (check 5).

**BK_BAND=1 (inClose, inSide):**
- the aim height is **midway from the waist to the face's top**, not the face's middle;
- at 0.6 m the whole face does not fit the frame: the first Cub inClose showed the black lower wall and the seat only, with the
  shelf, the net and the lamp cut off the top;
- this is the band the study found is the one seen; the same height is used for a build's BEFORE and AFTER.

**One-row builds (Jodel, Mosquito), inSide:**
- the eye is on the centre line 5 cm forward of the seat backs (there is no "between the front and rear seats");
- the first Jodel inSide, halfway to the wall, stood 18 cm from it and was re-shot.

**Jodel `inFwdFwd`** (the study's extra, `bk:infwd/-0.215/0/0.4@0.282`):
- the brief's inFwd on the Jodel looks 50 degrees down at the seat backs (the study's note), and is kept as shot;
- inFwdFwd is the eye on the centre line 40 cm forward of the pilot's eye, aimed at the band (y 0.282).

### The builds and sets

The sets are copies of the files with the rows added to `spec.cage` (`rig/mk_sets.js`). `intOn 1` and `intBulk 1` are as saved
on all five builds.

| build | file | intCons |
|---|---|---|
| cub | `builds/cub_2026-09-20_corrected.json` | 1 tube |
| twin | `builds/candidates/Twin_busher_floats_4b.json` (the flagship) | 3 aluminium |
| jodel | `builds/jodel_2026-09-20_corrected.json` | 2 plywood |
| mosquito | `builds/candidates/mosquito.json` (bubble canopy, one seat) | 0 composite |
| c172 | `builds/cessna172_2026-09-20_corrected.json` | 3 aluminium |

- FULL = bhStep 1, bhBevel 0.05, bhTwoTone 1, bhNet 1, bhLamp 3, lightOn 1, li_pax 1.
- FLAT = bhBevel 0.05, bhTwoTone 1, bhNet 1, bhLamp 2, lightOn 1, li_pax 1.
- SLING = bhSling 1.
- TWIN-A = bhBevel 0.05, bhTwoTone 1, bhLamp 2, lightOn 1, li_pax 1; TWIN-B = TWIN-A + bhNet 1.
- RELIEF1-3 = FLAT (twin: TWIN-B) + bhRelief 1/2/3 + bhFast 1.
- RIVETS = twin RELIEF3 with bhFast 2, a direct A/B against RELIEF3's screws.
- `...PAX0` = the same rows with li_pax 0 (check 4).

### The views

| view | rig view | what |
|---|---|---|
| q34Fwd | `bk:out/-30/0/3` | outside, port, 30 deg forward of the beam, level, 3 m, at the face's middle |
| q45Fwd | `bk:out/-45/0/3` | the same at 45 deg forward |
| inFwd | `bk:infwd` | the pilot's eye (`CAGE_CREW_EYE`), the pilot's body hidden, near 0.03 m |
| inClose | `bk:inclose/0.6` + BK_BAND | 0.6 m forward of the face, aimed at the band |
| inSide | `bk:inside/30` + BK_BAND | the centre line between the seat rows, pilot's eye height, looking aft-left 30 deg |
| inFwdFwd | `bk:infwd/-0.215/0/0.4@0.282` | Jodel only (above) |

- Day: all five views.
- Dusk (`&day=dusk`, dim 0.12, li_pax 1): q34Fwd and inFwd.
- `li_pax 0` at dusk: inFwd (+ q34Fwd on the twin, + inFwdFwd on the Jodel).

## THE CHECKS

### 1. No page error; a row change rebuilds

- **Page errors:** FAIL on the twin and the C172 pages, but from the train, not these rows (see above,
  `tools/_cage_energy.js:1906`). PASS everywhere else.
- **A row change rebuilds:** PASS (`details/check1_*`).
  - **Cub FULL, in the page.** Set to the default rows: the sheet goes from bulkTrim 72 / bulkhead 29 / baggage 33 / 24 `bhFace`
    faces to **bulkhead 114 / 0** (a fresh BEFORE's counts), and the passenger lamp meshes go 6 → 4 (the strip's two go). The
    pilot's-eye still then differs from a fresh BEFORE only in the roof dome (li_pax stayed 1) and edge noise (1737 px).
    Set back to FULL: the counts come back, and q45Fwd is **pixel-equal** to a fresh FULL (max difference 2).
  - **Twin TWIN-B:** default rows → bulkhead 114, inFwd **0 px** different from a fresh BEFORE. Back to TWIN-B: the counts come
    back, and q45Fwd shows **0 px different inside the rear window**. 24541 px differ elsewhere, all on the crew's pose and the
    float struts' edges, which shift after the rebuild (`details/check1_twin_TWINB_flipback_q45Fwd.jpg`). It is not the wall.

### 2. Through the glass: anything of the new wall outside the skin

- **Headless** (`rig/rows_probe.body.txt`, all 26 sets):
  - tested: every vertex of `bulkhead`, `bulkTrim`, `baggage`, the fasteners' `toele` and the sling's `tube` inside the wall's
    band, plus the wall lamp's meshes;
  - OUTSIDE = an odd number of hull crossings (body, pillars, loops, the waist band, glass, pane edges) from the pilot's eye
    (cross-read from the cabin's middle at the vertex's station).
- **Result:** none outside on the Cub (all sets), the Jodel, the twin's new faces or the C172.
- **Twin, 13 `toele` vertices** at (0.485, 0.116, 0.861), 1.4 cm out: the alloy liner, in BEFORE as well. Not the wall.
- **Mosquito FULL:** 8 `bulkTrim` vertices of the set-back upper panel flag outside, at (0.071, 0.131, -0.26). The pictures do
  not show it:
  - `details/mosquito_deck_BEFORE-FULL_aft35.jpg` and `..._beam25.jpg` aim at that point from aft-above and from the beam;
  - the deck behind the canopy is clean green in FULL; BEFORE and FULL differ only through the canopy glass (the cabin inside)
    and in a rib-pattern flicker;
  - **PASS by the pictures.** On a bubble canopy the probe's crossing count is not to be trusted (the eye's ray runs along the
    sill band).
- **Found instead, PRE-EXISTING (not these rows):** on the Mosquito BEFORE, the cabin flood lamp (`edLamp_flood`, sited on the
  aft wall's face by today's light layer) **pokes through the deck**. Its dark cup ring is plain on the deck just aft of the
  canopy (`details/mosquito_deck_BEFORE-FULL_aft35.jpg`, left).
  - Headless: 41 of its vertices are outside, at (0, 0.22, 0.04).
  - With FULL the flood moves onto the set-back upper panel (z -0.26 … -0.28), and nothing shows on the deck.
- **The views themselves:** no still shows anything of the wall outside the skin.

### 3. The shelf and the net clear the rear seats and the passengers

- **Headless:** from every vertex of every seat (`edSeat*`) and crew body (`char:*`) inside the wall's x/y box, a forward ray
  (+z) is cast, and every wall section it crosses is counted: a vertex behind a face is in it. "n/deepest" = vertices / the
  deepest (m).

| set | rear seat behind the wall | in the new sections (bulkTrim, baggage) |
|---|---|---|
| cub BEFORE | edSeat2 → bulkhead 731 / 0.216 (the study's 21.6 cm) | - |
| cub FULL, FLAT, RELIEF1-3 | edSeat2 → bulkhead 730 / 0.215 (FULL), 626-653 / 0.165-0.175 | **none: PASS** |
| **cub SLING** | **edSeat2 → baggage 589 / 0.208** | **FAIL** |
| twin BEFORE | edSeat3/4 → bulkhead 677 / 0.092 | - |
| twin TWIN-A/B, RELIEF1-3, RIVETS | edSeat3/4 → bulkhead 471-501 / 0.062-0.063 (less than before) | **none: PASS** |
| jodel all | none | none: PASS |
| mosquito all | none | none: PASS |
| c172 all | none | none: PASS |

- The crew bodies (`char:*`): none behind any wall face on any build.
- **The rear seat in the lower wall is today's own** (BEFORE: 21.6 cm on the Cub, 9.2 cm on the twin). It stays where the wall
  was, under the shelf. The shelf, the recess and the net are clear of it on every build.
- **The FAIL, Cub SLING (`details/FAIL_cub_SLING_seat_through_sling.jpg`):**
  - the rear seat's tan back frame runs through the canvas sling, side on;
  - layer frame (-0.149, 0.124, -0.176) m, world (0.197, 1.024, -0.149);
  - the seat reaches 27 cm aft of its own `zBack` (0.095), down to z -0.176. A closed wall hid that, the open frame does not;
  - the bag is hung from the wall's station aft, `_cage_gen.js:3706` (`zF = z0 - 0.01`, `zA = z0 - Ds`, Ds = bhShelfD 0.25),
    down `H` = 0.26 m (`:3704`) from the shelf line (`:3692`), with no clearance for the rear seat;
  - from the pilot's eye (`sling/cub_SLING_day_inFwd.jpg`) the sling's lower edge sits on the seat back.
  - `details/cub_rear_seat_end_FULL-SLING.jpg`, the same eye on both: in FULL the seat end is inside the closed box under the
    shelf (hidden from the cabin); in SLING it goes into the canvas.

### 4. The lamp

- **Headless:** the wall lamp's lens and diffuser read `emissive ffd9a0` at li_pax 1:
  - the strip: `emissiveIntensity` 0.18 (the channel) / 2.4 (the diffuser);
  - the Jodel's dome: 0.18 / 0.55 / 2.4;
  - all **0** at li_pax 0 (Cub, twin, Jodel). The dome's 34-vertex bezel is `emissive 000000` in both.
- **Which lamp lands where** (as the probes said):
  - Cub FULL: the strip, no dome;
  - Cub FLAT: the strip;
  - Jodel FULL: both;
  - twin TWIN-A/B: the strip;
  - **Mosquito FULL: no wall lamp at all**;
  - C172 FULL: none (no `bhFace`).
- **Pictures:** PASS.
  - `pairs/cub_FULL_dusk_inFwd_pax0-pax1.jpg`: the strip is dark (its diffuser's tint only) at 0, and glows white at 1;
  - `pairs/twin_TWINA_dusk_*_pax0-pax1.jpg`: the same through the rear glass (q34Fwd). The twin's inFwd crops the strip off its
    top edge;
  - `pairs/jodel_FULL_dusk_inFwdFwd_pax0-pax1.jpg`: the strip and the dome.

### 5. Default builds unchanged

`pairs/<build>_study-BEFORE_*`: the study's still (L30b adb2d2a9) | this run's BEFORE, the same view.

| build | view | vs the study |
|---|---|---|
| C172 | q34Fwd, inFwd | **identical** (mean diff 0.0) |
| Cub | q34Fwd | **identical** (0.0) |
| Cub | inFwd | the same (mean 0.4: render noise) |
| Jodel | q34Fwd, inFwd | the same (0.6, 0.1) |
| Cub, Jodel, twin, Mosquito | inClose | differ **by the aim** (this run aims at the band, BK_BAND), not by the wall |
| Mosquito | q34Fwd, inFwd | the same scene, the frame shifted a few % (the face box, above); the wall unchanged |
| twin | all | **a different file**: the study shot `bugReports/Twin_busher_floats_2.json`, this run the 4b flagship |

- In this run, BEFORE and FULL of the C172 are **pixel-identical** at inFwd.
- They differ in 275 px at q34Fwd, a glint at the front sill. FULL's li_pax 1 lights the C172's existing passenger lamps.

## What the probes said, as expected (not bugs)

- **twin 4b: no hat shelf.** Its pod ends 7 cm behind the wall, so bhStep falls back to the flat wall. TWIN-A/B are flat by their
  rows anyway. bhLampY is not used.
- **Mosquito: no lamp at all**, and no net: 64 mm of face over the shelf. FULL draws the bevel, the step and the light upper panel.
- **Cub FULL: the strip, no dome. Jodel FULL: both. FLAT: the strip only.**
- **C172 FULL: no change.** There is no wall to rebuild (bulkhead 100 / toele 120 in both, no `bhFace`), so it is as BEFORE, and
  the pictures are pixel-identical.

## THE STILLS

**Checks** in the table: 2 = nothing of the wall outside the skin, 3 = no seat or body through the shelf, recess or net, 4 = the
lamp glows at li_pax 1 / is dark at 0. "-" = not applicable or not visible in that frame. **Every still was looked at before it
was pushed.**

### Cub (tube; the wall 0.75 x 0.90 m)

| still | what it shows | reads / does not | 2 | 3 | 4 |
|---|---|---|---|---|---|
| before/cub_BEFORE_day_q34Fwd | the rear window's aft end, a dark slot; the lift strut across | as the study: nothing of the wall | - | - | - |
| full/cub_FULL_day_q34Fwd | the same: in the slot, a lit pale patch and the strip | reads as "something lit back there"; the strut covers half | PASS | - | PASS |
| before/cub_BEFORE_day_q45Fwd | the rear window, dark | nothing | - | - | - |
| full/cub_FULL_day_q45Fwd | **the lit recess and the strip framed by the rear window's aft end** | the best Cub outside frame; the net reads as a light grid | PASS | - | PASS |
| before/cub_BEFORE_day_inFwd | the black rounded wall behind the rear seat, the roof dome | the study's black card | - | - | - |
| full/cub_FULL_day_inFwd | a black lower wall, then **the shelf and a cream lined recess** with the net and the glowing strip | the recess reads; the lower wall stays near black | PASS | PASS | PASS |
| before/cub_BEFORE_day_inClose | black wall, the seat's top | dull | - | - | - |
| full/cub_FULL_day_inClose | the recess: the net **in front of the strip** | the strip shows through the mesh: a grille over the lamp again | PASS | PASS | PASS |
| before/cub_BEFORE_day_inSide | the wall edge-on behind the window | nothing | - | - | - |
| full/cub_FULL_day_inSide | the shelf and the net in profile at the top left; the side window fills the right | the step reads; the frame is mostly window | PASS | PASS | - |
| full/cub_FULL_dusk_q34Fwd | dusk: the rear window's slot with **the lit strip** | the glow reads through the glass | PASS | - | PASS |
| full/cub_FULL_dusk_inFwd | dusk: the strip white, the recess lit, the roof dome | reads; the lower wall black | PASS | PASS | PASS |
| full/cub_FULLPAX0_dusk_inFwd | the same at li_pax 0: the strip dark, the roof dome dark | the off state | - | PASS | PASS (dark) |
| flat/cub_FLAT_day_q34Fwd | the slot; the strip and a light panel | as FULL | PASS | - | PASS |
| flat/cub_FLAT_day_q45Fwd | **the strip and the net on the light upper panel** in the rear window | reads well, flatter than FULL | PASS | - | PASS |
| flat/cub_FLAT_day_inFwd | the light upper panel with the strip and the net over the black lower wall | the two-tone reads | PASS | PASS | PASS |
| flat/cub_FLAT_day_inClose | the strip across the panel, the net under it, the screws round the face | **the cleanest Cub close-up**; the panel's top edge is lumpy (it follows the ring) | PASS | PASS | PASS |
| flat/cub_FLAT_day_inSide | the panel and the net at the top left, the window right | as FULL | PASS | PASS | - |
| flat/cub_FLAT_dusk_q34Fwd | dusk, the lit strip in the slot | reads | PASS | - | PASS |
| flat/cub_FLAT_dusk_inFwd | dusk, the strip white over the panel | reads | PASS | PASS | PASS |
| sling/cub_SLING_day_q34Fwd, q45Fwd | the rear window, dark | nothing of the sling from outside | PASS | - | - |
| sling/cub_SLING_day_inFwd | **the open tube frame and a canvas sling** across the cabin, the rear seat under it | the sling's lower edge sits on the seat back | PASS | **FAIL** | - |
| sling/cub_SLING_day_inClose | the canvas filling the frame, the U of tube at the top | a plain light panel: no sag reads | PASS | **FAIL** (see detail) | - |
| sling/cub_SLING_day_inSide | the sling in three quarters, the tube frame, the window | the bag shape reads | PASS | **FAIL** | - |
| relief/cub_RELIEF1_day_q34Fwd | as FLAT | no relief through the glass | PASS | - | PASS |
| relief/cub_RELIEF1_day_inClose | the upper panel (strip, net, screws); **vertical beads on the black lower wall** | the beads are faint (black wall); the upper panel has none | PASS | PASS | PASS |
| relief/cub_RELIEF2_day_q34Fwd | as FLAT | nothing | PASS | - | PASS |
| relief/cub_RELIEF2_day_inClose | horizontal rolls on the black lower wall | faint | PASS | PASS | PASS |
| relief/cub_RELIEF3_day_q34Fwd | as FLAT | nothing | PASS | - | PASS |
| relief/cub_RELIEF3_day_inClose | a frame rail and a stile on the black lower wall | faint | PASS | PASS | PASS |

- **On the Cub the relief lands on the lower wall only.** bulkTrim stays 48 faces in all three, as in FLAT. Only bulkhead grows
  (168 / 208 / 168).
- The orange arrow on the ceiling over the wall, in every Cub close-up: also in BEFORE and in the study. A ceiling fitting, not
  these rows.

### Twin 4b (aluminium; flat wall: no shelf)

| still | what it shows | reads / does not | 2 | 3 | 4 |
|---|---|---|---|---|---|
| before/twin_BEFORE_day_q34Fwd | the rear window: a brown board | the study's flat card | - | - | - |
| full/twin_TWINB_day_q34Fwd | the rear window: **the light panel, the net, the strip** | reads at a glance | PASS | - | PASS |
| full/twin_TWINA_day_q34Fwd | the same without the net | cleaner; the strip reads | PASS | - | PASS |
| before/twin_BEFORE_day_q45Fwd | the rear window, mostly glare | - | - | - | - |
| full/twin_TWINB_day_q45Fwd, TWINA | the same glare, the strip at the top of the pane | less than q34Fwd | PASS | - | PASS |
| before/twin_BEFORE_day_inFwd | dark wall behind the two rear seats | dull | - | - | - |
| full/twin_TWINB_day_inFwd | **the light panel and the net over the rear seats**, the lower wall dark | reads; the strip is above the frame's top | PASS | PASS | - |
| full/twin_TWINA_day_inFwd | the light panel, plain | the two-tone alone already lifts it | PASS | PASS | - |
| before/twin_BEFORE_day_inClose | a dark brown face | dull | - | - | - |
| full/twin_TWINB_day_inClose | the strip across the top, the net, an existing passenger lamp's glow in the middle | reads well | PASS | PASS | PASS |
| full/twin_TWINA_day_inClose | the strip, the plain panel, the lamp glow | clean, a bit empty | PASS | PASS | PASS |
| before/twin_BEFORE_day_inSide | the wall edge-on, the door | dull | - | - | - |
| full/twin_TWINB_day_inSide, TWINA | the panel, the strip and the net in three quarters, the door frame right | reads | PASS | PASS | PASS |
| full/twin_TWINB_dusk_q34Fwd | **dusk: the glowing strip, the light panel and the net through the rear window** | **the best through-glass frame of the run** | PASS | - | PASS |
| full/twin_TWINB_dusk_inFwd, TWINA | dusk: the panel and the net over the seats | the strip is cut off at the top | PASS | PASS | - |
| full/twin_TWINA_dusk_q34Fwd | dusk, the strip glowing in the rear window | reads | PASS | - | PASS |
| full/twin_TWINAPAX0_dusk_inFwd, q34Fwd | li_pax 0: the strip dark | the off state | PASS | PASS | PASS (dark) |
| relief/twin_RELIEF1_day_inClose | **pressed beads on the light panel behind the net and on the lower wall**, the screws round the top | **the relief reads strongly here**; the beads are bold pills | PASS | PASS | PASS |
| relief/twin_RELIEF1_day_q34Fwd | the beads as faint vertical ribs through the rear window | **the one relief that reads at the glancing angle** | PASS | - | PASS |
| relief/twin_RELIEF2_day_inClose | rolls on the lower wall; the upper panel nearly plain (bulkTrim 68) | the lower rolls read, the upper not | PASS | PASS | PASS |
| relief/twin_RELIEF2_day_q34Fwd | through the glass: no rolls | nothing | PASS | - | PASS |
| relief/twin_RELIEF3_day_inClose | a frame rail and stiles on the lower wall, the upper panel framed | reads | PASS | PASS | PASS |
| relief/twin_RELIEF3_day_q34Fwd | a stile through the glass, faint | weak | PASS | - | PASS |
| relief/twin_RIVETS_day_inClose, q34Fwd | RELIEF3 with rivets | see below | PASS | PASS | PASS |

**Screws | rivets** (`pairs/twin_screws-rivets_day_*`):
- at inClose both read. The screws are larger hex-like heads at a wide pitch, the rivets small domes at a close pitch;
- the head line **follows the panel's wavy top edge** while the strip under it runs straight;
- at **q34Fwd neither reads**: no head is resolved through the rear glass. Shimmer cannot be judged on a still, and none shows in
  these frames.

### Jodel (plywood; side by side, one row; the wall 36 cm behind the seat backs)

| still | what it shows | reads / does not | 2 | 3 | 4 |
|---|---|---|---|---|---|
| before/jodel_BEFORE_day_q34Fwd | the canopy, the crew, a brown wall behind them | as the study | - | - | - |
| full/jodel_FULL_day_q34Fwd | the same: a light band behind the crew | the crew hide most of it | PASS | - | PASS |
| full/jodel_FULL_day_q45Fwd | the lit recess faint behind the pilot | weak | PASS | - | PASS |
| before/jodel_BEFORE_day_inFwd, full/jodel_FULL_day_inFwd | the brief's inFwd: 50 deg down at the seat backs | useless (the study's note); see inFwdFwd | - | - | - |
| before/jodel_BEFORE_day_inFwdFwd | from the panel: a plain warm board over the seat backs, a flood patch | the study's dullest wall | - | - | - |
| full/jodel_FULL_day_inFwdFwd | **the same eye: a lined cream recess, the arched strip, the dome, the net across, the shelf** | **the best BEFORE | AFTER of the run** (`pairs/jodel_BEFORE-FULL_day_inFwdFwd.jpg`); the net crosses in front of the dome | PASS | PASS | PASS |
| full/jodel_FULL_dusk_inFwdFwd | dusk: the strip and the dome white | reads | PASS | PASS | PASS |
| full/jodel_FULLPAX0_dusk_inFwdFwd | li_pax 0: the strip and the dome tan, not glowing (the diffuser's tint under the cabin flood, on in every frame) | the off state | PASS | PASS | PASS (off) |
| before/jodel_BEFORE_day_inClose | the warm board, the crew's sleeve | flat | - | - | - |
| full/jodel_FULL_day_inClose | **the lined recess, the arched strip and the dome glowing, the net, the shelf; the crew's red sleeve right** | **the best close-up of the run** | PASS | PASS | PASS |
| before/jodel_BEFORE_day_inSide | the plain board, edge on | dull | - | - | - |
| full/jodel_FULL_day_inSide | **the shelf stepping aft, the recess and the net in profile** | the step and the bevel read | PASS | PASS | - |
| full/jodel_FULL_dusk_q34Fwd | dusk, the crew and a faint glow behind them | weak | PASS | - | PASS |
| full/jodel_FULL_dusk_inFwd, jodel_FULLPAX0_dusk_inFwd | the brief's inFwd at dusk: seat backs | useless, as by day | - | - | - |
| relief/jodel_RELIEF1_day_inClose | beads on the light panel behind the net and on the warm lower wall | reads well (the plywood takes the light) | PASS | PASS | PASS |
| relief/jodel_RELIEF2_day_inClose | rolls on the lower wall | reads well | PASS | PASS | PASS |
| relief/jodel_RELIEF3_day_inClose | a frame rail low, one stile on the upper panel | reads | PASS | PASS | PASS |
| relief/jodel_RELIEF1-3_day_q34Fwd | the canopy, the crew | no relief through the glass (behind the crew) | PASS | - | PASS |

### Mosquito (bubble canopy, one seat; the wall low under the canopy)

| still | what it shows | reads / does not | 2 | 3 | 4 |
|---|---|---|---|---|---|
| before/, full/mosquito_*_day_q34Fwd, q45Fwd | the fuselage and the canopy's rear | nothing of the wall from outside, either | PASS | - | - |
| before/mosquito_BEFORE_day_inFwd | the black wall under the fin, the flood lamp at its top | the study's | - | - | - |
| full/mosquito_FULL_day_inFwd | the same, with **a thin light band** (the upper panel) under the flood lamp | a small lift | PASS | PASS | - (no lamp) |
| full/mosquito_FULL_day_inClose | the light upper panel's arc and the flood lamp | reads, plain | PASS | PASS | - |
| full/mosquito_FULL_day_inSide | the fin through the canopy, the wall small | weak | PASS | PASS | - |
| full/mosquito_FULL_dusk_* | dusk: as day, darker | - | PASS | PASS | - |
| details/mosquito_deck_BEFORE-FULL_* | the deck behind the canopy, aimed at the probe's flagged point | BEFORE: the flood's cup through the deck (pre-existing); FULL: clean | PASS | - | - |

### C172 (aluminium; no wall to rebuild)

| still | what it shows | reads / does not | 2 | 3 | 4 |
|---|---|---|---|---|---|
| full/c172_FULL_day_q34Fwd, before/... | the eye inside the wing (the study's rig artefact: the face is a roof strip), the tank | no change: no wall | - | - | - |
| full/c172_FULL_day_inFwd, before/... | the ceiling panel, the open tail cone | **pixel-identical** to BEFORE | - | - | - |
| full/c172_FULL_day_q45Fwd, inClose, inSide, dusk | the wing, the headliner, the tail cone's frames | no wall, as expected | - | - | - |

## Late stills

- Shot last, and in the tables above: the Jodel's inFwdFwd (day, dusk, li_pax 0), the twin's li_pax 0 at q34Fwd, and the Cub FULL
  / SLING side-on crop of the rear seat's end (`details/cub_rear_seat_end_FULL-SLING.jpg`).

## The three stills that sell it

1. `full/twin_TWINB_dusk_q34Fwd.jpg`: the flagship at dusk. Through the rear side glass, the glowing strip over the light panel
   and the net. It is the view the study found the wall is seen from, and it no longer reads black.
2. `pairs/jodel_BEFORE-FULL_day_inFwdFwd.jpg`: the plain warm board, then a lined, lit recess with the arched strip and the dome.
3. `relief/twin_RELIEF1_day_inClose.jpg`: the pressed beads on the light panel behind the net, the screws round the top. The
   relief at its best; it is also the one relief that still reads (as ribs) through the glass at q34Fwd.
