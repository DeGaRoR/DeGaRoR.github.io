# PTIS_PURITY_AND_VENT_DESIGN
## Contaminant Limits, Health Mechanics & Vent Composition
### Reference document for S10c, S5-lite (vent presets), PTIS_COMPOSITE_MODELS
### February 2026

---

> **Purpose.** Define contaminant thresholds for breathable air and
> drinkable water using all 10 registered species (11 post-S9 with
> CH₂O). Revise hydrothermal vent composition for richer gameplay.
> Source-of-truth for purity alarm envelopes on the room unit.
>
> **Design philosophy.** Numbers come from NASA SMACs (spacecraft
> maximum allowable concentrations) and WHO drinking water guidance,
> simplified for game readability. The player never sees "ppm" or
> "mg/L" — everything is mole percent or mole fraction, consistent
> with the simulation's composition tracking.

---

# 1. Registered Species (Current + S9)

| # | Species | MW | Phase at 298K, 1atm | Source in game | Role |
|---|---------|-----|---------------------|---------------|------|
| 1 | N₂ | 28.01 | Gas | Atmosphere, vent | Inert diluent. Haber feed. |
| 2 | O₂ | 32.00 | Gas | Atmosphere, electrolysis | Breathing. Combustion oxidant. |
| 3 | CO₂ | 44.01 | Gas | Atmosphere (8%), vent | Poison in air. Sabatier feed. Carbon source. |
| 4 | H₂O | 18.02 | Liquid (below 373K) | Vent (condensable), reactions | Drinking. Electrolysis feed. Universal solvent. |
| 5 | CH₄ | 16.04 | Gas | Vent, Sabatier product | Fuel. Explosion hazard. |
| 6 | H₂ | 2.02 | Gas | Electrolysis, vent | Fuel. Explosion hazard. Sabatier/Haber feed. |
| 7 | NH₃ | 17.03 | Gas (Tb 240K) | Haber product, vent (trace) | Fertilizer. Toxic in air and water. Refrigerant. |
| 8 | Ar | 39.95 | Gas | Atmosphere (1%), vent | Inert. Accumulates in recycle loops. |
| 9 | CO | 28.01 | Gas | Vent (trace), side reactions | Toxic. Colorless, odorless. Silent killer. |
| 10 | CH₂O | 30.03 | Gas (Tb 254K) | S9: food proxy | Food. Photosynthesis/metabolism substrate. |

---

# 2. Air Quality Limits

Based on NASA JSC 20584 SMACs (Rev C, June 2024) adapted for
game timescales. NASA defines 1-hour, 24-hour, 7-day, 30-day,
180-day, and 1000-day limits. For game purposes we use three
thresholds mapped to the consequence ladder.

## 2.1 Breathable Air Envelope

The room atmosphere is tracked as mole fractions. The alarm system
evaluates composition each tick.

### Oxygen (O₂)

O₂ depletion is the primary life support failure mode.

| Level | Mole % | Effect | Real-world basis |
|-------|--------|--------|-----------------|
| NOMINAL | 19.5–23.5% | Normal function | Standard atmosphere ~21% |
| WARNING | 18.0–19.5% | Vasquez comments, amber gauge | OSHA oxygen-deficient atmosphere <19.5% |
| MAJOR | 16.0–18.0% | Impaired judgment, headache, efficiency -30% | Cognitive impairment onset ~16% |
| CATASTROPHIC | <14.0% | Unconsciousness → death | Loss of consciousness <14%, death <10% |
| HIGH WARNING | >23.5% | Fire hazard. Amber gauge. | Oxygen-enriched atmosphere. Materials ignite more easily. |

### Carbon Dioxide (CO₂)

Planet X ambient is 8% CO₂ — immediately lethal. The shelter must
stay well below this. NASA removed CO₂ from the SMAC paradigm
because effects are progressive and dose-dependent.

| Level | Mole % | ppm equiv. | Effect |
|-------|--------|-----------|--------|
| NOMINAL | <0.5% | <5000 | Normal function |
| WARNING | 0.5–1.5% | 5000–15000 | Mild headache, Vasquez comments |
| MAJOR | 1.5–3.0% | 15000–30000 | Narcosis onset, efficiency -40%, countdown starts |
| CATASTROPHIC | >5.0% | >50000 | Unconsciousness, lethal above 8% |

