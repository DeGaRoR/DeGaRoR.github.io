# PROCESS THIS IN SPACE
## Game Architecture Document v1.0

---

# PART I — THE GAME

---

## 1. Elevator Pitch

A large ship breaks apart over an alien planet. You survive inside a torn-off hangar section with one injured crewmate, a punctured geothermal vent, and enough emergency supplies for two weeks. Using salvaged equipment, real thermodynamics, and a lot of trial and error, you build the chemical processes that keep you alive — then keep others alive — then turn a crash site into a self-sustaining colony.

It's Kerbal Space Program meets Factorio meets survival. You accidentally learn chemical engineering. Every explosion teaches you something.

---

## 2. Core Fantasy & Tone

**The fantasy:** *"I'm not a hero — I'm the kind of nerd who figures it out."*

The player isn't a soldier, a commander, or a chosen one. They're a resourceful person who happens to understand (or learns to understand) that the world runs on mass and energy, and that if you respect the physics, you can make anything from almost nothing.

**Tone progression:**
- **Phase A (M1-M3):** Grim survival. Everything is fragile. Emergency lighting. Countdowns ticking. Every success is a reprieve, not a victory.
- **Phase B (M4-M6):** Stabilization. Gallows humor creeps in. Dr. Vasquez makes dry remarks about "optimistic design margins." The base starts to feel like a place, not a shelter.
- **Phase C (M7-M9):** Competence. The player knows what they're doing. The base looks industrial. New survivors bring personality and problems. Dark humor about corporate negligence from wreck logs.
- **Phase D (M10):** Pride. The pull-back shot. You built this. From a crash and a leaking vent, you built an ecosystem. The tone is quiet awe, not triumphalism.

---

## 3. Selling Points

**Real physics, not approximated.** Mass and energy are conserved. Heat flows downhill unless you pay with work. Phase behavior follows real thermodynamics. When your compressor overheats or your flash drum doesn't separate, it's because the physics says so — not because of a difficulty slider.

**Every failure is spectacular and educational.** Overpressure a vessel? It ruptures. Forget to cool a reactor? Thermal runaway. Connect a liquid line to a gas port? Backflow. The failures are visual, dramatic, and always traceable to a physical cause. You learn by breaking things.

**You accidentally learn chemical engineering.** By Mission 10, the player has built: a condensation train, an electrolyzer, a Sabatier reactor, a Brayton power cycle, a multi-stage compression system, a heat pump, a Haber synthesis loop with recycle and purge, a Rankine bottoming cycle, a cryogenic liquefaction train, and a closed biosphere. These are real industrial processes. The player learns them by needing them, not by studying them.

**No magic, no tech tree.** Every piece of equipment is a real, nameable machine you could point at in a pilot plant. There's no "Research: Advanced Thermodynamics Level 3." You get new capability by finding a compressor in the wreckage and dragging it back to base.

**3D pipe-laying satisfaction.** The primary interface is a 3D plant view where you place equipment and connect it with pipes. The satisfaction of laying out a clean process, watching fluids flow through your piping, and then watching it all work (or spectacularly fail) is the core gameplay loop. Think Satisfactory's factory building meets the consequence of Kerbal's launches.

**Survival stakes with real systems.** The countdowns are real. O₂ runs out. CO₂ accumulates. The battery dies. Food runs low. Each mission replaces one countdown with a sustainable process. The transition from "12 days of oxygen left" to "oxygen: supplied ✓" is one of the most satisfying feelings in gaming — and it's backed by real chemistry.

---

## 4. Reference Games & What We Take

**Kerbal Space Program** — The build-test-explode-learn loop. You design on the ground, you commit, you watch physics happen. If it works, joy. If it fails, spectacular wreckage and a lesson. The checkpoint system: revert to launchpad after failure. Time warp when things are stable.

**Factorio** — The logistics satisfaction of watching a process run. The scaling challenge: what works for 2 people doesn't work for 7. The optimization itch: "I could make this 15% more efficient if I reroute that stream." The visual density of a mature factory.

**Oxygen Not Included** — Survival systems with real (simplified) physics. O₂ generation, CO₂ scrubbing, temperature management, water cycling. The feeling of managing an ecosystem where everything connects to everything.

**City builders (Cities: Skylines, Frostpunk)** — Visual feedback as reward. Watching your settlement grow from a cluster of shelters to a functioning town. Lights coming on. New buildings appearing. People moving between structures. The 3D view IS the reward.

**Satisfactory** — 3D pipe and conveyor laying as core gameplay. The satisfaction of clean routing. The pride of a well-organized factory floor. First-person perspective on industrial structures.

---

# PART II — GAME PHILOSOPHY

---

## 5. The Three Promises

These are the game's contract with the player. They are non-negotiable. They are what makes this game honest.

