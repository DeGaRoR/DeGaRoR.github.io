# PTIS_GAME_DESIGN
## Process This In Space — Game Design Document
### Unified creative reference · February 2026

---

> **Scope.** This document defines the creative vision: philosophy, tone,
> narrative, missions as player experiences, equipment as story, biosphere
> concept, and UX vision. It contains no code schemas, no port tables,
> no test matrices. For implementation detail, see `PTIS_S10_SPEC.md`.
> For canonical numbers (metabolic rates, power budgets, limits), see
> `PTIS_EQUIPMENT_MATRIX.md` and `PTIS_BIOSPHERE_POWER_RECONCILIATION.md`.

---

# PART I — THE GAME

---

## 1. Elevator Pitch

A large ship breaks apart over an alien planet. You survive inside a
torn-off hangar section with one injured crewmate, a punctured
geothermal vent, and enough emergency supplies for two weeks. Using
salvaged equipment, real thermodynamics, and a lot of trial and error,
you build the chemical processes that keep you alive — then keep others
alive — then turn a crash site into a self-sustaining colony.

It's Kerbal Space Program meets Factorio meets survival. You
accidentally learn chemical engineering. Every explosion teaches
you something.

---

## 2. Core Fantasy & Tone

**The fantasy:** *"I'm not a hero — I'm the kind of nerd who figures
it out."*

The player isn't a soldier, a commander, or a chosen one. They're a
resourceful person who understands (or learns to understand) that the
world runs on mass and energy, and that if you respect the physics,
you can make anything from almost nothing.

**Tone progression:**
- **Phase A (M1–M3) — Survive:** Grim survival. Everything is
  fragile. Emergency lighting. Countdowns ticking. Every success is
  a reprieve, not a victory.
- **Phase B (M4–M6) — Stabilize:** Gallows humor creeps in.
  Dr. Vasquez makes dry remarks about "optimistic design margins."
  The base starts to feel like a place, not a shelter.
- **Phase C (M7–M9) — Expand:** Competence. The player knows what
  they're doing. The base looks industrial. New survivors bring
  personality and problems. Dark humor about corporate negligence
  from wreck logs.
- **Phase D (M10) — Sustain:** Pride. The pull-back shot. You built
  this. From a crash and a leaking vent, you built an ecosystem.
  The tone is quiet awe, not triumphalism.

---

## 3. Selling Points

**Real physics, not approximated.** Mass and energy are conserved.
Heat flows downhill unless you pay with work. Phase behavior follows
real thermodynamics. When your compressor overheats or your flash drum
doesn't separate, it's because the physics says so.

**Every failure is spectacular and educational.** Overpressure a
vessel? It ruptures. Forget to cool a reactor? Thermal runaway.
The failures are visual, dramatic, and always traceable to a physical
cause. You learn by breaking things.

**You accidentally learn chemical engineering.** By Mission 10, the
player has built: a condensation train, an electrolyzer, a Sabatier
reactor, a Brayton power cycle, a multi-stage compression system, a
heat pump, a Haber synthesis loop with recycle and purge, a Rankine
bottoming cycle, a cryogenic liquefaction train, and a closed
biosphere. These are real industrial processes. The player learns
them by needing them, not by studying them.

**No magic, no tech tree.** Every piece of equipment is a real,
nameable machine you could point at in a pilot plant. No "Research:
Advanced Thermodynamics Level 3." You get new capability by finding
a compressor in the wreckage and dragging it back to base.

**3D pipe-laying satisfaction.** The primary interface is a 3D plant
view where you place equipment and connect it with pipes. Think
Satisfactory's factory building meets the consequence of Kerbal's
launches.

**Survival stakes with real systems.** O₂ runs out. CO₂ accumulates.
The battery dies. Each mission replaces one countdown with a
sustainable process. The transition from "12 days of oxygen left"
to "oxygen: supplied ✓" is one of the most satisfying feelings in
gaming — and it's backed by real chemistry.

---

## 4. Reference Games & What We Take

| Game | What we take |
|------|-------------|
| **Kerbal Space Program** | Build-test-explode-learn loop. Checkpoint on commit. Time warp when stable. Revert on failure. |
| **Factorio** | Logistics satisfaction of watching a process run. Scaling challenge: what works for 2 doesn't work for 7. Optimization itch. |
| **Oxygen Not Included** | Survival systems with real (simplified) physics. O₂, CO₂, temperature, water cycling. Everything connects to everything. |
| **Cities: Skylines / Frostpunk** | Visual feedback as reward. Watching your settlement grow. The 3D view IS the reward. |
| **Satisfactory** | 3D pipe and conveyor laying as core gameplay. The satisfaction of clean routing. Pride in organized layout. |

---

# PART II — GAME PHILOSOPHY

---

## 5. The Three Promises

The game's contract with the player. Non-negotiable.

**Promise 1 — Conservation.** Mass in equals mass out, energy in
equals energy out. Nothing comes from nowhere. Nothing vanishes.
The player can trust the numbers.

**Promise 2 — Second Law.** Heat flows from hot to cold. A cooler
without a cold source does not cool. You cannot move heat uphill
without paying with work. When the player builds a heat pump and
sees COP > 1, they know it's real.

**Promise 3 — What You See Is What You Get.** If a wire doesn't
exist on screen, it doesn't exist in the solver. An unconnected
port carries zero. Every unit in the palette is a real, nameable,
physically purchasable piece of equipment.

Together: **this world does not cheat.** Not in the player's favor,
not against them.

---

## 6. How It Plays

**The model IS the plant.** No safe simulation sandbox. Press play
and real improvised equipment runs. Physical consequences are
immediate.

