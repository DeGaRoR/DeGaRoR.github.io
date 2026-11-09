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
      empty: { v: [721, 744], tol: 0.02, src: 'standard empty 1590-1639 lb (Plane & Pilot / spec summaries; the 7 Nov row\'s 736 kg = 1623 lb sits inside)' },
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
    // THE BALANCE (CESSNA-FINAL 8 Nov; data, not scored): the POH's envelope in inches aft of the firewall (section 2:
    // forward 35.0 in at 1950 lb or less to 40.0 at 2450 lb, aft 47.3 at all weights - a manualslib copy, via a search
    // extract) on the TCDS 3A12 MAC (58.8 in from 25.9 in: a forum's citation, THIN) = 24.0-36.4 % MAC at 2450 lb,
    // 15.5-36.4 % at 1950 lb. (A typical weighed 172R's empty arm, ~39-40 in = ~23 % MAC, is an ESTIMATE, not a row.)
    cg: { fwdIn: [[1950, 35.0], [2450, 40.0]], aftIn: 47.3, macIn: 58.8, lemacIn: 25.9, atGrossMAC: [24.0, 36.4],
          src: 'POH section 2 (manualslib copy, search extract) + the TCDS 3A12 MAC via a forum citation (thin)' },
    // THE TAIL (CESSNA-TAIL): what the real 172 carries, for the question "is the official Cessna's stab 20-25 % small"
    tail: { Sh: [3.30, 3.35], hSpan: 3.40, elevFrac: 0.44, Sv: 1.6,
            src: 'C172-STUDY 2026-09-20 type sheet: stab span 11 ft 4 in, horizontal tail 35.7 ft2 with 15.7 ft2 of elevator (0.44); a design analysis (pdfcoffee "Cessna 172 Design") gives 21.56 ft2 stabilizer + 14.53 ft2 elevators = 36.1 ft2 (3.35 m2). Neither is the TCDS: the TCDS (3A12) gives travel, not areas' } },
  // CESSNA 172 ON WIPLINE 2350 FLOATS. The water figures do NOT say the weight, the engine or the prop. GATE HYDROTRIM's
  // brief: ~300-450 m, 20-35 s (Wipaire ~335-365 m for 160-180 hp 172s); Wipaire's 2350 page lists 1645 ft / 50 ft
  // 2463 ft and 749 fpm for "the 172" (configuration unstated). Both kept: the band runs 335-501 m.
  c172f: {
    // (CESSNA-FINAL 8 Nov, FLAGSHIP: the weights re-read off WIPAIRE'S OWN Cessna 172 Skyhawk Product & Modification Guide
    // (wipaire.com, rev 1/18; flydiy-notes evidence 2026-11-08/flagship/cessna-final/): the 172R / S on Wipline 2350s at
    // 2,550 lb (1,157 kg) on its stock engine and the McCauley 1A200/WFA8243 (82 x 43 in); the seaplane system 305 lb
    // (138 kg), its EXCHANGE weight 168 lb (76 kg: the float installation less the land gear) - so the empty weight is
    // the 172R's 721-744 kg + 76 = 797-820 kg (it was 736 + 150, an estimate). The guide has NO performance table: the
    // water figures stay the 2350 web page's, configuration unstated)
    name: 'Cessna 172R/S on Wipline 2350 floats (stock engine, McCauley 82 x 43)', mtow: 1157, empty: 736 + 76, fuelL: 212, S: 16.2, powerHP: 160,
    src: 'Wipaire Cessna 172 Product & Modification Guide rev 1/18 (172R, S: 2,550 lb / 1,157 kg, stock engine, McCauley 1A200/WFA8243; seaplane system 305 lb / 138 kg, exchange 168 lb / 76 kg; float 19 ft 7 in x 2 ft 5 in x 1 ft 11 in, 2,570 lb displacement a float); water figures: wipaire.com 2350 tag page (search extract): water run 1645 ft, over 50 ft 2463 ft, ROC 749 fpm, configuration unstated; GATE HYDROTRIM brief 20-35 s',
    poh: { vr: 1.00, vy: 1.50, flapTO: 20, flapLDG: 30, brake: 0, note: 'the floatplane supplement: flaps 20, the stick back through the hump, lift-off ~50 KIAS' },
    rows: {
      empty: { v: [721 + 76, 744 + 76], tol: 0.02, src: 'the 172R standard empty 721-744 kg + Wipaire\'s seaplane exchange weight 76 kg (168 lb; the guide rev 1/18)' },
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
// MORE REAL AEROPLANES (REAL-FIGURES-2, 2026-11-08): the planes with a clear real parent in the game. Where a figure is
// THIN (one source, or sources that disagree by more than the band) its src says so and it carries a wide tol or range.
// ---------------------------------------------------------------------------------------------------------------------
Object.assign(REFS, {
  // DOUGLAS DC-3A (2 x P&W R-1830 1200 hp). Figures vary by variant (DC-3 / DC-3A / C-47 / DC-3C): the DC-3A is taken.
  // The top speed is quoted at altitude (230 mph at 8500 ft); a sea-level figure is not published: the band runs from
  // the 215 mph some sheets quote to the altitude figure. No stall or field figures found that state their conditions.
  dc3: {
    name: 'Douglas DC-3A (2 x P&W R-1830 1200 hp)', mtow: 11431, empty: 7650, fuelL: 3111, S: 91.7, powerHP: 2400,
    src: 'aero-web DC-3C / aeropedia / airlines-inform (search extracts): 95 ft span, 64 ft 5-8 in, 16 ft 11 in, 987 ft2, 16 865 lb empty, 25 200 lb gross (DC-3A), max 215-229 mph, cruise 194-207 mph, ~1100 fpm; THIN on the conditions (altitude, weight)',
    poh: { vr: 1.15, vy: 1.40, flapTO: 0, flapLDG: 30, brake: 0.6, note: 'a heavy taildragger; flaps up for the take-off (C-47 practice), 1/4-1/2 flap is also used' },
    rows: {
      empty: { v: [7650, 8300], tol: 0.03, src: '16 865 lb (DC-3A) to 18 300 lb (DC-3C)' },
      V75:   { v: [194 * MPH, 207 * MPH], tol: 0.05, kg: 'unknown', src: 'cruise 194-207 mph, altitude unstated (THIN)' },
      Vmax:  { v: [215 * MPH, 230 * MPH], tol: 0.05, kg: 'gross', src: '215 mph (some sheets) to 230 mph at 8500 ft (THIN: no sea-level figure)' },
      roc:   { v: [1100 * FPM, 1130 * FPM], tol: 0.05, kg: 'gross', src: '~1100-1130 fpm' },
    } },
  // SOPWITH CAMEL F.1 (Clerget 9B 130 hp). Weights and dimensions agree across sources; the speed is one database's
  // (185 km/h) and the climb is not found stated as a rate: no climb row.
  camel: {
    name: 'Sopwith Camel F.1 (Clerget 9B 130 hp)', mtow: 659, empty: 421, fuelL: 140, S: 21.46, powerHP: 130,
    src: 'historyofwar / aeropedia / flugzeuginfo (search extracts): 28 ft span, 18 ft 9 in, 8 ft 6 in, 231 ft2, 929 lb empty, 1453 lb loaded, max 185 km/h (one source, THIN)',
    poh: { vr: 1.10, vy: 1.30, flapTO: 0, flapLDG: 0, brake: 0, note: 'no flaps, no brakes on a Camel (the build may have them)' },
    rows: {
      empty: { v: 421, tol: 0.03, src: '929 lb' },
      Vmax:  { v: [182, 185], tol: 0.05, kg: 'gross', src: '185 km/h (flugzeuginfo; THIN) / 113 mph' },
    } },
  // DE HAVILLAND DH.82A TIGER MOTH (Gipsy Major I 130 hp). Shuttleworth / aeropedia agree; the climb and the stall are
  // perf_study REAL.tigermoth's (type data), THIN.
  tigermoth: {
    name: 'de Havilland DH.82A Tiger Moth (Gipsy Major 130 hp)', mtow: 828, empty: 506, fuelL: 86, S: 22.2, powerHP: 130,
    src: 'Shuttleworth Collection / aeropedia / de Havilland Museum (search extracts): 29 ft 4 in span, 23 ft 11 in, 8 ft 9 in, 239 ft2, 1115 lb empty, 1825 lb gross, max 107-109 mph at SL; climb 635-673 fpm and stall 45 mph from type data (perf_study REAL.tigermoth, THIN)',
    poh: { vr: 1.10, vy: 1.30, flapTO: 0, flapLDG: 0, brake: 0, note: 'no flaps, no brakes (a tailskid)' },
    rows: {
      empty: { v: 506, tol: 0.03, src: '1115 lb' },
      Vs1:   { v: 45 * MPH, tol: 0.08, kg: 'unknown', flaps: 'up', src: '45 mph (type data, THIN)' },
      V75:   { v: [90 * MPH, 93 * MPH], tol: 0.05, kg: 'unknown', src: 'cruise 90-93 mph (type data, THIN)' },
      Vmax:  { v: [107 * MPH, 109 * MPH], tol: 0.05, kg: 'gross', src: '107 mph (Shuttleworth) / 109 mph at SL (aeropedia)' },
      roc:   { v: [635 * FPM, 673 * FPM], tol: 0.05, kg: 'gross', src: '635-673 fpm (type data, THIN)' },
    } },
  // BOEING-STEARMAN PT-17 (Continental R-670-5 220 hp; the build's W-670 is the same engine's civil designation)
  stearman: {
    name: 'Boeing-Stearman PT-17 (Continental R-670 220 hp)', mtow: 1195, empty: 876, fuelL: 174, S: 27.6, powerHP: 220,
    src: 'globalair / tillamookair / historyofwar (search extracts): 32 ft 2 in span, 24 ft 3 in - 24 ft 9 in, 9 ft 2 in - 9 ft 8 in, 297-298 ft2, 1931-1936 lb empty, 2635-2717 lb gross, max 124 (135 one source) mph, cruise 96-106 mph, 840 fpm; stall 55 mph (perf_study REAL.stearman, THIN)',
    poh: { vr: 1.10, vy: 1.30, flapTO: 0, flapLDG: 0, brake: 0.6, note: 'no flaps' },
    rows: {
      empty: { v: [876, 878], tol: 0.03, src: '1931-1936 lb' },
      Vs1:   { v: 55 * MPH, tol: 0.08, kg: 'unknown', flaps: 'up', src: '55 mph (type data, THIN)' },
      V75:   { v: [96 * MPH, 106 * MPH], tol: 0.05, kg: 'unknown', src: 'cruise 96-106 mph' },
      Vmax:  { v: [124 * MPH, 135 * MPH], tol: 0.05, kg: 'gross', src: '124 mph (most) / 135 mph (one)' },
      roc:   { v: 840 * FPM, tol: 0.05, kg: 'gross', src: '840 fpm' },
    } },
  // CESSNA 337 SKYMASTER (2 x Continental IO-360 210 hp). THE GAME'S SKYMASTER-ALIKE IS AN ENGINE-CONFIGURATION ARCHETYPE
  // NEVER HAND-AUTHORED to the type: a light check, a few figures; it is not expected to match.
  skymaster: {
    name: 'Cessna 337 Skymaster (2 x IO-360 210 hp)', mtow: 2100, empty: 1204, fuelL: 352, S: 18.8, powerHP: 420,
    src: 'all-aero CE-337 / findaircraft / globalair (search extracts): 38 ft span, 29 ft 9 in, 201-202.5 ft2, 2615-2787 lb empty, 4400-4700 lb gross, max 172 kt (conditions unstated), 940 fpm, stall 57 kt clean, 1435 ft over 50 ft (337/337A); LIGHT CHECK',
    poh: { vr: 1.10, vy: 1.40, flapTO: 0, flapLDG: 30, brake: 0.8 },
    rows: {
      empty: { v: [1186, 1264], tol: 0.03, src: '2615-2787 lb' },
      Vs1:   { v: 57 * KT, tol: 0.05, kg: 'gross', flaps: 'up', src: '57 kt clean' },
      Vmax:  { v: 172 * KT, tol: 0.08, kg: 'gross', src: '172 kt (conditions unstated)' },
      roc:   { v: 940 * FPM, tol: 0.05, kg: 'gross', src: '940 fpm' },
      TO50:  { v: 1435 * FT, tol: 0.10, kg: 'gross', surface: 'paved', src: '1435 ft over 50 ft (337/337A)' },
    } },
});

// CUBCRAFTERS CC11-160 CARBON CUB SS (REAL-FIGURES-3, 2026-11-09, A0 for the user: "the STOL Cub against a real Carbon
// Cub"). The closest Carbon Cub with published figures: the light-sport model, 1320 lb gross, the CC340 180 hp (full
// power 5 min, cruise limited to 80 hp by its POH). The Rotax model (the Carbon Cub UL, 916 iS 160 hp, 600-700 kg) has no
// published performance; the EX-3 / FX-3 are 2000 lb, 186 hp aeroplanes. Every figure is a brochure / review figure:
// no weight, surface or flap stated -> weight 'unknown' (a band), THIN where one source.
Object.assign(REFS, {
  carboncub: {
    name: 'CubCrafters Carbon Cub SS (CC340 180 hp)', mtow: 599, empty: 408, fuelL: 91, S: 16.6, powerHP: 180,
    src: 'Plane & Pilot "Carbon Cub SS" (1320 lb gross, 900 lb empty, 24 gal, 2100 fpm, stall 31 mph, cruise 105-110 mph); AOPA "Light-sport brute" 2010 (1320 lb, cruise 80 hp per the POH, full power 5 min); Wikipedia CC11-160 (stall 27 kt full flap out of ground effect, 35 kt flaps up; cruise 104 kt); aeropedia (take-off roll 60 ft, landing roll 245 ft - THIN, the same figures are listed for the EX2); AvPay (climb 1500 fpm)',
    poh: { vr: 1.0, vy: 1.30, flapTO: 50, flapLDG: 45, brake: 0.8, runup: true, stopShort: true, note: 'the STOL take-off (the user, 9 Nov): full flap, the brakes held and the stick full back while the engine comes up to its full rpm (the power eased if the tail lifts), then go; full flap for the landing and the tailwheel short-field stop (FAA-H-8083-3C ch. 14: held three-point, the brakes evenly and firmly from the touchdown, the stick full back; the flaps stay down)' },
    rows: {
      empty: { v: 408, tol: 0.05, src: '900 lb (Plane & Pilot)' },
      Vs1:   { v: 35 * KT, tol: 0.05, kg: 'unknown', flaps: 'up', src: '35 kt flaps up (Wikipedia, THIN)' },
      V75:   { v: [104 * KT, 110 * MPH], tol: 0.05, kg: 'unknown', src: 'cruise 105-110 mph (Plane & Pilot) / 104 kt (Wikipedia); NOTE the POH cruise is power-limited to 80 hp' },
      roc:   { v: [1500 * FPM, 2100 * FPM], tol: 0.05, kg: 'unknown', src: '2100 fpm (CubCrafters via Plane & Pilot), 1500 fpm (AvPay)' },
      TO:    { v: 60 * FT, tol: 0.15, kg: 'unknown', flaps: 'unknown', surface: 'unknown', src: '60 ft (aeropedia; THIN - also listed for the EX2)' },
      LDG:   { v: 245 * FT, tol: 0.15, kg: 'unknown', flaps: 'unknown', surface: 'unknown', src: '245 ft (aeropedia; THIN)' },
    } },
});

// ---------------------------------------------------------------------------------------------------------------------
// GEOMETRY AND SPECS OF THE REAL AEROPLANES (REAL-FIGURES-2): what the report's two other axes compare.
//   dims:  span, length, height, S (m2), cRoot, cTip, hSpan (stab span), Sh / Sv (tail areas), track (m) - a value or
//          [lo, hi]; absent = not known (never guessed). `lengthNote` when the type's length runs spinner to rudder.
//   specs: engine (name), hp (per engine), nE, propD (m), blades, empty, mtow (kg), fuelL, seats
// ---------------------------------------------------------------------------------------------------------------------
const GEO = {
  cub:      { dims: { span: 10.74, length: 6.83, height: 2.03, S: 16.6, cRoot: 1.60, cTip: 1.60, hSpan: 2.90, track: 1.83 },
              specs: { engine: 'Continental A-65', hp: 65, nE: 1, propD: 1.83, blades: 2, empty: 345, mtow: 550, fuelL: 45, seats: 2 },
              src: 'J-3 type sheet (perf_study REAL.cub.dims)' },
  d112:     { dims: { span: 8.20, length: 6.20, height: 2.07, S: 12.7, cRoot: 1.72, cTip: 1.20, hSpan: 2.74 },
              specs: { engine: 'Continental A-65', hp: 65, nE: 1, propD: 1.83, blades: 2, empty: 320, mtow: 530, fuelL: 45, seats: 2 },
              src: 'D.112 type sheet; height and stab span off the d112 reference payload (perf_study REAL.d112.dims)' },
  c172r:    { dims: { span: 11.0, length: 8.28, height: 2.72, S: 16.2, cRoot: 1.63, cTip: 1.12, hSpan: 3.40, Sh: [3.30, 3.35], Sv: 1.6, track: 2.53 },
              specs: { engine: 'Lycoming IO-360-L2A', hp: 160, nE: 1, propD: 1.905, blades: 2, empty: [721, 744], mtow: 1111, fuelL: [201, 212], seats: 4 },
              src: '172R type sheet (perf_study REAL.c172.dims) + §6 of REAL-CHECK-2026-11-07', lengthNote: 'spinner to rudder' },
  c172f:    { dims: { span: 11.0, S: 16.2, cRoot: 1.63, cTip: 1.12, hSpan: 3.40, Sh: [3.30, 3.35] },
              specs: { engine: 'Lycoming IO-360 / O-360', hp: [160, 180], nE: 1, propD: 2.083, blades: 2, empty: [797, 820], mtow: 1157, fuelL: [201, 212], seats: 4 },
              // the float itself (Wipaire's guide rev 1/18; data, not scored): the seaplane float 5.97 m long (amphibian 6.07), the
              // hull 0.58 m high and 0.74 m wide, 1,166 kg displacement a float in fresh water, 1,295 kg maximum flotation (FAR
              // 23.751, 80 % reserve, two floats), the seaplane system 138 kg, its exchange weight 76 kg
              floats: { L: 5.97, H: 0.58, B: 0.74, dispKg: 1166, maxFlotKg: 1295, systemKg: 138, exchangeKg: 76 },
              src: 'the 172R airframe + Wipline 2350, Wipaire\'s Cessna 172 Product & Modification Guide rev 1/18 (CESSNA-FINAL 8 Nov): 172R/S gross 2,550 lb (1,157 kg) on the stock engine and the McCauley 1A200/WFA8243 (82 x 43 in = 2.083 m); empty = the 172R\'s 721-744 kg + the seaplane exchange 168 lb (76 kg); it was ESTIMATED 800-900 kg' },
  pa18f:    { dims: { span: 10.73, S: 16.6, cRoot: 1.60, cTip: 1.60 },
              specs: { engine: 'Lycoming O-320', hp: [150, 160], nE: 1, blades: 2, empty: [500, 530], mtow: 806, fuelL: 136, seats: 2 },
              src: 'PA-18-150 sheet (35 ft 2.5 in, 178.5 ft2, 36 US gal); empty = landplane 930 lb + Wipaire seaplane exchange 182 lb' },
  petrel:   { dims: { span: 8.9, length: 6.25, height: [2.2, 2.33], S: 15.0 },
              specs: { engine: 'Rotax 912 iS', hp: 100, nE: 1, blades: 3, empty: 320, mtow: 600, fuelL: 90, seats: 2 },
              src: 'maker / Wikipedia (perf_study REAL.petrel.dims)' },
  chinook:  { dims: { span: 9.75, length: 5.38, height: 1.78, S: 14.35, cRoot: 1.47, cTip: 1.47 },
              specs: { engine: 'Rotax 582', hp: 64, nE: 1, propD: 1.73, blades: 3, empty: [172, 209], mtow: 476, fuelL: 38, seats: 2 },
              src: 'ASAP Chinook Plus 2 sheet (perf_study REAL.chinook.dims)' },
  dc3:      { dims: { span: 28.96, length: [19.43, 19.71], height: 5.16, S: 91.7 },
              specs: { engine: 'P&W R-1830 Twin Wasp', hp: 1200, nE: 2, propD: 3.51, blades: 3, empty: [7650, 8300], mtow: 11431, fuelL: 3111, seats: [21, 32] },
              src: 'DC-3A (search extracts above); Hamilton Standard 23E50 11 ft 6 in; 822 US gal' },
  camel:    { dims: { span: 8.53, length: 5.71, height: 2.59, S: 21.46 },
              specs: { engine: 'Clerget 9B', hp: 130, nE: 1, blades: 2, empty: 421, mtow: 659, seats: 1 },
              src: 'Camel F.1 (search extracts above)' },
  tigermoth:{ dims: { span: 8.94, length: 7.29, height: 2.68, S: 22.2 },
              specs: { engine: 'de Havilland Gipsy Major', hp: 130, nE: 1, blades: 2, empty: 506, mtow: 828, fuelL: 86, seats: 2 },
              src: 'DH.82A (search extracts above); fuel 19 imp gal (THIN)' },
  stearman: { dims: { span: 9.80, length: [7.39, 7.54], height: [2.79, 2.95], S: [27.6, 27.7] },
              specs: { engine: 'Continental R-670 / W-670', hp: 220, nE: 1, blades: 2, empty: [876, 878], mtow: [1195, 1232], fuelL: 174, seats: 2 },
              src: 'PT-17 (search extracts above); fuel 46 US gal (THIN)' },
  carboncub:{ dims: { span: 10.36, S: 16.6 },
              specs: { engine: 'CubCrafters CC340', hp: 180, nE: 1, blades: 2, empty: 408, mtow: 599, fuelL: 91, seats: 2 },
              src: 'Carbon Cub SS: 34 ft span (Wikipedia CC11-160), wing area as the Cub family (THIN); 1320 lb / 900 lb / 24 gal' },
  skymaster:{ dims: { span: [11.58, 11.63], length: 9.07, height: 2.84, S: [18.7, 18.8] },
              specs: { engine: 'Continental IO-360', hp: 210, nE: 2, blades: 2, empty: [1186, 1264], mtow: [1996, 2132], seats: [4, 6] },
              src: 'Cessna 337 (search extracts above); LIGHT CHECK' },
};
for (const k in GEO) if (REFS[k]) Object.assign(REFS[k], { dims: GEO[k].dims, specs: GEO[k].specs, geoSrc: GEO[k].src, lengthNote: GEO[k].lengthNote || null });

// ---------------------------------------------------------------------------------------------------------------------
// THE PLANES real_check flies. `file`: the build, loaded through the load door (_load_build.js); `card`: an archetype
// card (designBake -> the load door's birth envelope). `ref`: the REFS row. `water`: it takes off from water.
// `official`: on builds/lists/plane_lists.json's official list. `engineNote`: when the build's engine is not the type's.
// ---------------------------------------------------------------------------------------------------------------------
const PLANES = {
  cub:      { label: 'Piper Cub (official)', file: 'builds/cub_2026-09-20_corrected.json', ref: 'cub', official: true },
  jodel:    { label: 'Jodel D112 (official)', file: 'builds/jodel_2026-09-20_corrected.json', ref: 'd112', official: true },
  cessna:   { dropped: 'the user 8 Nov: the corrected 172 is the Cessna; B-CESS is dismissed', label: 'Metal Cessna B-CESS (official)', file: 'builds/cessna172_2026-09-20.json', ref: 'c172r', official: true,
              engineNote: 'the build flies an O-540 235 hp (the type: IO-360 160 hp) on an 18.4 m2 wing (16.2): power-bound rows are not like for like', cgSweep: true },
  cessnaF:  { dropped: 'the user 8 Nov: dismissed; a Cessna on Wipline 2350 floats is to be rebuilt from the corrected 172', label: 'Metal Cessna on floats (official)', file: 'builds/cessna172_floats_2026-11.json', ref: 'c172f', official: true, water: true,
              engineNote: 'O-540 235 hp against the 160-180 hp the references cover' },
  pa18f:    { label: 'PA-18 on floats (official)', file: 'builds/pa18_floats_2026-10-23.json', ref: 'pa18f', official: true, water: true,
              engineNote: 'O-320 150 hp against Wipaire\'s 160 hp; EDO-style seaplane floats against Wipline amphibians' },
  petrel:   { label: 'Super Petrel V4.1 (claude/hull-types, 7 Nov)', file: 'builds/candidates/superpetrel_V4_1.json', ref: 'petrel', water: true, land: true, supersededBy: 'petrelL',
              branch: 'claude/hull-types', note: 'not on master: run from a worktree of claude/hull-types (its core, its rows)' },
  chinook:  { label: 'Chinook (official, out of the battery)', file: 'builds/chinook_2026-09-21_corrected.json', ref: 'chinook', official: true },
  // REAL-FIGURES-2 (2026-11-08): the planes with a clear real parent
  dc3:      { label: 'DC-3-alike (candidate)', file: 'builds/candidates/dc3_2026-10.json', ref: 'dc3', group: 'historical' },
  stearman: { label: 'Stearman-alike (candidate)', file: 'builds/candidates/stearman_2026-10.json', ref: 'stearman', group: 'biplane' },
  tigermoth:{ label: 'Tiger Moth-alike (candidate)', file: 'builds/candidates/tigermoth_2026-10.json', ref: 'tigermoth', group: 'biplane' },
  camel:    { label: 'Camel-alike (candidate)', file: 'builds/candidates/camel_2026-10.json', ref: 'camel', group: 'biplane' },
  birdman:  { dropped: 'the user 8 Nov: not needed (it is the Chinook as first built)', label: 'Birdman (candidate: the Chinook as found)', file: 'builds/candidates/birdman.json', ref: 'chinook', group: 'ultralight',
              note: 'the user\'s birdman.json before the 21 Sep corrections (the official Chinook is its corrected file)' },
  skymaster:{ dropped: 'the user 8 Nov: not wanted in the set', label: 'Skymaster-alike (archetype card)', card: 'skymaster', ref: 'skymaster', group: 'archetype',
              note: 'an engine-configuration archetype, never hand-authored to the type: a light check' },
  petrelL:  { label: 'Super Petrel V4.1, land (claude/seaplanes-merge; PROVISIONAL)', file: 'builds/candidates/superpetrel_V4_1.json', ref: 'petrel', land: true,
              branch: 'claude/seaplanes-merge', provisional: true, note: 'not flyable on water on that branch yet: land figures only, to redo once it flies' },
  c172rf:   { label: '172R on Wipline 2350 floats, STC prop (G3390, 20 Oct)', short: '172R on Wipline 2350', file: 'builds/c172r_wipline2350_stcprop_2026-10-20.json', ref: 'c172f', water: true,
              note: 'HYDRO-TRIM\'s stock 172R on the catalogue-exact Wipline 2350s with the STC 82 x 43 prop: the floats Cessna that exists today, until FLAGSHIP\'s rebuild lands' },
  carboncubss: { label: 'Carbon Cub SS (the STOL Cub rebuilt to the type)', short: 'Carbon Cub SS', file: 'builds/candidates/carbon_cub_ss.json', ref: 'carboncub',
              note: 'REAL-FIGURES-3, the user 9 Nov: the STOL Cub with the CC340 built from the engine dials (the O-320 chassis on the CC340 stroke, 340 in3, 2700 rpm, the new tune 1.09 and build 0.88 dials: 180 hp, 120 kg), a 2-blade carbon 2.03 m, VGs only (no slot, droop or drooped tips), the new STOL flap (plain, to 50 deg), a Super Cub-sized tail, 29 in tundras, 91 L in the wing roots, one 7 in glass PFD/MFD with round ASI / ALT / VSI (builds/candidates/carbon_cub_ss.edits.json)' },
  // (the user, 9 Nov: the STOL Cub is a Cub with a kit, not a Carbon Cub - kept, measured, no longer compared: the Carbon
  // Cub SS is the aeroplane that IS a real one)
  stolcub:  { supersededBy: 'carboncubss', label: 'STOL Cub (official)', short: 'STOL Cub', file: 'tools/fixtures/stol_cub_showcase.json', ref: 'carboncub', official: true,
              engineNote: 'a Rotax 915 iS (141 hp turbo) where the Carbon Cub SS has the CC340 180 hp (the Carbon Cub UL\'s 916 iS is the Rotax analogue, unpublished)' },
  c172x:    { supersededBy: 'c172v2', label: 'Cessna 172 corrected (internal)', short: 'Cessna 172 corrected', file: 'builds/cessna172_2026-09-20_corrected.json', ref: 'c172r',
              note: 'the 20 Sep corrected 172 (IO-360 dials, 16.5 m2): the like-for-like 172R comparison the official B-CESS cannot be' },
  // CESSNA-FINAL (FLAGSHIP, 8 Nov): the corrected 172 + seven build rows - the lowered aft roof, 212 L at the wing root,
  // the DRAWN stab to the 172R's 3.40 m / 3.30 m2 (stSpan 1.19 -> 1.264: the join measures the drawing, spec.tail does not
  // survive a load), 'standard' seats, the 'full' trim (a 172 as delivered), V2-172. No generator change yet (Part 2)
  c172v2f:  { label: 'Cessna 172 V2-172 on Wipline 2350 floats (draft)', short: 'V2-172 floats', file: 'builds/cessna172r_floats_2026-11-08.json', ref: 'c172f', water: true,
              note: 'CESSNA-FINAL step 4 (draft): the land V2 + the G3390 float rows, the float system at Wipaire\'s 138 kg; flapless at gross (CG 45 % MAC) until A1' },
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

// ---------------------------------------------------------------------------------------------------------------------
// THE CAMPAIGN'S WRITTEN FINDINGS (tools/real_report.js prints them): `_global` under the global view, `_conclusion` and
// `_next` in "Conclusions and next steps", one list per PLANES key in that plane's section. HTML allowed (inline only).
// Rewrite them each campaign; the numbers around them are recomputed by the report every time.
// ---------------------------------------------------------------------------------------------------------------------
const NOTES = {
  _global: [
    '<b>The set</b> (every plane with a clear real parent, after the user\'s cut of 8 Nov): the official Cub, Jodel D112, PA-18 on floats and Chinook; <b>the corrected Cessna 172</b> (the Cessna of the set: the metal B-CESS and its float version are dismissed, a Cessna on Wipline 2350 floats is to be rebuilt from the corrected one) and, until then, HYDRO-TRIM\'s 172R on catalogue-exact Wipline 2350s; the candidates DC-3-alike and the three old biplanes (Stearman-, Tiger Moth- and Camel-alikes, the REF_MATCH recreations); the Super Petrel V4.1 (land only, provisional: claude/seaplanes-merge). The Birdman and the Skymaster-alike are out. <b>"Our 3 historical ones"</b> are read as the Cub, the Jodel and the Cessna of the original studies.',
    '<b>Geometry is measured on the drawn aeroplane</b> (since 8 Nov): span tip to tip, length spinner to rudder and height standing on the gear at its settled deck angle, off the editor\'s own scene through the load door; the structure\'s figures are shown beside them. A build FILE\'s stations can be stale: the game\'s load door re-measures the tail off the drawing (the Jodel\'s fin sits 0.55 m forward of its file\'s figure, the corrected 172\'s 0.48 m, and the 172\'s stab span reads 3.20 m where its file says 3.41).',
    '<b>Performance</b> is the aeroplane\'s capability (no pilot, or the same pilot on the handbook\'s schedule). What the shipped pilot adds is shown apart: on the landing roll it is most of the error on every plane (REAL-CHECK-2026-11-07 §5).',
  ],
  _conclusion: [
    'The light, faithfully built aeroplanes reproduce their parents closely on all three axes: the <b>Cub</b>, the <b>Jodel</b> and the <b>Chinook</b> sit within a few percent on stall, cruise, top speed, climb and take-off roll, at the weight their book was written for.',
    'The <b>ref-matched recreations</b> (Stearman, Tiger Moth, Camel, DC-3) reproduce their parents\' shape to within 0-5 % on span and length. Their weak side is the <b>mass model</b> on old construction (the Camel +37 % empty, the Tiger Moth +13 %, the DC-3 -15 to -22 %) and a <b>10-25 % climb deficit</b>, with low static margins on the biplanes (1-8 %).',
    'The <b>corrected 172</b> is right on shape (98) and specs (94); its performance (76) loses on the cruise (-11 %), the climb (-10 %), the climb-out to 50 ft (+48 %) and a landing roll the handbook schedule makes 18 % SHORTER than the POH (the brakes or the tyre friction too strong). See reports/CESSNA-DOSSIER-2026-11-08.md.',
    'The model\'s own residuals: climb 10-20 % short on matched engines, the climb-out to 50 ft long, the landing roll the pilot\'s.',
  ],
  _next: [
    '<b>The Cessna</b> (this week): FLAGSHIP\'s final corrected 172 and its Wipline 2350 version, measured with this tool against the 172R POH and Wipaire; the dossier lists every number and the corrections the load door would otherwise undo (edit the cage\'s tail rows, not spec.tail).',
    '<b>The landing brake law</b> (the pilot\'s, not PHYSICS_V): brakes from touchdown with a firmer ramp, the approach re-planned for the load.',
    '<b>The propeller\'s climb-speed efficiency</b> (physics, PHYSICS_V): the 10-20 % climb deficit and the long climb-out.',
    '<b>The pilot\'s climb speed</b> from the measured Vy instead of 1.38 Vs, and a Vx obstacle climb-out (the handbook\'s short-field technique; the sweep has none yet).',
    '<b>The mass model on old construction</b>: the Camel bills 37 % over its empty weight, the DC-3 15-22 % under.',
    '<b>Redo the Petrel</b> on water once claude/seaplanes-merge flies it.',
    '<b>GATE REALBAND</b> on the official planes: the airframe bands and the approach-trim row (REAL-CHECK-2026-11-07 §8).',
  ],
  cub: ['The J-3\'s sheet reads as a gross-weight sheet: stall, climb and the roll meet ours at 530-570 kg. Drawn: 10.70 m span, 6.93 m long (6.83), 2.09 m high three-point (2.03).'],
  jodel: ['<b>The geometry, checked</b> (the user 8 Nov: "I thought I was closer"): the span is right (8.32 m drawn tip to tip, the 17.5-degree outer panels included, against 8.20); the WING is bigger than a D.112\'s: 13.8 m² against 12.7 (+9 %), a 1.80 m root chord against ~1.72 and a square tip of 1.10 where the D.112\'s rounded tip runs ~1.20; and the aeroplane the game draws is <b>5.88 m long against 6.20</b> (-5 %): the load door puts the fin 0.55 m forward of the file\'s station (the 20 Sep study\'s 6.25 m read the file). Height 2.00 m three-point against 2.07 - right. The fin forward also shortens the tail arm (the study\'s small static margin).',
          'The D.112\'s thin book reads as a light-load sheet; the airframe is 5-10 % slow and 7 % heavy. The light Jodel goes around twice and runs out the clock (the approach is not re-planned for the load).'],
  c172x: ['<b>The Cessna of the set</b> (the user 8 Nov). Shape: span 11.02 m, length 8.21 m (8.28), height 2.65 m (2.72), wing 16.5 m² (16.2), the stab 3.11 m² (3.30-3.35) on a 3.20 m span (3.40: the file\'s 3.41 is overwritten by the drawing). Performance: stall exact at gross, cruise -11 %, climb -10 %, the roll -5 to -9 %, the climb-out to 50 ft +48 %, CG at 43 % MAC at gross with four aboard. The full dossier: reports/CESSNA-DOSSIER-2026-11-08.md.'],
  c172v2: ['<b>The V2-172</b> (CESSNA-FINAL on claude/alloy-frame: the corrected 172 + the build rows + A1, the nose section as body, and A4, every drawn seat weighed; measured 9 Nov on that branch\'s core): <b>5 inside / 5 near / 7 outside</b> against the 172R POH, from 2 / 9 / 6 on 8 Nov. In: the empty weight (729 kg, the 172R 721-744), the analytic take-off roll (284 m / 288), the handbook landing from 50 ft (378 / 395). Still out: the climb-out to 50 ft (788 m / 514, +53 %: the pilot levels in ground effect, no Vx climb-out in the sweep, and the propeller at low speed), the landing roll (handbook 139 / 168, game 240), the game\'s climb (3.18 / 3.66), the glide (not like for like). CG 30.8 % MAC light, 40.7 % at gross (the POH\'s aft limit 36.4 %): forward of 8 Nov by 2.3 points, still aft at gross. Its MTOW case is 1127 kg: the empty 729 + four aboard cannot get to 1111 even on a quarter of the fuel.'],
  c172v2f: ['<b>The V2-172 on Wipline 2350s</b> (CESSNA-FINAL step 4, DRAFT): <b>9 / 1 / 0</b> against Wipaire at 920-1157 kg (the 172R on 2350s: 8 / 2 / 0 with the same rows): empty 814 kg against 797-820 (Wipaire\'s exchange weight), the water runs inside, the climb ~10 % better than Wipaire\'s figure. BUT at its own MTOW case it is 1212 kg (over the STC 1157), CG 46 % MAC, it lands flapless, the hump R/W reads 0.27 (HYDROTRIM\'s band tops at 0.21) and the floatplane supplement\'s technique does not lift it off (the no-flap rig: 773 m / 44 s; the game\'s pilot: 613 m / 39 s).'],
  carboncubss: ['<b>The STOL Cub rebuilt to the type</b> (the user 9 Nov): the CC340 from the engine dials (340 in3, 2700 rpm, the new <i>tune</i> 1.09 = 10.7 bar and <i>build</i> 0.88 dials: 180 hp, 120 kg), two carbon blades on 2.03 m, VGs only, the new STOL flap (a plain hinge to 50 deg, the SS\'s 15/30/50), the new aluminium-spar-under-fabric wing, a Super Cub-sized tail, 29 in tundras (ours were 30.7 in), 91 L in the wing roots, one 7 in glass PFD/MFD with round ASI / ALT / VSI. <b>5 inside / 2 near / 4 outside</b> (the STOL Cub 1 / 1 / 9).',
            'The handbook schedule is the STOL one (the user): the take-off on full flap with the brakes held and the stick back to full rpm, then go (30-40 m against 41-52 rolling on the analytic schedule); the landing on the <b>tailwheel short-field stop</b> of FAA-H-8083-3C ch. 14 - held three-point, the stick full back, the brakes evenly and firmly from the touchdown only while the tail is down, the flaps left down (69-80 m against 75: inside). The old handbook brake law and the sweep\'s hardest one stood this aeroplane on its nose (pitch -19 deg, not a crash to the sim): such a roll is now flagged NOSE-OVER and never counted.',
            'In: empty 428 kg (388-428), climb by all three readings, the handbook landing. Near: the clean stall 55-61 km/h against 65, cruise 166-167 against 177-193. Out: the take-off 30-57 m against 60 ft (a single-source demonstration figure: 18 m at 599 kg on 180 hp needs a headwind), and the game\'s landing 114-140 m (the shipped brake law; the game\'s pilot also lands tail-high, not three-point). Full-flap stall 51-56 km/h against 27 kt (50).'],
  stolcub: ['Measured against the <b>CubCrafters Carbon Cub SS</b> (CC11-160, 1320 lb light-sport, CC340 180 hp): the closest Carbon Cub with published figures (the Rotax Carbon Cub UL publishes none; the EX-3/FX-3 are 2000 lb, 186 hp). Every Carbon Cub figure is a brochure / review figure with no weight or surface stated, two of them single-source (the 60 ft roll and the 245 ft landing).',
            'Empty 417 kg against 408 (inside). <b>Outside, and why</b>: the clean stall 47-52 km/h against 65 (35 kt flaps up) - the STOL kit\'s full-span slot, VGs, droop and drooped tips are always on, so its CLEAN stall is the SS\'s full-flap one (27 kt = 50 km/h); the cruise 150 km/h against 177-193 - the kit\'s drag (slots, VGs, drooped tips, tundra tyres, the bigger tail) on 141 hp against 180, and the SS\'s figure is at its POH\'s power limit; the climb 5.4-7.0 m/s against 7.6-10.7 - 141 hp against 180 (ours equals the SS\'s low figure at 368 kg, below any load); the take-off roll 30-55 m against 18 (60 ft, THIN: a demonstration figure); the landing roll 22-30 m against 75 (245 ft, THIN, probably a normal landing, ours a full-braking STOL one at 40 km/h).',
            'At MTOW (the passenger and the baggage aft, CG 36 % MAC, margin 9 %) the full-flap approach needs -0.69 of elevator (nose down) against the 0.154 budget: the drawn elevator chord 0.664 already flies clamped at 0.65 (the join\'s own error).'],
  c172rf: ['The float Cessna that exists today (HYDRO-TRIM G3390): the stock 172R airframe of 20 Oct on Wipaire\'s catalogue-exact 2350s with the STC 82 x 43 propeller. A reference point for FLAGSHIP\'s rebuild, measured against Wipaire\'s figures.'],
  pa18f: ['Climb 14-21 % short and the water run 50-80 kg "heavy": the propeller item, plus 150 hp against the reference\'s 160.'],
  chinook: ['Airframe only: the game\'s pilot rejects the take-off (GATE ARCHETYPES\' standing red). Drawn 2.19 m high against the sheet\'s 1.78 (the engine on the wing\'s centre section).'],
  stearman: ['Geometry to the centimetre (REF_MATCH). Top speed 12 % under the lower figure, climb 15 % short at gross: the drag of the radial and the wires plus the propeller item. Static margin 4-8 %. Landing roll: the pilot\'s (+200 m over the best schedule).'],
  tigermoth: ['Geometry within 1-7 % (wing area +7 %). Stall, cruise and top speed inside; climb 10-25 % short (thin reference); empty +13 %. Static margin 4-6 %. Landing roll: the pilot\'s (+164 m).'],
  camel: ['Geometry exact (REF_MATCH). <b>Empty 579 kg against 421 (+37 %)</b>: the frame\'s mass model on a 1917 wire-braced scout. Top speed 5 % under the one (thin) figure. Static margin 1-3 % (the real Camel was famously close to neutral). Only one performance figure is sourced: its performance score rests on it.'],
  dc3: ['Span to the centimetre, 19.60 m long (19.43-19.71), the right engines, propellers and fuel. <b>Empty 6480 kg against 7650-8300 (-15 to -22 %)</b>: the mass model, light on a big all-metal airliner. Cruise and top speed ~13 % under figures quoted at altitude (THIN); the climb inside at gross on the airframe and the handbook schedule, 18 % short under the game\'s pilot.',
        '<b>The balance</b>: the CG at 50 % MAC with a light load (margin 15 %) and 66 % with every seat filled (margin 1 %); at that load the game\'s pilot <b>capsized</b> on the landing. A mass-and-balance item for the DC-3 build before it goes official.'],
  petrelL: ['The same airframe as the 7 Nov run: flown numbers identical to the hull-types run (TO 192 m, climb 2.42 m/s, landing 457 m at 600 kg). Empty 380 kg against 320 (+19 %; the retract gear and the hull bottom), fuel 72 L against 90. Its drawn length is not used (that branch\'s scene reads 12.5 m: something besides the aeroplane), the structure\'s 5.61 m is. <b>PROVISIONAL</b>: land only until it flies off the water. Solo, a 3-4 % static margin.'],
};

module.exports = { REFS, PLANES, HISTORY, NOTES, KT, MPH, FPM, FT, LB };
