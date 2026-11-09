// real_refs_proposal.js (REF-DATA-DC3-TIGERMOTH, 2026-11-09) — PROPOSED reference rows for tools/real_refs.js, in its
// own format ({ v, tol, kg, flaps, surface, alt, src }). NOT wired in: tools/real_refs.js is untouched. The dossier with
// every figure, its conditions and its grade is README.md beside this file.
//
// Grades in src: [1.0] official manual chart · [0.9] TCDS / regulator / official report · [0.6] magazine flight test
// · [0.5] encyclopedia / compilation · [0.3] single unverified source or estimate. "(extract)" = read through a search
// engine extract, the page itself was not reachable from the research session (README section 0).
//
// Two PROPOSED NEW INDICATORS (not in real_check.js yet; drop them if the runner should not grow):
//   V50   km/h  level speed at 50 % power, TAS, at `alt` (the DC-3's published cruise is a 50 % power figure)
//   roc1E m/s   the best rate of climb on one engine (twins)
// and one use of the existing `alt` field: the DC-3's top speed is published at 8,500 ft, not at sea level.
'use strict';

const KT = 1.852, MPH = 1.609344, FPM = 0.00508, FT = 0.3048, LB = 0.45359237;

const REFS = {
  // DOUGLAS DC-3A (2 x P&W R-1830-S1C3-G = -92). Weights from the type certificate (A-669 via CAA NZ TAR 16/21B/17);
  // speeds and climbs from Francillon, AOPA Pilot (1994 flight test) and a C-47 flight-manual climb table. Take-off and
  // landing distances: none found with their conditions (the C-47 AN 01-40NC-1 charts were not reachable) - no rows.
  dc3: {
    name: 'Douglas DC-3A (2 x P&W R-1830-S1C3-G 1200 hp)', mtow: 11431, empty: 7650, fuelL: 3111, S: 91.7, powerHP: 2400,
    src: 'A-669 via CAA NZ TAR 16/21B/17 [0.9]: 25,200 lb max (26,200 / 26,900 lb under notes 12 / 10, 13); Francillon (Wikipedia) [0.5]: 95 ft, 64 ft 5 in, 987 ft2, 16,865 lb empty, 822 US gal, 230 mph at 8,500 ft, 1,130-1,140 fpm; AOPA Pilot 6/1994 [0.6] (extract): empty as tested 16,822 lb, Vs1 67 KIAS, Vs0 62 KIAS, Vmc 77 KIAS, single-engine 200 fpm, 157 kt at 50 % / 10,000 ft; C-47 manual climb table at 25,000 lb [0.6 pending] (extract): 1,220 fpm METO, 1,410 fpm take-off power, 425 fpm one engine',
    // Vy: 110 kt IAS (fsvintageair, from the Ozark handbook / T.O. 1C-47 [0.3]) and the Flight International test climb at
    // 110 kt -> 110 / 67 = 1.64 x Vs1 (the current card has 1.40)
    poh: { vr: 1.15, vy: 1.60, flapTO: 0, flapLDG: 30, brake: 0.6, note: 'a heavy taildragger; flaps up for the take-off (C-47 practice), 1/4-1/2 flap is also used; climb at 105-110 kt IAS (Vy 110, Vx 95)' },
    rows: {
      // the DC-3A airline empty weight: two sources 20 kg apart. The old 8,300 kg top was the C-47 / DC-3C (heavier by
      // 220-600 kg: 17,345 lb DC-3C basic empty, AOPA 2005; 18,135 lb C-47B, Francillon)
      empty: { v: [7630, 7650], tol: 0.03, src: '16,822 lb as tested (AOPA 1994 [0.6], extract) / 16,865 lb DC-3A (Francillon [0.5]); a C-47 / DC-3C is 7,870-8,230 kg' },
      Vs1:   { v: 67 * KT, tol: 0.06, kg: 'gross', flaps: 'up', src: '67 KIAS clean (AOPA Pilot 6/1994 spec box, manufacturer data [0.6], extract); IAS, weight not printed (AOPA boxes are at max gross); CL 1.68 at 25,200 lb. A C-47 manual "67 mph TAS" (garbled extract [0.3]) is not taken: CL 2.24 clean' },
      // Vs0 (not an indicator yet): 62 KIAS landing flap (AOPA 1994 [0.6]) - CL 1.96 at 25,200 lb
      Vmax:  { v: 230 * MPH, tol: 0.04, kg: 'gross', alt: 8500 * FT, src: '230 mph (200 kt) at 8,500 ft (Francillon DC-3A [0.5]); the C-47B: 224 mph at 10,000 ft at 26,000 lb. No sea-level figure is published: the row carries its altitude. (Wikipedia\'s "223 kt" is a slip for 230 mph)' },
      V50:   { v: 157 * KT, tol: 0.05, kg: 'unknown', alt: 10000 * FT, src: '157 kt at 50 % power, 10,000 ft, 94 US gal/h (AOPA Pilot 6/1994 [0.6], extract); taken as TAS - if IAS (as Wikipedia restates it), TAS is ~181 kt. PROPOSED NEW INDICATOR' },
      // the old V75 row (194-207 mph, altitude unstated) has no source that states a power or an altitude: dropped
      roc:   { v: [1130 * FPM, 1220 * FPM], tol: 0.05, kg: 'gross', src: '1,130-1,140 fpm at 25,200 lb (Francillon [0.5]); 1,220 fpm at METO 1,050 hp, 25,000 lb, ISA SL (C-47 manual climb table [0.6 pending], extract). At take-off power (1,200 hp, 1-minute limit on A-669): 1,410 fpm. Light: ~1,200 fpm at 8,800 kg, 110 kt, 35 in / 2,350 rpm (Flight International [0.6])' },
      roc1E: { v: [200 * FPM, 425 * FPM], tol: 0.05, kg: 'gross', src: '200 fpm at gross (AOPA 1994 [0.6]) to 425 fpm at 25,000 lb METO (C-47 manual excerpt [0.6 pending]); prop feathered. PROPOSED NEW INDICATOR' },
      LD:    { v: 14.7, tol: 0.08, kg: 'unknown', src: '(L/D)max 14.7 with CD0 0.0249 (Loftin, NASA SP-468, as commonly quoted [0.5 pending: the table was not reachable]); consistent with AR 9.14 and e 0.75; CD0 ~0.025 also derived from 230 mph at 8,500 ft on 2 x 1,050 hp' },
    } },

  // DE HAVILLAND DH.82A TIGER MOTH (Gipsy Major I 130 hp). The anchor is the AAIB's official flight trial of two UK
  // Tiger Moths at 1,760 and 1,790 lb (AAIB Bulletin 1/2019, G-ADXT, pp. 59-62 [0.9], read in full), with the Pilot's
  // Notes limits and the period figures (Jackson, Bransom) around it.
  tigermoth: {
    name: 'de Havilland DH.82A Tiger Moth (Gipsy Major I 130 hp)', mtow: 828, empty: 506, fuelL: 86, S: 22.2, powerHP: 130,
    src: 'AAIB Bulletin 1/2019 G-ADXT flight trial [0.9]: at 1,760 / 1,790 lb, take-off run 300 m, climb 650 / 500 fpm at 66 mph (2,100 / 2,050 rpm), stall 40-45 mph idle (test pilot: 45-49 mph IAS), level at 66 mph with 1,700-1,800 rpm at 2,000 ft DA; Pilot\'s Notes (ABAC c.1950, via RAF Jever [0.6], extract; and quoted by the AAIB): 1,825 lb max (1,770 aerobatic), tare 1,180 lb, stall 40 mph engine off, 2,100 rpm max climb / cruise, 160 mph max; Jackson / Bransom [0.5]: 29 ft 4 in, 23 ft 11 in, 8 ft 9 in, 239 ft2, 1,115 lb empty, 109 mph, 673 fpm, 13,600 ft',
    poh: { vr: 1.10, vy: 1.40, flapTO: 0, flapLDG: 0, brake: 0, note: 'no flaps, no brakes (a tailskid). Climb at 60 mph (club handling notes) to 66 mph (AAIB trials) = 1.33-1.47 x a 45 mph stall' },
    rows: {
      empty: { v: [506, 535], tol: 0.03, src: '1,115 lb basic (Jackson / Bransom [0.5]) to the RAF tare 1,180 lb with service equipment (Pilot\'s Notes via RAF Jever [0.6], extract)' },
      Vs1:   { v: [40 * MPH, 49 * MPH], tol: 0.03, kg: [798, 812], flaps: 'up', src: 'idle stall 40-45 mph, the test pilot "typically 45-49 mph IAS", at 1,760-1,790 lb (AAIB 1/2019 [0.9]); Pilot\'s Notes "engine off 40 mph (35 kt)" on a period ASI ([1.0] as quoted). 40 mph needs CL 1.87 at gross: the CAS stall is in the upper half of the band' },
      V75:   { v: [80 * MPH, 93 * MPH], tol: 0.05, kg: 'unknown', src: 'cruise 80-81 mph at 1,900-1,950 rpm (AAIB 9/98 G-BALX [0.9 est.]; IAOPA 2006 70 kt [0.6]; VH-BCI operator sheet 1,950 rpm [0.5]) to 90-93 mph at 2,100 rpm, max cruising (Jackson [0.5]); no source states a % power' },
      Vmax:  { v: [107 * MPH, 109 * MPH], tol: 0.05, kg: 'gross', src: '109 mph (Jackson / Bransom [0.5]; altitude not confirmed) / 107 mph (Shuttleworth; aero-web DH.82C [0.5])' },
      roc:   { v: [500 * FPM, 673 * FPM], tol: 0.03, kg: [798, 828], src: '650 fpm (G-ACDI, 2,100 rpm) and 500 fpm (G-ANNG, 2,050 rpm) at 1,760 / 1,790 lb, 66 mph (AAIB 1/2019 [0.9]); ~600 fpm at ~gross (IAOPA 2006 [0.6]); 673 fpm (Jackson / Bransom [0.5])' },
      TO:    { v: [200, 300], tol: 0.10, kg: [798, 812], flaps: 0, surface: 'grass', src: '300 m full power at 1,760-1,790 lb (AAIB 1/2019 Table 1 [0.9]; surface and wind not stated, UK grass fields); 200 m to "light on the wheels" at 40 KIAS, Old Sarum dry grass, calm, 15 C, QNH 1026 (AAIB 1/2019 p.61 [0.9]) - the lower bound' },
    },
    // PROPOSED DATA (not a row type yet): the AAIB partial-power table, a power-required check at 66 mph (58 KIAS),
    // density altitude 2,000 ft, 1,790 lb: rpm -> rate of climb (fpm). The level-flight rpm at 66 mph is ~1,750.
    partialPower: { kg: 812, alt: 2000 * FT, ias: 66 * MPH, rpmToFpm: { 1700: -20, 1800: 20, 1900: 200, 2000: 400 },
                    src: 'AAIB Bulletin 1/2019 Table 2 [0.9]' },
  },
};

