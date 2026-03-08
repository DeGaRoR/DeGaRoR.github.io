# Planet X — Colony Survival: 5 Missions
# ════════════════════════════════════════

    Planet X:  288 K (15°C)  |  0.885 atm  |  70% N₂  21% O₂  8% CO₂  1% Ar
    Status:    Breathable? NO — 8% CO₂ is lethal in minutes
    Resource:  Geothermal vents — hot gas (~500 K) rich in H₂O, CO₂, N₂, CH₄


────────────────────────────────────────────────────────────────────
 MISSION 1                                              ☐ WATER
────────────────────────────────────────────────────────────────────

  Goal       Collect 100 mol liquid water
  Chemistry  None — pure phase separation
  Principle  Hot gas contains water vapor. Cool it below 373 K,
             water condenses. Gravity separates liquid from gas.

       ┌──────┐     ┌─────────┐     ┌─────────┐     ┌────────┐
       │ VENT │────→│   AIR   │────→│  FLASH  │────→│  TANK  │
       │ 500K │     │ COOLER  │     │  DRUM   │     │ (H₂O)  │
       └──────┘     │  →300K  │     │         │     └────────┘
                    └─────────┘     │  gas ↑  │
                                    └────┬────┘
                                         │ CO₂ + N₂ + CH₄
                                         ↓ store for later

  New units  Air Cooler · Flash Drum · Tank
  Learns     Condensation · Flash separation · Phase behavior


────────────────────────────────────────────────────────────────────
 MISSION 2                                             ☐ OXYGEN
────────────────────────────────────────────────────────────────────

  Goal       Produce 50 mol O₂
  Chemistry  2 H₂O  →  2 H₂ + O₂          ΔH = +572 kJ/mol
  Principle  Electricity splits water into hydrogen and oxygen.
             Solar panels provide the power.

       ┌────────┐     ┌───────────────┐     ┌─────────┐
       │ WATER  │────→│ ELECTROLYZER  │────→│  TANK   │
       │  TANK  │     │               │     │(H₂ + O₂)│
       └────────┘     │    ⚡ ← SOLAR │     └─────────┘
                      └───────────────┘

  New units  Electrochemical Reactor · Grid Supply (solar)
  Learns     Electrochemistry · Power consumption · Energy balance


────────────────────────────────────────────────────────────────────
 MISSION 3                                               ☐ FUEL
────────────────────────────────────────────────────────────────────

  Goal       Produce 20 mol CH₄
  Chemistry  CO₂ + 4 H₂  →  CH₄ + 2 H₂O   ΔH = −165 kJ/mol
  Principle  Sabatier reaction — combine CO₂ waste from M1
             with H₂ from M2. Exothermic. Water byproduct
             recycles back to electrolyzer.

       ┌──────┐   ┌───────┐   ┌─────────┐   ┌─────┐   ┌───────┐
       │ CO₂  ├──→│       │──→│SABATIER │──→│ HEX │──→│ FLASH │
       │ tank │   │ MIXER │   │ REACTOR │   │     │   │ DRUM  │
       └──────┘   │       │   └─────────┘   └─────┘   ├───────┤
       ┌──────┐   │       │                            │ CH₄ ↑ │→ tank
       │  H₂  ├──→│       │                            │ H₂O ↓ │→ recycle
       │ tank │   └───────┘                            └───────┘
       └──────┘                                            │
                    ┌──────────────────────────────────────┘
                    ↓ recycle water → electrolyzer (M2)

  New units  Equilibrium Reactor · HEX · Mixer
  Learns     Catalytic reactions · Equilibrium · Recycle loops
  ★ First real process design — must balance flow rates


────────────────────────────────────────────────────────────────────
 MISSION 4                                              ☐ POWER
────────────────────────────────────────────────────────────────────

  Goal       Generate 10 kW net electrical power
  Chemistry  CH₄ + 2 O₂  →  CO₂ + 2 H₂O    ΔH = −890 kJ/mol
             or  2 H₂ + O₂  →  2 H₂O        ΔH = −572 kJ/mol
  Principle  Burn fuel with atmospheric air in a gas turbine cycle.
             Turbine shaft drives compressor + produces electricity.
             Colony becomes energy-independent.

                         shaft work
                    ┌─────────────────────┐
                    │                     │
       ┌──────┐   ┌┴──────────┐   ┌──────┴───┐   ┌─────────┐
       │ ATM  ├──→│COMPRESSOR │──→│COMBUSTOR │──→│ TURBINE │──→ exhaust
       │SOURCE│   └───────────┘   └──────────┘   │   ⚡→ ⚡ │
       └──────┘                        ↑          └─────────┘
       ┌──────┐                        │               │
       │ FUEL ├────────────────────────┘          electricity
       │ TANK │                                   to colony
       └──────┘

  New units  Compressor · Gas Turbine
  Learns     Combustion · Shaft work · Power cycles
  ★ Replaces solar — colony energy-independent


