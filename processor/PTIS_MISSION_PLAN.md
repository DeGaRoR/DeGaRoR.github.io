# PTIS Mission Plan
## Three-Arc Campaign Structure
### March 2026 — Working Document

---

> **Design principles.**
> 1. Emergency-driven: every mission answers "or else what?"
> 2. Causal chain: each mission's output enables the next mission's solution
> 3. Morale matters: breather missions after hard stretches
> 4. Realistic progression: survival problem first, engineering solution second
> 5. Name missions after the problem, not the process

---

# Arc A — Survival (Missions 1–10)

**Setting.** Crash landing on Planet X. Two survivors: Lena (engineer) and Kael (generalist). Wreckage, emergency supplies, one nearby hydrothermal vent. Planet X has Earth-like atmosphere with 9% CO₂, mean surface temperature 278K.

**Arc goal.** Stay alive long enough to produce rover fuel. End state: closed carbon loop, CH₄-fuelled rover ready.

**Crew:** 2 (Lena, Kael)

---

## M1 — Breathe, Drink, Power

**Emergency:** Shelter has no utilities. Emergency O₂ canister, water tank, and battery are full but won't last.

**Objective:** Connect power source, water supply, and O₂ canister to the shelter module.

**Player learns:** Pipe connections, port matching, basic flow. The shelter (room unit) as the central life-support hub.

**Units introduced:** Room, source (power), source (O₂), source (water), pipes.

**Unlocks:** Shelter is habitable. Clock starts ticking on consumables.

---

## M2 — Stay Warm, Stay Dry

**Emergency:** Shelter interior is 278K (5°C) — uncomfortably cold. Humidity builds from crew respiration. CO₂ rising but a finite chemical scrubber cartridge (from wreckage) buys time.

**Objective:** Build the air recirculation loop: electric heater to warm the shelter, cooler/dehumidifier to manage moisture. Connect the chemical scrubber cartridge to the air loop.

**Player learns:** Heat addition/removal, temperature control, air loop topology. The scrubber cartridge has a visible depletion meter — the player knows it won't last forever.

**Units introduced:** Heater, cooler, fan (air mover).

**Design note:** The chemical scrubber is a finite consumable, not a permanent solution. Its visible depletion drives urgency for M6. CO₂ is not condensed here — it's adsorbed by the cartridge. Name the mission after the comfort problem, not the CO₂ problem.

**Unlocks:** Livable temperature and humidity. Scrubber timer begins.

---

## M3 — Find Water

**Emergency:** Water tank dropping. No natural liquid water on surface at 278K.

**Objective:** Tap the hydrothermal vent. Build a makeshift air cooler (fan + radiator) to knock the vent temperature down. Condense water from the vent steam. Route condensate to the water reservoir. Connect overflow back to environment.

**Player learns:** Phase change (condensation), heat exchange with ambient air, liquid collection. The vent is a messy mix — mostly steam, but with CO₂, CH₄, H₂, traces of CO and other gases. Not everything condenses.

**Units introduced:** Vent (source_atm), heat exchanger (air-cooled radiator), simple_open_tank (reservoir with overflow), separator (gas/liquid split).

**Unlocks:** Sustainable water supply. Non-condensable vent gases are vented — for now.

---

## M4 — Make Oxygen

**Emergency:** O₂ canister running low. Vent gas has no usable O₂.

**Objective:** Build an electrolyser to split water into H₂ and O₂. Route O₂ to shelter air supply. Vent H₂ for now (wasteful, but survival first). Install a pressure relief valve on the O₂ line.

**Player learns:** Electrolysis, gas handling, pressure relief as safety. The concept of producing a consumable rather than depleting a canister.

**Units introduced:** Electrolyser (reactor_electrochemical), pressure relief valve.

**Design note:** H₂ is vented and visually lost. This sets up M8's "why are we wasting that?" moment.

**Unlocks:** Sustainable O₂. H₂ stream exists but is unused.

---

## M5 — Feed the Crew

**Emergency:** 30-day food runway is thinning. Lena's dialogue has been hinting at ration calculations since M3. Hunger is approaching.

