# The story pack, flown on node

tools/story_feas.js --table. Each mission flown the way the game flies it (tools/mission_feas.js: the stand, the taxi, the take-off, the landing, the taxi in, the load, the career's stop).
A row is kept until its mission changes. Structure only: the verdict, the aeroplane, the time flown, where each flight ended.

Summary (91 missions): 8 an aircraft order (not a flight); 21 feasible; 1 infeasible; 59 not flown; 2 stale. Time flown: 482 min 59 s.

| mission | step of | verdict | aeroplane | flown | flights (from > to, s) | why not |
|---|---|---|---|---|---|---|
| field.01 | contract | not flown | - | - | - |  |
| field.02 | contract | not flown | - | - | - |  |
| field.n1 | contract | not flown | - | - | - |  |
| field.round | contract | not flown | - | - | - |  |
| field.hike | contract | feasible | Piper Cub | 17 min 42 s | HOME > w8 1062 |  |
| field.ridge | contract | feasible | STOL Cub | 20 min 58 s | HOME > w3 564; w3 > w4 694 |  |
| field.cannery | contract | not flown | - | - | - |  |
| hangar.01 | hangar:1 | feasible | Piper Cub | 16 min 43 s | HOME > w3 560; w3 > HOME 443 |  |
| hangar.02 | hangar:1 | not flown | - | - | - |  |
| hangar.03 | hangar:2 | not flown | - | - | - |  |
| hangar.04 | hangar:2 | not flown | - | - | - |  |
| hangar.05 | hangar:3 | feasible | Cessna 172 | 21 min 13 s | HOME > w3 545; w3 > HOME 728 |  |
| heritage.01 | heritage:1 | feasible | STOL Cub | 15 min 30 s | HOME > nv_strip 930 |  |
| heritage.02 | heritage:2 | not flown | - | - | - |  |
| minedock.n1 | contract | not flown | - | - | - |  |
| minedock.b1 | contract | order | - | - | - |  |
| minedock.b2 | contract | order | - | - | - |  |
| minedock.01 | mine:1 | not flown | - | - | - |  |
| minedock.02 | mine:2 | not flown | - | - | - |  |
| mine.03 | mine:3 | not flown | - | - | - |  |
| mine.04 | mine:4 | feasible | PC-6 Turbo Porter | 22 min 06 s | HOME > mn_strip 1326 |  |
| mine.tour | contract | not flown | - | - | - |  |
| minedock.05 | harbour:1 | not flown | - | - | - |  |
| minedock.06 | harbour:2 | not flown | - | - | - |  |
| lumber.01 | lumber:1 | feasible | Cessna 172 floats (career) | 6 min 59 s | SEA > mk_sea 419 |  |
| lumber.02 | lumber:2 | not flown | - | - | - |  |
| lumber.03 | lumber:2 | not flown | - | - | - |  |
| lumber.04 | lumber:3 | not flown | - | - | - |  |
| lumber.run | contract | not flown | - | - | - |  |
| resort.01 | contract | not flown | - | - | - |  |
| resort.04 | contract | order | - | - | - |  |
| resort.b2 | contract | order | - | - | - |  |
| resort.guests | contract | not flown | - | - | - |  |
| resort.02 | skyline:1 | not flown | - | - | - |  |
| resort.03 | skyline:2 | not flown | - | - | - |  |
| skyline.03 | skyline:2 | feasible | Piper Cub | 20 min 33 s | HOME > tw_ski 1233 |  |
| resort.05 | skyline:3 | not flown | - | - | - |  |
| survey.01 | contract | not flown | - | - | - |  |
| survey.02 | contract | not flown | - | - | - |  |
| survey.03 | contract | not flown | - | - | - |  |
| survey.05 | contract | not flown | - | - | - |  |
| survey.04 | contract | order | - | - | - |  |
| obs.01 | observatory:1 | feasible | Piper Cub | 64 min 01 s | HOME > HOME 1426; HOME > HOME 1798; HOME > HOME 617 |  |
| obs.02 | observatory:2 | not flown | - | - | - |  |
| obs.03 | observatory:2 | stale | - | - | - |  |
| obs.04 | observatory:3 | not flown | - | - | - |  |
| obs.05 | observatory:3 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 16 min 40 s | HOME > w3 470; w3 > mt_strip 530 |  |
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
| home.02 | home:1 | not flown | - | - | - |  |
| home.03 | home:2 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 20 min 08 s | HOME > w3 486; w3 > w1 722 |  |
| home.04 | home:2 | not flown | - | - | - |  |
| home.05 | home:2 | feasible | light metal Cessna (the retired list:40) with the STOL kit and a larger elevator (test build) | 14 min 50 s | HOME > w1 890 |  |
| home.06 | home:3 | not flown | - | - | - |  |
| home.07 | home:3 | not flown | - | - | - |  |
| home.08 | home:4 | infeasible | Twin busher floats 4b | 10 min 49 s | SEA > cb_sea 649 | the stop refuses the load: aboard 39 kg / 1 pax, the job is 150 kg / 0 pax |
| home.09 | home:4 | not flown | - | - | - |  |
| home.10 | home:5 | not flown | - | - | - |  |
| home.11 | home:5 | not flown | - | - | - |  |
| home.12 | home:6 | not flown | - | - | - |  |
| home.13 | home:7 | not flown | - | - | - |  |
| home.14 | home:7 | not flown | - | - | - |  |
| community.01 | community:1 | feasible | Piper Cub | 34 min 05 s | HOME > w6 2045 |  |
| community.02 | community:2 | feasible | Piper Cub | 34 min 26 s | HOME > w3 571; w3 > w7 1495 |  |
| community.03 | community:2 | not flown | - | - | - |  |
| community.04 | community:3 | not flown | - | - | - |  |
| community.05 | community:4 | not flown | - | - | - |  |
| community.06 | community:4 | feasible | Piper Cub | 38 min 13 s | HOME > mn_strip 992; mn_strip > w7 1301 |  |
| community.07 | community:4 | not flown | - | - | - |  |
| community.08 | community:5 | not flown | - | - | - |  |
| community.09 | community:6 | not flown | - | - | - |  |
| community.10 | community:7 | not flown | - | - | - |  |
| community.11 | community:8 | not flown | - | - | - |  |
| club.stol | contract | feasible | Piper Cub | 8 min 09 s | HOME > xw_rough 489 [stol:ld=197.6] |  |
| club.spot | contract | feasible | Piper Cub | 8 min 09 s | HOME > w2 489 [stol:sp=95.5] |  |
| club.pylons | contract | feasible | Piper Cub | 18 min 16 s | HOME > HOME 1096 [hit:g1 hit:g2 hit:g3 hit:g4] |  |
| club.regular | contract | feasible | Piper Cub | 18 min 06 s | HOME > HOME 1086 [hit:r1 hit:r2] |  |
| club.tour | club:2 | feasible | Piper Cub | 35 min 39 s | HOME > w3 855 [hit:a1 hit:a2]; w3 > w5 532 [hit:b1 hit:b2]; w5 > HOME 752 [hit:c1 hit:c2] |  |
| club.breakfast | club:1 | stale | - | - | - |  |
