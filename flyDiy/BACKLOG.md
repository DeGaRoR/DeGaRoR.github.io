# flyDiy backlog

Updated Mon 12 Oct 2026, 22:45 · master f09cf417f (trains up to 44, 47, 48). Source: D:/Dev/flydiy-notes/backlog.json (A0).

## This week
- This week: bug fixes only, no new features. Editor work is the one exception, and the user's own scenery work comes first.
- Credit mode until Sat 17 Oct 20:00: finish what is coded, pause the rest, scripted landings, short reports.
- Every long effort closes by Saturday with a landed train or a 'parked at' note.
- Next week the user has less time; the box is A0's.

## Priority order
1. Editor road network, editor usability and speed
2. Bugs and physics integrity
3. Release backlog: damage ON, career ON, performance, autopilot closure
4. Ground vehicles
5. New features (after this week)

## Tonight, Mon 12
- **Train 50**: Tree streaming G2930/G2935, grass strip colour G2570, FINISH-FIX G2750 (one paint repaints the whole aircraft, patterns kept), wing-engine lag G2880, every flight starts on the autopilot G3120 (A0 | 19:45-20:25 | P2 | armed)
- **SCENERY-SHIP G3010**: Your rev27: strip 12 (w7), roads r37/r38, pavement look, your own tree clearings on strips 10-12; SEA plot moved 13.5 m west; w5/w6/w7 contract fields; the 24.9 km island road r1; the runway tool returns to Select (no stacked strips) (SCENERY-ED-2 + A0 | run 20:28, land 21:00-21:30 | P1 | armed)
- **Typed number fields G3017**: A typed box beside all 101 scenery-inspector sliders; joins SCENERY-SHIP if the 19:20 browser look passes (SCENERY-ED-2 | look 19:20-19:40 | P1 | waiting)
- **DESIGN-TRUST G2640 confirmation**: The damage red looks like the check's own timing (end compare past the worker's 0.1 s window), not a physics split (DESIGN-TRUST, then Deform | 18:55-19:00 | P2 | armed)
- **CHARACTERS G2970**: Six passengers baked; GPU probe 18:25, master merge + gates 19:40 (CHARACTERS | 18:25 / 19:40 | P3 | running)
- **Autopilot T45 runs**: Torque bundle CPU and GPU passes (PILOT | 21:30-23:08 | P3 | armed)
- **Editor and livery runs**: EDITOR-UX-A CPU + GPU; LIVERY-PATTERNS CPU (rebased onto master after train 50) (EDITOR-UX-A, LIVERY | 22:40-23:55 | P1 | armed)

## Tuesday 13
- **41b damage layer lands**: +160 KB gz accepted by name; WIRE budget 4.19 MiB (Deform + A0 | 00:00-00:45 | P3 | armed)
- **Strict-gate baseline re-take, then the full battery**: The 3 Oct baseline is stale; every red of the battery becomes an owned task (A0 | 00:45 / 01:25 | P2 | armed)
- **Night measurement slots**: WATER-STEADY census 03:35, LIVERY GPU 04:15, GARAGE-SHEET ABBA 04:45, EDITOR-BUGS GPU 05:15, GEOM-FIXES 05:40, SIM-CLOCK bake 05:55, grass cost split 06:00, SIM-CLOCK timed 06:45 (each session | 03:35-07:00 | P2 | armed)
- **Runway editor speed G2960-G2964**: A strip edit keeps the plots and trees of zones it doesn't touch (~1.1 s to ~0.3 s), byte-identical compose proven (SCENERY-ED-2 | 07:00-07:45, lands ~08:00 | P1 | coded)
- **Trees cut only on the strip (RWYTREES-MAP)**: Default back to 'map' plus a small clearing by HOME's taxiways so the taxi check passes (SCENERY-ED-2 | 08:15-08:45 | P2 | booked)
- **Train 52**: 44.2 storage + map groups + baked cowl, SIM-CLOCK wait fix, FLEETB cowl, GARAGE-SHEET (if ABBA green), EDITOR-BUGS, CARDS-CORNER, MAP-EDGE, LIVERY-PATTERNS, GEOM-FIXES (if READY), editor items (typed x/z positions, pavement saturation), RWYTREES-MAP, DESIGN-TRUST (after its fix) (A0 | 09:50-10:30 | P1 | booked)
- **Damage-ON readiness measures**: Impact hitch under 100 ms, steady 30 on the laptop rung with damage on (Deform | 10:35-11:20 | P3 | booked)
- **Day slots**: WATER-STEADY CPU 11:25, CERT-SLIM 11:50, ASSETS-OCT KTX2 12:15, T45 lands 13:00, WATER-STEADY timed 13:50, EDITOR-PERF GPU 14:40, FLEETB INSTANT 15:20, Metlakatla on/off 22:00 (each session | 11:25-22:00 | P2 | booked)
- **BIOME-PAINT G3040**: Ground half of the biome fix; moved off Monday (BIOME-PAINT | slot to name | P1 | open)

