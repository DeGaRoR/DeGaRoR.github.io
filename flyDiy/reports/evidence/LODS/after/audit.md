# LODS audit - every far rung of every generated asset of the editor's catalogue (tools/lods_audit.js)

n = how many Jolene places. The rungs are the game's since LODS-2026-10: R1 its own lod 1, R2 that less its generator's LOD_DETAIL roles, both on the real finish (the BEFORE table: ../audit.md). Open structures (marine, sports) are listed but are not closed volumes.

leak = share of the covered view whose nearest surface is a back face (the eye looks INTO the building: black); hole = share of the near view where the rung shows something > max(1.5 m, R/10) behind the near outside (see-through, a missing roof or storey); roof = share of the near roofed plan still roofed from above; iou = silhouette against the near mesh (25 views); open = welded edges used once (m).

| building | n | path | near tris | rung | at m | tris | leak | hole | worst view | roof | iou | open m | bags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| big/athletic centre | 0 | item | 3440 | R1: its lod 1 | 600 | 578 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 2334 | wall plinth roof door metal glass sign trim beam pane |
|  |  |  |  | R2: lod 1 less its detail roles | 3320 | 506 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 2334 | wall plinth roof door glass sign trim pane |
| big/boat shed | 3 | item | 1752 | R1: its lod 1 | 290 | 422 | 0.0% | 0.2% | 157.5/35 0.0% | 100% | 1.00 | 925 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1547 | 350 | 0.0% | 0.3% | 157.5/35 0.0% | 100% | 1.00 | 925 | wall plinth roof door glass sign trim pane |
| big/cafe | 1 | item | 1660 | R1: its lod 1 | 200 | 386 | 0.0% | 0.3% | 135/60 0.0% | 100% | 1.00 | 601 | wall plinth roof metal glass sign awning trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1064 | 294 | 0.0% | 2.0% | 135/60 0.0% | 96% | 0.99 | 601 | wall plinth roof glass sign awning trim pane |
| big/cannery | 3 | item | 2880 | R1: its lod 1 | 500 | 538 | 0.0% | 0.3% | 135/60 0.0% | 100% | 1.00 | 1492 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2666 | 402 | 0.0% | 1.0% | 135/60 0.0% | 100% | 0.99 | 1492 | wall plinth roof door glass sign trim pane |
| big/fire hall | 1 | item | 2048 | R1: its lod 1 | 300 | 470 | 0.0% | 0.1% | 22.5/35 0.0% | 100% | 1.00 | 1046 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1601 | 390 | 0.0% | 0.2% | 22.5/35 0.0% | 100% | 1.00 | 1046 | wall plinth roof door glass sign trim pane |
| big/fuel shed | 3 | item | 1202 | R1: its lod 1 | 161 | 362 | 0.0% | 0.1% | 45/12 0.0% | 100% | 1.00 | 381 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | R2: lod 1 less its detail roles | 859 | 266 | 0.0% | 0.4% | 135/60 0.0% | 99% | 0.99 | 381 | wall plinth roof glass sign trim pane |
| big/mine shop | 1 | item | 2212 | R1: its lod 1 | 270 | 474 | 0.0% | 0.3% | 0/0 0.0% | 100% | 1.00 | 937 | wall plinth roof door metal glass trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1440 | 398 | 0.0% | 1.0% | 0/0 0.0% | 100% | 0.99 | 937 | wall plinth roof door glass trim pane |
| big/motel | 0 | item | 3132 | R1: its lod 1 | 343 | 634 | 0.0% | 0.1% | 45/60 0.0% | 100% | 1.00 | 915 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1829 | 458 | 0.0% | 1.1% | 45/60 0.0% | 100% | 0.99 | 915 | wall plinth roof glass sign trim pane |
| big/store | 2 | item | 1732 | R1: its lod 1 | 230 | 394 | 0.0% | 0.2% | 135/12 0.0% | 100% | 1.00 | 682 | wall plinth roof metal glass sign awning trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1226 | 302 | 0.0% | 2.0% | 135/12 0.0% | 96% | 0.99 | 682 | wall plinth roof glass sign awning trim pane |
| big/swimming pool | 0 | item | 2660 | R1: its lod 1 | 490 | 594 | 0.0% | 0.0% | 135/12 0.0% | 100% | 1.00 | 1819 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2614 | 438 | 0.0% | 0.2% | 135/12 0.0% | 100% | 1.00 | 1819 | wall plinth roof glass sign trim pane |
| big/technical services | 2 | item | 2334 | R1: its lod 1 | 292 | 470 | 0.0% | 0.2% | 225/12 0.0% | 100% | 1.00 | 1063 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1556 | 402 | 0.0% | 0.3% | 135/12 0.0% | 100% | 1.00 | 1063 | wall plinth roof door glass sign trim pane |
| big/terminal | 2 | item | 3072 | R1: its lod 1 | 456 | 670 | 0.0% | 0.1% | 202.5/35 0.0% | 100% | 1.00 | 1566 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2434 | 490 | 0.0% | 0.8% | 202.5/35 0.0% | 100% | 0.99 | 1566 | wall plinth roof glass sign trim pane |
| big/tram shed | 0 | item | 1566 | R1: its lod 1 | 277 | 418 | 0.0% | 0.1% | 45/12 0.0% | 100% | 1.00 | 1108 | wall plinth roof door metal glass trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1476 | 382 | 0.0% | 0.2% | 45/12 0.0% | 100% | 1.00 | 1108 | wall plinth roof door glass trim pane |
| big/warehouse | 3 | item | 2626 | R1: its lod 1 | 409 | 538 | 0.0% | 0.2% | 0/0 0.0% | 100% | 1.00 | 1246 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2181 | 422 | 0.0% | 0.7% | 0/0 0.0% | 100% | 0.99 | 1246 | wall plinth roof door glass sign trim pane |
| big/workshop | 3 | item | 1954 | R1: its lod 1 | 242 | 418 | 0.0% | 0.3% | 225/12 0.0% | 100% | 1.00 | 840 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1292 | 350 | 0.0% | 0.6% | 135/12 0.0% | 100% | 1.00 | 840 | wall plinth roof door glass sign trim pane |
| hangar/club hangar | 0 | item | 3168 | R1: its lod 1 | 558 | 564 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 1582 | wall stem roof door metal trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2975 | 384 | 0.0% | 0.1% | 247.5/35 0.0% | 98% | 0.99 | 1580 | wall stem roof door pane |
| hangar/club hangar, long | 1 | item | 3382 | R1: its lod 1 | 567 | 564 | 0.0% | 0.1% | 0/0 0.0% | 100% | 1.00 | 1583 | wall stem roof door metal trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 3022 | 384 | 0.0% | 0.1% | 225/12 0.1% | 97% | 0.99 | 1581 | wall stem roof door pane |
| hangar/field shed | 1 | item | 1494 | R1: its lod 1 | 337 | 430 | 0.0% | 0.1% | 0/0 0.0% | 100% | 1.00 | 715 | wall stem roof door metal trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1799 | 238 | 0.0% | 0.4% | 0/0 0.0% | 97% | 0.99 | 713 | wall stem roof door pane |
| hangar/field shed, small | 1 | item | 1010 | R1: its lod 1 | 268 | 362 | 0.0% | 0.1% | 0/0 0.0% | 100% | 1.00 | 537 | wall stem roof door metal trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1431 | 202 | 0.0% | 0.3% | 0/0 0.0% | 97% | 0.99 | 535 | wall stem roof door pane |
| hangar/works hangar | 0 | item | 3878 | R1: its lod 1 | 600 | 612 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 2308 | wall stem roof door metal trim pane |
|  |  |  |  | R2: lod 1 less its detail roles | 4215 | 432 | 0.0% | 0.1% | 225/12 0.0% | 100% | 1.00 | 2306 | wall stem roof door pane |
| house/air taxi office | 2 | item | 5118 | R1: its lod 1 | 216 | 660 | 0.0% | 0.1% | 270/12 0.1% | 98% | 0.99 | 120 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1151 | 530 | 0.0% | 0.2% | 270/12 0.1% | 98% | 0.98 | 92 | siding trim roof deck stone metal floor |
| house/bear tours | 1 | item | 10452 | R1: its lod 1 | 216 | 1008 | 0.0% | 0.6% | 0/0 0.0% | 100% | 0.96 | 99 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1150 | 618 | 0.0% | 0.6% | 0/0 0.0% | 99% | 0.93 | 86 | siding trim roof deck metal floor log |
| house/bunkhouse | 2 | item | 14694 | R1: its lod 1 | 302 | 1564 | 0.0% | 0.4% | 0/0 0.0% | 100% | 0.98 | 239 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1611 | 658 | 0.0% | 0.4% | 0/0 0.0% | 99% | 0.93 | 178 | siding trim roof deck metal floor log |
| house/cafe | 4 | item | 9528 | R1: its lod 1 | 231 | 1034 | 0.0% | 0.4% | 292.5/35 0.0% | 100% | 0.97 | 145 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 1233 | 568 | 0.0% | 0.5% | 292.5/35 0.0% | 100% | 0.95 | 117 | siding trim roof deck metal floor awning |
| house/cannery shed | 0 | item | 29292 | R1: its lod 1 | 468 | 2220 | 0.0% | 0.2% | 180/60 0.1% | 100% | 0.99 | 464 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 2496 | 978 | 0.0% | 0.5% | 247.5/35 0.0% | 98% | 0.96 | 274 | siding trim roof deck metal floor log |
| house/chapel | 2 | item | 7854 | R1: its lod 1 | 204 | 635 | 0.0% | 0.1% | 180/12 0.1% | 100% | 0.98 | 134 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1088 | 383 | 0.0% | 0.1% | 180/12 0.1% | 100% | 0.96 | 111 | siding trim roof deck metal floor log |
| house/church | 2 | item | 7500 | R1: its lod 1 | 312 | 891 | 0.0% | 0.1% | 90/12 0.2% | 99% | 0.98 | 219 | siding trim roof deck post metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1665 | 477 | 0.0% | 0.1% | 90/12 0.2% | 99% | 0.96 | 175 | siding trim roof deck metal floor |
| house/clinic | 5 | item | 13176 | R1: its lod 1 | 388 | 1396 | 0.0% | 0.3% | 45/12 0.1% | 100% | 0.99 | 360 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2070 | 1054 | 0.0% | 0.4% | 45/12 0.1% | 100% | 0.99 | 313 | siding trim roof deck stone metal floor |
| house/clubhouse | 0 | item | 5038 | R1: its lod 1 | 216 | 512 | 0.0% | 0.5% | 135/12 0.0% | 100% | 0.99 | 146 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1151 | 370 | 0.0% | 0.6% | 135/12 0.0% | 100% | 0.98 | 130 | siding trim roof deck stone metal floor |
| house/concession stand | 0 | item | 2526 | R1: its lod 1 | 124 | 336 | 0.0% | 0.0% | 0/0 0.0% | 97% | 0.98 | 88 | siding trim roof deck post stone floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 662 | 222 | 0.0% | 0.0% | 0/0 0.0% | 97% | 0.98 | 74 | siding trim roof deck stone floor awning |
| house/control tower | 0 | item | 13648 | R1: its lod 1 | 371 | 1234 | 0.0% | 0.1% | 112.5/35 0.0% | 97% | 0.99 | 366 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1980 | 954 | 0.0% | 0.3% | 112.5/35 0.0% | 97% | 0.98 | 304 | siding trim roof glass deck stone metal floor |
| house/fish shack | 2 | item | 7670 | R1: its lod 1 | 387 | 1022 | 0.0% | 0.6% | 292.5/35 0.2% | 96% | 0.93 | 95 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | R2: lod 1 less its detail roles | 2065 | 326 | 0.0% | 0.4% | 0/0 0.0% | 91% | 0.69 | 76 | siding trim roof deck metal floor log |
| house/flight service | 0 | item | 7556 | R1: its lod 1 | 258 | 892 | 0.0% | 0.5% | 180/60 0.1% | 98% | 0.99 | 162 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1375 | 628 | 0.0% | 0.6% | 180/60 0.1% | 98% | 0.99 | 126 | siding trim roof deck stone metal floor |
| house/flying club | 1 | item | 13882 | R1: its lod 1 | 315 | 1274 | 0.0% | 0.8% | 0/0 0.0% | 100% | 0.98 | 182 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1679 | 652 | 0.0% | 1.1% | 0/0 0.0% | 100% | 0.96 | 132 | siding trim roof deck metal floor |
| house/fuel and bait | 1 | item | 4750 | R1: its lod 1 | 187 | 736 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.96 | 100 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 998 | 358 | 0.0% | 0.4% | 0/0 0.0% | 100% | 0.91 | 85 | siding trim roof deck metal floor awning |
| house/gambrel barn | 0 | item | 13326 | R1: its lod 1 | 293 | 1058 | 0.0% | 0.0% | 90/60 0.0% | 100% | 0.99 | 346 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1563 | 640 | 0.0% | 0.1% | 90/60 0.0% | 100% | 0.99 | 304 | siding trim roof deck stone metal floor log |
| house/garage | 1 | item | 2464 | R1: its lod 1 | 155 | 380 | 0.0% | 0.0% | 270/12 0.1% | 100% | 1.00 | 85 | siding trim roof post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 827 | 330 | 0.0% | 0.0% | 270/12 0.1% | 100% | 1.00 | 82 | siding trim roof stone metal floor |
| house/general store | 4 | item | 6684 | R1: its lod 1 | 272 | 772 | 0.0% | 0.1% | 0/0 0.0% | 99% | 0.98 | 233 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 1450 | 342 | 0.0% | 0.1% | 0/0 0.0% | 99% | 0.96 | 201 | siding trim roof deck metal floor awning |
| house/hip cottage | 1 | item | 11872 | R1: its lod 1 | 234 | 996 | 0.0% | 1.2% | 270/12 0.1% | 99% | 0.98 | 133 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1247 | 696 | 0.0% | 1.4% | 270/12 0.1% | 99% | 0.98 | 105 | siding trim roof deck stone metal floor log |
| house/kennecott mill | 1 | item | 113532 | R1: its lod 1 | 600 | 11404 | 0.0% | 0.5% | 0/0 0.0% | 95% | 0.95 | 3041 | siding trim roof glass deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 11420 | 6256 | 0.0% | 1.0% | 157.5/35 0.2% | 95% | 0.92 | 2215 | siding trim roof glass deck stone metal floor |
| house/lighthouse | 0 | item | 13322 | R1: its lod 1 | 373 | 1450 | 0.0% | 0.2% | 22.5/35 0.1% | 98% | 0.99 | 345 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1991 | 1152 | 0.0% | 0.4% | 22.5/35 0.1% | 98% | 0.98 | 300 | siding trim roof glass deck stone metal floor |
| house/lighthouse octagon | 0 | item | 11810 | R1: its lod 1 | 301 | 1122 | 0.0% | 0.1% | 270/12 0.1% | 100% | 1.00 | 310 | siding trim roof glass deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1608 | 976 | 0.0% | 0.1% | 270/12 0.1% | 100% | 1.00 | 221 | siding trim roof glass deck stone metal floor |
| house/log cabin | 7 | item | 9580 | R1: its lod 1 | 181 | 860 | 0.0% | 1.2% | 0/0 0.0% | 98% | 0.96 | 90 | siding trim roof deck post stone floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 966 | 506 | 0.0% | 1.3% | 0/0 0.0% | 98% | 0.94 | 79 | siding trim roof deck stone floor log |
| house/marine supply | 2 | item | 7634 | R1: its lod 1 | 273 | 964 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.97 | 182 | siding trim roof deck post metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1455 | 414 | 0.0% | 0.4% | 0/0 0.0% | 99% | 0.94 | 154 | siding trim roof deck metal floor |
| house/mine bunkhouse | 1 | item | 19272 | R1: its lod 1 | 313 | 1548 | 0.0% | 0.3% | 112.5/35 0.1% | 100% | 0.99 | 367 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1669 | 942 | 0.0% | 0.3% | 112.5/35 0.1% | 100% | 0.98 | 235 | siding trim roof deck metal floor log |
| house/mine cottage | 7 | item | 9816 | R1: its lod 1 | 200 | 996 | 0.0% | 0.6% | 112.5/35 0.1% | 98% | 0.97 | 132 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1065 | 552 | 0.0% | 0.6% | 112.5/35 0.1% | 98% | 0.96 | 110 | siding trim roof deck metal floor log |
| house/mine dormer hall | 1 | item | 22630 | R1: its lod 1 | 420 | 1790 | 0.0% | 0.2% | 112.5/35 0.1% | 100% | 0.99 | 393 | siding trim roof deck post stone floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 2242 | 1142 | 0.0% | 0.2% | 112.5/35 0.1% | 100% | 0.98 | 242 | siding trim roof deck stone floor log |
| house/mine mess hall | 1 | item | 14028 | R1: its lod 1 | 306 | 1090 | 0.0% | 0.7% | 0/0 0.0% | 98% | 0.98 | 204 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1633 | 498 | 0.0% | 0.7% | 0/0 0.0% | 98% | 0.96 | 135 | siding trim roof deck metal floor log |
| house/mine office | 1 | item | 12992 | R1: its lod 1 | 270 | 1364 | 0.0% | 1.0% | 292.5/35 0.0% | 99% | 0.98 | 217 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1440 | 860 | 0.0% | 1.2% | 292.5/35 0.0% | 99% | 0.97 | 134 | siding trim roof deck stone metal floor |
| house/modern dark | 0 | item | 11906 | R1: its lod 1 | 242 | 996 | 0.0% | 0.7% | 90/12 0.0% | 98% | 0.97 | 209 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1292 | 596 | 0.0% | 0.8% | 90/12 0.1% | 98% | 0.94 | 139 | siding trim roof deck metal floor log |
| house/motel | 2 | item | 13636 | R1: its lod 1 | 384 | 1380 | 0.0% | 0.5% | 90/60 0.1% | 100% | 0.99 | 228 | siding trim roof deck post metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2046 | 644 | 0.0% | 0.6% | 90/60 0.1% | 100% | 0.97 | 191 | siding trim roof deck metal floor |
| house/net loft | 0 | item | 12844 | R1: its lod 1 | 464 | 1574 | 0.0% | 0.4% | 135/60 0.1% | 99% | 0.96 | 176 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | R2: lod 1 less its detail roles | 2474 | 570 | 0.0% | 0.2% | 0/0 0.0% | 95% | 0.82 | 115 | siding trim roof deck metal floor log |
| house/outhouse | 1 | item | 1142 | R1: its lod 1 | 65 | 302 | 0.0% | 0.1% | 0/0 0.0% | 90% | 0.96 | 36 | siding trim roof deck post floor |
|  |  |  |  | R2: lod 1 less its detail roles | 349 | 170 | 0.0% | 0.1% | 0/0 0.0% | 90% | 0.92 | 36 | siding trim roof deck floor |
| house/over the water | 0 | item | 15444 | R1: its lod 1 | 453 | 1616 | 0.0% | 0.8% | 270/60 0.2% | 99% | 0.95 | 203 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | R2: lod 1 less its detail roles | 2416 | 702 | 0.0% | 0.4% | 247.5/35 0.2% | 97% | 0.77 | 99 | siding trim roof deck metal floor log |
| house/pilot hut | 2 | item | 9134 | R1: its lod 1 | 157 | 888 | 0.0% | 0.7% | 0/0 0.0% | 99% | 0.96 | 84 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 838 | 558 | 0.0% | 0.8% | 0/0 0.0% | 99% | 0.93 | 72 | siding trim roof deck metal floor log |
| house/police | 1 | item | 10766 | R1: its lod 1 | 323 | 1372 | 0.0% | 0.2% | 157.5/35 0.1% | 100% | 0.99 | 301 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1724 | 1034 | 0.0% | 0.6% | 157.5/35 0.1% | 100% | 0.98 | 274 | siding trim roof deck stone metal floor |
| house/post office | 1 | item | 9382 | R1: its lod 1 | 253 | 1078 | 0.0% | 0.6% | 270/12 0.1% | 96% | 0.97 | 142 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1351 | 628 | 0.0% | 1.1% | 270/12 0.1% | 96% | 0.94 | 105 | siding trim roof deck metal floor |
| house/saltbox cottage | 2 | item | 10664 | R1: its lod 1 | 213 | 1050 | 0.1% | 0.5% | 247.5/35 0.3% | 99% | 0.97 | 155 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1135 | 634 | 0.1% | 0.6% | 247.5/35 0.3% | 99% | 0.95 | 138 | siding trim roof deck stone metal floor log |
| house/saltbox farmhouse | 0 | item | 15448 | R1: its lod 1 | 252 | 1306 | 0.0% | 0.3% | 112.5/35 0.1% | 100% | 0.98 | 273 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1345 | 894 | 0.0% | 0.5% | 112.5/35 0.1% | 100% | 0.97 | 190 | siding trim roof deck stone metal floor log |
| house/school | 4 | item | 20664 | R1: its lod 1 | 600 | 1540 | 0.0% | 0.3% | 0/0 0.0% | 97% | 0.99 | 485 | siding trim roof deck post stone metal floor pane flag siding2 trim2 roof2 |
|  |  |  |  | R2: lod 1 less its detail roles | 3440 | 1082 | 0.0% | 0.4% | 0/0 0.0% | 97% | 0.99 | 382 | siding trim roof deck stone metal floor siding2 trim2 roof2 |
| house/shore cabin | 0 | item | 12896 | R1: its lod 1 | 258 | 1016 | 0.0% | 0.6% | 270/60 0.0% | 98% | 0.97 | 138 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1375 | 570 | 0.0% | 0.7% | 270/60 0.0% | 98% | 0.93 | 102 | siding trim roof deck metal floor log |
| house/storage shed | 2 | item | 4830 | R1: its lod 1 | 100 | 330 | 0.0% | 0.2% | 0/0 0.0% | 99% | 0.96 | 48 | siding trim roof deck post metal floor log |
|  |  |  |  | R2: lod 1 less its detail roles | 534 | 198 | 0.0% | 0.2% | 0/0 0.0% | 99% | 0.93 | 48 | siding trim roof deck metal floor log |
| house/town hall | 1 | item | 17384 | R1: its lod 1 | 358 | 1617 | 0.0% | 0.7% | 180/12 0.1% | 97% | 0.99 | 363 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1908 | 1045 | 0.0% | 1.0% | 180/12 0.1% | 97% | 0.97 | 219 | siding trim roof deck stone metal floor |
| house/tram base station | 1 | item | 32230 | R1: its lod 1 | 582 | 4152 | 0.0% | 0.4% | 22.5/35 0.0% | 99% | 1.00 | 506 | siding trim roof glass deck post stone metal floor pane steel girder siding2 trim2 roof2 |
|  |  |  |  | R2: lod 1 less its detail roles | 3105 | 3006 | 0.0% | 1.3% | 22.5/35 0.1% | 99% | 0.99 | 387 | siding trim roof glass deck stone metal floor steel girder siding2 trim2 roof2 |
| house/tram top station | 1 | item | 47640 | R1: its lod 1 | 600 | 10396 | 0.0% | 1.2% | 202.5/35 0.1% | 100% | 0.99 | 1165 | siding trim roof glass deck post stone metal floor pane steel girder siding2 trim2 roof2 siding3 trim3 roof3 |
|  |  |  |  | R2: lod 1 less its detail roles | 5453 | 9590 | 0.0% | 1.3% | 202.5/35 0.1% | 100% | 0.99 | 758 | siding trim roof glass deck stone metal floor steel girder siding2 trim2 roof2 siding3 trim3 roof3 |
| house/vet clinic | 0 | item | 7612 | R1: its lod 1 | 248 | 892 | 0.0% | 0.3% | 270/12 0.1% | 100% | 0.99 | 148 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1321 | 628 | 0.0% | 0.4% | 270/12 0.1% | 100% | 0.99 | 118 | siding trim roof deck stone metal floor |
| house/village church | 1 | item | 8774 | R1: its lod 1 | 218 | 707 | 0.0% | 0.1% | 225/60 0.1% | 97% | 0.98 | 164 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1163 | 427 | 0.0% | 0.1% | 225/60 0.1% | 97% | 0.96 | 129 | siding trim roof deck metal floor log |
| house/village house | 0 | item | 13890 | R1: its lod 1 | 220 | 1138 | 0.0% | 0.3% | 270/12 0.1% | 97% | 0.98 | 243 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1171 | 748 | 0.0% | 0.3% | 270/12 0.1% | 97% | 0.96 | 154 | siding trim roof deck metal floor log |
| house/woodshed | 0 | item | 8310 | R1: its lod 1 | 93 | 324 | 0.0% | 0.6% | 45/12 0.1% | 96% | 0.95 | 41 | siding trim roof deck post floor log |
|  |  |  |  | R2: lod 1 less its detail roles | 494 | 132 | 0.5% | 1.8% | 22.5/35 4.3% | 96% | 0.92 | 41 | siding trim roof deck floor log |
| marine/boat harbour floats | 4 | item | 8536 | R1: its lod 1 | 600 | 8536 | 0.2% | 0.0% | 90/12 0.9% | 100% | 1.00 | 27 | deck pile beam steel body glass |
|  |  |  |  | R2: lod 1 less its detail roles | 5682 | 8536 | 0.2% | 0.0% | 90/12 0.9% | 100% | 1.00 | 27 | deck pile beam steel body glass |
| marine/breakwater | 15 | item | 994 | R1: its lod 1 | 600 | 994 | 49% | 0.0% | 0/12 63% | 100% | 1.00 | 186 | rock |
|  |  |  |  | R2: lod 1 less its detail roles | 4908 | 994 | 49% | 0.0% | 0/12 63% | 100% | 1.00 | 186 | rock |
| marine/breakwater, light | 1 | item | 1084 | R1: its lod 1 | 600 | 1084 | 47% | 0.0% | 0/12 63% | 100% | 1.00 | 207 | rock |
|  |  |  |  | R2: lod 1 less its detail roles | 5434 | 1084 | 47% | 0.0% | 0/12 63% | 100% | 1.00 | 207 | rock |
| marine/landing float | 1 | item | 1268 | R1: its lod 1 | 479 | 1268 | 0.7% | 0.0% | 270/12 2.3% | 100% | 1.00 | 27 | deck pile beam steel body glass |
|  |  |  |  | R2: lod 1 less its detail roles | 2556 | 1268 | 0.7% | 0.0% | 270/12 2.3% | 100% | 1.00 | 27 | deck pile beam steel body glass |
| marine/net pens | 3 | item | 11636 | R1: its lod 1 | 600 | 11556 | 0.0% | 0.0% | 0/0 0.0% | 52% | 0.26 | 0 | deck steel body buoy |
|  |  |  |  | R2: lod 1 less its detail roles | 5450 | 11556 | 0.0% | 0.0% | 0/0 0.0% | 52% | 0.26 | 0 | deck steel body buoy |
| marine/net pens, large | 2 | item | 22506 | R1: its lod 1 | 600 | 22356 | 0.0% | 0.0% | 0/0 0.0% | 41% | 0.19 | 0 | deck steel body buoy |
|  |  |  |  | R2: lod 1 less its detail roles | 7355 | 22356 | 0.0% | 0.0% | 0/0 0.0% | 41% | 0.19 | 0 | deck steel body buoy |
| marine/seaplane float | 1 | item | 2768 | R1: its lod 1 | 543 | 2768 | 0.5% | 0.0% | 67.5/35 0.8% | 100% | 1.00 | 27 | deck pile beam steel body glass |
|  |  |  |  | R2: lod 1 less its detail roles | 2898 | 2768 | 0.5% | 0.0% | 67.5/35 0.8% | 100% | 1.00 | 27 | deck pile beam steel body glass |
| marine/trestle pier | 7 | item | 4100 | R1: its lod 1 | 600 | 4100 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | R2: lod 1 less its detail roles | 5129 | 4100 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
| marine/trestle pier, long | 2 | item | 6264 | R1: its lod 1 | 600 | 6264 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | R2: lod 1 less its detail roles | 9344 | 6264 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
| marine/wharf deck | 3 | item | 5692 | R1: its lod 1 | 600 | 5692 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | R2: lod 1 less its detail roles | 3826 | 5692 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 0 | deck pile beam steel glass |
| marine/wharf deck, small | 2 | item | 2960 | R1: its lod 1 | 410 | 2960 | 0.0% | 0.0% | 0/0 0.0% | 99% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | R2: lod 1 less its detail roles | 2184 | 2960 | 0.0% | 0.0% | 0/0 0.0% | 99% | 1.00 | 0 | deck pile beam steel glass |
| navaid/DVOR-DME | 1 | item | 4392 | R1: its lod 1 | 600 | 2224 | 0.0% | 0.0% | 45/60 0.0% | 99% | 0.99 | 98 | steel siding trim roof stone metal glass |
|  |  |  |  | R2: lod 1 less its detail roles | 4976 | 1276 | 0.0% | 0.1% | 90/12 0.2% | 99% | 0.99 | 88 | steel siding roof stone metal glass |
| navaid/DVOR-DME compact | 0 | item | 4316 | R1: its lod 1 | 600 | 2176 | 0.0% | 0.1% | 225/12 0.1% | 100% | 0.98 | 97 | steel siding trim roof stone metal glass |
|  |  |  |  | R2: lod 1 less its detail roles | 3428 | 1264 | 0.1% | 0.8% | 90/12 0.3% | 100% | 0.98 | 87 | steel siding roof stone metal glass |
| shed/lean-to | 0 | item | 4370 | R1: its lod 1 | 69 | 202 | 0.1% | 0.2% | 67.5/35 1.0% | 93% | 0.97 | 40 | siding trim roof deck post |
|  |  |  |  | R2: lod 1 less its detail roles | 370 | 190 | 0.1% | 0.5% | 67.5/35 1.0% | 93% | 0.97 | 40 | siding trim roof deck |
| shed/net store | 1 | item | 2054 | R1: its lod 1 | 108 | 316 | 0.0% | 0.0% | 0/0 0.0% | 99% | 0.99 | 80 | siding trim roof deck post stone |
|  |  |  |  | R2: lod 1 less its detail roles | 578 | 244 | 0.0% | 0.0% | 0/0 0.0% | 99% | 0.99 | 80 | siding trim roof deck stone |
| shed/tool shed | 5 | item | 5090 | R1: its lod 1 | 63 | 204 | 0.1% | 0.2% | 315/12 0.9% | 100% | 0.97 | 51 | siding trim roof deck |
|  |  |  |  | R2: lod 1 less its detail roles | 334 | 204 | 0.1% | 0.2% | 315/12 0.9% | 100% | 0.97 | 51 | siding trim roof deck |
| shed/trapper cabin | 0 | item | 11030 | R1: its lod 1 | 98 | 364 | 0.0% | 0.3% | 0/0 0.0% | 99% | 0.98 | 64 | siding trim roof deck post stone metal |
|  |  |  |  | R2: lod 1 less its detail roles | 523 | 292 | 0.0% | 0.3% | 0/0 0.0% | 99% | 0.98 | 64 | siding trim roof deck stone metal |
| shed/wood shed | 1 | item | 4860 | R1: its lod 1 | 79 | 202 | 0.3% | 0.2% | 45/12 1.1% | 100% | 0.99 | 47 | siding trim roof deck post |
|  |  |  |  | R2: lod 1 less its detail roles | 423 | 190 | 0.3% | 0.8% | 45/12 1.1% | 100% | 0.99 | 47 | siding trim roof deck |
| sport/ball park, lit | 1 | item | 2607 | R1: its lod 1 | 600 | 1639 | 0.0% | 0.9% | 0/0 0.0% | 100% | 0.96 | 854 | turf dirt line metal post seat |
|  |  |  |  | R2: lod 1 less its detail roles | 7695 | 1639 | 0.0% | 0.9% | 0/0 0.0% | 100% | 0.96 | 854 | turf dirt line metal post seat |
| sport/baseball diamond | 0 | item | 913 | R1: its lod 1 | 600 | 733 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.98 | 727 | turf dirt line metal post seat |
|  |  |  |  | R2: lod 1 less its detail roles | 7229 | 733 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.98 | 727 | turf dirt line metal post seat |
| sport/gravel pitch | 0 | item | 296 | R1: its lod 1 | 600 | 200 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 1073 | dirt line metal |
|  |  |  |  | R2: lod 1 less its detail roles | 4589 | 200 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 1073 | dirt line metal |
| sport/hard court | 1 | item | 1086 | R1: its lod 1 | 515 | 548 | 0.2% | 7.7% | 90/12 1.4% | 100% | 0.75 | 490 | court line metal seat |
|  |  |  |  | R2: lod 1 less its detail roles | 2749 | 548 | 0.2% | 7.7% | 90/12 1.4% | 100% | 0.75 | 490 | court line metal seat |
| sport/running track | 0 | item | 5268 | R1: its lod 1 | 600 | 3724 | 0.0% | 0.2% | 0/0 0.0% | 82% | 1.00 | 7206 | turf track line metal post seat |
|  |  |  |  | R2: lod 1 less its detail roles | 11832 | 3724 | 0.0% | 0.2% | 0/0 0.0% | 82% | 1.00 | 7206 | turf track line metal post seat |
| sport/soccer field | 0 | item | 1164 | R1: its lod 1 | 600 | 668 | 0.0% | 0.2% | 0/0 0.0% | 51% | 1.00 | 1386 | turf line metal post seat |
|  |  |  |  | R2: lod 1 less its detail roles | 5979 | 668 | 0.0% | 0.2% | 0/0 0.0% | 51% | 1.00 | 1386 | turf line metal post seat |
| sport/soccer, turf, lit | 0 | item | 2866 | R1: its lod 1 | 600 | 1420 | 0.0% | 0.8% | 0/0 0.0% | 53% | 0.92 | 1386 | turf line metal post seat |
|  |  |  |  | R2: lod 1 less its detail roles | 6549 | 1420 | 0.0% | 0.8% | 0/0 0.0% | 53% | 0.92 | 1386 | turf line metal post seat |
| tower/WWII tower | 1 | item | 2108 | R1: its lod 1 | 235 | 1268 | 4.4% | 1.7% | 270/12 9.3% | 99% | 0.92 | 31 | steel siding roof deck stone metal |
|  |  |  |  | R2: lod 1 less its detail roles | 1252 | 1268 | 4.4% | 1.7% | 270/12 9.3% | 99% | 0.92 | 31 | steel siding roof deck stone metal |
| tower/block tower | 0 | item | 3738 | R1: its lod 1 | 203 | 1686 | 0.6% | 0.8% | 90/12 3.7% | 100% | 0.98 | 226 | steel siding roof deck stone metal pane glass |
|  |  |  |  | R2: lod 1 less its detail roles | 1080 | 1686 | 0.6% | 0.8% | 90/12 3.7% | 100% | 0.98 | 226 | steel siding roof deck stone metal pane glass |
| tower/club tower | 0 | item | 3214 | R1: its lod 1 | 211 | 2362 | 0.1% | 0.5% | 270/12 0.8% | 98% | 0.97 | 157 | steel siding trim roof deck stone metal pane glass |
|  |  |  |  | R2: lod 1 less its detail roles | 1124 | 2334 | 0.1% | 0.6% | 270/12 0.8% | 98% | 0.97 | 157 | steel siding roof deck stone metal pane glass |
| tower/field cab | 0 | item | 2248 | R1: its lod 1 | 190 | 1392 | 0.2% | 0.3% | 135/12 1.1% | 100% | 0.98 | 123 | steel post siding trim roof deck stone metal pane glass sock |
|  |  |  |  | R2: lod 1 less its detail roles | 1015 | 1316 | 0.1% | 0.4% | 135/12 0.9% | 100% | 0.98 | 121 | steel post siding roof deck stone metal pane glass |
| tower/hut tower | 0 | item | 3130 | R1: its lod 1 | 193 | 1214 | 1.2% | 1.2% | 0/12 8.1% | 100% | 0.98 | 254 | steel post siding trim roof deck metal pane glass sock |
|  |  |  |  | R2: lod 1 less its detail roles | 1028 | 1138 | 1.2% | 1.6% | 0/12 8.1% | 98% | 0.97 | 252 | steel post siding roof deck metal pane glass |
| tower/lookout cab | 0 | item | 2762 | R1: its lod 1 | 196 | 2174 | 0.1% | 0.5% | 225/12 0.5% | 97% | 0.98 | 123 | steel post siding trim roof deck stone metal pane glass |
|  |  |  |  | R2: lod 1 less its detail roles | 1043 | 2154 | 0.1% | 0.7% | 225/12 0.5% | 97% | 0.97 | 123 | steel post siding roof deck stone metal pane glass |
| tower/regional tower | 0 | item | 4624 | R1: its lod 1 | 287 | 2874 | 0.5% | 0.6% | 90/12 2.1% | 100% | 0.98 | 330 | steel siding roof deck stone metal pane glass |
|  |  |  |  | R2: lod 1 less its detail roles | 1530 | 2874 | 0.5% | 0.6% | 90/12 2.1% | 100% | 0.98 | 330 | steel siding roof deck stone metal pane glass |
| utility/hydro powerhouse | 0 | item | 1384 | R1: its lod 1 | 565 | 1000 | 0.3% | 0.1% | 225/12 1.3% | 100% | 1.00 | 564 | steel siding trim roof stone metal pane glass |
|  |  |  |  | R2: lod 1 less its detail roles | 3012 | 960 | 0.3% | 0.1% | 225/12 1.3% | 100% | 1.00 | 541 | steel siding roof stone metal pane glass |
| meteo/meteo station | 1 | item | 36298 | R1: its lod 1 | 600 | 6120 | 0.1% | 0.3% | 135/12 0.9% | 99% | 0.99 | 3452 | roof copper dark shaft stone steel rail flue paint conc deck pane glass |
|  |  |  |  | R2: lod 1 less its detail roles | 4594 | 6120 | 0.1% | 0.3% | 135/12 0.9% | 99% | 0.99 | 3452 | roof copper dark shaft stone steel rail flue paint conc deck pane glass |
| meteo/meteo station 1974 | 0 | item | 36924 | R1: its lod 1 | 600 | 6160 | 0.1% | 0.4% | 90/12 1.2% | 100% | 0.99 | 3450 | roof copper dark shaft stone steel rail flue paint conc deck pane glass |
|  |  |  |  | R2: lod 1 less its detail roles | 4632 | 6160 | 0.1% | 0.4% | 90/12 1.2% | 100% | 0.99 | 3450 | roof copper dark shaft stone steel rail flue paint conc deck pane glass |
| house/shore cabin [as a plot] | 0 | plot | 12896 | R1: its lod 1 | 258 | 1016 | 0.0% | 0.6% | 270/60 0.0% | 98% | 0.97 | 138 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1375 | 570 | 0.0% | 0.7% | 270/60 0.0% | 98% | 0.93 | 102 | siding trim roof deck metal floor log |
| house/village house [as a plot] | 0 | plot | 13890 | R1: its lod 1 | 220 | 1138 | 0.0% | 0.3% | 270/12 0.1% | 97% | 0.98 | 243 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1171 | 748 | 0.0% | 0.3% | 270/12 0.1% | 97% | 0.96 | 154 | siding trim roof deck metal floor log |
| house/modern dark [as a plot] | 0 | plot | 11906 | R1: its lod 1 | 242 | 996 | 0.0% | 0.7% | 90/12 0.0% | 98% | 0.97 | 209 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1292 | 596 | 0.0% | 0.8% | 90/12 0.1% | 98% | 0.94 | 139 | siding trim roof deck metal floor log |
| house/cannery shed [as a plot] | 0 | plot | 29292 | R1: its lod 1 | 468 | 2220 | 0.0% | 0.2% | 180/60 0.1% | 100% | 0.99 | 464 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 2496 | 978 | 0.0% | 0.5% | 247.5/35 0.0% | 98% | 0.96 | 274 | siding trim roof deck metal floor log |
| house/village church [as a plot] | 0 | plot | 8774 | R1: its lod 1 | 218 | 707 | 0.0% | 0.1% | 225/60 0.1% | 97% | 0.98 | 164 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1163 | 427 | 0.0% | 0.1% | 225/60 0.1% | 97% | 0.96 | 129 | siding trim roof deck metal floor log |
| house/church [as a plot] | 0 | plot | 7500 | R1: its lod 1 | 312 | 891 | 0.0% | 0.1% | 90/12 0.2% | 99% | 0.98 | 219 | siding trim roof deck post metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1665 | 477 | 0.0% | 0.1% | 90/12 0.2% | 99% | 0.96 | 175 | siding trim roof deck metal floor |
| house/town hall [as a plot] | 0 | plot | 17384 | R1: its lod 1 | 358 | 1617 | 0.0% | 0.7% | 180/12 0.1% | 97% | 0.99 | 363 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1908 | 1045 | 0.0% | 1.0% | 180/12 0.1% | 97% | 0.97 | 219 | siding trim roof deck stone metal floor |
| house/lighthouse [as a plot] | 0 | plot | 13322 | R1: its lod 1 | 373 | 1450 | 0.0% | 0.2% | 22.5/35 0.1% | 98% | 0.99 | 345 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1991 | 1152 | 0.0% | 0.4% | 22.5/35 0.1% | 98% | 0.98 | 300 | siding trim roof glass deck stone metal floor |
| house/lighthouse octagon [as a plot] | 0 | plot | 11810 | R1: its lod 1 | 301 | 1122 | 0.0% | 0.1% | 270/12 0.1% | 100% | 1.00 | 310 | siding trim roof glass deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1608 | 976 | 0.0% | 0.1% | 270/12 0.1% | 100% | 1.00 | 221 | siding trim roof glass deck stone metal floor |
| house/school [as a plot] | 0 | plot | 20664 | R1: its lod 1 | 600 | 1540 | 0.0% | 0.3% | 0/0 0.0% | 97% | 0.99 | 485 | siding trim roof deck post stone metal floor pane flag siding2 trim2 roof2 |
|  |  |  |  | R2: lod 1 less its detail roles | 3440 | 1082 | 0.0% | 0.4% | 0/0 0.0% | 97% | 0.99 | 382 | siding trim roof deck stone metal floor siding2 trim2 roof2 |
| house/clinic [as a plot] | 0 | plot | 13176 | R1: its lod 1 | 388 | 1396 | 0.0% | 0.3% | 45/12 0.1% | 100% | 0.99 | 360 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2070 | 1054 | 0.0% | 0.4% | 45/12 0.1% | 100% | 0.99 | 313 | siding trim roof deck stone metal floor |
| house/police [as a plot] | 0 | plot | 10766 | R1: its lod 1 | 323 | 1372 | 0.0% | 0.2% | 157.5/35 0.1% | 100% | 0.99 | 301 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1724 | 1034 | 0.0% | 0.6% | 157.5/35 0.1% | 100% | 0.98 | 274 | siding trim roof deck stone metal floor |
| house/post office [as a plot] | 0 | plot | 9382 | R1: its lod 1 | 253 | 1078 | 0.0% | 0.6% | 270/12 0.1% | 96% | 0.97 | 142 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1351 | 628 | 0.0% | 1.1% | 270/12 0.1% | 96% | 0.94 | 105 | siding trim roof deck metal floor |
| house/general store [as a plot] | 0 | plot | 6684 | R1: its lod 1 | 272 | 772 | 0.0% | 0.1% | 0/0 0.0% | 99% | 0.98 | 233 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 1450 | 342 | 0.0% | 0.1% | 0/0 0.0% | 99% | 0.96 | 201 | siding trim roof deck metal floor awning |
| house/cafe [as a plot] | 0 | plot | 9528 | R1: its lod 1 | 231 | 1034 | 0.0% | 0.4% | 292.5/35 0.0% | 100% | 0.97 | 145 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 1233 | 568 | 0.0% | 0.5% | 292.5/35 0.0% | 100% | 0.95 | 117 | siding trim roof deck metal floor awning |
| house/motel [as a plot] | 0 | plot | 13636 | R1: its lod 1 | 384 | 1380 | 0.0% | 0.5% | 90/60 0.1% | 100% | 0.99 | 228 | siding trim roof deck post metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 2046 | 644 | 0.0% | 0.6% | 90/60 0.1% | 100% | 0.97 | 191 | siding trim roof deck metal floor |
| house/air taxi office [as a plot] | 0 | plot | 5118 | R1: its lod 1 | 216 | 660 | 0.0% | 0.1% | 270/12 0.1% | 98% | 0.99 | 120 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1151 | 530 | 0.0% | 0.2% | 270/12 0.1% | 98% | 0.98 | 92 | siding trim roof deck stone metal floor |
| house/marine supply [as a plot] | 0 | plot | 7634 | R1: its lod 1 | 273 | 964 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.97 | 182 | siding trim roof deck post metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1455 | 414 | 0.0% | 0.4% | 0/0 0.0% | 99% | 0.94 | 154 | siding trim roof deck metal floor |
| house/fuel and bait [as a plot] | 0 | plot | 4750 | R1: its lod 1 | 187 | 736 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.96 | 100 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 998 | 358 | 0.0% | 0.4% | 0/0 0.0% | 100% | 0.91 | 85 | siding trim roof deck metal floor awning |
| house/bear tours [as a plot] | 0 | plot | 10452 | R1: its lod 1 | 216 | 1008 | 0.0% | 0.6% | 0/0 0.0% | 100% | 0.96 | 99 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1150 | 618 | 0.0% | 0.6% | 0/0 0.0% | 99% | 0.93 | 86 | siding trim roof deck metal floor log |
| house/vet clinic [as a plot] | 0 | plot | 7612 | R1: its lod 1 | 248 | 892 | 0.0% | 0.3% | 270/12 0.1% | 100% | 0.99 | 148 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1321 | 628 | 0.0% | 0.4% | 270/12 0.1% | 100% | 0.99 | 118 | siding trim roof deck stone metal floor |
| house/clubhouse [as a plot] | 0 | plot | 5038 | R1: its lod 1 | 216 | 512 | 0.0% | 0.5% | 135/12 0.0% | 100% | 0.99 | 146 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1151 | 370 | 0.0% | 0.6% | 135/12 0.0% | 100% | 0.98 | 130 | siding trim roof deck stone metal floor |
| house/concession stand [as a plot] | 0 | plot | 2526 | R1: its lod 1 | 124 | 336 | 0.0% | 0.0% | 0/0 0.0% | 97% | 0.98 | 88 | siding trim roof deck post stone floor pane awning |
|  |  |  |  | R2: lod 1 less its detail roles | 662 | 222 | 0.0% | 0.0% | 0/0 0.0% | 97% | 0.98 | 74 | siding trim roof deck stone floor awning |
| house/outhouse [as a plot] | 0 | plot | 1142 | R1: its lod 1 | 65 | 302 | 0.0% | 0.1% | 0/0 0.0% | 90% | 0.96 | 36 | siding trim roof deck post floor |
|  |  |  |  | R2: lod 1 less its detail roles | 349 | 170 | 0.0% | 0.1% | 0/0 0.0% | 90% | 0.92 | 36 | siding trim roof deck floor |
| house/garage [as a plot] | 0 | plot | 2464 | R1: its lod 1 | 155 | 380 | 0.0% | 0.0% | 270/12 0.1% | 100% | 1.00 | 85 | siding trim roof post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 827 | 330 | 0.0% | 0.0% | 270/12 0.1% | 100% | 1.00 | 82 | siding trim roof stone metal floor |
| house/storage shed [as a plot] | 0 | plot | 4830 | R1: its lod 1 | 100 | 330 | 0.0% | 0.2% | 0/0 0.0% | 99% | 0.96 | 48 | siding trim roof deck post metal floor log |
|  |  |  |  | R2: lod 1 less its detail roles | 534 | 198 | 0.0% | 0.2% | 0/0 0.0% | 99% | 0.93 | 48 | siding trim roof deck metal floor log |
| house/woodshed [as a plot] | 0 | plot | 8310 | R1: its lod 1 | 93 | 324 | 0.0% | 0.6% | 45/12 0.1% | 96% | 0.95 | 41 | siding trim roof deck post floor log |
|  |  |  |  | R2: lod 1 less its detail roles | 494 | 132 | 0.5% | 1.8% | 22.5/35 4.3% | 96% | 0.92 | 41 | siding trim roof deck floor log |
| house/over the water [as a plot] | 0 | plot | 15444 | R1: its lod 1 | 453 | 1616 | 0.0% | 0.8% | 270/60 0.2% | 99% | 0.95 | 203 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | R2: lod 1 less its detail roles | 2416 | 702 | 0.0% | 0.4% | 247.5/35 0.2% | 97% | 0.77 | 99 | siding trim roof deck metal floor log |
| house/fish shack [as a plot] | 0 | plot | 7670 | R1: its lod 1 | 387 | 1022 | 0.0% | 0.6% | 292.5/35 0.2% | 96% | 0.93 | 95 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | R2: lod 1 less its detail roles | 2065 | 326 | 0.0% | 0.4% | 0/0 0.0% | 91% | 0.69 | 76 | siding trim roof deck metal floor log |
| house/net loft [as a plot] | 0 | plot | 12844 | R1: its lod 1 | 464 | 1574 | 0.0% | 0.4% | 135/60 0.1% | 99% | 0.96 | 176 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | R2: lod 1 less its detail roles | 2474 | 570 | 0.0% | 0.2% | 0/0 0.0% | 95% | 0.82 | 115 | siding trim roof deck metal floor log |
| house/saltbox farmhouse [as a plot] | 0 | plot | 15448 | R1: its lod 1 | 252 | 1306 | 0.0% | 0.3% | 112.5/35 0.1% | 100% | 0.98 | 273 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1345 | 894 | 0.0% | 0.5% | 112.5/35 0.1% | 100% | 0.97 | 190 | siding trim roof deck stone metal floor log |
| house/gambrel barn [as a plot] | 0 | plot | 13326 | R1: its lod 1 | 293 | 1058 | 0.0% | 0.0% | 90/60 0.0% | 100% | 0.99 | 346 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1563 | 640 | 0.0% | 0.1% | 90/60 0.0% | 100% | 0.99 | 304 | siding trim roof deck stone metal floor log |
| house/saltbox cottage [as a plot] | 0 | plot | 10664 | R1: its lod 1 | 213 | 1050 | 0.1% | 0.5% | 247.5/35 0.3% | 99% | 0.97 | 155 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1135 | 634 | 0.1% | 0.6% | 247.5/35 0.3% | 99% | 0.95 | 138 | siding trim roof deck stone metal floor log |
| house/hip cottage [as a plot] | 0 | plot | 11872 | R1: its lod 1 | 234 | 996 | 0.0% | 1.2% | 270/12 0.1% | 99% | 0.98 | 133 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1247 | 696 | 0.0% | 1.4% | 270/12 0.1% | 99% | 0.98 | 105 | siding trim roof deck stone metal floor log |
| house/chapel [as a plot] | 0 | plot | 7940 | R1: its lod 1 | 212 | 613 | 0.0% | 0.1% | 0/12 0.1% | 99% | 0.99 | 140 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1129 | 433 | 0.0% | 0.2% | 0/12 0.1% | 99% | 0.98 | 117 | siding trim roof deck stone metal floor log |
| house/pilot hut [as a plot] | 0 | plot | 9134 | R1: its lod 1 | 157 | 888 | 0.0% | 0.7% | 0/0 0.0% | 99% | 0.96 | 84 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 838 | 558 | 0.0% | 0.8% | 0/0 0.0% | 99% | 0.93 | 72 | siding trim roof deck metal floor log |
| house/flying club [as a plot] | 0 | plot | 13882 | R1: its lod 1 | 315 | 1274 | 0.0% | 0.8% | 0/0 0.0% | 100% | 0.98 | 182 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1679 | 652 | 0.0% | 1.1% | 0/0 0.0% | 100% | 0.96 | 132 | siding trim roof deck metal floor |
| house/control tower [as a plot] | 0 | plot | 13648 | R1: its lod 1 | 371 | 1234 | 0.0% | 0.1% | 112.5/35 0.0% | 97% | 0.99 | 366 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | R2: lod 1 less its detail roles | 1980 | 954 | 0.0% | 0.3% | 112.5/35 0.0% | 97% | 0.98 | 304 | siding trim roof glass deck stone metal floor |
| house/flight service [as a plot] | 0 | plot | 7556 | R1: its lod 1 | 258 | 892 | 0.0% | 0.5% | 180/60 0.1% | 98% | 0.99 | 162 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1375 | 628 | 0.0% | 0.6% | 180/60 0.1% | 98% | 0.99 | 126 | siding trim roof deck stone metal floor |
| house/bunkhouse [as a plot] | 0 | plot | 14694 | R1: its lod 1 | 302 | 1564 | 0.0% | 0.4% | 0/0 0.0% | 100% | 0.98 | 239 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1611 | 658 | 0.0% | 0.4% | 0/0 0.0% | 99% | 0.93 | 178 | siding trim roof deck metal floor log |
| house/mine bunkhouse [as a plot] | 0 | plot | 19634 | R1: its lod 1 | 313 | 1632 | 0.0% | 0.3% | 112.5/35 0.1% | 100% | 0.99 | 369 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1669 | 968 | 0.0% | 0.3% | 112.5/35 0.1% | 100% | 0.98 | 241 | siding trim roof deck metal floor log |
| house/mine dormer hall [as a plot] | 0 | plot | 23148 | R1: its lod 1 | 425 | 1888 | 0.0% | 0.1% | 247.5/35 0.1% | 100% | 0.99 | 400 | siding trim roof deck post stone floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 2269 | 1180 | 0.0% | 0.2% | 247.5/35 0.1% | 100% | 0.99 | 249 | siding trim roof deck stone floor log |
| house/mine mess hall [as a plot] | 0 | plot | 14516 | R1: its lod 1 | 313 | 1188 | 0.0% | 0.5% | 0/0 0.0% | 97% | 0.97 | 210 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1672 | 536 | 0.0% | 0.5% | 0/0 0.0% | 97% | 0.96 | 142 | siding trim roof deck metal floor log |
| house/mine office [as a plot] | 0 | plot | 12992 | R1: its lod 1 | 270 | 1364 | 0.0% | 1.0% | 292.5/35 0.0% | 99% | 0.98 | 217 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 1440 | 860 | 0.0% | 1.2% | 292.5/35 0.0% | 99% | 0.97 | 134 | siding trim roof deck stone metal floor |
| house/mine cottage [as a plot] | 0 | plot | 9816 | R1: its lod 1 | 200 | 996 | 0.0% | 0.6% | 112.5/35 0.1% | 98% | 0.97 | 132 | siding trim roof deck post metal floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 1065 | 552 | 0.0% | 0.6% | 112.5/35 0.1% | 98% | 0.96 | 110 | siding trim roof deck metal floor log |
| house/log cabin [as a plot] | 0 | plot | 9580 | R1: its lod 1 | 181 | 860 | 0.0% | 1.2% | 0/0 0.0% | 98% | 0.96 | 90 | siding trim roof deck post stone floor pane log |
|  |  |  |  | R2: lod 1 less its detail roles | 966 | 506 | 0.0% | 1.3% | 0/0 0.0% | 98% | 0.94 | 79 | siding trim roof deck stone floor log |
| house/storage shed [as an outbuilding] | 0 | out | 330 | R1: its lod 1 | 97 | 330 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 48 | siding trim roof deck post metal floor log |
|  |  |  |  | R2: lod 1 less its detail roles | 519 | 198 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.97 | 48 | siding trim roof deck metal floor log |
| house/outhouse [as an outbuilding] | 0 | out | 302 | R1: its lod 1 | 64 | 302 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 36 | siding trim roof deck post floor |
|  |  |  |  | R2: lod 1 less its detail roles | 340 | 170 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.95 | 36 | siding trim roof deck floor |
| house/garage [as an outbuilding] | 0 | out | 380 | R1: its lod 1 | 154 | 380 | 0.0% | 0.0% | 270/12 0.1% | 100% | 1.00 | 85 | siding trim roof post stone metal floor pane |
|  |  |  |  | R2: lod 1 less its detail roles | 823 | 330 | 0.0% | 0.0% | 270/12 0.1% | 100% | 1.00 | 82 | siding trim roof stone metal floor |
| house/woodshed [as an outbuilding] | 0 | out | 324 | R1: its lod 1 | 91 | 324 | 0.0% | 0.0% | 45/12 0.1% | 100% | 1.00 | 41 | siding trim roof deck post floor log |
|  |  |  |  | R2: lod 1 less its detail roles | 483 | 132 | 0.7% | 1.5% | 45/12 4.9% | 100% | 0.97 | 41 | siding trim roof deck floor log |
| kit #0 sampler #z1:r31:3 | 28 | kit | 10590 | kit lod 1 | 150 | 1142 | 0.0% | 0.7% | 0/0 0.0% | 100% | 0.98 | 240 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.0% | 0/0 0.0% | 95% | 0.83 | 119 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.4% | 1.3% | 180/12 2.0% | 95% | 0.88 | 114 | shell |
| kit #1 sampler #mk_z_res_w:mk_ax03:4 | 26 | kit | 4844 | kit lod 1 | 150 | 704 | 0.0% | 0.5% | 0/0 0.0% | 99% | 0.96 | 87 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.9% | 0/0 0.0% | 97% | 0.73 | 70 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 1.3% | 45/12 1.1% | 97% | 0.75 | 67 | shell |
| kit #2 sampler #mk_z_town:r3:2 | 25 | kit | 6738 | kit lod 1 | 150 | 836 | 0.0% | 0.4% | 90/12 0.1% | 100% | 0.97 | 124 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.0% | 0/0 0.0% | 95% | 0.77 | 73 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.7% | 1.3% | 180/12 2.0% | 95% | 0.83 | 67 | shell |
| kit #3 mine cottage | 24 | kit | 7080 | kit lod 1 | 150 | 984 | 0.0% | 0.5% | 135/60 0.1% | 99% | 0.97 | 132 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.4% | 0/0 0.0% | 100% | 0.80 | 104 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 3.3% | 90/12 1.3% | 89% | 0.87 | 97 | shell |
| kit #4 shore cabin | 23 | kit | 9484 | kit lod 1 | 150 | 984 | 0.0% | 0.5% | 270/12 0.1% | 97% | 0.97 | 138 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 3.2% | 0/0 0.0% | 94% | 0.81 | 120 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 2.0% | 90/12 0.7% | 94% | 0.86 | 115 | shell |
| kit #5 log cabin | 23 | kit | 6516 | kit lod 1 | 150 | 848 | 0.0% | 1.4% | 0/0 0.0% | 97% | 0.96 | 90 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 97% | 0.77 | 98 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 5.1% | 45/12 1.3% | 83% | 0.82 | 82 | shell |
| kit #6 over the water | 17 | kit | 11012 | kit lod 1 | 150 | 1240 | 0.0% | 0.5% | 135/12 0.1% | 94% | 0.97 | 197 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 4.8% | 0/0 0.0% | 90% | 0.83 | 84 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.4% | 90/12 0.6% | 90% | 0.85 | 80 | shell |
| kit #7 saltbox cottage | 17 | kit | 7756 | kit lod 1 | 150 | 1018 | 0.0% | 0.5% | 0/0 0.0% | 100% | 0.97 | 155 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 98% | 0.76 | 102 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 2.2% | 90/12 0.9% | 94% | 0.85 | 96 | shell |
| kit #8 sampler #mk_z_res_e:mk_sc37:10 | 17 | kit | 10152 | kit lod 1 | 150 | 1032 | 0.0% | 0.4% | 90/12 0.0% | 97% | 0.97 | 146 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.1% | 0/0 0.0% | 95% | 0.83 | 103 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.1% | 45/12 0.5% | 95% | 0.87 | 100 | shell |
| kit #9 sampler #mk_z_town:mk_sc45:0 | 17 | kit | 6024 | kit lod 1 | 150 | 888 | 0.0% | 0.7% | 270/12 0.1% | 97% | 0.97 | 115 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.8% | 0/0 0.0% | 94% | 0.78 | 99 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 3.5% | 135/12 0.5% | 75% | 0.78 | 84 | shell |
| kit #10 mine bunkhouse | 17 | kit | 15998 | kit lod 1 | 150 | 1596 | 0.0% | 0.3% | 112.5/35 0.1% | 100% | 0.99 | 352 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 6.1% | 0/0 0.0% | 100% | 0.80 | 151 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 8.9% | 90/12 0.8% | 84% | 0.87 | 131 | shell |
| kit #11 sampler #mk_z_town:mk_ax04:1 | 16 | kit | 15106 | kit lod 1 | 150 | 1350 | 0.0% | 0.4% | 292.5/35 0.1% | 100% | 0.98 | 252 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.2% | 0/0 0.0% | 93% | 0.80 | 116 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.1% | 90/12 0.9% | 93% | 0.85 | 118 | shell |
| kit #12 bunkhouse | 15 | kit | 10090 | kit lod 1 | 150 | 1356 | 0.0% | 0.4% | 112.5/35 0.0% | 100% | 0.99 | 227 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.4% | 0/0 0.0% | 100% | 0.77 | 138 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.4% | 4.1% | 135/12 1.6% | 89% | 0.83 | 120 | shell |
| kit #13 modern dark | 13 | kit | 8494 | kit lod 1 | 150 | 964 | 0.0% | 0.6% | 112.5/35 0.0% | 98% | 0.98 | 209 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 3.6% | 0/0 0.0% | 97% | 0.81 | 99 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.6% | 1.8% | 180/12 1.6% | 94% | 0.88 | 87 | shell |
| kit #14 sampler #mk_z_res_w:mk_ax02:10 | 13 | kit | 13270 | kit lod 1 | 150 | 1588 | 0.0% | 0.9% | 180/12 0.1% | 97% | 0.98 | 261 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 4.0% | 0/0 0.0% | 91% | 0.80 | 125 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 2.7% | 0/0 0.0% | 91% | 0.85 | 115 | shell |
| kit #15 sampler #mk_z_res_s:mk_sa03:2 | 13 | kit | 12298 | kit lod 1 | 150 | 1414 | 0.0% | 0.4% | 90/12 0.0% | 100% | 0.99 | 237 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 4.6% | 0/0 0.0% | 95% | 0.89 | 133 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.8% | 90/12 0.6% | 95% | 0.93 | 131 | shell |
| kit #16 sampler #mk_z_res_sub:mk_r_raven:1 | 13 | kit | 7258 | kit lod 1 | 150 | 800 | 0.0% | 0.5% | 247.5/35 0.0% | 99% | 0.97 | 178 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.8% | 0/0 0.0% | 97% | 0.76 | 67 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.7% | 2.5% | 45/12 2.2% | 97% | 0.80 | 72 | shell |
| kit #17 saltbox farmhouse | 12 | kit | 12024 | kit lod 1 | 150 | 1226 | 0.0% | 0.4% | 112.5/35 0.1% | 99% | 0.98 | 273 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.9% | 0/0 0.0% | 97% | 0.79 | 121 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.5% | 135/12 0.6% | 94% | 0.89 | 116 | shell |
| kit #18 sampler #mk_z_town:mk_ax05:5 | 11 | kit | 6764 | kit lod 1 | 150 | 946 | 0.0% | 0.7% | 0/12 0.1% | 100% | 0.97 | 101 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 92% | 0.72 | 93 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 3.1% | 0/0 0.0% | 92% | 0.80 | 82 | shell |
| kit #19 hip cottage | 10 | kit | 9564 | kit lod 1 | 150 | 1132 | 0.0% | 1.3% | 180/12 0.1% | 100% | 0.98 | 133 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.9% | 0/0 0.0% | 96% | 0.77 | 129 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 5.3% | 0/0 0.0% | 81% | 0.82 | 106 | shell |
| kit #20 sampler #mk_z_res_w:mk_ax03:9 | 10 | kit | 7742 | kit lod 1 | 150 | 808 | 0.0% | 0.2% | 270/60 0.0% | 97% | 0.98 | 226 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.4% | 0/0 0.0% | 93% | 0.84 | 122 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 1.6% | 90/12 0.4% | 93% | 0.89 | 114 | shell |
| kit #21 sampler #mk_z_res_c:mk_ax03:6 | 9 | kit | 8410 | kit lod 1 | 150 | 1242 | 0.0% | 0.5% | 112.5/35 0.0% | 97% | 0.97 | 215 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.9% | 0/0 0.0% | 92% | 0.77 | 110 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.4% | 2.9% | 90/12 2.5% | 92% | 0.82 | 111 | shell |
| kit #22 sampler #mk_z_town:mk_ax02:3 | 9 | kit | 5746 | kit lod 1 | 150 | 848 | 0.0% | 1.2% | 0/0 0.0% | 94% | 0.96 | 137 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.0% | 0/0 0.0% | 96% | 0.80 | 99 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 1.0% | 2.7% | 225/12 2.5% | 92% | 0.85 | 90 | shell |
| kit #23 sampler #mk_z_res_s:mk_sc48:1 | 8 | kit | 8612 | kit lod 1 | 150 | 1180 | 0.0% | 0.5% | 90/60 0.1% | 99% | 0.98 | 258 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.4% | 0/0 0.0% | 97% | 0.79 | 111 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 2.9% | 135/12 0.7% | 83% | 0.86 | 101 | shell |
| kit #24 motel | 7 | kit | 11514 | kit lod 1 | 150 | 1248 | 0.0% | 0.4% | 135/60 0.1% | 100% | 0.98 | 200 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.3% | 0/0 0.0% | 98% | 0.75 | 186 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 4.8% | 135/12 0.2% | 81% | 0.84 | 155 | shell |
| kit #25 sampler #mk_z_town:mk_ax05:0 | 7 | kit | 7482 | kit lod 1 | 150 | 936 | 0.0% | 0.7% | 90/12 0.1% | 100% | 0.98 | 120 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.1% | 0/0 0.0% | 96% | 0.79 | 115 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 4.6% | 90/12 1.6% | 81% | 0.82 | 99 | shell |
| kit #26 marine supply | 11 | kit | 7466 | kit lod 1 | 150 | 964 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.98 | 182 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 3.6% | 0/0 0.0% | 100% | 0.84 | 126 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 1.7% | 90/12 0.2% | 100% | 0.85 | 122 | shell |
| kit #27 sampler #mk_z_harbour:mk_r_shore:2 | 6 | kit | 6968 | kit lod 1 | 150 | 856 | 0.0% | 0.5% | 202.5/35 0.0% | 97% | 0.97 | 129 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 95% | 0.79 | 86 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.7% | 1.4% | 0/12 4.1% | 95% | 0.86 | 80 | shell |
| kit #28 mine bunkhouse | 5 | kit | 15890 | kit lod 1 | 150 | 1622 | 0.0% | 0.2% | 292.5/35 0.1% | 100% | 0.99 | 316 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.5% | 0/0 0.0% | 100% | 0.84 | 142 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.9% | 90/12 0.7% | 99% | 0.92 | 135 | shell |
| kit #29 log cabin | 4 | kit | 7528 | kit lod 1 | 150 | 1028 | 0.0% | 1.4% | 112.5/35 0.0% | 100% | 0.97 | 105 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 100% | 0.77 | 98 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 5.1% | 135/12 1.3% | 87% | 0.80 | 82 | shell |
| kit #30 storage shed | 50 | kit | 1318 | kit lod 1 | 150 | 302 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.98 | 48 | siding trim roof deck post floor |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.8% | 0/0 0.0% | 100% | 0.84 | 39 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 0.2% | 90/12 1.0% | 100% | 0.88 | 38 | shell |
| kit #31 outhouse | 14 | kit | 1142 | kit lod 1 | 150 | 302 | 0.0% | 0.1% | 0/0 0.0% | 95% | 0.97 | 36 | siding trim roof deck post floor |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 95% | 0.75 | 20 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.4% | 0.3% | 135/12 1.5% | 95% | 0.74 | 19 | shell |
| kit #32 garage | 5 | kit | 2464 | kit lod 1 | 150 | 380 | 0.0% | 0.0% | 270/12 0.0% | 100% | 1.00 | 85 | siding trim roof post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 97% | 0.80 | 87 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 0.2% | 90/12 0.6% | 93% | 0.89 | 75 | shell |
