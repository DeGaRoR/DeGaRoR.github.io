# LODS audit - every far rung of Jolene (tools/lods_audit.js)

leak = share of the covered view whose nearest surface is a back face (the eye looks INTO the building: black); hole = share of the near view where the rung shows something > max(1.5 m, R/10) behind the near outside (see-through, a missing roof or storey); roof = share of the near roofed plan still roofed from above; iou = silhouette against the near mesh (25 views); open = welded edges used once (m).

| building | n | path | near tris | rung | at m | tris | leak | hole | worst view | roof | iou | open m | bags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hangar/club hangar, long | 1 | item | 3382 | lod 0 keep (wall+stem+roof) | 150 | 488 | 0.6% | 7.2% | 45/12 3.8% | 97% | 0.99 | 1746 | wall stem roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.2% | 0/0 0.0% | 97% | 0.95 | 115 | box |
| house/flying club | 1 | item | 13882 | lod 0 keep (floor+siding+roof) | 150 | 2608 | 1.5% | 2.5% | 45/12 3.8% | 98% | 0.89 | 889 | floor siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.3% | 0/0 0.0% | 98% | 0.85 | 54 | box |
| big/fuel shed | 3 | item | 1202 | lod 0 keep (plinth+roof+wall) | 150 | 210 | 1.1% | 4.1% | 0/60 2.5% | 99% | 0.96 | 351 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.4% | 0/0 0.0% | 100% | 0.75 | 30 | box |
| shed/tool shed | 5 | item | 5090 | lod 0 keep (roof+siding+trim) | 150 | 4920 | 0.0% | 0.1% | 0/0 0.0% | 100% | 0.95 | 0 | roof siding trim |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.2% | 0/0 0.0% | 100% | 0.88 | 10 | box |
| hangar/field shed | 1 | item | 1494 | lod 0 keep (stem+wall+roof) | 150 | 306 | 0.4% | 2.6% | 45/12 0.8% | 97% | 0.99 | 818 | stem wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.8% | 0/0 0.0% | 97% | 0.91 | 67 | box |
| house/pilot hut | 2 | item | 9134 | lod 0 keep (floor+roof+siding) | 150 | 1488 | 2.3% | 2.2% | 315/12 4.1% | 97% | 0.84 | 350 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.7% | 0/0 0.0% | 98% | 0.82 | 26 | box |
| shed/wood shed | 1 | item | 4860 | lod 0 keep (trim+siding+deck) | 150 | 4776 | 0.0% | 9.3% | 0/0 0.0% | 38% | 0.92 | 0 | trim siding deck |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.6% | 0/0 0.0% | 100% | 0.85 | 14 | box |
| hangar/field shed, small | 1 | item | 1010 | lod 0 keep (stem+wall+roof) | 150 | 250 | 0.6% | 2.3% | 90/12 2.5% | 97% | 0.99 | 610 | stem wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.3% | 0/0 0.0% | 97% | 0.90 | 53 | box |
| house/town hall | 1 | item | 17384 | lod 0 keep (roof+floor+siding) | 150 | 5102 | 1.5% | 6.8% | 90/12 3.1% | 94% | 0.93 | 1774 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.3% | 0/0 0.0% | 95% | 0.71 | 56 | box |
| house/church | 2 | item | 7500 | lod 0 keep (floor+roof+siding) | 150 | 2624 | 1.5% | 2.7% | 0/12 2.8% | 99% | 0.93 | 824 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.4% | 0/0 0.0% | 99% | 0.69 | 43 | box |
| house/village church | 1 | item | 8774 | lod 0 keep (floor+roof+siding) | 150 | 1792 | 1.8% | 2.9% | 45/12 2.9% | 96% | 0.93 | 609 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 96% | 0.73 | 32 | box |
| house/chapel | 2 | item | 7940 | lod 0 keep (stone+roof+siding) | 150 | 1520 | 1.6% | 3.2% | 0/12 2.5% | 99% | 0.95 | 545 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.4% | 0/0 0.0% | 99% | 0.71 | 27 | box |
| house/school | 4 | item | 20664 | lod 0 keep (siding2+floor+stone) | 150 | 4588 | 0.0% | 54% | 0/0 0.0% | 2.4% | 0.83 | 525 | siding2 floor stone |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.0% | 0/0 0.0% | 94% | 0.74 | 116 | box |
| house/general store | 4 | item | 6684 | lod 0 keep (floor+roof+siding) | 150 | 2740 | 1.2% | 3.3% | 180/12 2.8% | 94% | 0.86 | 743 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.9% | 0/0 0.0% | 94% | 0.81 | 44 | box |
| house/cafe | 4 | item | 9528 | lod 0 keep (floor+roof+siding) | 150 | 1772 | 1.6% | 3.9% | 180/12 3.1% | 94% | 0.84 | 557 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.4% | 0/0 0.0% | 94% | 0.82 | 37 | box |
| house/motel | 2 | item | 13636 | lod 0 keep (siding+floor+roof) | 150 | 3804 | 1.6% | 1.9% | 180/12 5.5% | 97% | 0.92 | 1186 | siding floor roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.0% | 0/0 0.0% | 98% | 0.90 | 71 | box |
| house/saltbox cottage | 2 | item | 10664 | lod 0 keep (floor+roof+siding) | 150 | 1502 | 1.6% | 2.3% | 180/12 2.7% | 95% | 0.86 | 600 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.2% | 0/0 0.0% | 97% | 0.80 | 34 | box |
| house/post office | 1 | item | 9382 | lod 0 keep (floor+roof+siding) | 150 | 1768 | 1.9% | 3.6% | 0/12 5.0% | 93% | 0.88 | 626 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.3% | 0/0 0.0% | 95% | 0.80 | 39 | box |
| house/police | 1 | item | 10766 | lod 0 keep (stone+roof+siding) | 150 | 4200 | 1.6% | 3.9% | 0/12 4.1% | 97% | 0.94 | 902 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.1% | 0/0 0.0% | 98% | 0.77 | 56 | box |
| house/clinic | 5 | item | 13176 | lod 0 keep (stone+siding+roof) | 150 | 5590 | 1.5% | 4.0% | 180/12 4.7% | 95% | 0.95 | 1222 | stone siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.3% | 0/0 0.0% | 98% | 0.77 | 75 | box |
| big/fire hall | 1 | item | 2048 | lod 0 keep (plinth+roof+wall) | 150 | 376 | 0.4% | 6.0% | 0/12 2.5% | 100% | 0.99 | 1033 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.8% | 0/0 0.0% | 100% | 0.94 | 57 | box |
| big/technical services | 2 | item | 2334 | lod 0 keep (plinth+roof+wall) | 150 | 366 | 0.4% | 7.1% | 180/12 2.4% | 100% | 0.99 | 1064 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.2% | 0/0 0.0% | 100% | 0.94 | 55 | box |
| big/terminal | 2 | item | 3072 | lod 0 keep (plinth+wall+roof) | 150 | 540 | 0.1% | 7.3% | 45/12 0.4% | 100% | 0.98 | 1563 | plinth wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.7% | 0/0 0.0% | 100% | 0.89 | 91 | box |
| house/log cabin | 7 | item | 9580 | lod 0 keep (post+siding+roof) | 150 | 3068 | 1.9% | 2.8% | 135/12 3.6% | 98% | 0.94 | 446 | post siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.8% | 0/0 0.0% | 98% | 0.71 | 35 | box |
| house/air taxi office | 2 | item | 5118 | lod 0 keep (stone+roof+siding) | 150 | 1900 | 1.9% | 3.9% | 0/12 3.6% | 90% | 0.92 | 479 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.5% | 0/0 0.0% | 91% | 0.76 | 36 | box |
| big/workshop | 3 | item | 1954 | lod 0 keep (plinth+roof+wall) | 150 | 326 | 0.6% | 5.5% | 0/12 2.9% | 100% | 0.98 | 839 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.8% | 0/0 0.0% | 100% | 0.92 | 45 | box |
| house/marine supply | 2 | item | 7634 | lod 0 keep (floor+roof+siding) | 150 | 2410 | 1.3% | 3.2% | 180/12 3.1% | 82% | 0.83 | 687 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.6% | 0/0 0.0% | 82% | 0.83 | 42 | box |
| house/fuel and bait | 1 | item | 4750 | lod 0 keep (post+roof+siding) | 150 | 2430 | 1.9% | 3.1% | 225/12 3.0% | 85% | 0.88 | 351 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.9% | 0/0 0.0% | 100% | 0.63 | 35 | box |
| big/boat shed | 3 | item | 1752 | lod 0 keep (plinth+roof+wall) | 150 | 360 | 0.4% | 3.3% | 225/12 0.9% | 100% | 0.98 | 933 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.0% | 0/0 0.0% | 100% | 0.94 | 55 | box |
| big/store | 2 | item | 1732 | lod 0 keep (plinth+roof+wall) | 150 | 276 | 0.0% | 8.9% | 0/0 0.0% | 90% | 0.94 | 680 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.7% | 0/0 0.0% | 97% | 0.88 | 41 | box |
| shed/net store | 1 | item | 2054 | lod 0 keep (deck+trim+siding) | 150 | 1776 | 0.0% | 19% | 0/0 0.0% | 25% | 0.96 | 0 | deck trim siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.6% | 0/0 0.0% | 100% | 0.89 | 19 | box |
| big/cannery | 3 | item | 2796 | lod 0 keep (plinth+wall+roof) | 150 | 524 | 0.5% | 4.2% | 180/12 3.9% | 100% | 0.99 | 1156 | plinth wall roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 8.4% | 0/0 0.0% | 100% | 0.87 | 97 | box |
| big/warehouse | 3 | item | 2200 | lod 0 keep (plinth+roof+wall) | 150 | 348 | 0.6% | 4.6% | 180/12 3.7% | 100% | 0.98 | 850 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 8.6% | 0/0 0.0% | 100% | 0.83 | 68 | box |
| house/kennecott mill | 1 | item | 113532 | lod 0 keep (roof+floor+siding) | 150 | 43040 | 1.3% | 1.7% | 45/12 2.7% | 95% | 0.88 | 13371 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.1% | 0/0 0.0% | 100% | 0.18 | 363 | box |
| big/mine shop | 1 | item | 2212 | lod 0 keep (plinth+roof+wall) | 150 | 380 | 0.4% | 6.6% | 225/12 0.9% | 100% | 0.98 | 923 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.6% | 0/0 0.0% | 100% | 0.92 | 49 | box |
| house/mine cottage | 7 | item | 9816 | lod 0 keep (floor+roof+siding) | 150 | 1696 | 1.4% | 2.7% | 90/12 2.9% | 98% | 0.91 | 718 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.8% | 0/0 0.0% | 98% | 0.81 | 35 | box |
| house/storage shed | 2 | item | 4830 | lod 0 keep (post+roof+siding) | 150 | 1018 | 3.0% | 1.8% | 225/12 4.5% | 94% | 0.93 | 147 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.4% | 0/0 0.0% | 100% | 0.65 | 17 | box |
| house/mine office | 1 | item | 12992 | lod 0 keep (roof+floor+siding) | 150 | 3936 | 1.8% | 5.4% | 0/12 3.6% | 94% | 0.94 | 1311 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.6% | 0/0 0.0% | 95% | 0.78 | 46 | box |
| house/bunkhouse | 2 | item | 14694 | lod 0 keep (post+roof+siding) | 150 | 6724 | 1.4% | 2.3% | 180/12 3.8% | 87% | 0.93 | 902 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.9% | 0/0 0.0% | 100% | 0.58 | 60 | box |
| house/mine bunkhouse | 1 | item | 19272 | lod 0 keep (roof+floor+siding) | 150 | 4822 | 0.9% | 3.1% | 270/12 2.1% | 99% | 0.95 | 1781 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.5% | 0/0 0.0% | 99% | 0.81 | 57 | box |
| house/mine dormer hall | 1 | item | 22630 | lod 0 keep (roof+siding+floor) | 150 | 6628 | 0.9% | 3.0% | 90/12 2.3% | 100% | 0.97 | 2798 | roof siding floor |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 6.3% | 0/0 0.0% | 100% | 0.86 | 76 | box |
| house/mine mess hall | 1 | item | 14028 | lod 0 keep (floor+siding+roof) | 150 | 3342 | 1.1% | 3.0% | 45/12 2.2% | 96% | 0.88 | 1092 | floor siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.4% | 0/0 0.0% | 98% | 0.82 | 54 | box |
| house/hip cottage | 1 | item | 11872 | lod 0 keep (stone+siding+roof) | 150 | 2384 | 1.7% | 3.7% | 225/12 3.1% | 94% | 0.95 | 624 | stone siding roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.1% | 0/0 0.0% | 95% | 0.78 | 43 | box |
| house/fish shack | 2 | item | 7670 | lod 0 keep (roof+post+siding) | 150 | 2404 | 1.7% | 1.9% | 315/12 3.1% | 79% | 0.77 | 254 | roof post siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.4% | 0/0 0.0% | 97% | 0.45 | 27 | box |
| house/tram top station | 1 | item | 47640 | lod 0 keep (siding+floor+steel) | 150 | 14996 | 0.0% | 26% | 0/0 0.0% | 92% | 0.76 | 1736 | siding floor steel |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 3.0% | 0/0 0.0% | 99% | 0.35 | 175 | box |
| house/garage | 1 | item | 2464 | lod 0 keep (stone+roof+siding) | 150 | 962 | 2.3% | 2.9% | 180/12 4.5% | 95% | 0.98 | 296 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.0% | 0/0 0.0% | 96% | 0.77 | 30 | box |
| house/outhouse | 1 | item | 1142 | lod 0 keep (post+trim+siding) | 150 | 862 | 0.1% | 3.5% | 90/12 0.2% | 51% | 0.89 | 63 | post trim siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.4% | 0/0 0.0% | 100% | 0.63 | 10 | box |
| house/tram base station | 1 | item | 32230 | lod 0 keep (roof+floor+siding) | 150 | 10992 | 0.8% | 12% | 0/12 2.5% | 77% | 0.94 | 1779 | roof floor siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 10% | 0/0 0.0% | 98% | 0.85 | 101 | box |
| house/bear tours | 1 | item | 10452 | lod 0 keep (post+roof+siding) | 150 | 3612 | 1.8% | 2.0% | 0/12 3.4% | 97% | 0.89 | 447 | post roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 2.6% | 0/0 0.0% | 100% | 0.61 | 41 | box |
| navaid/DVOR-DME | 1 | item | 4392 | lod 0 keep (steel+metal) | 150 | 2172 | 0.0% | 0.1% | 0/12 0.2% | 99% | 0.98 | 1495 | steel metal |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.2% | 0/0 0.0% | 99% | 0.61 | 184 | box |
| tower/WWII tower | 1 | item | 2108 | lod 0 keep (roof+deck+steel) | 150 | 1548 | 3.1% | 4.7% | 0/12 6.0% | 99% | 0.90 | 83 | roof deck steel |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.3% | 0/0 0.0% | 100% | 0.38 | 24 | box |
| big/cafe | 1 | item | 1660 | lod 0 keep (plinth+roof+wall) | 150 | 252 | 0.0% | 9.4% | 0/0 0.0% | 90% | 0.94 | 569 | plinth roof wall |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 5.6% | 0/0 0.0% | 97% | 0.88 | 35 | box |
| meteo/meteo station | 1 | item | 36298 | lod 0 keep (pane+dark+roof) | 150 | 12150 | 15% | 14% | 112.5/35 19% | 83% | 0.88 | 1701 | pane dark roof |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 4.9% | 0/0 0.0% | 100% | 0.54 | 153 | box |
| house/shore cabin [as a plot] | 0 | plot | 12896 | lod 1 (far town) | 258 | 1004 | 1.4% | 0.8% | 0/12 3.1% | 98% | 0.97 | 213 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1375 | 84 | 1.7% | 1.0% | 0/12 3.7% | 84% | 0.82 | 171 | siding roof floor log |
| house/village house [as a plot] | 0 | plot | 13890 | lod 1 (far town) | 220 | 1120 | 1.4% | 0.5% | 45/12 2.3% | 97% | 0.98 | 312 | siding trim roof deck post metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1171 | 124 | 1.5% | 0.6% | 45/12 2.5% | 93% | 0.91 | 216 | siding roof floor log |
| house/saltbox farmhouse [as a plot] | 0 | plot | 15448 | lod 1 (far town) | 252 | 1286 | 1.4% | 0.6% | 45/12 2.3% | 100% | 0.98 | 358 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1345 | 212 | 1.6% | 0.6% | 45/12 2.6% | 95% | 0.90 | 268 | siding roof stone floor log |
| house/gambrel barn [as a plot] | 0 | plot | 13326 | lod 1 (far town) | 293 | 1038 | 1.1% | 0.2% | 180/12 2.0% | 100% | 0.99 | 452 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1563 | 180 | 1.3% | 0.5% | 180/12 2.0% | 96% | 0.97 | 394 | siding roof stone floor log |
| house/hip cottage [as a plot] | 0 | plot | 11872 | lod 1 (far town) | 234 | 988 | 1.6% | 1.9% | 225/12 3.0% | 99% | 0.98 | 200 | siding trim roof deck post stone metal floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 1247 | 104 | 1.7% | 2.9% | 225/12 3.1% | 94% | 0.92 | 158 | siding roof stone floor log |
| house/log cabin [as a plot] | 0 | plot | 9580 | lod 1 (far town) | 181 | 848 | 1.9% | 2.0% | 225/12 3.5% | 98% | 0.96 | 142 | siding trim roof deck post stone floor pane log |
|  |  |  |  | lod 1 shells (past the detail band) | 966 | 300 | 2.0% | 1.9% | 45/12 3.9% | 98% | 0.89 | 125 | siding roof stone floor log |
| house/church [as a plot] | 0 | plot | 7500 | lod 1 (far town) | 312 | 879 | 1.3% | 0.2% | 180/12 2.6% | 99% | 0.98 | 311 | siding trim roof deck post metal floor pane |
|  |  |  |  | lod 1 shells (past the detail band) | 1665 | 112 | 1.5% | 0.4% | 0/12 2.8% | 99% | 0.93 | 233 | siding roof floor |
| house/general store [as a plot] | 0 | plot | 6684 | lod 1 (far town) | 272 | 764 | 1.1% | 0.5% | 180/12 2.7% | 99% | 0.98 | 317 | siding trim roof deck post metal floor pane awning |
|  |  |  |  | lod 1 shells (past the detail band) | 1450 | 70 | 1.2% | 1.2% | 180/12 2.8% | 94% | 0.86 | 261 | siding roof floor |
| house/storage shed [as an outbuilding] | 0 | out | 318 | lod 1 keep (floor+roof+siding) | 150 | 72 | 3.3% | 0.1% | 45/12 4.8% | 95% | 0.85 | 67 | floor roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.5% | 0/0 0.0% | 95% | 0.82 | 13 | box |
| house/outhouse [as an outbuilding] | 0 | out | 290 | lod 1 keep (trim+roof+siding) | 150 | 122 | 4.3% | 0.0% | 45/12 5.4% | 100% | 0.80 | 48 | trim roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.0% | 0/0 0.0% | 100% | 0.75 | 7 | box |
| house/garage [as an outbuilding] | 0 | out | 368 | lod 1 keep (stone+roof+siding) | 150 | 84 | 2.3% | 0.2% | 180/12 4.5% | 96% | 0.99 | 120 | stone roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 1.9% | 0/0 0.0% | 98% | 0.77 | 30 | box |
| house/woodshed [as an outbuilding] | 0 | out | 318 | lod 1 keep (deck+roof+siding) | 150 | 66 | 4.2% | 1.8% | 45/12 11% | 97% | 0.87 | 60 | deck roof siding |
|  |  |  |  | box (past far2) | 1200 | 10 | 0.0% | 0.2% | 0/0 0.0% | 97% | 0.84 | 16 | box |
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