## Rest of the week
- **Runway editor: taxiways G3090-G3099**: Taxiways become editable graph roads linked to the autopilot's taxi route (SCENERY-ED-2 | Wed 14 | P1 | booked)
- **Runway editor: profile G2965-G2969**: Absolute profile, two-point ends, banks follow the profile, overlap warning, altiport landing end. Redo the altiport here (keep one of w1/w4) (SCENERY-ED-2 | Thu 15 | P1 | booked)
- **Damage ON by default (train 45)**: After your play-test; needs the readiness measures and G3020 (Deform | Wed 14 | P3 | open)
- **Career ON by default (train 46)**: After the play-through; no longer waits for crew seats (GAME | Wed-Thu | P3 | open)

## Open bugs
- **Editor: grab a strip's derived things**: Clicking the club hangar footprint or the stand selects the strip and grabs that handle (c1); parked aircraft picked by their span, not 2.5 m (c3) (SCENERY-ED-1 | train 52 | P1 | booked)
- **Editor: runway plot handles**: Move / turn HOME's plots with their stand and taxi points (c2), re-cooks (SCENERY-ED-1 | train 53 | P1 | booked)
- **Scenery life around HOME is placed by rules**: People, cones, clutter, the lattice mast can't be dragged; 'life here' off/people only per entry today; baking into props later (c4) (after Saturday | P1 | open)
- **Taxiways editable (RUNWAY-ED TAXI)**: Taxiways as graph roads; the pilot's taxi route and the fleet tie-downs follow (fleet re-cook) (SCENERY-ED-2 | Wed 14 | P1 | booked)
- **Biome tab: trees slider dead past saturation**: Shows nominal density only; the count saturates at one tree a grid point (~680 at the gamer default); the clump (55 % bare in muskeg) and canopy floor have no rows. Fix: planted density label + '(full)', clump / clump size / canopy floor rows, max 6000 (TREE-STREAM | train 52 | P1 | booked)
- **HOME auxiliary hangars black at distance**: Their far LOD draws black instead of the mesh colour (WORKS-COZY | train 52 | P2 | open)
- **Grass cleared near lakes**: A few metres of bare ground at lake edges; grass should reach the waterline (GRASS-DENSE | train 52 | P2 | open)
- **Grass root gradient**: Tufts darkened at the root, fading to the tip (multiply), with strength + height dials; 0 = today (GRASS-DENSE | train 52 | P1 | booked)
- **World editor: added species gets no card**: '+ add from the catalogue' in the biome tab shows no section, so the species cannot be set (TREE-STREAM | train 52 | P1 | booked)
- **Slider limits too tight**: World editor (e.g. lightness at 3, slider max 2) and scenery inspector: no slider caps below a value in use; typed values may pass the slider's range, clamped to physical bounds only; world editor gets typed number fields on every slider and lower bounds at 0 (fireweed density too high at its minimum) (TREE-STREAM / SCENERY-ED-2 | train 52 | P1 | booked)
- **DESIGN-TRUST G2640 held from 43.1**: Mosquito level flight, swept fins, wing height, carbon boom, bench instability flag. The floats' shell now parts at the root at 0.15 s in a severe nose-in (tail comes off) (DESIGN-TRUST | train 52 | P2 | held)
- **Red on master already**: SKINMAT (marking reframe 1 of 3 wired), WEATHER (livery macro rows), BENCH (phase strip lacks ROUTE and LOITER from T44) (EDITOR-BUGS / PILOT | train 52 | P2 | open)
- **Page budget give-backs**: G3020 damage modules as a lazy chunk (~-50 KB gz), then G3021 the damage half of app.js; ROUTE-LAZY G3070 gives back T44's +30 KB (Deform / PILOT | before damage ON | P3 | open)
- **pilot-45 not green**: Six named reds in the torque bundle (PILOT | before T45 lands | P2 | open)
- **Damage-ON prerequisites**: Crash impact hitch (~0.6 s CPU), background certificate, gear sweep, the doubled 'BROKE UP' bar (Deform | Tue 10:35 | P3 | booked)
- **Gate: the Cub clears every strip**: Take-off and landing with slope, every strip; no capability filter in the game (GAME / PILOT | after Saturday | P2 | open)
- **Smaller owed items**: Metlakatla 80-97 ms approach frame, genAP Vy 1.38 vs POH 1.54 Vs, Jodel not airborne at Jumbo Mine, nacelle harness first-card gaps, FLEETB metal INSTANT slow row, TIMED rung row (session owners | after Saturday | P3 | open)
- **Branches with no master hit**: terrain-match-g2115, rollrec-fix, ground-look-g2610 seams, tour-real-g2065: verify or drop (A0 | this week | P3 | open)