**Promise 1 — Conservation.** Mass and energy are rigorously conserved. Every unit: mass in equals mass out, energy in equals energy out. Nothing comes from nowhere. Nothing vanishes. If a reaction produces water, that water has mass and enthalpy. If a compressor does work, that energy came from somewhere. The player can trust the numbers.

**Promise 2 — Second Law.** Heat flows from hot to cold. A cooler without a cold source does not cool. A heater without energy does not heat. You cannot move heat uphill without paying with work. When the player builds a heat pump and sees COP > 1, they know it's real — they're not getting free energy, they're cleverly moving heat that already existed.

**Promise 3 — What You See Is What You Get.** If a wire doesn't exist on screen, it doesn't exist in the solver. An unconnected port carries zero — no flow, no heat, no power. Every unit computes the consequences of what it receives, not what it wishes it had. Every unit in the palette is a real, nameable, physically purchasable piece of equipment. If you can't point at it in a pilot plant and say "that one," it has no place in the game.

Together: **this world does not cheat.** Not in the player's favor, not against them. The physics is the physics. Learn it and you can do anything. Ignore it and you'll see the consequences — spectacularly.

---

## 6. How It Plays

**The model IS the plant.** There is no simulation sandbox where you test a design safely and then "deploy" it. When you press play, you're running real improvised equipment. Physical consequences are immediate. This is what creates stakes.

**Build → Run → Watch → (Fail?) → Learn → Reset.** The core loop is Kerbal's. You design your process on a frozen world (paused). You press play. Physics happens. If it works, you watch production accumulate, maybe time-warp to hit your target. If it fails — overpressure, thermal runaway, wrong phase, dead flow — the failure is visual, dramatic, and informative. You checkpoint-revert and try again.

**Topology edits pause the world.** Adding equipment, connecting pipes, deleting units — these are construction operations that happen with the world frozen. You can take your time designing.

**Parameter tweaks are live.** Changing a setpoint, adjusting a valve opening, tuning a compressor pressure ratio — these happen in real time while the process runs. You feel the system respond. This is how real operators work: the plant is running, and you're adjusting.

**Checkpoint on every play press.** Every time you commit your design and press play, the game auto-saves the current state. If the process fails catastrophically, you revert to the last stable checkpoint. You lose progress since last play, not the entire mission. Just like Kerbal's "revert to launch."

**Time warp when stable.** When your process is converged and running smoothly, you can accelerate time to reach production targets faster. When instability or alarms occur, time automatically slows — you see the problem developing, not just the aftermath.

---

## 7. Economy & Progression

**No money. Scarcity of physical parts.** The economy is entirely physical. You have "3 valves, 2 tanks, 1 compressor." Placing a unit uses one from inventory. Deleting returns it. The palette shows count badges and greys out when depleted.

**Salvage drives capability.** New equipment comes from EVA expeditions to the wreck field. Early missions: nearby debris yields small, light equipment. Later missions: deeper expeditions into the propulsion section and cargo holds yield heavy, specialized machinery. You don't research new technology — you find it, carry it, and figure out what it does.

**Piping is free. Equipment is scarce.** Rerouting a connection costs nothing — the cost is the player's engineering insight, not a resource tax. This encourages experimentation. Equipment, however, is limited. You can't build five compressors if you only found two.

**Demand grows with survivors.** Rescued survivors are scripted narrative beats, not random events. Each rescue is a story moment and a step-change in resource demands. More people means more O₂ consumed, more CO₂ produced, more water needed, more food required. The systems you built for two people don't work for seven. You must scale.

**Every mission replaces a countdown with a process.** This is the fundamental gameplay loop. The room has gauges ticking toward zero. Each mission connects a sustainable supply to one of those gauges. The feeling of watching a red countdown switch to a green "SUPPLIED ✓" is the core reward.

---

## 8. Physics Ground Rules

**Correctness over accuracy.** The simulator does not chase 0.1°C agreement with industrial data. It does refuse outcomes that violate fundamental laws. Mass and energy always balance. Phase transitions happen at the right conditions. Reactions shift equilibrium the right direction with temperature and pressure.

**Stability over sophistication.** When advanced realism threatens solver stability or playability, we choose pragmatic simplification — as long as fundamentals stay intact. Pressure-flow network coupling is deferred. Real-gas equations of state are not required when ideal-gas behavior captures the right trends. The goal is not the most accurate simulator; it's the most discovery-friendly simulator that never becomes physically absurd.

**Trends must be right.** If you increase pressure, equilibrium shifts the correct way. If you cool a gas mixture, the right species condenses first. If you compress, temperature rises. If you expand through a valve, temperature drops. These causal relationships are the curriculum. Getting them wrong would be unforgivable. Getting the third decimal right is optional.

