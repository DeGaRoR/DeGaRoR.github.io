# RETRACT-ROBUST - the retractable gear on reasonable planes, and the rules for its cuts (2026-11-08, cloud)

- **Who:** a cloud tester session. It ran tests and wrote reports only; it changed no game code. The fixes belong to the
  SEAPLANES-LAND session.
- **Base tested:** `origin/claude/seaplanes-merge` at **15ad5d66** (SEA-OFF + tour_real Digit9). The branch had moved from
  7f6e1df6 at the launch, and A0 asked for the newest tip. It is not on master yet.
- **Where it ran:** node only (RETRACT-LAB is on in node). Every picture is quickshot's headless drawing. Every flight is
  the game's host flying the load door's spec.
- **Status:** INTERIM. The flights and gates sections are being filled in. The rules (section 6) are a proposal for the
  user to agree to; SEAPLANES implements them after that.

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

## 4. Flights (the game's host: the load door's spec, the Expert, the game's day 8 kt from 250 deg, damage ON; HOME -> w3)

`node reports/evidence/RETRACT-ROBUST/tools/rr_fly.js <build|key:..> '<rows>'`

| plane / rows | fit | flown spec | leg | gear (up / took / down took) | landing | damage |
|---|---|---|---|---|---|---|
| C172 inward (default) | RED (6) | retract 6 s, lift mains **0**, nose 0.55 | ok, 521 s | 1 cycle: 5.98 s / 5.98 s | sink 1.22, 22.4 m/s, run 207 m | 0 breaks, 0 yields, g 1.9 |
| (more rows pending) | | | | | | |

**F1. The flown spec ignores the fit (the join).** BAD.
- What happens: the red C172 flies the leg cleanly, its gear drag credited away by (1 - pos) while the mains hang under
  the belly.
- Its `lift.mains` is 0, so the contact plane never rises; the gear-up landing case is in section 4b.

## 5. Gates

(pending: RETRACT, JOIN, DESIGN, HULL on 15ad5d66)

## 6. PROPOSED RULES (no code; for the user to agree, then SEAPLANES implements)

(draft below; numbers from section 2 and the code's own constants: FIT.wall 15 mm, FIT.floor 20 mm, FIT.gap 30 mm,
FIT.clear 30 mm, MOUNT_MIN 80 mm, sparFront 0.15 and sparRear 0.65 of the chord, GATE RETRACT §17's 4 mm door face)

See the end of the file (being finalised).
