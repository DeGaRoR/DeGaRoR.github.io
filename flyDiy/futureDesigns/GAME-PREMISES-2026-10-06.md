# GAME-PREMISES — hangars you hold at bases, aeroplanes that stand somewhere, and the money between them
### (2026-10-06, G2095, cloud; the design of the next big release + its first slice, landed with this document)

**The ask** (the user's roadmap, 1-2 Oct, relayed by A0): after the release trains, the next big release is
*"the game premises"*: **hangar management, unique hangars blending in and out** of the world, with **the three
garage interior presets as the spec** (the `field`, `club` and `works` shells, `26_hangar_fit.js` `SHELLS`).

**What this document is.** The design of the whole release (§1-§8), the phasing into four sessions with their gates
(§9), and every question that is the user's to answer, each with the default this design takes until it is answered
(§10). **The first slice is landed with it** (§6-§7, G2095): the data model, its migration from today's player save,
the rules (capacity, storing, moving), and GATE GAMEPREM. Nothing on screen changes in the slice. The one picture is
a mock-up of the premises screen drawn from the slice's own rules (`futureDesigns/game-premises/`).

**Read with it:** `HANGARS.md` (shell · fit-out · capability; landed G126-G128), `GAME-LAYER-2026-09-14.md` (the spine,
the time model, ruling ax), `PREMISES-CONTRACT-2026-09-13.md` + `PREMISES-EDITOR-2026-09-13.md` (the world record that
places a field's buildings; the club hangar stood at Jolene in v1.14), HANDOVER **G1945-G1954 DEST-TO** (bases,
`flightWhere`, the To), `70_player.js` (the player document), `DEFORM-AND-BREAK-2026-10-04.md` §10 / §12 (the bill,
dm9-dm12: repair charged on an explicit garage Repair, grounded until repaired).

**One word, two meanings — kept apart on purpose.** The player sees **premises** (the release's name, the screen's
title). The code says `player*` / `hangar*` / `BASE_OFFERS`, because `PREMISES_*` is already the world editor's record
(`27_premises.js`): that record says *where a field's buildings stand*; this one says *which of them the player holds
and what is parked inside*. They meet in exactly one place, the **plot** (§5).

---

## 0. THE DESIGN IN TEN LINES

1. **A base** is an aerodrome where the player holds at least one hangar. Derived, never stored twice.
2. **A hangar** is one of the three presets — field / club / works — with **its own** dims, kits and dress: the
   existing shed record (`player.sheds[id]`), now standing at a base (`base`) and held (`tenure`: own | rent).
   Each one is unique because each carries its own interior; none is a copy of HOME's.
3. **A plot** is where a hangar can stand: per aerodrome, which presets it takes, at what size, with what kit.
   A hangar's id IS its plot's id, so a plot is held at most once by construction. HOME's starter is plot `HOME`.
4. **Every saved build is one airframe** and stands somewhere: inside a hangar, or tied down outside at an aerodrome.
5. **Capacity is geometry, not a number on a card**: the span passes the door, and the set inside packs on the floor
   beside the fit-out. A bare club parks six Cubs; today's fully fitted club, two. The fit-out costs floor.
6. **Aeroplanes move by flying.** Land at a base of yours: into a hangar with room, else tied down. Land where you
   hold nothing: tied down, *away*. A flight that ends anywhere else moves nothing — recovery charges the road home.
7. **The garage opens in a hangar** (`here`); you work on the aeroplanes standing at that base.
8. **Money: sandbox records, career charges.** Every migrated save and every new profile is a sandbox until contracts
   exist (P5b); the rules are the same in both. Hangars are bought or rented (rent accrues per flown hour — time runs
   in flight, ruling ax); kits and extensions are bought; repairs are charged on Repair (dm9) with a labour factor the
   hangar's fit-out earns.
9. **The hangar blends in and out of the world** because the world already stands *the garage's own shell* at the
   field (G434): each base's hangar is `genHangarBuild`'s exterior at *that* hangar's preset and dims, at its plot.
10. **One document, v2.** `PLAYER_V` 1 → 2: the shed's key stops being its aerodrome (`base` takes that job); `mode`,
    `here`, `clock`, `fleet`, `ledger` join. An old save's shed is byte-identical after the walk (GATE GAMEPREM).

---

## 1. WHAT ALREADY EXISTS (measured on master 068584d, train 37b)

| piece | where | state |
|---|---|---|
| the player document | `70_player.js` — `flydiy.player`, `PLAYER_V` 1, migrator walk, vintage shelf | `wallet: 0`, `sheds.HOME` only |
| the three presets | `26_hangar_fit.js` `SHELLS` — field (timber, 14 × 18 m, door 9 m), club (30 × 25, door 25), works (40 × 40, door 35) | live, each with lims, skin, `price` (0 / 15 000 / 6 000) |
| kits and verbs | `HANGAR_KITS` (ten kits over the 44 props), `hangarFit` (places or reports), `hangarCaps` / `hangarWants` | advisory, never enforced (HANGARS §5) |
| the shed in the world | `render_world` stands `genHangarBuild(…, { exterior })` at the site's `hangar`; Jolene's record puts the club hangar at HOME (premises contract v1.14, G434) | ONE shed, HOME's |
| sites | `25_airfield.js` `AIRFIELD_SITES` (HOME; M1-M3 null = "granting is a value landing in a slot"); the island's sites come from the premises record (`runwaySite`) | stands at HOME, w3, mn_strip, nv_strip, tw_ski |
| bases | `38b_dest.js` `FLIGHT_BASES` = { HOME } ("a second base is a row here"); `flightWhere` derives where the aeroplane is | one base |
| the fleet | `garage.js` `flydiy.build.<name>` slots (envelope: spec, plaque, log, images), the fleet popup | files, not places |
| parked aeroplanes | `parked.js` — any build as a static prop (the capture round trip, LODs, the parked cook) | used for the world's stock planes |
| the bill | DEFORM-AND-BREAK §10 / dm9-dm12: `{ damaged, writeOff, bill[], at, still }` on the build's garage record | designed, D5 not landed |
| prices | `61_gen_frame.js` ledger: the stock Cub costs **~30 000** (genShakedown on GEN_DEFAULT) | priced, nothing pays |

**Jolene's aerodromes** (the island the game plays; `tools/fixtures/island_jolene.json`): HOME = Jolene AFB 13/31
(2 325 m, paved, the club hangar), w2 = Jolene AFB 02/20 (the same field), w3 = Tamgas Hill Strip (520 m gravel, a
stand), SEA = Annette Dock (water), mk_sea = Metlakatla Seaplane Base (water), mn_strip = Jumbo Mine Street (250 m),
nv_strip = East Point Clearing (150 m), tw_ski = Skyline Altiport (380 m, snow).

---

## 2. WHAT THE PLAYER OWNS

### 2.1 Bases and plots

A **base** is not a record: it is "an aerodrome where I hold a hangar" (`playerBaseIds`). What *can* be held is
declared per aerodrome in **`BASE_OFFERS`** (`71_player_bases.js`), plot by plot:

| aerodrome | plot | presets it takes | as offered | kits it comes with | price factor | why |
|---|---|---|---|---|---|---|
| HOME (Jolene AFB) | `HOME` | club · works · field | the starter: today's room | today's full fit-out | 1 | the game's opening hangar, owned |
| HOME | `HOME.2` | works · club · field | the preset's own size (field 18 × 20) | bare | 1 | the second door at home — *the works next door* |
| w3 Tamgas Hill | `w3` | field | **17 × 18 m** (door 12 m: a Cub's 10.8 m passes) | bench | 0.8 | a hill strip above the trees |
| tw_ski Skyline | `tw_ski` | field · club | field 18 × 20, eave 4.0 | bare | 0.9 | the altiport |
| mn_strip Jumbo Mine | `mn_strip` | field | **14 × 18 m** (door 9 m: a Jodel, nothing wider) | bench · curio | 0.5 | *a derelict shed on the street* — HANGARS §6's fantasy, as data |
| SEA Annette Dock | `SEA` | field · club | field 18 × 20, eave 4.4 (floats) | stores | 1 | a slipway |
| mk_sea Metlakatla | `mk_sea` | field | field 18 × 20, eave 4.4 | bare | 0.8 | the seaplane float |

w2 is HOME's own field and gets no plot; East Point Clearing (150 m) has tie-downs and nothing to build on. The
analytic world offers HOME's plots only (`playerOffers(doc, world)` filters by the world's aerodromes).

**Why the plot carries the size.** "Unique hangars" is the shell *and* its proportions: the same `field` preset is a
12 m-door shed at Tamgas Hill, a 9 m-door derelict at the mine and a tall slipway shed at Metlakatla. The size is the
plot's (inside the shell's lims, gated); the player may extend it later (§2.3).

