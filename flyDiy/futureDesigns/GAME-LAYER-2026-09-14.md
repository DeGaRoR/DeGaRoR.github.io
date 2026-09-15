# THE GAME LAYER — contracts, a fleet, and the aeroplane you got wrong

2026-09-14, from the user's design session: *"the game part of this, which is
really the failure of Flight Simulator — it's not a game, it's a pure
simulator… and somehow you can see that we have a bit of an airline manager,
except that the planes would really be flown with real physics, and if you
mismatch the planes then the autopilot would crash and you would lose the
plane."*

This is the first document on the GAME. Everything else in `futureDesigns/`
is the simulator it stands on. Measured against the tree unless marked
INFERRED; nothing landed.

---

## 0. WHAT ALREADY EXISTS — this is built ON, not proposed into air

More of the economic scaffolding is in the tree than the conversation assumed:

| piece | where | state |
|---|---|---|
| **a wallet** | `src/core/70_player.js:57` `wallet: 0`, migrated and gated (`_player_check.js`) | exists, **never credited or debited** |
| **every part priced** | `61_gen_frame.js` `bill()` / `spend()` / `GEN_PRICES` | the aeroplane costs a real number today |
| **the fleet rack** | `garage.js:550` `#edFleet`, `:967` the fleet popup | exists |
| **the logbook** | `garage.js:915` (G130) — built date, flight count, hours, last six flights | exists, **written since G65** |
| **the bench certificate** | G208, `bench.js` — verdict, sheets, fingerprint, withdrawal on change | exists |
| **three pilots** | `40_autopilot.js`, `41_test_pilot.js`, `43_pilot.js` | exist |
| **the premises record** | `27_premises.js` (G353/G385), `PREMISES-CONTRACT-2026-09-13.md` — polygons, modifiers, roads, seeds | exists; **this is the mod format, see §7** |
| **the island** | Annette, 358 km², 31 × 39 km, Tamgas 1 096 m (`ISLAND-ANNETTE.md`) | terrain baked, 4.4 MB |

`26_hangar_fit.js:36` already declares the seam: *"the ledger records, it does
not gate; **joining the wallet is P5**."* So the economy was always planned;
this document is what P5 becomes.

**And the ROADMAP must be corrected.** It currently carries the user's own
2026-09-01 ruling — *"I don't care so much about the game aspect at this
stage"* — which put the economy in Phase 8. That ruling is **reversed as of
2026-09-14**: the game layer is the spine, not the garnish. A session reading
the old line would deprioritise the wrong thing.

---

## 1. THE SPINE — one mechanic, and everything hangs off it

> **You design the aeroplane. You certify it. You assign it to a route. If you
> got it wrong, the autopilot fails and you lose it.**

This is not one idea among four. It is the game, and it is the one thing no
competitor can build, because it needs a real solver behind the pilot. An
airline manager rolls dice; this one flies the aeroplane and finds out.

What it does, in order of importance:

1. **It makes ENGINEERING the gameplay, not flying** — the project's stated
   thesis (*"you are the engineer more than the pilot"*, ROADMAP § THE GAME IN
   ONE PARAGRAPH) becomes a mechanic rather than a preference.
2. **It converts the autopilot from a limitation into the core loop.** The AP
   was a design choice made to avoid a skill wall. Here it is the thing under
   test.
3. **It gives the bench certificate teeth.** G208's certificate stops being a
   readout and becomes the instrument you consult before risking an asset:
   *can this aeroplane survive this route?*
4. **It generates stories.** "I lost the Beaver on the Metlakatla run" is a
   sentence a player says to another player, and it is the storytelling the
   user brings to this without any narrative system being written.
5. **It uses the physics that already exists.** The outcome is emergent, not
   scripted — which is the whole reason the simulator was built to be
   coherent.

---

## 2. POSITIONING — not an airline manager

The user's own framing (*"a bit of an airline manager"*) undersells it and
lands the game in a crowded, mostly mobile genre. The distinguishing fact is
not that the aeroplanes are flown. It is that **you designed them**.

> **You are the manufacturer AND the operator.** Design it, prove it on the
> bench, prove it in service, lose it when you were wrong.

Nobody has made that. Keep the words out of the store page.

---

## 3. THE TIME MODEL — Kerbal's, and the observatory

**RULED by the user, 2026-09-14.** Time does not advance in the garage. Time
advances when you fly. An **observatory** (route planner / route watch) shows
every route in progress and lets you follow any aeroplane visually.

Consequences, taken deliberately:

- **The fleet earns only while you play.** This is a feature: it kills the
  idle-game degeneration where the right move is to close the tab, and it ties
  passive income to active play without pressuring the player.
- **The observatory is the restful half of the game**, and the user is right
  that unpressured passive time is worth having. It is also, exactly, the
  ROADMAP's own judging criterion made into a feature: *"I want to build lots
  of small planes, test them, do some little airports, reach them and **watch
  the autopilot struggle or not**."* The observatory IS that sentence.