**Objective:** Locate and retrieve the food crate from the wreckage. Connect it to the room (food_in port) and route biological waste output (waste_out) to disposal.

**Player learns:** The room's metabolic model — food in, waste out, the human as a process unit. Waste is a stream that needs to go somewhere.

**Units introduced:** Food crate (source, finite), waste outlet.

**Design note:** Waste is simply vented/dumped for now. This is deliberately unsatisfying — it sets up B8 (waste loop closure). No food crate in M0/M1 by design; the crew recently ate before the crash and the deficit builds gradually.

**Unlocks:** Crew fed. Waste stream exists but is unmanaged.

---

## M6 — Scrub the Air

**Emergency:** Chemical scrubber cartridge from M2 is nearly spent. CO₂ readings climbing. Headaches, drowsiness. Lena is alarmed.

**Objective:** Build a compression-condensation CO₂ removal system. Compress shelter air, cool it to near-ambient (278K is conveniently close to CO₂'s condensation point at high pressure), separate liquid CO₂, return clean air to shelter.

**Player learns:** Compression, cooling under pressure, phase separation of a specific component. The relationship between pressure, temperature, and condensation. Real gas behaviour starts to matter here — CO₂ near its critical point (Tc = 304K) behaves non-ideally.

**Units introduced:** Compressor, condenser (HEX at high pressure), phase separator, expansion valve.

**Design note:** This is the mission most at risk of feeling like a lecture. Frame it hard around the emergency. Lena is dizzy. The scrubber gauge is red. The player solves the crisis and the chemistry is incidental. Liquid CO₂ is stored or vented — it becomes Sabatier feedstock in M10.

**Unlocks:** Permanent CO₂ removal. Liquid CO₂ stockpile growing.

---

## M7 — Hot Shower and Coffee

**Emergency:** None. That's the point.

**Objective:** Build a heat recovery loop: capture waste heat from the compressor (M6) or vent fluid, route it through a small water heater, deliver warm water to the shelter for a shower and hot drinks.

**Player learns:** Heat recovery, waste heat as resource, heat exchanger networks. The concept of integration — connecting outputs of one system to inputs of another.

**Units introduced:** No new units — just creative reuse of HEX, pipes, and the shelter.

**Narrative payoff:** Shower animation. Coffee animation. Kael and Lena have a real conversation — first genuine downtime since the crash. This is earned rest after M6's intensity.

**Design note:** This is M7 on purpose. After six missions of crisis, the player needs a reward. The engineering is easy. The emotion is the payload.

**Unlocks:** Crew morale. Player confidence. Warm water infrastructure reusable later.

---

## M8 — Burn What You Wasted

**Emergency:** Power demand growing. Battery and initial source won't sustain electrolysis + compressor + heating + shelter systems simultaneously. Brownouts becoming frequent.

**Objective:** The H₂ being vented since M4, and CH₄ from the vent — those are fuels. Build a gas engine (gas turbine) to burn them and generate electricity. Route exhaust (CO₂ + H₂O) back into the system.

**Player learns:** Combustion for power, fuel gas management, exhaust heat recovery. The "aha" moment: we've been throwing away energy since M4.

**Units introduced:** Gas turbine (combustion), mixer (fuel gas blending).

**Design note:** Exhaust CO₂ adds load to the scrubber from M6 — the player discovers that power and air quality are coupled. First real system interaction tension.

**Unlocks:** Adequate power for all systems. Fuel gas infrastructure. Exhaust integration.

---

## M9 — Keep It Cold

**Emergency:** Food crate spoilage accelerating. Visible food loss counter ticking up. Rations are shrinking.

**Objective:** Build a refrigeration loop to chill the food storage. Compressor, condenser, expansion valve, evaporator — a classic vapour-compression cycle.

**Player learns:** Refrigeration cycle, heat pumping (moving heat from cold to hot), COP concept. The same compression/expansion physics from M6 but run in reverse for a different purpose.

**Units introduced:** Refrigeration loop components (may reuse compressor, HEX, expansion valve from M6 in new configuration).

**Design note:** Deliberately placed after M6 so the player recognises the pattern: compress, cool, expand, evaporate. M6 was separation; M9 is temperature control. Same physics, different goal.

**Unlocks:** Food preservation. Zero spoilage losses. Extended food runway.

---

## M10 — Close the Carbon Loop

**Emergency:** CO₂ stockpile from M6 is filling up. Liquid CO₂ storage nearly full. Simultaneously, the crew needs CH₄ to fuel the rover for exploration beyond walking range.

**Objective:** Build a Sabatier reactor: CO₂ + 4H₂ → CH₄ + 2H₂O. Exothermic reaction at moderate temperature and pressure. Route CH₄ to rover fuel tank. Route water back to the main water supply.

**Player learns:** Catalytic reaction, stoichiometry in practice (need 4:1 H₂:CO₂ ratio), heat management of exothermic reaction (recover or reject heat), closing a material loop. CO₂ is no longer waste — it's feedstock.

**Units introduced:** Reactor (catalytic, Sabatier conditions).

**Narrative payoff:** The rover fills up. Lena and Kael can explore. The camera pulls back to show the whole flowsheet — a functioning life support system, built from wreckage. End of Arc A.

**Unlocks:** Rover operational. CO₂ loop closed. Foundation for everything that follows.

---

# Arc B — Development (Missions B1–B10)

**Setting.** The rover picks up a distress signal. Four survivors found at a crashed module 3km away. Population triples from 2 to 6. Every system from Arc A is now undersized. 

**Arc goal.** Build a self-sustaining community. End state: closed biosphere, diversified energy, food production, waste recycling.

**Crew:** 6 (Lena, Kael + 4 new survivors)

**Narrative engine:** Each Arc A system that was barely adequate for 2 people now buckles under 6. The missions follow the cascade of failures.

---

## B1 — Rescue Range

**Emergency:** Distress signal received. Survivors at 3km, but the rover's CH₄ tank only gives 2km range.

**Objective:** Build a H₂/O₂ fuel cell as a range extender. It's silent, efficient, and produces clean water as byproduct (recoverable). Supplement the gas engine with electrochemical power.

**Player learns:** Fuel cell as reverse electrolysis. Electricity directly from chemistry. The water byproduct closes a loop — fuel cell output feeds back to water supply.

**Units introduced:** Fuel cell (reactor_electrochemical, already implemented but first player use).

**Narrative payoff:** Rescue scene. Four new faces. Names, skills, personalities. The shelter feels crowded immediately.

**Unlocks:** 6 crew members. Triple demand on all systems. Everything starts alarming.

---

## B2 — Air for Six

**Emergency:** Six people in shelter designed for two. CO₂ scrubbing maxed out. Compressor-condenser from M6 running at 100%. Alarms.

**Objective:** Build a second room module. Duplicate the air recirculation loop. Balance airflow between the two rooms with fans and ducting.

**Player learns:** Parallel systems, load balancing, flow splitting. The first "scaling" mission — same concept as Arc A, but managing two interlinked loops.

**Units introduced:** Second room unit, splitter (airflow distribution).

**Design note:** This is intentionally not a new concept. The stress is in the scaling, not the novelty. The player's Arc A knowledge is validated.

**Unlocks:** Habitable space for 6. Air quality restored. Power deficit worsening.

---

## B3 — More Power

**Emergency:** Two rooms, six people, double the electrolysis, double the heating. Gas engine from M8 at maximum. Rolling brownouts. Critical systems tripping.

**Objective:** The second, larger vent discovered during the rescue run is hotter and wetter. Build a steam Rankine cycle: boil vent water in a HEX, expand steam through a turbine, condense in a second HEX, pump liquid water back. First real closed power cycle.

**Player learns:** Rankine cycle, boiler/turbine/condenser/pump loop. The distinction between M8's chemical energy (burning fuel) and B3's thermal energy (heat → work). Phase change as the working principle.

**Units introduced:** Steam turbine, pump (liquid), boiler HEX, condenser HEX (closed-loop configuration).

**Unlocks:** Major power upgrade. Stable grid for expanded operations.

---

## B4 — The Silent Killer

**Emergency:** A crew member collapses. CO poisoning — CO from the vent gas has been accumulating at low levels in the expanded system. Colorless, odorless. Nobody noticed until it was nearly too late.

**Objective:** Build a water-gas shift reactor: CO + H₂O → CO₂ + H₂. Converts toxic CO to manageable CO₂ (which the scrubber handles) and useful H₂ (which feeds into fuel/chemistry).

**Player learns:** Catalytic gas-phase reaction, hazard management, the concept that every stream has contaminants you can't ignore at scale. Also: CO₂ is bad, but CO is lethal at much lower concentrations.

**Units introduced:** Reactor (water-gas shift conditions — moderate temperature, simple catalyst).

**Narrative note:** This is the darkest mission. Someone nearly died from something invisible. Lena's dialogue here is critical — she's angry that they didn't check for CO sooner. The player feels genuine responsibility.

**Unlocks:** Clean gas processing. H₂ surplus from CO conversion. Safety culture established.

---

## B5 — First Harvest

**Emergency:** Food crate running low. Six mouths, finite supply. No resupply possible.

**Objective:** Build the first greenhouse module. Maintain temperature (heating against 278K exterior), humidity, CO₂ enrichment (ironic — pump some scrubbed CO₂ back in), and grow lighting from the power grid. Initial crop uses residual soil nutrients — no fertiliser yet.

**Player learns:** Greenhouse as controlled environment — essentially another "room" but for plants. CO₂ is toxic for humans but essential for plants. The same gas is waste in one context and feedstock in another.

**Units introduced:** Greenhouse (composite unit — air_in, air_out, water_in, waste_out, power_in).

**Narrative payoff:** First fresh food. The crew sits down for a real meal. Kael cooks. This is the B-arc equivalent of M7 — earned comfort after B1–B4's intensity.

**Unlocks:** Renewable food source (limited yield). Soil nutrient depletion timer starts.

---

## B6 — Fertiliser

**Emergency:** Greenhouse yield dropping. Soil nutrients exhausted. Crop output declining week by week.

**Objective:** Haber-Bosch synthesis: N₂ + 3H₂ → 2NH₃ at high pressure (~150 bar) and temperature (~450°C). Requires multi-stage compression of N₂ (from air) and H₂ (from electrolysis + water-gas shift). Reactor is exothermic — recover heat. Condense NH₃ (Tb = 240K, accessible with refrigeration from M9) and route to greenhouse.

**Player learns:** High-pressure operations for the first time. Peng-Robinson EOS matters here — NH₃ near its condensation point behaves non-ideally. Multi-stage compression with intercooling. Heat integration between exothermic reactor and endothermic separation.

**Units introduced:** High-pressure reactor, multi-stage compressor arrangement, NH₃ condenser.

**Design note:** This is the hardest mission yet. The payoff (fertiliser → food → survival) is clear, but the engineering is substantial. Lena guides the player more actively here.

**Unlocks:** Sustainable agriculture. Greenhouse at full yield. NH₃ production infrastructure.

---

## B7 — Sauna

**Emergency:** None. The crew is exhausted after B6.

**Objective:** Build a sauna from vent heat. Simple HEX to heat a small insulated room. Temperature control. Optional: cold plunge by opening an airlock to 278K exterior briefly.

**Player learns:** Nothing new — simple heat exchange. This is a reward mission.

**Narrative payoff:** Kael builds it as a surprise. Steam animations (S-SMOKE). The crew relaxes together for the first time as a full group of six. Dialogue reveals backstories of the new survivors.

**Optional hidden objective:** CO₂ lounge — a small adjacent room with intentionally elevated CO₂ (2–3%). Mild euphoria effect. Lena disapproves if she finds out. Morally ambiguous player choice. The engineering is trivial (partially bypass the scrubber), the narrative is rich.

**Unlocks:** Crew morale. Community bonding. Breathing room before B8.

---

## B8 — Close the Waste Loop

**Emergency:** Biological waste piling up. Six people produce significant waste. Current system just dumps it. Storage full. Hygiene crisis threatening. Risk of water supply contamination.

**Objective:** Build an anaerobic digester: organic waste (CH₂O proxy) → CH₄ + CO₂. Route biogas to the gas engine (M8) or fuel cell (B1). Route CO₂ to Sabatier (M10) or greenhouse (B5). Water from decomposition back to supply.

**Player learns:** Waste as resource. The matter loop closing — food → human → waste → biogas → power/chemistry → food. Circular system thinking.

**Units introduced:** Digester (reactor, slow conversion, residence-time-based).

**Narrative note:** Unglamorous but deeply satisfying. The flowsheet is now visibly circular. Lena remarks that this is how real ecosystems work.

**Unlocks:** Waste processing. Biogas stream. Circular material economy. Reduced external inputs.

---

## B9 — Energy Independence

**Emergency:** Primary vent showing pressure fluctuations. Output dropping 20%. The geothermal source that's sustained everything since M3 is weakening. If it fails, everything fails.

**Objective:** Deploy solar panels and wind turbines. Build battery storage for intermittent generation. Implement thermal storage (hot water tanks — heat when power is abundant, draw when it's scarce). Set up grid priority management: life support > food > comfort.

**Player learns:** Intermittent generation, diurnal cycles (S-DIURNAL spec), energy storage, grid management, load prioritisation. The transition from a single reliable source to a diversified but variable portfolio.

**Units introduced:** Solar panel, wind turbine, battery, thermal storage tank (hot water), grid controller.

**Design note:** This is a management mission more than a construction mission. The player has all the tools; the challenge is orchestrating them. Failure mode is not "you die" but "you lose comfort, then food, then air" in priority order.

**Unlocks:** Diversified energy. Reduced vent dependency. Resilient grid. S-DIURNAL gameplay loop active.

---

## B10 — The Beacon

**Emergency:** None. Everything is stable.

**Objective:** Light a permanent beacon — a high-visibility flare burning excess gas — to signal any other survivors or orbital assets. Engineer a steady, reliable combustion from surplus fuel gas. The player manages fuel allocation: enough to burn continuously without starving other systems.

**Player learns:** Resource allocation, surplus management. Also: controlled combustion, flare stack design.

**Narrative payoff:** The beacon lights up. The camera pulls out to show the settlement — two rooms, greenhouse, solar panels, the vent, a web of pipes. A functioning community. Lena speaks: "We're not just surviving. We're building."

**End of Arc B.** The beacon is visible. Something answers.

**Unlocks:** Arc C. Whatever responds to the beacon.

---

# Arc C — Advanced Engineering (Missions C1–C10)

> **Status: Skeleton. Missions identified, order tentative, narrative framing TBD.**

**Setting.** The beacon is answered — by an automated orbital relay, another settlement, or a rescue signal. Regardless, the community's ambition shifts from survival to capability. The challenges are no longer emergencies but opportunities: efficiency, scale, and mastery.

**Arc goal.** Push the PTIS engine to its thermodynamic limits. High-pressure operations, cryogenics, real-gas behaviour, advanced separation, and full biosphere closure.

**Crew:** 6+ (possible further additions)

**Design philosophy.** Arc C missions are longer, harder, more open-ended. Multiple valid solutions exist. The player is now experienced enough to design their own flowsheets with less hand-holding from Lena. Some missions may be optional / reorderable.

---

## C1 — Cryogenic Air Separation

**Concept:** Compress, cool, and distill air into pure N₂, O₂, and Ar streams using the FUG shortcut distillation column.

**Engine payoff:** First real use of the distillation column. Multi-component VLE. Cryogenic temperatures (77–90K). Peng-Robinson at low-temperature, high-pressure conditions.

**Game payoff:** Pure O₂ for medical storage and welding. Pure N₂ at scale for expanded Haber-Bosch. Liquid Ar as inert shielding gas. These enable downstream C-arc missions.

**Narrative hook:** Medical emergency requiring pure O₂. Or: Haber-Bosch efficiency limited by dilute N₂ feed.

---

## C2 — Supercritical CO₂ Power Cycle

**Concept:** Build an sCO₂ Brayton cycle using geothermal heat. CO₂ near its critical point (304K, 74 bar) — compact, efficient, the PR EOS at its most dramatic.

**Engine payoff:** The mission that justifies Peng-Robinson. Real-gas density, enthalpy departure functions, behaviour near the critical point where ideal gas is wildly wrong.

**Game payoff:** High-efficiency power from moderate-temperature heat. More watts per unit of geothermal input.

**Narrative hook:** Second vent declining. Need to extract more power from less heat. Efficiency matters now.

---

## C3 — Tame the Poison (H₂S Processing)

**Concept:** New vent source (or existing vent composition updated) contains H₂S. Toxic, corrosive. Claus process: 2H₂S + SO₂ → 3S + 2H₂O.

**Engine payoff:** Two new species (H₂S, SO₂). Gas-phase reaction with interesting equilibrium. Sulfur as solid product (novel output type).

**Game payoff:** Sulfur is a fertiliser component — potassium sulfate or sulfuric acid for soil amendment. Also: rubber vulcanisation if the game ever models materials.

**Narrative hook:** Vent composition shifts. H₂S alarms. The familiar "silent killer" pattern from B4 but with a different gas.

**Species cost:** +2 (H₂S, SO₂) → 13 total.

---

## C4 — Liquid Fuel (Methanol Synthesis)

**Concept:** CO + 2H₂ → CH₃OH. Gas-phase catalytic reaction at ~250°C and 50–100 bar. Liquid methanol as product.

**Engine payoff:** High-pressure catalytic reaction. Condensation of product. Experiment with reaction equilibrium (temperature/pressure tradeoff).

**Game payoff:** Liquid fuel — energy-dense, storable, transportable. Rover range upgrade. Possible trade commodity with other settlements.

**Narrative hook:** Rover expedition to distant signal requires more range than CH₄ tanks allow.

**Species cost:** +1 (CH₃OH) → 14 total.

---

## C5 — Heat Pump Revolution

**Concept:** Replace electric resistance heating across the settlement with heat pump systems. Use 278K exterior as heat source, deliver 3–4× heating per watt (COP 3–4).

**Engine payoff:** Reversed refrigeration cycle. COP as performance metric. Player sees power budget freed up dramatically.

**Game payoff:** Massive efficiency gain. Power freed for other uses. The "boring upgrade" that transforms the energy economy.

**Narrative hook:** Power grid at capacity. Growth stalled. Need efficiency, not more generation.

---

## C6 — Alcohol and Celebration

**Concept:** Greenhouse produces fermentable biomass. Composite black-box fermentation: sugars → ethanol + CO₂. Distillation column separates ethanol from water. First social luxury produced by chemistry.

**Engine payoff:** Binary distillation (ethanol-water is the textbook case). New use for the distillation column. Condenser and reboiler energy balance.

**Game payoff:** The bar. Social space. Crew morale. Celebration of how far they've come.

**Narrative hook:** One of the new survivors was a brewer. Community wants to celebrate one year on Planet X.

**Species cost:** +1 (C₂H₅OH) → 15 total.

---

## C7 — Medical Cryogenics

**Concept:** Produce and store cryogenic liquids (liquid O₂, liquid N₂) for medical applications — surgery, tissue preservation, sterilisation.

**Engine payoff:** Deep cryogenic temperatures. Liquefaction cycles (Linde or Claude cycle). Joule-Thomson effect. Storage vessel boil-off management.

**Game payoff:** Unlocks medical capability. Can treat injuries that were previously fatal. Narrative weight: a crew member's life saved by technology the player built.

**Narrative hook:** Medical emergency that existing first-aid can't handle. Pure O₂ from C1 isn't enough — need it liquid and cold.

---

## C8 — Closed Biosphere (ZERO)

**Concept:** Seal the entire settlement — no atmospheric exchange, no vent input, no waste output. Every atom recycles. The ultimate test of the player's flowsheet.

**Engine payoff:** Every loop must close perfectly. Mass balance across the entire system must net zero. Any leak, any imbalance, any accumulation of inerts (Ar, He) will eventually crash the system.

**Game payoff:** The prestige mission. The hardest challenge in the game. "Can your system run indefinitely with no external inputs?"

**Narrative hook:** Vent has finally failed. Or: deliberate challenge to prove the colony can survive anything.

---

## C9 — Terraforming Seed

**Concept:** Large-scale atmospheric CO₂ processing. Convert Planet X's 9% CO₂ atmosphere toward Earth-normal. Massive throughput, multi-train compression and reaction systems.

**Engine payoff:** Scale-up. Parallel process trains. The player designs for throughput, not just function.

**Game payoff:** The atmosphere outside starts changing. O₂ rising, CO₂ falling. Visible planetary change.

**Narrative hook:** Long-term vision. The colony decides to change the planet, not just survive on it.

---

## C10 — The Signal

**Concept:** The relay that answered the beacon carries a message. Someone is coming. Build the infrastructure to support a landing — fuel depot, power supply, life support for 50+ people. Everything the player has learned, at scale.

**Engine payoff:** Full system design. The player is the engineer now, not the student. Minimal guidance. Open-ended design challenge.

**Game payoff:** End of the game. The ship arrives. Planet X becomes a colony. Lena's final line: "We started with wreckage. Look what we built."

**Narrative hook:** Everything.

---

# Appendix: Species Registry Across Arcs

| # | Species | Formula | Introduced | First critical use |
|---|---------|---------|------------|-------------------|
| 1 | Water | H₂O | M1 (source) | M3 (condensation) |
| 2 | Oxygen | O₂ | M1 (source) | M4 (electrolysis) |
| 3 | Carbon dioxide | CO₂ | M2 (atmosphere) | M6 (scrubbing) |
| 4 | Nitrogen | N₂ | M2 (atmosphere) | B6 (Haber-Bosch) |
| 5 | Hydrogen | H₂ | M4 (electrolysis) | M8 (fuel) |
| 6 | Methane | CH₄ | M3 (vent gas) | M8 (fuel), M10 (Sabatier product) |
| 7 | Argon | Ar | M2 (atmosphere) | C1 (cryogenic separation) |
| 8 | Carbon monoxide | CO | M3 (vent trace) | B4 (water-gas shift) |
| 9 | Ammonia | NH₃ | B6 (Haber-Bosch) | B6 (fertiliser) |
| 10 | Formaldehyde (food proxy) | CH₂O | M5 (food crate) | B5 (greenhouse) |
| 11 | Helium | He | Background trace | C8 (inert accumulation) |
| 12 | Hydrogen sulfide | H₂S | C3 | C3 (sulfur recovery) |
| 13 | Sulfur dioxide | SO₂ | C3 | C3 (Claus process) |
| 14 | Methanol | CH₃OH | C4 | C4 (liquid fuel) |
| 15 | Ethanol | C₂H₅OH | C6 | C6 (distillery) |

---

# Appendix: Unit Introduction Sequence

| Mission | New units | Cumulative |
|---------|-----------|------------|
| M1 | Room, source, pipes | 3 |
| M2 | Heater, cooler, fan | 6 |
| M3 | Vent, HEX (radiator), open tank, separator | 10 |
| M4 | Electrolyser, pressure relief valve | 12 |
| M5 | Food crate (source), waste outlet | 14 |
| M6 | Compressor, condenser HEX, phase separator, expansion valve | 18 |
| M7 | (none — reuse) | 18 |
| M8 | Gas turbine, mixer | 20 |
| M9 | (refrigeration loop — reuse of M6 components) | 20 |
| M10 | Reactor (Sabatier) | 21 |
| B1 | Fuel cell | 22 |
| B2 | Splitter | 23 |
| B3 | Steam turbine, pump, boiler HEX | 26 |
| B4 | Reactor (WGS) | 27 |
| B5 | Greenhouse (composite) | 28 |
| B6 | (high-pressure configuration — reuse) | 28 |
| B7 | (none — reuse) | 28 |
| B8 | Digester (reactor variant) | 29 |
| B9 | Solar, wind, battery, thermal storage, grid controller | 34 |
| B10 | (flare stack — possibly new, possibly reuse) | 34–35 |
| C1+ | Distillation column, advanced configurations | 35+ |
