# Closed Biosphere Loop — Design Document v3
# ═════════════════════════════════════════════

    Status:  Design specification for implementation in processThis
    Scope:   Humans + greenhouse + room + cooling — full recycle
    Engine:  Ideal gas / Raoult / Antoine — all gas-phase compounds
    Rev:     v3.1 — liquid water cycle added (drinking + wastewater)
             Greenhouse simplified (no purge — NH₃ exits via urine)
             Wastewater not recycled (vent water is abundant)
             Simulation parameters added (§16) — calibrated rates,
             lighting efficiency, alarm thresholds, all validated
             against NASA BPC, Lunar Palace 1, LED research


════════════════════════════════════════════════════════════════════
 1.  NEW COMPOUND: FORMALDEHYDE (CH₂O)
════════════════════════════════════════════════════════════════════

  Formula    CH₂O
  CAS        50-00-0
  MW         30.026 g/mol
  Tb         254.0 K (−19°C) at 1 atm
  Tc         408.0 K
  Pc         65.9 bar
  Role       "Food token" — proxy for carbohydrate (CH₂O)ₙ

  NIST data available: Antoine coefficients, Cp(ig) polynomial,
  ΔHf° = −115.9 kJ/mol (gas), S° = 218.8 J/mol·K.
  Standard gas-phase compound. Fits ComponentRegistry unchanged.

  WHY CH₂O AND NOT CH₄:

  The canonical photosynthesis equation is:

      CO₂ + H₂O  →  CH₂O + O₂

  This is not an approximation. Glucose is (CH₂O)₆. Using CH₂O
  means every reaction in the biosphere is the real biochemical
  equation from a biology textbook.

  Stoichiometric comparison for 0.4 mol/hr CO₂ production:

                   O₂ consumed   H₂O produced   Heat      Real human
                   ─────────────────────────────────────────────────────
  CH₄ proxy        0.80 mol/hr   0.80 mol/hr    99 W      —
  CH₂O proxy       0.40 mol/hr   0.40 mol/hr    63 W      0.50 / 0.40 / 100 W

  CH₂O matches H₂O production exactly and gets O₂ within 20%.
  Adjusting food rate slightly upward (~0.46 mol/hr) hits 100 W
  and 0.46 mol/hr O₂ — close to the real 0.50.


════════════════════════════════════════════════════════════════════
 2.  THE TWO REACTIONS
════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────┐
  │  PHOTOSYNTHESIS  (greenhouse reactor)                       │
  │                                                             │
  │  CO₂ + H₂O  →  CH₂O + O₂       ΔH ≈ +571 kJ/mol          │
  │                                                             │
  │  Endothermic. Powered by electricity (grow lights).         │
  │  Electrochemical reactor, same type as M2 electrolyzer.     │
  │  All other species (N₂, O₂, NH₃, Ar) pass through as       │
  │  non-participating species.                                 │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  METABOLISM  (human reactor)                                │
  │                                                             │
  │  CH₂O + O₂  →  CO₂ + H₂O       ΔH ≈ −571 kJ/mol          │
  │                                                             │
  │  Exothermic. Fixed conversion (complete combustion).        │
  │  NH₃ in feed passes through but is diverted internally      │
  │  to the liquid waste stream (kidney abstraction, see §5).   │
  └─────────────────────────────────────────────────────────────┘

  These are EXACT REVERSES. Every atom balances. Every joule
  balances. The engine handles both with existing reactor types.
  No new chemistry framework needed.


════════════════════════════════════════════════════════════════════
 3.  HUMAN METABOLIC RATES (per person, NASA ECLSS data)
════════════════════════════════════════════════════════════════════

  O₂ consumed       ~0.50 mol/hr
  CO₂ produced      ~0.40 mol/hr      (RQ ≈ 0.8)
  H₂O (respiration) ~0.40 mol/hr      (from reaction)
  H₂O (perspiration)~0.40 mol/hr      (additional, not from rxn)
  H₂O (drinking)    ~2.0  mol/hr      (~2.2 L/day)
  H₂O (urine)       ~2.0  mol/hr      (~2.0 L/day)
  Heat               100 W total       (75 W sensible, 25 W latent)

  For 6 colonists:  × 6

  O₂ consumed        3.0 mol/hr
  CO₂ produced       2.4 mol/hr
  H₂O (respiratory)  2.4 mol/hr       (exhaled to room)
  H₂O (perspiration) 2.4 mol/hr       (exhaled to room)
  H₂O (drinking)    12.0 mol/hr       (liquid, from M1 water tank)
  H₂O (urine)       12.0 mol/hr       (liquid, to waste sink)
  NH₃ (in food)      trace             (exits in urine)
  Heat                600 W


════════════════════════════════════════════════════════════════════
 4.  KEY INSIGHT: THE GREENHOUSE IS THE AIR PROCESSOR
