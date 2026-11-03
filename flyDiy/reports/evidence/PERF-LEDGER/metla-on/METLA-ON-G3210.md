# G3210 METLA-ON lever 1 - the plots never reach the far frame (14 Oct 2026)

Branch claude/metla-on-g3210 (rebased on train 56 e21d9c7fc). The A/B ran on the branch built on 54b b0cbaf781 (the code
is unchanged by the rebase; the LIFTS regions are identical to both masters).
- **Metlakatla bare** (the user's call): an mk_ plot's fence and yard (lot ground, slab, the cars in it), an mk_ site's fences and
  an mk_ road's guardrail are taken down at buildOne0 the teardown's way; houses, outbuildings, roads and the town kit kept;
  the generation untouched (the cook's tallies hold). ?metlabare=0 the A/B.
- **The lots near-only everywhere:** a lot cell's merged meshes are drawn within 600 m of the eye (render_world, every 10 frames).
  ?lotnear=0 the A/B.

## Results

- **Gates** (20:05-20:16, a fresh parked cook): FRAMECOST, BUILD, PREMISES, PREMRASTER, PREMCOOK, TARR, LIFE, STAGES - PASS.
- **metla_bare_check** (the page in node, the town on, Metlakatla built round its median plot): PASS - lots held 21.7 M tris /
  1 040 MB kept -> 1.9 M / 108 MB bare (the home lots only), mk_ yards 378 -> 0, houses 491 = 491, obstacles 1 574 -> 1 157 (the yard
  cars), no page error.
- **The A/B** (floats, SEA circuit 3.9 km from the town - the floats still cannot route to mk_sea; 21:00-21:17 A B, 22:00-22:15 B A):

| ON - OFF on the approach (1.5-6 km) | before (14 Oct 13:30, b0cbaf781) | after G3210 |
| --- | --- | --- |
| loop / render / worldUpdate (ms) | +12.1 / +6.9 / +3.3 | **+5.8 / +1.8 / +3.0** |
| draws / triangles | +506 / +5.4 M | **+22 / +0.6 M** |
| lots held (all meshes, drawn or not) | 549 MB ON (census of the drawn) | **110 MB, the same OFF and ON** (266 of 324 meshes hidden: near-only) |
| JS heap at the end | +1.5-2.3 GB | **+0.8 GB** |
| Chrome peak private | 13.6 -> 16.3 GB | 13.4 -> 15.1 GB |
| frames over 34 ms (OFF 2.0 %) | 13.8 % | **10.4 %** |
| frames over 100 ms (OFF 0.04 %) | 1.04 % | 0.68 % (worst 217 ms) |
| p95 / p99 (OFF 33.5 / 66.7) | 66.8 / 100 ms | 66.7 / 91.8 ms |
| garage load (the 'world' step) | +3.4 s (+4.5 s) | +7.7 s (+4.1 s) - the OFF side was 6 s faster tonight; the town's world step is unchanged |

**Verdict: lever 1 did what it targets - the lots are gone from the far frame and from memory (-5.4 M triangles, -484 draws, the
lots' 549 MB down to the home lots' 110 MB, -0.7 to -1.5 GB heap) - but Metlakatla ON is not yet even: ~+6 ms of loop remains
(worldUpdate +3.0 ms, render +1.8 ms), 10 % of frames miss 30 fps and 0.7 % exceed 100 ms. The ON-default flip is NOT applied**
(prepared: gfx pv 10 + the loader). Next: lever 2 (the town's per-frame JS, +3 ms) and the town loader variant's own cost, then a
close visit once the floats can route to mk_sea (a Pilot bug).
# METLA-ONOFF - Metlakatla OFF (A, ?town=0) vs ON (B, ?town=1), ABBA

The box's default preset (GFX.get() kept per run). garage = navigation -> garage (s, warm profile), boot worst = the worst main-thread task before it, roll-out = Roll out -> flight (s); loop = the frame's JS work, render = renderer.render() CPU (ms), draws a frame (shadows in); memory = Chrome's whole process tree (peak private / working set, MB) and the JS heap at the end; closest = the nearest the aeroplane came to the Metlakatla seaplane base (m); NEAR = every frame within 1500 m of it (s spent, loop, render, draws, frame p99 / worst, the worst task).

## FRAME EVENNESS - OFF vs ON (the floats leg; NEAR = within 1500 m of the Metlakatla seaplane base, APPROACH = 1500 m - 6 km, ALL = every frame after the reveal)

A frame over 34 ms is a missed 30-fps frame; "longest below 30" = the longest unbroken stretch of such frames (s).

| run | window | frames | > 34 ms % | > 50 ms % | > 100 ms % | p95 | p99 | worst | longest below 30 (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| metla_1_A (OFF) | near | 0 | - | - | - | - | - | - | - |
| metla_1_A (OFF) | approach | 3506 | 2.1 | 1.3 | 0.06 | 33.5 | 66.7 | 100 | 0.15 |
| metla_1_A (OFF) | all | 9917 | 1.5 | 1.0 | 0.05 | 33.4 | 50.0 | 183 | 0.18 |
| metla_2_B (ON) | near | 0 | - | - | - | - | - | - | - |
| metla_2_B (ON) | approach | 3213 | 10.7 | 7.9 | 0.72 | 66.7 | 100 | 217 | 0.25 |
| metla_2_B (ON) | all | 9186 | 8.2 | 6.3 | 0.75 | 66.7 | 100 | 317 | 0.37 |
| metla_3_B (ON) | near | 0 | - | - | - | - | - | - | - |
| metla_3_B (ON) | approach | 3224 | 10.1 | 8.0 | 0.65 | 66.7 | 83.5 | 167 | 0.27 |
| metla_3_B (ON) | all | 9218 | 7.9 | 6.2 | 0.69 | 66.7 | 83.5 | 317 | 0.37 |
| metla_4_A (OFF) | near | 0 | - | - | - | - | - | - | - |
| metla_4_A (OFF) | approach | 3501 | 1.9 | 1.3 | 0.03 | 33.4 | 66.6 | 100 | 0.10 |
| metla_4_A (OFF) | all | 9908 | 1.4 | 1.0 | 0.05 | 33.4 | 50.0 | 217 | 0.22 |
| **mean OFF** | approach | 3504 | 2.0 | 1.3 | 0.04 | 33.5 | 66.7 | 100 | 0.15 |
| **mean OFF** | all | 9913 | 1.4 | 1.0 | 0.05 | 33.4 | 50.0 | 217 | 0.22 |
| **mean ON** | approach | 3219 | 10.4 | 8.0 | 0.68 | 66.7 | 91.8 | 217 | 0.27 |
| **mean ON** | all | 9202 | 8.0 | 6.3 | 0.72 | 66.7 | 91.8 | 317 | 0.37 |

### The landings (pilot phases and water phases, s after the reveal) - for the Pilot

- metla_1_A (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.8 CROSSWIND@45.5 DOWNWIND@85.0 BASE@121.4 FINAL@148.6 FLARE@244.8 ROLLOUT@247.3 STOPPED@276.5 | water to-displace@0.0 to-step@2.2 climb@18.8 circuit@45.5 flare@244.8 ldg-step@246.8 circuit@248.5 ldg-step@248.8 circuit@252.4 ldg-step@253.0 circuit@254.5 ldg-step@255.0 ldg-displace@256.4 ldg-step@257.3 ldg-displace@257.9 ldg-step@258.2 ldg-displace@258.4 ldg-step@259.1 ldg-displace@259.4 ldg-step@259.9 ldg-displace@260.1 ldg-step@260.8 ldg-displace@261.0 ldg-afloat@274.4 ...
- metla_2_B (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.8 CROSSWIND@45.5 DOWNWIND@85.0 BASE@121.3 FINAL@148.5 FLARE@244.7 ROLLOUT@247.2 STOPPED@277.2 | water to-displace@0.0 to-step@2.2 climb@18.8 circuit@45.5 flare@244.7 ldg-step@246.8 circuit@248.4 ldg-step@248.8 circuit@252.3 ldg-step@253.1 circuit@254.4 ldg-step@255.0 ldg-displace@256.4 ldg-step@257.4 ldg-displace@257.9 ldg-step@258.2 ldg-displace@258.5 ldg-step@259.0 ldg-displace@259.3 ldg-step@264.7 ldg-displace@264.7 ldg-step@274.7 ldg-afloat@274.9 ldg-step@314.1 ...
- metla_3_B (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.5 CLIMB@27.0 CROSSWIND@45.7 DOWNWIND@85.2 BASE@121.5 FINAL@148.7 FLARE@244.8 ROLLOUT@247.3 STOPPED@277.5 | water to-displace@0.0 to-step@2.4 climb@19.0 circuit@45.7 flare@244.8 ldg-step@246.9 circuit@248.4 ldg-step@248.9 circuit@252.4 ldg-step@253.5 circuit@254.7 ldg-step@255.2 ldg-displace@256.7 ldg-step@257.7 ldg-displace@258.3 ldg-step@258.6 ldg-displace@258.9 ldg-step@259.4 ldg-displace@259.8 ldg-step@262.1 ldg-displace@262.1 ldg-step@262.6 ldg-displace@262.8 ldg-step@265.0 ...
- metla_4_A (to CIRCUIT): pilot ROLL@0.0 LIFTOFF@17.3 CLIMB@26.8 CROSSWIND@45.4 DOWNWIND@85.0 BASE@121.3 FINAL@148.5 FLARE@244.5 ROLLOUT@247.0 STOPPED@275.4 | water to-displace@0.0 to-step@2.2 climb@18.8 circuit@45.4 flare@244.5 ldg-step@246.6 circuit@248.2 ldg-step@248.7 circuit@250.4 ldg-step@250.6 circuit@252.2 ldg-step@253.3 circuit@254.6 ldg-step@255.0 ldg-displace@256.4 ldg-step@257.5 ldg-displace@258.1 ldg-step@258.3 ldg-displace@258.6 ldg-step@259.2 ldg-displace@259.5 ldg-step@260.1 ldg-displace@260.2 ldg-step@261.8 ...

(The frame rows carry no attitude: a flip is read from the phases - a FLARE / ROLLOUT that goes back to circuit is a skip; STOPPED with the water phase flickering is the float at rest.)

## THE FLOATS LEG - the Cessna on floats from the SEA lane, 330 s (the route each run flew: see the landings; distances to the Metlakatla seaplane base)

| run | garage | bootWorst | rollout | nearS | nearLoop | nearRender | nearDraws | nearP99 | nearWorstDt | afterWorst | privMB | wsMB | heapMB | houses | closest | town |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| metla_1_A | 64.5 | 868 | 3.5 | 0.0 | - | - | - | - | - | 975 | 13443 | 9791 | 3157 | 79.0 | 3922 | false |
| metla_2_B | 70.6 | 2044 | 3.1 | 0.0 | - | - | - | - | - | 564 | 15096 | 11413 | 3883 | 524 | 3922 | true |
| metla_3_B | 72.1 | 2071 | 3.1 | 0.0 | - | - | - | - | - | 555 | 15085 | 11357 | 4023 | 524 | 3922 | true |
| metla_4_A | 62.7 | 997 | 3.1 | 0.0 | - | - | - | - | - | 528 | 13393 | 9805 | 3146 | 79.0 | 3922 | false |
| **A off** | 63.6 | 933 | 3.3 | 0.0 | - | - | - | - | - | 752 | 13418 | 9798 | 3152 | 79.0 | 3922 | |
| **B on** | 71.3 | 2058 | 3.1 | 0.0 | - | - | - | - | - | 560 | 15091 | 11385 | 3953 | 524 | 3922 | |
| **B - A** | +7.7 | +1125 | -0.2 | 0.0 | - | - | - | - | - | -192 | +1673 | +1587 | +802 | +445 | -0.0 | |

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
| world | 24886 | 29030 | +4144 |
| settle | 15721 | 16663 | +942 |
| frames | 1139 | 1683 | +544 |
| town | 4098 | 4424 | +326 |
| craft | 772 | 1033 | +262 |
| firstFrame | 1352 | 1190 | -162 |
| upload | 2127 | 2268 | +141 |
| bake | 884 | 1020 | +136 |
| worldCompile | 194 | 315 | +121 |
| recheck | 1304 | 1401 | +97.5 |

### What the scene holds at the end (over the town), by class - the visible meshes (draws), their triangles, in the camera's view, as shadow casters, geometry / texture MB; mk = Metlakatla's own

| class | draws off -> on (Δ) | tris off -> on (Δ) | in view (on) | shadow casters (on: draws / tris) | geometry MB (Δ) | textures MB (on) | mk tris (on) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| premises:roads | 72 -> 125 (+53) | 3.67 M -> 4.54 M (+875 k) | 4.01 M | 38 / 15 k | 180 (+32.9) | 0.0 | 0 |
| premises:townkit | 0 -> 2 (+2) | 0 -> 644 k (+644 k) | 0 | 2 / 644 k | 41.2 (+41.2) | 0.0 | 0 |
| premises:patch | 97 -> 106 (+9) | 835 k -> 1.27 M (+437 k) | 157 k | 0 / 0 | 0.0 (0.0) | 0.0 | 0 |
| scene:Mesh | 353 -> 395 (+43) | 7.09 M -> 7.10 M (+12 k) | 4.06 M | 282 / 1.31 M | 67.2 (0.0) | 48.5 | 0 |
| rail:r3:2 | 1 -> 1 (0) | 3928 -> 2042 (-1886) | 0 | 1 / 2042 | 0.2 (-0.2) | 0.0 | 0 |
| houses:boxes | 19 -> 42 (+23) | 470 -> 1320 (+850) | 60 | 0 / 0 | 0.1 (+0.1) | 0.0 | 0 |
| scene:propInstances | 13 -> 13 (0) | 1.98 M -> 1.98 M (-813) | 1.98 M | 13 / 1.98 M | 1.0 (0.0) | 18.9 | 0 |
| premises:life | 2 -> 2 (0) | 7076 -> 7636 (+560) | 7636 | 1 / 6516 | 0.7 (0.0) | 0.0 | 0 |
| scene:standCards | 120 -> 120 (0) | 431 k -> 431 k (-554) | 431 k | 0 / 0 | 0.0 (0.0) | 0.0 | 0 |
| premises:houses | 42 -> 54 (+12) | 1240 -> 1590 (+350) | 0 | 54 / 1590 | 0.2 (+0.1) | 87.2 | 0 |
| props | 78 -> 81 (+3) | 17 k -> 17 k (+281) | 2127 | 38 / 7597 | 0.8 (0.0) | 38.8 | 0 |
| rail:r3:0 | 1 -> 1 (0) | 9706 -> 9924 (+218) | 0 | 1 / 9924 | 1.1 (+0.1) | 0.0 | 0 |
| scene:PerspectiveCamera | 1 -> 1 (0) | 1216 -> 1216 (0) | 1216 | 0 / 0 | 0.0 (0.0) | 0.0 | 0 |
| scene:cloudComposite | 1 -> 1 (0) | 2 -> 2 (0) | 2 | 0 / 0 | 0.0 (0.0) | 0.0 | 0 |
| scene:lakes | 1 -> 1 (0) | 510 -> 510 (0) | 510 | 0 / 0 | 0.0 (0.0) | 0.0 | 0 |
| scene:LOD | 9 -> 9 (0) | 484 -> 484 (0) | 0 | 2 / 76 | 0.0 (0.0) | 25.6 | 0 |
| premises:patchfar | 24 -> 24 (0) | 82 k -> 82 k (0) | 20 k | 0 / 0 | 0.0 (0.0) | 0.0 | 0 |
| houses:far | 9 -> 9 (0) | 38 k -> 38 k (0) | 0 | 0 / 0 | 0.3 (0.0) | 0.0 | 0 |
| **all** | 1206 -> 1351 (+145) | 15.85 M -> 17.82 M (+1.97 M) | 11.27 M | 620 / 5.26 M | 465 (+74.2) | 364 | 0 |

### THE LOTS HELD (A0: built and kept, drawn or not - every mesh under the lots group at the end of each run)

| run | meshes | of them hidden | triangles | geometry MB | mk_ yards | Metlakatla entries bared |
| --- | --- | --- | --- | --- | --- | --- |
| metla_1_A | 324 | 266 | 1.93 M | 110 | 0 | 0 |
| metla_2_B | 324 | 266 | 1.93 M | 110 | 0 | 818 |
| metla_3_B | 324 | 266 | 1.93 M | 110 | 0 | 818 |
| metla_4_A | 324 | 266 | 1.93 M | 110 | 0 | 0 |

### The three biggest levers

(written from these numbers after the run - see below)

**ON costs - ms loop / - ms render a frame over the town (draws -, frame p99 - -> - ms, worst frame - -> - ms); +7.7 s to the garage, -0.2 s roll-out; +1673 MB peak private (+802 MB JS heap).**

## AS IT IS TODAY - the town's houses, people and cars by distance (gamer, master b0cbaf781 + G3210; no new run)

The 4 km column is measured (the census of 14 Oct, the aircraft 3.9 km from Metlakatla). The 1 km and 300 m columns are from the code's
own thresholds (file:line in src/viewer/, RP = render_premises.js, SL = scenery_life.js, PJ = props.js, TK = townkit.js).

| | ~300 m | ~1 km | ~4 km | instanced? |
| --- | --- | --- | --- | --- |
| **houses** | BUILT, full lod-0 held; a median house (R 8.3 m) is past its projected swap (~220 m; edge = R·F/48 clamped 60-600 m, RP:1902-1925) -> drawn as 'houses:far' (lod 1, the TARR town shader, detail bands on); a big house (R > ~11 m) still lod 0 per-cell merge | BUILT; 'houses:far' lod 1; the detail bands leave at ~1.17 km (RP:1882) | BUILT (everything within STREAM.reach = 6 km, RP:3645); 'houses:far' shells + 'houses:boxes' (10 tris a house) past 1.2 km for cells without lod 1 (RP:1852, 2379) - measured: farTris 426 k, bakeDraws 72 with the town on | NO - merged per 256 m cell (world-space Mesh, ~1-5 draws a cell); Metlakatla's kit plots: a BatchedMesh per material (TK:444-474) |
| **people** | the house / pier people: instanced proxies drawn to 200 m (RP:3523); the life people to 220 m (a proc figure from 90 m, SL:189) -> at 300 m none drawn | not drawn, still placed and held | not drawn, still placed and held (LIFE.place re-places them after every build batch, SL:783-821) | YES (InstancedMesh per level / BatchedMesh) |
| **cars** | yard / lot cars: one THREE.LOD each, always in the scene; traffic: one LOD each, posed and drawn; life cars: 'carBody' proc to 450 m | yard: LOD; traffic: posed and drawn (reach 1200 m, RP:1743); life: not drawn | yard: LOD until its empty level (~3.6 km, RP:1739) - Metlakatla's now dropped (G3210); traffic: not posed but EVERY car's s / v still advanced EVERY frame on EVERY road (RP:1754-1767); life: not drawn | yard / traffic: NO (a LOD per car); life: YES |

Per frame or periodically, over EVERYTHING whatever the distance (RP:2688 tick): detailTick loops every house (distanceTo, the cast and
prop switches, RP:2664-2685); hlodTick loops every cell each frame and hlodScan re-signs every cell every 30 frames (RP:2349-2398); the
kit host's tick loops every kit house (TK:450); propInstUpdate walks every proxy when the eye moves 1.5 m (PJ:585-612); moveTraffic every
road and car (RP:2688); LIFE.place after each build batch. Two code flags: 'scenery: low' promises "no yard props" but never turns them off
(RP:2677: pOn = !DETAIL.props || ...); houses the in-flight stream builds get no lod 1, so their cells fall back to the lod-0 merge with a
hard switch at 150 m, then boxes (RP:3180-3182, 2375).

**The gap to the target, and the scalable design (the next session's brief; fitted to BIG-WORLD-STUDY-2026-10 §2-3, P4 -
Ketchikan is ~11x Metlakatla by housing units, 6 614 vs 586: "if 375 houses do not pass, 5 000 will not"):**
1. *Resident only near, evicted behind:* today every house, yard, person and car within 6 km is generated in full and held (the far form
   drawn, the lod-0 bags kept), and people / life / traffic are placed or advanced with no distance gate. Target: the full house (today's
   generator or the kit - the close-up detail kept), its yard, people and cars exist only in a near ring (~300-500 m), are built on
   approach and freed behind the aircraft, under a per-cell memory budget; outside that ring nothing is updated (the study's
   "per-cell budget; evict behind").
2. *The far house as cooked data, drawn instanced:* the user's far form (roof shape + colour, main walls + colour, porches; no detail) as
   ~30-60-triangle proxies of the kit's 30 archetypes, ONE InstancedMesh per archetype with per-instance transform + roof / wall
   colour; the instance table (archetype, footprint, height, colours: ~16-32 bytes a house) COOKED OFFLINE per 1 km cell and never built
   at runtime (the study's "far town cooked per 1 km cell"). A few draws and a few MB for thousands of houses, the same cost at 4 km
   or 40 km; what is drawn 90 % of the time unless landing in the town.
3. *One distance clock and the rest of the town by cell:* per-cell rings (near / mid / far) recomputed when the eye crosses a cell, not
   per house per frame (detailTick, hlodTick, traffic, life and props only on the near ring); roads merged per 1-2 km cell past 2 km and
   culled past 6-7 km, the cooked ground raster only near fields (§2.3); KTX2 house arrays. Gate it on the user's rule over the town,
   ON vs OFF: no frame > 100 ms, uneven <= 15 %, load no worse than +2 s - the measure this report starts.
