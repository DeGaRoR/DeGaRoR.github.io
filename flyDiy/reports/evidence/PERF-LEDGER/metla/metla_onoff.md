# METLA-ONOFF - Metlakatla OFF (A, ?town=0) vs ON (B, ?town=1), ABBA

The box's default preset (GFX.get() kept per run). garage = navigation -> garage (s, warm profile), boot worst = the worst main-thread task before it, roll-out = Roll out -> flight (s); loop = the frame's JS work, render = renderer.render() CPU (ms), draws a frame (shadows in); memory = Chrome's whole process tree (peak private / working set, MB) and the JS heap at the end; closest = the nearest the aeroplane came to the Metlakatla seaplane base (m); NEAR = every frame within 1500 m of it (s spent, loop, render, draws, frame p99 / worst, the worst task).


## READ THIS FIRST - what the runs could and could not see (14 Oct 13:30-14:08, master b0cbaf781 = train 54b, gamer, RTX 3080)

- NO RUN REACHED THE TOWN. The floats' route to the Metlakatla seaplane base (mk_sea) was refitted to a CIRCUIT on every run,
  town on or off (start.route.to = CIRCUIT; a routing bug for the Pilot: app.js routeFitted / stripAllows on a water To). Every run
  flew the SAME SEA-lane circuit; the closest approach to the town was 3.9 km. So this is Metlakatla ON vs OFF SEEN FROM ~4 km,
  not the first close-up visit: the near tier never triggered (the NEAR window is empty). A close-up baseline needs a working
  route to mk_sea (or a manual leg) - a later slot.
- The sides: A1 = ?town=0 (today's default: the true OFF); A3 / A4 = ?town=1 with Metlakatla's 233 premises records filtered out
  (rollout_perf --variant nomet-sea: the town's loader variant kept, its premises gone); B2 / B5 = ?town=1 (ON). Order A1 B2 A3 A4 B5.
- Flags: the rig sets no graphics flag; GFX.get() = the gamer default (water 'simple': no foam by design; mirror auto; shadows full;
  30 fps cap). The physics worker was live.

## THE FRAME, ON THE CIRCUIT (frames 1.5-6 km from the town; medians, ms / counts)

| | loop | render | of it: shadow | worldUpdate | draws | triangles |
| --- | --- | --- | --- | --- | --- | --- |
| OFF (A1, ?town=0) | 16.5 | 8.8 | 0.7 | 5.4 | 417 | 15.6 M |
| town variant, Metlakatla's premises out (A3, A4) | 20.9 | 12.2 | 0.8 | 5.7 | 904 | 18.4 M |
| ON (B2, B5) | 28.6 | 15.7 | 1.2 | 8.7 | 923 | 21.0 M |
| **ON - OFF** | **+12.1** | **+6.9** | +0.5 | **+3.3** | +506 | +5.4 M |

At 28.6 ms of loop against a 33.3 ms frame the cap can no longer hold: 13.8 % of frames miss 30 fps (OFF: 2.0 %), p95 33.5 -> 66.8 ms,
p99 61 -> 100 ms (the evenness table above). Of the +12 ms: ~+4 ms come with the town's loader variant itself (A1 -> A3/A4: +487 draws
- the ground/raster cells and far bakes the 'town' variant loads), ~+8 ms with Metlakatla's premises (A3/A4 -> B: render +3.5, world +3.0).

## WHERE IT GOES (the census at the end of the runs, the aircraft on the water 3.9 km from the town)

- **premises:lots - the house plots: 0.8 M -> 8.9 M triangles (+8.1 M), 35 -> 126 draws, geometry 53 -> 549 MB (+496 MB), of it
  86 k triangles in view.** The biggest single item by far, almost all of it off-screen or sub-pixel at 4 km.
- premises:roads +0.9 M triangles, +53 draws, +33 MB; premises:townkit +0.64 M triangles in 2 draws - all shadow casters, none in view;
  premises:patch +0.44 M.
- The houses themselves are NOT the cost at this range: 524 vs 79 houses, but drawn as the far bake (bakeDraws 48 -> 72, farTris
  223 k -> 426 k); the near tiers hold a few thousand triangles. The shadow pass: +0.5 ms.
- Memory: JS heap 3.2 -> 4.8-5.6 GB (+1.5-2.3 GB), Chrome's peak private 13.6 -> 16.3 GB (+2.7 GB): the lots' and roads' geometry
  kept on the CPU after upload is the visible part (+0.53 GB of attribute arrays).
- The load: navigation -> garage +3.4 s (the 'world' step +4.5 s), the boot's worst task 1.0 -> 2.0 s; the roll-out unchanged.

## THE THREE BIGGEST LEVERS (far gets simpler, close-up detail kept - the user's line)

1. **THE LOTS BY DISTANCE.** Metlakatla's plots are 8.9 M triangles and 0.5 GB drawn at full detail from 4 km. Give the lots the
   houses' treatment: full detail near (the close-up unchanged), past ~300 m bake them into the ground patch / a per-cell merged
   low version (as houses:far / hlod do for the buildings), and cull what the camera cannot see. The bulk of +8 M triangles,
   +91 draws, ~0.5 GB of geometry - most of the ON render cost on the approach.
2. **THE TOWN'S PER-FRAME JS (worldUpdate +3.0 ms).** 524 houses' and their lots' per-frame work in the world update (the LOD /
   merge checks, the stream bookkeeping) costs as much as the whole OFF world. Update the town per cell, when the eye has moved,
   and only the cells near the eye each frame. The next profile (a CPU profile on the circuit with the town on) names the function.
