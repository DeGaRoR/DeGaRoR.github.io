# PTIS Arc A — Revised Mission List
### March 2026

| # | Title | Emergency | Core activity | New units | Key lesson |
|---|-------|-----------|--------------|-----------|------------|
| M1 | Breathe | No utilities | Connect O₂ + battery to shelter | Shelter, battery, O₂ canister | Tutorial: pipes, ports, flow |
| M2 | Clear the Air | CO₂ building | Build air loop: exhaust → fan → LiOH scrubber → return | Fan, CO₂ scrubber (finite) | Recirculation, consumables |
| M3 | Find Water | Dehydration | Vent → cooler → separator → barrel → shelter | Vent, air cooler/HEX, separator, barrel | Condensation, phase change |
| M4 | Make Oxygen | O₂ canister depleting | Electrolyser: water → H₂ + O₂ | Electrolyser | Electrolysis, renewable vs finite |
| M5 | Feed the Crew | Hunger | Connect food crate + waste dump | Food crate, waste sink | Metabolic model, spoilage |
| M6 | Stay Warm | 5°C inside, brownouts | Heater on air loop + power dispatcher | Heater, power dispatcher, opt. cooler | Heat, power management |
| M7 | Burn What You Wasted | Power deficit | Gas engine from vented H₂ + vent CH₄ | Gas turbine, mixer | Combustion, waste = resource |
| M8 | Hot Shower | None (reward) | Heat recovery → hot water to shelter | (none — reuse) | Integration, morale |
| M9 | Scrub the Air | LiOH scrubber spent | Water-wash CO₂ absorption: compress + cold water + flash | (none — reuse: compressor, mixer, cooler, flash drum, heater, valve) | Gas absorption (Henry's law), pressure-swing |
| M10 | Close the Loop | CO₂ stockpile + need rover fuel | Sabatier: CO₂ + 4H₂ → CH₄ + 2H₂O | Catalytic reactor | Catalytic reaction, closing loops |

**Dependencies:** M9 requires S-HENRY engine enhancement (Henry's law K-values in flash).

**LiOH scrubber lifetime:** Sized to last M2 through M8 (~7 missions). Depletion triggers visible from M2 onwards, becoming urgent during M9.

**M9 → M10 pair:** M9 produces concentrated CO₂. M10 consumes it. The carbon loop closes across two missions.