### 2.2 A hangar, and why each is unique

`player.sheds[id]` is the record HANGARS S1 created, unchanged in shape, with three words added:

```
sheds[<plot id>] = {
  shell, kits[], dims?, parts?, name?,    // the interior: v1's fields, verbatim
  base,                                    // the aerodrome it stands on (v1: the key itself)
  tenure: 'own' | 'rent',
  price?, since?                           // what it cost (resale, rent), when it was taken (flown seconds)
}
```

The interior is the garage: `hangar.js` already builds any preset at any dims with any kit set and any dress, and
`hangarFit` already places or reports. So "a unique hangar from the three presets" costs no new modelling: it is a
second record the same function reads. The garage opens in whichever hangar is `here` (§3.3).

### 2.3 Capacity — geometry, not a number

**THE RULE (`hangarPark`):** an aeroplane is inside only if (1) its span + 0.3 m a side passes the door and, when
measured, its height passes the door's height, and (2) everything inside packs on the floor: plan rectangles, nose to
the door, 0.5 m round each (1 m wingtip to wingtip, 0.5 m to a wall), none on the fit-out's placed props (their
footprints, full height). The door is `hangar.js`'s own two lines (source-scanned by the gate: they cannot drift).
The pack is **recomputed from scratch** every time — the hangar crew shuffles; history never decides what fits.

