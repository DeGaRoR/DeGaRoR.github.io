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
