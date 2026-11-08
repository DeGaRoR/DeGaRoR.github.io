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

STATUS: in progress. Sections 0 and 1 are done; 2-4 fill in as the flights finish.

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
     power cut / no turn-out-of-wind on a growing roll past ~15 deg; (d) the 8 kt wind and gusts on the turn - wind 0
     is in the matrix, which says whether it is the wind's (section 2); (e) `flyLeg` should end a leg on the pilot's
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
