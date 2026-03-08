# S-VOICE: Unit Content Guide

| Level | What | Voice |
|---|---|---|
| L1 | Tagline (2–5 words) | 12-year-old, familiar objects |
| L2 | Why pick this one | Teen-friendly, decision-focused |
| L3 | Real equipment | Factual, 1 sentence |
| L4 | Operating manual | Edge cases, what breaks |
| L5 | Modeling | Engineering method, no solver internals |

---

## Vessels

### Open Tank
| L | |
|---|---|
| 1 | A bucket with a tap |
| 2 | For storing liquid at room conditions. Cheap but fragile — melts above 80°C and can't hold pressure. |
| 3 | Atmospheric polyethylene/polypropylene (T1) or stainless steel (T2) storage vessel. |
| 4 | Overflow port must be connected — unconnected overflow at high level triggers MAJOR alarm. Hot inlet will melt T1 plastic. No pressure buildup possible — gas vents freely. Liquid draw from bottom via Cv valve; zero flow if tank is empty. |
| 5 | Level from molar inventory ÷ liquid density. Outlet flow via Cv equation on hydrostatic head. Overflow with hysteresis ±2%. |

### Closed Tank
| L | |
|---|---|
| 1 | Sealed container with a safety valve |
| 2 | Holds gas or liquid under a bit of pressure. Good up to about 5 bar — beyond that, pick a Pressure Tank. |
| 3 | Flanged steel storage vessel with relief valve and overflow drain. |
| 4 | Pressure builds from accumulated gas — vent and overflow ports are safety devices. Unconnected vent at overpressure → MAJOR alarm. Unconnected overflow at high level → MAJOR alarm. Exceeding P_HH or T_HH destroys the tank. Dual outlet: gas from top, liquid from bottom — each with independent opening %. |
| 5 | P from ideal gas law (nRT/V). Dual-phase inventory via flash. Cv-driven outlets with per-connection opening. Relief valve hysteresis at P_relief ±2%. |

### Pressure Tank
| L | |
|---|---|
| 1 | Tough tank for high pressure |
| 2 | Same as a Closed Tank but handles up to 50 bar. For when the regular one keeps popping its safety valve. |
| 3 | Thick-wall carbon steel (T1) or alloy steel (T2) pressure vessel. |
| 4 | Same behavior as Closed Tank — higher pressure/temperature envelope. Use when Closed Tank keeps blowing its relief valve. |
| 5 | Same model as Closed Tank. Only limit envelope differs. |

### Well
| L | |
|---|---|
| 1 | Underground gas or liquid tap |
| 2 | Your main raw material source. Careful with the valve — crack it open gently or you'll flood everything downstream. |
| 3 | Subsurface wellhead with choke valve. Geothermal vent, gas well, or pressurized aquifer. |
| 4 | Start with low opening (10–20%) — high opening at high reservoir pressure produces enormous flow that overwhelms downstream equipment. Flow depends on pressure difference between reservoir and connected network. Zero ΔP = zero flow. |
| 5 | Infinite inventory at fixed (P, T, composition). Outlet via Cv restriction: Q ∝ Cv × √ΔP. |

---

## Flow Control

### Pressure Regulator
| L | |
|---|---|
| 1 | Turns pressure down |
| 2 | Set the outlet pressure you want. Only goes down, never up — for that you need a compressor. |
| 3 | Spring-loaded pressure regulating valve. |
| 4 | If inlet P < setpoint → pass-through at inlet P with alarm. Isenthalpic — gas cools slightly (Joule-Thomson) on real-gas packages. |
| 5 | Isenthalpic throttle: H_out = H_in. P_out = min(setpoint, P_in). PH-flash for outlet T. |

### Mixer
| L | |
|---|---|
| 1 | Joins two pipes into one |
| 2 | Everything that flows in gets blended together. If one side has way more pressure, the weak side gets shut off automatically. |
| 3 | Pipe tee or static mixer with check valves. |
| 4 | Outlet takes the lower inlet pressure. If one inlet is at much lower pressure, its check valve closes — that side goes to zero flow. Both inlets blocked = full upstream blockage. |
| 5 | Adiabatic: H_out = ΣH_in. P_out = min(P_in) − ΔP_mix. Per-inlet check valve on pressure. |

