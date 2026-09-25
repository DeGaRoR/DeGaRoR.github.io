# GAME-VISION — the company, the fleet and the island
### (2026-09-25, from the user's design session; a draft for discussion, nothing landed)

This is the user's vision of the game, written up with a critical read. It
builds on `GAME-LAYER-2026-09-14.md` (the spine: a mismatched plane on a route
is lost) and changes several of its points: three contract categories instead
of one, hand-flying at the centre of two of them, a hangar-and-summon fleet
model, and a living island. Where the two disagree, THIS document is the more
recent word, pending the user's rulings in §10. The living copy (comments,
edits) is the Claude Doc
https://claude.ai/code/artifact/a84edfb1-40ab-4deb-8c42-9171f97873f7 — this
file is its snapshot of 2026-09-25.

---

## 1. The premise

You are a young entrepreneur and pilot on an Alaskan island, starting at the derelict WWII airfield with one Cub, one hangar and a passion for designing aeroplanes. The island administration offers contracts. Every one you complete earns money, grows the island and opens bigger aeroplanes. The game is building a company and a fleet you love, one aeroplane at a time.

**In one sentence:** design aeroplanes, fly them or hire pilots to fly them, and watch the island grow around your company.

**What sets it apart:** SnowRunner and RoadCraft handle missions well, but their fleets are decorative. When you drive one truck, all the others sit idle. Here the fleet works: planes on routes fly real physics while you do something else. A plane that was badly specified, or given to the wrong pilot, crashes.

### The five objectives the mechanics must serve

1. **Never a blank sheet.** Construction is introduced slowly, starting from a Cub you tune, never an empty editor.
2. **Challenge, active and passive.** Hand-flown missions and competitions for the active player; fleet and route design for the planner.
3. **A fully passive path.** No adrenaline, no reflexes: build your dream plane, watch it fly, travel. This path must be viable, not just tolerated.
4. **A reason to build many planes.** Contract variety must reward specialised aeroplanes over one do-it-all machine.
5. **A world that evolves with you.** Construction sites and new places appear as visible proof of progress, possibly unique to each save.

## 2. The contract board

The island administration posts every contract. It needs a fictional name in place of Metlakatla, which is a real community and a real Tsimshian reserve. Contracts come in three categories, and at first each category has its own default way of being flown.

| Category | What it is | Who flies it (v1) | Reward shape |
| --- | --- | --- | --- |
| **Missions** | Passengers and freight, island development (materials to a construction site), survey, discovery, animal spotting | You, by hand | Pays, and advances the island's development |
| **Competitions** | Modelled on real events: rally, pure speed, fuel economy, STOL, floatplane, aerobatics | You, by hand | Prize + standing; entry fee |
| **Routes** | A recurring leg between two fields, served by a plane + a hired pilot | A hired pilot (the autopilot with a personality) | Recurring income per completed leg; lost if the plane crashes |

### The hired pilot

The autopilot is the same brain for every hired pilot. A pilot's character is a set of degradations and biases applied to it: reaction time, crosswind skill, short-field technique, risk appetite, water experience. A cheap pilot on a demanding strip is a real risk. A crash is caused by physics, not a dice roll.

### Opening the categories later

The v1 split (missions and competitions by hand, routes by pilot) is a starting point, not a rule. Later, a hired pilot could also fly missions and competitions. That makes the fully passive path from §1 complete for players who only want to build.

- **Competitions with a hired pilot** are a good fit: the competition becomes an engineering contest ("design the plane that wins STOL"), and the pilot's skill is part of the result.
- **Missions with a hired pilot** probably pay less, or take a cut of the reward, so flying by hand still counts for something.

## 3. The build loop and getting planes

The build loop is modify → bench → maiden flight → contract. The bench and the maiden flight are strong. What is missing is the link between a change and its effect.

### Is the bench + maiden flight enough?

Nearly. The bench gives whole-plane verdicts, and the maiden flight gives feel. What the player lacks is **cause and effect per part**. Two additions would close the loop:

1. **Click a part, see its sheet** (as Flyout does): mass, cost, drag share, strength margin, and which plane figures it moves. This makes the "a slider must move a number or be honest set dressing" rule visible to the player.
2. **A before/after delta on every change**, on the figures a contract cares about: take-off run, stall speed, cruise, range, payload, CG margin. For tuning, this matters more than the part sheet: it tells the player whether the change was worth its price.

### The early game is the Cub

The early game is about tuning the Cub, and real Cubs offer a lot to tune:

