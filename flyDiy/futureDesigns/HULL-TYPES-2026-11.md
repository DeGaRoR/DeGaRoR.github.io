# HULL-TYPES — flying-boat hulls and bodies, with variety, piloted by the cage (study, 3 Nov 2026)

The user (via A0, 3 Nov): *"I would also like that you have a look at the different types of hulls and bodies, so we
could also model these with variety."* — and the rule this study is built around:

> *"absolutely reuse existing controls from the cage. It's really important we don't veer off into a full new hull
> model. It can be full new, but piloted by the same inputs. In other words, we should be able to switch between boat
> hull and normal easily, with most controls shared between both body builders."*

STUDY ONLY: no game code changes. Base `origin/master` 05f95aa7. Sketches: `futureDesigns/hull-types/` (drawn by
`draw_hulls.js` from the proposed rows; `node futureDesigns/hull-types/draw_hulls.js` redraws them, `--table`
prints §3.4's table from the same objects).

**The answer in one paragraph.** The cage's ring already has what a boat hull needs. Its bottom is three vertices: the
two keel corners and a centre column (`C.keel`, `tools/_cage_gen.js:1271-1276`, the belly faces at `:1484-1485`).
`botRound` already moves the corners up an arc while the centre column stays at the keel height
(`_cage_gen.js:260-265`). A **V-bottom is the same move with a straight line instead of an arc**: the corners rise by
`botW·tan β` and become the **chine**, and the centre column becomes the **keel**. The frames' **bottom height** stays
the lowest point of the section in both modes, so the gear, the ground contact and the keel datum read what they read
now. The **step** is a tight ring pair, which is the cage's own pillar idiom. The **afterbody** is the
passenger/boom/tail frames' bottom heights, which already exist. So the hull is a **mode** (`hullOn`). It reads every
existing row in its old meaning and adds **eight boat rows** (deadrise ×3, step position and depth, steps count, spray
rail, keel pad). The physics flies **the drawn hull**: the join samples the cage's keel/chine/gunwale lines into a
station table, and 32_hydro's existing hull builder lofts its panels from that table instead of from its formula.
Lateral stability is **one discriminator with six options**. The hull form is **one starter with five presets**.

---

## 1. THE FAMILIES (web)

Sources: everything here comes from web-search summaries. The research could not open pages directly (the session's
network denied Wikipedia, NASA NTRS and the makers' sites at DNS). Every number carries the URL it came from. "?" means
not found. "(unsourced)" means read off photographs or from general knowledge and not verified. **Four corrections to
the reference list** came out of the research:
- the **Elitar Sigma** is a pod on strut floats, not a flying boat;
- the **LISA Akoya** has no planing bottom and no step (it sits on two hydrofoils);
- the **MVP Model 3** is a *tri-hull*;
- the **Adventurer 333** is American (Arkansas), not Brazilian, and rides on outrigger pontoons.

### 1.1 The reference list, classified

| aeroplane | hull form | afterbody / body | water stability | engine | L / span / MTOW | source |
|---|---|---|---|---|---|---|
| Icon A5 | single step, hard chine | cabin blended into the hull | **sponsons** ("Seawings", hydrostatic and hydrodynamic; the tips are designed with them) | pusher behind the cabin (unsourced) | 7.01 m / 10.61 m / 686 kg | [patent US8286912](https://patents.google.com/patent/US8286912), [globalair](https://www.globalair.com/aircraft-specifications/icon/icon-a5-specifications/1546) |
| Dornier Seastar CD2 (+ ORCA) | deep V widening into the sponsons | cabin hull, rising tail | **sponsons** ("two-stage", clear of the water at ~50 kt; fuel and mains inside) | 2 × PT6A push-pull on a pylon over the cabin | 12.7 m / 15.9-17.7 m (sources disagree) / 4,200 kg (1988) | [yachting](https://www.yachtingmagazine.com/?p=53328), [ADN](https://www.adn.com/bush-pilot/article/review-dornier-cd2-seastar/2009/09/15/), [all-aero](https://all-aero.com/2024/01/29/dornier-composite-sea-star), [ORCA](https://www.flyingmag.com/dornier-introduces-orca-amphibian) |
| Super Petrel LS / XP | single step, carbon monocoque | **hull tub, open frame and wings above** | small sponsons under the lower wing (early aircraft: tip floats) | pusher on a pylon under the upper wing | LS 6.25 m / 8.90 m / 600 kg; XP 6.43 m / 9.04 m / 649 kg | [AOPA](https://aopa.org/news-and-media/all-news/2024/july/pilot/super-petrel-xp-small-but-mighty), [Wikipedia](https://en.wikipedia.org/wiki/EDRA_Aeronautica_Super_P%C3%A9trel), [AOPA guide](https://www.aopa.org/go-fly/aircraft-and-ownership/aircraft-guide/aircraft/super-petrel-xp) |
| SeaMax M-22 | composite hull | cabin hull | sponsons/floats at the wing tips | pusher over the wing | 6.05 m / 10.2 m (Wikipedia: 8.75 m) / 649 kg | [Dan Johnson](https://bydanjohnson.com/pilotreport/airmax-seamax-elegant-engineering), [Plane & Pilot](https://planeandpilotmag.com/article/aircraft/specifications/seamax-specifications/) |
| Seawind 300C | single step (the 3000 changed hull and step) | cabin hull, rising tail | **drooped tips that float** (and act as endplates) | engine on the fin | 8.23 m / 10.67 m / 1,542 kg | [Wikipedia](https://en.wikipedia.org/wiki/Seawind_International_Seawind) |
| Beriev Be-103 | single step | cabin hull | **planing wing roots**: the gull/cranked low wing's roots displace water and plane (three planing elements: the step and both wing trailing edges) | 2 × pylon on the rear fuselage (unsourced) | 10.88 m / 12.7 m / 2,200 kg | [aircraft24](https://it-ch.aircraft24.com/multiprop/beriev/be-103-amphibious-aircraft--xi132584.htm), [EASA TCDS](https://www.easa.europa.eu/lv/downloads/7188/en) |
| Republic RC-3 Seabee | single step, all metal (unsourced detail) | cabin hull, rising tail | strut tip floats (unsourced) | pusher over the cabin | 8.5 m / 11.47 m / 1.3 t | [Cradle of Aviation](https://www.cradleofaviation.org/history/exhibits/exhibit-galleries/the_jet_age/republic_rc-3_seabee.html), [flugzeuginfo](https://www.flugzeuginfo.net/acdata_php/acdata_rc3_en.php) |
| LISA Akoya | **no step, no planing bottom**: a round fuselage underside | cabin body | **hydrofoils** ("Seafoils", outboard of the mains); tip floats optional | ? | 6.90 m / 11.0 m / 650 kg | [AOPA](https://www.aopa.org/news-and-media/all-news/2012/july/24/akoya-hydrofoil-amphib-makes-oshkosh-debut), [wikiwand](https://www.wikiwand.com/en/articles/Lisa_Akoya) |
| Flywhale FW650 (DS-2C) | single step | cabin hull | **sponsons** (mains retract into them; fuel too) | ? | 6.45 m / 9.0 m / 650 kg | [Wikipedia](https://en.wikipedia.org/wiki/Flywhale_Aircraft_Flywhale), [leaflet](https://dornierseawings.com/wp-content/uploads/2022/05/DS-2C-leaflet_May-2022.pdf) |
| AeroVolga Borey | boat hull | cabin hull | strut tip floats | ? | 6.95 m / 9.76 m / 560-650 kg | [airframer](https://www.airframer.com/program/borey), [Wikipedia](https://en.wikipedia.org/wiki/AeroVolga_Borey) |
| Avid Catalina | hull | cabin hull | wing floats (sponsons optional); the earlier **Avid Amphibian** used **turned-down tips as floats** | pusher | 5.91 m / 10.97 m / 544 kg | [Wikipedia](https://en.wikipedia.org/wiki/Avid_Catalina) |
| Elitar Sigma | **not a boat**: a pod below the wing, strut floats | — | float plane | ? | 6.19 m / 9.80 m / 540 kg | [Wikipedia](https://en.wikipedia.org/wiki/Elitar_Sigma) |
| Novotech Seagull | **trimaran** | cabin centre hull | the two outer hulls | hybrid | ? | [Reinforced Plastics](https://www.reinforcedplastics.com/content/news/carbon-fiber-hybrid-aircraft), [Glasgow thesis](https://theses.gla.ac.uk/4030) |
| MVP Model 3 | **tri-hull** | cabin centre hull | the side hulls | ? | 7.24 m / 10.97 m / 649 kg (cancelled) | [Flight](https://www.flightglobal.com/financing-slows-development-pace-for-mvp-seaplane/117746.article), [Plane & Pilot](https://planeandpilotmag.com/details-and-new-video-about-mvps-show-hit/) |
| Equator P2 Xcursion | hull | cabin hull | **"float wings"**: low wing roots, no side floats or sponsons | electric, in the tail | 6.80 m / 9.80 m / 750 kg | [Equator](https://equatoraircraft.com/Prototype.html), [CleanTechnica](https://cleantechnica.com/2018/07/17/the-equator-p2-xcursion-hybrid-electric-seaplane-makes-maiden-flight-in-norway/), [New Atlas](https://newatlas.com/amphibious-electric-aircraft-prototype-flight/59354) |
| KAMA-hydro (FP6 not confirmed) | ? | strut-braced high wing, composite | ? | ? | 6.30 m / 9.22 m / ? | [dlapilota](https://dlapilota.pl/wiadomosci/dlapilota/wodnosamolot-z-polski) |
| Osprey 2 | wooden hull | cabin hull | tip floats, built like the hull | pusher nacelle on a tube pylon | 6.25 m / 7.92 m / 708 kg | [Wikipedia](https://en.wikipedia.org/wiki/Osprey_Osprey_2), [aeropedia](https://aeropedia.com.au/?p=4182) |
| AeroVolga LA-8 | boat hull, foam-glass sandwich | cabin hull | high wing, watertight compartments | 2 engines | 10.80 m / 15.0 m / ? | [Wikipedia](https://en.wikipedia.org/wiki/AeroVolga_LA-8) |
| Dornier ORCA | the Seastar's hull (a mission variant) | — | sponsons | push-pull | (Seastar) | [Flying](https://www.flyingmag.com/dornier-introduces-orca-amphibian) |
| Che-27 (Che-25 family) | hull | fully glazed cabin | **fibreglass tips that are floats** | 2 over the wing leading edge | 7.70 m / 12.60 m / ? | [Wikipedia](https://en.wikipedia.org/wiki/Chernov_Che-25), [aviastroitel](https://www.aviastroitel.com/en/seaplanes/seaplane-che-27) |
| Nordic Omsider (Norway) | hull | cabin, T-tail | prototype 1 outrigger floats, prototype 2 stub wings | pusher | 6.9 m / 9.1 m / 495 kg | [Wikipedia](https://en.wikipedia.org/wiki/Nordic_Omsider), [all-aero](https://all-aero.com/2023/12/27/atec-omsider-nordic-omsider) |
| Volmer VJ-22 | plywood hull | cabin hull | floats at the wing ends | pusher on pylons over the wing | 7.32 m / 11.13 m / 680 kg | [Wikipedia](https://en.wikipedia.org/wiki/Volmer_VJ-22_Sportsman), [aeropedia](https://aeropedia.com.au/content/volmer-vj-22-sportsman/) |
| Che-22 Korvet | hull | parasol, short hull | **enlarged anhedral buoyant tips** (later with small hydrodynamic float extensions) | 1-2 over the wing leading edge | 7.25 m / 10.53 m / 650-750 kg | [Wikipedia](https://en.wikipedia.org/wiki/Gidroplan_Che-22_Korvet), [aeropedia](https://aeropedia.com.au/content/gidroplan-che-22-korvet/) |
| Atol 650 | Kevlar over a foam-core birch hull | cabin hull | ? (mains retract into wing pods) | pusher | 7.45 m / 9 m / 650 kg | [aeropedia](https://aeropedia.com.au/content/atol-avion-650-lsa/) |
| WetAero M6 / CZAW Mermaid | composite hull | cabin hull, cruciform tail | ? | pusher on a pylon over the wing | ? / 9.5 m / 650 kg | [Wikipedia](https://en.wikipedia.org/wiki/CZAW_Mermaid), [globalair](https://www.globalair.com/aircraft-specifications/czech-aircraft-works/lake-sport-mermaid-specifications/1640) |
| Adventurer 333 (USA) | boat hull | pod-mounted pusher, cruciform tail | **outrigger pontoons** | Chevrolet V6 pusher | 7.77 m / 10.92 m / 1,512 kg | [Wikipedia](https://en.wikipedia.org/wiki/Adventure_Air_Adventurer) |
| Vickers Wave | carbon hull | cabin hull | **hydrofins** (outboard stabilisers, 4 in of travel) | pusher | 7.5 m / 9.4 m / 839 kg | [aeroexpo](https://aeroexpo.online/prod/vickers-aircraft-company-ltd/product-181876-37534.html), [Wikipedia](https://en.wikipedia.org/wiki/Vickers_Aircraft_Wave) |
| Aventura II | hull | high-wing pusher, short hull with a tail boom (unsourced) | ? (a "canard sponson", unverified) | pusher | 7.0 m / 9.35 m / 649 kg | [Wikipedia](https://en.wikipedia.org/wiki/Aero_Adventure_Aventura), [Plane & Pilot](https://planeandpilotmag.com/its-winter-so-lets-talk-seaplanes-aero-adventures-affordable-amphibious-aircraft/) |
| SeaRey | fibreglass **hull tub** | the hull rising to the tail (unsourced) | strut floats (rotocast) | pusher on a pylon over the wing | 6.83 m / 9.40 m / 683 kg (LSX) | [Plane & Pilot](https://planeandpilotmag.com/searey-lsx-skyboat-extraordinaire/), [Wikipedia](https://en.wikipedia.org/wiki/Progressive_Aerodyne_SeaRey) |

**The classics**

| aeroplane | hull | stability | L / span / MTOW | source |
|---|---|---|---|---|
| PBY-5A Catalina | single step | **retracting tip floats** that form the wing tips (3.15 × 0.61 m) | 19.5 m / 31.7 m / 16.1 t | [pbycatalina.com](https://pbycatalina.com/specifications/) |
| Grumman Goose G-21A | two steps stated for its relatives (G-64, Mallard), unconfirmed on the Goose; the hull was modified for spray | strut tip floats | 11.7 m / 14.9 m / 3.6 t | [airvectors](https://airvectors.net/avgoose.html), [NASM](https://si.edu/object/grumman-g-21-goose:nasm_A19840405000) |
| Grumman Widgeon G-44 | ? | strut tip floats (unsourced) | 9.5 m / 12.2 m / 2.05 t | [aeropedia](https://aeropedia.com.au/content/grumman-g-44-widgeon/) |
| Lake LA-4-200 | short single step, "no deep V", prone to porpoising; keelson boosters, "batwing" root fillets | strut tip floats (which also carry fuel) | 7.6 m / 11.6 m / 1.22 t | [planephd](https://planephd.com/research/lake-la-4), [Wikipedia](https://en.wikipedia.org/wiki/Lake_Buccaneer) |
| Dornier Wal | **two steps** | **sponsons** (Dornier's patented stubs) | 17.25 m / 22.5 m / 5.6 t | [naval-encyclopedia](https://naval-encyclopedia.com/naval-aviation/ww2/germany/dornier-do-j-wal.php) |
| Short Sunderland V | main step (sources say single; an aft step is unsourced) | strut tip floats, wire braced | 26.0 m / 34.4 m / 29.5 t | [uboat.net](https://uboat.net/allies/aircraft/sunderland.htm), [aeropedia](https://aeropedia.com.au/content/short-s-25-sunderland/) |
| Grumman HU-16B Albatross | ? | strut tip floats | 19.2 m / 29.5 m / 17 t; hull ~2.4 m wide | [thisdayinaviation](https://www.thisdayinaviation.com/tag/grumman-hu-16-albatross/), [airplanes-online](https://airplanes-online.com/hu16-albatross.htm) |

### 1.2 The axes, and what the list actually contains

Five axes, and what this list puts on each:

- **Hull form.** The references are almost entirely **single-step V boats**.
  - **Two steps**: the Dornier Wal (sourced), possibly the Goose and the Sunderland (unconfirmed). NACA rated the
    "English-type" two-step hull "somewhat inferior" to a single step ([NTRS 19930081261](https://ntrs.nasa.gov/citations/19930081261)).
  - **Stepless**: the LISA Akoya, which sits on foils.
  - **Flat-floored "bass-boat" bow**: no reference was confirmed, and no number was found. It stays a capability,
    not a family.
  - **Hard vs soft chine**: every modern composite boat in the list is hard-chined. No reference was confirmed as
    soft-chined.
  - **Spray rails**: Lake's keelson boosters and the Goose's spray modification are the sourced examples.
  - **Flared chines**: no sourced figure.
- **Afterbody.** Two forms:
  - a **rising tail cone** from a long cabin hull (the classics, Seawind, Icon, Borey, Mermaid, Atol);
  - a **short hull with a slender tail boom** (Che-22, Aventura II, Adventurer 333, and SeaRey/Super Petrel, where the
    hull itself narrows into the boom). The boom forms are read off photographs (unsourced).
- **Body.** Two forms:
  - a **cabin blended into the hull** (most);
  - a **hull tub with an open frame and the wings above** (Super Petrel LS/XP sourced, SeaRey's tub).
- **Multi-hull.** Novotech Seagull (trimaran) and MVP Model 3 (tri-hull) are confirmed. The Adventurer 333 and
  Omsider prototype 1 have outrigger pontoons, which are the same thing at a smaller size.
- **Water stability**, six devices:
  - **strut tip floats**: Seabee, Borey, Osprey, VJ-22, SeaRey, Lake, the Goose, Widgeon and Albatross, the
    Sunderland, and the Catalina (retracting);
  - **sponsons**: Icon, Seastar/ORCA, Flywhale, Wal, Super Petrel, Omsider 2;
  - **planing wing roots**: Be-103, Equator P2;
  - **drooped buoyant tips**: Che-22, Che-25/27, Seawind 300C, Avid Amphibian;
  - **hydrofins and hydrofoils**: Vickers Wave, LISA Akoya;
  - **outrigger hulls**: Seagull, MVP, Adventurer 333.

### 1.3 Typical numbers (cited; what the rows' ranges should hold)

| quantity | value | source |
|---|---|---|
| hull length / beam | NACA series ran L/b 6-15. A higher L/b gives less air drag, the same spray, a lower hump and a higher load coefficient. Model 35 is 6.15. No published figure for light amphibians. | [NACA TN 1686](https://ntrs.nasa.gov/api/citations/19930093045/downloads/19930093045.pdf), [NTRS 20090026293](https://ntrs.nasa.gov/api/citations/20090026293/downloads/20090026293.pdf) |
| deadrise at the step | 15-25° tested. 15 → 25° changed planing resistance little. Going to 24.5° raised resistance and trim moments. The bow is deeper than the step. | [NACA TN 551 set](https://ntrs.nasa.gov/api/citations/19930081252/downloads/19930081252.pdf) |
| step depth | conventional 5-10 % of beam, typically 8 %. 13 % was needed for landing stability with a constant-deadrise afterbody. Longer afterbodies need deeper steps. A near-zero step is unstable. | [NTRS 19930081263](https://ntrs.nasa.gov/api/citations/19930081263/downloads/19930081263.pdf) |
| afterbody keel (sternpost) | 4° vs 9° compared. A smaller angle rides higher. The forebody-to-afterbody keel angle is ~1° more than the afterbody's. One L/b 9 model used 5.4°. EDO floats: 8° heel. | [NTRS 19930081350](https://ntrs.nasa.gov/api/citations/19930081350/downloads/19930081350.pdf), 19930081263 above |
| forebody / afterbody | the L/b 10 parent ran afterbodies of 4.12 and 6.63 beams | 19930081263 above |
| reserve buoyancy | hull 70-100 %; twin floats 80-100 % surplus (each float ~90 % of the gross) | [globalsecurity](https://www.globalsecurity.org/military/systems/aircraft/flying-boat-design.htm), [NTRS 19930082208](https://ntrs.nasa.gov/api/citations/19930082208/downloads/19930082208.pdf), [AOPA](https://aopa.org/news-and-media/all-news/2018/may/flight-training-magazine/what-am-i-floats) |
| tip float | a **moment** rule, not a volume: a submerged tip float's righting moment = 2 × the upsetting moment of the heeled CG. NACA TN-215 says every boat except Dornier stub types needs tip floats. No %-of-gross figure found. | [Notes on seaplane design](https://core-prod.cambridgecore.org/core/services/aop-cambridge-core/content/view/7F1E4A43EE3DF7D451456986D3FCBD52/S2976693100000727a.pdf/notes-on-seaplane-design.pdf), [TN-215](https://www.abbottaerospace.com/?p=25255) |
| sponsons | "the usual method" in the 1936 NACA tests; the Do X needed them. Span and immersion: no figure found. | [NTRS 19930081428](https://ntrs.nasa.gov/api/citations/19930081428/downloads/19930081428.pdf) |
| our own float, for comparison | deadrise 22° at the step, 30° at the bow, 18° aft; step depth 0.075 m on a 0.57 m deck (13 %); afterbody keel 6.5° (NACA families 5.5-8.5) | `src/core/32_hydro.js:171-175` |

**What the numbers tell the design.** The tip-float rule is a moment, so the tip float's size row should be stated
as **righting moment ÷ upsetting moment** (target 2), not as a volume. The step-depth row's range should be 4-15 % of
the chine beam. The afterbody angle should be 4-9°.

---

## 2. OUR MODEL (read, not changed)

### 2.1 The cage fuselage ring
- **Six levels, keel to roof.** `keel, floor, waist, band, ceil, roof`, plus two guard levels (`_cage_gen.js:15-18`,
  index table `:194`).
- **The ring as built** (`fullRing`, `_cage_gen.js:270-301`):
  - keel corner at `(Wk, keelY)`;
  - floor on the keel→waist wall (`wallT`, `:290`);
  - waist at `(Ww, yW)` (the widest line);
  - band and ceil derived from the waist and roof widths (`:221-223`);
  - roof at `(Wr, roofY)`.
- **Centre columns.** The roof and keel have one, `C`, emitted at `yC` (`mkIds`, `:1265-1277`). **The belly is two
  faces, keel corner → centre → keel corner** (`:1484-1485`). That third vertex is the deadrise's handle.
- **Roundness.** `roundTop` (`:231-268`): `topRound` puts the roof/ceil on a waist→crown arc. `botRound` moves the
  keel corners and the floor up an arc from the waist to the keel crown, and the crown (the centre column) stays at
  the keel height (`:260-265`). A ring may carry its own `botRound` (`:236`).
- **The flat belly is a crease.** `crKeel` creases the keel rail so the panel between the corners stays a plane
  (comment `:1490-1499`, applied at `:1500`). Default 0 (`:7148`: G362, "it squared every saved aeroplane"). `botRound`
  fades the crease out.
- **Frames: seven, nine rows each** (T2.1, `CAGE_PARAMS :7303-7348`, `CAGE_FRAME_KEYS :7519`): nose, windscreen,
  door-post, cabin, passenger, boom, tail. Each frame has top/waist/bottom × height/half-width/fore-aft, in absolute
  metres. `null` = follow the reference section. A deviation moves the levels rigidly: bottom = keel + floor (`dimF`,
  `:396-406`). The boom frame's top/bottom heights are `aftRoofY/aftKeelY`, the tail's are
  `tailRoofY/tailKeelY/tailHalfW` (`:7535-7540`).
- **The panel** (`tools/_cage_page5.js`):
  - reference section `roofY/keelY/waistY/halfW/roofHalfW` (`:208-212`);
  - every frame's rows (`:213-333`, e.g. `frCabBotY :254`, `aftKeelY :298`, `tailKeelY :320`);
  - the passenger run's profile (ease/bias/bulge, `:278-288`);
  - longerons `bandH/crKeel/...` (`:337-344`);
  - rings `topRound/botRound/topAngCeil/topAngRoof` (`:349-356`).
- **The nose rows**: `noseLen` (`:221`), `noseDroop` (`:411`), `noseTipV`, the vertical tip collapse that raises the
  keel to the deck line (`:422`), `noseFinish` (`:441`) / `aeroNose` (the round body's full rings, `:449`) and its `aero*`
  rows (`:450-456`), `cowlLoops/cowlEase/cowlEaseBot/noseDome` (`:461-469`).
- **Rod & pod**: `boomStyle 1` + `taperOn`, `rodY/rodD/rodIncl` (`:1132-1140`, defaults `_cage_gen.js:7201-7202`). The
  pod ends at the aft bulkhead, and the rod carries the tail.
- **Twin booms**: `boomTwin` + the loft rows `boomX/boomDy/boomDz/boomWf...boomTailCap` (`:1055-1099`, defaults
  `_cage_gen.js:7207`).
- **The aero aft**: `aeroAftOn/Len/Droop/Tip/Shape/Edge` (`:1116-1131`).
- **The cockpit openings**: `cpOpen` / `paxOpen1-4` (`:558-566`). **The covering**: `skinOn` (`:370`).
- **The parts tree** (`tools/_cage_parts.js`): Fuselage (`:262`, groups reference section / longerons / roundness),
  Boom (`:539`), Tail cone (`:564`).
- **The tiles** (`tools/_cage_design.js`):
  - `section` (Box / Round top / Round bottom / Round), a starter that writes `topRound/botRound` (`:1266-1283`);
  - `boomStyle` (Lofted skin / Rod & pod, `:1213-1231`);
  - `booms` (Single / Twin, `:1236-1251`);
  - `covering` (`:1254-1264`);
  - `gearLayout` (Taildragger / Tricycle / **Floats**, `:1740-1789`; Floats writes `s1On 0, s2On 0, gearFloats 1`);
  - `wgTip`, which already has **Drooped** (`:1358-1366`; `GEN_TIPS.drooped`, `droop: 0.14` tip chords,
    `src/core/60_gen_spec.js:2613`).

### 2.2 The float hull generator (`src/core/32_hydro.js`)
- **`DEF`** (`:166-232`): the Wipline family.
  - `L, xs` (step from the bow), `B` (deck width at the step), `H`;
  - `beta / betaBow / betaA` (deadrise at the step, the bow, the afterbody);
  - `hs` (step depth), `aftAngle / aftCurve / aftHold / aftPow` (the afterbody keel and plan);
  - `flatK / stemK / rake / noseR / sheerK / planK` (the forebody keel flat, the stem, the deck sheer, the plan
    fullness);
  - `bStern`, `flare`, `bevel`;
  - the drawn details `railW/railT` (the chine spray strap), `keelW/H`, `skZ/W/H`, which are **drawing only**: the
    physics never reads them (they appear only in `FLOAT_METRIC` / `FLOAT_SPEC_KEYS`, `:1694`, `:1770`);
  - the water rudder `wrArea / wrDepth`;
  - the masses, then the model's constants (`Cpl, kBeta, kTr, dVent, Cd, kw, CpBase, kSide...`).
- **The keel line** (`keelTable`, `:277-305`): a straight flat ahead of the step, then a Bezier rocker tangent to a
  raked stem. The deck has a sheer (`deckAt :310`), and the plan is `planF` (`:319`).
- **The section** (`sectionOf :325-367`):
  - keel `yk`, chine half-beam `b`, deadrise warped as `t^2.5` toward the bow (`:338`);
  - the chine `yc = yk + b tan β`;
  - deck `yd`, deck edge `bd` (flare).
  - **K / C / E / D** (`secPoly :372-375`): keel, chine, the chamfer foot, the deck edge. The physics loft and
    `levelVolume` both read exactly this polygon.
- **`makeFloat`** (`:377-505`):
  - stations crowd to the bow;
  - **one step**: the face is built where the station's body flips F→A (`:413-431`);
  - bottom panels `bottomF/bottomA`, then side / bevel / deck, a bow cap and a transom (`:444-453`);
  - every panel is planar (quads split);
  - the step edge `{K, Cm, Cp}` (`:484`) is what `hydroPanels` ventilates (`:703-720`);
  - the trailing-edge fade and the leading-edge tables are kept **per body F / A** (`:861-890`).
  - **One step is structural**, not a parameter.
- **The joint to the aeroplane**:
  - `hydroBuild` (`:1504-1529`) makes one record per `def.parts.floats` entry;
  - `tetraCtx` (`:1425-1503`) rides the panels on four frame nodes and distributes forces over a **slab table**. Each
    station is three nodes (keel, two deck edges), and a force goes to the six nodes of its slab (`:1445-1496`).
  - The frame builds **exactly two** floats (`for (const sd of [-1, 1])`, `src/core/61_gen_frame.js:2626`), with
    spreader bars between `FL` and `FR` (`:2695-2696`).
- **The float rows** (`tools/_cage_float.js`):
  - `gearFloats`, `fltPreset` (the Wipline starter);
  - the hull rows `fltL / fltStep / fltB / fltH / fltBeta / fltBetaBow / fltBetaA / fltHs / fltAft / fltAftCurve /
    fltFlat / fltStem / fltRake / fltNoseR / fltPlan / fltStern / fltFlare / fltMass` (`:118-137`);
  - placement `fltZ` (from the 12° step rule, `:438`), `fltDrop`, `fltInc`, `fltTrack` (`:138-143`);
  - the struts (`:144-150`);
  - `hullParams` maps the rows onto `HYDRO.scaleParams` (`:157-173`).

### 2.3 The wet body (`wetBuild`, `32_hydro.js:2035-2131`)
- **The fuselage is a box.** It is lofted from the frame's stations `F[k].{BL, BR, TL, TR}`: bottom, two sides, top,
  the firewall and the tail cone (`:2055-2085`). It is a flat bottom, and the slam floors a face's deadrise at
  `WB_BETA_MIN` 10° (`:1910`).
- **The wings are paddles plus buoyant slabs** (`WB_WING :1906`, `:2086-2106`). Flooding is by material (`WB_MAT`).
- **It turns itself off when floats exist** (`:2036`). A hull aircraft would lose its cabin's and wings' buoyancy in a
  capsize unless that changes (see §3.5).

**Reading for the proposal.** The cage's ring and the float's section already line up level for level:

| cage level | float section |
|---|---|
| keel centre column | `K` |
| keel corner | `C` (the chine) |
| floor on the wall | the side |
| waist | `E` / `D` (the deck edge) |

The deadrise is the only missing number. The float generator already holds everything a single-step hull's physics
needs. What it lacks is a way to take its stations **from a table** instead of from its own formula.

---

## 3. PROPOSAL — the hull as a mode of the fuselage

### 3.1 The switch
- **One key, `hullOn`** (0 / 1), on the **Fuselage** part.
- **The tile.** A discriminator tile **"Body: Fuselage | Boat hull"** in `_cage_design.js`, beside `section`.
  The Undercarriage tile gains a fourth option, **Hull**, which writes `hullOn 1, s1On 0, s2On 0` (the Floats
  option's pattern, `_cage_design.js:1779-1788`). Amphibian wheels are A0's S4/S5.
- **Switching is lossless.** `hullOn 0 → 1 → 0` touches no shared row. The boat rows are kept while hidden (`when:
  P => +P.hullOn`), so a builder can flip back and forth.
- **`hullOn 0` is bit-identical** to today: GATE FIT and the displayed-mesh hash, the same identity standard as
  `fullRing`'s note at `_cage_gen.js:279-280`.
- **A hull build has no strut floats**: `hullOn` and `gearFloats` are exclusive, except for outriggers (§3.6).

### 3.2 The reading (how the shared rows build a hull)
At every ring, in hull mode:

| point | normal mode | hull mode |
|---|---|---|
| **bottom height** (`keelY`, `fr*BotY`, `aftKeelY`, `tailKeelY`) | the lowest point: the flat belly | **the lowest point: the KEEL** (the centre column `C.keel`). The gear, the ground and the keel datum read the same number. |
| **keel corners** `(botW, botY)` | the lower longerons | **the CHINE**, at `(botW, botY + botW·tan β)`, raised exactly as `botRound` raises them up its arc |
| floor | on the keel→waist wall | on the **chine→gunwale** wall: the topsides. **The flare is the shared rows' own**: `atan((waistW − botW) / (waistY − chineY))`. No flare row. |
| waist | the widest line | **the gunwale / sheer**, the deck edge of the hydro hull |
| band, ceil, roof, windows, doors | unchanged | unchanged (the cabin over the hull) |
| `crKeel` | the flat belly's crease | **the chine's crease** (hard chine). The hull starter writes 3. Lowering it softens the chine. |
| `botRound` | the round belly | **a soft chine**: the corner rounds, the V stays |
| the centre column | uncreased | **creased automatically** (a V must stay a V under Catmull-Clark: the keel line). Not a row. |

- **The step** is a **tight ring pair** at `hullStepZ`. This is the pillar idiom (`_cage_gen.js:21-24`): the fore
  ring is the interpolated section, and the aft ring's keel and chine are `hullHs` higher. The pair is creased like a
  frame (`crFrame`). The aft keel fades into the next frame's own bottom height, so **the afterbody keel line is the
  passenger / boom / tail frames' bottom heights**. These are shared rows: the afterbody angle the panel shows is a
  *readout* off them, with the NACA 4-9° band beside it (§1.3), not a new control.
- **The bow** is the nose rows:
  - `frNoseBotY` and `noseTipV` raise the keel to the stem;
  - `noseLen` is the forebody's length forward of the windscreen;
  - `noseDroop` sets the stem's line;
  - `aeroNose` + `cowlLoops` / `cowlEase(Bot)` set the bow's fullness.
  - The deadrise **warps toward the bow** by 32_hydro's own law (`t^2.5`, `:338`) to `hullBetaBow`.

See **`hull-types/same_values_normal_vs_hull.svg`**: one set of frame rows drawn with `hullOn 0` and `hullOn 1`.

### 3.3 Shared rows vs boat-only rows

**SHARED** (existing cage inputs that keep their meaning in hull mode):

| row(s) | where | meaning in hull mode |
|---|---|---|
| `roofY keelY waistY halfW roofHalfW` | reference section, `_cage_page5.js:208-212` | the hull's reference section (`keelY` = the keel) |
| every frame's `TopY / WaistY / BotY`, `TopW / WaistW / BotW`, `TopZ / WaistZ / BotZ` (nose, win, post, cab, pax, boom, tail) | `:213-333` | top = cabin; waist = gunwale; bottom = keel height, bottom width = chine half-beam; flare falls out of waist vs bottom widths |
| `aftKeelY`, `tailKeelY`, `tailHalfW`, `aftRoofY`, `tailRoofY` | `:298`, `:320` | the afterbody keel line rising to the tail (the sternpost angle) |
| `frPaxProfile / Ease / Bias / BulgeH / BulgeW / Loops` | `:278-288` | the afterbody's run from the step aft |
| `pilotLen paxLen paxCount boomLen tailLen taperOn taperLen` | stations | the hull's length, and where the step can sit |
| `topRound` | `:349` | the cabin's roundness (unchanged) |
| `botRound` | `:350` | the chine's softness |
| `crKeel` | `:340` | the chine's crease (hard chine) |
| `bandH crSill crCeil ceilInset ringPullIn` | `:337-344` | unchanged |
| `noseLen noseDroop noseTipV aeroNose aeroWsLen aeroLen aeroTipW/H aeroDroop aeroRound cowlLoops cowlEase cowlEaseBot cowlBulge noseDome` | `:221`, `:411-469` | the bow: forebody length, stem line, bow fullness |
| `boomStyle rodY rodD rodIncl` (Rod & pod) | `:1132-1140` | **pod hull on a boom**: the hull ends at the pod's bulkhead (the transom), and the rod carries the tail clear of the water |
| `boomTwin boomX boomDy boomDz boomWf...boomTailCap` (twin booms) | `:1055-1099` | unchanged (twin-boom boats: the pod is the hull) |
| `aeroAftOn / Len / Droop / Tip / Shape / Edge` | `:1116-1131` | the pod hull's tail fairing above the transom |
| `cpOpen paxOpen1-4 openCut ...`, `skinOn` | `:558-566`, `:370` | the open cockpit; the hull tub (see `hullTub` below) |
| windows, doors, canopy, fittings, livery | — | unchanged |

**BOAT-ONLY** (new, shown only with `hullOn 1`; eight rows, plus three that switch on a capability):

| row | label | range (from §1.3) | default | read by |
|---|---|---|---|---|
| `hullBeta` | deadrise at the step ° | 0-35 | 22 | cage (chine rise) + physics |
| `hullBetaBow` | deadrise at the bow ° | 15-50 | 36 | cage + physics (the `t^2.5` warp) |
| `hullBetaA` | deadrise aft of the step ° (expert) | 0-30 | 18 | cage + physics |
| `hullStepZ` | step fore/aft, from the rule | ±1.5 m | 0 = 12° aft of the CG (the float's rule, `_cage_float.js:438`) | cage (the ring pair) + physics |
| `hullHs` | step depth | 0.02-0.20 m (the readout shows % of the chine beam, target 5-10 %) | 0.07 | cage + physics |
| `hullSteps` | steps | 0 (stepless) / 1 / 2 | 1 | cage + physics |
| `hullStep2Z`, `hullHs2` | the rear step's station and depth (with `hullSteps 2`) | — | — | cage + physics |
| `hullRail` | spray rail width (0 = none) | 0-0.06 m | 0.03 | drawing strip + a 0° planing strip |
| `hullPad` | keel pad half-width (a flat floor ahead of the step; 0 = a sharp V) | 0-0.3 m | 0 | cage (a split keel column) + physics |
| `hullTub` | skin to the gunwale only (an open frame above) | 0/1 | 0 | cage (covering by level) + wet body |

Water rudder: `fltRudder`'s blade on the transom, sized by `wrArea / wrDepth` (32_hydro already reads them, `:198-199`)
— a part, not a hull row.

### 3.4 The presets (one starter, "Hull form", writes ONCE, the `fltPreset` / `engPreset` pattern)

Five options, each one a different family of aeroplane. Each writes the boat rows and a few shared rows. The frame
rows are left to the builder, except where a family's shape *is* a frame fact (the pod's short hull). Values in
metres for a ~7 m two-to-four-seat amphibian. The sketches use these exact objects (`draw_hulls.js FAMILIES`).

| preset | like | boat rows it writes | shared rows it writes | sketch |
|---|---|---|---|---|
| **Classic V** | Seabee, Lake, Widgeon, Albatross, PBY, Borey, VJ-22, Osprey 2, Seawind, Mermaid, Atol | β 22 / bow 38 / aft 18°, step 0.07 m (7 % beam), 1 step, rail 0.03 | `crKeel 3`, `botRound 0`, `topRound 0.6`, `boomStyle 0` | `family_classicV.svg` |
| **Two-step** | Dornier Wal (Goose and Sunderland unconfirmed) | as Classic + rear step at the boom frame (5.0 m), 0.05 m deep | as Classic; boom frame bottom 0.24 (a longer, flatter afterbody) | `family_twoStep.svg` |
| **Pod & boom** | Che-22, Aventura II, Adventurer 333 | β 20 / 36 / 16°, step 0.06 m | `boomStyle 1` (Rod & pod), `taperOn 1`, `rodY` over the waterline, `topRound 1`, `crKeel 3`; pax/boom/tail frames closed into a short hull | `family_podBoom.svg` |
| **Open tub** | Super Petrel LS/XP, SeaRey | β 18 / 34 / 15°, step 0.06 m, no rail, `hullTub 1` | `boomStyle 1`, `cpOpen 1`, `topRound 0` | `family_tubOpen.svg` |
| **Stepless (foils)** | LISA Akoya | β 0, `hullSteps 0` | `botRound 1`, `crKeel 0`, `topRound 1`. Pairs with **Hydrofins**. | `family_stepless.svg` |

Not presets (rows only, no confirmed reference): **soft chine** (`botRound` in hull mode, `family_roundChine.svg`) and
the **keel pad** (`hullPad`, `family_padBow.svg`). **Trimaran** is a stability option on any preset
(`family_trimaran.svg`).

**Water stability** is a separate **discriminator**, "On the water, held up by", with six options. It decides which
parts exist (`water_stability.svg`):

| option | like | its rows | built from |
|---|---|---|---|
| Strut tip floats | Seabee, Borey, SeaRey, Lake, the classics; PBY retracting | station (fraction of semispan), size as **righting ÷ upsetting moment** (target 2, §1.3), strut drop | a small HYDRO float record (N records, A0's S2) on wing struts |
| Sponsons | Icon, Seastar, Flywhale, Wal, Super Petrel | span, chord, height over the chine, dihedral | a stub with a flat planing bottom: a HYDRO record, plus an aero strip (Seastar's sponsons fly) |
| Planing wing roots | Be-103, Equator P2 | none: low wing, root at the chine (`wgPos` low + a "root planes" flag) | the root strips' lower surfaces get planing panels |
| Drooped buoyant tips | Che-22, Che-25/27, Seawind, Avid Amphibian | the **existing** `wgTip: drooped` (`GEN_TIPS.drooped`), its `droop` as a row (0.14 → ~0.6 tip chords), tip volume | a closed tip volume: a buoyant slab (the `WB_WING` idea) |
| Hydrofins | Vickers Wave, LISA Akoya | span, chord, height | a foil in water: the strip lift law at water density |
| Outrigger hulls | Novotech Seagull, MVP Model 3, Adventurer 333 | **the existing float rows** (`gearFloats`, `fltL`, `fltTrack`...) at a small size and a wide track | the float layer with the hull: the one place `gearFloats` and `hullOn` coexist |

### 3.5 What the physics reads — the drawn hull is the flown hull
1. **The join measures the hull** (`tools/_cage_join.js`, the G54.1 profile idiom). It samples the built cage's
   **keel line, chine line and gunwale line** at N stations: per station, the keel `yk`, chine half-beam `b`,
   deadrise `β`, gunwale `yd` and gunwale half-width `bd`. It also records the step(s)' x and depth. All of this goes
   into a station table, `spec.fuselage.hull = { sta: [...], steps: [{x, hs}], ... }`, in metres in the frame's axes.
2. **`makeFloat` lofts from a table.** `sectionOf(P, x)` gains one branch: when `P.table` exists, interpolate the
   table instead of `keelTable / planF / deckAt`. Everything downstream already reads `sectionOf` / `secPoly`:
   the panels, the step face, `levelVolume`, the `bTab` half-beam table (`:496-500`) and the water rudder. The
   Wipline floats keep the formula, bit-identical.
3. **One centreline record** (A0's S2 "HYDRO.makeFloat as ONE centreline record on the fuselage's frame nodes"):
   - `parts.floats = [{ side: 0, P: table, tetra, slab }]`;
   - the slab's stations **are the fuselage's own frame stations**: `F[k].BL, BR` plus a **keel node** per hull
     station, which the frame adds as the boat's keel member chain, where the slam lands;
   - `tetraCtx`'s slab distribution (`:1445-1496`) is unchanged;
   - the hull's shell mass is the fuselage covering's (already billed by material), so there is no `mFloat`.
4. **The wet body runs alongside.** `wetBuild` stops returning null on a hull build (`:2036`). It builds the **wings'
   slabs** and **the cabin above the gunwale**, and skips the slices under the hydro hull so nothing is counted
   twice. Then a capsized boat still floats on its cabin and wings, as a ditched Cub does.
5. **The step(s), the transom and ventilation** are 32_hydro's, unchanged for one step. The panel's readouts (step %
   of beam, afterbody angle, the step 10-15° aft of the CG) are the same numbers the physics flies.

### 3.6 New generator capability per family, with days

**The base: every hull family needs these.** This is A0's S2 core. These estimates are this study's; coordinate with
A0's S2 plan.

| # | work | days |
|---|---|---|
| B1 | cage hull mode: `hullOn`, the V by the keel centre column, the chine/keel creases, the step ring pair, the boat rows, the two tiles, GATE FIT / mesh-hash identity at `hullOn 0` | 2.5 |
| B2 | the join's station table + `makeFloat` from a table (Wiplines bit-identical; a table-vs-formula round-trip check on the 2350) | 2 |
| B3 | the frame: one centreline hull record on the fuselage nodes (keel nodes, slab = frame stations), the transom water rudder, `wetBuild` alongside, the GATE SEAPLANE hull case (settles at the drawn waterline, crosses the hump, takes off) | 3 |
| | **base total** | **7.5** |

**Per family:**

| capability | family | what is new | days |
|---|---|---|---|
| **two steps** | Two-step (Wal) | `makeFloat` bodies F / A1 / A2, a step face and a ventilation edge per step, leading-edge and fade tables per body (`hydroPanels :703-720`, `:861-890` are written for one step); the cage's second ring pair | 3.5 |
| **spray rails** | all V presets | a strip mesh on the chine (the float's `railW` strap, `tools/_float_gen.js:379`) + a 0° planing strip panel outboard of the chine | 1 |
| **flat floor ahead of the step** | (pad, no reference yet) | the keel centre column split into two (the pad's edges); `secPoly` K → K, P, C; the pad's planing at 0° | 1.5 |
| **pod hull on a boom** | Pod & boom | almost nothing: the cage already has Rod & pod. The transom is the pod's bulkhead, the rod stays above the waterline (a check), plus the preset. | 0.5 |
| **hull tub, open frame** | Open tub | covering by level (skin to the gunwale, the truss above); `wetBuild`'s cabin slices off | 1 |
| **stepless** | Stepless (foils) | `makeFloat` with no step face (`hullSteps 0`), ventilation at the transom only | 1 |
| **trimaran outriggers** | any (+ Outriggers) | `gearFloats` with `hullOn`: the float layer at a wide track, small hulls, no spreader bars across the centre hull (`61_gen_frame.js:2695-2696` assume FL–FR) | 1.5 |
| **strut tip floats** | Classic, Pod, Tub | N float records (the `[-1, 1]` loop at `61_gen_frame.js:2626` generalised), a tip-float record type on wing struts, sized by the moment rule | 2 |
| **sponsons** | Icon / Seastar / Wal family | a stub at the chine: a flat-bottomed HYDRO record + an aero strip; drawn by the wing layer | 2.5 |
| **planing wing roots** | Be-103 / Equator | the root strips' lower surfaces as planing panels (wing slabs exist in `wetBuild`; they need the Savitsky term) | 2 |
| **drooped buoyant tips** | Che-22 / Seawind | `GEN_TIPS.drooped`'s `droop` as a row and deeper; a closed tip volume as a buoyant slab | 1.5 |
| **hydrofins** | Vickers / Akoya | a foil in water: the strip lift law at water density, its stall and ventilation | 2 |

**Suggested order** (each step flies on its own):
1. **base** (7.5 d);
2. **strut tip floats** (2 d), which gives Classic V and Pod & boom as complete boats;
3. **spray rails** (1 d);
4. **drooped tips** (1.5 d) and **sponsons** (2.5 d), the user's 3 Nov additions;
5. **planing wing roots** (2 d);
6. then the rest: open tub, stepless + hydrofins, outriggers, two steps (3.5 d), and the pad when a reference
   asks for it.

The base plus the first five steps is **16.5 days**. Every row in §3.6 is about **27.5 days**.

### 3.7 Options considered and dropped
- **A separate hull editor** (the float rows `flt*` reused for a centreline hull). This is the user's "veer off": a
  second set of length / width / height rows that would fight the frames. The float rows stay the floats'. Only
  their **physics** (`makeFloat`) is shared.
- **A deadrise per frame.** Seven more rows for a number that real hulls hold nearly constant from the step aft and
  warp only at the bow. Three rows (step / bow / aft) cover every reference.
- **A flare row.** The shared waist and bottom widths already state it.
- **A "steps count" above two.** No reference has more.

---

## 4. SKETCHES (`futureDesigns/hull-types/`, drawn from the rows above)

- `same_values_normal_vs_hull.svg`: **one set of cage values, `hullOn 0` and `hullOn 1`**. Side profile and the
  section at the step.
- `family_classicV.svg`, `family_twoStep.svg`, `family_podBoom.svg`, `family_tubOpen.svg`, `family_stepless.svg`:
  the five presets. Each sheet has a side profile, the section at the step, and a front view of its water stability.
- `family_roundChine.svg`, `family_padBow.svg`, `family_trimaran.svg`: the soft chine, the keel pad and the trimaran.
- `water_stability.svg`: the six stability options, front views at the step.
- `draw_hulls.js`: the drawing. Every line is computed from the frame rows and the boat rows.
- **What the sketches are and are not.** The waterline is a sketch: the real rest trim is the solver's. The frames
  are interpolated with a smooth curve, which stands in for the subdivided skin.

## 5. OPEN QUESTIONS FOR THE USER
1. Should **Hull** be the fourth Undercarriage option (beside Floats), as proposed? The alternative is a Fuselage tile
   only. Same key either way.
2. Are the five presets the right cut? Stepless (Akoya) is the one outside the classic forms. The pad bow has no
   confirmed reference and is a row only.
3. Should the tip-float row be stated as a **moment ratio** (the sourced rule) rather than a volume?
