// real_refs.js (REAL-FIGURES, 2026-11-07) — THE REFERENCE ROWS, THE PLANES, THE HISTORY: the data tools/real_check.js
// reads. Kept apart from the runner so a figure is changed in one place, with its source beside it.
//
// A REFERENCE ROW is one published figure WITH THE CONDITIONS IT WAS STATED AT:
//   { v: value | [lo, hi],          the figure (a range when the source gives one, e.g. "1000-1400 fpm")
//     tol: 0.05,                    the book's own scatter around v (POH editions scatter ~5 %; brochure 10 %)
//     kg: 'gross' | number | [lo, hi] | 'solo' | 'unknown',
//                                   the weight it was stated at: 'gross' = the row's mtow; 'solo' = empty + one 77 kg
//                                   pilot + half fuel; 'unknown' = anywhere from one light pilot with reserves to gross
//                                   (the RANGE the user asked for: an unknown condition is a band, not a guess)
//     flaps: 'up' | deg | 'unknown', surface: 'paved' | 'grass' | 'water' | 'unknown', alt: 0 (m), oat: 15 (C),
//     src: 'where it comes from' }
// Every row is sea level ISA unless it says otherwise (no row in this file does).
//
// THE INDICATORS (the keys of `rows`):
//   empty  kg       the empty weight (no load band: the frame's mass model)
//   Vs1    km/h     the clean stall, power off (CAS where the source says so)
//   V75    km/h     level speed at 75 % power (TAS)
//   Vmax   km/h     level speed at full power
//   roc    m/s      the best rate of climb
//   LD     -        the best glide ratio
//   TO     m        the take-off ground roll (land)          TO50  m   to 50 ft (land)
//   LDG    m        the landing ground roll                  LDG50 m   from 50 ft
//   TOW    m        the take-off run on water                TOW50 m   to 50 ft off water   TOWs s  time to lift-off
//
// THE POH TECHNIQUE (`poh`): the test pilot's schedule, as ratios to the build's OWN stall at the load flown (so a
// build with a bigger wing is flown at its own speeds, not the type's absolute ones): vr (rotate / Vs1 at the take-off
// flap), vy (climb / Vs1), flapTO / flapLDG (degrees; converted to the build's own travel), brake (the pilot's brake
// fraction for a "maximum braking" landing roll). The sweep explores around these.
'use strict';

const KT = 1.852, MPH = 1.609344, FPM = 0.00508, FT = 0.3048, LB = 0.45359237;