**Build → Run → Watch → (Fail?) → Learn → Reset.** The core loop
is Kerbal's. Design on a frozen world. Press play. Physics happens.
Checkpoint-revert on failure.

**Topology edits pause the world.** Adding equipment, connecting
pipes, deleting units — construction happens with the world frozen.

**Parameter tweaks are live.** Valve openings, setpoints, pressure
ratios — adjusted in real time while the process runs. This is how
real operators work.

**Checkpoint on every play press.** Auto-saves current state. Revert
to last stable checkpoint on catastrophic failure.

**Time warp when stable.** Accelerate to reach production targets.
Auto-decelerates on instability or alarms.

---

## 7. Economy & Progression

**No money. Scarcity of physical parts.** "3 valves, 2 tanks,
1 compressor." Palette shows count badges. Greys out when depleted.

**Salvage drives capability.** New equipment from EVA expeditions to
the wreck field. Not research — find it, carry it, figure it out.

**Piping is free. Equipment is scarce.** Rerouting costs nothing but
engineering insight. Equipment is limited to what you've found.

**Demand grows with survivors.** Scripted rescues add mouths to feed
and lungs to breathe. Systems built for two don't work for seven.

**Every mission replaces a countdown with a process.** Red countdown
→ green "SUPPLIED ✓" is the core reward.

---

## 8. Physics Ground Rules

**Correctness over accuracy.** The simulator refuses outcomes that
violate fundamental laws. It doesn't chase 0.1°C agreement with
industrial data.

**Stability over sophistication.** When advanced realism threatens
solver stability or playability, we choose pragmatic simplification
— as long as fundamentals stay intact.

**Trends must be right.** Increase pressure → equilibrium shifts
correctly. Cool a mixture → the right species condenses first.
Compress → temperature rises. These causal relationships are the
curriculum. Getting them wrong is unforgivable. Getting the third
decimal right is optional.

**Discovery-friendly realism.** The player should be able to ask
"what happens if I...?" and try it. The answer should always be
physically plausible. A playground with real gravity.

---

# PART III — THE STORY

---

## 9. Planet X — The World

Planet X is deceptively Earth-like. Comfortable gravity. Reasonable
pressure. Breathable-looking sky. The kind of planet that makes you
think "we could live here" — until you check the CO₂.

| Parameter | Value | Design intent |
|-----------|-------|---------------|
| Atmosphere | 70% N₂, 21% O₂, 8% CO₂, 1% Ar | 8% CO₂ is the poison pill — lethal, invisible. O₂ is right there but unusable. |
| Surface pressure | 0.885 atm (89,750 Pa) | Close enough that equipment works normally. |
| Surface temperature | 288 K (15°C) | Chilly. Just below CO₂ critical T (304 K) — makes transcritical cycles natural for M6. |
| Geothermal vents | ~500 K, H₂O/CO₂/N₂/CH₄ | Hot enough for water vapor. Rich enough to bootstrap a chemical industry. The planet's gift. |

Every number serves a gameplay purpose. The Ar creates the
inert-accumulation problem in M7's Haber loop.

---

## 10. The Ship — ISV Calypso

The **ISV Calypso** was an interstellar survey vessel operated by
Meridian Extractives, a resource-prospecting corporation. Mixed-use:
crew quarters for 40, a deployable ISRU module, cryogenic propulsion
(liquid H₂/CH₄/O₂), chemistry lab, small agricultural research pod.

The ship was on a flyby survey — not a colony mission. Mostly
scientists and engineers. The ISRU module justifies every piece of
equipment the player salvages: the diaphragm compressor from the gas
processing train, the Sabatier catalyst bed from life-support spares,
the micro turbine from auxiliary power, the agricultural pod's seeds
and grow lights for M10's greenhouse.

**Wreck log fragments** reveal the backstory: corporate memos about
"acceptable survey risk margins," a chief engineer's private log
about maintenance deferrals, a final automated distress broadcast.
Dark-corporate-comedy tone: a competent crew undone by budget-driven
management.

---

## 11. The Crash

Catastrophic structural failure during atmospheric survey — metal
fatigue in a load-bearing frame, deferred maintenance.

Three major sections:
- **The bow** (crew quarters): 2 km northwest. Some survivors in
  reinforced compartments.
- **The midsection** (engineering, ISRU, lab): debris field
  500m–1km. Heavy equipment, mostly intact.
- **The hangar module**: tears free, lands relatively intact near a
  rocky outcrop. Starting base.

Impact punctures a hydrothermal pocket. Hot pressurized gas leaks
into the lower compartment. Dangerous — but also the most valuable
thing on the planet.

The vent leak is handled narratively. Mission 1 begins with the feed
available.

---

## 12. The Characters

Gender balance across all characters is intentional — approximately
50/50. This is a STEM game, and representation matters.

### Starting Pair (Day 0)

**Kael Osei** — The player character. Male, late 20s. Junior systems
technician. Not an engineer — someone who maintained equipment and
understood how things connected. Resourceful, practical, physically
capable. Speaks rarely (player-insert); internal monologue in loading
screens and journal entries.

**Dr. Lena Vasquez** — The Expert. Female, mid-40s. Chemical
engineer, lead ISRU specialist. Brilliant, dry-humored, precise.
Injured in the crash — broken leg, cracked ribs. Cannot move, cannot
EVA. But she knows thermodynamics like she breathes it. She is the
player's knowledge source: tutorials, hints, diagnosis, contextual
commentary. She replaces a static reference book with a living expert
who delivers knowledge in context, with personality. She advises; she
doesn't instruct.