- **A loss reaches you mid-flight.** You are on final somewhere and the word
  comes that the Beaver went down at Tamgas. Good drama, free.
- **Time warp belongs to the observatory**, and that is where the resolution
  budget is spent (§6).

**Manual flight stays an option, not a gate** — the existing ruling, unchanged
(G200's bindings work; the user has flown them). One small finding from that
test: **the initial trim wants to be set automatically.** `genTrim`
(`64_gen_build.js:104`) already solves `stabTrim` for cruise, so a
"trimmed for cruise" starting state is nearly free and is the difference
between "the stick works" and "the stick feels right".

---

## 4. THE MISSION CATEGORIES

### 4.1 CONTRACTS — the spine's content (SnowRunner's shape)

Contractors offer jobs: take this load, these passengers, from here to there,
possibly in several hops, within a window. Measured objectives, light
narrative. This already goes further than anything in the genre because a
multi-hop with a fuel and payload constraint IS a planning problem when the
aeroplane is yours.

### 4.2 SURVEY — nearly free, and the most bush-flying thing here

Fly out, find a gravel bar or a beach, land on it, prove it, and **it becomes
a node in your network.** `WORLD-V2.md` §7's nomination pass already
identifies plausibly landable terrain for the baker — so the machinery exists
and this turns the world generator itself into content. Recommended SECOND,
right after contracts.

### 4.3 COMPETITIONS — but not against generated rivals

A circuit with stops against the clock; single-performance-point challenges
(fastest, shortest field, most payload).

**Generated rival aircraft are NOT recommended for v1.** They need plausible
designs, an AP that flies them competitively, and a difficulty curve — a lot
of machinery for an uncertain payoff. **Ghosts and leaderboards deliver most
of the satisfaction for almost nothing.**

**And there is a better version that is on-thesis:** *"beat this time with an
aeroplane costing under X."* Now the competition is an ENGINEERING problem,
not a flying one — which is this game and not someone else's.

### 4.4 SET PIECES — one, and for the trailer

The user's tunnel-in-a-mountain landing. Bespoke authoring, so it earns its
place only once the systemic game works — **but it is a trailer moment, and
that has marketing value distinct from its gameplay value.** Do one, before
launch, deliberately.

### 4.5 The opening, which Annette hands over for free

`ISLAND-ANNETTE.md` §10 raises **the derelict WWII field as the opening**.
That is the game's first act already written by the island: you begin at a
ruined airfield with one small aeroplane, and the network grows outward from
it. It is the SnowRunner shape exactly, and it costs nothing to adopt.

---

## 5. THE ECONOMY — the ladder, and the thing the ladder does not solve

**The user's answer is right for the early and mid game.** A Cessna Grand
Caravan can do nearly everything — short, rough, heavy, passengers — and the
reason you do not fly one on day one is that you cannot afford one. The price
ladder is the progression, and it is correct.

**What the ladder does not solve is the LATE game.** Once the Caravan is
affordable, capability alone gives no reason to keep anything else. Two
mechanisms close that, and both must be deliberate design rather than hope:

1. **MARGIN, not capability.** A Caravan carrying 200 kg to a village 15 km
   away *loses money* — fuel, hours, maintenance, crew against a small fee.
   **Operating cost per route is what keeps the small aeroplanes in service
   forever**, and it is how every good logistics game solves this. The ledger
   already prices the airframe; it needs a cost-per-hour to fly.
2. **Hard physical gates.** Strips too short for anything but an ultralight;
   water-only destinations; loads too bulky for a door. These must be designed
   in, not left to emerge.

**THE RULE, stated so route design is held to it:**

> **No aeroplane may fly every route profitably.** Route design is the game
> design; if one airframe dominates, the fleet is dead and so is the loop.

The wallet (`70_player.js`) is where this lands. The first work is small:
credit it on contract completion, debit it on build (`GEN_PRICES` already
computes the number), and give a route an operating cost.

---

## 6. HOW BACKGROUND FLIGHTS RESOLVE — the hard question

An assigned aeroplane is flying Metlakatla while the player is in the hangar.
Three ways to resolve that, and only one keeps the premise:

- **real time** — unplayable;
- **a dice roll** — destroys the entire proposition; the point is that the
  aeroplane really flies;
- **RUN THE REAL SOLVER FASTER THAN REAL TIME.** ✔

The machinery exists: the gate battery already flies full circuits headless in
node, and GATE ARCHETYPES does 25 of them. One route flight is a small number
of seconds of compute, deterministic, and reproducible.

**AND THIS REOPENS THE WEB WORKER.** `RENDERER-DECISION` §4f withdrew it on a
measured 1.4 ms of physics. Two things have changed:

1. The W0 verdict measured the **unpaused frame carrying ~7 ms of `sim.step` +
   instruments** (`WORLD-QUEST-BRIEFING` §3) — five times the number the
   withdrawal was based on, and a real share of a 16.7 ms budget.
2. **Fleet resolution is a second, better justification**: N route flights
   resolved off the main thread while the player flies or watches. That is
   exactly what a worker is for, and it is not latency-sensitive at all —
   §4e's obstacle 3 (one frame of control lag) simply does not apply to an
   aeroplane nobody is holding the stick of.

§4e's other obstacles stand and are the design: build the world twice from the
same seed (`makeWorld` is deterministic and `test_world.js:69` proves it), audit
`def` for the function-valued fields, and keep the worker a WRAPPER so the node
battery still calls `step()` directly.

**Recommendation: reinstate the worker chantier, justified by fleet resolution
rather than by frame time.**

---

## 7. MODABILITY — build the FORMAT now, the editor later

The user is right that planning for it early is cheap and retrofitting is
expensive. The specific advice:

**`27_premises.js` IS the mod format.** The world editor already writes a
record of polygons, modifiers, roads and seeds, with a contract
(`PREMISES-CONTRACT-2026-09-13.md`), a normaliser, a migrator and a gate.
**Missions should be DATA in that same record**, not a parallel system.

Then modability falls out later for nearly nothing, and the work now is a
schema decision rather than a feature. **Do not build mission-editor UI
early.** Build the mission record early.

---

## 8. FAILURE BEFORE DEFORMATION

The user notes crash behaviour is nearly BeamNG's selling point. The honest
split:

- **Structural failure is half-built already.** The frame computes strain per
  beam; `65_gen_loadtest.js` already takes the airframe to ultimate load.
  *"Your wing folded because you exceeded the load you certified it for"* is
  dramatic, on-thesis, and connects the bench certificate directly to the
  wreck. **Do this.**
- **Visual deformation — crumpling, plastic hinges, persistent damage — is the
  expensive part** and can wait years without hurting the loop.

Failure first. It is cheaper and it means more.

---

## 9. THE DEPENDENCY NOT YET PRICED — the autopilot becomes load-bearing

If the fleet mechanic rests on the AP flying routes competently, **the
autopilot stops being a convenience and becomes a foundation.** Its current
state: ~11 m of crosswind wander against a 12 m gate bound, ground steering
tuned against a soft boom (`rodBoomK` was computed at G233/G235 — re-read that
before assuming), and no water-taxi law at all (`WATER-2026-09-13.md` §2.6).

**Budget AP work inside the game layer, not as tidying.** And note the
pleasing consequence: an AP that is merely *good* rather than perfect is not a
defect here — it is the tension the whole game is made of. It only has to fail
for the RIGHT reasons.

---

## 10. SEQUENCING

The minimum viable game is **§4.1 + the spine**. Everything else is addition.

| | size | content | needs |
|---|---|---|---|
| **P5a — the wallet joins** | S | credit on completion, debit on build, an operating cost per hour | nothing; `GEN_PRICES` computes already |
| **P5b — routes and contracts** | M | the contract record (in the premises format, §7), acceptance, payout, the multi-hop | P5a |
| **P5c — assignment and the mismatch** | **L — the spine** | assign an aeroplane to a route; resolve it with the real solver; win, damage, or lose it | P5b, §6's worker, §9's AP |
| **P5d — the observatory** | M | route watch, follow an aeroplane, time warp | P5c |
| **P5e — survey** | M | nomination surfaced as missions; proving a site adds a node | `WORLD-V2` §7 |
| **P5f — competitions** | S–M | ghosts, time trials, the cost-capped challenge | P5b |
| **P5g — structural failure** | M | the spar fails, the wing folds, the certificate was right | §8 |
| **P5h — one set piece** | M | the tunnel, for the trailer | the world |

Not before: the mission editor UI, generated rivals, visual deformation, the
second island.

---

## 11. RULINGS

- **(ax) RULED 2026-09-14 — the time model is Kerbal's**: the garage is
  timeless, time advances in flight, and the observatory is where routes are
  watched and warped.
- **(ay) The spine is the mismatch**: a wrongly-specified aeroplane on a route
  is lost. **Recommended** — it is what nothing else in the genre can do.
- **(az) No aeroplane flies every route profitably** (§5). **Recommended** as a
  standing constraint on route design.
- **(ba) Operating cost per hour**, not capability alone, is what keeps a fleet
  diverse. **Recommended.**
- **(bb) Missions are data in the premises record** (§7). **Recommended.**
- **(bc) Reinstate the Web Worker**, justified by fleet resolution (§6).
  **Recommended.**
- **(bd) Failure before deformation** (§8). **Recommended.**
- **(be) The ROADMAP's "I don't care so much about the game aspect" ruling is
  REVERSED**; the economy moves from Phase 8 to the spine. **Taken** — the
  ROADMAP needs the edit.
- **(bf)** Generated rival aircraft: deferred, ghosts instead (§4.3).
  **Recommended, reversible.**
- **(bg)** Does the derelict WWII field open the game (§4.5)? **Owed** — it
  interacts with `ISLAND-ANNETTE` §10's own open ruling.
- **(bh)** Does damage persist between flights (a repair cost), or is a route
  binary — arrives or is lost? **Owed**, and it decides how harsh the loop is.
