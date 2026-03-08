# Planet X — Narrative & Mission Trunk (v0.2)

> **Goal of this trunk:** a coherent, narrative-only basis doc for a 10‑mission prototype campaign. No implementation micromanagement.

---

## 1) Elevator pitch
A large ship breaks apart over **Planet X**. You survive inside a torn-off hangar section and must bootstrap a colony from almost nothing—using salvage, improvised rigs, and unforgiving physics. You learn thermodynamics by building real process flows that keep you alive, then keep others alive, then turn disaster into an ecosystem.

**Tone:** grim survival opening → cynical humor + occasional dark beats → pride and competence as the base grows.

**Core fantasy:** *"I’m not a hero—I’m the kind of nerd who figures it out."*

---

## 2) Premise and setting
### Planet X (why it matters)
Planet X is deceptively “Earth-ish” in feel, but the outside air is **not safely breathable** (high CO₂). The planet is also **resource-rich**: geothermal vents and abundant atmospheric gases give you enough raw material to bootstrap industry—if you can tame it.

### The crash and the starting location
- The main ship wreck is **not** a system you “restore.”
- The **starting base** is a torn-off **hangar/workshop module** plus a small **pressurized shelter compartment** that buys you only a short time.
- The **shipwreck** is a distant, dangerous salvage field. Reaching it safely becomes a mid/late-game logistical milestone.

### The inciting incident: the vent leak (intro only)
The impact drives part of the hull deep enough to puncture a hydrothermal pocket. A hot, pressurized mixed-gas leak fractures into a nearby compartment.

This is handled as **narrative introduction**, not Mission 1 gameplay: you (and possibly a nearby survivor) improvise a crude welded manifold and throttle valve to keep the leak from killing you and to route it as a controllable feed. Mission 1 then begins with a usable feed stream available—so the player can focus on the first real thermo problem (getting water).

### The player
- A surviving passenger turned improviser-engineer.
- Not the chief engineer; not special—just resourceful.
- Motivation evolves: **survive → stabilize → expand → build an industrial kingdom out of salvage**.

No rival colonies nearby. The planet is yours if you can survive it.

---

## 3) Narrative design principles
### Physics as playground
Physics sets the boundaries of what’s possible. The game is convincing, not textbook-perfect.
- The world doesn’t hand out free energy.
- The player earns every capability through work, heat, and constraints.
- Failure is informative: warnings, limits, and explanations—rare hard stops.

### “Salvage drives progression” (not tech-tree magic)
New capability comes from **what you can access, carry, and assemble**.
- Early salvage: small parts and light equipment.
- Mid salvage: skids and larger modules once EVA logistics exist.
- Late salvage: heavy modules once you have mobility, power margin, and safety.

### Demand grows with story (survivors)
As you explore, you find survivors.
- Population increases cause **step changes** in O₂/CO₂/water/heat loads.
- This forces scaling: buffers, redundancy, parallel trains, better efficiency.
- Demand increases are **scripted beats**, not constant babysitting.

---

## 4) How the story is delivered (flowsheet-first)
The prototype can feel “real” without 3D by using:
1. **Static illustrations** + short, punchy text beats (comic-panel density).
2. **Terminal logs** as flavor (black-box fragments, passenger notes, corporate disclaimers).
3. **Environmental meters**: habitat CO₂, O₂, humidity, temperature, water reserve, power margin.
4. **Milestone vignettes**: first water collected, first O₂ stability, frost on a valve, first rover departure.
5. **UI immersion shortcut**: replace the flowsheet grid with a Planet X / hangar floor backdrop.

---

## 5) The campaign arc (single canonical structure)
### Phase A — Survive (M1–M3)
You build fragile, improvised supply chains. Everything is scarce. Every mistake is costly.

### Phase B — Stabilize (M4–M6)
You stop living on emergency margins: steady power, controlled temperature, reliable storage.

### Phase C — Expand (M7–M9)
You industrialize. Salvage gets heavier. EVA and mobility become normal. The base starts looking like a plant.

