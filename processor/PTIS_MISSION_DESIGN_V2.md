# PTIS_MISSION_DESIGN_V2
## Process This In Space — Mission Design (Revised)
### Replaces PTIS_GAME_DESIGN.md Parts IV and VI
### February 2026

---

> **Scope.** This document replaces the mission structure (old Parts IV
> and VI) of the game design document. Parts I–III (philosophy, story),
> Part V (biosphere concept), Part VII (equipment as story), and
> Part VIII (UX vision) remain authoritative in PTIS_GAME_DESIGN.md.
>
> **Design change.** The old mission order followed a chemical engineering
> curriculum: condensation → electrolysis → reaction equilibrium →
> power cycles → compression → heat pumps → synthesis loops →
> combined cycles → cryogenics → biosphere. Correct, but lifeless.
>
> The new order follows a survival story: what do I need RIGHT NOW to
> not die? Water. Air. Something to burn. A way to burn it. And then:
> close the damn loop before the scrubber runs out.
>
> The thermodynamics is the same. The order serves the narrative.

---

# 15. Mission Flow

Every mission follows the same rhythm:

1. **Briefing** — Vasquez (and later others) explain the problem.
   Dialogue establishes stakes, teaches relevant physics, and
   provides just enough direction without solving it.
2. **Build** — World paused. Equipment placed, pipes laid. Palette
   shows available equipment with count badges. Auto-solve-on-edit
   gives immediate flow preview.
3. **Play** — Auto-checkpoint. World ticks. Physics happens.
4. **Watch** — Adjust parameters live (valve openings, setpoints).
   Time warp when stable. Alarms when things go wrong. Gauges
   respond in real time.
5. **Evaluate** — Objectives checked. Star rating computed.
6. **Debrief** — Narrative payoff. Visual reward.

On catastrophic failure: auto-pause, dramatic 3-second consequence,
then Restore to checkpoint. The lesson is in the failure.

---

# 16. The Room & Buffer Architecture

## The Room Is a Tank

The room (shelter) is the physical and emotional center of the game.
Physically, it is a 50 m³ sealed vessel with atmospheric composition
tracking. When processes feed into the room, the composition changes
in real time. The gauges on the wall are computed from the room's
actual inventory — not scripted numbers.

**Gauges:**

| Gauge | Green | Amber | Red | Flashing |
|-------|-------|-------|-----|----------|
| O₂ | 19–23% | 17–19% | <17% | <14% |
| CO₂ | <0.5% | 0.5–2% | 2–5% | >5% |
| CO | <10 ppm | 10–50 ppm | 50–200 ppm | >200 ppm |
| Temperature | 293–300K | 288–293K | <288K | — |
| Water | >7 days | 3–7 days | 1–3 days | <1 day |
| Food | >7 days | 3–7 days | 1–3 days | <1 day |
| Power | supply ≥ demand | 80–100% | 50–80% | <50% |

Early game: gauges tick toward zero. Each mission connects a
sustainable supply. The transition from ticking countdowns to stable
green indicators IS the primary emotional arc.

## Day 0 — Depletable Supplies

The room starts pre-connected to emergency supplies:

| Supply | Unit | Capacity | Runway (2 ppl) |
|--------|------|----------|----------------|
| O₂ bottles | reservoir (depletable) | 500 mol | ~13 days |
| LiOH scrubber | membrane_separator (depletable) | 200 mol capacity | ~11 days |
| Water jerricans | reservoir (depletable) | 800 mol | ~10 days |
| MRE crate | reservoir (depletable) | 3000 mol CH₂O | ~75 days |
| Battery bank | battery | 75 kWh | ~8 days at 400W |

These depletable supplies are connected directly to the room. The
gauges count down. The player's job, mission by mission, is to
replace each countdown with a process.

## Buffer Tanks — The Decoupling Layer

Here is the critical design decision: **the player does not pipe
raw process output directly into the room.** Instead, each life
support feed goes through a buffer tank.

```
Process output → [ BUFFER TANK ] → Room air_in / water_in
                      ↑
              Composition is checked HERE
```

Why buffer tanks matter:

1. **Decoupling.** If the Sabatier reactor trips, the room doesn't
   instantly lose feed. The buffer tank drains. The player has hours,
   not seconds, to fix the problem. Real plant design.

2. **Purity enforcement.** The buffer tank's composition is the
   composition that enters the room. If the O₂ tank has 2% CO
   contamination from incomplete combustion upstream, that CO
   enters the room. The gauges respond. People get sick.

3. **Diagnostic puzzles.** The player notices the CO gauge creeping
   up. Why? The O₂ buffer looks clean. Wait — there's 0.3% CO in
   the O₂ tank, building up slowly. Where's it coming from? Trace
   upstream: the flash drum isn't fully separating, so a trace of
   vent gas (which contains CO₂ that the Sabatier partially converts
   to CO) is contaminating the oxygen stream. The player has to
   diagnose the source and fix it — a flash drum temperature
   adjustment, or an additional separation step, or a purge line.

4. **Teaching.** Real chemical plants have intermediate storage
   between process units and final consumers for exactly these
   reasons. The player learns this by needing it, not by reading
   about it.

