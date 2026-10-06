# PILOT-ONE-2 evidence (G1949, 2026-10-06)

Master = train 35 (origin/master e9e14880) + MILL-TAXI (origin/claude/mill-taxi-g1925 618484a9) with master's pilot;
before = the same + PILOT-ONE as it stood (536d5b16, the built commit dropped); after = + G1949. Node only, 4-core box.

- `cub_eastpoint_map_*.txt` (`ep_trace.js <flyDiy> cub nv_strip 800`, GATE RWYTREES 8's flight: the user's Cub - the
  archetype `cub` builds to the same nodes and ap as builds/cub_2026-09-20_corrected.json - off East Point's stand,
  its circuit, 'map' trees, every node against every tree cylinder):
  master 'completed' touching ~98 m in and stopping ~84 m past the end (s -256 against the end at -340; off the strip, unsaid);
  before: round twice (floating, 120 m left for 130), diverted to Tamgas Hill - still INBOUND at 800 s (the gate's FAIL);
  after: round once (120 m for 128), the second arrival aimed 17 m earlier, touched 28 m in at 0.86 m/s, stopped with
  11 m of strip left at 554 s, no tree contact.
- `cub_mn_south_teardrop_*.txt` (`mn_pivot_replay.js <flyDiy> -1 68`: the Cub stopped 68 m short of Jumbo Mine
  Street's south end, nose to it, departFrom(mn_strip, w2), the cooked obstacles in the world - ISLAND-TOUR's case).
  Before (not kept, the run's numbers): the pivot inside MILL-TAXI's teardrop 4.4 m off the centreline, the wing
  -0.01 m to mn_s_mine/clinic, 18 node contacts, stuck 6 m off until the taxi timed out. After = master to the digit
  (both end in mn_s_mine/shop's pallets 17 m off with a taxi timeout from this synthetic standing start - the
  teardrop / follower's, not the pilot change's).
- `turnaround_*_after.txt` (tools/pilot_one_turnaround.js): East Point - the Cub pivots on the centreline, airborne;
  Jumbo Mine - every build flies MILL-TAXI's teardrop on the wheels (the base's numbers).
- `takeoff_land_*.txt` (tools/pilot_one_trace.js --only=cub,jodel,c172 --csv): the land take-offs, master vs after:
  the summaries and the 10 Hz CSVs byte-identical.