**The packer** is first fit, biggest first, scanned from the back wall forward over a 0.5 m grid plus every position
flush against a wall, a prop or a parked aeroplane, with two orders across the width — from the centre line (a lone
aeroplane stands in the middle of the bay, as the garage shows it) and from the wall (two abreast) — the better kept.
Deterministic and independent of the order it is handed (gated).

**Measured (GATE GAMEPREM `--show`, the archetypes' own footprints, `GP_PARKED_FOOT`):**

| how many fit, empty | club bare | club full fit-out | works bare | works full | field bare | field full |
|---|---|---|---|---|---|---|
| Cub (10.8 m) | 6 | **2** | 15 | 7 | 0 (door 9 m) | 0 |
| Jodel (8.4 m) | 9 | 3 | 20 | 12 | 2 | 0 |
| C172 (11 m) | 4 | 2 | 12 | 6 | 0 | 0 |
| Caravan (14 m) | 4 | 1 | 8 | 3 | 0 | 0 |
| twin on floats (16 m) | 2 | 1 | 8 | 4 | 0 | 0 |

This is HANGARS §2 made into a rule: **a big empty shed is worth more parking and less work; a small shed with a good
bench is the opposite.** Today's room (the club, every kit) holds two Cubs — the one on the stand and a guest.

### 2.4 Upgrades

`playerUpgrade(doc, hangar, { shell?, dims?, kits? })`, priced by `playerUpgradeCost`:
- **extend** (dims, inside the preset's lims): the preset's price × the added floor / its default floor; raising the
  eave 10 % of the price per default eave. Shrinking is free and refunds nothing.
- **fit a kit**: `KIT_PRICES` (bench 800, wood 2 500, metal 3 500, stores 300, handling 600, office 1 500, comfort 900;
  curios and the work in progress come with a hangar, never sold). Removing a kit refunds nothing.
- **rebuild as another preset** (only one the plot takes): the new preset's price less half the old one's.
- **Never evicts**: a change after which the aeroplanes inside no longer pack is refused ("wheel them out first").

**Why a kit is worth buying** (it was only advisory): the **labour factor** (§4.4) — and the verbs stay advisory for
*building*, as HANGARS §5 ruled.

---

## 3. WHERE THE AEROPLANES ARE

### 3.1 The fleet ledger

`player.fleet[slotName] = { hangar, aero, foot? }` — **one row per saved build** (a slot is one airframe, Q1). The slot
envelope stays the file cabinet (spec, plaque, log, images; individually shareable); the ledger says *where*.

| `playerWhere` | stored as | means |
|---|---|---|
| `in` | `hangar: <id>`, `aero: <its base>` | inside a hangar of yours |
| `out` | `hangar: null`, `aero: <a base of yours>` | tied down outside at your base |
| `away` | `hangar: null`, `aero: <elsewhere>` | tied down where you hold nothing |
| `none` | no row | not a saved build (the working build in the garage, a stock design) |

`foot` is the aeroplane's plan box `{ half, fwd, aft, h? }` measured by the page at save / roll-out (S2); a row without
one packs as the 12 m default single (`GP_PARKED_DEFAULT`) — wrong for a microlight, wrong in the safe direction.

### 3.2 Storing and moving

- **Wheel in / wheel out** (`playerStore` / `playerWheelOut`): at the base the aeroplane stands at, nowhere else
  ("it is at w3: fly it to HOME first"). In only if it packs with everything already inside.
- **Moving is flying** (`playerArrive`, called by the page when a flight STOPS on an aerodrome — `flightWhere`'s aero):
  - back at the base it left: **back into the hangar it left** — its room was never given away;
  - another base of yours: into the first hangar there that takes it (the one asked for first), else tied down `out`;
  - anywhere else: tied down `away`.
- **Nothing moves while it flies.** The document's place for an aeroplane is where it departed from until it stops on an
  aerodrome. So a crash, a forced landing in a field, a flight abandoned, a page closed mid-flight: it is *where it
  departed from* (`playerRecover`: career pays the road, 200 + 25 per km). With damage on, it arrives damaged and
  grounded (dm10) — at the hangar it left, where Repair is.
- **No ferry, no truck** between bases in this release (Q8): the user's word was *fly them*.

### 3.3 Where the garage opens, and what you can do there

`player.here` is the hangar the garage opens in (default HOME). The premises screen's **Go there** changes it,
instantly (Q7: the pilot travels with the aeroplanes, Kerbal's vessel switch). At a base you can **work on** any
aeroplane standing at that base — inside a hangar or tied down outside (the garage wheels it into the bay); an
aeroplane *away* can be **flown**, not edited (no garage there, Q6). The roll-out starts at `here`'s base (its stand);
an aeroplane away rolls from that field's stand or lane (DEST-TO's `flightWhere` / `placeAtStand` already plan from any
pose).

### 3.4 The lift: today's builds become today's fleet

`playerFleetReconcile(doc, slotNames)` — pure; the page hands it the slot names at load and after save / delete
(S2). Every slot the ledger lacks is lifted to `here`'s base: inside while it packs, then any other hangar there, then
tied down outside. **It refuses nothing**: an old save with forty builds keeps forty aeroplanes at HOME, every one
flyable from the stand exactly as today (gated). A row whose slot is gone (deleted, in this tab or another) leaves.
Idempotent (gated). It is not a migrator because a migrator sees only the document, and the slot names live in the
browser's storage.

---

## 4. THE MONEY LOOP

### 4.1 Sandbox and career

`player.mode`: **`sandbox`** records what each thing *would* cost in the ledger and charges nothing — today's game,
every migrated save and every new profile until contracts exist; **`career`** charges the wallet. The rules (capacity,
storing, moving, what a plot takes) are the same in both. Without income (contracts are P5b) a career could only
spend, so **the career switch ships with the first income** (Q2), with a starting grant.

### 4.2 What costs what (defaults, all in `PREM_RATES` / `KIT_PRICES` / `BASE_OFFERS`; calibration is P5a's, Q4)

| line | rule | e.g. |
|---|---|---|
| a hangar, owned | the preset's price × the plot's factor (club, never sold as a starter, is 10 000 elsewhere) | Tamgas Hill field 4 800; the works next door 15 000 |
| a hangar, rented | **1 % of that price per flown hour**, settled at each flight's end (`playerClock`) — time runs in flight (ax) | Tamgas Hill 48 / flown hour |
| released | owned: half back; rented: nothing owed beyond the dues | — |
| extend / raise / kit / rebuild | §2.4 | Tamgas Hill's shed 17 → 20 m wide (+54 m²): 1 286 |
| recovery by road | 200 + 25 / km | a forced landing 12 km out: 500 |
| a build | the ledger's own price (`genShakedown.cost`) on Save of a new airframe — GAME-LAYER P5a, dm11 for edits | the stock Cub ~30 000 |
| a repair | DEFORM-AND-BREAK §10's bill, charged on **Repair** (dm9) | × the labour factor (4.4) |

**Debt** (Q18): a charge that is not a choice (rent, recovery) may take the wallet below zero; a purchase needs the
cash ("the wallet holds 10, the club costs 9 000").

### 4.3 The garage's sliders under a career

Today the shed sheet changes shell, kits and size for free (`GARAGE_ENV.setShell / setKit / setDims`). In sandbox
that stays. In career those three doors route through `playerUpgrade` — the price shown on the control, the change
refused (with its reason) when the wallet or the room says no (Q15). The dress (`parts`) stays free: paint is not
property.

### 4.4 Repairs and the labour factor (with DMG-D5)

dm9-dm12 stand as ruled: the bill is stored with the aeroplane's DAMAGED state, the aeroplane is grounded (dm10), Fly
is disabled, **Repair** charges it, Scrap and Sell are the other ways out, an edited section is billed at its build
price (dm11), the garage draws the pristine model + tag + bill + the wreck's still (dm12). Premises adds two things:
- **Where:** the aeroplane is where it departed from (§3.2), i.e. at a hangar of yours, or away at a field it stopped
  on damaged (a hard landing). Away: Repair there at the field's mechanic's rate, or recover it home (the road fee).
- **How much:** `playerLabourFactor(hangar, hangarWants(spec))` multiplies the bill's labour — **0.8** in a hangar with
  every verb the aeroplane wants (a wooden wing in a hangar with the woodshop), **1.0** when one is missing, **1.25**
  away. This is what makes a kit worth buying, and it keeps HANGARS §5's ruling: nothing is *forbidden* by the fit-out.

### 4.5 What closes the loop (not this release)

Income: contracts (GAME-LAYER P5b), Sell (dm10's salvage), later survey. The premises release lands the spending side
and its rules so P5b plugs income into a loop that already holds.

---

## 5. THE HANGAR IN AND OUT OF THE WORLD

**What is there:** the world stands the garage's own shell at the field — `genHangarBuild(THREE, dims, { exterior })`,
the same function as the room, so the building you taxi past and the room you stand in cannot disagree (HANGARS §1;
`playerShedDims` composes the player's dims over the site's). Jolene's record places it with the runway's `hangar`
`{ x, z, hdg }` (premises contract v1.14). The roll-out shot (`rollanim.js`) rolls the aeroplane out of that door; the
reveal shot frames the shed; the roll-in returns to the garage.

**What the release adds (S3):**
1. **Plots in the premises record** — contract amendment v1.x: a runway's `plots: [{ id, x, z, hdg }]`, the existing
   `hangar` becoming plot `HOME` (verbatim, so nothing at Jolene moves). The editor's runway inspector already stands,
   turns and drags the club hangar: the same handle, once per plot. `runwaySite` carries each into its site.
2. **Every hangar you hold is in the world at its plot**: `genHangarBuild` exterior at *that* hangar's preset and dims,
   its dress (`parts`) applied — the timber shed at Tamgas Hill is visibly the timber shed you stand in there. Plots
   you do not hold show the offer's preset closed and dark with a sign (Q19).
3. **The blend at any base:** the roll-out starts at `here`'s hangar door and stand (each plot needs a stand and a
   taxi-out, the record's `stand` / `taxiOut`, which w3, mn_strip and tw_ski already have); a flight that stops at a
   base of yours ends with the roll-in into *that* hangar (`playerArrive`'s answer), the garage opening there.
4. **The fleet as statics:** aeroplanes tied down at a base and the residents behind an open door stand as parked
   aeroplanes (`parked.js`, keyed `mine:<slot>`), at `hangarPark`'s positions inside and on the apron's tie-down rings
   outside — capped to the nearest base's own (the parked cook's memory budget is A0's call, measured on the box).
5. **The evidence**: the world is not trusted on SwiftShader, so S3 ships `tools/gameprem_world_shot.js` for A0's GPU
   box (each base's exterior against its interior at the same dims; the roll-out at w3).

---

## 6. THE UI — THE PREMISES SCREEN

A rail entry **PREMISES** (beside the garage's and the flight's), one screen, three columns:
`futureDesigns/game-premises/premises_home.png` and `premises_w3.png` are the mock-up (`premises.html`, HOME and Tamgas Hill selected), drawn by `tools/gameprem_shot.js` from the slice's
own rules over the v2 vintage fixture (every number on it — door, room, floor used, prices — is computed, not typed).

- **Bases** (left): the bases held, then the offers (free plots, the price to buy and the rent per flown hour); a
  base's line says how many hangars and aeroplanes are there.
- **Hangars** (centre) of the selected base, as cards: the preset, the name, own / rent, the size and the door, the
  floor used, *room for N more* of the selected aeroplane, the kits as chips (fit / remove, priced), the verbs; the
  residents with *wheel out*; actions **Open the garage here**, **Extend**, **Rebuild**, **Release** (empty only).
- **Fleet** (right): every aeroplane with its place (`in HOME` / `out at w3` / `away at the mine` / `DAMAGED`) and its
  actions: **Fly from there** (sets the base and the To), **Wheel in**, **Repair** (dm9), **Show on the map**.
- **The wallet** (top): `sandbox — nothing is charged` or the balance; the ledger's last lines under it.

Elsewhere: the garage's `base` line (DEST-TO's, "Home base · the WWII hangar") becomes the hangar the garage is in,
with a select once there are two; the fleet popup (`garage.js`) gains the place badge and greys an aeroplane that is
not at this base ("at Tamgas Hill — fly from there?").

---

## 7. THE SAVE — v2 and its migration (LANDED, G2095)

```
flydiy.player v2 = {
  what: 'flydiy-player', v: 2,
  wallet, mode: 'sandbox' | 'career', here: <hangar id>, clock: <flown seconds>,
  sheds: { <hangar id>: { shell, kits[], dims?, parts?, name?, base, tenure, price?, since? } },
  fleet: { <slot name>: { hangar: <id> | null, aero: <aerodrome id>, foot?: { half, fwd, aft, h? } } },
  ledger: [ { k, amt, ref, clock, free } ]   // the last 200 money lines; `free` = recorded in sandbox
}
```

- **The walk** (`PLAYER_MIGRATORS[1]`, the first real entry of HANGARS S1's exercised machine): each shed gains
  `base` = its key — in v1 the key *was* the aerodrome. Nothing else is rewritten.
- **The normaliser** fills `tenure` (own), `mode` (sandbox), `here` (HOME, or any held hangar), `clock` (0),
  `fleet` ({}), `ledger` ([]); every unknown shed and field still rides along (a newer game's data survives an older
  one, and the other way round: a v1 game handed a v2 document passes it through untouched, `v >= PLAYER_V`).
- **Old saves load unchanged** (GATE GAMEPREM, both vintages on the shelf): every v1 shed field byte-identical, what
  it composes to (the world's shed dims, the verbs) identical, the wallet identical, the mode sandbox, the fleet
  empty until the page lifts the slots (§3.4, S2). The v2 vintage (`player_v2_2026-10-06.json`: two bases, a rented
  shed, aeroplanes in / out / away, ledger lines) is a fixpoint, byte for byte. GATE PLAYER reads the same shelf.
- **The page is untouched in the slice**: `app.js` already runs `playerNormalise(playerMigrate(doc))` on load and
  writes the result back once, so the first boot of this build stores a v2 document and nothing on screen differs.
- **Between devices** (MOBILE-GARAGE's *send to computer*): a build received lands in the slots like any save, and
  the next reconcile places it at `here` — the premises never travel with a build.

---

## 8. THE RULES — the slice's API (`src/core/71_player_bases.js`)

Every operation takes the document and returns `{ ok, doc, why, … }` on a clone; **a refusal hands back the very
document it was given, untouched** (gated on every refusal). Pure: no DOM, storage or THREE (gated).

| | |
|---|---|
| the room | `hangarDims(shed)`, `hangarDoor(shed)`, `hangarDoorWhy(shed, foot)`, `hangarObstacles(shed, reg)`, `hangarPark(shed, planes, {reg})`, `hangarRoomFor(shed, foot, residents, {reg})` |
| reading | `playerWhere(doc, name)`, `playerBaseIds(doc)`, `playerHangarsAt(doc, aero)`, `playerResidents(doc, id)`, `playerOffers(doc, world)` |
| the fleet | `playerFleetReconcile(doc, slotNames, {foots, reg})` |
| storing / moving | `playerStore`, `playerWheelOut`, `playerArrive(doc, name, aero, {prefer, foots, reg})`, `playerRecover(doc, name, {km})` |
| holding | `playerAcquire(doc, aero, plot, shell, tenure)`, `playerRelease`, `playerUpgrade(doc, id, change, {foots, reg})`, `playerUpgradeCost` |
| the rest | `playerGoTo(doc, id)`, `playerClock(doc, seconds)`, `playerLabourFactor(shed, wants)`, `playerCharge` |
| the tables | `BASE_OFFERS`, `PREM_RATES`, `KIT_PRICES`, `PARK_CLR` / `PARK_DOOR_CLR` / `PARK_STEP` |

**GATE GAMEPREM** (`tools/_gameprem_check.js`, core, ~2 s, 458 checks; `--show` prints the room table): THE SAVE,
THE ROOM (the door source-scanned against `hangar.js`; the packer's contract on 3 presets × 3 fit-outs × 2 sizes × 2
fleets; the fit-out costs floor; a bigger preset holds at least as many; today's room takes every archetype; a lone
aeroplane on the centre line), THE LIFT, STORE / MOVE (a whole journey: Tamgas Hill bought, a Cub flown there and
stored, the shed filled until the next ties down, wheel out / in, away, recovery, two hangars at HOME and the return
to the right one), HOLDING (acquire / rent / dues / release / upgrade and every refusal), THE OFFERS (every offered
aerodrome is a runway of Jolene's record, a slipway on water and a shed on land, every plot's shed as bought takes an
aeroplane that can use that field), PURITY. **Negative-verified** (`--selftest`): sixteen rules broken in their own
sources (the walk dropping a shed's dress, the fleet forgotten, a migrated save that starts paying, the door ignored,
overlaps, the fit-out ignored, the door formula drifted from hangar.js, the lift refusing the overflow, storing and
arriving ignoring the room, coming home to the wrong hangar, a full hangar released, an upgrade that evicts, a
sandbox that pays, a refusal that leaves a mark, the rules reaching for storage) — each caught.

---

## 9. THE PHASING — four sessions, each with its gate

| session | G | where | what | gate (on top of the battery) |
|---|---|---|---|---|
| **S1 — the model** ✔ | G2095 | cloud, node | this document; `PLAYER_V` 2 and its walk; `71_player_bases.js` (offers, the room, the rules); the v2 vintage; the mock-up still | **GAMEPREM** (new); PLAYER, SAVE, ROUNDTRIP, HANGAR, SITE unchanged and green |
| **S2 — the page holds it** | G2096 (+) | cloud, node + SwiftShader stills | the lift at load and on save / delete / import (`garage.js` slot doors → `playerFleetReconcile`); `foot` measured at save / roll-out (the craft's box the mobile ring already measures); `FLIGHT_BASES` derived from the document (`flightBases` reads held hangars); the roll-out from `here`'s stand; `playerArrive` on STOPPED on an aerodrome (DEST-TO's chain, after the logbook row), `playerRecover` on a crash / reset; `playerClock` on every flight's end; the garage's base line + select; the fleet popup's place badge | **GAMEPREM** extended with the page's doors (source scans, GATE PLAYER's idiom); **DESTTO** + a case: a Cub lands at w3 with a hangar held there → in w3, a reload → rolls out at w3; **UISMOKE** block; **ROUNDTRIP** (the trips still skip every world step: a base change is a stand change, measured) |
| **S3 — the world** | G2097 (+) | cloud + A0's GPU box | premises contract v1.x `plots[]` (+ the editor's handle); each held hangar's exterior at its preset / dims / dress at its plot; offered plots closed; the roll-out / roll-in at any base; the fleet as parked statics (inside at `hangarPark`'s places, outside on the rings) | **SITE** (every plot inside its field's flat, frames round-trip), **STAND**, **PREMISES** (the amendment), **FRAMECOST** (the statics' budget, ratcheted); `tools/gameprem_world_shot.js` for A0 (exterior vs interior per base, the roll-out at w3) |
| **S4 — the screen and the money** | G2098-G2099 | cloud, SwiftShader stills; A0 for the feel | the PREMISES screen (§6); acquire / release / upgrade wired; the garage's three paid doors in career (§4.3); Repair / Scrap / Sell with DMG-D5 and the labour factor; the career switch **iff** contracts (P5b) have landed, else the screen ships in sandbox | **GAMEPREM** (the screen's every action routes through a rule: source scan); **UISMOKE** (the screen's stills, every state: sandbox, career, a refusal shown); **SAVE** (a premises change never touches a build envelope) |

S2 can start the day this lands; S3 needs A0's box for its evidence; S4 waits on the user's answers to Q2-Q4, Q15.

---

## 10. OPEN QUESTIONS FOR THE USER — each with the default this design takes

| | question | DEFAULT (what the slice and the plan do until answered) |
|---|---|---|
| **Q1** | Is a saved build **one airframe** that stands somewhere, or a **design** you can build copies of? | One slot = one airframe. Stock designs are templates; Save makes an airframe (and, in career, pays its ledger price). |
| **Q2** | When does money become real? | Sandbox for everyone (and every migrated save) until contracts (P5b) give an income; then a **career** switch, opt-in, with a starting grant (proposed 60 000: two Cubs' worth). Sandbox stays forever as a mode. |
| **Q3** | How is rent charged, given time only runs in flight (ruling ax)? | Per **flown hour**, 1 % of the hangar's price, settled at each flight's end. (Alternatives: a fee per departure; no rent at all, buy only.) |
| **Q4** | The price scale: hangars at 4 800-15 000 against a ~30 000 Cub? | Keep the shells' declared prices (field 6 000, works 15 000; a club 10 000 when not the starter) × the plot's factor; kits 300-3 500. Calibrated in P5a against contract income. |
| **Q5** | How many hangars per field? | As many as the field has plots: HOME has two (the starter and the works next door), every other offered field one. |
| **Q6** | Where can an aeroplane be edited? | At any base you hold, on any aeroplane standing at that base (inside or tied down: it is wheeled into the bay). **Away** (no hangar of yours): fly only. |
| **Q7** | Switching the garage between your bases: free and instant? | Yes — the pilot travels with the aeroplanes (Kerbal's vessel switch). (Alternative: only by flying an aeroplane there.) |
| **Q8** | Can an aeroplane be moved without flying it (a ferry pilot, a truck)? | No, except the recovery after a crash / field landing (by road, to where it left). A paid ferry is a later idea (it would fly the real sim in the background, P5c). |
| **Q9** | How real is parking? | Plan rectangles, nose to the door, the fit-out full height, the crew shuffles freely. Later: wings over low benches (heights), staggered wings, tail-in, an aeroplane blocked behind others. |
| **Q10** | Tie-downs outside: limited, charged, weathering? | Unlimited and free everywhere in this release; weather wear outside and a parking fee away come with wear (DEFORM-AND-BREAK's later reliability system). |
| **Q11** | A crash or a landing in a field: where does the aeroplane go? | Back where it departed from, by road (200 + 25 / km in career), damaged and grounded (dm10) when damage is on. A damaged aeroplane that stopped on a field you hold nothing at: Repair there at 1.25 × labour, or recover it home. |
| **Q12** | Should the fit-out change what repairs cost? | Yes: labour × 0.8 with every verb the aeroplane wants, × 1.0 short of one, × 1.25 away. Building stays unenforced (HANGARS §5). |
| **Q13** | Seaplane bases with the three presets only? | Yes: a field or club shed on a **slipway** (a plot property, the floats ride a dolly up it); a boathouse would be a fourth preset, later. |
| **Q14** | The opening: HOME's full club, owned? Or the derelict WWII field (GAME-LAYER bg)? | HOME's club with today's full fit-out, owned — today's game, unchanged. A career could start in the derelict (a bare field shed at HOME) — the user's call with bg. |
| **Q15** | In career, the shed sheet's shell / kits / size controls cost money? | Yes, through `playerUpgrade` (the price on the control; refused when the wallet or the room says no). The dress (materials, tiles) stays free. In sandbox, all free as today. |
| **Q16** | Selling back? | An owned hangar returns half its price; kits and extensions return nothing; only an empty hangar, never the last. |
| **Q17** | The screen's name? | **PREMISES**, on the rail. |
| **Q18** | Can the wallet go negative? | Only through charges that are not choices (rent, recovery); purchases need the cash. |
| **Q19** | What does the world show on a plot you do not hold? | The offer's preset, doors shut, dark, with a sign (*to let*); a derelict plot as a derelict shell. |
| **Q20** | A cap on the fleet? | None but the slots (and the hangars' room). |

---

## 11. RULINGS PROPOSED (taken as defaults, reversible)

- **(gp1)** A base is derived from the hangars held; `FLIGHT_BASES` becomes the held hangars' aerodromes (S2).
- **(gp2)** A hangar's id is its plot's id; a plot is held at most once.
- **(gp3)** Capacity is `hangarPark`'s geometry, recomputed from scratch; never a stored number.
- **(gp4)** Nothing moves in the document while an aeroplane flies; only a stop on an aerodrome moves it.
- **(gp5)** The lift refuses nothing; old saves keep every build, at HOME.
- **(gp6)** Every rule returns a clone; a refusal returns the input untouched.
- **(gp7)** Sandbox records, career charges; the rules are the same in both.