### Rescued Survivors

| Character | Found in | Crew role | What they add |
|-----------|----------|-----------|--------------|
| **Jin Park** | M4 (propulsion) | Propulsion tech | Male, early 30s. Practical, quiet, strong. Found near second vent. |
| **Amara Okafor** | M6 (bow) | Environmental systems | Female, mid-30s. Understands closed loops — foreshadows M10. |
| **Tomás Reyes** | M6 (bow) | Medical officer | Male, early 40s. Enables injury treatment; Vasquez begins recovery. |
| **Priya Sharma** | M7 (lab) | Agricultural scientist | Female, late 20s. Brings seeds and greenhouse knowledge. Makes M10 possible. |
| **Erik Lindqvist** | M7 (lab) | Structural engineer | Male, mid-50s. Enables base expansion. Builds rover frame. |

Each rescue is a story moment and a step-change in resource demand.

### Population Timeline

| Day | Pop. | Event |
|-----|------|-------|
| 0 | 2 | Crash (Kael + Vasquez) |
| ~10 | 3 | +Jin (M4 salvage) |
| ~22 | 5 | +Amara, Tomás (M6 salvage) |
| ~27 | 7 | +Priya, Erik (M7 salvage) |

---

## 13. The Wreck Field

| Zone | Distance | Accessible | Contents |
|------|----------|-----------|----------|
| Immediate | 0–50m | M1 | Radiator panels, cabin fan, vessels, pipe, tools |
| Near debris | 50–200m | M3 | HEX, mixer, catalyst bed, small components |
| Propulsion field | 500m–1km | M4 | Compressor, gas turbine, combustion chamber. Second vent. Jin. |
| Bow section | 1–2km | M6 | Crew quarters. Amara & Tomás. Medical supplies. |
| Chemistry lab | 800m | M7 | Heater, Haber catalyst, technical notes. Priya & Erik. |
| Cargo hold | 1.5km | M9 | Dewar tanks, agricultural pod, rover frame. |

Each salvage expedition is a narrative beat with its own mini-story:
trek, discovery, danger (unstable structures, residual pressurized
compartments, darkness), and return with new capability.

---

## 14. Wreck Lore & Flavor

Scattered data pads, terminal logs, notice boards, personal effects.
Discovered during salvage, archived for later review.

**Corporate memos:** Dry, bureaucratic, damning. "The frame
inspection interval has been extended from 2,000 to 3,500
flight-hours per Technical Bulletin 2247-R3."

**Chief Engineer's logs (Mariko Tanaka):** Increasingly frustrated.
Her final entry: "If anyone finds this, check Frame 7-B."

**Passenger notes:** Mundane, human, sometimes funny. Zero-g pasta
recipes. Unsent love letters. A child's drawing of the ship.

**Automated systems:** Frozen mid-message from the moment of breakup.

The lore rewards exploration but never blocks progress.

---

# PART IV — THE MISSIONS

---

## 15. Mission Flow

Every mission follows the same rhythm:

1. **Briefing** — Vasquez (and later others) explain the problem.
   Dialogue establishes stakes, teaches relevant physics, and
   provides just enough direction without solving it.
2. **Build** — World frozen. Equipment placed, pipes laid. Palette
   shows available equipment with count badges.
3. **Commit (Play)** — Auto-checkpoint. World begins ticking.
4. **Run** — Watch physics happen. Adjust parameters live. Time
   warp when stable. Alarms when things go wrong.
5. **Evaluate** — Objectives checked. Star rating computed.
6. **Debrief** — Narrative payoff. Visual reward. Rewards applied.

On catastrophic failure: revert to checkpoint, try again. The lesson
is in the failure.

---

## 16. Campaign Structure

```
PHASE A — SURVIVE (Days 0–8)
  M1  Water          First process. Condensation.
  M2  Oxygen         Electrolysis. Power consumption.
  M3  Fuel           Sabatier. Recycle. HEX cooling.

PHASE B — STABILIZE (Days 8–27)
  M4  Power          Brayton cycle. First electricity.
  M5  Air            Multi-stage compression. CO₂ removal.
  M6  Warmth         Heat pump. COP. Closed cycle.

PHASE C — EXPAND (Days 27–42)
  M7  Fertilizer     Haber synthesis. Recycle/purge. Inerts.
  M8  More Power     Rankine bottoming. Combined cycle.
  M9  Reserves       Cryogenic liquefaction. Linde cycle.

PHASE D — SUSTAIN (Day 42+)
  M10 Biosphere      Closed ecosystem. The final boss.
```

Missions are sequential. Each inherits the scene and accumulated
equipment from prior completions.

---

## 17. The Missions (Player Experience)

### Phase A — SURVIVE

#### Mission 1 — Water (Days 0–3)

The vent is blasting hot mixed gas into the hangar. It's a dangerous
nuisance — and also the only source of everything they need.

Vasquez, immobilized, talks Kael through the basics: "That vent gas
is 500 Kelvin. It's carrying water vapor, CO₂, N₂, methane. If you
cool it below 100°C, the water condenses. That's all condensation is
— get cold enough and vapor turns liquid."

The player builds their first process: Vent → Air Cooler → Flash
Drum → Tank. Cool the hot gas, let gravity separate liquid from
vapor, collect the water. Simple, tangible, immediately rewarding.

**Teaching moment:** Temperature approach in the air cooler. The
ambient air at 288 K can only cool the vent gas to ~298 K (10 K
approach). That's enough to condense water, but only barely. The
player sees how much water they get — and starts thinking about how
to cool further.

