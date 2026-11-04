# DESIGN-AIDS — STATUS

Cloud session, 3 Nov 2026. Branch `claude/design-aids` (base `origin/master` 0fcf54ef, PHONE-1a). Asked by the user
via A0: garage helpers beyond the CG and neutral point, a failed certification that says what fails and what to do,
a two-tier certificate ("Planes get certified when they're safe to fly, they get their commercial certification when
they're robust and practical"), and one top-bar button with a menu of the indicators in place of the reference swap.

## 0. READY — the user's rulings applied (A0, 3 Nov 08:40)

Branch `claude/ready/design-aids`, REBASED ON `origin/master` a8a23ad6 (train L30a, PHONE-1b included) after the L30b cut dropped
3efbc2e56 on a merge conflict (app.js, editor.js, phone.css). The tier table and `comm` are unchanged by the rebase
(GEN_CERT_TIER, genCertTierOf, genCertTiers, BENCH_STATE().comm: byte-for-byte the 3efbc2e56 code Game's cert-gates was cut on).

| ruling | done |
|---|---|
| **D1** promote the float step ahead of the CG, the float reserve < 1.8 × and the prop within 5 cm of structure: they REFUSE | `aid.step`, `aid.reserve`, `aid.prop` are plain safe-tier rows (no `proposed`): a fail withholds the bench check (64c, 64b GEN_CERT_TIER) |
| **D2** the commercial certificate unlocks passengers for hire and paid contracts (Game wires it) | the one reader: **`window.BENCH_STATE().comm`** (below) |
| **D3** the elevator nose-up at the forward CG and the flare: COMMERCIAL | GEN_CERT_TIER `ctl.elevator: 'comm'`, `ctl.flare: 'comm'` |
| **D4** the float-step band stays 8-16° | unchanged (GEN_AIDS.stepDeg [8, 16, 12]) |
| **D5** a float build's "flies a circuit" uses the hydroplane run | bench.js `benchCircuit(sheet, floats)`: on floats the bench check asks the climb only (≥ 0.3 m/s); the take-off is the hydroplane row's (gating, its own run to lift-off). `_4b` (climb 5.68 m/s, land estimate 1134 m) flies a circuit, and lifts off the water in 22 s |

**`BENCH_STATE().comm`, the shape Game reads** (null until a current bench check, i.e. none run yet, or the aeroplane
changed since):
```
{ verdict: 'pass' | 'warn' | 'fail',   // the commercial tier over every row; a safe-tier fail or a circuit it cannot fly fails it too
  n: 2,                                // how many rows fail it
  warn: 3,                             // how many rows are notes (non-pass, not failing it)
  fails: ['aid.range', 'pitch.Vh'],    // the failing row ids (row ids: GEN_CERT_TIER's keys, 'shake.circuit', TANK-FIT's 'wb.tank<i>')
  notes: ['aid.step'],                 // the warn row ids
  airworthy: true,                     // the airworthiness certificate stands (BENCH_STATE().passed)
  ok: true }                           // airworthy && verdict !== 'fail': THE ONE FLAG for passengers for hire / paid contracts
```
The same object without `airworthy` / `ok` is `results.shake.comm` (`BENCH_STATE().results.shake.comm`); the bench
card's commercial line reads it (`benchCommLine`). Shady contracts: Game's (no reader needed).

**Overlaps:**
- **PHONE-1b's "CG posts on floats": KEPT PHONE-1b'S.** On master it stands the posts on the float layer's step keels
  (`CAGE_FLOAT.tetraC`, the same landmark), so this branch's copy of `standOffset` was dropped at the rebase; the aids
  use PHONE-1b's stand. PHONE-1b also dropped the phone's CG chip (`CG_MARKS_ON`) and draws the posts WITHOUT WORDS on a
  touch screen (G3906b, the user: "at 360 px a label is a smudge"): kept, and the aids follow the same rule on touch
  (geometry only; their numbers are the bench's key issues). The indicators' menu is one of master's new own-body top-bar
  cards (`QPOP_OWN.aids`, beside TIME-CONTROLS' `time`).
- **TANK-FIT's `wb.tank<i>` FAIL rows:** an id GEN_CERT_TIER does not name is SAFE (`genCertTierOf`), so they refuse as
  TANK-FIT intends; nothing to add. Their remedy text shows as their row's `fix` in the key issues.
- **PILLAR-ANCHORS's blocked door:** the commercial row id is **`aid.doors`** ("Doors open fully (egress)"), built by the
  bench from PILLAR-ANCHORS's own `window.CAGE_DOORSWING.last` (its `doors[].red`, `redMM`, `PILLAR_SITE.swingLine`).
  PILLAR-ANCHORS has no row of its own (its answer is a join NOTE), so there is one id; if it ever adds a row, it should
  use `aid.doors` or tell this branch.

## 1. THE ANSWER: what would have helped, from `_2` to `_4b`

The test case: the user's twin-boom pusher on floats, `Twin_busher_floats_2` (a copy is the gate's fixture,
`tools/fixtures/aids/twin_busher_floats_2.json`), and the final `_4b` (on `claude/ready/boom-reach`, run in a scratch
tree with that branch merged for the 916 iS row). Every number below is the model's, from the new aids and verdict
lines (node: `_bake_joined` + `buildGen` + `genShakedown` + `genDesignAids` / `genKeyIssues`; "the room" = the page,
from the renders).

**First, a bug that hid everything:** on a float build the CG / neutral-point posts were **never drawn** in the garage.
`standOffset()` placed them by the wheel legs and a float build has none, so it returned null and hid them. The
user's twin on floats never showed its own −18 % margin in the room. Fixed: the posts (and all the aids) now stand on
the float layer's step keels (`CAGE_FLOAT.tetraC`), the same points as the lattice's float nodes.

| step `_2` → `_4b` | the aid or verdict line that points to it, on `_2`, with its number | what the user did / the result |
|---|---|---|
| **stability −18 %** (CG well aft of the NP) | **Key issue 1, safe to fly, rejects:** "Static margin −0.18 MAC · unstable in pitch: margin −18 %, needs +5 % or more → **move the wing aft ~0.58 m**, or the stabiliser alone cannot (it would take +470 %), or move ~140 kg forward 2 m (0.35 m of CG)". The remedy comes from the rebuilt aeroplane: wing 0.1 m aft gives +0.040 MAC; stab +10 % gives +0.005. Room: the **centre-of-lift** arrow stands 0.60 m *ahead* of the CG (wing 83 % of the area), and the CG and NP posts are red. | wing moved aft 0.45 m + a little tip sweep → `_3` margin +25 %, `_4b` +18 % (every loading +7 … +21 %) |
| **sat tail-down / reared** on the water (step ahead of the CG) | **Key issue 2, safe to fly (refuses, D1):** "Float step against the CG −3.2° · the step is 0.09 m AHEAD of the CG → **move the floats aft 0.46 m** (the step to 12°)". Room: the CG→step line, the vertical through the CG and the target line, all on the floats. Checked with the bench's own hydroplane run (headless): as built it sits **31° nose-up at rest, rears to 89° and aborts**; with the floats moved the aid's 0.46 m it sits at −2°, gets over the hump (R/W 0.21) and **lifts off in 27 s**. | the float-step fix (FLAGSHIP's AFT_REACH) → in the room `_4b`'s step is **12° aft** (pass); node's bake reads `_3`/`_3b` 4.8°, `_4` 1.0°, `_4b` 2.0° (see the caveat below). `_4b` lifts off in 22 s |
| **floats too small** for 4-up | **Key issue 3, safe to fly (refuses, D1):** "Float buoyancy reserve 1.60 × gross · 1272 kg for 796 kg; at gross 0.35 m deep of 0.45 m → **floats 11 % too small**: scale them 4 % (length, beam, depth), or 90 kg lighter". Room: the waterline at gross on each float and "floats 1.60 × the weight". | floats 4.59 × 0.55 → 5.0 × 0.68 m: `_4b` **2.19 ×** (pass) |
| **916 iS** for four aboard | no new aid: power is the hydroplane test's (hump R/W against T/W) and the bench's climb. The **CG range** aid shows the four-up corner (full cabin, full fuel). | `_4b` climbs 5.68 m/s (was 4.87), off the water in 22 s |
| **prop strike** against the wing TE / flaps | **Key issue 4, safe to fly (refuses, D1):** "Propeller clearance 0.03 m · 0.03 m from **the flap, down 35°** → the disc 8 cm further (the engine aft, a smaller disc, or shorter flaps)". Measured against the **drawn** disc (the editor's own hub, `CAGE_ENG.units[i].propAt`: on the twin it turns 0.105 m aft of the engine station). Room: the disc's circle and a rod to the flap's trailing edge, flaps down. The same 3 cm on `_3` / `_3b`. | flaps out to the ailerons: on `_4` / `_4b` no flap is in the disc; the nearest structure is the wing's TE at 0.20 m (pass) |
| **doors blocked** by the wing and struts | **commercial · robust and practical:** "Doors open fully (egress)", from PILLAR-ANCHORS's door-swing check (`CAGE_DOORSWING`, the editor's idle pass) — a menu item and a bench row once that branch is on master; until then the aid says "door swing: not measured". | the wing raised, the float struts lower, the sill up → `_4b` every door swings clear (PILLAR-ANCHORS's table) |
| **margins varying between loadings** | **commercial:** "CG over every loading (seats × fuel) · margin −18 … −29 % (the worst: solo · reserves) → the wing aft ~0.85 m …". Room: the CG-range bar on the ground with a tick per corner and the NP in red. | `_4b` +2 … +17 % in the room (orange aft corner: a commercial note), +7 … +21 % in node |

**`_4b` with the aids, in the room** (`tb4b_aids_side_desktop.png`, `tb4b_aids_prop_range_tails_q_desktop.png`):
**green on every safety aid** - margin +14 % (the page's sheet; node's bake +18 %), the step 12° aft of the CG, the
floats 2.19 × the weight, the thrust line 0.30 m above the CG (3 % of the elevator), the prop 0.20 m from the wing's
TE, tail volume 1.11, fin 0.063. **One commercial note:** over the loadings the margin runs +17 … +2 % in the room (the
aft corner: solo, reserves - orange; node's bake +21 … +7 %). Airworthiness ✓; commercial ✓ with that note.

Two caveats found on the way, both pre-existing, both for A0:
- **node's `_bake_joined` places the twin's floats differently from the page's join.** In the browser the float layer
  stands the step off the CG as flown (`CAGE_FLOAT.cgFrom`), so `_4b`'s step is 12° aft; node's bake reads 2° (and
  `_2` −3.2° in node, −1° in the room: "move the floats aft 0.46 m" in node, 0.38 m in the room). Within the page the
  room and the bench agree; the gate and the survey are node's numbers.
- **`_4b` (and `_3`) fail master's bench check "flies a circuit": take-off 1134 m against the 1100 m bar**, while the
  bench's own hydroplane run gets `_4b` off the water in 22 s. The take-off estimate looks like a land run with the
  floats' drag; nothing of this branch changes it (master's rule says the same, section 6).

## 2. THE SPLIT: safe to fly / robust and practical

The rule: a fail in the **safe** column withholds the airworthiness certificate. Everything in the **commercial**
column is a WARNING on the airworthiness certificate and a fail of the commercial one.
One table in the code: `GEN_CERT_TIER` (`src/core/64b_gen_design.js`), read by `genCertTiers` and the bench.

| check (row id) | tier | why |
|---|---|---|
| bench check: flies a circuit (climb ≥ 0.3 m/s, take-off ≤ 1100 m; on floats the climb, the take-off is the hydroplane row's - D5) | safe | can it fly at all |
| static margin, normal loading (`pitch.sm`; the game's sheet is the drawn loading) | safe | unstable in pitch |
| short-period pitch mode (`pitch.short`) | safe | |
| elevator nose-up at the forward CG (`ctl.elevator`), the flare power-off (`ctl.flare`) | **commercial** (D3) | judged at the forward loading corner |
| weathercock, dihedral effect, spiral, dutch roll, roll mode (MIL-F-8785C worse than Level 2) | safe | |
| aileron roll power, drooped ailerons, rudder crosswind (FAR 23.233) | safe | control |
| wing loading: holds the ultimate (`load`) | safe | structure |
| test flight: arrives (`flight`) | safe | |
| hydroplane: lifts off the water (`hydro`, floats) | safe | |
| **float step against the CG (`aid.step`)** | safe (D1) | a step ahead of the CG rears and capsizes it — NEW, refuses |
| **float buoyancy reserve ≥ 1.8 × (`aid.reserve`)** | safe (D1) | FAR 23.751 — NEW, refuses |
| **propeller clearance, ground / water / structure, flaps down (`aid.prop`)** | safe (D1) | a prop strike — NEW, refuses |
| horizontal and vertical tail volume (`pitch.Vh`, `yaw.Vv`) | **commercial** | Raymer's sizing table is headroom; the modes above measure the safety. **Moved: relaxes** |
| CG over every loading — every seat × full fuel / reserves (`aid.range`) | commercial | the user: "margins varying a lot between loadings" |
| doors open fully, egress (`aid.doors`, PILLAR-ANCHORS's check) | commercial | the user: "doors blocked by the wing and struts" |
| thrust line against the CG (`aid.thrust`, warn over half the elevator at 1.3 Vs) | commercial | a go-around's trim change |
| ground stance: tip-back / mains ahead, nose-wheel share (`aid.stance`) | commercial | ground handling |
| wing loading's yield proxy (`load` warn) | commercial (was a warning already) | durability margin |
| density altitude (`dalt`, advisory already), the belly pod (`pod`, advisory already) | commercial | practicality |

**Existing certificates:** the design check's own rows only relax (tail volumes, the elevator and the flare moved to
commercial; GATE AIDS holds that its airworthiness fails are a subset of master's), and a float build's circuit no
longer reads the land take-off. The only NEW refusals are the three promoted aids rows (D1). Section 6 names every build
whose verdict moves.

**Not wired to the career's economy** (the commercial certificate is a line on the bench and a verdict in the data:
`r.comm`). Question for the user / the Game session: what does the commercial certificate unlock (passengers for hire,
contracts, a price)?

## 3. THE AIDS AND THE MENU

All in the 3D view, in the CG posts' own group and style, built when the posts are built (a release, the balance
job's answer, the sheet's), never per frame; an aid that is off computes nothing. One function feeds the room and the
bench: `genDesignAids(def, balance)` (`src/core/64c_gen_aids.js`, pure geometry + the ledger + the float's hull
tables, ~13 ms on the twin).

| aid | what is drawn | default |
|---|---|---|
| CG + neutral point | the existing posts (now also on float builds) | on |
| Centre of lift | an arrow up from each surface's aerodynamic centre (area-weighted quarter chord of its strips: the solver's own force points), length and thickness by its share of the area; label: share, area, distance from the CG | off |
| Thrust line | the thrust arrow at the disc, the line through the aeroplane, its offset from the CG; label: offset, full-power pitch moment (nose-up/down, N m), its share of the elevator at 1.3 Vs | off |
| Floats | the CG→step line, the vertical through the CG, the target (12°) line, the step marks, the waterline at gross on each float; labels: "step N° aft / AHEAD of the CG — move the floats aft X m", "floats R × the weight — floats N % too small" | on for a float build |
| CG range | a bar on the ground from the forward to the aft corner, a tick per corner (coloured by its margin band), the NP in red | off |
| Tail volumes | tail and fin volumes against typical, at the stab; the wing-AC → stab-AC arm | off |
| Prop clearance | the disc's circle, a rod to the nearest structure in it (flaps down), the drop to the ground / water; label in cm | off |
| Ground stance | the main contact → CG line and the vertical; tip-back angle, nose-wheel share | off (wheels only) |
| Door swing | PILLAR-ANCHORS's last door-swing answer as a label over the cabin ("not measured" until that lands) | off |

The menu: the top bar's reference-cut button (`QUICK` 'ref') is **gone**; in its place one button (`QUICK` 'aids', a
CG post and a lift arrow) opens the top bar's card (`#edPopCard`, already draggable: FLYDIY_DRAG 'quickPop') with two
columns of 44 px toggles, one per aid (greyed where the aeroplane has nothing to say), and the reference's cut as the
last item ("Reference: both whole / reference halved / split halves"; disabled with no reference standing). The
reference swap is used (REF_MATCH's fit-to-reference work), so it stayed as an item, not dropped. Toggles persist in
`flydiy.aids` (the viewer prefs store, never the build). Same menu on the phone (the phone's CSS had hidden the old
ref button when no reference stood; the indicators' button always shows).

**Rules kept:** no new screen estate (one button replaced one button); the card opens under the top bar, two columns
so its 5 rows stay in the top band (it never reaches the view's centre at 360 × 780); WYSIWYG (the bench reads the
same `genDesignAids` rows the room draws); cheap.

## 4. THE VERDICT FORMAT

On a failed or warned bench check, the card and the panel row open on **KEY ISSUES** (3-5): the title with its number,
which certificate it belongs to ("not safe to fly" / "safety · warning" / "commercial · robust
and practical"), what it means in plain words, and **→ the remedy, sized**. The full report (the design check's 13
rows + the aids' rows) is folded under "full report", one tap away. The commercial line sits under the issues and in
the bench's header ("commercial ✗ 5 issues" / "commercial ✓ robust and practical"). The phone shows the compact list
(title, number, remedy). The remedies: the margin's levers are measured on the **bench's thread** (`bench_worker.js`
'levers': the aeroplane rebuilt with the wing 0.1 m aft and the stab 10 % bigger, ~1.5 s, never on the page while
there is a thread); the issues show first and the sized remedy replaces the generic one when the levers land.

## 5. RENDERS (`flyDiy/reports/evidence/DESIGN-AIDS/`)

The room: `tools/aids_shot.js` (Playwright's Chromium on SwiftShader, the phone profile's studio, the build imported
through the fleet's own #gFile, the aids set in the menu's own preference key; the 3D canvas, marks on). At 1600 × 900
the phone profile's view is the left half (the controls sheet takes the right); the desktop profile loads the whole
world and did not finish in 20 min on SwiftShader, so the "desktop" stills are the phone profile at desktop size. The
cards: `tools/aids_verdict_shot.js` (the bench's own `BENCH_TESTS` 'shake' run, renderers and bench.css, laid out as
the award card).

| file | what |
|---|---|
| `tb2_aids_floats_side_desktop.png` | `_2`, CG + floats: "step 1° AHEAD of the CG — move the floats aft 0.38 m", "floats 1.60 × the weight — floats 11 % too small", the level waterline at gross, the red posts (−18 %) — on a float build, where the posts never showed before |
| `tb2_aids_lift_thrust_side_desktop.png` | `_2`, CG + centre of lift + thrust: the wing's lift 0.60 m ahead of the CG, the stab's 4.13 m aft, the thrust line 0.29 m above the CG (nose-down 685 N m, 6 % of the elevator) |
| `tb2_aids_prop_range_tails_q_desktop.png` | `_2`, prop + CG range + tails: the disc and its 3 cm to the flap down, the CG range bar −18 … −29 %, tail 0.68 / fin 0.090 against typical |
| `tb2_aids_floats_phone.png` | `_2` at 360 × 780 (the view band), CG + floats - rendered before the L30a rebase: since PHONE-1b a touch screen draws the posts and the aids without words |
| `tb2_menu_open_desktop.png` | the indicators' menu open (defaults on a float build: CG + floats on, ground stance greyed, the reference item disabled with none standing); the card clear of the view's centre |
| `tb2_menu_open_phone.png` | the same on the phone: the card opens below the view band, the aids stay in sight |
| `tb2_verdict_before.png` | `_2`'s bench-check card as master has it (two fail lines, the 13 rows in one list) |
| `tb2_verdict_after.png`, `tb2_verdict_after_full.png`, `tb2_verdict_phone.png` | after: the 5 key issues with their sized remedies and tiers, "commercial ✗", the full report folded / opened; the phone's compact list |
| `tb4b_aids_side_desktop.png` | `_4b`, CG + floats + lift + thrust: green (step 12° aft, floats 2.19 ×, margin +14 %, the lift 0.17 m ahead of the CG) |
| `tb4b_aids_prop_range_tails_q_desktop.png` | `_4b`, prop + range + tails: the prop 20 cm from the TE (green), tail 1.11 / fin 0.063, the CG range +17 … +2 % (orange: the commercial note) |
| `tb4b_verdict_*.png` | `_4b`'s card (node: the take-off bar of master's check, and the node bake's 2° step note) |

## 6. SURVEY: every build's verdict, before and after the rulings (`tools/aids_survey.js`, node)

"Before" = master's rule (every design-check fail refuses; the circuit = climb + the 1100 m land take-off; a float build
also needs the hydroplane run). "After" = the tiers with D1 (the three aids rows refuse), D3 (the elevator and the flare
commercial) and D5 (a float build's take-off is the hydroplane run's). The hydroplane run is the bench's gating row,
flown headless the way app.js flies it. 45 builds: the repo's `builds/`, `builds/candidates/` (+ `review/`), the repro
fixtures, the two bugReports and `_4b`. The float builds were run again on the PHONE-1b tree (FLOAT-CG moves the float
step): the same verdicts.

**THE BUILDS WHOSE AIRWORTHINESS VERDICT CHANGES (4):**

| build | before | after | why |
|---|---|---|---|
| `Twin_busher_floats_4b` | refused (circuit: land take-off 1134 m) | **certifies** (+1 note) | D5: off the water in 22 s, climb 5.68 m/s |
| `c172r_wipline2350_stcprop_2026-10-20` | refused (circuit: land take-off 1345 m) | **certifies** (+1 note) | D5: off the water in 54 s |
| `build_v7_twin_2026-09-04` (review) | refused (`ctl.elevator`) | **certifies** (+3 notes); commercial fails | D3: the elevator at the forward CG is commercial |
| `Twin_busher_floats_3b` (review) | certifies | **refused** (`aid.prop`) | D1: the prop 3 cm from the flaps down (the user's prop strike) |

Refused before and after, for a different reason: `Twin_busher_floats_3` (circuit → `aid.prop`, 3 cm from the flaps down)
and `_2` (now also the three aids rows). Every other build keeps its verdict; the notes are warnings.

| build | margin % | take-off m | hydroplane | before (master) | after (the tiers) | | commercial |
|---|---|---|---|---|---|---|---|
| c172r_wipline2350_landprop_2026-10-20.json | 13 | 1576 | STAYS ON | refused (circuit, hydro) | refused (hydro) |  | fail |
| c172r_wipline2350_stcprop_2026-10-20.json | 14 | 1345 | off in 54 s | refused (circuit) | certifies + 1 warn | CHANGED: now certifies | warn |
| cessna172_2026-09-20.json | 24 | 147 | - | certifies | certifies + 2 warn |  | warn |
| cessna172_2026-09-20_corrected.json | 20 | 300 | - | certifies | certifies + 1 warn |  | warn |
| chinook_2026-09-21.edits.json | 64 | 163 | - | certifies | certifies + 3 warn |  | fail (aid.stance) |
| chinook_2026-09-21.json | -18 | 184 | - | refused (pitch.sm, pitch.short) | refused (pitch.sm, pitch.short) |  | fail (pitch.sm, pitch.short, aid.range) |
| chinook_2026-09-21_corrected.json | 7 | 102 | - | certifies | certifies |  | pass |
| composite_jodel_2026-10-07.json | 2 | 248 | - | certifies | certifies + 3 warn |  | fail (aid.range) |
| cub_2026-09-20.json | 13 | 164 | - | certifies | certifies + 4 warn |  | fail (aid.range) |
| cub_2026-09-20_corrected.json | 17 | 157 | - | certifies | certifies + 2 warn |  | warn |
| jodel_2026-09-20.json | -4 | 215 | - | refused (pitch.sm) | refused (pitch.sm) |  | fail (pitch.sm, aid.range) |
| jodel_2026-09-20_corrected.json | 4 | 206 | - | certifies | certifies + 4 warn |  | warn |
| pa18_floats_2026-10-23.json | 13 | 793 | off in 21 s | certifies | certifies + 3 warn |  | warn |
| rufus_2026-10-18_certified.json | 18 | 77 | - | certifies | certifies + 1 warn |  | warn |
| mosquito.json | 17 | 84 | - | certifies | certifies + 2 warn |  | warn |
| mosquito_0.json | 17 | 84 | - | certifies | certifies + 2 warn |  | warn |
| mosquito_1.json | 17 | 83 | - | certifies | certifies + 2 warn |  | warn |
| mosquito_2.json | 18 | 96 | - | certifies | certifies + 1 warn |  | warn |
| mosquito_3.json | 33 | 109 | - | certifies | certifies + 1 warn |  | warn |
| rufus_2026-10-18.json | 32 | 55 | - | certifies | certifies + 4 warn |  | warn |
| rufus_2026-10-18_certified.json | 18 | 77 | - | certifies | certifies + 2 warn |  | warn |
| cessnaFloatsWOrks.json | 27 | 1068 | off in 30 s | certifies | certifies + 1 warn |  | warn |
| cessnaMetal (1).json | 24 | 147 | - | certifies | certifies + 2 warn |  | warn |
| build_v7_ultralight_2026-09-05.json | 10 | 43 | - | certifies | certifies + 4 warn |  | warn |
| Twin_busher_floats_2.json | -18 | 1019 | STAYS ON | refused (pitch.sm, pitch.short, hydro) | refused (pitch.sm, pitch.short, aid.step, aid.reserve, aid.prop, hydro) |  | fail (pitch.sm, pitch.short, aid.range, aid.step, aid.reserve, aid.prop) |
| Twin_busher_floats_3.json | 25 | 1137 | off in 27 s | refused (circuit) | refused (aid.prop) |  | fail (aid.prop) |
| camel_2026-10.json | -0 | 162 | - | refused (pitch.sm) | refused (pitch.sm) |  | fail (pitch.sm, aid.range) |
| cub_fittings_hand_2026-10.json | 17 | 157 | - | certifies | certifies + 2 warn |  | warn |
| dc3_2026-10.json | 18 | 328 | - | certifies | certifies + 2 warn |  | warn |
| mosquito.json | 17 | 84 | - | certifies | certifies + 2 warn |  | warn |
| Twin_busher_floats_3b.json | 24 | 1100 | off in 22 s | certifies | refused (aid.prop) | CHANGED: now refused | fail (aid.prop) |
| Twin_busher_floats_4.json | 23 | 1063 | off in 26 s | certifies | certifies + 1 warn |  | warn |
| birdman.json | -18 | 184 | - | refused (pitch.sm, pitch.short) | refused (pitch.sm, pitch.short) |  | fail (pitch.sm, pitch.short, aid.range) |
| build_v7_twin_2026-09-04.json | 33 | 111 | - | refused (ctl.elevator) | certifies + 3 warn | CHANGED: now certifies | fail (ctl.elevator) |
| build_v7_ultralight_2026-09-05.json | 11 | 43 | - | certifies | certifies + 3 warn |  | warn |
| build_v8_pusher_2026-09-11.json | -4 | 99 | - | refused (pitch.sm) | refused (pitch.sm) |  | fail (pitch.sm, aid.range) |
| composite_jodel_2026-10-07.json | 2 | 248 | - | certifies | certifies + 3 warn |  | fail (aid.range) |
| cub_quadwin_2026-10.json | 17 | 157 | - | certifies | certifies + 2 warn |  | warn |
| flydiy-build (4).json | -5 | 148 | - | refused (pitch.sm) | refused (pitch.sm) |  | fail (pitch.sm, aid.range) |
| stol_cub_kit.json | 16 | 117 | - | certifies | certifies + 3 warn |  | warn |
| stearman_2026-10.json | 4 | 289 | - | certifies | certifies + 5 warn |  | warn |
| stol_cub_showcase.json | 19 | 58 | - | certifies | certifies + 2 warn |  | warn |
| tigermoth_2026-10.json | 0 | 226 | - | certifies | certifies + 2 warn |  | warn |
| ugly_bi.json | 12 | 189 | - | certifies | certifies + 3 warn |  | warn |
| Twin_busher_floats_4b.json | 18 | 1134 | off in 22 s | refused (circuit) | certifies + 1 warn | CHANGED: now certifies | warn |

## 7. GATES

On the READY tree (`claude/ready/phone-1b` 4f959b92 + this branch), A0's list, `--jobs=3`:

**PASS (20):** AIDS, DESIGN, PARTS, SAVE, CAGEFIT, UISMOKE, UISMOKE-PHONE, UILAYER, CARDS, CARDDRAG, VIEW, BOOMBOX,
DESIGNCHECK, BENCH, CGBAND, ACCEPT, CONTRACTS, SPECFIX, HINGE, MEDIA.

**FAIL (2), both FAILING THE SAME ON CLEAN `claude/ready/phone-1b`** (a detached worktree, the same hour) - PHONE-1b's,
not this branch's (both passed on the FINISH-4 base with this branch):
- **SHEETWORKER**: "the editor says when a hand is on a slider (or its settle build is owed)".
- **STORY**: "the beat card: T0's title and brief, no step counter ... the hangar not ours yet".

Earlier, on the FINISH-4 base: the same list passed whole (SHEETWORKER and STORY included). Outside the list, STOL,
POD, DMGCERT and BENCHTIME fail the same on clean master (stale byte baselines, the destruction test, wall-clock budgets);
POD's shakedown-sheet digests are master's (this branch writes no field into the sheet).

## 8. QUESTIONS (answered by the user 3 Nov: D1-D5 above)

Still open:
1. **The page's join and node's bake** place the twin's floats differently (section 1): the gate's and the survey's
   numbers are node's. For the float layer's owner (FLOAT-CG's handshake work in PHONE-1b is the same seam).
