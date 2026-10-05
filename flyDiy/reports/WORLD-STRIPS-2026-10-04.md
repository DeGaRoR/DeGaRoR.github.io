# WORLD-STRIPS, G1560-G1569 (2026-10-04): what moved on seed 0 and on Jolene

The fixes are REVIEW 2026-10-04's A5, B14, B25, D8 and the C-world note on the strip grade's box. This report lists
everything that moved. HANDOVER "## G1560-G1569 - WORLD-STRIPS" has the why and the gates.
The lists come from `tools/world_moves.js <old core> <new core> <seed0|jolene> --rivers` and the pictures from
`tools/world_topmap.js` (node only, no GPU). Both compare the train-31 + review-round-2 core (before) with this
branch's core (after).

## Jolene (the default map): what moved
- **Aerodromes: none.** All 8 (w2, HOME 13/31, w3, SEA, mk_sea, mn_strip, nv_strip, tw_ski) are byte-identical in
  ground and water over each strip and 300 m past its ends. The island takes no generated strips, so A5 and the
  feather fix do not reach it.
- **Lakes: none** (206 → 206, all identical). **Sea / coastline: none** (0 cells changed). D8 is not applied on an
  island: its sea is the data's coast field. The bake's five "landlocked" pockets on Jolene (1-12 cells at −5 m)
  are the coast field's own sea shelf behind channels narrower than a bake cell, and they stay sea.
- **Rivers: +40 reaches (B14), 0 removed or reshaped.** Eight lakes' outlets had no river. Their outlet creeks are
  traced now: 1 189 of 3.84 M 20 m samples of ground (0.031 %) are lowered by the new beds (≤ 1.16 m), and 327 samples
  are newly wet (≈ 13 ha). Nothing dried. Pictures: `evidence/WORLD-STRIPS/jolene_whole_before_after_diff.png`,
  `jolene_outlets_east.png` (the 3.7 km creek from the lake chain at (6941, −12730) to (8663, −10740)).
- terrainH / waterH cost on Jolene: unchanged within noise (1e6 reads over the island and round HOME, A/B).

## Seed 0 (the analytic world)
Meadows, the sea lane, HOME and the four golden anchors held (GATE WORLD). The far field moved because the rivers
moved. B14 traced 105 lakes' outlet rivers and D8 turned 49 landlocked components into lakes. Stage 3 scores town
sites on the rivers (near-water and confluence bonuses), so the towns re-sited, and stage 4's strips followed the
towns. Pictures: `evidence/WORLD-STRIPS/seed0_whole_before_after_diff.png` (whole world),
`seed0_home_box.png` (x −6300..600, z −3300..2600), `seed0_pelham_A2.png` (A5: the old Pelham Field across its
river), `seed0_north_basin_D8.png` (the 3 020-cell basin: sea at 0 → a lake at its 1.49 m spill).

### seed0: aerodromes
| id | before | after |
|---|---|---|
| A0 | Morford Airfield (main, 900 m) at (-6082, 395) hdg 0.0, elev 9.39 | Morford Airfield (main, 900 m) at (-4699, -118) hdg 112.5, elev 13.84 |
| A1 | Holtorham Field (main, 650 m) at (-2993, -9636) hdg 0.0, elev 24.93 | Pelham Field (main, 650 m) at (4853, -10955) hdg 22.5, elev 33.45 |
| A2 | Pelham Field (main, 650 m) at (5384, -10964) hdg 135.0, elev 24.43 | Lunford Field (main, 650 m) at (-10066, 175) hdg 157.5, elev 41.26 |
| A3 | Pelwick Field (main, 480 m) at (837, -10187) hdg 90.0, elev 43.98 | Berton Field (main, 480 m) at (-8432, 7159) hdg 0.0, elev 51.93 |
| A4 | Holwick Field (main, 480 m) at (-7775, -10560) hdg 22.5, elev 2.60 | Tyl Strip (strip, 340 m) at (-2020, 8775) hdg 157.5, elev 103.29 |
| A5 | Tyl Strip (strip, 340 m) at (-2020, 8775) hdg 157.5, elev 103.29 | Ulv Strip (strip, 340 m) at (1765, -9144) hdg 67.5, elev 89.59 |
| A6 | Brekk Strip (strip, 340 m) at (-9651, 5626) hdg 67.5, elev 113.49 | Stein Strip (strip, 340 m) at (9061, 11376) hdg 90.0, elev 98.48 |
| A7 | Stein Strip (strip, 340 m) at (-9033, 9789) hdg 112.5, elev 103.59 | - |
(5 unchanged: HOME, M1, M2, M3, SEA)

### seed0: towns (stage 3)
before: Home Field (60, 112) pop 45; Morford (-5602, 398) pop 900; Holtorham (-3164, -10008) pop 641; Pelham (5836, -10945) pop 795; Lunford (-10195, -164) pop 687; Berton (-8133, 7992) pop 536; Pelwick (-70, -10289) pop 439; Holwick (-7945, -10289) pop 268; Vimfield (3023, -10477) pop 199

after: Home Field (60, 112) pop 45; Morford (-5602, 398) pop 900; Vimdorf (-8039, -11414) pop 728; Alwick (-3352, -914) pop 739; Pelham (5836, -10945) pop 689; Dalford (-2602, -10195) pop 478; Lunford (-10195, -164) pop 475; Berton (-8133, 7992) pop 340; Pelwick (-70, -10289) pop 243

