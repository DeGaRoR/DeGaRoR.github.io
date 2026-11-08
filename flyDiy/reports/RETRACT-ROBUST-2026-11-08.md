# RETRACT-ROBUST - the retractable gear on reasonable planes, and the rules for its cuts (2026-11-08, cloud)

- **Who:** a cloud tester session. It ran tests and wrote reports only; it changed no game code. The fixes belong to the
  SEAPLANES-LAND session.
- **Base tested:** `origin/claude/seaplanes-merge` at **15ad5d66** (SEA-OFF + tour_real Digit9). The branch had moved from
  7f6e1df6 at the launch, and A0 asked for the newest tip. It is not on master yet.
- **Where it ran:** node only (RETRACT-LAB is on in node). Every picture is quickshot's headless drawing. Every flight is
  the game's host flying the load door's spec.
- **Status:** FINAL for this pass (8 Nov). The rules (section 6) are a proposal for the user to agree to; SEAPLANES
  implements them after that.

## 0. In one paragraph

Switching retract on works mechanically. It builds and flies on every tricycle: the gear goes up and down in the cycle
time, and the plane lands on its wheels. **But on none of the six ordinary tricycles tested does any preset fold fit.**
The only green results are the hand-tuned Super Petrel and the 0.6 partial retraction, and the partial is green only
because the skin test is skipped for a partial fold. Every red design is still **cut** (belly and wing wells, doors made)
and still **flown as retractable**. The join writes `gear.retract` without reading the fit verdict
(`tools/_cage_join.js:471`), so the gear's drag is credited away while the drawn wheels hang outside.

The cuts are made from the swept points that happen to fall inside the body, whatever the fit says. On the low-wing
cards this produces two things nothing checks:
- one merged mains well 1.0-1.5 m wide straddling the keel and the wing's rear-spar line (the carry-through);
- a nose well whose aft end crosses the front-spar line.

The root cause is geometric: the cards' gear is laid out for a fixed gear. The mains sit at 60-90 % of the chord, the
half track is too narrow for the leg, and the wing is about 100 mm deep where a flat-stowed tyre needs about 190 mm.
Section 6 proposes the rules: when a cut is valid, the fallback chain, and refuse versus flag, with numbers.

The flights, beside the gear: four of the archetype cards used here fail on the ground with the gear FIXED. The DA62-,
Caravan- and Skymaster-alikes strike a propeller at rest; the RV-alike breaks its tail on the roll. The Skymaster's
failure is new in the merge, where it is born retractable. These are §7's X1-X4, for the cards' owner, not the gear's.

## 1. What is offered (the editor's own rows, the panel's `when`)