const GEO = {
  dc3:      { dims: { span: [28.96, 29.11], length: [19.43, 19.63], height: [5.16, 5.18], S: 91.7 },
              specs: { engine: 'P&W R-1830-S1C3-G (-92) Twin Wasp', hp: 1200, nE: 2, propD: 3.51, blades: 3, empty: [7630, 7650], mtow: 11431, fuelL: 3111, seats: [21, 32] },
              // the engine: 1,200 hp / 2,700 rpm / 48 in for 1 minute; METO 1,050 hp / 2,550 rpm, 41.5 in at SL to 39.5 in at
              // 7,500 ft (A-669 Rev 31 [0.9], extract); dry 1,467 lb (NASM [0.9]). Propeller: Hamilton Standard 23E50 hub,
              // blades 6153A-18 / 6353A-18 / 6565A-18 (TAR 16/21B/17 [0.9]), 11 ft 6 in (Francillon [0.5])
              src: 'span 95 ft DC-3A / 95 ft 6 in C-47B, length 64 ft 5 in DC-3A / 63 ft 9 in C-47B, height 16 ft 11 in - 17 ft tail down, 987 ft2 (Francillon [0.5]); AR 9.14; airfoil NACA 2215 / 2206; empty 16,822-16,865 lb; 25,200 lb (A-669 [0.9]); 822 US gal (Francillon)' },
  tigermoth:{ dims: { span: 8.94, length: 7.29, height: 2.67, S: 22.2 },
              specs: { engine: 'de Havilland Gipsy Major I', hp: 130, nE: 1, propD: [1.93, 1.96], blades: 2, empty: [506, 535], mtow: 828, fuelL: 86, seats: 2 },
              src: '29 ft 4 in, 23 ft 11 in, 8 ft 9 in, 239 ft2 (Jackson / Bransom [0.5]); 1,825 lb (Pilot\'s Notes; AAIB [0.9]); 19 imp gal fuel, 2.1 imp gal oil (Pilot\'s Notes [0.6], extract); prop ~6 ft 4-5 in wooden fixed pitch (collectors / forum [0.3]); dihedral upper ~2 deg / lower 4.5 deg, incidence 4 deg, sweep 11 in / 9 1/8 in at the strut (1931 DH rigging guide via forum [0.3])' },
};