### seed0: lakes (the bake's lake mask, 8-connected components): 359 -> 365; 332 identical
changed or gone (before): 17 cells at (-3972, -11753) level 3.1; 1 cells at (-3867, -11742) level 3.1; 14 cells at (-3827, -11491) level 3.1; 124 cells at (5907, -9973) level 13.83; 1 cells at (-4805, -9727) level 1.72; 15 cells at (-3698, -9598) level 5.52; 1 cells at (10336, -9164) level 2.99; 2 cells at (10547, -8953) level 2.99; 2 cells at (10781, -8883) level 2.99; 1 cells at (10898, -8695) level 2.99; 2 cells at (10313, -8367) level 2.99; 635 cells at (-6670, -7478) level 78.41; 367 cells at (-3028, -7543) level 83.22; 338 cells at (11311, -7249) level 93.75; 2712 cells at (8550, -5092) level 118.6; 36 cells at (-11488, -6449) level 29.9; 1033 cells at (-10041, -5694) level 200.21; 84 cells at (10847, -5550) level 64.88; 377 cells at (-6137, -5183) level 184.31; 921 cells at (4049, -4288) level 168.34; 1848 cells at (-7982, -3668) level 130.51; 141 cells at (3319, -2844) level 109.49; 76 cells at (-11566, -1902) level 21.38; 74 cells at (-1503, -1832) level 31.54; 1 cells at (7945, -1945) level 1.67; 304 cells at (2268, -231) level 4.58; 1 cells at (1992, 70) level 4.58

changed or new (after): 81 cells at (-3905, -11655) level 3.1; 3020 cells at (-5799, -10162) level 1.49; 33 cells at (-7870, -11110) level 1.49; 35 cells at (-2907, -11004) level 1.49; 1 cells at (-6914, -10992) level 1.54; 13 cells at (-7635, -10859) level 1.49; 2 cells at (-7852, -10734) level 1.49; 125 cells at (5906, -9971) level 13.83; 28 cells at (-10893, -9668) level 0.93; 6 cells at (-4781, -9773) level 1.72; 16 cells at (-3697, -9595) level 5.52; 4 cells at (10184, -9246) level 0.27; 200 cells at (10498, -8668) level 2.99; 903 cells at (-6745, -7443) level 78.41; 372 cells at (-3023, -7538) level 83.22; 361 cells at (11319, -7232) level 93.75; 3067 cells at (8527, -5111) level 118.6; 68 cells at (-11455, -6472) level 29.9; 1039 cells at (-10037, -5698) level 200.21; 96 cells at (10851, -5530) level 64.88; 379 cells at (-6138, -5184) level 184.31; 922 cells at (4049, -4288) level 168.34; 2156 cells at (-7977, -3714) level 130.51; 147 cells at (3312, -2843) level 109.49; 84 cells at (-11564, -1901) level 21.38; 91 cells at (-1500, -1839) level 31.54; 2 cells at (7945, -1922) level 1.67; 52 cells at (-874, -816) level 0.27; 363 cells at (2238, -185) level 4.58; 19 cells at (-2002, -778) level 0.27; 1 cells at (-2930, 211) level 0.08; 1 cells at (-2930, 352) level 0.08; 2 cells at (-2789, 375) level 0.08

### seed0: the sea (the bake's sea mask, 512x512 cells of 46.9 m): 4561 cells left the sea, 0 joined it

**By name:** Tyl Strip did not move. Morford Airfield moved 1.47 km (it is still A0). Pelham Field moved 0.53 km
(now A1, hdg 22.5). Lunford and Berton were towns before too, without a field. Their populations changed (687 → 475,
536 → 340) and their searches now admit a clean site. Holtorham, Holwick and Vimfield are no longer towns, so their
fields went with them. Pelwick (pop 439 → 243) dropped under the 250 threshold for a field. Brekk Strip's bench is
no longer among the three flattest clean benches far enough from the strips, so Ulv and a new Stein (the name is
hashed from the site) take the backcountry slots. Applied on its own, without B14/D8, A5 moved two fields: Pelham
Field by 168 m (same heading: every candidate crossed the river's bank, so the nudge pass found the clean site) and
Holwick Field (its edge touched a bed).

### seed 0: the 49 landlocked components below 0 m (D8), now lakes
The bake's sea mask lost 4 561 cells and gained none. The ocean (every below-0 component that reaches the domain's
edge) is unchanged, and so is the coastline. Many of the deep northern ones lay INSIDE lakes the flood already had
(at 78-200 m): their middles were "sea" at 0, a hole in the lake's water, and now the lake is whole. A component
shallower than 1.5 m keeps its ground exactly and only holds water at its spill. The five such dips in the home
lowlands are (−874, −816), (−2002, −778), (−2930, 211), (−2930, 352) and (−2789, 375), at 0.27 / 0.08 m.