════════════════════════════════════════════════════════════════════

  In nature, there is no industrial CO₂ scrubber. Plants ARE
  the CO₂ scrubber. A leaf takes in atmospheric air, strips CO₂
  and H₂O from it, locks the carbon into biomass, and releases
  O₂-enriched air.

  The greenhouse receives FULL ROOM AIR. The M5 industrial
  separation train is NOT part of the biosphere loop.

  What the greenhouse does to room air:

  IN:   N₂ + O₂ + CO₂↑ + H₂O↑ + Ar        (dirty room air)

  REACT: CO₂ + H₂O → CH₂O + O₂

  OUT:  N₂ + O₂↑ + CO₂↓ + H₂O↓ + Ar       (clean air return)
        CH₂O + NH₃                          (food, separate)

  The greenhouse simultaneously:
    ✓ Removes CO₂   (consumed by reaction)
    ✓ Removes H₂O   (consumed by reaction — dehumidification)
    ✓ Produces O₂    (produced by reaction)
    ✓ Produces food  (CH₂O separated as biomass)

  Four functions, one unit, ambient pressure, powered by light.

  M5 STILL EXISTS — FOR THE OUTDOOR ATMOSPHERE:

  The planet's atmosphere is 8% CO₂ and unbreathable. M5 is
  still essential for scrubbing outdoor air. The greenhouse
  only closes the loop INSIDE the habitat. Both coexist:

    M5:          Industrial — tames the alien atmosphere
    Greenhouse:  Biological — sustains life within the habitat

  The player's progression: primitive → industrial → ecological.


════════════════════════════════════════════════════════════════════
 5.  THE THREE ABSTRACTIONS
════════════════════════════════════════════════════════════════════

  The biosphere uses three operations inside composite units
  that do not correspond to standard thermodynamic unit
  operations. Each one maps to a real biological process.

  ─────────────────────────────────────────────────────────────
  ABSTRACTION #1: CH₂O separation in greenhouse
  ─────────────────────────────────────────────────────────────

  What we model:
    After the reactor, an internal separator pulls CH₂O (+ NH₃)
    out of the mixed gas stream and routes it to the food port.

  What it represents in nature:
    Photosynthesis produces solid glucose. Carbon leaves the gas
    phase and enters the condensed phase (plant tissue). It never
    goes back into the air. A leaf is a gas-phase reactor with a
    solid product outlet.

  Why it holds:
    The separation represents a real phase boundary. Biology
    produces a condensed-phase product from a gas-phase reactant.
    The abstraction is that we model this as an internal split
    rather than a true gas→solid phase change. The physical
    reality (carbon leaves the atmosphere) is exactly correct.

  Thermodynamic honesty: HIGH
    The operation has a real physical basis. The only
    simplification is mechanism, not outcome.

  ─────────────────────────────────────────────────────────────
  ABSTRACTION #2: NH₃ diversion in human (the kidney)
  ─────────────────────────────────────────────────────────────

  What we model:
    NH₃ enters the human in the food stream (gas phase).
    Inside the human unit, NH₃ is diverted from the gas
    exhaust to the liquid waste stream, mixed with drinking
    water.

  What it represents in nature:
    Humans ingest nitrogen as protein. The liver converts
    nitrogenous waste to urea. The kidneys dissolve urea
    in water and excrete it as urine. Almost zero nitrogen
    exits through the lungs. Exhaled air is CO₂ + H₂O + N₂
    with negligible nitrogen waste.

  Why it holds:
    The route is correct: nitrogen enters orally, exits in
    liquid waste, NOT in exhaled gas. A standard reactor
    would pass NH₃ to the gas outlet (inert pass-through).
    The diversion represents renal function — nitrogen
    crosses from gas-phase metabolism to liquid-phase excretion.
    Same class of abstraction as #1: a phase boundary that
    biology manages and that we model as an internal routing.

  Thermodynamic honesty: HIGH
    The mass balance is exact. The energy balance is exact.
    The route (gas→liquid) is biologically correct. Only
    the mechanism (kidney chemistry) is abstracted away.

  NOTE ON UREA:

    The actual biochemistry is:
      Liver:   2 NH₃ + CO₂ → CO(NH₂)₂ + H₂O   (urea synthesis)
      Kidney:  dissolve urea in water → urine
      Decomp:  CO(NH₂)₂ + H₂O → 2 NH₃ + CO₂    (hydrolysis)

    These two reactions are exact reverses. Net effect: zero.
    NH₃ → urea → NH₃. Urea is a transport molecule that
    carries nitrogen in a water-soluble, non-toxic form.
    Since the round trip is thermodynamically neutral, skipping
    it (routing NH₃ directly to liquid waste) is correct in
    terms of mass and energy balance.

    We cannot model urea explicitly because:
    — CO(NH₂)₂ is a solid at 295 K (mp = 406 K)
    — Requires aqueous-phase activity coefficients
    — Requires solid-liquid dissolution model
    — All outside the gas-phase engine constraints

    But we don't need to. The round trip cancels.

  ─────────────────────────────────────────────────────────────
  ABSTRACTION #3: Wastewater disposal (not separation)
  ─────────────────────────────────────────────────────────────

  What we model:
    Liquid wastewater (H₂O + NH₃) goes directly to a sink.
    No separation. No water recovery. Fresh water supplied
    continuously from the M1 vent condenser.

  What it represents in nature:
    On a planet with active geothermal vents producing
    abundant H₂O, recycling urine is unnecessary. You use
    fresh water and dump the waste. This is the opposite
    of the ISS (which recycles ~93% of wastewater) because
    the resource context is different.

  Why this is the right choice:
    Separating NH₃ from liquid H₂O at 295 K is not possible
    with a simple flash drum. A dilute NH₃/H₂O solution at
    1 atm has a bubble point around ~360 K — well above room
    temperature. Nothing flashes at 295 K. Zero separation.

    Real options would require:
    — Heating to ~400 K + flash (ammonia stripping)
    — But NH₃+H₂O is highly non-ideal (strong H-bonding)
    — Ideal Raoult would give quantitatively wrong results
    — Or vacuum distillation (ISS approach) — adds complexity

    Rather than introduce a thermodynamically dishonest
    separation, we accept the water loss. The vent produces
    far more water than 6 humans drink (~12 mol/hr drinking
    vs hundreds of mol/hr from vent condensation).

  Thermodynamic honesty: HIGH (by avoidance)
    We don't claim to separate something we can't separate
    with our engine. We use the planet's abundant resource
    instead. This is a real engineering decision, not a cheat.

  ─────────────────────────────────────────────────────────────
  ADVANCED OPTION (not in main mission path):
  ─────────────────────────────────────────────────────────────

  A player who notices that NH₃ is leaving in the waste can
  attempt: HEATER (→400 K) → boil everything → pipe vapor
  (H₂O + NH₃) back into greenhouse inlet. The greenhouse
  consumes the H₂O (needs it for photosynthesis) and passes
  the NH₃ through to food. Nitrogen loop closes completely.
  Haber becomes startup-only, not continuous.

  This is thermodynamically valid with existing units (heater
  + mixer). The Raoult inaccuracy on NH₃+H₂O doesn't matter
  because there's no separation — everything boils together.

  Could be a hidden achievement: "CLOSED ECOSYSTEM — eliminated
  continuous Haber dependency." Counterintuitive (boiling waste
  to feed a greenhouse), thermodynamically perfect, and exactly
  what real closed-loop life support research investigates.


