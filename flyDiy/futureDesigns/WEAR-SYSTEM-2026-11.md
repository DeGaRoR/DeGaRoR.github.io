# WEAR-SYSTEM - age, wear and price as one model (study, 2026-11-05, WEAR-TAB for A0; no game code)

The user, 5 Nov: "Study a system tying them all together, as well as the price. We could get a master age slider for
example. And something about the rate of degradation, from either rough operations or poor maintenance. 2 parameters,
possibly lockable, and the ability to restore condition for a price. The other parameter will ultimately be hidden".

Conventions: 1 credit = 1 USD 2025-26, the ledger a parts bill (futureDesigns/PRICE-STUDY-2026-11.md). The game's rule:
real physics, what you see is what flies. A penalty below is real only where it names a physical cause; anything else is
marked **judgement**.

## 1. What exists today (read from the code)

| system | where | what it is | moves physics? | moves price? |
|---|---|---|---|---|
| the look of wear: 4 macros `age`, `flight`, `bush`, `rain` (0-1) | tools/_cage_ui.js `WEAR`; saved as `finish.weather`; prefs `flydiy.aeroSections.wear` | a uniform on the skin shader (chalk, chips, rust, soot, mud, streaks) | no (finish is cosmetic, outside the certificate) | no |
| per-surface wear rate (0.05-4, absent 1) | `secWear`; `finish.sections[nm].wearM`; prefs `.wearM` | how much of the macros each section shows | no | no |
| outside wear | 71_ `PREM_WEAR` {hours 10, age 0.6, rain 0.5}, `playerWearNow` / `playerWearSpec` | parked outside, the macros rise to full in ~10 h of the clock; `playerWearReset` on a repair or indoors | no | no |
| physical age | 60_ `GEN_AGING`, `spec.aging {years, engineHours}` | power x(1 - h/40 000) to -6 %; drag (body CdA, every polar's Cd0) x(1 + 0.001 y) to +5 % | **yes** | no (the ledger is the engine as rated) |
| the used price | 76_ `econAgeFactor` = 0.14 + 0.86 e^(-A/27.5); `econZeroValue` = ledger x 0.92; `econUsedValue` x (1 - deductions); `econSaleValue` ded = 0.08 a repair + 0.1 if damaged, cap 0.5, then min(value, paid) | the market | - | **yes** |
| a listing's condition | 76_procure `PROCURE_COND` [0.2, 0.8], from the age curve less the old deductions | drives the listing's price | via `aging` on its spec | yes |
| engine hours since overhaul | a listing's `hours` = (A x 50-120 h/y) mod 2 000 + 150 | written into `aging.engineHours` | yes (power) | only through the age |
| damage, scars, repairs | `fleet[slot].damage` (DMG* gates: members set, skin torn, gear, prop strike `GEN_DRIVE` logged/inspect/overhaul) | physical while it stands; `econRepair` clears it **for free** (`econRepairCost` returns 0) | yes until repaired | `repairs` count, -8 % each on sale |
| hard landings | the acceptance recorder's sink; the pilots' `pilotsLandings` counts landings | skill growth only | no | no |
| tyres | DMGTYRE is the lateral law (slip / Coulomb); `whTread` / `whSlick` rows are the pattern | no tread wear exists | - | - |

**Disconnected today:**
1. The look and the physics are two unrelated dials. A listing sets both from its age (procureUsedSpec: `aging` + `playerWearSpec(min(1, A/40))`), the garage sets them separately (WEAR tab, expert rows), and a career's own airframe never ages: no clock writes `aging` (its years stay at what it was bought at; an own build stays new forever).
2. The price reads the age, not the condition: a repaint, an overhaul or a recover changes nothing the market sees (it cannot - none exists).
3. `aging` hashes with the certificate's STRUCTURE group (66b `certMajorOf`: an unlisted block counts as structure). Moving the age withdraws a certificate; an overhaul would too.
4. A used airframe's certificate numbers are the model's AS NEW (`procureUsedCert` adds only the kilos), while its fingerprint is the aged spec's: the plaque says a climb the aeroplane does not have.
5. Repairs are free and the outside wear clears with them, so the look of an old plane resets on any repair.
6. Hard landings, grass strips and nights outside are measured or known, and feed nothing but the look (outside) and pilot skill.

## 2. One master: the AGE

The master is the airframe's age `A` in years (the user's "master age slider"). It is a REAL quantity: a log-book's
years since manufacture or since the last restoration (`A_eff`, section 4). Everything else is a curve of it, scaled
by the two rates (section 3). At the reference rates (R = M = 0.5, "a club aeroplane"):

