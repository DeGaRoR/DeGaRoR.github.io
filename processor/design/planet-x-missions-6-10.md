# Planet X — Colony Survival: Missions 6–10
# ════════════════════════════════════════════

    Colony status after Mission 5:
    Water ✓  Oxygen ✓  Fuel ✓  Power ✓  Breathable Air ✓

    But survival ≠ thriving.
    The habitat is 15°C. Food won't grow. Power is fragile.
    Reserves are gaseous — one leak and it's gone.
    And nobody is going anywhere.


────────────────────────────────────────────────────────────────────
 MISSION 6                                             ☐ WARMTH
────────────────────────────────────────────────────────────────────

  Goal       Deliver 5 kW of heat to habitat at 295 K (22°C)
             using ≤ 2 kW electrical input  →  COP ≥ 2.5
  Chemistry  None — pure thermodynamic cycle
  Principle  A heat pump moves heat uphill. CO₂ from the atmosphere
             is the working fluid — abundant and free.
             Planet T = 288 K, CO₂ critical T = 304 K.
             The cycle is transcritical: supercritical on the hot
             side, subcritical evaporation on the cold side.

       ┌─────────────────────────────────────────────────┐
       │                 closed CO₂ loop                 │
       │                                                 │
       │  ┌──────────┐   ┌───────────┐   ┌───────┐   ┌──────────┐
       └─→│COMPRESSOR├──→│  GAS HEX  ├──→│ VALVE ├──→│EVAPORATOR├─┘
          │  ⚡ ≤2kW │   │ (heats    │   │ P↓ T↓ │   │(absorbs  │
          └──────────┘   │  habitat) │   └───────┘   │ ambient  │
                         │  →295 K   │               │  288 K)  │
                         └───────────┘               └──────────┘
                           5 kW to                    heat from
                           colony                     outside air

  New units  None — closed loop is the new concept
  Learns     Heat pump cycle · COP · Transcritical CO₂ · Energy
             flows from cold to hot with work input
  ★ First closed thermodynamic cycle — working fluid is recycled
    endlessly. No chemical reaction, pure thermodymamics.
  ★ Planet ambient (288 K) is just below CO₂ critical T (304 K)
    — this is not a coincidence. The planet was designed for it.


────────────────────────────────────────────────────────────────────
 MISSION 7                                         ☐ FERTILIZER
────────────────────────────────────────────────────────────────────

  Goal       Produce 10 mol liquid NH₃
  Chemistry  N₂ + 3 H₂  →  2 NH₃           ΔH = −92 kJ/mol
  Principle  Haber synthesis. Equilibrium-limited — only ~15%
             conversion per pass. Must recycle unreacted gas.
             At 100+ bar and 288 K, NH₃ condenses while
             N₂ and H₂ remain gaseous → flash separation.
             Ar from the feed slowly accumulates → purge needed.

  Source N₂  Clean air from M5 (still contains ~1% Ar)
  Source H₂  Electrolysis from M2

                           recycle N₂ + H₂ + Ar
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ↓                                     │
  ┌─────┐  ┌───────┤  ┌──────┐  ┌─────────┐  ┌───────┐  │  ┌──────┐
  │ N₂  ├─→│       │  │ COMP │  │SABATIER │  │  AIR  │  │  │FLASH │
  │ tank│  │ MIXER ├─→│  →   ├─→│ REACTOR ├─→│COOLER ├──┼─→│ DRUM │
  └─────┘  │       │  │100bar│  │ 450°C   │  │→288 K │  │  ├──────┤
  ┌─────┐  │       │  └──────┘  └─────────┘  └───────┘  │  │NH₃ ↓ │→ tank
  │ H₂  ├─→│       │                                     │  │gas ↑ │─→ splitter
  │ tank│  └───────┘                                     │  └──────┘     │
  └─────┘                                                │          ┌────┴────┐
                                                         └──recycle─┤SPLITTER │
                                                                    │         │
                                                                    └────┬────┘
                                                                         │
                                                                     purge (Ar)

  New units  Splitter (divides flow — purge vs recycle)
  Learns     Haber process · Equilibrium-limited reaction ·
             Recycle loop · Inert accumulation · Purge strategy
  ★ First mission with recycle convergence — the player must
    balance purge rate: too little → Ar builds up and kills
    conversion; too much → wastes reactants.
  ★ NH₃ is critical for greenhouse hydroponics — no ammonia,
    no nitrogen source, no food, no long-term colony.


────────────────────────────────────────────────────────────────────
 MISSION 8                                         ☐ MORE POWER