### Phase D — Sustain (M10)
You stop thinking in linear chains and start thinking in cycles: a closed(ish) biosphere is the capstone.

---

## 6) The 10 missions (canonical list)
Each mission includes: a story need, a visible success condition, and a lasting upgrade.

### M1 — Water (Bootstrapping)
**Need:** You have heat and vent gas, but no water supply.
**Win fantasy:** pulling life out of alien air.
**Upgrade:** water storage + first stable utility.

### M2 — Oxygen (Breathing and fire)
**Need:** emergency O₂ is running out.
**Upgrade:** oxygen production for survival + controlled combustion later.

### M3 — First fuel (Sabatier as a lifeline)
**Need:** you need a reliable fuel path for field ops and generators.
**Upgrade:** methane fuel chain + water knock-out intuition.

### M4 — First steady power (Stop living on luck)
**Need:** you can’t scale on emergency power.
**Upgrade:** steady electricity; power becomes the currency of growth.

### M5 — Outdoor air taming (Industrial CO₂ scrubbing)
**Need:** Planet X air is lethal; you need limited breathable air for EVA/buffers.
**Upgrade:** an industrial air processor that unlocks safer outside work.

### M6 — Cold storage (First refrigeration loop)
**Need:** food spoils, meds degrade, comfort is unstable.
**Upgrade:** controlled cold; COP becomes intuitive.

### M7 — CO₂ cold logistics (Two-stage refrigeration, not deep cryo)
**Need:** you want inerting / portable cold / safer handling tools.
**Upgrade:** staged refrigeration + integration intuition; CO₂ becomes a resource.

### M8 — Fertilizer (Nitrogen fixation loop)
**Need:** to stop living on rations, you need hydroponics inputs.
**Upgrade:** nitrogen chemistry introduces recycle + purge + inerts; food production begins.

### M9 — Scaling and robustness (Make it industrial)
**Need:** more survivors + more machines demand reliability.
**Upgrade:** storage buffers, parallel trains, redundancy, efficiency—your base becomes a true plant.

### M10 — Closed biosphere (Ecosystem capstone)
**Need:** industrial life support is expensive and fragile at scale.
**Revelation:** plants are process units; an ecosystem is a process network.
**Gameplay:** three comprehensible composites—**Room**, **Human**, **Greenhouse**—close the CO₂/O₂/H₂O loops (almost).
**Upgrade:** the colony becomes largely self-sustaining; main external dependencies are electricity and nitrogen makeup.

---

## 7) The Thermo Bible (diegetic learning tool)
A battered **Thermodynamics & Field Processing Manual** is found in the starting debris.

Purpose:
- Provide operating envelopes, definitions, and “what to watch” so players don’t need external googling.
- Never provide step-by-step flowsheets.

Structure (10–20 pages):
- Principles (1–2 pages): conservation, phase intuition, COP.
- Field cards (1 page each): reaction overview, typical ranges, failure modes.
- Troubleshooting index (2 pages).
- Late-game **Closed Loop Appendix** (ecosystems as process networks).

---

## 8) Character and story beats (light touch)
- **You**: survivor-engineer.
- **Survivors**: discovered in a few scripted beats; each adds demand and stakes.
- **Wreck lore**: logs, disclaimers, last messages provide humor and darkness without adding mechanics.

---

## 9) Aesthetic direction
- Salvaged industrial look: painted metal, scratched acrylic, patched insulation.
- Minimalist readable HUD: gauges, meters, meaningful alarms.
- Planet palette: cold dust + harsh light; warm interior utility lighting.

---

## 10) Remaining open narrative choices (optional)
These are optional refinements, not blockers:
- Name and backstory of the ship (tone: corporate, utopian, cynical?).
- Exact survivor beats: how many rescues (e.g., 3–4) and after which missions.
- Why this ship was passing Planet X (accident, route miscalc, opportunistic stop?).
- The “end of prototype” hook after M10 (new biome, new region, or signal from orbit?).