**Discovery-friendly realism.** The physics should invite exploration, not punish it. The player should be able to ask "what happens if I...?" and try it. The answer should always be physically plausible. The simulator is a playground with real gravity — not a padded room, not a cliff edge.

---

# PART III — THE STORY

---

## 9. Planet X — The World

Planet X is deceptively Earth-like. Comfortable gravity. Reasonable pressure. Breathable-looking sky. The kind of planet that makes you think "we could live here" — until you check the CO₂.

| Parameter | Value | Why this number |
|-----------|-------|-----------------|
| Atmosphere | 70% N₂, 21% O₂, 8% CO₂, 1% Ar | Earth-like enough to feel familiar. 8% CO₂ is the poison pill — lethal in minutes, invisible, odorless. The O₂ is right there but you can't use the air. |
| Surface pressure | 0.885 atm (89,750 Pa) | Close enough to Earth that equipment works normally. No exotic pressure engineering needed. |
| Surface temperature | 288 K (15°C) | Chilly but survivable. Cool enough that the shelter is uncomfortable without heating. Critically: just below CO₂'s critical temperature (304 K), which makes transcritical CO₂ cycles natural for M6. |
| Geothermal vents | ~500 K gas, rich in H₂O/CO₂/N₂/CH₄ | Hot enough to carry water vapor. Rich enough in useful species to bootstrap an entire chemical industry. The planet's gift to whoever crashes on it. |

The planet's atmosphere composition was designed as a teaching tool. The 8% CO₂ creates the survival pressure. The 21% O₂ means the air is almost breathable — tantalizingly close. The N₂ provides feedstock for Haber synthesis. The Ar creates the inert-accumulation problem in M7. Every number serves a gameplay purpose.

---

## 10. The Ship — ISV Calypso

The **ISV Calypso** was an interstellar survey vessel operated by Meridian Extractives, a resource-prospecting corporation. Mixed-use: crew quarters for 40, a deployable ISRU (In-Situ Resource Utilization) testing module for evaluating colony sites, cryogenic propulsion (liquid H₂/CH₄/O₂), a chemistry laboratory, a small agricultural research pod, and the usual ship systems — life support with Sabatier CO₂ recycling, fuel cells, power management.

The ship was on a flyby survey of the Planet X system. Not a colony mission — a scouting pass. The crew was mostly scientists and engineers, plus support staff. The ISRU module was meant for short surface deployments: land, test resource extraction, report feasibility, move on.

Why this matters: the Calypso's cargo justifies every piece of equipment the player salvages. The diaphragm compressor came from the ISRU module's gas processing train. The Sabatier catalyst bed was a life-support spare. The micro turbine was an auxiliary power unit. The brazed-plate heat exchangers were in every cooling loop. The agricultural pod in the cargo hold contains seeds, growth medium, and grow lights — the greenhouse of M10. Nothing the player finds is implausible.

**Wreck log fragments** found during salvage reveal the backstory in pieces:
- Corporate memos about "acceptable survey risk margins"
- A chief engineer's private log about maintenance deferrals
- Passenger manifests with names and roles
- A final automated distress broadcast that never reached anyone

The tone is dark-corporate-comedy: a competent crew undone by budget-driven management decisions. The humor is dry and bitter, never slapstick.

---

## 11. The Crash

The Calypso suffers a catastrophic structural failure during atmospheric survey — metal fatigue in a load-bearing frame, deferred maintenance, exactly the risk the chief engineer warned about.

The ship breaks into three major sections:
- **The bow** (crew quarters, bridge): impacts 2 km northwest. Mostly destroyed. Some survivors sheltered in reinforced compartments.
- **The midsection** (engineering, propulsion, ISRU module, chemistry lab): scatters across a debris field 500m-1km from the landing zone. Heavy equipment, mostly intact but buried or inaccessible without EVA.
- **The hangar module**: tears free during breakup and lands relatively intact 200m from a rocky outcrop. This is the starting base.

The impact drives part of the hangar floor deep enough to puncture a hydrothermal pocket. Hot, pressurized mixed gas begins leaking into the lower compartment. This is dangerous — but also the most valuable thing on the planet.

**The inciting incident** is handled as a narrative introduction, not gameplay. The player character and Dr. Vasquez improvise a welded manifold and throttle valve from hangar debris to control the vent leak and route it as a usable feed stream. Mission 1 begins with this feed available — the player can focus on the first real thermodynamic problem (getting water), not on plumbing a gas leak.

---

## 12. The Characters

Gender balance across all characters is intentional and deliberate — approximately 50/50 throughout the game. This is a STEM game, and representation matters.

### Starting Pair (Day 0)

**Kael Osei** — The player character.
Male, late 20s. Junior systems technician on the Calypso — not an engineer, not a scientist, just someone who maintained equipment and understood how things connected. Resourceful, practical, physically capable. Can carry heavy salvage, operate tools, build connections. Speaks rarely in dialogue (player-insert), but his internal monologue appears in loading screens and journal entries.

