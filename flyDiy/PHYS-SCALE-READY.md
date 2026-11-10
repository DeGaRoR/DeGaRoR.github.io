# PHYS-SCALE — READY (claude/ready/phys-scale, onto claude/ready/real-figures-3b b87682040)

The physics fixes from the REAL-FIGURES study that the user approved (8-10 Nov): DRAG-SCALE, MASS-SCALE, BIPLANE-SIZING,
BUSH-WHEELS, SLAT-KG and UL-WING. **Merge real-figures-3b first** (this branch sits on it: it uses the `fabricAlu` row and
the engine dials from it), then this branch, then `claude/ready/tail-retract` (it sits on this one).

## Commits

| commit | what |
|---|---|
| 1a355609 | the physics (src/core 60 / 61 / 62, tools/_weight_check.js), PHYSICS_V 7 -> 9 |
| d13b248e | built |
| 62f6f179 | GATE STOL's baseline: the ten moving cards' hashes re-taken |
| b4468bb0 | PROCURE: the tundra-tyre option's measured effect re-emitted |
| 423bf466 | built (career_core moves with 76_procure) |
| (this file) | READY |

## Where it comes from

Everything was taken BY HUNK from `claude/practical-cerf-7fjpwp` (`git show <c> -- <paths> | git apply -3`), never as a
whole commit. Pilot's work on that branch stays there: the brakes (GEN_BRAKES; the one line of BUSH-WHEELS' hunk that
billed them was dropped), PROP-CLASSES, STRUT-OPTIONS, the cards, candidates, the Ruckus, quickshot, real_check /
real_refs.