### Splitter
| L | |
|---|---|
| 1 | Splits one pipe into two |
| 2 | Choose the percentage that goes to each side. If one path jams, flow reroutes to the other automatically. |
| 3 | Pipe tee with flow divider. |
| 4 | No phase separation — both outlets get identical composition. If one downstream path is blocked, flow auto-redirects to the other. Both blocked → upstream source killed. |
| 5 | Isothermal isobaric mole-fraction split. Blocked branch redistribution via solver post-pass. |

### Flow Brake
| L | |
|---|---|
| 1 | Pinches the flow |
| 2 | Creates a pressure drop to slow things down. Bigger drop = less flow getting through. |
| 3 | Fixed orifice plate or manual throttle valve. |
| 4 | If set ΔP exceeds available inlet pressure → pass-through at inlet P. Flow rate is a consequence of ΔP, not a setpoint. |
| 5 | Isenthalpic: P_out = P_in − ΔP. Same flash model as Pressure Regulator. |

### Fan
| L | |
|---|---|
| 1 | Pushes gas gently |
| 2 | For moving gas around at low pressure — vents, ducts, circulation. Needs electricity. Tiny pressure boost compared to a compressor. |
| 3 | Axial or centrifugal duct fan, electric motor driven. |
| 4 | Very small pressure boost — for ventilation, not compression. Curtailed if power supply is insufficient. |
| 5 | Isentropic compression with η_fan. ΔP typically 1–10 kPa. |

---

## Heat & Temperature

### Air Cooler
| L | |
|---|---|
| 1 | Fan that cools stuff down |
| 2 | Blows outside air over your hot pipe. Can't go colder than the weather — that's physics. Needs electricity for the fan. |
| 3 | Fin-fan air cooler, forced draft, electric fan. |
| 4 | Cannot cool below ambient temperature — second law enforced. If the fan is at max speed and can't reach target T, the outlet floats above setpoint (warning: "fan at max speed"). More fan power or more UA = more cooling capacity. |
| 5 | ε-NTU method. Air-side flow from fan power. Effectiveness determines actual duty. T_out ≥ T_ambient enforced. |

### Electric Heater
| L | |
|---|---|
| 1 | Heats stuff up |
| 2 | Like a kettle element in a pipe. Set the temperature you want, give it enough power, done. |
| 3 | Inline electric resistance heater. |
| 4 | If power supply is curtailed, outlet T falls below target — check power dispatcher allocation. No maximum T limit on the heater itself, but downstream equipment has limits. |
| 5 | Q = ṅCpΔT. Power demand = Q. Curtailable: T_out from available Q if supply < demand. |

### Heat Exchanger
| L | |
|---|---|
| 1 | Hot meets cold, they swap |
| 2 | Recovers heat between two streams — saves energy by reusing warmth instead of dumping it. No electricity needed, just a hot pipe and a cold pipe. |
| 3 | Shell-and-tube or plate heat exchanger, counter-current. |
| 4 | Hot and cold streams must not cross temperatures — if they do, the exchanger flags a temperature cross error. Smaller approach = more heat recovered but needs larger UA. If hot-out becomes colder than cold-in, the approach is violated. |
| 5 | Three modes: approach (iterative T-approach), UA (ε-NTU with fixed UA), duty (fixed Q). Counter-current LMTD. Post-flash cross detection. |

---

## Phase Separation

### Vapor-Liquid Separator
| L | |
|---|---|
| 1 | Gas goes up, liquid stays down |
| 2 | Catches the liquid that forms when you cool a gas. Place it after a cooler — that's how you harvest water from steam. |
| 3 | Vertical flash drum, gravity separation. |
| 4 | Only useful for two-phase (mixed gas+liquid) inlets. A pure-gas or pure-liquid inlet just passes through one outlet with nothing on the other. Place after a cooler that causes partial condensation. |
| 5 | Adiabatic flash at inlet (T, P). Phase split from VLE (Raoult or PR). β from Rachford-Rice. |

