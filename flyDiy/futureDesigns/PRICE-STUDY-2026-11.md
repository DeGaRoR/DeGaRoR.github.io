# PRICE-STUDY 2026-11: what a credit is worth, and the three ways to own a plane

*A study only: no game code, balance or tool was changed. Web prices are as of the search date, **4 November 2026**, in
USD (EUR/GBP/AUD/CAD converted roughly). The game's prices were computed headless off master's core (`05f95aa7`) by
`futureDesigns/price-study/price_study.js`. The career was re-played through the economy simulator's own careers by
`econ_price_run.js`. Every number below is in `price_study_data.json` and `econ_price_results.json` beside them.*

**A caveat on the sources.** The research ran about 150 web searches. Fetching the pages themselves (Aircraft Spruce,
Van's, Controller, Barnstormers, Garmin, Wipaire and others) was blocked by the session's network allowlist, so each
figure comes from a search-result extract of the page linked. Treat them as indicative. A row marked ESTIMATE has no
published figure behind it.

**Revision 3 (the user, 4 Nov):** one base price, and an age multiplier on it that reconciles new and old; an easy
first step, with performance to follow (§D).

**Revision 2 (the user, 4 Nov):** fit this study to the economy study, and keep three ways to own a plane apart:
- the **maker way**: new plane, your choices, built in your hangar, which is already well calibrated;
- **pre-built planes, used only** for now: the official Cub, Cessna, Jodel, Birdman;
- **what a plane sells for**.

Keep margins that let the agreed economy progress, correct every outlier, and narrow the market before the report is
final.

---

## The conclusions (one page)

1. **One credit is about 1.5 US dollars (2025-26) for anything the game lets you buy.**
   - Instruments, radios and electrics read **$1.1 a credit**.
   - Engines ("second-hand, installed") read **$1.5** against overhauled or exchange prices.
   - The 38 component rows that are not outliers fit at **$1.30**, scattered by a factor of 1.4.
   - **The convention proposed: 1 credit = $1.5.**
2. **The maker way is calibrated: keep it.** The ledger is a parts bill with the labour free, which is exactly a plans-built
   homebuilt. At $1.5 a credit it lands within ±25 % of the real plans route on the Cub (1.83 / 1.5) and the Jodel
   (1.22 / 1.5). A real kit costs more (2.3-3.4) because it carries the factory's labour; a new certified aeroplane
   costs 5-7.6. **Neither is the maker way's job.**
3. **The used price is already right, measured against the right thing: the game's own build cost, not the market's
   listings.** Today a used airframe costs catalogue × 0.4-0.8, which is the ledger × 0.46-0.92, or **0.58-1.15× what
   the same plane costs to build** in a fitted hangar. Real used planes fetch **0.5-1.2× their build cost**:
   - a J-3 is about 1.2× its plans cost (collector premium);
   - a Jodel about 0.8×;
   - an RV about 0.85× its kit cost;
   - a Chinook about 0.5×.

   The game's band brackets all four. **Keep it**, and keep the used price tied to the ledger, so it moves with every
   correction.
4. **The market's cross-type ratios are fashion: do not chase them.**
   - Used J-3 asking prices about **doubled from 2016 to 2026**.
   - All used pistons rose **34 % from 2019 to the 2022 peak** and have been flat since (July 2026: −0.4 % year on year).
   - The Cub carries a **20-30 % collector premium** (Flying).
   - In the same European market a used Jodel sells for **0.4-0.6 of a used Cub**. No Jodel factory price was found, so
     the new-price ratio is unknown.

   The game builds a Jodel at 1.10× a Cub (wood at 55 a kilo, and the card's oleo gear at 2 600). That stays inside
   what the build costs can say, so **it is not an outlier and no price changes for it**. (If the real Jodel's gear is
   not an oleo, the card's suspension row is the lever, not the price book.)
5. **Selling: a rule to add, with the cap the economy needs.** Proposed:
   - **a sale pays the smaller of 75 % of the used listing at the airframe's condition, and what the player paid for it**;
   - 75 % is the dealer spread, the top of the real 15-25 %;
   - the cap uses `career.airframes[slot].paid`, which already exists.

   An own build in a fitted hangar sells back at 86 % of its cost; a real homebuilt fetches 50-100 %. A used one bought
   and sold at once loses 25 %. Nothing can be bought or built to sell at a profit, and that includes the story's
   occasions (0.40 × the ledger), which would otherwise sell above their price. Story airframes (paid 0) do not sell.
6. **The top five outliers** (real ÷ game, against the convention's 1.5):
   1. **Floats, 16× too cheap.** Only the shell's mass is billed (+1 529 credits) against $27-50k a pair.
   2. **Paint, 4× too cheap.** A flat 1 800 on every aeroplane.
   3. **Interior, 4× too cheap.** The furnishing at 60 a kilo.
   4. **Propellers, 3× too cheap.** A constant-speed prop is priced as fixed. The composite prop is the exception, 4×
      too dear.
   5. **Fabric covering and the tailwheel, 3× too cheap.** Skis and lights have no row: garage gaps.

   Four ledger faults:
   - a twin bills one propeller;
   - every seat is billed twice;
   - the core carries two catalogue margins (1.15 and 1.08);
   - a tank's price includes its first fill.
7. **Correcting them, through the agreed economy (§B).** The fixes raise the Cub's ledger **×1.376** (31 203 → 42 935),
   the metal Cessna ×1.17, the Jodel ×1.23. Re-played on econ_sim's own careers (4 policies × 20 seeds):
   - **pay held:** the paces slip to 5 / 9-10 / 16 contracts (Cub-class / 4-seater / side hangar), the collector never
     finishes segment 3, and 16 of 25 targets are met;
   - **the absolute money scaled ×1.376** (contract pay, the build contracts' bases, the route pay per km, T6's fee):
     the paces are **4 / 7-8 / 12**, money at rest is 0.44-2.29, **every seed finishes segment 3**, and **24 of 26 targets
     are met**;
   - the two misses are the demo-length rows, which the user chose to leave (23 Oct);
   - the agreed economy itself, on today's master: 4 / 8-9 / 12, with only 14-15 of 20 seeds finishing segment 3.

   **The corrections plus the pay ×1.376 hold the agreed economy at least as well as today's numbers do.**
8. **The economy simulator does not run on master.** The cause is L30d's certification gate: a paying job needs an
   airframe with a commercial certificate, the page writes that certificate from the bench, and econ_sim never runs the
   bench. Every career stops at "T5: clients.01 not flown". The study's harness signs each simulated airframe as the
   bench would (every design econ_sim flies is validated) and leaves the tool alone. The lasting fix is a `careerSign`
   call in econ_sim before an accept. **Done since, in its own commit** (`benchSign` in tools/econ_sim.js). On master
   with it, 160 careers on 20 seeds play with no error. The PROPOSED economy reads 4 / 8 / 12 contracts and meets every
   pace, money-at-rest and route target, but **5 seeds of 20 per policy get stuck in segment 1**: the Cub is on the
   story's route, the Rufus (one seat, no baggage) can fly no offer, and the wallet (~6 000) buys nothing. That is a
   finding about the no-grant start, for the economy owner, not a tool fault.
9. **Weights hold.**
   - Engines are within ±12 % of published dry mass (the R-1830 is +12 %); empty weights are within ±16 % on the Cub,
     C172, Jodel, Tiger Moth, RVs and DC-3.
   - The ultralights are 40-70 % heavy: the basic systems tier rides on a 154 kg Chinook.
   - The Caravan-alike is a smaller aeroplane than a 208B.
10. **Age (revision 3, §D): one base, one curve.**
    - **V0 = the ledger × 1.15**, and the price = V0 × f(age), with f(0) = 1 (new) and f = 0.8 × (0.14 + 0.86 ×
      e^(−age / 27.5)) for used. It fits same-type new-against-used pairs within a factor of 1.12.
    - **Today's used band (0.4-0.8) is exactly the curve's first 24 years**, so a first step that draws ages 2-24 changes
      no price band and leaves the agreed economy alone. It adds an age to each listing, shows it through the existing
      weathering, scales the extra kilos and the older panel with age, and sells on the same curve.
    - Engine wear and drag (step 2) come before older planes and the new market.
11. **B-ITES** ("B-ITID" is not on master; A0 identified it as the user's B-ITES on `origin/claude/a0/b-ites-input`).
    - **Build:** 52 900 (66 100 in a short hangar).
    - **Catalogue:** 76 000 (≈ $114k).
    - Against the RVs: inside the used RV-7/-8 band ($130-160k) and below building an RV from the kit ($150-190k).
    - After the corrections it builds at 62 000 and would list used at 35 600-71 300.

---

## A. The three ways to own a plane, and selling one

**The rules.** Today's rules unless marked PROPOSED. L is the ledger, the parts bill.

| route | rule | × L | where |
|---|---|---|---|
| **the maker way** (new plane, your choices, built) | L × the main hangar's labour: 0.8 fitted / 1.0 short | 0.80 / 1.00 | 76_economy `econAirframePrice` |
| **pre-built, used** (certified, bought where it stands) | catalogue (L × 1.15) × condition 0.4-0.8 | 0.46-0.92 | 76_procure `procureUsedListing` |
| the story's occasions (one-time) | catalogue × 0.35 | 0.40 | 79_story `STORY_OCCASIONS` |
| pre-built, NEW (the makers' board) | catalogue L × 1.15 | 1.15 | `procurePrice`: **the user: not for now.** Keep it as the base the used price is read from, and hide the new sale in a career until used planes are degraded |
| **selling** (PROPOSED) | min(0.75 × the listing at its condition, paid) | ≤ 0.69 | a fleet airframe's condition is 0.8, less 0.08 a repair, floor 0.4 (no hours are kept); story airframes sell for 0 |

**What each costs, at the proposed (corrected) ledgers, in credits:**

| plane | build (fitted / short) | used listing | occasion | sell your own build | sell a used one (condition 0.6) |
|---|---|---|---|---|---|
| Cub | 34 300 / 42 900 | 19 700-39 500 | 17 300 | 29 600 | 22 200 |
| Jodel | 33 900 / 42 300 | 19 500-38 900 | 17 000 | 29 200 | 21 900 |
| Birdman | 28 700 / 35 800 | 16 500-33 000 | 14 400 | 24 700 | 18 500 |
| Chinook | 27 600 / 34 600 | 15 900-31 800 | 13 900 | 23 800 | 17 900 |
| metal Cessna (econ-sim's) | 87 800 / 109 800 | 50 500-101 000 | 44 200 | 75 800 | 56 800 |
| Cessna 172 (corrected card) | 83 200 / 103 900 | 47 800-95 600 | 41 800 | 71 700 | 53 800 |
| Cessna on floats | 109 200 / 136 500 | 62 800-125 600 | 54 900 | 94 200 | 70 600 |
| Tiger Moth | 63 600 / 79 500 | 36 600-73 100 | 32 000 | 54 800 | 41 100 |
| B-ITES | 62 000 / 77 500 | 35 600-71 300 | 31 200 | 53 500 | 40 100 |
| DC-3 | 543 300 / 679 100 | 312 400-624 700 | 273 300 | 468 600 | 351 400 |

Today's numbers are the same table ÷ each plane's factor (§5); the Cub, for example, builds at 25 000 / 31 200 today.

**The margins, and why they hold:**
- **Building beats buying used, except for a cheap tired one.** A used plane costs 0.58-1.15× a fitted build. The
  worst used plane is cheaper than building, and the best one costs more than building in a fitted hangar but less
  than in a short one. You pay for the certificate (a used plane arrives certified; a build needs the bench), for having
  it now and where it stands, and for not owning the shop's kits. This matches real resale: 0.5-1.2× the build cost.
- **No loop makes money.**
  - Build in a fitted hangar and sell: −14 % (−31 % from a short hangar).
  - Buy used and sell: −25 %.
  - Buy an occasion and sell: capped at its price.
- **Selling speeds the ladder, but not past its band.** A frugal player who sells the Cub-class plane when buying the
  4-seater gets ~29 600 back, about two contracts of segment-2 pay at the scaled rate. The 4-seater's pace drops from
  7-8 contracts to ~5-6, at the edge of the 6-8 band. This is first-order, not simulated: econ_sim does not model
  selling. If the band matters, a 0.65 spread puts it back at ~6.

---

## B. Through the agreed economy (econ_sim's careers re-played)

`econ_price_run.js` runs econ_sim's own `playCareer` with its PROPOSED config: the table the user approved and
G3359 applied (no grant, T6's fee 20 000, routes 30 a km with 6 trips a day, the shells 3.6 / 5.6 / 8.6 Cubs, the
landmarks 2.5 / 6 / 12 Cubs).
- It covers four policies (frugal, collector, router, competitor) × 20 seeds × 3 runs.
- The price corrections enter as each design's measured factor (§5).
- The twin floatplane has no build file, so it takes the Chinook's factor, as a single-582 ultralight.
- `CONTRACT_DESIGNS` follows, so the Cub reference does too, and with it the shells, landmarks, rungs, kits and
  sign-ons.

| run | Cub-class build (target 3-4) | 4-seater (6-8) | side hangar (8-12) | money at rest seg 1/2/3, median of the 4 policies (0.3-3) | finish segment 3 | targets met |
|---|---|---|---|---|---|---|
| agreed economy, on today's master | 4 | 8-9 | 12 | 0.33-0.94 / 0.49-0.83 / 0.49-0.73 | 14-15 / 20 | 20 / 26 |
| prices corrected, pay held | **5** | **9-10** | **16-16.5** | 0.36-1.17 / 0.48-0.62 / 0.33-0.60 | **0** (collector) - 13 / 20 | 16 / 25 |
| **prices corrected, pay ×1.376** | **4** | **7-8** | **12** | 0.44-2.29 / 0.48-0.87 / 0.49-0.70 | **20 / 20** | **24 / 26** |

The scaled pay, as the third run applies it:

| the absolute money number | now | ×1.376 |
|---|---|---|
| `CONTRACT_PAY.perKm` | 160 | 220 |
| `CONTRACT_PAY.surf` (short / water / snow / altiport) | 1 100 / 800 / 950 / 1 350 | 1 510 / 1 100 / 1 310 / 1 860 |
| `CONTRACT_PAY.baseF` · `.story` | 2.7 · 2.6 | 3.72 · 3.58 |
| the build contracts' authored bases (11 records, e.g. minedock.b2) | 38 000-56 000 | ×1.376 |
| `ROUTES_PAY.perKm` | 30 | 41 |
| `STORY_T6_FEE` | 20 000 | 27 500 |
| `CAREER_GRANT` (the sandbox / reference career only; the story's is 0) | 60 000 | 82 600 |

The cleanest way to write it is one `ECON_BOOK.payScale` that `contractPay`, `routeTerms` and the story fee read,
instead of seven edits.

**Why the corrected run finishes better than today's.** The Cub, and with it the landmarks and shells, rises ×1.376,
but the metal Cessna (×1.17) and the composite Jodel (×1.17) rise less. Segment 2-3 airframes get cheaper relative to
the pay, and the money goes to the keystones. What keeps 5-6 seeds from finishing today is a separate question for the
economy owner; it is the same with or without this study.

---

## C. The market, narrowed (the user's doubt about the Jodel and the Cub)

| aircraft | narrowed used range (USD 2026) | what is in it | sources |
|---|---|---|---|
| J-3 Cub | **$45-65k** airworthy, the same in the US and continental Europe (EUR 47-60k); UK $37-61k; restored or on floats $70-100k | asking prices; a 20-30 % collector premium; about ×2 since 2016 (2016 Vref base retail $23-28k) | [aircraft24](https://euro.aircraft24.com/singleprop/piper/j-3-cub--xi142142.htm), [aeromarkt](https://www.aeromarkt.net/en/Piper-J-3-12162), [planephd](https://planephd.com/marketplace/515/piper-j-3-for-sale), [AOPA 2016](https://www.aopa.org/news-and-media/all-news/2016/march/pilot/briefing_budget), [Flying](https://www.flyingmag.com/?p=162061) |
| Jodel D11 / D112 / D117 / DR1050 | **$20-35k** typical (EUR 12-38k asking; UK GBP 9-24k) | weak resale (European forums); no price index; no factory price found (the D11 family was sold to clubs under a state subsidy) | [aircraft24](https://ie.aircraft24.com/singleprop/jodel/d-11-huetz-u2v--xi180540.htm), [planecheck](https://www.planecheck.com/aspdet.asp?nr=60220), [air-contact](https://www.air-contact.com/annonce-21696-jodel-d-112-a), [afors](https://afors.uk/light-aircraft/for-sale/standardView-65189/jodel-d117a) |
| Cessna 172M/N (1970s) | **$95-150k** (Europe EUR 80-110k; US $120-150k) | +34 % 2019-22, flat 2025-26 | [aircraft24](https://euro.aircraft24.com/singleprop/cessna/172m--xi144381.htm), [Controller blog 2026](https://www.controller.com/blog/sandhills-news/2026/02/used-aircraft-inventory-continues-slide-piston-singles-and-helicopters-leading-declines) |
| Chinook Plus 2 | **$10-15k** used; ~$20-32k new flying with a 582 | | [upac.ca](https://upac.ca/classifieds/?p=10927), [Plane & Pilot](https://planeandpilotmag.com/canadas-chinook-relocated-to-texas-and-upgraded-now-made-in-the-usa/) |
| Tiger Moth | $80-170k | not re-checked | §2 |

**New prices.**
- A J-3 cost about one year's average US wage: $1 095-1 300 in 1937-39 (wage $1 282) and $2 195 in 1946 (wage $2 383).
- A 1956 Cessna 172 cost $8 295-8 750, about 2.5 years' wages, or about 2.7 Cubs once wage growth is allowed for.
- Today a used 172 is about 2-2.5 used Cubs, so that ratio has held for 70 years.
- The game's builds put the metal Cessna at 3.0 Cubs today (93 694 / 31 203) and 2.6 after the corrections
  (109 807 / 42 935). The corrections move it toward the historical ratio.

**The dealer spread:**
- Bluebook wholesale against retail: ~22 % on a 172M;
- an SR22: ~18 %;
- trade-in haircuts: 15-25 %;
- a broker: 1-5 %;
- a finished homebuilt resells at about its parts cost or less, 50-100 % of what the builder spent
  ([Aviation Consumer](https://www.aviationconsumer.com/?p=7473), [EuroGA](https://euroga.org/forums/is-a-finished-homebuilt-worth-more-than-the-cost-of-the-parts/8612), [Vref](https://vref.com/?p=46531)).
- The proposed 0.75 sits at the top of the spread, on purpose, for the economy's margins.

**What this means for the game:** price the used market from the game's own build cost and a condition, not from
listings. The listings' level drifts by ±30-100 % in a decade, and their cross-type ratios carry fashions (the Cub's
premium) that a game's progression should not inherit.

---

## D. One base, one age curve (revision 3: the user, 4 Nov)

*"Ideally we have a base calculation, and factors on prices depending on plane age. That could reconcile new and old:
just degrade the multiplier as a function of age. But we'd need to degrade performance too for it to make sense.
Let's have an easy first step."* `age_curve.js` fits the curve and writes `age_curve.json`.

**The base and the curve:**
- **V0 = the new value = ledger × 1.15** (the catalogue: what a maker would charge new).
- **f(age) = 1 at age 0**; used, **f = 0.8 × (0.14 + 0.86 × e^(−age / 27.5))**:
  - 0.8 is the first-resale step (a plane that has left the maker is a used plane), the middle of the real 15-25 %
    dealer spread, held fixed;
  - the rest is fitted on the same-type new-against-used pairs, in log least squares, scattered by a factor of 1.12.

| pair (USD, 2025-26 asking) | age | real used ÷ new | the curve |
|---|---|---|---|
| C172S NXi (2016+) vs a new 172S | 7.5 | 0.57 | 0.64 |
| C172S (2000s) vs a new 172S | 20 | 0.53 | 0.44 |
| C172M/N (1970s) vs a new 172S | 50 | 0.22 | 0.22 |
| 208B (2000s) vs a new 208B EX | 22 | 0.37 | 0.42 |

**Left out, and why:**
- **The 208B EX of 2019-22**, listed above its new price: a post-2020 supply squeeze, not age.
- **The J-3 against a new Cub-class:** not the same aeroplane.
- Four pairs set the floor (0.11 of new at great age) only loosely. Collector types (the J-3, the Tiger Moth) sit well
  above it, so for anything older than ~30 years the game may want a higher floor, e.g. 0.2.

**Every price is the same formula:**
- **build** (the maker way) = ledger × labour, 0.8 / 1.0: unchanged;
- **buy used** = V0 × f(age) × (1 − the listing's own deductions: a repair 0.08, an older panel 0.03, the extra kilos
  0.04 × kg / 15);
- **sell** = min(0.75 × the same value at the airframe's age, what you paid);
- **buy new**, later = V0 × f(0) = V0. **This reconciles new and old with one number**: a new plane is a used one of
  age 0.

**The key measurement: today's used band is already this curve between 0 and 24 years.**
- f is 0.8 at age 0+, 0.6 at 9.5 years, and 0.4 at 24 years.
- The listing's 0.4-0.8 is the curve's first 24 years.
- So the first step can introduce age **without moving one price band, which leaves the agreed economy as §B
  measured it.**

**The corrected official planes by age** (V0 × f(age), credits; build in a fitted hangar for reference):

| plane | build | new (0) | 2 y | 5 y | 10 y | 20 y | 30 y | 40 y | 60 y |
|---|---|---|---|---|---|---|---|---|---|
| Cub | 34 300 | 49 400 | 37 100 | 33 800 | 29 100 | 21 900 | 16 900 | 13 500 | 9 400 |
| Jodel | 33 900 | 48 700 | 36 600 | 33 400 | 28 700 | 21 600 | 16 700 | 13 300 | 9 200 |
| Birdman | 28 700 | 41 200 | 31 000 | 28 200 | 24 300 | 18 300 | 14 100 | 11 200 | 7 800 |
| Chinook | 27 600 | 39 700 | 29 900 | 27 300 | 23 500 | 17 700 | 13 600 | 10 800 | 7 500 |
| metal Cessna | 87 800 | 126 300 | 94 900 | 86 600 | 74 500 | 56 100 | 43 300 | 34 400 | 23 900 |
| Cessna on floats | 109 200 | 157 000 | 118 000 | 107 600 | 92 700 | 69 800 | 53 900 | 42 800 | 29 800 |
| Tiger Moth | 63 600 | 91 400 | 68 700 | 62 700 | 54 000 | 40 600 | 31 400 | 24 900 | 17 300 |

Read the rows this way:
- A plane under ~5 years costs more than building it yourself: you pay for the certificate and for having it now.
- From ~5 years on, buying used is the cheaper way in.
- A new one (age 0) is 1.44× a fitted build. That is the maker's margin over doing it yourself, and the reason the new
  market waits until age also costs performance.

### The easy first step: price and look, no new physics

| # | what | where | how |
|---|---|---|---|
| A1 | a listing draws an **age**, 2-24 years | 76_procure `procureUsedListing` | the price's hours term becomes f(age); `hours` stays as text, drawn ~50-120 h a year since the last overhaul. The band stays 0.4-0.8 of V0, so the agreed economy is untouched |
| A2 | **the age shows** | the listing card ("built 2009 · 1 400 h"), and the drawn aeroplane | the weathering the game already has, `finish.weather.age` = age / 40 (G2230's visual macro: no physics) |
| A3 | **the real spec rows follow the age** | the listing's existing rows | extra empty mass 0.4 kg a year (cap 15, today a random 0-15); the older panel with chance age / 30 (today 0.6 flat) |
| A4 | **selling** reads the same curve | a new door in 76_economy | min(0.75 × V0 × f(age) × deductions, `paid`). An own build, once flown, is a used plane of age ~0 (f = 0.8), so it sells at 0.75 × 1.15 × 0.8 = 0.69 × the ledger, as in §A |
| A5 | the occasions | 79_story | unchanged (0.35 × V0: a gift of the story, below the curve on purpose) |
| A6 | buying new stays hidden in a career | the makers' board | its price is already V0 = f(0), so opening it later is a switch, not a re-price |

### Step 2, later: age costs performance, then the new market opens

| # | what | physics | why it makes the price make sense |
|---|---|---|---|
| B1 | **engine wear**: power −1 % per 400 h since overhaul, down to −6 %; an overhaul resets it (a priced repair) | one spec field (`engines[i].wear`) read where the powerplant resolves; a PHYSICS_V step | a tired engine climbs worse; a new one is worth its price |
| B2 | **airframe drag** +2-5 % with age (old fabric, paint layers, rigging) | the body's `cdWet` × (1 + k·age) | an old plane is slower |
| B3 | ages up to 60 years (the vintage plateau, floor ~0.2) | none beyond B1-B2 | cheap old planes become a real choice, slower and heavier, not just cheaper |
| B4 | **the new market opens** at f(0) = 1 | none | it now buys measurable performance |

Before B3 widens the band, re-play econ_sim with the used market in it (§B's harness can take it): planes under 0.4 ×
V0 make the entry cheaper, which the agreed economy has not seen.

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
| Cub, a slightly upgraded J-3 (cub_…_corrected) | A-65 65 hp | 354 | 31 203 | 25 000 | 35 900 | $35-60k (est.) · **1.83** | $80-140k (est.) · 3.39 | used airworthy J-3 $45-65k · **1.51**; **new** Cub-class (AL3, Carbon Cub UL) $250-295k · 7.56 |
| Cessna 172 (cessna172_…_corrected) | custom 159 hp | 637 | 88 486 | 70 800 | 107 900 | - | - | **new** 172S $499-580k · **4.99**; used 172M/N $95-150k · 1.96 (against the used band) |
| Jodel, as a D115 (jodel_…_corrected) | A-65 65 hp | 341 | 34 363 | 27 500 | 39 500 | $25-45k (est.) · **1.22** | - | used D11/D112/D117 $20-35k · **0.67** |
| Birdman (review/birdman.json) | Rotax 582 | 263 | 28 118 | 22 500 | 32 300 | - | (as the Chinook) | (as the Chinook) |
| Chinook (Birdman Chinook) | Rotax 582 | 219 | 26 082 | 20 900 | 30 000 | - | 2009 kit $20-36k · 1.03 | used Plus 2 $10-15k · **0.41** |
| Tiger Moth (tigermoth_2026-10) | Gipsy Major 130 hp | 557 | 56 784 | 45 400 | 65 300 | - | - | used / restored $80-170k · **1.79** |
| **B-ITES** (the user's, RV range) | IO-360 180 hp | 467 | 66 128 | 52 900 | 76 000 | - | RV-7/-8 kit to fly $150-190k · **2.55** | used RV-7A / RV-8 $130-160k · **1.90** |
| RV-alike (archetype) | IO-360 180 hp | 469 | 72 402 | 57 900 | 83 300 | - | $150-190k · 2.33 | used $130-160k · 1.73 |
| DC-3 (dc3_2026-10) | 2 × R-1830 | 6 441 | 541 782 | 433 400 | 623 000 | - | - | used airworthy $230-600k · **0.60** |
| Caravan-alike (archetype) | PT6A-114A | 873 | 332 513 | 266 000 | 382 400 | - | - | **new** 208B EX $2.6-2.9M · **7.18**; used 208B $0.7-1.5M · 4.7 |

**Reading the table.**
- **Plans (1.2-1.8):** the ledger is a plans-built parts bill, as §1 says.
- **Kit (2.3-3.4):** a kit carries the factory's jigs, CNC and some of its labour, which the ledger does not.
- **Used (0.4-1.9):** the market pays nothing for labour, vintage types sell below their parts, and the level is fashion (§C).
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
| 2 | Birdman 32 300 | **Jodel $26k** |
| 3 | Cub 35 900 | **Cub $54k** |
| 4 | **Jodel 39 500** | Tiger Moth $117k |
| 5 | Tiger Moth 65 300 | used C172 $119k ≈ RV $144k |
| 6 | B-ITES 76 000 · RV-alike 83 300 | (B-ITES in the RV band) |
| 7 | C172 107 900 | **DC-3 (used) $371k** |
| 8 | **Caravan-alike 382 400** | new C172 $538k |
| 9 | **DC-3 623 000** | **Grand Caravan (new) $2.75M; used ~$1.0M** |

The two inversions are bold.
- **The Jodel and the Cub** is market fashion, not a pricing error (§C and conclusion 4): the Cub's collector premium,
  the Jodel's weak resale, and no Jodel factory price to compare against.
- **The DC-3 above the Caravan class** is the tank (P17) and a smaller Caravan card. The PT6A itself is priced in
  line (1.6), and a Grand Caravan, new or used, is a certified-factory product the maker way does not try to be.

---

## 3. The conversion

| what | fit (USD per credit) | scatter (rms factor) | rows |
|---|---|---|---|
| instruments, radios, electrics (list prices) | 1.11 | 1.42 | 18 |
| engines (vs overhauled / exchange) | 1.48 | 1.20 | 16 |
| every component row with a game price | 1.71 | 2.08 | 49 |
| the 38 rows that are not outliers (no props, floats, paint, interior, covering, tailwheel, harness) | **1.30** | **1.40** | 38 |
| whole planes, the buyer's route (factory or used) | 1.55 | 2.45 | 9 |

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
| P18 | *(later, with degraded used planes)* a NEW market | the board's 1.15 | hidden in a career for now; when it opens, a certified-factory margin of 2.5-4 is the real one | the user: used only for now. At $1.5 a new 172S costs 3.3× the catalogue, and the career could not carry that before used planes are degraded |
| P19 | **the used price: keep** (`procureUsedListing`) | catalogue × 0.4-0.8 = L × 0.46-0.92 | **unchanged**, still read from the ledger | it brackets real resale at 0.5-1.2× build cost (§A); it moves with every correction |
| P20 | **selling (new)** | none (GAME §12.3 planned 0.5-0.8 × hull) | **min(0.75 × the listing at its condition, `paid`)**; condition 0.8 − 0.08 a repair (floor 0.4); story airframes 0 | no loop makes money (§A); 0.75 is the top of the real 15-25 % spread; 0.65 if the 4-seater's pace must stay at 6+ |
| P21 | **the absolute money ×1.376** (one `ECON_BOOK.payScale`) | `CONTRACT_PAY` perKm 160, surf, baseF 2.7, story 2.6; build bases; `ROUTES_PAY.perKm` 30; `STORY_T6_FEE` 20 000; `CAREER_GRANT` 60 000 | ×1.376 (§B's table) | with P1-P15, econ_sim meets 24 / 26 targets and finishes every seed (§B); without it, 16 / 25 |
| P22 | **econ_sim's certificate** (tools/econ_sim.js) | never signs an airframe: fails on master since L30d | a `careerSign` (safe + comm pass) where it materialises a validated design | **done** (`benchSign`, its own commit); the harness's shim is now redundant and harmless |

**What P1-P15 do to the planes** (ledger now → proposed; P16-P18 not included):

| plane | ledger now | proposed | × | catalogue | ratio (factory/used) now → proposed (1.5 = right) |
|---|---|---|---|---|---|
| Cub | 31 203 | 42 930 | 1.38 | 49 400 | 1.51 → **1.10** (plans 1.83 → 1.34) |
| Cessna 172 | 88 486 | 103 942 | 1.17 | 119 500 | new 4.99 → 4.50 · used 1.96 → 1.77 |
| Jodel | 34 363 | 42 334 | 1.23 | 48 700 | 0.67 → 0.54 (plans 1.22 → 0.99) |
| Birdman | 28 118 | 35 820 | 1.27 | 41 200 | - |
| Chinook | 26 082 | 34 561 | 1.33 | 39 700 | 0.41 → 0.31 |
| Tiger Moth | 56 784 | 79 489 | 1.40 | 91 400 | 1.79 → **1.28** |
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

The ranking keeps the Jodel above the Cub, and that is accepted (§C): the used market's ratio between them is fashion,
and at build cost the two are within what the estimates can tell apart.

**What it does to the career:** measured, not estimated, in §B. Everything ECON_BOOK prices in Cubs moves with the
Cub's ledger (the shells, the kits, the sign-ons, the landmarks, the rungs, the competitions). The absolute numbers
need P21. With P1-P15 and P21, econ_sim's careers hold the agreed paces (4 / 7-8 / 12) and finish every seed.

---

## 6. Method and files

- `futureDesigns/price-study/price_study.js` (run from `flyDiy/`: `node futureDesigns/price-study/price_study.js`, ~4 min):
  - loads `tools/flight_core.js`;
  - reads each build through `genMigrateSpec → resolveSpec → buildGen → genShakedown` (the ledger by section);
  - bakes the RV-alike and Caravan-alike through `_cage_design.js designBake` with GATE ARCHETYPES' own shim (read
    from `_arch_check.js`);
  - reads B-ITES from `origin/claude/a0/b-ites-input` with `git show` when it is not in the tree;
  - prices each plane with `econAirframePrice`, `procurePrice` and `econCatalogPrice`, and the three routes (§A);
  - fits the rate (log least squares);
  - runs the proposal on a patched copy and restores it.
- `futureDesigns/price-study/price_study_data.json`:
  - every plane's ledger sections, categories (engine, prop, structure, gear, systems, seats, outfit, tank, paint) and prices;
  - the game's component catalogue;
  - the real benchmark rows with their notes, the ratios, the fits and the proposal's measured planes.
- `futureDesigns/price-study/age_curve.js` (seconds; after price_study.js): fits the age curve, writes `age_curve.json` (§D).
- `futureDesigns/price-study/econ_price_run.js` (run after price_study.js: `node futureDesigns/price-study/econ_price_run.js
  --seeds=20`, ~9 min):
  - econ_sim's own `measureDesigns`, `playCareer`, `aggregate` and `judge`, required as a module;
  - the certificate shim (conclusion 8);
  - the three runs of §B;
  - writes `econ_price_results.json`;
  - restores every table it patched.
- The Cub's tank is under review (44 vs 28 L). At 28 L its tank line falls from 918 to ~640: noise for this study.
- Nothing built was edited; no gate was run or changed.
