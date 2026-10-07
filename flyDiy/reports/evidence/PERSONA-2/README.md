# PERSONA-2 (G2460-G2466) - evidence

MODE: node (no browser, no SwiftShader: nothing on the page changed but the custom pilot's knob list, which GATE UISMOKE
walks). Every sweep names its tree: BEFORE = `5cc6856` (origin/claude/pilot-persona-probe = pilot-integration: train 38
+ ENGINE-TORQUE G2080 + ROUTE-DRAW G2120 + PILOT-PERSONA's own change; origin/claude/pilot-integration's tip 1c64198 is in
it), built; AFTER = `5c57518` (this branch, built; a first after sweep on 00c2329 is superseded by G2466 - see HANDOVER G2460).

| file | what | command |
|---|---|---|
| `before_table.txt` / `.md`, `before_results.json` | THE BEFORE: the four validated aeroplanes (the Cub `builds/cub_2026-09-20_corrected.json`, the Jodel `builds/jodel_2026-09-20_corrected.json`, the C172 `builds/cessna172_2026-09-20_corrected.json`, the C172 on Wipline 2350 floats `tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json` off the SEA lane) x the five people, calm, the four people on seeds 1935 / 1 / 2 / 3, the expert once - 68 flights. 12 FINDINGS | `node tools/pilot_persona.js --seeds 1935,1,2,3 --jobs 4 --core <5cc6856's built flight_core.js> --out before_results.json --md before_table.md` (7110 s wall; the tool as on this branch: --max 1500, the stab column '-' on the old core) |
| `after_table.txt` / `.md`, `after_results.json` | THE AFTER, the same 68 flights. SAFE | the same on 5c57518's core (3943 s wall) |
| `before_summary.txt` / `after_summary.txt` | one row per (aeroplane, person): min-max over the seeds, bounces / go-arounds summed, the stabilised-approach verdicts counted, the worst control reversals / min, the roll-out's worst heading (deg), the outcomes | `node summary.js <results.json>` (a scratch reader of the JSON; its columns as in HANDOVER G2085's summary + stab + roll-out) |
| `gates.log` | THE BATTERY on 5c57518 (node): BATTERY PASS - INPUT, PILOT, TAKEOFF, PILOTACT, UISMOKE, PILOTMATRIX, SEAPLANE, PLAYER, ENGTORQUE (the progress lines dropped) | `node tools/build.js` then `node --max-old-space-size=2048 tools/run_gates.js --no-build --only=PILOT,TAKEOFF,PILOTACT,PILOTMATRIX,SEAPLANE,INPUT,PLAYER,UISMOKE,ENGTORQUE --jobs=4 --verbose` (2807 s wall) |
| `experiments.txt` | the variants behind each change: the water run's delay (§1), the roll-out dither (§2), the ham-fist on floats step by step (§3), the expert's water flare before / after (§4), the ham-fist's roll-out (§5), GATE PILOTMATRIX's profile cells on the base and on 00c2329 (§6) | scratch, on built cores with an env-switched variant; numbers per flight |

The table's columns are pilot_persona.js's (its header); `stab` (new): `ok` judged stable, `GAn` the go-arounds the
stabilised-approach rule called, `+U` an unstable final landed after the two go-arounds (committed), `+T` an unstable
final (past the expert's 2 s dwell) landed by a person who decides late - both NAMED under the table.