## Waiting on you
- **HOME made editable: import rev27c**: D:/Dev/flydiy-notes/inbox/jolene_rev27c_home_editable.json = your rev27 + the 4 gravel shoulders + 02/20's fan as normal areas; move or delete them (removing the shoulders stops HOME's ~40 m tree cut) (you | after ~23:15 | P1 | waiting)
- **FRAMES rows: option 2 + bottom height (your pick)**: Height, waist width and bottom height per frame; the Cabin shows windscreen + cabin; the rest to Expert; saved builds unchanged (EDITOR-UX-A | tonight 22:40 or train 52 | P1 | booked)
- **Stacked altiports: keep the simpler profile**: SCENERY-ED-2 picks between w1 and w4 and writes a cleaned save for you to import (inbox/jolene_rev27b_one_altiport.json) (SCENERY-ED-2 | tonight, file only | P1 | booked)
- **Optional: HOME taxiway clearing**: If you draw the no-trees area yourself, SCENERY-ED-2 only flips the default (you | before Tue 08:15 | P2 | waiting)
- **Laptop recorder log**: Clouds from boot, boundingSphere throw (you | any time | P3 | waiting)

## Parked until after Saturday
- **STOL-WING G2820**: Slats, VGs, fences, cuffs, endplates, drooped tips. Ready, not landed (P5 | parked)
- **ENGINE-CONFIGS G2790**: Push-pull, 3-4 engines. Ready, not landed (P5 | parked)
- **AVIONICS-GPS G2800**: Electrics in 3D, GPS + minimap (P5 | parked)
- **Ground vehicles**: Spike on master; car MVP on the road graph (P4 | parked)
- **WATERFRONT G3030**: Breakwaters, docks, piers, boats; prototype green (P5 | parked)
- **CREW-SEATS G2715, MACHINE-SHOP G2720, ALTIPORT-ROLLOUT**: Paused or stopped by you (P5 | parked)
- **Approach editing per strip**: Circuit side, pattern altitude, final (P1 | parked)
- **Shelved or cancelled**: DESIGN-DIGEST (shelved), COWL-FIT (cancelled), PRE-EXPOSURE, DMG-POLES (P5 | parked)

## Closed today
- **Train 47 road network, train 48 placer speed, train 44 autopilot + rivers off**: Live on Pages (A0 | 08:35 / 13:21 / 13:52 | P1 | done)
- **Stacked runways**: Cause found: the runway tool stayed armed. Fix rides SCENERY-SHIP; no code path adds a strip by itself (SCENERY-ED-2 | P1 | done)
- **Old damage side branches**: rebless, waterdamp, treecrash folded into 41b; deletable (Deform | P2 | done)
- **Pavement saturation and typed positions**: Coded, ride train 52 (SCENERY-ED-2 | P1 | done)
