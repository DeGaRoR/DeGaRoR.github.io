
# PTIS – Project Roadmap (Working Document)

Version: 0.1
Purpose: Align technical development, mission design, UI work, and communication strategy.

---

# 1. Core Product Identity

PTIS is a **thermodynamic survival engineering game**.

Core fantasy:

Engineer livable environments in hostile worlds using real thermodynamics.

Key pillars:
- gas physics
- pressure networks
- power systems
- life support
- environmental engineering

Primary narrative backbone:
- Planet X campaign (10 missions)

---

# 2. Development Principles

## 2.1 Discipline on Scope

All development must support one of:
1. Planet X campaign
2. Engine stability
3. Mission framework

Anything else is secondary.

---

## 2.2 Data-driven Content

Missions must be defined as configuration files rather than hard‑coded logic.

Conceptually:

Mission = file  
Campaign = list of missions

---

## 2.3 Engine vs Game Layers

### Engine Layer
Simulation systems:
- thermodynamics
- power dispatch
- pressure networks
- equipment models
- particles and visualization

### Game Layer
Built on top of the engine:
- missions
- UI shell
- campaign progression
- tutorials
- narrative

---

# 3. Major Technical Milestones

## Phase 0 — Specification Reconciliation

Goal: remove inconsistencies between specs.

Tasks:
- make Mission Design V2 canonical
- archive conflicting sections in other docs
- update S10 mission spec to current engine version
- align terminology with profile/template system

Deliverable:
- consistent documentation baseline

---

## Phase 1 — Human / Room Validation Harness

Goal: validate survivability model.

This is not gameplay.

Internal sandbox scenario: **Ineluctable Fate**

Environment:
- sealed room
- one human
- defined volume
- no oxygen supply

Measurements:
- O2 depletion
- CO2 increase
- humidity increase
- temperature increase
- time to death

Expected outputs:
- survival time within plausible range
- realistic metabolic rates
- correct tank dynamics

Variants:
- multiple humans
- leaks
- CO2 scrubber
- oxygen injection

Tools required:
- time series graph visualizer

---

# 4. Time Series Visualization Tool

Purpose:
Validate dynamic models and debug simulations.

Features:
- graph panel
- drag variables from inspector
- overlay multiple curves
- export data
- pause/step integration

Example tracked variables:
- O2 partial pressure
- CO2 concentration
- temperature
- humidity
- power demand
- tank levels

Graph types:
- preconfigured graphs
- user graphs

Possible UI layout:

Simulation view | Graph panel

---

## Phase 2 — Composite Units

Goal: hide internal complexity.

Composite units wrap multiple internal models.

Examples:

Habitat module
- room volume
- thermal mass
- atmosphere tank

Human occupant
- metabolic gas production
- heat output
- humidity

Greenhouse
- CO2 sink
- O2 source
- humidity driver

Benefits:
- cleaner UI
- readable gameplay
- engineering depth preserved internally

---

## Phase 3 — Mission System Kernel

Goal: support basic missions.

Minimum mission definition fields:

- id
- title
- description
- environment
- palette restrictions
- starting state
- objectives
- fail conditions

Mission lifecycle:

1. briefing
2. build
3. run
4. evaluation
5. debrief

Mission data stored in files such as:

missions/m01.json  
missions/m02.json

---

## Phase 4 — UI Shell

Goal: make the game feel like a real product.

Required UI elements:

Home screen
- title
- logo
- animated background
- menu

Menu entries
- Missions
- Sandbox
- Options
- Exit

Mission UI
- briefing screen
- mission objectives panel
- pause / restart
- save / restore
- return to menu

Visual style:
- ragtag / industrial aesthetic

---

# SVG Icon Strategy

Icons generated procedurally using parameters instead of image files.

Example concept:

icon parameters:
- type: reactor
- color: rust
- detail: pipes

Advantages:
- no external assets
- safer performance
- consistent visual style

Custom icons allowed for:
- mission specific profiles
- composite units

---

## Phase 5 — Planet X Vertical Slice

Target: Missions 1–5.

Mission themes:

1. water condensation
2. oxygen production
3. fuel and power
4. atmospheric stabilization
5. sustained survival

Active systems:
- thermodynamics
- power grid
- human room model
- composite units
- mission framework

Deliverable:
first playable alpha.

---

## Phase 6 — External Alpha Testing

Goal:
validate usability and engagement.

Tester types:

Systems gamers
- Factorio players
- Oxygen Not Included players
- Kerbal players

Engineers
- chemical engineers
- process engineers

Non technical players
- onboarding clarity testing

Target tester pool:
20–30 people.

---

## Phase 7 — Full Planet X Campaign

Add missions:

6 cold chain  
7 energy scaling  
8 fertilizer production  
9 cryogenic emergency  
10 biosphere closure

Deliverable:
complete narrative arc.

---

## Phase 8 — Secondary Mission Packs

Added after core campaign.

Priority ranking:

1 Real Space Engineering
- ISS life support
- Mars ISRU plant
- Mars base expansion

2 Harsh Environment Earth
- Arctic station
- volcanic station
- off grid settlement

3 Environmental Engineering
- offshore hydrogen
- methane capture
- carbon capture

4 Solar System Infrastructure
- Titan depot
- Venus cloud city
- orbital fuel depot

---

# 9. Communication Strategy

Communication starts early but at low intensity.

Goal:
build audience gradually.

Devlog cadence:
every 2–3 weeks.

Content examples:
- particle visualization
- life support experiments
- reactor builds
- oxygen depletion tests

Short clips preferred.

---

## Platforms

Reddit
- r/Factorio
- r/Oxygennotincluded
- r/KerbalSpaceProgram
- r/basebuildinggames

Professional
- LinkedIn

Game dev
- TIGSource
- simulation communities

---

# 10. Early Community Strategy

Stage 1:
5–10 trusted testers

Stage 2:
20–30 alpha testers

Stage 3:
100+ players after campaign slice

Avoid large public launches early.

---

# 11. Key Success Criterion

If Planet X Missions 1–5 are:

- understandable
- tense
- satisfying

then the game works.

Everything else becomes expansion.

---

# 12. Current Highest Risk Areas

1 onboarding complexity
2 human room model validation
3 mission framework implementation
4 UI clarity

---

# 13. Immediate Next Steps

1 specification reconciliation
2 build time series graph tool
3 implement human room validation harness
4 composite units framework
5 mission kernel
6 UI shell
7 Planet X M1–M5 slice

---