### Carbon Monoxide (CO)

Colorless, odorless, undetectable without instruments. The silent
killer. Binds to hemoglobin 200× more strongly than O₂.

NASA SMAC: 55 ppm (7-day), 15 ppm (30-day+).

| Level | Mole % | ppm equiv. | Effect |
|-------|--------|-----------|--------|
| NOMINAL | <0.001% | <10 | Normal |
| WARNING | 0.001–0.005% | 10–50 | Mild headache over hours. Gauges can't detect — need CO sensor (unlockable). |
| MAJOR | 0.005–0.02% | 50–200 | Headache, dizziness, efficiency -50%. "Something's wrong but I can't tell what." |
| CATASTROPHIC | >0.04% | >400 | Lethal within hours |

**Gameplay note:** CO is the scariest contaminant because the
player can't easily see it. The room's O₂ gauge looks fine. The
CO₂ gauge looks fine. But crew health degrades. The diagnostic
challenge is: "Why is everyone sick when all the gauges are green?"
A CO sensor equipment item (unlocked M4+) adds a gauge. Until
then, the player has to notice the health alarm and trace upstream.

### Ammonia (NH₃)

NASA SMAC: 30 ppm (1-hr), 3 ppm (7-day+). Highly irritating.
Detectable by smell at ~5 ppm.

| Level | Mole % | ppm equiv. | Effect |
|-------|--------|-----------|--------|
| NOMINAL | <0.0003% | <3 | Normal |
| WARNING | 0.0003–0.003% | 3–30 | Eye/throat irritation. Vasquez: "Something stings." |
| MAJOR | 0.003–0.03% | 30–300 | Severe irritation, efficiency -40% |
| CATASTROPHIC | >0.05% | >500 | Lung damage |

### Methane (CH₄) — Explosion Hazard

CH₄ is non-toxic (simple asphyxiant). The danger is explosion.
LEL (Lower Explosive Limit) = 5% in air.

| Level | Mole % | Effect |
|-------|--------|--------|
| NOMINAL | <0.5% | Safe |
| WARNING | 0.5–1.0% | "Flammable gas detected." 10–20% of LEL. |
| MAJOR | 1.0–2.5% | "Explosion hazard." 20–50% of LEL. No ignition sources. |
| CATASTROPHIC | >5.0% | Explosive atmosphere. Any spark = catastrophic event. |

### Hydrogen (H₂) — Explosion Hazard

H₂ is non-toxic. LEL = 4% in air. Even harder to contain than CH₄
because H₂ is so light and diffusive.

| Level | Mole % | Effect |
|-------|--------|--------|
| NOMINAL | <0.4% | Safe |
| WARNING | 0.4–1.0% | "Flammable gas detected." 10–25% of LEL. |
| MAJOR | 1.0–2.0% | "Explosion hazard." 25–50% of LEL. |
| CATASTROPHIC | >4.0% | Explosive atmosphere. |

### Argon (Ar)

Inert. Non-toxic. Only dangerous if it displaces O₂ (already
covered by O₂ low alarm). No separate alarm needed.

### Formaldehyde (CH₂O) — Post-S9 only

NASA SMAC: 0.1 ppm (7-day), 0.04 ppm (180-day). Very irritating.
In practice, CH₂O in the game is food proxy inside locked
composites. It should never appear in room air. If it does,
something is very wrong (broken greenhouse membrane).

| Level | Mole % | Effect |
|-------|--------|--------|
| NOMINAL | 0% | Never in room air |
| WARNING | >0.00001% | >0.1 ppm. "Chemical smell. What IS that?" |
| MAJOR | >0.0001% | >1 ppm. Severe eye/respiratory irritation. |

## 2.2 Summary: Air Alarm Thresholds (mol%)

