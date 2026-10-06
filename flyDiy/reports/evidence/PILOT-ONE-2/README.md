# PILOT-ONE-2 evidence (G1949, 2026-10-06)

Master = train 36 (origin/master 1ae2eebb, MILL-TAXI in); after = claude/pilot-one-2-g1949 (PILOT-ONE @5d294064 rebased,
the built commit dropped, + G1949). "before" = PILOT-ONE as A0 held it (536d5b16 / 4e54fa90) on the same world.
Node only, a 4-core cloud box. The probes run from `flyDiy/tools` (or take `CORE=<flight_core.js>`).

## East Point (GATE RWYTREES 8's flight) - `ep_trace.js <flyDiy> cub nv_strip 800`
The user's Cub (the archetype `cub` builds to the same nodes and ap as builds/cub_2026-09-20_corrected.json) off East
Point's stand, its circuit, the 'map' trees, every node against every tree cylinder every 6th step.
- `cub_eastpoint_map_master.txt`: 'completed', touched ~98 m in, stopped ~84 m past the end (s -256 against the end at
  -340): off the strip, unsaid.
- `cub_eastpoint_map_before.txt`: round twice (floating, 120 m left for a 130 m stop), diverted to Tamgas Hill - still
  INBOUND at 800 s (the gate's FAIL).
- `cub_eastpoint_map_after.txt`: round once (120 m for 128), the second arrival aimed 17 m earlier; touched 28 m in at
  0.86 m/s, stopped with 11 m of strip left at 554 s; no tree contact.

## The turn on the spot - `tools/pilot_one_turnaround.js` (stopped 20 m from a short strip's far end, nose to it)
- `turnaround_nv_after.txt`: East Point - the Cub and the Jodel pivot as PILOT-ONE had them; THE C172 (a tricycle,
  owed by G1938) now sets its turn up at the edge and turns on the strip: 4.5 m off the centreline at most (base 9.1),
  never off the strip, the roll at 33 s (rejected - 150 m for its 313 m run, as on base).
- `turnaround_mn_after.txt`: Jumbo Mine - every build flies MILL-TAXI's authored teardrop (base numbers).
- `trike_turn_probe.js` / `trike_turn_gravel_probe.js`: the C172's turn, full rudder + the inside toe brake, by
  throttle: 180 deg with the CG moving 4.3 m on the flat, ~7-8 m on East Point's gravel at any throttle.

## ISLAND-TOUR's legs (their branch claude/island-tour-g1965 merged with this one; `node tools/island_tour.js --build cub`)
- `islandtour_twski_mn_w2_before.txt` (`--order tw_ski,mn_strip,w2`): the chained leg mn_strip > w2 pivoted at the
  teardrop's entry, resumed on its far lobe 11 m west, crashed into mn_s_mine/clinic 48 s in.
  `..._after.txt`: pivot on the centreline (2.8 m at most), resumed on the return, airborne - TOUR DONE.
- `islandtour_w3_twski_before.txt` (`--order w3,w3,tw_ski`): 1390 s (a circuit join whose downwind start was orbited
  for 420 s, gave-up, a go-around). `..._after.txt`: straight in, 484 s (today's pilot: 480).

## The FLEX settle - `flail_probe.js <material>` (GEN_DEFAULT with that fuselage material, the straight downwind, 10 s)
- `flex_gain_probes.txt`: the 6061 tube + Dacron (aluTube) cruise as tuned (de p2p 0.585, pitch 6.5 deg, ~2.3 Hz)
  and under the gain probes (AP={...} overrides); the last line is G1949's detector: 0.004 / 0.09 deg.

## The land take-offs - `tools/pilot_one_trace.js --only=cub,jodel,c172 --csv`
- `takeoff_land_master.txt` / `takeoff_land_after.txt`: identical; the 10 Hz CSVs byte-identical (not kept).

## Jumbo Mine replay - `mn_pivot_replay.js <flyDiy> -1 68` (the Cub stopped 68 m short of the south end, departFrom
with the site). `cub_mn_south_teardrop_master.txt` / `_after.txt`: identical - both end in mn_s_mine/shop's pallets 17 m
off with a taxi timeout from this synthetic standing start (the teardrop / follower's, not the pilot change's).