- Engine upgrades
- Tundra tyres
- Floats, and later skis
- Clipped or extended wings, vortex generators, bigger flaps
- Extended baggage, a cargo pod
- Seats out for freight

Each contract tier should reward one of these. That makes the Cub the tutorial without calling it one.

### Modifying a plane you own: the price model

Keep it to one rule a player can predict:

- **Cost of a change = price of the new parts + a labour fee per part changed.**
- **Removed parts refund 50 %.** No parts shelf or inventory in v1; that can come later if players ask.
- **Any change withdraws the bench certificate** (as the bench already does since G208). A plane must be re-benched before it takes a paid contract. Benching is free and quick; the step is there for the information, not as a tax.

### Getting a new plane: three doors

| Door | What you get | Freedom | Price | Role in the game |
| --- | --- | --- | --- | --- |
| **Vendor** (fictional manufacturers) | An archetype with a short option list (engine, gear, seats, colours) | Open to full modification once it is yours | Base + options; cheapest per capability | The main door: fast, readable, never a blank sheet |
| **Second-hand** | A specific plane, as-is, with its history and wear | None before buying; full after | Cheap, variable | Bargains, surprises, character |
| **Custom** | The full editor from a starting frame | Total | Parts + labour, highest | The craft end-game; opens as the player grows |

**The vendor tension, resolved.** A fixed option list is easy to understand but kills the fun; an open archetype is fun but opens on a blank-ish sheet. Do both in sequence: buy from the option list, which is fast and clear. From then on the plane is yours to modify like any other, at the modification prices above. The option list teaches the parts; the hangar teaches the craft.

**Second-hand needs one rule:** you may inspect (part sheets, logbook) and take a test flight before buying, but not modify. Otherwise the as-is door is a blind gamble, and gambling is not the fun here.

## 4. The fleet in the world

Every plane you own is a real object in the world, in one of four places: a hangar slot, parked in the open, in the air, or in long-term storage. Planes not being flown render with the static-plane and LOD system.

### The rules

| Rule | Detail |
| --- | --- |
| Hangar to hangar | Instant transfer between owned hangars |
| Summon out | A plane in a hangar can be summoned to any field |
| Summon back | Any plane anywhere can be recalled into an owned hangar with a free slot |
| Left in the open | Stays exactly where you left it, visible to you in the world |
| Long-term storage | Free, unlimited, off-map; how you keep old, loved builds without selling them |
| Spawning | Needs a free slot in an owned hangar (the SnowRunner rule) |
| Selling | Always possible; price = value less wear |
| Switching | Hop to any plane within 100 m of the one you are in |

### The three hangars

The three editor presets (shed, club, works) are the only hangars the player ever owns. Other fields may have hangars, but they are scenery. The works hangar is at the WWII field.

A suggestion that ties hangars to progression: **start in the works hangar, derelict, with one usable bay.** Restoring its bays is itself a development project from §6, and each restored bay is a new slot. The shed and the club come later, placed at two other fields to open those regions of the island. Where they go is your open decision in §10.

### Critical note: what makes location matter

If summoning is free and instant in both directions, where a plane is parked stops mattering; it becomes a picture, not a constraint. That is acceptable (the game is meant to be generous), but it should be a deliberate choice. Two light options:

- **Summoning costs a ferry fee** proportional to distance. Cheap, but enough that a plane already at the right field is worth something.
- **Summoning is free but takes game time.** In flight time, since the garage is timeless.

My lean is the fee, because it keeps the rule to one number. Recalling a plane left in the open should cost the same fee; otherwise leaving planes outside has no downside at all.

### Performance note

A large fleet parked around the island means many static planes on screen. The LOD system already handles this, but set a budget early: how many parked planes can be drawn at full detail near the camera before the rest drop to impostors.

## 5. The economy

Five money lines and nothing else: plane costs, fuel, pilot salary, contract rewards, competition fees. Two of them come straight from the simulator, which is the point: a better-engineered plane earns more.

| Line | In / out | Where the number comes from |
| --- | --- | --- |
| Buy / build / modify | Out | `GEN_PRICES` already prices every part |
| Fuel | Out | Litres actually burned in the flight: an efficient design is cheaper to run |
| Pilot salary | Out | Per flight hour, higher for better pilots |
| Contract reward | In | Scales with difficulty: distance, strip, payload, weather |
| Competition fee | Out (prize in) | Flat per entry |

**Deliberately left out of v1:** maintenance, insurance, loans, taxes, parts inventory. Wear exists only as a lower resale value. Each of these can be added later if play shows a gap.

