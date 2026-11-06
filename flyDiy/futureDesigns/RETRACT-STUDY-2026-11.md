# RETRACT-STUDY — retractable landing gear and amphibious floats (2026-11-03)

A STUDY, no game code. Asked by the user through A0 on 3 Nov 2026: "Retractable wheels themselves are a study to be
launched properly. We would need to automatically cut the fuselage and reserve space, also in the wings. We would need
to allow different motions of retraction ... The goal is to understand what we can afford and when, what's gonna be the
cost, and how can we approach that progressively."

Base: origin/master `adb2d2a9` (train L30b, built). Every claim about our code carries `file:line` on that commit.
Every claim about real aeroplanes carries a link; the words are mine, nothing is copied. Where a number could not be
checked it says so.

Contents: §0 the answer in one page · §1 the real thing · §2 our code · §3 the design, step by step · §4 the table ·
§5 what is affordable this month · §6 open questions for the user.

---

## 0. THE ANSWER IN ONE PAGE

- **Nothing about retraction exists in the physics, the drawing or the game today**, but almost every organ it needs
  does: the gear's drag is its own priced term (`62_gen_aero.js:702`), every gear wheel is a node whose contact the
  solver can be told to ignore (`30_solver.js:3726-3735`), a belly that touches the ground already scrapes, scars and
  strikes the propeller (`30_solver.js:3790`, `:1547`), a wheel in the water already ploughs and noses over
  (`32_hydro.js:1870-1890`), the game layer already knows the word `amphibian` and lets it use every strip
  (`25_airfield.js:982-1003`), and the floats' water rudder is already a retracting part with a handle, a pilot's rule,
  a key and a rigid swing in the drawing (`32_hydro.js:1552-1615`, `input.js:104`, `app.js:3282-3307`). That last one
  is the template for the whole thing.
- **The expensive part is not the motion, it is the HOLE.** A wheel that swings up into a skin that is not cut, with a
  bay nobody reserved, is two days of work and looks right from 20 m. A well cut into the belly or the wing's lower
  skin, a bay the tanks and the crew respect, and doors that close over it is two to three weeks and touches the
  knife, the wing loft, the bay registry, GATE CLIP and the tank fit.
- **Recommended order** (each step ships on its own, details §3):
  1. **The retract core + one motion, no wells** (5 days, low-medium risk): `gear.retract` in the spec, a gear handle
     with a transit time in the solver, the gear's drag scaled by how far down it is, the wheels' contacts off when up
     (a gear-up landing is then a belly landing the damage system already handles), the pilot's "gear up after
     positive climb, gear down on downwind", three green / red in-transit lamps on the HUD, a warning horn, and the
     Mooney / Bonanza inward fold drawn as a rigid swing of the leg-and-wheel units into a skin that hides them.
  2. **Amphibious floats** (7 days, medium-high risk): wheels hung in the floats on the same core, the nose wheels
     pivoting up onto the deck, the mains up into the float, the land / water mode, the pilot choosing the gear by the
     surface it is landing on, and the "gear is UP for a water landing" advisory. Highest game value (the island's
     strips AND its water with one aeroplane) — but it needs step 1's core, so it is second, not first.
  3. **The other motions** (5 days for the general swing law and its presets): aft with a 90° twist, outward, aft into
     the fuselage (Cessna RG), nose forward / aft, tailwheel, semi-retractable in a nacelle (DC-3).
  4. **Wells, bays and doors** (12-15 days, high risk): the reserved bay, the automatic cut of the belly and of the
     wing's lower skin, the doors as hinged parts, GATE CLIP over the swept volume.
  5. **Career, bench, certificate** (3 days): the price and mass rows, the gear-swing bench test and its sticker, the
     emergency extension, a pilot personality who forgets the gear.
- **Affordable this month:** step 1 (5 days). Step 2 next month. Steps 3-5 when a Spitfire / DC-3 / Mooney card is the
  chantier. See §5.

---

## 1. THE REAL THING

**How this was gathered.** From web search summaries. faa.gov and aopa.org could not be fetched from this session
(the host is not allowed), so the FAA handbooks (Airplane Flying Handbook; AMT Airframe Handbook, ch. 13) were NOT
read. Where a fact comes from a forum, a museum page or a simulator manual it says so. **[unverified]** marks a
claim I could not source; "background" marks my own knowledge. Before any number below becomes a gate, A0 opens the
source on the box.

### 1.1 Inward into the wing root (Mooney M20, Beech Bonanza)