────────────────────────────────────────────────────────────────────

  Goal       Generate 20 kW net power from the same fuel as M4
  Chemistry  Same as M4:  CH₄ + 2 O₂ → CO₂ + 2 H₂O
  Principle  The gas turbine exhaust from M4 is still hot (~600 K).
             That heat is being wasted. Boil water with it, expand
             the steam through a second turbine → more electricity.
             This is a combined cycle — Brayton (M4) on top,
             Rankine (steam) on the bottom. Same fuel, nearly
             double the power.

  ─── BRAYTON TOPPING CYCLE (from M4) ───

  ┌──────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
  │ ATM  ├─→│COMPRESSOR├─→│COMBUSTOR ├─→│GAS TURB.├──→ exhaust
  │SOURCE│  └──────────┘  └──────────┘  │  ⚡ 10kW │   still hot
  └──────┘       ↑ shaft ──────────────→┘          │   ~600 K
  ┌──────┐                                         │
  │ FUEL ├──→ combustor                            │
  └──────┘                                         │
                                                   ↓ hot exhaust

  ─── RANKINE BOTTOMING CYCLE (new) ───

          hot exhaust                      cooled exhaust
               │                                 ↑
               ↓                                 │
  ┌──────────────────────────────────────────────────────────────┐
  │                    closed H₂O loop                           │
  │                                                              │
  │  ┌───────┐    ┌───────────┐    ┌─────────┐    ┌──────────┐  │
  └─→│ BOILER├───→│STEAM TURB.├───→│AIR COOL ├───→│   PUMP   ├──┘
     │(HEX)  │    │   ⚡ 12kW │    │(condense│    │  liquid   │
     │H₂O→stm│    └───────────┘    │ steam)  │    │  →10 bar  │
     └───────┘                     └─────────┘    └──────────┘

  Net gain   Gas turbine ~10 kW + Steam turbine ~12 kW
             − Compressor − Pump ≈ 20 kW net
  New units  Pump (liquid pressurizer — like compressor but
             for liquids; tiny work because liquids are
             nearly incompressible)
  Learns     Rankine cycle · Combined cycle · Waste heat recovery
             · Why power plants use steam · Pump vs compressor
  ★ Dramatic payoff — same fuel, double the electricity.
    The colony can now run the electrolyzer, heat pump,
    AND Haber compressor simultaneously.


────────────────────────────────────────────────────────────────────
 MISSION 9                                          ☐ RESERVES
────────────────────────────────────────────────────────────────────

  Goal       Liquefy and store 50 mol liquid O₂ (at ~90 K)
  Chemistry  None — pure thermodynamics
  Principle  No refrigerant exists at 90 K on this planet. You
             must manufacture cold from pressure and expansion.
             Compress O₂, cool to ambient, then expand through
             a turboexpander — isentropic expansion cools the
             gas far below ambient. Counterflow HEX transfers
             that cold to the incoming stream. After enough
             pre-cooling, a final J-T valve liquefies a fraction.
             Unliquefied vapor recycles. This is the Linde cycle
             with a turboexpander assist.

  O₂ data    T_crit = 154.6 K  |  P_crit = 50.4 bar
             T_boil = 90.2 K (at 1 atm)

                       recycle cold vapor
               ┌───────────────────────────────────────┐
               │                                       │
               ↓                                       │
  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐  ┌─────┐ │ ┌───────┐
  │  O₂  ├─→│ COMP ├─→│ AIR  ├─→│COUNTER-  ├─→│SPLIT│─┤→│ VALVE │
  │ feed │  │→80bar│  │COOLER│  │FLOW HEX  │  │     │ │ │ J-T   │
  └──────┘  └──────┘  │→288K │  │(cold side │  └─────┘ │ └───┬───┘
                      └──────┘  │ from below)│         │     │
                                └───────────┘         │     ↓
                                     ↑                │  ┌───────┐
                                     │                │  │ FLASH │
                                     │                │  │ DRUM  │
                                     │                │  ├───────┤
                                     │  ┌───────────┐ │  │liq O₂↓│→ tank
                                     │  │TURBO-     │ │  │vap  ↑ │──┐
                                     │  │EXPANDER   │←┘  └───────┘  │
                                     │  │(isentropic│               │
                                     │  │ expansion)│               │
                                     │  │   ⚡→grid │               │
                                     │  └─────┬─────┘              │
                                     │        │ cold gas            │
                                     │        ↓                     │
                                     │  ┌───────────┐              │
                                     └──┤   MIXER   │←─────────────┘
                                        │(cold vapor │
                                        │ streams)   │
                                        └────────────┘

  How it works:
  1. Compress O₂ to ~80 bar, air-cool to 288 K
  2. Pre-cool in counterflow HEX against returning cold vapor
  3. Split: part → turboexpander (cools to ~140 K, makes work)
            part → J-T valve (cools further, partial liquefaction)
  4. Flash drum: liquid O₂ collected, cold vapor recycles
  5. Cold vapor + turboexpander outlet → counterflow HEX cold side
  6. Warmed vapor recycles to compressor

  New units  Turboexpander (gas turbine running on process gas —
             same physics, different purpose: cold, not power)
  Learns     Cryogenics · Joule-Thomson effect · Isentropic vs
             isenthalpic expansion · Counterflow HEX · Liquefaction
  ★ Hardest thermodynamics so far — the player must balance
    split ratio, expansion pressures, and HEX approach temperatures.
  ★ Key insight: you cannot buy cold on an alien planet.
    You manufacture it from work + clever expansion.