| Species | NOMINAL | WARNING | MAJOR | CATASTROPHIC |
|---------|---------|---------|-------|--------------|
| O₂ | 19.5–23.5 | 18.0–19.5 or >23.5 | 16.0–18.0 | <14.0 |
| CO₂ | <0.5 | 0.5–1.5 | 1.5–3.0 | >5.0 |
| CO | <0.001 | 0.001–0.005 | 0.005–0.02 | >0.04 |
| NH₃ | <0.0003 | 0.0003–0.003 | 0.003–0.03 | >0.05 |
| CH₄ | <0.5 | 0.5–1.0 | 1.0–2.5 | >5.0 |
| H₂ | <0.4 | 0.4–1.0 | 1.0–2.0 | >4.0 |
| CH₂O | 0 | >0.00001 | >0.0001 | — |

---

# 3. Water Quality Limits

Water composition is tracked the same way — mole fractions. Pure
drinking water is {H₂O: 1.0}. Real condensed water from the vent
carries dissolved gases.

### Why Water Purity Matters in the Game

Condensed water from the flash drum is NOT pure H₂O. Gases
dissolve in the liquid phase proportionally to their partial
pressure and solubility. On Planet X, the vent gas carries CO₂,
NH₃, CO, and CH₄. When the vapor condenses, some of each dissolves
in the water.

The simulation computes liquid composition from flash equilibrium.
NH₃ is very soluble in water. CO₂ is moderately soluble. CH₄ and
CO are poorly soluble. The flash drum does real thermodynamics —
which means the water purity is a natural consequence of the
separation, not a scripted number.

### Water Alarm Thresholds

WHO and NASA SWEG (Spacecraft Water Exposure Guidelines) adapted
for game use. Expressed as mole fractions of contaminant in the
liquid phase.

| Species | NOMINAL | WARNING | MAJOR | Notes |
|---------|---------|---------|-------|-------|
| H₂O (purity) | >99.5% | 98–99.5% | <98% | Below 98% = noticeably contaminated |
| NH₃ | <0.05% | 0.05–0.5% | >0.5% | Very soluble. Taste at ~0.1%. Harmful >1%. |
| CO₂ (dissolved) | <0.5% | 0.5–2% | >2% | Makes water acidic. Sharp taste. Corrosive. |
| CO (dissolved) | <0.01% | 0.01–0.1% | >0.1% | Poorly soluble, but toxic. Outgasses. |
| CH₄ (dissolved) | <0.1% | 0.1–1% | >1% | Fire hazard on outgassing. Not directly toxic. |
| CH₂O | <0.01% | 0.01–0.1% | >0.1% | Formaldehyde in water = toxic. Should never occur. |
| H₂ | — | — | — | Non-toxic. Outgasses instantly. No alarm needed. |
| N₂ | — | — | — | Inert. No alarm needed. |
| Ar | — | — | — | Inert. No alarm needed. |

### Consequence Ladder (Water)

Same structure as air, but slower-acting:

**WARNING:** Water tastes strange. Vasquez: "This water has a
metallic bite. Run it through a second separation if you can."
No health effect.

**MAJOR:** Gastrointestinal distress. Efficiency -20%. Crew
reluctant to drink. Water consumption rate drops → dehydration
countdown begins.

**CATASTROPHIC:** Not reached from water alone (you'd need
extremely contaminated water sustained for days). Instead, MAJOR
water contamination combines with other stresses to push toward
mission failure.

---

# 4. Revised Vent Composition

## 4.1 Why Enrich the Vent?

The current vent is 30/35/25/10 (H₂O/CO₂/N₂/CH₄). This makes
M1 trivially simple: cool the gas, collect pure water. No
separation challenge. No purity puzzle.

Real hydrothermal vents on Earth emit: H₂O, CO₂, H₂S, CH₄, H₂,
CO, N₂, NH₃, Ar, and trace metals. We can't use H₂S (not
registered), but we have CO, H₂, NH₃, and Ar — all of which
create gameplay.

The enriched vent serves three purposes:

1. **Water purity challenge.** NH₃ dissolves readily in the
   condensate. The player's first water is contaminated. Buffer
   tank + observation + fix = teaching moment.

2. **Free hydrogen.** H₂ from the vent supplements the electrolyzer.
   But it comes mixed with CO and CH₄. Separating it is a later
   challenge.

