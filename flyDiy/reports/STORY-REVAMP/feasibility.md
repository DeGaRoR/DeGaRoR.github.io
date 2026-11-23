# The story pack, flown on node

tools/story_feas.js --table. Each mission flown the way the game flies it (tools/mission_feas.js: the stand, the taxi, the take-off, the landing, the taxi in, the load, the career's stop).
A row is kept until its mission changes. Structure only: the verdict, the aeroplane, the time flown, where each flight ended.

Summary (91 missions): 8 an aircraft order (not a flight); 30 feasible; 5 infeasible; 2 no official plane can fly it (the player builds one); 36 not flown; 10 stale. Time flown: 790 min 34 s.

| mission | step of | verdict | aeroplane | flown | flights (from > to, s) | why not |
|---|---|---|---|---|---|---|
| field.01 | contract | feasible | Piper Cub | 16 min 06 s | HOME > w3 533; w3 > HOME 432 |  |
| field.02 | contract | feasible | Piper Cub | 16 min 15 s | HOME > w3 546; w3 > HOME 430 |  |
| field.n1 | contract | feasible | Piper Cub | 17 min 08 s | HOME > w3 537; w3 > HOME 490 |  |
| field.round | contract | not flown | - | - | - |  |
| field.hike | contract | feasible | Piper Cub | 17 min 43 s | HOME > w8 1063 |  |
| field.ridge | contract | stale | - | - | - |  |
| field.cannery | contract | not flown | - | - | - |  |
| hangar.01 | hangar:1 | feasible | Piper Cub | 16 min 43 s | HOME > w3 560; w3 > HOME 443 |  |
| hangar.02 | hangar:1 | feasible | Piper Cub | 19 min 52 s | HOME > w5 555; w5 > HOME 637 |  |
| hangar.03 | hangar:2 | feasible | Piper Cub | 18 min 13 s | HOME > w3 573; w3 > HOME 520 |  |
| hangar.04 | hangar:2 | feasible | STOL Cub | 20 min 53 s | HOME > w5 554; w5 > HOME 699 |  |
| hangar.05 | hangar:3 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 18 min 55 s | HOME > w3 472; w3 > HOME 664 |  |
| heritage.01 | heritage:1 | feasible | STOL Cub | 15 min 31 s | HOME > nv_strip 931 |  |
| heritage.02 | heritage:2 | infeasible | - | - | - | no official plane can do it (73_ contractCanDo): cub: Cub: 300 kg aboard, the cabin takes 90 kg; jodel: Jodel: 300 kg aboard, the cabin takes 90 kg; c172: Cessna 172: 300 kg aboard, the cabin takes 280 kg; c172f: Cessna  |
| minedock.n1 | contract | not flown | - | - | - |  |
| minedock.b1 | contract | order | - | - | - |  |
| minedock.b2 | contract | order | - | - | - |  |
| minedock.01 | mine:1 | not flown | - | - | - |  |
| minedock.02 | mine:2 | not flown | - | - | - |  |
| mine.03 | mine:3 | stale | - | - | - |  |
| mine.04 | mine:4 | stale | - | - | - |  |
| mine.tour | contract | not flown | - | - | - |  |
| minedock.05 | harbour:1 | not flown | - | - | - |  |
| minedock.06 | harbour:2 | not flown | - | - | - |  |
| lumber.01 | lumber:1 | stale | - | - | - |  |
| lumber.02 | lumber:2 | not flown | - | - | - |  |
| lumber.03 | lumber:2 | not flown | - | - | - |  |
| lumber.04 | lumber:3 | stale | - | - | - |  |
| lumber.run | contract | not flown | - | - | - |  |
| resort.01 | contract | not flown | - | - | - |  |
| resort.04 | contract | order | - | - | - |  |
| resort.b2 | contract | order | - | - | - |  |
| resort.guests | contract | not flown | - | - | - |  |
| resort.02 | skyline:1 | not flown | - | - | - |  |
| resort.03 | skyline:2 | not flown | - | - | - |  |
| skyline.03 | skyline:2 | stale | - | - | - |  |
| resort.05 | skyline:3 | not flown | - | - | - |  |
| survey.01 | contract | not flown | - | - | - |  |
| survey.02 | contract | not flown | - | - | - |  |
| survey.03 | contract | not flown | - | - | - |  |
| survey.05 | contract | not flown | - | - | - |  |
| survey.04 | contract | order | - | - | - |  |
| obs.01 | observatory:1 | stale | - | - | - |  |
| obs.02 | observatory:2 | not flown | - | - | - |  |
| obs.03 | observatory:2 | stale | - | - | - |  |
| obs.04 | observatory:3 | not flown | - | - | - |  |
| obs.05 | observatory:3 | stale | - | - | - |  |
| obs.06 | observatory:4 | not flown | - | - | - |  |
| obs.07 | observatory:4 | not flown | - | - | - |  |
| obs.08 | observatory:5 | not flown | - | - | - |  |
| obs.09 | observatory:6 | not flown | - | - | - |  |
| clients.01 | contract | not flown | - | - | - |  |
| clients.n1 | contract | not flown | - | - | - |  |
| clients.n2 | contract | not flown | - | - | - |  |
| clients.03 | contract | not flown | - | - | - |  |
| clients.02 | contract | order | - | - | - |  |
| clients.04 | contract | order | - | - | - |  |
| clients.b1 | contract | order | - | - | - |  |
| booze.01 | contract | not flown | - | - | - |  |
| booze.02 | contract | not flown | - | - | - |  |
| home.01 | home:1 | feasible | Piper Cub | 19 min 44 s | HOME > w1 1184 |  |
| home.02 | home:1 | feasible | Piper Cub | 24 min 20 s | HOME > w3 560; w3 > w1 900 |  |
| home.03 | home:2 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 20 min 08 s | HOME > w3 486; w3 > w1 722 |  |
| home.04 | home:2 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 15 min 29 s | HOME > w1 929 |  |
| home.05 | home:2 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 14 min 50 s | HOME > w1 890 |  |
| home.06 | home:3 | infeasible | - | - | - | no official plane can do it (73_ contractCanDo): cub: Cub: 450 kg aboard, the cabin takes 90 kg; jodel: Jodel: 450 kg aboard, the cabin takes 90 kg; c172: Cessna 172: 450 kg aboard, the cabin takes 280 kg; c172f: Cessna  |
| home.07 | home:3 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 20 min 03 s | HOME > w3 472; w3 > w1 731 |  |
| home.08 | home:4 | stale | - | - | - |  |
| home.09 | home:4 | not flown | - | - | - |  |
| home.10 | home:5 | not flown | - | - | - |  |
| home.11 | home:5 | not flown | - | - | - |  |
| home.12 | home:6 | not flown | - | - | - |  |
| home.13 | home:7 | infeasible | PC-6 Turbo Porter | 19 min 04 s | HOME > w1 1144 | the stop refuses the load: aboard 0 kg / 0 pax, the job is 280 kg / 0 pax |
| home.14 | home:7 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 19 min 53 s | HOME > w3 480; w3 > w1 713 |  |
| community.01 | community:1 | feasible | Piper Cub | 33 min 10 s | HOME > w6 1990 |  |
| community.02 | community:2 | feasible | Piper Cub | 34 min 26 s | HOME > w3 571; w3 > w7 1495 |  |
| community.03 | community:2 | feasible | Piper Cub | 28 min 54 s | HOME > w7 1734 |  |
| community.04 | community:3 | feasible | Piper Cub | 29 min 31 s | HOME > w7 1771 |  |
| community.05 | community:4 | feasible | STOL Cub | 26 min 12 s | HOME > w5 553; w5 > w7 1019 |  |
| community.06 | community:4 | feasible | Piper Cub | 38 min 12 s | HOME > mn_strip 992; mn_strip > w7 1300 |  |
| community.07 | community:4 | feasible | Piper Cub | 35 min 18 s | HOME > w3 572; w3 > w7 1546 |  |
| community.08 | community:5 | feasible | PC-6 Turbo Porter | 16 min 26 s | HOME > w7 986 |  |
| community.09 | community:6 | infeasible | DC-3-alike | 31 min 08 s | HOME > w7 1868 | the stop refuses the load: aboard 0 kg / 1 pax, the job is 300 kg / 0 pax |
| community.10 | community:7 | infeasible | DC-3-alike | 31 min 08 s | HOME > w7 1868 | the stop refuses the load: aboard 0 kg / 1 pax, the job is 400 kg / 0 pax |
| community.11 | community:8 | infeasible | PC-6 Turbo Porter | 12 min 35 s | HOME > w3 755 | the stop refuses the load: aboard 0 kg / 0 pax, the job is 350 kg / 0 pax |
| club.stol | contract | feasible | Piper Cub | 8 min 09 s | HOME > xw_rough 489 [stol:ld=197.6] |  |
| club.spot | contract | feasible | Piper Cub | 8 min 08 s | HOME > w2 488 [stol:sp=95.7] |  |
| club.pylons | contract | feasible | Piper Cub | 18 min 16 s | HOME > HOME 1096 [hit:g1 hit:g2 hit:g3 hit:g4] |  |
| club.regular | contract | feasible | Piper Cub | 18 min 06 s | HOME > HOME 1086 [hit:r1 hit:r2] |  |
| club.tour | club:2 | infeasible | STOL Cub | 74 min 03 s | HOME > w3 873 [hit:a1 hit:a2]; w3 > w5 572 [hit:b1 hit:b2]; w5 > w5 1546; w5 > w5 1452 | no progress: pass c1: not flown yet |
| club.breakfast | club:1 | feasible | Jodel D112 | 16 min 02 s | HOME > tw_ski 962 |  |
