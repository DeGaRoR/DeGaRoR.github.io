# SCENERY-PLACE: the October scenery stood on Jolene (3 Nov 2026, cloud, for A0)

The user, 3 Nov via A0: "I know I said wait, but actually, you should go ahead and place all the new scenery we have."
Plus A0's extra item (~20:55): "there is a sign at the old mine, next to the parking spot. It's in the way, remove it."

Scenery only. The record keeps rev 23. No plot, garage, shed or owner changed. No built file was committed (index.html,
dev.html, sw.js, version.json and tools/flight_core.js are left to the train). Branch: on top of origin/master adb2d2a9 (L30b).

## 1. Inventory: what was built and placed nowhere

| key(s) | what | built by | placed before? | decision |
|---|---|---|---|---|
| `utility/hydro powerhouse` x2 | Metlakatla's two hydro plants (G2909) | `tools/_navaid_gen.js` | no ("the user positions") | **placed**, both |
| `tent_hiking` `tent_frame` `tent_big` `tent_small` | the user's tents (G3145) | camp kit | no | **placed** at the Cabin Lake shore |
| `machine_excavator` `machine_backhoe` `machine_loader` `machine_crane` `machine_loader_rusty` `machine_skidsteer` `tractor_farm` `tractor_scan` | construction machines (G3665, on master since L28b) | pier kit | no | **placed** at the quarry, the Upper Lake works and the gardens |
| `heating_plant` `bunker` `sky_rest` `observatory` | the scenery kit's landmarks (G2901-07) | scenery kit | no | **placed** |
| `alma_base` + `alma_fork` + `alma_dish` | the ALMA 12 m antenna (an assembly) | scenery kit | no | **placed** as one record (`with`) |
| `fishing_boat` | steel trawler | scenery kit | no (the ferry was) | **placed** at anchor |
| `starfighter` `loader_wreck` | F-104G gate guardian, wheel-loader wreck | scenery kit | no | **placed** |
| `crowd_1` .. `crowd_6` | six photoscanned people | scenery kit | no | **placed** at the camp's fire |
| `pylon_suspension` `_tall` `_tension` `_terminal` `_hframe` (+ levels) | high-voltage pylons (G3140) | `tools/infra_gen.js` | no | **not placed** (see 4) |
| `car_conquer_*` | the driveable car's body, wheels, steering, lamps | cars kit | no | **not placed** (see 4) |
| pier kit's older vehicles / pier modules | the September kit | pier kit | partly | out of scope: not October's scenery |

## 2. Placement table (tools/fixtures/island_jolene.json)

Every record is written the way the fixture's own records are: a site is `{id, name, at {x, z, yaw}, items}`, a prop is
`{id, kind: 'prop', key, x, z, yaw, dy, on}`, a clear is `{id, poly, what: ['trees']}`, a pad is a `flatten` in `terrain`.
World yaw for a site item is `at.yaw + pi + item.yaw`. The hydro generator's +z (the riprap side) faces the road and the
water, and its yard is at -x.