| A (y) | look `age` (= 0.6 x min(1, A/40), as procureUsedSpec) | drag (+0.1 %/y, cap 5 %) | engine h since overhaul (club 85 h/y, TBO 2 000, sawtooth) | power | price x (econAgeFactor) |
|---|---|---|---|---|---|
| 0 | 0.00 | +0.0 % | 0 | 100 % | 1.000 (zero days; new = x1.25) |
| 2 | 0.03 | +0.2 % | 300 | 99.3 % | 0.940 |
| 5 | 0.07 | +0.5 % | 600 | 98.5 % | 0.857 |
| 10 | 0.15 | +1.0 % | 1 000 | 97.5 % | 0.738 |
| 20 | 0.30 | +2.0 % | 1 850 | 95.4 % | 0.556 |
| 30 | 0.45 | +3.0 % | 700 (overhauled once) | 98.3 % | 0.429 |
| 40 | 0.60 | +4.0 % | 1 550 | 96.1 % | 0.341 |
| 60 | 0.60 | +5.0 % (cap) | 1 250 | 96.9 % | 0.237 |

- **The engine is not the age.** Its hours since overhaul are a sawtooth, reset at each overhaul (real: TBO ~2 000 h on
  a Continental / Lycoming). So the master drives the hours only as a default history (`A x use mod TBO`); the moment the
  player overhauls, the engine has its own counter. In the UI the engine's hours are a read-out under the master, not a
  second master.
- **Mass.** Real: old aeroplanes gain weight (paint layers, repairs, wiring) - the listings already add 0.4 kg a year to
  15 kg (`ECON_BOOK.age.kgPerYear`). Keep it on the master: it is physical (cargo kg aboard every flight).
- **The look.** `age` follows the curve above; `rain` and `flight` / `bush` follow the rates (section 3), and the
  per-surface wear rates stay what they are (where on the aeroplane it shows).
- **Sources and judgement.** Price curve: fitted on same-type new/used pairs (price-study/age_curve.js, rms x1.12).
  Power: -1 % per 400 h is GEN_AGING's (compression loss to ~5 % at TBO: **judgement** from overhaul practice, no
  dyno source in the study). Drag +0.1 %/y: **judgement** (old fabric, paint layers, rigging); the study's B2 said 2-5 %.

## 3. Two rates: ROUGH OPERATIONS (R) and POOR MAINTENANCE (M), 0-1