| plane | file / card | layout | gearRetract offered? | why |
|---|---|---|---|---|
| Cessna 172 | builds/cessna172_2026-09-20_corrected.json | high wing, tricycle | **yes** | tricycle, wheels |
| Caravan-alike (high-wing single) | key:caravan | high wing, tricycle | yes | |
| RV-alike (low-wing single) | key:rv | low wing, tricycle | yes | |
| T-tail tourer (low-wing single, the gate's) | key:ttail | low wing, tricycle | yes | |
| DA62-alike (twin) | key:da62 | low wing twin, tricycle | yes | |
| Skymaster-alike (twin, push-pull) | key:skymaster | high wing, tricycle | yes (born aftBelly / skymaster fold) | |
| Super Petrel LS V4.1 | builds/candidates/superpetrel_V4_1.json | biplane amphibian hull | already on (lfold 9) | the official card |
| Twin 4b | builds/candidates/Twin_busher_floats_4b.json | twin on floats | **not offered** | floats (`gearFloats`), and no nose station (s2On 0) |
| DC-3 | builds/candidates/dc3_2026-10.json | taildragger | **not offered** | `GEAR_RETRACTABLE` needs `s2Leg != 3` (a tailwheel cannot retract) |
| Jodel (recorded only) | builds/jodel_2026-09-20_corrected.json | taildragger | **not offered** | the same |
| v7 twin | builds/candidates/build_v7_twin_2026-09-04.json | taildragger twin | not offered | the same |

Offered rows once the switch is on, on every tricycle above (11): gearRetract, gearRetT, gearRetAct, gearFold,
gearFoldNose, gearRetFrac, gearWellCut, gearLegDoor, gearShort, gearShortNose, gearDoors.

**The finding for the rules:**
- Every fold in FOLD_KEYS is offered on every plane: inward, outward, aftFlat, aftBelly, skymaster, custom, catalina,
  nacelle, knee and lfold.
- So 'nacelle' is offered on a single.
- 'catalina', 'knee' and 'lfold' are offered on planes with no hull and one wing. Their red reasons then talk about "the
  hull's side" and "the lower wing" on an RV (`rv__fold_lfold`: "the lower wing is 413 mm too low", "the pivot falls below
  the hull's side").
- A taildragger cannot retract at all; that is a garage gap (the DC-3, the Spitfire), not a bug.
- A saved taildragger with gearRetract 1 shows all 11 rows, which do nothing (`GEAR_RETRACTABLE` is false). This is
  cosmetic.

Reproduce:

```bash
node reports/evidence/RETRACT-ROBUST/tools/rr_probe.js builds/candidates/dc3_2026-10.json '{}' --nogame
```

The output lists `offered: []`. With `'{"gearRetract":1}'` you get the 11 rows and `retractable: false`.

## 2. The matrix - 7 planes x 18 options = 126 builds (node, the editor headless)

- **The cases:** `reports/evidence/RETRACT-ROBUST/out/cases.txt`. The full table, one row per case (fit, reds, cuts,
  doors), is `reports/evidence/RETRACT-ROBUST/out/matrix.md`. The raw JSON per case is under
  `reports/evidence/RETRACT-ROBUST/out/m/`.
- **The options:** each mains fold (9 presets); the nose forward; the box outline; doors 0 and 1 (the default is 2); leg
  door off; legs 0.6x and 1.4x the drop; legs that shorten by 0.3; a 0.6 fraction.

Reproduce one case:

```bash
node reports/evidence/RETRACT-ROBUST/tools/rr_probe.js key:ttail '{"gearRetract":1}'
```

Reproduce all 126 (about 4 min on 4 cores):

```bash
node reports/evidence/RETRACT-ROBUST/tools/rr_matrix.js > /tmp/cases.txt && node reports/evidence/RETRACT-ROBUST/tools/rr_run.js /tmp/cases.txt /tmp/m 4 && node reports/evidence/RETRACT-ROBUST/tools/rr_table.js /tmp/m
```

**Builds:** all 126 build. No layer error, no crash.

**Fits (foldFit green):**

| plane | green cases (of 18) | which |
|---|---|---|
| C172 | 1 | frac 0.6 only |
| Caravan | 1 | frac 0.6 only |
| RV | 1 | frac 0.6 only |
| T-tail | 1 | frac 0.6 only |
| DA62 | 1 | frac 0.6 only |
| Skymaster | 0 | nearest: aftBelly, "7 mm out of the body" |
| Super Petrel | 10 | its own lfold card and the door, cut, leg and fraction options on it; every other preset fold is red |

The 0.6 fraction is green because the skin test runs only when `C.frac >= 0.999` (`foldFit`). With a partial fold the
wheels hang out by design and nothing is measured against the skin. On the RV the stowed wheels then sit across the flap
(picture `rv_frac06_g0_bottom.png`), and the flap test does not see it.

**The reds, by class** (cases with at least one, out of 126):

| class | cases |
|---|---|
| no room - the skin ("not inside: N mm out of the body / through the wing's skin / aft of the trailing edge") | 101 |
| no room - the cabin floor ("rises N mm into the cabin floor") | 90 |
| units clash ("the two mains meet as they fold") | 52 |
| mechanism (brace or actuator out of the structure, no stroke) | 48 |
| clash with a lift strut | 10 |
| structure: trunnion depth < 80 mm (mount) | 3 |
| structure: spar (wing well across a spar) | 2 |
| other (the hull or lower-wing folds' own words) | 13 |

**What is missing on the default fold** (inward, the starboard main; nose aft):

| plane | half track (hinge x) | leg | wheel R | body half-width at the hinge | wing depth at the well | the miss (foldFit's words) |
|---|---|---|---|---|---|---|
| T-tail | 0.697 | 0.624 | 0.20 | 0.656 | **0.097** | 22 mm out of the body; 226 mm into the floor; the mains meet; nose 15 mm into the floor |
| DA62 | 0.697 | 0.631 | 0.20 | 0.656 | 0.066 | 24 mm out; 225 mm into the floor; meet; brace 13 mm out |
| RV | 0.697 | 0.569 | 0.20 | 0.330 | 0.088 | 110 mm out of the body; meet; nose 7 mm out and 15 mm into the floor |
| Caravan | 0.482 | 0.592 | 0.20 | 0.685 | 0.133 | 74 mm out; 178 mm into the floor; meet; nose 2 mm out and 16 mm into the floor |
| C172 | 0.288 (body-rooted) | **1.158** | 0.185 | 0.497 | - (high wing) | **2021 mm through the wing's skin, 725 mm out of the body**; meet; actuator 123 mm out; nose 181 mm into the floor |
| Skymaster (aftBelly, its own) | 0.279 | 0.651 | 0.17 | 0.652 | - | **7 mm out of the body** - the nearest to a fit |

Reading the table:
- An inward fold stows the wheel's centre at about (hinge x - leg) from the centreline. That is 0.07 m on the T-tail,
  inside the body and past the keel. Hence "the two mains meet".
- To stow in the wing root, outboard of the body, it needs hinge x >= body half-width + leg + R + 30 mm = 1.51 m on the
  T-tail: **0.81 m more half track**.
- To stow in the belly without meeting, it needs hinge x - leg - R >= 15 mm: **0.14 m more**, or a 0.48 m leg.
- The flat tyre's stowed thickness on these cards is 0.16-0.19 m. The wing's depth at the well is 0.066-0.133 m, so the
  wing is **60-125 mm too thin** to take the tyre flat.

## 3. The cuts - where they go wrong (the measurements: `cutStruct` in each case's JSON)

**C1. A red fold is cut anyway (all 115 red cases).** BAD.
- `foldFit` builds `out.cuts` / `cutsWing` / `cutsSide` from the swept points that fall inside the body (`wellRaw`) with
  no test on `out.ok`. The doors are then made over those cuts (`doorBuild`), and `_cage_ui wellApply` cuts the drawn
  fuselage.
- C172, inward: a 0.91 m x 0.4 m mains well and its 2 well doors are cut in the belly. The mains never enter it: their
  lift is **0** and they stay under the belly, gear up (picture `c172_inward_g0_bottom.png`).
- RV and C172 with frac 0.6: wells are cut in the belly although the wheels stay outside.
- Reproduce: `rr_probe.js builds/cessna172_2026-09-20_corrected.json '{"gearRetract":1}'` gives `cuts` 2, `swing.R.lift` 0,
  and `fit.ok` false.
- Node shows it; the browser must confirm the drawn hole.

**C2. A belly well across a low wing's carry-through: 42 cases on the low-wing cards; nothing flags it.** BLOCKS (a
structure break).
- The T-tail, RV and DA62 mains, inward, box or legs: the merged mains well covers chord 0.62-0.91 (T-tail), 0.64-0.94
  (RV) or 0.70-1.00 (DA62).
- That is over the rear spar line (GEN_RULES sparRear 0.65), and 0.55-1.04 m wide across the keel. The picture
  `ttail_inward_g0_bottom.png` shows one diamond hole across the centre section.
- The SPAR test reads only points in the wing and not in the body (`wingIn(p) > 0 && !(bodyIn(p) > 0)`), so a spar that
  runs through the body is never tested.
- Reproduce: `rr_probe.js key:ttail '{"gearRetract":1}'` gives `cutStruct[0]` `chordBand [0.62,0.91]`, `crossesRearSpar`
  true, `straddlesCentre` true.

**C3. The two mains' wells merged across the keel (52 cases: wherever "the two mains meet").** BAD.
- `wellMerge` unites cuts that meet. The keel strip and its longerons between the wells go.
- It is merged and cut even while the fit says the units clash.

**C4. The nose well reaches the front-spar line on every low-wing card.** BAD.
- Chord band from -0.29 to 0.21 at the root, so it crosses sparFront 0.15 by about 0.06 chord (about 70 mm).
- Example: `ttail`, `da62`, `rv` `cutStruct` (kind body, units T).

**C5. The wells run into the cabin floor (90 cases), and the floor is cut by the ceiling.** BAD. The probable rule is in
§6. The floor test reddens the row, but the well's ceiling is the swept points' top + 30 mm, whatever the floor.

**C6. Folds stow where they cannot.** BAD.
- 'nacelle' on the DA62-alike: its mains are not under the nacelles. The wheels stow aft of the trailing edge, through the
  flap, and the leg's head stands over the wing (pictures `da62_nacelle_g0_front.png`, `_bottom.png`).
- 'outward' on the DA62: 1015 mm through the wing's skin.
- These are offered without regard to the build (section 1).

**C7. A partial retraction is "green" with the wheels across a flap (the RV, frac 0.6).** BAD (a hole in the test). The flap
test looks only at whole folds (`up` points inside the wing).

**What works** (for contrast): the Super Petrel's cuts.
- The exact round recess for the flat tyre in the lower wing (`cutsWing` 80 pts each side), the nose well (39 pts), the
  side slots.
- All green, no spar crossing, nothing across the keel (picture `petrel_g0_front.png`).
- It is hand-tuned, and a different preset on it goes red, like everyone else.

## 4. Flights

How they were flown:
- the game's host flies the load door's spec (`LB.gameSpec`);
- the Expert pilot, damage ON, the game's day (8 kt from 250 deg, gusts 0.15);
- one leg, HOME -> w3 (Tamgas Hill, 543 m).

Reproduce one:

```bash
node reports/evidence/RETRACT-ROBUST/tools/rr_fly.js <build|key:..> '<rows>'
```

| plane / rows | fit | flown spec | leg | gear: cycles, up took / down took | landing | damage |
|---|---|---|---|---|---|---|
| C172 inward (`builds/cessna172_2026-09-20_corrected.json`, `{"gearRetract":1}`) | RED (6) | retract 6 s; lift mains **0**, nose 0.55 | **ok**, 521 s | 1: 5.98 / 5.98 s | sink 1.22 m/s, 22.4 m/s, run 207 m | 0 breaks, 0 yields, g 1.9 |
| Super Petrel V4.1 (its card, on LAND) | OK | electric 6 s; lift 0.61 / 0.45 | **ok**, 598 s | 1: 5.98 / 5.98 s | sink 0.66, 27.8 m/s, run 369 m, 101 m left | 0 breaks, g 2.4 |
| T-tail inward (`key:ttail`, `{"gearRetract":1}`) | RED (6) | retract 6 s; lift 0.70 / 0.57; 761.8 kg | **FAIL: timeout 1800 s** - two go-arounds "past the aim at 248 / 243 m", downwind legs of 386 s | 3: 5.98 / 5.98 s | none | 0 breaks |
| T-tail FIXED (control, `{}`) | - | fixed; 739.6 kg | ok, 569 s, but **off-the-strip**: touched 81 m in, stopped 16 m past the end of 543 m | - | sink 0.34, **29.0 m/s**, run 478 m | 0 breaks, g 3.3 |
| DA62 inward (`key:da62`, `{"gearRetract":1}`) | RED (8) | retract 6 s; 983.6 kg | **CRASH at placement, t 0.8 s** (prop strike t 0.1, 8 breaks, 6225 yields) | 0 | - | crashed |
| DA62 FIXED (control) | - | fixed; 954.4 kg | **CRASH at placement** (prop strike t 0.1, 9 breaks, 6391 yields) - the card's, not the gear's (X1) | - | - | crashed |
| RV inward (`key:rv`, `{"gearRetract":1}`) | RED (7) | retract 6 s; lift 0.67 / 0.57; 581.8 kg | FAIL by faults: **ground loop** on the take-off run (30 deg at 9.1 m/s), prop strike t 3.8 - then flew and landed | 1: 5.98 / 5.98 s | sink 1.76, 30.5 m/s, run 352 m, on the strip | 0 breaks, g 3.5 |
| RV frac 0.6 (`{"gearRetract":1,"gearRetFrac":0.6}`) | "OK" (unmeasured, C7) | frac 0.6; lift 0.23 / 0.27 | the same as RV inward, to within 0.5 s (ground loop, prop strike t 3.8, landed) | 1: 5.98 / 5.98 s | sink 1.78, 30.5 m/s, run 351 m | 0 breaks |
| RV FIXED (control) | - | fixed; 571 kg | **CRASH on the roll**: prop strike t 3.3, a tail member broke, 13 breaks (X2) | - | - | crashed |
| Skymaster aftBelly (`key:skymaster`, `{"gearRetract":1,"gearFold":3}`) | RED (1: 7 mm proud) | retract 6 s; 1090.4 kg | **FAIL**: prop strike at t 0.4 at rest, taxi timeouts and replans, a node inside an obstacle, crashed at t 1007 s on the ground | 0 | - | 17 breaks (X3) |

**F1. The flown spec ignores the fit (the join).** BAD. Node; the browser must confirm the drawn gear.
- What happens: the red C172 flies its leg cleanly. The gear's drag is credited away by (1 - pos) while the drawn mains
  stay under the belly (their lift is 0).
- Reproduce: the first row above.

**F2. A unit that does not rise is "retracted" (lift 0).** BAD. Node.
- The C172's body-rooted 1.16 m spring legs, folded inward, measure lift 0. The physics' contact plane stays where the
  wheels are, so the wheels touch first in a gear-up landing.
- Gear-up landing (GATE RETRACT §6's person: gearForget 0.05, seed 17, the emergency extension disarmed):
  ```bash
  node reports/evidence/RETRACT-ROBUST/tools/rr_gearup.js builds/cessna172_2026-09-20_corrected.json '{"gearRetract":1}'
  ```
- The result: 'gear-forgotten', then a **wheel touchdown** recorded (tdInfo: sink 1.15 m/s, 22.7 m/s), then ROLLOUT >
  STOPPED. GATE RETRACT §6 expects no wheel touchdown and the 'gear-up-landing' verdict. Here the propeller struck and the
  scar is large (18257 hits), and the gear read **pos 0.53 at the stop**: it was moving down on the ground after a belly
  slide (unproven why: the squat switch?).
- GATE RETRACT's own fixture (`build_v10_cessnaMetal`) has the same geometry: lift 0.117 (< R 0.185), and it is RED
  ("1670 mm through the wing's skin, 514 mm out of the body"). The gate's circuit flies an aeroplane whose gear cannot stow.
  Rule V12 (§6) would catch both.

**F3. The T-tail tourer with retract does not get down on w3.** BAD, cause unproven.
- With retract it times out after two go-arounds past the aim. The same card fixed lands but overruns w3 by 16 m at a
  29 m/s touchdown.
- So the card is marginal on a 543 m strip before any retraction. Retract adds 22 kg and a cleaner approach (until the
  gear is down), and that tips it from "overruns" to "cannot land".
- Both runs say "rotate-pull: the nose will not come up at 26.7-26.9 m/s on the stop".
- A pilot / card matter as much as a gear one. Re-fly on a long strip before blaming the gear.
- Reproduce: rows 3 and 4 above.

**F3b. The controls show the cards, not the gear, failing on the ground.** The DA62-alike and the RV-alike crash FIXED
as well (X1, X2). The RV even does *better* with retract: it ground-loops but flies, where the fixed card breaks its tail.
The Skymaster-alike strikes its propeller at rest (X3). None of these is the retraction's. They are reported in §7 for
the owner of the cards.

**F4. The extension works wherever it was tried.** Not a bug, recorded:
- every cycle measured is 5.98 s for a 6 s setting, up and down, on all four flights;
- the gear was down and locked for every landing made;
- 0 breaks and 0 yields on every flight that landed.

## 5. Gates (15ad5d66; one per call, `node tools/run_gates.js --only=ID`)

| gate | verdict | note |
|---|---|---|
| RETRACT | **PASS** | It ran past its 600 s wall on this shared cloud box; that is not a performance number. It passes on a fixture whose gear does not fit (F2). |
| JOIN | **PASS** | |
| DESIGN | **PASS** | |
| HULL | **PASS** | |
| KNIFE | not run | the brief: KNIFE is the drawn windows, not the wells |

**ENV note.** At 15ad5d66 the built `index.html`, `dev.html`, `sw.js` and `version.json` are stale against the SEA-OFF
sources (`tools/_cage_*.js` changed with no "(built)" commit):
- `node tools/build.js` rewrites them;
- `tools/flight_core.js` is unchanged, so every node result here stands;
- a browser check of SEA-OFF needs the built commit first.

This session restored those files and committed none of them.

## 6. PROPOSED RULES (no code - for the user to agree; then SEAPLANES implements)

The numbers come from section 2 and from the code's own constants:

| constant | value |
|---|---|
| FIT.wall | 15 mm |
| FIT.floor | 20 mm |
| FIT.gap | 30 mm |
| FIT.clear | 30 mm |
| MOUNT_MIN | 80 mm |
| GEN_RULES sparFront / sparRear | 0.15 / 0.65 of the chord |
| GATE RETRACT §17 (the door face) | 4 mm |

A number marked **[TUNE]** is a proposal, not a measurement.

### 6.1 One verdict, read by everyone

- The gear layer's fit (foldFit and the tests after it) ends in ONE verdict: **OK, FLAG or REFUSED**, with its reasons.
- Everything downstream reads that verdict and nothing else: the cuts, the wells' bay litres, the doors, the drawn hole,
  the join's `gear.retract`, the physics' drag credit and the row's colour.
- Today each of them acts on the raw switch: C1 (the cuts) and F1 (the join).
- The verdict is the WHOLE gear's: one handle, one spec. A refused unit refuses the retraction, and the reason names that
  unit. Per-unit retraction is not proposed.

### 6.2 When a cut is valid (every well, every test)

| # | rule | the number | today |
|---|---|---|---|
| V1 | **Containment.** The stowed unit (tyre, leg, brace, actuator) lies inside the envelope it is cut into: the body, the wing between its skins, or a nacelle. | >= 15 mm inside everywhere (FIT.wall). A partial: only the share inside is cut. | tested (SKIN), but not obeyed by the cut |
| V2 | **Depth.** The bay's clear depth at the stowed wheel holds it. | Flat tyre: depth >= tyre thickness + 2 x 15 mm + 8 mm under an upper skin. The cards' flat tyre is 0.16-0.19 m, so it needs about **0.20 m**. Upright wheel (nose aft or forward, a side recess): >= 2R + 38 mm. | the wing is 0.066-0.133 m deep at the low-wing cards' wells: **60-136 mm short** |
| V3 | **One spar bay** (a wing well). Its chord band lies inside [sparF + m, sparR - m] (or wholly outside both). The wheel's diameter + 60 mm <= (sparR - sparF) x chord at the station. | m = max(30 mm, 2 % chord) **[TUNE]**. The low-wing cards' bay is 0.58-0.61 m, so a 0.40 m wheel fits *if* the hinge is in the bay. | tested for the wing's own points only |
| V4 | **The carry-through** (low or mid wing). A belly well never crosses a spar line inside the body's width. The mains' belly well lies between the two carry-through spars (the Arrow / PC-12 way) or wholly aft of the rear one. The nose well ends >= m ahead of the front spar. | the same m | **not tested** (C2, C4) |
| V5 | **The keel strip.** Two wells never merge across the centreline. | >= 60 mm of skin between them (2 x FIT.gap) | merged (C3) |
| V6 | **The floor.** The well's ceiling stays <= floor - 20 mm over the cabin's length; no cut opens the cabin floor. | FIT.floor 20 mm | tested (FLOOR), not obeyed by the ceiling (C5) |
| V7 | **The hull bottom.** No cut below the chine + 20 mm; the planing bottom, the step and the keel are never cut. | 20 mm (the user's HULL-B61, made general) | by card tuning only |
| V8 | **Moving surfaces.** No well behind a flap's or aileron's hinge line within its span. | applies to whole AND partial folds | whole folds only (C7) |
| V9 | **Struts, tanks, bays, the firewall.** The existing tests stand (strut 20 mm, the tanks' keep-out, AFT_BAYS). Add: a well never cuts the firewall frame or the engine mount. | - | partly |
| V10 | **Land between cuts.** Skin between a well's outline and any other cut, door, window or the wing-body fillet. | >= 30 mm (FIT.clear). Otherwise merge only if V3-V7 still hold; otherwise refuse. | merged blindly |
| V11 | **The mount.** The trunnion's structure depth is enough. A wing-rooted hinge stands on or just aft of the main spar. | >= 80 mm (MOUNT_MIN); hinge at chord 0.15-0.35 **[TUNE]** | depth tested; station not. The cards' mains stand at 0.60-0.90 of the chord, which is why every wing fold ends aft of the trailing edge. |
| V12 | **It rises.** Every retracting unit's measured lift is at least its wheel's radius. | lift >= R | **not tested**: the C172's mains have lift 0 and are flown "retracted" |

### 6.3 The fallback chain - tried in order, the first that passes

The garage never silently moves the track, the leg's length, the wing or the wheel; it only proposes them.

1. **As drawn.**
2. **The small corrections the garage may make itself, and say so (FLAG).**
   - The leg's shortening (gearShort / gearShortNose, up to 0.45) when the miss is only a height: the floor or the skin
     within 50 mm **[TUNE]**.
   - Example: the nose wheel's systematic 15-16 mm into the floor on the T-tail, the RV, the DA62 and the Caravan.
3. **The other folds valid for this layout** (offered by context, §6.5), in this order:
   - low or mid wing, mains on the wing: inward (wing root, between the spars), then aftBelly (twist-and-tuck into the
     belly, between the carry-through spars);
   - high wing, or mains on the body: aftBelly, then skymaster (two axes); with a hull: catalina, knee, lfold;
   - mains under an engine nacelle: nacelle, then inward;
   - nose: aft, then forward.
4. **Partial retraction** - the semi-retractable (the DC-3's and the B-17's real practice). FLAG: "semi-retractable: N % of
   the wheel exposed".
   - frac >= 0.5;
   - the wells cut only for the share inside, and that share must pass V1-V12;
   - no doors (a door cannot close on a protruding wheel);
   - the drag credited only for the covered share.
5. **Fixed gear.** The switch reverts, the reason is shown, and the garage states what would make it fit, with the
   numbers (the table below).

What it would take on the cards tested (the starboard main, inward; from the matrix's `room`):

| plane | half track now | for a belly stow (hinge x >= leg + R + 15 mm) | for a wing-root stow (>= body half-width + leg + R + 30 mm) | wing depth now / needed for the flat tyre |
|---|---|---|---|---|
| T-tail | 0.697 | 0.839 (**+0.14 m**, or a 0.48 m leg) | 1.51 (**+0.81 m**) | 0.097 / ~0.20 (**-0.105**) |
| DA62 | 0.697 | 0.846 (+0.15) | 1.52 (+0.82) | 0.066 / ~0.20 (-0.136) |
| RV | 0.697 | 0.784 (+0.09) | 1.13 (+0.43) | 0.088 / ~0.21 (-0.123) |
| Caravan (body-rooted) | 0.482 | 0.807 (+0.33) | - | - |
| C172 (body-rooted spring leg) | 0.288 | the 1.16 m spring leg is longer than the body is wide (0.99 m): no inward fold can stow it | - | - |
| Skymaster (aftBelly) | 0.279 | 7 mm proud of the belly: **a FLAG under rule 6.4** | - | - |

### 6.4 Refuse or flag

**REFUSED.** The spec carries no `gear.retract`. The row is red; the switch reads "fixed: <reason>"; nothing is cut; no
door is made. It is refused when any of these holds:
- a stowed point is more than 15 mm outside its envelope, on a whole fold (V1);
- the mains meet each other, or the nose wheel, closer than 30 mm at any pose;
- a cut fails V3 (spar bay), V4 (carry-through), V5 (keel), V7 (hull bottom), V8 (flap or aileron) or V9 (strut, tank,
  bay, firewall);
- the floor intrusion is more than 20 mm, or the well enters the crew's volume (V6);
- the trunnion depth is under 80 mm; the actuator has no real stroke; the brace or actuator stands more than 15 mm out of
  the structure, stowed;
- the lift is under R (V12).

**FLAGGED.** The build retracts. The row is amber; the reason is in the row's note and on the build sheet; the bill is
honest. It is flagged when:
- the stowed unit is 1-15 mm proud: a blister. It is drawn as a fairing bump, which is a garage gap today. The drag keeps
  a share of the gear's cdA **[TUNE]**, unproven.
- the floor intrusion is 1-20 mm: a floor bump.
- the retraction is partial (rule 4 above);
- the garage applied a correction (rule 2 above);
- the well is open (gearDoors 0), or the doors stay open while the gear is down (B64's rule);
- the box outline is used instead of the exact one (cosmetic).

**Doors.** A door is made only over an OK or FLAG unit. It must close flush, its outer face <= 4 mm proud (GATE RETRACT
§17). A door that cannot close falls back to an open well (FLAG); it never makes the design refused, except on a hull's
bottom (V7).

**Never silent.** Every design reads OK, FLAG or REFUSED in the garage *before* it flies. The build sheet and the
certificate carry the class.

### 6.5 What the garage offers (so the bad cuts cannot be reached)

- **The fold presets by context.** A preset that does not apply is greyed with its reason, not hidden:
  - 'inward': a wing-rooted main on a low or mid wing;
  - 'nacelle': the main's hinge inside a nacelle's footprint;
  - 'catalina' and 'knee': a hull;
  - 'lfold': a hull under a lower plane;
  - 'outward': only where the wing outboard of the hinge has the depth (V2).
- **The verdict's class on the switch's own note**, before flying.
- **A taildragger: not offered today.** Garage gap G-TD: the DC-3's semi-retracting mains with a fixed tailwheel is the
  natural first case (rule 4's partial, on a taildragger). It needs `GEAR_RETRACTABLE`, clampSpec (which drops retract on
  a taildragger: GATE RETRACT §1) and the join to accept a taildragger with a fixed tailwheel.

### 6.6 The verdict reaches the flight

- **The join** writes `gear.retract` on OK or FLAG only. On REFUSED it writes nothing (the fixed gear's spec, to the bit)
  and says so in its ERRS.
- **The drag credit** (the physics' (1 - pos) x cdA) is multiplied by the covered share: 1 when OK, less for a partial or
  a blister.
- **`gear.wells`' litres** are taken from the OK and FLAG units' inside points only.

### 6.7 How to know the rules hold (for GATE RETRACT, when implemented)

- the 126-case matrix (`rr_matrix.js`) re-run: every case either OK, FLAG with its reason, or REFUSED with no cut and no
  `gear.retract`;
- no `cutStruct` crossing a spar or the keel on a low wing;
- the Super Petrel V4.1 still OK, to the bit.

## 7. Every finding, classified

Severity: **BLOCKS** (a broken aeroplane or structure), **BAD** (wrong but flies), **COSMETIC**. Each item is node-only or
needs the browser.

| # | class | what | severity | reproduce (from `flyDiy/`) | node / browser |
|---|---|---|---|---|---|
| C1 | bad cut | a red fold is cut anyway: belly / wing wells and doors made for units that do not stow (C172: lift 0, a 0.91 m belly well, empty) | BAD | `node reports/evidence/RETRACT-ROBUST/tools/rr_probe.js builds/cessna172_2026-09-20_corrected.json '{"gearRetract":1}'` | node; the browser to confirm the drawn hole |
| C2 | structure break | the low wing's mains belly well crosses the rear-spar line and the keel (T-tail 0.62-0.91 chord, 1.03 m wide; RV and DA62 the same); no test sees it | **BLOCKS** | `... rr_probe.js key:ttail '{"gearRetract":1}'` -> `cutStruct[0]` | node |
| C3 | bad cut | the mains' wells merged across the keel whenever the mains meet (52 cases) | BAD | as C2 | node |
| C4 | structure break | the nose well's aft end crosses the front-spar line on the low-wing cards (about 0.06 chord, about 70 mm) | BAD | `... rr_probe.js key:da62 '{"gearRetract":1}'` | node |
| C5 | no room / bad cut | wells run into the cabin floor (90 cases): the floor test reddens the row, the ceiling ignores it | BAD | the matrix (no-room(floor)) | node; the browser to see the floor |
| C6 | bad cut | folds offered out of context ('nacelle' with no nacelle over the main: the wheels stow aft of the trailing edge through the flap; hull folds on monoplanes with "the hull's side" messages) | BAD | `... rr_probe.js key:da62 '{"gearRetract":1,"gearFold":7}'` | node + the garage's rows in the browser |
| C7 | bad cut | a partial fold is "green" unmeasured, its wheels across a flap (RV frac 0.6) | BAD | `... rr_probe.js key:rv '{"gearRetract":1,"gearRetFrac":0.6}'` | node |
| R1 | no room | no preset fold fits any of the six ordinary tricycles: the mains sit at 0.60-0.90 chord, the half track is 0.09-0.82 m short, the wing is 60-136 mm too thin (§2) | BAD (the design space, not a bug) | the matrix | node |
| R2 | no room | the nose wheel is 15-16 mm into the floor on four cards, and 2-7 mm out of the body on two: a near miss a leg shortening would fix | COSMETIC -> FLAG | the matrix | node |
| D1 | door clash | doors are made over the wells of red units. The doors close (flush) while the stowed tyre stands 22 mm (T-tail), 24 mm (DA62) or 110 mm (RV) out of the body: they close through the tyre by that much | BAD | the matrix rows' doors + fit | DERIVED from the fit's numbers, not measured on the door mesh: **unproven**; the browser to confirm |
| F1 | the join | `gear.retract` is written with the fit red; the drag is credited away | BAD | §4 row 1 | node; the browser: the gear swing and lamps |
| F2 | structure / physics | lift 0 (< R) counts as retracted: a gear-up landing reads as a wheel touchdown, and the gear moves to pos 0.53 on the ground after the slide | BAD | `... rr_gearup.js builds/cessna172_2026-09-20_corrected.json '{"gearRetract":1}'` | node |
| F3 | flight | the T-tail retract times out on w3 (the fixed card overruns) | BAD, cause unproven | §4 rows 3-4 | node |
| O1 | offer | a taildragger cannot retract (the DC-3, the Jodel, the v7 twin); floats cannot either (Twin 4b) | garage gap | `... rr_probe.js builds/candidates/dc3_2026-10.json '{}'` | node |
| O2 | offer | a saved taildragger with gearRetract 1 shows the 11 retract rows, which do nothing | COSMETIC | `... rr_probe.js builds/candidates/dc3_2026-10.json '{"gearRetract":1}'` | the browser (?retract=lab) |
| X1 | the card (not retract) | the DA62-alike strikes its propellers at rest, FIXED (t 0.1-0.2 s), on master L35a 1bcd01d3 too, and crashes at the game's placement | BLOCKS (the card) | `node reports/evidence/RETRACT-ROBUST/tools/rr_stance.js key:da62 '{}'` | node |
| X2 | the card (not retract) | the RV-alike, FIXED, breaks its tail on the take-off roll (prop strike t 3.3); with retract it ground-loops but flies. It is clean at rest, so it is a roll matter | BLOCKS (the card) | `... rr_fly.js key:rv '{}'` | node |
| X3 | merge regression | the Skymaster-alike on seaplanes-merge is born retractable (cage.gearRetract 1 from designBake, 1090.4 kg) and strikes a propeller at rest (t 0.4 s). At the merge base L34a cad30863 and on master L35a it is fixed, 1054.9 kg, and clean. It cannot taxi in the game (obstacle, timeouts, crash). The row over the card did not switch the retract off (unproven why) | BAD | `... rr_stance.js key:skymaster '{}'` on both trees | node |
| X4 | the card (not retract) | the Caravan-alike strikes its propeller at rest (t 0), on master L35a too | BAD (the card) | `... rr_stance.js key:caravan '{}'` | node |
| E1 | ENV | the built page is stale at 15ad5d66 (SEA-OFF without its built commit) | info | `node tools/build.js && git status` | - |

## 8. What the browser must confirm (node cannot)

All with `?retract=lab`, on the built 15ad5d66 or later:
1. The C172 with retract on (C1, F1): the drawn belly hole with no wheel in it, gear up. The flown aeroplane's swing
   (app.js gearSwingRig) with the mains hanging under the belly while the PFD lamps read up.
2. The T-tail's belly well across the centre section (C2): the editor's drawn fuselage (`_cage_ui wellApply`), seen from
   below.
3. The doors closing over a tyre that stands proud (D1), on the T-tail or the RV.
4. The rows: the red row and its tooltip (CAGE_ROW_BAD -> .rowBad) on the fold rows; the out-of-context folds' wording on
   an RV (C6); the 11 inert rows on a saved taildragger (O2).
5. The partial RV (C7): the stowed wheels over the flap, with the flap deployed.

## 9. Unproven

- **D1**: the door-through-tyre depth is taken from the fit's numbers, not from the door mesh.
- **F2**: why the gear reads pos 0.53 after the belly slide.
- **F3**: whether the timeout is the gear's or the card's.
- **The [TUNE] numbers in §6.**
- **The taildragger and float cases**: not offered, so not tried; never forced.

## 10. The pictures (quickshot, headless; `reports/evidence/RETRACT-ROBUST/`)

- **The C172, inward:** `c172_inward_g{1,0.5,0}_{front,bottom}.png`. Up, the mains hang under the belly beside an empty
  belly well and its doors.
- **The T-tail, inward:** `ttail_inward_g{1,0.5,0}_{front,bottom}.png`. Up, the diamond belly well across the centre
  section and the keel.
- **The T-tail, box:** `ttail_box_g0_bottom.png`, the box outline.
- **The DA62, 'nacelle' with no nacelle over the main:** `da62_nacelle_g0_{front,bottom}.png` and
  `da62_nacelle_g1_front.png`. The wheels stow aft of the trailing edge, and the leg's head stands over the wing.
- **The Skymaster, its own aftBelly:** `sky_g0_{bottom,side}.png`, 7 mm proud.
- **The RV, partial 0.6:** `rv_frac06_g0_{front,bottom}.png`. The wheels hang out, across the flap.
- **The Super Petrel V4.1:** `petrel_g0_{front,side}.png`. What a valid cut looks like: the exact round recess, the nose
  well, nothing across a spar.

Reproduce a picture:

```bash
node tools/quickshot.js --key ttail out --over '{"gearRetract":1}' --gear 0 --views front,bottom --focus gear --fit
```