| centroid (x, z) | cells (46.9 m) | lowest ground | water before | water now (the spill) | bed |
|---|---|---|---|---|---|
| (-5799, -10162) | 3020 | -120.82 m | 0 (sea) | 1.49 m | carved where deeper than 1.5 m |
| (10495, -8664) | 192 | -57.15 m | 0 (sea) | 2.99 m | carved (lake) |
| (-7177, -7364) | 184 | -62.45 m | 0 (sea) | 78.41 m | carved (lake) |
| (8348, -5974) | 157 | -135.70 m | 0 (sea) | 118.60 m | carved (lake) |
| (-8348, -4083) | 149 | -139.16 m | 0 (sea) | 130.51 m | carved (lake) |
| (-7554, -4007) | 133 | -45.74 m | 0 (sea) | 130.51 m | carved (lake) |
| (2085, 90) | 55 | -2.24 m | 0 (sea) | 4.58 m | carved (lake) |
| (-6350, -7473) | 52 | -68.73 m | 0 (sea) | 78.41 m | carved (lake) |
| (-874, -816) | 52 | -0.43 m | 0 (sea) | 0.27 m | ground kept (shallow) |
| (-3905, -11666) | 49 | -2.61 m | 0 (sea) | 3.10 m | carved (lake) |
| (8300, -3986) | 49 | -92.38 m | 0 (sea) | 118.60 m | carved (lake) |
| (7242, -5430) | 45 | -61.67 m | 0 (sea) | 118.60 m | carved (lake) |
| (8818, -4042) | 37 | -44.84 m | 0 (sea) | 118.60 m | carved (lake) |
| (-2907, -11004) | 35 | -1.89 m | 0 (sea) | 1.49 m | carved (lake) |
| (-7870, -11110) | 33 | -2.04 m | 0 (sea) | 1.49 m | carved (lake) |
| (-11417, -6498) | 32 | -53.85 m | 0 (sea) | 29.90 m | carved (lake) |
| (-10893, -9668) | 28 | -3.00 m | 0 (sea) | 0.93 m | carved where deeper than 1.5 m |
| (11428, -6985) | 23 | -29.27 m | 0 (sea) | 93.75 m | carved (lake) |
| (-6734, -7020) | 20 | -30.17 m | 0 (sea) | 78.41 m | carved (lake) |
| (9593, -4927) | 20 | -12.52 m | 0 (sea) | 118.60 m | carved (lake) |
| (7750, -4945) | 19 | -11.38 m | 0 (sea) | 118.60 m | carved (lake) |
| (-2002, -778) | 19 | -0.18 m | 0 (sea) | 0.27 m | ground kept (shallow) |
| (-7401, -3531) | 18 | -20.30 m | 0 (sea) | 130.51 m | carved (lake) |
| (-1490, -1868) | 17 | -11.20 m | 0 (sea) | 31.54 m | carved (lake) |
| (-7635, -10859) | 13 | -1.24 m | 0 (sea) | 1.49 m | carved (lake) |
| (9791, -5479) | 13 | -15.44 m | 0 (sea) | 118.60 m | carved (lake) |
| (-5824, -7398) | 12 | -15.93 m | 0 (sea) | 78.41 m | carved (lake) |
| (10875, -5391) | 12 | -26.32 m | 0 (sea) | 64.88 m | carved (lake) |
| (8840, -4910) | 12 | -14.34 m | 0 (sea) | 118.60 m | carved (lake) |
| (-8279, -2936) | 8 | -7.50 m | 0 (sea) | 130.51 m | carved (lake) |
| (-11543, -1898) | 8 | -4.75 m | 0 (sea) | 21.38 m | carved (lake) |
| (-9352, -6375) | 6 | -17.22 m | 0 (sea) | 200.21 m | carved (lake) |
| (3164, -2812) | 6 | -6.62 m | 0 (sea) | 109.49 m | carved (lake) |
| (-4777, -9783) | 5 | -1.29 m | 0 (sea) | 1.72 m | carved (lake) |
| (-2639, -7130) | 5 | -11.83 m | 0 (sea) | 83.22 m | carved (lake) |
| (10184, -9246) | 4 | -1.43 m | 0 (sea) | 0.27 m | carved where deeper than 1.5 m |
| (8336, -5242) | 3 | -3.49 m | 0 (sea) | 118.60 m | carved (lake) |
| (-7852, -10734) | 2 | -0.27 m | 0 (sea) | 1.49 m | carved (lake) |
| (-6187, -5320) | 2 | -1.78 m | 0 (sea) | 184.31 m | carved (lake) |
| (2086, -656) | 2 | -0.11 m | 0 (sea) | 4.58 m | carved (lake) |
| (-2789, 375) | 2 | -0.02 m | 0 (sea) | 0.08 m | ground kept (shallow) |
| (-6914, -10992) | 1 | -0.08 m | 0 (sea) | 1.54 m | carved (lake) |
| (5836, -9680) | 1 | -0.13 m | 0 (sea) | 13.83 m | carved (lake) |
| (-3680, -9539) | 1 | -0.25 m | 0 (sea) | 5.52 m | carved (lake) |
| (4102, -3961) | 1 | -2.99 m | 0 (sea) | 168.34 m | carved (lake) |
| (7945, -1898) | 1 | -0.80 m | 0 (sea) | 1.67 m | carved (lake) |
| (2180, -633) | 1 | -0.06 m | 0 (sea) | 4.58 m | carved (lake) |
| (-2930, 211) | 1 | -0.01 m | 0 (sea) | 0.08 m | ground kept (shallow) |
| (-2930, 352) | 1 | -0.01 m | 0 (sea) | 0.08 m | ground kept (shallow) |


### ### seed0: river reaches 299 -> 528 (253 identical, 46 gone or reshaped, 275 new or reshaped)

<details><summary>the reaches (from, to, length, width, how they end)</summary>