════════════════════════════════════════════════════════════════════
 6.  THE GREENHOUSE — COMPOSITE UNIT
════════════════════════════════════════════════════════════════════

  The greenhouse takes full room air, reacts away CO₂ and H₂O,
  separates food from clean air, and returns breathable air.

  No purge needed. NH₃ exits the system through the human's
  liquid waste stream, not through the greenhouse air loop.

  INTERNAL STRUCTURE:

  ┌────────────────────────────────────────────────────────────┐
  │                     GREENHOUSE UNIT                        │
  │                                                            │
  │  room_air_in ──→ MIXER ──→ REACTOR ──→ SEPARATOR          │
  │  (N₂+O₂+CO₂+      ↑       CO₂+H₂O→     ↓       ↓       │
  │   H₂O+Ar)          │       CH₂O+O₂     air     food      │
  │                     │       all else   (clean)  (CH₂O     │
  │                NH₃ makeup   passes              + NH₃)    │
  │                     IN      through                       │
  │                                                     ⚡ IN │
  └────────────────────────────────────────────────────────────┘

  EXTERNAL PORTS (visible to player):

  Port            Type          Direction
  ──────────────  ────────────  ─────────
  room_air_in     MATERIAL      IN         full room atmosphere
  nh3_in          MATERIAL      IN         Haber makeup
  power_in        ELECTRICAL    IN         grow lights
  clean_air_out   MATERIAL      OUT        CO₂-depleted, O₂-enriched
  food_out        MATERIAL      OUT        CH₂O + NH₃ (biomass)

  Five ports. No purge port. Simpler than v2.

  INTERNAL SEPARATOR (Abstraction #1):

  After the reactor, the stream contains N₂, O₂, Ar (inerts),
  enriched O₂ (from reaction), depleted CO₂/H₂O, plus CH₂O
  (food) and NH₃ (nutrient).

  The separator splits:
    — Clean air:  N₂ + O₂ + Ar + residual CO₂/H₂O
    — Food:       CH₂O + NH₃

  Represents the biological fact that plants lock carbon into
  solid biomass. The food product never enters the atmosphere.

  INTERNAL tick() SEQUENCE:

  1. Read room_air_in: {N₂, O₂, CO₂, H₂O, Ar, ...}
  2. Mix NH₃ makeup (nh3_in) into room air stream
  3. Run reaction: CO₂ + H₂O → CH₂O + O₂
     All non-participating species pass through
  4. Separate product stream:
     — CH₂O + NH₃ → food_out
     — Everything else → clean_air_out
  5. Electrical consumption = reaction ΔH × moles converted


════════════════════════════════════════════════════════════════════
 7.  THE HUMAN — COMPOSITE UNIT
════════════════════════════════════════════════════════════════════

  The human eats, breathes, drinks, and excretes. Four material
  streams. Plus heat.

  INTERNAL STRUCTURE:

  ┌────────────────────────────────────────────────────────────┐
  │                      HUMAN UNIT                            │
  │                                                            │
  │  food_in ───→ ┐                                            │
  │  (CH₂O+NH₃)   │                                           │
  │                ├→ REACTOR → exhaust_out (gas)               │
  │  air_in ─────→ ┘  CH₂O+O₂→    CO₂ + H₂O vapor            │
  │  (room air)        CO₂+H₂O    (NO NH₃ — clean breath)     │
  │                                                            │
  │                    NH₃ diverted (Abstraction #2)            │
  │                      ↓                                     │
  │  water_in ──→ ── MIXER ──→ waste_out (liquid)              │
  │  (liquid H₂O        H₂O + NH₃                             │
  │   from M1 tank)      ("urine")                             │
  │                                                            │
  │                              heat_out (600 W)              │
  └────────────────────────────────────────────────────────────┘

  EXTERNAL PORTS:

  Port            Type          Direction   Phase
  ──────────────  ────────────  ─────────   ─────
  food_in         MATERIAL      IN          gas    CH₂O + NH₃
  air_in          MATERIAL      IN          gas    room atmosphere
  water_in        MATERIAL      IN          liquid drinking water
  exhaust_out     MATERIAL      OUT         gas    CO₂ + H₂O
  waste_out       MATERIAL      OUT         liquid H₂O + NH₃
  heat_out        HEAT          OUT         —      600 W

  Six ports.

  KEY INTERNAL OPERATIONS:

  1. Mixer combines food (CH₂O + NH₃) + air (N₂ + O₂ + ...)
  2. Reactor: CH₂O + O₂ → CO₂ + H₂O (complete conversion)
     NH₃ would normally pass to gas outlet as inert
  3. DIVERSION (Abstraction #2): NH₃ routed to liquid waste
     instead of gas exhaust. This is the kidney.
  4. Mixer combines NH₃ + drinking water → waste_out
  5. Gas exhaust: CO₂ + H₂O + N₂ + residual O₂ → exhaust_out
  6. Heat: colonist_count × 100 W → heat_out

  PARAMETER: colonist_count (1–12, default 6)
  Scales all rates linearly.

  EXHAUST IS CLEAN:

  Because NH₃ exits through waste_out (liquid), the gas
  exhaust contains NO nitrogen waste. The room atmosphere
  never accumulates NH₃. This means:
    — No NH₃ in room air → no NH₃ reaching greenhouse via air
    — All NH₃ reaches greenhouse via nh3_in port (Haber makeup)
    — No purge needed on the greenhouse
    — No inert accumulation problem in the gas loop


════════════════════════════════════════════════════════════════════
 8.  THE ROOM — PRESSURIZED TANK
════════════════════════════════════════════════════════════════════

  Volume:         50 m³ (parameter)
  Pressure:       ~1 atm, maintained by inlet flows
  Temperature:    Target 295 K, maintained by cooling HEX

  INLETS:

  1. Clean air from greenhouse (N₂ + O₂↑ + CO₂↓ + H₂O↓ + Ar)
  2. Human exhaust (CO₂ + H₂O + N₂ + residual O₂)

  OUTLETS:

  1. Room air to greenhouse (bulk atmospheric processing)
  2. Breathing air to human air_in

  COOLING:

  HEX rejects 600 W metabolic heat to ambient air (288 K).
  7 K ΔT. Simple air-cooled. No refrigeration needed.

  MONITORED KPIs:

  KPI               Target       Warning      Critical
  ────────────────   ──────────   ──────────   ──────────
  CO₂ mol%          < 0.5%       > 0.5%       > 2.0%
  O₂ mol%           19–23%       < 19%        < 16%
  Rel. Humidity      40–60%       > 70%        > 85%
  Temperature        293–297 K    > 300 K      > 305 K

  Relative humidity: RH = (x_H₂O × P) / Psat_H₂O(T) × 100
  Uses existing Antoine equation. One line of code.


════════════════════════════════════════════════════════════════════
 9.  THE WATER SUPPLY — M1 CONNECTION
════════════════════════════════════════════════════════════════════

  Mission 1 produces liquid water from geothermal vent gas.
  This water now has a permanent role in the biosphere:

  VENT (500 K) → AIR COOLER → FLASH DRUM → WATER TANK
                                              │
                                    drinking water (12 mol/hr
                                    for 6 colonists)
                                              │
                                              ↓
                                         HUMAN UNIT
                                              │
                                    wastewater (H₂O + NH₃)
                                              │
                                              ↓
                                           SINK

  The vent produces far more water than 6 humans drink.
  Typical vent condensation rate: hundreds of mol/hr.
  Human drinking rate: ~12 mol/hr.
  Water is the most abundant resource on Planet X.

  Wastewater is not recycled. The NH₃ it carries is the
  nitrogen lost from the biosphere. Replaced by Haber (M7).

  NARRATIVE SIGNIFICANCE:

  Mission 1 water is not just "the first thing you make."
  It is the permanent lifeline feeding the colony. The very
  first resource the player synthesized is the foundation
  of the biological cycle. Without drinking water, humans
  can't excrete nitrogen waste, NH₃ has no exit path, and
  the biology cannot function.

  M1 water → M7 NH₃ → greenhouse food → human → wastewater
  → back to needing M1 water. The first mission connects to
  the last link in the chain.


════════════════════════════════════════════════════════════════════
 10. COMPLETE FLOWSHEET
════════════════════════════════════════════════════════════════════

  EXTERNAL INPUTS:
    — Electricity (grow lights) from M8 / grid
    — NH₃ makeup from Haber (M7)
    — Liquid H₂O from vent condenser (M1)
    — Ambient air 288 K for room cooling HEX

  EXTERNAL OUTPUTS:
    — Wastewater to sink (H₂O + NH₃)
    — Warm air ~293 K (600 W rejected heat)


              NH₃ ←── HABER (M7)       H₂O ←── VENT/M1
                  │                         │
                  ↓                         │
             ┌──────────────────────┐       │
 room air ──→│     GREENHOUSE       │       │
             │                      │       │
             │ air + NH₃ → reactor  │       │
             │ CO₂+H₂O → CH₂O+O₂  │       │
             │ separate food / air  │       │
             │        ⚡←M8        │       │
             └───┬──────────┬───────┘       │
                 │          │               │
            clean air    food               │
                 │      (CH₂O+NH₃)          │
                 │          │               │
                 │          ↓               │
                 │     ┌─────────┐          │
                 │     │  HUMAN   │←── water (drinking)
                 │     │         │          │
                 │     │  eats   │          │
                 │     │  breathes ←── air (from room)
                 │     │  drinks │
                 │     │  excretes│
                 │     └──┬──┬──┬┘
                 │        │  │  │
                 │   exhaust │  waste (H₂O+NH₃)
                 │   (gas)   │     │
                 │   CO₂+H₂O │     └──→ SINK
                 │        │  │
                 │        │  heat (600 W)
                 ↓        ↓  ↓
             ┌──────────────────────────────┐
             │         ROOM (TANK)           │
             │     50 m³, 295 K, 1 atm       │
             │                              │
             │  CO₂ < 0.5%    O₂ > 19%      │
             │  RH  < 60%     T  ~ 295 K    │
             │                              │
             │        ┌──────────┐          │
             │  288K→ │ ROOM HEX │ →~293K   │
             │        │  600 W   │          │
             │        └──────────┘          │
             └──────┬───────────────────────┘
                    │
                    └──→ room air ──→ GREENHOUSE
                         (+ breathing air → HUMAN)


════════════════════════════════════════════════════════════════════
 11. FOUR CYCLES
════════════════════════════════════════════════════════════════════

  CARBON (fully closed):

  CO₂ → greenhouse → CH₂O (food) → human → CO₂
  No carbon enters or leaves in steady state.

  OXYGEN (fully closed):

  O₂ (room air) → human → H₂O (exhaled) → greenhouse → O₂
  The greenhouse returns O₂-enriched air to the room.

  WATER (two phases, both open but balanced):

  Gas loop:
    H₂O exhaled by human → room air → greenhouse → consumed
    (closed — greenhouse consumes what human exhales)

  Liquid loop:
    M1 vent → water tank → human (drinking) → waste → sink
    (open — continuous supply from vent, waste disposed)

  The gas-phase water cycle is closed by the reaction.
  The liquid-phase water cycle is open, fed by the vent.
  Total water on the planet: effectively unlimited.

  NITROGEN (open, linear):

  Haber → NH₃ → greenhouse (in food) → human → urine → sink
  Nitrogen exits in liquid wastewater. Replaced by Haber.
  This is the only continuous chemical dependency.

  ENERGY:

  IN:   Electricity (grow lights)
  OUT:  Heat (600 W to ambient via room HEX)
        + enthalpy in wastewater (minor)
  The biosphere is a heat engine running on electricity.


════════════════════════════════════════════════════════════════════
 12. WHAT THE GREENHOUSE REPLACES
════════════════════════════════════════════════════════════════════

  BEFORE (M5 industrial):

  room → COMPRESSOR → INTERCOOLER → COMPRESSOR → INTERCOOLER
       → FLASH DRUM → valve → room
                    → CO₂+H₂O liquid → further processing

  8 units. 50 bar. High power. Industrial separation.

  AFTER (greenhouse biological):

  room → GREENHOUSE → room + food → human

  1 unit. Ambient pressure. Powered by light.

  M5 remains essential for OUTDOOR atmosphere (8% CO₂).
  The greenhouse only closes the loop INSIDE the habitat.

  Player progression: primitive → industrial → ecological.
  The M5 compressor train is not wasted. It is surpassed.


════════════════════════════════════════════════════════════════════
 13. SYSTEM BOUNDARIES
════════════════════════════════════════════════════════════════════

  INTO THE BIOSPHERE:

  1. Electricity         Grow lights (greenhouse reaction)
  2. NH₃ (from Haber)    Nitrogen makeup (lost in wastewater)
  3. H₂O (from M1 vent)  Drinking water (lost in wastewater)
  4. N₂ + O₂ (initial)   One-time room fill from M5
  5. Ambient air 288 K   Cold side of room cooling HEX

  OUT OF THE BIOSPHERE:

  1. Wastewater           H₂O + NH₃ to sink
  2. Warm air ~293 K      600 W of rejected heat

  Everything else circulates internally.

  DEPENDENCIES ON PRIOR MISSIONS:

  Mission 1 (Water):    Continuous — drinking water supply
  Mission 2 (Oxygen):   Startup only — initial room O₂ fill
                        (greenhouse sustains O₂ afterward)
  Mission 4 (Power):    Continuous — electricity for grow lights
  Mission 5 (Clean air):Startup only — initial room N₂/O₂ fill
                        (greenhouse maintains air quality after)
  Mission 7 (NH₃):      Continuous — nitrogen makeup
  Mission 8 (Power+):   Continuous — enough power for everything


════════════════════════════════════════════════════════════════════
 14. IMPLEMENTATION CHECKLIST
════════════════════════════════════════════════════════════════════

  COMPONENT REGISTRY:

  ☐ Add CH₂O (formaldehyde) — Antoine, Cp, ΔHf°, S° from NIST
  ☐ Validate: T_boil, T_crit, Psat at 300 K, enthalpy at 298 K

  REACTION REGISTRY:

  ☐ R_PHOTOSYNTHESIS: CO₂ + H₂O → CH₂O + O₂
    ΔH ≈ +571 kJ/mol. Electrochemical reactor (power-driven).

  ☐ R_METABOLISM: CH₂O + O₂ → CO₂ + H₂O
    ΔH ≈ −571 kJ/mol. Fixed conversion = 1.0.

  UNIT REGISTRY — NEW UNITS:

  ☐ GREENHOUSE (composite unit)
    - 5 ports: room_air_in, nh3_in, power_in,
               clean_air_out, food_out
    - Internal: mixer + reactor + separator (Abstraction #1)
    - No purge (NH₃ exits via human waste, not air)
    - tick(): mix NH₃ into air → react → separate → emit

  ☐ HUMAN (composite unit)
    - 6 ports: food_in, air_in, water_in,
               exhaust_out, waste_out, heat_out
    - Internal: mixer + reactor + NH₃ diversion (Abstraction #2)
               + drinking water mixer for waste stream
    - Parameter: colonist_count (1–12, default 6)
    - Exhaust is CLEAN (no NH₃ in room air)
    - Waste is liquid (H₂O + NH₃)
    - Heat: colonist_count × 100 W

  TANK ENHANCEMENTS (needed for room):

  ☐ Compositional inventory tracking: {species: mol}
  ☐ Mole fraction KPIs in inspector
  ☐ Alarm thresholds:
    — CO₂ > 0.5% warning, > 2.0% critical
    — O₂ < 19% warning, < 16% critical
  ☐ Relative humidity: RH = (x_H₂O × P) / Psat_H₂O(T) × 100
    — RH > 70% warning, > 85% critical
  ☐ Temperature: > 300 K warning, > 305 K critical

  EXISTING UNITS (no changes needed):

  ✓ HEX — room cooling
  ✓ Atmosphere source — ambient air for cooling
  ✓ Sink — wastewater disposal
  ✓ Tank — M1 water storage (drinking supply)
  ✓ Grid supply / combined cycle — grow light power

  TESTS:

  ☐ C atom balance: C in (food) = C out (exhaust CO₂) per step
  ☐ O atom balance: O₂ consumed = O in CO₂ + O in H₂O produced
  ☐ H atom balance: H in food + H in drinking water
                   = H in exhaust H₂O + H in waste H₂O
  ☐ N balance: NH₃ in (Haber) = NH₃ out (wastewater) steady state
  ☐ Energy: electricity in = heat out + waste enthalpy
  ☐ Reverse symmetry: greenhouse + human at matching throughput
    produce equal and opposite mass/energy flows
  ☐ Room CO₂ alarm: reduce greenhouse throughput → CO₂ rises
  ☐ Room O₂ alarm: disable greenhouse → O₂ falls
  ☐ Humidity: verify room H₂O stabilizes when greenhouse runs
  ☐ Water supply: verify M1 tank drawdown matches drinking rate
  ☐ NH₃ routing: verify zero NH₃ in room atmosphere
  ☐ NH₃ in waste: verify waste_out contains NH₃


════════════════════════════════════════════════════════════════════
 15. NARRATIVE ARC
════════════════════════════════════════════════════════════════════

  Missions 1–5: INDUSTRIAL SURVIVAL
    Linear supply chains. CO₂ is waste. O₂ is product.
    Water is feedstock. M5 compressor train is the pinnacle.

  Biosphere mission: ECOLOGICAL SUSTAINABILITY
    Build greenhouse + human + room. Discover:
    — Greenhouse WANTS the CO₂ that humans produce
    — Humans WANT the O₂ that the greenhouse produces
    — Waste ↔ feedstock depending on context
    — M5 indoor air system becomes redundant
    — Plants do the same job, at ambient pressure, with light

  After: SELF-SUSTAINING COLONY
    External dependencies: electricity, nitrogen, water.
    Carbon and oxygen cycle internally. The colony is alive.

  THE DEEP LESSONS:

  1. A chemical plant and an ecosystem are the same thing:
     networks of reactions where mass and energy are conserved.

  2. Linear (industrial) vs cyclic (ecological) is the
     difference between consuming and sustaining.

  3. Biological systems are process plants optimized over
     geological time. Photosynthesis is a separation.
     Respiration is combustion. Evolution is the ultimate
     process optimization.

  4. Mission 1 water — the simplest thing the player made —
     turns out to be the foundation of all life in the colony.


════════════════════════════════════════════════════════════════════
 16. SIMULATION PARAMETERS — READY FOR IMPLEMENTATION
════════════════════════════════════════════════════════════════════

  All values calibrated to NASA ECLSS data (Strategy A:
  CO₂ production matched). Cross-validated against NASA BPC,
  Lunar Palace 1, published LED grow light studies, and
  real crop agronomy data.

  ─────────────────────────────────────────────────────────────
  HUMAN UNIT — per colonist
  ─────────────────────────────────────────────────────────────

  Parameter: colonist_count (integer 1–12, default 6)
  All rates below are PER PERSON. Multiply by colonist_count.

  INPUTS:

  Port         Species   Rate        Unit      Phase   Note
  ─────────    ───────   ──────────  ────────  ─────   ──────────────────
  food_in      CH₂O      0.95        mol/hr    gas     from greenhouse
  food_in      NH₃       0.036       mol/hr    gas     in food stream
  air_in       O₂        0.95        mol/hr    gas     consumed from room
  air_in       N₂,Ar     pass-thru   —         gas     returned in exhaust
  water_in     H₂O       4.63        mol/hr    liquid  drinking water

  OUTPUTS:

  Port         Species   Rate        Unit      Phase   Note
  ─────────    ───────   ──────────  ────────  ─────   ──────────────────
  exhaust_out  CO₂       0.95        mol/hr    gas     to room
  exhaust_out  H₂O       0.95        mol/hr    gas     respiratory (rxn)
  exhaust_out  H₂O       0.56        mol/hr    gas     perspiration*
  exhaust_out  N₂,Ar     pass-thru   —         gas     from air_in
  waste_out    H₂O       4.63        mol/hr    liquid  urine water
  waste_out    NH₃       0.036       mol/hr    liquid  urine nitrogen
  heat_out     —         137         W         —       metabolic heat

  * perspiration H₂O is recommended (adds humidity challenge)
    without it, gas-phase H₂O is perfectly balanced by rxn

  TOTALS FOR 6 COLONISTS:

  CH₂O consumed:    5.68 mol/hr    (170.5 g/hr)
  O₂ consumed:      5.68 mol/hr    (181.8 g/hr)
  CO₂ produced:     5.68 mol/hr    (249.9 g/hr)
  H₂O resp:         5.68 mol/hr    (102.3 g/hr)
  H₂O perspiration: 3.36 mol/hr    (60.5 g/hr)
  H₂O drinking:     27.8 mol/hr    (500 g/hr)
  H₂O urine:        27.8 mol/hr    (500 g/hr)
  NH₃ in urine:     0.21 mol/hr    (3.6 g/hr)
  Heat:              820 W

  ─────────────────────────────────────────────────────────────
  GREENHOUSE UNIT — sized by crew
  ─────────────────────────────────────────────────────────────

  All rates scale linearly with colonist_count.
  Values below are for 6 colonists.

  REACTION:  CO₂ + H₂O → CH₂O + O₂    ΔH = +519.4 kJ/mol

  INPUTS:

  Port         Species   Rate        Unit      Note
  ─────────    ───────   ──────────  ────────  ──────────────────
  room_air_in  N₂+O₂+   1420        mol/hr    full room atmosphere
               CO₂+H₂O                        (at 0.4% CO₂ target)
               +Ar
  nh3_in       NH₃       0.21        mol/hr    from Haber (M7)
  power_in     —         82          kW        grow light electricity

  OUTPUTS:

  Port          Species   Rate        Unit      Note
  ──────────    ───────   ──────────  ────────  ──────────────────
  clean_air_out N₂+O₂+Ar 1414        mol/hr    CO₂-depleted, O₂-enriched
  food_out      CH₂O      5.68        mol/hr    food (biomass proxy)
  food_out      NH₃       0.21        mol/hr    nutrient (pass-through)

  INTERNAL PARAMETERS:

  Parameter               Value     Unit      Note
  ──────────────────────  ────────  ────────  ──────────────────
  CO₂ fixation rate       5.68      mol/hr    = crew × 0.95
  H₂O consumption rate    5.68      mol/hr    1:1 with CO₂
  CH₂O production rate    5.68      mol/hr    1:1 with CO₂
  O₂ production rate      5.68      mol/hr    1:1 with CO₂
  Thermo minimum power    819       W         519.4 × 5.68
  Lighting efficiency η   1.0       %         parameter, adjustable
  Electrical demand        82       kW        819 W / η
  Waste heat (lighting)   81.2      kW        electrical − chemical
  Air changes per hour    0.69      /hr       1420 / 2065

  LIGHTING EFFICIENCY PARAMETER:

  η         Electrical    Corresponds to
  ────────  ────────────  ──────────────────────────────────────
  0.3%      273 kW        Conventional overhead LED
  0.5%      164 kW        Optimized LED, proven operational
  1.0%       82 kW        Best targeted close-canopy LED (NASA 2014)
  2.0%       41 kW        Theoretical limit, not demonstrated
  100%      819 W         Thermodynamic minimum (not physical)

  ─────────────────────────────────────────────────────────────
  ROOM (TANK) — fixed parameters
  ─────────────────────────────────────────────────────────────

  Parameter               Value     Unit
  ──────────────────────  ────────  ────────
  Volume                  50        m³
  Gas inventory (at STP)  2065      mol
  Target temperature      295       K
  Target pressure         101.325   kPa

  INITIAL COMPOSITION:

  Species   Mol fraction   Moles
  ───────   ────────────   ─────
  N₂        0.78           1611
  O₂        0.21           434
  Ar        0.01           21

  ALARM THRESHOLDS:

  KPI               Warning      Critical
  ────────────────   ──────────   ──────────
  CO₂ mol%          > 0.5%       > 2.0%
  O₂ mol%           < 19%        < 16%
  Rel. Humidity      > 70%        > 85%
  Temperature        > 300 K      > 305 K

  FAILURE TIMESCALES (greenhouse OFF, 6 colonists):

  Event                   Time
  ──────────────────────  ──────
  CO₂ hits 0.5% (warn)   1.8 hr
  CO₂ hits 2.0% (crit)   7.3 hr
  CO₂ hits 5.0% (lethal) 18.1 hr
  O₂ hits 19% (warn)     7.3 hr
  O₂ hits 16% (crit)     18.1 hr
  RH hits 60% (comfy)    ~9.5 hr  (with perspiration)

  COOLING:

  Humans only (greenhouse separate):  820 W
  Humans + greenhouse (same module):  82 kW
  Ambient temperature:                288 K
  ΔT available:                       7 K

  ─────────────────────────────────────────────────────────────
  EXTERNAL DEPENDENCIES — steady state
  ─────────────────────────────────────────────────────────────

  Resource        Rate        Unit      Source    Note
  ──────────────  ──────────  ────────  ────────  ──────────────
  Drinking H₂O   27.8        mol/hr    M1 vent   500 g/hr
  NH₃ makeup      0.21        mol/hr    M7 Haber  3.6 g/hr
  Electricity     ~84         kW        M8 × 4–5  grow lights + aux
  Ambient air     as needed   mol/hr    planet    cooling HEX cold side

  CONTEXT:

  M1 vent condenser output:  >> 100 mol/hr H₂O (ample)
  M7 Haber single batch:     10 mol NH₃ = 48 hr supply
  M8 combined cycle output:  20 kW (need 4–5 units)

  ─────────────────────────────────────────────────────────────
  THERMOCHEMISTRY REFERENCE
  ─────────────────────────────────────────────────────────────

  Species       ΔHf° (kJ/mol)   MW (g/mol)
  ──────────    ─────────────    ──────────
  CH₂O          −115.9           30.026
  O₂               0.0           31.998
  CO₂           −393.51          44.009
  H₂O (g)       −241.83          18.015
  H₂O (l)       −285.83          18.015
  NH₃            −45.90          17.031

  Metabolism:     CH₂O + O₂ → CO₂ + H₂O(g)   ΔH = −519.4 kJ/mol
  Photosynthesis: CO₂ + H₂O(g) → CH₂O + O₂   ΔH = +519.4 kJ/mol

  CALIBRATION NOTE:

  CH₂O proxy releases 23% more energy per carbon than real
  glucose (519.4 vs 423.0 kJ/mol). Calibrating to CO₂
  production (Strategy A) gives:
    CO₂:  exact      O₂:  −13%      Heat: +37%
  These errors are acceptable for gameplay and pedagogy.


════════════════════════════════════════════════════════════════════
 17. OPEN DESIGN QUESTIONS
════════════════════════════════════════════════════════════════════

  Q1: HUMAN AIR INTAKE ARCHITECTURE

  The human needs O₂ from room air. Two options:
  a) Explicit air_in port — room tank needs two outlets.
     Player sees breathing-air flow on the grid.
  b) Human implicitly draws from room — modeled as a
     draw rate. Simpler but less visible.
  Recommendation: (a) for visibility and pedagogy.

  Q2: FOOD STREAM PHASE

  CH₂O is a gas at 295 K (Tb = 254 K). On the pipe from
  greenhouse to human, "food" flows as vapor. Physically
  odd but thermodynamically consistent. The composite units
  abstract away the phase question at their boundaries.
  Unlikely to bother players. Not worth complicating.

  Q3: COLONIST COUNT GROWTH

  Fixed per mission (recommend 6) or growing dynamically?
  Growing population forces the player to scale up all
  systems. Interesting but complex. Recommend: fixed per
  mission, increasing across later missions.

  Q4: PERSPIRATION

  Extra ~0.4 mol/hr/person H₂O vapor not from the reaction.
  Options: small auxiliary H₂O source in room, or accept
  undercount. Greenhouse reaction consumes H₂O anyway, so
  the system self-corrects. Recommend: accept undercount
  for simplicity unless humidity balance is too far off.

  Q5: ADVANCED ACHIEVEMENT — WASTEWATER RECYCLE

  Player discovers: heater (→400 K) boils entire waste
  stream → vapor H₂O + NH₃ → pipe to greenhouse inlet.
  Greenhouse consumes H₂O, passes NH₃ to food. Nitrogen
  loop closes. Haber becomes startup-only. Water recycles.

  Hidden achievement: "CLOSED ECOSYSTEM"
  Counterintuitive, thermodynamically perfect, and exactly
  what real closed-loop life support research investigates.

  Not part of main mission. Optional optimization puzzle.