**Dr. Lena Vasquez** — The Expert.
Female, mid-40s. Chemical engineer. Was the lead ISRU specialist on the Calypso, responsible for evaluating whether Planet X's resources could support a colony. Brilliant, dry-humored, precise. Injured in the crash — broken leg, cracked ribs. Cannot move, cannot lift, cannot EVA. But she knows thermodynamics like she breathes it. She is the player's knowledge source: tutorials, hints, diagnosis, contextual commentary. When you inspect a compressor, she might say "watch your discharge temperature — diaphragm seals don't forgive overheating." When alarms fire, she suggests causes. She is not a manual. She is a person you ask for help.

Vasquez replaces the "Thermo Bible" concept. Instead of a static reference book, the player has a living expert who delivers knowledge in context, through dialogue, with personality. Less directive than a manual — she advises, she doesn't instruct. She might say "I'd be worried about that CO₂ partial pressure" rather than "set the flash drum to 70 bar."

### Rescued Survivors

Survivors are discovered during salvage expeditions at scripted moments. Each adds demand (more O₂, more water, more food) and personality.

**Jin Park** — Found during M4 propulsion salvage.
Male, early 30s. Propulsion technician. Was in the engine section when it separated. Practical, quiet, strong. Good with heavy equipment. Finding him is tied to discovering the second vent — he survived because his compartment landed near another geothermal fissure.

**Amara Okafor & Tomás Reyes** — Found during M6 expedition.
Female, mid-30s (Amara). Environmental systems engineer. Was responsible for life support on the Calypso. Understands closed-loop systems — foreshadows M10. Male, early 40s (Tomás). Medical officer. His presence means injuries can be treated, Vasquez begins partial recovery. Both were sheltered in a reinforced crew compartment in the bow section, surviving on emergency supplies.

**Priya Sharma & Erik Lindqvist** — Found during M7/M8 expedition.
Female, late 20s (Priya). Agricultural scientist. Was tending the experimental crop module when the ship broke apart. Knows about plant growth, nutrient cycles, photosynthesis. Her arrival makes the greenhouse possible — she literally brought the seeds. Male, mid-50s (Erik). Structural engineer. Older, experienced, pragmatic. Good at improvising physical structures. His arrival enables expanding the base footprint.

**Final count: 7 survivors (4 women including Vasquez, 3 men including Kael).**

---

## 13. The Expert

Dr. Vasquez is the game's primary knowledge-delivery mechanism. She replaces a static reference manual with a character the player develops a relationship with.

**How she works mechanically:**
- **Contextual comments:** When the player inspects a unit, Vasquez may offer a remark about operating limits, typical problems, or design suggestions. These are not mandatory — they appear as a small dialogue bubble the player can expand or dismiss.
- **Alarm diagnosis:** When alarms fire, the player can "ask Vasquez" for analysis. She reads the alarm data and suggests probable causes. "Your flash drum outlet is almost pure vapor — that usually means you're not cooling enough upstream."
- **Mission briefing:** Before each mission, Vasquez explains the physics of what needs to happen. Not a step-by-step guide — a conceptual briefing. "We need to get that water vapor to condense. Think about what determines when a gas becomes a liquid."
- **Hints (progressive):** If the player struggles (multiple failed attempts, long time without progress), Vasquez offers increasingly specific hints. First attempt: conceptual. Second: directional. Third: nearly explicit. The player never feels stuck forever.
- **Celebration:** When missions complete, Vasquez reacts. Early missions: relief. Mid-game: dry satisfaction. Late game: genuine admiration. "I designed ISRU systems for ten years. You just built one from a junkyard. In a week."

**What she is NOT:**
- Not an omniscient narrator. She doesn't know the wreck layout or what's in unexplored areas.
- Not a walkthrough. She suggests, she doesn't prescribe. "Have you considered what happens at higher pressure?" not "set the compressor to 70 bar."
- Not always right. In rare cases, she expresses uncertainty. "I think that should work. I'm... honestly not sure. Try it."

---

## 14. The Narrative Arc

This is the full story of the game, told as a continuous narrative. Missions are the structural beats, but the story flows between and through them.

### Phase A — Survive (Days 0–10)

**Day 0 — The Crash.**

The screen is black. Sound of metal tearing, wind, impact. A slow fade-in: emergency lighting, red, flickering. The player character (Kael) is on the floor of a damaged hangar module. Sparks. Dust. The hiss of escaping atmosphere, quickly sealing as emergency bulkheads engage.

A voice from the darkness: "Hey — hey. Are you hurt?" Dr. Vasquez, pinned under a fallen equipment rack, one leg bent wrong. She's lucid, in pain, commanding. "Don't move that — move *this*. Get the rack off me. Good. Now seal that panel before we lose pressure."