**gone/reshaped** (46)
- (-3820, -11930)->(-3773, -11977) 66 m w 8.2 boundary
- (-2695, -11414)->(-3305, -11227) 991 m w 16.7 sea
- (-7945, -11273)->(-7992, -11227) 66 m w 8.6 sea
- (-6070, -11273)->(-6680, -10805) 1046 m w 14.3 sea
- (5695, -9773)->(5742, -9867) 105 m w 8.4 lake
- (5742, -9914)->(5602, -10148) 281 m w 10.8 lake
- (-3867, -9398)->(-4055, -9820) 525 m w 38.9 sea
- (-3539, -8039)->(-3586, -7992) 66 m w 14.3 lake
- (-3727, -8039)->(-3914, -8273) 406 m w 29.2 lake
- (-3914, -8320)->(-3680, -9023) 867 m w 31.1 lake
- (-3727, -9211)->(-3820, -9305) 133 m w 31.9 lake
- (-3867, -9352)->(-3867, -9398) 47 m w 32.0 junction
- (-8555, -9023)->(-8555, -9070) 47 m w 33.8 lake
- (-8602, -9211)->(-8555, -9258) 66 m w 34.5 lake
- (-8602, -9352)->(-9070, -9633) 604 m w 36.0 sea
- (10195, -5648)->(10242, -5602) 66 m w 24.9 lake
- (10430, -5789)->(10477, -5742) 66 m w 25.7 lake
- (10523, -5695)->(10664, -5789) 207 m w 28.7 lake
- (10805, -5930)->(10758, -6070) 160 m w 30.1 lake
- (10758, -6164)->(10852, -6305) 199 m w 30.9 lake
- (10945, -6680)->(10992, -6633) 66 m w 33.4 lake
- (11414, -6445)->(11930, -6398) 552 m w 34.8 sea
- (-8555, -4617)->(-8555, -4570) 47 m w 43.0 lake
- (-8695, -4195)->(-8695, -4148) 47 m w 43.2 lake
- (-7477, -4430)->(-7523, -4383) 66 m w 26.0 lake
- (-7570, -4383)->(-7617, -4336) 66 m w 26.2 lake
- (-11695, -1992)->(-11648, -1945) 66 m w 24.7 lake
- (-11648, -1617)->(-11648, -1570) 47 m w 25.1 lake
- (-11695, -1523)->(-11742, -1477) 66 m w 25.4 lake
- (-11836, -1383)->(-11977, -1383) 171 m w 26.4 boundary
- (3398, -3117)->(3445, -3117) 47 m w 20.9 lake
- (-914, -1477)->(-773, -914) 687 m w 20.5 sea
- (-7617, -2227)->(-7289, -1477) 865 m w 17.3 lake
- (-7289, -1430)->(-7195, -1289) 179 m w 17.8 lake
- (-7242, -1195)->(-7242, -680) 632 m w 20.4 lake
- (-7195, -633)->(-6914, -211) 577 m w 39.2 lake
- (-6867, -164)->(-6633, 586) 915 m w 41.2 sea
- (-2180, -1617)->(-1992, -867) 896 m w 25.1 sea
- (1992, -1055)->(2039, -727) 378 m w 34.9 lake
- (-2836, -961)->(-2930, 211) 1403 m w 38.1 sea
- (-1289, -773)->(-1992, -867) 734 m w 16.4 sea
- (-2367, -633)->(-2742, -539) 511 m w 13.5 junction
- (2742, -23)->(3492, -305) 991 m w 12.0 sea
- (1758, 117)->(1805, 23) 105 m w 8.1 lake
- (1758, -23)->(1992, -773) 919 m w 17.6 junction
- (-3164, 305)->(-2930, 586) 538 m w 9.7 sea