| | ROUGH OPERATIONS R | POOR MAINTENANCE M |
|---|---|---|
| what it is | how hard the aeroplane is used: strips, landings, loads | how little is spent keeping it: inspections, overhauls, hangar |
| drives (physical) | gear and structure: the damage model's own events (hard landings set members; a scar is real). Tyres: a tread counter (new: none exists - garage gap, below). The prop: stone nicks (`GEN_DRIVE` brush band already). | the engine: hours past TBO keep losing power (-1 %/400 h continues past 2 000 h instead of an overhaul; cap 6 % -> 10 % past TBO, **judgement**). Corrosion: the drag years run x(0.5 + M). Mass: +kg a year x(0.5 + M). |
| drives (look) | `bush` (grass / dirt landings), `flight` (soot, bugs, belly dirt: hours since a wash) | `age` x(0.5 + M), `rain` (nights outside, as PREM_WEAR today) |
| how flying fills it | each landing's measured sink (the acceptance recorder's) and surface (stripSurface): R = the running mean of (sink / 2 m/s, a grass landing 1.5x, a dirt 2x), over the last 50 landings. | the clock outside (PREM_WEAR's outSince), hours flown past TBO, years since the last inspection (an "annual" skipped). |
| what it never does | invent a performance penalty: rough ops act through the damage model, which is already physics | touch anything rough ops owns |

**Lockable.** A lock holds a rate at its slider and flying stops moving it.
- SANDBOX: both rates are dials, LOCKED by default (an authored history: "a 30-year-old bush plane, well kept"); unlocked,
  flying fills them as in a career. Free.
- CAREER: the rates are what the player did (unlocked, read-only). A lock on M is a maintenance plan (the annual done,
  overhaul on TBO): it keeps M at 0 and costs money. That is a RUNNING COST, which the game has none of today (G-COST: "no
  running costs" - the user's ruling of PREM-S2). Hence question Q3. A lock on R has no career meaning (you cannot buy
  gentler landings) - it stays a sandbox control.

## 4. Restore, for a price

Each step resets part of the state. Prices are the parts bill (labour free), as every ledger row; the real shop price is
given beside it so the user can choose otherwise.

| step | resets | parts bill (game rule) | real, with source | the value it gives back |
|---|---|---|---|---|
| wash and polish | `flight`, `bush` looks | ~0 (**judgement**: soap) | - | none |
| **repaint** | the `age` look on painted surfaces, the paint's own drag share (none modelled: drag stays) | `paintM2` 40 x painted area (Cub ~2 000) | C172 professional 7-15k ([Epic](https://epicflightacademy.com/cost-of-a-cessna-172/), PRICE-STUDY §B) | **a repaint is not a restoration**: the age, the engine and the price curve do not move. Only the look (and the T2 checklist's `paint`, which reads `spec.paint`, as today) |
| recover fabric (fabric aeroplanes) | the airframe's drag years to 0; the `age` look; the corrosion found (M's mass back to the build's) | `coverM2` 75 x cloth + paint (Cub ~51 m²: ~3 800 + 2 000) | materials 3-6k a Cub ([Spruce CA Poly-Fiber kit](https://www.aircraftspruce.ca/catalog/cspages/polyfiberkit.php)); a professional recover 20-40k (supercub.org, PRICE-STUDY §B) | `A_eff` for the airframe = the years since recover (the market: "restored ... $70-100k" vs airworthy $45-65k for a J-3, PRICE-STUDY §C - x1.5) |
| **overhaul the engine** | engine hours to 0 (power to rated) | the engine row x `ovhK` 0.85 (**judgement**, anchored: A-65 shop overhaul ~9.5k against its 11k exchange row, [Aviation Consumer](https://aviationconsumer.com/?p=9272)) | O-200 rebuilt 47.5k ([Air Power](https://www.airpowerinc.com/0200a48bn)) | the engine-time deduction goes (the real market's: price -= overhaul cost x h/TBO, the way Vref / Bluebook adjust for engine time) |
| rebuild (restoration) | all of the above + the structure's corrosion and scars; `A_eff` = 0 | recover + overhaul + paint + the structure section of the ledger x 0.3 (**judgement**, no source here) | J-3 restorations commonly sell at the restored band above; a shop rebuild is not in the study's sources - search before landing | `A_eff` = 0: the age curve restarts (the log-book's age stays as words: "built 1946, restored 2026") |

**The value, joined:** used = zero x econAgeFactor(A_eff) x (1 - deductions) - engine overhaul price x (h / TBO - 0.5)
(mid-time is the market's neutral; a fresh overhaul sells above, a run-out below). One formula for a listing, a sale and
a delivery; the deductions as today.

**The test case: the tutorial's Client Cub** (79_story `storyClientSpec`: bare paint, no flaps, minimal panel).
- Its arrival would carry `aging` (old, beaten: A 35, R 0.8, M 0.8, 1 900 h): drag +3.5 %, power -4.8 %, the look
  `age` 0.5+, `bush` high.
- T2's checklist reads `paint.job` against the arrival (STORY_CHECKS.paint) and nothing about wear: a repaint ticks
  `paint`, and must not be confused with a restoration. It still works unchanged; nothing here writes `paint`.
- The T2 budget (`storyCostCap`, 57 300 after the scale) has room for a repaint (~2 000) but not an overhaul (O-200 x
  0.85 ~ 36 500 on top of the 53 939 finish bill): good - an engine upgrade on the checklist IS the overhaul's story.
- The wear tab stays SHUT at T0 (the story's finish lock, below); open at T2.

## 5. What the player sees

```
 STRUCTURE | FINISH | WEAR
 ───────────────────────────────────────────
 age            ●────────────── 35 y   [built 1991]
 rough use      ●───────── 0.8   🔒
 upkeep         ●───────── 0.2   🔒      (poor maintenance, shown the other way round)
   flies on 95 % power, +3.5 % drag, +14 kg  ·  worth 41 % of new
 ─ restore ─────────────────────────────────
 [ wash ]  [ repaint 2 000 ]  [ recover 5 800 ]  [ overhaul 36 500 ]  [ rebuild … ]
 ─ expert ▸ ────────────────────────────────  (today's rows: the four looks, airframe years,
                                                engine hours, each surface's wear rate)
```

Today (WEAR-TAB, landed) only the expert block exists. The masters come in front; the expert rows become what the
masters write (each a curve's output, overridable in the sandbox, hidden "ultimately").

## 6. Costs

- **Per frame: none.** The look is a uniform (already), the physics is two factors in resolveSpec (already). A rate
  filled by flying is a write at a flight's stop (careerOnStop), not per frame. If R reads every landing's sink it rides
  the recorder that already runs.
- **Save format:** `spec.aging` grows to `{ years, engineHours, R, M, locks, restored: { airframe, engine, paint } }` -
  absent = new, as today. The career's airframe row gains `bornAt` (clock) so years advance with the career's clock.
  No migration: an old file has no `aging` and stays new.
- **Certificates under ageing:** today `aging` hashes as STRUCTURE (an age or an overhaul withdraws). Real world: age
  does not void a type's certificate; the annual keeps the airworthiness certificate. Recommend: `aging` joins the
  MINOR blocks (66b `CERT_MINOR_BLOCKS`, never withdraws) and the plaque shows the as-certified numbers with the aged
  ones beside ("climb 2.97 certified, 2.73 today"); the contract checks read the TODAY numbers (what flies). A one-line
  rule change, but it moves every used airframe's fingerprint (they carry `aging` now): a re-stamp at load, as the dash
  switch did (G3451). Q2.
- **The economy:** the rates move money once restores cost money and the airframe ages on the clock. Not run here (no
  rate exists to simulate); `node tools/econ_sim.js --seeds=20` is owed at step 4 below, against PRICE-CAL.2's agreed
  pace (3 / 6 / 11).

## 7. Landing order (small steps)

1. **(landed)** WEAR tab, the existing rows moved, physical sliders under expert, career read-only, shut at T0.
2. `aging` out of the certificate (MINOR), the plaque's "today" numbers, the used listing's certificate re-measured on
   its aged spec (fixes disconnect 4).
3. The master age row: drives the look `age`, the drag years, the mass, the default engine hours; the expert rows show
   its outputs. Sandbox only. Gates: def bits at A = 0, the curve table above.
4. The career's clock ages its airframes (`bornAt`); the sale and the listing read `A_eff` and the engine-time term.
   econ_sim.
5. Restore buttons (repaint, overhaul first - both are single resets with a sourced price), then recover, then rebuild.
6. The two rates, filled by flying (R from the recorder's sink and the strip surface; M from the outside clock and TBO).
   Locks in the sandbox.
7. Tyre tread (a garage gap: no tread state exists) - only with a grip law that reads it.

## 8. Questions for the user (each with a recommendation)

1. **Do your own airframes age on the career's clock?** Recommend YES (a year a real-time of play ~ 1 game day? - no:
   one year per 100 h flown or per in-game year, whichever first). Without it only bought planes are ever old.
2. **Should age withdraw a certificate?** Recommend NO: age is condition, not design - `aging` becomes a minor block,
   the plaque shows certified and today's numbers, and the contracts read today's.
3. **Maintenance as a running cost?** You ruled "no running costs". Recommend keeping that: poor maintenance is not a
   bill you pay monthly but what you SKIP - its price comes due as an overhaul / recover you buy when you choose. The
   career lock on M then does not exist; M is just your history.
4. **Restores at parts price or shop price?** The ledger is a parts bill (labour free) - an overhaul at 0.85 of the
   engine row is consistent; a shop repaint at 7-15k is not. Recommend PARTS, as everything else, with the shop price
   in the button's line.
5. **Rough operations' physics only through the damage model?** Recommend YES: hard landings already break members; R
   adds no invented penalty, only the look (`bush`, `flight`) and, later, tread. If you want R to cost money, it is the
   repairs (free today, `econRepairCost` 0) that should get their price first.

## 9. The user's answers (5 Nov) and what landed (WEAR-PRICE)

1. **Own planes age on the career's clock - yes; and when building you set the plane's age.** The career's airframe
   row carries `aging` { years0, engH0, at, flownS, engAt }: years = years0 + max(calendar years of the clock, hours
   flown / 100); engine hours = engH0 + hours flown since the last overhaul (76_economy `econAgingNow`). A used
   purchase starts at its listing's age and hours; a build at what the WEAR tab set when its first save materialises
   it. A career slot loads at its age now (garage.js loadSlot). On a career AIRFRAME the sliders are read-only (its
   history); on a build not yet an airframe they are free.
2. **Age withdraws no certificate.** `aging` is the CONDITION (66b `CERT_CONDITION`), outside the hash; the bench's
   strip drops it. The used airframes signed while it hashed are re-signed on their next save (76_procure M4).
3. **No running costs.** Nothing is billed for time passing; the age costs power, drag and value, and the refreshes
   buy them back.
4. **Parts price.** Every bill below is a ledger row or a powerplant / prop row.
5. **Rough use through the damage model only; money on the repair and the refresh tasks, breakage included.**
   - THE REPAIR AT THE STOP (`econRepairBill`, app.js playerFlightEnd): each damage group parted bills its ledger
     section shared by that section's groups (a Cub's wing root: half the wings); a break-up the fuselage, a crash with
     nothing parted a quarter of it (judgement); an engine mount a tenth of the engine row (judgement); a strike's
     teardown 0.1 of the engine row (judgement), an overhaul-band overspeed or an internal finding the overhaul; a bent
     or worse prop a new prop. Crashed or landed bent. Free during the tutorial (T0-T6, as the sale), a free record in
     the sandbox. The crash's reset to the departure stands (G2705).
   - THE REFRESHES (the WEAR tab's buttons on a career airframe): REPAINT = the ledger's paint line (the look's four
     macros to 0 and the outside wear reset; the age, the engine and the price curve unmoved); OVERHAUL = the engine
     rows x 0.85 (the engine's hours to 0). On the stock Cub: repaint 5 642, overhaul 9 350 (the A-65's shop overhaul
     ~9.5k), a crash with a wing root, a gear leg and a bent prop 8 315.

Still owed (§7): recover and rebuild; the value reading `A_eff` and the engine-time term; the two rates filled by
flying; tyre tread; the Client Cub arriving old.

## 10. Broken and grounded, recover and rebuild, the upkeep authored (5 Nov, the user's follow-ups)

- "We ruled that we were not carrying the visual damage into the shed ... since planes can really explode. So we should
  probably simply have the plane model, maybe greyed out and listed as broken and grounded, and an option in the new tab
  allows paying for repair. The option is free in sandbox mode": the flight's end no longer charges. What it broke
  (`econRepairBill`) is left on the fleet row as dm10's damage record: the roll-out and the fly-from-storage door
  refuse it, the bench greys its certificate (R5), the rack greys its row "broken, grounded", and the WEAR tab shows
  what broke with its Repair - the bill in a career, free in the sandbox. The shed stands the whole model. The tutorial
  records nothing (as before). NOT DONE: the parked 3D model greyed (the rack row is).
- "the idea with the rate selector is rather to author second hand planes and set this myself, then publish and
  locked in career": the upkeep is set on the WEAR tab outside a career (spec.aging.care), carried by the published
  build, and read-only in a career; no door changes it there.
- RECOVER (a fabric aeroplane: the cloth's materials coverM2 x its area + its paint; the condition years to 0) and
  REBUILD (recover or repaint + overhaul + 0.3 of the structure's ledger, judgement; years and hours to 0) beside
  repaint and overhaul, priced off 61_'s new `parts.cover` { paintA, clothA }. No refresh while broken. The sale stays
  capped at what was paid, so a recover-and-sell makes no money.
