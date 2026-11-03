# SCENERY-PLACE: Metlakatla's two hydro plants on Jolene, the construction machines, the tents, the F-104 by the runway, the mine's sign (3 Nov 2026, cloud, for A0)

The user, 3 Nov via A0: "go ahead and place all the new scenery we have". Then the user, the same evening, narrowing it:
"The 2 hydroplants were the main thing. I actually did not want the other assets. The f104 should be next to the runway,
OK for construction machines, but not the factories, they look bad, nor the abandoned plant and nothing more on Mount
Ardent than the already placed meteo observatory." And then: "Ok for the tent, the tractors too." Plus A0's extra item (~20:55): "there is a sign at the old mine, next to
the parking spot. It's in the way, remove it."

Scenery only. The record keeps rev 23. No plot, garage, shed or owner changed. No built file was committed (index.html,
dev.html, sw.js, version.json and tools/flight_core.js are the train's). Branch: on top of origin/master adb2d2a9 (L30b).

## 1. Inventory: what was built and placed nowhere, and what became of it

| key(s) | what | placed before? | now |
|---|---|---|---|
| `utility/hydro powerhouse` x2 | Metlakatla's two hydro plants (G2909, `tools/_navaid_gen.js`) | no ("the user positions") | **placed** |
| `machine_excavator` `machine_backhoe` `machine_loader` `machine_crane` `machine_loader_rusty` `machine_skidsteer` `tractor_farm` `tractor_scan` | construction machines (G3665) | no | **placed** (the quarry, the Upper Lake works, the gardens) |
| `loader_wreck` | the scenery kit's abandoned wheel loader | no | **placed** in the quarry with the machines |
| `starfighter` | F-104G gate guardian | no | **placed** beside 13/31 |
| `heating_plant` `bunker` `sky_rest` `observatory` `alma_*` `fishing_boat` `crowd_1..6` | the scenery kit | no | placed, then **withdrawn** (the user) - the six people too: the tents came back without them |
| `tent_*` | the user's tents (G3145) | no | **placed** at the Cabin Lake shore camp (withdrawn, then back on the user's "Ok for the tent") |
| `pylon_*` | high-voltage pylons (G3140) | no | **not placed**: nothing strings a line between two pylon props; r25 / r1 carry the road's distribution line past both plants |
| `car_conquer_*` | the driveable car's parts | no | **not placed**: the vehicle shell's pieces, not a parked car |

## 2. Placement table (tools/fixtures/island_jolene.json)

Every record is written the way the fixture's own records are: a site is `{id, name, at {x, z, yaw}, items}`, a prop is
`{id, kind: 'prop', key, x, z, yaw, dy, on}`, a clear is `{id, poly, what: ['trees']}`, a pad is a `flatten` in `terrain`.
World yaw for a site item is `at.yaw + pi + item.yaw`. The hydro generator's +z (the riprap side) faces the road and the
water, and its yard is at -x.

