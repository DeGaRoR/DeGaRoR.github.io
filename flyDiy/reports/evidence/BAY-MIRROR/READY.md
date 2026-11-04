# READY - claude/ready/bay-mirror (BAY-MIRROR, 3 Nov 2026, cloud: node gates + SwiftShader stills)

Base: origin/master 05f95aa7 (train L30d built; rebased from adb2d2a9 - only HANDOVER.md overlapped, the append re-applied as bytes). The stills and the master comparisons were taken on adb2d2a9; the gate set below was re-run on the rebased tree. No built files committed (index.html, dev.html, sw.js, version.json,
tools/flight_core.js come from `node flyDiy/tools/build.js` on the train).

## What it does
The sheltered sea bays calm toward a lake: a shelter field from the coastline (the wind's fetch, 16 headings, 100 m cells)
scales the sea's waves by `waveK = 0.25 + 0.75 x calm` - in `waterH` (the floats, the hull, the spray, the buoys) and, from
the same bytes and dial, in the water shader (the near patch's lift, the swell's slopes, the ripple tile toward the lake's,
the whitecaps). Over a bay the AUTO mirror ring takes the lake's weight rule (no second capture, the same plane). Open water
is calm 1: the open sea is the same doubles and the same pixels. Details, cause and numbers: README.md beside this file.

## A0's ruling (3 Nov ~22:00) applied
"A sheltered bay should be CALMER, not dead glassy whatever the wind": the bay keeps 0.25 of the open sea's waves (JONSWAP
height ~ sqrt(fetch)); the amplitude is the wind's, so it is glassy only in calm air (GATE WATER 7: the SEA base keeps
0.026 m of ripple at a 5 m/s sea, 0 with no wind).

## The remaining differences, with the numbers
- **Take-off at the SEA base** (the game's own seaplane base lies in the south fjord: calm 0, waveK 0.25), the floats
  Cessna, 1017 kg, `hydro_trim_table.js --world jolene --at SEA --sea A,L,dir`, master core vs this branch's:
  5 m/s sea: rig 26.9 s / 458 m -> 26.6 s / 455 m, POH 21.7 s / 292 m -> 21.4 s / 291 m;
  8 m/s sea: rig 27.3 s / 456 m -> 26.7 s / 457 m, POH 23.1 s / 310 m -> 21.5 s / 293 m (the one difference past a few
  metres: 17 m shorter on the calmer bay); calm air: identical. The floats unstick the same.
- **DESTTO**: red on this branch AND on clean master adb2d2a9 with the same row and the same event times (ltd:floats' leg 2
  gives up its roll-out at mk_sea after 811 s; pivot 122.3 s, Vx climb 352.9 s). The gate's island has no sea state (A 0),
  so `waterH` returns before the shelter is read: this change cannot reach it. mk_sea itself is open water (calm 1).
- The other reds, all red on clean master with the same rows: TOUR (the aluminium C172's ground-loop at tw_ski), VEHICLE
  (DEF / AIRBORNE), LAKEBED (02/20's pond rows 2-3), WORLD (13/31 island approaches), ASSETS (material counts in files not
  touched here), PARKED (node heap out of memory, also seen by NEW-PLANE's session on master).
- **Re-gated on L30d** (05f95aa7 + this branch): WATER, GFX, FLOATS, SEAPLANE, HYDRODYN, UISMOKE, UISMOKE-PHONE, SIMWORKER,
  WETFX, WIPLINE, WORLDRENDER, UILAYER, SHADOWSKY, CLIMATE, HYDRO, SITE: PASS. MEDIA: FAIL - "index.html is 5.03 MiB gzipped
  against a declared 5 MiB budget", the same row on clean L30d (master's own build is 5.0142 MiB gzipped; this branch adds
  4.7 KB, 5.0187 MiB).
- The water program: one more sampler of its own (uWCalm) - 8 -> 9 texture units with the hull's reflection, counted off
  the linked GL program on SwiftShader; GATE WATER's sampler row now names five.
- The look (stills): the south bay's ripple ridges -31 % (to the lake's level), Port Chester -22 %, the bay from 300 m -11 %
  with the mirror's weight 0.35 -> 0.52; the lake and the open sea unchanged to JPEG noise.