Buffer tanks are placed by the player, not automatic. Mission
briefings suggest them ("Vasquez: Don't pipe that directly into
our air supply. Use a buffer tank. Trust me."). But the player
CAN skip them — and learn why that's a bad idea.

## Purity & Health Consequences

### Air Quality

| Species | WARNING | MAJOR | CATASTROPHIC |
|---------|---------|-------|--------------|
| O₂ low | < 19.5% | < 16% (impaired) | < 14% (unconscious) |
| CO₂ high | > 1% | > 3% (narcosis) | > 5% (lethal) |
| CO | > 25 ppm | > 100 ppm (headache) | > 400 ppm (lethal) |
| NH₃ | > 25 ppm | > 300 ppm | > 500 ppm |

### Water Quality

| Condition | WARNING | MAJOR |
|-----------|---------|-------|
| H₂O purity | < 98% | < 90% |
| NH₃ content | > 0.1% | > 1% |
| Unexpected species | > 0.5% | > 2% |

### Consequence Ladder

**WARNING:** Vasquez comments. Gauges turn amber. No mechanical
effect. Player has time.

Vasquez: "CO₂ in the shelter is climbing. Point eight percent.
That's not emergency territory yet, but I'd like to know why."

**MAJOR:** "Health declining" alarm. Crew efficiency drops (reduced
metabolic rate, less work output, slower EVA). A countdown starts:
hours until CATASTROPHIC. Visual: characters coughing, sluggish.

Vasquez: "I can feel it. Headache. Shortness of breath. Whatever
you changed, change it back. We have maybe six hours."

**CATASTROPHIC:** Crew incapacitated. Mission failure. Revert to
checkpoint.

Vasquez (on revert): "Let's not do that again."

### Contamination Dynamics

Contamination doesn't spike — it creeps. A small CO leak from
incomplete combustion enters the O₂ buffer tank. The tank
composition shifts 0.01% per tick. Over game-hours, CO builds in
the room air. The gauges drift from green through amber toward red.
The player who watches their gauges catches it early. The player
who time-warps through gets the alarm.

This is exactly how real plant operators work — and exactly how
real accidents happen.

---

# 17. Campaign Structure

```
PHASE 1 — SURVIVE (Days 0–17)
  M1  Water          Condense from vent. First process.
  M2  Oxygen         Electrolysis. Battery draining.
  M3  Fuel           Sabatier. First recycle loop.
  M4  Power          Brayton cycle. Lights on.
  M5  Air (Boss)     CO₂ scrub. Close the loop.

PHASE 2 — STABILIZE (Days 17–42)
  M6  Cold Chain     Refrigeration. Food preservation.
  M7  More Power     Rankine bottoming. Combined cycle.
  M8  Fertilizer     Haber synthesis. Inert purge.
  M9  Cryo Emergency Pharmaceuticals. Linde cycle.

PHASE 3 — SUSTAIN (Day 42+)
  M10 Biosphere      Closed ecosystem. The final mission.

PHASE 4 — TERRAFORM (Endgame)
  Blueprint-based atmospheric engineering. Conceptual.
```

Missions are sequential. Each inherits the scene and accumulated
equipment from prior completions. The room persists. Buffer tanks
persist. Contamination persists.

---

# 18. Population & Salvage Timeline

## Characters

Starting pair (Day 0): **Kael Osei** (player, systems tech) and
**Dr. Lena Vasquez** (chemical engineer, injured, immobilized).

| Character | Found at | Crew role | What they bring |
|-----------|----------|-----------|----------------|
| **Jin Park** | M4 salvage | Propulsion tech | Extra hands. Found near second vent. |
| **Amara Okafor** | M7 salvage | Environmental systems | Closed-loop thinking. Foreshadows M10. |
| **Tomás Reyes** | M7 salvage | Medical officer | Injury treatment. Vasquez begins recovery. |
| **Priya Sharma** | M8 salvage | Agricultural scientist | Seeds, greenhouse knowledge. Makes M10 possible. |
| **Erik Lindqvist** | M8 salvage | Structural engineer | Base expansion. Builds rover frame. |

## Population Timeline

| Day | Pop. | Event |
|-----|------|-------|
| 0 | 2 | Crash (Kael + Vasquez) |
| ~12 | 3 | +Jin (M4 propulsion salvage) |
| ~27 | 5 | +Amara, Tomás (M7 salvage — found sheltering in chem lab) |
| ~32 | 7 | +Priya, Erik (M8 deep salvage — cargo/lab section) |

Each rescue is a step-change in demand. Systems built for 2 don't
work for 3. Systems built for 3 don't work for 7.

## Wreck Field

| Zone | Distance | Accessible | Contents |
|------|----------|-----------|----------|
| Immediate | 0–50m | M1 | Air cooler, flash drum, tanks, pipe, tools |
| Near debris | 50–200m | M2–M3 | Electrolyzer, HEX, mixer, catalyst bed |
| Propulsion | 500m–1km | M4 | Compressor, gas turbine. Second vent. Jin. |
| Bow section | 1–2km | M5 | Membrane separator (from ship's air recycler). Life support spares. |
| Chemistry lab | 800m | M7 | Steam turbine, pump. Amara & Tomás (sheltered here). |
| Cargo / deep lab | 1.5km | M8–M9 | Heater, Haber catalyst. Priya & Erik. Technical notes. |
| Cargo hold | 2km | M9 | Dewar tanks, agricultural pod frame, rover parts. |

---

# 19. Progressive Substitution

Each mission replaces a depletable countdown with a sustainable
process:

| Depletable | Replaced by | Mission |
|------------|------------|---------|
| Water jerricans | Vent condensation train | M1 |
| O₂ bottles | Water electrolysis | M2 |
| Battery bank | Brayton power cycle | M4 |
| LiOH scrubber | CO₂ compression + separation | M5 |
| MRE crate | Greenhouse | M10 |

The depletables physically remain as emergency reserves after
replacement. Gauges shift from countdown to production-rate display.

The food supply (MRE crate) is deliberately the LAST countdown to be
replaced. It lasts ~75 days for 2 people, extending through Phase 1
and most of Phase 2 even as population grows. The growing pressure
from more mouths on a finite food supply is the background tension
that drives Phase 3.

---

# 20. The Missions

## Phase 1 — SURVIVE

Phase 1 is grim. Emergency lighting. Countdowns everywhere. Every
success is a reprieve, not a victory. The vent is the only resource
and it's also a hazard. Two people, alone.

The phase ends when every life support loop except food is closed.
That's the M5 Boss moment — the first time the player can look at
the gauges and see green across the board.

---

### Mission 1 — Water (Days 0–3)

The vent is blasting hot mixed gas into the lower hangar. Dangerous,
loud, relentless. And it carries everything they need — dissolved in
500 K vapor.

Vasquez, immobilized on a stretcher, voice steady despite the pain:
"That vent gas is carrying water vapor. Cool it below 100°C and the
water condenses out. That's it. That's your first process: make it
cold, collect the liquid."

**The player builds:** Vent (reservoir) → Air Cooler → Flash Drum →
Tank.

Cool the hot gas. Gravity separates liquid from vapor in the flash
drum. Water collects in the tank. Simple, tangible, immediately
rewarding.

**Teaching moment:** Temperature approach. The ambient air at 305 K
(Planet X is warm) can only cool the vent gas to ~315 K (10 K
approach). That's enough to condense water, but barely. The player
sees the flow rate and starts thinking: "How do I cool further?"

This is the first encounter with the air cooler's fundamental
limitation — it can never cool below ambient. The seed is planted
for heat exchangers, refrigeration, and every cooling problem
that follows.

**Visual reward:** Water drips into the tank. The gauge: "WATER:
100 mol." The water jerrican countdown pauses. Vasquez: "A hundred
moles. That's drinking water for a week. From a hole in the
ground and a piece of wreckage."

**Buffer tank lesson:** Vasquez suggests storing water in a dedicated
tank before connecting it to the room supply. "Don't drink straight
from the process. Vent gas carries CO₂, methane, who knows what
else. Store it, check it, then pipe it in." If the player skips
the buffer and pipes flash drum liquid directly to the room's
water_in, trace CO₂ dissolves into the water supply — a WARNING
that teaches the lesson gently.

**Stars:**
- ★ Collect 100 mol water in buffer tank.
- ★★ Collect 200 mol.
- ★★★ 200 mol using only 1 collection tank (efficient layout).

**Equipment unlocked:** Air cooler, flash drum, 2× tank, pipe,
mixer, splitter. (Immediate debris salvage.)

---

### Mission 2 — Oxygen (Days 3–5)

Water is chemistry's master key. Split it and you get the two
things you need most: oxygen to breathe and hydrogen to burn.

Vasquez: "Water electrolysis. Electricity through water. Hydrogen
off one electrode, oxygen off the other. Two outlets — cathode and
anode — because mixing those gases is how you make a bomb. The
catch: it costs energy. Real energy. Look at the battery gauge."

**The player builds:** Water tank → Electrolyzer (reactor_electro-
chemical, R_H2O_ELEC) → [cathode: H₂ tank] + [anode: O₂ buffer
→ room air_in].

Two outlets, two streams, two tanks. The electrolyzer drains the
battery visibly. The player watches it fall and understands: making
oxygen isn't free. Every mole costs energy. This is M4's
motivation.

**Teaching moment:** Power consumption. The battery gauge is the
teacher. Also: the two-outlet electrolyzer — why gases must be
separated, why electrode products go to different tanks. The
H₂ tank sits there, full of potential, foreshadowing M3.

**Purity note:** The O₂ stream from electrolysis is pure. This is
the easy case. The player builds the buffer tank habit now, while
the feed is clean. The habit will protect them later, when feeds
are messy.

**Visual reward:** O₂ accumulates in the buffer. The room's O₂
gauge stops falling. The O₂ bottles countdown pauses. Vasquez:
"Fifty moles of oxygen. Two weeks of breathing. From water and a
battery. Chemistry works."

**Stars:**
- ★ Deliver 50 mol O₂ to room via buffer tank.
- ★★ Also store 100 mol H₂ (save the hydrogen for M3).
- ★★★ Achieve both consuming ≤10 kWh from battery.

**Equipment unlocked:** Electrolyzer (near debris salvage). Also:
additional HEX (from cooling system wreckage).

---

### Mission 3 — Fuel (Days 5–8)

Hydrogen from M2. CO₂ from the vent (35% of the mix). The Sabatier
reaction turns them into methane — fuel — and water, which recycles.

Vasquez: "CO₂ plus four H₂ gives CH₄ plus two H₂O. The Sabatier
reaction. Exothermic — it releases heat. Good. But the equilibrium
temperature matters. Too hot, conversion drops. You need to cool
the products and recycle what didn't convert."

**The player builds:** H₂ tank + CO₂-rich vent gas → Mixer →
Reactor (reactor_adiabatic, R_SABATIER) → HEX (cool products) →
Flash Drum (liquid H₂O separates) → CH₄ Tank. Unconverted vapor
recycles back to the mixer.

**Teaching moment:** The recycle loop. Not everything converts in
one pass — and that's okay. The player connects flash drum vapor
back to the mixer inlet. First encounter with recycle, the
concept that industrial chemistry runs on. Also: heat exchange.
The reactor runs hot. Products must be cooled before the flash
drum can separate phases. The HEX moves heat from the hot
reactor outlet to... where? The player discovers they need a
cooling medium. The ambient air cooler from M1, or the cold vent
gas feed itself as a pre-heater (elegant, foreshadows M7).

**Purity note:** The methane tank may accumulate trace N₂ and CO₂
from imperfect separation. This is fine for combustion in M4. But
the water from the flash drum recycles to the electrolyzer — and
if it carries dissolved CO₂, the electrolyzer will see it. The
player starts learning that recycle loops amplify impurities.

**Visual reward:** Methane fills a tank. Vasquez: "That's barbecue
fuel. On this planet, same as rocket fuel."

**Stars:**
- ★ Produce 20 mol CH₄ (purity ≥90%).
- ★★ Water recycle sustained 10 minutes.
- ★★★ Total H₂ consumed ≤85 mol (efficient recycle).

**Equipment unlocked:** Additional HEX, mixer (near debris).
Catalyst bed from life support spares.

---

### Mission 4 — Power (Days 8–12)

The battery is dying. Every process Kael has built runs on stored
energy that is not being replenished. M4 is the crisis point.

Salvage expedition to the propulsion wreckage — the longest EVA
yet. Through unstable structural debris, past the forward
bulkhead. Kael finds a diaphragm compressor, a micro gas turbine,
and a combustion chamber. Also finds Jin Park, alive, sheltering
near a second geothermal vent, rationing a personal O₂ supply.

Vasquez: "Burn the methane. A turbine converts hot expanding gas
into shaft work. But you need to compress the air first — otherwise
the expansion ratio is worthless. Compression costs work. Expansion
produces work. The difference is net power. That's the Brayton
cycle — the simplest power plant that exists."

**The player builds:** Atmospheric air (source) → Compressor →
Reactor (reactor_adiabatic, R_CH4_COMB) → Gas Turbine → exhaust
to atmosphere (sink). CH₄ feed from M3 tank. Compressor and
turbine share an electrical bus via power hub. Net power out =
turbine work − compressor work.

**Teaching moment:** Why power cycles work. The compressor raises
pressure. Combustion raises temperature. The turbine expands hot
gas back to low pressure. Hot expansion produces more work than
cold compression consumes. The difference is net power. This is
THE fundamental insight of thermodynamic power generation. Every
power plant on Earth — gas, steam, nuclear — is a variation on
this theme.

Also: net power. The turbine makes ~8 kW. The compressor takes
~3 kW. Net: ~5 kW. The player sees this on the power hub and
understands that gross ≠ net.

**Purity note:** Combustion products are exhausted to atmosphere
(sink). If the player accidentally routes exhaust into the shelter
— CO₂ and H₂O flood the room air. MAJOR alarm within minutes.
Vasquez: "You're piping combustion exhaust into our living space.
STOP." Dramatic failure. Educational.

**Visual reward:** Lights come on. Real lights — overhead
illumination replacing emergency strips. The hangar transforms.
Power gauge: "5.0 kW NET." Vasquez: "First time I've been warm
in twelve days."

Jin, entering the hangar: "I saw the lights from half a kilometer.
I thought I was hallucinating."

**Stars:**
- ★ Sustain 5 kW net power for 5 minutes.
- ★★ Battery charging (net positive storage).
- ★★★ Achieve 5 kW with ≤4 units in the power loop.

**Equipment unlocked:** Compressor, gas turbine. Second vent access
(higher pressure — Jin's discovery). Population: 3.

---

### Mission 5 — Air: The Phase 1 Boss (Days 12–17)

With power, continuous processes become possible. But the base still
breathes through a LiOH scrubber — a sorbent that is being consumed.
The scrubber has maybe ten days left. After that, CO₂ accumulates in
the shelter. At 5%, unconsciousness. At 8% (Planet X ambient), death.

This is the boss fight of Phase 1. Not one process — a SYSTEM. The
player must scrub CO₂ from atmospheric air, produce clean breathable
gas, and feed it to the room. Everything they've learned — cooling,
separation, pressure, power — comes together.

Salvage expedition to the bow section. Through twisted corridors
of the crew quarters, Kael finds the ship's membrane air separator —
a compact unit designed to pull CO₂ from cabin air. Also: additional
tanks, valves, life support control manuals.

Vasquez: "CO₂ is 8% of this planet's atmosphere. We need to get it
below half a percent for the shelter. The membrane separator from the
Calypso's life support can do it — but it needs pressurized feed.
Compress the air, feed the membrane, clean gas to the shelter, CO₂
reject to waste. And for the love of thermodynamics, use a buffer
tank."

**The player builds:** Atmospheric air (source) → Compressor →
Air Cooler (knock out moisture) → Membrane Separator → [permeate:
clean air buffer → room air_in] + [retentate: CO₂-rich waste to
atmosphere]. Power from M4 Brayton cycle.

Alternatively, the player can build multi-stage compression to
liquefy CO₂ directly (no membrane needed — pure thermodynamic
separation). Planet X's CO₂ critical point (304 K, 73.8 bar) is
just above ambient temperature, so transcritical compression + cooling
can separate it. This is the harder, more elegant solution — and
teaches phase behavior near the critical point.

**Teaching moment:** System integration. For the first time, the
player's processes depend on each other. The air scrubber needs
power from M4. M4 needs fuel from M3. M3 needs hydrogen from M2.
M2 needs water from M1. Pull one thread and everything unravels.
This is the real lesson of chemical engineering: processes are
networks, not lines.

**Purity note — the boss mechanic:** The membrane separator is
imperfect. It rejects most CO₂ but passes some. If the operating
pressure is too low or the membrane is undersized, the "clean" air
buffer accumulates 0.5%, then 1%, then 2% CO₂. The room gauges
drift. Vasquez starts coughing. The player must tune the process
— higher compression, better cooling, membrane parameter adjustment
— until the shelter CO₂ stays below 0.5%.

This is the first time purity is genuinely difficult. And the buffer
tank is what gives the player time to diagnose and fix it.

**The replug moment:** At this point, the player disconnects the
O₂ bottles, the LiOH scrubber, and the water jerricans. The room
now runs entirely on process feeds through buffer tanks. The
depletable supplies remain as emergency reserves. Every gauge shows
green production rates instead of red countdowns.

Vasquez, looking at the gauges: "Water: supplied. Oxygen: supplied.
Power: supplied. Air: supplied. Food..." She glances at the MRE
crate. "Food we'll deal with later."

**Visual reward:** All gauges green except food. The shelter feels
different — stable, humming, alive. The emergency lighting is
gone. Real lighting, clean air, running water. It's a home, not
a shelter.

**Stars:**
- ★ Shelter CO₂ sustained below 1% for 30 minutes.
- ★★ Below 0.5% for 30 minutes.
- ★★★ Below 0.5% while consuming ≤2 kW total for air processing.

**Equipment unlocked:** Membrane separator, additional valves and
tanks (bow section salvage).

---

## Phase 2 — STABILIZE

The immediate survival crisis is over. Phase 2's tone shifts:
gallows humor creeps in. Vasquez's dry remarks. Jin's quiet
competence. The base starts to feel like a place, not a shelter.

But the food countdown is ticking. The MRE crate that supported
2 people for 75 days now supports 3 people (and soon more). Each
rescue accelerates the deadline. Phase 2 builds the infrastructure
that Phase 3's greenhouse will need — refrigeration, power, and
the chemistry of nitrogen.

---

### Mission 6 — Cold Chain (Days 17–22)

The MREs are degrading. Planet X is warm — 305 K (32°C). Food
spoilage accelerates above 280 K. If they can refrigerate storage
below 270 K (-3°C), the remaining food supply lasts twice as long.
Later, this same cold chain will store greenhouse produce.

Vasquez: "A refrigeration cycle. You compress a working fluid, cool
it to ambient with the air cooler, expand it through a valve — the
Joule-Thomson effect drops the temperature below ambient — then let
it absorb heat from the food storage tank through a heat exchanger.
The loop runs continuously. For every watt of electricity you spend,
you move two or three watts of heat. That's COP — coefficient of
performance."

**The player builds:** Working fluid (NH₃ or CO₂) in a closed loop:
Compressor → Air Cooler → Valve (JT expansion) → HEX (cold side
absorbs heat from food tank) → back to Compressor. The food tank
cools below ambient.

**Teaching moment:** COP > 1 is not free energy. The heat pump
moves heat from cold to hot — against the natural direction — by
spending work. The electricity provides the driving force, not the
energy content. This is one of the deepest insights in
thermodynamics, and the player discovers it through a refrigerator.

Also: working fluid selection. NH₃ gives great COP but is toxic
(the player already knows NH₃ is dangerous from the purity
tables). CO₂ is safe but operates near its critical point on Planet
X — transcritical cycle behavior. The player can try both and see
the tradeoffs.

**Visual reward:** The food tank temperature drops. Frost forms on
the insulation. MRE shelf-life counter extends. Vasquez: "Cold
storage. We just doubled our food runway. That buys us time for
what comes next."

**Stars:**
- ★ Food storage below 270 K for 1 hour.
- ★★ COP ≥ 2.5.
- ★★★ COP ≥ 3.0.

**Equipment unlocked:** Additional valve, HEX (from wreckage
cooling systems).

---

### Mission 7 — More Power (Days 22–27)

Three people now. Power is strained. The electrolyzer, the air
scrubber, the refrigeration loop, and the compressor all fight
for the turbine's 5 kW. Priority shedding kicks in — things
flicker off. Sometimes the air scrubber loses power for minutes.
Vasquez's CO₂ warnings increase.

Salvage deeper into the wreckage. Through the chemistry lab
section, past collapsed corridors. Kael finds Amara and Tomás
sheltering in a pressurized compartment — alive, rationing supplies,
waiting for rescue. Also: a metering pump from the propellant
transfer line. And a small steam turbine from the emergency
generator.

Vasquez: "That turbine exhaust is still 600 Kelvin. We're throwing
away enough heat to run a second generator. Boil water with the
exhaust, run the steam through a turbine, condense it, pump the
liquid back. That's a Rankine cycle. And here's the beautiful
part — pumping a liquid costs almost nothing compared to compressing
a gas. That's why the world runs on steam."

**The player builds:** Existing Brayton turbine exhaust → HEX
(hot side: exhaust gas, cold side: water/steam) → Steam Turbine →
Air Cooler (condense steam) → Pump → back to HEX. Net: ~3 kW
additional from the same fuel input.

**Teaching moment:** Combined cycle efficiency. The Brayton cycle
alone wastes most of its heat. Adding a bottoming Rankine cycle
captures that waste. Real power plants do exactly this — gas
turbine + steam turbine. The player sees efficiency jump from
~25% to ~35%. Also: pump work is negligible — liquid compression
costs almost nothing. The numbers prove it.

**Visual reward:** A second generator comes online. Power gauge:
yellow "TIGHT" → green "SURPLUS." All processes run without
shedding. Vasquez: "This is the moment it stopped being survival
and started being engineering."

Amara, looking at the flowsheet: "You built a combined-cycle power
plant. From wreckage. In two weeks." Vasquez: "Fourteen days and
a lot of swearing."

**Stars:**
- ★ Sustain 8 kW net for 5 minutes.
- ★★ Pump work < 5 W.
- ★★★ Combined cycle efficiency > 35%.

**Equipment unlocked:** Steam turbine, pump. Population: 5.

---

### Mission 8 — Fertilizer (Days 27–32)

Five people. The MRE countdown accelerates. But something else is
happening — the deeper salvage expeditions have opened the path to
the cargo section. Priya Sharma and Erik Lindqvist are found there
among the remains of the agricultural research equipment.

Priya knows what's needed: nitrogen fertilizer. Ammonia. Without it,
no greenhouse. Without a greenhouse, no food beyond the MRE crate.

Vasquez: "N₂ plus 3H₂ gives 2NH₃. The Haber reaction. But
conversion per pass is only 15–25% at practical temperatures. You
need a recycle loop. And here's the fun part — atmospheric N₂ has
1% argon. Argon doesn't react. It accumulates in the recycle,
diluting your reactants, killing conversion. You need a purge."

**The player builds:** N₂ (from atmosphere source) + H₂ (from
electrolyzer) → Mixer → Heater → Reactor (reactor_adiabatic,
R_HABER) → Air Cooler → Flash Drum (liquid NH₃ separates) → Tank.
Vapor (unreacted N₂/H₂ + accumulated Ar) recycles to mixer, with
a bleed-off purge.

**Teaching moment:** The recycle-purge problem. Argon builds up.
The player watches conversion drop over time as the recycle stream
gets more dilute. They must add a purge — bleeding off a fraction
of the recycle to remove inerts. Too little purge: conversion dies.
Too much purge: hydrogen wasted. The optimum is a live, adjustable
tradeoff. This is THE classic problem of industrial chemistry,
and the player discovers it by watching their reactor die.

**Visual reward:** Liquid ammonia collects. Priya: "With this, I
can grow anything." Erik, in the background, welding the greenhouse
frame: "If I can get the structure sealed by next week..."

**Stars:**
- ★ 10 mol NH₃ (liquid).
- ★★ Ar purge stable for 10 minutes (no conversion collapse).
- ★★★ > 50% N₂ conversion (optimized recycle-purge ratio).

**Equipment unlocked:** Heater, Haber catalyst bed. Population: 7.
The pressure on the MRE crate intensifies.

---

### Mission 9 — Cryo Emergency (Days 36–42)

A distress signal — not from a person. From the cargo hold's
automated medical module, still running on its own failing battery.
Inside: pharmaceutical supplies, tissue cultures, vaccines.
Irreplaceable biological material rated for -80°C storage. In the
wreckage, exposed to Planet X's 305 K ambient, they'll degrade
within 48 hours.

Tomás, the medical officer: "Those cultures represent every
biological sample from the ship's research program. Antibiotics,
vaccines, cell lines. If we lose them, we're one infection away
from a catastrophe we can't treat."

Vasquez: "Cryogenic liquefaction. Compress a gas, cool it to
ambient, exchange heat with the recycled cold stream, expand it —
either through a valve for JT cooling or through a turbine for
work recovery — and flash-separate the liquid. The cold vapor
recycles to pre-cool the incoming gas. It bootstraps: each pass
gets colder, until liquid forms."

**The player builds:** A Linde-style liquefaction loop: source gas
→ Compressor → Air Cooler → HEX (counterflow with cold recycle)
→ Gas Turbine or Valve (JT expansion) → Flash Drum → [liquid to
Dewar tank] + [cold vapor recycles through HEX]. The gas turbine
recovers expansion work, improving efficiency but adding
complexity.

Salvage: the cargo hold yields vacuum-insulated Dewar tanks rated
for 20 K. The deepest EVA yet.

**Teaching moment:** The Linde cycle. Counterflow heat exchange —
the elegant bootstrap where cold vapor pre-cools the incoming
warm gas, making the next expansion colder still. JT cooling:
throttling a real gas below its inversion temperature produces
cooling (not ideal gas behavior — the player sees Peng-Robinson
in action). Turboexpander: using expansion work instead of
throttling, more efficient but requires a machine.

Also: the 48-hour deadline creates genuine urgency. This isn't
"accumulate 100 mol." It's "get to -80°C before the clock
runs out." A different kind of challenge — not throughput, but
startup speed.

**Visual reward:** Cryogenic plumbing outside the hangar. Frost-
covered pipes. Vapor plumes in the warm air. The Dewar tank
temperature drops: 250K... 200K... 180K... Tomás, watching the
medical readout: "Stable. They're stable." Vasquez: "Cryogenics
from wreckage and a geothermal vent. The Calypso's designers
would either be proud or horrified."

**Stars:**
- ★ Dewar tank below 200 K within 48 hours.
- ★★ Below 100 K (deep cryo).
- ★★★ Turboexpander work recovery active (gas turbine in the loop).

**Equipment unlocked:** Dewar tank (tank_cryo), additional
compressor (from cargo hold).

---

## Phase 3 — SUSTAIN

Seven people. The MRE crate is running out. The food countdown,
which has been a background pressure since Day 0, is now red.
Everything Phase 1 and Phase 2 built was infrastructure for this
moment.

The greenhouse frame is ready. The seeds are viable. The ammonia
is flowing. Now comes the hardest engineering challenge of the
campaign: powering an ecosystem.

The tone shifts again: competence. The player knows what they're
doing. The base looks industrial. Vasquez, recovering, walks with
a cane.

---

### Mission 10 — Biosphere: The Final Mission (Day 42+)

Priya: "A plant takes in CO₂ and water, fixes the carbon into
food, and releases oxygen. The greenhouse isn't just a food source
— it's an air processor. If we close the loop, the colony breathes
through its plants."

The revelation: **an ecosystem is a process network.** CO₂ from
humans feeds plants. O₂ from plants feeds humans. Water cycles
through both. The player has been building this network piece by
piece across nine missions. M10 closes the loop.

**New discovery:** A deep geothermal tap — higher pressure, higher
temperature, more flow capacity. Discovered during the cargo hold
expedition (M9), mapped by Erik. This is the energy source that
makes the biosphere possible.

**The power challenge:** The greenhouse demands ~42 kW at 2%
lighting efficiency. Combined with existing base load (~15 kW),
total demand is ~60 kW. The existing combined-cycle plant produces
~8 kW. The player needs to build 4–5 power blocks, or redesign for
higher efficiency using the new high-pressure vent.

Fabrication unlocked: "The engineering team has restored the ship's
workshop. Unlimited equipment counts from available templates."
Equipment scarcity ends. Engineering complexity is the challenge.

**The composites:** The greenhouse and human units are S8 group
templates — locked assemblies containing real engine units. The
player can Tab into them and inspect every reactor, every separator,
every stream.

- **Greenhouse:** reactor_electrochemical (R_PHOTOSYNTHESIS) +
  membrane_separator (leaf gas exchange). Ports: air_in, water_in,
  elec_in, air_out (O₂-enriched), food_out (CH₂O).

- **Human:** reactor_adiabatic (R_METABOLISM) + membrane_separator
  (kidney) + waste mixer. Ports: air_in, food_in, water_in,
  air_out (CO₂-enriched, warm), waste_out (H₂O + NH₃).

The hidden achievement: the player who Tabs into the greenhouse and
recognizes the electrolyzer from M2 — the same unit, the same
physics, running a different reaction — has understood the game's
deepest lesson. **All chemistry is the same chemistry.**

**The player builds:** Room (air_out) → Greenhouse (CO₂ → O₂ +
food) → Human composite (breathes, eats, exhales) → Room. External
inputs: water makeup, NH₃ from Haber loop, massive electricity for
grow lights, cooling for waste heat.

**The balancing act:** Seven humans consume O₂ and food, produce
CO₂ and waste heat. The greenhouse consumes CO₂ and electricity,
produces O₂ and food. The rates must match. If the greenhouse is
undersized, food runs out. If it's oversized, the grow lights
consume all available power and the air scrubber shuts down. The
player must balance production, consumption, and power across the
entire colony network.

**Vasquez**, now mobile with a cane, stands in the greenhouse. She
looks at the complete colony process diagram — every stream balanced,
every loop closed. "You know what this is? This is what I came to
Planet X to prove could be done. A self-sustaining colony from
in-situ resources." A pause. "I just didn't plan on doing it the
hard way."

**Visual reward:** The rover departs. Kael drives. Camera pulls
back — slowly — revealing the full base from above. The hangar,
expanded. The greenhouse, glowing green. Tanks, piping, turbine
heat shimmer, cryo frost plumes, air processing, Haber loop. All
built from salvage. All running. All real.

Statistics overlay: total units placed, total energy generated,
total water produced, total O₂ produced, total food grown, days
survived. Colony roster: seven names, seven portraits.

A radio crackle. Static. "...Calypso survivors... this is...
orbital... we see your... thermal signature..." The signal fades.
The rover drives toward the horizon.

**END OF CAMPAIGN.**

**Stars:**
- ★ All biosphere conditions sustained 1 hour (O₂, CO₂, food,
  water, power all green for all 7).
- ★★ Sustained 4 hours.
- ★★★ Wastewater recycle active (≥50% water recovery from human
  waste_out back to greenhouse water_in).

---

## Phase 4 — TERRAFORM (Endgame / Future)

After the campaign, sandbox mode unlocks fully. The radio signal
hook suggests rescue is possible — but also that Planet X could
be home.

Phase 4 is architectural: blueprint-based scale-up, atmospheric
exchange accounting, the CO₂ removal puzzle. The player designs
industrial-scale process plants and deploys them as blueprints
across the planet's surface. The atmosphere responds.

Planet X has 21% O₂ — already breathable. The problem is 8% CO₂.
Remove it without changing the O₂, and the sky clears, the air
becomes breathable, the planet becomes home.

The catch: naive photosynthesis adds O₂. Above 23.5%, fire hazard.
The player must discover O₂-neutral removal pathways: BECCS, mineral
carbonation. The terraforming puzzle IS the game at this scale.

As CO₂ drops, the planet cools (reduced greenhouse effect). Remove
too much CO₂ and Planet X becomes too cold. Water vapor management
becomes critical. The player literally watches the sky change color
over game-years as they reshape the atmosphere.

Victory: a self-sustaining biosphere that maintains breathable
atmosphere without industrial input. Nature takes over.

Detailed design: `PTIS_S_TERRAFORM_SPEC.md`.

---

# 21. Engine Requirements by Mission

| Mission | Key engine feature needed | Stage |
|---------|-------------------------|-------|
| M1 | Tank physics (Cv flow, flash), air cooler | S5-lite |
| M2 | electrochemicalTick (electrolysis) | S6 |
| M3 | reactor_adiabatic (Sabatier), HEX | S6 (or existing reactor_equilibrium) |
| M4 | Compressor, gas turbine, power hub | Existing (post-S2) |
| M5 | membrane_separator | Cherry-pick from S9 |
| M6 | Refrigeration loop (existing units) | Existing (valve JT + HEX) |
| M7 | Steam turbine, pump | Cherry-pick from S9 |
| M8 | Heater, Haber reaction | Existing |
| M9 | tank_cryo (Dewar) | Cherry-pick from S9 |
| M10 | GroupTemplateRegistry, composites | S8 + S9 full |

Vertical slice (M1–M5): S5-lite + S6 + membrane_separator.
Full campaign (M1–M10): + S7 + S8 + S9 + S9b.

---

# Appendix: Changes from V1

| V1 (old) | V2 (new) | Reason |
|----------|----------|--------|
| M5 Air (compression CO₂ separation) | M5 Air (membrane separator + compression option) | Two solution paths, more accessible entry |
| M6 Warmth (heat pump for shelter) | M6 Cold Chain (refrigeration for food) | Food is the tension; warmth is a side effect of power |
| M7 Fertilizer | M8 Fertilizer (reordered) | Power surplus needed before complex synthesis |
| M8 More Power | M7 More Power (reordered) | Power strain is felt earlier with 5 people |
| M9 Reserves (general cryogenics) | M9 Cryo Emergency (pharmaceuticals) | Urgency narrative instead of abstract "reserves" |
| HVAC mission | Killed | Not exciting as standalone. Shelter climate folded into M4/M5 |
| Purity: not designed | Purity: buffer tanks + health ladder | Core gameplay mechanic, diagnostic puzzles |
| Rescues at M4/M6/M7 | Rescues at M4/M7/M8 | Matches new mission order and equipment needs |
| Phase A/B/C/D | Phase 1 SURVIVE / 2 STABILIZE / 3 SUSTAIN / 4 TERRAFORM | Clearer narrative arc, terraform separated |