**Visual reward:** Water drips into the tank. A gauge: "WATER:
100 mol collected." The water countdown pauses. Emergency supplies
last longer.

**Stars:** ★ 100 mol water. ★★ 200 mol. ★★★ 200 mol with only
1 collection tank.

---

#### Mission 2 — Oxygen (Days 3–5)

Water is chemistry's universal solvent. Split it and you get the
two things you need most: hydrogen (fuel) and oxygen (breathable).

Vasquez: "Water electrolysis. Run electricity through water. Hydrogen
comes off one electrode, oxygen off the other. The catch: it takes
energy. Real energy. And right now, all we have is that battery."

The player adds an electrolyzer (reactor_electrochemical with
R_H2O_ELEC). Water in, power in, H₂ out one port, O₂ out another.
Two outlets — cathode and anode — because the gases must not mix.

**Teaching moment:** Power consumption. The electrolyzer drains the
battery visibly. The player watches the battery gauge fall and
understands: making oxygen isn't free. Every mole costs energy. This
sets up M4's motivation — sustainable power.

**Visual reward:** O₂ accumulates in a tank. The O₂ countdown pauses.
Emergency bottles are no longer the only source. Vasquez: "Fifty
moles of oxygen. That's two weeks of breathing for both of us. From
water and electricity. Chemistry works."

**Stars:** ★ 50 mol O₂. ★★ 100 mol H₂ (save the hydrogen). ★★★
Achieve both using ≤10 kWh from battery.

---

#### Mission 3 — Fuel (Days 5–8)

Hydrogen from M2 and CO₂ from the vent. The Sabatier reaction turns
them into methane and water. Methane is fuel. The water recycles back
to the electrolyzer. Two problems solved with one reaction.

Vasquez: "CO₂ plus 4H₂ gives CH₄ and 2H₂O. The Sabatier reaction.
Exothermic — it releases heat. But the equilibrium temperature
matters. Too hot, conversion drops. You need to cool the reactor
outlet and recycle."

The player builds: H₂ + CO₂ → Mixer → Reactor (R_SABATIER) → HEX
(cool products) → Flash Drum (liquid water separates) → Tank (CH₄).
The unconverted gas recycles.

**Teaching moment:** Recycle loops. The player must connect the flash
drum vapor back to the mixer inlet. First encounter with recycle —
the concept that not everything converts in one pass, and that's
okay. Also: HEX cooling. The reactor runs hot; the products must be
cooled before the flash drum can separate phases.

**Visual reward:** Methane fills a tank. Vasquez: "That's rocket
fuel. Well, barbecue fuel. But on this planet, same difference."

**Stars:** ★ 20 mol CH₄ (purity ≥90%). ★★ Water recycle sustained
10 min. ★★★ ≤85 mol H₂ consumed total.

---

### Phase B — STABILIZE

#### Mission 4 — Power (Days 8–12)

The battery is dying. Everything runs on stored energy that's not
being replenished. M4 is the crisis point: build a power source or
lose everything.

Salvage expedition to the propulsion wreckage — the biggest EVA yet.
Kael finds a diaphragm compressor, a micro gas turbine, and a
combustion chamber. Also finds Jin Park, alive, sheltering near a
second geothermal vent.

Vasquez: "Burn the methane. A turbine converts hot expanding gas into
shaft work. But you need to compress the air first — otherwise the
expansion ratio is too low to generate net power. Compression costs
work. Expansion produces work. The trick is that hot expansion
produces more than cold compression consumes. That's the Brayton
cycle."

The player builds: Atmospheric Air → Compressor → Reactor (R_CH4_COMB,
locked to combustion, no heat port) → Gas Turbine → Exhaust. CH₄ feed
from M3 tank. Net power out = turbine work − compressor work.

**Teaching moment:** Why a power cycle works. The compressor raises
pressure. Combustion raises temperature. The turbine expands hot gas
back to low pressure. Hot expansion produces more work than cold
compression consumes. The difference is net power. This is the
fundamental insight of thermodynamic power generation.

**Visual reward:** Lights come on. Real lights — overhead
illumination replacing emergency strips. The workshop area of the
hangar illuminates. Power gauge: "5.0 kW NET." Vasquez: "First time
I've been warm in eight days."

**Stars:** ★ 5 kW sustained 5 min. ★★ Battery now charging. ★★★
Achieve 5 kW with ≤4 units in the power loop.

---

#### Mission 5 — Air (Days 12–17)

With power, the base can run continuous processes. The next
bottleneck: breathable air. Planet X's atmosphere is 8% CO₂ —
lethal. The room needs clean N₂/O₂.

Vasquez: "We need to remove CO₂ from atmospheric air. CO₂ liquefies
at high pressure near ambient temperature — its critical point is
304 K, 73.8 bar. Compress the air, cool it, and the CO₂ drops out
as a liquid."

The player builds multi-stage compression with intercooling:
Atmosphere → Compressor → Air Cooler → Compressor → Air Cooler →
Flash Drum → [Liquid CO₂ to waste / Clean gas to room].

**Teaching moment:** Multi-stage compression and why intercooling
matters. Compressing in one stage would overheat the gas (and the
compressor). Two stages with cooling between them: each stage does
less work, and the gas stays manageable. Also: CO₂ near its critical
point — the player sees real phase behavior.

**Visual reward:** Clean air flowing into the shelter. The CO₂
gauge drops from red to green. For the first time, the door can open
without an alarm. Jin and Kael can work without masks.

**Stars:** ★ 500 mol clean air (<0.5% CO₂). ★★ 50 mol liquid CO₂
collected. ★★★ Air purity <0.1% CO₂.