**new/reshaped** (275)
- (-4102, -11883)->(-3914, -11930) 237 m w 10.3 lake
- (-3820, -11930)->(-3773, -11977) 66 m w 11.3 boundary
- (-6867, -10992)->(-6680, -10805) 284 m w 45.0 lake
- (-6727, -10758)->(-6961, -10570) 328 m w 45.0 lake
- (-7008, -10570)->(-7055, -10570) 47 m w 45.0 lake
- (-7148, -10570)->(-7617, -10805) 596 m w 45.0 lake
- (-7711, -10898)->(-7758, -11133) 293 m w 45.0 lake
- (-7898, -11273)->(-7992, -11227) 105 m w 45.0 lake
- (-7992, -11180)->(-7992, -11039) 171 m w 45.0 lake
- (-8039, -10992)->(-8227, -10664) 406 m w 45.0 sea
- (-4711, -11414)->(-4945, -11414) 302 m w 10.2 lake
- (-4992, -11414)->(-5086, -11414) 94 m w 45.0 lake
- (-5180, -11461)->(-5883, -11648) 850 m w 45.0 lake
- (-5930, -11695)->(-6680, -10852) 1603 m w 45.0 junction
- (-2695, -11414)->(-3305, -11227) 991 m w 45.0 lake
- (-3352, -11227)->(-3680, -10945) 513 m w 45.0 lake
- (-3727, -10898)->(-4102, -10664) 472 m w 45.0 lake
- (-4195, -10664)->(-4336, -10805) 199 m w 45.0 lake
- (-4477, -10945)->(-4523, -10992) 66 m w 45.0 lake
- (-7805, -11273)->(-7945, -11273) 171 m w 8.4 junction
- (-4664, -10758)->(-4758, -10852) 133 m w 8.1 lake
- (-3539, -10477)->(-3680, -10617) 199 m w 9.8 lake
- (-3727, -10664)->(-3867, -10805) 199 m w 9.9 junction
- (5695, -9773)->(5742, -9867) 105 m w 19.0 lake
- (5742, -9914)->(5602, -10148) 281 m w 20.2 lake
- (10195, -9305)->(10242, -9258) 66 m w 10.7 lake
- (10289, -9305)->(10336, -9352) 66 m w 11.0 sea
- (-3867, -9398)->(-4055, -9820) 525 m w 39.2 lake
- (-4102, -9867)->(-4289, -10148) 359 m w 39.4 lake
- (-5648, -11508)->(-5695, -11555) 66 m w 39.6 junction
- (-10992, -9586)->(-10992, -9633) 47 m w 13.9 lake
- (-11039, -9680)->(-10992, -9727) 66 m w 16.0 lake
- (-10992, -9773)->(-10945, -9820) 66 m w 17.3 lake
- (-10945, -9867)->(-10945, -10008) 141 m w 18.7 sea
- (-3539, -8039)->(-3586, -7992) 66 m w 14.9 lake
- (-3727, -8039)->(-3914, -8273) 406 m w 29.6 lake
- (-3914, -8320)->(-3680, -9023) 867 m w 31.5 lake
- (-3727, -9211)->(-3820, -9305) 133 m w 32.3 lake
- (-3867, -9352)->(-3867, -9398) 47 m w 32.4 junction
- (-8555, -9023)->(-8555, -9070) 47 m w 40.7 lake
- (-8602, -9211)->(-8555, -9258) 66 m w 41.3 lake
- (-8602, -9352)->(-9070, -9633) 604 m w 42.5 sea
- (10195, -5648)->(10242, -5602) 66 m w 45.0 lake
- (10430, -5789)->(10477, -5742) 66 m w 45.0 lake
- (10523, -5695)->(10664, -5789) 207 m w 45.0 lake
- (10805, -5930)->(10758, -6070) 160 m w 45.0 lake
- (10758, -6164)->(10852, -6305) 199 m w 45.0 lake
- (10945, -6680)->(10992, -6633) 66 m w 45.0 lake
- (11414, -6445)->(11930, -6398) 552 m w 45.0 sea
- (-11648, -6445)->(-11648, -6398) 47 m w 22.5 lake
- (-11836, -6305)->(-11977, -6305) 171 m w 24.2 boundary
- (-4758, -9867)->(-4758, -10242) 491 m w 45.0 lake
- (-8555, -4617)->(-8555, -4570) 47 m w 45.0 lake
- (-8695, -4195)->(-8695, -4148) 47 m w 45.0 lake
- (-7852, -2461)->(-7289, -1477) 1310 m w 45.0 lake
- (-7289, -1430)->(-7195, -1289) 179 m w 45.0 lake
- (-7242, -1195)->(-7242, -680) 632 m w 45.0 lake
- (-7195, -633)->(-6914, -211) 577 m w 45.0 lake
- (-6867, -164)->(-6633, 586) 915 m w 45.0 sea
- (7898, -6258)->(7945, -6305) 66 m w 45.0 lake
- (9633, -5695)->(9680, -5742) 66 m w 45.0 lake
- (9633, -5930)->(9680, -6023) 105 m w 45.0 lake
- (-7477, -4430)->(-7523, -4383) 66 m w 28.4 lake
- (-7570, -4383)->(-7617, -4336) 66 m w 29.1 lake
- (-11695, -1992)->(-11648, -1945) 66 m w 24.7 lake
- (-11648, -1617)->(-11648, -1570) 47 m w 25.5 lake
- (-11695, -1523)->(-11742, -1477) 66 m w 25.7 lake
- (-11836, -1383)->(-11977, -1383) 171 m w 26.7 boundary
- (-680, -961)->(-773, -914) 105 m w 44.0 lake
- (-914, -961)->(-961, -914) 66 m w 44.7 lake
- (-1055, -914)->(-1148, -867) 105 m w 45.0 lake
- (-1195, -867)->(-1992, -867) 866 m w 45.0 lake
- (-2180, -820)->(-2930, 211) 1753 m w 45.0 lake
- (-2977, 258)->(-2930, 586) 425 m w 45.0 sea
- (3398, -3117)->(3445, -3117) 47 m w 21.3 lake
- (-914, -1477)->(-727, -961) 621 m w 20.3 junction
- (-2180, -1617)->(-1992, -867) 896 m w 25.5 junction
- (1992, -1055)->(2039, -727) 378 m w 36.0 lake
- (2273, -492)->(2320, -445) 66 m w 36.2 lake
- (2461, -305)->(3492, -305) 1404 m w 38.1 sea
- (-2836, -961)->(-2742, -539) 450 m w 9.6 junction
- (1758, 117)->(1805, 23) 105 m w 9.0 lake
- (1758, -23)->(1992, -773) 919 m w 19.8 junction
- (-3164, 305)->(-2977, 352) 207 m w 8.3 junction
- (1336, -11508)->(1148, -11742) 312 m w 9.5 junction
- (1477, -11508)->(1430, -11461) 66 m w 8.8 lake
- (-7805, -10898)->(-7852, -10945) 66 m w 27.4 lake
- (-7617, -10242)->(-7711, -10805) 729 m w 27.3 lake
- (-7617, -10102)->(-7570, -10148) 66 m w 21.9 lake
- (-7477, -9727)->(-7430, -9773) 66 m w 20.0 lake
- (6633, -9727)->(6867, -9633) 260 m w 10.3 lake
- (6914, -9680)->(7008, -9633) 105 m w 11.6 junction
- (-7523, -9586)->(-7477, -9633) 66 m w 18.9 lake
- (352, -9492)->(352, -9539) 47 m w 8.3 junction
- (-7477, -9445)->(-7477, -9492) 47 m w 18.0 lake
- (1430, -9445)->(1242, -10477) 1292 m w 13.1 lake
- (5227, -9445)->(5180, -9820) 491 m w 10.9 junction
- (-5039, -9352)->(-4758, -9633) 417 m w 9.3 junction
- (-10523, -9211)->(-10477, -9211) 47 m w 19.7 lake
- (-10430, -9164)->(-10148, -9445) 398 m w 20.1 sea
- (-7383, -9070)->(-7336, -9164) 105 m w 15.4 lake
- (10289, -9023)->(10336, -9070) 66 m w 22.4 lake
- (10477, -9023)->(10523, -8977) 66 m w 22.8 lake
- (10617, -8883)->(10664, -8836) 66 m w 23.0 lake
- (10805, -8930)->(10898, -8977) 105 m w 24.8 sea
- (-7383, -8977)->(-7336, -9023) 66 m w 14.3 lake
- (-8461, -8883)->(-8508, -8930) 66 m w 34.3 lake
- (10195, -8836)->(10242, -8883) 66 m w 20.5 lake
- (3492, -8742)->(3539, -8742) 47 m w 20.2 lake
- (-9586, -8648)->(-9867, -9023) 505 m w 11.0 sea
- (-8320, -8648)->(-8367, -8695) 66 m w 33.9 lake
- (11555, -8602)->(11602, -8883) 292 m w 21.1 sea
- (-9727, -8555)->(-9586, -8602) 148 m w 8.9 lake
- (-7570, -8555)->(-7523, -8602) 66 m w 8.4 lake
- (9680, -8555)->(9867, -8602) 207 m w 9.6 lake
- (9914, -8555)->(10148, -8555) 234 m w 10.2 lake
- (3586, -8320)->(3680, -8461) 179 m w 18.8 lake
- (-7992, -8273)->(-8227, -8508) 359 m w 32.3 lake
- (6820, -8227)->(6773, -8273) 66 m w 8.0 lake
- (3211, -8180)->(3492, -8227) 301 m w 17.6 lake
- (-7992, -8133)->(-7945, -8227) 105 m w 17.8 lake
- (2086, -8133)->(2695, -9445) 1675 m w 39.3 lake
- (8555, -8133)->(8508, -8086) 66 m w 18.1 lake
- (8461, -8086)->(8320, -8414) 375 m w 18.8 lake
- (10477, -8133)->(10477, -8320) 226 m w 15.4 lake
- (3023, -8086)->(3164, -8133) 160 m w 16.6 lake
- (10102, -8039)->(10289, -8086) 237 m w 12.9 lake
- (-6352, -7992)->(-6352, -7945) 47 m w 11.4 lake
- (3914, -7992)->(3961, -8273) 301 m w 19.5 lake
- (8742, -7992)->(8695, -8039) 66 m w 17.8 lake
- (-10289, -7898)->(-10477, -8977) 1389 m w 18.9 lake
- (11648, -7898)->(11508, -8555) 685 m w 20.8 lake
- (1758, -7805)->(1945, -8180) 453 m w 36.4 lake
- (9727, -7805)->(9914, -8039) 312 m w 10.2 lake
- (11555, -7805)->(11602, -7805) 47 m w 19.2 lake
- (7102, -7758)->(6914, -7945) 293 m w 14.4 junction
- (9633, -7758)->(9680, -7758) 47 m w 8.0 lake
- (-7898, -7711)->(-7898, -7758) 47 m w 13.0 lake
- (1477, -7664)->(1523, -7664) 47 m w 33.8 lake
- (2789, -7617)->(2977, -8039) 500 m w 14.3 lake
- (1336, -7570)->(1383, -7617) 66 m w 23.6 lake
- (5227, -7570)->(5414, -7477) 226 m w 8.7 junction
- (10430, -7570)->(10477, -7523) 66 m w 8.7 lake
- (10664, -7336)->(10711, -7289) 66 m w 9.8 lake
- (-11133, -7477)->(-11133, -7430) 47 m w 10.7 lake
- (-10945, -7102)->(-10898, -7008) 105 m w 13.4 lake
- (-11180, -6914)->(-11133, -6867) 66 m w 15.6 lake
- (-11086, -6727)->(-11273, -6633) 226 m w 16.6 lake
- (-7758, -7477)->(-7758, -7523) 47 m w 9.9 lake
- (7242, -7336)->(7195, -7383) 66 m w 10.7 lake
- (1195, -7289)->(1477, -7430) 314 m w 22.6 lake
- (1617, -7242)->(1664, -7383) 148 m w 23.4 lake
- (1055, -7055)->(1148, -7242) 226 m w 21.8 lake
- (1008, -6961)->(1055, -7008) 66 m w 21.6 lake
- (773, -6820)->(867, -6820) 94 m w 20.6 lake
- (5367, -6727)->(5320, -6680) 66 m w 8.5 lake
- (8320, -6727)->(8273, -6680) 66 m w 8.5 lake
- (8227, -6680)->(8180, -6633) 66 m w 13.0 lake
- (8039, -6445)->(7992, -6398) 66 m w 16.2 lake
- (-6352, -6680)->(-6539, -6820) 246 m w 11.9 lake
- (1711, -6680)->(1664, -6727) 66 m w 20.5 lake
- (10383, -6680)->(10430, -6633) 66 m w 8.5 lake
- (10664, -6398)->(10758, -6445) 105 m w 9.8 junction
- (-9773, -6633)->(-9820, -6586) 66 m w 11.4 lake
- (-10523, -5789)->(-10477, -5742) 66 m w 21.6 lake
- (-10992, -5367)->(-10992, -5320) 47 m w 25.1 lake
- (-11273, -5133)->(-11320, -5086) 66 m w 27.2 lake
- (-11461, -4992)->(-11508, -4992) 47 m w 27.8 lake
- (-11508, -5039)->(-11508, -5086) 47 m w 28.8 lake
- (-11602, -5320)->(-11742, -5648) 386 m w 29.8 lake
- (-11789, -5742)->(-11977, -6070) 406 m w 30.4 boundary
- (-9680, -6633)->(-9727, -6586) 66 m w 10.5 lake
- (2273, -6586)->(2227, -6586) 47 m w 16.0 lake
- (2883, -6586)->(2836, -6539) 66 m w 11.1 lake
- (7008, -6539)->(6961, -6539) 47 m w 8.8 lake
- (7664, -5836)->(7711, -5883) 66 m w 40.1 lake
- (6586, -6445)->(6633, -6492) 66 m w 10.6 lake
- (6586, -6305)->(6586, -6352) 47 m w 9.1 lake
- (164, -6164)->(258, -6211) 105 m w 11.5 lake
- (-1383, -6070)->(-1477, -6070) 94 m w 12.5 lake
- (-4664, -5695)->(-4664, -5742) 47 m w 35.1 lake
- (-8320, -5602)->(-8227, -5742) 179 m w 8.6 lake
- (-1289, -5602)->(-1336, -5602) 47 m w 12.0 lake
- (6492, -5602)->(6633, -5602) 141 m w 11.5 lake
- (-3445, -5555)->(-3398, -5414) 199 m w 10.1 lake
- (-3258, -4945)->(-3258, -4898) 47 m w 15.3 lake
- (-3398, -4758)->(-3352, -4711) 66 m w 16.3 lake
- (-3398, -4617)->(-3445, -4570) 66 m w 16.8 lake
- (-3586, -4617)->(-3633, -4570) 66 m w 18.1 lake
- (-3773, -4008)->(-3867, -4008) 94 m w 23.0 lake
- (-4008, -3914)->(-4102, -3867) 105 m w 24.3 lake
- (-4945, -4992)->(-4898, -5039) 66 m w 31.5 lake
- (-4758, -5086)->(-4711, -5086) 47 m w 32.1 lake
- (-4523, -5086)->(-4477, -5227) 160 m w 32.4 lake
- (4570, -5508)->(4617, -5555) 66 m w 11.7 junction
- (6586, -5414)->(6633, -5508) 105 m w 14.5 lake
- (-3445, -5367)->(-3398, -5414) 66 m w 8.5 junction
- (539, -5273)->(586, -5227) 66 m w 14.1 lake
- (867, -4992)->(1148, -4898) 361 m w 15.9 lake
- (-352, -4805)->(-352, -4758) 47 m w 11.3 lake
- (-398, -4711)->(-445, -4664) 66 m w 11.7 lake
- (-633, -4711)->(-633, -4805) 94 m w 19.9 lake
- (-6492, -4758)->(-6539, -4711) 66 m w 21.4 lake
- (-6539, -4664)->(-6727, -4523) 246 m w 21.9 lake
- (-4992, -4523)->(-4945, -4570) 66 m w 14.7 lake
- (-9680, -4477)->(-9586, -4523) 105 m w 27.0 lake
- (-5133, -4477)->(-5086, -4523) 66 m w 9.2 lake
- (6445, -4477)->(6914, -4852) 627 m w 10.7 lake
- (6727, -4289)->(6727, -4242) 47 m w 11.2 lake
- (7289, -3633)->(7523, -3258) 480 m w 15.6 lake
- (7570, -3117)->(7570, -3070) 47 m w 17.6 lake
- (7523, -3023)->(7336, -2977) 207 m w 21.8 lake
- (7383, -2836)->(7242, -2695) 199 m w 22.3 lake
- (7195, -2695)->(7148, -2648) 66 m w 22.7 lake
- (7289, -2461)->(7430, -2320) 199 m w 26.8 lake
- (7430, -2273)->(7945, -1898) 671 m w 28.2 lake
- (7992, -1852)->(7945, -1711) 160 m w 29.7 sea
- (-820, -4242)->(-820, -4289) 47 m w 11.1 lake
- (1242, -4242)->(1336, -4383) 179 m w 13.3 lake
- (1664, -4195)->(1664, -4289) 94 m w 11.3 lake
- (-10711, -4102)->(-10758, -4008) 105 m w 11.5 lake
- (-10711, -3727)->(-10664, -3680) 94 m w 14.1 lake
- (-10430, -3727)->(-10383, -3680) 66 m w 18.9 lake
- (-10242, -3680)->(-10148, -3773) 152 m w 20.2 lake
- (-10195, -3914)->(-10148, -3961) 66 m w 20.7 lake
- (-9727, -3914)->(-9727, -3961) 47 m w 8.7 lake
- (5930, -3680)->(5930, -3633) 47 m w 13.7 lake
- (5883, -3539)->(5883, -3492) 47 m w 14.4 lake
- (5602, -3352)->(5555, -3305) 66 m w 17.7 lake
- (5320, -3164)->(5086, -2930) 351 m w 19.5 lake
- (4992, -3023)->(4898, -2930) 133 m w 21.3 lake
- (4852, -2930)->(4711, -2930) 141 m w 21.4 lake
- (4430, -2836)->(4242, -2695) 287 m w 24.3 lake
- (4195, -2695)->(4148, -2648) 66 m w 24.4 lake
- (3023, -3398)->(3117, -3352) 105 m w 10.6 lake
- (3258, -3211)->(3305, -3070) 160 m w 11.9 junction
- (2648, -3258)->(2742, -3211) 105 m w 8.0 junction
- (-3867, -3070)->(-3820, -3023) 66 m w 11.7 lake
- (-3586, -2742)->(-3586, -2508) 301 m w 15.9 lake
- (-3961, -2414)->(-4008, -2367) 66 m w 19.6 lake
- (-4055, -2367)->(-4148, -2273) 133 m w 21.5 lake
- (-3586, -1711)->(-3258, -633) 1404 m w 29.0 junction
- (-2602, -3070)->(-2648, -3023) 66 m w 12.1 lake
- (-2602, -2977)->(-2695, -2602) 469 m w 14.3 lake
- (-2695, -2555)->(-2695, -2320) 234 m w 14.8 lake
- (-2602, -2273)->(-1898, -1758) 1258 m w 17.5 lake
- (-1992, -1664)->(-1992, -1570) 94 m w 23.6 junction
- (-4945, -3023)->(-4805, -2883) 199 m w 17.4 lake
- (-4805, -2789)->(-4758, -2742) 66 m w 19.0 lake
- (-4852, -2602)->(-4805, -2555) 66 m w 19.7 lake
- (-4945, -2320)->(-4992, -2273) 66 m w 21.1 lake
- (-4992, -2086)->(-5086, -1711) 414 m w 22.7 junction
- (164, -3023)->(305, -2930) 179 m w 10.7 junction
- (6820, -3023)->(6867, -2977) 66 m w 8.5 lake
- (7055, -2883)->(7148, -2695) 226 m w 11.3 lake
- (7805, -2977)->(7617, -3023) 193 m w 11.2 lake
- (-3305, -2695)->(-3539, -2508) 312 m w 9.1 junction
- (-9773, -2320)->(-9727, -2273) 66 m w 11.0 lake
- (-9586, -2133)->(-9539, -1945) 193 m w 11.6 lake
- (-9586, -1898)->(-9586, -1852) 47 m w 14.9 lake
- (-9445, -1711)->(-7898, -820) 2807 m w 23.7 junction
- (-6961, -2227)->(-7336, -1852) 601 m w 11.9 lake
- (1617, -2180)->(2039, -2180) 513 m w 9.9 lake
- (2086, -2133)->(2273, -1430) 770 m w 13.2 lake
- (2320, -1336)->(2648, -961) 659 m w 25.4 lake
- (2789, -820)->(2227, -867) 787 m w 26.9 lake
- (2789, -2086)->(2789, -1336) 932 m w 15.1 lake
- (2742, -1242)->(2602, -1195) 160 m w 17.1 junction
- (-1664, -2039)->(-1711, -1992) 66 m w 10.8 lake
- (-1711, -1617)->(-1852, -1617) 141 m w 14.3 lake
- (-1898, -1617)->(-1945, -1664) 66 m w 14.6 lake
- (-6352, -1852)->(-6352, -961) 997 m w 11.6 junction
- (9023, -1758)->(8742, -1383) 499 m w 11.9 sea
- (-8367, -1711)->(-7758, -1008) 958 m w 10.8 junction
- (-4664, -1289)->(-4664, -727) 781 m w 14.2 junction