Together they stabilize the shelter compartment. Vasquez directs Kael to activate emergency systems: O₂ bottles, LiOH scrubber, lighting. The shelter dashboard comes online. Five gauges, all red-to-yellow, all counting down.

Then: a deep rumble from below. Hot gas begins seeping through a crack in the floor. The vent.

Vasquez recognizes it immediately. "That's geothermal gas. H₂O, CO₂, methane, nitrogen... that's not a problem. That's a *goldmine*." She directs Kael to weld a crude manifold from hangar debris, throttle the flow, route it to a pipe stub. The tutorial is complete. The feed stream is live.

Vasquez, from her stretcher: "Okay. We have two weeks of oxygen, two weeks of water, and a hole in the ground that's venting everything we need to survive — if you can figure out how to use it. I can't walk. But I can think. Let's get to work."

**Mission 1 — Water (Days 1–2).**

Vasquez: "That vent gas is 500 Kelvin and 30% water vapor. If you cool it below 100°C, the water condenses. Simple as rain. You need a cooler and something to separate the liquid from the gas."

Salvage: the nearby wreckage (within 50m of the hangar) yields ship radiator panels and a cabin ventilation fan. Kael improvises an air cooler — finned panels with a fan blowing ambient air across them. A damaged pressure vessel becomes a flash drum. A storage container becomes a tank.

The player builds: Source → Air Cooler → Flash Drum → Tank.

**Visual reward:** Water drips into the tank. The first liquid. The water gauge on the shelter dashboard switches from red countdown to green "SUPPLIED ✓." Vasquez: "That's water. From alien air. Not bad for day one."

**Mission 2 — Oxygen (Days 3–5).**

The O₂ bottles are visibly emptying. The gauge is yellow, trending toward red. Vasquez: "We can make oxygen from that water. Electrolysis — split H₂O into H₂ and O₂. Same reaction that runs in reverse in a fuel cell. You'll need an electrolyzer and power."

Salvage: digging through shelter stores reveals an electrolyzer unit — a life-support spare, standard on any ship with a Sabatier loop. The battery bank provides power, but it won't last forever.

The player builds: Water Tank → Electrolyzer (powered by battery) → O₂ to shelter, H₂ to storage.

**Visual reward:** The O₂ gauge rises from yellow to green. The emergency klaxon — a background drone the player has been hearing since Day 0 — falls silent. Vasquez, quietly: "Breathe. We're going to be fine." A beat. "For now."

**Mission 3 — Fuel (Days 5–8).**

Vasquez: "You've got CO₂ from the vent off-gas and H₂ from the electrolyzer. There's a reaction — Sabatier. CO₂ plus hydrogen gives methane and water. Exothermic, so you don't even need to heat it. The water recycles back to the electrolyzer. The methane is fuel."

Salvage: first EVA-lite to the near debris field (100m radius). Kael finds a plate heat exchanger from a cooling loop, a static mixer section from a chemical processing line, and a catalyst bed from the ship's own Sabatier CO₂ recycler — cracked housing, but the catalyst is intact.

The player builds their first real process: CO₂ Tank + H₂ Tank → Mixer → Sabatier Reactor → HEX (cool products) → Flash Drum → CH₄ to tank, H₂O recycles.

This is the first mission with recycle — the water from the Sabatier goes back to the electrolyzer. The player must think about the whole chain, not just one unit.

**Visual reward:** Blue methane flame from a test burner. First controlled fire on the planet. Kael and Vasquez watch it in silence. Then Vasquez: "Methane. From CO₂ and water. That's not survival anymore. That's chemistry."

**The battery gauge is noticeably lower.** The electrolyzer has been drawing power for two days. The lights occasionally flicker. This isn't dramatic yet — but the trend is clear. Vasquez notices: "We're burning through that battery faster than I'd like."

### Phase B — Stabilize (Days 8–22)

**Mission 4 — Power (Days 8–11).**

The battery is at 35%. Baseline life support plus the electrolyzer are draining it steadily. Vasquez, urgently: "We need our own power. That methane isn't just fuel for later — it's fuel for *right now*. A gas turbine: compress air, burn fuel, expand through a turbine. The expansion generates more work than the compression costs. Net electricity."

Salvage: major EVA to the propulsion wreckage (500m). This is the first real expedition — Kael carrying tools, crossing rocky terrain, entering damaged ship sections. He finds:
- A diaphragm compressor from the ship's H₂ handling system
- A micro gas turbine (auxiliary power unit)
- A combustion chamber

And: **Jin Park**, propulsion technician, alive in a sealed compartment. He's been surviving on a pocket of breathable air and emergency rations. His compartment is near a second geothermal fissure — smaller, but active.

