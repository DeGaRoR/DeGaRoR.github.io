# SEA-AMPHIB - the amphibious floats, and every float plane (8 Nov 2026)

Cloud tester, branch `claude/sea-amphib-findings`. **TEST AND REPORT ONLY - no game code changed.**

- Base tested: `claude/seaplanes-merge` **15ad5d66** (A0's update; the report started on 7f6e1df6). `tools/flight_core.js`
  rebuilt from src on 15ad5d66 is byte-identical to the committed one (node physics = the base's). `index.html`,
  `dev.html`, `sw.js`, `version.json` are NOT: `node tools/build.js` on 15ad5d66 changes them (SEA-OFF c1ee10ad's editor
  rows are not baked into the page yet) - see F9.
- Master trees flown by the same driver: master **L35a 1bcd01d3** (origin/master) and **L34a cad308635**.
- Tools (all new, all under `reports/evidence/SEA-AMPHIB/`, none in the game):
  - `mk_amph.js` - makes the amphibious-float build through the editor's own row and the load door.
  - `probe_drawn.js` - the drawn wheels against the flown def.
  - `probe_surface.js` - placed surface physics (a physics probe, NOT the game's route; said where used).
  - `fly.js` - one tour the game's way (the load door's spec, `_tour_lib` game host = the page's placement, pilot with
    the shakedown, nav and day; damage ON) with per-step prop clearance, roll / pitch, tip clearance, capsize margin and
    a sim hash per leg; `--root` flies another worktree, `--trace` writes a 1 Hz time series.

STATUS: DONE - sections 0-4 (30 flights; FLOATS / HYDRODYN / SEAPLANE on both trees).

---

## 0. A0's FIRST FINDING - the float Cessna's TOUR red on mk_sea > SEA (node-proven)

**F1 (blocks: the TOUR gate, and a player's float Cessna on mk_sea): it is a CAPSIZE IN THE TAXI out of mk_sea - not
a landing, not a strike on the touchdown - and master already has it, to the hash.**

```bash
node flyDiy/reports/evidence/SEA-AMPHIB/fly.js --build bugReports/cessnaFloatsWOrks.json --order SEA,mk_sea,SEA --wind 8 --trace capsize.csv
```
(the TOUR gate's own path: `LB.gameSpec` + `_tour_lib` game host, game day 8 kt from 250 with gusts, damage ON; 45 min
on one cloud core)

1. **The faults, in order** - leg 1 SEA > mk_sea: ok. Leg 2 mk_sea > SEA: the pilot says `capsized: on its back in TAXI
   at 3.5 m/s (bank 90 deg)`; then `prop-strike (water, t 604.6)` - **t is ABSOLUTE sim time** (`DMG.propAt.t = simT`),
   about 182 s into leg 2, not leg time; then `timeout` (1800 s). `_tour_lib.js flyLeg` has no end for a capsize: the
   aeroplane sits inverted in TAXI until the timeout - and the timeout (plus no `vref-raised` on leg 2) is what takes it
   out of the gate's G3079 known-red filter (`_tour_check.js:231-236`).
2. **The trace** (sim t 588-605, TAXI at 4-6 m/s on mk_sea, roll + = right wing down): the roll oscillates and GROWS
   +7.7, -5.6, +0.4, +5.3, +11.8, +16.3, +15.1, +6.3, -1.9, +7.1, +15.4, +22.6, +29.8, +51 deg (about a 6-7 s period),
   then the CG drops to 1.3 m under the surface, the disc to 2.6 m under, a tip to 5.4 m under, and stays there
   (inverted on the floats). 0 yields, 0 breaks, gPeak 3.7.
3. **The touchdown** (leg 1 at mk_sea): 35.6 m/s (`vref-raised: the elevator cannot hold 31.7 m/s at this power`), sink
   0.47 m/s, run 370 m. Leg 2 never takes off.
4. **The propeller over the water** - float Cessna: leg 1 at least **0.47 m** (ROLLOUT, mk_sea): the landing does not
   strike; leg 2 goes negative only at the capsize. **Super Petrel V4.1** SEA > mk_sea (base): touchdown 25.6 m/s, sink
   0.36, run 179 m; in the ROLLOUT at 16 -> 10 m/s it BOUNDS (vy +1.35 / -2.39 m/s, pitch 30 then 41.9 deg) and the
   disc is **9 cm into the water at sim t 452** (prop-strike); at rest afterwards 0.23-0.37 m, the pitch bobbing
   +-2-4 deg (F2).
5. **Master gives the same, to the hash**: base 15ad5d66, master L35a 1bcd01d3 and master L34a cad308635 all fly leg 1 ->
   `6d3f1c643f66` and leg 2 -> `e50c81e92c5c`, capsized. **Not a seaplanes-merge regression.**
   `node flyDiy/reports/evidence/SEA-AMPHIB/fly.js --root <worktree>/flyDiy ...` (the same driver on each tree).
6. **THE 10 Hz TRACE** (`reports/evidence/SEA-AMPHIB/runs/cessna_capsize_10hz_t560-612.csv`: t, phase, Vg, vy, CG
   height, disc gap, pitch, roll, heading, thr, da, dr, de). Re-flown with the last leg capped at 230 s: the same
   capsize at the same sim time (deterministic).
   ```bash
   node flyDiy/reports/evidence/SEA-AMPHIB/fly.js --build bugReports/cessnaFloatsWOrks.json --order SEA,mk_sea,SEA --wind 8 --hz 10 --tmax-last 230 --trace c.csv
   ```
   - The leg is 183 s of TAXI on mk_sea (from where leg 1 stopped, towards the take-off); it never reaches HOLD / ROLL.
   - **The taxi is FAST for floats.** From t 582.8 the throttle steps 0 -> 0.5 (>= 0.45 for 72 % of 582-604); Vg climbs
     1.6 -> 3.8 -> 5.4 -> **6.0-6.4 m/s** (12 kt), during a slow left-hand turn (heading -38 -> -53 deg). On a float
     Cessna that is the plow / hump band, not a displacement taxi (an idle taxi on this hull earlier in the leg: 1-2 m/s).
   - **The roll diverges right wing down, and the controller can do nothing about it.** Two swings: +17 deg at 595.3,
     back to -2.6, then +7 (600.0), +15.6 (601.0), +23 (602.0), +30.5 (603.0), +52.6 (604.0), +92 (604.6), +139 (605.0),
     179 (605.3). **The aileron sits at its stop, da -0.25**, from 592.8 and through all of the second swing (41 % of
     582-604); the rudder stays within +-0.3; the elevator is 0.3.
   - **The throttle is never cut.** thr is still 0.5 at 60, 90 and 140 deg of bank (604.2-605.0).
   - Then inverted: the CG 1.3-1.5 m under the surface, the disc -2.6 to -2.9 m (the strike, t 604.6), roll +-163-180.
   - For SEAPLANES (unproven causes, the numbers above are the evidence): (a) the water taxi's target speed / throttle
     on floats (6 m/s with the power pulsing to 0.5); (b) the taxi's aileron authority, capped at -0.25 here; (c) no
     power cut / no turn-out-of-wind on a growing roll past ~15 deg; (d) the 8 kt wind and gusts on the turn - ANSWERED: in calm air the
     same aeroplane flies mk_sea > SEA clean (taxi, take-off, landing at SEA, prop >= 0.59 m; section 2), so the wind
     is the trigger; (e) `flyLeg` should end a leg on the pilot's
     `capsized` outcome (the 1800 s timeout costs the gate 25 min of CPU and hides the cause behind 'timeout').

**F2 (bad: the official Petrel strikes its propeller landing on mk_sea, the user's OPEN item, measured):** see 0.4. The
strike comes from the bounding rollout (pitch 42 deg at 10 m/s), not from the touchdown (sink 0.36) or from rest
(gap >= 0.23 m on this run).

---

## 1. Are the amphibious floats flown? NO - drawn only. (node-proven)

THE AMPHIBIOUS-FLOAT BUILD (none existed): the validated float Cessna (`LB.VALIDATED.floats`,
`bugReports/cessnaFloatsWOrks.json`) with the editor's own row `spec.cage.fltAmph` = 1 (Wipline) and = 2 (EDO style),
then the game's load door `LB.gameSpec`. Files: `reports/evidence/SEA-AMPHIB/cessna_floats_amph1.json`, `..._amph2.json`.

```bash
node flyDiy/reports/evidence/SEA-AMPHIB/mk_amph.js
```
```bash
node flyDiy/reports/evidence/SEA-AMPHIB/probe_drawn.js
```

Measured:
- The game spec of the amphibious-float build differs from the plain float Cessna's in ONE place: `spec.cage.fltAmph`
  (an inert editor row). `gear.type` 'floats', no `gear.floats.amphibian`, `stripGear` -> 'floats'.
- DRAWN (the page's float layer, gear down): Wipline 2350 (picked by hull height, `est`), mains 1 x 5.00x5, nose 2.50x4,
  keel 142 mm over the ground, amphibian system +73.9 kg; axles at (+-0.80, -1.80, 0.32) and (+-0.80, -1.84, 4.28).
- FLOWN (the def): `parts.amph` false, 2 floats, `refs.mains` = the two float keel nodes (FLK), `refs.tw` -1, **0 nodes
  with a contact radius (no wheel anywhere)**, `params.retract` null, mass **949.5 kg = the plain float Cessna's** (the
  73.9 kg is not carried).

Each question, with the code path:

| question | answer | where |
|---|---|---|
| does the row reach the spec? | **no** - the join copies `CAGE_FLOAT.P` (hull numbers) and never reads `fltAmph`; the floats' record carries only `FLOAT_SPEC_KEYS` + placement | `tools/_cage_join.js:1498-1501` (M.floats), `:427-438` (spec.gear.floats), `:1308` (gearType 'floats') |
| does the route treat it as an amphibian? | **no** - `stripGear` reads `gear.floats.amphibian === true`, which NO producer writes (grep: only `_surface_check.js:133` sets it by hand) -> 'floats': land ends refused | `src/core/25_airfield.js:1013`, `:1024-1027` |
| wheel contact on land (taxi, take-off, landing)? | **none** - the frame builds wheels only when `gear.type` is not floats/hull; the amphibian path (`AMPH`) is a TRICYCLE with a hull record (the Petrel), never floats | `src/core/61_gen_frame.js:2663` (AMPH), `:2671` (WHEELS), `:3092` (floats branch) |
| contacts in the solver | `wheelsOnGround` / `wheelContacts` switch to wheels only on `parts.amph`; a float build returns the floats' wet count (0 on land) | `src/core/30_solver.js:4210-4232` |
| do the float wheels retract / extend? | **no** - no `params.retract`, so `gearStep` never runs (`GR` null); the Digit9 key has nothing to move. The DRAWN pose is the editor's `gearPos` (default 1 = down), and the `gearPos` row only shows with `gearRetract` - so in the game the drawn wheels stand DOWN for the whole flight, on the water too (browser to confirm) | `src/core/30_solver.js:1560-1600, 4059`; `tools/_cage_float.js:644`; `tools/_cage_gear.js:1444` |
| AP's gear logic | `AMPHG` needs `parts.amph`: never on floats | `src/core/43_pilot.js:854, 3339-3340` |
| water vs lowered wheels | **ignored** - there are no wheel nodes, and the tyres' water model (`wetBuild`, the plough) is built only for a build WITHOUT floats / hull (`WB_CAN = !HY`) | `src/core/30_solver.js:1857`; `src/core/32_hydro.js:2547-2548` |
| the amphibian's weight | not flown - `rec.amph.dKg` is a drawing record; the float mass row (`mFloat`) does not add it | `tools/_cage_float.js:742` vs `:191` |

THE SAME QUESTION FOR THE ONE AMPHIBIAN THAT IS FLOWN (the Super Petrel, a hull on a retracting tricycle): its wheels ARE
contacts on land (`parts.amph`, `61_gen_frame.js:3776`; solver 4210) and retract (`params.retract`), but **on the water its
lowered wheels are ignored too**: the hull makes `HY` non-null, so `WB_CAN` is false and the tyres' plough
(`32_hydro.js:2392`) is never built for it; the wheels' only contact is `terrainH` (the sea bed). A Petrel landing on the
water gear DOWN meets no extra drag and no nose-over moment. Measured in 1b below.

---

## 2. Every float plane through the load door (node)

How: `fly.js` per row (the load door's spec, the game host, damage ON, Expert = the game pilot's default profile;
wind 8 = the game's day 8 kt from 250 with gusts, wind 0 = calm). Legs are capped at 1200 s (1800 on the first four
runs). The table is `node flyDiy/reports/evidence/SEA-AMPHIB/table.js flyDiy/reports/evidence/SEA-AMPHIB/runs`; the
runs' JSON and logs are in that folder.
Columns: prop min = the disc's least height over the water / ground on the leg (with the phase); roll + = right wing
down; tip min = the outer 20 % of the span over the surface while on it; capsize margin = 90 - max |roll| on the
surface (negative = it went over); gear = out.gear min-max (retract builds only).
NOTE: the runs named base_*, master_cessna_*, l34a_* and base_petrel used `asin` for the roll, which reads an
inverted aeroplane as about +-78 deg. Their 77.6 deg / margin 12.4 on the capsized leg is really +-180 / -90, as
capsize10hz and amph1 show. Every later run uses atan2.

**THE LAND LEGS FOR FLOAT PLANES.** The route door refuses every land end (12 of 15) for the Twin 4b, the PA-18, the
Cessna AND the amphibious-float Cessna: stripGear says 'floats', 'floats land on water only' (`runs/route_door.log`;
`node flyDiy/reports/evidence/SEA-AMPHIB/route_door.js`). So for all four, land>land, land>water and water>land are
'refused by the game'. That is right for pure floats and WRONG for the amphibious build, which draws wheels (section 1).
The Super Petrel may use all 15 ends.

**"3 TIMES".** The sim is deterministic, so a repeat gives the same hash and adds nothing:
- the Cessna's SEA > mk_sea was flown 5 times on 3 trees (base, base 10 Hz, base amph1, master L35a, master L34a): all
  `6d3f1c643f66`;
- the PA-18's legs twice each (base, master): `f18ea9496828` / `97b61668719f`;
- the Twin's SEA > mk_sea twice: `c93c91a4ffb9`;
- the capsize recurs at sim t 604.6 under three leg caps (1800 / 1200 / 230 s).
The variation that does change the answer is the WIND, flown both ways below. A seeded perturbation (start offset,
gust seed) would be the meaningful "3 times"; no rig option for it exists - unproven how it moves F1-F3.

| run | build | wind | leg | result | sink m/s | run m | prop min m (phase) | roll on surface min / max | pitch on surface min / max | tip min m | capsize margin deg | gear | hash |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| amph1_SEA-mk-SEA_w8 | cessna_floats_amph1 | 8 kt | SEA>mk_sea | PASS | 0.47 | 370 | 0.47 ROLLOUT | -3.1 / 5.8 | -1.3 / 8.3 | 1.5 | 84.2 | - | 6d3f1c643f66 |
| amph1_SEA-mk-SEA_w8 | cessna_floats_amph1 | 8 kt | mk_sea>SEA | FAIL: capsized: on its back in TAXI at 3.5 m/s (bank 90 deg) | - | - | -2.86 TAXI | -180 / 180 | -2.4 / 12.4 | -5.43 | -90 | - | a337ca603fcf |
| base_cessna_w8 | cessnaFloatsWOrks | 8 kt | SEA>mk_sea | PASS | 0.47 | 370 | 0.47 ROLLOUT | -3 / 5.8 | -1.3 / 8.3 | 1.5 | 84.2 | - | 6d3f1c643f66 |
| base_cessna_w8 | cessnaFloatsWOrks | 8 kt | mk_sea>SEA | FAIL: capsized: on its back in TAXI at 3.5 m/s (bank 90 deg) | - | - | -2.86 TAXI | -17.5 / 77.6 | -2.4 / 12.4 | -5.43 | 12.4 | - | e50c81e92c5c |
| base_petrel_w8 | superpetrel_V4_1 | 8 kt | SEA>mk_sea | FAIL: prop-strike (the propeller struck (water, t 452)) | 0.36 | 179 | -0.09 ROLLOUT | -4.4 / 14.3 | -5.3 / 42.6 | 0.2 | 75.7 | 0-1 | 793d9d539efa |
| capsize10hz | cessnaFloatsWOrks | 8 kt | SEA>mk_sea | PASS | 0.47 | 370 | 0.47 ROLLOUT | -3.1 / 5.8 | -1.3 / 8.3 | 1.5 | 84.2 | - | 6d3f1c643f66 |
| capsize10hz | cessnaFloatsWOrks | 8 kt | mk_sea>SEA | FAIL: capsized: on its back in TAXI at 3.5 m/s (bank 90 deg) | - | - | -2.87 TAXI | -180 / 180 | -2.4 / 12.4 | -5.43 | -90 | - | ba11d232d9e7 |
| cessna_SEA-SEA_w0 | cessnaFloatsWOrks | 0 kt | SEA>SEA | PASS | 0.37 | 383 | 0.5 ROLL | -2.2 / 4.9 | -0.5 / 7.5 | 1.56 | 85.1 | - | 03e595c84cb8 |
| cessna_SEA-SEA_w8 | cessnaFloatsWOrks | 8 kt | SEA>SEA | PASS | 0.64 | 347 | 0.49 ROLL | -3.1 / 5.8 | -0.5 / 7.6 | 1.5 | 84.2 | - | 3577df631178 |
| cessna_SEA-mk-SEA_w0 | cessnaFloatsWOrks | 0 kt | SEA>mk_sea | PASS | 0.4 | 380 | 0.5 ROLL | -2.2 / 4.9 | -0.5 / 7.6 | 1.56 | 85.1 | - | bdeb8eecf0a8 |
| cessna_SEA-mk-SEA_w0 | cessnaFloatsWOrks | 0 kt | mk_sea>SEA | PASS | 0.4 | 373 | 0.59 TAXI | -3.6 / 5.5 | 0.9 / 7.5 | 1.47 | 84.5 | - | b5dde7209627 |
| l34a_cessna_w8 | cessnaFloatsWOrks | 8 kt | SEA>mk_sea | PASS | 0.47 | 370 | 0.47 ROLLOUT | -3 / 5.8 | -1.3 / 8.3 | 1.5 | 84.2 | - | 6d3f1c643f66 |
| l34a_cessna_w8 | cessnaFloatsWOrks | 8 kt | mk_sea>SEA | FAIL: capsized: on its back in TAXI at 3.5 m/s (bank 90 deg) | - | - | -2.86 TAXI | -17.5 / 77.6 | -2.4 / 12.4 | -5.43 | 12.4 | - | e50c81e92c5c |
| master_cessna_w8 | cessnaFloatsWOrks | 8 kt | SEA>mk_sea | PASS | 0.47 | 370 | 0.47 ROLLOUT | -3 / 5.8 | -1.3 / 8.3 | 1.5 | 84.2 | - | 6d3f1c643f66 |
| master_cessna_w8 | cessnaFloatsWOrks | 8 kt | mk_sea>SEA | FAIL: capsized: on its back in TAXI at 3.5 m/s (bank 90 deg) | - | - | -2.86 TAXI | -17.5 / 77.6 | -2.4 / 12.4 | -5.43 | 12.4 | - | e50c81e92c5c |
| master_pa18_w8 | pa18_floats_2026-10-23 | 8 kt | SEA>mk_sea | PASS | 0.48 | 194 | 0.28 ROLLOUT | -2.2 / 3.1 | -4 / 9.3 | 1.58 | 86.9 | - | f18ea9496828 |
| master_pa18_w8 | pa18_floats_2026-10-23 | 8 kt | mk_sea>SEA | PASS | 0.69 | 194 | 0.27 HOLD | -1.9 / 2.9 | -4.3 / 7.8 | 1.63 | 87.1 | - | 97b61668719f |
| master_twin_w8 | Twin_busher_floats_4b | 8 kt | SEA>mk_sea | PASS | 0.66 | 225 | 0.39 ROLLOUT | -2.6 / 1.2 | -5.7 / 11.6 | 1.57 | 87.4 | - | c93c91a4ffb9 |
| master_twin_w8 | Twin_busher_floats_4b | 8 kt | mk_sea>SEA | FAIL: timeout (the leg took over 1200 s) | - | - | 0.32 TAXI | -8.6 / 7.8 | -8.6 / 8.9 | 1.06 | 81.4 | - | 667fa810c584 |
| pa18_SEA-SEA_w0 | pa18_floats_2026-10-23 | 0 kt | SEA>SEA | PASS | 0.45 | 246 | 0.36 ROLL | -1.8 / 2.6 | -3.4 / 13.4 | 1.6 | 87.4 | - | 13bc2164c09a |
| pa18_SEA-SEA_w8 | pa18_floats_2026-10-23 | 8 kt | SEA>SEA | PASS | 0.58 | 198 | 0.35 ROLL | -2.2 / 3.1 | -3.4 / 7.9 | 1.58 | 86.9 | - | 9e74a074c16c |
| pa18_SEA-mk-SEA_w0 | pa18_floats_2026-10-23 | 0 kt | SEA>mk_sea | PASS | 0.45 | 246 | 0.36 ROLL | -1.8 / 2.6 | -3.4 / 13.4 | 1.6 | 87.4 | - | 6090cdf099ed |
| pa18_SEA-mk-SEA_w0 | pa18_floats_2026-10-23 | 0 kt | mk_sea>SEA | PASS | 0.45 | 244 | 0.42 TAXI | -2.1 / 3.6 | -1 / 13.8 | 1.56 | 86.4 | - | 1bba9a129dc5 |
| pa18_SEA-mk-SEA_w8 | pa18_floats_2026-10-23 | 8 kt | SEA>mk_sea | PASS | 0.48 | 194 | 0.28 ROLLOUT | -2.2 / 3.1 | -4 / 9.3 | 1.58 | 86.9 | - | f18ea9496828 |
| pa18_SEA-mk-SEA_w8 | pa18_floats_2026-10-23 | 8 kt | mk_sea>SEA | PASS | 0.69 | 194 | 0.27 HOLD | -1.9 / 2.9 | -4.3 / 7.8 | 1.63 | 87.1 | - | 97b61668719f |
| petrel_HOME-SEA_w0 | superpetrel_V4_1 | 0 kt | HOME>SEA | PASS | 0.36 | 327 | 0.13 ROLLOUT | -1.5 / 0.4 | -5.2 / 13.2 | 0.92 | 88.5 | 0-1 | c07c9e9fd5e4 |
| petrel_HOME-SEA_w8 | superpetrel_V4_1 | 8 kt | HOME>SEA | PASS | 0.3 | 256 | 0.15 ROLLOUT | -1.6 / 5.3 | -5.2 / 12.2 | 0.85 | 84.7 | 0-1 | 3d11893f4776 |
| petrel_HOME-w3_w0 | superpetrel_V4_1 | 0 kt | HOME>w3 | PASS | 0.76 | 354 | 0.72 ROLL | -1.5 / 0.4 | -5.2 / 8.1 | 1.47 | 88.5 | 0-1 | 7398aa59899a |
| petrel_HOME-w3_w8 | superpetrel_V4_1 | 8 kt | HOME>w3 | PASS | 0.66 | 369 | 0.72 ROLL | -1.6 / 0.4 | -5.2 / 8.1 | 1.48 | 88.4 | 0-1 | adba2eb349ba |
| petrel_SEA-HOME_w0 | superpetrel_V4_1 | 0 kt | SEA>HOME | PASS | 0.81 | 451 | 0.17 ROLL | -1.2 / 0.7 | -2.6 / 7.8 | 0.89 | 88.8 | 0-1 | 3b521e2f0cc9 |
| petrel_SEA-HOME_w8 | superpetrel_V4_1 | 8 kt | SEA>HOME | PASS | 0.81 | 479 | 0.16 ROLL | -1.3 / 1.2 | -2.5 / 8 | 0.89 | 88.7 | 0-1 | c600d8719cb0 |
| petrel_SEA-SEA_w0 | superpetrel_V4_1 | 0 kt | SEA>SEA | PASS | 0.4 | 329 | 0.13 ROLLOUT | -1.2 / 0.7 | -2.6 / 13.2 | 0.89 | 88.8 | 0-1 | 82601559a9b6 |
| petrel_SEA-SEA_w8 | superpetrel_V4_1 | 8 kt | SEA>SEA | PASS | 0.22 | 251 | 0.16 ROLL | -1.5 / 5.8 | -2.5 / 11.9 | 0.8 | 84.2 | 0-1 | 5560cca69a22 |
| petrel_SEA-mk-SEA_w0 | superpetrel_V4_1 | 0 kt | SEA>mk_sea | PASS | 0.38 | 329 | 0.13 ROLLOUT | -1.2 / 0.7 | -2.6 / 13.2 | 0.89 | 88.8 | 0-1 | 5e81596afabe |
| petrel_SEA-mk-SEA_w0 | superpetrel_V4_1 | 0 kt | mk_sea>SEA | PASS | 0.35 | 331 | 0.13 ROLLOUT | -4 / 8.8 | 0.2 / 12.9 | 0.33 | 81.2 | 0-0 | 626c0907097d |
| twin_SEA-SEA_w0 | Twin_busher_floats_4b | 0 kt | SEA>SEA | PASS | 0.97 | 273 | 0.39 ROLL | -0.8 / 0 | -3.8 / 15.4 | 1.53 | 89.2 | - | dbdd3e42f0c3 |
| twin_SEA-SEA_w8 | Twin_busher_floats_4b | 8 kt | SEA>SEA | PASS | 1.21 | 220 | 0.4 ROLLOUT | -1.9 / 1.9 | -3.8 / 11.6 | 1.56 | 88.1 | - | e7ccdcedb6c8 |
| twin_SEA-mk-SEA_w0 | Twin_busher_floats_4b | 0 kt | SEA>mk_sea | PASS | 0.99 | 274 | 0.39 ROLL | -0.8 / 0.3 | -3.8 / 15.4 | 1.53 | 89.2 | - | 71508e7e7108 |
| twin_SEA-mk-SEA_w0 | Twin_busher_floats_4b | 0 kt | mk_sea>SEA | PASS | 0.97 | 269 | 0.39 ROLL | -2.4 / 2.3 | -2.4 / 15.4 | 1.53 | 87.6 | - | 8e9644185a93 |
| twin_SEA-mk-SEA_w8 | Twin_busher_floats_4b | 8 kt | SEA>mk_sea | PASS | 0.66 | 225 | 0.39 ROLLOUT | -2.6 / 1.2 | -5.7 / 11.6 | 1.57 | 87.4 | - | c93c91a4ffb9 |
| twin_SEA-mk-SEA_w8 | Twin_busher_floats_4b | 8 kt | mk_sea>SEA | FAIL: timeout (the leg took over 1200 s) | - | - | 0.32 TAXI | -8.6 / 7.8 | -8.6 / 8.9 | 1.06 | 81.4 | - | 667fa810c584 |

### Pass / fail by aeroplane and leg (the game's day 8 kt | calm)

| aeroplane | SEA > mk_sea | mk_sea > SEA | SEA circuit (SEA > SEA) | HOME > w3 | HOME > SEA | SEA > HOME |
|---|---|---|---|---|---|---|
| Twin_busher_floats_4b | PASS / PASS | **FAIL (F3, gave-up)** / PASS | PASS / PASS | refused | refused | refused |
| PA-18 floats | PASS / PASS | PASS / PASS | PASS / PASS | refused | refused | refused |
| Cessna floats (VALIDATED) | PASS / PASS | **FAIL (F1, capsized)** / PASS | PASS / PASS | refused | refused | refused |
| Cessna floats + fltAmph 1 | PASS (= the Cessna's hash) / not flown (= the Cessna) | **FAIL (F1, capsized)** / not flown | not flown (= the Cessna) | refused (WRONG) | refused (WRONG) | refused (WRONG) |
| Super Petrel V4.1 | **FAIL (F2, prop strike)** / PASS | not flown (the leg before failed) / PASS (two lineup-timeouts, F3b) | PASS / PASS | PASS / PASS | PASS / PASS | PASS / PASS |

Findings:
- **F1, F2 and F3 are all mk_sea on the game's day, and all three go away in calm air.** Calm: the Cessna flies
  mk_sea > SEA clean (the prop at least 0.59 m), the Twin too (one go-around: 'unstabilised approach at 84 m: sinking
  3.8 m/s'), and the Petrel lands at mk_sea with no strike (the prop at least 0.13 m, the margin 81 deg). So the
  8 kt / gusts / sea breeze at mk_sea is the trigger - whether through the sea state there or through the controller
  is unproven (node cannot separate them without a rig option).
- **F3 (bad, node-proven, master the same): the Twin 4b cannot leave mk_sea on the game's day.** Leg 2 mk_sea > SEA:
  - 456 s of TAXI, wandering (the heading swinging 140 -> -90 -> 105 deg);
  - then STOP / HOLD / LINEUP three times - one LINEUP holds heading 133 at 4.5 m/s on thr 0.36-0.45 for 120 s (about
    540 m straight) and stops;
  - then 549 s more TAXI. It never reaches ROLL: the outcome is 'gave-up', the leg times out.
  No damage, roll within +-8.6 deg. Base and master L35a give the same hash (667fa810c584).
  ```bash
  node flyDiy/reports/evidence/SEA-AMPHIB/fly.js --build builds/candidates/Twin_busher_floats_4b.json --order SEA,mk_sea,SEA --wind 8 --trace t.csv
  ```
- **F3b (bad): the Petrel in CALM air also fights the line-up at mk_sea:** 'lineup-timeout: could not line up in 60 s'
  at 92 and 184 s, 'replan: not lined up with a run ahead (143 m, 15.2 m off)', then 'gave-up: still in FINAL at
  t=871 s' - and it still lands at SEA (1062 s). The departure from mk_sea is the weak point for the water pilot.
- **F4 (cosmetic): a water pivot is worded as wheels** - 'pivot: a turn of 24 deg that the wheels (Infinity m) cannot
  steer on the route - turning on the spot' (Twin 4b, calm, mk_sea).
- **The Super Petrel on land and between surfaces:** HOME > w3, HOME > SEA, SEA > HOME and SEA > SEA all PASS on both
  days; the wheels go down for land and up for water (gear 0-1 on every mixed leg, 0-0 on calm mk_sea > SEA). Its
  propeller is the lowest of the five on the water: 0.13-0.17 m at the least, in the rollout / take-off roll (the
  Cessna 0.47-0.59, the Twin 0.39, the PA-18 0.27-0.42). Landing runs on HOME / w3: 354-479 m (long for an LSA; the
  HANDOVER's B80 already notes the V4's ~100 m longer roll).
- **The amphibious-float Cessna flies as the float Cessna, to the hash** (leg 1 `6d3f1c643f66`), and capsizes at the
  same sim t 604.6 on leg 2. Its leg-2 end hash differs (`a337ca603fcf` vs `e50c81e92c5c`) only because the leg was
  capped at 1200 s, not 1800: it sits inverted longer in the other run.

## 3. Regression - the non-amphibious float planes, base vs master

Sim hashes (node positions at each leg's end, `fly.js`), the game's day 8 kt:

| aeroplane / leg | base 15ad5d66 | master L35a 1bcd01d3 | master L34a cad308635 |
|---|---|---|---|
| float Cessna SEA > mk_sea | 6d3f1c643f66 | 6d3f1c643f66 | 6d3f1c643f66 |
| float Cessna mk_sea > SEA (capsized) | e50c81e92c5c | e50c81e92c5c | e50c81e92c5c |
| Twin 4b SEA > mk_sea | c93c91a4ffb9 | c93c91a4ffb9 | - |
| Twin 4b mk_sea > SEA (gave-up) | 667fa810c584 | 667fa810c584 | - |
| PA-18 floats SEA > mk_sea | f18ea9496828 | f18ea9496828 | - |
| PA-18 floats mk_sea > SEA | 97b61668719f | 97b61668719f | - |

**No float plane moved between master and the seaplanes merge: 6 of 6 legs give identical hashes.** (The build files
are byte-identical on both trees: Twin 4b c7a9956a, PA-18 e26c7353.) The Petrel is not on master (no hull code there),
so it has no master column.

**The gates, base 15ad5d66 vs master L35a 1bcd01d3** (the gate scripts run directly with `--show`, full output kept in
`reports/evidence/SEA-AMPHIB/runs/raw_<tree>_<gate>.log`):

| gate | base | master | output identical? |
|---|---|---|---|
| FLOATS (`_floats_check.js`) | PASS, 22 PASS lines | PASS, 22 PASS lines | yes, byte for byte (sha1 4c9bae8e9fcc) |
| HYDRODYN (`_hydro_check.js`) | PASS, 49 | PASS, 49 | yes, except the 2 cost lines (ms/step - CPU load, not a count) - sha1 0520288ec0bb without them |
| SEAPLANE (`_seaplane_check.js`, full tier) | PASS, 12 | PASS, 12 | yes, byte for byte (sha1 4eafe6c368ee) |

`node tools/run_gates.js --only=FLOATS --no-build` and `--only=HYDRODYN` were also run through the runner on both
trees: PASS / PASS. The cert keys were not re-run here (the box runs them; A0's CERT IDENTITY on 8 Nov: 0 moved on 13).
**Second opinion: no regression for the non-amphibious float planes.**

## 4. What is missing for amphibious floats to really work (a list for SEAPLANES - no code from this tester)

Ordered by dependency. Each item names where today's code stops.
1. **The record.** The join must carry the row: `fltAmph` -> `spec.gear.floats.amphibian` (true / style), the model,
   the tyres (main / nose codes, mainN), the axle stations (the drawn `rec.amph.L/R` mainAxle / noseAxle, in the
   floats' own x-aft-of-step / y-over-keel frame like `floats.x / y`) and the system's mass (`dKg`).
   `tools/_cage_join.js:427-438, 1498-1501`; `src/core/60_gen_spec.js:5518-5551` must keep and clamp the new keys.
   Then `stripGear` (`25_airfield.js:1013`) already answers 'amphibian' and the route, map, contracts and storage cards
   all follow (they read stripGear).
2. **Wheels in the frame.** `61_gen_frame.js` builds wheels only when `gear.type` is not floats (`:2671`) and the
   amphibian path `AMPH` (`:2663`) is a hull on a tricycle. A float amphibian needs four (or two + two) wheel nodes with
   contact radii hung from each float's keel at the drawn stations - mains just aft of the step, noses at the bows -
   tied into the float's own structure, `refs.mains` / `refs.tw` (the nose pair as the steering contact) and
   `parts.amph` set, so that the solver's land / water switch (`30_solver.js:4210-4232`) and the AP's surface rule
   (`43_pilot.js:854`) work unchanged.
3. **The retraction.** `params.retract` for a float amphibian (the hydraulic pump of the Wipline system; the time),
   `gearStep` lifting each wheel by its MEASURED rise (the drawn fold: main up into the well, nose forward to the bow
   bumper) - the `RET.lift` mains / nose split exists (`30_solver.js:1574-1580`). The drawing must follow
   `sim.out.gear` in the game (today `_cage_float.js:644` reads the editor's `gearPos`, default 1 = down, and the
   `gearPos` row needs `gearRetract`): the page's float wheels need a swing rig like `gearSwingRig` (app.js).
4. **The water and the lowered wheels (the floats AND the Petrel).** `WB_CAN = !HY` (`30_solver.js:1857`): a float or
   hull build never builds the tyres' water model, so a wheels-down water landing is free. The tyre plough
   (`32_hydro.js:2392`, Cd and the disc segment) has to run beside the float / hull pass for the wheel nodes alone,
   scaled by the retraction (`WB.lift`, already written by gearStep). Without it the GUMPS 'up for water' rule has no
   consequence to protect against - the classic amphibian accident (wheels down on the water: the nose-over) cannot
   happen.
5. **The ground under the floats.** Today a float keel on concrete is a high-friction skid (placed probe: 3.2 m moved in
   30 s at full throttle, 0.12 m/s, no damage). With wheels the keels stand 0.8 R over the ground (142 mm on the 2350's
   5.00x5) - the gear-up landing on a runway (keels on concrete) should then be the scrape / damage case.
6. **The weight and the drag.** +`dKg` into the float mass (the Wipline 2350's 73.9 kg on the Cessna; null for six
   catalogue rows - those need a rule or a number); the wheels' drag down in the air (the retract's `cdA`); the
   balance moves (the gear's mass forward).
7. **The ramp.** The KNOWN LIMIT already in HANDOVER: on the surface the AP reads the water under the CG (0.2 m margin),
   so an amphibian cannot taxi up a ramp out of the water on its wheels. Floats make it more likely (the wheels are
   under the keels, the keels touch first on a shallow ramp).
8. **The pilot and the tests.** AMPH-GEAR / GUMPS for floats (`43_pilot.js:3337-3354` reads `parts.amph`: works once
   item 2 sets it); a gate that flies an amphibious-float build land > water > land (the Cessna + fltAmph 1 from
   `reports/evidence/SEA-AMPHIB/mk_amph.js` is a ready fixture); RETRACT-LAB: the row stays lab-only until 1-4 land.
9. **Data gaps** the drawing already admits (`_cage_float.js` `rec.amph.assumed`): stow flush, trunnion height, nose
   travel, nose rake; `WIPLINE_AMPHIB` dL / dKg null on six rows; the EDO style's geometry from photographs only.

## Browser-needed (node cannot show these)

- B1. The amphibious-float build in the game: are the Wipline / EDO wheels drawn DOWN through the whole flight and on
  the water (the editor's gearPos default; no swing rig on floats)? Does Digit9 do anything visible? (section 1)
- B2. The float Cessna's mk_sea taxi capsize (F1) on the GPU: the same at sim t ~605 on the default day?
- B3. The Petrel's bounding rollout at mk_sea (F2): the pitch-up to ~40 deg and the strike, on screen.
- B4. The Twin 4b's mk_sea departure loop (F3): where the LINEUP is trying to go.
- B5. The page files on 15ad5d66 are not rebuilt from SEA-OFF (index.html / dev.html / sw.js / version.json change on
  `node tools/build.js`): a page loaded from this commit does not carry SEA-OFF's lab gating until the built commit lands.