// THE DC-3 GROUP WEIGHTS (README section 1.3): an ENGINEERING ESTIMATE [0.3] around two sourced anchors (empty
// 16,865 lb [0.5], R-1830-92 dry 1,467 lb each [0.9]). lb; share of empty. No group weight statement was reachable.
const DC3_GROUPS_EST = {
  wing: { lb: 3500, range: [2900, 4050], share: 0.21 },
  tail: { lb: 450, range: [380, 560], share: 0.03 },
  fuselage: { lb: 2650, range: [2300, 3000], share: 0.16 },
  nacelles: { lb: 700, range: [550, 900], share: 0.04 },
  landingGear: { lb: 1260, range: [1100, 1470], share: 0.07 },
  engines: { lb: 2934, range: [2934, 2934], share: 0.17, src: 'NASM R-1830-92 1,467 lb x 2 [0.9]' },
  propellers: { lb: 750, range: [700, 900], share: 0.04, src: '~375 lb each, forum [0.3]' },
  enginesSystems: { lb: 1246, range: [900, 1500], share: 0.07, src: 'mounts, cowls, exhaust, accessories, oil + fuel systems, controls, starting' },
  fixedEquipment: { lb: 3375, range: [2900, 3800], share: 0.20, src: 'controls, hydraulics, electrical, instruments, radio, furnishings (21 seats), heating, de-icing' },
  total: 16865,
};

module.exports = { REFS, GEO, DC3_GROUPS_EST, KT, MPH, FPM, FT, LB };