| id | key | x, z | why there |
|---|---|---|---|
| hy_s_upper (site) | utility/hydro powerhouse, P {riprap 2.5} | -174.7, -5780.2 | AT Purple Lake's point at the end of Hydroplant Rd (G2909), at.yaw 2.1434; 25 x 10 default. Its foot runs 6.2..15.6 m: the shelf cuts into the hillside; r25 does not move |
| hy_s_upper_clear | trees, r 30 | | as s_vor_ann_clear |
| hy_t_works + hy_t_works_clear | flatten 9.5, falloff 6 | NW of the shed along r25 | the penstock works ground |
| hy_o_crane, hy_o_backhoe | machine_crane, machine_backhoe | -193.6, -5804.9 / -185.9, -5804.0 | on the works ground |
| hy_s_bayside (site) | utility/hydro powerhouse, P {hL 12, hW 10, riprap 2.5, yardL 7, yardW 6} | -1135.9, -8315.4 | 6.4 m off Chester Lake's candidate A, at.yaw 0.8476. **A is now the user's boat yard** (o13-o17, five boats 7-14 m from the point, on a19's gravel) and candidate B is the user's marine supply (s22). Moved 5.7 m NE along r1 and 3 m back: clear of the boats, the road (3.2 m off its pavement) and s22. 12 x 10 from the aerial's roof |
| hy_s_bayside_clear | trees, r 30 | | |
| qy_o_excavator / _loader / _skidsteer / _loader_rusty / _loader_wreck | the machines + the wreck | -2702..-2676, -7733..-7768 | mk_x_quarry's flat floor (39.6 m) by its workshop s34; the loader faces the excavator |
| mk_o_tractor_farm, mk_o_tractor_scan | tractor_farm, tractor_scan | -2800, -8350 / -2804, -8341 | the community gardens (mk_gardens_shed); mk_ ids so they go with the town cut |
| cb_o_firepit, cb_o_tent_big / _frame / _hiking / _small, cb_x_camp | camp_firepit + the four tents round it; trees r 12 | 2116, -17244 | Cabin Lake's shore 25 m above the water, 350 m abeam cb_sea's lane, 70 m from the slip's stand; the tents 5-6.5 m from the fire, 5 m or more apart, their doors to it |
| af_o_f104 + af_o_f104_clear | starfighter, on the ground | -442.1, -73.9 | 130 m abeam 13/31's centreline on the side away from the club, 300 m NW of its middle, on the flat (0.1 m), parked along the runway; its tail 4.9 m over the runway against the 7.9 m the 1:7 transitional surface allows |

GATE NAVAID section 5 now holds the powerhouses: each within 5 m (Upper Lake) or 10 m (Bayside) of its point, with its
clear (~30 m).

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
- Pictures: `mine_sign_BEFORE_master_pilot.jpg` / `_above.jpg` (clean origin/master: the board on its two posts on the lawn
  in front of the blue office; the stand is the open ground to its left) and `mine_sign_AFTER_pilot.jpg` (this branch: the
  lawn is clear, the board is over the door). The rig's free eye does not draw the parked aeroplane.

## 4. Gates

Run with `node tools/run_gates.js --no-build --jobs=3 --only=...` on the final record (cooks re-run: premises, city,
map, fleet spots). The baseline is a clean worktree of origin/master adb2d2a9 with the same command; the failing rows are
diffed row by row with timings normalised.

PASS (39): ANIMALS ASSETBUDGET CITYCOOK CITYHOST CONTACT CONTRACTS GAMEPREM GE GRASSSIDES HONESTY HOUSE (the new `signs`
section included) HYDRODYN KITHOST LIFE LOOKS MAPBAKE MEDIA METKIT MISSIONS NAMES NAVAID (5: hy_s_upper 0.0 m, hy_s_bayside
6.4 m off their points) PAVEMENT PREMCOOK PREMISES PREMRASTER ROUTES SCENERY SIMWORKER SITE SPLAT STAGES STAND STORAGE
STOREDRAW STRIPSURF TAXICLEAR (all 4 shards) TOWNKIT TREES UISMOKE.

RED, and **red on clean origin/master with the same failing rows**: ASSETS (material sites in src/viewer), GEO
(media/geo/chars named by no manifest), LAKEBED (02/20's pond), RWYLIGHTS (w4 / w5 lights), SCENERYED (20b only: the town
composition over its 2500 ms on a loaded box), STORY (T0's beat card), TREEHIT (the trunk rows), VEHICLE (DEF, AIRBORNE),
WORLD (13/31 approaches under 4 %).

Caught on the way (both on placements since withdrawn):
- **TAXICLEAR 11a** caught the first heating-plant spot sitting ON 02/20's extended centreline. The world's aerodrome
  heading is (cos h, sin h), not (sin h, cos h).
- **CONTACT 'road side'** counts pavement-side points within 5 mm of the premises' ground patch, which is built in 64 m
  chunks round ANY placed entry. Upper Lake on r25 costs 664 such points and has to stand there (its point).

FRAMECOST is A0's, on the GPU box in the landing train.

## 5. Pictures

The brief named `tools/plane_shot.js`, but that rig shoots a BUILD in the phone profile's garage and has no world. So these
are SwiftShader stills by `tools/soft_still.js` (the cloud world rig, G1465) with the stage module `stage_place.js` (in this
folder). One boot, then for each placement the paused aeroplane parked 400 m over the place, because the premises stream
round the AEROPLANE (`STREAM.reach` 6 km), not round the eye. Then the free eye is posed (`FLIGHT_PROBE.devFree`): a
pilot's oblique and a view from above. `?idle=0`, noon. The coloured squares at the right are a page overlay the rig does
not hide. The water is dark because the software rung draws no sky probe (G1460). **Never read a frame time off these.**

| still | what it shows |
|---|---|
| upper_hydro_pilot.jpg / _above.jpg | the Upper Lake powerhouse by r25 above the bay, its two-tone roof and small yard, the crane and backhoe on the works ground NW of it |
| bayside_hydro_pilot.jpg / _above.jpg | the Bayside powerhouse beside r1, its yard to the NE, the user's boats and parking just SW |
| cabinlake_camp_above.jpg | the camp from above (taken with the six people at the fire, since withdrawn; the tents stand where they stood then) |
| quarry_pilot.jpg / _above.jpg | the quarry floor: excavator, loader facing it, skid steer, the rusty loader by the workshop, the wreck to the W |
| mine_sign_BEFORE_master_*.jpg, mine_sign_AFTER_pilot.jpg | section 3 |

Not pictured: the gardens' tractors (the software rung composes the town-off variant, which drops every `mk_` entry; the
tractors go with the town by design) and the F-104 at its new spot (moved after the stills; the user said stop).