### Distillator
| L | |
|---|---|
| 1 | Moonshine still, but precise |
| 2 | When a simple separator isn't pure enough. Repeated boiling and condensing gives razor-sharp separation — but it's power-hungry and complex. |
| 3 | Tray or packed distillation column with reflux condenser and reboiler. |
| 4 | Sharper separation than a flash drum but needs power and more complex setup. Specify which component goes to the top (light key) and which stays at the bottom (heavy key). |
| 5 | Fenske-Underwood-Gilliland shortcut. N_min, R_min, actual stages. Relative volatilities from thermo package. |

### CO₂ Absorber
| L | |
|---|---|
| 1 | Scrubs CO₂ out of air |
| 2 | Keeps your crew breathing. Eats through cartridges — when they're gone, CO₂ passes straight through. Watch the gauge. |
| 3 | LiOH chemical absorption bed with consumable cartridges. |
| 4 | Cartridges deplete with use — when they run out, CO₂ passes straight through. Monitor remaining cartridge capacity. Non-CO₂ gases pass through unaffected. |
| 5 | Selective membrane model with consumable depletion. Extraction fraction applied to target species. Depletion ∝ absorbed moles. |

---

## Pressure & Pumping

### Pump
| L | |
|---|---|
| 1 | Pushes liquid harder |
| 2 | For liquids only — gas makes it choke. Set the pressure you need at the outlet. |
| 3 | Centrifugal pump (T1), electric motor driven. |
| 4 | Liquid only — gas at inlet causes cavitation (trip + alarm). The outlet gets hotter from compression work, but the rise is tiny for liquids. |
| 5 | Isentropic liquid compression: W = V̇ × ΔP / η. Cavitation check on inlet vapor fraction. |

### Compressor (Medium Pressure)
| L | |
|---|---|
| 1 | Squeezes gas, gets hot |
| 2 | General-purpose gas compression up to about 30 bar. Above that, you need the high-pressure version. Makes gas hot — plan for cooling downstream. |
| 3 | Reciprocating piston compressor, single-stage, electric motor. |
| 4 | Outlet gas is significantly hotter than inlet — compression heats gas. If power is curtailed, compression ratio drops. For pressures above 30 bar, use Compressor (High Pressure). |
| 5 | Isentropic compression: T_out = T_in × (P_out/P_in)^((γ−1)/γ) / η. Cp from thermo package. |

### Compressor (High Pressure)
| L | |
|---|---|
| 1 | Squeezes gas harder, stays sealed |
| 2 | For the heavy stuff — up to 50 bar, and sealed tight so nothing nasty leaks out. Same idea, tougher build. |
| 3 | Diaphragm compressor, hermetically sealed. Safe for toxic/flammable gases. |
| 4 | Same operation as Medium Pressure. Higher rating, higher power draw. Sealed design prevents gas leaks — required for hazardous service. |
| 5 | Same isentropic model. Higher P_HH limit only. |

---

## Power

### Generator
| L | |
|---|---|
| 1 | Reliable power, always on |
| 2 | Your baseline electricity. Doesn't care about weather or time of day. Set the kW and it delivers. |
| 3 | Diesel/gas generator, portable power unit, or grid connection. |
| 4 | Always produces full rated power regardless of demand — excess goes to Surplus Dump if connected. Not affected by day/night cycle (unlike Solar Panel). |
| 5 | Boundary: constant capacity = maxPower. No fuel consumption modeled. |

### Power Dispatcher
| L | |
|---|---|
| 1 | Fuse box with priorities |
| 2 | Collects power from all your sources and hands it out to equipment. Essential gear gets power first — the rest gets what's left. |
| 3 | Electrical bus with priority-based load shedding. |
| 4 | Each consumer has a priority (1=essential, 3=expendable). When supply < demand, low-priority equipment gets cut first. Accepts multiple generators AND multiple consumers on the same ports (fan-out). Surplus port must be connected or excess power triggers warning. |
| 5 | Five-step dispatch: capacity poll → demand collection → priority-sorted allocation → curtailment factor distribution → battery balancing. |

