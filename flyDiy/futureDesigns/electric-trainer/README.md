# Electric trainer (hand-off, 18 Nov 2026)

The user's ruling (17 Nov): "send this as-is to REAL-FIGURES, as well as A0 for inclusion as an official plane. We'll call it
the electric trainer. We'll do the thermal engine version later." No real names on the plane or its livery (the user: not
the type's, not the maker's): it is the **Electric trainer**.

What it is: a two-seat high-wing electric trainer, outside fitted on the drafting table to a published three-view of a
Virus-type aeroplane (the blueprint image is private and is not here), inside and powerplant set from that type's
electric flight manual (POH-128). Built at subdivision level 2 (FIT AT LEVEL 2).

## Files

- `electric_trainer.json` - the plane: the garage's save format (cage rows + spec) with the drafting table's reference
  block (`ref`: the figures and their sources, the marks, the view boxes). Load it in the garage or with
  `node tools/drafting/table.js check|weigh`.
- `proto_rows.patch` - **the card needs it.** Generator changes made in a scratch copy while fitting; applies on
  `origin/master` 5f33d6bb7 (L40G, `git apply`), every patched file passes `node --check`. Not gated yet.
- `bench.html` - the comparison table (also at https://claude.ai/artifact/UfA2azDBoviDXj9ooFLmtS, private to the user).

## What the patch adds (every new row is absent / 0 at its default: no other build moves, except where noted)

| Row / change | File | What |
| --- | --- | --- |
| `frLeanCap` | `_cage_gen.js` | the frame lean clamp (was a fixed half bay) |
| `boomRound`, `boomRoundAt` | `_cage_gen.js` | round the boom's section from a station aft |
| `wsBaseCrown` (unused), `wsStraight` | `_cage_gen.js` | the windscreen's centre line straight base -> top |
| DASH-BAND | `_cage_gen.js` | with `wsToWaist`, the dash's base trace widens to two fifths only when the fifth finds < 4 edges (the dash was silently missing) |
| LINER-NGON | `_cage_gen.js` | the composite liner also lines the knife's n-gons round a drawn window (it stopped in steps) |
| `finVentralLand`, `finVentralSweep` | `_cage_fin.js` | a ventral fin without floats or twin booms; its tip row slid aft |
| `s2Inline` | `_gear_gen.js`, `_cage_gear.js` | the steered nose oleo's fork in the strut's own line (no castor under it); its shroud stops above the tyre / spat |
| BEAM-FLAT | `_gear_gen.js` | **every beam leg**: the blade thin from the front, wide from the side (the user: "fixed once and for all") |
| `wgTipTE` | `_cage_wing.js`, `_cage_join.js`, `63_gen_wing.js` | the tip bow's trailing edge held straight |
| `seatStickCut` | `_seat_gen.js` | a U notch in the carbon bucket's pan for a stick between the legs |
| `dashBack` range 0.30 -> 0.80 | `_cage_page5.js` | a dash out to the pilot |
| E-811 as installed | `00_registry.js` | **e811_velis**: 30 -> 53 kg, liquid (motor 23 + controller 8.1 + both coolant loops + HV cabling, POH-128 7-12..7-17); electric `cool.liquid` 0.11 -> 0.15 (the packs' loss in the loop) |
| liquid electric drive hardware | `_eng_mesh.js` | radiator (the `rad*` rows), pump pair, HV junction box on the motor stand |
| QS_VESSELS / QS_SEED_ENERGY | `quickshot.js`, `_scene_headless.js`, `_cage_energy.js` | env-gated: quickshot draws the build's own packs; quickshot no longer paints `pillarWindow` as glass |
| `--door` | `perf_study.js` | the bench loads a saved build through `_load_build` - **without it a drafting-table file flies its stale saved wing** (this card flew a 9.0 m wing until found) |

## Where it stands (bench, 600 kg, `perf_study --build=electric_trainer.json --vs=velis --door`; the `velis` reference row is in the patch)

| | Ours | Manual |
| --- | --- | --- |
| Empty mass | 420 kg | 428 |
| CG two aboard / margin | 28 % MAC / 21 % | 25.2-32.6 |
| Stall clean / landing flaps | 90 / 83 km/h | 94 / 83 |
| Climb | 3.5 m/s | 3.3 |
| Level speed ~75 % | 173 km/h | 170 |
| Take-off roll (formula / flown) | 232 / 283 m | 240 |
| Endurance at 20 kW to empty | ~64 min | 62 (52 + 10) |
| Best glide | 12.4 | 15 |
| Top speed | 193 km/h | 172 (rpm-limited) |
| Landing roll (normal pilot) | 443 m | 183 |

Open, owed: the cantilever wing buckles in the sandbag test at 3.5 g (glass; 4.2 g carbon) against +4 limit / 6 ultimate
- the box caps are not sized to the root moment (the same law also fails the Tiger Moth, Stearman and motorglider
archetypes); glide 17 % short (gear drag); no continuous rpm limit; the short-field landing pass does not finish. The
thermal-engine (Virus) variant comes later.
