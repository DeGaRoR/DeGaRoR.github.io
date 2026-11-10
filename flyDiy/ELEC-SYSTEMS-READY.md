# ELEC-SYSTEMS — READY (9 Nov 2026, branch `claude/elec-systems`)

The user, 9 Nov: "Where do we set that? I think battery type is under controls? Do we even compute the discharge? Do we
refuse lamps without electrics? And electrical instruments? If we need to manage that, we need to manage that well."
Audit, plan and sources: `futureDesigns/ELEC-SYSTEMS-2026-11.md`. Pictures: `reports/evidence/ELEC-SYSTEMS/`.

## The answers, short
- **Where:** Fit > **Instruments**, not Controls. Its `electrics` fold is now tiles (it was four drop-downs).
- **Discharge:** yes, and it always was. `src/core/31_elec.js` runs the bus in flight: battery charge, drain by the
  loads, the generator charging above its cut-in, the starter's draw, breakers. A flat battery refuses the crank. New:
  the flight now SAYS it (LOW VOLTS / NOT CHARGING / BATTERY FLAT / a refused start, with its reason).
- **Electric instruments without a battery:** refused, named and drawn red (unchanged rule, now said in the electrics
  section itself).
- **Lamps without power:** still fitted and billed (the player's choice), dark in flight. The garage says so twice:
  the top-bar triangle (as before) and the electrics section.
- **Dash switches:** they exist. MASTER whenever there is a bus, ALT whenever something charges (`_panel_gen.js:583`).
  The cockpit wires both into the bus.

## What changed (all additive: no tier names a new row)
1. **Catalogue rows** (`GEN_ELEC`, 12 V everywhere): small sealed lead 9 Ah 3.2 kg, small lithium 5 Ah 1.0 kg, heavy
   lead 35 Ah 12.5 kg (ESTIMATE); the two-stroke's lighting coil 12 A 0.8 kg and the 912's integrated generator 18 A
   0.9 kg (both `internal`, with a lower `cutIn`), a heavy generator 50 A 15 kg (ESTIMATE); an ultralight starter
   3.5 kg / 80 A and a heavy one 15 kg / 300 A. Sources in the design doc.
2. **The engine suggests, nothing applies:** `genElecSetOf(engine, key)`. As-built history first (`GEN_ELEC_AS_BUILT`:
   A-65, Clerget, Gipsy Major, W-670, Mikron had no electrics), else engine mass and family. Each part's tiles mark
   "for this engine"; one button fits the set ("take the electrics off, as built" for the no-electrics engines). No
   "class" choice: the user found that a needless new concept.
3. **A generator with no battery** does what the real one does: a self-exciting machine (DC generator, Rotax PM coil)
   feeds the bus above its cut-in and nothing below; the 60 A alternator, whose field the battery excites, never comes
   on (FAA AC 20-40). Said in the column (`genOnly` / `altNoBatt`).
4. **Refusals said, never re-billed:** a starter with no battery, an alternator with no battery, a 12 V starter on an
   electric motor (`genSystemsResolve().warnings`). The user: "This is the player's problem."
5. **In flight:** the bus takes the catalogue's cut-in and crank amps (the old rows' values are the old constants);
   `cockpit.js elecAlarms` -> the `#flElec` line.
6. **GATE ELEC** section 7: the tiers unchanged, the sets' mass bands, the engine suggestions (as-built included), the
   refusals, the generator-only and alternator-only buses, an ultralight bus; its selftest catches a tier moved.

## The calibrated builds: nothing moved
Every `builds/*.json` (14 files) through `tools/_load_build.js`, before (master) and after (this branch, every commit):
genCertKey, sha1 of nodes/beams/params, total mass, CG x and systems kg are **identical** (the script:
`reports/evidence/ELEC-SYSTEMS/fingerprint.js`, its two tables beside it; diffed empty three times: after the first commit, after the generator-only
change, after the as-built table).

## The Cub without electrics: measured, NOT shipped (out of the 3 % band)
REAL-FIGURES relayed the user's go-ahead for builds that never had electrics, within the 3 % reference band. The Cub
card with only `systems.elec` battery / alternator / starter = none (fit 'basic', venturi kept):

| | before | after | reference |
|---|---|---|---|
| empty mass | 354.77 kg (+2.8 %) | 333.49 kg (**-3.3 %**) | 345 kg |
| CG empty, % MAC | 26.25 | 29.42 | |
| CG loaded, % MAC | 23.39 | 25.58 | |
| static margin | 16.69 % | 14.48 % | |
| genCertKey | af84cf8d | bf832a5a | |