Two discoveries: a new crewmate (demand jumps to 3 people) and a second vent (fuel supply doubles). Both are needed — the turbine burns fuel faster than one vent can supply.

The player builds: Atmosphere Source → Compressor → Combustion Reactor (with CH₄ fuel) → Gas Turbine → Exhaust. The Sabatier and vent must run simultaneously to keep the turbine fed.

**Visual reward:** The lights come on. Not emergency red — real white light, across the whole shelter. The battery gauge switches from depleting to CHARGING. Vasquez shields her eyes. Jin, from the doorway: "I was starting to think I'd die in the dark." Vasquez: "Welcome to the grid."

**Mission 5 — Breathable Air (Days 11–16).**

The LiOH cartridges are running low. 8 of 20 remaining. Vasquez has been tracking the depletion curve. "We've got about four days of CO₂ scrubbing left. After that, the shelter atmosphere goes toxic. The planet's air has the O₂ we need — but 8% CO₂. We need to scrub it."

The principle: CO₂'s critical temperature is 304 K. The planet is 288 K. Compress air to ~70 bar, cool to ambient, and the CO₂ liquefies while the N₂ and O₂ stay gaseous. Flash-separate. Clean air.

Salvage: Kael fabricates a valve from spare parts and seals — the first piece of equipment that's built, not found. Workshop milestone.

The player builds a multi-stage compression train: Atmosphere → Compressor → Air Cooler → Compressor → Air Cooler → Flash Drum → Valve (pressure letdown) → Clean Air Tank. Liquid CO₂ exits the flash drum bottom.

This is the hardest Phase A mission. Two compressors in series, two intercoolers, pressure management, power budgeting (the compressors eat most of the 5 kW turbine output).

**Visual reward:** The airlock activates for the first time. Kael steps outside without emergency O₂. The camera pulls wide — the first time the player sees the planet's horizon clearly. Amber sky, dark rock, distant wreckage glinting in the sunlight. The LiOH cartridge gauge reads "RETIRED — Air processing online." Vasquez, over comms: "How's the weather?" Kael: "Cold. Beautiful."

**═══ SURVIVAL AUTONOMY ═══**
*Water, oxygen, power, and breathable air are all process-supplied. All five emergency countdowns are stopped. The colony is no longer dying — it's just uncomfortable, hungry, and small.*

**Mission 6 — Warmth (Days 17–22).**

The shelter is 15°C. Not lethal, but everyone is cold. Sleeping is difficult. Vasquez's injuries heal slowly in the chill.

Vasquez: "We have everything we need to build a heat pump. Compressor, heat exchangers, a valve. CO₂ from the atmosphere as the working fluid. You compress it, it gets hot — reject that heat into the shelter. Expand it, it gets cold — absorb heat from outside. Net effect: heat moves from the cold planet into the warm shelter. It costs you compressor work, but you get more heat out than the electricity you put in."

No new equipment — this is the first mission using only what's already in inventory. The concept is the new thing: a closed thermodynamic cycle. Working fluid that goes around forever.

The player builds a closed CO₂ loop: Compressor → HEX (rejects heat to shelter) → Valve (expands, cools) → HEX (absorbs heat from ambient) → back to compressor.

Teaching moment: if the player dumps too much heat, the shelter overheats. They must tune the heat pump output. First experience with "more isn't always better."

Salvage EVA to the bow section: **Amara Okafor** and **Tomás Reyes** found alive in a reinforced crew compartment. They've been rationing emergency supplies for over two weeks. Tomás (medical officer) can now treat Vasquez properly — she begins recovering.

Population: 5 survivors. Demand jumps significantly. The food counter accelerates.

**Visual reward:** Temperature on the shelter display rises from 15°C to 22°C. Frost on interior surfaces melts. People take off emergency thermal blankets. The lighting shifts from harsh white to warm amber — someone found a way to adjust the spectrum. It finally looks like a place where people live, not where people survive.

### Phase C — Expand (Days 22–42)

**Mission 7 — Fertilizer (Days 22–29).**

The MRE crate is getting lighter. At 10 MREs per day for 5 people, the counter is visibly dropping. Vasquez: "We can't eat rations forever. We need nitrogen chemistry — ammonia. That means Haber synthesis."

This is the iconic chemical engineering process: N₂ + 3H₂ → 2NH₃. Equilibrium-limited — only ~15% conversion per pass. Must recycle unreacted gas. Argon from the feed slowly accumulates — requires a purge. The player must balance purge rate: too little, Ar kills conversion; too much, wastes reactants.

Salvage: deep EVA into the ship's chemistry laboratory. Kael and Jin find:
- An inline electric heater (for preheating syngas to reaction temperature)
- Pipe tee section (for building a splitter/purge point)
- A canister of Haber catalyst
- Pages from a technical manual — Vasquez recognizes Dr. Kenji Watanabe's notes (the ship's chief chemist, status unknown)