---

#### Mission 6 — Warmth (Days 17–22)

The shelter is 15°C and falling. With Amara and Tomás rescued from
the bow section (five people now), body heat helps, but the hangar
is too large. The planet is cold.

Vasquez: "A heat pump. It moves heat from cold to hot — the opposite
of natural heat flow. That's why it costs work. But for every watt
of electricity you put in, you get 2 or 3 watts of heating. That's
the coefficient of performance — COP."

The player builds a refrigeration/heat pump cycle: working fluid in
a loop — Compressor → HEX (reject heat to room, hot side) → Valve
(expand, cool) → HEX (absorb heat from atmosphere, cold side) → back
to Compressor.

**Teaching moment:** COP > 1 is not free energy. The heat pump moves
existing environmental heat into the shelter, using work to push it
uphill. The electricity provides the driving force, not the energy
content. This is one of the deepest insights in thermodynamics.

**Visual reward:** The shelter warms. Frost melts off interior
surfaces. The temperature gauge settles into green (293–300 K).
Amara and Tomás can finally remove their emergency blankets. Vasquez:
"Twenty degrees. I'd forgotten what comfortable felt like."

**Stars:** ★ Room T 293–300 K sustained 30 min. ★★ COP ≥ 2.5.
★★★ COP ≥ 3.0.

---

### Phase C — EXPAND

#### Mission 7 — Fertilizer (Days 22–27)

Priya needs ammonia for the greenhouse nutrient solution. N₂ is 70%
of the atmosphere. H₂ is available from electrolysis. The Haber
process turns them into NH₃.

Vasquez: "N₂ plus 3H₂ gives 2NH₃. The Haber reaction. But
conversion per pass is only 15–25% at practical temperatures. You
need a recycle loop — and you need to deal with the argon."

The player builds: N₂ + H₂ → Mixer → Heater → Reactor (R_HABER) →
Air Cooler (cool products) → Flash Drum (liquid NH₃ separates) →
Tank. Vapor (unreacted N₂/H₂ + inert Ar) recycles to mixer.

**Teaching moment:** Inert accumulation. Argon (1% of atmospheric
N₂ feed) doesn't react. It builds up in the recycle loop, diluting
reactants and killing conversion. The player must add a purge —
bleeding off a fraction of the recycle to remove Ar. This is the
classic recycle-purge problem of chemical engineering.

**Visual reward:** Liquid ammonia collects. Priya's eyes light up.
"With this, I can grow anything." The greenhouse dome framework
appears in the background — Erik is building the structure.

**Stars:** ★ 10 mol NH₃ (liquid). ★★ Ar purge stable 10 min.
★★★ >50% N₂ conversion.

---

#### Mission 8 — More Power (Days 27–32)

Seven people. Power is strained. Everything fights for the turbine's
5 kW. Sometimes things trip off.

Vasquez: "That turbine exhaust is still 600 Kelvin. We're venting
enough heat to run a second generator. What if we boil water with it?"

Combined cycle: Brayton top (existing M4 turbine) + Rankine bottom
(new). Exhaust heat boils water. Steam drives a second turbine.
Condenses in an air cooler. A pump pushes liquid back to the boiler.

Salvage: Kael returns to the propulsion section. Finds a metering
pump from the propellant transfer line.

**Teaching moment:** Pump work is negligible. Compressing a liquid
costs almost nothing compared to compressing a gas. This is why
power plants use steam cycles. The player sees it in the numbers.

**Visual reward:** A second generator comes online. The workshop
lights up with bright overhead illumination. Power gauge: yellow
"TIGHT" → green "SURPLUS." Vasquez: "This is the moment it stopped
being survival and started being engineering."

**Stars:** ★ 8 kW sustained 5 min. ★★ Pump work <5 W. ★★★ >35%
combined efficiency.

---

#### Mission 9 — Reserves (Days 36–42)

The colony works. But everything is gaseous, flow-dependent. If the
turbine trips, power dies. No reserves.

Vasquez: "Liquids store dense. A tank of liquid oxygen holds a
thousand times more than the same tank of gas. Liquefy our O₂ and
CH₄, and we have reserves for weeks."

Cryogenic liquefaction: compress, cool to ambient, counterflow HEX
with recycled cold gas, turboexpander (the gas turbine making cold
instead of power), JT expansion through a valve, flash-separate
liquid from vapor, recycle cold vapor.

Salvage: cargo hold — deepest in the wreck. Vacuum-insulated Dewar
tanks from the ship's cryogenic propellant storage.

**Teaching moment:** The Linde cycle with turboexpander assist.
Counterflow heat exchange. JT cooling. The elegant bootstrap: cold
vapor pre-cools incoming warm gas, making the next expansion colder
still, until liquid forms.

**Visual reward:** Cryogenic plumbing outside the hangar. Frost-
covered pipes. Vapor plumes. "LIQUID O₂: 50 mol. LIQUID CH₄: 50
mol. PROPELLANT STATUS: READY." The rover sits waiting.

**Stars:** ★ Both liquids stored (50 mol each). ★★ Single continuous
run. ★★★ Turboexpander work recovery.

---

### Phase D — SUSTAIN

#### Mission 10 — Closed Biosphere

Priya: "I've been thinking about this since the greenhouse came
online. A plant takes in CO₂ and water, locks the carbon into
biomass, and releases oxygen. The greenhouse isn't just a food source
— it's an air processor. If we close the loop, the colony breathes
through its plants."

The revelation: **an ecosystem is a process network.** CO₂ from
humans feeds plants. O₂ from plants feeds humans. Water cycles
through both. The player has been building this network piece by
piece across nine missions. M10 closes the loop.

