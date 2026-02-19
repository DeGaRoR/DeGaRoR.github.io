# processThis — Game Design Briefing
# For Claude Opus 4.6 context loading

    Load this document at the start of any design session
    involving processThis game narrative, missions, units,
    player experience, or implementation architecture.

    Source:  Planet X — Narrative & Mission Trunk v0.2
    Author:  Game designer (human collaborator)
    Form:    Restructured for fast AI consumption.
             Substance unchanged. Nothing invented.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 THE GAME IN ONE PARAGRAPH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A large ship breaks apart over Planet X. The player survives
inside a torn-off hangar section and bootstraps a colony from
salvage, improvised rigs, and unforgiving physics. The simulation
engine is real thermodynamics. The player learns process
engineering by building flowsheets that keep people alive —
then keep others alive — then turn disaster into an ecosystem.

Core fantasy: "I'm not a hero — I'm the kind of nerd who
figures it out."

Genre: colony survival meets process simulator.
Interface: 2D SVG flowsheet editor. No 3D. No Unity.
Tone arc: grim survival → cynical humor → industrial pride → wonder.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PLANET X — THE WORLD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deceptively Earth-like. Feels right, breathes wrong.

Atmosphere:  High CO₂ (~8%), not safely breathable.
Temperature: 288 K (15°C) ambient. Comfortable skin temperature.
Geology:     Active geothermal vents, 500 K gas output.
Vent gas:    CO₂ + H₂O + N₂ + traces of H₂, Ar, others.
Resources:   Abundant raw material — if you can process it.
Biology:     None. No native biosphere. You build the first one.
Water:       No surface liquid, but massive H₂O in vent gas.

The planet is generous with feedstock and hostile with atmosphere.
It gives you everything you need in forms you can't directly use.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 THE CRASH — STARTING CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What happened:  Ship broke apart in atmosphere.
What survived:  A torn-off hangar/workshop module.
Shelter:        Small pressurized compartment. Buys limited time.
The wreck:      Distant. Dangerous. Mid/late-game salvage target.

The wreck is NOT a system you restore. It's a debris field you
pick through over time, recovering increasingly heavy and
capable equipment as your logistics improve.

The player is a surviving passenger. Not the chief engineer.
Not special. Just resourceful. Motivation evolves:
survive → stabilize → expand → build an industrial ecosystem.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FOUR DESIGN LAWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These are non-negotiable. Every design decision must pass
through them.

1. PHYSICS AS PLAYGROUND

   The world doesn't hand out free energy. The player earns
   every capability through work, heat, and constraints.
   The game is convincing, not textbook-perfect. Failure is
   informative: warnings, limits, explanations. Rare hard stops.

2. SALVAGE DRIVES PROGRESSION

   No tech tree. No research menu. No unlock screen.
   New capability comes from what you can physically access,
   carry, and assemble.

   Early: small parts, light equipment.
   Mid:   skids and modules once EVA logistics exist.
   Late:  heavy modules once you have mobility and power margin.

   Progression is diegetic and narrative-driven.

3. DEMAND GROWS WITH STORY

   Survivors are found at scripted beats. Each rescue is a
   step change in O₂/CO₂/water/heat loads. This forces
   scaling: buffers, redundancy, parallel trains, efficiency.

   Demand increases are narrative events, not constant
   babysitting. The player scales up because people need
   them to, not because a timer expired.

4. THE PLAYER IS ALONE WITH PHYSICS

   No AI companion giving hints. No quest markers on the
   flowsheet. The Thermo Bible provides principles. The
   player must design the solution. That is the game.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CAMPAIGN — FOUR PHASES, TEN MISSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each mission has: a story need, a visible success condition,
and a lasting upgrade.


PHASE A — SURVIVE (M1–M3)
─────────────────────────
Fragile improvised supply chains. Everything scarce.
Every mistake costly. Tone: grim, tense, immediate.

  M1 — WATER
  Story need:   Heat and vent gas, but no water supply.
  Win fantasy:  Pulling life out of alien air.
  Process:      Cool vent gas → condense H₂O → store.
  Upgrade:      Water storage. First stable utility.
  Core concept: Phase change, condensation, flash drums.

  M2 — OXYGEN
  Story need:   Emergency O₂ running out.
  Process:      Electrolyze water → H₂ + O₂.
  Upgrade:      Oxygen production for survival.
  Core concept: Electrolysis, energy input, gas handling.

  M3 — FUEL (Sabatier)
  Story need:   Reliable fuel for field ops and generators.
  Process:      CO₂ + 4H₂ → CH₄ + 2H₂O.
  Upgrade:      Methane fuel chain + water knock-out.
  Core concept: Equilibrium reactors, product separation,
                water byproduct as recycle opportunity.


PHASE B — STABILIZE (M4–M6)
───────────────────────────
Stop living on emergency margins. Steady power, controlled
temperature, reliable storage. Tone: gaining competence.

  M4 — POWER (Brayton cycle)
  Story need:   Can't scale on emergency power.
  Process:      Compress → heat → expand → generate.
  Upgrade:      Steady electricity. Power = growth currency.
  Core concept: Gas turbines, work extraction, thermal efficiency.

  M5 — BREATHABLE AIR (CO₂ scrubbing)
  Story need:   Planet air is lethal. Need air for EVA/buffers.
  Process:      Compress outdoor air → cool → flash → separate.
  Upgrade:      Industrial air processor. Safer outside work.
  Core concept: Multi-stage compression, intercooling,
                high-pressure flash separation.

  M6 — COLD STORAGE (Refrigeration)
  Story need:   Food spoils, meds degrade, comfort unstable.
  Process:      CO₂ transcritical heat pump or refrigeration loop.
  Upgrade:      Controlled cold. COP becomes intuitive.
  Core concept: Reversed power cycles, heat pumps, COP.