| id | key | x, z | why there |
|---|---|---|---|
| hy_s_upper (site) | utility/hydro powerhouse, P {riprap 2.5} | -174.7, -5780.2 | Purple Lake's point at the end of Hydroplant Rd (G2909), the riprap toward r25 and the bay; 25 x 10 default |
| hy_s_upper_clear | trees, r 30 | | as s_vor_ann_clear |
| hy_t_works + _clear | flatten 9.5, falloff 6 | NW of the shed along r25 | the penstock works ground |
| hy_o_crane, hy_o_backhoe | machine_crane, machine_backhoe | -193.6, -5804.9 / -185.9, -5804.0 | on the works ground |
| hy_s_bayside (site) | utility/hydro powerhouse, P {hL 12, hW 10, riprap 2.5, yardL 7, yardW 6} | -1135.9, -8315.4 | 6.4 m off Chester Lake's candidate A. **A is now the user's boat yard** (o13-o17, five boats 7-14 m from the point, on a19's gravel) and candidate B is the user's marine supply (s22). Moved 5.7 m NE along r1 and 3 m back from it: clear of the boats, the road (3.2 m off its pavement) and s22. Sized 12 x 10 from the aerial's roof |
| hy_s_bayside_clear | trees, r 30 | | |
| qy_o_excavator / _loader / _skidsteer / _loader_rusty / _loader_wreck | the machines + the wreck | -2702..-2676, -7733..-7768 | mk_x_quarry's flat floor (39.6 m) by its workshop s34; the loader faces the excavator |
| mk_o_tractor_farm, mk_o_tractor_scan | tractor_farm, tractor_scan | -2800, -8350 / -2804, -8341 | the community gardens (mk_gardens_shed); mk_ ids so they go with the town cut |
| cb_o_firepit, cb_o_tent_* , cb_o_crowd1..6, cb_x_camp | camp_firepit, the 4 tents, crowd_1..6; trees r 12 | 2116, -17244 | Cabin Lake's shore 25 m above the water, 350 m abeam cb_sea's lane, 70 m from the slip's stand |
| mt_o_observatory + mt_t_observatory | observatory, flat on a pad | 9198, -5866 | Mount Ardent's east shoulder, the one flat spot 88 m from mt_s_meteo |
| mt_o_antenna + mt_t_antenna | alma_base `with` alma_fork, alma_dish | 9196, -5892 | beside it on its own pad: a summit science site (meteo + optics + radio) |
| af_o_heating_plant + _clear | heating_plant, flat | -780, -860 | the old base's flat NW of the field, 495 m abeam 13/31, outside every approach funnel, its long side along r11 (27 m off) |
| af_o_f104 + _clear | starfighter | -320, 450 | the gate guardian by r2 at the field's entrance, 185 m abeam 13/31 (7 m under its transitional surface) |
| gw_o_bunker + gw_t_bunker + _clear | bunker, flat on a pad | 640, -4280 | the bluff S of Greywater, the sea 42 m off, its face to the sea |
| gw_o_skyrest + _clear | sky_rest, on the ground | -1420, -3325 | the headland W of Ridgeback, 480 m from any road (see 5) |
| by_o_trawler | fishing_boat, flat, dy = -seabed - 1.6 | -1480, -8560 | at anchor off Bayside, written the way the ferry is |

The power line: r25 and r1 already carry the road's distribution poles and cable (powerline.js) past both plants.

## 3. The sign at the old mine (A0's extra item)

It is **generated**, not a record item. `mn_s_mine/airtaxi` is a `house/air taxi office`, and that preset carries
`signAt: 1`, which tells HOUSE_GEN to stand the board "on posts by the path". Nothing collides with that board, so the
taxi census never sees it. The board's centre stood **10.8 m from mn_strip's stand** (7278, -15318), inside a parked
aeroplane's wing. mn_strip has no fleet tie-down spots, so the "parking spot" is the strip's stand.
- The fix: that item's `P.signAt` is now `0`, so the board goes over the door. The user's AFB (19) save carries
  mn_s_mine, so `scenery_ship_afb19.json` gains `itemPatches` {mn_s_mine: {airtaxi: {signAt: 0}}}. GATE SCENERYED 15 now
  applies it after the ship, the same way it applies `fieldPatches`.
- The rule, gated: a new GATE HOUSE section, **signs**. Every house sign on posts in the cooked places (both variants)
  must stand 17.5 m (the DC-3's 14.5 m half-span plus 3 m) or more from every stand, plot stand and fleet tie-down spot.
  It went **red on the old cook** (the mine's sign at 10.8 m) and is green now. Census: 12 post signs on Jolene before,
  11 after. Nothing else moved: the next nearest is the flying club's, 47.9 m from HOME's stand.

## 4. Not placed, and why

- **The pylons.** Nothing strings a line between two pylon props: their `attach` points wait for a future line tool, and
  powerline.js strings only the road's poles. Wire-less lattice towers would be a row of sticks. The island's grid is a
  distribution line, and r25 / r1 already carry one past both plants.
- **The driveable car's parts** (`car_conquer_*`). These are the vehicle shell's pieces, which the placer hides as
  parts. A body standing without its rig is not a parked car.

## 5. Gates

Run with `node tools/run_gates.js --no-build --jobs=3 --only=...` on the final record (cooks re-run: premises, city,
map, fleet spots). The baseline is a clean worktree of origin/master adb2d2a9 with the same command.

PASS (39): NAVAID, PREMCOOK, PREMISES, HOUSE (the new `signs` section included), ASSETBUDGET, TAXICLEAR (all 4 shards),
SCENERY, SITE, CONTRACTS, UISMOKE, MAPBAKE, CITYCOOK, MEDIA, NAMES, PREMRASTER, GAMEPREM, PAVEMENT, STAGES, HONESTY,
SIMWORKER, LOOKS, CONTACT, ANIMALS, TREES, GRASSSIDES, SPLAT, HYDRODYN, STRIPSURF, GE, CITYHOST, MISSIONS, ROUTES,
STORAGE, STOREDRAW, TOWNKIT, KITHOST, METKIT, LIFE, STAND.

RED, and **red on clean origin/master with the same failing rows** (diffed row by row, timings normalised):
ASSETS (material sites in src/viewer), GEO (media/geo/chars named by no manifest), LAKEBED (02/20's pond), RWYLIGHTS
(w4 / w5 lights), SCENERYED (20b only: the town composition over its 2500 ms on a loaded box; master 2886 ms, here
3230 ms), STORY (T0's beat card), TREEHIT (the trunk rows), VEHICLE (DEF, AIRBORNE), WORLD (13/31 approaches under 4 %).

Two passes this placement cost, each caught by a gate:
- **TAXICLEAR 11a** caught the first heating-plant spot (840, -680) sitting ON 02/20's extended centreline, 280 m past
  end0. I had vetted it with the runway heading as (sin h, cos h). The world's aerodrome heading is (cos h, sin h).
- **CONTACT 'road side'** counts pavement-side points within 5 mm of the premises' ground patch. That patch is built in
  64 m chunks round ANY placed entry. The sky-rest's first spot, 120 m off r5, cost 127 such points; it moved 480 m from
  any road. The Upper Lake plant on r25 costs 664 and has to stand at its point. Count 7516 (master) -> 8180, limit 8301.

FRAMECOST is A0's, on the GPU box in the landing train.

## 6. Pictures

The brief named `tools/plane_shot.js`, but that rig shoots a BUILD in the phone profile's garage and has no world. So these
are SwiftShader stills by `tools/soft_still.js` (the cloud world rig, G1465) with the stage module `stage_place.js` (in this
folder): one boot, then for each placement the paused aeroplane parked 400 m over the place, so the premises stream
(`STREAM.reach` 6 km, round the aeroplane) builds it, and the free eye posed (`FLIGHT_PROBE.devFree`). Each place has a
pilot's oblique (~200-300 m out, 50-80 m up) and a view from above. `?idle=0`, noon. The coloured squares at the
right-hand side are a page overlay the rig does not hide. The water is dark because the software rung draws no sky
probe (G1460). **Never read a frame time off these.**

(the stills table is filled in below)