### Surplus Dump
| L | |
|---|---|
| 1 | Burns off extra power |
| 2 | Somewhere for leftover electricity to go. Without it, excess power has nowhere to go and the dispatcher complains. |
| 3 | Resistive load bank. |
| 4 | Always connect to the surplus port of a Power Dispatcher. Size it to handle your peak excess — undersized dump triggers overload warnings on the dispatcher. |
| 5 | Consumes min(available, rated). Always lowest priority. |

### Battery
| L | |
|---|---|
| 1 | Saves power for later |
| 2 | Charges when there's extra, drains when there's not enough. Key stats: how much it holds (kWh) and how fast it can charge or drain (kW). |
| 3 | Lithium-ion or lead-acid battery bank. Bidirectional. |
| 4 | At SOC = 0%, no more output. At SOC = 100%, no more charging. Charge/discharge rate limited by peak power — a large-capacity battery with low peak power charges/discharges slowly. |
| 5 | Inventory-based: charge_J advanced by TimeClock.step(). SOC = charge/capacity. Participates in dispatch step E (battery balancing). |

### Solar Panel
| L | |
|---|---|
| 1 | Free power, but only by day |
| 2 | Full blast at noon, nothing at night. On Planet X the sun is weaker than Earth. Pair with a battery if you need 24/7 power. |
| 3 | Photovoltaic panel array. |
| 4 | Output follows day-night cycle automatically. On Planet X: peak ~400 W/m² (Earth: ~1000). |
| 5 | Output = peakPower × solarFactor. Squared cosine bell from computeDiurnal(). |

### Wind Turbine
| L | |
|---|---|
| 1 | Power from wind, hit or miss |
| 2 | Output swings with wind speed — great on gusty days, useless on calm ones. Less predictable than solar. |
| 3 | Horizontal-axis wind turbine with generator. |
| 4 | Output varies with wind speed — gusty and unpredictable. Pair with Battery or Generator for stable supply. |
| 5 | Output = peakPower × windFactor. Wind from computeDiurnal() with hourly gust hash. |

### Gas Turbine
| L | |
|---|---|
| 1 | Jet engine on a generator |
| 2 | Feed it hot pressurized gas (from a Burner) and it spins out electricity. The exhaust is still hot — great for heat recovery. |
| 3 | Open-cycle gas turbine with electric generator. |
| 4 | Inlet must be hot AND pressurized — connect after a Burner. If outlet pressure ≥ inlet pressure, check valve closes (zero output). Exhaust is still hot — valuable for heat recovery via Heat Exchanger. |
| 5 | Isentropic expansion: T_out = T_in × (P_out/P_in)^((γ−1)/γ) with η. W = ṅ(H_in − H_out). |

### Fuel Cell
| L | |
|---|---|
| 1 | Hydrogen in, electricity out |
| 2 | Clean power as long as you feed it H₂ and O₂. Also makes water — handy for life support. Basically a battery that never dies. |
| 3 | PEM or solid-oxide fuel cell stack. |
| 4 | Needs H₂ and O₂ on separate electrode inlets — not a mixture. Produces water and electricity. The reverse of an Electrolyzer. Waste heat must be removed (cooling connection). |
| 5 | Electrochemical tick with Faradaic efficiency. Electrode separation routing. Waste heat = ΔH_rxn − W_elec. |

---

## Reactors

### Reactor (Insulated)
| L | |
|---|---|
| 1 | Mix, react, no temp control |
| 2 | The simple one. Whatever heat the reaction makes (or takes) stays inside. Temperature just goes where it goes. Good first step to see what a reaction does. |
| 3 | Adiabatic continuously-stirred tank reactor (CSTR). Insulated walls. |
| 4 | Temperature shifts with the reaction — exothermic reactions get hot, endothermic get cold. If ΔT is too large, switch to Reactor (Heated) or (Cooled). Volume controls conversion: bigger = more conversion = more heat. |
| 5 | Adiabatic energy balance: H_out = H_in + ΔH_rxn × ξ. CSTR kinetics: τ = V/V̇. Optional equilibrium mode (α parameter). |

