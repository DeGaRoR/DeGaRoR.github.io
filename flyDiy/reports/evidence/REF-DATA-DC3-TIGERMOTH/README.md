# REF-DATA-DC3-TIGERMOTH — reference data for the DC-3A and the DH.82A Tiger Moth (research, 2026-11-09)

The owner asked for better-sourced reference rows for the two planes that sit on thin references in
`tools/real_refs.js` (`dc3`, `tigermoth`). This dossier lists each figure with the conditions it was stated at, its
source and a quality grade. The proposed rows are in `real_refs_proposal.js`, in `real_refs.js`'s own format.
**`tools/real_refs.js` is NOT edited.**

Quality grades: **1.0** official manual chart (Pilot's Notes, AN/TO flight manual, AFM, TCDS chart) · **0.9** TCDS /
official report (AAIB, regulator) / manufacturer weight report · **0.6** magazine flight test with stated conditions ·
**0.5** encyclopedia / compilation (Francillon, Jackson, Bransom, via Wikipedia) · **0.3** single unverified source
or estimate.

## 0. Access note: read this first

This session's network allowed only `en.wikipedia.org` and `assets.publishing.service.gov.uk` (plus `aviation.govt.nz`).
**The primary sources the brief names were not reachable**: `archive.org`, `web.archive.org`, `ntrs.nasa.gov`,
`www.hq.nasa.gov` / `history.nasa.gov` (Loftin, *Quest for Performance*, SP-468), `drs.faa.gov` / `www.faa.gov`
(TCDS A-669), `www.douglasdc3.com` and `www.john2031.com` (copies of A-669 Rev 30/31), `app.aircorpslibrary.com`
(the C-47 AN 01-40NC-1 scans; that one is also a subscription), `www.rafjever.org` (the ABAC Tiger Moth Pilot's Notes
transcript), `www.aopa.org`, `www.flightglobal.com`, `tigermothclub.co.nz`, `aircraftinvestigation.info`. Proxy
refusals are logged in the session (`connect_rejected`).

So the figures below come from three kinds of source:
- **documents read in full here**: AAIB Bulletin 1/2019 (G-ADXT, Tiger Moth, with an official flight trial), AAIB
  bulletins on G-BALX (9/98) and another DH82A, CAA NZ Type Acceptance Report TAR 16/21B/17 (DC-3, from FAA TC A-669),
  the Wikipedia specification blocks with their cited books (Francillon, Jackson, Bransom);
- **search-engine extracts** of the unreachable pages (A-669 Rev 31, AOPA Pilot June 1994, Flight International
  "Dakota skies", the RAF Jever Pilot's Notes transcript, the IAOPA Tiger Moth article). These are marked
  `(extract)`. The figure is quoted from the page, but the surrounding conditions could not be read in full;
- **derived checks** made here from the figures above (marked `derived`).

To finish the job with primary sources, allow these hosts for a follow-up session: `archive.org`, `ntrs.nasa.gov`,
`www.hq.nasa.gov`, `drs.faa.gov`, `www.douglasdc3.com`, `www.rafjever.org`, `www.aopa.org`. See section 3 for what to
read on each.

---

## 1. Douglas DC-3A (2 x P&W R-1830-S1C3-G / -92) and the C-47

### 1.1 Geometry

| Item | Value | Conditions / notes | Source | Grade |
|---|---|---|---|---|
| Span | 95 ft 0 in (28.96 m) | DC-3A | Francillon, *McDonnell Douglas Aircraft since 1920* (via Wikipedia DC-3 spec block) | 0.5 |
| Span | 95 ft 6 in (29.11 m) | C-47B (the same wing; the 6 in is the usual tip-measurement difference) | Francillon (via Wikipedia C-47) | 0.5 |
| Length | 64 ft 5 in (19.63 m) / 19.7 m | DC-3A | Francillon (via Wikipedia) | 0.5 |
| Length | 63 ft 9 in (19.43 m) | C-47B (different tail cone) | Francillon (via Wikipedia) | 0.5 |
| Height | 16 ft 11 in (5.16 m), tail down | DC-3A. The Wikipedia block also writes "16 ft 9 in" and "(level attitude) 23 ft 6 in": that is a garbled field; 5.16 m is the figure most sources agree on | Francillon | 0.5 |
| Height | 17 ft 0 in (5.18 m) | C-47B, tail down | Francillon | 0.5 |
| Wing area | 987 ft² (91.7 m²) | all variants | Francillon; every source agrees | 0.5 (consensus) |
| Aspect ratio | 9.14 (derived: 95²/987); 9.17 quoted | | Wikipedia / derived | 0.5 |
| Airfoil | NACA 2215 root, NACA 2206 tip | | Lednicer, *Incomplete Guide to Airfoil Usage* | 0.5 |
| Propeller | Hamilton Standard 23E50 hub, blades 6153A-18, 6353A-18 or 6565A-18; 3 blades; 11 ft 6 in (3.51 m); hydromatic constant-speed, feathering | DC3C-S1C3G | CAA NZ TAR 16/21B/17 (from FAA TC A-669; propeller TC P-603); diameter from Francillon | 0.9 (models) / 0.5 (diameter) |
| C.G. range | +47.1 to +70.6 in aft of datum (datum: leading edge of the wing centre section) | A-669 Rev 31 | (extract) | 0.9 |
| MAC, tail span/areas, track, wheelbase | **not found** | | | — |

### 1.2 Weights

| Item | Value | Conditions / what it includes | Source | Grade |
|---|---|---|---|---|
| Max take-off / landing weight | **25,200 lb (11,431 kg)** | DC3C-S1C3G, standard | CAA NZ TAR 16/21B/17 (from A-669) | 0.9 |
| Max take-off weight | 26,200 lb (11,884 kg) | A-669 Note 12 | TAR 16/21B/17 | 0.9 |
| Max take-off weight | 26,900 lb (12,202 kg) | A-669 Notes 10 and 13 (later operating rules) | TAR 16/21B/17 | 0.9 |
| Max landing/take-off | 26,000 lb | engines rated 1050 hp METO / 1200 hp TO, under certain performance rules | A-669 Rev 31 (extract) | 0.9 |
| C-47 gross / max | 26,000 lb normal; 31,000 lb max (overload) | C-47B military | Francillon | 0.5 |
| Empty | **16,865 lb (7,650 kg)** | DC-3A as delivered, airline interior. What "empty" includes is not stated | Francillon (via Wikipedia) | 0.5 |
| Empty, as tested | 16,822 lb (7,630 kg); useful load 8,378 lb; payload with full fuel 3,446 lb | a DC-3 flown by AOPA Pilot (1994); "specifications based on manufacturer's data" | AOPA Pilot, June 1994, "Flying the DC-3" (extract) | 0.6 |
| Basic empty | 17,345 lb (7,868 kg); max useful 7,855 lb | a 1990s-2000s DC-3C (another aircraft) | AOPA Pilot, Dec 2005, "70th anniversary of the DC-3" (extract) | 0.6 |
| Empty | 18,135 lb (8,226 kg) | C-47B (military equipment, cargo floor, big door) | Francillon | 0.5 |
| Fuel | 822 US gal (3,111 L) | DC-3A | Francillon | 0.5 |
| Oil | **not found** | | | — |

Reading: the DC-3A airline empty weight is **7,630-7,650 kg** (two independent sources within 20 kg). The 8,300 kg
upper bound in the current row is the C-47 / DC-3C range: a converted C-47 is heavier by 220-600 kg.

### 1.3 Group weight statement (the item the owner asked for most)

**No group weight statement could be read in this session.** Searched: Roskam *Airplane Design* Part V appendix (the
group-weight tables found cover other classes; no DC-3 row was visible), Torenbeek, NACA weight reports, SAWE papers,
Russian Li-2 «весовая сводка» (Li-2 = licence DC-3), the Douglas / Air Force weight-and-balance handbook
(AN 01-1B-40 Chart A for the C-47). The only online breakdown found is a **parametric calculation** on
aircraftinvestigation.info (it models a Wright Cyclone DC-3; its own text says calculated, not measured): grade 0.3.

What can be said with sources, and an estimate built around them:

| Group | Estimate lb | Range lb | Share of 16,865 lb | Anchors |
|---|---:|---:|---:|---|
| Wing (centre section, outer panels, ailerons, flaps) | 3,500 | 2,900-4,050 | 21 % | 1930s all-metal multicellular wing, ~13-16 % of gross; aircraftinvestigation (calc.) 1,837 kg = 4,050 lb |
| Tail (stab, elevators, fin, rudder) | 450 | 380-560 | 3 % | typical 1.5-2.2 % of gross |
| Fuselage (body structure) | 2,650 | 2,300-3,000 | 16 % | typical 9-12 % of gross. aircraftinvestigation's "fuselage total 2,856 kg (6,300 lb)" evidently includes the cabin and its equipment |
| Engine nacelles | 700 | 550-900 | 4 % | typical |
| Landing gear (main, tail, retraction) | 1,260 | 1,100-1,470 | 7 % | typical 4.5-5.8 % of gross; aircraftinvestigation (calc.) 665.5 kg = 1,467 lb |
| **Structure** | **8,560** | | **51 %** | |
| Engines, dry, 2 x R-1830-92 | **2,934** | | 17 % | **1,467 lb each: Smithsonian NASM (R-1830-92 object record) and Canadian Museum of Flight. Grade 0.9.** Wikipedia's 1,250 lb is the family's early dry weight |
| Propellers, 2 x 23E50 | 750 | 700-900 | 4 % | ~375 lb each complete with hub and pitch mechanism: forum figure (0.3) |
| Engine section, mounts, cowls, exhaust, accessories, oil system (tanks, coolers), fuel system (4 tanks, lines, pumps), controls, starting | 1,246 | 900-1,500 | 7 % | typical 0.3-0.5 x dry engine weight |
| **Power plant** | **4,930** | 4,600-5,200 | **29 %** | |
| Fixed equipment: flight controls ~350, hydraulics ~150, electrical ~550, instruments ~150, radio ~200, furnishings, seats, galley, lavatory, soundproofing ~1,300, heating and ventilation ~150, de-icing ~200, misc. ~325 | 3,375 | 2,900-3,800 | 20 % | airline DC-3A, 21 seats |
| **Empty** | **16,865** | | **100 %** | Francillon |

**Grade of the table: 0.3 (an engineering estimate).** Only the engine dry weight (0.9) and the empty total (0.5) are
sourced. The group split uses typical fractions for 1930s transports and is meant to say *where to look*, not to fit
to.

What it says for the ~1,170 kg shortfall of our build: **the power plant alone is ~2,240 kg** (engines and propellers
~1,670 kg of it, which is hard data) and **fixed equipment ~1,530 kg**. Those two are where to look first. A build that
has, say, 2 x 500 kg "engines" is short by more than 300 kg on the engines alone.

### 1.4 Drag

| Item | Value | Conditions | Source | Grade |
|---|---|---|---|---|
| CD0 | **0.0249** | clean, low speed | commonly quoted from Loftin, NASA SP-468 *Quest for Performance* (the per-aircraft table could not be opened: host blocked). Not verified here | 0.5 pending |
| (L/D)max | 14.7 | | same | 0.5 pending |
| Consistency check | 0.5·sqrt(π·9.14·e/0.0249) = 14.7 for **e = 0.75** | | derived | — |
| CD0, from top speed | **~0.025** | 230 mph at 8,500 ft (σ = 0.774), 2 x 1,050 hp, prop η 0.85, 25,200 lb, e 0.75: CD = 0.0282, CDi = 0.0028 → CD0 ≈ 0.0254 | derived | 0.5 |
| Equivalent flat-plate area | **f ≈ 24.6 ft² (2.29 m²)** | 0.0249 x 987 ft² | derived | 0.5 |
| Textbook value | CD0 ≈ 0.025, e = 0.7 (assumed) | Anderson, *Introduction to Flight* 8th ed., problem 6.40 (worked solution) | (extract) | 0.3 |
| Gear-down / flap increments, cowling cooling drag | **not found** | | | — |

### 1.5 Engine: P&W R-1830-S1C3-G (= R-1830-92 military)

| Item | Value | Source | Grade |
|---|---|---|---|
| Take-off | 1,200 hp at 2,700 rpm, 48.0 in Hg, **1 minute** limit | A-669 Rev 31 (extract) | 0.9 |
| Max continuous (METO) | 1,050 hp at 2,550 rpm: 41.5 in Hg at sea level, straight-line to 39.5 in Hg at **7,500 ft** (critical altitude) | A-669 Rev 31 (extract) | 0.9 |
| C-47B normal rating | 1,000 hp at 14,500 ft (two-speed blower variant -90C) | Francillon | 0.5 |
| Dry weight | 1,467 lb (666 kg) | NASM object record R-1830-92; Canadian Museum of Flight | 0.9 |
| Fuel grade | 91 octane minimum (S1C3G) | A-669 (extract) | 0.9 |
| Usual cruise setting | 30 in Hg / 2,050 rpm, auto-lean | douglasdc3.com "How to fly the DC-3", pilot guides (extract) | 0.3 |

### 1.6 Performance, with conditions

| Figure | Value | Weight | Conditions | Source | Grade |
|---|---|---|---|---|---|
| Vs1 (clean) | **67 KIAS** | not stated (AOPA spec boxes are at max gross 25,200 lb) | power off assumed | AOPA Pilot June 1994 (extract) | 0.6 |
| Vs0 (landing flap) | **62 KIAS** | same | same | AOPA Pilot June 1994 (extract) | 0.6 |
| Stall | 67 mph TAS, "basic" | table columns 26,000 / 29,000 / 31,000 lb, the extract garbled | C-47 Pilot Training Manual (AAF 51-129-2) via Scribd (extract) | 0.3 |
| Vmc | 77 KIAS | | one engine out | AOPA 1994 (extract) | 0.6 |
| Vmax | **230 mph (200 kt) at 8,500 ft** | gross (25,200) | max power | Francillon DC-3A (Wikipedia gives "223 kt", a transcription slip: 230 mph = 200 kt) | 0.5 |
| Vmax | 224 mph at 10,000 ft | C-47B, 26,000 lb | | Francillon | 0.5 |
| Cruise | **157 kt at 50 % power, 10,000 ft, 94 US gal/h** | not stated | TAS assumed (AOPA); Wikipedia restates it as "157 kt IAS" — if IAS, TAS ≈ 181 kt | AOPA 1994 (extract) | 0.6 |
| Cruise | 160 mph | C-47B | conditions unstated | Francillon | 0.5 |
| Cruise | 185 mph at 10,000 ft | | | Britannica (extract) | 0.5 |
| RoC, 2 engines, SL | **1,130-1,140 fpm** | 25,200 lb (gross) | rated power | Francillon DC-3A / Wikipedia | 0.5 |
| RoC, 2 engines, SL | **1,410 fpm at take-off power (1,200 hp); 1,220 fpm at METO (1,050 hp)** | **25,000 lb** | ISA SL | a C-47 flight-manual climb table quoted by search (excerpt; other weights on charts A4-32/33) | 0.6 pending |
| RoC, 2 engines | ~1,200 fpm at 110 kt, 35 in Hg, 2,350 rpm | **8,800 kg (19,400 lb)** estimated AUW, no load | OAT 9 °C, low altitude | Flight International, "Dakota skies" flight test (extract) | 0.6 |
| Time to climb | 10,000 ft in 9 min 30 s | C-47B, 26,000 lb | | Francillon | 0.5 |
| RoC, 1 engine, SL | **200 fpm** | gross | | AOPA 1994 (extract) | 0.6 |
| RoC, 1 engine, SL | 425 fpm | 25,000 lb | METO on the live engine | C-47 manual excerpt (as above) | 0.6 pending |
| RoC table 480 / 450 / 390 / 190 / 40 fpm at SL / 5 / 10 / 15 / 20 kft | weight not stated | probably METO at a heavy weight, or a cruise-climb power: **unresolved** | fsvintageair, from Ozark Airlines DC-3 handbook (1968) and USAF T.O. 1C-47 (1963/65) (extract) | 0.3 |
| Vy / Vx | 110 / 95 (kt IAS assumed) | | | fsvintageair (extract) | 0.3 |
| Service ceiling | 23,200 ft (DC-3A); 26,400 ft (C-47B); absolute 24,800 ft | | | Francillon; AOPA | 0.5 / 0.6 |
| Single-engine ceiling | 9,000 ft (AOPA); absolute 12,500 ft (AOPA 2005) | | | AOPA | 0.6 |
| Take-off / landing ground roll and over 50 ft | **not found with conditions** | | | (the AN 01-40NC-1 / T.O. 1C-47-1 charts: not reachable) | — |

**Conflicts and how they are read:**
- *Stall, 67 KIAS vs 67 mph.* At 25,200 lb, 67 kt needs CL 1.68 clean (plausible with an indicated-airspeed error at
  the stall); 67 mph would need CL 2.24 (not plausible clean at gross). The AOPA 67 / 62 KIAS pair is taken; the 67 mph
  is read as a C-47 figure at a light weight or with flap, or a mph/kt slip.
- *Two-engine climb, 1,130 vs 1,220 vs 1,410 fpm.* These are three power settings: rated (Francillon), METO and
  take-off power (manual excerpt), all at ~25,000 lb. The band 1,130-1,220 fpm is proposed for the gross-weight
  METO climb; 1,410 fpm is the take-off-power figure (1 minute limit on the TCDS: not a sustained climb).
- *Single-engine climb, 200 vs 425 fpm.* 200 fpm is the AOPA civil figure (at gross, prop feathered, likely with
  margins); 425 fpm is a C-47 manual figure at 25,000 lb. Kept as a band.
- *Cruise.* None is a 75 %-power figure. The AOPA cruise is 50 % power at 10,000 ft. The proposal adds it as a new
  indicator (`V50`, with `alt`) rather than forcing it into `V75`.

---

## 2. de Havilland DH.82A Tiger Moth (Gipsy Major I, 130 hp)

### 2.1 Geometry

| Item | Value | Source | Grade |
|---|---|---|---|
| Span | 29 ft 4 in (8.94 m), both planes | Bransom, *The Tiger Moth Story*; Jackson, *de Havilland Aircraft since 1909* (via Wikipedia); RAF Jever | 0.5 |
| Length | 23 ft 11 in (7.29 m) | same | 0.5 |
| Height | 8 ft 9 in (2.67 m) | same | 0.5 |
| Wing area | 239 ft² (22.2 m²), both planes together | same | 0.5 |
| Per-plane area, stagger, gap | **not found** | | — |
| Dihedral | upper ~2° (transcription unclear), lower 4° 30' | 1931 DH rigging guide, quoted in a forum (via the Aeroguide book) (extract) | 0.3 |
| Sweepback | 11 in top wing, 9 1/8 in bottom wing, measured at the interplane strut | same | 0.3 |
| Incidence | 4° both wings | same | 0.3 |
| Propeller | wooden, fixed pitch, 2 blades, ~6 ft 4-5 in (1.93-1.96 m), pitch ~4 ft 5-8 in | collectors' listings / wooden-propeller forum (extract) | 0.3 |

### 2.2 Weights

| Item | Value | Conditions | Source | Grade |
|---|---|---|---|---|
| Max all-up weight | **1,825 lb (828 kg)** normal; **1,770 lb (803 kg)** aerobatics | | Pilot's Notes (ABAC c.1950, RAF Jever transcript, extract); AAIB Bulletin 1/2019 | 0.9 |
| Empty | 1,115 lb (506 kg) | basic, not defined | Jackson / Bransom | 0.5 |
| Tare weight | **1,180 lb (535 kg)** | RAF tare (aircraft with its service fixed equipment) | Pilot's Notes via RAF Jever (extract) | 0.6 |
| Load sheet to 1,825 lb | tare 1,180 + crew of two with parachutes 400 + fuel 19 gal 142 + oil 2.1 gal 18 + stowage 85 | | same | 0.6 |
| Fuel | 19 imp gal (86 L), gravity tank in the centre section | (one AAIB bulletin says 18 gal) | Wikipedia; AAIB 9/98 | 0.5 |
| Oil | 2.1 imp gal (9.5 L) | | Pilot's Notes (extract) | 0.6 |
| Engine dry weight | ~300-322 lb (Gipsy Major 1F to 1D) | | Lumsden (via Wikipedia) | 0.5 |
| Component weights / weight breakdown | **not found** | | | — |

### 2.3 Engine and limits (Pilot's Notes, ABAC c.1950, via RAF Jever — extract, grade 0.6 until read in the original)

- Take-off and climb: 2,100 rpm max; maximum cruising 2,100 rpm (1 hour); diving 2,350 rpm for the Gipsy Major I / IF
  (2,400 IC, 2,500 IJ), 20 s.
- Maximum diving speed 160 mph (139 kt) IAS.
- Gipsy Major I rating: 130 hp at 2,350 rpm (130 hp quoted by every source; the 2,350 rpm is the Pilot's Notes'
  diving limit). The Gipsy Major family's cruise rating is 122 hp at 2,100 rpm (Wikipedia, Gipsy Major 10-series:
  grade 0.5, not the Mk I).

### 2.4 Performance, with conditions

**The best single source is AAIB Bulletin 1/2019 (G-ADXT, EW/C2017/08/03), pages 59-62: an official flight trial of
two UK Tiger Moths, flown by a test pilot, with weights and C.G. stated. Read in full here. Grade 0.9.**
- G-ACDI: take-off weight **1,760 lb**, C.G. 12.6 in aft; G-ANNG: **1,790 lb**, C.G. 13.7 in aft (anti-spin strakes).
- Take-off and initial climb at 2,100 rpm (G-ACDI) and 2,050 rpm (G-ANNG).

| Figure | Value | Weight | Conditions | Source | Grade |
|---|---|---|---|---|---|
| Take-off run | **300 m** | 1,760-1,790 lb | full power; surface, wind and temperature not stated (UK grass airfields) | AAIB 1/2019 Table 1 | 0.9 |
| Take-off run to "light on the wheels" | 200 m, then 40 KIAS | 1,790 lb (G-ANNG) | Old Sarum rwy 06, **dry grass**, calm, 15 °C, QNH 1026 hPa | AAIB 1/2019 p.61 | 0.9 |
| Airborne | 45-50 kt | not stated | ~2,000 rpm on the run | AAIB bulletin (another DH82A) | 0.9 |
| RoC, full power | **650 fpm** (G-ACDI, 2,100 rpm); 500 fpm (G-ANNG, 2,050 rpm) | 1,760 / 1,790 lb | stabilised climb at 66 mph (58 KIAS), low altitude | AAIB 1/2019 Table 1 | 0.9 |
| RoC, climbing turn | 580 fpm | 1,760 lb | full power | AAIB 1/2019 | 0.9 |
| Partial power, level/climb | **1,700 rpm: −20 fpm; 1,800: +20; 1,900: +200; 2,000: +400 fpm** | 1,790 lb | **66 mph (58 KIAS), density altitude 2,000 ft** | AAIB 1/2019 Table 2 | 0.9 |
| Glide | 860 fpm at 66 mph (in a descending turn); 1,200 fpm at the stall | 1,760-1,790 lb | throttle closed; 10° nose-down attitude for 66 mph | AAIB 1/2019 | 0.9 |
| Stall, idle | **40-45 mph**; the test pilot: typically **45-49 mph IAS** | 1,760-1,790 lb | power idle, stick fully back, no wing drop | AAIB 1/2019 | 0.9 |
| Stall (Pilot's Notes) | "Normal stall from a straight glide, engine off **40 mph (35 kt)**, engine on 30 mph (25 kt)" | not stated | period ASI | Pilot's Notes quoted in AAIB 1/2019 footnote 9 | 1.0 (quotation) |
| RoC | 673 fpm | gross implied | | Jackson / Bransom (via Wikipedia) | 0.5 |
| RoC | ~600 fpm | ~gross: 400 lb payload + full fuel | | IAOPA *General Aviation* Apr 2006 (extract) | 0.6 |
| Time to 5,000 ft | 7.5 min (≈ 667 fpm mean) | | | aeropedia (extract) | 0.5 |
| Vmax | 109 mph | gross | (sea level / 1,000 ft: not confirmed) | Jackson / Bransom | 0.5 |
| Vmax | 107 mph | | | Shuttleworth; aero-web (DH.82C) | 0.5 |
| Cruise | 90-93 mph | | probably 2,100 rpm (max cruising) | Jackson / aero-web | 0.5 |
| Cruise | 80 mph, ~6.6 imp gal/h | | | AAIB 9/98 (G-BALX; an AAIB estimate) | 0.9 (estimate in an official report) |
| Cruise | 70 kt (81 mph) at 6.5 gal/h | | | IAOPA 2006 (extract) | 0.6 |
| Normal cruise | 1,950 rpm, 33 L/h | | | operator spec sheet, VH-BCI (Australia) (extract) | 0.5 |
| Cruise | 67 mph | | | Wikipedia spec box — **an outlier** (other sources 80-93) | rejected |
| Climb speed | 60 mph (club handling notes); 66 mph (AAIB trials) | | | NZ Tiger Moth Club handling notes (extract); AAIB | 0.6 / 0.9 |
| Ceiling | 13,600 ft (Jackson); 14,600 ft (DH.82C); 15,800 ft (a pilot's article) | | | | 0.5 / 0.3 |
| Landing roll / over 50 ft | **not found with conditions** (no wheel brakes: the AAIB reject stopped in ~230 m from 40 KIAS on dry grass) | 1,790 lb | | AAIB 1/2019 | 0.9 (reject only) |
| CD0 / drag area | **not found** for the Tiger Moth (the Camel's 0.0378 / 8.73 ft² from Loftin is the nearest biplane datum) | | | | — |

**Conflicts and how they are read:**
- *Stall, 40 mph (Pilot's Notes) vs 45-49 mph (AAIB 2018).* 40 mph at 1,825 lb needs CL 1.87 (too high for this
  biplane); 45 mph needs 1.48. The Pilot's Notes figure is an indicated speed on a 1930s-40s ASI, which under-reads at
  the stall. The AAIB test pilot's 45-49 mph on modern-calibrated aircraft is taken as the band's top, and 40 mph as its
  bottom: **Vs1 40-49 mph IAS at 1,760-1,790 lb**, and the build should sit in the upper half of the band in CAS.
- *Climb, 500-673 fpm.* The same AAIB trial gave 650 fpm at 2,100 rpm and 500 fpm at 2,050 rpm: the static rpm the
  propeller lets the engine reach changes the climb by ~25 %. The band is kept whole, at 1,760-1,825 lb.
- *Cruise.* 80-81 mph at 1,900-1,950 rpm (modern operators, AAIB) and 90-93 mph at 2,100 rpm (period). There is no
  "75 % power" figure; the AAIB partial-power table is the better datum (level at 66 mph with 1,700-1,800 rpm).

---

## 3. What is still missing, and where it is

| Item | Where | Host / status |
|---|---|---|
| DC-3 group weight statement | Roskam *Airplane Design* Part V, Appendix A (check the transport tables); Douglas weight report for the DC-3 (Boeing archives); C-47 *Weight and Balance Data* AN 01-1B-40 Chart A (item weights); SAWE technical papers | books / aircorpslibrary.com (subscription) |
| A-669 TCDS full text (fuel, oil, airspeed limits, equipment weights) | FAA DRS; douglasdc3.com/faa/a-669.pdf (Rev 30); john2031.com (Rev 31) | drs.faa.gov, www.douglasdc3.com: **blocked here** |
| C-47 take-off / landing distances, climb vs weight, stall vs weight | AN 01-40NC-1 (5 Feb 1945), T.O. 1C-47-1 Appendix A (pages A4-32/33, A6-3/4) | app.aircorpslibrary.com (subscription); archive.org: **blocked here** |
| DC-3 CD0 / (L/D)max from Loftin | NASA SP-468, chapter 6/7 tables | www.hq.nasa.gov, ntrs.nasa.gov: **blocked here** |
| AOPA 1994 full spec box (take-off / landing distances) | aopa.org/news-and-media/all-news/1994/june/pilot/flying-the-dc-3 | www.aopa.org: **blocked here** |
| Tiger Moth Pilot's Notes in the original (AP 1835? — the RAF Jever transcript is the ABAC c.1950 edition; the AP number could not be confirmed) | rafjever.org/tigpic027.htm; archive.org scans | **blocked here** |
| Tiger Moth take-off / landing over 50 ft, per-plane areas, stagger, gap, prop | de Havilland Support Ltd type data; Tiger Moth Club (UK) handbook | — |

## 4. Sources

- AAIB Bulletin 1/2019, G-ADXT, DH82A Tiger Moth, EW/C2017/08/03 —
  https://assets.publishing.service.gov.uk/media/5f5a3eafd3bf7f7238f22feb/DH82A_Tiger_Moth_G-ADXT_01-19.pdf (read in full)
- AAIB Bulletin 9/98, G-BALX, DH82A — https://assets.publishing.service.gov.uk/media/5422ebfce5274a13170000cf/dft_avsafety_pdf_502449.pdf (read)
- AAIB bulletin, DH82A ditching — https://assets.publishing.service.gov.uk/media/5422eeb540f0b613420001f3/dft_avsafety_pdf_500813.pdf (read)
- CAA NZ Type Acceptance Report TAR 16/21B/17, Douglas DC3-S1C3G, Rev 0, 25 Sep 2018 —
  https://www.aviation.govt.nz/assets/aircraft/type-acceptance-reports/Douglas-DC3-S1C3G.pdf (read in full)
- FAA Aircraft Specification A-669 Rev 31 — https://www.john2031.com/douglas/dc-3/A-669.pdf (extract only)
- Wikipedia: Douglas DC-3 (spec block: Francillon 1988), Douglas C-47 Skytrain (Francillon), de Havilland Tiger Moth
  (Bransom 1991 p.261, Jackson 1966 p.13), de Havilland Gipsy Major (Lumsden 2003), P&W R-1830, Zero-lift drag
  coefficient (Loftin SP-468) — read via the wiki raw text
- Smithsonian NASM, R-1830-92 object record — https://www.si.edu/object/nasm_A19750478000 (extract)
- AOPA Pilot, June 1994, "Flying the DC-3" — https://www.aopa.org/news-and-media/all-news/1994/june/pilot/flying-the-dc-3 (extract)
- AOPA Pilot, Dec 2005, "70th anniversary of the DC-3" (extract)
- Flight International, "FLIGHT TEST: Douglas DC-3 - Dakota skies" — https://www.flightglobal.com/flight-test-douglas-dc-3-dakota-skies/71144.article (extract)
- fsvintageair DC-3 reference (Ozark DC-3 handbook 1968, T.O. 1C-47 1963/65) — http://www.fsvintageair.com/Aircraft-Handing-Notes/DC-3_ref.htm (extract)
- RAF Jever, Tiger Moth Pilot's Notes transcript — https://www.rafjever.org/tigpic027.htm and tigpic004.htm (extract)
- IAOPA *General Aviation*, Apr 2006, Tiger Moth — https://www.iaopa.eu/mediaServlet/storage/gamag/apr06/Tiger_moth.pdf (extract)
- VH-BCI Tiger Moth spec sheet — https://philunicombaviation.com/wp-content/uploads/PUA-VH-BCI-Tiger-Moth-Spec-Sheet.pdf (extract)
- aircraftinvestigation.info, Douglas DC-3 (parametric calculation) — http://aircraftinvestigation.info/airplanes/Douglas_DC-3.html (extract)
