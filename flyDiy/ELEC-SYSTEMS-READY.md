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
