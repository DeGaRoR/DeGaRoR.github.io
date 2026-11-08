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

STATUS: in progress. Sections 1 done; 2-4 filling as flights finish.

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