The player builds: N₂ Source + H₂ Tank → Mixer → Compressor (→100 bar) → Heater (→450°C) → Reactor (Haber) → Air Cooler → Flash Drum → Splitter (purge vs recycle) → recycle to mixer. NH₃ liquid exits the flash drum.

**Priya Sharma** arrives with the salvage party — she was sheltering in the agricultural pod adjacent to the chemistry lab, alive because the pod had its own small life-support system. She brings seeds, growth substrate, and knowledge.

**Visual reward:** The first greenhouse module activates. Green plants visible through a window panel. It's small — just a test bed — but the color is shocking after weeks of metal and rock. The shelter display adds: "FOOD: SUPPLEMENTED (40%)." Priya, standing in front of the grow lights: "Give me nitrogen and water and light. I'll give you food."

**Erik Lindqvist** found nearby — the structural engineer was in a maintenance corridor. Population: 7.

**Mission 8 — More Power (Days 29–36).**

Seven people. The turbine's 5 kW is strained. The Haber compressor, the heat pump, the air processor, the electrolyzer, basic lighting — everything is fighting for power. Sometimes things trip off. Vasquez: "That turbine exhaust is still 600 Kelvin. We're venting enough heat to run a second generator. What if we boil water with it?"

Combined cycle: Brayton top (existing M4 turbine) + Rankine bottom (new). The exhaust heat boils water. Steam drives a second turbine. The steam condenses in an air cooler. A pump pushes the liquid back to the boiler. Same fuel, nearly double the power.

Salvage: Kael returns to the propulsion section. Deeper this time — into the fuel handling systems. Finds a metering pump from the propellant transfer line.

The player builds the Rankine bottoming cycle: Turbine Exhaust → HEX (boiler, water side) → Gas Turbine #2 (steam expansion) → Air Cooler (condenser) → Pump → back to boiler.

Teaching moment: the pump work is negligible. Compressing a liquid costs almost nothing compared to compressing a gas. This is why power plants use steam cycles — liquid water is nearly incompressible.

**Visual reward:** A second generator comes online. The workshop wing of the hangar lights up — bright overhead illumination. The power gauge goes from yellow "TIGHT" to green "SURPLUS." Priya gets full grow-light power for the greenhouse. The food situation stabilizes. Vasquez: "When the history of this colony is written — if anyone ever writes it — this is the moment it stopped being survival and started being engineering."

**Mission 9 — Reserves (Days 36–42).**

The colony works. Power, water, air, food — all supplied. But everything is gaseous, fragile, flow-dependent. If the turbine trips, power dies. If the vent clogs, water stops. There are no reserves.

Vasquez: "Liquids store dense. A tank of liquid oxygen holds a thousand times more O₂ than the same tank of gas. If we can liquefy our O₂ and CH₄, we have reserves that last weeks instead of hours. And liquid propellant means the rover can move."

Cryogenic liquefaction: compress O₂, cool to ambient, use a counterflow HEX to pre-cool with recycled cold gas, expand through a turboexpander (the gas turbine running backwards — making cold instead of power), final J-T expansion through a valve, flash-separate liquid from remaining vapor, recycle the cold vapor.

Salvage: the cargo hold, deepest in the wreck. This is a major expedition. Finds vacuum-insulated Dewar tanks — the ship's cryogenic propellant storage.

The player builds a Linde-cycle variant with turboexpander assist: O₂ Feed → Compressor → Air Cooler → Counterflow HEX (warm side) → Splitter → [one branch: Turboexpander (→ cold) → back to HEX cold side] → [other branch: Valve (J-T) → Flash Drum → Liquid to Dewar tank, vapor recycles through HEX cold side].

**Visual reward:** Cryogenic plumbing appears outside the hangar — frost-covered pipes, vapor plumes, the white fog of extreme cold meeting warm air. A rover fueling station takes shape. The displays show: "LIQUID O₂: 50 mol stored. LIQUID CH₄: 50 mol stored. PROPELLANT STATUS: READY." The rover, assembled from wreck components by Erik over the past weeks, sits waiting.

### Phase D — Sustain (Day 42+)

**Mission 10 — Closed Biosphere.**

Priya: "I've been thinking about this since the greenhouse came online. Right now, we grow food, we eat it, we exhale CO₂, and we scrub the CO₂ industrially. But that's what plants DO. A plant takes in CO₂ and water, locks the carbon into biomass, and releases oxygen. The greenhouse isn't just a food source — it's an air processor. If we close the loop, the colony breathes through its plants."

The revelation: an ecosystem is a process network. CO₂ from humans feeds plants. O₂ from plants feeds humans. Water cycles through both. The player has been building this network piece by piece across nine missions. M10 closes the loop.