- **Swing.** The mains swing inboard about a hinge running roughly fore and aft near the outer end of the well. There is
  no twist, and the wheel ends up lying flat in a well in the wing root or centre section. The nose gear goes aft into
  the fuselage. This is background **[unverified]** for both types. The wells and their doors are documented:
  - Mooney strut doors and inner doors: [inner gear doors](https://mooneyspace.com/topic/29588-inner-gear-doors), [door alignment](https://mooneyspace.com/topic/20477-gear-door-alignment).
  - Clearance between the door and the wheel depends on the shock-disc stack: [main gear rubbing](https://mooneyspace.com/topic/41435-main-gear-rubbing-on-tension-bar).
  - The nose wheel centres itself on the way up: [nosewheel steering on retraction](https://mooneyspace.com/topic/49947-nosewheel-steering-disconnection-on-retraction).
- **Actuation.**
  - Early Mooneys used a manual JOHNSON BAR, a long lever between the seats that the pilot pulls through with
    momentum. Mooney dropped it partway through the 1968 model year ([PoA](https://www.pilotsofamerica.com/community/goto/post?id=1833198)).
  - The bar takes technique and gets harder the faster you fly ([Plane & Pilot](https://planeandpilotmag.com/up-and-away/), [MooneySpace](https://mooneyspace.com/topic/43053-trouble-retracting-the-gear-johnson-bar-manual-gear)).
  - A handle that was not locked collapsed an M20B's gear ([NTSB](https://data.ntsb.gov/carol-repgen/api/Aviation/ReportMain/GenerateNewestReport/77821/pdf)).
  - Later Mooneys have an electric motor and gearbox with an airspeed lockout ([Plane & Pilot, gear systems](https://planeandpilotmag.com/gear-systems/)).
  - The Bonanza has one electric motor and transmission under the floor at the spar. Older aircraft had one gear light,
    later ones three ([MooneySpace](https://mooneyspace.com/topic/13920-engineering-reason-for-complicated-expensive-landing-gear/page/2)).
- **Emergency extension.** A hand crank.
  - Mooney: about 50-110 turns by model, an owners' figure ([MooneySpace](https://mooneyspace.com/topic/45634-emergency-gear-extension)). The crank is on the pilot's left before 1978 and is a ratchet handle on the floor after ([Plane & Pilot](https://planeandpilotmag.com/gear-systems/)).
  - Bonanza: about 50 turns, heavy at the end ([Australian Flying](https://www.australianflying.com.au/advanced-skills/learning-from-mistakes-an-avoidable-gear-up)).
  - A worn sector gear lets the motor AND the crank spin without moving the gear ([NTSB](https://data.ntsb.gov/carol-repgen/api/Aviation/ReportMain/GenerateNewestReport/55351/pdf)).
- **Timing.** About 4 s for a Bonanza (a video title) and about 3 s for a Mooney (a forum calculation). Both
  **[unverified]**.
- **A lesson for our cockpit.** NTSB SR-80-01 found that Bonanza and Baron gear-ups on the ground were "unacceptably high"
  because pilots confused the flap and gear switches ([NTSB](https://www.ntsb.gov/safety/safety-studies/Pages/SR8001.aspx)).
  This is why real gear handles are wheel-shaped and flap handles are aerofoil-shaped.

### 1.2 Aft with a 90° twist (Curtiss P-36 / P-40, Vought F4U, Grumman F6F) and outward (Spitfire, Bf 109)

- **The twist.** The leg swings aft about a hinge that is roughly spanwise, and turns about its own axis by about 90°
  on the way, so the wheel arrives lying flat in the wing at the bottom of the leg:
  - Sources: [P-36](https://en.wikipedia.org/wiki/Curtiss_P-36_Hawk), [F4U](https://en.wikipedia.org/wiki/Vought_F4U_Corsair), [F6F](https://en.wikipedia.org/wiki/Grumman_F6F_Hellcat).
  - On the P-40 the twist comes from a bevel gear fixed to the well that meshes with one on the leg ([photos](https://www.williammaloney.com/Aviation/VintageWingsOfCanada/CurtissP40Kittyhawk/pages/27P40GearRetractionGears.htm)).
  - On the Corsair it comes from a link at the top of the strut ([WIX forum](https://warbirdinformationexchange.org/phpBB3/viewtopic.php?p=527152)).
  - On the P-40 only the wheel goes fully into the wing, and the leg lies under a fairing ([WIX](https://www.warbirdinformationexchange.org/phpBB3/viewtopic.php?p=494040)).
  - The Corsair has doors on each strut plus a pair of doors over each well ([Wikipedia](https://en.wikipedia.org/wiki/Vought_F4U_Corsair)).
  - The F6F is hydraulic ([Wikipedia](https://en.wikipedia.org/wiki/Grumman_F6F_Hellcat)).
  - Whether Boeing patented the twist and licensed it is forum talk **[unverified]**.
- **Outward.** The Spitfire's mains fold OUTWARD, pivoting near the main spar's inner rear corner.
  - The narrow track was accepted because it eased the spar's load ([History of War](https://www.historyofwar.org/Pictures/pictures_spitfire_raised.html)).
  - Hydraulic jacks retract the gear. An emergency CO2 bottle blows it down: the selector goes DOWN, then the emergency lever moves through about 100° ([AAIB report G-CTIX](https://assets.publishing.service.gov.uk/media/5f467defd3bf7f5d8cf6ae9f/Spitfire_Mk_T_IX__Modified__G-CTIX_06-19.pdf), [A2A forum](https://a2asimulations.com/forum/viewtopic.php?p=263425)).
  - The Spiteful that followed went to inward folding to widen the track ([Wikipedia](https://en.wikipedia.org/wiki/Supermarine_Spiteful)).
  - The Bf 109 also folds outward. Its legs pivot on the fuselage, so the wings come off with the aeroplane standing on its gear ([WRG](https://warbirdsresourcegroup.org/LRG/luftwaffe_messerschmitt_bf109_design_features.html), [Britannica](https://britannica.com/technology/Bf-109)).
  - **One correction to the brief:** the brief grouped the Spitfire with the aft-twisters. It is outward with no twist.

### 1.3 Aft and up into the fuselage (Cessna 172RG, 182RG, 210)

- **Why the belly.** These are high-wing aeroplanes, so the wing is too far from the ground to take the gear. Cessna's
  "twist and tuck" gear came in on the 210 and went on every high-wing retractable Cessna ([Aviation Consumer](https://aviationconsumer.com/uncategorized/cessna-210-centurion/)).
- **Swing.**
  - The spring-steel leg first drops about 60 cm, then is pulled aft and up into a well under the tapering rear belly ([Achtung Skyhawk](https://achtungskyhawk.com/tag/cessna-172/)).
  - It pivots on a skewed axis, so it also moves in toward the centreline as it rises ([RCU](https://www.rcuniverse.com/forum/5401436-post49.html)).
  - The angle of twist is not published in what I could reach **[unverified]**.
- **Doors.** The 172RG has open wells with no main doors ([AVweb](https://avweb.com/features/cessna-172rg-cutlass-rg/)). The 210 lost its main doors from 1979.
- **Actuation.** An electric hydraulic power pack behind the firewall serves only the gear. It holds about 1,500 psi
  and restarts below about 1,000 psi ([172RG POH §7](https://edwilliams.org/172RG_POH/7-27.html)).
- **Emergency extension.** A hand pump between the seats, used only to extend (same POH).
- **Warnings.** The horn sounds with the gear not locked down and either the manifold pressure under about 12 inHg or
  the flaps beyond 20°. One green light means three down and locked ([Purdue Aviation](https://www.purdueaviationllc.com/aircraft-rental/cessna-172rg)).
- **The Piper Arrow, for contrast.** Its mains fold INWARD (background **[unverified]**).
  - An electric reversible pump drives it. There are no uplocks: hydraulic pressure holds the gear up, and a cycle takes about 7 s ([AOPA](https://aopa.org/news-and-media/all-news/2020/august/flight-training-magazine/how-it-works-retractable-landing-gear)).

### 1.4 The nose gear

- **The Arrow's nose retracts aft.** Emergency extension dumps the pressure and the gear free-falls. A spring pushes the
  nose leg forward against the airflow, which shows the air load resists an aft-retracting leg coming down ([Arrow POH ch. 2](https://business.desu.edu/sites/business/files/document/11/arrow_200_chap_2_airplane_and_systems.pdf)).
- **The Arrow also extends ITSELF** at low airspeed with low power, below about 90-105 kt or mph by model ([AAIB G-OPJD](https://assets.publishing.service.gov.uk/media/5423030ae5274a1317000bfb/Piper_PA-28RT-201T_Turbo_Cherokee_Arrow_IV_G-OPJD_06-14.pdf), [Piper Flyer](https://www.piperflyer.com/forums/topic/arrow-automatic-landing-gear-extension-is-breaking-my-plane/)).
  That is a design-side answer to forgetting the gear.
- **Forward-retracting noses.** Gravity and the air load both swing a forward-retracting nose leg down and aft, which
  helps a free-fall. This is design sense; I found no source that states it **[unverified]**.
- **Other types.** The Bonanza, 210 and RG noses go aft (background). The Mooney's nose goes up into a doored well ([MooneySpace](https://mooneyspace.com/topic/17403-gear-door-problem)).
- **Speed limits.** Two placard speeds exist and can differ: V_LO for operating the gear and V_LE for flying with it
  extended ([AOPA](https://aopa.org/news-and-media/all-news/2020/august/flight-training-magazine/how-it-works-retractable-landing-gear)).

### 1.5 Semi-retractable (DC-3 / C-47, PBY-5A, B-17)

- **DC-3.** The mains rise roughly vertically into the engine nacelles, on a folding brace that breaks forward. About
  11 in of tyre stays outside, and that tyre still turns and brakes in a wheels-up landing ([sim manual after the pilot's manual](https://manualedistruzioni.it/microsoft/switch/flight-simulator-douglas-dc-3/user-manual/uw60), [FineScale](https://forum.finescale.com/t/c-47-landing-gear/106309)).
  - The system is hydraulic ([LES DC-3 docs](https://airfightergr.github.io/les_dc3_docs/docs/common/hydraulics)).
  - "Retracts forward" is only partly right. "Up into the nacelle, the brace breaking forward" is the better
    description **[partly unverified]**.
  - In a belly landing the props and engines take the damage ([FlightAware photo](https://flightaware.com/photos/view/4340032-e8d84e2bae285d3d727687ceb7ac08c12f34a356/user/Digdis/sort/votes/page/1)).
- **PBY-5A.** The mains pull up against the hull side between the wing struts, with the wheel left in view ([History of War](https://www.historyofwar.org/articles/weapons_PBY-5A_catalina.html)).
  - The nose gear folds into a bay under the flight deck behind two hydraulic doors that close flush ([Dutch Safety Board](https://onderzoeksraad.nl/en/onderzoek/loss-of-directional-control-during-waterlanding-consolidated-pby-5a/)).
  - Water getting into that bay has sunk Catalinas ([WIX](https://warbirdinformationexchange.org/phpBB3/viewtopic.php?p=78292)).
- **B-17.** Part of each main wheel stays below the nacelle when retracted. That this was meant for belly landings is a
  forum claim **[unverified]** ([WIX](https://warbirdinformationexchange.org/phpBB3/viewtopic.php?p=365615)).
- **Why it matters for us.** A half-exposed wheel is the cheapest motion to draw: no doors and a short swing. It also
  makes a forgotten gear survivable, which is a designer's choice the game could offer.

### 1.6 Tailwheels

- **Fixed:** the DC-3 (it castors) ([dc3airways](https://dc3airways.net/technical/description.php)), and the Spitfire
  Mk V, IX and XVI.
- **Retractable:**
  - Spitfire Mk VII and VIII, with a small door ([Hush-Kit](https://hushkit.net/2019/07/12/my-favourite-spitfire-6-the-mk-viii/)).
  - P-51: hydraulic, forward and up into the fuselage, fully enclosed behind doors ([Air Corps Aviation](https://www.aircorpsaviation.com/wp-content/uploads/P-51_MarkOnMaintence_LandingGearFailuresSafety_Web-2020.pdf)).
    The P-51's mains go inward with strut doors and hydraulic inner doors ([PPRuNe](https://www.pprune.org/archive/index.php/t-532652.html)).
  - Bf 109 F onwards: retractable, though many G models were fixed once the bigger tyre no longer fitted ([ww2aircraft.net](https://ww2aircraft.net/forum/threads/difference-between-g-and-k-model-bf-109.30974/post-841671)).
    The K-4 has clamshell doors and was often locked down in service ([WRG](https://warbirdsresourcegroup.org/LRG/bf109_variants_K.html)).
  - Grumman Goose: the steerable tailwheel retracts into the hull behind the second step ([CG Aviation History](https://cgaviationhistory.org/?p=3671)).

### 1.7 Amphibious floats (Wipline, Aerocet)

- **Layout.** A "quadricycle": two swivelling nose wheels, one in each float's bow, and the mains, all run by one
  reversible electric hydraulic pump, with hydraulic brakes ([Wipline 2100 manual](https://manualshive.com/en/manual/wipaire/wipline-2100/988365?page=22)).
  - The mains are a pair in each float on the 2100, which the manual describes as four main wheels. That count needs
    checking on the drawing.
  - The nose unit draws a carriage along tracks in the bow box and locks over centre ([Wipline 13000 manual](https://manualshive.com/en/manual/wipaire/wipline-13000/988363?page=22)).
  - A mechanical indicator on the float deck, just forward of the step, shows the mains' position.
  - The 8750 has trailing-link mains in one float compartment ([Flying](https://flyingmag.com/photo-gallery-photos-wipline-8750-floats-cessna-grand-caravans)).
  - Where the wheels sit when stowed comes from photos, not a source **[unverified]**: the nose wheels look up and aft
    on the deck at the bow, and the mains in the float body near mid-length, which a patent calls "near the centre of
    the float" ([US12330775](https://patents.google.com/patent/US12330775)).
- **Backup.** A hand pump on the cockpit floor, with fluid reserved for it ([Wipline 2100](https://manualshive.com/en/manual/wipaire/wipline-2100/988365?page=32)).
  The Wipline 3730's power pack sits in the left float's locker. Aerocet uses a pump on the airframe plus a hand pump ([Aerocet 3400](https://www.manualslib.com/manual/2816209/Aerocet-3400.html)).
- **THE ADVISORY.** The classic Wipaire voice says "gear is up for water landing" or "gear is down for runway landing".
  - Since 2017 a laser senses the surface below. It stays quiet when the gear and the surface agree and calls "check
    gear" at about 50 ft when they do not. Shallow water, foam or debris can fool it ([General Aviation News](https://generalaviationnews.com/2017/07/21/wipaires-laser-gear-advisory-system-now-standard-and-available-for-retrofit/), [Wipaire release](https://www.wipaire.com/wp-content/uploads/2017/07/20170721-Wipaire-Releases-Laser-Gear-Advisory.pdf)).
  - **For our game this is the laser, almost free:** our world knows the surface under the aeroplane (`world.surface`,
    `world.waterH`).
- **Wheels down on the water.**
  - The ASI seaplane report puts about 90% of seaplane accidents in the landing phase, many of them gear-down water
    landings ([AOPA ASI](https://www.aopa.org/training-and-safety/air-safety-institute/accident-analysis/seaplane-accident-report/executive-summary)).
  - In 83% of gear-down water landings the gear had never been raised after take-off, and about one in four is fatal
    ([AOPA 2023](https://www.aopa.org/news-and-media/all-news/2023/august/08/seaplane-pilots-raise-gear-on-positive-rate)).
  - The usual end is a nose-over onto the back.
  - The lesson is "raise the gear on a positive rate even when you will land back on the same lake", and it is the
    pilot rule we should copy.
- **Mass and speed.** See §1.9.

### 1.8 Flying-boat hull gear (Lake, ICON A5, Seawind, Grumman)

- **Lake LA-4 / Renegade.** Retractable tricycle gear, with the nose leg in the forward hull ([TSB](https://bst-tsb.gc.ca/eng/rapports-reports/aviation/2004/a04p0041/a04p0041.html)).
  - The main wheel well shows the rear spar web ([FAA/EASA SAIB 2024-02](https://ad.easa.europa.eu/blob/SAIB-2024-02.pdf/SIB_SAIB-2024-02_1)), which puts the mains in or near the wing root.
  - The exact swing is **[unverified]**.
  - It has an emergency pump.
- **ICON A5.** Electro-mechanical, NOT manual: one actuator for the nose and one for both mains, about 7 s each way
  ([ICON maintenance manual](https://iconaircraft.com/maintenance-manual-A5/ICON%20A5%20MM/Inspect_RetractionExtensionTime.html),
  [description](https://iconaircraft.com/maintenance-manual-A5/ICON%20A5%20MM/LandingGearDescription.html)).
  - The mains stow by the wells under the sponsons ("Seawings").
  - The checklist has the pilot look at the gear: down for land, up for water ([checklist](https://www.iconaircraft.com/wp-content/uploads/2020/02/ICA014502-B_CHECKLIST-PILOT-A5-ISSUE-B.pdf)).
  - An A5 flipped landing on water with the gear down ([Flying](https://www.flyingmag.com/icon-a5-flips-in-water-after-landing)).
  - **A correction to the brief:** only its wing fold is manual.
- **Seawind 300C.** Trailing-link mains hinged on the hull side fold up into the wing. One electro-hydraulic pack runs
  the gear, the flaps and the nose steering, with a manual backup pump ([Wikipedia](https://en.wikipedia.org/wiki/Seawind_International_Seawind), [GAN](https://generalaviationnews.com/2018/09/17/cracked-hydraulic-fitting-flare-cause-of-seawind-accident/)).
- **Grumman Goose.** A hand crank on the rear bulkhead raises the mains into the hull sides ([Smithsonian](https://si.edu/object/grumman-g-21-goose:nasm_A19840405000)).
- **Grumman Widgeon.** Sources disagree on its system. An equipment list shows an engine pump plus a hand pump ([A-734](https://mail.enginehistory.org/Operations/MagnumWidgeon/A-734_Rev_19.pdf)).

### 1.9 What it costs: mass, drag, speed

| Pair (fixed -> retract) | Cruise | Empty mass | Note |
|---|---|---|---|
| Cessna 177B -> 177RG | 124 -> 148 kt | +145 lb (66 kg), mostly gear | engine 180 -> 200 hp too ([Wikipedia](https://en.wikipedia.org/wiki/Cessna_177_Cardinal)) |
| Cessna 182 -> R182 RG | about +15 kt at the same fuel flow | RG about 1,809-1,844 lb | same engine ([Aviation Consumer](https://aviationconsumer.com/?p=8251)) |
| Cessna 172 -> 172RG | about 122 -> 140 kt | about +80 kg (owner figure) | engine 160 -> 180 hp, CS prop ([172guide](https://172guide.com/models/172RG-82.htm)) |
| Piper Archer -> Arrow | about +15 kt | — | ([AOPA](https://aopa.org/news-and-media/all-news/2013/april/01/efficiency-rationalizing-retracts)) |
| Saratoga -> Saratoga SP | +10-20 kt (turbo SP +12 at 65 %) | tens of lb | same 300 hp ([AOPA fact sheet](https://www.aopa.org/go-fly/aircraft-and-ownership/aircraft-fact-sheets/piper-turbo-saratoga)) |
| PA-18 wheels -> Wipline 2100 amphib | about -7 to -8 kt (under 10 %) | +427 lb installed (straight floats about 281) | ([Wipaire PA-18](https://www.wipaire.com/piper-pa18-rev-6-16/), [AOPA](https://www.aopa.org/news-and-media/all-news/2022/august/flight-training-magazine/unusual-attitude-amphibious-floats)) |
| C206 wheels -> Wipline 3450 | — | amphib installation 694 lb vs straight 491; exchange 532 vs 329 | ([Wipaire C206](https://www.wipaire.com/cessna-206-rev-4-18/)) |
| DHC-2 -> Wipline 6100 | — | exchange 885 lb amphib vs 467 straight | ([Wipaire Beaver](https://wipaire.com/aircraft_page/de-havilland-beaver-mk-i)) |
| C208 -> Wipline 8750 amphib | 186 -> 159 kt | — | ([GlobalAir](https://www.globalair.com/articles/cessna-caravan-float-conversions-the-cost-of-going-amphibious/12536)) |

What to read from the table:
- **Retraction is worth about 15-20 kt on a 120-140 kt single.** On the clean same-engine pair (the 182) it is about
  +15 kt, roughly 12 %.
- **Retraction costs about 30-65 kg of empty mass on a light single.**
- **Amphibious wheels cost about 90-190 kg over straight floats on the same airframe.** That is about 200 lb on the 206
  and about 420 lb on the Beaver: roughly +40 % to +90 % of the straight float installation. Our catalogue's straight
  `mSys` (3450: 223 kg) against Wipaire's amphib figure (694 lb, 315 kg) gives +41 %.

Drag:
- An unfaired fixed tricycle gear can be up to about a third of a light aircraft's parasite drag. Good fairings remove
  about 80 % of that, so retraction wins the remaining fifth, worth about 4 kt at 100 kt ([KITPLANES](https://www.kitplanes.com/?p=14702)).
- Full flaps usually cost more drag than the gear ([Aviation Safety](https://aviationsafetymagazine.com/?p=12679)).
- **This is the honest game design point:** our spats and trousers (`genGearCdA`) already buy most of what retraction
  buys. Retraction has to cost mass, price and risk to stay a choice rather than a default.

Gear mass as a share of the maximum take-off mass:
- 2.5-5 % ([Wikipedia](https://en.wikipedia.org/wiki/Landing_gear)); 3-6 % (Chai 1996, [summary](https://spaircraft.readthedocs.io/en/docs/lg.html)).
- Raymer's GA weight equations carry a retractable / fixed switch ([AeroSandbox's implementation](https://aerosandbox.readthedocs.io/en/master/autoapi/aerosandbox/library/weights/raymer_general_aviation_weights/index.html)).
  That is the factor to read before setting ours.
- I found no Roskam figure.

### 1.10 Gear-up accidents, warnings, maintenance

- **How many.**
  - Counts depend on who keeps them. FAA preliminary reports logged 58 gear-ups in FY2013, and AOPA ASI counted 159 in
    2016 ([AOPA](https://www.aopa.org/training-and-safety/flight-schools/flight-school-business/newsletter/2017/june/23/cost-of-non-accidents)).
  - NTSB final reports only about 15 a year, because most gear-ups are not reportable accidents ([Flying](https://www.flyingmag.com/light-retract-safety/)).
  - Of 431 gear mishaps in the 2002 FAA reports: 48 % collapses, 37 % gear-up landings, 15 % mechanical ([Flying](https://www.flyingmag.com/?p=316863)).
  - The American Bonanza Society puts gear mishaps at over 40 % of Beech-type accidents and launched "Put Your Gear
    Down" at Oshkosh 2026 ([GAN](https://generalaviationnews.com/2026/08/02/put-your-gear-down-campaign-takes-off/)).
  - The saying: "there are those who have, and those who will" ([Aviation Consumer](https://aviationconsumer.com/safety/insurance/what-a-gear-up-costs)).
- **The damage.**
  - The prop strikes first. The prop is replaced and the engine torn down, about $4,000 for an O-320 / O-360 in 2007 ([AOPA](https://www.aopa.org/news-and-media/all-news/2007/november/pilot/two-dreaded-words)).
  - A "minor" single-engine gear-up comes to $40-80k ([FAASTeam slides](https://www.faasafety.gov/files/events/CE/CE03/2019/CE0388871/CE0388871F.pdf), [Aviation Safety](https://aviationsafetymagazine.com/?p=7925)).
  - It is among insurers' most claimed and most costly events, about $70k each ([AOPA](https://www.aopa.org/news-and-media/all-news/2020/june/pilot/safety-spotlight-costly-mistakes)).
  - Belly-skin and flap damage is not itemised in what I found.
- **The horn.**
  - It sounds with any gear not down and locked and either the throttle back (a manifold-pressure switch at about
    12-14 inHg) or the flaps past the approach setting.
  - The throttle case can be silenced, and advancing the throttle resets it. The flaps case cannot be silenced ([AMT study guide](https://open-exam-prep.com/study-guides/faa-amt-airframe/comm-nav-warning-systems/position-warning-annunciator-systems)).
  - The Arrow's switch is on the throttle at 14 ± 2 inHg and lights a red "WARNING GEAR UNSAFE" ([AAIB](https://assets.publishing.service.gov.uk/media/542300db40f0b61346000b43/dft_avsafety_pdf_031799.pdf)).
  - Lights: three green (down and locked), a red or amber in transit, nothing when up.
  - A dead electrical bus silences the warning ([NTSB](https://data.ntsb.gov/carol-repgen/api/Aviation/ReportMain/GenerateNewestReport/66237/pdf)).
- **Insurance and upkeep.**
  - A retract costs about 25-50 % more to insure. One example is a 182 at $908 a year against $1,346 for the RG ([AOPA](https://aopa.org/news-and-media/all-news/2013/april/01/efficiency-rationalizing-retracts)).
  - The annual puts the aeroplane on jacks for a gear swing. I found no hours figure ([Plane & Pilot](https://planeandpilotmag.com/article/why-bother-with-retractable-gear/)).
  - AOPA's 2025 verdict: probably not worth it for an entry-level owner ([AOPA](https://www.aopa.org/news-and-media/all-news/2025/october/28/is-retractable-gear-worth-the-cost)).

**Gaps, kept for whoever opens the sources:**
- the Bonanza and Mooney cycle times;
- the 172RG's twist angle;
- the Bonanza, 210 and RG nose directions (background only);
- the DC-3's brace geometry;
- the Lake's main swing;
- the A5's emergency extension;
- where the Wipline wheels sit when stowed, and how many mains;
- per-annual hours for a retract;
- the FAA handbook text.

---

## 2. OUR CODE (read, not changed)

### 2.1 The `retract` row: declared, not built

- The row: `tools/_cage_design.js:1662-1670` — `key: 'retract'`, `kind: 'discriminator'`, `status: 'declared'`, its
  `read` always answers `'fixed'`, and the Retractable option is `inactive` with the reason "a real discriminator —
  mass, drag, price, complexity — and none of that model is built; no spec field exists until it is". Its icon is
  drawn (`_cage_design.js:466-467`).
- The design note behind it: `futureDesigns/NEW-AIRCRAFT.md:473` (`gear.retract` NEW, priority D, "absent everywhere
  today"); the T-tail tourer was born asking for it and was made live without it (`_cage_design.js:2553-2554`,
  `NEW-AIRCRAFT.md:566`).
- The roadmap: `ROADMAP.md:548-550` ("Retractable gear [L]. G148's rigging contract is the enabler and drag is already
  delta-from-reference (G115), so this is a drag delta + a motion law + editor rows rather than new physics") and the
  priority table `ROADMAP.md:859` (phase 6, rank 4, L).
- Two studies already asked for it: the DC-3 study (`futureDesigns/DC3-STUDY-2026-10.md:79` "no retraction anywhere
  (gear drag always on)", and its G3506 row at `:202` "retraction = gear drag off, a key, the pilot raising it after
  positive climb, the nacelle wells drawn", S + M) — the split flap of that row landed, the retraction did not
  (`HANDOVER.md:100664`: "Retracting mains (G3506 M) ... not started"); and the Spitfire's ref match lists
  "retractable gear (the Spitfire's outward-retracting legs) | OPEN" as a garage gap (`tools/REF_MATCH.md:251`), its
  reference model's mains being retracted in the file (`REF_MATCH.md:390`).
- The water study planned amphibians as the fourth gear option inheriting this row
  (`futureDesigns/WATER-2026-09-13.md:59-62, 78-79`).

### 2.2 The gear rows and the gear layer (the drawing)

- `gearLayout` is a STARTER with three options — taildragger, tricycle, floats (`_cage_design.js:1611-1660`); the floats
  option switches both wheel stations off and raises `gearFloats` (`:1655-1659`).
- The spec knows exactly three types: `taildragger`, `tricycle`, `floats` (`60_gen_spec.js:5212`); the floats' record
  is normalised at `:5215-5242`; the fairing, leg-fairing and suspension fields at `:5243-5263`; the default gear
  block at `:4113`; the gear's height is the prop-clearance rule at `:6150-6176`.
- The drawing: `tools/_cage_gear.js` stands the bench's legs on the live cage (header `:1-17`); its station defaults
  (`s1*` mains, `s2*` third wheel, `gearFloats`) at `:41-67`. The leg families are `_gear_gen.js`'s: beam
  (`legBeam` `:1382`), swinging link (`legLink` `:1435`), oleo (`legOleo` `:1699`), castor (`castorUnit` `:1809`),
  tailwheel (`legTailwheel` `:1936`), the wheel (`wheel` `:349`), the spat (`spat` `:605`).
- **Where a main leg roots is decided per station**: on the wing when a low wing is above the wheel
  (`wingMount`, `_cage_gear.js:383-415`, which seeks the wing's underside within 0.6 m of the station), on a rod, on the
  open frame, else on the fuselage (`:440-451`). The layer publishes `onWing` (`:637`).
- **Every unit already has the two points a retraction needs**: the layer publishes per leg its `root` (the airframe
  bolt), its `axle` and its `moving` end (`_cage_gear.js:507-513`, `:639-641`), and the castor's top, axis and axle
  (`:642-645`). The leg's `root` IS the natural hinge point of a retraction; what is missing is the hinge AXIS and the
  angle(s).

### 2.3 The gear in the physics (the frame and the solver)

- The mains are two AXLE nodes with the wheel's contact radius (`61_gen_frame.js:2478`) on six gear-class members to
  belly nodes — the legs, the drag braces, two cross wires (`:2488-2491`) — plus a near-vertical internal member per
  side to the ring's top corner against the snap-through (`:2492-2506`, structural rule 10); the wheel's mass and its
  fairing's on the axle (`:2508`). The third wheel: a nose wheel off the firewall and the mount (`:2512-2549`) or a
  tailwheel off the tailpost (`:2550-2578`). Floats replace all of it with two rigid node bodies (`:2579-2605`).
- **The physics mains always hang off the FUSELAGE frames**, even when the drawing roots them on the wing: there is no
  branch in `61_gen_frame.js` that hangs a main gear from wing or nacelle nodes (a wide track is simply long members
  to the belly; `gear.track` clamps to 6 m on a big build, `60_gen_spec.js:5410`). A DC-3's nacelle retraction, drawn,
  would still be braced to the belly in the physics — a gap, not a blocker.
- `refs.mains = [GAL, GAR]`, `refs.tw = TW` (`61_gen_frame.js:3198-3204`).
- **The ground pass** (`30_solver.js:3713-3800`): every node meets the ground by its contact radius
  (`pen = gy + rC[i] - p.y`, `:3726`); a node in `refs.mains` or `refs.tw` ROLLS (`:3735-3788`), anything else SCRAPES
  (`:3790-3800`) — and the scrape arms the yield, writes the ground's scar (DMG-SCAR) and the scuff; a nose node on the
  ground is a PROP STRIKE (`:3728`, `:1547`, `propStrike` `:1677`). **So a gear-up landing needs no new physics: take the
  wheels out of the contact and the belly, the flaps and the propeller meet the ground through the laws that already
  exist.**
- `rC` is a per-node array set at reset from the node's radius less its standoff (`30_solver.js:2478-2490`, G661 /
  G2044) — mutable, so a wheel half-retracted into a nacelle (the DC-3, the B-17) is the same node with a smaller, even
  negative, contact radius: the contact plane rises with the wheel and the tyre still rolls.
- `wheelsOnGround` / `wheelContacts` (`30_solver.js:4045-4073`) answer the floats when there is a hull (`HY`), the axle
  nodes otherwise — an amphibian needs both, chosen by what is under it.
- **The drag**: the gear is priced piece by piece (`genGearCdA`, `62_gen_aero.js:702-722`: two mains' tyres at 0.55 bare
  / 0.22 spat / 0.15 trouser on their frontal, the third wheel, the legs at 1.0 bare / 0.30 faired, the lift struts)
  and ADDED into the fuselage's axial blob (`62_gen_aero.js:1508-1511`: `cda.fusCdA[0] += gearCdA`, published as
  `gen.drag.gear`). The solver applies `P_.fusCdA` at the cabin's four frame nodes (`30_solver.js:3212-3236`) — a
  constant of the def, so **retraction needs a runtime term**: for a retractable build only, the gear's CdA leaves
  `fusCdA` and is applied by the solver as `gearCdA x down` (+ an open-doors / transit term) — at the axle nodes
  ideally, which also gives the gear's real nose-down pitching moment. Fixed-gear builds keep today's line to the bit.
- **The mass**: the gear's wheels and fairings are billed (`61_gen_frame.js:2414-2440`), priced (`GEN_PRICES`
  `60_gen_spec.js:2486-2494`: a wheel 320, the third wheel 260, a spat 380, a trouser 560). Raymer's gear-weight
  exponent is already in the estimator (`60_gen_spec.js:1830`).
- **The controls the solver reads**: `ctl = { thr, de, da, dr, brake, flap, eng, brakeD, wr }` (`30_solver.js:1731`);
  `wr` is the water-rudder handle (null = the rule, 0 up, 1 down; `:1729-1730`, reset to the rule at `:2534`).
  **The gear handle is the same shape**: `ctl.gear` null / 0 / 1, and the solver keeps the gear's actual position
  `st.gear` (0 up .. 1 down) moving at the actuator's rate — in CORE, because the transit time is physics (a
  go-around with the gear in transit) and the gates and the pilot must see it. (The flap's rate today lives in the
  viewer, `input.js:406, 596, 744` — the gear must not copy that.)
- **The water**: the floats' water rudder retracts by a rule (down below `WR_UP_V`, up at take-off power) or by the
  hand (`32_hydro.js:1552-1615`; the constants at `:1566`). A wheeled aeroplane in the water meets it on its belly and
  its tyres — each tyre a bluff plate, "a plough, not a wheel", two g at 22 m/s below the CG, the nose-over every
  ditched taildragger shows (`32_hydro.js:1870-1890`; the wheels are gathered from `refs.mains`/`refs.tw` at
  `:2040-2042` and pushed at `:2480-2490`). **So "wheels down on the water" already flips the aeroplane** — the
  amphibian's classic accident is in the physics for free. One catch: "a build with floats keeps the float pass alone"
  (`32_hydro.js:1890`), so an amphibian's wheels down on the water would NOT plough until that pass runs both.

### 2.4 The fuselage sheet and the wing: can we CUT a well and RESERVE a bay?

- **The fuselage already cuts its skin in two ways.**
  (a) ZONES: a cabin door is a zone of faces marked at emit time (`doorKey`), read back as four edge runs for the
  hinges and the handle (`cageDoorEdges`, `tools/_cage_gen.js:9106-9122`); a zone can be EXPLODED as one part
  (`cageExplodeFaces`, `:2981-3021` — the faces become `cutPart` with a `cutOff`), and the contracts are taken on the
  sheet with every cutOff undone (`:9100-9105`). (b) THE KNIFE: `tools/_knife_gen.js` cuts a drawn convex outline
  through the subdivided skin "exactly where it was drawn, with a real reveal and a recessed pane" (header `:3-40`) —
  but it projects along x, from the SIDE (`:22-33`, `:294-339`: `n0 = [side, 0, 0]`, candidates are faces whose
  normal has `n.x * side` > 0.03). **A belly well is the knife projected from BELOW (along y)** with an opaque well
  material instead of glass: a new projection axis for an existing tool, not a new tool. Its door is the cut piece
  kept as a part (the zone / explode precedent) and hung on a hinge.
- **The wing**: the wing is the game's own loft imported verbatim (`tools/_cage_wing.js:1-35`), and its skin carries a
  FIELD in which "a rib is an integer station and a spar is an integer rail" (`:537-538`, `:1158-1186`; the spars at
  0.15 / 0.65 of the chord, `:1184-1185`). A wing well is a rectangle in (station, chord) between the spar rails on
  the LOWER skin — the field makes it addressable; nothing cuts the wing's skin today. The nearest precedent is the
  Spitfire's radiators, a duct lofted ONTO the lower skin (`_cage_wing.js:310-323`, layer `:2476`) — outward, not in.
- **The bays.** `GEN_BAYS` (`src/core/60c_gen_energy.js:327-419`) is exactly the "bay" concept the brief names: a bay is a
  REGION, not a station (`:135-145`), body bays in metres along the body (`nose`, `cabin`, `underFloor`, `aftCabin`)
  and wing bays in span fraction (`wingRoot` 0.12-0.55, `wingPanel` 0.55-0.88, the second plane's, the strut pods).
  Each is resolved to a volume (`genBayResolve`, `:430-497`), and the editor's finer fit test `_bay_site.js` sweeps the
  real section and measures a signed clearance (`tools/_bay_site.js:184`). **A wheel well is a bay that holds no
  vessel and that every other bay subtracts**: an inward-folding main lives exactly in `wingRoot` (0.12-0.55 of the
  span) and a Cessna RG's mains in `underFloor`/`aftCabin`. Nothing in the bay code knows a keep-out yet.

### 2.5 The floats (for amphibious wheels)

- `tools/_cage_float.js` draws the Wipline family from the same hull generator the water runs on (header `:1-55`); the
  physics float is a rigid node body (`61_gen_frame.js:2579-2605`) with `refs.mains` = the two step keels (r 0) and
  `refs.tw = -1` (`:2590-2592`).
- The catalogue `HYDRO.FLOAT_PRESETS` (`32_hydro.js:1728-1766`) carries per pair the system mass `mSys` with rigging
  (e.g. the 3450, `:1743`: 223 kg); two rows are flagged "amphibian only in the catalogue" (the 7000, `:1755-1756`;
  the 10000, `:1761-1762`) but no row carries an amphibian mass.
- The word `amphibian` is already read by the game: `stripGear` answers `'amphibian'` for `gear.type === 'amphibian'`
  or `floats.amphibian === true` and `stripAllows` lets it use every strip (`25_airfield.js:982-1003`, "so the rule
  below is whole the day the garage builds one"); the contracts (`73_contracts.js:708`), the pilots
  (`76_pilots.js:445`), the map menu (`map_menu.js:209, 504`), the storage cards (`storage_ui.js:119`,
  `71_player_bases.js:1064`) and the pilot (`43_pilot.js:512`) all read it. **The game is waiting for the garage.**
- Two nose wheels (a float amphibian has one per float) meet a single `refs.tw` in the solver (`isTW = i ===
  def.refs.tw`, `30_solver.js:3735`); the viewer already tolerates an array (`app.js:3017`).

### 2.6 Moving parts: what a retraction can reuse in the drawing

- **The wheel** is its own group pivoted at its axle and ridden on its axle node (`app.js:3005-3008`, `:3619-3627`);
  the nose castor carries the nose wheel inside it (`:3611-3618`, `:3630-3640`).
- **The leg** is a STRETCH rig: each vertex weighted by its projection from `root` (0, pinned) to the moving end (1,
  on the node) so the suspension compresses between two fixed anchors (`app.js:3405-3461`, G58.7). A retraction
  composes ON TOP of it: the stretch (the suspension) in the leg's own frame, then the unit turned rigidly about the
  hinge. Fully up, the unit no longer follows its axle node.
- **The water rudder is the template**: a blade that "steers about the post and retracts about the arms' pivot", its
  rest kept and its pose recomputed each frame, the senses PROBED rather than assumed (the two floats are mirror
  builds) with a Rodrigues rotation `rotP` (`app.js:3282-3307`); it follows the hydro float's `wrDown`
  (`32_hydro.js:1599`).
- **The rods follow a hinge**: `linkRigs` turn a member's far end about a hinge by a drive channel
  (`app.js:3568-3610` build, `:4693-4712` pose) — the drag brace and the side brace of a retraction are this.
  The drive channels are the linkage's `KEYS` (`50_model_codec.js:268`): `gear` would be one more.
- **The doors**: the cabin doors have edges and hinges drawn (`_cage_hinge.js:71-72, 102-110`, `cageDoorEdges`) and can
  explode, but nothing SWINGS a door in flight; the hinge layer's rule "which bag a triangle goes in is the whole
  animation" (`_cage_hinge.js:14-24`) is how a gear door would move with its unit.
- **The draws**: the still airframe is merged one draw per material (`mergeStill`, `app.js:2452-2475`), but "anything a
  part carries (it is not a bucket: gear, surfaces, rods ...)" stays separate (`:2460-2463`) — the gear is already
  paid for in draws; a door is a part, so a draw per material per door.

### 2.7 The cockpit, the sound, the bus, the pilot

- The cockpit's hands and levers are LAWS (`switch|knob|key|flap|gpskey`, `cockpit.js:157`); the flap lever is the
  precedent of a lever the hand clicks (`:436`, `:517`, `:544`, `:623`). A gear lever is one more law and three lamps
  are lamps on the bus (`cockpit.js:44-50, 144, 356-403`). The panel generator itself is `tools/_cage_panel.js`.
- The input map has the water rudder's step (AUTO -> UP -> DOWN, `input.js:104, 728`) — the gear handle is the same
  step without AUTO (a real gear has no "rule").
- The warning sound: the airframe sound already has a stall warning in two kinds, a reed and an electric buzzer
  (`audio/airframe_model.js:32-35, 89-100`) and a flap-motor sound (`:280`). A gear horn is a third kind on the same
  law; the gear motor is `flapM`'s twin.
- The electrical bus (`src/core/31_elec.js:1-20`) has the starter as a 150 A transient load — an electric gear pump is
  another, and a dead bus is a real reason for the emergency extension.
- The pilot (`src/core/43_pilot.js`): the phases (`:141-150`) are where GUMPS lives — "gear up" at positive climb
  (LIFTOFF -> CLIMB), "gear down" on DOWNWIND / the base / a straight-in's FINAL gate; it already runs a checklist on
  DEPART (`:3209-3213`) and the water rudders' rules (`:576-578`, `:3698-3717`, `:4802`). The personalities
  (`:171-196`) have quirks — a "forgets the gear" quirk is a real one.
- The bench (`src/viewer/bench.js:1-25`) awards dated, fingerprinted certificates — a gear-swing test is a natural
  sticker. The certificate (`src/core/66_gen_cert.js:1-40`) and GATE DMGGEAR (`tools/_dmg_gear_check.js:1-20`) are the
  gear's structural cases.
- The career: "NOTHING ELSE" costs money — "no repair (free), no fuel, no maintenance reserve" (`76_economy.js:18-25`),
  and a crash resets the aeroplane, repaired, to where it departed (`75_career_wire.js:313-314`, G2705). So a
  retraction's career cost today can only be its PRICE and its MASS; maintenance is a ruling to reopen, not a row.

---

## 3. THE DESIGN — progressively, each step shipping on its own

### 3.0 The four rules every step keeps

1. **A fixed-gear build is bit-identical.** Every new term runs only when `spec.gear.retract` is present.
   - The gear's drag stays inside `fusCdA` for a fixed build (`62_gen_aero.js:1510`).
   - The ground pass, the hydro pass and the pilot take no new branch without the field.
   - A RETRACT gate's first check is that the whole battery's log does not move.
2. **The motion is a LAW on a published unit, never hand animation.**
   - A retraction is (hinge point, hinge axis, swing angle, twist axis, twist angle, the stowed contact offset).
   - The hinge point is the leg's `root`, which the gear layer already publishes (`_cage_gear.js:512-513`).
   - The axis and the angles are rows.
   - The join MEASURES the swung unit at its stowed pose (where the wheel ends up, how far it stands proud of the skin)
     into the spec. This is the float's rule: "the join MEASURES the drawn float" (`WATER-2026-09-13.md` §1.5).
3. **The physics does not move nodes in steps 1-3.**
   - The axle node stays where the frame built it.
   - Retraction changes only:
     - what the node does on the ground: it rolls, rolls on a raised contact plane, or is out of the contact;
     - what the drag sees;
     - what the water sees.
   - Moving the axle node along its arc (driving the gear members' rest lengths L0, which the solver can change at
     run time, cf. `beamYield`, `30_solver.js:1415`) is possible but is option B (§3.7). It reopens structural rule 10:
     an axle drawn up toward the belly plane IS the snap-through geometry `61_gen_frame.js:2492-2506` warns about.
4. **Every fitted value lands on a garage row, and every missing one is a named gap**, as the ref-match rule says
   (CLAUDE.md, `REF_MATCH.md` §7).

### 3.1 STEP 1 — the retract core, and the inward fold, without wells (5 days, risk low-medium)

**The spec.** `gear.retract`:
- `null` = fixed: every build today, and the default;
- otherwise
  `{ motion: 'inward', axis: [..], swing: deg, twist: 0, time: s, act: 'electric'|'hydraulic'|'manual', emerg: 'crank'|'freefall'|'pump'|'blow', stowR: m }`.
- Normalised in `clampSpec` beside `gear.floats` (`60_gen_spec.js:5215`).
- The design row `retract` (`_cage_design.js:1662`) goes from `declared` to `live` for a TRICYCLE with a LOW wing that
  roots its mains on the wing (`onWing`, `_cage_gear.js:637`). Every other layout keeps the option inactive with the
  reason "this motion is not built for this layout yet". That keeps the row honest step by step.

**The solver.** The gear handle and its transit, following the water rudder's pattern:
- `ctl.gear`: null keeps the current state, 0 = up, 1 = down.
- `st.gear`, 0..1, moves at `1 / time`, but only:
  - with the bus alive for `electric` / `hydraulic` (31_elec: a load of about 20-30 A while it runs);
  - always for `manual`.
- **Weight on wheels**: no retraction while any wheel is loaded (`wheelContacts`, `30_solver.js:4067`). The squat
  switch every real system has.
- `emergency()` takes the gear down in the emergency method's time. The free-fall reaches 1 when the speed is under
  the build's V_LE.
- `DMG` gets a `gearUp` flag for the bench and the career.

**Contacts.** `isMain` / `isTW` (`30_solver.js:3735`) roll only above a threshold `st.gear > 0.98` (down and locked).
- Between that and fully up, a wheel is "in transit": it scrapes like any node, which is the gear collapsing.
- Fully up, the node's `rC` is set to `r - stowR`, with `stowR` large: deep in the well, it never touches before the
  belly. The ground meets the belly, the flaps, the propeller (`:1547`) and the scar.
- **That is the gear-up landing, with no new law.**

**Drag.**
- For a retract build the join leaves `gen.drag.gear` out of `fusCdA[0]` and publishes it as `P_.gearCdA`.
- The solver applies `gearCdA · st.gear` as a blob on the mains' and the third wheel's own nodes.
- In transit it adds about 15 % for the open wells and doors. Literature-light, so `[TUNE]` with the reason.
- Applying it at the wheels (not the cabin) gives the gear's own nose-down moment, so lowering the gear trims nose-down
  as a real one does. The plaque shows "gear up / gear down" drag.

**Mass and price** (`61_gen_frame.js:2414`):
- the retraction kit is billed on the axle nodes at `R.retractKg`;
- it is first cut from Raymer's GA retractable factor and checked against the real pairs in §1.9 (about 30-65 kg on a
  light single);
- the price goes in `GEN_PRICES.retract`.

**Water** (`32_hydro.js:2040`): a wheel joins the bluff-plate list only when `st.gear > 0.02`. Up is up.

**The drawing.**
- `_cage_gear.js` keeps drawing the legs DOWN.
- The join publishes per unit the hinge (point, axis) and the stowed pose.
- `app.js` composes a rigid turn of the leg unit, its wheel group and its castor about the hinge, by `st.gear`. The
  stretch rig (`app.js:3405-3461`) comes first, as it is today. The water rudder's `rotP` and its probed senses
  (`app.js:3299-3307`) are the code to copy.
- Fully up, the units are `visible = false`, which saves the gear's draws in cruise.
- The stowed wheel sits INSIDE the opaque skin, which hides it. No well and no door yet: from below, a closed wing.
- GATE CLIP excludes the stowed pose for now: a fitting inside the skin there is by design. Step 4 measures it.
- The linkage gets a `gear` key (`50_model_codec.js:268`) so the braces can follow as `linkRigs`.

**The hand.**
- `input.js` gets a `gear` step (UP <-> DOWN, no AUTO).
- The HUD shows three lamps: green = down and locked, red = in transit, none = up. A HUD strip, not the cockpit's
  geometry, which is step 5.
- The horn (`airframe_model.js`, a third warning kind beside the reed and the buzzer) sounds with the gear not locked
  down and either the throttle under 25 % with the speed under 1.3 V_REF, or the flap past its take-off setting. It
  can be silenced on the throttle and not on the flap, as §1.10 describes.
- The motor sound is `flapM`'s twin (`:280`).

**The pilot** (`43_pilot.js`):
- **gear UP** in CLIMB once the climb is positive and the aeroplane is 15 m over the ground with no runway left to land
  on (the classic rule);
- **gear DOWN** abeam the threshold on DOWNWIND, at the start of a straight-in FINAL, or at the INBOUND gate;
- a **GUMPS** check at the FINAL gate (Gas, Undercarriage, Mixture, Prop, Seatbelts): no three greens at 150 m means a
  go-around (`GOAROUND` exists, `:147`);
- the go-around raises the gear again on the positive climb;
- the expert never forgets.

**The gate GATE RETRACT** (core, ~10 s, a new `tools/_retract_check.js`). It asserts:
1. the battery log does not move on fixed builds;
2. a retract card's cruise speed rises when the gear is up, by a number printed against §1.9's band;
3. the transit takes `time` both ways and stops when the bus is dead;
4. the squat switch refuses a retraction on the ground;
5. a landing with the gear up scrapes the belly and strikes the prop (DMG reads it) and does not roll on the axles;
6. the horn sounds in the two cases and not in a clean climb;
7. the pilot flies a full circuit, raising and lowering the gear at the phases above;
8. the emergency extension reaches three greens on a dead bus.

**Why this first.** It builds every organ the amphibian needs (the handle, the transit, the contacts, the drag, the
horn, the pilot's rule) on the simplest geometry, and a low-wing tourer with gear tucked away is a real aeroplane
(Mooney, Bonanza, Arrow). Cost: 1 day spec, rows and join; 1.5 days solver and drag; 1 day drawing; 1 day pilot, horn
and HUD; 0.5 day gate. **5 days.**

Risks:
- **The pilot's circuit with a new drag step:** the approach trims change when the gear comes down. The PILOT gates
  fly retract cards only on the new path.
- **The drag split:** GATE HONEST's `stockDelta` tripwire (`62_gen_aero.js:733-736`) must see the fixed builds
  unchanged.

### 3.2 STEP 2 — amphibious floats: wheels in the floats (7 days, risk medium-high)

**What a float amphibian is** (§1.7): two nose wheels, one in each float's bow, that swing up and aft onto the deck,
and mains in the float body near mid-length that swing up into it. One hydraulic pump, a hand pump, and the voice
advisory.

**The frame** (`61_gen_frame.js:2579-2605`).
- Each float's rigid node body takes two wheel nodes: a nose axle under the bow and a main axle under the float near
  the step.
- They hang on gear-class members to the float's own deck and keel nodes. This is a tetra, off the plane, so rule 10
  is satisfied by construction.
- The float's straight mass (`mSys`) grows by the amphibian figure. `mSys` for the 3450 (223 kg) is exactly Wipaire's
  straight 491 lb. The amphib figure is +203 lb on the 206 and +418 lb exchange on the Beaver, which makes an `ampK`
  per catalogue row, with `est: true` where no figure was found.

**The refs.**
- An amphibian has TWO sets: the floats' (`HY`) and the wheels' (`refs.mains` = the two main axles, `refs.tw` = the
  pair of nose axles).
- `refs.tw` as an array is a solver change (`30_solver.js:3735`, `isTW`). The steering law takes both nose wheels:
  free-castoring with differential brake, which is what a Wipline does.
- `wheelsOnGround` / `wheelContacts` (`:4045-4073`) answer by the surface under the CG: `world.surface` is water, or
  it is not.

**The water with wheels down.** The wheels' bluff plates must run together with the float pass. Today "a build with
floats keeps the float pass alone" (`32_hydro.js:1890`). With them running, a gear-down water landing digs the
nose-wheel plates in at the bow, the nose-over that 83 % of those accidents show (§1.7). That is the gameplay lesson,
and it comes free from G1381's law.

**The rules.**
- `stripGear` answers `'amphibian'` (`25_airfield.js:992`). The game layer is already whole for it (§2.5).
- The pilot sets the gear by the destination's surface (`stripSurface`) and raises it on a positive rate even off
  water (§1.7's lesson).
- The ADVISORY: a voice line ("gear is up for water landing" / "gear is down for runway landing") on the gear-down
  selection and at 150 m on final, plus "check gear" at 15 m when the gear and the surface disagree. That is the
  laser, read off `world.surface`. The voice catalogue (`src/viewer/audio/voice_catalogue.json`) takes the lines.

**The drawing.**
- `_cage_float.js` / `_float_gen.js` draw a nose-wheel unit in the bow box and a main unit near the step.
- They are rigid swings on the float's own frame. The float rig already re-poses a part in its float's frame
  (`app.js:3282-3311`), so the water rudder's machinery IS this.
- No skin cutting: on the real thing the nose wheels sit on the deck and the mains in an open well in the float. The
  well can be a recessed panel drawn into the float's own hull generator, which owns its sections.

**The gate.** SEAPLANE, FLOATS, DMGGEAR's float rows, plus the RETRACT cases on an amphibian:
- a land circuit on wheels and a water circuit on the hulls;
- a gear-down water landing that noses over;
- a gear-up landing on grass that scrapes the keels.

**Cost:**
- 1.5 days frame and mass;
- 2 days solver (two refs sets, the tw array, the surface switch, the wheel plates beside the float pass);
- 1.5 days drawing;
- 1 day pilot and advisory;
- 1 day gates.

**7 days.**

Risks:
- **The SEAPLANE and PILOTMATRIX sweeps:** the floats' pilot is the most-tuned code in `43_pilot.js` (G3077, G3329).
- **The tw array** touches every reader of `refs.tw`: the solver, the hydro, `app.js`, the pilot. Grep before
  estimating again.

### 3.3 STEP 3 — the other motions (5 days for the general law, then ~1 day a preset; risk medium)

**One general law covers §1.1-§1.6:**
- a rotation about the hinge axis by `swing`;
- composed with a rotation about the leg's own axis by `twist · s(t)` (P-40, Corsair: about 90°; Cessna RG: a skewed
  axis does it in one);
- optionally a second-stage drop (the RG's "drops 60 cm, then tucks") as a piecewise schedule;
- for the nose gear, the castor centred first: the Mooney's self-centring.

**The presets,** each a row starter:

| Preset | Swing |
|---|---|
| `inward` | Mooney / Bonanza / Arrow / P-51 |
| `outward` | Spitfire / Bf 109 |
| `aftTwist` | P-40 / F4U / F6F |
| `aftBelly` | Cessna RG / 210, high wing, into `underFloor` / `aftCabin` |
| `noseAft`, `noseFwd` | the nose gear |
| `tailFwd` | P-51 / Bf 109 F / Goose |
| `semi` | DC-3 / B-17: up into the nacelle, `stowR` = r minus the proud depth, so the rolling law still applies with the contact plane raised (§2.3, `rC`) |
| `hullSide` | Goose / PBY: up against the hull side. Waits for a flying-boat hull, which the garage does not have (WATER-2026-09-13 §1.2 lists it; nothing builds it) |

**A real gap for `semi` on a DC-3:** the physics mains hang off the fuselage frames (§2.3), so a nacelle gear 2.9 m
out on each side is braced 2.9 m back to the belly. Hanging the mains off the nacelle's spar-bay nodes (the
`dmgLump` / nacelle code, `61_gen_frame.js:1660-1800`) is its own M chantier and belongs with the DC-3 (G3506's M).

**The gate:**
- each preset's stowed pose is measured inside the skin (`_bay_site.js` clearance, signed) or proud by exactly its
  declared depth;
- the swept arc clears the crew and the tanks at N angles.

**Cost:** 3 days for the law, the presets and the join's measurement; 2 days for the gates and the editor rows.
**5 days**, then a day per new aeroplane to fit its preset.

### 3.4 STEP 4 — wells, bays and doors: the automatic cut (12-15 days, risk high)

**The bay** (1.5 days, risk low):
- `GEN_BAYS` (`60c_gen_energy.js:327`) takes a `well` kind: `wellMainL/R`, `wellNose`, `wellTail`.
- A well holds no vessel, and its region is the swept stowed volume the join measured.
- `genBayResolve` subtracts a well from every vessel bay it overlaps. An inward-folding main eats the inner half of
  `wingRoot` (0.12-0.55 of the span): the Bonanza's tanks are outboard of its wells, a real constraint the builder
  should feel.
- The tank fit (`_bay_site.js` clearance, `:184`) and the crew fit treat a well as a keep-out solid.
- **This piece is cheap, and it is what "reserve space" means. It can ship in step 1 as a reservation with no cut.**

**The fuselage well** (3-4 days, risk medium-high):
- the knife (`_knife_gen.js`) gets a projection along y, from below: candidate faces `n.y < 0`, the outline in
  (x, z) plan, convex;
- an opaque well-wall material instead of the pane;
- the reveal depth is the well's depth.
- The knife's convexity rule (`:23-26`) suits a well: wells are rounded rectangles.

**The wing well** (3-4 days, risk high):
- The wing's lower skin is the game's loft, not the cage. The cut is a rectangle in the field's (station, chord)
  between the spar rails (`_cage_wing.js:1158-1186`) on the lower surface, with walls dropped to a floor at the well's
  depth.
- It needs the wing flex binding kept on the new vertices: a lerp of their edge's ends, the knife's step 5.

**The doors** (3 days, risk medium):
- the cut piece is kept as a part (the zone and `cutPart` precedent, `_cage_gen.js:2990-3021`) and hung on a hinge;
- strut doors ride the leg unit (a bag of the unit, the hinge layer's rule, `_cage_hinge.js:14-24`);
- wheel doors are sequenced: open, gear, close. That is a two-phase schedule on `st.gear`; on a real hydraulic system
  a sequence valve does it.
- A door costs a draw per material per pass (a part, `app.js:2460-2463`).

**GATE CLIP over the swing** (1.5 days):
- GATE CLIP already measures fittings "at full control travel both ways" (`_clip_check.js:16-19`);
- the gear's travel becomes one more travel: the unit at N angles against the skin, the crew, the tanks and the
  doors;
- the stowed pose must be inside its well.

**Cost:** 12-15 days. Risks:
- **the wing loft cut** (nothing cuts the wing today);
- **the knife's new projection** (its candidate test and its tangent-plane placement are side-view logic,
  `_knife_gen.js:309-339`).

### 3.5 STEP 5 — career, bench, certificate, cockpit (3 days, risk low)

- **Price and mass:** `GEN_PRICES.retract` (`60_gen_spec.js:2486`) and `R.retractKg`. The amphibian's from the float
  catalogue's `ampK`.
- **Maintenance:** NOT a row today. The career rules out every running cost (`76_economy.js:18-25`), and repairs are
  free with a reset to the departure point (`75_career_wire.js:313-314`).
  - A gear-up in the career therefore costs the flight: the contract failed, the aeroplane reset.
  - Charging an annual gear swing, insurance (+25-50 %, §1.10) or a gear-up's repair (§1.10: $40-80k) means reopening
    G-COST / G2705. That is for the user (§6).
- **The bench** (`bench.js`):
  - a "gear swing" test on jacks (`time` both ways, the emergency extension, the horn's two cases);
  - it awards a certificate sticker, fingerprinted like the others;
  - the certificate (`66_gen_cert.js`) runs its ground cases on the gear down and its flight cases with the gear up
    (the V-n corners at V_D are gear-up on a real retract).
- **The cockpit:**
  - a gear lever law in `cockpit.js` (a wheel-shaped knob, as §1.1's NTSB study is why);
  - three lamps on the bus;
  - the lever and its placard drawn by `_cage_panel.js`;
  - the emergency crank or pump handle among the cabin fittings.
- **The pilot's personality:** a `gearForget` quirk on the casual profiles (`43_pilot.js:186-196`). It forgets the
  gear with a small per-landing probability, and only the horn or the GUMPS check saves it. The expert never forgets.
  That is §1.10's saying, in the game.

### 3.6 The autopilot and the checklist, in one place

- **Take-off:** gear up at positive climb (VSI > 1 m/s for 2 s), at 15 m or more AGL, before V_LO.
- **Approach:** gear down at the downwind abeam point, the straight-in's final gate, or the route's INBOUND gate,
  under V_LO.
- **Final gate (GUMPS):** three greens, or go around.
- **Go-around:** power, positive climb, then gear up.
- **Water (amphibian):** the gear set by the destination surface on DOWNWIND, the advisory checked, and the water
  rudders down only after the gear is confirmed up, a rule the pilot already keeps (`43_pilot.js:4802`).

### 3.7 Option B: moving the node (later, if ever)

- **What it buys:** the axle node really travels its arc. The CG shifts (POHs list a gear-moment change), the wheel's
  mass moves, and a half-retracted collapse is mechanically right.
- **What it costs:**
  - the gear members' L0 driven every substep;
  - the rule-10 snap-through re-proved at every angle;
  - FLEX and LOAD re-run;
  - the stretch rig rebuilt.
- **M-L, risk high, gameplay value small.** Option A's "the contact plane moves, the node does not" is what every step
  above uses.

### 3.8 Phone cost

- **Draws today:**
  - the aeroplane is about 545 draws in the studio profile (`MOBILE-GARAGE-2026-10-04.md:194`);
  - three.js costs about 7 µs of CPU per draw on desktop (`PERF-2026-09-23.md:21`), and several times that on a phone;
  - the gear's units are parts and are never merged (`app.js:2460-2463`): of the order of 20-30 draws, plus shadow
    passes. **Unmeasured — measure with `tools/make_probe.js` before step 1 lands.**
- **Step 1:**
  - the animation is a group transform per unit per frame, cheaper than the stretch rig that already rewrites the
    legs' vertices;
  - fully up, the units are hidden, so a retract aeroplane in cruise draws FEWER calls than a fixed one.
- **Step 2:** the same, on the float rig.
- **Step 4:**
  - a door costs one draw per material per pass, about 2-3 per door and 3-6 doors a build: +10-20 draws;
  - the well walls are new faces in the skin's own buckets, about +1 bucket for the well material;
  - the doors only move during transit, so steady flight pays the draws and not the CPU.
- **Verdict:** affordable on a phone. Doors are the only real cost, and the phone tier could draw closed doors as part
  of the skin (no door parts) at the same visual result from the chase camera.

---

## 4. THE TABLE

| Motion | Real examples | What our code has | What's missing | Days | Risk | Step |
|---|---|---|---|---|---|---|
| The core (handle, transit, contacts, drag, horn, lamps, pilot) | every retract | contact law that scrapes a non-wheel (`30_solver.js:3790`), prop strike (`:1547`), gear CdA priced (`62_gen_aero.js:702`), handle pattern `ctl.wr` (`30_solver.js:1729`), stall buzzer kind (`airframe_model.js:89`), pilot phases + GOAROUND (`43_pilot.js:141`) | `gear.retract` field, `ctl.gear` / `st.gear`, runtime gear CdA, squat switch, horn kind, HUD lamps, GUMPS, GATE RETRACT | (in step 1) | low-med | 1 |
| Inward into the wing root | Mooney, Bonanza, Arrow, P-51 mains | legs rooted on a low wing (`_cage_gear.js:383`, `onWing`), leg `root` published (`:512`), rigid-swing rig (water rudder, `app.js:3282-3307`) | hinge axis/angle rows, the composed rig, stowed-pose measurement | 5 (with the core) | low-med | 1 |
| Amphibious floats (nose up onto the deck, mains into the float) | Wipline 2100-13000, Aerocet, PK | floats as rigid node bodies (`61_gen_frame.js:2579`), Wipline catalogue (`32_hydro.js:1728`), `amphibian` in every game rule (`25_airfield.js:982-1003`), tyres plough in water (`32_hydro.js:1870`), float part rig (`app.js:3282`) | wheel nodes on the float body, two-set refs, `refs.tw` as an array, wheels' plates beside the float pass, surface-switched contacts, advisory voice, amphib mass per preset | 7 | med-high | 2 |
| Aft with a 90° twist | P-40, F4U, F6F | as inward | the twist term of the law, a `wingRoot`-length well | 5 for the general law (all of step 3) | med | 3 |
| Outward | Spitfire, Bf 109 | as inward; the Spitfire card WIP lists it OPEN (`REF_MATCH.md:251`) | the preset; the outer wing well | (step 3) +1 | med | 3 |
| Aft and up into the belly | Cessna 172RG, 182RG, 210 | `underFloor` / `aftCabin` bays (`60c_gen_energy.js:364-384`) | skewed-axis preset, two-stage drop, belly keep-out | (step 3) +1 | med | 3 |
| Nose gear aft / forward | Arrow, Bonanza, 210 (aft); many forward | the castor unit and its axis published (`_cage_gear.js:642`) | castor-centring before the swing, the preset | (step 3) +0.5 | low-med | 3 |
| Tailwheel | P-51, Bf 109 F, Goose, Spitfire Mk VIII | tailwheel unit and castor (`_gear_gen.js:1936`) | the preset, the tail-cone well | (step 3) +0.5 | low | 3 |
| Semi-retractable in a nacelle | DC-3, B-17 | `rC` is per node and mutable (`30_solver.js:2489`): the raised contact plane; nacelles exist (`61_gen_frame.js:1660`) | the preset; mains braced to the nacelle in the physics (they hang off the belly today) | (step 3) +1; nacelle bracing M separate | med (high with the bracing) | 3 |
| Flying-boat hull gear | Lake LA-4, ICON A5, Seawind, Goose, PBY | the hull section family is planned only (`WATER-2026-09-13.md` §1.2) | a flying-boat hull first | after the hull chantier | high | later |
| Reserved bays (no cut) | every retract | `GEN_BAYS`, `genBayResolve`, `_bay_site.js` clearance (`60c_gen_energy.js:327, 430`; `_bay_site.js:184`) | a `well` bay kind subtracted from the vessel bays; keep-out in tank and crew fit | 1.5 | low | 4 (can ride with 1) |
| Auto-cut fuselage well | Cessna RG, PBY nose, P-51 tail | the knife cuts the subdivided skin with reveal + pane (`_knife_gen.js:3-40`), from the side only | projection from below, opaque well wall | 3-4 | med-high | 4 |
| Auto-cut wing well | Mooney, Bonanza, Spitfire, P-40 | wing field addresses rib/spar (`_cage_wing.js:1158-1186`); radiators lofted onto the lower skin (`:310`) | any cut of the wing loft; walls and floor; flex binding on new vertices | 3-4 | high | 4 |
| Doors (strut and wheel, sequenced) | Mooney, F4U, P-51, PBY | door zones, `cutPart` explode (`_cage_gen.js:2990`), hinge bags (`_cage_hinge.js:14-24`) | a swinging door in flight; the two-phase schedule | 3 | med | 4 |
| Swept-volume clip gate | — | GATE CLIP at full travel (`_clip_check.js:16-19`) | the gear's travel as a travel | 1.5 | low-med | 4 |
| Career, bench, cert, cockpit lever, forgetful pilot | — | prices (`60_gen_spec.js:2486`), bench certificates (`bench.js:1-25`), flap lever law (`cockpit.js:436`), personalities (`43_pilot.js:186`) | price/mass rows, gear-swing test, lever law + lamps, `gearForget`; maintenance needs a G-COST ruling | 3 | low | 5 |
| Option B: the node moves | — | L0 mutable (`beamYield`) | everything in §3.7 | 6-10 | high | never/later |

**Totals:**
- step 1: 5 days;
- step 2: 7;
- step 3: 5 + about 4 for the presets;
- step 4: 12-15;
- step 5: 3.

**About 36-39 days for the whole arc,** of which the first 5 ship a flying retractable and the first 12 a flying
amphibian.

---

## 5. WHAT WE CAN AFFORD THIS MONTH, AND LATER

- **This month (November): step 1, 5 days.** A low-wing tricycle retract (the T-tail tourer, `_cage_design.js:2555`,
  was born asking for it) with the full core: drag, contacts, gear-up landing, horn, lamps, the pilot's rule. Plus the
  reserved bay (1.5 days) if there is room. It touches no tuned float code. Every fixed build is bit-identical by
  rule 1, so the full battery's risk is in the PILOT gates on the new card only.
- **Next (December): step 2, the amphibian, 7 days.** The highest game value: one aeroplane for the island's strips and
  its water. The career already prices the choice: amphibians may use any strip (`25_airfield.js:1003`). It needs the
  core, so it cannot come first without doing step 1 inside it, and doing it inside it is the same 12 days in a
  riskier order.
- **When a card asks for it: step 3's presets.**
  - The Spitfire WIP asks `outward` (`REF_MATCH.md:251`).
  - The DC-3 asks `semi` (`DC3-STUDY:202`).
  - A Cessna RG asks `aftBelly`.
- **Later, as its own chantier: step 4, the wells and doors.** It is the expensive, risky part, and from the chase
  camera a closed skin (step 1) reads right. Do it when a reference model's belly is the thing being matched.
- **Step 5's maintenance only after a ruling** (§6).

---

## 6. QUESTIONS FOR THE USER (their decisions, not the code's)

1. **The first card.** Step 1 on a low-wing tourer (Mooney / Bonanza-like), or do you want the amphibian first, accepting
   the core is then built inside it (the same days in a riskier order)?
2. **Should a retraction cost upkeep in the career?** Today nothing does (G-COST, GQ5; free repair, G2705). A real
   retract costs insurance (+25-50 %) and an annual gear swing, and a gear-up costs $40-80k. Do we keep it free (the
   cost is the reset and the failed contract), or open a "gear-up repair" line?
3. **The forgetful pilot.** May a hired pilot forget the gear (a casual personality's quirk), or is that only the
   player's own mistake?
4. **The phone tier's doors.** Is drawing closed doors as skin on the phone (no moving doors) acceptable?
5. **Option B.** Is the CG shift of a real gear swing worth a physics chantier, or is "the contact plane moves, the node
   does not" enough? I recommend that it is enough.

### 6.1 The rulings (the user, 3 Nov 2026, the evening)

"go with step 1, the low-wing tourer first. No upkeep cost, hired pilots might, even though unlikly, no on phone, all
planes stand on the ground."

1. **Step 1 first, the low-wing tourer's motion first:**
   - the inward fold of wing-rooted mains;
   - the amphibian comes second.
2. **No upkeep cost:** the career keeps G-COST / G2705. A retraction costs its price and its mass, and a gear-up costs
   the flight.
3. **Hired pilots may forget, rarely.** The persons carry `gearForget`:
   - club 1 %, student 2 %, ham-fist 1 %, bush 0.5 % per approach;
   - the expert never forgets;
   - hired pilots inherit their base person's value and grow toward their ceiling.
4. **No to the phone's closed-doors shortcut:** the phone draws what the desktop draws. This is noted for step 4; there
   are no doors yet.
5. **"All planes stand on the ground":**
   - **Read as:** every aeroplane on the ground stands on its wheels. A reset, a spawn, a parked or a stored aeroplane is
     gear DOWN.
   - **No retraction on the ground:** the squat switch holds the gear down under a handle raised on the ground.
   - **No CG-shift physics:** option B stays shelved, which this answer also settles.

## 7. STEP 1 AS BUILT (RETRACT-1, 2026-11-03)

- **Spec.** `gear.retract`:
  - `{ time 2-20 s (6), act electric | hydraulic | manual, emerg crank | freefall | pump | blow }`;
  - a tricycle's only: `clampSpec` drops it on any other type (`60_gen_spec.js`, after the floats);
  - the key only when chosen, the full swivel's rule (G3575).
- **Garage.** The design tile `retract` is LIVE:
  - it twins the gear layer's `gearRetract` row; the retraction rows are `gearRetract`, `gearRetT`, `gearRetAct`
    (`_cage_gear.js`);
  - they are shown on a LOW WING on wheels (one row from the stock aeroplane, GATE PARTS' reach) and claimed by the
    mains part (`_cage_parts.js`);
  - the join writes `spec.gear.retract` only for a low-wing TRICYCLE (`GEAR_RETRACTABLE`, `_cage_gear.js`), the
    user's "the low-wing tourer first". The physics takes any tricycle (GATE RETRACT flies the high-wing metal Cessna).
    The garage holds the high wing back because its body-rooted spring legs, swung aft, stood their wheels on edge
    beside the belly (seen on quickshot): the Cessna RG's twist-and-tuck is step 3's.
- **Bill.**
  - Mass: `GEN_RULES.retractKg` = 3.5 % of the gross, 12 kg at the least, on the axles (a third each mains, a third the
    nose).
  - Price: `GEN_PRICES.retract` 4200.
  - Both land on the gear's ledger row (`61_gen_frame.js`).
- **Physics** (`30_solver.js`, option A: the node never moves):
  - **Handle and position:** `ctl.gear` (1 down, 0 up) and `pos` moving at 1 / time. The power is `gearPower`, which
    the page's bus is NOT yet wired to. `gearEmergency()` lowers it at the method's rate: crank 25 s, free fall 4 s,
    pump 20 s, gas 2 s.
  - **Squat switch:** no retraction with a wheel within 3 cm of its ground.
  - **Contact plane:** it rises with the wheel by GH, the lift to the highest of the wheel's own members' anchors plus
    its radius. A wheel rolls only down and locked (pos > 0.98) and scrapes otherwise. A gear-up landing is the belly
    landing: the scrape, the scar, the prop strike.
  - **Drag:** `params.retract.cdA` (`gen.drag.gear`) comes off fusCdA as (1 - pos), plus 15 % of it at mid-transit.
  - **Water:** the wheels' plough plates in the water ride the same lift (`32_hydro.js` `WB.lift`).
  - **Published state:** `out.gear` / `gearMov` / `gearWow` / `gearEmerg`, so the physics worker's snapshot carries it.
- **Pilot** (`43_pilot.js`):
  - Up in CLIMB / GOAROUND over 15 m with a positive climb (1 m/s).
  - Up en route.
  - Down for the circuit, on an inbound within 4 km of the field, and in a glide under 150 m.
  - The emergency extension if it has not come down in 1.5 cycles + 2 s.
  - GUMPS: on final under 60 m, not down and locked, it goes around (twice at the most).
  - `gearForget` per approach, from a deterministic die (`pilotGearDice(seed, k)`) and the person's chance. A forgotten
    approach never lowers it and says 'gear-forgotten'.
- **Viewer.**
  - **Key:** `Digit9` (the 'landing gear' step: UP <-> DOWN).
  - **Hand packet:** the hand's gear handle rides the worker's packet (`sim_link.js` / `sim_host.js`).
  - **Lamps:** three on the PFD, green down and locked, red in transit, dark up. The line says the state, 'gear DOWN?'
    with the handle down and the gear not, and EMERG.
  - **Horn:** on the stall voice, intermittent 0.3 s on / 0.2 s off. It sounds with the gear not locked down off the
    ground and either the throttle under 25 % or the flap over 35 % (`audio_params.js` gearWarn,
    `airframe_model.js`).
  - **Swing** (`app.js` gearSwingRig, the join's `gearSwing`): each unit's leg, wheel and castor under one group, turned
    90° about the leg's airframe end, conjugated by the capture's map.
    - A main rooted on the wing folds INWARD about the fore-aft axis.
    - A main rooted on the body, and the nose, swing AFT about the lateral axis.
    - The sense is probed. A stowed unit is hidden. There is no well yet: it lies inside the skin.
- **GATE RETRACT** (`tools/_retract_check.js`, core): the spec, the bill, the squat switch, the expert's circuit, the
  drag, the gear-up landing, the power and the emergency, the forgetful person, the horn.
- **Pictures without the game:** `tools/quickshot.js --gear 0..1` (the user: "use a simple renderer for screenshots,
  not the game") swings the editor's own gear units by the same rule (`CAGE_GEAR.swing`, which the join also reads).
  The stills of the T-tail tourer at 1 / 0.5 / 0 (front, side, three-quarter) are in `reports/evidence/RETRACT-1/`.
  - Half-way, the mains fold inward under the wing roots and the nose swings aft.
  - Up, the units are inside the skin; a sliver of the nose unit shows under the cowl.
- **Left for later, said:**
  - the cockpit's own gear lever and lamps (a `gear` law in `cockpit.js`);
  - the bus driving `gearPower`;
  - the career's tech table (retraction as a tech option);
  - the T-tail tourer card switched to retractable: GATE ARCHETYPES flies a card's birth spec pre-join, and a spec write
    of `gear.retract` would need a `GEN_DEFAULT` field;
  - wells and doors (step 4);
  - the other motions' presets (step 3);
  - the amphibian (step 2).

---

## 8. THE WIDE OVERVIEW - ONE GEAR SYSTEM (the user, 3 Nov 2026, the night)

The user's direction, in their words where it matters:
- "merge that with the amphibious floats at some point, where these ones can integrate directly the landing train";
- "control the direction of rotation of the wheels ... the Skymaster, which rotates on two axes and then comes and
  sticks to the back";
- "the Catalina ... retract partly their wheels without doors ... an inset into the fuselage ... keep the inset that we
  would generate anyways";
- "the closing doors on the path";
- "a part of the cut is actually going onto the wheel and the leg, and another part is becoming a little opening door";
- "maybe just a box";
- "a wheel which is also turning 90 degrees on its own axis to be flatter".

And on the user interface: "we do not need a ton of diagnosis. We just need responsive sliders that are showing it red
when it is and then turns not red, and then you see the cutouts and you have something to simulate, and then you choose
whether it has a door ... and you choose the way they fold. We obviously always cut exactly. Wells before doors, but we
do not forget doors afterwards."

### 8.1 The model: a gear UNIT, everywhere

Every wheel station is a unit:
- the mains pair (mirrored);
- the nose or tail wheel;
- AND the wheels of an amphibious float: two nose units in the bows, two main units in the floats.

A unit carries five things:
1. **Its leg and wheel** - today's families: beam, link, oleo, castor.
2. **A MOTION:** an ordered chain of up to three turns, each a hinge point, an axis (a direction to pick, not a sign to
   guess) and an angle. Plus the wheel's own twist about the leg's axis (0-90 degrees: "to be flatter"). Plus a
   RETRACTION FRACTION:
   - 1 is fully up;
   - 0.6 is a Catalina or a DC-3, the wheel stopping in its inset half out.

   Each turn is a row; a preset fills them all:

   | Preset | What it does |
   |---|---|
   | `inward` | Mooney, Bonanza, Arrow |
   | `outward` | Spitfire, Bf 109 |
   | `aftTwist` | P-40, F4U: aft + the wheel's 90-degree twist |
   | `aftBelly` | the Cessna RG's twist-and-tuck |
   | `skymaster` | aft, then a second turn that lays the leg along the body (two axes, as the user describes the 337 - to check on a reference) |
   | `noseAft`, `noseFwd`, `tailFwd` | the nose and tail legs |
   | `semi` | partial, no door |
   | `floatNose` | up and aft onto the float's deck |
   | `floatMain` | up into the float |

   The motion is a law the flight replays: the position 0..1 walks the chain (the turns in sequence, the twist across
   them). The physics keeps option A: the contact plane follows the wheel's lowest point at that position, which makes
   a semi-retract roll on its exposed tyre for free.
3. **A HOST**, measured: where the swept volume lands - the body, the wing, a nacelle, or a float.
4. **A WELL:**
   - **Shape:** `fitted` (hugging the swept volume plus 30 mm) or `box` (its bounding box, the user's "just a box").
   - **Cut:** always cut exactly into the host's skin, walls and ceiling included.
   - **Partial units:** a semi-retract unit keeps its well as the inset it stops in.
5. **DOORS**, chosen: none / leg door / leg door + well doors. The well's outline is split in two:
   - the part over the leg's path becomes the LEG DOOR, riding the leg and the wheel ("a part of the cut is going onto
     the wheel and the leg");
   - the rest becomes WELL DOORS, hinged on an outline edge, that open, let the gear through, and close ("the closing
     doors on the path").

   The cut piece IS the door, so the door is the skin it came from.

**No fairings on a retracting gear** (done, 3 Nov): no spat, trouser or leg shroud. The doors are its fairing.

### 8.2 The editor: sliders that go red, and a swing to watch

- **A `gear position` slider (0..1)** simulates the motion in the editor, the shed's own preview. The same position
  drives quickshot `--gear`.
- **Red sliders, no diagnosis wall.** Any row whose value makes a unit not fit turns RED, and turns back the moment it
  fits:
  - the motion's angles, the hinge, the track, the leg, the wheel, the twist, the fraction;
  - the wing's thickness and chord;
  - the tanks' rows.

  "Not fit" is four things only:
  - the swept volume leaves the host's skin (past the fraction's declared exposure);
  - it crosses a spar or the floor;
  - it meets the other units (the two mains under the belly - the T-tail tourer's today);
  - it meets a tank or the crew.

  A one-line tooltip says which. Nothing changes the geometry by itself.
- **The cutouts are drawn** as the sliders move: exact cuts, recomputed on release; while dragging, the outline only.
- **One choice for the doors**, one for the fold (the presets above, then the rows to tune).

### 8.3 The reservation

- The wells are keep-outs every fitter respects:
  - the fuel bays lose their volume, in the core's numbers too (genBayResolve);
  - the tank fit and the crew fit treat a well like structure (TANK-FIT's exact solid test);
  - GATE CLIP sweeps the gear's travel like any control's.
- A well is published in the spec (`gear.wells`, measured by the join), so the core knows it without the editor.

### 8.4 The amphibious floats, on the same units

The float is a host, as the wing and the body are. The float generator owns its sections, so a float well is cut in the
hull it draws.

The physics is the part §3.2 already costed:
- the wheel nodes hung on the float's own nodes;
- the land / water switch;
- the wheels' water plates running beside the float pass;
- the advisory voice.

Done after the land retract's wells: the amphibian then needs no new drawing machinery, only its two presets and its
physics.

### 8.5 The order (replaces §3.3-§3.4)

| | What ships | Days |
|---|---|---|
| G1 | The motion chain: up to three turns, the twist, the fraction, the presets above. The editor's `gear position` slider, the flight replaying the chain. Retire the single 90-degree swing | 3 |
| G2 | The red sliders: the swept volume per unit (sampled turns + the wheel's cylinder and the leg's capsules); the four tests; the rows that turn red | 2-3 |
| G3 | The reservation (§8.3) | 2 |
| G4 | The body cut: the knife from below, the well's walls and ceiling; `fitted` and `box` | 2-3 |
| GM | THE MECHANISM (added 4 Nov after G4, §8.11): the trunnion inside the structure, the leg an oleo, the brace and the actuator modelled and animated, one kinematics for the editor, quickshot and the flight (WYSIWYG) | 5-7 |
| G5 | The wing cut: the knife on the wing loft's lower skin, in the rib/spar field, the flex binding kept | 3-4 |
| G6 | Doors: the leg door and the well doors from the cut, the door sequence | 3 |
| G7 | The amphibian on the same units (§3.2's physics + the two float presets + the float well) | 7 |

G1-G5 is about 12-15 days; G6 3; G7 7.

### 8.6 The reference aeroplane

The archetypes have never been fitted to a real aeroplane, and wells are where that shows: the T-tail tourer's track
(1.6 m) puts its folded wheels together under the belly. The user can provide a model; the fit is REF_MATCH's
(`tools/REF_MATCH.md`, `tools/ref_match/KICKOFF.md`).

**Recommendation: the PIPER ARROW (PA-28R).**
- It is the Cherokee with a retracting gear, so a Cherokee model is the same airframe: fixed now, retracting once its
  gear is fitted.
- The garage already draws every part of it: the low wing, the straight or T tail, the cabin, the flat-four on the nose.
- The T-tail tourer card IS an Arrow IV in all but name: a low wing, a T-tail, a Lycoming IO-360, a tricycle.
- Its mains fold inward into the wing and its nose aft, the first motion built.
- Of the family, an Arrow II's or a Cherokee's constant-chord wing is the easiest to fit. An Arrow III / IV's tapered
  wing matches our card. Either works.

**Against the others:**
- The Bonanza needs the tapered V-tail and a tapered wing fitted.
- The Mooney needs its forward-raked fin, a garage gap.

**What a model must show:** the gear DOWN, ideally with the wells and doors visible - the doors are what we will match.

### 8.7 G1 AS BUILT (2026-11-04)

- **The fold** (`tools/_cage_gear.js`: FOLD_PRESETS, foldOf, foldChain, foldPose; published as `CAGE_GEAR_FOLD`).
  - A unit's chain is applied in this order:
    1. the wheel's TWIST about its own leg (the leg's airframe end to the axle, or to the castor's top);
    2. up to two TURNS about BODY axes through the hinge, one after the other.
  - Each turn's sense is PROBED on the axle where the turns before it left it: + is inboard about the fore-aft and
    vertical axes, and aft about the lateral axis. The starboard mirrors the port (the twist's sign flips).
  - The pose at position g walks s = (1 - g) x frac: the twist across all of it, the turns one after the other.
  - The presets [TUNE on a reference]:

    | Unit | Preset | Turns and twist |
    |---|---|---|
    | mains | `inward` | fore-aft 90 |
    | mains | `outward` | fore-aft -90 |
    | mains | `aftFlat` | lateral 90, twist 90 |
    | mains | `aftBelly` | lateral 85, then vertical 35, twist 90 |
    | mains | `skymaster` | fore-aft 45, then lateral 90 |
    | mains | `custom` | two turns + twist as rows |
    | nose | `aft` | lateral 90 |
    | nose | `fwd` | lateral -90 |
    | nose | `custom` | as rows |

- **Rows** (the retraction group; claimed by the mains part's 'retraction' and 'fold' groups):
  - `gearPos` - the preview: 1 down, 0 up;
  - `gearFold` and `gearFoldNose`;
  - the custom rows `gm1Ax`/`gm1Ang`/`gm2Ax`/`gm2Ang`/`gmTwist` and `gn1Ax`…`gnTwist`;
  - `gearRetFrac` - the fraction, 0.3-1.
- **The preview:** the gear layer poses its drawn units at `gearPos`. quickshot `--gear` is that row. The join's capture
  holds it at 1 (VIEW_STATE 'gear position', `hidden`: a panel row, not a rail control).
- **The lift:** foldChain MEASURES how far the stowed wheel's lowest point rises. The join writes `gear.retract.lift`
  { mains, nose } and `frac` (only when < 1). The solver's contact plane uses the measured lift; without it, the frame's
  rule times the fraction.
  - A PARTIAL gear (frac < 1) rolls on its exposed tyres when up, and keeps (1 - frac) of the gear's drag.
  - Its stowed units stay drawn (visible) in flight.
- **The flight** (`app.js` gearSwingRig) replays the same chain from the join's `gearSwing` (hinge, leg, twist,
  turns, frac), each turn conjugated by the capture's map.
- **The certificate** (`genStolCageOff`, every fingerprint's path): with the gear fixed, every retraction row is absent;
  the preview is always absent. This also closes step 1's rows (`gearRetract`/`gearRetT`/`gearRetAct`), which were
  counted on the core's path.
- **GATE RETRACT §10:**
  - inward goes inboard and up, mirrored; the nose goes aft; the lift is measured;
  - outward goes outboard; aft-flat goes aft with the wheel lying flat; two axes give two turns; custom equals the
    preset it copies;
  - the fraction stops part way; the preview poses the units;
  - the join writes the fraction and the lift; the certificate strip holds;
  - a partial gear's downwind lies between the down and the fully up.
- **Still the T-tail tourer's:** its 1.6 m track folds the two mains together under the belly. G2's red sliders are
  what will say so.

### 8.8 G2 AS BUILT (2026-11-04): does it fit - the rows that go red

- **The test** (`tools/_cage_gear.js` foldFit, in the gear layer's own build, after the wing: about 20-50 ms):
  - **The points:** each unit's tyre (two faces x two rings x 12, plus the hub) and its leg (from a quarter of the way
    down). They are posed at six positions along the fold: 1, 0.8, 0.6, 0.4, 0.2, 0.
  - **SKIN:** fully up (a whole retraction only; a partial one declares its exposure), every point is inside the body
    or the wing, 15 mm in. Within the body's width the envelope is the body and the wing's centre section together.
    Points outside are said as: N mm through the wing's skin, N mm out of the body, aft of the trailing edge, or ahead
    of the leading edge.
  - **SPAR:** the stowed wheel's points inside the wing (out of the body) sit in one bay. Their chord fractions cross
    neither GEN_RULES.sparFront nor sparRear.
  - **FLOOR:** nothing inside the body rises above the cabin floor (floorY x scale, 20 mm under it), at any position.
  - **UNITS:** the units clear each other by 30 mm at every position.
  - **TANKS:** the fifth test, read when the rows refresh (`fitTanks`: the energy layer runs after the gear). A posed
    point inside a body tank's box or a wing tank's side boxes counts.
- **The red rows:**
  - Each failed test names the rows a builder turns:

    | Test | Rows |
    |---|---|
    | skin | the fold, the wheel radius, the leg drop, the fraction, the wing's thickness, and the gear's fore/aft when it sits off the chord |
    | spar | the fold, the gear's fore/aft, the wheel, the wing chord |
    | floor | the fold, the leg drop, the wheel, the floor, the fraction |
    | units | the half track (mains) or the stations (a main and the nose), both folds, both legs, the wheel |
    | tanks | the fold, the station, the fraction, the retraction switch |

  - `window.CAGE_ROW_BAD()` gives each row key its reason. `_cage_ui.js` applyRowVis reads it after every build: a
    flagged row turns red (`.rowBad`, editor.css) with the reason as its tooltip, and back the moment it fits.
  - The retraction row carries the first reason as its note.
  - No other layer's row definition changed: the red is keyed by the row's key.
- **What the T-tail tourer as born says:**
  - the two mains meet as they fold;
  - each stows 79 mm out of the body, and the nose wheel 69 mm out.

  A track of 3.2 m at a 0.6 fraction fits. Mains moved forward to 1.8 m cross the front spar when folded inward. A nose
  turned 130° rises 222 mm into the cabin floor.
- **GATE RETRACT §11** holds all of it, plus "a fixed gear: no fit, nothing red".

### 8.9 G3 AS BUILT (2026-11-04): the reservation

- **The wells** (`tools/_cage_gear.js`, the end of foldFit; CAGE_GEAR.wells): per unit, the box round its stowed points
  (the tyre and the leg, fully up at its fraction) and 30 mm more. Each well carries:
  - its share in the body and in the wing (by its points: a partial gear reserves only what goes inside);
  - its band of the section at its station (lv: 0 keel .. 1 top);
  - its span fractions;
  - its volume.

  The editor draws each as edges (a LineSegments overlay, outside the capture): amber when the fold fits, red when it
  does not. quickshot draws them over its picture.
- **The spec** (`gear.wells`, written by the join with the retraction only): per unit `{ unit, x: [station range, the
  frame's body x = gear.x + the mains axle's z - the point's], lv, span, bodyL, wingL }`. clampSpec keeps four at the
  most and drops them with the retraction.
- **The core's bays** (`60c_gen_energy.js` genBayWellL, inside genBayResolve): a body bay gives up each well's body
  litres by its share of the bay's station range and band; a wing bay gives up the wing litres by its share of the
  span (the first plane). Every reader of the bays follows: the frame's vessels and the plaque's vessel fit. No wells,
  no change, to the bit.
  - As born: the cabin and under-floor bays lose 106.6 L (313.9 → 207.3 under the floor).
  - With a 3.2 m track: the wing root loses 38.8 L (347.5 → 308.7).
- **The editor's tanks** (`_cage_energy.js` judgeAll): any placed tank, body or wing, that meets a well is red, "the
  retracted gear's well (left main)" (`wellHitsTank`: separating axes in plan, the tank turned about y, the heights'
  overlap). The gear's own rows also go red against a tank (G2's fifth test).
- **Not here, and why:**
  - The crew fit: the floor test already keeps every well under the cabin floor.
  - GATE CLIP's sweep of the gear's travel: until the wells are CUT (G4 / G5), a stowed unit is inside a closed skin
    by design, and CLIP would read every such build as clipping. It comes with the cuts.
- **GATE RETRACT §12** holds the wells, the tank test, the spec, both bays' losses, and the fixed builds untouched.

### 8.10 G4 AS BUILT (2026-11-04): the wells cut into the fuselage

The user: "keep the option to cut rectangular or exact, so we have a fallback in case we struggle with exact". The
cut is always exact (the knife); the OUTLINE it cuts is the row's choice.

- **The row** `gearWellCut` (the retraction group, the mains' part): `exact (the swept unit's hull)` (0, the default) or
  `box (a rounded rectangle)` (1). Like every retraction row it is absent from the cage when the gear is fixed
  (CAGE_RETRACT_ROWS / GEN_RETRACT_ROWS), so no fixed build's certificate moves.
- **The outline** (`tools/_cage_gear.js` wellCutsOf, at the end of foldFit; CAGE_GEAR.cuts):
  - each unit's points (the tyre's two rims at two radii, the leg at five stations) posed through the whole fold at
    17 positions, plus the points where a swept point crosses the skin between two of them;
  - those inside the body (the airframe table's section) are the well's: exact = their plan hull grown by FIT.clear
    (30 mm) all round; box = their plan box, 30 mm wider all round, the corners rounded by the same 30 mm (so it always holds the exact hull);
  - the ceiling is their highest point plus 30 mm;
  - two outlines that meet are cut as one (their points together, the higher ceiling) - as born, the mains' two wells
    under the belly are one cut;
  - published in the knife's terms: cage units, the outline in (u, v) = (z, -x), counter-clockwise.
  - The preview position never moves it (the cut is the whole fold's). A unit that never enters the body (a 0.6
    fraction on the T-tail tourer; the mains of a 3.2 m track, which stow in the wing) has no body cut.
- **The knife from below** (`tools/_knife_gen.js`): knifeCut takes `opt.frame` (the projection straight down, t1 along
  the body), `opt.outline` (the outline as given) and `opt.ceil` (the recess is a BOX: the pane is the flat ceiling at
  that height, each point straight up from where the outline met the skin; the walls stand vertical; a wall of zero
  height is not drawn). A face whose box in the frame misses the outline's passes as it is (the same output, ~20 %
  faster). `knifeWells(sheet, cuts)` runs it per cut over the skin's sections only (WELL_MATS), section `wheelWell` for
  the walls and the ceiling, then `knifeCarve`: every other face inside a well's prism (the frames, the liners, the
  bulkheads below the floor) is clipped against the prism's planes and only its outside kept - the well is empty.
  As born: two cuts, 64 + 34 loop points, one closed loop each, 477 interior faces carved, ~100 ms in node.
- **Where it is cut** (`tools/_cage_ui.js` wellApply, after the post chain): the gear layer stands its legs on the
  sheet, so it can only say where the wells are after the sheet is built. The DRAWN fuselage is cut, never the
  measured sheet (MS, every layer's ctx.mesh, the dims, the glazed area: the legs, the wing deck and every contract
  read the whole skin). The level-2 mesh is swapped for a cut one in place (eyePut: the scene slot, the materials by
  section, the glass), and the eye sheet (the cockpit's and the flight capture's) is cut the same way when it is
  made. A diagnostic view (surface, curvature, wire) draws the sheet as it is. A drag tick never cuts (its fuselage
  stands uncut, so the deform preview keeps working); the release cuts it.
- **The section** `wheelWell`: role `struct` in aeroskin (the construction's own frame finish, inside: the cabin's
  darkness), labelled "wheel wells" in the finish panel.
- **quickshot** cuts the wells as the editor does (`--nowells` draws the sheet whole), draws `wheelWell` grey, and has
  two views for them: `bottom` and `qb` (three-quarter from below); `--noedges` leaves G3's boxes out.
- **Not here, and why:**
  - The wing's centre section (the wing layer's mesh) still runs through a mains well on a low wing: the wing's cut
    is G5's.
  - The well does not yet open and close: the doors are G6's (a part of the cut on the leg, a part a well door).
  - GATE CLIP's sweep of the travel: next, now that the body has its wells (the wing's after G5).
- **GATE RETRACT §13** holds it (see its header).

### 8.11 GM - THE MECHANISM (the user, 4 Nov, after G4)

The user, on G4's stills: "you did not animate the full mechanism, so the whole assembly rotates, instead of activating
through a piston. You did not model the rotation points which should probably be put further into the fuselage. We
should have a proper 3D model and animation of these retractable gears before we go further. WYSIWYG." And: "you
should do G5 anyways, that's probably the cause of the yellow bars through. But you did not have a phase for correct
modeling and animation of the landing gear, so that one should be done." GM comes before G5.

**What G1-G4 drew** (measured on the T-tail tourer, headless):
- The pivot was the fixed gear's root on the SKIN: the mains' pads on the wing's lower skin at |x| 0.70 (the circled
  brackets, left behind as the leg swings) and the nose's plate under the belly. Nothing turns about a pin inside the
  structure.
- The whole leg group turns rigidly about that point: a spring-steel BLADE (the card's mains, s1Leg 0) swings bent into
  the belly. No real aeroplane retracts a blade.
- No brace, no actuator: nothing drives the leg or locks it down.
- Two belly fittings sit inside the new wells: the transponder aerial in the mains' (the red fin) and the fuel drain in
  the nose's.

**The phase** (each step shipped with its stills, its gate rows and its browser check):

- **GM1 - the trunnion and the leg.**
  - A retracting leg is an OLEO (blade and bungee V are not offered with the retraction; the join's suspension is
    'oleo': the physics follows the drawn leg).
  - The PIVOT moves into the structure. Mains on a low wing: up inside the wing at the spar's line, at mid-depth. Nose:
    inside the fuselage, above the well's ceiling line and below the floor, on a frame.
  - The oleo runs from the trunnion through the well's opening to the axle. The trunnion is a cross-pin in two
    bearing blocks bolted to the spar or the frame (static); the leg's yoke turns on it. No skin pad.
  - The fold's hinge is the trunnion's point; the inward/outward turn's axis is the pin's.
  - The access fittings are kept out of the wells (the aerial and the drain move to the nearest clear belly).
- **GM2 - the actuation.** Per unit:
  - a folding BRACE: a side brace for an inward/outward fold, a drag brace for an aft/forward one. Two links and a knee,
    from a pivot on the structure to a pivot on the leg; over-centre (locked) down; folding as the leg swings.
  - the ACTUATOR, by the actuation row:
    - hydraulic: a cylinder and its chrome rod;
    - electric: a motor and screw jack;
    - manual: the Johnson bar's push-pull rod.

    It runs from a structure pivot to a horn on the leg above the trunnion; its stroke and closed length are checked
    (a real cylinder cannot extend past about twice its closed length).
  - the wheel's TWIST (aft-flat, twist-and-tuck) turned by a link.
- **GM3 - one kinematics** (WYSIWYG). Each mechanism part carries one of three rules:
  - RIGID with the leg (the leg, the wheel, the yoke);
  - AIMED between two moving points (the cylinder's body from its base pivot, its rod from the horn: they slide in
    each other);
  - the two-link KNEE (the brace, solved in its plane).

  One pure function in the core poses every part from the gear position g, read by:
  - the editor's preview row;
  - quickshot `--gear`;
  - the flown aeroplane (the snapshot carries the parts and their rules; app.js poses them with the same function,
    replacing the rigid swing).
- **GM4 - the proof.** GATE RETRACT §14:
  - the trunnion inside the structure;
  - the links' lengths constant over the whole fold (to 1e-6);
  - the brace over-centre down;
  - the actuator within its stroke, never inverted;
  - every mechanism part, at every g, inside the skin or in the well's opening;
  - the editor's pose equal to the flight's.

  Also stills at g = 1, 0.66, 0.33, 0, and the browser rig in the garage and in flight.

The yellow bars through the stowed mains (the wing's centre section running through the well on a low wing) are G5's,
which follows GM. G6's doors then hang on GM's parts (the leg door rides the leg; the well doors on their own hinges).

#### GM1-GM3 as built (2026-11-04)

- **The trunnion** (`tools/_gear_gen.js` legOleo, `st.ret`; `tools/_cage_gear.js` retIn / retPin). A retracting leg is an oleo
  whatever the leg row holds (the row says so in a note; the join flies `suspension: 'oleo'`). Its pin is inside the
  structure:
  - a low wing's mains: at the wing's mid-depth over the leg's root (the T-tail tourer's station at 97 % chord gives
    48 mm a side);
  - a body leg (the nose): 45 % of the way from the keel to the cabin floor, 50-160 mm (the tourer's nose: 122 mm in);
  - the pin lies along the fold's first axis. Its two lugs and the fitting plate are the structure's (static, sized to
    the depth there); the strut's yoke turns on it. No pad on the skin.
- **The mount test** (the fit, 'mount'): a wing leg's trunnion needs 80 mm of structure depth. Less turns the station
  rows (fore/aft, half track) and the wing's thickness red.
- **The fittings** (`tools/_cage_access.js`): a body fitting whose site falls in a well (its outline + 50 mm, under its
  ceiling) slides along the body to the first clear station. On the tourer, the fuel drain went 2.28 → 2.68 and the
  transponder aerial 1.16 → 0.53.
- **The actuation** (`tools/_cage_gear.js` mechBuild, MECH):
  - **the brace**: from a structure pivot (85 % of the way from the trunnion to where the brace point stows) to the
    leg's brace point (40 % down). Its two links are equal. It is straight down, and its knee folds UP into the
    structure in the leg's swing plane.
  - **the actuator**: hydraulic (barrel, hose bosses, chrome rod) or electric (screw jack, motor box); none for the
    manual gear. It runs from a structure pivot (2.8 x the actuator point's stowed offset from the trunnion) to a point
    30 % down the leg. Its body is the closed length less 30 mm; the rod reaches the extended length and 30 mm in.
  - On the tourer (3.2 m track): the mains 0.367-0.602 m, the nose 0.314-0.518 m, all within a real cylinder's stroke.
- **The one kinematics** (`src/core/62c_gear_mech.js`, GEAR_MECH: gearFoldPose, gearMechPose; built into the core): the
  record is the units' chains, the knees and the parts.
  - Rules: rigid (the leg, the wheel, the castor), aimed (a link, a barrel, a rod: its base on one point, its axis to
    another).
  - The two-link knee is solved in its plane, bent toward a reference off the brace's line. (The trunnion itself is ON
    the line when stowed: the first cut's knee jumped there.)
  - Down, every pose is the identity.
  - The garage poses its groups with it. The join captures each mechanism part (`edMech<unit>_<part>`, kind
    `gearMech`, pivoted on its rest base) and the record with the capture's linear map Mp (`gearMech: { R, Mp }`).
    app.js poses the units and the parts with the same function, each matrix carried through the map (Mp T Mp^-1). An
    older snapshot (no gearMech) keeps the rigid swing.
- **The well's cut, GM's** (the user: "you should include a cut for the rest position too. A cut in which the rotation
  point slots"):
  - the swept points now take the leg FROM ITS TRUNNION (every 5 %) and the brace and actuator at every position, so
    the slot where the leg leaves the skin gear down is in the outline;
  - the ceiling is FITTED: a height map of the swept points (30 mm cells, grown by the clearance, never above the
    cut's top), deep only where the unit, its trunnion and its brace go;
  - the floor test sees the brace and the actuator too.

### 8.12 G5 AS BUILT (2026-11-04): the wells cut into the wing

- **Where the wing is cut** (`tools/_cage_gear.js` wellRaw / wellMerge; CAGE_GEAR.cutsM):
  - the units' swept points inside the wing (between its skins), with their crossings, AND the body's;
  - merged where they meet, so a low wing's centre section is cut wherever it crosses a belly well (the "yellow bars
    through the wheels" of the user's G4 still);
  - in the layer's own metres, exact or box like the body's, the leg from its trunnion (the rest slot in the wing's
    lower skin) and the mechanism swept with it;
  - a wing well's fitted ceiling is held 8 mm under the wing's upper skin outside the body: a unit thicker than the wing
    pokes through it, and the fit's rows say so; the wing's top is never opened.
- **The knife on a THREE geometry** (`tools/_knife_gen.js` knifeWellsGeo): the wing layer's skin meshes (tagged
  `userData.wingSkin`: main, centre, tip, stol) become the knife's mesh, with every attribute but the position and the
  normal packed into the field and lerped like it. Each is cut from below (the same knifeCut, the fitted ceiling) and
  carved, then split back into the skin's geometry and the well's (section `wheelWell`, a child mesh).
- **knifeCarve, revised**: the prism's walls clip exactly; a piece inside them is carved only under the cut's fitted
  ceiling (at its centroid). The structure over a shallow part of a well stays.
- **In the garage** (`tools/_cage_ui.js` wingWellApply, after the chain with wellApply): each skin mesh is re-cut from
  its own first geometry when the cuts change. A mesh whose box misses every outline is left as it is; an exploded view
  is uncut.
- **In flight**: nothing new. The wing's skin is bound to the spar by its vertices' places when the flight loads it
  (makeSkinBinding), so the cut skin and its well flex with the wing.
- **quickshot** cuts the wing's skin the same way ("wing wells cut: ...").
- **GATE RETRACT §16** holds it.

### 8.13 G6 AS BUILT (2026-11-05): the doors

The user: "Most of the fuselage actually goes onto the leg that retracts, and only a little part is left as a door that
needs to open and close ... Did you keep the square cut option? This one could have simple doors based on the square
cut; One, or 2, slitting in the middle?" (Yes: the box outline, `gearWellCut` 1, is kept.)

- **The patch** (`tools/_cage_gear.js` doorBuild): per cut, the skin the knife takes out, rebuilt exactly. That is the
  skin's down-facing faces clipped to the outline in plan: the fuselage sheet's skin sections for a body cut, the wing
  skin meshes outside the body for a wing cut. It is shared out as follows.
  - **The leg door** (exact outline, row `gearLegDoor`, on by default): for each unit, the part of the patch inside
    its stowed plan footprint (the wheel and the leg, 10 mm round). It is carried by the unit as a rigid part, drawn
    where the down leg holds it (the stowed pose undone), so it lands flush in the opening when the gear is up. Gear
    down it hangs on the strut, as a gear door does.
  - **The well doors** (row `gearDoors`: none, one, or two split along the well's long axis, which is the patch's
    principal axis). They cover whatever is left (exact), or the whole box (box: no leg door). Each is hinged on its
    outer long edge (one door: the side away from the centreline) and opens DOWN by 85°.
    - Sequence (the core's gearDoorOpen): open within 0.15 of the gear leaving either end, shut once it is up.
    - Gear down, a door shuts again unless the down gear (the wheel, the leg from its trunnion, the brace, the
      actuator) passes through it; such a door stands open, and is drawn open, its rest.
  - Each door is a panel in the skin's own finish (the fuselage's 'body' material, the wing's skin material) over a
    dark inner face 4 mm in.
- **The one kinematics**: the core's rule 'door' (hinge, axis, angle, sequence), relative to its rest at g = 1. The
  leg doors use the rule 'rigid' on their unit. The join captures every `edMech*` part (pivot: its o0), so the flight
  poses the doors with the same function.
- **Measured** (the T-tail tourer, 3.2 m track, exact):
  - a leg door on each unit: the nose's 0.059 m², the mains' 0.143 m² each on the wing;
  - small well doors for the rest;
  - up, every door flush on the skin it came from (4 mm: its inner face);
  - the box with two doors: two per well, one shutting gear down, the other standing open where the leg passes.
- **GATE RETRACT §17** holds it. Not yet: the doors' drag when open, and a door's own hinge hardware.

### 8.14 GR - ROBUSTNESS: the battery, the questions, the remedies (the user, 5 Nov, after G6)

The user: "you need to leave a gap in your opening ... the wheels are not fitting into your wings, so it looks odd ...
I think you have your piston still sticking out at the end ... when they are not getting it in completely, we would
still do the cutouts ... I do not see the round cutout for the wheel ... maybe you want to get the wheels higher so that
really penetrate the wing ... a full battery of images for a lot of cases (the wing, the fuselage, the tip of a narrow
nose, the cowl) ... partially retractable ... the Skymaster ... two axes ... the back pod ... would we be able to cut into
a cowl ... a single test plane, that's not enough. You can take ... the B-ITES plane."

**The battery** (`tools/retract_battery.js <out-dir>`): every case drawn by quickshot down / half / up, from a
three-quarter below and from ahead. The frame is fixed on the gear down (`--focus gear`, `--frames`), giving one
contact sheet a case. The aeroplanes are the T-tail tourer and B-ITES (`builds/candidates/B-ITES.json`, a low-wing
oleo tricycle). The cases: into the fuselage, into the wing, the box with two doors, a 0.6 fraction, the nose folding
forward.

**What the first battery shows** (5 Nov, on G6):
1. **Into the fuselage** (both aeroplanes as born): the mains and the nose stow, and the doors close flush.
2. **Into the wing** (both, a wide track): the stowed wheels hang UNDER the wing. The wheel rides its stub axle
   OUTBOARD of the leg (hubIn ~0.1 m); the inward 90° fold turns that offset DOWN, so the stowed wheel's centre is
   ~0.1 m under the trunnion's pin at the wing's mid-depth. The tyre (~0.15 m) is also thicker than these wings
   (96-110 mm there). On the T-tail tourer the station is at 97 % chord, so the well is clipped STRAIGHT by the
   trailing edge: the user's "straight cutout".
3. **A 0.6 fraction**: nothing enters the structure, so no inset is cut.
4. **The actuator**: its base (2.8 x the actuator point's stowed offset from the trunnion) can stand outside the
   wing; its end sticks out stowed.
5. **The doors**: they lie edge to edge with the skin, with no seam.

**The remedies, in order:**
- R1 THE SEAM: every door is 4 mm short of the opening's edge and of its neighbour (the leg door's edge too).
- R2 THE ACTUATOR INSIDE: its base searched in the swing plane (along the stowed line and turned off it) for a place
  inside the structure, with the barrel inside it stowed and the stroke a real cylinder's. None found: the fit's
  'actuator' test turns the fold's rows red.
- R3 THE WHEEL HIGHER: a preset's last turn is trimmed (-15..+25°) so the stowed wheel's centre sits at the
  structure's mid-depth there (the wing's, or the body's between keel and floor). The physics' lift follows the chain.
- R4 THE CUTOUTS WHERE IT STILL PIERCES: where the stowed wheel stands proud of a skin (a wing thinner than the tyre,
  a partial fold), that skin is cut round it:
  - the upper skin by the knife from above, a hole, no recess;
  - the doors (leg door, well doors) minus the wheel's section on the lower skin.

  The wheel lies in its inset, as on a DC-3 or a Catalina.
- R5 THE COWL (the nose folding forward under a long cowl, a pusher's pod): the cowl layer's meshes as a cut target,
  the wing's way (knifeWellsGeo on its geometry), and the cowl's own doors. To study on the battery's nose-forward
  cases first.
- R6 THE SKYMASTER: the mains on the booms/pod of a high wing, folding aft on two axes into the boom or the pod. This
  needs the retraction opened beyond the low-wing tricycle (GEAR_RETRACTABLE): body- or boom-rooted mains, the
  'skymaster' preset (already a two-turn chain), the pod/boom as a cut target. A study with its own case in the
  battery before code.

### 8.15 THE CATALINA (the user, 5 Nov: "before the skymaster, study the catalina")

The user: "It remains a popular way of retracting gear for boat planes, and we should be able to cut into a fuselage
or a Hull, and have this sort of mecanism, not necessarily requiring doors."

**The real thing** (PBY-5A, and the amphibians after it: Goose, Widgeon, Albatross, the modern amphibious hulls):
- The mains hang from the hull's sides, braced to the wing.
- Up, each wheel lies in a RECESS in the hull's side, about half out of it, upright, above the chine. There are no
  doors: the recess and the exposed tyre are the design, and the hull's bottom stays clean for the water.
- The nose wheel goes forward into the bow behind two doors.
- The mechanism is a linkage (the oleo, a long side strut to the wing, a drag link), hydraulic with a hand pump as
  the alternate. The wheel rises roughly ALONG the hull's side.

**In our terms** (built 5 Nov):
- **The retraction opened beyond the low wing.** Any wing position retracts a tricycle: a low wing's mains root on the
  wing, any other's on the body. GEAR_RETRACTABLE, the retraction rows and the join no longer ask for a low wing.
- **v1 was wrong.** The user's review (5 Nov): "you're not cutting at the right place ... the back gear does whatever
  it does ... doesn't even feel like the mechanism is correctly articulated ... an inset in the fuselage in which the
  wheel really slots in ... nice round". v1 turned the leg 90 degrees about the lateral axis only. The wheel rose
  under the pin and its well was cut wherever the swept unit touched the hull. v2 replaces it.
- **The fold 'catalina' (v2): two turns, SOLVED per build.**
  - Turn 1 is about the lateral axis, searched from 45 to 135 degrees until the leg lies level (aft).
  - Turn 2 is about the vertical axis, searched from 0 to 40 degrees until the wheel's centre sits 50 mm into the
    hull's side (`SP.bodyIn`).
  - `C.solved` carries both angles.
- **The pivot is external.** A trunnion fitting stands just outside the skin (`retIn` negative: the oleo's radius and
  9 mm), as the PBY's does. The wheel rides INBOARD of its leg (`st.ret.flip`, legOleo's `hS`), so the tyre faces the
  hull.
- **The pivot's height is automatic.** The leg's root angle round the section is raised until the pin is at least a
  wheel's radius and the clearance above the lowest point of the near-vertical side (|nx| >= 0.85). The stowed wheel
  then clears the turn of the bilge, and so does its recess (v1 notched the bilge).
- **The brace.** The side strut runs from the hull side, 0.4 of the leg's length aft and 60 mm under the pin, with its
  knee bent outward. There is no actuator (the PBY's own is in the hull).
- **The recess is the wheel's only, and round.**
  - Its outline is the tyre's two rims, finely sampled (`wheelRims`: 48 points x 2 radii x 2 faces). The leg lies
    outside the hull and cuts nothing.
  - The side well: the knife's frame looks at the side (n0 = [±1, 0, 0]), the outline in (z, ∓y), the floor fitted
    (`ceilP`).
  - knifeCarveF clears the structure in any frame, using the deepest floor under each piece plus 8 mm, so no frame
    face shows inside the recess.

  `CAGE_GEAR.cutsSide`. No doors (rows: well doors none, leg door off).
- **On the Cessna 172 as the hull** (the battery's c172_catalina, a 1.2 m track, the floor raised as a hull's): the
  mains swing aft and level along the sides, then tuck into round recesses. The tyres stand upright, half in the hull.
  The nose folds aft into its belly well.
- **Not yet:**
  - the wing strut of the real gear (our brace is the generic folding brace);
  - the nose forward into a bow behind doors (the 'fwd' fold exists; the bow's doors are G6's below-cut doors);
  - a real hull with a step and chines (the amphibian, G7);
  - doors for a side well (doorBuild knows below-cuts only).

### 8.16 THE NACELLE GEAR (the user, 5 Nov: "nacelle mounted retractable wheels ... more or less under the engine, and then it folds back into the nacelle ... should work with low wing, high wing")

**The real thing:**
- **Low wing** (DC-3, Aztec, Seneca, DA42/62, Baron): the nacelle hangs under the wing and is deep. A short leg folds
  FORWARD (the DC-3, under the engine, the tyre's bottom left out) or AFT (the Baron) into it.
- **High wing** (F27, Dash 8, An-24, Fokker 50): the wing is high and the legs are long. The nacelle is carried on
  DOWN and AFT, past the trailing edge, as the gear's bay. The legs fold aft into it. The bay is most of what one sees
  of those nacelles.

**In our terms** (built 5 Nov, `_cage_gear.js`):
- **The nacelles.** The cowl layer's off-centre units (|x| > 0.3 m) are this build's nacelles (`nacellesOf`). Each has
  its skin meshes and a section table about its own centreline (`meshAirframe`). `nacIn` (the depth inside) and
  `nacAt` (the nacelle over a plan place) serve the probe, the mounts, the fold, the cuts and the doors.
- **The mount.** A main station whose wheel is under a nacelle roots its leg on the nacelle's bottom (`nacMount`,
  before the wing's mount, retracting builds only). The pin is 45 % of the nacelle's depth up.
- **The fold 'nacelle'** (the mains' eighth fold, appended): 90 degrees about the lateral axis, forward or aft,
  whichever way the nacelle runs further from the pin. The trim is limited to ±10 degrees and centres the wheel in the
  nacelle's own depth. A wheel past the nacelle's ends is heavily penalised, so the trim never chases the wing's depth.
- **The cuts and doors.** The swept units inside a nacelle are cut from below into its skin
  (`CAGE_GEAR.cutsNacM`; `_cage_ui` nacWellApply and quickshot cut every mesh tagged `nacSkin`). The well's ceiling
  stays under the nacelle's top. The doors (G6's) take the nacelle's faces: a leg door and one or two well doors.
- **The fit.** The 'nacelle' test turns s1Z, s1Drop and gearFold red when the stowed wheel ends up past the nacelle's
  front or tail.
- **THE GEAR NACELLE (`nacPodBuild`, row `gearNacPod`: auto / always / never).**
  - **When.** On auto, a nacelle that cannot take the folded leg is GROWN. It cannot when it is too short both ways
    from the pin, or shallower than the wheel and 40 mm.
  - **The pod's shape.** A fairing under the wing:
    - its top 30 mm into the wing's underside, following it (level with the trailing edge behind it);
    - a wheel's depth and the clearance below that, with the pin at the wheel's centre stowed;
    - the width of the tyre, or of the leg's offset with the tyre, widened toward 70 % of the nacelle's own (at most
      1.6 times the tyre's);
    - a long nose tucked under the engine, a full section from the gear bay's front wall to past the stowed wheel,
      and an upswept tail.
  - **The join.** The pod's mesh joins its nacelle's section table (the union's), so the mount, the pin (the pod's own
    height), the fold (now aft: the union runs aft), the trim, the well and the doors all read it as the nacelle. It
    is drawn in the gear layer, unnamed, so the join merges it as structure. It is tagged as nacelle skin, so the
    knife cuts its well.

**Evidence** (quickshot, scratchpad sheets `sheet_lowwing.png`, `sheet_highwing.png`):
- **Low wing (da62, s1X 2.45, s1Z 1.25).** No bay is grown. The mains fold forward under the engine into the
  nacelle, behind a leg door and two well doors, and the doors close flush. "always" changes nothing visible: the bay
  lies inside the deep nacelle.
- **High wing (twinBush, s1X 2.8, s1Z 1.25).** The 1.7 m legs and the slim nacelle on the wing could not work:
  before the bay, the wheel stowed in front of the propeller disc. Now the bay is grown and the 1.43 m legs fold aft
  into it, past the trailing edge. The doors close flush and no fit test fires for the mains.

**Not yet:**
- **The lift strut.** On the twinBush the strut crosses the bay at that track: a strut-braced high wing puts its
  nacelles inboard of the strut's root. There is no fit test for a strut through the bay yet.
- **The well doors stay open while the gear is down** (G6's sequence). The F27's close again. `closedDown` could be
  set for a nacelle bay's well doors, since the leg door covers the leg's slot.
- **The pod's nose is a separate body under the engine nacelle.** It is not a loft of the nacelle's own sections
  into the bay, which would be a smoother join.
- **A twin-boom or pusher nacelle** (engAim 2) has not been tried.

### 8.17 THE REVIEW OF 5 NOV (evening): the cut's finish, the fittings, the doors, the shortening

The user, after 8.16: "the cut is not that clean ... are you sure that you are cutting into the max subdivided mesh?
... you have a flat shading that doesn't help ... it doesn't feel like the cut is round at all ... the rotation points
... the plates ... do not look very realistic ... [the rest-position cut] only partially ... It should really not clip
at any points ... a metal plate sticking 90 degrees out of the fuselage ... a triangle structure ... another plate that
comes flat on the fuselage ... the backside should be as flat as possible ... cut through it, extrude that, and do a flat
surface ... allow these very long landing trains to half retract ... make these options in the sliders ... the doors ...
until half of the wheel ... the other cut part ... a little opening door".

**What the knife cuts.** The well cuts already used the windows' knife (`_knife_gen.js`), which cuts the subdivided
displayed sheet (76 566 vertices on the twinBush) along exact crossings. The roughness came from the OUTLINE handed to
it:
- a convex hull of points swept at only 17 positions;
- tyre rings of 12 points;
- the leg sampled as its axis;
- corners grown by 12-gons (the nose well came out a 17-point kite).

**Now:**
- **The sweep.** 33 positions. The tyre's rims at 32 points. The leg is a tube at its radius plus 20 mm (`legTube`,
  C.legR from the oleo's diameter), so the rest slot holds the leg's skin, not its axis.
- **The corners.** Grown by circumscribed 32-gons. The nose well is now 39-41 points and smooth.
- **The ceiling is flat.** The outline is extruded to the highest swept point plus the clearance (`wellHeights`, and
  the side wells' floor). A wing's upper skin and a nacelle's top still cap it, cell by cell.
- **The cost.** The fit went from 0.19 s to 1.5 s with the finer sweep, then back to 0.25-0.42 s:
  - the swept points are posed once per unit and shared by the body's, the nacelles' and the wing's sweeps;
  - the wing's skin heights are memoised on a 1 cm grid;
  - the nacelles are rejected by their box;
  - the nacelles' section tables are cached on their vertices.

**The shading.** quickshot was flat-shaded per triangle. It now interpolates each mesh's own vertex normals per pixel
(the sheet's `N`, the layers' `normal` attributes), with a Lambert term and a soft highlight. `--flat` gives the old
facets.

**THE FITTINGS (`fittingsDraw`).** Every fixed pivot hangs from the structure ABOVE it: the trunnions (legOleo now only
records them, `RT.fits`), the brace anchors and the actuator anchors (`mechBuild` returns `fits`). The structure is the
well's flat ceiling over the pivot's plan place (the body's, the wing's or the nacelle's well), else 50 mm up. Each
fitting has:
- two lugs from the pin;
- a block between their roots when the drop is longer than a lug (55 mm);
- a base plate flat on the ceiling, with four bolts;
- a triangular gusset outside each lug, from the lug to the plate.

Drawn after the fit, once the ceilings are known. The Catalina keeps its hull-side lugs.

**THE DOORS.** The leg door's share is now the leg (its tube) plus the wheel's half on the trunnion's side, ending a
fifth of a radius short of the axle. Gear down, it ends over the axle, a radius clear of the ground. The rest of the
cut is the well's doors (one or two). They open as the gear leaves either end and close once it is in. Gear down,
they close unless the down gear passes through them.

The "passes through" test was too coarse. Any down point within 50 mm of the door's height inside its plan counted,
so a trunnion inside the structure kept the T-tail's belly doors open on the ground. It is now a crossing test: one of
the down gear's lines (the leg from its trunnion to its axle, the brace's links, the actuator) crosses the door's own
surface inside it, or comes within 12 mm of it. The T-tail's and B-ITES's belly doors now close gear down. The
twinBush's nose doors stay open gear down, because its drag brace crosses them (as the light twins' linked nose doors
do).

**THE SHORTENING (rows `gearShort`, `gearShortNose`: 0-0.45 of the leg).**
- **The slide.** The piston slides up into its cylinder as the gear comes up, smoothly, completed half way up the
  travel. It stops 50 mm short of the gland, and the cylinder is shortened to leave the piston that travel.
- **In the core** (`src/core/62c_gear_mech.js`): `gearSlide` and `gearSlidePt` slide a unit's points below `t0` along
  the strut. A part with `slide` (the wheel, the castor, the piston's group `edMechLow*`) rides it in `gearMechPose`.
  So the editor's preview and the flown aeroplane telescope alike.
- **The torque scissor** becomes a knee (`R.knees.sc*`, parts `edMech*_sc1/_sc2`): its upper arm on the cylinder, its
  lower on the piston, folding as the piston goes in.
- **In the gear layer.** The sweep (`poseAll`), the trim, the lift and the nacelle test all take the slide. The
  grown gear bay is sized to the stowed (shortened) leg (`stowLen`).
- **On the twinBush** (gearShort 0.4, the nose 0.3): the 1.43 m mains slide 0.57 m in and stow in a bay about half a
  metre shorter. The fit is clean for the mains.

**Evidence** (quickshot, smooth shading; scratchpad `fin/`):
- twinBush with shortening (gearShort 0.4, nose 0.3; gear 1 / 0.6 / 0.3 / 0);
- da62 nacelle;
- the T-tail's belly wells (gear 1 / 0.85 / 0.5 / 0) and its wing wells;
- B-ITES;
- the Catalina.

**Not yet:**
- the cut into a cowl (the nose forward into it);
- the Skymaster (two axes, the rear pod);
- the long well behind a nose leg, set by where the brace and actuator anchor (a nose well 1 m long for a 0.2 m
  wheel on the twinBush; anchoring them over the leg's own slot would shorten it);
- the gear bay's width and length held to the wing (its chord, the flap);
- a lift strut through a bay (no test);
- the gates (after the user's review).

### 8.18 THE NACELLE FITTED TO ITS GEAR (replaces 8.16's grown pod as the default)

The user (5 Nov, on 8.16/8.17's bay): "the enormous pod you've created is also unacceptable. The idea is to fit the
nacelle so it fits, maybe swinging front or back, and possibly retracting, but certainly not to add this enormous
thing. We could have a stand-alone pod option, but separate. Start again from the linear cowl and nacelle, extend the
nacelle as much as required, move the whole assembly up and down, possibly make the nacelle higher if required (and
the cowl, keep these aligned, same height, same width)".

**Built (`_cage_cowl.js nacGearFit`, row `gearNacFit`, on by default).**
- **Where.** In `engineFaces`, the face every layer reads (the cowl, the engine and its propeller, the gear's nacelle
  probe). When it changes, the whole engine assembly changes together.
- **When it applies.** The mains fold into a puller's nacelle (gearFold 'nacelle'), their wheel is under it, and the
  nacelle as drawn cannot hold the folded wheel either way:
  - the section as drawn: a free cowl's own rows, a fitted one's face;
  - the pin is 45 % up the depth (the gear layer's own rule);
  - the folded wheel is inside the section with its clearance;
  - on a HIGH wing, the wheel is under the wing's underside where it stows (its middle over the body's centre line;
    a low wing's wheel stows ahead of the wing or into the wing's own well);
  - long enough: forward, under the engine's rear (60 % of the cowl past the firewall, the DC-3's way); aft, in the
    tail cone's first 55 % (the cone keeps 86 % of its section there).
- **The growth, least first:**
  1. Deep enough: the half-height grows to hold the wheel and its clearance. It grows DOWNWARD: the top is kept and
     the assembly is lowered by the growth. Cowl and nacelle stay one section, the same height and width. The width
     grows to the tyre and its offset.
  2. Lowered just enough for the folded wheel to pass under a high wing (the leg shortens with it).
  3. Forward when that fits under the engine's rear. Else aft, into a tail cone as long as it needs, 4 m at most.
     Past that the gear layer's fit stays red: shorten the legs (8.17) or move the station.
- **Not saved.** The rows keep their values. The face carries `gearFit` (dy, halfW, halfH, tailLen, fold, ok), and a
  fitted cowl's synced rows show its section.

**The stand-alone pod** (8.16's `nacPodBuild`) is now only `gearNacPod` 1: "a separate gear pod under the nacelle",
off by default.

**Evidence** (scratchpad `fit/`):
- **twinBush, legs shortened 40 %.** Its own nacelle is 0.56 m deep (from 0.34), lowered 0.32 m, under the wing. The
  legs fold forward under the engine, and the fit is clean for the mains.
- **twinBush unshortened.** It needs a tail cone of more than 4 m, so it stays red (honestly).
- **da62.** Its nacelle is deepened downward by 0.16 m, and the wheel is now wholly inside (it was proud through a
  round cutout). It still folds forward and its fit is clean.

### 8.19 PHASE 1 CLOSED (5 Nov): the cut into a cowl, the gate, what is left

**THE CUT INTO A COWL** (the user: "cut into a cowl ... the tip of a narrow nose"):
- **Structure.** A nose cowl (the cowl layer's unit on the centre line) is now structure, as a wing nacelle is
  (`nacellesOf`, kind 'cowl'): its skin is in the probe, and the knife cuts its wells and doors.
- **Kept apart.** The mains' nacelle logic (the mount, the fold, the trim, the pod, the nacelle test) skips a cowl.
- **The fold's target.** A forward-folding nose wheel (gearFoldNose 'fwd') is trimmed to the cowl's LOWER QUARTER, not
  its middle: the engine fills the rest.
- **On the T-tail tourer** the nose wheel folds forward and stows wholly hidden in the cowl's lower back and the nose,
  with a well and doors in the cowl skin.
- **Two fit flags are too strict here.** The floor test still flags it (the cabin-floor test runs the length of the
  body, under the instrument panel too), and a few points just ahead of the cowl's measured section count as outside.
  The floor test should stop at the firewall.

**The doors' faces.** Only the outermost down-facing skin over a plan place is a door's (a cowl is shells in shells:
skin, inlet ducts, lips).

**GATE RETRACT** (5 Nov, after 8.17-8.18):
- **The fit's time.** 0.33 s, back to about 0.22 s:
  - 25 poses;
  - the fine rims at 24 points;
  - the unit's own points at their hub and 60 % rings only;
  - the tube's rings at six stations (the axis every 5 %);
  - the mechanism's points once per unit;
  - the wing's sweep every other pose.
- **The wing's wells.** Swept with the leg's axis, not its tube: the tube carried the root's well over the centre
  section's seam, where the knife's loops cannot close.
- **The box outline.** Grown as the exact one is (circumscribed), so it holds it.
- **A partial fold.** Its exposure is declared for the brace and the actuator too, as for the wheel.

**What is left for the next phase:**
- **The Skymaster.** The 'two axes' preset folds the mains aft and twisted into the back pod, the push-pull's aft
  cowl. With the cowl cut it is cut and has doors, but at half travel a few shards remain and the open well shows the
  rear engine. The real 337 stows its mains in the fuselage aft of the cabin, so it wants its own study.
- **The floor test** should stop at the firewall (above).
- **The long nose well** behind a nose leg, where the brace and the actuator anchor far aft.
- **The gear bay held to the wing's size** (its flaps, a lift strut).

### 8.20 PHASE 2 (5 Nov): the floor, the nose well, the wing's limits, the Skymaster

**THE FLOOR TEST (no change).** It runs the length of the body, and that is right: the space between the firewall
and the panel is the footwell, a floor too. A forward-folding nose leg pivoting behind the firewall sweeps it. The
remedy is the station: a forward fold's trunnion belongs on the engine mount, ahead of the firewall, as on real
forward-folding nose gear. The station row (s2Z) is already among the rows the test turns red. On the T-tail tourer
with s2Z 2.9 the floor test clears. Its forward-folded nose wheel then stands past the cowl's nose bowl (the cowl is
short for the leg), which the skin test flags, also correctly.

**THE LONG NOSE WELL (no change).** Measured on the twinBush, the nose well's length (0.77 m) is the folded leg and
its wheel. The brace and actuator anchors lie inside it; they do not stretch it (8.17's guess was wrong). Shortening
the nose leg (gearShortNose 0.3 / 0.45) brings the well to 0.63 / 0.58 m.

**THE WING'S LIMITS (new fit tests):**
- **'strut'.** A lift strut (CAGE_WING.struts, pin to tip) running through a gear nacelle, or crossing the mains
  anywhere along their fold. The test is segment to segment, at the sweep's 25 poses, the leg's radius and the
  strut's 20 mm off, the wheel by its radius. It turns engNacAt, s1X, s1Z and the fold red.
  - On the twinBush (s1X 2.8, high wing, forward fold) the mains cross the strut mid-fold, about 58 mm into it.
- **'flap'.** A gear nacelle's tail, or a folded wheel, behind a flap's hinge line within the flap's span (the flap
  comes down through it). It turns wgFlapSpan, engNacAt, s1Z and the fold red.
  - None of the tested cards trips it.

**THE SKYMASTER:**
- **The real 337** (the Cessna 210's layout): the mains swing aft and twist flat into the belly behind the cabin,
  just ahead of the rear firewall; the nose folds aft.
- **The rear engine's bay is never a stowage.** An aft engine's cowl on the centre line (a pusher's, a push-pull's
  rear) is no longer cut (AFT_BAYS). A new fit test, 'bay', turns the station, the fold and the shortening red when
  the folded mains end in it.
- **The Skymaster-alike card cannot stow its mains as drawn.**
  - Its pod ends at z 0.73, just behind the gear station (0.95), so there is no belly behind the station.
  - Its 0.8 m half track leaves the mains outboard of the pod: every fold (inward, aft-flat, aft-and-in, two axes;
    shortening 0 to 0.45; s1Z 0.95 and 1.3) ends with the mains out of the pod or in the rear engine's bay.
  - The test now says so.
  - Making it a 337 means the card itself: a longer pod with belly wells ahead of the rear firewall, the mains under
    the pod (a narrower track or wider pod), then the aft-and-in twist fold.

### 8.21 CLOSED WELLS, THE SKYMASTER, THE EVIDENCE (5 Nov)

**THE WELL A CLOSED BOX** (the user: "the shading inside the cuts looks odd. Did you build an actual volume after the
cut? It should really be a closed section, where we first cut, then extrude the cut and close it so it forms a closed
volume").

- **What it was.** The knife's well was the cut-out skin pushed up to the ceiling, its walls the ring between, a
  window's recessed pane. Two faults followed.
  - A skin with an opening of its own (the T-tail cowl's open belly round its exhaust stacks) left the well open there:
    the engine's fins showed through.
  - Every SHELL of a cowl or a nacelle that the outline crossed built its own well (its inlet ducts, its lips, its
    seams): boxes inside boxes, fighting for the same pixels.
- **What it is now** (`_knife_gen.js wellBox` / `skinYOf`).
  - Each downward cut's well is built from its OUTLINE: sampled finely and dropped onto the ORIGINAL skin from below.
  - Walls go straight up to one flat ceiling, their normals level and facing the well's axis.
  - The ceiling is the outline at that height, facing the opening.
  - The knife only cuts the hole and carves the structure out of the volume.
  - The fuselage sheet (`knifeWells`) and the wing's and nacelles' skins (`knifeWellsGeo`) take it.
  - The Catalina's side recesses keep the knife's own.
- **One shell per well.** Only a nacelle's or a cowl's OUTER skins (those inside no other skin mesh's box) build a
  well; the others (and the inner twin) are cut through for the hole only. The doors take the outer skins' faces too,
  of either winding (a cowl's aft lofts are wound inside out).
- **Not fixed.** On the T-tail cowl the front of the slot still has no door: there is no skin there.

**THE SKYMASTER** (the user: "you may change the skymaster. It has never been authored"). The card is born retractable,
the 337's (and the 210's) way:
- the mains under the pod: 0.43 m half track, s1Z 1.7, 0.17 m tyres;
- fold 'aftBelly' (aft and in, the wheel turned flat), the legs shortening 30 %, into one belly well ahead of the rear
  engine;
- the nose aft, shortened 30 % (its own well);
- the cabin floor at -0.25.
- **A preset's main never stows across the centre line.** The last turn backs off a degree at a time till the stowed
  tyre keeps 20 mm off it, where the other main lies (the two mains met otherwise).
- **The fit's last flag:** the stowed tyres sit 8 mm inside the pod's skin, where the test wants 15.
- **Still rough:** the shared belly well's doors (large panels hanging at mid-travel, triangular leg doors). The
  generic door split does not suit a well this wide.
- **The pod's length cannot be changed this way.** Neither taperLen nor aeroAftLen move this card's body (it ends at
  0.73).

**THE EVIDENCE.** One page with every option tested, each with its verdict and its sheet (the artifact "Retractable Gear
Evidence"; the renders in the scratchpad's ev/ folder, the same frames across each sheet's positions):
- the belly wells (exact, box with one door, box with two, open);
- the fittings;
- the wing wells;
- a partial fold;
- the nose forward into the cowl, and its close-up;
- the Catalina;
- the nacelles (low wing; high wing shortened; high wing unshortened, red; the separate pod);
- B-ITES;
- the Skymaster;
- the strut test;
- the closed wells.

### 8.22 Polish: the doors as slabs, and a quality pass (P2)

The user: "give them some thickness, and proper edge beveling. Also do some texture work on them; seams and light
shadow/dirt in the corners ... Then do a pass of quality ... stay grounded in clear action yielding benefit".

**THE DOOR IS A SLAB** (`_cage_gear.js`, `panel`):
- **The front.** The skin's own faces, welded into one smooth front. Their normals are averaged, then smoothed over
  their neighbours in three passes: the clipped fragments' own normals made a door read crumpled.
- **The edge.** A 45-degree chamfer, DOOR_BEV (1.5 mm) out and in, catching the light a shade lighter. Then a side wall
  down to the back face, DOOR_T (6 mm) in, which stays in the seam's shadow.
- **The back face.** The dark inner skin, looking into the aircraft.
- **The grime.** Vertex colours on the front: darker within about 25 mm of the edge (16 % at most), and a little more
  into its corners (10 %). There is no noise: on the skin's irregular triangles it read as mottled.
- **The material.** The skin's material, cloned once with vertex colours. `quickshot.js` now draws vertex colours too
  (they multiply the material's colour).
- **The gate measures the outer face.** The front mesh carries `doorOuterN`: its first vertices are the outer face.
  Behind the wing's blunt trailing edge (86 mm tall on the T-tail) "6 mm in" lies between the skins, and a plan-view
  test read it as 26 mm off the skin. GATE RETRACT §17 now measures the outer face only: every door is within 4 mm
  (measured: 0.1 mm). A new check confirms every door is a slab: outer face, chamfer and wall (seam-shaded), back face.

**THE QUALITY PASS** (each one found in a screenshot, each one a single fix):
- **The well's lip is chamfered** (`wellBox`): the wall's top 3 mm turns out at 45 degrees.
- **Where a wing well runs into the body** (`inBody`): its walls stay out, and its ceiling sits 2 mm under the body's.
  No two surfaces share a place.
- **The well's shoulder** (`wellBox`, `skinTop`). On the DA62 the fitted nacelle narrows to a ridge under the wing, and
  the straight walls rose out of its sides as dark slivers between the nacelle and the wing. Now, where the skin over an
  outline point is lower than the flat ceiling, the wall stops 3 mm under it. It then slopes in to a ceiling point
  drawn inward until the skin over it clears the ceiling. Elsewhere nothing changes: the shoulder is skipped.
- **A fitting stays inside its nacelle** (`fittingsDraw`, `roomX`). The trunnion's base plate (plus or minus 96 mm)
  stood out of the same narrow ridge. Inside a nacelle, the plate now lands lower, on the nacelle's own frame, where the
  skin leaves the lugs their room. It is also no wider than that room: the lip and the gussets are trimmed, and the lugs
  are kept.
- **A nacelle's doors are its belly's.** The nacelle's shells are wound either way, so the door test took any face lying
  flat enough (|ny|). That let the nacelle's top skin at its edge into two doors. Each face is now turned away from the
  nacelle's own centre line at its station (5 cm stations, from the faces near the outline), and only the faces that
  look down are kept.
- **A well door opens out of the skin.** The hinge's sense is now taken from the door's own outward normal, not just
  "down". A nacelle's door wraps its round belly, with its centroid nearly under the hinge.
- **The check.** On the DA62 (fold 7, s1X 2.45), no vertex of the gear layer stands outside the nacelle's skin, gear up,
  half and down (the scratchpad probe `poke.js`).

### 8.23 The wing well's box, the Catalina re-checked, and what the amphibian needs (P2)

**THE WING WELL** (the user: "a hole, plus a little border that extrudes out with no cap, so nothing like extrude in
and cap"). Cross-sections of the T-tail's wing well (plane x = const: the uncut skin, the cut skin, the well) showed
two boxes:
- the right one, from the lower skin up to the ceiling;
- a second one from the wing's centre-section skin mesh (|x| < 0.65 m), which the outline only grazes at the root.
  Its points with no skin under them took the nearest hit's height (-0.49 m), so its walls hung 2 to 3 cm under the
  wing with no cap.

Aft of the trailing edge, too, the outline's points had no skin under them and borrowed a neighbour's height: a wall
stood in the air behind the wing.

`wellBox` now does two things:
- **The box is the skin's that carries the cut.** A mesh under less than 40 % of the outline builds none.
- **A point with no skin under it is walked inward** (5 mm steps, up to 0.4 m), until it finds the skin. The wall
  closes the well at the trailing edge.

After the fix: one box per well, walls from the skin up, closed at the trailing edge, and the doors flush. This
variant's wheel still stands 34 to 51 mm proud of its thin wing (the fit's red row).

**THE CATALINA, RE-CHECKED** (the user: "did you fix the cut in the fuselage? And is our animation mechanism correct
there?"):
- **The cut is a closed, round pocket.** A hull section through it (z = 0.458 m on the c172 battery card) shows it
  going 0.19 m in from the side: walls, a floor, the tyre's own outline.
- **It still reads wrong gear down.** Its floor and walls are flat grey with no lip and no shadow, so it reads as a
  drum standing out of the hull. It wants the closed wells' finish (a chamfered lip, a darker interior).
- **The motion is not confirmed, and the sources point elsewhere.** Ours swings the leg aft to level along the hull,
  then turns it in about the vertical axis. The sources found say the PBY-5A's mains went UP into recesses in the hull
  sides, under the wing and between the wing struts, hydraulic, the wheel left in view
  ([History of War](https://www.historyofwar.org/articles/weapons_PBY-5A_catalina.html),
  [AOPA](https://www.aopa.org/news-and-media/all-news/2014/august/pilot/f_pby)).
- **No source found gives the pivot or the linkage.** The operator handbook found
  (pbycatalina.com, the PBY-5A C-FUAW handbook) is outside this session's network. Not to be rebuilt by eye: the
  pivot and the arc wait for a handbook or erection-and-maintenance drawing.

**THE AMPHIBIAN: WHAT WE HAVE, WHAT IT NEEDS** (the user: "does your session have enough information to accurately
start on amphibious floats by modifying the Wipaire and EDO floats? That's work that needs to be done according to
manufacturer data, not eyeballed"). No, not yet.

What we hold:
- **The Wipline seaplane catalogue** (`32_hydro.js` FLOAT_PRESETS): length, beam, height, displacement and system mass
  for 15 models. Eight are marked `est: true` (scaled from displacement, not read off a sheet).
- **The 2350's lines**, from its parts manual.
- **Three amphibian installed-mass figures** (206/3450, Beaver/6100, PA-18/2100).
- **The 2100 and 13000 manuals' system descriptions** (quadricycle, a hydraulic pump and a hand pump, the bow carriage
  on tracks locking over centre).

What we do not hold, per model:
- **The amphibian float's own dimensions.** The amphib hull is not the seaplane hull: it is deeper and longer at the
  bow box, with the main well.
- **The wheels' positions:** the nose and main axle stations from the bow and the step; the main wheel's height under
  the keel, gear down; the stowed positions (§1.7 marks them [unverified], from photos).
- **The tyres and wheels:** the sizes, and the castoring nose's trail.
- **The retraction geometry:** the nose carriage's track and arc; the main's pivot and swing.
- **The weights:** the amphibian system weight per model, and land vs water gross and CG limits.
- **EDO: nothing at all.** No row in the catalogue, no amphibian data.

Where it would come from: the Wipaire installation and parts manuals and STC sheets (wipaire.com, and the manual
mirrors cited in §1.7), and EDO/Aerocet type data and float drawings. The hosts must be reachable from the session.

### 8.24 The PBY-5A's main gear, from the operator's handbook; the amphibious floats, from photographs

**THE SOURCE.** Pacific Flying Boats, *Canso Flight Operations Handbook* (PBY-5A C-FUAW, June 2020):
- §1.8 and §1.9, pp. 49-51;
- Figs 12 and 13, the main gear's extension and retraction drawn in front view;
- p. 22's g, the gear table.

It was read in this session once the environment allowed pbycatalina.com.

**WHAT IT SAYS:**
- **The layout.** A tricycle, all hydraulic. "The two main gears retract into wheel wells in the side of the hull. The
  nose gear retracts into a wheel well in the bow of the hull. Doors close over the nose wheel well", and there are
  none on the mains.
- **Up and down locks** on all three units.
- **The main unit's shock strut** is hydraulic-pneumatic, with a watertight wheel and brake.
- **The tread** is 16 ft 7 in, 5.05 m, tyre centre to tyre centre.
- **The motion (§1.9 b, Fig 13).** Two cylinders per side:
  - the small one, near the main strut's upper hinge point, releases the spring-loaded strut latch through a bell
    crank and a rod;
  - the main one "floats between a bracket near the upper end of the main strut and a bracket on the forward leg of
    the upper V-strut". Contracting, it folds the main strut INWARD, "pulling the gear upward and into the well";
  - a roller on the axle's inboard end meets a spring bumper arm in the well, because "the gear, in approaching its
    retracted position, has a tendency to fall into the well". A spring latch then holds it up.
- **The drawing (Figs 12 and 13, front views of the hull's side).**
  - Down: the oleo stands upright, OUTBOARD of the hull. A near-level strut runs from the hull's side to the leg's top,
    and the upper V-strut runs up from it.
  - Up: the leg and its wheel lie against the hull's side, in the well, still upright.
  - The motion is all in the cross-section plane (about fore-aft axes): up and in. The wheel stays in its fore-aft
    plane, with no aft swing and no twist.
- **The nose.** Two cylinders. The unit is pulled up into the bow's well behind doors, hooked by a spring latch.

**OURS IS WRONG.** The 'catalina' fold (§8.15 v2) swings the leg aft to level, then tucks it about the vertical axis.
The real gear is a FOUR-BAR in the cross-section plane: the leg is the coupler, carried by the folding side strut and
the V-strut. It rises and moves inward while staying nearly upright.

Our fold chain only rotates rigid units about a fixed trunnion (plus the shortening slide), so the honest rebuild
needs:
- a linkage pose in the core's kinematics (`62c_gear_mech.js`): the leg's pose from two rockers;
- the gear layer drawing the side strut (with its knee latch) and the V-strut;
- the well in the hull's side where the wheel ends, upright. The present round recess, the tyre's own outline, is
  that shape already.

**Built (P2 v3, 5 Nov, the same day).** The core's kinematics are unchanged. The motion is expressed in what the core
already poses:
- **The rise.** The shortening's slide, made to carry the whole unit (`shorten.whole`, `t0` -1e9): the jack lifts
  the leg straight up, done 60 % of the way.
- **The swing in.** ONE turn about the fore-aft axis through a POLE solved per build. That is the point the
  displacement turns about, so the wheel lands where it is stowed:
  - level with the leg's head as drawn (the side's fitting height);
  - its centre 40 mm inside the side, the tyre about half out.

  The angle is solved too (6 to 40 degrees): the least that keeps the stowed leg inside the side. A PBY's side is
  upright and its leg too; a hull with tumblehome leans it in.
- **The leg's head is free** (`legOleo` `RT.free`). The oleo stands upright over its axle, outboard of the hull, with no
  trunnion lugs left in the air. The wheel rides OUTBOARD of its leg, as in the drawing (v2 had it inboard). `C.top`
  is the head and `C.hinge` the pole; every use that means the leg reads `topOf(C)`.
- **The side strut.** A knee from a fitting inside the hull to the leg near its head. The fitting is searched so the
  strut is longest gear down (straight, locked) and never stretches. It folds down.
- **The V-strut's jack.** Its barrel runs from a fitting high on the hull's side, its rod from the leg's head. The
  jack contracts.
- **The recess** takes the wheel and its leg.
- **GATE RETRACT section 18** (on the c172 battery card):
  - the motion lies in the section plane (0.000 mm off it);
  - the leg stays near upright (13.7 degrees at the most), the wheel upright;
  - the strut never stretches;
  - up 0.69 m and in 0.19 m;
  - half way it has done 93 % of the rise and 69 % of the way in;
  - the jack and the strut are parts of the one kinematics;
  - a recess on each side.
- **The fit is RED on that card, and rightly.** The C172's side is upright only between -0.3 and +0.3 m, and its
  round bilge falls away under the wheel, so the stowed unit is 125 mm out and its head 0.86 m into the cabin. The
  PBY's flat-sided hull, about 3 m deep, is what makes the arrangement possible. It waits for a real hull (G7).

**THE AMPHIBIOUS FLOATS, FROM THE USER'S PHOTOGRAPHS** (5 Nov). These are observations, to be checked against the
manufacturers' data:
- **The mains.** A large wheel, main-gear size, just AFT OF THE STEP, on every set photographed: Wiplines on Cessnas,
  EDO on a Cessna, and very large floats on a DC-3.
  - In flight, on the DC-3's floats, there is one main and one nose wheel per float. The second pair seen is the far
    float's, by parallax.
  - On the DC-3's floats the main is a big tyre on a horizontal, trailing strut along the float's bottom, with no door
    (the user's close-ups).
- **The nose.** A small castoring wheel at the bow. Retracted, it sits at the very front of the float, in the black bow
  cap, partly in view. Two mechanisms:
  - **Wipline:** the leg extends from, and stows INSIDE, the bow. Wipaire's 2100 manual (p. 22): "the carriage is drawn
    along the tracks in the nose box", with an over-centre down lock. The mains also have over-centre locks up and
    down, the actuator driving the actuating arm "along the slide track".
  - **EDO** (the American-flag photograph): the pivot is low at the bow's front. The leg is pushed down by a piston
    through a small triangular linkage. Retracted, it HUGS the outside of the bow, probably with a fairing.
- **The DC-3's nose well has doors** (the user's close-ups: an upright oleo, torque links, a steering cam "CAM LIMITS
  TURN", door panels either side). Its mains have none.

The manufacturers' numbers (dimensions, stations, tyres, weights, the mechanisms' geometry) are being gathered from
the Wipaire manuals and sheets now that the session can reach them. They go into §8.25.

### 8.25 The amphibious floats: Wipaire's data, and the gear drawn on the Wipline hulls

The user: "do more than study, do it". The data comes from Wipaire's own documents, reached once the environment
allowed wipaire.com and manualshive.com. The research notes, with every figure used, are in the session's scratchpad
(AMPHIB-DATA.md, not in the repository). The sources by model:

| model | service manual | parts manual / guide |
|---|---|---|
| 2100/2350 | `wipaire.com/wp-content/uploads/2016/10/2100-and-2350-SMAN-Rev-V.pdf` (and manualshive 988365) | guides Husky, Scout, C-172 (`.../2018/06/*.pdf`) |
| 3000/3450 | `.../2016/10/3000-and-3450-SMAN-Rev-P.pdf` | `.../2016/11/3450-PMAN-on-Cessna-206-Rev-V.pdf`; guides C-180..206 |
| 3730/3900 | manualshive 988366 | — |
| 4000, 6000/6100, 7000 | `.../2016/10/4000-SMAN-Rev-K.pdf`, `6000-and-6100-Service-Manual-Rev-W.pdf`, `7000-Service-Manual-Rev-U.pdf` | guides Beaver, Kodiak |
| 8750 | manualshive 988360 (`.../8750-SMAN-Rev-V.pdf`) | guide C-208B |
| 13000, 10000 | manualshive 988363 / 988362 (`.../13000-Service-Manual-Rev-T-1.pdf`) | `.../2016/11/13000-PMAN-Rev-Y.pdf`; guide Twin Otter |

**What the manufacturer states:**
- **The hull is unchanged.** "The amphibian float is geometrically the same as the seaplane except for the addition of
  landing gear and internal structure for the gear."
- **The layout is a quadricycle.**
  - The main gear: a drag link on trunnions at the step bulkhead. Single wheels from the 2100 to the 3450, dual from
    the 4000 up. It swings up into an open wheel well just aft of the step, with NO doors (no door in any parts
    list).
  - The nose gear: a composite spring leg ("very similar to a Cessna style") on a trolley in tracks in a nose box,
    fully castering, self-centring, with no shimmy damper. It "retracts into the float nose to provide a dock
    bumper", with no doors.
- **Locks.** Over-centre locks; the main locks up and down, the nose down only.
- **Hydraulics.** One hydraulic system and a hand pump: about 100 strokes on the 2100, about 400 on the 13000.
- **Tyres and weights per model.** The tyres (5.00x5 to dual 8.50x10), the nose tyres, and the amphibian system weight
  over the seaplane's: +147 lb (PA-18) to +677 lb (DHC-6).
- **Geometry, read off the dimensioned 3-views** [inferred, plus or minus 3 %]: the wheelbase is 0.48 to 0.52 of the
  amphibian length; the main axle sits at 0.50 to 0.55 of it from the front, the nose axle at the front.

**Not published, so the drawing ASSUMES these and the record says so (`amph.assumed`):**
- the wheels' drop: their bottoms half the main's radius under the step's keel;
- whether the stowed main sits flush with the keel or shows below it: flush where the hull is deep enough, else as
  high as the deck allows, and the record says how far it shows (`amph.fitWhy`);
- the trunnion's height: half the hull's;
- the nose trolley's travel: what lands the wheel at the bow tip;
- the nose leg's rake: 20 degrees.

**EDO: no data.** No reachable host has any. The FAA type certificate data sheets (drs.faa.gov), Kenmore Air / EDO-AIRE
and archive.org would be needed.

The DC-3 floats in the user's photographs (an upright oleo, torque links, a steering cam, a doored nose well) are not
Wiplines. Wipaire's 13000 has a castering spring on a trolley and no doors; no DC-3 float document was reached.

**BUILT (the drawing, the data, the gate):**
- **The data.** `HYDRO.WIPLINE_AMPHIB` (`32_hydro.js`), beside the seaplane catalogue, which is left untouched:
  - per model, the main and nose tyres, single or dual mains, the extra length, and the weight over the seaplane's
    (null where Wipaire publishes no pair);
  - `TYRE_OD` / `TYRE_W` by the aircraft-tyre rule;
  - `AMPHIB_GEOM` (wheelbase 0.50, main 0.53);
  - `amphibOf`: a preset's own gear, else the row nearest the hull's HEIGHT (the wheel must stow in it), est: true.
- **The row `fltAmph`** ("amphibian (Wipline wheels in the floats)") in the floats group. The gear's position is the
  gear page's preview row (`gearPos`).
- **The drawing** (`_cage_float.js` amphib), on each float in the hull's model frame, mirrored to port:
  - the main's drag link from the step bulkhead's trunnion, the wheel (or the pair) on its axle, and the shock strut
    to the carriage under the deck. It swings up about the trunnion into its well;
  - the nose's spring leg from the trolley at the end track's foot to the castering block and fork. It swings forward
    and up (the short way) while the trolley is drawn aft, and the wheel ends at the bow tip, in the black bumper,
    half out.
- **The main well.** The knife cuts it from below into the hull: a closed box to a ceiling over the stowed tyre, open at
  the bottom, no door.
- **The record** (`CAGE_FLOAT.amph`): the model, est, the tyres, the weight, the assumptions, the fit's words, and per
  float the axles down and up, the trunnion and the angle.
- **GATE RETRACT section 19:**
  - the catalogue's tyres (5.00x5 is 14 in, 8.50x10 is 25.3 in);
  - the 2350 wears its own gear;
  - the main wheel just aft of the step;
  - the nose ahead of the bow gear down, the main swinging up;
  - the nose wheel stowed as the dock bumper;
  - the wells cut;
  - the assumptions named.

**On the C172 battery card's own float (L 6.95 m, 0.45 m step keel to deck) the stowed 5.00x5 shows 86 mm under the
keel.** The catalogue's 2350 hull is 0.58 m deep. The record says so.

**NOT YET (the amphibian's next steps, in order):**
1. The physics. The wheels as contacts beside the hulls (`refs.mains` / `refs.tw`, two nose wheels: free-castering with
   differential brake). The solver's `isTW` takes an array. The float pass and the wheels' plates run together, so a
   gear-down water landing noses over.
2. The flight's poses. The float layer's gear as parts of the one kinematics (`gearMechPose`), the gear handle and the
   transit on a floatplane.
3. The mass. `dKg` into the join's float system mass, where Wipaire gives it.
4. The advisory voice ("gear is up for water landing"), and the pilot's rule (raise it on a positive rate).
5. EDO, when its data can be reached.

**THE EDO STYLE (built the same day; the user: "you now have enough for doing the EDO variation too, I described enough
and we have the reference closeups").** `fltAmph` is now three options: none, Wipline, EDO style. No EDO document was
reached: the geometry is the user's photographs, and the tyres are the same hull's Wipline row's. The record says so
(`amph.style` 'EDO (photographs)').
- **The nose, corrected** (the user: "you have the lever going the other way. So the anchor point is not at the tip
  where you drew it. That's the whipline design. It's actually at the bottom ... and then it moves up when it
  retracts. And it moves up because it has a little piston").
  - The leg's ANCHOR is at the bottom of the float's front: on the keel where it turns up into the stem (the
    forefoot), outside the hull.
  - Gear down, the leg hangs from it nearly upright (8 degrees of rake), with a fairing and a castering fork.
  - A small piston, from a fitting on the float's bottom aft of the anchor to the leg a quarter down (the triangle),
    swings the leg FORWARD AND UP about the anchor. It lies along the stem, and the wheel ends at the bow tip, in front
    of the float in its black cap.
  - The anchor is placed where its distance to that stowed place equals the leg's length.
  - There is no well, so no doors. The first EDO cut had its pivot at the tip and doors on a slot: that was the wrong
    way round, and it is gone.
- **The main.** A trailing arm just aft of the step, with a HORIZONTAL shock cylinder along the float's bottom from a
  fitting ahead of the step to the arm (the close-ups), and no door. Its swing and well are the Wipline's.

**The noses at the black cap; the EDO leg raked** (the user, 5 Nov: "your little wheel is coming too low, so it should
really come at the level of the black little tip there, and this black little tip should even be cut so that the
wheel can slide through it ... your rotation point should still follow the bottom of the hull further by, let's say,
maybe 20 centimeters ... the landing position of your arm is ... between 45 degrees and horizontal ... Then it goes up
using a little piston ... so that the little wheel goes straight at the tip"; and: "are we sure that we are working on
the EDO model here and not just the we pair model?").
- **Both styles stow at the cap.** The stowed nose wheel's centre comes to the cap's middle height, a quarter of the
  wheel inside the tip. A slot as wide as the tyre is cut through the rubber cap (`out.bumper`, its faces in the
  band dropped), so the wheel slides through it.
  - **Wipline:** the leg swings forward and up till the wheel is at that height, and the trolley draws it into the tip.
  - **EDO style:** the leg swings straight up to it.
  - **Measured on the c172 card:** both within 33 mm of the cap's middle, 31 mm inside the tip.
- **EDO: the anchor further aft along the bottom, the leg landing raked.**
  - The anchor walks aft along the keel to where a leg raked forward about 35 degrees below level reaches the stowed
    place at the tip exactly. Its length is set by the ground line; the rake is solved from the anchor's height and
    distance.
  - **Measured:** the anchor 242 mm aft of the tip (it was 33), the landing rake 34.9 degrees.
  - The piston, from a fitting on the float's bottom aft of the anchor, swings the leg up.
- **The hull is not EDO.** Only the gear is EDO's. The hull is still the Wipline 2350's, the one hull family the garage
  has; EDO's lines wait for EDO drawings.
- **GATE RETRACT section 19 adds two checks:** both noses at the cap's height; the EDO rake between 45 degrees and level.

### 8.26 The Catalina's single round opening; the amphibians' legs measured (6 Nov)

**THE CATALINA, v4** (the user: "you have done an opening on the side, which corresponds to the whole mechanism. But
that's not what it does ... the whole mechanism is done so that you can have a single round opening that the wheel
comes and closes ... The little leg there will have almost a single point of travel through the wall it goes
through"). v3 had stowed the leg INSIDE the hull, and its sweep tore a tall slot.

v4:
- **The leg stays outside.** It stows along the hull's side. The wheel rides INBOARD of it again (`st.ret.flip`, with
  `free`). The lean is solved (-20 to 40 degrees, the least) to keep every point of the leg 15 mm off the skin.
- **The links pass the wall at their fittings.** Both the side strut's and the V-strut jack's sit ON the skin, so each
  passes the wall at one point and cuts nothing.
- **The recess is the STOWED wheel's rims alone:** one round opening, which the wheel closes.
- **It is always cut as a side well.** Where the side turns into the bilge, the average normal had read it as a belly
  well.
- **The fit tests the design.**
  - The Catalina's skin test is its recess's: the stowed wheel's centre at least 15 mm inside the side.
  - The floor test ignores the fittings on the skin, the points within 20 mm of it.
- **On the c172 card one red stays, and it is real:** the stowed wheel's inner half reaches 121 mm over the cabin floor
  the card raises to -0.25 m. A flying boat's hull is deep, with its floor high.

**THE AMPHIBIANS' LEGS, MEASURED** (the user: "check ... whether the length of the leg that we have is sufficient. They
just seem a little short to me ... if you can find any data that gives you a clear reference point"). Read off
Wipaire's dimensioned 3-views (the product guides), each scaled by its own wheelbase dimension:
- **C-206 on 3450s** (6.00x6, wheelbase 11'-7", 1.806 px/in): the keel stands 7.2 in over the ground line at the step.
- **Husky on 2100s** (5.00x5, wheelbase 9'-3", 0.836 px/in): 5.5 in.

Both are 0.8 of the main wheel's radius, and the main axle stands level with the keel. `HYDRO.AMPHIB_GEOM.clearK` is
0.8, a measurement now, not an assumption: `amph.measured.keelClearance` is 142 mm on the 2350's 5.00x5. The old
assumption, 0.5 R (89 mm), was short, as the user saw. GATE RETRACT section 19 checks it.

### 8.27 A wing over the Catalina mains: the cap, and the wing-crossing test (6 Nov, for the Super Petrel)

The hull-types session (the Super Petrel LS, a sesquiplane amphibian whose lower wing roots on the hull's side over
the Catalina mains; relayed by the user) found two problems:
- the stowed leg head and the V-strut jack stood 0.4 to 0.5 m over the chine, through the lower wing's root;
- nothing flagged it.

Now:
- **THE CAP** (`foldChain`, the Catalina block). Take the lowest wing underside, over any plane (`wingPlanes`,
  `wingUnderIn`: CAGE_WING.planes, else the one wing), over a band: the leg head's plan place to 0.4 m outboard, the
  wheel's length fore and aft. Less 30 mm, it caps the rise (`C.catCap`):
  - the stowed wheel's centre comes down by what the cap takes, so the stowed head stays under it;
  - the side strut's and the jack's fittings are searched under it too;
  - with no room to rise (under 50 mm), the fit reddens (`C.catCapWhy`) and says how much higher the wing must be
    for the full rise (`C.catWingRaise`).
- **THE WING-CROSSING TEST** (`foldFit`, `catU`). At every fit position, the Catalina unit's leg points, its head, its
  side strut (through its knee) and its jack's line are tested against every plane's skins. Any point between a
  plane's underside and its top skin (5 mm margin) reddens the fit, naming the plane and the gear position.
- **GATE RETRACT section 18 adds two checks**, on the c172 battery card with a second, lower wing (w2On, w2Pos 1):
  - raised (w2Dy 0.45): the stowed head and the jack are under the cap and nothing crosses the wing;
  - low (w2Dy -0.1): the fit is red, with the words "mm higher".
- **What it cannot do yet.** The Catalina's rise is the whole unit's slide (`shorten.whole`). The leg cannot also
  telescope as it rises (`gearShort` does not reach a Catalina), so a long leg needs that much room under the wing. A
  second slide in the core's kinematics (the piston into its cylinder while the unit rises) would let a long leg tuck
  under a low wing. That is the next step if the Petrel needs it.

**THE SMALL MECHANISM: the head hoisted a little, the oleo telescoping the rest** (the user, relayed by the hull-types
session: "The bottom wing needs to get higher up on the fuselage, the mechanism needs to be small and the wheel should
fit below the wing. It can go up maybe 10-15 cm"). The cap alone kept the head under the wing only by keeping the
wheel low: the unit still rose as one piece.

Now the core has a second slide:
- **THE HOIST** (`src/core/62c_gear_mech.js` gearLift, a unit's `hoist` { dir, d, k }) carries the WHOLE unit up its
  leg: head, leg, wheel, every rigid part (gearMechPose), every unit point (gearUnitPt's new argument) and every knee.
  It is apart from the SHORTENING, which slides only the piston and the wheel up the leg. The layer's copies follow
  (liftD, poseAll), and the shortening now measures its gland from the leg's HEAD (C.top), not the fold's pole.
- **The Catalina with a wing over it** (the lowest underside over the leg):
  - the stowed wheel's top tucks 20 mm under the wing;
  - the head is hoisted only as far as 30 mm under it (the jack stays short and low);
  - the oleo telescopes the rest, its travel the piston's length less 50 mm. The Catalina's oleo is drawn with its
    piston apart and its cylinder at 42 %.
  - Short of travel, the fit reddens: "the wing over it leaves N mm to rise (the head .., the oleo ..) - tucked under
    it, the wheel needs the wing M mm higher (or a shorter leg)".
- **With no wing over it**, the head is hoisted the whole way, as v4.
- **On the c172 battery card with a second wing:**

  | lower wing | head hoisted | oleo telescopes | result |
  |---|---|---|---|
  | w2Dy 0.25 (underside about +0.03 m) | 0.398 m | 0.296 m | jack stroke 0.106 m; nothing crosses |
  | w2Dy 0.45 | 0.598 m | 0.096 m | |
  | w2Dy -0.1 | | | red: needs the wing 167 mm higher |

- **GATE RETRACT section 18:** the w2Dy 0.25 case - head and jack under the cap, the oleo telescoping, nothing crossing.

### 8.28 The folding knee, a fold of its own (6 Nov - the user's sketch, relayed by the hull-types session)

The user, on v4 and the hoist: "I don't think that's the system. Honestly, I don't think it's the system for the
catalina either, because you have all your mechanism exposed, while in both cases, mechanisms are invisible." And:
"maybe the retract session can also keep its previous design as options, and we will check the different systems at
the end". So 'catalina' stays as it is, and 'knee' is appended to FOLD_KEYS (index 8, "folding knee, hidden in the
side").

**THE SKETCH (front view):**
- **Extended:** a horizontal ARM runs from a pivot P just inside the hull's wall, out through the side, to a KNEE.
  From the knee a straight LEG goes vertically down to the axle, with the wheel outboard of it. A PISTON runs from a
  fitting high inside the hull to the knee.
- **Retracted:** the piston pulls the knee in and up, and the arm swings up about P to near vertical, just inside the
  wall. The leg hangs down along it. Only the wheel shows, centred on the hull's line, half in its round recess.

**THE KINEMATICS.** The arm turns about P (a fore-aft axis) and the knee opens by as much, so the leg stays upright. The
whole unit TRANSLATES with the knee on a quarter circle about P: up by the arm's length a, and in by a.
- **The core.** A third motion in src/core/62c_gear_mech.js: the ARC (`C.arc` { p, knee, axis, ang }; gearArc is the
  translation at g, smooth over the travel). gearUnitPt takes it as a 6th argument; gearMechPoints (Am) and
  gearMechPose apply it to every rigid part.
- **The layer.** arcT and poseAll follow. The fold has no turn.

**THE GEOMETRY** (`kneeGeom`, per side at the station; the leg is drawn to it, `RT.kneeB`):
- **The down axle A0** comes from the station's rows: half track s1X, the drop under the keel. The hub (0.4 R + 20 mm)
  sits outboard of the leg.
- **The arm a = the inward travel = the rise**, solved by bisection so the stowed wheel's centre lies ON the side line
  at its height: |A0.x| - a = the section's half width at A0.y + a. The track sets the arm.
- **The leg b**, three conditions:
  - long enough that the arm clears the tyre (R + 30 mm);
  - long enough that P sits INSIDE the hull, 30 mm in from the wall at its height;
  - short enough that the stowed knee keeps 20 mm under the lowest wing over it.
- **P** is the down knee less a. **The piston's fitting F** is inboard of P and up, under that wing.
- **The links.** The arm is drawn as a link P -> knee (rule 'aim'); the piston as a barrel from F and a rod from the
  knee; lugs at P and F; the knee's pin on the leg.
- **The recess** is the stowed wheel's rims, round, always a side well. The arm passes the wall inside that circle.
- **The fit** (`kneeU`):
  - the stowed wheel centred on the side line, within 30 mm;
  - the arm, the leg, the head and the piston BEHIND the skin when stowed;
  - nothing crossing a wing at any position;
  - the knee's own words if the wing over it is too low, or the track too wide;
  - the floor test as for the Catalina's.

**ON THE C172 BATTERY CARD** (s1X 0.85, s1Root 1): a 0.478, b 0.47 (the pivot pushed up inside the round bottom), the
piston's stroke 0.63. The wheel is centred in its recess; arm, leg and piston are hidden. The one red is the card's
raised cabin floor: the stowed knee is 64 mm into it.

**GATE RETRACT section 18:**
- the fold exists beside the Catalina's;
- the leg stays upright and the wheel moves up and in by a;
- stowed, the wheel is centred in a round recess, with nothing outside the skin.

### 8.29 The folding knee: a little piston at the pivot, a slot for the leg, full doors (6 Nov)

The user, on the knee: "have a little piston on the folding knee, at the place where the rotating joint is, and
anchoring higher up on the fuselage. Also, in this case it needs a little cut on top so the folded leg can fit. Would
also be good to do a version with full doors ... Only work on the folding knee, it's good".

**THE PISTON AT THE PIVOT** (kneeGeom, mechBuild's knee branch):
- The arm carries a HORN at its pivot P: h = 0.22 a, kept between 50 and 90 mm, at 120 deg round from the arm. Gear
  down the horn points up and in; stowed, it points in and down.
- The piston's fitting F is taken from a short list of places over the pivot and inboard (160 mm in, 360 mm up, down to
  80 / 200 mm). The first place that is 40 mm inside the side, under the wing (40 mm), and no closer than 50 mm to the
  centre line wins.
- The piston runs from F to the horn's end: a barrel from F and a rod from the horn. It pushes the horn round, and the
  arm swings up. On the C172 card: stroke 109 mm, shortest 305 mm, barrel radius 20 mm.
- The core (62c_gear_mech.js) has a new point type, `{ along: [P, Q], r, s, ax }`: the point r along the link from P
  toward Q, plus s across it along ax x the link. The horn's end is `{ along: [{fix: P}, {unit, p: knee}], r: h cos 120,
  s: h sin 120, ax: [0, 0, side] }`. It travels to the flight with the record, like every other point.

**THE SLOT** (kneeSlots, after wellMergeSide):
- For each knee main, the leg's axis (knee to foot) and the arm's (P to knee) are sampled every 1 cm at each WELL_G
  pose. Where a sample crosses the skin, or lies within the leg's radius of it, that is a piercing.
- The slot is a rounded rectangle from the circle's centre up to the highest piercing plus the leg's radius. Its width
  is the leg's diameter (at least 60 mm), plus FIT.clear all round.
- It is a side cut of its own (`slot`), with the circle's `group`. Both are given ONE flat floor: the deeper of the
  circle's floor and the stowed leg's depth plus FIT.clear.
- The knife (knifeWells) tags each side cut's new walls (`sideCut`) and drops any wall of a grouped cut whose middle
  lies inside the other cut's outline, grown a hair. The two cuts become one keyhole opening, with no wall between them.
- Gate: a slot over each circle, narrower than 60 % of it. On the C172 card it reaches y -0.13, the height of the
  stowed knee.

**FULL DOORS** (row gearKneeDoor: 0 open recess, 1 full door; shown with the knee fold; claimed in PARTS, listed in
CAGE_RETRACT_ROWS / the spec's retract rows):
- kneeGeom(…, full) solves the arm so the whole stowed tyre (its outer face, over its full height) sits KNEE_IN = 25 mm
  behind the skin. On the C172 card that gives a 0.61 m arm, against 0.48 m for the open recess. The fit's centred test
  becomes "wholly inside": every rim point at least 17 mm in.
- **The leg's door.** This is the body's side faces inside the keyhole (circle and slot, DOOR_SEAM in, the outermost skin
  only), cut at y = stowed axle - 0.8 R. It is one slab (panel(), looking along [side, 0, 0]), rule 'rigid' on the unit,
  drawn at the stowed place less gearArc(C, 0). The fold is a pure translation that ends moving level and inward, so the
  door lands flush. A stay runs from the axle's outer end to the door's back. Gear down, its foot is 0.2 R (+ seam) over
  the tyre's.
- **The foot's door** is the circle under that line: a crescent hinged on the hull along its lowest edge. Its rule is
  'door', 120 deg with closedDown: it swings out and down as the gear leaves up, and is shut both up and down. The wheel
  enters over it.
- Gate: two leg doors and two foot doors. Stowed, both lie flush, within 10 mm of the airframe probe (the probe's chords
  sit a few mm off the faceted bilge). The leg door clears the tyre's foot by 39 mm, and the foot door hangs open at mid
  travel.

On the C172 stand-in the full-door wheel goes deeper, so the cabin-floor red grows (137 mm against 64). That card's
raised floor is not a hull's.

### 8.30 The folding knee's door on the hull, hinged at the top (6 Nov)

The user: "Can we have the door also full attached to the hull. Same cut, but the top part attaches to the top of the
cut, and rotates 90 deg upwards, comes right below the wing of the Petrel for example".

- **The row.** gearKneeDoor gets a third value: 2, "full door on the hull, hinged at the top". kneeDoor(P) (the wheel
  wholly inside, KNEE_IN) holds for 1 and 2; kneeHullDoor(P) is 2 alone.
- **The door** (doorBuild, the knee's branch) is the body's side faces over the WHOLE keyhole (circle and slot, DOOR_SEAM
  in, the outermost skin), one slab with no foot split.
  - Its hinge is the cut's top edge (the points within 8 mm of the highest), fore-aft. The axis sign is chosen so the
    door swings OUT.
  - Rule 'door': ang 90 deg (KNEE_DOOR_ANG), seq { k: KNEE_DOOR_SEQ = 0.10, closedDown: false }. It is open as soon as
    the gear leaves up, and stays open while the gear travels and stands down: the arm passes through the opening gear
    down. It shuts in the last tenth, with the wheel already in.
  - It is drawn as it stands gear down (open). Two steel knuckles sit on the hinge line.
- **Open, it must clear every wing.** Its outer face is swung 90 deg, plus DOOR_T. A point within 5 mm of any plane's
  underside reddens the fit: "the left main's door, swung up, stands N mm into the wing over it (lower the cut's top: a
  narrower track, or raise the wing)". The rows it points to are the fold, gearKneeDoor and w2Dy.
- **The horn, stowed, inside.** kneeGeom's pivot-inside condition now also holds the horn's stowed end 20 mm inside. A
  full-door knee under a low wing, with its leg shortened, had put the horn 23 mm out of the bottom.
- **On the C172 card** with a second wing (w2On 1, w2Pos 1, w2Dy 0.25): the hinge is at y -0.073 and the open door lies
  about 100 mm under the wing. At w2Dy 0.12 the fit is red: the door stands 15 mm into the wing, and the stowed knee too.
- **Gate (section 18):** two hull doors and no leg or foot doors; the hinge on the cut's top; shut, the door is over
  300 mm tall; open, it is level (under 60 mm of height) and under the wing; with a low wing, the door's red is named.
