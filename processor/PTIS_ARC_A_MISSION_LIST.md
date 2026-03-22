# PTIS Arc A — Revised Mission List
### March 2026

| # | Title | Emergency | Core activity | New units | Preplaced | Key lesson |
|---|-------|-----------|--------------|-----------|-----------|------------|
| M1 | Breathe | No utilities | Connect O₂ + battery to shelter | O₂ canister, battery | Room | Tutorial: drag, connect, play |
| M2 | Clear the Air | CO₂ building | Build air loop: exhaust → scrubber → return → flare | CO₂ scrubber (finite LiOH) | + Flare | Recirculation loops, consumables |
| M3 | Find Water | Dehydration | Vent → cooler → barrel → shelter. Power dispatcher for multi-consumer | Power dispatcher, air cooler, barrel, opt. L/V separator | + Hydrovent | Condensation, power distribution |
| M4 | Make Oxygen | O₂ canister depleting | Electrolyser: water → H₂ + O₂ | Electrolyser | — | Electrolysis, renewable vs finite |
| M5 | Feed the Crew | Hunger | Connect food crate + waste dump | Food crate, waste sink | — | Metabolic model, spoilage |
| M6 | Stay Warm | 5°C inside, brownouts | Heater on air loop | Electric heater, opt. air cooler | — | Heat, thermal comfort |
| M7 | Burn What You Wasted | Power deficit | Gas engine from vented H₂ + vent CH₄ | Gas turbine, mixer | — | Combustion, waste = resource |
| M8 | Hot Shower | None (reward) | Heat recovery → hot water to shelter | (reuse) | — | Integration, morale |
| M9 | Scrub the Air | LiOH spent | Water-wash CO₂ absorption (requires S-HENRY) | (reuse: compressor, mixer, cooler, flash drum, heater, valve) | — | Gas absorption, Henry's law |
| M10 | Close the Loop | CO₂ stockpile + rover fuel | Sabatier: CO₂ + 4H₂ → CH₄ + 2H₂O | Catalytic reactor | — | Catalytic reaction, closing loops |

## Notes

**Power dispatcher timing:** Introduced M3 (not M6). Battery has no fan-out —
dispatcher required as soon as the air cooler becomes the second electrical consumer.

**LiOH scrubber lifetime:** Sized to last M2 through M8 (~7 missions of game time).
Depletion triggers fire during this period, becoming urgent during M9 setup.

**M9 → M10 pair:** M9 produces concentrated CO₂. M10 consumes it.

**S-HENRY prerequisite:** Henry's law K-values in flash. Required before M9 content.

**Preplaced units accumulate:** Room (M1) + Flare (M2) + Hydrovent (M3).
All locked. All subsequent missions inherit the full scene.

## Species Introduction

| Mission | New species | Cumulative |
|---------|------------|------------|
| M1 | — (ship air: O₂, N₂, Ar, CO₂) | 4 |
| M2 | — | 4 |
| M3 | H₂O, CH₄, H₂, CO (vent) | 8 |
| M4 | — | 8 |
| M5 | CH₂O (food) | 9 |
| M6–M10 | — | 9 |