The Room, which has been a consumer-with-gauges for the entire game, is now revealed as a tank with real composition dynamics. The Humans, who were implicit consumers, become explicit reactor units with visible mass and energy balances. The Greenhouse, which was a food supplement, becomes the primary air processor.

The player connects: Room (air out) → Greenhouse (processes CO₂, returns clean air + food) → Human (breathes, eats, exhales) → Room. External inputs: water (M1), NH₃ makeup (M7), electricity for grow lights (M8), cooling.

Vasquez, now mobile with a cane (thanks to Tomás), stands in the greenhouse. She looks at the flowsheet — the complete colony process diagram, every stream balanced, every loop closed. "You know what this is? This is what I came to Planet X to prove could be done. A self-sustaining colony from in-situ resources." A pause. "I just didn't plan on doing it the hard way."

**Visual reward:** The rover departs. Kael drives. The camera pulls back — slowly — revealing the full base from above. The hangar module, expanded with new wings. The greenhouse, glowing green. The process equipment: tanks, piping, the turbine stack with its heat shimmer, the cryogenic section with its frost plumes, the air processing train, the Haber loop. All of it built from salvage, all of it running. All of it real.

Statistics overlay: total units placed, total energy generated, total water produced, total O₂ produced, total food grown, days survived. The colony roster: seven names, seven portraits.

A radio crackle. Static. Then: a voice. Faint, breaking up. "...Calypso survivors... this is... orbital... we see your... thermal signature..." The signal fades. The screen holds on the rover, driving toward the horizon.

**END OF CAMPAIGN. HOOK FOR BEYOND.**

---

## 15. The Wreck Field

The Calypso wreckage is distributed across a landscape centered on the hangar module landing site. Salvage geography maps to gameplay capability:

| Zone | Distance | Accessible from | Contents |
|------|----------|-----------------|----------|
| **Immediate** (hangar surrounds) | 0–50m | M1 (Day 0) | Radiator panels, cabin fan, empty vessels, pipe sections, basic tools |
| **Near debris** | 50–200m | M3 (Day 5) | HEX, mixer, catalyst bed, small components |
| **Propulsion field** | 500m–1km | M4 (Day 8, first major EVA) | Compressor, gas turbine, combustion chamber. Second vent. Jin Park |
| **Bow section** | 1–2km | M6 (Day 17, EVA now routine) | Crew quarters. Amara & Tomás. Medical supplies, personal effects |
| **Chemistry lab** | 800m (inside midsection, deep) | M7 (Day 22) | Heater, pipe fittings, Haber catalyst, technical notes. Priya & Erik |
| **Cargo hold** | 1.5km (deepest in wreck) | M9 (Day 36) | Dewar tanks, agricultural pod, heavy equipment, rover frame |

Each salvage expedition is a narrative beat with its own mini-story: the trek, the discovery, the danger (unstable structures, residual pressurized compartments, darkness), and the return with new capability. They get longer and more ambitious as the player's EVA infrastructure improves.

The second vent (discovered during M4 salvage) is 600m from the base, near the propulsion wreckage. Jin's survival compartment is adjacent to it. Piping the second vent back to base is itself a small logistical challenge — another teaching moment about pressure drop and flow.

---

## 16. Wreck Lore & Flavor

Scattered throughout the wreck are data pads, terminal logs, notice boards, and personal effects. These are discovered during salvage and delivered as text snippets — readable in the moment, archived for later review.

**Corporate memos:** Meridian Extractives communications about survey timelines, budget constraints, "risk-adjusted scheduling." Dry, bureaucratic, damning in retrospect. "The frame inspection interval has been extended from 2,000 to 3,500 flight-hours per Technical Bulletin 2247-R3. This represents significant schedule savings."

**Chief Engineer's logs (Mariko Tanaka):** Personal recordings. Increasingly frustrated. "Frame 7-B is showing fatigue indicators consistent with Table 9 projections. Requested inspection halt. Denied. 'We'll catch it at Proxima refit.' That's eight months from now." Her final entry: "If anyone finds this, check Frame 7-B."

**Passenger notes:** Mundane, human, sometimes funny. A botanist's sketches of imagined alien plants. A recipe for "zero-g pasta" (terrible). A love letter, unsent. A child's drawing of the ship (a passenger family). These humanize the wreck — it was full of people, not equipment.

**Automated systems:** The Calypso's AI still runs fragments of its monitoring protocols. Salvaged terminals occasionally display system status from the moment of breakup: "STRUCTURAL ALERT — FRAME 7-B — CRITICAL — EVACUATE AFT SEC—" frozen mid-message.

The tone is controlled darkness with moments of warmth. The lore rewards exploration but never blocks progress. A player who ignores every data pad loses flavor, not capability.