PHASE C — EXPAND (M7–M9)
─────────────────────────
Industrialize. Heavier salvage. EVA and mobility become
normal. The base looks like a real plant. Tone: pride, ambition.

  M7 — CO₂ COLD LOGISTICS (Two-stage refrigeration)
  Story need:   Inerting, portable cold, safer handling.
  Process:      Two-stage refrigeration, CO₂ as resource.
  Upgrade:      Staged refrigeration + integration intuition.
  Core concept: Cascade cooling, CO₂ phase behavior.

  M8 — FERTILIZER (Haber process)
  Story need:   Stop living on rations. Hydroponics inputs.
  Process:      N₂ + 3H₂ → 2NH₃ at high P with recycle.
  Upgrade:      Nitrogen chemistry. Food production begins.
  Core concept: Reactor recycle, inert accumulation, purge
                strategy, equilibrium limitations.

  M9 — SCALING AND ROBUSTNESS
  Story need:   More survivors + machines demand reliability.
  Process:      Parallel trains, storage, redundancy.
  Upgrade:      Base becomes a true industrial plant.
  Core concept: Scale-up, reliability, heat integration,
                efficiency optimization.


PHASE D — SUSTAIN (M10)
───────────────────────
Stop thinking in linear chains. Start thinking in cycles.
Tone: wonder, ecological insight, philosophical closure.

  M10 — CLOSED BIOSPHERE
  Story need:   Industrial life support is expensive and fragile.
  Revelation:   Plants are process units. An ecosystem is a
                process network.
  Process:      Three composites — Room, Human, Greenhouse —
                close the CO₂/O₂/H₂O loops.
  Upgrade:      Colony becomes largely self-sustaining.
                External dependencies: electricity + nitrogen.
  Core concept: Closed cycles vs open chains. Biology as
                chemical engineering. Waste and product are
                contextual, not absolute.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 STORY DELIVERY — NO CUTSCENES, NO 3D
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The prototype communicates narrative through:

1. Static illustrations + short punchy text (comic-panel density,
   not novel paragraphs).

2. Terminal logs as flavor: black-box fragments, passenger notes,
   corporate disclaimers. Humor and darkness without mechanics.

3. Environmental meters: habitat CO₂, O₂, humidity, temperature,
   water reserve, power margin. These ARE the story — when CO₂
   rises, that's tension.

4. Milestone vignettes: first water collected, first O₂ stability,
   frost on a valve, first rover departure.

5. UI immersion: flowsheet grid backed by planet/hangar floor
   visual instead of abstract dark background.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 THE THERMO BIBLE (in-game learning tool)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A battered "Thermodynamics & Field Processing Manual" found
in starting debris. Diegetic. Feels like a real field manual
that survived the crash.

What it provides:  Operating envelopes, definitions, "what to watch."
What it never provides:  Step-by-step flowsheet solutions.

Structure (~10–20 pages):
  Principles (1–2 pp): conservation, phase behavior, COP.
  Field cards (1 pp each): reaction data, typical ranges,
    failure modes per mission chemistry.
  Troubleshooting index (2 pp).
  Late-game Closed Loop Appendix (ecosystems as processes).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CHARACTERS AND TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The player:  Survivor-engineer. No dialogue trees. No RPG stats.
Survivors:   Found at scripted beats. Each adds demand and stakes.
             They are load, not characters. The game is about the
             process, not the people. But their survival is the stakes.
Wreck lore:  Logs, disclaimers, last messages. Flavor only.

Aesthetic:   Salvaged industrial. Painted metal, scratched acrylic,
             patched insulation. Minimalist readable HUD.
Palette:     Cold dust + harsh light outside.
             Warm utility lighting inside.

Tone arc:
  M1–M3:  Grim survival. Desperate. Every drop counts.
  M4–M6:  Gaining competence. Cynical humor emerges.
  M7–M9:  Industrial pride. Dark beats (survivors in danger).
  M10:    Wonder. Ecological insight. Quiet triumph.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPEN NARRATIVE DECISIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These are not blockers. They can be decided in any future session.

  — Ship name and backstory (corporate? utopian? cynical?)
  — Exact survivor beats: how many rescues (3–4), after which
    missions, what demand step-change each causes
  — Why this ship was passing Planet X (accident? route
    miscalculation? opportunistic stop?)
  — End-of-prototype hook after M10 (new biome? signal from
    orbit? second crash site?)
  — Thermo Bible content: which field cards, what level of
    hint, how much math to expose


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 HARD CONSTRAINTS (from engine and implementation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These are not narrative decisions — they are fixed boundaries
that any game design proposal must respect.

ENGINE:
  — Real thermodynamics: ideal gas, Raoult, Antoine, energy balance.
  — Pressure resolves via graph (anchors, boosts, drops).
    Flow propagates topologically. NOT pressure-driven flow.
  — Units: compressor, turbine, HEX, reactor, flash drum, valve,
    tank, pump, splitter, mixer, source, sink.
  — Composite units can wrap standard units internally.

COMPOUNDS (complete list, gas-phase, expandable with NIST data):
  H₂O, CO₂, N₂, O₂, H₂, CH₄, Ar, NH₃, CH₂O

WHAT THE ENGINE CANNOT DO:
  — No solids, no salts, no ions, no aqueous phase.
  — No polymers, no complex organic molecules.
  — Every process must work within gas-phase + simple liquid
    flash behavior.

DIFFICULTY PHILOSOPHY:
  — A bad design doesn't crash — it underperforms, wastes energy,
    or produces wrong output.
  — The player learns by seeing WHY their process doesn't meet
    spec, not by being told NO.
  — Difficulty comes from physics, not from mechanics.