3. **CO as hidden hazard.** CO traces in the vent gas follow
   every process stream. Incomplete combustion in M4 produces more.
   The player gradually learns that CO is everywhere, silent, and
   must be managed.

## 4.2 Vent Presets (Revised)

### Vent 1 (Primary — hangar floor)

Moderate pressure, moderate temperature. The player's lifeline
from Day 0. Composition designed to make M1 non-trivial while
still solvable on the first try.

| Parameter | Value | Design intent |
|-----------|-------|---------------|
| T | 500 K | Hot enough for steam. Cool enough for equipment. |
| P | 3.0 bar | Drives flow through Cv without extreme compression. |
| Cv | 0.5 | Modest flow capacity. Limits throughput. |
| **Composition** | | |
| H₂O | 30% | Primary condensable. Drinking water source. |
| CO₂ | 28% | Sabatier + atmospheric feed. Reduced from 35% to make room. |
| N₂ | 18% | Inert carrier. Haber feed (eventually). |
| CH₄ | 10% | Fuel source from Day 0. |
| H₂ | 7% | Free hydrogen! But mixed with everything. |
| CO | 2% | The poison pill. Traces everything downstream. |
| NH₃ | 3% | Dissolves in condensate. Water purity challenge. |
| Ar | 2% | Inert. Accumulates in recycle loops. |

**Sum: 100%**

### Vent 2 (Jin's discovery — propulsion field, accessible M4+)

Higher pressure, same temperature. Larger Cv. The "upgrade" vent.

| Parameter | Value | Design intent |
|-----------|-------|---------------|
| T | 500 K | Same thermal source. |
| P | 4.0 bar | Higher driving pressure. Better throughput. |
| Cv | 1.2 | More flow capacity. |
| **Composition** | Same as Vent 1 | Geologically the same formation. |

### Deep Tap (Phase 3 — new discovery for biosphere)

Higher everything. The energy source that makes M10 possible.

| Parameter | Value | Design intent |
|-----------|-------|---------------|
| T | 550 K | Hotter = more enthalpy for power cycles. |
| P | 8.0 bar | High pressure = more flow, better turbine expansion. |
| Cv | 5.0 | Large capacity. Industrial-scale feed. |
| **Composition** | | |
| H₂O | 35% | More water for the colony. |
| CO₂ | 25% | Slightly less CO₂-rich (deeper formation). |
| N₂ | 15% | Less nitrogen. |
| CH₄ | 10% | Same fuel potential. |
| H₂ | 8% | More hydrogen (deeper serpentinization). |
| CO | 2% | Same trace level. |
| NH₃ | 3% | Same. |
| Ar | 2% | Same. |

**Sum: 100%**

## 4.3 What Happens When You Cool the Vent Gas?

Flash drum at ~315 K (ambient + 10 K approach from air cooler):

**Liquid phase (condensate):**
- Mostly H₂O (>95 mol%)
- Dissolved NH₃ (~2–4% depending on T and P) — very soluble
- Dissolved CO₂ (~0.5–1%) — moderately soluble
- Trace dissolved CO, CH₄ (<0.1%) — poorly soluble

**Vapor overhead:**
- CO₂ (dominant, ~35–40% of overhead)
- N₂ (~25%)
- CH₄ (~14%)
- H₂ (~10%)
- CO (~3%)
- Ar (~3%)
- H₂O vapor (equilibrium partial pressure at 315K, ~5%)
- NH₃ (some, reduced by dissolution)

The exact split comes from the flash calculation (Peng-Robinson
VLE from S3). The numbers above are estimates. The sim computes
the real answer.

### Gameplay Consequence

**M1 condensate analysis:**
The player collects water in a buffer tank. The composition shows
~96% H₂O, ~3% NH₃, ~0.8% CO₂, traces of everything else.

If piped directly to the room water supply: WARNING alarm after
the first few ticks. Vasquez: "That water has ammonia in it.
Three percent. I can smell it from here."

The fix is simple: the flash drum already does most of the work.
A second flash (re-flash the condensate at a lower pressure to
drive off dissolved gases) or just accepting slightly impure water
early (WARNING but no MAJOR at 3% NH₃) and fixing it later when
more equipment is available.