────────────────────────────────────────────────────────────────────
 MISSION 10                                       ☐ EXPEDITION
────────────────────────────────────────────────────────────────────

  Goal       Produce and store rover propellant:
             100 mol liquid CH₄  +  200 mol liquid O₂
             (stoichiometric for CH₄ + 2 O₂ combustion)
  Chemistry  All previous — no new reactions
  Principle  Everything connects. Vent gas → water → electrolysis
             → H₂ + O₂. CO₂ + H₂ → Sabatier → CH₄ + H₂O (recycle).
             Liquefy CH₄ (T_boil = 112 K) and O₂ (T_boil = 90 K)
             using M9 cryogenic techniques. Power from combined
             cycle (M8). Heat integration across all systems.

  CH₄ data   T_crit = 190.6 K  |  P_crit = 46.0 bar
             T_boil = 111.7 K (at 1 atm)

  The player must design TWO parallel cryogenic trains
  (CH₄ and O₂ have different critical points) or cascade them:

  ═══ PRODUCTION (M1–M4 integrated) ═══

  ┌──────┐    ┌───────┐    ┌───────┐    ┌─────────┐
  │ VENT ├───→│COOLER ├───→│ FLASH ├───→│ELECTRO- │──→ O₂ buffer
  │ 500K │    └───────┘    │ DRUM  │    │ LYZER   │──→ H₂
  └──────┘                 │H₂O ↓ ├───→│  ⚡     │    │
                           │gas ↑  │    └─────────┘    │
                           └───┬───┘                   │
                               │ CO₂                   │
                               ↓                       │
                           ┌─────────┐                 │
                      H₂──→│SABATIER ├──→ CH₄ buffer   │
                           │ REACTOR │                 │
                           └────┬────┘                 │
                                │ H₂O recycle          │
                                └──→ electrolyzer      │
                                                       │
  ═══ LIQUEFACTION (M9 techniques × 2) ═══             │
                                                       │
  CH₄ buffer ──→ ┌──────────────────────┐              │
                 │ CH₄ CRYO TRAIN       │              │
                 │ compress → cool →    │              │
                 │ expand → flash       ├──→ LIQ CH₄ TANK
                 │ (T_crit=191K,easier) │    (100 mol)
                 └──────────────────────┘
                                                       │
  O₂ buffer ───→ ┌──────────────────────┐              │
                 │ O₂ CRYO TRAIN        │←─────────────┘
                 │ compress → cool →    │
                 │ expand → flash       ├──→ LIQ O₂ TANK
                 │ (T_crit=155K,harder) │    (200 mol)
                 └──────────────────────┘

  ═══ POWER + HEAT INTEGRATION ═══

  Combined cycle (M8) powers everything.
  Sabatier exotherm (−165 kJ/mol) → preheat Haber feed or
     boiler feed water.
  Turboexpander shaft work offsets compression cost.
  Waste heat from compressors → habitat heating (M6).

  New units  None — pure integration of everything learned
  Learns     Process synthesis · Mass & energy balance at scale ·
             Heat integration across subsystems · Debottlenecking
  ★ Capstone mission. Every unit the player has ever placed
    appears in one flowsheet. Every trick matters.
  ★ This is NASA's actual Mars ISRU plan: Sabatier + electrolysis
    + cryogenic propellant storage. The player just built it.


════════════════════════════════════════════════════════════════════
 PROGRESSION (Missions 6–10)