### Generosity, as targets to tune against

The goal is many planes, so the pace should be generous. Suggested targets for the first hours:

- A worthwhile Cub modification every 1–2 contracts.
- A second plane within the first hour of play.
- A crash hurts but never ends the company: early planes are cheap, and a free basic plane is always on offer from a vendor.

### Progression to bigger planes

Money alone gates size. One natural second gate is already in the world: **the hangar door.** A plane has to fit a slot to spawn, so restoring the works hangar's big bay can open the large-plane tier without a separate unlock system.

### The balance to watch

Routes pay while you play something else, so they compete with missions for the player's time. If routes pay too much, missions become pointless; too little, and nobody hires pilots. A starting rule: **routes pay steady and modest; missions and competitions pay in bigger lumps and are the only way the island develops.** That keeps both halves worth doing.

## 6. The living island

The island develops through **projects**: a construction site that missions feed, and that visibly changes the world when it completes. This is the story, told through the landscape rather than through dialogue.

### How a project works

1. The administration opens a project (a lodge, a cannery, a new strip, a lighthouse, a fire lookout, a hangar bay).
2. It needs deliveries: tonnes of materials, crews, sometimes a survey flight first to choose the site.
3. The site shows its progress in 2–3 visual stages: staked out, framed, finished.
4. When finished, it opens something: a new field, a new contract type, a new region, a restored hangar bay.

### Unique per save

The world differs between saves if **the player chooses which projects to fund and in what order**, and some choices exclude others (the cannery or the lodge at the same cove). A few forks give each save its own shape without authoring a branching story.

### Built on what exists

The world editor's premises record (polygons, modifiers, roads, seeds, with a contract, migrator and gate) is already the right format. A project's stages are premises records, and a save stores which stages it has reached. Missions are data in the same record, as GAME-LAYER already recommended.

### The cost to watch

Every project means 2–3 authored stages. Ten to fifteen projects is a realistic v1; the forks multiply that authoring, so keep them to a handful. Each save's world state also joins the rule that saves stay compatible forever: a stage record written today must load in two years.

## 7. Damage, breakage and crashes

Yes, it would catch the eye: a crash is the clip people share, and it is what made BeamNG. The node-and-beam frame makes it reachable, but in stages whose cost rises steeply. Take them in order and stop wherever the value runs out.

| Stage | What the player sees | Cost | Why |
| --- | --- | --- | --- |
| **1. Structural failure** | A beam past its limit breaks; a wing folds, a gear leg snaps. "You exceeded what you certified." | M | The frame already computes strain per beam, and the load test already takes it to ultimate load |
| **2. Parts detach** | The broken wing or gear leaves as its own body and tumbles | M–L | Changes the frame's shape mid-flight; the solver's sizing and the gate battery must survive it |
| **3. Failure by material** | Wood splinters, steel tube bends, aluminium buckles, fabric tears | M | A per-material rule on each beam: snap, or bend and stay bent |
| **4. Visible deformation** | Crumpled skin that follows the bent frame | L+ | The skin is generated from the frame; it would have to follow moving nodes |

Stage 1 is on-thesis: it ties the bench certificate to the wreck, and the player learns something from it. Stage 3 is the most distinctive: a wooden plane and a metal plane crashing differently is something no other game shows. Stage 4 is spectacle, and can wait until after launch.

**Ties to an open decision:** if damage carries over between flights (a repair bill), stages 1–3 feed the economy directly. See §10.

## 8. Critical discussion

The vision is coherent and its core is original. The risks are scope, the change of pilot, and fairness when a plane is lost. None of them is a reason to change direction; each needs a decision.

### Where it is strongest

- **A fleet that works.** Planes that earn while you fly another, and crash for real reasons, fix the idle-truck problem SnowRunner never solved. This is the pitch.
- **Never a blank sheet.** Cub first, vendors second, custom last solves the onboarding problem the editor has today.
- **A real passive path.** Cozy, no-reflex games have a large audience, and few of them have real engineering underneath.
- **The island as the story.** Progress you can see from the air needs no cutscenes, and reuses the world editor.

### Risk 1: scope

Count the systems: three contract categories, hand-flying and hired pilots, projects, vendors, second-hand, modification pricing, the fleet rules, damage. Each is a chantier or more. **The first playable version must be a cut**: missions (passengers, freight, one project) + routes + one competition. STOL is the best first competition: it is short, measurable and pure engineering. The rest waits for the playtest.

### Risk 2: the pilot has changed

