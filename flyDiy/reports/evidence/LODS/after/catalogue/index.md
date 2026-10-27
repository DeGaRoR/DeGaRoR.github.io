# LODS - the whole catalogue (2026-10-27): every generated asset of the editor's site palette

Each sheet: one building, its NEAR mesh and every far rung the game draws of it (render_premises.js's own detailOf / lod1Bags / hlodMerge / hlodBoxes, lifted from the file by tools/_lods_rig.js), from the same cameras: **A** close from the air, **B** the far side steeper, **C** at the rung's switch distance through the game's lens (46 deg, 1080 rows) - true pixels, blown up. Since LODS-2026-10 the far columns ARE the game: every building's own lod 1 on its finish, then less its LOD_DETAIL roles past the detail band (the boards before the fix: git history of this folder, commit 90aece7d).

![official](overview-official.jpg)

![industrial](overview-industrial.jpg)

![commercial](overview-commercial.jpg)

![airport s](overview-airport-s.jpg)

![landmark](overview-landmark.jpg)

![airport m](overview-airport-m.jpg)

![airport xs](overview-airport-xs.jpg)

![residential](overview-residential.jpg)

![sports](overview-sports.jpg)

![shed](overview-shed.jpg)


Made by `node tools/lods_sheet.js` (SwiftShader, headless; the numbers: `node tools/lods_audit.js`). Plan: [futureDesigns/LODS-2026-10.md](../../../futureDesigns/LODS-2026-10.md). The whole island's table: [audit.md](audit.md).

**light** = the rung's mean luminance over the near mesh's from camera C (1.00 = as bright); **black** = share of the rung's pixels darker than sRGB 38 from camera A; **leak** = share of the view looking INTO the building (25 views); **hole** = share of the near view where the rung shows something more than max(1.5 m, R/10) behind the near mesh's outside (see-through, a missing roof or storey); **roof** = the near mesh's roofed plan still roofed from straight above.

## big/athletic centre  [official]

![big-athletic-centre](big-athletic-centre.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3440 | 10 | - |  |  |  | 1.00 | 4.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 578 | 10 | 600 | 0.0% | 0.0% | 100% | 1.00 | 5.6% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 506 | 8 | 3320 | 0.0% | 0.0% | 100% | 0.92 | 5.6% |

## big/boat shed  [industrial]  x3 on Jolene

![big-boat-shed](big-boat-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1752 | 9 | - |  |  |  | 1.00 | 1.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 422 | 9 | 290 | 0.0% | 0.2% | 100% | 0.99 | 1.5% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 350 | 8 | 1547 | 0.0% | 0.4% | 100% | 0.98 | 1.5% |

## big/cafe  [commercial]  x1 on Jolene

![big-cafe](big-cafe.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1660 | 9 | - |  |  |  | 1.00 | 1.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 386 | 9 | 200 | 0.0% | 0.3% | 100% | 1.01 | 1.4% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 294 | 8 | 1064 | 0.0% | 2.0% | 96% | 0.98 | 1.4% |

## big/cannery  [industrial]  x3 on Jolene

![big-cannery](big-cannery.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2880 | 9 | - |  |  |  | 1.00 | 1.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 538 | 9 | 500 | 0.0% | 0.3% | 100% | 1.01 | 1.2% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 402 | 8 | 2666 | 0.0% | 1.0% | 100% | 0.97 | 1.2% |

## big/fire hall  [official]  x1 on Jolene

![big-fire-hall](big-fire-hall.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2048 | 9 | - |  |  |  | 1.00 | 1.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 470 | 9 | 300 | 0.0% | 0.1% | 100% | 0.99 | 2.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 390 | 8 | 1601 | 0.0% | 0.2% | 100% | 0.94 | 2.1% |

## big/fuel shed  [airport s]  x3 on Jolene

![big-fuel-shed](big-fuel-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1202 | 10 | - |  |  |  | 1.00 | 1.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 362 | 9 | 161 | 0.0% | 0.1% | 100% | 1.00 | 1.9% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 266 | 7 | 859 | 0.0% | 0.4% | 99% | 1.03 | 1.0% |

## big/mine shop  [landmark]  x1 on Jolene

![big-mine-shop](big-mine-shop.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2212 | 8 | - |  |  |  | 1.00 | 6.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 474 | 8 | 270 | 0.0% | 0.3% | 100% | 1.00 | 6.7% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 398 | 7 | 1440 | 0.0% | 1.0% | 100% | 0.98 | 6.3% |

## big/motel  [commercial]

![big-motel](big-motel.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3132 | 10 | - |  |  |  | 1.00 | 0.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 634 | 9 | 343 | 0.0% | 0.1% | 100% | 1.00 | 1.2% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 458 | 7 | 1829 | 0.0% | 1.1% | 100% | 0.98 | 0.9% |

## big/store  [commercial]  x2 on Jolene

![big-store](big-store.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1732 | 9 | - |  |  |  | 1.00 | 1.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 394 | 9 | 230 | 0.0% | 0.2% | 100% | 1.02 | 2.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 302 | 8 | 1226 | 0.0% | 2.0% | 96% | 1.02 | 2.1% |

## big/swimming pool  [official]

![big-swimming-pool](big-swimming-pool.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2660 | 9 | - |  |  |  | 1.00 | 8.3% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 594 | 9 | 490 | 0.0% | 0.0% | 100% | 1.00 | 9.6% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 438 | 7 | 2614 | 0.0% | 0.1% | 100% | 0.98 | 9.6% |

## big/technical services  [airport m]  x2 on Jolene

![big-technical-services](big-technical-services.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2334 | 9 | - |  |  |  | 1.00 | 6.4% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 470 | 9 | 292 | 0.0% | 0.2% | 100% | 0.98 | 8.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 402 | 8 | 1556 | 0.0% | 0.3% | 100% | 0.92 | 8.0% |

## big/terminal  [airport m]  x2 on Jolene

![big-terminal](big-terminal.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3072 | 9 | - |  |  |  | 1.00 | 7.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 670 | 9 | 456 | 0.0% | 0.1% | 100% | 1.00 | 9.2% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 490 | 7 | 2434 | 0.0% | 0.8% | 100% | 0.94 | 9.1% |

## big/tram shed  [landmark]

![big-tram-shed](big-tram-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1566 | 8 | - |  |  |  | 1.00 | 4.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 418 | 8 | 277 | 0.0% | 0.1% | 100% | 0.98 | 4.4% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 382 | 7 | 1476 | 0.0% | 0.2% | 100% | 0.96 | 4.5% |

## big/warehouse  [industrial]  x3 on Jolene

![big-warehouse](big-warehouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2626 | 9 | - |  |  |  | 1.00 | 0.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 538 | 9 | 409 | 0.0% | 0.2% | 100% | 0.99 | 1.2% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 422 | 8 | 2181 | 0.0% | 0.7% | 100% | 1.00 | 1.2% |

## big/workshop  [industrial]  x3 on Jolene

![big-workshop](big-workshop.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1954 | 9 | - |  |  |  | 1.00 | 5.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 418 | 9 | 242 | 0.0% | 0.3% | 100% | 0.94 | 7.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 350 | 8 | 1292 | 0.0% | 0.6% | 100% | 0.91 | 7.2% |

## hangar/club hangar  [airport s]

![hangar-club-hangar](hangar-club-hangar.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3168 | 7 | - |  |  |  | 1.00 | 2.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 564 | 7 | 558 | 0.0% | 0.0% | 100% | 1.01 | 2.8% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 384 | 5 | 2975 | 0.0% | 0.1% | 98% | 1.12 | 2.8% |

## hangar/club hangar, long  [airport s]  x1 on Jolene

![hangar-club-hangar-long](hangar-club-hangar-long.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3382 | 7 | - |  |  |  | 1.00 | 3.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 564 | 7 | 567 | 0.0% | 0.1% | 100% | 1.01 | 4.6% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 384 | 5 | 3022 | 0.0% | 0.1% | 97% | 1.17 | 4.6% |

## hangar/field shed  [airport xs]  x1 on Jolene

![hangar-field-shed](hangar-field-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1494 | 7 | - |  |  |  | 1.00 | 1.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 430 | 7 | 337 | 0.0% | 0.1% | 100% | 0.93 | 1.2% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 238 | 5 | 1799 | 0.0% | 0.4% | 97% | 0.93 | 1.2% |

## hangar/field shed, small  [airport xs]  x1 on Jolene

![hangar-field-shed-small](hangar-field-shed-small.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1010 | 7 | - |  |  |  | 1.00 | 1.3% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 362 | 7 | 268 | 0.0% | 0.1% | 100% | 0.96 | 1.3% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 202 | 5 | 1431 | 0.0% | 0.3% | 97% | 0.95 | 1.3% |

## hangar/works hangar  [airport m]

![hangar-works-hangar](hangar-works-hangar.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3878 | 7 | - |  |  |  | 1.00 | 1.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 612 | 7 | 600 | 0.0% | 0.0% | 100% | 1.01 | 2.2% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 432 | 5 | 4215 | 0.0% | 0.1% | 100% | 1.12 | 2.2% |

## house/air taxi office  [commercial]  x2 on Jolene

![house-air-taxi-office](house-air-taxi-office.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 5118 | 10 | - |  |  |  | 1.00 | 31% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 660 | 9 | 216 | 0.0% | 0.1% | 98% | 0.77 | 36% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 530 | 7 | 1151 | 0.0% | 0.2% | 98% | 0.67 | 34% |

## house/bear tours  [commercial]  x1 on Jolene

![house-bear-tours](house-bear-tours.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 10452 | 11 | - |  |  |  | 1.00 | 14% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1008 | 9 | 216 | 0.0% | 0.6% | 100% | 0.95 | 15% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 618 | 7 | 1150 | 0.0% | 0.6% | 100% | 0.90 | 17% |

## house/bunkhouse  [residential]  x2 on Jolene

![house-bunkhouse](house-bunkhouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 14694 | 10 | - |  |  |  | 1.00 | 2.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1564 | 9 | 302 | 0.0% | 0.4% | 100% | 0.73 | 4.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 658 | 7 | 1611 | 0.0% | 0.4% | 99% | 0.82 | 0.4% |

## house/cafe  [commercial]  x4 on Jolene

![house-cafe](house-cafe.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 9528 | 11 | - |  |  |  | 1.00 | 36% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1034 | 9 | 231 | 0.0% | 0.4% | 100% | 0.80 | 40% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 568 | 7 | 1233 | 0.0% | 0.5% | 100% | 0.82 | 39% |

## house/cannery shed  [industrial]

![house-cannery-shed](house-cannery-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 29292 | 11 | - |  |  |  | 1.00 | 2.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2220 | 9 | 468 | 0.0% | 0.2% | 100% | 0.98 | 3.7% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 978 | 7 | 2496 | 0.0% | 0.5% | 98% | 0.99 | 0.0% |

## house/chapel  [official]  x2 on Jolene

![house-chapel](house-chapel.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 7940 | 11 | - |  |  |  | 1.00 | 1.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 613 | 10 | 212 | 0.0% | 0.1% | 99% | 1.06 | 2.3% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 433 | 8 | 1129 | 0.0% | 0.2% | 99% | 1.00 | 1.4% |

## house/church  [official]  x2 on Jolene

![house-church](house-church.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 7500 | 9 | - |  |  |  | 1.00 | 0.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 891 | 8 | 312 | 0.0% | 0.1% | 100% | 0.92 | 2.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 477 | 6 | 1665 | 0.0% | 0.1% | 99% | 0.74 | 0.4% |

## house/clinic  [official]  x5 on Jolene

![house-clinic](house-clinic.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 13176 | 9 | - |  |  |  | 1.00 | 2.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1396 | 9 | 388 | 0.0% | 0.3% | 100% | 0.95 | 3.8% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1054 | 7 | 2070 | 0.0% | 0.4% | 100% | 0.86 | 2.6% |

## house/clubhouse  [sports]

![house-clubhouse](house-clubhouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 5038 | 9 | - |  |  |  | 1.00 | 17% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 512 | 9 | 216 | 0.0% | 0.5% | 100% | 0.67 | 21% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 370 | 7 | 1151 | 0.0% | 0.6% | 100% | 0.48 | 22% |

## house/concession stand  [sports]

![house-concession-stand](house-concession-stand.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2526 | 12 | - |  |  |  | 1.00 | 1.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 336 | 9 | 124 | 0.0% | 0.0% | 97% | 0.94 | 2.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 222 | 7 | 662 | 0.0% | 0.0% | 97% | 0.86 | 2.2% |

## house/control tower  [airport m]

![house-control-tower](house-control-tower.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 13648 | 12 | - |  |  |  | 1.00 | 19% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1234 | 11 | 371 | 0.0% | 0.1% | 97% | 0.56 | 17% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 954 | 8 | 1980 | 0.0% | 0.3% | 97% | 0.47 | 18% |

## house/fish shack  [industrial]  x2 on Jolene

![house-fish-shack](house-fish-shack.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 7670 | 11 | - |  |  |  | 1.00 | 12% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1022 | 10 | 387 | 0.0% | 0.6% | 96% | 0.97 | 12% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 326 | 7 | 2065 | 0.0% | 0.4% | 91% | 0.77 | 0.0% |

## house/flight service  [airport m]

![house-flight-service](house-flight-service.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 7556 | 9 | - |  |  |  | 1.00 | 38% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 892 | 9 | 258 | 0.0% | 0.5% | 98% | 0.80 | 36% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 628 | 7 | 1375 | 0.0% | 0.5% | 98% | 0.65 | 37% |

## house/flying club  [airport s]  x1 on Jolene

![house-flying-club](house-flying-club.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 13882 | 12 | - |  |  |  | 1.00 | 1.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1274 | 9 | 315 | 0.0% | 0.8% | 100% | 0.97 | 1.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 652 | 6 | 1679 | 0.0% | 1.1% | 100% | 0.97 | 0.3% |

## house/fuel and bait  [commercial]  x1 on Jolene

![house-fuel-and-bait](house-fuel-and-bait.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4750 | 11 | - |  |  |  | 1.00 | 2.4% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 736 | 9 | 187 | 0.0% | 0.3% | 100% | 0.88 | 2.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 358 | 7 | 998 | 0.0% | 0.4% | 100% | 0.90 | 0.6% |

## house/gambrel barn  [shed]

![house-gambrel-barn](house-gambrel-barn.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 13326 | 11 | - |  |  |  | 1.00 | 2.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1058 | 10 | 293 | 0.0% | 0.0% | 100% | 0.98 | 6.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 640 | 8 | 1563 | 0.0% | 0.1% | 100% | 0.95 | 5.5% |

## house/garage  [shed]  x1 on Jolene

![house-garage](house-garage.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2464 | 8 | - |  |  |  | 1.00 | 1.3% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 380 | 8 | 155 | 0.0% | 0.0% | 100% | 0.87 | 1.5% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 330 | 6 | 827 | 0.0% | 0.0% | 100% | 0.85 | 1.9% |

## house/general store  [commercial]  x4 on Jolene

![house-general-store](house-general-store.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 6684 | 11 | - |  |  |  | 1.00 | 6.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 772 | 9 | 272 | 0.0% | 0.1% | 99% | 0.91 | 6.7% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 342 | 7 | 1450 | 0.0% | 0.1% | 99% | 0.90 | 4.8% |

## house/hip cottage  [residential]  x1 on Jolene

![house-hip-cottage](house-hip-cottage.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 11872 | 12 | - |  |  |  | 1.00 | 1.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 996 | 10 | 234 | 0.0% | 1.2% | 99% | 0.93 | 1.6% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 696 | 8 | 1247 | 0.0% | 1.4% | 99% | 0.82 | 1.8% |

## house/kennecott mill  [landmark]  x1 on Jolene

![house-kennecott-mill](house-kennecott-mill.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 114156 | 9 | - |  |  |  | 1.00 | 1.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 11404 | 10 | 600 | 0.0% | 0.4% | 95% | 0.91 | 2.3% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 6256 | 8 | 12376 | 0.0% | 0.8% | 95% | 0.00 | 2.1% |

## house/lighthouse  [official]

![house-lighthouse](house-lighthouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 13322 | 11 | - |  |  |  | 1.00 | 6.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1450 | 11 | 373 | 0.0% | 0.2% | 98% | 0.61 | 7.4% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1152 | 8 | 1991 | 0.0% | 0.4% | 98% | 0.44 | 6.5% |

## house/lighthouse octagon  [official]

![house-lighthouse-octagon](house-lighthouse-octagon.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 11810 | 9 | - |  |  |  | 1.00 | 8.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1122 | 10 | 301 | 0.0% | 0.1% | 100% | 0.82 | 10% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 976 | 8 | 1608 | 0.0% | 0.1% | 100% | 0.69 | 7.0% |

## house/log cabin  [residential]  x7 on Jolene

![house-log-cabin](house-log-cabin.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 9580 | 11 | - |  |  |  | 1.00 | 6.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 860 | 9 | 181 | 0.0% | 1.2% | 98% | 0.99 | 2.5% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 506 | 7 | 966 | 0.0% | 1.3% | 98% | 0.92 | 2.4% |

## house/marine supply  [commercial]  x2 on Jolene

![house-marine-supply](house-marine-supply.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 7634 | 10 | - |  |  |  | 1.00 | 4.6% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 964 | 8 | 273 | 0.0% | 0.3% | 100% | 0.95 | 4.8% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 414 | 6 | 1455 | 0.0% | 0.4% | 99% | 0.97 | 0.5% |

## house/mine bunkhouse  [residential]  x1 on Jolene

![house-mine-bunkhouse](house-mine-bunkhouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 19634 | 11 | - |  |  |  | 1.00 | 2.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1632 | 9 | 313 | 0.0% | 0.3% | 100% | 0.77 | 6.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 968 | 7 | 1669 | 0.0% | 0.3% | 100% | 0.82 | 0.2% |

## house/mine cottage  [residential]  x7 on Jolene

![house-mine-cottage](house-mine-cottage.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 9816 | 11 | - |  |  |  | 1.00 | 1.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 996 | 9 | 200 | 0.0% | 0.6% | 98% | 0.94 | 0.8% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 552 | 7 | 1065 | 0.0% | 0.7% | 98% | 0.93 | 0.7% |

## house/mine dormer hall  [landmark]  x1 on Jolene

![house-mine-dormer-hall](house-mine-dormer-hall.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 23148 | 11 | - |  |  |  | 1.00 | 2.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1888 | 9 | 425 | 0.0% | 0.1% | 100% | 0.99 | 3.8% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1180 | 7 | 2269 | 0.0% | 0.2% | 100% | 0.96 | 0.1% |

## house/mine mess hall  [landmark]  x1 on Jolene

![house-mine-mess-hall](house-mine-mess-hall.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 14516 | 12 | - |  |  |  | 1.00 | 1.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1188 | 9 | 313 | 0.0% | 0.5% | 98% | 1.03 | 3.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 536 | 7 | 1672 | 0.0% | 0.5% | 98% | 1.05 | 0.1% |

## house/mine office  [landmark]  x1 on Jolene

![house-mine-office](house-mine-office.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 12992 | 10 | - |  |  |  | 1.00 | 2.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1364 | 9 | 270 | 0.0% | 1.0% | 99% | 1.00 | 3.5% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 860 | 7 | 1440 | 0.0% | 1.2% | 99% | 0.92 | 0.3% |

## house/modern dark  [residential]

![house-modern-dark](house-modern-dark.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 11906 | 11 | - |  |  |  | 1.00 | 5.3% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 996 | 9 | 242 | 0.0% | 0.7% | 98% | 0.93 | 9.4% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 596 | 7 | 1292 | 0.0% | 0.8% | 98% | 0.91 | 1.9% |

## house/motel  [commercial]  x2 on Jolene

![house-motel](house-motel.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 13636 | 10 | - |  |  |  | 1.00 | 0.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1380 | 8 | 384 | 0.0% | 0.5% | 100% | 0.99 | 0.4% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 644 | 6 | 2046 | 0.0% | 0.6% | 100% | 0.98 | 0.1% |

## house/net loft  [industrial]

![house-net-loft](house-net-loft.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 12844 | 11 | - |  |  |  | 1.00 | 8.3% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1574 | 10 | 464 | 0.0% | 0.4% | 99% | 1.00 | 7.9% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 570 | 7 | 2474 | 0.0% | 0.2% | 95% | 1.13 | 0.0% |

## house/outhouse  [shed]  x1 on Jolene

![house-outhouse](house-outhouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1142 | 7 | - |  |  |  | 1.00 | 1.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 302 | 6 | 65 | 0.0% | 0.1% | 90% | 0.80 | 0.8% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 170 | 5 | 349 | 0.0% | 0.1% | 90% | 0.79 | 0.8% |

## house/over the water  [residential]

![house-over-the-water](house-over-the-water.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 15444 | 11 | - |  |  |  | 1.00 | 7.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1616 | 10 | 453 | 0.0% | 0.8% | 99% | 0.96 | 11% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 702 | 7 | 2416 | 0.0% | 0.4% | 97% | 1.16 | 0.1% |

## house/pilot hut  [airport xs]  x2 on Jolene

![house-pilot-hut](house-pilot-hut.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 9134 | 11 | - |  |  |  | 1.00 | 0.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 888 | 9 | 157 | 0.0% | 0.7% | 99% | 0.77 | 1.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 558 | 7 | 838 | 0.0% | 0.8% | 99% | 0.72 | 0.7% |

## house/police  [official]  x1 on Jolene

![house-police](house-police.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 10766 | 11 | - |  |  |  | 1.00 | 36% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1372 | 10 | 323 | 0.0% | 0.2% | 100% | 0.75 | 40% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1034 | 7 | 1724 | 0.0% | 0.6% | 100% | 0.58 | 41% |

## house/post office  [official]  x1 on Jolene

![house-post-office](house-post-office.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 9382 | 12 | - |  |  |  | 1.00 | 2.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1078 | 9 | 253 | 0.0% | 0.6% | 96% | 0.95 | 3.3% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 628 | 6 | 1351 | 0.0% | 1.1% | 96% | 0.87 | 1.2% |

## house/saltbox cottage  [residential]  x2 on Jolene

![house-saltbox-cottage](house-saltbox-cottage.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 10664 | 11 | - |  |  |  | 1.00 | 2.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1050 | 10 | 213 | 0.1% | 0.5% | 99% | 0.91 | 2.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 634 | 8 | 1135 | 0.1% | 0.6% | 99% | 0.93 | 0.5% |

## house/saltbox farmhouse  [residential]

![house-saltbox-farmhouse](house-saltbox-farmhouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 15448 | 11 | - |  |  |  | 1.00 | 5.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1306 | 10 | 252 | 0.0% | 0.3% | 100% | 0.84 | 6.9% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 894 | 8 | 1345 | 0.0% | 0.5% | 100% | 0.87 | 3.2% |

## house/school  [official]  x4 on Jolene

![house-school](house-school.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 20664 | 14 | - |  |  |  | 1.00 | 34% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1540 | 13 | 600 | 0.0% | 0.3% | 97% | 0.91 | 36% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1082 | 10 | 3440 | 0.0% | 0.4% | 97% | 0.71 | 35% |

## house/shore cabin  [residential]

![house-shore-cabin](house-shore-cabin.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 12896 | 11 | - |  |  |  | 1.00 | 7.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1016 | 9 | 258 | 0.0% | 0.6% | 98% | 0.81 | 5.9% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 570 | 7 | 1375 | 0.0% | 0.7% | 98% | 0.78 | 2.4% |

## house/storage shed  [shed]  x2 on Jolene

![house-storage-shed](house-storage-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4830 | 9 | - |  |  |  | 1.00 | 1.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 330 | 8 | 100 | 0.0% | 0.2% | 99% | 0.93 | 0.3% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 198 | 7 | 534 | 0.0% | 0.2% | 99% | 0.91 | 0.2% |

## house/town hall  [official]  x1 on Jolene

![house-town-hall](house-town-hall.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 17384 | 11 | - |  |  |  | 1.00 | 48% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1617 | 10 | 358 | 0.0% | 0.7% | 97% | 0.89 | 50% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1045 | 7 | 1908 | 0.0% | 1.0% | 97% | 0.60 | 52% |

## house/tram base station  [landmark]  x1 on Jolene

![house-tram-base-station](house-tram-base-station.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 32230 | 15 | - |  |  |  | 1.00 | 4.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 4152 | 15 | 582 | 0.0% | 0.4% | 99% | 0.92 | 5.6% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 3006 | 13 | 3105 | 0.0% | 1.3% | 99% | 0.87 | 8.0% |

## house/tram top station  [landmark]  x1 on Jolene

![house-tram-top-station](house-tram-top-station.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 47640 | 18 | - |  |  |  | 1.00 | 2.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 10396 | 18 | 600 | 0.1% | 1.2% | 100% | 0.95 | 2.7% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 9590 | 16 | 5453 | 0.1% | 1.3% | 100% | 0.00 | 0.8% |

## house/vet clinic  [official]

![house-vet-clinic](house-vet-clinic.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 7612 | 9 | - |  |  |  | 1.00 | 49% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 892 | 9 | 248 | 0.0% | 0.3% | 100% | 0.81 | 47% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 628 | 7 | 1321 | 0.0% | 0.4% | 100% | 0.54 | 48% |

## house/village church  [official]  x1 on Jolene

![house-village-church](house-village-church.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 8774 | 11 | - |  |  |  | 1.00 | 1.6% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 707 | 9 | 218 | 0.0% | 0.1% | 97% | 0.95 | 2.5% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 427 | 7 | 1163 | 0.0% | 0.1% | 97% | 0.95 | 0.1% |

## house/village house  [residential]

![house-village-house](house-village-house.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 13890 | 11 | - |  |  |  | 1.00 | 2.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1138 | 9 | 220 | 0.0% | 0.3% | 97% | 0.83 | 6.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 748 | 7 | 1171 | 0.0% | 0.3% | 97% | 0.95 | 0.2% |

## house/woodshed  [shed]

![house-woodshed](house-woodshed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 8310 | 9 | - |  |  |  | 1.00 | 14% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 324 | 7 | 93 | 0.0% | 0.6% | 96% | 0.83 | 20% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 132 | 6 | 494 | 0.5% | 1.8% | 96% | 0.85 | 22% |

## marine/boat harbour floats  [industrial]  x4 on Jolene

![marine-boat-harbour-floats](marine-boat-harbour-floats.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 8536 | 6 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 8536 | 6 | 600 | 0.2% | 0.0% | 100% | 1.00 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 8536 | 6 | 5682 | 0.2% | 0.0% | 100% | 0.00 | 0.0% |

## marine/breakwater  [landmark]  x15 on Jolene

![marine-breakwater](marine-breakwater.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2140 | 1 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2140 | 1 | 600 | 61% | 0.0% | 100% | 1.00 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 2140 | 1 | 8908 | 61% | 0.0% | 100% | 0.00 | 0.0% |

## marine/breakwater, light  [landmark]  x1 on Jolene

![marine-breakwater-light](marine-breakwater-light.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1288 | 3 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1288 | 3 | 600 | 59% | 0.0% | 100% | 1.00 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1288 | 3 | 5515 | 59% | 0.0% | 100% | 0.00 | 0.0% |

## marine/landing float  [industrial]  x1 on Jolene

![marine-landing-float](marine-landing-float.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1268 | 6 | - |  |  |  | 1.00 | 0.9% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1268 | 6 | 479 | 0.7% | 0.0% | 100% | 1.00 | 0.9% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1268 | 6 | 2556 | 0.7% | 0.0% | 100% | 1.04 | 0.9% |

## marine/net pens  [industrial]  x3 on Jolene

![marine-net-pens](marine-net-pens.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 11636 | 5 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 11556 | 4 | 600 | 0.0% | 0.0% | 52% | 2.41 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 11556 | 4 | 5450 | 0.0% | 0.0% | 52% | 0.00 | 0.0% |

## marine/net pens, large  [industrial]  x2 on Jolene

![marine-net-pens-large](marine-net-pens-large.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 22506 | 5 | - |  |  |  | 1.00 | 0.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 22356 | 4 | 600 | 0.0% | 0.0% | 41% | 2.79 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 22356 | 4 | 7355 | 0.0% | 0.0% | 41% | 0.00 | 0.0% |

## marine/seaplane float  [airport s]  x1 on Jolene

![marine-seaplane-float](marine-seaplane-float.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3396 | 6 | - |  |  |  | 1.00 | 0.7% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 3396 | 6 | 600 | 0.4% | 0.0% | 100% | 1.00 | 0.7% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 3396 | 6 | 3523 | 0.4% | 0.0% | 100% | 1.04 | 0.7% |

## marine/trestle pier  [industrial]  x7 on Jolene

![marine-trestle-pier](marine-trestle-pier.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4100 | 5 | - |  |  |  | 1.00 | 0.3% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 4100 | 5 | 600 | 0.0% | 0.0% | 96% | 1.00 | 0.3% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 4100 | 5 | 5129 | 0.0% | 0.0% | 96% | 0.00 | 0.3% |

## marine/trestle pier, long  [industrial]  x2 on Jolene

![marine-trestle-pier-long](marine-trestle-pier-long.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 6264 | 5 | - |  |  |  | 1.00 | 0.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 6264 | 5 | 600 | 0.0% | 0.0% | 97% | 1.00 | 0.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 6264 | 5 | 9344 | 0.0% | 0.0% | 97% | 0.00 | 0.1% |

## marine/wharf deck  [industrial]  x3 on Jolene

![marine-wharf-deck](marine-wharf-deck.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 5692 | 5 | - |  |  |  | 1.00 | 0.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 5692 | 5 | 600 | 0.0% | 0.0% | 100% | 1.00 | 0.2% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 5692 | 5 | 3826 | 0.0% | 0.0% | 100% | 0.85 | 0.2% |

## marine/wharf deck, small  [industrial]  x2 on Jolene

![marine-wharf-deck-small](marine-wharf-deck-small.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2960 | 5 | - |  |  |  | 1.00 | 0.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2960 | 5 | 410 | 0.0% | 0.0% | 99% | 1.00 | 0.5% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 2960 | 5 | 2184 | 0.0% | 0.0% | 99% | 0.83 | 0.5% |

## navaid/DVOR-DME  [landmark]  x1 on Jolene

![navaid-dvor-dme](navaid-dvor-dme.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4392 | 7 | - |  |  |  | 1.00 | 0.2% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2224 | 7 | 600 | 0.0% | 0.0% | 99% | 0.99 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1276 | 6 | 4976 | 0.0% | 0.1% | 99% | 0.98 | 0.0% |

## navaid/DVOR-DME compact  [landmark]

![navaid-dvor-dme-compact](navaid-dvor-dme-compact.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4316 | 7 | - |  |  |  | 1.00 | 0.5% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2176 | 7 | 600 | 0.0% | 0.1% | 100% | 1.01 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1264 | 6 | 3428 | 0.1% | 0.8% | 100% | 0.96 | 0.0% |

## shed/lean-to  [shed]

![shed-lean-to](shed-lean-to.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4370 | 6 | - |  |  |  | 1.00 | 30% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 202 | 5 | 69 | 0.1% | 0.2% | 93% | 0.77 | 35% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 190 | 4 | 370 | 0.1% | 0.5% | 93% | 0.64 | 34% |

## shed/net store  [shed]  x1 on Jolene

![shed-net-store](shed-net-store.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2054 | 8 | - |  |  |  | 1.00 | 0.4% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 316 | 6 | 108 | 0.0% | 0.0% | 100% | 1.04 | 0.4% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 244 | 5 | 578 | 0.0% | 0.0% | 100% | 1.04 | 0.3% |

## shed/tool shed  [shed]  x5 on Jolene

![shed-tool-shed](shed-tool-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 5090 | 6 | - |  |  |  | 1.00 | 32% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 204 | 4 | 63 | 0.1% | 0.3% | 100% | 0.38 | 52% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 204 | 4 | 334 | 0.1% | 0.3% | 100% | 0.45 | 52% |

## shed/trapper cabin  [shed]

![shed-trapper-cabin](shed-trapper-cabin.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 11030 | 8 | - |  |  |  | 1.00 | 38% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 364 | 7 | 98 | 0.0% | 0.3% | 100% | 0.80 | 43% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 292 | 6 | 523 | 0.0% | 0.3% | 100% | 0.77 | 44% |

## shed/wood shed  [shed]  x1 on Jolene

![shed-wood-shed](shed-wood-shed.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4860 | 5 | - |  |  |  | 1.00 | 34% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 202 | 5 | 79 | 0.3% | 0.2% | 100% | 0.78 | 36% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 190 | 4 | 423 | 0.3% | 0.8% | 100% | 0.61 | 35% |

## sport/ball park, lit  [sports]  x1 on Jolene

![sport-ball-park-lit](sport-ball-park-lit.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3591 | 7 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1871 | 6 | 600 | 0.0% | 0.3% | 93% | 0.99 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1871 | 6 | 11079 | 0.0% | 0.3% | 93% | 0.00 | 0.0% |

## sport/baseball diamond  [sports]

![sport-baseball-diamond](sport-baseball-diamond.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 913 | 7 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 733 | 6 | 600 | 0.0% | 0.2% | 100% | 0.99 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 733 | 6 | 7229 | 0.0% | 0.2% | 100% | 0.00 | 0.0% |

## sport/gravel pitch  [sports]

![sport-gravel-pitch](sport-gravel-pitch.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 296 | 3 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 200 | 3 | 600 | 0.0% | 0.0% | 100% | 1.00 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 200 | 3 | 4589 | 0.0% | 0.0% | 100% | 0.99 | 0.0% |

## sport/hard court  [sports]  x1 on Jolene

![sport-hard-court](sport-hard-court.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1086 | 5 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 548 | 4 | 515 | 0.2% | 7.7% | 100% | 0.87 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 548 | 4 | 2749 | 0.2% | 7.7% | 100% | 0.86 | 0.0% |

## sport/running track  [sports]

![sport-running-track](sport-running-track.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 5268 | 7 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 3724 | 6 | 600 | 0.0% | 0.2% | 82% | 1.00 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 3724 | 6 | 11832 | 0.0% | 0.2% | 82% | 0.00 | 0.0% |

## sport/soccer field  [sports]

![sport-soccer-field](sport-soccer-field.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1164 | 6 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 668 | 5 | 600 | 0.0% | 0.2% | 51% | 1.00 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 668 | 5 | 5979 | 0.0% | 0.2% | 51% | 0.00 | 0.0% |

## sport/soccer, turf, lit  [sports]

![sport-soccer-turf-lit](sport-soccer-turf-lit.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2866 | 6 | - |  |  |  | 1.00 | 0.0% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1420 | 5 | 600 | 0.0% | 0.8% | 53% | 0.99 | 0.0% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1420 | 5 | 6549 | 0.0% | 0.8% | 53% | 0.00 | 0.0% |

## tower/WWII tower  [landmark]  x1 on Jolene

![tower-wwii-tower](tower-wwii-tower.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2108 | 7 | - |  |  |  | 1.00 | 20% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1268 | 6 | 235 | 4.4% | 1.7% | 99% | 1.12 | 19% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1268 | 6 | 1252 | 4.4% | 1.7% | 99% | 1.04 | 19% |

## tower/block tower  [airport s]

![tower-block-tower](tower-block-tower.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3738 | 9 | - |  |  |  | 1.00 | 10% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1686 | 8 | 203 | 0.6% | 0.8% | 100% | 1.00 | 19% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1686 | 8 | 1080 | 0.6% | 0.8% | 100% | 0.82 | 19% |

## tower/club tower  [airport s]

![tower-club-tower](tower-club-tower.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3214 | 9 | - |  |  |  | 1.00 | 10% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2362 | 9 | 211 | 0.1% | 0.5% | 98% | 0.98 | 11% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 2334 | 8 | 1124 | 0.1% | 0.6% | 98% | 0.94 | 11% |

## tower/field cab  [airport xs]

![tower-field-cab](tower-field-cab.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2248 | 11 | - |  |  |  | 1.00 | 13% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1392 | 11 | 190 | 0.2% | 0.3% | 100% | 1.04 | 14% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1316 | 9 | 1015 | 0.1% | 0.4% | 100% | 0.87 | 15% |

## tower/hut tower  [airport s]

![tower-hut-tower](tower-hut-tower.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 3130 | 10 | - |  |  |  | 1.00 | 9.1% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1214 | 10 | 193 | 1.2% | 1.2% | 100% | 0.75 | 9.7% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 1138 | 8 | 1028 | 1.1% | 1.6% | 98% | 0.66 | 10% |

## tower/lookout cab  [airport xs]

![tower-lookout-cab](tower-lookout-cab.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 2762 | 10 | - |  |  |  | 1.00 | 8.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2174 | 10 | 196 | 0.1% | 0.5% | 97% | 0.95 | 9.6% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 2154 | 9 | 1043 | 0.1% | 0.7% | 97% | 0.86 | 10% |

## tower/regional tower  [airport m]

![tower-regional-tower](tower-regional-tower.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 4624 | 9 | - |  |  |  | 1.00 | 17% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 2874 | 8 | 287 | 0.5% | 0.6% | 100% | 0.96 | 29% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 2874 | 8 | 1530 | 0.5% | 0.6% | 100% | 0.83 | 29% |

## utility/hydro powerhouse  [landmark]

![utility-hydro-powerhouse](utility-hydro-powerhouse.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 1384 | 8 | - |  |  |  | 1.00 | 2.3% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 1000 | 8 | 565 | 0.3% | 0.1% | 100% | 1.01 | 2.1% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 960 | 7 | 3012 | 0.3% | 0.1% | 100% | 0.90 | 2.1% |

## meteo/meteo station  [landmark]

![meteo-meteo-station](meteo-meteo-station.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 36298 | 16 | - |  |  |  | 1.00 | 21% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 6120 | 13 | 600 | 0.1% | 0.3% | 100% | 1.01 | 26% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 6120 | 13 | 4594 | 0.1% | 0.3% | 100% | 0.76 | 26% |

## meteo/meteo station 1974  [landmark]

![meteo-meteo-station-1974](meteo-meteo-station-1974.jpg)

| rung | tris | meshes | from m | leak | hole | roof | light | black |
|---|---|---|---|---|---|---|---|---|
| NEAR (lod 0) | 36924 | 15 | - |  |  |  | 1.00 | 9.8% |
| GAME FAR: ITS LOD 1, ON ITS FINISH | 6160 | 13 | 600 | 0.1% | 0.4% | 100% | 0.99 | 13% |
| GAME FAR, PAST THE DETAIL BAND: LESS ITS DETAIL ROLES | 6160 | 13 | 4632 | 0.1% | 0.4% | 100% | 0.84 | 13% |

