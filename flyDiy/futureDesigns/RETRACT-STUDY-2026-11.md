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