────────────────────────────────────────────────────────────────────
 MISSION 5                                      ☐ BREATHABLE AIR
────────────────────────────────────────────────────────────────────

  Goal       Produce 500 mol air with < 0.5% CO₂
  Chemistry  None — phase separation above CO₂ critical point
  Principle  CO₂ critical temperature = 304 K. Planet is at 288 K.
             Compress air to ~50 bar → air cool → CO₂ liquefies
             → flash drum removes liquid CO₂ → clean air remains.
             Multi-stage compression with intercooling.

       ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌───────┐
       │ ATM  ├─→│COMP  ├─→│ AIR  ├─→│COMP  ├─→│ AIR  ├─→│ FLASH │
       │SOURCE│  │  #1  │  │COOL 1│  │  #2  │  │COOL 2│  │ DRUM  │
       └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  ├───────┤
                                                          │air  ↑ │→ valve → tank
                                                          │CO₂  ↓ │→ liquid tank
                                                          └───────┘

  New units  Multi-stage compression · Valve (pressure letdown)
  Learns     Critical point · High-P separation · Process design
  ★ Hardest mission — intercooling, pressure management, optimization


════════════════════════════════════════════════════════════════════
 PROGRESSION
════════════════════════════════════════════════════════════════════

  SKILL                 M1        M2        M3        M4        M5
  ─────────────────── ──────── ──────── ──────── ──────── ────────
  Phase separation      ●
  Energy balance                  ●
  Reaction engineering                      ●
  Power systems                                       ●
  Process integration                                             ●

  COMPLEXITY            simple    simple    medium    medium    hard
  MAGIC UNITS           zero      solar¹    zero      zero      zero
  PRESSURE SYSTEM       no        no        no        yes       yes

  ¹ grid_supply is an ideal power source — honest simplification


  RESOURCE CHAIN:

  Vent gas ──→ ① WATER ──→ ② OXYGEN ──→ ③ FUEL ──→ ④ POWER
                  │              │             │           │
                  │              │ recycle H₂O ←           │
                  │              └─────────────┘           │
                  └───────────────────────────────→ ⑤ CLEAN AIR
                                                          │
                                              ════════════╧═══════
                                              COLONY SELF-SUSTAINING
                                              Water ✓  Oxygen ✓
                                              Fuel  ✓  Power  ✓
                                              Air   ✓
                                              ═══════════════════


  UNIT INTRODUCTION:

  M1  │ Air Cooler  Flash Drum  Tank  Atmosphere Source
  M2  │ + Electrochemical Reactor  Grid Supply
  M3  │ + Equilibrium Reactor  HEX  Mixer
  M4  │ + Compressor  Gas Turbine  Combustion Reactor
  M5  │ + Valve  (multi-stage = combining known units)

  By Mission 5, the player has used 11 unit types.
  All physics real. All balances exact. No magic.


════════════════════════════════════════════════════════════════════
 BEYOND: REAL PLANETS (endgame)
════════════════════════════════════════════════════════════════════

  Same engine. Same physics. Radically different challenges.

  MARS     210 K | 636 Pa (0.006 atm) | 95% CO₂
           Challenge: near-vacuum → extreme compression ratios
           Everything is cryogenic. Water is ice. CO₂ is dry ice.
           NASA's actual ISRU plan: Sabatier + electrolysis.

  TITAN    94 K | 1.47 atm | 95% N₂, 5% CH₄
           Challenge: no oxygen at all. Fuel everywhere, no oxidizer.
           Cryogenic methane lakes. How do you generate power?

  VENUS    737 K | 92 atm | 96.5% CO₂
           Challenge: everything is supercritical. Brutal pressure.
           CO₂ is above critical P AND T — can't liquefy it at all.
           Sulfuric acid clouds. Engineering nightmare.

  Each planet breaks a different assumption the player learned
  on Planet X. That's the replayability.
