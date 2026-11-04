# PRICE-STUDY 2026-11: what a credit is worth

*A study only: no game code or balance was changed. Web prices are as of the search date, **4 November 2026**, in USD
(EUR/GBP/AUD/CAD converted roughly). The game's prices were computed headless off master's core (`05f95aa7`) by
`futureDesigns/price-study/price_study.js`; every number below is in `price_study_data.json` beside it.*

**A caveat on the sources.** The research ran about 115 web searches. Fetching the pages themselves (Aircraft Spruce,
Van's, Controller, Barnstormers, Garmin, Wipaire and others) was blocked by the session's network allowlist, so each
figure comes from a search-result extract of the page linked. Treat them as indicative. A row marked ESTIMATE has no
published figure behind it.

---

## The conclusions (one page)

1. **One credit is about 1.5 US dollars (2025-26) for anything the game lets you buy.** Instruments, radios and
   electrics were entered at list price and read **1 credit ≈ $1.1**. Engines are "second-hand, installed" and read
   **≈ $1.5** against overhauled or exchange prices. On the 38 component rows that are not outliers, the fit is
   **$1.30 a credit**, scattered by a factor of 1.4. **The study proposes 1 credit = $1.5** as the stated convention.
2. **For whole aeroplanes, no single rate fits, and that is the market's fault, not the game's.** Real aeroplanes sell
   in four regimes that differ by up to 20× for the same airframe:
   - **used or vintage** (J-3, Jodel, Chinook, Tiger Moth, DC-3, a used RV): $0.35 to $1.9 for each game credit;
   - **pure homebuilt from plans** (materials, engine and panel, labour free): $1.2 to $1.8;
   - **kit** (the factory's parts and part of its labour): $2.3 to $3.4;
   - **new certified factory** (C172, Grand Caravan, a new Cub-class): $5 to $7.6.

   **The game's ledger is a plans-built parts bill**: at $1.5 it lands within ±25 % on the Cub and the Jodel. Its
   catalogue (the ledger × 1.15) is no factory price: at $1.5 a credit, a new C172 costs 3.3× the catalogue and a new
   Grand Caravan 4.8×.
3. **Ranking: right except in two places.** The order runs Chinook < Birdman < Cub < Jodel < Tiger Moth < B-ITES <
   RV < C172 < Caravan-alike < DC-3. The two inversions:
   - **The Jodel above the Cub.** Real used Jodels sell for about half a used Cub. The cause is the Jodel's oleo gear
     (2 600) and wood at 55 a kilo.
   - **The DC-3 above the Caravan class.** A new Grand Caravan costs 4-12× a used DC-3, and even a used 208B costs more.
     The PT6A is priced honestly (its ratio of 1.6 sits with the other engines). The DC-3 is high because of its 3 000 L
     tank (51 000 credits) and its 273 000 of structure at alloy's 78 a kilo. The Caravan-alike is low because it is a
     4-seat, 873 kg card, not a 2-tonne Grand Caravan (see §2).
4. **The top five outliers** (real / game, against the convention's 1.5):
   1. **Floats: ×24 too cheap.** A pair is billed only as shell mass at the airframe's price a kilo (+1 529 credits on
      the Cessna) against $27-50k for a real pair. No row exists.
   2. **Paint: ×4-6 too cheap, and flat.** 1 800 credits on every aeroplane, Cub to DC-3. A C172 strip-and-paint is
      $7-15k.
   3. **Interior: ×4-6 too cheap.** The C172's seats and furnishing come to 2 855 credits against a $14-20k
      professional interior. The furnishing is priced at 60 a kilo.
   4. **Propellers: ×3-5 too cheap, carbon ×4 too dear.** Wood (900), alloy (2 200) and a constant-speed prop (priced
      exactly as fixed-pitch) all read 4-5× under real list. A ground-adjustable composite 3-blade is billed 6 600
      against $1.3-4.4k.
   5. **Fabric covering ×4.7, tailwheel ×4.6, harness ×4.9 (estimate): all too cheap.** Plus two rows that do not
      exist: **skis** (real $3-9.5k a pair) and **lights** (real $1.2-1.9k a nav/strobe set). Both are garage gaps.
5. **Four faults in the ledger's code** (not taste):
   - a twin bills **one** propeller (the DC-3's second prop is missing, ~10 800);
   - every seat is billed **twice** (a 380 "seat" line in `cabin` beside the GEN_SEATS row in `furnish`);
   - the core carries **two catalogue margins** (PROCURE ×1.15, ECONOMY's `econCatalogPrice` ×1.08: a Cub is 35 900
     or 33 700 depending on who asks);
   - a tank's price **includes its first fill of fuel** and is linear in litres (the DC-3's tank is 9 % of the aeroplane).
6. **Weights hold.** Engines fall within ±12 % of published dry mass, most within ±5 %. Empty weights fall within
   ±16 % on the Cub, C172, Jodel, Tiger Moth, RVs and DC-3. Two exceptions:
   - **The ultralights are 40-70 % heavy.** The basic systems tier (22.6 kg: battery, generator, starter, radio)
     rides on a 154 kg Chinook. This is a choice of tier, not a mass law.
   - **The Caravan-alike is 0.4× a 208B**, because it is a smaller aeroplane.
7. **B-ITES** (A0 identified "B-ITID" as the user's build B-ITES, on `origin/claude/a0/b-ites-input`; the name is not
   on master). The game prices it at a ledger of **66 128**, scratch 52 900, catalogue 76 000 (**≈ $114k at $1.5**).
   It sits **inside the used RV-7/-8 range** ($130-160k, ×0.85) and **below the kit-to-fly route** ($150-190k, ×0.6).
   That is the right neighbourhood, and the game's IO-360 (38 000) is most of its price.
8. **The proposal (§5) raises the Cub's ledger ×1.38, from 31 203 to ~42 900.** Everything ECON_BOOK prices in Cubs
   moves with it. The absolute numbers do not: the grant, the T6 fee, the contract pay and the route pay. Scale them
   ×1.38 and ECON-SIM's paces (3 / 8 / 11 contracts) hold to first order.
   **`tools/econ_sim.js` does not run on master today**: every career stops at "T5: clients.01 not flown". The career
   figures are therefore first-order arithmetic, not a simulation.

---

## 1. Components: real price vs the game's

*real = the range found (basis: oh = overhauled or exchange, which is what the game's "second-hand, installed"
engines mean; exp = experimental, non-TSO; tso = certified). ratio = mid of the real range ÷ game credits. **At the
proposed convention, a right price reads 1.5.***

### Engines (`00_registry.js POWERPLANTS`)

| component | real (USD) | basis | game cr | ratio | note / source |
|---|---|---|---|---|---|
| Continental A-65 | 9.5-13k | oh | 9 000 | 1.23 | shop overhaul ~9.5k before accessories; mid-time used 3-3.5k ([Aviation Consumer](https://aviationconsumer.com/?p=9272), [taylorcraft.org](https://vb.taylorcraft.org/forum/taylorcraft/buy-sell-aircraft-parts-services-shops/7120-continental-a-65-8-250-hrs-smoh)) |
| Rotax 503 | 4.5-5k | oh | 4 000 | 1.19 | out of production ([backcountrypilot](https://backcountrypilot.org/forum/100hp-class-experimental-lsa-engine-shootout-6573)) |
| Rotax 582 + gearbox | 8.2-9.5k | new | 5 500 | 1.60 | GBP 7 500 new boxed ([afors](https://afors.uk/engines+propellors/for-sale/standardView-66028), [Controller](https://www.controller.com/listing/for-sale/259472043/rotax-582-dcdi-engines)) |
| Rotax 912 UL/ULS | 20.6-23.7k | new | 18 000 | 1.23 | [Motive](https://motive.aero/engine-details/rotax-912ul/315), [Six Chuter](https://www.sixchuter.com/catalog/p/535fp5sct6ms62z99fuq40sco0u89b) |
| Rotax 914 UL | 37.6-48.5k | new | (no row) | - | [Controller](https://www.controller.com/listing/for-sale/259472089/rotax-914ul-engines) |
| Rotax 915 iS | 48.5-55k | new | 34 000 | 1.52 | [Motive](https://motive.aero/products) |
| Rotax 916 iS | 51-60k | new | 38 000 | 1.46 | [flying411](https://flying411.com/blog/rotax-915is-vs-916is/292) |
| Continental O-200 | 40-47.5k | oh | 24 000 | **1.82** | rebuilt 47.5k, new O-200-D 46.7k ([Air Power](https://www.airpowerinc.com/0200a48bn)) |
| Lycoming O-235 | 38.7-47k + core | oh | (no row) | - | [Aircraft Spruce](https://www.aircraftspruce.com/catalog/pnpages/07-22637.php) |
| Lycoming O-320 | 48-56k | oh | 28 000 | **1.85** | 2024 exchange; used reman 32k ([Air Power](https://www.airpowerinc.com/renpl-rt8164)) |
| Lycoming IO-360 | 48-56k | oh | 38 000 | 1.36 | new 75-88k; Superior XP kit 31-55k ([Spruce](https://www.aircraftspruce.com/catalog/eppages/superiorxp.php), [Van's show prices](https://www.vansaircraft.com/wp-content/uploads/2023/03/Lycoming_Vans_SNF_Show_Prices.pdf)) |
| Lycoming O-540 | 61-67k | oh | 38 000 | 1.68 | new 117k ([Rotorcorp](https://rotorcorp.com/lycoming-engines-for-your-robinson-helicopters)) |
| DH Gipsy Major | 43-70k | oh | 26 000 | **2.11** | GBP 34-55k asking ([afors](https://afors.uk/engines+propellors/for-sale/standardView-68219/gipsy-major-10-mk2-zero-timed-engine-for-sale)) |
| P&W R-985 | 45-60k | oh | 48 000 | 1.08 | ESTIMATE ([WIX](https://www.warbirdinformationexchange.org/phpBB3/viewtopic.php?p=536948)) |
| P&W R-1830 | 60-100k | oh | 65 000 | 1.19 | ESTIMATE ([PoA](https://www.pilotsofamerica.com/community/threads/pw-1830-tbo.45858/)) |
| P&W PT6A-114A | 350-433k | oh | 240 000 | 1.62 | P&WC flat rate 2025; 2026 382-472k; exchange ~590k ([P&WC](https://www.rtx.com/prattwhitney/services/pwc-engine-services/maintenance-repair-overhaul/pwcsmart/pt6a-engines)) |
| P&W PT6A-34 | 387-455k | oh | 265 000 | 1.58 | same |
| P&W PT6A-42 | 420-489k | oh | 300 000 | 1.51 | same |

The engines' geometric mean is **1.48**. The custom-engine law (`genEnginePrice`) sits on the same rows, so it inherits
the same rate.

### Propellers (`GEN_PROP_MATS`; the law: price × blades/2 × (D/1.88)²)

| component | real (USD) | game cr | ratio | note / source |
|---|---|---|---|---|
| fixed wood, Cub | 3.5-4.4k | 900 | **4.36** | Sensenich W72 ([Univair](https://univair.com/categories/aeronca/propellers.html)) |
| fixed metal, C172 | 8.2-10.8k | 2 271 | **4.14** | Sensenich 74DM6 / McCauley 1C160 ([Univair](https://univair.com/categories/cessna/cessna-150-152/propellers.html), [Spruce CA](https://www.aircraftspruce.ca/catalog/appages/sensmetal.php)) |
| ground-adjustable composite 3-blade (912) | 1.3-4.4k | 6 605 | **0.36** | Warp Drive 1.3k, E-Props EUR 1.5k, IVO 3.4-4.4k ([Six Chuter](https://www.sixchuter.com/catalog/p/warp-drive-3-blade-propeller-with-hpl-hub), [E-Props](https://blogen.e-props.fr/?p=9819)) |
| constant speed 2-blade (IO-360) | 10.5-11.8k | 2 319 | **4.80** | Hartzell via Van's + governor ([VAF](https://vansairforce.net/goto/post?id=1939196)); **the game prices a CS prop as fixed** |
| MT composite CS 3-blade | 15.9-18.6k | (carbon row) | - | [Van's MT form](https://www.vansaircraft.com/wp-content/uploads/2022/08/mt_prop_order_form-Aug2022.pdf) |
| turboprop 3-blade (PT6A) | 18.5-45k | 6 756 | **4.27** | old Hartzell kit 18.5-19.9k; 30-45k ESTIMATE today ([Hartzell](https://hartzellprop.com/?p=337)) |

### Instruments, electrics, avionics (`GEN_INSTR`, `GEN_ELEC`, `GEN_AVIONICS`: the panel arc's list prices)

| component | real (USD) | basis | game cr | ratio | source |
|---|---|---|---|---|---|
| airspeed | 254-374 | exp | 350 | 0.88 | [Spruce](https://www.aircraftspruce.com/catalog/inpages/swiftsai2.php) (TSO 1.2-1.6k) |
| altimeter | 429-1 200 | exp | 600 | 1.20 | [Spruce 2024](https://www.aircraftspruce.com/pdf/2024Individual/Cat24540.pdf) |
| attitude, vacuum | 1 487-2 495 | tso | 1 900 | 1.01 | [Spruce](https://www.aircraftspruce.com/catalog/inpages/st5000bw1.php) |
| attitude, electric | 893-4 195 | exp/tso | 2 800 | 0.69 | non-TSO ~0.9k, TSO 4.2k+ ([SE Aerospace](https://seaerospace.com/sales/product/Mid-Continent/4300)) |
| directional gyro | 675-893 | exp | 1 600 | 0.49 | non-TSO only found; the game's row is a TSO RC Allen class, so this is a basis mismatch, not an outlier |
| turn coordinator | 1 195-1 325 | tso | 800 | 1.57 | [Spruce](https://www.aircraftspruce.com/catalog/pnpages/10-01372.php) |
| compass | 455-883 | new | 300 | **2.11** | [Spruce CA](https://www.aircraftspruce.ca/catalog/inpages/airpath_compass_c2400.php) |
| vacuum pump | 553-809 | new | 600 | 1.11 | [Spruce](https://www.aircraftspruce.com/catalog/inpages/rapco_dryairpump2.php) |
| battery, lead (PC680) | 183-281 | new | 180 | 1.26 | [Van's store](https://store.vansaircraft.com/odyssey-pc680-battery-es-pc680.html) |
| battery, lithium | 379-450 | new | 520 | 0.79 | [batterymart](https://www.batterymart.com/c-aircraft-batteries.html) |
| alternator 60 A | 1 057-1 287 | new | 800 | 1.46 | [Spruce 2024](https://www.aircraftspruce.com/pdf/2024Individual/Cat24363.pdf) |
| starter | 1 086-1 120 | new | 700 | 1.58 | same |
| wiring harness | 500-3 000 | ESTIMATE | 250 | **4.9** | no published figure |
| VHF COM | 1 364-2 110 | new | 1 600 | 1.06 | [Spruce 2024](https://www.aircraftspruce.com/pdf/2024Individual/Cat24726.pdf) |
| Mode-S transponder | 3 053-3 893 | new | 2 300 | 1.50 | [Spruce](https://www.aircraftspruce.com/catalog/pnpages/11-12076.php), [Sarasota](https://sarasotaavionics.com/search?q=gtx335) |
| VOR nav (used KX 155) | 1 995-3 000 | used | 2 200 | 1.11 | [Controller](https://www.controller.com/listings/for-sale/bendix-slash-king/kx155a/avionics/30100) |
| portable GPS | 849-1 549 | new | 900 | 1.27 | [Sarasota](https://sarasotaavionics.com/aviation-gps-specials) |
| panel GPS | 4 995-7 995 | new | 4 500 | 1.40 | [AVweb](https://avweb.com/news/aea-garmin-rolls-out-two-new-panel-gps-navigators/) |
| glass EFIS 7 in | 3 360-6 500 | new | 6 500 | 0.72 | [Garmin exp. sheet](https://www8.garmin.com/aviation/brochures/Experimental%20Pricing%20Sheet%202023.pdf), [KitPlanes 2026](https://kitplanes.com/2026-avionics-and-lights-buyers-guide/) |

**The game's three panel tiers:**
- minimal: 1 800;
- basic: 7 950 (the Cub, the Jodel, the Chinook);
- ifr: 16 660.

Real panels: a basic VFR homebuilt panel (one EFIS, a COM, a transponder) is $8-15k (ESTIMATE). A certified IFR
retrofit (a GTN 650Xi with a GI 275 or G5, installed) is $15-22k ([Lafayette](https://reach.dog/shop/lafayette-avionics-inc/products/gtn650-installed)).
The tiers read about 1.5 against those panels.

### Gear, floats, skis, finish, interior, tanks, lights

| component | real (USD) | game cr | ratio | note / source |
|---|---|---|---|---|
| main wheel + tyre + brake, each | 680-900 | 320 | **2.44** | Matco 5.00-5 pair 1 096 + tyre 254-294 ([Spruce](https://www.aircraftspruce.com/catalog/lgpages/matcoW51LT.php)) |
| tailwheel assembly | 1 000-1 410 | 260 | **4.57** | ABI/Scott 3200 PMA ([Wag-Aero](https://onlinecatalog.wagaero.com/55/)) |
| bungee set (Cub) | 200-260 | 250 | 0.91 | [Univair](https://univair.com/categories/piper/piper-j-3/landing-gear.html) |
| spring-steel legs | 2 000-2 500 | 900 | **2.48** | old figure ([VAF](https://vansairforce.net/threads/grove-vs-vans-gear.15072/latest)) |
| oleo set | not found | 2 600 | - | |
| tundra tyre 26-29 in, each | 1 680-2 980 | (no row) | - | [McFarlane](https://www.mcfarlaneaviation.com/products/categories/all-products/landing-gear-components/tires-and-tubes/alaskan-bushwheels/) |
| **floats, Cub/C172 pair** | **27-50k** | **1 529** | **24** | Aerocet 2200 ~27.5k, Wipline 2100 amphib ~50k, XCub 45k / 70k amphib, used EDO 2000 ~19k ([Barnstormers](https://www.barnstormers.com/category-19238-Float-Plane--Floats--Edo.html), [Piper Flyer](https://piperflyer.com/refreshing-flying-how-a-floatplane-made-flying-fun-again/), [AVweb](https://avweb.com/news/xcub-now-available-on-floats/)) |
| **skis, Cub pair** | **3-9.5k** | **no row** | - | Summit carbon 4.9k; Federal wheel-ski 8.8-9.5k ([KitPlanes](https://kitplanes.com/summit-aircraft-skis-for-cubs/)) |
| paint, C172 professional | 7-15k | 1 800 (any plane) | **5.69** | [Epic](https://epicflightacademy.com/cost-of-a-cessna-172/) |
| interior, C172 professional | 14-20k | 2 855 | **5.86** | [AVweb](https://avweb.com/features/your-refurb-upgrading-the-interior/), [flying411](https://flying411.com/blog/cessna-172-interior-refurbishment-cost/266) |
| fabric covering materials, Cub | 3-6k | ~900 | **4.71** | 51 m² × 0.42 kg/m² × 42 cr/kg; a professional recover is 20-40k ([Spruce CA](https://www.aircraftspruce.ca/catalog/cspages/polyfiberkit.php), [supercub.org](https://www.supercub.org/forum/threads/how-many-hours-to-cover-a-cub-fuselage-or-how-much.20698/)) |
| fuel tank, Cub/PA-18 class | 400-2 274 | 796 + the fuel | 1.20 | [Univair](https://univair.com/content/partcatalog/18PM-flipbook/files/basic-html/page15.html) |
| **nav/strobe LED pair** | **1.19-1.9k** | **no row** | - | [Van's store](https://store.vansaircraft.com/aeroled-pulsar-11-1100-pair-l-r-tso-lights-ln-200-1.html) |
| seats (homebuilt cushions) | 344 for two | 120-2 900 a row (+380 a seat again) | - | [Van's](https://store.vansaircraft.com/oregon-aero-rv-6-6a7-7a-9-9a-seat-foam-set-ca-seat-set-7-9.html) |

### Raw materials (`GEN_MATERIALS.price`: credits per kg of finished structure)

| row | game cr/kg | real stock | reading |
|---|---|---|---|
| 4130 tube + fabric | 42 | 4130 ¾ in square tube $28.75/ft (~$185/kg) ([Spruce](https://www.aircraftspruce.com/catalog/pnpages/03-12700.php)); covering $3-6k a Cub | a tube Cub's 157 kg of structure bills 6 666 (~$10k), roughly the raw stock and covering a plans builder buys; no labour in it |
| spruce + ply | 55 | spruce $12-15 per board ft; Finnish 2 mm birch ply $62 a 4×4 sheet ([Spruce 2025](https://www.aircraftspruce.com/pdf/2025Individual/Cat25031.pdf)) | materials-level |
| 2024 alloy | 78 | 2024-T3 .032 sheet $66-174 a sheet ([Alcobra](https://alcobrametals.com/product/032-2024t3-alclad-alum-sheet/)); per kg not found | an RV kit's airframe (~$50k for ~300 kg of structure, ~$160/kg) is 2× this at $1.5 |
| carbon + epoxy | 165 | carbon cloth ~$125-180/kg + resin (ESTIMATE) ([US Composites](https://uscomposites.com/carbonpage.html)) | materials-level |

**The comments say each row is "stock, covering and labour rolled into one". Measured against the market, the rows
price the stock.** That suits a plans-built aeroplane, where the labour is free. It is also why the kit route reads
2.3-3.4 and not 1.5.

---

## 2. Planes, three ways

*Game prices off the build files through the game's own rules:*
- *scratch = ledger × 0.8 (a fitted main hangar, `econAirframePrice`);*
- *short = ledger × 1.0;*
- *catalogue = ledger × 1.15 (PROCURE `procurePrice`, what the makers' board charges);*
- *used = 0.4-0.8 × catalogue.*

*Ratio = real USD mid ÷ the game's credits: the plans route against scratch, the kit route against the ledger, the
factory or used route against the catalogue. **Right at the convention = 1.5.***

| plane (build) | engine | game empty kg | ledger | scratch | catalogue | (a) plans: real · ratio | (b) kit: real · ratio | (c) factory / used: real · ratio |
|---|---|---|---|---|---|---|---|---|
| Cub, a slightly upgraded J-3 (cub_…_corrected) | A-65 65 hp | 354 | 31 203 | 25 000 | 35 900 | $35-60k (est.) · **1.83** | $80-140k (est.) · 3.39 | used upgraded J-3 / PA-11 $45-75k · **1.62**; **new** Cub-class (AL3, Carbon Cub UL) $250-295k · 7.56 |
| Cessna 172 (cessna172_…_corrected) | custom 159 hp | 637 | 88 486 | 70 800 | 107 900 | - | - | **new** 172S $499-580k · **4.99**; used 172M/N $120-150k · 2.2 (against the used band) |
| Jodel, as a D115 (jodel_…_corrected) | A-65 65 hp | 341 | 34 363 | 27 500 | 39 500 | $25-45k (est.) · **1.22** | - | used D11/D112 in Europe $16-38k · **0.62** |
| Birdman (review/birdman.json) | Rotax 582 | 263 | 28 118 | 22 500 | 32 300 | - | (as the Chinook) | (as the Chinook) |
| Chinook (Birdman Chinook) | Rotax 582 | 219 | 26 082 | 20 900 | 30 000 | - | 2009 kit $20-36k · 1.03 | used Plus 2 $9-12k · **0.35** |
| Tiger Moth (tigermoth_2026-10) | Gipsy Major 130 hp | 557 | 56 784 | 45 400 | 65 300 | - | - | used / restored $76-170k · **1.74** |
| **B-ITES** (the user's, RV range) | IO-360 180 hp | 467 | 66 128 | 52 900 | 76 000 | - | RV-7/-8 kit to fly $150-190k · **2.55** | used RV-7A / RV-8 $130-160k · **1.90** |
| RV-alike (archetype) | IO-360 180 hp | 469 | 72 402 | 57 900 | 83 300 | - | $150-190k · 2.33 | used $130-160k · 1.73 |
| DC-3 (dc3_2026-10) | 2 × R-1830 | 6 441 | 541 782 | 433 400 | 623 000 | - | - | used airworthy $230-600k · **0.60** |
| Caravan-alike (archetype) | PT6A-114A | 873 | 332 513 | 266 000 | 382 400 | - | - | **new** 208B EX $2.6-2.9M · **7.18**; used 208B $0.7-1.5M · 4.7 |

**Reading the table.**
- **Plans (1.2-1.8):** the ledger is a plans-built parts bill, as §1 says.
- **Kit (2.3-3.4):** a kit carries the factory's jigs, CNC and some of its labour, which the ledger does not.
- **Used (0.35-1.9):** the market pays nothing for labour, and vintage types sell below their parts.
- **New certified (5-7.6):** certification, liability and margin, which no 1.15 margin can reach.

**Builder hours** (for the plans and kit routes):
- a Cub-class: 700-1 000 h as a quickbuild kit, 2 000-3 000 h from plans (estimate);
- an RV-7/-8: 1 500-2 500 h; an RV-14: 1 000-1 300 h; an RV-12iS: ~800 h;
- a Jodel D11: 1 500-2 500 h (estimate).

**What those hours are worth:** the market says nothing. Used homebuilts sell for about their parts, and one builder's
own accounting came to about $10 an hour. At $10-25 an hour, a Cub from plans carries $20-75k of labour, more than its
parts. This is the kit route's gap, and the reason the game's labour factor (0.8 / 1.0 / 1.25) is a mild knob, not a
market.

**The Grand Caravan class, roughly.** No Grand Caravan-sized build exists. The archetype is a 4-seat, 873 kg card with
a 14 m wing, against a 208B's 2 064-2 252 kg empty. Scaling its non-engine 77 000 credits by mass to ~2.1 t puts a
208B-class build at a ledger of ~440 000 and a catalogue of ~500 000 (≈ $0.75M at $1.5). That is about a used 208B
($0.7-1.5M) and a quarter of a new one. **The turbine's price is in the registry** (PT6A-114A 240 000; -34 265 000;
-42 300 000; -60A 380 000), and it reads 1.5-1.6 against P&WC's 2025-26 flat-rate overhaul. The engine is right; the
turbine airframe is a certified-factory product the ledger does not try to be.

**The Jodel as a D115.** The build flies a 65 hp A-65, so it is a D112. The D115 is listed as a D11 with a 75 hp
Mathis; the variant lists disagree, so treat that as unverified. The price would move by an engine row, not more.

**B-ITES** is a single-seat low-wing tube-and-fabric build with an IO-360 and 22 L in the nose (v8). Its catalogue of
76 000 (≈ $114k) falls inside the used RV band and under the RV kit route. A single-seat RV-3B kit is $28k (RV-3B, 2023)
before an O-320, which would put a real single-seater at ~$90-130k: the game's figure is in it.

### The order

| rank | game catalogue | real (what a buyer pays, mid) |
|---|---|---|
| 1 | Chinook 30 000 | Chinook $10k |
| 2 | Birdman 32 300 | **Jodel $25k** |
| 3 | Cub 35 900 | **Cub $58k** |
| 4 | **Jodel 39 500** | Tiger Moth $114k |
| 5 | Tiger Moth 65 300 | used C172 $134k ≈ RV $144k |
| 6 | B-ITES 76 000 · RV-alike 83 300 | (B-ITES in the RV band) |
| 7 | C172 107 900 | **DC-3 (used) $371k** |
| 8 | **Caravan-alike 382 400** | new C172 $538k |
| 9 | **DC-3 623 000** | **Grand Caravan (new) $2.75M; used ~$1.0M** |

The two inversions are bold. Both are explained in conclusion 3.

---

## 3. The conversion

| what | fit (USD per credit) | scatter (rms factor) | rows |
|---|---|---|---|
| instruments, radios, electrics (list prices) | 1.11 | 1.42 | 18 |
| engines (vs overhauled / exchange) | 1.48 | 1.20 | 16 |
| every component row with a game price | 1.71 | 2.08 | 49 |
| the 38 rows that are not outliers (no props, floats, paint, interior, covering, tailwheel, harness) | **1.30** | **1.40** | 38 |
| whole planes, the buyer's route (factory or used) | 1.52 | 2.53 | 9 |

**The convention proposed: 1 credit = $1.5 (2025-26).** It is the engines' number and the planes' fit. The panel is
~25 % under it, which is within the scatter. Against it, the outliers are:

| outlier | ratio at $1.5 | direction | by how much |
|---|---|---|---|
| floats | 24 / 1.5 = **16×** | too cheap | no row; billed as shell mass |
| paint (C172; worse on big aeroplanes) | 3.8× | too cheap | flat 1 800 |
| interior (C172) | 3.9× | too cheap | 60 cr a kilo of furnishing |
| props (wood, alloy, CS, turbo) | 2.8-3.2× | too cheap | the CS hub is unpriced |
| composite prop | 0.24× (4× too dear) | too dear | carbon 5 200 a pair of blades |
| fabric covering | 3.1× | too cheap | 0.42 kg/m² × 42 |
| tailwheel / wheels / spring legs | 3.0× / 1.6× / 1.7× | too cheap | |
| harness | 3.3× (estimate) | too cheap | 250 flat |
| Gipsy Major, O-200, O-320 | 1.2-1.4× | a little cheap | |
| skis, lights | - | no row | garage gaps |

---

## 4. Weights (the user's aside): published vs game

| item | published kg | game kg | ratio | source |
|---|---|---|---|---|
| Continental A-65 (dry) | 77 | 80 | 1.04 | type data |
| Rotax 912 UL | 55-57 | 58 | 1.03 | Rotax |
| Rotax 915 iS / 916 iS | 84 / 85.8 | 84 / 85.8 | 1.00 | Rotax ([916 iS page](https://www.flyrotax.com/products/916-is-c)) |
| Continental O-200 | 90-98 | 85 | 0.91 | type data (approx.) |
| Lycoming O-320-E2D | 115-120 | 122 | 1.04 | type data (approx.) |
| Lycoming IO-360 | ~130 | 138 | 1.06 | type data (approx.) |
| Lycoming O-540 | ~180 | 176 | 0.98 | type data (approx.) |
| Gipsy Major 1 | ~138 | 139 | 1.01 | type data |
| P&W R-985 / R-1830 | 290 / ~670 | 290 / 750 | 1.00 / **1.12** | type data (approx.) |
| PT6A-114A / -34 / -42 | 159 / 150 / 177 | 160 / 150 / 183 | 1.0 / 1.0 / 1.03 | P&WC |
| lithium battery | 1.77 | 2.3 | 1.30 | EarthX ETX680C |
| alternator 60 A | 6.0 | 4.5 | 0.75 | Plane-Power ([Air Power](https://airpowerinc.com/al24-f60)) |
| float pair, PA-18 class (straight) | 127 (Wipline 2100) | ~120 (the PA-18's gear section − the land gear) | ~0.95 | [Wipaire](https://www.wipaire.com/aircraft_page/piper-pa-18pa-12) |
| float pair, C172 class | 212 (Wipline 2350 amphib system) | +129 straight | (straight not found) | [Wipaire](https://wipaire.com/wipline-floats) |
| skis, Cub pair | ~23 (Summit carbon) | no row | - | [KitPlanes](https://kitplanes.com/summit-aircraft-skis-for-cubs/) |

| plane | published empty kg | game empty kg | ratio | note |
|---|---|---|---|---|
| J-3C-65 Cub | 308 | 354 | 1.15 | the game's carries the basic tier's battery, generator and starter (+17 kg): an "upgraded" J-3 |
| Cessna 172N / 172S | ~660 / 754-779 | 637 | 0.97 / 0.83 | |
| Jodel D112 | ~340 | 341 | 1.00 | |
| Chinook 2S | 154 | 219 (chinook) / 263 (birdman) | **1.42 / 1.71** | the basic systems tier (22.6 kg) on an ultralight |
| Tiger Moth DH.82A | 506 | 557 | 1.10 | |
| RV-7 / RV-8 | 481-505 / 484-508 | 469 (RV-alike) / 467 (B-ITES) | 0.95 / 0.94 | B-ITES is single-seat; an RV-3 is 340 |
| DC-3 | 7 650 | 6 441 | **0.84** | |
| 208B Grand Caravan | 2 064-2 252 | 873 (Caravan-alike) | **0.40** | a smaller aeroplane, not a weight law |

Weight sources: [NASM J-3](https://www.si.edu/object/nasm_A19771128000), [Wikipedia Chinook](https://en.wikipedia.org/wiki/Birdman_Chinook),
[aarg Tiger Moth](https://aarg.com.au/tigermoth.html), [Wikipedia RV-8](https://en.wikipedia.org/wiki/Van%27s_Aircraft_RV-8),
flugzeuginfo.net (D112, DC-3), globalair.com (172S), gccports.com (208B). The engine masses marked "approx." are
published type-data figures, not re-checked in this session's searches.

**Verdict:** the care taken on weight shows. Nothing in the weights needs a change beyond the R-1830 (+12 %) and the
decision of which systems tier an ultralight card carries.

---

## 5. Proposal (a table only: nothing applied)

*At the convention (1 credit = $1.5), each outlier is moved to real ÷ 1.5. Measured by `price_study.js`: the data
rows patched on its own process's copy of the core, the code rules added as deltas off the ledger's own masses.*

| # | where | now | proposed | why |
|---|---|---|---|---|
| P1 | `GEN_PROP_MATS.wood.price` | 900 | **2 600** | Sensenich wood $3.5-4.4k |
| P2 | `GEN_PROP_MATS.alu.price` | 2 200 | **6 000** | fixed metal $8-11k; a PT6A 3-blade comes to ~18 400 (≈ $28k) |
| P3 | `GEN_PROP_MATS.carbon.price` | 5 200 | **2 000** | hobby composites $1.3-4.4k (an MT CS is dearer: see P13) |
| P4 | a constant-speed hub (engine `cs`) | 0 | **+1 000** a prop | governor + hub; the blades as P2 |
| P5 | `GEN_PRICES.wheel` / `thirdWheel` | 320 / 260 | **550 / 800** | Matco + tyre; Scott 3200 |
| P6 | `GEN_SUSPENSION.spring.price` | 900 | **1 500** | Grove-class legs |
| P7 | `GEN_ELEC.harness.price` · `GEN_INSTR.compass.price` | 250 · 300 | **800 · 450** | |
| P8 | `POWERPLANTS` O-200 / O-320 / Gipsy Major | 24 000 / 28 000 / 26 000 | **29 000 / 34 000 / 37 000** | the three engines under 1.5 by more than the scatter |
| P9 | paint (`GEN_FINISH.full`) | 1 800 flat | **120 cr per m² painted** | Cub ~6 000, C172 ~7 200, DC-3 ~42 000 |
| P10 | furnishing (61_gen_frame outfit) | 60 cr/kg | **240 cr/kg** | C172 interior $14-20k |
| P11 | fabric covering (tubeFabric, aluTube) | in 42 cr/kg | **+50 cr per m²** | fabric systems $3-6k a Cub |
| P12 | **floats (new row)** | shell mass only | **24 cr per kg of the gross they are sized for** | measured: PA-18 18 000 (≈ $27k), Cessna 24 400 (≈ $37k); amphibians later |
| P13 | **skis, lights (new rows)** | none | **skis 3 500 a pair (+~25 kg); lights 1 000 a set** (on a bus) | garage gaps: REF_MATCH §7's rule, a row each |
| P14 | **fix: a prop per engine** (61_gen_frame `spend(S.prop.price)`) | once | once per engine | the DC-3 lacks ~10 800 (29 400 after P2) |
| P15 | **fix: one seat line** (`GEN_PRICES.seat` 380 in `cabin`) | 380 a seat + the GEN_SEATS row | **0** (the GEN_SEATS row alone) | a seat is billed twice |
| P16 | **fix: one catalogue margin** | PROCURE 1.15, `econCatalogPrice` 1.08 | **one** (the user picks) | the Cub reads 35 900 or 33 700 |
| P17 | tank price | first fill included; linear in litres | **no fill** (G-COST: no fuel cost); **per m² of shell** | the DC-3's tank is 51 000 |
| P18 | *(taste, not proposed by default)* a certified-factory margin | 1.15 | 2.5-4 for a certified type | at $1.5 a new 172S costs 3.3× the catalogue; the career would not survive it, so it stays the user's call |

**What P1-P15 do to the planes** (ledger now → proposed; P16-P18 not included):

| plane | ledger now | proposed | × | catalogue | ratio (factory/used) now → proposed (1.5 = right) |
|---|---|---|---|---|---|
| Cub | 31 203 | 42 930 | 1.38 | 49 400 | 1.62 → **1.18** (plans 1.83 → 1.34) |
| Cessna 172 | 88 486 | 103 942 | 1.17 | 119 500 | new 4.99 → 4.50 · used 2.2 → 1.98 |
| Jodel | 34 363 | 42 334 | 1.23 | 48 700 | 0.62 → 0.51 (plans 1.22 → 0.99) |
| Birdman | 28 118 | 35 820 | 1.27 | 41 200 | - |
| Chinook | 26 082 | 34 561 | 1.33 | 39 700 | 0.35 → 0.26 |
| Tiger Moth | 56 784 | 79 489 | 1.40 | 91 400 | 1.74 → **1.24** |
| B-ITES | 66 128 | 77 489 | 1.17 | 89 100 | 1.90 → **1.62** |
| RV-alike | 72 402 | 81 863 | 1.13 | 94 100 | 1.73 → **1.53** |
| DC-3 | 541 782 | 679 071 | 1.25 | 780 900 | 0.60 → 0.48 |
| Caravan-alike | 332 513 | 347 307 | 1.04 | 399 400 | 7.18 → 6.88 |
| Cessna on floats | 95 775 | 136 516 | 1.43 | 157 000 | (floats now cost what floats cost) |
| PA-18 on floats | 54 693 | 92 032 | 1.68 | 105 800 | |

The proposal fixes the components. It does not fix the planes the market prices by age:
- the ultralights and the Jodel get dearer against their used market;
- the DC-3 stays high, and P17 is its own lever: dropping the fill alone takes ~7 900 off it (3 297 L × 2.40);
- the Caravan stays a factory product.

The ranking keeps its two inversions. Fixing the Jodel above the Cub is a materials question: wood at 55 a kilo and an
oleo at 2 600 versus tube at 42 and bungees at 250. That is a design call, so it stays out of the table.

**What it does to the career (first order).** ECON_BOOK prices everything in Cubs (`econRefPrice` = the stock Cub's
ledger, re-derived from its build file), so a Cub at ×1.376 (31 203 → **~42 900**) moves these in step:
- the hangar shells (a Tamgas Hill field shed 89 840 → ~123 600);
- the kits, the sign-on fees, the landmarks' co-funding (keystones 2.5 / 6 / 12 Cubs), the rungs, the competitions.

What is absolute does not move:

| absolute | now | ×1.376 to hold the paces |
|---|---|---|
| `CAREER_GRANT` (sandbox / reference career) | 60 000 | 82 600 |
| `STORY_T6_FEE` | 20 000 | 27 500 |
| `CONTRACT_PAY.perKm` · `surf.short` (and the surface bonuses, `baseF` 2.7, `story` 2.6) | 160 · 1 100 | 220 · 1 510 |
| `ROUTES_PAY.perKm` | 30 | 41 |

The paces were measured by ECON-SIM (G3250, proposed table, 20 seeds): a Cub-class build at 3 contracts, a 4-seater at
8, a side hangar at 11.
- **With the pay held**, these become ~4.1 / ~9.4 / ~15.1. Two would leave their bands (Cub-class 3-4, hangar 8-12).
- **With the pay scaled ×1.376**, they come back to ~3 / ~6.8 / ~11, all inside the bands. The 4-seater drops a little
  because the C172 only rises ×1.17.
- A build contract is priced against its airframe, so it follows on its own.

**This is arithmetic, not a simulation.** `node tools/econ_sim.js` fails on master: every career stops with
"T5: clients.01 not flown" (`playCareer1`, econ_sim.js:409). Re-measure once that is repaired.

---

## 6. Method and files

- `futureDesigns/price-study/price_study.js` (run from `flyDiy/`: `node futureDesigns/price-study/price_study.js`, ~4 min):
  - loads `tools/flight_core.js`;
  - reads each build through `genMigrateSpec → resolveSpec → buildGen → genShakedown` (the ledger by section);
  - bakes the RV-alike and Caravan-alike through `_cage_design.js designBake` with GATE ARCHETYPES' own shim (read
    from `_arch_check.js`);
  - reads B-ITES from `origin/claude/a0/b-ites-input` with `git show` when it is not in the tree;
  - prices each plane with `econAirframePrice`, `procurePrice` and `econCatalogPrice`;
  - fits the rate (log least squares);
  - runs the proposal on a patched copy and restores it.
- `futureDesigns/price-study/price_study_data.json`:
  - every plane's ledger sections, categories (engine, prop, structure, gear, systems, seats, outfit, tank, paint) and prices;
  - the game's component catalogue;
  - the real benchmark rows with their notes, the ratios, the fits and the proposal's measured planes.
- The Cub's tank is under review (44 vs 28 L). At 28 L its tank line falls from 918 to ~640: noise for this study.
- Nothing built was edited; no gate was run or changed.