This is a soft lesson. The game doesn't fail — it just warns. The
player learns about dissolved gas contamination and buffer tank
monitoring. By M5, they're thinking about purity instinctively.

---

# 5. Contamination Pathways

Each mission introduces new contamination risks. This is by
design — the player's awareness of purity grows with complexity.

## M1: Water

**Risk:** NH₃ in condensate (from vent NH₃ dissolution).
**Severity:** WARNING (3% NH₃ → bad taste, slight health impact if
sustained).
**Fix:** Accept it for now. Re-flash later. Or route flash vapor to
waste (loses some NH₃ to vapor, cleaning the liquid).

## M2: Oxygen

**Risk:** O₂ from electrolysis is pure. Low risk. But: if the
player feeds vent-derived water (with dissolved CO₂) to the
electrolyzer, trace CO₂ electrolysis could produce trace CO at
the cathode.
**Severity:** Negligible at first. Creeping hazard if ignored.
**Fix:** Use clean water. The buffer tank lesson from M1 applies.

## M3: Fuel (Sabatier)

**Risk:** Recycle loop amplifies impurities. CO in the vent gas
enters the Sabatier feed. At Sabatier temperatures, water-gas
shift (CO + H₂O ↔ CO₂ + H₂) may partially convert CO, but some
passes through. Recycle concentrates it.
**Severity:** CH₄ product contains trace CO. If burned in M4, CO
shows up in exhaust.
**Fix:** Purge the recycle. The player is already learning this for
unreacted gases — now CO gives another reason.

## M4: Power

**Risk:** Incomplete combustion produces CO. Always. Even with
excess air, the gas turbine outlet contains 0.1–1% CO depending
on combustion temperature and stoichiometry.
**Severity:** Exhaust is routed to atmosphere (sink). Safe. UNLESS
the player routes exhaust near the shelter intake.
**Teaching moment:** The player builds an air intake for the shelter
scrubber (M5). If the intake is "near" the turbine exhaust (in
the 3D view this is spatial; in the flowsheet it's about which
source feeds the compressor), CO enters the air processing system.
**Fix:** Separate intake from exhaust. Real plant design.

## M5: Air Scrub (Boss)

**Risk:** Everything upstream. The membrane separator removes CO₂
but passes CO, CH₄, H₂, NH₃. If the vent-derived atmosphere
carries 2% CO (from vent gas leakage into the hangar), the
"clean" air still contains 2% CO. The membrane doesn't know CO
from N₂.
**Severity:** CO accumulates in the shelter. Slow. Creeping.
MAJOR after hours of game time.
**Fix:** Multiple separation steps. Or: ensure the air intake
draws from clean atmosphere, not from the hangar where vent gas
disperses. Spatial awareness.

## M8: Fertilizer (Haber)

**Risk:** Liquid NH₃ product must be stored safely. NH₃ leak in
the shelter is a rapid MAJOR alarm.
**Severity:** NH₃ is pungent — detectable at 5 ppm. The player
will notice immediately.
**Fix:** Sealed storage. Distance from shelter.

## M9: Cryo

**Risk:** Cryogenic liquids outgas violently if containment fails.
A liquid O₂ spill in an enclosed space creates an oxygen-enriched
atmosphere (fire hazard). A liquid CH₄ spill creates an explosive
atmosphere.
**Severity:** CATASTROPHIC if containment fails on cryogenic
storage near the shelter.
**Fix:** Outdoor storage (Dewar tanks). S-SIM catastrophic event.

---

# 6. Implementation Notes

## 6.1 Room Unit Alarm Sources

The room unit (shelter) gets composition-checking alarm sources
added to its tick function. Each tick:

```
for each species in room.atmosphere.composition:
    check against air alarm thresholds (§2.2)
    emit PLANT alarm at appropriate severity

for each species in room.waterSupply.composition (if connected):
    check against water alarm thresholds (§3)
    emit PLANT alarm at appropriate severity
```

Alarm domain: PLANT (not SIM). The player sees them in the alarm
panel. Vasquez dialogue triggers on specific alarm IDs.

