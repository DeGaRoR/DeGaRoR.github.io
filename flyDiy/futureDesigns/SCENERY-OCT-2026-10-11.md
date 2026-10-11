# ASSETS-OCT (G2900-G2909): the October scenery models, game-ready

The user (11 Oct 2026): "Most of them need a round of game-readification. There are many raw scans, and we need
the full chain: decimation, reprojection, like we have done with the woodworking machines. Look at all of them,
issue specs for the target polygon number (the buildings are important, large assets, but the bulldozer and
starfighter are only scenery elements and should be kept reasonable)." And: "One of the observatory models has no
texture: pick within our material library and do something with it on your own, to submit for my review."

Input: `flyDiy/assets/sceneryOctober/` (gitignored, 129 MB, 9 GLBs, never edited).

## STEP 0 - LICENCES (read from each GLB's `asset.extras`, Sketchfab's export block)

| asset | author | licence (as declared) | source | verdict |
|---|---|---|---|---|
| abandoned_bulldozer | lebeden | CC-BY-4.0 | sketchfab.com/3d-models/abandoned-bulldozer-3ee4f4ffb57e4a66a968dd3491e48711 | OK, credit |
| abandoned_heating_plant_-_scan | illusoXR | CC-BY-4.0 | sketchfab.com/3d-models/abandoned-heating-plant-scan-67ce905f1f9643ff8c5b31424467e9ec | OK, credit |
| abandoned_new_muroto_sky_rest_resort_japan (1) | Raiz (RaizVR) | CC-BY-4.0 | sketchfab.com/3d-models/abandoned-new-muroto-sky-rest-resort-japan-14cbb0fa1a4d4be2af20c910e10beb0d | OK, credit |
| boat_fishing | mortalityrexotable | CC-BY-4.0 | sketchfab.com/3d-models/boat-fishing-1874f9a9e58a408d988f8a09771886a5 | OK, credit |
| devils_slide_bunker_-_pacifica_ca | Azad Balabanian | CC-BY-4.0 | sketchfab.com/3d-models/devils-slide-bunker-pacifica-ca-52982f5a24834be48dab4057d2df1c3d | OK, credit |
| f-104_g_starfighter | fhernand | CC-BY-4.0 | sketchfab.com/3d-models/f-104-g-starfighter-5cdfee92623e4b59bc967be7537b1372 | OK, credit |
| hailuoto_car_ferry_la_merituuli | Snowsoup | CC-BY-4.0 | sketchfab.com/3d-models/hailuoto-car-ferry-la-merituuli-6e3a4f3513bd4529854552b7afb0a7ac | OK, credit |
| tutor_tv_observatory | Tommen | CC-BY-4.0 | sketchfab.com/3d-models/tutor-tv-observatory-28a2c1ff61304e6eb36b6840b43e2fc1 | OK, credit (author's own Maya model: `initialShadingGroup`, no maps) |
| satellite__radio_telescope_from_votv | Carl Johnson (Carl_Johnson142) | "CC-BY-4.0" as uploaded | sketchfab.com/3d-models/satellite-radio-telescope-from-votv-e20035a4807449acbecf8e7a453618d2 | **BLOCKED** - see below |

Credit line pattern (one per asset, in the credits screen and the media entry):
`"<title>" by <author> (sketchfab.com/<handle>), CC BY 4.0, modified (decimated, re-textured)`.

**The telescope is BLOCKED, not processed.** The title says it comes from *Voices of the Void* (VotV, a commercial
indie game), and the file confirms it is an extraction from that game's engine: two of its materials are Unreal
Engine's own debug materials (`WorldGridMaterial`, `VertexColorViewMode_RedOnly`) and the rest are UE material
instances (`inst_dishBase_0`.. `inst_dish_0_0`). The uploader can't licence a game's art as CC BY, whatever the
Sketchfab field says. It is also out of scale: 88 x 144 x 88 m. It needs the user's call (a different
telescope, or the game author's permission); nothing new is downloaded from here.

## STEP 1 - THE SPECS

Measured from the delivered files (tris = triangles, sizes in metres after the delivered node transforms; x / height / z).

| asset | what it is | delivered size | delivered tris / mats / maps | role | scale |
|---|---|---|---|---|---|
| heating_plant | photoscan: a 2-3 storey blue-clad works building, a chimney stack, rubble, scanned shrubs, on a 74 x 46 m terrain patch | 73.9 x 28.7 x 45.6 | 1 205 448 / 1 (unlit) / 1 x 1024 jpg | LANDMARK building | as delivered (checked against storey height) |
| bunker | photoscan: WW2 coastal fire-control bunker on its cliff-top mound, graffiti | 16.7 x 11.5 x 24.0 | 90 833 / 1 (unlit) / 1 x 1024 jpg | LANDMARK building | as delivered (checked against door height) |
| sky_rest | photoscan, already cut to 5 k: ruined tower resort, three round shafts, cantilevered floor slabs, ground patches | 42.7 x 17.8 x 33.5 | 5 246 / 1 (unlit) / 1 x 4096 jpg | LANDMARK building | as delivered (checked against floor-to-floor) |
| observatory | modelled (Maya), UNTEXTURED: a domed observatory on a drum base, a small dish, stairs | 57.2 x 37.7 x 41.5 (origin 246 m off) | 100 202 / 1 (none) / 0 | LANDMARK building | re-centred; checked against stair rise / door |
| ferry | modelled: the Hailuoto road ferry L/A Merituuli, open car deck, wheelhouse on a side gantry | 48.5 x 19.0 x 9.6 | 86 632 / 22 flat + 6 small maps / 1303 meshes | LARGE PROP (moored ship) | checked against rail and door heights |
| fishing_boat | modelled game asset: a small steel trawler with gantry and booms | 15.7 x 11.3 x 12.1 (booms out) | 27 320 / 5 / 6 x 1024 png | PROP (moored / beached) | as delivered |
| starfighter | photoscan of a stripped museum F-104G (panels open) on its gear | 6.0 x 3.75 x 15.3 | 995 566 / 4 UDIM / 4 x (1024 jpg + 1024 normal) | PROP (scenery) | x 1.09: the real F-104G is 16.7 m long, 6.63 m span, 4.11 m tall - the scan is ~9 % small on all three |
| loader ("bulldozer") | photoscan: an abandoned wheel loader with its bucket, graffiti, on a scanned dirt patch | 6.3 x 6.4 x 14.8 (with the patch) | 49 862 / 1 / 1 x 1024 jpg | PROP (scenery) | checked against tyre diameter |

### Targets

L0 = near level, L1 / L2 = the far levels (the pier kit's `lodOf` / `lodDist` rows). Buildings are generous but
stay well inside the town's measured envelope (retro's boot town: 182 houses, 1.19 M tris = ~6.5 k a house; one
landmark here = a handful of houses, and there is one of each on the map). Props follow the hangar-props ladder
(the bandsaw: 13.5 k / 3.4 k / 0.8 k).

| asset | L0 | L1 (past) | L2 (past) | maps (shipped, KTX2 twins) | materials | collision |
|---|---:|---:|---:|---|---|---|
| heating_plant | **60 000** | 15 000 (150 m) | 3 000 (600 m) | albedo 2048 + normal 1024 (the scan's whole site was ONE 1024 map; reprojected onto a cleaner atlas at 2048 so no texel is lost) | 1 | column grid, 1 m cell, from L1 |
| bunker | **24 000** | 6 000 (120 m) | 1 500 (500 m) | albedo 2048 + normal 1024 (from one 1024) | 1 | column grid, 1 m, from L1 |
| sky_rest | **5 246 (as delivered)** | 1 500 (250 m) | - | albedo 4096 -> **2048** (KTX2) | 1 | column grid, 1 m, from L0 |
| observatory | **30 000** | 8 000 (150 m) | 2 000 (600 m) | **none new**: the house library's own tiling maps (render, concrete, galv / steelgrey), UVs in metres + an AO term | 3-4 (library sets) | column grid, 1 m, from L1 |
| ferry | **30 000** | 8 000 (150 m) | 2 000 (500 m) | one 1024 atlas (the 22 flat colours become a palette strip beside the 6 small maps) | 22 -> 3 (opaque, glass, lamps) | column grid, 0.5 m, from L1 |
| fishing_boat | **12 000** | 3 000 (60 m) | 800 (200 m) | albedo / normal / ORM 1024 (KTX2) | 5 -> 2 (hull, glass) | column grid, 0.5 m, from L1 |
| starfighter | **16 000** | 4 000 (60 m) | 1 000 (200 m) | albedo 2048 + normal 1024 (from 4 x 1024 + 4 x 1024 normals) | 4 -> 1 | column grid, 0.5 m, from L1 |
| loader | **10 000** | 2 500 (40 m) | 600 (150 m) | albedo 1024 + normal 512 | 1 | column grid, 0.5 m, from L1 |

Trims (the scans carry their own ground; ours draws the ground, the grass and the trees better):
- heating_plant: the 74 x 46 m terrain patch is cut back to the building + an ~8 m apron; the scanned shrubs and
  trees beyond go (they are melted blobs at any distance). A skirt sinks the cut edge 0.5 m into our terrain.
- loader: the dirt patch is cut to a 0.5 m pad round the wheels, skirt sunk.
- bunker: the mound IS the cliff top it sits on - kept, skirt sunk.
- sky_rest: its ground patches are kept (they are the terraces); checked for the floating slabs.

Method per family:
- Scans (heating_plant, bunker, starfighter, loader): tools/machine_prep.py's route generalised (tools/scenery_prep.py):
  weld, two-pass quadric collapse with the far-moved vertices protected (tolerance scaled to the asset: 1 cm for
  the props, 3-5 cm for the buildings), crease-aware planar charts, one atlas, Cycles CPU bake selected-to-active of
  the albedo (as emission) + a tangent normal for the lost relief. Then the levels.
- sky_rest: no cut; the 4096 map resized to 2048; L1 by half-edge collapse on its own uvs.
- Modelled (ferry, fishing_boat): merged by material, flat colours to a palette atlas, decimated on their own uvs.
- observatory: STEP 3 below.

### Where they could live (a "fantasy location" each, for the user to pick)

| asset | suggestion |
|---|---|
| heating_plant | **The cannery power house** - the dead boiler house of an abandoned cannery in a cove (or the JUMBO MINE's boiler house): a rust-and-blue landmark seen from the water |
| bunker | **East Point battery** - a WW2 coastal fire-control post on the East Point headland (Annette Island did have WW2 coastal works), facing the strait |
| sky_rest | **The Sky Rest** - a ruined hilltop resort tower on a ridge road, a VFR waypoint |
| observatory | **The ridge observatory** - on a summit by the altiport / tramway's top station |
| ferry | **The island ferry** - moored at a ferry slip in Metlakatla's harbour (the real island is served by a road ferry) |
| fishing_boat | at the Metlakatla pier kit, or beached and listing on a shingle shore |
| starfighter | **Gate guardian** - on a plinth at the gate of Jolene AFB |
| loader | at the quarry / JUMBO MINE, or rusting at the end of a gravel strip |