Why -21.3 kg and not -17: elec 17.05 -> 0.40 kg (the venturi stays), the COM radio (1.0 kg) and the fuel gauge and
volt/ammeter (0.7 kg) are refused with no battery, and the generator re-sizes the structure for the lighter aeroplane
(fuselage -0.41, wings -0.73, bracing -0.51, tail -0.17, gear -0.48, furnish -0.62 kg). The official card is unchanged;
the variant is at `reports/evidence/ELEC-SYSTEMS/cub_noelec_2026-11-09.json` for the user's ruling. The Chinook, Tiger
Moth and Camel take REAL-FIGURES' validated minimal-fit cards (its branch); my rows do not change what 'minimal' bills.

## Gates
The full battery could not run here: after 2.5 h the core run had done 7 of 320 jobs on this shared 4-core box (and the
kernel killed processes for memory twice), so it was stopped. The battery that ran is the 19 gates this chantier
touches, on master (a worktree) and on this branch, same machine, `--jobs=4`:

| gate | master | this branch | note |
|---|---|---|---|
| ELEC | PASS | PASS | 443 checks; section 7 new; selftest 3/3 caught |
| TECH | FAIL | FAIL | pre-existing: `av.elt:none` / `av.elt:fitted` have no segment (the comms work's ELT). The 8 new electrics keys have theirs |
| GPSFACE | FAIL | PASS* | master: an allocation check (32 B against 0.31 B budget) under load. *branch: failed inside the pair run (the core went stale mid-run, my edit), PASS re-run alone |
| ROLLSND | PASS | PASS* | *failed inside the pair run on the same stale core; PASS re-run alone |
| PANEL, DASH, LIGHT, STARTER, ENGID, ENGMESH, PARTS, UISMOKE, NEWPLANE, PRICE, MASS, WEIGHT, DEFAULT, SAVE, BUILD | PASS | PASS | |

**Not delivered on the full battery.** The project's rule is `run_gates.js --all` before delivery; it needs a machine
that can run it.

## Open questions (defaults in brackets)
1. **The Cub without electrics** lands at -3.3 % against 345 kg, outside the band. Take it anyway, add the J-3's cork
   fuel sight (0.05 kg), or keep the card? [keep the card; the variant waits in the evidence folder]
   REAL-FIGURES' reading (9 Nov): a finding, not a defect - the Cub's calibration absorbed ~17 kg of electrics a J-3
   never carried, so something else in the model J-3 (structure, outfit or furnishing) is under-billed by ~11 kg. It
   puts that to the user with the variant.
2. **The wiring as a fraction of empty mass** (SAWE: wiring 1-2 % of empty; 1 % gives the Cub 4.1 kg, the Jodel 4.0,
   the 172 7.1 against 1.65 / 1.65 / 2.40 today). REAL-FIGURES: no-go on the three calibrated builds (the Jodel already
   reads +7.5 %), go for new builds. [parked: harness unchanged everywhere; the rule needs the empty mass inside the
   resolver, which is a real change to the bill's order]
3. **GATE TECH's ELT rows**: which segment is an ELT? [none 1, fitted 3 (electronics) - not mine to set]
4. **The heavy rows' masses** (battery 12.5 kg, generator 15 kg) are estimates; REAL-FIGURES has no sourced figure.
   [keep, marked ESTIMATE]
5. **The Chinook's starter**: unknown as built (the 582 came with pull or electric start); the engine suggests the
   ultralight set, REAL-FIGURES' card assumes a pull start. [the card's minimal fit]

## The user's rulings (9 Nov, evening)
- **Cub:** keep the official card (the electrics-free variant stays as evidence only).
- **Cork fuel sight:** not added.
- **ELT tech tier:** "do what you think is best" -> `av.elt:none` 1, `av.elt:fitted` 2 (the transponder's tier: certified
  avionics on its own battery). GATE TECH is green (it was red on master for want of these keys).
- **Wiring:** 1 % of empty mass "feels right and better than the current rule". Not applied yet - see below.

### The wiring, costed (wire only; the bus parts 0.5-0.7 kg are kept apart)
| build | today | 1 % of empty | cable runs (bottom-up) |
|---|---|---|---|
| Cub | 1.65 | 4.25 (empty 354.8 -> 357.4, **+3.6 % vs 345, out of band**) | 3.10 |
| Jodel | 1.65 | 4.14 (+8.3 % vs 320, already +7.5 %) | 2.91 |
| C172 | 2.40 | 7.24 (inside its band) | 3.67 |
| PA-18 floats | 1.65 | 6.34 | 3.12 |
| Chinook | 1.35 | 3.00 | 2.85 |
| Rufus | 1.20 | 3.37 | 2.82 |
Cable runs = the starter cable sized by its amps and the charging lead by its amps, a run per powered load, the wingtip
and tail lights over the build's own span and length, x 1.6 for connectors, clamps and sleeving. It is the better
SHAPE (wire follows where the current goes, not how heavy the structure is: a wooden and a steel-tube airframe of one
size get the same wire), but it undercounts: 3.7 kg for the 172 against the 5-7 kg REAL-FIGURES calls realistic.

## The cable-run harness - APPLIED (the user, 9 Nov: "go cable runs")
`genHarnessKg` (60_gen_spec.js) bills the wire by its runs, lengths to the centimetre from the spec: the starter cable
sized by the starter (`cableKgM`: 2 AWG for the Sky-Tec class), the charging lead, a run per powered load, the nav lights
over the span, the tail light down the tail arm, the landing light a third out, x1.6 for connectors, clamps, sleeving;
plus the bus parts. It replaced 1.2 kg + 0.15 kg per powered item. **PHYSICS_V 7 -> 8.**

**Every `builds/*.json`, master against this branch** (`reports/evidence/ELEC-SYSTEMS/emptyall.js`, tables beside it):

| build | empty before | empty after | delta | harness before -> after | CG empty % MAC | CG loaded % MAC | key before -> after |
|---|---|---|---|---|---|---|---|
| c172r_wipline2350_landprop_2026-10-20 | 767.46 | 769.18 | +1.72 | 2.40 -> 3.87 | 38.44 -> 38.36 | 38.37 -> 38.32 | af98c9fe -> b5129149 |
| c172r_wipline2350_stcprop_2026-10-20 | 770.03 | 771.76 | +1.73 | 2.40 -> 3.87 | 38.07 -> 37.99 | 38.12 -> 38.07 | 92dd236d -> baa171ad |
| cessna172_2026-09-20 | 713.20 | 715.02 | +1.82 | 2.40 -> 3.94 | 21.72 -> 21.65 | 24.82 -> 24.76 | bd677633 -> 7a3a3398 |
| cessna172_2026-09-20_corrected | 639.45 | 641.18 | +1.73 | 2.40 -> 3.87 | 33.37 -> 33.29 | 35.06 -> 35.00 | 1e02cbdf -> fcc329b |
| cessna172_floats_2026-11 | 845.45 | 847.27 | +1.82 | 2.40 -> 3.94 | 25.04 -> 24.97 | 26.81 -> 26.76 | 78476d00 -> 66dacfba |
| chinook_2026-09-21 | 282.03 | 285.81 | +3.78 | 1.35 -> 4.71 | 75.92 -> 74.44 | 61.04 -> 60.10 | 3208e677 -> c423fe56 |
| chinook_2026-09-21_corrected | 235.43 | 238.52 | +3.09 | 1.35 -> 4.16 | 54.46 -> 53.08 | 36.77 -> 36.00 | 8e50507f -> 79aa3dd5 |
| composite_jodel_2026-10-07 | 360.35 | 361.92 | +1.57 | 1.65 -> 2.95 | 28.95 -> 28.88 | 25.32 -> 25.28 | b78ff514 -> eb092bc8 |
| cub_2026-09-20 | 344.53 | 346.13 | +1.60 | 1.65 -> 3.04 | 23.14 -> 23.01 | 22.89 -> 22.79 | c7409e90 -> d7770ff0 |
| cub_2026-09-20_corrected | 354.77 | 356.37 (+2.8 -> +3.3 % vs 345) | +1.60 | 1.65 -> 3.04 | 26.25 -> 26.11 | 23.39 -> 23.30 | af84cf8d -> 80ceab1a |
| jodel_2026-09-20 | 404.21 | 405.67 | +1.46 | 1.65 -> 2.94 | 36.36 -> 36.27 | 37.04 -> 36.97 | 22bc6b3a -> 6fc89625 |
| jodel_2026-09-20_corrected | 343.63 | 345.15 (+7.4 -> +7.9 % vs 320) | +1.52 | 1.65 -> 2.95 | 28.86 -> 28.78 | 25.12 -> 25.08 | 59b49604 -> e5d16223 |
| pa18_floats_2026-10-23 | 563.63 | 565.36 | +1.73 | 1.65 -> 3.14 | 18.65 -> 18.58 | 22.11 -> 22.05 | e5f3f8e1 -> 9307881b |
| rufus_2026-10-18_certified | 275.16 | 276.80 | +1.64 | 1.20 -> 2.63 | 28.36 -> 28.16 | 25.73 -> 25.59 | 7052bcd0 -> b0a435ce |

- The Cub stays at +3.3 % (REAL-FIGURES' option (a), the user's rule over its hold): its missing line (~11-13 kg found
  missing once its electrics are taken off) is REAL-FIGURES' to find; with LINER-BACK's zero-sum it reads ~355.9 kg.
- The Jodel's +7.9 % is temporary: its electrics-off systems edit rides in REAL-FIGURES' **JODEL-GEO** ready (combined
  321.7 kg against 320, static margin 5.6 %, design check PASS). **It must not land alone**: on this branch alone it
  failed GATE DESIGNCHECK (pitch.sm -0.001), so it was reverted here (340634f3).
- The Chinook carries the most new wire (+3.1 kg: a pusher, the starter cable runs aft) - moot once REAL-FIGURES'
  minimal-fit Chinook card lands (no bus, no harness).
- A real consequence: with +1.6 kg, the student and the roster pilot now **refuse the Cub at mn_strip** (the need ~250.2 m
  against 250 m).
- The rule reads low on a 172 (3.9 kg against the 5-7 kg REAL-FIGURES calls real): `GEN_ELEC.harness.runs.install` is the
  one knob to calibrate when a real harness weight turns up.

### Gates after the cable runs (this branch; failures compared with master)
| gate | master | branch | |
|---|---|---|---|
| ELEC, TECH, PANEL, PRICE, NEWPLANE, ENGID, PARTS, UISMOKE, LIGHT, STARTER, DASH, GPSFACE, ROLLSND, ENGMESH, MASS, WEIGHT, DEFAULT, SAVE, BUILD, DESIGN, CERTGATES, ACCEPT, PLANELISTS | | PASS | |
| PILOTCANFLY | PASS | PASS | after the fix: the gate read pilotCanFly's rounded need with a strict >; the rule refuses on the unrounded one |
| GEN | FAIL | FAIL | the same check on both, "cruise is quiet in wind" (bank 11.59 / 11.61 deg against 3) |
| DESIGNCHECK | FAIL | FAIL | the carbon mosquito's boom stiffness on both (the Jodel row was mine, reverted) |
| ALTIPORT, APSMOOTH, BENCHTIME, DESIGNSIM, DMGCERTCOST | FAIL | FAIL | the same failures on both |
| JOINPARITY | 5 FAIL | 6 FAIL | **one new row: the twin floatplane, node = page at 4.2e-9** (its float station's CG handshake against the captured page). The capture (`tools/fixtures/join_parity_page.json`) is already stale on master (its Cub and Jodel rows). A plain +0.1 kg on master's old harness keeps the row exact, so the cable-run rule reads some input that differs between the two paths - not pinned down. The gate's own instruction: re-capture with `tools/join_parity_page.js` when a move is meant - A0's call, with master's drift |

### For A0
- **PHYSICS_V collision:** claude/practical-cerf-7fjpwp's PROP-CLASSES also bumps 7 -> 8 (2704c5644). Whichever lands
  second takes 9.
- **Landing order:** the Jodel's systems edit only with or after JODEL-GEO; LINER-BACK's mass is zero-sum on the Cub
  (trim 'bare') and takes the Jodel's -1.90 kg.
- **JOINPARITY:** re-capture the page after this lands (see above).
- **The full battery** still has to run on a machine that can carry it.
- **No build card in this branch's diff** (master..claude/elec-systems -- flyDiy/builds/ is empty: the Jodel edit and its
  revert cancel). LINER-BACK (claude/liner-back 729f49f04, aiming at L37b) edits `outfit.trim` on the one-line Cub and
  Jodel cards; nothing here conflicts with it as text. Its measures with the liner: Cub 354.77 -> 353.35 kg (+2.4 %;
  ~+2.9 % with this branch's cable runs), Jodel 343.63 -> 342.45 kg (+7.0 %; JODEL-GEO then carries the electrics-off edit).