════════════════════════════════════════════════════════════════════

  SKILL                    M6        M7        M8        M9       M10
  ──────────────────────  ───────  ────────  ────────  ───────  ────────
  Reversed cycles           ●
  Reactor recycle design              ●
  Combined power cycles                         ●
  Cryogenics                                              ●
  Full process synthesis                                            ●

  COMPLEXITY               medium    hard      hard      hard    expert
  NEW REACTIONS            zero      Haber     zero      zero     zero
  NEW COMPOUNDS            zero       NH₃      zero      zero     zero
  CLOSED LOOPS             yes       yes       yes       yes      yes


  UNIT INTRODUCTION (cumulative):

  M1–M5 │ Air Cooler · Flash Drum · Tank · Atm Source
        │ Electrochemical Reactor · Grid Supply
        │ Equilibrium Reactor · HEX · Mixer
        │ Compressor · Gas Turbine · Combustion Reactor · Valve
  ──────┼──────────────────────────────────────────────────
  M6    │ + (none — closed-loop cycle from existing units)
  M7    │ + Splitter
  M8    │ + Pump
  M9    │ + Turboexpander (gas turbine repurposed for cold)
  M10   │ + (none — capstone integration)

  By Mission 10, the player has used 15 unit types.
  Two new reactions total (Haber in M7, combustion reused).
  All physics real. All balances exact. No magic.


  RESOURCE CHAIN (full colony):

  Vent gas ─→ ① WATER ─→ ② OXYGEN ──→ ③ FUEL ──→ ④ POWER ─→ ⑧ MORE POWER
                 │              │            │          │
                 │              │ recycle H₂O←          │
                 │              └────────────┘          │
                 │              │                       │
                 │              │─→ ⑦ NH₃ (+ N₂ from ⑤)│
                 │              │                       │
                 └──────────────┼──────────→ ⑤ CLEAN AIR
                                │
  Atmosphere ──→ ⑥ WARMTH (CO₂ heat pump, powered by ④/⑧)
                                │
  O₂ from ② ──→ ⑨ LIQUID O₂ RESERVES
  CH₄ from ③ ─→ ⑨ LIQUID CH₄ RESERVES
                                │
                       ⑩ EXPEDITION
                     ┌─────────┴──────────┐
                     │  LIQ CH₄ + LIQ O₂  │
                     │  = ROVER PROPELLANT │
                     │  Explore Planet X   │
                     └─────────────────────┘


  NARRATIVE ARC:

  M1–M5     SURVIVE       Don't die. Secure basics.
  M6–M7     SUSTAIN       Comfort. Food. Long-term viability.
  M8–M9     STRENGTHEN    Efficiency. Reserves. Resilience.
  M10       EXPLORE       Leave the base. The planet is yours.


════════════════════════════════════════════════════════════════════
 DESIGN NOTES
════════════════════════════════════════════════════════════════════

  Why these missions:

  M6  CO₂ heat pump is the only honest way to heat without
      combustion waste. Planet T just below CO₂ critical T is
      a deliberate design gift — it makes transcritical CO₂
      cycles natural. Real-world technology (supermarket
      refrigeration, European heat pumps). No magic refrigerant.

  M7  Haber process is THE iconic chemical engineering achievement.
      Teaches recycle convergence, inert accumulation, purge —
      concepts no prior mission covers. NH₃ is a real gas in any
      compound bank. The Ar-in-feed detail forces the purge.

  M8  Combined cycle is how modern power plants work. The concept
      that exhaust heat is not waste but fuel for a second cycle
      is one of the most important ideas in thermodynamics.
      Pump is trivially simple but conceptually important:
      compressing a liquid costs almost nothing.

  M9  Cryogenics closes the biggest gap in the curriculum.
      The turboexpander is just a gas turbine used backwards
      in purpose (cold, not power). Counterflow HEX is the
      workhorse of cryogenic plants. The split-stream Linde
      cycle is real industrial practice (air separation plants).
      No exotic refrigerant — you make cold from work.

  M10 Integration capstone. No new physics. The challenge is
      connecting 10 missions into one coherent flowsheet where
      mass balances close, energy balances close, and nothing
      is wasted. This IS process engineering.

  All five missions avoid:
  ✗ Solids, salts, or solid catalysts as streams
  ✗ Dedicated refrigerants (R-134a, R-410A, etc.)
  ✗ Magic coolers or unexplained cold sources
  ✗ Units without clear thermodynamic basis
  ✗ Compounds outside a basic gas-phase bank
  ✓ Every cold stream has a physical origin
  ✓ Every unit already exists in process simulators
  ✓ All working fluids come from the planet