The roadmap was built on "you are the engineer; the autopilot is the pilot", with hand-flying as a late option. This vision puts hand-flying at the centre of two of three categories in v1. That may be right, but it moves flight feel into v1: controls, joystick, trim, camera, landing help, all previously deferred. The active player will judge the whole game on how the Cub feels in hand.

A lower-risk alternative: **allow a hired pilot on missions from day one, for a cut of the reward.** The passive promise is true from the start, and hand-flying can mature without blocking anything.

### Risk 3: a crash must be fair

A route crash only works if the player believes it was their mistake: the wrong plane or the wrong pilot, not an autopilot bug. Two consequences:

- The autopilot becomes a foundation. PILOT-ROADMAP's P0–P1 (the runway as data, approaches) is a prerequisite for routes, not polish.
- **Every loss needs a report** that names the cause in the player's terms: "crosswind 14 kt, your pilot's limit is 10" or "strip 320 m, loaded take-off run 380 m". This is the most important screen in the routes category.

### Risk 4: many real planes, flying at once

"Every plane is real" plus routes means several planes in full physics at the same time. The performance work has just been fought for one plane. Suggested split: full physics near the camera; far away, the same solver runs in a worker, and the plane's position follows its result. It is still real physics, just not rendered. This is the Web Worker GAME-LAYER already recommended.

### Risk 5: generous vs meaningful

If planes are cheap, losing one does not sting, and the route mismatch loses its teeth. The sting can come from attachment instead of money: **a lost plane can be rebuilt from its blueprint, but its logbook, hours and history are gone.** The cost is emotional, and it costs the economy nothing.

### Smaller notes

- **Pilot personalities must be readable.** Each trait maps to something you can see: a nervous pilot goes around more, a bold one lands in more wind.
- **Real names.** Annette Island and Metlakatla are a real Tsimshian community and reserve. Fictionalise the administration, and consider the island's name too. Real competitions should inspire, not be named.
- **Second-hand planes** need a supply: they could be generated from the archetype cards with random options and wear, so no extra authoring is needed.

## 9. What exists, and a build order

More of this is already built than it looks: the wallet, part prices, the fleet rack, the logbook, the certificate, three pilots, 17 archetype cards, the hangar presets and the premises record. What is missing is the game logic that connects them. Each stage below ends with a playtest, and the playtest may reorder what follows.

| Stage | What lands | Built on (exists today) | Gate to move on |
| --- | --- | --- | --- |
| **0. Performance** | Finish the current work | Frame clock, graphics tiers | Target fps held on the benchmark machine |
| **1. The company** | The five money lines; planes located in the world; the three-hangar rules and storage; the contract board with passenger and freight missions (payload mass and CG) | Wallet, `GEN_PRICES`, fleet rack, logbook, hangar presets | One hour of play: Cub → a few contracts → a second plane |
| **2. The build loop** | Part sheets; the before/after delta; modification prices; vendors from the archetype cards; certificate required for paid work; a first sound pass | Bench, certificate (G208), 17 archetype cards | A new player tunes the Cub without help |
| **3. Routes** | Hired pilots (autopilot + traits); assign plane + pilot; the loss report; far planes solved in a worker | Three pilots, pilot matrix, headless gate flights | Playtesters call their crashes fair |
| **4. Show HN** | STOL competition; one island project with stages; the first 10 minutes polished | Premises record, world editor | Strangers play past the first contract |
| **5. Depth** | More competitions; second-hand market; project forks; damage stages 1–3; hired pilots on missions and competitions | Frame strain, load test | Driven by Show HN feedback |
| **6. Steam** | Store page (early, for wishlists), desktop wrapper, controllers, trailer, Next Fest demo, Early Access | Everything above | — |

The order puts the company before the build loop because the loop needs something to be *for*: a part sheet matters once a contract asks for 300 kg and a 250 m strip.

## 10. Open decisions

Eight decisions are yours to make. The first three block stage 1.

- [ ] **Damage between flights:** a repair bill, or is each flight simply "arrived" or "lost"?
- [ ] **Hired pilots on missions from day one** (for a cut of the reward), or hand-flying only until later?
- [ ] **Summoning:** a ferry fee, game time, or free?
- [ ] **The fictional name** of the island administration, and whether the island itself is renamed.
- [ ] **Where the shed and the club go**, and whether the works hangar starts derelict with one bay.
- [ ] **Vendors:** how many fictional manufacturers, and which archetype cards each one sells.
- [ ] **A lost plane:** rebuilt from its blueprint without its logbook, or gone?
- [ ] **The first competition:** STOL, or another?
