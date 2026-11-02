# LODS audit - every far rung of every generated asset of the editor's catalogue (tools/lods_audit.js)

n = how many Jolene places. FIX rows = the proposed ladder (its own lod 1, then less its declared detail roles; all on the real finish). Open structures (marine, sports) are listed but not closed volumes.

leak = share of the covered view whose nearest surface is a back face (the eye looks INTO the building: black); hole = share of the near view where the rung shows something > max(1.5 m, R/10) behind the near outside (see-through, a missing roof or storey); roof = share of the near roofed plan still roofed from above; iou = silhouette against the near mesh (25 views); open = welded edges used once (m).

| building | n | path | near tris | rung | at m | tris | leak | hole | worst view | roof | iou | open m | bags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| big/athletic centre | 0 | item | 3440 | lod 0 keep (plinth+roof+wall) | 150 | 728 | 0.3% | 3.5% | 0/12 3.3% | 100% | 1.00 | 2369 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.5% | 0/0 0.0% | 100% | 0.92 | 127 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 578 | 0.3% | 0.0% | 0/12 3.3% | 100% | 1.00 | 2334 | wall plinth roof door metal glass sign trim beam pane |
|  |  |  |  | FIX R2: its lod 1 shells | 3320 | 410 | 0.3% | 0.2% | 0/12 3.3% | 100% | 1.00 | 2310 | wall plinth roof door glass pane |
| big/boat shed | 3 | item | 1752 | lod 0 keep (plinth+roof+wall) | 150 | 360 | 0.4% | 3.3% | 225/12 0.9% | 100% | 0.98 | 933 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.0% | 0/0 0.0% | 100% | 0.94 | 55 | box |
|  |  |  |  | FIX R1: its lod 1 | 290 | 422 | 0.4% | 0.2% | 135/12 0.8% | 100% | 1.00 | 925 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1547 | 278 | 0.4% | 1.1% | 135/12 0.8% | 100% | 0.99 | 904 | wall plinth roof door glass pane |
| big/cafe | 1 | item | 1660 | lod 0 keep (plinth+roof+wall) | 150 | 252 | 0.0% | 9.4% | 0/0 0.0% | 90% | 0.94 | 569 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.6% | 0/0 0.0% | 97% | 0.88 | 35 | box |
|  |  |  |  | FIX R1: its lod 1 | 200 | 386 | 0.0% | 0.3% | 135/60 0.0% | 100% | 1.00 | 601 | wall plinth roof metal glass sign awning trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1064 | 218 | 0.0% | 5.4% | 315/12 0.0% | 90% | 0.94 | 562 | wall plinth roof glass pane |
| big/cannery | 3 | item | 2880 | lod 0 keep (plinth+wall+roof) | 150 | 608 | 0.5% | 4.0% | 180/12 3.3% | 100% | 0.99 | 1518 | plinth wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 8.0% | 0/0 0.0% | 100% | 0.92 | 97 | box |
|  |  |  |  | FIX R1: its lod 1 | 500 | 538 | 0.4% | 0.3% | 180/12 3.1% | 100% | 1.00 | 1492 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 2666 | 330 | 0.5% | 1.5% | 180/12 3.2% | 100% | 0.99 | 1459 | wall plinth roof door glass pane |
| big/fire hall | 1 | item | 2048 | lod 0 keep (plinth+roof+wall) | 150 | 376 | 0.4% | 6.0% | 0/12 2.5% | 100% | 0.99 | 1033 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.8% | 0/0 0.0% | 100% | 0.94 | 57 | box |
|  |  |  |  | FIX R1: its lod 1 | 300 | 470 | 0.4% | 0.1% | 0/12 2.5% | 100% | 1.00 | 1046 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1601 | 318 | 0.4% | 1.0% | 0/12 2.5% | 100% | 0.99 | 1025 | wall plinth roof door glass pane |
| big/fuel shed | 3 | item | 1202 | lod 0 keep (plinth+roof+wall) | 150 | 210 | 1.1% | 4.1% | 0/60 2.5% | 99% | 0.96 | 351 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.4% | 0/0 0.0% | 100% | 0.75 | 30 | box |
|  |  |  |  | FIX R1: its lod 1 | 161 | 362 | 0.9% | 0.1% | 180/12 2.0% | 100% | 1.00 | 381 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | FIX R2: its lod 1 shells | 859 | 194 | 1.1% | 1.9% | 0/60 2.5% | 99% | 0.96 | 365 | wall plinth roof glass pane |
| big/mine shop | 1 | item | 2212 | lod 0 keep (plinth+roof+wall) | 150 | 380 | 0.4% | 6.6% | 225/12 0.9% | 100% | 0.98 | 923 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.6% | 0/0 0.0% | 100% | 0.92 | 49 | box |
|  |  |  |  | FIX R1: its lod 1 | 270 | 474 | 0.4% | 0.3% | 225/12 0.8% | 100% | 1.00 | 937 | wall plinth roof door metal glass trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1440 | 338 | 0.4% | 1.3% | 135/12 0.9% | 100% | 0.99 | 937 | wall plinth roof door glass pane |
| big/motel | 0 | item | 3132 | lod 0 keep (plinth+wall+roof) | 150 | 448 | 0.7% | 5.4% | 180/12 3.8% | 100% | 0.98 | 942 | plinth wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.5% | 0/0 0.0% | 100% | 0.89 | 66 | box |
|  |  |  |  | FIX R1: its lod 1 | 343 | 634 | 0.5% | 0.1% | 180/12 3.5% | 100% | 1.00 | 915 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1829 | 326 | 0.7% | 2.5% | 180/12 3.7% | 100% | 0.98 | 888 | wall plinth roof glass pane |
| big/store | 2 | item | 1732 | lod 0 keep (plinth+roof+wall) | 150 | 276 | 0.0% | 8.9% | 0/0 0.0% | 90% | 0.94 | 680 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.7% | 0/0 0.0% | 97% | 0.88 | 41 | box |
|  |  |  |  | FIX R1: its lod 1 | 230 | 394 | 0.0% | 0.2% | 135/12 0.0% | 100% | 1.00 | 682 | wall plinth roof metal glass sign awning trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1226 | 226 | 0.0% | 5.4% | 135/12 0.0% | 90% | 0.94 | 636 | wall plinth roof glass pane |
| big/swimming pool | 0 | item | 2660 | lod 0 keep (plinth+wall+roof) | 150 | 560 | 0.3% | 5.8% | 45/12 0.8% | 100% | 0.99 | 1717 | plinth wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.7% | 0/0 0.0% | 100% | 0.91 | 99 | box |
|  |  |  |  | FIX R1: its lod 1 | 490 | 594 | 0.3% | 0.0% | 45/12 0.6% | 100% | 1.00 | 1819 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | FIX R2: its lod 1 shells | 2614 | 354 | 0.3% | 0.5% | 45/12 0.8% | 100% | 0.99 | 1799 | wall plinth roof glass pane |
| big/technical services | 2 | item | 2334 | lod 0 keep (plinth+roof+wall) | 150 | 366 | 0.4% | 7.1% | 180/12 2.4% | 100% | 0.99 | 1064 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.2% | 0/0 0.0% | 100% | 0.94 | 55 | box |
|  |  |  |  | FIX R1: its lod 1 | 292 | 470 | 0.4% | 0.2% | 180/12 2.2% | 100% | 1.00 | 1063 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1556 | 330 | 0.4% | 1.0% | 180/12 2.3% | 100% | 0.99 | 1043 | wall plinth roof door glass pane |
| big/terminal | 2 | item | 3072 | lod 0 keep (plinth+wall+roof) | 150 | 540 | 0.1% | 7.3% | 45/12 0.4% | 100% | 0.98 | 1563 | plinth wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.7% | 0/0 0.0% | 100% | 0.89 | 91 | box |
|  |  |  |  | FIX R1: its lod 1 | 456 | 670 | 0.0% | 0.1% | 45/12 0.1% | 100% | 1.00 | 1566 | wall plinth roof metal glass sign trim beam pane |
|  |  |  |  | FIX R2: its lod 1 shells | 2434 | 394 | 0.1% | 1.4% | 45/12 0.4% | 100% | 0.98 | 1538 | wall plinth roof glass pane |
| big/tram shed | 0 | item | 1566 | lod 0 keep (plinth+roof+wall) | 150 | 398 | 0.4% | 3.4% | 45/12 0.8% | 100% | 0.99 | 1087 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.8% | 0/0 0.0% | 100% | 0.94 | 53 | box |
|  |  |  |  | FIX R1: its lod 1 | 277 | 418 | 0.4% | 0.1% | 45/12 0.8% | 100% | 1.00 | 1108 | wall plinth roof door metal glass trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1476 | 334 | 0.4% | 0.4% | 45/12 0.8% | 100% | 0.99 | 1108 | wall plinth roof door glass pane |
| big/warehouse | 3 | item | 2626 | lod 0 keep (plinth+wall+roof) | 150 | 510 | 0.3% | 3.9% | 45/12 0.8% | 100% | 0.99 | 1268 | plinth wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 8.6% | 0/0 0.0% | 100% | 0.90 | 80 | box |
|  |  |  |  | FIX R1: its lod 1 | 409 | 538 | 0.3% | 0.3% | 270/12 0.6% | 100% | 1.00 | 1246 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 2181 | 350 | 0.3% | 1.3% | 45/12 0.8% | 100% | 0.99 | 1222 | wall plinth roof door glass pane |
| big/workshop | 3 | item | 1954 | lod 0 keep (plinth+roof+wall) | 150 | 326 | 0.6% | 5.5% | 0/12 2.9% | 100% | 0.98 | 839 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.8% | 0/0 0.0% | 100% | 0.92 | 45 | box |
|  |  |  |  | FIX R1: its lod 1 | 242 | 418 | 0.6% | 0.3% | 0/12 2.5% | 100% | 1.00 | 840 | wall plinth roof door metal glass sign trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1292 | 278 | 0.6% | 1.5% | 0/12 2.7% | 100% | 0.98 | 821 | wall plinth roof door glass pane |
| hangar/club hangar | 0 | item | 3168 | lod 0 keep (stem+wall+roof) | 150 | 494 | 0.6% | 7.8% | 45/12 3.7% | 98% | 0.99 | 1727 | stem wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.9% | 0/0 0.0% | 98% | 0.95 | 113 | box |
|  |  |  |  | FIX R1: its lod 1 | 558 | 564 | 0.2% | 0.0% | 135/12 0.4% | 100% | 1.00 | 1582 | wall stem roof door metal trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 2975 | 384 | 0.2% | 0.1% | 225/12 0.5% | 98% | 0.99 | 1580 | wall stem roof door pane |
| hangar/club hangar, long | 1 | item | 3382 | lod 0 keep (wall+stem+roof) | 150 | 488 | 0.6% | 7.2% | 45/12 3.8% | 97% | 0.99 | 1746 | wall stem roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.2% | 0/0 0.0% | 97% | 0.95 | 115 | box |
|  |  |  |  | FIX R1: its lod 1 | 567 | 564 | 0.2% | 0.1% | 45/12 0.6% | 100% | 1.00 | 1583 | wall stem roof door metal trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 3022 | 384 | 0.2% | 0.1% | 225/12 0.8% | 97% | 0.99 | 1581 | wall stem roof door pane |
| hangar/field shed | 1 | item | 1494 | lod 0 keep (stem+wall+roof) | 150 | 306 | 0.4% | 2.6% | 45/12 0.8% | 97% | 0.99 | 818 | stem wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.8% | 0/0 0.0% | 97% | 0.91 | 67 | box |
|  |  |  |  | FIX R1: its lod 1 | 337 | 430 | 0.3% | 0.1% | 180/12 0.7% | 100% | 1.00 | 715 | wall stem roof door metal trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1799 | 238 | 0.4% | 0.5% | 45/12 0.8% | 97% | 0.99 | 713 | wall stem roof door pane |
| hangar/field shed, small | 1 | item | 1010 | lod 0 keep (stem+wall+roof) | 150 | 250 | 0.6% | 2.3% | 90/12 2.5% | 97% | 0.99 | 610 | stem wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.3% | 0/0 0.0% | 97% | 0.90 | 53 | box |
|  |  |  |  | FIX R1: its lod 1 | 268 | 362 | 0.5% | 0.1% | 90/12 2.5% | 100% | 1.00 | 537 | wall stem roof door metal trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1431 | 202 | 0.6% | 0.3% | 90/12 2.5% | 97% | 0.99 | 535 | wall stem roof door pane |
| hangar/works hangar | 0 | item | 3878 | lod 0 keep (stem+wall+roof) | 150 | 716 | 0.3% | 5.6% | 45/12 2.1% | 100% | 1.00 | 2509 | stem wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.7% | 0/0 0.0% | 100% | 0.97 | 163 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 612 | 0.1% | 0.0% | 22.5/35 0.2% | 100% | 1.00 | 2308 | wall stem roof door metal trim pane |
|  |  |  |  | FIX R2: its lod 1 shells | 4215 | 432 | 0.1% | 0.1% | 225/12 0.3% | 100% | 1.00 | 2306 | wall stem roof door pane |
| house/air taxi office | 2 | item | 5118 | lod 0 keep (stone+roof+siding) | 150 | 1900 | 1.9% | 3.9% | 0/12 3.6% | 90% | 0.92 | 479 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.5% | 0/0 0.0% | 91% | 0.76 | 36 | box |
|  |  |  |  | FIX R1: its lod 1 | 216 | 652 | 1.8% | 0.3% | 0/12 3.5% | 98% | 0.99 | 178 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1151 | 388 | 1.8% | 0.6% | 0/12 3.6% | 98% | 0.97 | 144 | siding roof deck stone metal floor |
| house/bear tours | 1 | item | 10452 | lod 0 keep (post+roof+siding) | 150 | 3612 | 1.8% | 2.0% | 0/12 3.4% | 97% | 0.89 | 447 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.6% | 0/0 0.0% | 100% | 0.61 | 41 | box |
|  |  |  |  | FIX R1: its lod 1 | 216 | 996 | 1.7% | 0.9% | 0/12 3.2% | 100% | 0.96 | 157 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1150 | 544 | 1.7% | 1.1% | 0/12 3.3% | 99% | 0.92 | 138 | siding roof deck metal floor log |
| house/bunkhouse | 2 | item | 14694 | lod 0 keep (post+roof+siding) | 150 | 6724 | 1.4% | 2.3% | 180/12 3.8% | 87% | 0.93 | 902 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.9% | 0/0 0.0% | 100% | 0.58 | 60 | box |
|  |  |  |  | FIX R1: its lod 1 | 302 | 1550 | 1.4% | 0.7% | 180/12 3.8% | 100% | 0.98 | 344 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1611 | 436 | 1.4% | 0.7% | 180/12 4.0% | 99% | 0.93 | 271 | siding roof deck metal floor log |
| house/cafe | 4 | item | 9528 | lod 0 keep (floor+roof+siding) | 150 | 1772 | 1.6% | 3.9% | 180/12 3.1% | 94% | 0.84 | 557 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.4% | 0/0 0.0% | 94% | 0.82 | 37 | box |
|  |  |  |  | FIX R1: its lod 1 | 231 | 1022 | 1.3% | 0.6% | 180/12 2.9% | 100% | 0.97 | 214 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | FIX R2: its lod 1 shells | 1233 | 404 | 1.4% | 1.9% | 180/12 3.0% | 97% | 0.95 | 163 | siding roof deck metal floor |
| house/cannery shed | 0 | item | 29292 | lod 0 keep (roof+floor+siding) | 150 | 7976 | 1.0% | 3.0% | 135/12 1.9% | 92% | 0.93 | 2498 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 12% | 0/0 0.0% | 92% | 0.81 | 74 | box |
|  |  |  |  | FIX R1: its lod 1 | 468 | 2202 | 0.7% | 0.3% | 135/12 1.7% | 100% | 0.99 | 634 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 2496 | 550 | 0.9% | 0.7% | 135/12 1.8% | 98% | 0.96 | 438 | siding roof deck metal floor log |
| house/chapel | 2 | item | 7854 | lod 0 keep (floor+roof+siding) | 150 | 1490 | 1.8% | 2.5% | 225/12 2.8% | 100% | 0.93 | 516 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.70 | 27 | box |
|  |  |  |  | FIX R1: its lod 1 | 204 | 623 | 1.6% | 0.4% | 225/12 2.3% | 100% | 0.98 | 193 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1088 | 209 | 1.8% | 0.5% | 225/12 2.8% | 100% | 0.96 | 153 | siding roof deck metal floor log |
| house/church | 2 | item | 7500 | lod 0 keep (floor+roof+siding) | 150 | 2624 | 1.5% | 2.7% | 0/12 2.8% | 99% | 0.93 | 824 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.4% | 0/0 0.0% | 99% | 0.69 | 43 | box |
|  |  |  |  | FIX R1: its lod 1 | 312 | 879 | 1.3% | 0.2% | 180/12 2.6% | 99% | 0.98 | 311 | siding trim roof deck post metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1665 | 231 | 1.4% | 0.4% | 180/12 2.7% | 99% | 0.95 | 234 | siding roof deck metal floor |
| house/clinic | 5 | item | 13176 | lod 0 keep (stone+siding+roof) | 150 | 5590 | 1.5% | 4.0% | 180/12 4.7% | 95% | 0.95 | 1222 | stone siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.3% | 0/0 0.0% | 98% | 0.77 | 75 | box |
|  |  |  |  | FIX R1: its lod 1 | 388 | 1372 | 1.4% | 0.6% | 180/12 4.7% | 100% | 0.99 | 522 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 2070 | 856 | 1.5% | 0.9% | 180/12 4.7% | 100% | 0.99 | 447 | siding roof deck stone metal floor |
| house/clubhouse | 0 | item | 5038 | lod 0 keep (stone+roof+siding) | 150 | 2160 | 2.0% | 2.1% | 0/12 6.4% | 98% | 0.95 | 676 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.1% | 0/0 0.0% | 98% | 0.89 | 42 | box |
|  |  |  |  | FIX R1: its lod 1 | 216 | 504 | 1.9% | 1.1% | 0/12 6.3% | 100% | 0.99 | 218 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1151 | 226 | 1.9% | 1.2% | 0/12 6.4% | 100% | 0.98 | 190 | siding roof deck stone metal floor |
| house/concession stand | 0 | item | 2526 | lod 0 keep (stone+roof+siding) | 150 | 858 | 2.3% | 4.1% | 0/12 4.2% | 90% | 0.94 | 297 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.4% | 0/0 0.0% | 90% | 0.85 | 21 | box |
|  |  |  |  | FIX R1: its lod 1 | 124 | 324 | 2.2% | 0.4% | 0/12 4.1% | 97% | 0.98 | 125 | siding trim roof deck post stone floor pane awning |
|  |  |  |  | FIX R2: its lod 1 shells | 662 | 108 | 2.2% | 1.6% | 0/12 4.2% | 90% | 0.96 | 97 | siding roof deck stone floor |
| house/control tower | 0 | item | 13648 | lod 0 keep (roof+floor+siding) | 150 | 6214 | 11% | 12% | 270/60 22% | 55% | 0.84 | 988 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 14% | 0/0 0.0% | 97% | 0.68 | 37 | box |
|  |  |  |  | FIX R1: its lod 1 | 371 | 1226 | 1.4% | 0.3% | 180/12 2.9% | 97% | 0.99 | 430 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | FIX R2: its lod 1 shells | 1980 | 766 | 2.7% | 2.7% | 180/60 5.1% | 82% | 0.97 | 332 | siding roof glass deck stone metal floor |
| house/fish shack | 2 | item | 7670 | lod 0 keep (roof+post+siding) | 150 | 2404 | 1.7% | 1.9% | 315/12 3.1% | 79% | 0.77 | 254 | roof post siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.4% | 0/0 0.0% | 97% | 0.45 | 27 | box |
|  |  |  |  | FIX R1: its lod 1 | 387 | 1014 | 1.4% | 1.1% | 45/12 2.7% | 96% | 0.93 | 127 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | FIX R2: its lod 1 shells | 2065 | 232 | 1.9% | 0.8% | 45/12 4.2% | 91% | 0.68 | 101 | siding roof deck metal floor log |
| house/flight service | 0 | item | 7556 | lod 0 keep (stone+siding+roof) | 150 | 2688 | 1.5% | 4.6% | 180/12 3.5% | 93% | 0.93 | 662 | stone siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.1% | 0/0 0.0% | 96% | 0.80 | 49 | box |
|  |  |  |  | FIX R1: its lod 1 | 258 | 884 | 1.4% | 0.8% | 180/12 3.3% | 98% | 0.99 | 242 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1375 | 508 | 1.4% | 1.1% | 180/12 3.4% | 98% | 0.99 | 190 | siding roof deck stone metal floor |
| house/flying club | 1 | item | 13882 | lod 0 keep (floor+siding+roof) | 150 | 2608 | 1.5% | 2.5% | 45/12 3.8% | 98% | 0.89 | 889 | floor siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.3% | 0/0 0.0% | 98% | 0.85 | 54 | box |
|  |  |  |  | FIX R1: its lod 1 | 315 | 1262 | 1.3% | 1.1% | 180/12 3.5% | 100% | 0.98 | 275 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | FIX R2: its lod 1 shells | 1679 | 456 | 1.4% | 1.7% | 180/12 3.7% | 100% | 0.95 | 211 | siding roof deck metal floor |
| house/fuel and bait | 1 | item | 4750 | lod 0 keep (post+roof+siding) | 150 | 2430 | 1.9% | 3.1% | 225/12 3.0% | 85% | 0.88 | 351 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.9% | 0/0 0.0% | 100% | 0.63 | 35 | box |
|  |  |  |  | FIX R1: its lod 1 | 187 | 724 | 1.7% | 0.6% | 225/12 3.0% | 100% | 0.96 | 148 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | FIX R2: its lod 1 shells | 998 | 232 | 1.9% | 1.9% | 135/12 3.4% | 97% | 0.89 | 119 | siding roof deck metal floor |
| house/gambrel barn | 0 | item | 13326 | lod 0 keep (roof+floor+siding) | 150 | 4324 | 1.2% | 1.7% | 0/60 1.9% | 96% | 0.93 | 1110 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 12% | 0/0 0.0% | 96% | 0.86 | 47 | box |
|  |  |  |  | FIX R1: its lod 1 | 293 | 1038 | 1.1% | 0.2% | 180/12 2.0% | 100% | 0.99 | 452 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1563 | 412 | 1.3% | 0.4% | 180/12 2.0% | 100% | 0.99 | 394 | siding roof deck stone metal floor log |
| house/garage | 1 | item | 2464 | lod 0 keep (stone+roof+siding) | 150 | 962 | 2.3% | 2.9% | 180/12 4.5% | 95% | 0.98 | 296 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.0% | 0/0 0.0% | 96% | 0.77 | 30 | box |
|  |  |  |  | FIX R1: its lod 1 | 155 | 368 | 2.2% | 0.3% | 180/12 4.5% | 100% | 1.00 | 134 | siding trim roof post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 827 | 244 | 2.2% | 0.3% | 180/12 4.5% | 100% | 0.99 | 120 | siding roof stone metal floor |
| house/general store | 4 | item | 6684 | lod 0 keep (floor+roof+siding) | 150 | 2740 | 1.2% | 3.3% | 180/12 2.8% | 94% | 0.86 | 743 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.9% | 0/0 0.0% | 94% | 0.81 | 44 | box |
|  |  |  |  | FIX R1: its lod 1 | 272 | 764 | 1.1% | 0.5% | 180/12 2.7% | 99% | 0.98 | 317 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | FIX R2: its lod 1 shells | 1450 | 158 | 1.1% | 2.0% | 180/12 2.8% | 94% | 0.96 | 261 | siding roof deck metal floor |
| house/hip cottage | 1 | item | 11872 | lod 0 keep (stone+siding+roof) | 150 | 2384 | 1.7% | 3.7% | 225/12 3.1% | 94% | 0.95 | 624 | stone siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.1% | 0/0 0.0% | 95% | 0.78 | 43 | box |
|  |  |  |  | FIX R1: its lod 1 | 234 | 988 | 1.6% | 1.9% | 225/12 3.0% | 99% | 0.98 | 200 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1247 | 540 | 1.6% | 2.1% | 225/12 3.0% | 99% | 0.98 | 159 | siding roof deck stone metal floor log |
| house/kennecott mill | 1 | item | 113532 | lod 0 keep (roof+floor+siding) | 150 | 43040 | 1.3% | 1.7% | 45/12 2.7% | 95% | 0.88 | 13371 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.1% | 0/0 0.0% | 100% | 0.18 | 363 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 11216 | 1.0% | 0.6% | 225/12 2.4% | 95% | 0.95 | 4079 | siding trim roof glass deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 11420 | 2580 | 1.1% | 1.2% | 225/12 2.5% | 95% | 0.92 | 3184 | siding roof glass deck stone metal floor |
| house/lighthouse | 0 | item | 13322 | lod 0 keep (stone+roof+siding) | 150 | 5476 | 6.1% | 7.7% | 180/60 8.8% | 79% | 0.92 | 978 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 8.6% | 0/0 0.0% | 93% | 0.61 | 54 | box |
|  |  |  |  | FIX R1: its lod 1 | 373 | 1434 | 1.5% | 0.3% | 180/12 3.4% | 98% | 0.99 | 469 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | FIX R2: its lod 1 shells | 1991 | 978 | 3.6% | 3.3% | 180/60 5.6% | 88% | 0.97 | 386 | siding roof glass deck stone metal floor |
| house/lighthouse octagon | 0 | item | 11810 | lod 0 keep (roof+floor+siding) | 150 | 5192 | 3.7% | 7.9% | 67.5/35 5.0% | 96% | 0.90 | 985 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.6% | 0/0 0.0% | 96% | 0.78 | 44 | box |
|  |  |  |  | FIX R1: its lod 1 | 301 | 1114 | 1.3% | 0.2% | 0/12 2.6% | 100% | 1.00 | 390 | siding trim roof glass deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1608 | 682 | 2.1% | 2.3% | 270/12 2.9% | 100% | 0.99 | 281 | siding roof glass deck stone metal floor |
| house/log cabin | 7 | item | 9580 | lod 0 keep (post+siding+roof) | 150 | 3068 | 1.9% | 2.8% | 135/12 3.6% | 98% | 0.94 | 446 | post siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.8% | 0/0 0.0% | 98% | 0.71 | 35 | box |
|  |  |  |  | FIX R1: its lod 1 | 181 | 848 | 1.9% | 2.0% | 225/12 3.5% | 98% | 0.96 | 142 | siding trim roof deck post stone floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 966 | 444 | 1.9% | 2.0% | 135/12 3.6% | 98% | 0.94 | 125 | siding roof deck stone floor log |
| house/marine supply | 2 | item | 7634 | lod 0 keep (floor+roof+siding) | 150 | 2410 | 1.3% | 3.2% | 180/12 3.1% | 82% | 0.83 | 687 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.6% | 0/0 0.0% | 82% | 0.83 | 42 | box |
|  |  |  |  | FIX R1: its lod 1 | 273 | 952 | 1.1% | 0.5% | 180/12 2.9% | 100% | 0.97 | 262 | siding trim roof deck post metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1455 | 278 | 1.1% | 1.0% | 180/12 3.0% | 99% | 0.94 | 221 | siding roof deck metal floor |
| house/mine bunkhouse | 1 | item | 19272 | lod 0 keep (roof+floor+siding) | 150 | 4822 | 0.9% | 3.1% | 270/12 2.1% | 99% | 0.95 | 1781 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.5% | 0/0 0.0% | 99% | 0.81 | 57 | box |
|  |  |  |  | FIX R1: its lod 1 | 313 | 1518 | 1.6% | 0.5% | 0/12 4.1% | 100% | 0.99 | 504 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1669 | 454 | 1.6% | 0.5% | 0/12 4.2% | 100% | 0.97 | 366 | siding roof deck metal floor log |
| house/mine cottage | 7 | item | 9816 | lod 0 keep (floor+roof+siding) | 150 | 1696 | 1.4% | 2.7% | 90/12 2.9% | 98% | 0.91 | 718 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.8% | 0/0 0.0% | 98% | 0.81 | 35 | box |
|  |  |  |  | FIX R1: its lod 1 | 200 | 976 | 1.9% | 1.1% | 45/12 3.8% | 98% | 0.97 | 203 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1065 | 384 | 2.0% | 1.2% | 45/12 3.9% | 98% | 0.96 | 169 | siding roof deck metal floor log |
| house/mine dormer hall | 1 | item | 22630 | lod 0 keep (roof+siding+floor) | 150 | 6628 | 0.9% | 3.0% | 90/12 2.3% | 100% | 0.97 | 2798 | roof siding floor |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.3% | 0/0 0.0% | 100% | 0.86 | 76 | box |
|  |  |  |  | FIX R1: its lod 1 | 420 | 1754 | 1.2% | 0.3% | 0/12 3.4% | 100% | 0.99 | 561 | siding trim roof deck post stone floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 2242 | 612 | 1.3% | 0.5% | 0/12 3.5% | 100% | 0.98 | 404 | siding roof deck stone floor log |
| house/mine mess hall | 1 | item | 14028 | lod 0 keep (floor+siding+roof) | 150 | 3342 | 1.1% | 3.0% | 45/12 2.2% | 96% | 0.88 | 1092 | floor siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.4% | 0/0 0.0% | 98% | 0.82 | 54 | box |
|  |  |  |  | FIX R1: its lod 1 | 306 | 1078 | 1.0% | 1.0% | 45/12 2.0% | 98% | 0.98 | 312 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1633 | 256 | 1.0% | 1.1% | 45/12 2.1% | 98% | 0.96 | 237 | siding roof deck metal floor log |
| house/mine office | 1 | item | 12992 | lod 0 keep (roof+floor+siding) | 150 | 3936 | 1.8% | 5.4% | 0/12 3.6% | 94% | 0.94 | 1311 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.6% | 0/0 0.0% | 95% | 0.78 | 46 | box |
|  |  |  |  | FIX R1: its lod 1 | 270 | 1356 | 1.4% | 1.5% | 0/12 3.5% | 99% | 0.98 | 291 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1440 | 560 | 1.6% | 1.8% | 0/12 3.5% | 99% | 0.97 | 195 | siding roof deck stone metal floor |
| house/modern dark | 0 | item | 11906 | lod 0 keep (roof+floor+siding) | 150 | 2456 | 1.6% | 5.6% | 0/12 2.8% | 84% | 0.84 | 857 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.6% | 0/0 0.0% | 89% | 0.81 | 33 | box |
|  |  |  |  | FIX R1: its lod 1 | 242 | 988 | 1.3% | 1.3% | 45/12 2.3% | 98% | 0.97 | 264 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1292 | 358 | 1.4% | 1.4% | 45/12 2.5% | 98% | 0.94 | 188 | siding roof deck metal floor log |
| house/motel | 2 | item | 13636 | lod 0 keep (siding+floor+roof) | 150 | 3804 | 1.6% | 1.9% | 180/12 5.5% | 97% | 0.92 | 1186 | siding floor roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.0% | 0/0 0.0% | 98% | 0.90 | 71 | box |
|  |  |  |  | FIX R1: its lod 1 | 384 | 1368 | 1.5% | 0.8% | 180/12 5.0% | 100% | 0.99 | 358 | siding trim roof deck post metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 2046 | 392 | 1.5% | 1.0% | 180/12 5.3% | 100% | 0.96 | 284 | siding roof deck metal floor |
| house/net loft | 0 | item | 12844 | lod 0 keep (roof+siding+post) | 150 | 5586 | 1.1% | 2.1% | 135/12 2.3% | 80% | 0.88 | 582 | roof siding post |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 7.4% | 0/0 0.0% | 99% | 0.54 | 58 | box |
|  |  |  |  | FIX R1: its lod 1 | 464 | 1562 | 1.0% | 0.5% | 135/12 2.2% | 99% | 0.96 | 258 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | FIX R2: its lod 1 shells | 2474 | 424 | 1.1% | 0.3% | 135/12 2.8% | 95% | 0.82 | 190 | siding roof deck metal floor log |
| house/outhouse | 1 | item | 1142 | lod 0 keep (post+trim+siding) | 150 | 862 | 0.1% | 3.5% | 90/12 0.2% | 51% | 0.89 | 63 | post trim siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.4% | 0/0 0.0% | 100% | 0.63 | 10 | box |
|  |  |  |  | FIX R1: its lod 1 | 65 | 290 | 3.5% | 0.7% | 225/12 4.9% | 90% | 0.96 | 48 | siding trim roof deck post floor |
|  |  |  |  | FIX R2: its lod 1 shells | 349 | 96 | 3.7% | 0.8% | 225/12 5.2% | 90% | 0.91 | 43 | siding roof deck floor |
| house/over the water | 0 | item | 15444 | lod 0 keep (floor+post+siding) | 150 | 4600 | 0.0% | 25% | 0/0 0.0% | 64% | 0.80 | 634 | floor post siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 12% | 0/0 0.0% | 99% | 0.49 | 42 | box |
|  |  |  |  | FIX R1: its lod 1 | 453 | 1604 | 1.2% | 0.9% | 180/60 3.7% | 99% | 0.95 | 255 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | FIX R2: its lod 1 shells | 2416 | 424 | 1.5% | 0.5% | 0/12 4.5% | 97% | 0.77 | 145 | siding roof deck metal floor log |
| house/pilot hut | 2 | item | 9134 | lod 0 keep (floor+roof+siding) | 150 | 1488 | 2.3% | 2.2% | 315/12 4.1% | 97% | 0.84 | 350 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 98% | 0.82 | 26 | box |
|  |  |  |  | FIX R1: its lod 1 | 157 | 876 | 1.9% | 1.1% | 45/12 3.6% | 99% | 0.96 | 128 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 838 | 496 | 2.0% | 1.2% | 45/12 3.7% | 99% | 0.93 | 111 | siding roof deck metal floor log |
| house/police | 1 | item | 10766 | lod 0 keep (stone+roof+siding) | 150 | 4200 | 1.6% | 3.9% | 0/12 4.1% | 97% | 0.94 | 902 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.1% | 0/0 0.0% | 98% | 0.77 | 56 | box |
|  |  |  |  | FIX R1: its lod 1 | 323 | 1348 | 1.5% | 0.3% | 0/12 3.6% | 100% | 0.99 | 427 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | FIX R2: its lod 1 shells | 1724 | 896 | 1.6% | 0.9% | 0/12 4.0% | 99% | 0.98 | 374 | siding roof deck stone metal floor |
| house/post office | 1 | item | 9382 | lod 0 keep (floor+roof+siding) | 150 | 1768 | 1.9% | 3.6% | 0/12 5.0% | 93% | 0.88 | 626 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.3% | 0/0 0.0% | 95% | 0.80 | 39 | box |
|  |  |  |  | FIX R1: its lod 1 | 253 | 1066 | 1.7% | 0.9% | 0/12 4.6% | 96% | 0.97 | 209 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | FIX R2: its lod 1 shells | 1351 | 456 | 1.8% | 1.5% | 0/12 4.7% | 96% | 0.93 | 158 | siding roof deck metal floor |
| house/saltbox cottage | 2 | item | 10664 | lod 0 keep (floor+roof+siding) | 150 | 1502 | 1.6% | 2.3% | 180/12 2.7% | 95% | 0.86 | 600 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.2% | 0/0 0.0% | 97% | 0.80 | 34 | box |
|  |  |  |  | FIX R1: its lod 1 | 213 | 1034 | 1.9% | 0.8% | 0/12 3.7% | 99% | 0.97 | 225 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1135 | 508 | 2.0% | 0.9% | 0/12 3.9% | 99% | 0.95 | 203 | siding roof deck stone metal floor log |
| house/saltbox farmhouse | 0 | item | 15448 | lod 0 keep (roof+floor+siding) | 150 | 3022 | 1.0% | 3.8% | 180/12 2.2% | 95% | 0.89 | 1239 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.0% | 0/0 0.0% | 97% | 0.82 | 40 | box |
|  |  |  |  | FIX R1: its lod 1 | 252 | 1286 | 1.4% | 0.6% | 45/12 2.3% | 100% | 0.98 | 358 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1345 | 572 | 1.6% | 0.9% | 45/12 2.6% | 100% | 0.97 | 269 | siding roof deck stone metal floor log |
| house/school | 4 | item | 20664 | lod 0 keep (siding2+floor+stone) | 150 | 4588 | 0.0% | 54% | 0/0 0.0% | 2.4% | 0.83 | 525 | siding2 floor stone |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.0% | 0/0 0.0% | 94% | 0.74 | 116 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 1520 | 0.8% | 0.4% | 45/12 2.3% | 97% | 0.99 | 759 | siding trim roof deck post stone metal floor pane flag siding2 trim2 roof2 |
|  |  |  |  | FIX R2: its lod 1 shells | 3440 | 804 | 0.8% | 0.7% | 45/12 2.4% | 97% | 0.99 | 632 | siding roof deck stone metal floor siding2 roof2 |
| house/shore cabin | 0 | item | 12896 | lod 0 keep (post+siding+roof) | 150 | 3736 | 1.6% | 2.8% | 0/12 3.4% | 85% | 0.90 | 575 | post siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.3% | 0/0 0.0% | 98% | 0.60 | 51 | box |
|  |  |  |  | FIX R1: its lod 1 | 258 | 1004 | 1.4% | 0.8% | 0/12 3.1% | 98% | 0.97 | 213 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1375 | 412 | 1.5% | 0.9% | 0/12 3.3% | 98% | 0.93 | 172 | siding roof deck metal floor log |
| house/storage shed | 2 | item | 4830 | lod 0 keep (post+roof+siding) | 150 | 1018 | 3.0% | 1.8% | 225/12 4.5% | 94% | 0.93 | 147 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.4% | 0/0 0.0% | 100% | 0.65 | 17 | box |
|  |  |  |  | FIX R1: its lod 1 | 100 | 318 | 2.9% | 0.7% | 225/12 4.5% | 99% | 0.96 | 72 | siding trim roof deck post metal floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 534 | 124 | 3.0% | 0.7% | 225/12 4.7% | 99% | 0.93 | 67 | siding roof deck metal floor log |
| house/town hall | 1 | item | 17384 | lod 0 keep (roof+floor+siding) | 150 | 5102 | 1.5% | 6.8% | 90/12 3.1% | 94% | 0.93 | 1774 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.3% | 0/0 0.0% | 95% | 0.71 | 56 | box |
|  |  |  |  | FIX R1: its lod 1 | 358 | 1609 | 1.0% | 1.0% | 270/12 2.4% | 97% | 0.99 | 458 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | FIX R2: its lod 1 shells | 1908 | 611 | 1.4% | 1.7% | 270/12 2.9% | 97% | 0.97 | 276 | siding roof deck stone metal floor |
| house/tram base station | 1 | item | 32230 | lod 0 keep (roof+floor+siding) | 150 | 10992 | 0.8% | 12% | 0/12 2.5% | 77% | 0.94 | 1779 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 10% | 0/0 0.0% | 98% | 0.85 | 101 | box |
|  |  |  |  | FIX R1: its lod 1 | 582 | 4132 | 0.9% | 0.6% | 0/12 2.4% | 99% | 1.00 | 732 | siding trim roof glass deck post stone metal floor pane steel girder siding2 trim2 roof2 |
|  |  |  |  | FIX R2: its lod 1 shells | 3105 | 2564 | 1.0% | 1.6% | 0/12 2.4% | 99% | 0.99 | 606 | siding roof glass deck stone metal floor steel girder siding2 roof2 |
| house/tram top station | 1 | item | 47640 | lod 0 keep (siding+floor+steel) | 150 | 14996 | 0.0% | 26% | 0/0 0.0% | 92% | 0.76 | 1736 | siding floor steel |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.0% | 0/0 0.0% | 99% | 0.35 | 175 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 10312 | 1.3% | 1.4% | 90/12 4.9% | 100% | 0.99 | 1696 | siding trim roof glass deck post stone metal floor pane steel girder siding2 trim2 roof2 siding3 trim3 roof3 |
|  |  |  |  | FIX R2: its lod 1 shells | 5453 | 8208 | 1.4% | 1.5% | 90/12 4.9% | 100% | 0.99 | 1283 | siding roof glass deck stone metal floor steel girder siding2 roof2 siding3 roof3 |
| house/vet clinic | 0 | item | 7612 | lod 0 keep (stone+siding+roof) | 150 | 2592 | 1.2% | 3.5% | 0/12 3.8% | 94% | 0.94 | 617 | stone siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.3% | 0/0 0.0% | 96% | 0.78 | 46 | box |
|  |  |  |  | FIX R1: its lod 1 | 248 | 884 | 1.1% | 0.5% | 0/12 3.2% | 100% | 0.99 | 224 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 1321 | 508 | 1.2% | 0.7% | 0/12 3.7% | 100% | 0.99 | 180 | siding roof deck stone metal floor |
| house/village church | 1 | item | 8774 | lod 0 keep (floor+roof+siding) | 150 | 1792 | 1.8% | 2.9% | 45/12 2.9% | 96% | 0.93 | 609 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 96% | 0.73 | 32 | box |
|  |  |  |  | FIX R1: its lod 1 | 218 | 695 | 1.6% | 0.4% | 180/12 2.4% | 97% | 0.98 | 228 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1163 | 219 | 1.8% | 0.5% | 45/12 2.8% | 97% | 0.96 | 174 | siding roof deck metal floor log |
| house/village house | 0 | item | 13890 | lod 0 keep (roof+floor+siding) | 150 | 2582 | 1.5% | 5.0% | 45/12 2.4% | 93% | 0.90 | 1113 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.5% | 0/0 0.0% | 95% | 0.81 | 34 | box |
|  |  |  |  | FIX R1: its lod 1 | 220 | 1120 | 1.4% | 0.5% | 45/12 2.3% | 97% | 0.98 | 312 | siding trim roof deck post metal floor pane log |
|  |  |  |  | FIX R2: its lod 1 shells | 1171 | 452 | 1.5% | 0.6% | 45/12 2.4% | 97% | 0.95 | 217 | siding roof deck metal floor log |
| house/woodshed | 0 | item | 8310 | lod 0 keep (roof+siding+deck) | 150 | 4502 | 4.1% | 2.6% | 337.5/35 10.0% | 95% | 0.83 | 125 | roof siding deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 95% | 0.83 | 16 | box |
|  |  |  |  | FIX R1: its lod 1 | 93 | 318 | 2.8% | 1.4% | 45/12 4.8% | 96% | 0.95 | 60 | siding trim roof deck post floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 494 | 90 | 3.6% | 2.8% | 22.5/35 8.0% | 96% | 0.91 | 60 | siding roof deck floor log |
| marine/boat harbour floats | 4 | item | 8536 | lod 0 keep (beam+deck+body) | 150 | 6852 | 0.0% | 0.5% | 0/0 0.0% | 99% | 0.93 | 0 | beam deck body |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.6% | 0/0 0.0% | 100% | 0.20 | 197 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 8536 | 0.2% | 0.0% | 90/12 0.9% | 100% | 1.00 | 27 | deck pile beam steel body glass |
|  |  |  |  | FIX R2: its lod 1 shells | 5682 | 8536 | 0.2% | 0.0% | 90/12 0.9% | 100% | 1.00 | 27 | deck pile beam steel body glass |
| marine/breakwater | 15 | item | 994 | lod 0 keep (rock) | 150 | 994 | 49% | 0.0% | 0/12 63% | 100% | 1.00 | 186 | rock |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 100% | 0.84 | 191 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 994 | 49% | 0.0% | 0/12 63% | 100% | 1.00 | 186 | rock |
|  |  |  |  | FIX R2: its lod 1 shells | 4908 | 994 | 49% | 0.0% | 0/12 63% | 100% | 1.00 | 186 | rock |
| marine/breakwater, light | 1 | item | 1084 | lod 0 keep (rock) | 150 | 1084 | 47% | 0.0% | 0/12 63% | 100% | 1.00 | 207 | rock |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 7.1% | 0/0 0.0% | 100% | 0.85 | 213 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 1084 | 47% | 0.0% | 0/12 63% | 100% | 1.00 | 207 | rock |
|  |  |  |  | FIX R2: its lod 1 shells | 5434 | 1084 | 47% | 0.0% | 0/12 63% | 100% | 1.00 | 207 | rock |
| marine/landing float | 1 | item | 1268 | lod 0 keep (pile+body+deck) | 150 | 752 | 0.0% | 0.7% | 0/0 0.0% | 100% | 0.89 | 0 | pile body deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.5% | 0/0 0.0% | 100% | 0.29 | 75 | box |
|  |  |  |  | FIX R1: its lod 1 | 479 | 1268 | 0.7% | 0.0% | 270/12 2.3% | 100% | 1.00 | 27 | deck pile beam steel body glass |
|  |  |  |  | FIX R2: its lod 1 shells | 2556 | 1268 | 0.7% | 0.0% | 270/12 2.3% | 100% | 1.00 | 27 | deck pile beam steel body glass |
| marine/net pens | 3 | item | 11636 | lod 0 keep (steel+deck+body) | 150 | 11332 | 0.0% | 0.0% | 0/0 0.0% | 52% | 0.25 | 0 | steel deck body |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 99% | 0.70 | 165 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 11556 | 0.0% | 0.0% | 0/0 0.0% | 52% | 0.26 | 0 | deck steel body buoy |
|  |  |  |  | FIX R2: its lod 1 shells | 5450 | 11556 | 0.0% | 0.0% | 0/0 0.0% | 52% | 0.26 | 0 | deck steel body buoy |
| marine/net pens, large | 2 | item | 22506 | lod 0 keep (steel+deck+body) | 150 | 22132 | 0.0% | 0.0% | 0/0 0.0% | 41% | 0.18 | 0 | steel deck body |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.73 | 245 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 22356 | 0.0% | 0.0% | 0/0 0.0% | 41% | 0.19 | 0 | deck steel body buoy |
|  |  |  |  | FIX R2: its lod 1 shells | 7355 | 22356 | 0.0% | 0.0% | 0/0 0.0% | 41% | 0.19 | 0 | deck steel body buoy |
| marine/seaplane float | 1 | item | 2768 | lod 0 keep (pile+deck+body) | 150 | 2348 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.98 | 0 | pile deck body |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.7% | 0/0 0.0% | 100% | 0.15 | 111 | box |
|  |  |  |  | FIX R1: its lod 1 | 543 | 2768 | 0.5% | 0.0% | 67.5/35 0.8% | 100% | 1.00 | 27 | deck pile beam steel body glass |
|  |  |  |  | FIX R2: its lod 1 shells | 2898 | 2768 | 0.5% | 0.0% | 67.5/35 0.8% | 100% | 1.00 | 27 | deck pile beam steel body glass |
| marine/trestle pier | 7 | item | 4100 | lod 0 keep (beam+pile+deck) | 150 | 2204 | 0.0% | 0.1% | 0/0 0.0% | 96% | 0.95 | 0 | beam pile deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.3% | 0/0 0.0% | 100% | 0.37 | 156 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 4100 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | FIX R2: its lod 1 shells | 5129 | 4100 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
| marine/trestle pier, long | 2 | item | 6264 | lod 0 keep (beam+pile+deck) | 150 | 3144 | 0.0% | 0.0% | 0/0 0.0% | 96% | 0.93 | 0 | beam pile deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.35 | 280 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 6264 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | FIX R2: its lod 1 shells | 9344 | 6264 | 0.0% | 0.0% | 0/0 0.0% | 96% | 1.00 | 0 | deck pile beam steel glass |
| marine/wharf deck | 3 | item | 5692 | lod 0 keep (beam+pile+deck) | 150 | 4484 | 0.0% | 0.1% | 0/0 0.0% | 100% | 1.00 | 0 | beam pile deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 9.7% | 0/0 0.0% | 100% | 0.72 | 141 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 5692 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | FIX R2: its lod 1 shells | 3826 | 5692 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 0 | deck pile beam steel glass |
| marine/wharf deck, small | 2 | item | 2960 | lod 0 keep (beam+pile+deck) | 150 | 2208 | 0.0% | 0.2% | 0/0 0.0% | 99% | 1.00 | 0 | beam pile deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 9.2% | 0/0 0.0% | 100% | 0.61 | 76 | box |
|  |  |  |  | FIX R1: its lod 1 | 410 | 2960 | 0.0% | 0.0% | 0/0 0.0% | 99% | 1.00 | 0 | deck pile beam steel glass |
|  |  |  |  | FIX R2: its lod 1 shells | 2184 | 2960 | 0.0% | 0.0% | 0/0 0.0% | 99% | 1.00 | 0 | deck pile beam steel glass |
| navaid/DVOR-DME | 1 | item | 4392 | lod 0 keep (steel+metal) | 150 | 2172 | 0.0% | 0.1% | 0/12 0.2% | 99% | 0.98 | 1495 | steel metal |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.2% | 0/0 0.0% | 99% | 0.61 | 184 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 2224 | 0.0% | 0.0% | 45/60 0.0% | 99% | 0.99 | 98 | steel siding trim roof stone metal glass |
|  |  |  |  | FIX R2: its lod 1 shells | 4976 | 1276 | 0.0% | 0.1% | 90/12 0.2% | 99% | 0.99 | 88 | steel siding roof stone metal glass |
| navaid/DVOR-DME compact | 0 | item | 4316 | lod 0 keep (stone+steel+metal) | 150 | 2766 | 0.1% | 1.8% | 90/12 0.2% | 98% | 0.98 | 1050 | stone steel metal |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.51 | 134 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 2176 | 0.0% | 0.1% | 225/12 0.1% | 100% | 0.98 | 97 | steel siding trim roof stone metal glass |
|  |  |  |  | FIX R2: its lod 1 shells | 3428 | 1264 | 0.1% | 0.8% | 90/12 0.3% | 100% | 0.98 | 87 | steel siding roof stone metal glass |
| shed/lean-to | 0 | item | 4370 | lod 0 keep (trim+siding+deck) | 150 | 4212 | 0.0% | 4.0% | 0/0 0.0% | 52% | 0.90 | 0 | trim siding deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.4% | 0/0 0.0% | 100% | 0.80 | 12 | box |
|  |  |  |  | FIX R1: its lod 1 | 69 | 176 | 2.8% | 2.7% | 315/12 18% | 96% | 0.98 | 27 | siding trim roof deck post |
|  |  |  |  | FIX R2: its lod 1 shells | 370 | 92 | 4.8% | 5.2% | 45/12 27% | 96% | 0.98 | 27 | siding roof deck |
| shed/net store | 1 | item | 2054 | lod 0 keep (deck+trim+siding) | 150 | 1776 | 0.0% | 19% | 0/0 0.0% | 25% | 0.96 | 0 | deck trim siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.6% | 0/0 0.0% | 100% | 0.89 | 19 | box |
|  |  |  |  | FIX R1: its lod 1 | 108 | 298 | 0.0% | 0.0% | 0/0 0.0% | 99% | 0.99 | 58 | siding trim roof deck post stone |
|  |  |  |  | FIX R2: its lod 1 shells | 578 | 154 | 0.0% | 0.0% | 0/0 0.0% | 99% | 0.99 | 58 | siding roof deck stone |
| shed/tool shed | 5 | item | 5090 | lod 0 keep (roof+siding+trim) | 150 | 4920 | 0.0% | 0.1% | 0/0 0.0% | 100% | 0.95 | 0 | roof siding trim |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.88 | 10 | box |
|  |  |  |  | FIX R1: its lod 1 | 63 | 188 | 1.2% | 1.2% | 270/12 7.5% | 100% | 0.97 | 34 | siding trim roof deck |
|  |  |  |  | FIX R2: its lod 1 shells | 334 | 116 | 1.6% | 1.7% | 270/12 7.6% | 100% | 0.97 | 34 | siding roof deck |
| shed/trapper cabin | 0 | item | 11030 | lod 0 keep (trim+roof+siding) | 150 | 10572 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.95 | 0 | trim roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.9% | 0/0 0.0% | 100% | 0.87 | 16 | box |
|  |  |  |  | FIX R1: its lod 1 | 98 | 348 | 1.7% | 1.9% | 270/12 12% | 99% | 0.98 | 46 | siding trim roof deck post stone metal |
|  |  |  |  | FIX R2: its lod 1 shells | 523 | 204 | 1.9% | 2.0% | 270/12 12% | 99% | 0.98 | 46 | siding roof deck stone metal |
| shed/wood shed | 1 | item | 4860 | lod 0 keep (trim+siding+deck) | 150 | 4776 | 0.0% | 9.3% | 0/0 0.0% | 38% | 0.92 | 0 | trim siding deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.6% | 0/0 0.0% | 100% | 0.85 | 14 | box |
|  |  |  |  | FIX R1: its lod 1 | 79 | 176 | 3.4% | 3.3% | 315/12 21% | 100% | 0.99 | 32 | siding trim roof deck post |
|  |  |  |  | FIX R2: its lod 1 shells | 423 | 92 | 4.9% | 5.9% | 45/12 30% | 100% | 0.99 | 32 | siding roof deck |
| sport/ball park, lit | 1 | item | 2607 | lod 0 keep (seat+dirt+turf) | 150 | 418 | 0.0% | 1.1% | 0/0 0.0% | 94% | 0.95 | 599 | seat dirt turf |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.36 | 302 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 1639 | 0.0% | 0.9% | 0/0 0.0% | 100% | 0.96 | 854 | turf dirt line metal post seat |
|  |  |  |  | FIX R2: its lod 1 shells | 7695 | 1639 | 0.0% | 0.9% | 0/0 0.0% | 100% | 0.96 | 854 | turf dirt line metal post seat |
| sport/baseball diamond | 0 | item | 913 | lod 0 keep (dirt+turf) | 150 | 176 | 0.0% | 0.2% | 0/0 0.0% | 0.0% | 0.96 | 476 | dirt turf |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 0.0% | 0.52 | 273 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 733 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.98 | 727 | turf dirt line metal post seat |
|  |  |  |  | FIX R2: its lod 1 shells | 7229 | 733 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.98 | 727 | turf dirt line metal post seat |
| sport/gravel pitch | 0 | item | 296 | lod 0 keep (dirt) | 150 | 2 | 0.0% | 0.1% | 0/0 0.0% | 100% | 1.00 | 180 | dirt |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.1% | 0/0 0.0% | 100% | 1.00 | 0 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 200 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 1073 | dirt line metal |
|  |  |  |  | FIX R2: its lod 1 shells | 4589 | 200 | 0.0% | 0.0% | 0/0 0.0% | 100% | 1.00 | 1073 | dirt line metal |
| sport/hard court | 1 | item | 1086 | lod 0 keep (metal+court) | 150 | 878 | 0.0% | 7.6% | 0/0 0.0% | 100% | 0.75 | 94 | metal court |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.86 | 106 | box |
|  |  |  |  | FIX R1: its lod 1 | 515 | 548 | 0.2% | 7.7% | 90/12 1.4% | 100% | 0.75 | 490 | court line metal seat |
|  |  |  |  | FIX R2: its lod 1 shells | 2749 | 548 | 0.2% | 7.7% | 90/12 1.4% | 100% | 0.75 | 490 | court line metal seat |
| sport/running track | 0 | item | 5268 | lod 0 keep (seat+track+turf) | 150 | 628 | 0.0% | 0.1% | 0/0 0.0% | 82% | 0.99 | 997 | seat track turf |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.65 | 443 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 3724 | 0.0% | 0.2% | 0/0 0.0% | 82% | 1.00 | 7206 | turf track line metal post seat |
|  |  |  |  | FIX R2: its lod 1 shells | 11832 | 3724 | 0.0% | 0.2% | 0/0 0.0% | 82% | 1.00 | 7206 | turf track line metal post seat |
| sport/soccer field | 0 | item | 1164 | lod 0 keep (seat+turf) | 150 | 146 | 0.0% | 0.2% | 0/0 0.0% | 51% | 0.99 | 228 | seat turf |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.91 | 236 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 668 | 0.0% | 0.2% | 0/0 0.0% | 51% | 1.00 | 1386 | turf line metal post seat |
|  |  |  |  | FIX R2: its lod 1 shells | 5979 | 668 | 0.0% | 0.2% | 0/0 0.0% | 51% | 1.00 | 1386 | turf line metal post seat |
| sport/soccer, turf, lit | 0 | item | 2866 | lod 0 keep (seat+turf) | 150 | 374 | 0.0% | 0.9% | 0/0 0.0% | 47% | 0.91 | 228 | seat turf |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.67 | 255 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 1420 | 0.0% | 0.8% | 0/0 0.0% | 53% | 0.92 | 1386 | turf line metal post seat |
|  |  |  |  | FIX R2: its lod 1 shells | 6549 | 1420 | 0.0% | 0.8% | 0/0 0.0% | 53% | 0.92 | 1386 | turf line metal post seat |
| tower/WWII tower | 1 | item | 2108 | lod 0 keep (roof+deck+steel) | 150 | 1548 | 3.1% | 4.7% | 0/12 6.0% | 99% | 0.90 | 83 | roof deck steel |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.38 | 24 | box |
|  |  |  |  | FIX R1: its lod 1 | 235 | 1268 | 7.4% | 3.5% | 270/12 14% | 99% | 0.92 | 31 | steel siding roof deck stone metal |
|  |  |  |  | FIX R2: its lod 1 shells | 1252 | 1268 | 7.4% | 3.5% | 270/12 14% | 99% | 0.92 | 31 | steel siding roof deck stone metal |
| tower/block tower | 0 | item | 3738 | lod 0 keep (roof+deck+stone) | 150 | 962 | 3.2% | 10% | 90/12 9.1% | 100% | 0.88 | 288 | roof deck stone |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 24% | 0/0 0.0% | 100% | 0.63 | 23 | box |
|  |  |  |  | FIX R1: its lod 1 | 203 | 1686 | 3.2% | 2.3% | 90/12 7.1% | 100% | 0.98 | 226 | steel siding roof deck stone metal pane glass |
|  |  |  |  | FIX R2: its lod 1 shells | 1080 | 1686 | 3.2% | 2.3% | 90/12 7.1% | 100% | 0.98 | 226 | steel siding roof deck stone metal pane glass |
| tower/club tower | 0 | item | 3214 | lod 0 keep (deck+trim+steel) | 150 | 2134 | 1.4% | 8.1% | 135/12 3.6% | 96% | 0.89 | 38 | deck trim steel |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.48 | 24 | box |
|  |  |  |  | FIX R1: its lod 1 | 211 | 2362 | 2.6% | 1.5% | 90/12 4.3% | 98% | 0.97 | 157 | steel siding trim roof deck stone metal pane glass |
|  |  |  |  | FIX R2: its lod 1 shells | 1124 | 2334 | 1.8% | 1.5% | 90/12 3.8% | 98% | 0.97 | 157 | steel siding roof deck stone metal pane glass |
| tower/field cab | 0 | item | 2248 | lod 0 keep (post+deck+trim) | 150 | 1444 | 1.5% | 5.9% | 0/12 4.1% | 100% | 0.88 | 111 | post deck trim |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 13% | 0/0 0.0% | 100% | 0.39 | 30 | box |
|  |  |  |  | FIX R1: its lod 1 | 190 | 1392 | 3.1% | 1.8% | 180/12 6.4% | 100% | 0.98 | 123 | steel post siding trim roof deck stone metal pane glass sock |
|  |  |  |  | FIX R2: its lod 1 shells | 1015 | 1316 | 2.2% | 1.8% | 135/12 4.3% | 100% | 0.98 | 121 | steel post siding roof deck stone metal pane glass |
| tower/hut tower | 0 | item | 3130 | lod 0 keep (deck+siding+trim) | 150 | 2094 | 2.9% | 6.9% | 90/12 10% | 96% | 0.92 | 334 | deck siding trim |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 16% | 0/0 0.0% | 100% | 0.62 | 31 | box |
|  |  |  |  | FIX R1: its lod 1 | 193 | 1214 | 3.3% | 1.6% | 0/12 10% | 100% | 0.98 | 254 | steel post siding trim roof deck metal pane glass sock |
|  |  |  |  | FIX R2: its lod 1 shells | 1028 | 1138 | 2.7% | 1.8% | 0/12 10% | 98% | 0.97 | 252 | steel post siding roof deck metal pane glass |
| tower/lookout cab | 0 | item | 2762 | lod 0 keep (trim+deck+post) | 150 | 1712 | 1.5% | 6.5% | 180/12 3.2% | 97% | 0.89 | 34 | trim deck post |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 23% | 0/0 0.0% | 100% | 0.52 | 22 | box |
|  |  |  |  | FIX R1: its lod 1 | 196 | 2174 | 2.6% | 1.3% | 180/12 4.5% | 97% | 0.98 | 123 | steel post siding trim roof deck stone metal pane glass |
|  |  |  |  | FIX R2: its lod 1 shells | 1043 | 2154 | 1.9% | 1.3% | 90/12 3.7% | 97% | 0.97 | 123 | steel post siding roof deck stone metal pane glass |
| tower/regional tower | 0 | item | 4624 | lod 0 keep (deck+steel+stone) | 150 | 1742 | 1.4% | 20% | 90/12 4.2% | 100% | 0.83 | 179 | deck steel stone |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.62 | 31 | box |
|  |  |  |  | FIX R1: its lod 1 | 287 | 2874 | 2.1% | 1.4% | 90/12 4.9% | 100% | 0.98 | 330 | steel siding roof deck stone metal pane glass |
|  |  |  |  | FIX R2: its lod 1 shells | 1530 | 2874 | 2.1% | 1.4% | 90/12 4.9% | 100% | 0.98 | 330 | steel siding roof deck stone metal pane glass |
| utility/hydro powerhouse | 0 | item | 1384 | lod 0 keep (metal+siding+stone) | 150 | 240 | 9.1% | 19% | 112.5/35 18% | 67% | 0.99 | 450 | metal siding stone |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.6% | 0/0 0.0% | 100% | 0.70 | 108 | box |
|  |  |  |  | FIX R1: its lod 1 | 565 | 1000 | 0.3% | 0.1% | 225/12 1.3% | 100% | 1.00 | 564 | steel siding trim roof stone metal pane glass |
|  |  |  |  | FIX R2: its lod 1 shells | 3012 | 960 | 0.3% | 0.1% | 225/12 1.3% | 100% | 1.00 | 541 | steel siding roof stone metal pane glass |
| meteo/meteo station | 1 | item | 36298 | lod 0 keep (pane+dark+roof) | 150 | 12150 | 15% | 14% | 112.5/35 19% | 83% | 0.88 | 1701 | pane dark roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.9% | 0/0 0.0% | 100% | 0.54 | 153 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 6120 | 0.1% | 0.3% | 135/12 0.9% | 99% | 0.99 | 3452 | roof copper dark shaft stone steel rail flue paint conc deck pane glass |
|  |  |  |  | FIX R2: its lod 1 shells | 4594 | 4548 | 0.1% | 0.6% | 135/12 1.0% | 99% | 0.99 | 3446 | roof copper dark shaft stone conc deck pane glass |
| meteo/meteo station 1974 | 0 | item | 36924 | lod 0 keep (pane+dark+roof) | 150 | 12140 | 15% | 14% | 67.5/35 19% | 83% | 0.89 | 1708 | pane dark roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.8% | 0/0 0.0% | 100% | 0.53 | 153 | box |
|  |  |  |  | FIX R1: its lod 1 | 600 | 6160 | 0.1% | 0.4% | 90/12 1.2% | 100% | 0.99 | 3450 | roof copper dark shaft stone steel rail flue paint conc deck pane glass |
|  |  |  |  | FIX R2: its lod 1 shells | 4632 | 4588 | 0.1% | 0.6% | 90/12 1.2% | 100% | 0.99 | 3444 | roof copper dark shaft stone conc deck pane glass |
| house/shore cabin [as a plot] | 0 | plot | 12896 | lod 1 (far town) | 258 | 1004 | 1.4% | 0.8% | 0/12 3.1% | 98% | 0.97 | 213 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1375 | 84 | 1.7% | 1.0% | 0/12 3.7% | 84% | 0.82 | 171 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1375 | 412 | 1.5% | 0.9% | 0/12 3.3% | 98% | 0.93 | 172 | siding roof deck metal floor log |
| house/village house [as a plot] | 0 | plot | 13890 | lod 1 (far town) | 220 | 1120 | 1.4% | 0.5% | 45/12 2.3% | 97% | 0.98 | 312 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1171 | 124 | 1.5% | 0.6% | 45/12 2.5% | 93% | 0.91 | 216 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1171 | 452 | 1.5% | 0.6% | 45/12 2.4% | 97% | 0.95 | 217 | siding roof deck metal floor log |
| house/modern dark [as a plot] | 0 | plot | 11906 | lod 1 (far town) | 242 | 988 | 1.3% | 1.3% | 45/12 2.3% | 98% | 0.97 | 264 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1292 | 72 | 1.5% | 1.4% | 0/12 2.8% | 84% | 0.85 | 188 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1292 | 358 | 1.4% | 1.4% | 45/12 2.5% | 98% | 0.94 | 188 | siding roof deck metal floor log |
| house/cannery shed [as a plot] | 0 | plot | 29292 | lod 1 (far town) | 468 | 2202 | 0.7% | 0.3% | 135/12 1.7% | 100% | 0.99 | 634 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 2496 | 174 | 1.0% | 1.3% | 135/12 1.8% | 92% | 0.94 | 438 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 2496 | 550 | 0.9% | 0.7% | 135/12 1.8% | 98% | 0.96 | 438 | siding roof deck metal floor log |
| house/village church [as a plot] | 0 | plot | 8774 | lod 1 (far town) | 218 | 695 | 1.6% | 0.4% | 180/12 2.4% | 97% | 0.98 | 228 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1163 | 124 | 1.8% | 0.4% | 45/12 2.9% | 97% | 0.94 | 174 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1163 | 219 | 1.8% | 0.5% | 45/12 2.8% | 97% | 0.96 | 174 | siding roof deck metal floor log |
| house/church [as a plot] | 0 | plot | 7500 | lod 1 (far town) | 312 | 879 | 1.3% | 0.2% | 180/12 2.6% | 99% | 0.98 | 311 | siding trim roof deck post metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1665 | 112 | 1.5% | 0.4% | 0/12 2.8% | 99% | 0.93 | 233 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1665 | 231 | 1.4% | 0.4% | 180/12 2.7% | 99% | 0.95 | 234 | siding roof deck metal floor |
| house/town hall [as a plot] | 0 | plot | 17384 | lod 1 (far town) | 358 | 1609 | 1.0% | 1.0% | 270/12 2.4% | 97% | 0.99 | 458 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | lod 1 shells (past the detail band) | 1908 | 180 | 1.5% | 2.6% | 270/12 3.1% | 94% | 0.93 | 274 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1908 | 611 | 1.4% | 1.7% | 270/12 2.9% | 97% | 0.97 | 276 | siding roof deck stone metal floor |
| house/lighthouse [as a plot] | 0 | plot | 13322 | lod 1 (far town) | 373 | 1434 | 1.5% | 0.3% | 180/12 3.4% | 98% | 0.99 | 469 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | lod 1 shells (past the detail band) | 1991 | 160 | 6.0% | 5.8% | 180/60 9.0% | 79% | 0.92 | 329 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1991 | 978 | 3.6% | 3.3% | 180/60 5.6% | 88% | 0.97 | 386 | siding roof glass deck stone metal floor |
| house/lighthouse octagon [as a plot] | 0 | plot | 11810 | lod 1 (far town) | 301 | 1114 | 1.3% | 0.2% | 0/12 2.6% | 100% | 1.00 | 390 | siding trim roof glass deck post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1608 | 88 | 3.5% | 4.7% | 67.5/35 4.7% | 96% | 0.95 | 230 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1608 | 682 | 2.1% | 2.3% | 270/12 2.9% | 100% | 0.99 | 281 | siding roof glass deck stone metal floor |
| house/school [as a plot] | 0 | plot | 20664 | lod 1 (far town) | 600 | 1520 | 0.8% | 0.4% | 45/12 2.3% | 97% | 0.99 | 759 | siding trim roof deck post stone metal floor pane flag siding2 trim2 roof2 |
|  |  |  |  | lod 1 shells (past the detail band) | 3440 | 176 | 0.8% | 0.8% | 45/12 2.4% | 97% | 0.97 | 630 | siding roof stone floor siding2 roof2 |
|  |  |  |  | FIX R2: its lod 1 shells | 3440 | 804 | 0.8% | 0.7% | 45/12 2.4% | 97% | 0.99 | 632 | siding roof deck stone metal floor siding2 roof2 |
| house/clinic [as a plot] | 0 | plot | 13176 | lod 1 (far town) | 388 | 1372 | 1.4% | 0.6% | 180/12 4.7% | 100% | 0.99 | 522 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 2070 | 208 | 1.5% | 1.8% | 180/12 4.7% | 95% | 0.95 | 444 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 2070 | 856 | 1.5% | 0.9% | 180/12 4.7% | 100% | 0.99 | 447 | siding roof deck stone metal floor |
| house/police [as a plot] | 0 | plot | 10766 | lod 1 (far town) | 323 | 1348 | 1.5% | 0.3% | 0/12 3.6% | 100% | 0.99 | 427 | siding trim roof deck post stone metal floor pane flag |
|  |  |  |  | lod 1 shells (past the detail band) | 1724 | 208 | 1.7% | 1.5% | 0/12 4.1% | 97% | 0.94 | 372 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1724 | 896 | 1.6% | 0.9% | 0/12 4.0% | 99% | 0.98 | 374 | siding roof deck stone metal floor |
| house/post office [as a plot] | 0 | plot | 9382 | lod 1 (far town) | 253 | 1066 | 1.7% | 0.9% | 0/12 4.6% | 96% | 0.97 | 209 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | lod 1 shells (past the detail band) | 1351 | 84 | 1.9% | 1.4% | 0/12 5.0% | 93% | 0.88 | 157 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1351 | 456 | 1.8% | 1.5% | 0/12 4.7% | 96% | 0.93 | 158 | siding roof deck metal floor |
| house/general store [as a plot] | 0 | plot | 6684 | lod 1 (far town) | 272 | 764 | 1.1% | 0.5% | 180/12 2.7% | 99% | 0.98 | 317 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | lod 1 shells (past the detail band) | 1450 | 70 | 1.2% | 1.2% | 180/12 2.8% | 94% | 0.86 | 261 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1450 | 158 | 1.1% | 2.0% | 180/12 2.8% | 94% | 0.96 | 261 | siding roof deck metal floor |
| house/cafe [as a plot] | 0 | plot | 9528 | lod 1 (far town) | 231 | 1022 | 1.3% | 0.6% | 180/12 2.9% | 100% | 0.97 | 214 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | lod 1 shells (past the detail band) | 1233 | 72 | 1.6% | 1.2% | 180/12 3.0% | 94% | 0.84 | 162 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1233 | 404 | 1.4% | 1.9% | 180/12 3.0% | 97% | 0.95 | 163 | siding roof deck metal floor |
| house/motel [as a plot] | 0 | plot | 13636 | lod 1 (far town) | 384 | 1368 | 1.5% | 0.8% | 180/12 5.0% | 100% | 0.99 | 358 | siding trim roof deck post metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 2046 | 84 | 1.6% | 0.8% | 0/12 5.3% | 97% | 0.92 | 284 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 2046 | 392 | 1.5% | 1.0% | 180/12 5.3% | 100% | 0.96 | 284 | siding roof deck metal floor |
| house/air taxi office [as a plot] | 0 | plot | 5118 | lod 1 (far town) | 216 | 652 | 1.8% | 0.3% | 0/12 3.5% | 98% | 0.99 | 178 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1151 | 92 | 1.9% | 1.1% | 0/12 3.6% | 90% | 0.91 | 142 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1151 | 388 | 1.8% | 0.6% | 0/12 3.6% | 98% | 0.97 | 144 | siding roof deck stone metal floor |
| house/marine supply [as a plot] | 0 | plot | 7634 | lod 1 (far town) | 273 | 952 | 1.1% | 0.5% | 180/12 2.9% | 100% | 0.97 | 262 | siding trim roof deck post metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1455 | 94 | 1.3% | 0.8% | 180/12 3.1% | 82% | 0.84 | 221 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1455 | 278 | 1.1% | 1.0% | 180/12 3.0% | 99% | 0.94 | 221 | siding roof deck metal floor |
| house/fuel and bait [as a plot] | 0 | plot | 4750 | lod 1 (far town) | 187 | 724 | 1.7% | 0.6% | 225/12 3.0% | 100% | 0.96 | 148 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | lod 1 shells (past the detail band) | 998 | 72 | 2.2% | 0.9% | 45/12 3.5% | 81% | 0.77 | 119 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 998 | 232 | 1.9% | 1.9% | 135/12 3.4% | 97% | 0.89 | 119 | siding roof deck metal floor |
| house/bear tours [as a plot] | 0 | plot | 10452 | lod 1 (far town) | 216 | 996 | 1.7% | 0.9% | 0/12 3.2% | 100% | 0.96 | 157 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1150 | 384 | 1.9% | 0.8% | 0/12 3.7% | 98% | 0.83 | 138 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1150 | 544 | 1.7% | 1.1% | 0/12 3.3% | 99% | 0.92 | 138 | siding roof deck metal floor log |
| house/vet clinic [as a plot] | 0 | plot | 7612 | lod 1 (far town) | 248 | 884 | 1.1% | 0.5% | 0/12 3.2% | 100% | 0.99 | 224 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1321 | 92 | 1.2% | 1.5% | 0/12 3.8% | 94% | 0.93 | 179 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1321 | 508 | 1.2% | 0.7% | 0/12 3.7% | 100% | 0.99 | 180 | siding roof deck stone metal floor |
| house/clubhouse [as a plot] | 0 | plot | 5038 | lod 1 (far town) | 216 | 504 | 1.9% | 1.1% | 0/12 6.3% | 100% | 0.99 | 218 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1151 | 72 | 2.0% | 1.4% | 0/12 6.4% | 98% | 0.94 | 189 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1151 | 226 | 1.9% | 1.2% | 0/12 6.4% | 100% | 0.98 | 190 | siding roof deck stone metal floor |
| house/concession stand [as a plot] | 0 | plot | 2526 | lod 1 (far town) | 124 | 324 | 2.2% | 0.4% | 0/12 4.1% | 97% | 0.98 | 125 | siding trim roof deck post stone floor pane awning |
|  |  |  |  | lod 1 shells (past the detail band) | 662 | 84 | 2.3% | 1.5% | 0/12 4.2% | 90% | 0.94 | 97 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 662 | 108 | 2.2% | 1.6% | 0/12 4.2% | 90% | 0.96 | 97 | siding roof deck stone floor |
| house/outhouse [as a plot] | 0 | plot | 1142 | lod 1 (far town) | 65 | 290 | 3.5% | 0.7% | 225/12 4.9% | 90% | 0.96 | 48 | siding trim roof deck post floor |
|  |  |  |  | lod 1 shells (past the detail band) | 349 | 72 | 4.4% | 0.6% | 135/12 5.5% | 90% | 0.77 | 43 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 349 | 96 | 3.7% | 0.8% | 225/12 5.2% | 90% | 0.91 | 43 | siding roof deck floor |
| house/garage [as a plot] | 0 | plot | 2464 | lod 1 (far town) | 155 | 368 | 2.2% | 0.3% | 180/12 4.5% | 100% | 1.00 | 134 | siding trim roof post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 827 | 96 | 2.2% | 0.5% | 180/12 4.5% | 95% | 0.98 | 120 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 827 | 244 | 2.2% | 0.3% | 180/12 4.5% | 100% | 0.99 | 120 | siding roof stone metal floor |
| house/storage shed [as a plot] | 0 | plot | 4830 | lod 1 (far town) | 100 | 318 | 2.9% | 0.7% | 225/12 4.5% | 99% | 0.96 | 72 | siding trim roof deck post metal floor log |
|  |  |  |  | lod 1 shells (past the detail band) | 534 | 84 | 3.2% | 0.7% | 45/12 4.8% | 99% | 0.86 | 67 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 534 | 124 | 3.0% | 0.7% | 225/12 4.7% | 99% | 0.93 | 67 | siding roof deck metal floor log |
| house/woodshed [as a plot] | 0 | plot | 8310 | lod 1 (far town) | 93 | 318 | 2.8% | 1.4% | 45/12 4.8% | 96% | 0.95 | 60 | siding trim roof deck post floor log |
|  |  |  |  | lod 1 shells (past the detail band) | 494 | 54 | 3.6% | 4.0% | 22.5/35 8.0% | 96% | 0.91 | 60 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 494 | 90 | 3.6% | 2.8% | 22.5/35 8.0% | 96% | 0.91 | 60 | siding roof deck floor log |
| house/over the water [as a plot] | 0 | plot | 15444 | lod 1 (far town) | 453 | 1604 | 1.2% | 0.9% | 180/60 3.7% | 99% | 0.95 | 255 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | lod 1 shells (past the detail band) | 2416 | 84 | 1.7% | 0.4% | 0/12 5.0% | 75% | 0.68 | 144 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 2416 | 424 | 1.5% | 0.5% | 0/12 4.5% | 97% | 0.77 | 145 | siding roof deck metal floor log |
| house/fish shack [as a plot] | 0 | plot | 7670 | lod 1 (far town) | 387 | 1014 | 1.4% | 1.1% | 45/12 2.7% | 96% | 0.93 | 127 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | lod 1 shells (past the detail band) | 2065 | 60 | 2.1% | 0.7% | 45/12 4.5% | 75% | 0.61 | 101 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 2065 | 232 | 1.9% | 0.8% | 45/12 4.2% | 91% | 0.68 | 101 | siding roof deck metal floor log |
| house/net loft [as a plot] | 0 | plot | 12844 | lod 1 (far town) | 464 | 1562 | 1.0% | 0.5% | 135/12 2.2% | 99% | 0.96 | 258 | siding trim roof deck post metal floor pane pile log |
|  |  |  |  | lod 1 shells (past the detail band) | 2474 | 84 | 1.3% | 0.3% | 45/12 3.0% | 75% | 0.71 | 189 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 2474 | 424 | 1.1% | 0.3% | 135/12 2.8% | 95% | 0.82 | 190 | siding roof deck metal floor log |
| house/saltbox farmhouse [as a plot] | 0 | plot | 15448 | lod 1 (far town) | 252 | 1286 | 1.4% | 0.6% | 45/12 2.3% | 100% | 0.98 | 358 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1345 | 212 | 1.6% | 0.6% | 45/12 2.6% | 95% | 0.90 | 268 | siding roof stone floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1345 | 572 | 1.6% | 0.9% | 45/12 2.6% | 100% | 0.97 | 269 | siding roof deck stone metal floor log |
| house/gambrel barn [as a plot] | 0 | plot | 13326 | lod 1 (far town) | 293 | 1038 | 1.1% | 0.2% | 180/12 2.0% | 100% | 0.99 | 452 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1563 | 180 | 1.3% | 0.5% | 180/12 2.0% | 96% | 0.97 | 394 | siding roof stone floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1563 | 412 | 1.3% | 0.4% | 180/12 2.0% | 100% | 0.99 | 394 | siding roof deck stone metal floor log |
| house/saltbox cottage [as a plot] | 0 | plot | 10664 | lod 1 (far town) | 213 | 1034 | 1.9% | 0.8% | 0/12 3.7% | 99% | 0.97 | 225 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1135 | 172 | 2.2% | 0.8% | 0/12 4.2% | 95% | 0.87 | 202 | siding roof stone floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1135 | 508 | 2.0% | 0.9% | 0/12 3.9% | 99% | 0.95 | 203 | siding roof deck stone metal floor log |
| house/hip cottage [as a plot] | 0 | plot | 11872 | lod 1 (far town) | 234 | 988 | 1.6% | 1.9% | 225/12 3.0% | 99% | 0.98 | 200 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1247 | 104 | 1.7% | 2.9% | 225/12 3.1% | 94% | 0.92 | 158 | siding roof stone floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1247 | 540 | 1.6% | 2.1% | 225/12 3.0% | 99% | 0.98 | 159 | siding roof deck stone metal floor log |
| house/chapel [as a plot] | 0 | plot | 7940 | lod 1 (far town) | 212 | 601 | 1.5% | 0.4% | 0/60 2.2% | 99% | 0.99 | 199 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1129 | 126 | 1.6% | 0.7% | 0/12 2.5% | 99% | 0.96 | 152 | siding roof stone floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1129 | 245 | 1.6% | 0.5% | 0/12 2.5% | 99% | 0.98 | 153 | siding roof deck stone metal floor log |
| house/pilot hut [as a plot] | 0 | plot | 9134 | lod 1 (far town) | 157 | 876 | 1.9% | 1.1% | 45/12 3.6% | 99% | 0.96 | 128 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 838 | 336 | 2.2% | 1.0% | 45/12 4.1% | 97% | 0.85 | 111 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 838 | 496 | 2.0% | 1.2% | 45/12 3.7% | 99% | 0.93 | 111 | siding roof deck metal floor log |
| house/flying club [as a plot] | 0 | plot | 13882 | lod 1 (far town) | 315 | 1262 | 1.3% | 1.1% | 180/12 3.5% | 100% | 0.98 | 275 | siding trim roof deck post metal floor pane flag |
|  |  |  |  | lod 1 shells (past the detail band) | 1679 | 84 | 1.5% | 1.4% | 45/12 3.8% | 98% | 0.89 | 211 | siding roof floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1679 | 456 | 1.4% | 1.7% | 180/12 3.7% | 100% | 0.95 | 211 | siding roof deck metal floor |
| house/control tower [as a plot] | 0 | plot | 13648 | lod 1 (far town) | 371 | 1226 | 1.4% | 0.3% | 180/12 2.9% | 97% | 0.99 | 430 | siding trim roof glass deck post stone metal floor pane flag |
|  |  |  |  | lod 1 shells (past the detail band) | 1980 | 100 | 11% | 10% | 270/60 22% | 55% | 0.87 | 217 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1980 | 766 | 2.7% | 2.7% | 180/60 5.1% | 82% | 0.97 | 332 | siding roof glass deck stone metal floor |
| house/flight service [as a plot] | 0 | plot | 7556 | lod 1 (far town) | 258 | 884 | 1.4% | 0.8% | 180/12 3.3% | 98% | 0.99 | 242 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1375 | 92 | 1.5% | 1.8% | 180/12 3.4% | 93% | 0.93 | 189 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1375 | 508 | 1.4% | 1.1% | 180/12 3.4% | 98% | 0.99 | 190 | siding roof deck stone metal floor |
| house/bunkhouse [as a plot] | 0 | plot | 14694 | lod 1 (far town) | 302 | 1550 | 1.4% | 0.7% | 180/12 3.8% | 100% | 0.98 | 344 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1611 | 102 | 1.6% | 0.9% | 180/12 4.1% | 85% | 0.84 | 271 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1611 | 436 | 1.4% | 0.7% | 180/12 4.0% | 99% | 0.93 | 271 | siding roof deck metal floor log |
| house/mine bunkhouse [as a plot] | 0 | plot | 19634 | lod 1 (far town) | 313 | 1602 | 1.6% | 0.5% | 0/12 4.1% | 100% | 0.99 | 506 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1669 | 294 | 1.6% | 0.5% | 0/12 4.3% | 99% | 0.95 | 366 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1669 | 478 | 1.6% | 0.5% | 0/12 4.2% | 100% | 0.97 | 366 | siding roof deck metal floor log |
| house/mine dormer hall [as a plot] | 0 | plot | 23148 | lod 1 (far town) | 425 | 1852 | 1.1% | 0.3% | 90/12 2.0% | 100% | 0.99 | 567 | siding trim roof deck post stone floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 2269 | 468 | 1.3% | 0.5% | 45/12 2.1% | 100% | 0.97 | 404 | siding roof stone floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 2269 | 636 | 1.2% | 0.4% | 45/12 2.1% | 100% | 0.98 | 404 | siding roof deck stone floor log |
| house/mine mess hall [as a plot] | 0 | plot | 14516 | lod 1 (far town) | 313 | 1176 | 1.2% | 0.8% | 180/12 2.8% | 97% | 0.97 | 319 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1672 | 96 | 1.4% | 0.8% | 0/12 2.8% | 97% | 0.89 | 237 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1672 | 280 | 1.3% | 0.9% | 180/12 2.8% | 97% | 0.96 | 237 | siding roof deck metal floor log |
| house/mine office [as a plot] | 0 | plot | 12992 | lod 1 (far town) | 270 | 1356 | 1.4% | 1.5% | 0/12 3.5% | 99% | 0.98 | 291 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1440 | 140 | 1.7% | 2.6% | 0/12 3.6% | 94% | 0.93 | 194 | siding roof stone floor |
|  |  |  |  | FIX R2: its lod 1 shells | 1440 | 560 | 1.6% | 1.8% | 0/12 3.5% | 99% | 0.97 | 195 | siding roof deck stone metal floor |
| house/mine cottage [as a plot] | 0 | plot | 9816 | lod 1 (far town) | 200 | 976 | 1.9% | 1.1% | 45/12 3.8% | 98% | 0.97 | 203 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1065 | 200 | 2.1% | 1.0% | 45/12 4.1% | 98% | 0.91 | 169 | siding roof floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 1065 | 384 | 2.0% | 1.2% | 45/12 3.9% | 98% | 0.96 | 169 | siding roof deck metal floor log |
| house/log cabin [as a plot] | 0 | plot | 9580 | lod 1 (far town) | 181 | 848 | 1.9% | 2.0% | 225/12 3.5% | 98% | 0.96 | 142 | siding trim roof deck post stone floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 966 | 300 | 2.0% | 1.9% | 45/12 3.9% | 98% | 0.89 | 125 | siding roof stone floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 966 | 444 | 1.9% | 2.0% | 135/12 3.6% | 98% | 0.94 | 125 | siding roof deck stone floor log |
| house/storage shed [as an outbuilding] | 0 | out | 318 | lod 1 keep (floor+roof+siding) | 150 | 72 | 3.3% | 0.1% | 45/12 4.8% | 95% | 0.85 | 67 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 95% | 0.82 | 13 | box |
|  |  |  |  | FIX R1: its lod 1 | 97 | 318 | 2.8% | 0.0% | 225/12 4.5% | 100% | 1.00 | 72 | siding trim roof deck post metal floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 519 | 124 | 2.9% | 0.1% | 225/12 4.6% | 100% | 0.96 | 67 | siding roof deck metal floor log |
| house/outhouse [as an outbuilding] | 0 | out | 290 | lod 1 keep (trim+roof+siding) | 150 | 122 | 4.3% | 0.0% | 45/12 5.4% | 100% | 0.80 | 48 | trim roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.75 | 7 | box |
|  |  |  |  | FIX R1: its lod 1 | 64 | 290 | 3.4% | 0.0% | 225/12 4.9% | 100% | 1.00 | 48 | siding trim roof deck post floor |
|  |  |  |  | FIX R2: its lod 1 shells | 340 | 96 | 3.6% | 0.1% | 225/12 5.2% | 100% | 0.94 | 43 | siding roof deck floor |
| house/garage [as an outbuilding] | 0 | out | 368 | lod 1 keep (stone+roof+siding) | 150 | 84 | 2.3% | 0.2% | 180/12 4.5% | 96% | 0.99 | 120 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.9% | 0/0 0.0% | 98% | 0.77 | 30 | box |
|  |  |  |  | FIX R1: its lod 1 | 154 | 368 | 2.3% | 0.0% | 180/12 4.5% | 100% | 1.00 | 134 | siding trim roof post stone metal floor pane |
|  |  |  |  | FIX R2: its lod 1 shells | 823 | 244 | 2.3% | 0.0% | 180/12 4.5% | 100% | 1.00 | 120 | siding roof stone metal floor |
| house/woodshed [as an outbuilding] | 0 | out | 318 | lod 1 keep (deck+roof+siding) | 150 | 66 | 4.2% | 1.8% | 45/12 11% | 97% | 0.87 | 60 | deck roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.2% | 0/0 0.0% | 97% | 0.84 | 16 | box |
|  |  |  |  | FIX R1: its lod 1 | 91 | 318 | 2.9% | 0.0% | 0/12 6.2% | 100% | 1.00 | 60 | siding trim roof deck post floor log |
|  |  |  |  | FIX R2: its lod 1 shells | 483 | 90 | 3.8% | 1.8% | 45/12 10% | 100% | 0.96 | 60 | siding roof deck floor log |
| kit #0 sampler #z1:r31:3 | 28 | kit | 10590 | kit lod 1 | 150 | 1134 | 1.1% | 0.9% | 0/12 2.6% | 100% | 0.98 | 314 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.0% | 0/0 0.0% | 95% | 0.83 | 119 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.4% | 1.2% | 180/12 2.0% | 95% | 0.88 | 114 | shell |
| kit #1 sampler #mk_z_res_w:mk_ax03:4 | 26 | kit | 4844 | kit lod 1 | 150 | 692 | 1.2% | 0.6% | 0/12 2.5% | 99% | 0.96 | 131 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.9% | 0/0 0.0% | 97% | 0.73 | 70 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 1.3% | 45/12 1.1% | 97% | 0.75 | 67 | shell |
| kit #2 sampler #mk_z_town:r3:2 | 25 | kit | 6738 | kit lod 1 | 150 | 828 | 1.6% | 0.8% | 45/12 3.1% | 100% | 0.97 | 167 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.0% | 0/0 0.0% | 95% | 0.77 | 73 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.7% | 1.3% | 180/12 2.0% | 95% | 0.83 | 67 | shell |
| kit #3 mine cottage | 24 | kit | 7080 | kit lod 1 | 150 | 964 | 1.8% | 1.0% | 45/12 3.6% | 99% | 0.97 | 203 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.4% | 0/0 0.0% | 100% | 0.80 | 104 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 3.3% | 90/12 1.3% | 89% | 0.87 | 97 | shell |
| kit #4 shore cabin | 23 | kit | 9484 | kit lod 1 | 150 | 972 | 1.4% | 0.7% | 180/12 3.2% | 97% | 0.97 | 213 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 3.2% | 0/0 0.0% | 94% | 0.81 | 120 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 2.0% | 90/12 0.7% | 94% | 0.86 | 115 | shell |
| kit #5 log cabin | 23 | kit | 6516 | kit lod 1 | 150 | 836 | 1.9% | 2.3% | 135/12 3.6% | 97% | 0.96 | 142 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 97% | 0.77 | 98 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 5.1% | 45/12 1.3% | 83% | 0.82 | 82 | shell |
| kit #6 over the water | 17 | kit | 11012 | kit lod 1 | 150 | 1228 | 1.4% | 0.7% | 135/12 2.2% | 94% | 0.97 | 249 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 4.8% | 0/0 0.0% | 90% | 0.83 | 84 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.4% | 90/12 0.6% | 90% | 0.85 | 80 | shell |
| kit #7 saltbox cottage | 17 | kit | 7756 | kit lod 1 | 150 | 1002 | 1.8% | 0.8% | 0/12 3.8% | 100% | 0.97 | 225 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 98% | 0.76 | 102 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 2.2% | 90/12 0.9% | 94% | 0.85 | 96 | shell |
| kit #8 sampler #mk_z_res_e:mk_sc37:10 | 17 | kit | 10152 | kit lod 1 | 150 | 1020 | 1.1% | 0.6% | 0/12 2.2% | 97% | 0.97 | 212 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.1% | 0/0 0.0% | 95% | 0.83 | 103 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.1% | 45/12 0.5% | 95% | 0.87 | 100 | shell |
| kit #9 sampler #mk_z_town:mk_sc45:0 | 17 | kit | 6024 | kit lod 1 | 150 | 876 | 1.6% | 1.2% | 45/12 3.6% | 97% | 0.97 | 171 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.8% | 0/0 0.0% | 94% | 0.78 | 99 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 3.5% | 135/12 0.5% | 75% | 0.78 | 84 | shell |
| kit #10 mine bunkhouse | 17 | kit | 15998 | kit lod 1 | 150 | 1566 | 1.4% | 0.5% | 315/12 2.8% | 100% | 0.99 | 472 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 6.1% | 0/0 0.0% | 100% | 0.80 | 151 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 8.9% | 90/12 0.8% | 84% | 0.87 | 131 | shell |
| kit #11 sampler #mk_z_town:mk_ax04:1 | 16 | kit | 15106 | kit lod 1 | 150 | 1338 | 1.2% | 0.6% | 180/60 2.2% | 100% | 0.98 | 331 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.2% | 0/0 0.0% | 93% | 0.80 | 116 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.1% | 90/12 0.9% | 93% | 0.85 | 118 | shell |
| kit #12 bunkhouse | 15 | kit | 10090 | kit lod 1 | 150 | 1342 | 1.4% | 0.8% | 0/12 4.3% | 100% | 0.99 | 323 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.4% | 0/0 0.0% | 100% | 0.77 | 138 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.4% | 4.1% | 135/12 1.6% | 89% | 0.83 | 120 | shell |
| kit #13 modern dark | 13 | kit | 8494 | kit lod 1 | 150 | 956 | 1.3% | 1.2% | 315/12 2.4% | 98% | 0.98 | 264 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 3.6% | 0/0 0.0% | 97% | 0.81 | 99 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.6% | 1.8% | 180/12 1.6% | 94% | 0.88 | 87 | shell |
| kit #14 sampler #mk_z_res_w:mk_ax02:10 | 13 | kit | 13270 | kit lod 1 | 150 | 1580 | 0.9% | 1.1% | 180/12 2.4% | 97% | 0.98 | 335 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 4.0% | 0/0 0.0% | 91% | 0.80 | 125 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 2.7% | 0/0 0.0% | 91% | 0.85 | 115 | shell |
| kit #15 sampler #mk_z_res_s:mk_sa03:2 | 13 | kit | 12298 | kit lod 1 | 150 | 1402 | 1.4% | 0.6% | 180/12 2.4% | 100% | 0.99 | 323 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 4.6% | 0/0 0.0% | 95% | 0.89 | 133 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.8% | 90/12 0.6% | 95% | 0.93 | 131 | shell |
| kit #16 sampler #mk_z_res_sub:mk_r_raven:1 | 13 | kit | 7258 | kit lod 1 | 150 | 780 | 2.2% | 0.8% | 225/12 3.2% | 99% | 0.97 | 228 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.8% | 0/0 0.0% | 97% | 0.76 | 67 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.7% | 2.5% | 45/12 2.2% | 97% | 0.80 | 72 | shell |
| kit #17 saltbox farmhouse | 12 | kit | 12024 | kit lod 1 | 150 | 1206 | 1.5% | 0.6% | 0/12 2.8% | 99% | 0.98 | 358 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.9% | 0/0 0.0% | 97% | 0.79 | 121 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.5% | 135/12 0.6% | 94% | 0.89 | 116 | shell |
| kit #18 sampler #mk_z_town:mk_ax05:5 | 11 | kit | 6764 | kit lod 1 | 150 | 938 | 1.4% | 1.0% | 180/12 3.3% | 100% | 0.97 | 152 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 92% | 0.72 | 93 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 3.1% | 0/0 0.0% | 92% | 0.80 | 82 | shell |
| kit #19 hip cottage | 10 | kit | 9564 | kit lod 1 | 150 | 1124 | 1.5% | 1.9% | 0/12 5.6% | 100% | 0.98 | 200 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.9% | 0/0 0.0% | 96% | 0.77 | 129 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 5.3% | 0/0 0.0% | 81% | 0.82 | 106 | shell |
| kit #20 sampler #mk_z_res_w:mk_ax03:9 | 10 | kit | 7742 | kit lod 1 | 150 | 796 | 1.4% | 0.6% | 0/12 2.3% | 97% | 0.98 | 302 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.4% | 0/0 0.0% | 93% | 0.84 | 122 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 1.5% | 90/12 0.4% | 93% | 0.89 | 114 | shell |
| kit #21 sampler #mk_z_res_c:mk_ax03:6 | 9 | kit | 8410 | kit lod 1 | 150 | 1222 | 1.3% | 0.8% | 0/12 2.6% | 97% | 0.97 | 289 | siding trim roof deck post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.9% | 0/0 0.0% | 92% | 0.77 | 110 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.4% | 2.9% | 90/12 2.5% | 92% | 0.82 | 111 | shell |
| kit #22 sampler #mk_z_town:mk_ax02:3 | 9 | kit | 5746 | kit lod 1 | 150 | 840 | 1.8% | 1.9% | 315/12 3.9% | 94% | 0.96 | 194 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.0% | 0/0 0.0% | 96% | 0.80 | 99 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 1.0% | 2.7% | 225/12 2.5% | 92% | 0.85 | 90 | shell |
| kit #23 sampler #mk_z_res_s:mk_sc48:1 | 8 | kit | 8612 | kit lod 1 | 150 | 1160 | 1.2% | 0.8% | 180/12 2.4% | 99% | 0.98 | 326 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.4% | 0/0 0.0% | 97% | 0.79 | 111 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 2.9% | 135/12 0.7% | 83% | 0.86 | 101 | shell |
| kit #24 motel | 7 | kit | 11514 | kit lod 1 | 150 | 1236 | 1.3% | 0.7% | 315/12 3.5% | 100% | 0.98 | 301 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.3% | 0/0 0.0% | 98% | 0.75 | 186 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 4.8% | 135/12 0.2% | 81% | 0.84 | 155 | shell |
| kit #25 sampler #mk_z_town:mk_ax05:0 | 7 | kit | 7482 | kit lod 1 | 150 | 924 | 1.6% | 1.2% | 135/12 3.1% | 100% | 0.98 | 184 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 2.1% | 0/0 0.0% | 96% | 0.79 | 115 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 4.6% | 90/12 1.6% | 81% | 0.82 | 99 | shell |
| kit #26 marine supply | 11 | kit | 7466 | kit lod 1 | 150 | 952 | 1.2% | 0.4% | 0/12 2.9% | 100% | 0.98 | 262 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 3.6% | 0/0 0.0% | 100% | 0.84 | 126 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.0% | 1.7% | 90/12 0.2% | 100% | 0.85 | 122 | shell |
| kit #27 sampler #mk_z_harbour:mk_r_shore:2 | 6 | kit | 6968 | kit lod 1 | 150 | 848 | 1.6% | 0.9% | 45/12 2.9% | 97% | 0.97 | 180 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 95% | 0.79 | 86 | siding roof |
|  |  |  |  | city far shell | 1000 | 10 | 0.7% | 1.4% | 0/12 4.1% | 95% | 0.86 | 80 | shell |
| kit #28 mine bunkhouse | 5 | kit | 15890 | kit lod 1 | 150 | 1598 | 1.5% | 0.4% | 45/12 2.9% | 100% | 0.99 | 413 | siding trim roof deck post metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 5.5% | 0/0 0.0% | 100% | 0.84 | 142 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 1.9% | 90/12 0.7% | 99% | 0.92 | 135 | shell |
| kit #29 log cabin | 4 | kit | 7528 | kit lod 1 | 150 | 1016 | 1.8% | 2.2% | 135/12 3.5% | 100% | 0.97 | 157 | siding trim roof deck post stone floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 100% | 0.77 | 98 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 5.1% | 135/12 1.3% | 87% | 0.80 | 82 | shell |
| kit #30 storage shed | 50 | kit | 1318 | kit lod 1 | 150 | 290 | 3.0% | 0.6% | 180/12 5.3% | 100% | 0.98 | 72 | siding trim roof deck post floor |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.8% | 0/0 0.0% | 100% | 0.84 | 39 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.2% | 0.2% | 90/12 1.0% | 100% | 0.88 | 38 | shell |
| kit #31 outhouse | 14 | kit | 1142 | kit lod 1 | 150 | 290 | 3.4% | 0.7% | 225/12 4.7% | 95% | 0.97 | 48 | siding trim roof deck post floor |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 95% | 0.75 | 20 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.4% | 0.3% | 135/12 1.5% | 95% | 0.74 | 19 | shell |
| kit #32 garage | 5 | kit | 2464 | kit lod 1 | 150 | 368 | 2.3% | 0.3% | 0/12 5.6% | 100% | 1.00 | 134 | siding trim roof post stone metal floor pane |
|  |  |  |  | kit box | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 97% | 0.80 | 87 | siding roof |
|  |  |  |  | city far shell | 1000 | 14 | 0.1% | 0.2% | 90/12 0.6% | 93% | 0.89 | 75 | shell |