## 6.2 Buffer Tank Composition Display

Buffer tanks between processes and the room should display
composition in the inspector with color-coded purity:
- Green: all species within NOMINAL
- Amber: any species in WARNING
- Red: any species in MAJOR

This gives the player a pre-check before connecting a new feed to
the room.

## 6.3 CO Sensor Equipment Item

CO is undetectable by human senses until it's too late. The
game reflects this: the room's CO gauge is HIDDEN until the
player unlocks a CO sensor (salvage from M4 propulsion wreckage,
or craftable post-M5).

Before the sensor: CO contamination shows up only as a "Health
declining" alarm with no specific species identified. The player
has to hypothesize "CO?" and test by checking upstream compositions.

After the sensor: the CO gauge appears on the room wall. This is
both a gameplay unlock and a teaching moment about industrial
safety culture.

## 6.4 Explosion Mechanics

CH₄ and H₂ above their LEL in an enclosed space don't cause
gradual health decline — they cause CATASTROPHIC events if an
ignition source is present. Ignition sources include:
- The Brayton cycle combustion reactor
- Electrical equipment (compressors, pumps)
- Any equipment with T > autoignition temperature

The check: if (room.CH4 > 5% OR room.H2 > 4%) AND any ignition
source is running inside the room → CATASTROPHIC: explosion event.
This is immediate, not gradual. Dramatic. Educational.

**Prevention:** Don't route CH₄ or H₂ process streams through the
shelter. Use buffer tanks outdoors. Vent gas processing should be
outside the sealed room. The player learns spatial process design.

---

# 7. Design Decisions

## 7.1 Simplifications for Gameplay

| Real world | Game simplification | Reason |
|-----------|-------------------|--------|
| CO toxicity depends on exposure time × concentration (Ct product) | Three fixed thresholds (WARNING/MAJOR/CATASTROPHIC) | Keep it readable. The creeping dynamic still teaches the concept. |
| Gas solubility depends on Henry's law coefficients per species per temperature | Flash drum handles this via Peng-Robinson VLE | No simplification needed — the sim already does it right. |
| CO₂ narcosis is progressive (drowsiness → confusion → unconsciousness) | Two thresholds (MAJOR at 1.5%, CATASTROPHIC at 5%) | Sufficient for gameplay. Gradual efficiency drop covers the continuum. |
| NH₃ has different thresholds for short-term vs long-term | Single set of thresholds | Game ticks are ~minutes of game time. Long-term is the right regime. |
| Explosive limits depend on O₂ concentration | Fixed LEL (5% CH₄, 4% H₂) | O₂ is ~21% in the shelter. Close enough to standard conditions. |

## 7.2 What We Don't Model

| Phenomenon | Why omitted |
|-----------|-------------|
| Radiation | No radioactive species registered. Planet X has no nuclear hazard. |
| Particulates / dust | No solid phase in simulation. |
| Noise | No acoustic model. |
| Psychological stress | Human composite models metabolic rates only. |
| Temperature stress | Room temperature alarm exists separately (from COMPOSITE_MODELS §3). Hypothermia/hyperthermia are thermal, not chemical. |

---

# 8. Cross-References

| Topic | Source |
|-------|--------|
| Room composite model (atmospheric tank) | PTIS_COMPOSITE_MODELS §3 |
| Room alarm envelopes (existing thermal) | PTIS_COMPOSITE_MODELS §3.3 |
| Day-0 depletable configuration | PTIS_COMPOSITE_MODELS §4 |
| Vent source definitions | PTIS_COMPOSITE_MODELS §6 (to be updated per §4 of this doc) |
| Flash drum VLE calculation | S3 (Peng-Robinson), S5-lite (flash_drum tick) |
| Alarm system infrastructure | S1 (AlarmSystem), S-SIM (catastrophic modal) |
| Mission purity challenges | PTIS_MISSION_DESIGN_V2 §20 (per-mission contamination notes) |
| NASA SMACs source | JSC 20584 Rev C (June 2024) |
| WHO drinking water guidance | WHO Guidelines for Drinking-water Quality, 4th ed. |