// ---------------------------------------------------------------------------------------------------------------------
// THE REAL AEROPLANES
// ---------------------------------------------------------------------------------------------------------------------
const REFS = {
  // PIPER J-3C-65 CUB. The 1940s Piper sheet does not state the weight its figures were flown at; the usual reading is
  // gross (1220 lb), but a club J-3 is mostly flown solo from the rear seat. The surface is unstated: a grass type.
  cub: {
    name: 'Piper J-3C-65 Cub (A-65)', mtow: 550, empty: 345, fuelL: 45, S: 16.6,
    src: 'Piper J-3C-65 sheet / POH reprint: gross 1220 lb, empty 765 lb, stall 38 mph, cruise 73-75 mph, top 87 mph, climb 450 fpm, TO run 370 ft, ldg roll 290 ft (perf_study REAL.cub)',
    poh: { vr: 1.15, vy: 1.30, flapTO: 0, flapLDG: 0, brake: 0.6, note: 'no flaps on a J-3 (the build has them: the game pilot uses them)' },
    rows: {
      empty: { v: 345, tol: 0.03, src: '765 lb' },
      Vs1:   { v: 38 * MPH, tol: 0.05, kg: 'unknown', flaps: 'up', src: '38 mph (IAS on a 1940s ASI)' },
      V75:   { v: [73 * MPH, 75 * MPH], tol: 0.05, kg: 'unknown', src: 'cruise 73-75 mph at ~2150 rpm' },
      Vmax:  { v: 87 * MPH, tol: 0.05, kg: 'unknown', src: '87 mph' },
      roc:   { v: 450 * FPM, tol: 0.05, kg: 'unknown', src: '450 fpm' },
      LD:    { v: 9.5, tol: 0.10, kg: 'unknown', src: 'common figure' },
      TO:    { v: 370 * FT, tol: 0.10, kg: 'unknown', flaps: 0, surface: 'unknown', src: '370 ft' },
      LDG:   { v: 290 * FT, tol: 0.10, kg: 'unknown', flaps: 0, surface: 'unknown', src: '290 ft' },
    } },
  // JODEL D.112 (A-65). Thin book: Wikipedia D.11 + aircraft-catalog. The stall row is the RULING of 2026-09-21 (the
  // catalogue's 35 mph needs CL 2.54: refused; the club's 60-65 km/h, an indicated figure) - kept as a range.
  d112: {
    name: 'Jodel D.112 (A-65)', mtow: 530, empty: 320, fuelL: 45, S: 12.7,
    src: 'Wikipedia D.11 / aircraft-catalog D.112: 320 / 530 kg, 12.7 m2, cruise 100 mph, Vmax 124 mph, climb "800 fpm / 2 m/s"; club stall 60-65 km/h (perf_study REAL.d112)',
    poh: { vr: 1.15, vy: 1.30, flapTO: 0, flapLDG: 0, brake: 0.6, note: 'a D.112 has no flaps (the build has them)' },
    rows: {
      empty: { v: 320, tol: 0.05, src: '320 kg' },
      Vs1:   { v: [60, 65], tol: 0.05, kg: 'unknown', flaps: 'up', src: 'the club figure 60-65 km/h (catalogue 35 mph refused, CL 2.54)' },
      V75:   { v: [150, 161], tol: 0.05, kg: 'unknown', src: 'cruise 150-160 km/h / 100 mph' },
      Vmax:  { v: [175, 124 * MPH], tol: 0.05, kg: 'unknown', src: 'perf_study REAL.d112 175 km/h; its own source line says 124 mph (200 km/h): both kept' },
      roc:   { v: [2.0, 800 * FPM], tol: 0.05, kg: 'unknown', src: '"800 fpm / 2 m/s" in one line: both kept' },
      LD:    { v: 10, tol: 0.10, kg: 'unknown', src: 'common figure' },
      TO:    { v: 200, tol: 0.10, kg: 'gross', flaps: 0, surface: 'grass', src: '200 m at gross (catalogue)' },
      LDG:   { v: 150, tol: 0.15, kg: 'unknown', flaps: 0, surface: 'grass', src: 'catalogue' },
    } },
  // CESSNA 172R (IO-360-L2A 160 hp) - the POH, which DOES state its conditions: 2450 lb, SL ISA, paved level dry,
  // flaps 0-10 deg for the take-off, flaps 30 deg and maximum braking for the landing.
  c172r: {
    name: 'Cessna 172R (IO-360-L2A 160 hp)', mtow: 1111, empty: 736, fuelL: 212, S: 16.2, powerHP: 160,
    src: 'Cessna 172R POH (1996+), section 4-5: Vs1 44 KIAS / 51 KCAS flaps up at 2450 lb, Vs0 47 KCAS, Vr 55 KIAS, Vy 79 KIAS, 720 fpm, ground roll 945 ft / 50 ft 1685 ft (flaps 0-10, paved), landing roll 550 ft / 50 ft 1295 ft (flaps 30, max braking, paved); 75 % cruise ~118 KTAS at SL',
    poh: { vr: 1.10, vy: 1.50, flapTO: 10, flapLDG: 30, brake: 0.8, note: 'Vr 55 KIAS = 1.10 Vs1 (CAS), Vy 79 KIAS = 1.5 Vs1' },
    rows: {
      empty: { v: 736, tol: 0.03, src: 'POH basic empty, 1623 lb' },
      Vs1:   { v: 51 * KT, tol: 0.03, kg: 'gross', flaps: 'up', src: '51 KCAS at 2450 lb, most forward CG' },
      V75:   { v: 118 * KT, tol: 0.05, kg: 'gross', src: '75 % at SL, ~118 KTAS (the POH table starts at 2000 ft)' },
      Vmax:  { v: 124 * KT, tol: 0.05, kg: 'gross', src: '124 KTAS at SL' },
      roc:   { v: 720 * FPM, tol: 0.03, kg: 'gross', src: '720 fpm at SL, 2450 lb' },
      LD:    { v: 9.0, tol: 0.10, kg: 'gross', src: 'max glide 9:1 (POH section 3: 1.5 nm per 1000 ft)' },
      TO:    { v: 945 * FT, tol: 0.03, kg: 'gross', flaps: 10, surface: 'paved', src: '945 ft' },
      TO50:  { v: 1685 * FT, tol: 0.03, kg: 'gross', flaps: 10, surface: 'paved', src: '1685 ft' },
      LDG:   { v: 550 * FT, tol: 0.05, kg: 'gross', flaps: 30, surface: 'paved', src: '550 ft, max braking' },
      LDG50: { v: 1295 * FT, tol: 0.05, kg: 'gross', flaps: 30, surface: 'paved', src: '1295 ft' },
    },
    // THE TAIL (CESSNA-TAIL): what the real 172 carries, for the question "is the official Cessna's stab 20-25 % small"
    tail: { Sh: [3.30, 3.35], hSpan: 3.40, elevFrac: 0.44, Sv: 1.6,
            src: 'C172-STUDY 2026-09-20 type sheet: stab span 11 ft 4 in, horizontal tail 35.7 ft2 with 15.7 ft2 of elevator (0.44); a design analysis (pdfcoffee "Cessna 172 Design") gives 21.56 ft2 stabilizer + 14.53 ft2 elevators = 36.1 ft2 (3.35 m2). Neither is the TCDS: the TCDS (3A12) gives travel, not areas' } },
  // CESSNA 172 ON WIPLINE 2350 FLOATS. The water figures do NOT say the weight, the engine or the prop. GATE HYDROTRIM's
  // brief: ~300-450 m, 20-35 s (Wipaire ~335-365 m for 160-180 hp 172s); Wipaire's 2350 page lists 1645 ft / 50 ft
  // 2463 ft and 749 fpm for "the 172" (configuration unstated). Both kept: the band runs 335-501 m.
  c172f: {
    name: 'Cessna 172 on Wipline 2350 floats (160-180 hp)', mtow: 1157, empty: 736 + 150, fuelL: 212, S: 16.2, powerHP: 160,
    src: 'GATE HYDROTRIM brief (Wipaire ~335-365 m, 20-35 s, 160-180 hp); wipaire.com 2350 tag page (search extract): water run 1645 ft, over 50 ft 2463 ft, ROC 749 fpm, configuration unstated; STC gross 1157 kg (G3390)',
    poh: { vr: 1.00, vy: 1.50, flapTO: 20, flapLDG: 30, brake: 0, note: 'the floatplane supplement: flaps 20, the stick back through the hump, lift-off ~50 KIAS' },
    rows: {
      Vs1:  { v: 51 * KT, tol: 0.05, kg: 'gross', flaps: 'up', src: 'the landplane 51 KCAS (floats add ~nothing to CLmax)' },
      roc:  { v: [660 * FPM, 749 * FPM], tol: 0.05, kg: 'unknown', src: 'Wipaire 749 fpm; 660 fpm on another Wipaire page' },
      TOW:  { v: [335, 501], tol: 0.05, kg: 'unknown', surface: 'water', src: 'Wipaire ~335-365 m (160-180 hp) to 1645 ft (unstated)' },
      TOWs: { v: [20, 35], tol: 0.05, kg: 'unknown', surface: 'water', src: 'HYDROTRIM brief 20-35 s' },
      TOW50: { v: 2463 * FT, tol: 0.10, kg: 'unknown', surface: 'water', src: 'Wipaire 2463 ft (unstated)' },
    } },
  // PIPER PA-18 SUPER CUB ON FLOATS - Wipaire's PA-18/PA-12 guide, Wipline 2100 AMPHIBIANS, O-320 160 hp: two columns,
  // the standard gross (1776 lb with the floats) and the 2000 lb kit. The build is an O-320 150 hp on EDO-style floats
  // (the 150 hp row is the registry's): engine within 7 %, float type differs (seaplane vs amphibian: ~150 lb lighter).
  pa18f: {
    name: 'Piper PA-18 Super Cub on floats (O-320)', mtow: 806, empty: 520, fuelL: 136, S: 16.6, powerHP: 160,
    src: 'Wipaire PA-18/PA-12 Product & Modification Guide (Wipline 2100 amphibian, O-320 160 hp): gross 1776 lb: TO run land 588 ft, water 776 ft, over 50 ft water 1294 ft, ROC 925 fpm; at 2000 lb: water 1174 ft, 50 ft 1956 ft, ROC 756 fpm',
    poh: { vr: 1.00, vy: 1.35, flapTO: 15, flapLDG: 30, brake: 0, note: 'PA-18 on floats: half flap off the water' },
    rows: {
      Vs1:  { v: 43 * MPH, tol: 0.05, kg: 'gross', flaps: 'up', src: 'PA-18-150 landplane 43 mph flaps up (Piper sheet)' },
      roc:  { v: 925 * FPM, tol: 0.05, kg: 806, src: 'Wipaire 925 fpm at 1776 lb (amphibian, 160 hp)' },
      roc2: { v: 756 * FPM, tol: 0.05, kg: 907, key: 'roc', src: 'Wipaire 756 fpm at 2000 lb' },
      TOW:  { v: 776 * FT, tol: 0.05, kg: 806, surface: 'water', src: 'Wipaire 776 ft at 1776 lb' },
      TOW2: { v: 1174 * FT, tol: 0.05, kg: 907, key: 'TOW', surface: 'water', src: 'Wipaire 1174 ft at 2000 lb' },
      TOW50: { v: 1294 * FT, tol: 0.05, kg: 806, surface: 'water', src: 'Wipaire 1294 ft at 1776 lb' },
    } },
  // EDRA / SCODA SUPER PETREL LS (912 iS). Brochure figures - the maker's own and the web summaries disagree on the
  // stall (56 km/h Wikipedia / 37 kt = 68 km/h maker) and quote 1000-1400 fpm: all solo-ish (HULL-B76 found the stall
  // and climb meet at 475 kg, one aboard, half fuel). No flaps on a Petrel.
  petrel: {
    name: 'Super Petrel LS (Rotax 912 iS)', mtow: 600, empty: 320, fuelL: 90, S: 15.0, powerHP: 100,
    src: 'maker / Wikipedia EDRA Super Petrel / pilotmix: 320 / 600 kg, stall 56 km/h (Wikipedia) or 37 kt (maker), cruise ~86 kt, VH ~97 kt, climb 1000-1400 fpm, take-off run land 80 m, water 120 m (Wikipedia; a review: water < 400 ft, hard surface 260 ft)',
    poh: { vr: 1.10, vy: 1.35, flapTO: 0, flapLDG: 0, brake: 0.6, note: 'no flaps' },
    rows: {
      empty: { v: 320, tol: 0.05, src: '320 kg (315 one source, 775 lb a review "as equipped")' },
      Vs1:   { v: [56, 68], tol: 0.03, kg: 'unknown', flaps: 'up', src: '56 km/h (Wikipedia) to 37 kt (maker)' },
      V75:   { v: 86 * KT, tol: 0.05, kg: 'unknown', src: 'cruise ~86 kt' },
      Vmax:  { v: 97 * KT, tol: 0.05, kg: 'unknown', src: 'VH ~97 kt' },
      roc:   { v: [1000 * FPM, 1400 * FPM], tol: 0.03, kg: 'unknown', src: '1000-1400 fpm' },
      TO:    { v: [80, 260 * FT], tol: 0.05, kg: 'unknown', flaps: 0, surface: 'paved', src: 'land run 80 m (Wikipedia), 260 ft (review)' },
      TOW:   { v: [120, 400 * FT], tol: 0.05, kg: 'unknown', surface: 'water', src: 'water run 120 m (Wikipedia), < 400 ft (review)' },
    } },
  // CHINOOK PLUS 2 (582) - an ultralight sheet, flown one-up (perf_study REAL.chinook's ruling)
  chinook: {
    name: 'Chinook Plus 2 (Rotax 582)', mtow: 476, empty: 209, fuelL: 38, S: 14.35,
    src: 'ASAP Chinook Plus 2 sheet / pilotmix (perf_study REAL.chinook): stall 35 mph, cruise 83 mph, max 95, 1200 fpm, TO 200 ft, ldg 300 ft',
    poh: { vr: 1.15, vy: 1.35, flapTO: 0, flapLDG: 0, brake: 0.6 },
    rows: {
      empty: { v: [380 * LB, 460 * LB], tol: 0.03, src: '380 lb (503) - 460 lb (582, pilotmix) empty' },
      Vs1:   { v: 35 * MPH, tol: 0.05, kg: 'unknown', flaps: 'up', src: '35 mph (32 with flaperons)' },
      V75:   { v: [72 * MPH, 83 * MPH], tol: 0.05, kg: 'unknown', src: 'cruise 72-83 mph' },
      Vmax:  { v: 95 * MPH, tol: 0.05, kg: 'unknown', src: '95 mph' },
      roc:   { v: [1000 * FPM, 1200 * FPM], tol: 0.05, kg: 'unknown', src: '1000 / 1200 fpm' },
      LD:    { v: 10, tol: 0.10, kg: 'unknown', src: '10:1' },
      TO:    { v: [200 * FT, 250 * FT], tol: 0.05, kg: 'unknown', flaps: 0, surface: 'grass', src: '200 / 250 ft' },
      LDG:   { v: 300 * FT, tol: 0.10, kg: 'unknown', flaps: 0, surface: 'grass', src: '300 ft' },
    } },
};