### Reactor (Heated)
| L | |
|---|---|
| 1 | React at the temperature you want |
| 2 | Keeps the reaction at a set temperature using electricity. Needs power — if it runs short, the temperature drifts. |
| 3 | Jacketed CSTR with electric heating. |
| 4 | If power supply is curtailed, temperature drifts from setpoint — the reaction still runs but at wrong conditions. Endothermic reactions consume a lot of power. |
| 5 | Isothermal: Q = H_out(T_set) − H_in − ΔH_rxn × ξ. Curtailable: T_out from available Q. Fixed-Q mode available. |

### Reactor (Cooled)
| L | |
|---|---|
| 1 | React without overheating |
| 2 | For reactions that get dangerously hot. Built-in cooling keeps things under control. Not fully wired up yet — currently runs as insulated. |
| 3 | Catalytic reactor with integrated cooling coils. |
| 4 | Currently runs as insulated — cooling circuit not yet implemented. Future: coolant connections for active heat removal. |
| 5 | Stub: adiabatic model. Future: internal HEX coupling process-side with coolant-side. |

### Burner
| L | |
|---|---|
| 1 | Sets fuel on fire |
| 2 | Mix fuel and air, light it up, get screaming-hot gas out. Feed it to a Gas Turbine or use the heat somewhere useful. |
| 3 | Continuous-flow combustion chamber. |
| 4 | Feed a premixed fuel+air stream from a Mixer. Outlet is extremely hot — route to a Gas Turbine or Heat Exchanger, never directly to plastic equipment. Incomplete combustion produces CO (toxic). |
| 5 | Insulated reactor model with combustion kinetics. Adiabatic flame temperature from enthalpy balance. |

### Electrolyzer
| L | |
|---|---|
| 1 | Electricity rips molecules apart |
| 2 | The reverse of a fuel cell — pour in power and feedstock, get split products on separate outlets. Essential for making hydrogen. |
| 3 | PEM or alkaline electrolysis cell stack. |
| 4 | Products exit through separate electrode ports — not mixed. Higher power = higher production rate. Produces waste heat proportional to overpotential losses. |
| 5 | Electrochemical tick with Faradaic efficiency. Electrode separation routing. Shared infrastructure with Fuel Cell (reversed direction). |

---

## Boundaries

### Feed
| L | |
|---|---|
| 1 | Pipe from the outside world |
| 2 | Delivers whatever you set — species, temperature, pressure, flow rate. Never runs out. For air specifically, use Air Intake. |
| 3 | Idealized pipeline or supply depot. Fixed rate, infinite supply. |
| 4 | No pressure interaction, no depletion. If downstream path is blocked (check valve), the feed shuts off with alarm. |
| 5 | Boundary: fixed-rate emission. No Cv. Blocked by post-pass if downstream check valve fires. |

### Air Intake
| L | |
|---|---|
| 1 | Breathes in planet air |
| 2 | Automatically gives you whatever's in the atmosphere — composition, humidity, temperature all follow the planet and time of day. |
| 3 | Atmospheric inlet with pressure-sensitive valve. |
| 4 | Composition includes humidity — varies with planet and time of day. T and P follow the diurnal cycle. Flow depends on Cv and pressure difference to downstream network. |
| 5 | T, P, composition from getAtmosphere()/getWetAir() via ctx. Flow via Cv if modeled, fixed ṅ fallback. |

### Material Dump
| L | |
|---|---|
| 1 | Where stuff goes to leave |
| 2 | End of the line. Name it something useful ("Exhaust", "Water Out") so you can track what's going where. |
| 3 | Vent, drain, or product collection point. |
| 4 | Accepts anything. Zero backpressure. |
| 5 | Boundary sink. Flash at ambient for phase display. |

### Loop Driver
| L | |
|---|---|
| 1 | Keeps a loop circulating |
| 2 | Place it in a recycle loop so the solver knows where to start. Not a real device — just a helper for closed circuits. |
| 3 | Not a physical device — represents the circulating inventory in a recycle loop. |
| 4 | If the solver struggles to converge, adjust the species and flow rate closer to expected conditions. |
| 5 | Tear-stream bootstrap. Initial guess on first iteration, overwritten by converged upstream on subsequent iterations. |