</details>

### ### jolene: river reaches 170 -> 210 (170 identical, 0 gone or reshaped, 40 new or reshaped) (Jolene)

**gone/reshaped** (0)
- none

**new/reshaped** (40)
- (6864, -12807)->(6903, -12769) 54 m w 23.6 lake
- (6941, -12730)->(8663, -10740) 3690 m w 28.0 junction
- (5180, -12730)->(5218, -12769) 54 m w 12.8 lake
- (5754, -12692)->(6061, -12501) 366 m w 18.8 lake
- (6290, -12539)->(6329, -12501) 54 m w 19.4 lake
- (6367, -12539)->(6405, -12539) 38 m w 19.6 lake
- (6443, -12577)->(6750, -12922) 889 m w 23.6 lake
- (5065, -12462)->(5104, -12501) 54 m w 11.6 lake
- (13, -10510)->(51, -10625) 121 m w 10.7 lake
- (3228, -8252)->(3305, -8214) 86 m w 28.0 lake
- (3381, -8214)->(3420, -8175) 54 m w 28.0 lake
- (3458, -8214)->(3496, -8214) 38 m w 28.0 lake
- (3534, -8252)->(3573, -8252) 38 m w 28.0 lake
- (3611, -8252)->(3687, -8214) 86 m w 28.0 lake
- (3764, -8214)->(3802, -8175) 54 m w 28.0 lake
- (3841, -8175)->(3879, -8137) 54 m w 28.0 lake
- (3917, -8137)->(3994, -8099) 86 m w 28.0 lake
- (4032, -8137)->(4070, -8137) 38 m w 28.0 lake
- (4223, -8175)->(4262, -8175) 38 m w 28.0 lake
- (3075, -8175)->(3113, -8175) 38 m w 28.0 lake
- (2998, -8137)->(3037, -8137) 38 m w 27.9 lake
- (9199, -8061)->(9965, -8367) 924 m w 15.7 junction
- (2348, -7984)->(2424, -7984) 77 m w 24.7 lake
- (2807, -7946)->(2960, -8099) 217 m w 27.7 lake
- (2195, -7946)->(2233, -7946) 38 m w 23.8 lake
- (2080, -7869)->(2156, -7907) 86 m w 23.6 lake
- (1965, -7793)->(2042, -7831) 86 m w 23.0 lake
- (9161, -7793)->(9161, -7831) 38 m w 14.1 lake
- (1888, -7754)->(1927, -7754) 38 m w 22.5 lake
- (8625, -7563)->(8663, -7525) 54 m w 11.6 lake
- (8702, -7525)->(8740, -7486) 54 m w 12.3 lake
- (8778, -7486)->(8816, -7448) 54 m w 12.4 lake
- (8855, -7448)->(9123, -7640) 469 m w 13.3 lake
- (1353, -7410)->(1506, -7525) 191 m w 18.5 lake
- (1276, -7295)->(1314, -7333) 54 m w 16.6 lake
- (1238, -7218)->(1276, -7257) 54 m w 16.4 lake
- (1123, -7142)->(1161, -7104) 54 m w 16.0 lake
- (1008, -7027)->(1046, -7065) 54 m w 15.3 lake
- (893, -6874)->(970, -6989) 138 m w 14.8 lake
- (778, -6721)->(817, -6759) 54 m w 11.4 lake

## Other seeds (procedural), STRIPGROUND's walk (centreline + both edges, 2 m)
Before, every seed walked had a broken field: seed 0 Pelham Field 5.59 m / 17 wet samples, seed 1 Alnorstad Airfield
5.86 m / 19 and Morwick Field 4.61 m / 27, seed 2 Berholton Airfield 6.35 m / 42, seed 3 Fenvik Field 3.82 m / 33,
seed 7 Kesham Field 7.02 m / 69, seed 12345 Norstad Field 5.08 m / 18. After: none on any of them.