The Room, which has been a consumer-with-gauges the entire game, is
now revealed as a tank with real composition dynamics. The Humans,
who were implicit consumers, become explicit reactor units with
visible mass and energy balances. The Greenhouse, which was a food
supplement, becomes the primary air processor.

The player connects: Room (air out) → Greenhouse (CO₂ → O₂ + food)
→ Human (breathes, eats, exhales) → Room. External inputs: water,
NH₃ makeup, electricity for grow lights, cooling.

**The power challenge:** The greenhouse demands ~85 kW at default 1%
lighting efficiency. This is the final engineering challenge.
Fabrication is unlocked ("Engineering team restores the ship's
workshop") — unlimited equipment counts. The player must build 4–5
combined cycle power blocks, using S8 group templates to manage the
PFD complexity. The greenhouse lighting efficiency (0.5–5%) is
editable — a design tradeoff between realism and practicality.

**The biosphere insight:** Three layers of abstraction, each a real
process:
- **Photosynthesis:** CO₂ + H₂O + light → CH₂O (food proxy) + O₂.
  An electrochemical reactor. Light energy replaces electrical energy.
- **Metabolism:** CH₂O + O₂ → CO₂ + H₂O + heat. An equilibrium
  reactor. Complete conversion at body temperature.
- **Gas exchange:** Membrane separators inside both composites. In
  the greenhouse (leaf): O₂ passes to air_out, CH₂O retained for
  food_out. In the human (kidney): NH₃ diverted to waste, exhaled
  gases pass through.

All three are built from the same engine units the player has been
using all game. The game doesn't hide physics — it assembles it. The
hidden achievement for players who Tab into the greenhouse and
recognize the reactor they used in M2 is the design payoff.

Vasquez, now mobile with a cane, stands in the greenhouse. She looks
at the complete colony process diagram — every stream balanced, every
loop closed. "You know what this is? This is what I came to Planet X
to prove could be done. A self-sustaining colony from in-situ
resources." A pause. "I just didn't plan on doing it the hard way."

**Visual reward:** The rover departs. Kael drives. Camera pulls back
— slowly — revealing the full base from above. The hangar, expanded.
The greenhouse, glowing green. Tanks, piping, turbine heat shimmer,
cryo frost plumes, air processing, Haber loop. All built from
salvage. All running. All real.

Statistics overlay: total units placed, total energy generated, total
water produced, total O₂ produced, total food grown, days survived.
Colony roster: seven names, seven portraits.

A radio crackle. Static. "...Calypso survivors... this is... orbital
... we see your... thermal signature..." The signal fades. The rover
drives toward the horizon.

**END OF CAMPAIGN. HOOK FOR BEYOND.**

**Stars:** ★ All conditions sustained 1 hr. ★★ Sustained 4 hr.
★★★ Wastewater recycle (≥50% water recovery).

---

# PART V — THE BIOSPHERE

---

## 18. Biosphere Design Concept

The closed biosphere is the culmination of every engineering skill
learned across the campaign. Its design philosophy:

**Plants are chemical reactors.** Photosynthesis is a real reaction
with real stoichiometry, real energy requirements, and real mass
balance. Not a magic "food generator" — a power-hungry
electrochemical reactor that converts CO₂ and H₂O into food (CH₂O)
and oxygen. The grow lights are the energy input.

**Humans are chemical reactors.** Metabolism is the reverse reaction.
Food and oxygen in, CO₂ and water out, plus heat. The human body is
an equilibrium reactor at 310 K with complete conversion.

**CH₂O as food proxy.** Formaldehyde (CH₂O) represents carbohydrates.
It's the simplest molecule with one carbon, one oxygen, and one water
of hydration. The stoichiometry: one mole of CH₂O provides one mole
of CO₂ fixation and one mole of O₂ release. This 1:1:1:1
stoichiometry makes mass and energy balance transparent. The player
can trace every atom.

**No black boxes.** Both greenhouse and human are S8 locked group
templates containing real, inspectable engine units. The player can
Tab in, click each unit, read the inspector, see the streams. The
teaching message: these "advanced" systems are just the same
components you've been using. The game doesn't hide physics — it
assembles it.

For detailed metabolic rates, greenhouse power budget, and NASA
cross-validation, see `PTIS_BIOSPHERE_POWER_RECONCILIATION.md`.

---

## 19. The Three Biosphere Abstractions

| Abstraction | Engine implementation | Physical analogue |
|---|---|---|
| Photosynthesis | reactor_electrochemical (R_PHOTOSYNTHESIS, η) | Chloroplast: light + CO₂ + H₂O → sugar + O₂ |
| Metabolism | reactor_equilibrium (R_METABOLISM, T=310K) | Mitochondria: sugar + O₂ → CO₂ + H₂O + heat |
| Gas exchange | membrane_separator (selectivity map) | Leaf stomata / kidney nephron |

The same engine units serve both composites. membrane_separator with
different selectivity maps models leaf gas exchange (O₂ permeates)
and kidney function (NH₃ retained). The reactor types differ because
the physics differs: photosynthesis requires energy input
(ELECTROCHEMICAL), metabolism releases energy spontaneously
(EQUILIBRIUM, complete conversion).

---

## 20. The Hidden Achievement

A player who Tabs into the greenhouse composite and recognizes the
electrochemical reactor from M2 (electrolysis) — the same unit, the
same model, just running a different reaction — has understood the
deepest lesson of the game: **all chemistry is the same chemistry.**
Electrolysis and photosynthesis are the same physics. The greenhouse
is an electrolyzer running R_PHOTOSYNTHESIS instead of R_H2O_ELEC.

This moment is not signposted. No popup, no achievement banner. The
realization is the reward.

---

# PART VI — THE ROOM

---

## 21. The Room as Gameplay Hub

The room (shelter) is the physical and emotional center of the game.
It is where the player lives, where the gauges are, where the stakes
are visible.

**Gauges on the wall:**
- **O₂:** Percentage. Green 19–23%, amber 17–19%, red <17%.
- **CO₂:** Percentage. Green <0.5%, amber 0.5–2%, red >2%.
- **Temperature:** Kelvin. Green 293–300K, amber 288–293K, red <288K.
- **Water:** Days remaining at current rate.
- **Food:** Days remaining.
- **Power:** kW available / kW demand.

Early game: gauges tick toward zero. Each mission connects a
sustainable supply. The transition from ticking countdowns to stable
green indicators is the primary emotional arc.

**The room is a tank.** Physically, it's a 50 m³ sealed vessel with
atmospheric composition tracking. When the player connects processes
to the room's air supply port, the composition changes in real time.
The gauges display computed values from the room's actual inventory,
not scripted numbers.

---

## 22. Progressive Substitution

The room starts with depletable supplies pre-connected: O₂ bottles,
LiOH scrubber, water jerricans, MRE crate, battery bank.

Each mission replaces a depletable with a sustainable process:
- M1: Water process replaces jerricans
- M2: Electrolyzer replaces O₂ bottles
- M4: Brayton cycle replaces battery
- M5: Air processor replaces LiOH scrubber
- M10: Greenhouse replaces MRE crate

The depletables physically remain — they become reserves. Gauges
shift from countdown to production-rate display.

---

# PART VII — EQUIPMENT AS STORY

---

## 23. Every Machine Has a Salvage Story

Equipment is not abstract. Each piece has a physical origin in the
Calypso wreckage, a reason for its capability, and a story attached
to its discovery. This section describes the narrative context — for
port tables, limits, and parameters, see `PTIS_EQUIPMENT_MATRIX.md`.

**Air cooler:** Radiator panel from the Calypso's thermal management
system. Found in the immediate debris field — one of the first
useful items. Cross-flow plate-fin design, ambient air on one side,
process gas on the other. Cannot cool below ambient.

**Flash drum:** Pressurized settling drum from the ISRU module's
preliminary separation train. Heavy, awkward to move. The player
rolls it back on improvised pipe-rollers.

**Tank:** Standard high-pressure storage vessel. Several sizes found
in various wreck zones. The workhorse container.

**Electrolyzer (reactor_electrochemical):** PEM electrolysis stack
from the Calypso's life-support backup. Compact, designed for water
splitting. Two separate outlet ports — cathode and anode — because
mixing H₂ and O₂ is explosive.

**Mixer / Splitter:** Simple pipe fittings fabricated from wreckage.
These are the "free" components — Kael can make them from salvaged
pipe sections.

**Reactor (reactor_equilibrium):** The Sabatier catalyst bed from
life-support spares, later repurposed for combustion (M4) and Haber
synthesis (M7). Different reactions, same hardware.

**Compressor:** Diaphragm compressor from the ISRU gas processing
train. The most valuable piece of equipment in the propulsion
wreckage. Multiple found across expeditions.

**Gas turbine:** Micro turbine from auxiliary power. Found near the
compressor. Together they form the heart of M4's Brayton cycle.

**Heat exchanger:** Brazed-plate unit from the Calypso's cooling
loops. Several recovered across expeditions. Enables heat integration
throughout the process.

**Valve:** Throttle valves from various pipe runs. Expansion through
valves provides JT cooling for cryogenic work.

**Pump:** Metering pump from the propellant transfer line. Found in
M8 expedition. Enables liquid compression for the Rankine cycle.

**Steam turbine:** Extracted from the emergency steam-driven
generator in the engineering section. Handles wet steam up to 12%
moisture — critical for the Rankine bottoming cycle.

**Heater:** Electric resistance heater from the crew quarters
climate system. Provides controlled heating for Haber pre-heat.

**Dewar tank (tank_cryo):** Vacuum-insulated cryogenic storage from
the propellant bay. Found in the deepest salvage expedition (M9).
Rated for temperatures down to 20 K.

**Greenhouse (composite):** Agricultural research pod from the cargo
hold. Grow lights, growth medium, seeds. Internally: an
electrochemical reactor (photosynthesis) + membrane separator
(leaf gas exchange) + nutrient mixer. Priya brings the knowledge to
make it work.

**Human (composite):** Not a "found" item — the colonists
themselves, modeled as a process unit. Internally: an equilibrium
reactor (metabolism) + membrane separator (kidney) + waste mixer.
The game's most profound WYSIWYG moment: human biology is
chemical engineering.

---

# PART VIII — USER EXPERIENCE

---

## 24. The 3D View (Primary Interface)

The 3D view is the game. Not a secondary rendering — the world the
player inhabits. Equipment has physical presence, pipes run between
real ports, vapor plumes rise from vents, compressors vibrate,
turbines whine.

### Design Heritage

Three genres simultaneously:

**City builder.** The base grows from empty hangar to complex
facility. Visual density IS the score. The SimCity pullback moment:
"I made this."

**Factory builder.** 3D pipe-laying is inherently satisfying.
Routing, bending, snapping to racks. Every connection visible and
physical.

**Survival game.** Alien landscape beyond shelter walls. Beautiful
and lethal. Warm amber interior vs. cold blue exterior.

### Camera

Orbit camera (OrbitControls). Presets: Overview (45°, full floor),
Equipment focus (zoom to selected), Ground level (walk-through feel),
Exterior (outside, looking back — after M5 airlock).

### Equipment Placement

Pick from palette, place on process floor. Snap to 1m grid.
90° rotation. Ghost preview shows footprint and ports. Cannot
overlap. 0.5m minimum clearance for pipe routing. Placement is a
topology edit (pauses world).

### Pipe Laying

Core physical interaction. Click output port → route → click input
port. Three routing modes: Auto-route (quick, functional), Manual
(waypoints, more control), Rack snap (organized industrial look).

Pipe colors by content: blue (liquid), red (hot gas), white (steam),
yellow (CH₄), green (O₂/air), gray (N₂/inert), amber (NH₃).
Updates live.

Pipe laying is a topology edit (pauses world).

---

## 25. The Inspector

Click any unit to open the inspector panel. Shows all computed
values: temperatures, pressures, flow rates, compositions, energy
flows. Every number the solver computes is visible.

**Hierarchy:** Summary line (name, status icon, key metric) →
Expanded view (all ports, all params, alarms) → Thermodynamic detail
(enthalpy, entropy, phase fractions).

**Vasquez commentary:** In campaign mode, the inspector may trigger
contextual Vasquez dialogue: "That discharge temperature is getting
close to the seal limit. I'd back off the pressure ratio."

**Performance maps (S7):** Canvas overlay showing operating point
relative to envelope boundaries and limit regions. Visual feedback:
where am I, how close to the edge.

---

## 26. The Palette

Left-side toolbar showing available equipment. Campaign mode: count
badges, greyed when depleted, teased entries with narrative tooltips
for future equipment. Sandbox mode: all equipment, unlimited.

Equipment categories match real process engineering:
- VESSEL (tank, tank_cryo, room)
- SEPARATOR (flash_drum, membrane_separator)
- REACTION (reactor_equilibrium, reactor_electrochemical)
- TURBOMACHINERY (compressor, gas_turbine, steam_turbine, pump)
- HEAT TRANSFER (hex, air_cooler, heater)
- PIPING (mixer, splitter, valve)
- SOURCE/SINK (source, atmosphere_sink)
- POWER (battery, generator)
- COMPOSITE (greenhouse, human — via S8 templates)

---

## 27. The HUD

**Always visible:** Play/Pause/Speed controls. Most critical runway
countdown. Game day. Population.

**On hover/expand:** Full runway breakdown (O₂, CO₂, water, food,
power). Alarm summary. Net power balance.

**Runway colors:** Green (>48h), amber (12–48h), red (<12h),
flashing red (<4h).

---

## 28. Failure Presentation

Failures are visual events, not just alarm text:

| Failure | Visual | Sound | Teaching |
|---------|--------|-------|----------|
| Overpressure | Vessel bulges, bursts, vapor cloud | BANG + hiss | Pressure has consequences |
| Thermal runaway | Red glow, heat shimmer, meltdown | Rising hum → alarm | Temperature limits matter |
| Dry compressor | Grinding, sparks, seizure | Metal screech | Feed it or lose it |
| Phase wrong | Slugging, knocking, hammering | Mechanical distress | Liquids don't compress well |
| Power trip | Lights flicker, unit spins down | Electrical pop + darkness | Everything needs energy |

Each failure type auto-reverts to checkpoint after a dramatic 3-second
pause. The player sees the consequence. Then they fix it.

---

## 29. Soundtrack & Atmosphere

**Ambient:** Low hum of equipment. Vent hiss. Compressor whirr.
Environmental sounds change with process state (busier plant = more
background machinery).

**Music:** Sparse electronic/ambient. Phase-dependent mood. Phase A:
tense, minimal. Phase B: steadier, building. Phase C: purposeful,
layered. Phase D: expansive, reflective.

**Silence is intentional.** Many moments have no music. The sound of
a working plant IS the soundtrack.

---

# APPENDIX

---

## A. Document Cross-References

| Topic | Authoritative document |
|-------|----------------------|
| Mission data schemas, evaluator code, star criteria | `PTIS_S10_SPEC.md` |
| Equipment ports, limits, parameters | `PTIS_EQUIPMENT_MATRIX.md` |
| Metabolic rates, greenhouse power, NASA validation | `PTIS_BIOSPHERE_POWER_RECONCILIATION.md` |
| Group template code, boundary ports, editableParams | `PTIS_S8_SPEC.md` |
| New defIds, species, reactions (S9 registrations) | `PTIS_S9_SPEC.md` |
| State machine, mission framework, campaign impl | `PTIS_S10_SPEC.md` |
| All engine physics (S0–S8) | `PTIS_S0–S8_SPEC.md` |
| Development roadmap and critical path | `PTIS_ROADMAP.md` |
| Visual dependency graph | `PTIS_DEPENDENCY_MAP.html` |

---

## B. Archived Documents

This document replaces:
- `game_arch_part_1_to_3_description.md` → Parts I–III
- `game_arch_part_4_missions.md` → Part IV
- `game_arch_part_5_biosphere.md` → Part V
- `game_arch_part_6_room.md` → Part VI
- `game_arch_part_7_equipment.md` → Part VII
- `game_arch_part_8_ux.md` → Part VIII
- `biosphere-loop-design-v3.md` → Part V + `PTIS_BIOSPHERE_POWER_RECONCILIATION.md`

All code schemas, port tables, test matrices, and implementation
details that previously appeared in game_arch files now live in
their authoritative spec documents (S8, S9, S10). This document
retains only design intent, narrative, and player experience.
