# DERELICT-HANGAR — ready note (branch `claude/derelict-hangar`, 9 Nov 2026)

Not landed. A0 lands it after the box gates. Source commits and "(built)" commits are separate.

## What the branch carries

- **DERELICT_GEN** (`tools/_derelict_gen.js`, in the build after `_hangar_gen.js`): the Annette Island WWII hangar,
  stages 0 derelict / 1 made safe / 2 roofed / 3 restored (= HANGAR 1). Three LODs, one material per bag (17 bags +
  the AO skirt), place-keyed randomness, calibrated albedo, the barriers, the wet-concrete puddles. The bench is
  `tools/_derelict.html`, the stills are from `tools/derelict_shot.js`, and the gate is GATE DERELICT
  (`tools/_derelict_check.js`, 108 checks).
- **The room**: hangar.js shell 'works' ('Large hangar', frame 'steel') stands stage 3's bags. Its parts:
  - the right gallery (5.5 m), the left facade (1 m);
  - the door 2.25 m off the axis (`door.z`, `hangarBay`);
  - the works garage's scenery placed as if the galleries were not there;
  - the five shadowed fittings, plus six unshadowed fill pendants (`lights.fill`);
  - the back leaves shut.
- **The world**: render_world's works exterior is DERELICT_GEN at the plot's stage, with its own materials per stage.
  HOME.2 is a `closedShed` at `closedStage: 0` (derelict until it is held). The club carries a HANGAR 2 board. The
  stand and the parking lane follow the door's line.
- **Storage**: the career's stored aeroplanes (residents) pack round a stand on the door's line. The rig is
  `tools/large_hangar_store_shot.js`, with evidence in `reports/evidence/DERELICT-HANGAR/store/`. With the Jodel on the
  stand and 8 inside slots, the floor takes 3 Cubs + 3 Jodels.

## Gates (this branch, 9 Nov)

- PASS: HANGAR, GAMEPREM (647), DERELICT, SITE, STORAGE, ECON, HOUSE, ASSETS, HANGARVIEW, TAXICLEAR, WORLDRENDER,
  DEFAULT, UISMOKE.
- PREMISES: PASS when run alone. In the batch, 3 rows failed on the terrainH timing (506 / 549 / 1054 ms against 500)
  while a browser rig loaded the box.

## Open: the user's review, relayed by A0 (in this order; details in HANDOVER.md, "DERELICT-HANGAR — A0's list")

1. **The DC-3 through the door.** The open leaves stack inside the 33.5 m opening, so the clear width is about 22 m.
   The fix needs a clear opening of at least 31-32 m and at least 6 m high, with `door.w` meaning the clear width, and
   a gate on the DC-3 taxiing in. This is a bug in what the branch claims today.
2. **Baked AO on a second UV set**, multiplied over the tiled materials, with one bake per state where the geometry
   differs.
3. **The real dimensions** of the Annette Island hangar, researched and combined with the user's own measurements.
4. **The HOME layout.** This hangar is the centrepiece and needs an apron and approach for a DC-3. Game owns the
   placement, and the vacant plot goes.