3. **THE MEMORY: free the CPU copies of static town geometry after upload** (lots, roads, the town kit, the patch: they never
   change after the build) and do not shadow-cast what is far (the town kit's 644 k triangles cast shadows at 4 km, none in view).
   Targets the +1.5-2.3 GB JS heap / +2.7 GB private and part of the +4.5 s 'world' load step.

Smaller: the town loader variant's own +4 ms / +487 draws (A1 vs A3/A4) - worth a look once the three above land.

## FRAME EVENNESS - OFF vs ON (the floats leg; NEAR = within 1500 m of the Metlakatla seaplane base, APPROACH = 1500 m - 6 km, ALL = every frame after the reveal)

A frame over 34 ms is a missed 30-fps frame; "longest below 30" = the longest unbroken stretch of such frames (s).

| run | window | frames | > 34 ms % | > 50 ms % | > 100 ms % | p95 | p99 | worst | longest below 30 (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| metla_1_A (OFF) | near | 0 | - | - | - | - | - | - | - |
| metla_1_A (OFF) | approach | 3511 | 1.6 | 1.1 | 0.03 | 33.5 | 50.1 | 100 | 0.13 |
| metla_1_A (OFF) | all | 9919 | 1.3 | 0.9 | 0.05 | 33.4 | 50.0 | 183 | 0.18 |
| metla_2_B (ON) | near | 0 | - | - | - | - | - | - | - |
| metla_2_B (ON) | approach | 3136 | 13.9 | 9.2 | 1.05 | 66.8 | 100 | 167 | 0.38 |
| metla_2_B (ON) | all | 9011 | 11.2 | 7.4 | 0.95 | 66.7 | 100 | 317 | 0.38 |
| metla_3_A (OFF) | near | 0 | - | - | - | - | - | - | - |
| metla_3_A (OFF) | approach | 3499 | 2.0 | 1.5 | 0.09 | 33.5 | 66.6 | 134 | 0.13 |
| metla_3_A (OFF) | all | 9908 | 1.5 | 1.1 | 0.07 | 33.5 | 50.1 | 184 | 0.18 |
| metla_4_A (OFF) | near | 0 | - | - | - | - | - | - | - |
| metla_4_A (OFF) | approach | 3494 | 2.3 | 1.7 | 0.11 | 33.5 | 66.6 | 117 | 0.15 |
| metla_4_A (OFF) | all | 9907 | 1.6 | 1.1 | 0.08 | 33.5 | 50.1 | 183 | 0.18 |
| metla_5_B (ON) | near | 0 | - | - | - | - | - | - | - |
| metla_5_B (ON) | approach | 3133 | 13.6 | 8.8 | 1.02 | 66.8 | 100 | 167 | 0.42 |
| metla_5_B (ON) | all | 9015 | 10.5 | 7.1 | 0.99 | 66.7 | 100 | 317 | 0.42 |
| **mean OFF** | approach | 3501 | 2.0 | 1.4 | 0.08 | 33.5 | 61.1 | 134 | 0.15 |
| **mean OFF** | all | 9911 | 1.5 | 1.0 | 0.07 | 33.5 | 50.1 | 184 | 0.18 |
| **mean ON** | approach | 3135 | 13.8 | 9.0 | 1.04 | 66.8 | 100 | 167 | 0.42 |
| **mean ON** | all | 9013 | 10.8 | 7.3 | 0.97 | 66.7 | 100 | 317 | 0.42 |

### The landings (pilot phases and water phases, s after the reveal) - for the Pilot

- metla_1_A (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.9 CROSSWIND@45.5 DOWNWIND@85.0 BASE@121.4 FINAL@148.6 FLARE@244.8 ROLLOUT@247.3 STOPPED@276.5 | water to-displace@0.0 to-step@2.3 climb@18.8 circuit@45.5 flare@244.8 ldg-step@246.9 circuit@248.5 ldg-step@248.9 circuit@252.4 ldg-step@253.0 circuit@254.5 ldg-step@255.0 ldg-displace@256.5 ldg-step@257.4 ldg-displace@257.9 ldg-step@258.2 ldg-displace@258.5 ldg-step@259.1 ldg-displace@259.4 ldg-step@259.9 ldg-displace@260.1 ldg-step@260.8 ldg-displace@261.0 ldg-afloat@274.4 ...
- metla_2_B (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.9 CROSSWIND@45.5 DOWNWIND@85.1 BASE@121.4 FINAL@148.6 FLARE@244.8 ROLLOUT@247.3 STOPPED@277.2 | water to-displace@0.0 to-step@2.2 climb@18.8 circuit@45.5 flare@244.8 ldg-step@246.8 circuit@248.4 ldg-step@248.9 circuit@252.3 ldg-step@253.1 circuit@254.5 ldg-step@255.1 ldg-displace@256.5 ldg-step@257.4 ldg-displace@258.0 ldg-step@258.3 ldg-displace@258.6 ldg-step@259.1 ldg-displace@259.4 ldg-step@261.7 ldg-displace@261.9 ldg-step@274.7 ldg-afloat@274.9 ldg-step@314.1 ...
- metla_3_A (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.9 CROSSWIND@45.5 DOWNWIND@85.0 BASE@121.3 FINAL@148.5 FLARE@244.6 ROLLOUT@247.1 STOPPED@277.4 | water to-displace@0.0 to-step@2.2 climb@18.8 circuit@45.5 flare@244.6 ldg-step@246.7 circuit@248.3 ldg-step@248.7 circuit@252.3 ldg-step@253.3 circuit@254.6 ldg-step@255.1 ldg-displace@256.5 ldg-step@257.6 ldg-displace@258.1 ldg-step@258.4 ldg-displace@258.7 ldg-step@259.3 ldg-displace@259.6 ldg-step@262.5 ldg-displace@262.6 ldg-step@264.9 ldg-displace@265.1 ldg-step@274.9 ...
- metla_4_A (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.9 CROSSWIND@45.5 DOWNWIND@85.1 BASE@121.3 FINAL@148.5 FLARE@244.6 ROLLOUT@247.1 STOPPED@275.6 | water to-displace@0.0 to-step@2.3 climb@18.9 circuit@45.5 flare@244.6 ldg-step@246.7 circuit@248.3 ldg-step@248.7 circuit@250.5 ldg-step@250.7 circuit@252.2 ldg-step@253.4 circuit@254.6 ldg-step@255.1 ldg-displace@256.5 ldg-step@257.6 ldg-displace@258.1 ldg-step@258.4 ldg-displace@258.6 ldg-step@259.2 ldg-displace@259.6 ldg-step@260.2 ldg-displace@260.3 ldg-step@261.8 ...
- metla_5_B (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.9 CROSSWIND@45.4 DOWNWIND@85.1 BASE@121.2 FINAL@148.5 FLARE@244.5 ROLLOUT@247.0 STOPPED@275.5 | water to-displace@0.0 to-step@2.2 climb@18.8 circuit@45.4 flare@244.5 ldg-step@246.5 circuit@248.2 ldg-step@248.6 circuit@250.4 ldg-step@250.6 circuit@252.1 ldg-step@253.3 circuit@254.5 ldg-step@254.9 ldg-displace@256.4 ldg-step@257.5 ldg-displace@258.0 ldg-step@258.3 ldg-displace@258.5 ldg-step@259.1 ldg-displace@259.5 ldg-step@260.1 ldg-displace@260.2 ldg-step@261.7 ...

(The frame rows carry no attitude: a flip is read from the phases - a FLARE / ROLLOUT that goes back to circuit is a skip; STOPPED with the water phase flickering is the float at rest.)

## THE FLOATS LEG - the Cessna on floats from the SEA lane, 330 s (the route each run flew: see the landings; distances to the Metlakatla seaplane base)

| run | garage | bootWorst | rollout | nearS | nearLoop | nearRender | nearDraws | nearP99 | nearWorstDt | afterWorst | privMB | wsMB | heapMB | houses | closest | town |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| metla_1_A | 62.8 | 880 | 3.1 | 0.0 | - | - | - | - | - | 657 | 13507 | 10062 | 3282 | 79.0 | 3922 | false |
| metla_2_B | 69.6 | 2039 | 3.1 | 0.0 | - | - | - | - | - | 581 | 16357 | 12326 | 5565 | 524 | 3922 | true |
| metla_3_A | 75.0 | 1253 | 3.1 | 0.0 | - | - | - | - | - | 626 | 13756 | 10085 | 3207 | 79.0 | 3922 | true |
| metla_4_A | 71.1 | 948 | 3.1 | 0.0 | - | - | - | - | - | 658 | 13650 | 10057 | 3211 | 79.0 | 3922 | true |
| metla_5_B | 76.5 | 2034 | 3.1 | 0.0 | - | - | - | - | - | 562 | 16312 | 12295 | 4798 | 524 | 3921 | true |
| **A off** | 69.6 | 1027 | 3.1 | 0.0 | - | - | - | - | - | 647 | 13638 | 10068 | 3233 | 79.0 | 3922 | |
| **B on** | 73.1 | 2037 | 3.1 | 0.0 | - | - | - | - | - | 572 | 16335 | 12311 | 5182 | 524 | 3922 | |
| **B - A** | +3.4 | +1010 | +0.0 | 0.0 | - | - | - | - | - | -75.5 | +2697 | +2243 | +1948 | +445 | -0.0 | |

## THE BREAKDOWN - where Metlakatla ON goes (the floats runs: the frame over the town, the load, what the scene holds at the end)

### The frame over the town (NEAR window medians, ms / counts)

| | loop | render | of it: shadow pass | worldUpdate | premises stream | draws | triangles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A off | - | - | - | - | - | - | - |
| B on | - | - | - | - | - | - | - |
| B - A | - | - | - | - | - | - | - |

### The load (the garage boot's steps, ms; the ten largest moves)

| step | A off | B on | B - A |
| --- | --- | --- | --- |
| world | 24443 | 28949 | +4506 |
| worldCompile | 5301 | 3985 | -1317 |
| settle | 17558 | 16707 | -851 |
| compile | 1286 | 1716 | +430 |
| frames | 1623 | 1304 | -320 |
| bake | 1372 | 1209 | -163 |
| craft | 514 | 649 | +135 |
| firstFrame | 433 | 311 | -123 |
| upload | 2441 | 2345 | -96.8 |
| snapshot | 611 | 676 | +64.8 |

### What the scene holds at the end (over the town), by class - the visible meshes (draws), their triangles, in the camera's view, as shadow casters, geometry / texture MB; mk = Metlakatla's own

| class | draws off -> on (Δ) | tris off -> on (Δ) | in view (on) | shadow casters (on: draws / tris) | geometry MB (Δ) | textures MB (on) | mk tris (on) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| premises:lots | 35 -> 126 (+91) | 825 k -> 8.88 M (+8.06 M) | 86 k | 0 / 0 | 549 (+496) | 7.0 | 49 k |
| premises:roads | 72 -> 125 (+53) | 3.67 M -> 4.54 M (+875 k) | 4.01 M | 38 / 15 k | 180 (+32.9) | 0.0 | 0 |
| premises:townkit | 0 -> 2 (+2) | 0 -> 644 k (+644 k) | 0 | 2 / 644 k | 41.2 (+41.2) | 0.0 | 0 |
| premises:patch | 97 -> 106 (+9) | 834 k -> 1.27 M (+437 k) | 157 k | 0 / 0 | 0.0 (0.0) | 0.0 | 0 |
| rail:mk_r_graveyard:0 | 0 -> 1 (+1) | 0 -> 21 k (+21 k) | 0 | 1 / 21 k | 2.3 (+2.3) | 0.0 | 21 k |
| premises:animals | 15 -> 17 (+2) | 2430 -> 8574 (+6144) | 8574 | 16 / 5502 | 0.1 (+0.1) | 0.0 | 0 |
| rail:mk_r_graveyard:1 | 0 -> 1 (+1) | 0 -> 4806 (+4806) | 0 | 1 / 4806 | 0.5 (+0.5) | 0.0 | 4806 |
| rail:mk_r_walden:0 | 0 -> 1 (+1) | 0 -> 4692 (+4692) | 0 | 1 / 4692 | 0.5 (+0.5) | 0.0 | 4692 |
| rail:mk_r_breakwater:0 | 0 -> 1 (+1) | 0 -> 4156 (+4156) | 0 | 1 / 4156 | 0.4 (+0.4) | 0.0 | 4156 |
| scene:Mesh | 381 -> 395 (+14) | 7.11 M -> 7.10 M (-2907) | 4.06 M | 282 / 1.31 M | 67.2 (-12.7) | 48.5 | 0 |
| rail:mk_sc35:0 | 0 -> 1 (+1) | 0 -> 2626 (+2626) | 0 | 1 / 2626 | 0.3 (+0.3) | 0.0 | 2626 |
| rail:r3:2 | 1 -> 1 (0) | 3928 -> 2042 (-1886) | 0 | 1 / 2042 | 0.2 (-0.2) | 0.0 | 0 |
| rail:mk_r_walden:1 | 0 -> 1 (+1) | 0 -> 1762 (+1762) | 0 | 1 / 1762 | 0.2 (+0.2) | 0.0 | 1762 |
| rail:mk_r_walden:2 | 0 -> 1 (+1) | 0 -> 1306 (+1306) | 0 | 1 / 1306 | 0.1 (+0.1) | 0.0 | 1306 |
| poles:r9:cable0 | 1 -> 1 (+0) | 2608 -> 3912 (+1304) | 0 | 0 / 0 | 0.1 (+0.0) | 0.0 | 0 |
| rail:mk_sa20:0 | 0 -> 1 (+1) | 0 -> 1192 (+1192) | 0 | 1 / 1192 | 0.1 (+0.1) | 0.0 | 1192 |
| rail:mk_r_skaters:1 | 0 -> 1 (+1) | 0 -> 1192 (+1192) | 0 | 1 / 1192 | 0.1 (+0.1) | 0.0 | 1192 |
| rail:mk_r_walden:3 | 0 -> 1 (+1) | 0 -> 1078 (+1078) | 0 | 1 / 1078 | 0.1 (+0.1) | 0.0 | 1078 |
| **all** | 1232 -> 1479 (+247) | 16.62 M -> 26.68 M (+10.06 M) | 11.36 M | 634 / 5.31 M | 1014 (+565) | 364 | 98 k |

### The three biggest levers

(see THE THREE BIGGEST LEVERS at the top)

**ON costs - ms loop / - ms render a frame over the town (draws -, frame p99 - -> - ms, worst frame - -> - ms); +3.4 s to the garage, +0.0 s roll-out; +2697 MB peak private (+1948 MB JS heap).**