// ---------------------------------------------------------------------------------------------------------------------
// THE PLANES real_check flies. `file`: the build, loaded through the load door (_load_build.js); `card`: an archetype
// card (designBake -> the load door's birth envelope). `ref`: the REFS row. `water`: it takes off from water.
// `official`: on builds/lists/plane_lists.json's official list. `engineNote`: when the build's engine is not the type's.
// ---------------------------------------------------------------------------------------------------------------------
const PLANES = {
  cub:      { label: 'Piper Cub (official)', file: 'builds/cub_2026-09-20_corrected.json', ref: 'cub', official: true },
  jodel:    { label: 'Jodel D112 (official)', file: 'builds/jodel_2026-09-20_corrected.json', ref: 'd112', official: true },
  cessna:   { label: 'Metal Cessna B-CESS (official)', file: 'builds/cessna172_2026-09-20.json', ref: 'c172r', official: true,
              engineNote: 'the build flies an O-540 235 hp (the type: IO-360 160 hp) on an 18.4 m2 wing (16.2): power-bound rows are not like for like', cgSweep: true },
  cessnaF:  { label: 'Metal Cessna on floats (official)', file: 'builds/cessna172_floats_2026-11.json', ref: 'c172f', official: true, water: true,
              engineNote: 'O-540 235 hp against the 160-180 hp the references cover' },
  pa18f:    { label: 'PA-18 on floats (official)', file: 'builds/pa18_floats_2026-10-23.json', ref: 'pa18f', official: true, water: true,
              engineNote: 'O-320 150 hp against Wipaire\'s 160 hp; EDO-style seaplane floats against Wipline amphibians' },
  petrel:   { label: 'Super Petrel V4.1 (claude/hull-types)', file: 'builds/candidates/superpetrel_V4_1.json', ref: 'petrel', water: true, land: true,
              branch: 'claude/hull-types', note: 'not on master: run from a worktree of claude/hull-types (its core, its rows)' },
  chinook:  { label: 'Chinook (official, out of the battery)', file: 'builds/chinook_2026-09-21_corrected.json', ref: 'chinook', official: true },
  c172x:    { label: 'Cessna 172 (corrected, internal)', file: 'builds/cessna172_2026-09-20_corrected.json', ref: 'c172r',
              note: 'the 20 Sep corrected 172 (IO-360 dials, 16.5 m2): the like-for-like 172R comparison the official B-CESS cannot be' },
  // CESSNA-FINAL (FLAGSHIP, 8 Nov): the corrected 172 + seven build rows - the lowered aft roof, 212 L at the wing root,
  // the DRAWN stab to the 172R's 3.40 m / 3.30 m2 (stSpan 1.19 -> 1.264: the join measures the drawing, spec.tail does not
  // survive a load), 'standard' seats, the 'full' trim (a 172 as delivered), V2-172. No generator change yet (Part 2)
  c172v2:   { label: 'Cessna 172 V2-172 (land, build rows)', short: 'Cessna 172 V2-172', file: 'builds/cessna172r_2026-11-08.json', ref: 'c172r',
              note: 'CESSNA-FINAL step 2: the corrected 172 on build rows only; the empty CG still aft (the aluminium generator\'s A1)' },
};