| fix | source commit | what changes in src/core |
|---|---|---|
| DRAG-SCALE | dac78a178 | 60_gen_spec `GEN_DRAG.kCool` radialNaca 0.0005, ringLD 0.35, nacaLD 0.60: a cowled radial's cooling goes from the Townend ring's 0.0009 to the NACA cowl's 0.0005 by the cowl's chord over the engine's diameter (`cw_cowlLen` / 2 x `engBox.cylReach`). `GEN_DRAG.reynolds` {vRef 60, nu 1.46e-5, lBody 8, cSurf 2}: 62_gen_aero `genReK`, Schlichting's turbulent Cf ratio on the body's cdWet past 8 m and on the polars' Cd0 past a 2 m chord (`reP`; the finish's own matCd0 is not scaled). `drag.reK` is published only when != 1. Sources: NACA TR 592 (Theodorsen 1937), Hoerner ch. 9, Schlichting. |
| MASS-SCALE | 5be057892 | 60_gen_spec `GEN_GAUGE.hiBy {gear: 8}`, 61_gen_frame `hiOf` in genDesignGross: the gear's own gauge ceiling (Raymer's GA law uncapped past 3x for a transport; Torenbeek 8.4: 4-5 % of gross). Moves only a build whose design gross is over ~4.3x its row's refGross (the DC-3). tools/_weight_check.js gaugeSane reads it. trussBoxK stayed 1 after measurement. Its candidates and evidence stay on practical-cerf. |
| BIPLANE-SIZING | 2d7dc1fef (its half) | 60_gen_spec `GEN_RULES.trussSparK [0.35, 1]`, `trussBoxK 1`; 61_gen_frame B()'s `opt.massK` (mass only, stiffness unchanged), `sparKs`, `SPAR` on the spar caps, `TBOX` / `TWEB` on the box (inert at trussBoxK 1). A wired plane's spar caps bill (its braced moment / a Cub-like strut monoplane's)^(2/3). |
| BUSH-WHEELS | 24f7ce231 (src/core only) | 60_gen_spec `wheelKg(R, prof)`: a balloon carcass (cage `whProfile` 1, tundra) bills R^1.6 off the 3.5 kg anchor (a 26" wheel 7.8 kg, was 12.2); every other profile R^2.5 as before. |
| SLAT-KG | 24f7ce231 (src/core only) | 60_gen_spec `GEN_STOL.cost`: automatic slat 1.8 -> 1.2 kg/m, fixed slot 1.2 -> 0.8 kg/m. |
| UL-WING | e449077fb (src/core only) | 60_gen_spec `GEN_SURF_MATERIALS.aluFabric.standInK 0.25`; 61_gen_frame `STAND` on the strut fan's hidden members, the plan diagonals and the rib members of that row's wing (the two drawn lift struts stay whole). |

## PHYSICS_V: 7 -> 9

master is at 7. **8 is taken twice** by unmerged branches: ELEC-SYSTEMS' cable runs (`claude/elec-systems`) and
PROP-CLASSES (`claude/practical-cerf-7fjpwp`). So this branch takes **9**, and the history comment in 60_gen_spec says so.
Whichever of those lands after this one should take the next free number (10), not 8.

Every certificate key moves (genCertKey mixes PHYSICS_V). The game re-checks a stamped build on load (R3: an update
re-checks, never withdraws).

## What moves: the 18 shipped builds, the four adopted cards' files and the 32 cards

Each build went through the load door (tools/_load_build.js, the page's chain) on plain real-figures-3b and on this branch,
measured by a scratch script on the same machine:
- the empty mass (the ledger's non-payload rows);
- Vmax (tools/_perf_probe.js sweepAt / levelSpeedAt at full power, ISA sea level, as built: full fuel, no occupants);
- genCertKey;
- sha1 of nodes, beams and params.

MOVED (def digest differs):

| build | empty kg | Vmax km/h (as built, sea level) | cert key |
|---|---|---|---|
| builds/chinook_2026-09-21_corrected.json | 235.4 → **219.6** (-6.7 %) | 153.4 → **153.7** (+0.2 %) | 8e50507f → 5102d789 |
| tools/fixtures/stol_cub_showcase.json | 417.1 → **392.7** (-5.8 %) | 169.9 → **170.1** (+0.1 %) | f801025a → a9c4e4cd |
| builds/candidates/dc3_2026-10.json | 6481.6 → **6643.9** (+2.5 %) | 304.4 → **313.1** (+2.9 %) | 5b320edf → 9d1abf9 |
| builds/candidates/camel_2026-10.json | 598.8 → **584.2** (-2.4 %) | 170.1 → **170.7** (+0.4 %) | bb6329a7 → 48bd5cf2 |
| builds/candidates/tigermoth_2026-10.json | 569.6 → **553.7** (-2.8 %) | 168.4 → **168.7** (+0.2 %) | 3aca3562 → 60aa9742 |
| builds/candidates/stearman_2026-10.json | 902.3 → **880.3** (-2.4 %) | 176 → **176.3** (+0.2 %) | 30e3477e → 5aeed332 |
| card:tigermoth | 569.8 → **553.9** (-2.8 %) | 168.3 → **168.6** (+0.2 %) | 3d3496e → 1ebc4d2 |
| card:stearman | 902.3 → **880.3** (-2.4 %) | 176 → **176.3** (+0.2 %) | 2b1afe4d → 1538ecd |
| card:camel | 598.8 → **584.2** (-2.4 %) | 170.1 → **170.7** (+0.4 %) | f9a7945 → 99635098 |
| card:pittsAlike | 527.7 → **517** (-2.0 %) | 195.5 → **195.7** (+0.1 %) | 2aca5543 → b19015e8 |
| card:sesqui | 600.6 → **586.9** (-2.3 %) | 150.4 → **150.9** (+0.3 %) | 2b94e338 → 51b8aecc |
| card:chinook | 238.4 → **222.5** (-6.7 %) | 153.1 → **153.4** (+0.2 %) | f8a35743 → eabc9966 |
| card:caravan | 917.4 | 311.8 | 4a736dc0 → bb7f435a |
| card:spitfire | 1466.1 | 406.1 → **406.7** (+0.1 %) | 8fde38da → a810c628 |
| card:radial | 513.6 | 229 → **231** (+0.9 %) | b5607c18 → 4229cd22 |
| card:beaver | 1046.2 | 273.3 → **275.3** (+0.7 %) | c2cbf4d2 → 724671a4 |

- **Biplanes** (BIPLANE-SIZING): -2 to -3 %, as expected.
- **Chinook** (UL-WING): -16 kg (the corrected file 219.6 kg against the type's 172-209 kg).
- **STOL Cub showcase** (BUSH-WHEELS + SLAT-KG): -24 kg (its 31" tundra wheels and slats).
- **DC-3** (MASS-SCALE + DRAG-SCALE): +162 kg (the gear: 2.4 % -> ~4.7 % of the gross) and +9 km/h (the NACA cowl and the
  Reynolds number).
- **Radials, Beaver, Spitfire, Caravan** (DRAG-SCALE): drag only, +0 to +2 km/h, the same mass.

UNMOVED: every other build and card, the Cub, the Cessnas, the Jodels, the PA-18 floats, Rufus and the fixtures. Their
nodes, beams and params are byte-identical; only their certificate key moves (by PHYSICS_V).


UNMOVED (def digest identical: nodes, beams, params; empty and Vmax equal; only the cert key moves, by PHYSICS_V):

| build | empty kg | Vmax km/h | cert key |
|---|---|---|---|
| builds/c172r_wipline2350_landprop_2026-10-20.json | 767.5 | 221.5 | af98c9fe → 120c52fc |
| builds/c172r_wipline2350_stcprop_2026-10-20.json | 770 | 205.2 | 92dd236d → 913c28a3 |
| builds/cessna172_2026-09-20.json | 713.2 | 240.9 | bd677633 → d6093355 |
| builds/cessna172_2026-09-20_corrected.json | 639.5 | 223.7 | bce62d1a → 7fb06420 |
| builds/cessna172_floats_2026-11.json | 845.4 | 227.3 | 78476d00 → bb2b8472 |
| builds/cessna172r_2026-11-08.json | 729 | 221.9 | 92575c78 → fd7767e6 |
| builds/chinook_2026-09-21.json | 282 | 146.1 | 3208e677 → 7ab44621 |
| builds/composite_jodel_2026-10-07.json | 360.4 | 168.2 | b78ff514 → 185fddc2 |
| builds/cub_2026-09-20.json | 344.5 | 138.7 | c7409e90 → 201208f2 |
| builds/cub_2026-09-20_corrected.json | 354.8 | 144.2 | af84cf8d → c35e5e7b |
| builds/jodel_2026-09-20.json | 404.2 | 187.9 | 22bc6b3a → 46f364dc |
| builds/jodel_2026-09-20_corrected.json | 343.6 | 161.7 | 59b49604 → d66a3efa |
| builds/pa18_floats_2026-10-23.json | 563.6 | 183.9 | e5f3f8e1 → 42c7d4c7 |
| builds/rufus_2026-10-18_certified.json | 275.2 | 146.6 | 7052bcd0 → a2f5920a |
| tools/fixtures/build_v7_ultralight_2026-09-05.json | 332.5 | 168.4 | 27a9fdfb → b51cd4f5 |
| tools/fixtures/build_v8_pusher_2026-09-11.json | 239.6 | 155.4 | a12823be → 877cbb38 |
| card:cub | 355.2 | 144.2 | 6bc488a5 → 2faef3d7 |
| card:pietenpol | 344.5 | 159.4 | 40eafafd → 233be99f |
| card:jodel | 336.3 | 163.2 | 9430cf1a → 76344e8c |
| card:c172 | 642.2 | 223.9 | 35b62970 → e78697d2 |
| card:rv | 447.9 | 262 | e894856e → badce674 |
| card:savannah | 345.4 | 168.2 | d920445 → 66955f93 |
| card:ul1 | 253.4 | 153.6 | 353bd410 → bc575f2e |
| card:floatplane | 415.1 | 184.6 | a8298c04 → dd7d4426 |
| card:pusherPod | 324.3 | 132.4 | 9d80ee2e → 557ac838 |
| card:motorglider | 173.3 | 202.3 | d3d82156 → 717ac220 |
| card:etrainer | 249.4 | 191.9 | 74e62a2b → 79692129 |
| card:ttail | 579.3 | 237 | 370cb273 → cabaa639 |
| card:vtail | 708.8 | 236.7 | e9ac98b2 → a8d6ec78 |
| card:mw5 | 209.7 | 116.1 | fcaaa9d3 → 94d633f1 |
| card:archaeopteryx | 170.7 | 179.6 | 28cb24fa → a400090 |
| card:da62 | 789.8 | 273.7 | 642174da → 909f4650 |
| card:twinBush | 1239.8 | 245.8 | be0ebda0 → 5509e6a2 |
| card:skymaster | 905.6 | 256.3 | 8584b762 → 749baa54 |
| card:p38 | 456.7 | 212.5 | 66138ab7 → 17c40a31 |
| card:pushPull | 883 | 257.4 | 4675f759 → 5005fabb |
| card:trimotor | 676.1 | 228.6 | 588c9c21 → 4afa390b |
| card:fourEngine | 784.5 | 237 | f3114978 → f8803bc6 |

## Gates (this branch vs plain real-figures-3b, same machine, the same day)

The full battery (322 jobs, ~2 h at 4 jobs on a quiet machine) was not run. On this 4-core box the 17 named gates took
~1 h 40 min at 2 jobs. The run was `run_gates.js --no-build --jobs=2 --only=STOL,RETRACT,DESIGN,DESIGNCHECK,ENGCONFIG,
PROCURE,SKINMAT,CANDIDATES,PLANELISTS,BENCH,CGBAND,SPECFIX,JOINPARITY,GEN,ARCHETYPES,CARDS,CERTGATES`, on d13b248e.
Each red was then re-run on plain real-figures-3b (b87682040).

| gate | this branch | plain real-figures-3b | reading |
|---|---|---|---|
| CARDS, PLANELISTS, SKINMAT, SPECFIX, CGBAND, RETRACT, DESIGN, CANDIDATES, CERTGATES | PASS | (STOL PASS; the others not re-run: green here) | |
| STOL | FAIL -> **PASS** after 62f6f179 | PASS | Section 1 "OFF IS THE BITS" named exactly the ten cards the measurement shows moving: tigermoth, stearman, camel, pittsAlike, sesqui and chinook (def, fly, draw), and caravan, spitfire, radial, beaver (def, fly: drag only). The six validated builds' hashes did not move. `_stol_samebits.js --capture` was run on this tree. Only those ten cards' def / fly / draw hashes were kept from it. The specs stay master's, because the capture's own specs carry RF3's neutral engine dials, which the gate strips. `_stol_check.js --selftest`: PASS. |
| PROCURE | FAIL (5 of 3170) -> **PASS** after b4468bb0 | PASS (real-figures-3b READY's run) | Only `scout\|cub\|gear=tundra`, BUSH-WHEELS' lighter balloon wheel: re-emitted (`--emit`) as cost 33, +3 kg, toM 3 (was 81, 8, 8). Re-run: PASS (3170). |
| BENCH | **FAIL** (156/157) | PASS (157/157) | **Ours, by the PHYSICS_V bump, and needs a re-stamp on the page.** Rufus's shipped certificate is "stamped under this game (f3, spec 10, physics 7; now 10, 9)". Its plaque-stamp and load-door-body rows hold. Its body and spec do not move with this physics: the Rufus digests in the table are identical, and only the stamp's version number is stale. The re-stamp is the gate's own instruction: load the file in the game, run the bench check, save, record the page and door hashes in `_bench_check.js SHIPPED_CERTS`. That is a page action (G3914 did it for TAILWHEELS' 6 -> 7), so it was not done headless here. Until then the game re-checks Rufus on load (R3), as it did after 6 -> 7. |
| ENGCONFIG | FAIL | FAIL | The same 8 lines on both: the Chinook pin, the push-pull / trimotor / quad cards ("DIFFERS from the saved file"), the quad's three downwind cases. The Chinook row's text differs. On base its def digest equals the pin and the flown one differs (0ce32059 167a9992). Here both move (f1b87a0f 3dcf5c63), because UL-WING lightens its wing. The row was already red, so it is **not re-pinned** here (someone else's red). The three example layouts do not move with this physics (their def digests are identical in the table above), so their `--write` was not re-taken either. |
| JOINPARITY | 1 FAIL | 1 FAIL | The same Jodel line, the same numbers (node 471.789 vs page 467.989 kg, node 0 S0BL). |
| DESIGNCHECK | FAIL (31/32) | FAIL (31/32) | The same line: "200 N sideways at the post: 4.2 mm against the drawn carbon shell's 1.8 mm". |
| GEN | FAIL (shard 3/4) | FAIL (shard 3/4) | The same check, "cruise is quiet in wind" (RF3's READY lists it on master too). Shards 0, 1, 2 PASS. |
| ARCHETYPES | FAIL (1) | FAIL (1) | The same line, "Chinook-alike: the circuit completes - rejected-takeoff" (`_arch_check.js --only=chinook` on base). The other 30 flown cards PASS. |

## Not in this branch

- On practical-cerf: the adopted cards and candidates, the DC-3 / Chinook / Tiger Moth / Camel / Stearman minimal fits,
  the Ruckus, real_check's gear-up sweeps, REF-DATA's real_refs rows. These are Pilot's and REAL-FIGURES' own trains.
- MASS-SCALE's message also names "the big-aircraft systems / installation billing". Its src/core is only the gear
  ceiling (hiBy). The transport systems were left as a finding in its evidence README on practical-cerf.
- TAIL-RETRACT is its own branch, `claude/ready/tail-retract` (TAIL-RETRACT-READY.md there).
