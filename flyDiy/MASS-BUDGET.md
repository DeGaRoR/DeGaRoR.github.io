# MASS-BUDGET — the wiring and the liner on the calibrated cards (9 Nov 2026)

ELEC-SYSTEMS (branch `claude/elec-systems`) answering CABIN-CRAFT (LINER-BACK, `claude/liner-back` 29effdb16). The rule
the user gave, as CABIN-CRAFT relays it: **no plane further from its reference than today.**

**APPLIED since** (the user: "go cable runs"): the measured result for every build is in `ELEC-SYSTEMS-READY.md`
(Cub 356.37 kg, +3.3 %; Jodel 345.15 kg, +7.9 % until JODEL-GEO). The tables below are the proposal as it was costed.

## The wiring, MEASURED (not added by hand)
Each rule's harness put into the bill, then the build rebuilt through `_load_build` + `buildGen` + `genShakedown`. The
generator re-sizes the structure for the heavier aeroplane, so the empty mass moves ~15 % more than the wire itself
(Cub runs: +1.45 kg of wire -> +1.67 kg empty). Script: `reports/evidence/ELEC-SYSTEMS/wirebudget.js`.

| build | rule | harness kg | empty kg | all-up kg | vs reference | CG empty % MAC | CG loaded % MAC | genCertKey |
|---|---|---|---|---|---|---|---|---|
| Cub (ref 345) | today | 1.65 | 354.77 | 476.45 | +2.8 % | 26.25 | 23.39 | af84cf8d |
| | cable runs | 3.10 | 356.44 | 478.12 | +3.3 % | 26.11 | 23.29 | 63b2d2 |
| | 1 % of empty | 4.25 | 357.78 | 479.46 | +3.7 % | 26.00 | 23.22 | 75b00b23 |
| Jodel (ref 320) | today | 1.65 | 343.63 | 471.79 | +7.4 % | 28.86 | 25.12 | 59b49604 |
| | cable runs | 2.91 | 345.09 | 473.25 | +7.8 % | 28.79 | 25.08 | 882a27bf |
| | 1 % of empty | 4.14 | 346.53 | 474.69 | +8.3 % | 28.71 | 25.04 | 864cccaf |
| C172 corrected | today | 2.40 | 639.45 | 976.97 | | 33.37 | 35.06 | 1e02cbdf |
| | cable runs | 3.67 | 640.95 | 978.47 | | 33.30 | 35.01 | b82aa527 |
| | 1 % of empty | 7.24 | 645.14 | 982.66 | | 33.11 | 34.87 | 258eb90b |

(The C172 row is `builds/cessna172_2026-09-20_corrected.json`; REAL-FIGURES' "172 V2 reads 729 against 721-744" is a
different card, so no reference column here.)

## Read with CABIN-CRAFT's liner (its deltas: Cub +0.95, Jodel -1.90; summed here, the two were not built together)
| build | today | + liner | + liner + cable runs | + liner + 1 % |
|---|---|---|---|---|
| Cub | 354.77 (+2.8 %) | 355.72 (+3.1 %) | 357.39 (**+3.6 %**) | 358.73 (+4.0 %) |
| Jodel | 343.63 (+7.4 %) | 341.73 (+6.8 %) | 343.19 (**+7.2 %**) | 344.63 (+7.7 %) |

Against "no plane further than today":
- **Cable runs:** the Jodel passes (+7.2 % against +7.4 % today); the Cub fails (+3.6 % against +2.8 %).
- **1 % of empty:** both fail.
- The Cub passes either rule only if another of its lines comes down by its overshoot: about 2.6 kg for cable runs plus
  the liner, 4.0 kg for 1 % plus the liner. REAL-FIGURES already has a lead: without electrics the Cub reads 333.5 kg, so
  ~11 kg of something else in it is under-billed. The ~17 kg of electrics a J-3 never had masks that.

## ELEC-SYSTEMS' position
1. **Cable runs is the better shape and the one I would ship:** wire follows where the current goes, not how heavy the
   structure is. Its known weakness is that it undercounts: 3.7 kg for a 172 against the 5-7 kg REAL-FIGURES calls real.
   Calibrating its allowance factor (1.6 today) needs one real harness weight.
2. **1 % of empty** is the simpler, sourced rule (SAWE: wiring 1-2 % of empty weight), but it moves both calibrated cards
   further from their references.
3. Either rule moves every build's certificate key except those with no electrics. It is a ready of its own after
   the user's ruling, not part of the current ELEC-SYSTEMS ready.
4. **The Cub's offset belongs to REAL-FIGURES** (point 3 of CABIN-CRAFT's proposal): name the over-billed line and fix it
   in the same ready, so the Cub ends at or under +2.8 %.