// ---------------------------------------------------------------------------------------------------------------------
// THE HISTORY: every plane ever compared to its real figures, with the numbers measured then (ours / theirs as printed
// in the source), the date, the build and the report. `alive`: the build still exists and real_check can re-run it.
// Units: kg, km/h, m/s, m. `flown` = the game's pilot (the circuit); everything else the bench's probes.
// ---------------------------------------------------------------------------------------------------------------------
const HISTORY = [
  // PERF-STUDY 2026-09-15 §2 (birth spec, before the four chantiers) and §6 (joined, after G428-G431): the 12 cards
  ...[
    ['cub',       'Piper J-3C-65 Cub',      [331, 70, 126, 146, 2.3, 8.9, 224], [354, 65, 126, 145, 2.4, 9.4, 122], 'card (archetype)', 'yes (card; the official Cub is a build since 20 Sep)'],
    ['pietenpol', 'Pietenpol Air Camper',   [326, 71, 123, 144, 2.5, 8.0, 230], [339, 68, 143, 162, 3.2, 9.2, 131], 'card', 'card only if the archetype still exists'],
    ['tigermoth', 'DH.82 Tiger Moth',       [506, 70, null, 114, 0.3, 8.3, 389], [574, 69, 146, 170, 3.0, 8.7, 144], 'card', 'card; a REF_MATCH build in candidates (tigermoth_2026-10)'],
    ['stearman',  'Boeing-Stearman PT-17',  [786, 77, 230, 256, 11.0, 8.7, 80], [894, 77, 158, 183, 3.7, 7.9, 150], 'card', 'card; a REF_MATCH build in candidates (stearman_2026-10)'],
    ['d119',      'Jodel D.119 (card "jodel" until G445.4)', [374, 84, 154, 177, 3.3, 9.3, 248], [348, 84, 182, 203, 4.4, 11.4, 154], 'card', 'no: the card is the D.112 since G445.4'],
    ['c172',      'Cessna 172R',            [412, 94, 181, 207, 4.0, 9.3, 247], [640, 95, 203, 230, 4.0, 11.0, 222], 'card', 'card'],
    ['caravan',   'Cessna 208 Caravan',     [558, 94, 282, 304, 17.2, 11.3, 90], [1179, 143, 282, 308, 5.6, 12.3, 470], 'card', 'card'],
    ['rv',        "Van's RV-7",             [435, 94, 194, 218, 5.7, 9.3, 187], [484, 93, 240, 263, 7.3, 12.5, 188], 'card', 'card'],
    ['savannah',  'ICP Savannah S',         [302, 77, 131, 156, 2.2, 8.2, 238], [370, 77, 144, 166, 2.7, 8.7, 172], 'card', 'card'],
    ['mw5',       'Whittaker MW5',          [283, 61, 110, 128, 3.0, 7.0, 87], [213, 55, 100, 116, 3.2, 6.7, 67], 'card', 'card'],
    ['da62',      'Diamond DA62 (engine differs)', [652, 98, 233, 256, 9.8, 10.9, 139], [973, 129, 237, 264, 4.2, 12.1, 425], 'card', 'card'],
    ['beaver',    'DHC-2 Beaver',           [660, 77, 246, 271, 11.8, 11.3, 87], [1115, 115, 238, 267, 5.2, 11.0, 444], 'card', 'card'],
  ].map(([key, name, a, b, build, alive]) => ({ key, name, date: '2026-09-15', src: 'reports/PERF-STUDY-2026-09-15.md §2 (birth) / §6 (joined, after G428-G431)', build, alive,
          then: { empty: a[0], Vs1: a[1], V75: a[2], Vmax: a[3], roc: a[4], LD: a[5], TO: a[6] },
          after: { empty: b[0], Vs1: b[1], V75: b[2], Vmax: b[3], roc: b[4], LD: b[5], TO: b[6] } })),
  { key: 'cub', name: 'Piper Cub, the user\'s NewCub corrected', date: '2026-09-20', build: 'builds/cub_2026-09-20_corrected.json', alive: 'yes - the official Cub',
    src: 'reports/CUB-STUDY-2026-09-20.md (+ .corrected.txt)', ref: 'J-3C-65 at MTOW 550 kg',
    then: { empty: 352, Vs1: 62, V75: 126, Vmax: 145, roc: 2.5, LD: 9.6, CdS: 0.80, TO: 106, TO50: 160, T0: 1215 },
    flown: { TO: 145, climb: 2.1, LDG: 170, cruise: '113 at thr 0.71' } },
  { key: 'cub', name: 'Piper Cub (accuracy sheet)', date: '2026-09-21', build: 'builds/cub_2026-09-20_corrected.json', alive: 'yes', src: 'reports/ACCURACY-SHEET-2026-09-21.html',
    then: { empty: 354, S: 17.6, Vs1: 62, V75: 123, Vmax: 142, roc: 2.4, LD: 9.4, T0: 1215, TO: 118 }, flown: { TO: 144, climb: 1.9, LDG: 79 }, balance: 'CG 23 %, NP 40 %' },
  { key: 'jodel', name: 'Jodel D.112, the user\'s Jodel1050v1 corrected', date: '2026-09-20', build: 'builds/jodel_2026-09-20_corrected.json', alive: 'yes - the official Jodel',
    src: 'reports/JODEL-STUDY-2026-09-20.md', ref: 'D.112 at MTOW 530 kg (Vs1 then 56)',
    then: { empty: 338, S: 13.8, Vs1: 72, V75: 134, Vmax: 160, roc: 2.0, LD: 9.0, CdS: 0.55, TO: 197, TO50: 272 },
    flown: { TO: 287, climb: 1.6, LDG: 87, cruise: '124 at thr 0.82' }, balance: 'CG 34 %, SM 2 % (G445.7-8: 29 %, 7 %)' },
  { key: 'jodel', name: 'Jodel D.112 (accuracy sheet)', date: '2026-09-21', build: 'builds/jodel_2026-09-20_corrected.json', alive: 'yes', src: 'reports/ACCURACY-SHEET-2026-09-21.html',
    then: { empty: 341, S: 13.8, Vs1: 72, V75: 134, Vmax: 159, roc: 2.0, LD: 9.0, T0: 1039, TO: 183 }, flown: { TO: 262, climb: 1.4, LDG: 243 }, balance: 'CG 27 %, NP 31 %' },
  { key: 'c172x', name: 'Cessna 172, the user\'s build corrected (IO-360 dials, 159 hp)', date: '2026-09-20', build: 'builds/cessna172_2026-09-20_corrected.json', alive: 'yes - internal ("retired, kept for the gates")',
    src: 'reports/C172-STUDY-2026-09-20.md §1.1', ref: '172R at MTOW 1111 kg',
    then: { empty: 664, S: 16.5, Vs1: 93, V75: 193, Vmax: 220, roc: 3.3, LD: 11.1, CdS: 0.56, TO: 301, TO50: 410 },
    flown: { TO: 428, climb: 2.5, LDG: 227, cruise: '180 at thr 0.83' } },
  { key: 'cessna', name: 'Cessna 172, the user\'s build AS FOUND (= the official B-CESS file), on the io360 row', date: '2026-09-20', build: 'builds/cessna172_2026-09-20.json (engine swapped to io360_mccauley for the run)', alive: 'yes - the official Metal Cessna (on its own O-540)',
    src: 'reports/C172-STUDY-2026-09-20.md §1.1', ref: '172R at MTOW 1111 kg',
    then: { empty: 632, S: 18.4, Vs1: 89, V75: 194, Vmax: 219, roc: 4.0, LD: 10.4, CdS: 0.65, TO: 215, TO50: 305 },
    flown: { TO: 266, climb: 3.2, LDG: 384, cruise: '173 at thr 0.73' }, note: 'as saved (O-540 235 hp): ROC 6.8 (shakedown), TO 150 (shakedown)' },
  { key: 'c172x', name: 'Cessna 172R (accuracy sheet: the corrected build)', date: '2026-09-21', build: 'builds/cessna172_2026-09-20_corrected.json', alive: 'yes', src: 'reports/ACCURACY-SHEET-2026-09-21.html',
    then: { empty: 641, S: 16.5, Vs1: 93, V75: 194, Vmax: 221, roc: 3.3, LD: 11.2, T0: 2198, TO: 264, TO50: 370 }, flown: { TO: 308, climb: 2.5, LDG: 206 }, balance: 'CG 35 %, NP 56 %' },
  { key: 'chinook', name: 'Chinook Plus 2, the user\'s birdman corrected', date: '2026-09-21', build: 'builds/chinook_2026-09-21_corrected.json', alive: 'yes - official, out of the battery',
    src: 'reports/CHINOOK-STUDY-2026-09-21.md §1 (at MTOW) + ACCURACY-SHEET (at the sheet\'s 340 kg)',
    then: { empty: 219, S: 13.1, Vs1: 58, V75: 125, Vmax: 140, roc: 5.0, LD: 7.7, T0: 1324, TO: 52 }, flown: { TO: 101, climb: 2.5, LDG: 74 } },
  { key: 'c172f', name: 'Cessna 172R on Wipline 2350 (STC prop, 1157 kg) - water', date: '2026-10-20', build: 'builds/c172r_wipline2350_stcprop_2026-10-20.json', alive: 'yes (GATE HYDROTRIM\'s)',
    src: 'HANDOVER G3440-G3443 (HYDRO-TRIM), hydro_trim_table.js', then: { TOWs: 30.7, TOW: 442 }, note: 'POH technique; the rig technique 38.8 s / 687 m; the game\'s pilot (float Cessna, cessnaFloatsWOrks) lifts at 22.3 s' },
  { key: 'pa18f', name: 'PA-18 on floats - water', date: '2026-11-03', build: 'builds/pa18_floats_2026-10-23.json (753 kg)', alive: 'yes - official',
    src: 'reports/evidence/FLOATS-CLASSIC/water_runs_node.txt', then: { TOWs: 22.6, TOW: 235 }, note: 'the game\'s pilot, EDO-classic and Wipline styles alike (235 / 236 m); no reference was set then' },
  { key: 'petrel', name: 'Super Petrel B54 (flying boat, no wheels)', date: '2026-11-06', build: 'builds/candidates/superpetrel_V0.json (= b54) on claude/hull-types', alive: 'on claude/hull-types',
    src: 'claude/hull-types reports/PETREL-STUDY-2026-11-06.md', ref: 'at 600 kg',
    then: { empty: 338, S: 14.5, Vs1: 75, V75: 162, Vmax: 184, roc: 3.9, LD: 9.7, CdS: 0.61 }, water: { TOWs: 25.1 } },
  { key: 'petrel', name: 'Super Petrel V2 solo, half fuel (475 kg)', date: '2026-11-06', build: 'V2 card (HULL-B76)', alive: 'on claude/hull-types',
    src: 'claude/hull-types HANDOVER HULL-B76', then: { Vs1: 67, V75: 166, Vmax: 186, roc: 5.5, TO: 74 }, flown: { TO: 119, climb: 4.1, LDG: 290 } },
  { key: 'petrel', name: 'Super Petrel V3 / V4 / V4.1 at gross', date: '2026-11-07', build: 'superpetrel_V3 / V4 / V4_1.json', alive: 'on claude/hull-types (V4.1 the final)',
    src: 'claude/hull-types HANDOVER HULL-B80', then: { empty: '373 / 380 / 380', roc: '3.9 / 4.0 / 4.0', V75: '161 / 164 / 164', Vmax: '183 / 186 / 186', CdS: '0.62 / 0.59 / 0.59', LD: '9.7 / 9.9 / 9.9' },
    flown: { TO: '180 / 183 / 182', climb: '2.7 / 2.7 / 2.9', LDG: '258 / 368 / 363' }, water: { TOWs: '25.7 / 26.6 / 26.3' } },
];

module.exports = { REFS, PLANES, HISTORY, KT, MPH, FPM, FT, LB };
