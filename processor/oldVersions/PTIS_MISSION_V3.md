# PTIS_MISSION_V3

## Purpose

This version reflects the latest validated progression logic:

- missions must follow immediate survival instinct
- the player should naturally think: **"yes, of course I would do that now"**
- early game prioritizes **survival and stabilization**
- mid game uses energy to **extend autonomy and regain agency**
- late game introduces **optimization and loop closure**
- elegant engineering is welcome, but only when it is **motivated by lived survival needs**

---

## Core progression logic

### Act 1 — Immediate survival

#### M1 — Condense Water
**Fantasy:** There is water in the wreck streams, but the base tank is broken and the liquid is too hot / unsuitable.  
**Player goal:** Recover usable water fast.  
**Engineering lesson:** Cooling, condensation, first buffer logic.  
**Why now:** Immediate thirst / hygiene / survival pressure.

#### M2 — Electrolysis
**Fantasy:** Water alone is not enough; oxygen autonomy is failing.  
**Player goal:** Divert part of the water production to oxygen generation.  
**Engineering lesson:** Electrolysis, utility consumption, gas production, first real coupling between systems.  
**Why now:** Oxygen is a direct survival need.

#### M3 — First Power Recovery
**Fantasy:** The electrolyzer is draining the battery and brute survival fixes are creating an energy crisis.  
**Player goal:** Recover energy from what is already available.  
**Possible routes:** simple turbine on pressure drop, combustion of easy fuel streams, other crude salvage-level recovery.  
**Engineering lesson:** Pressure/enthalpy recovery, first energy tradeoffs, ugly but effective survival engineering.  
**Why now:** Electrolysis creates immediate battery stress.

#### M4 — CO2 Scrubbing
**Fantasy:** Air is no longer sustainable even with oxygen production; CO2 becomes the next hard wall.  
**Player goal:** Stabilize breathable atmosphere with a brute-force but robust solution.  
**Engineering lesson:** Gas treatment, atmosphere quality, direct survival metrics.  
**Why now:** Once water / oxygen / battery are barely stabilized, CO2 is the next obvious threat.

---

## Phase 2 — Stabilization and autonomy

#### M5 — Habitat Stabilization
**Fantasy:** The base is technically alive, but hot, wasteful and unpleasant.  
**Player goal:** Recover / redirect heat, manage hot incoming streams, improve room conditions, possibly produce useful hot water for hygiene.  
**Engineering lesson:** Thermal integration, waste heat valorization, room liveability as a system.  
**Why now:** Survivors do not just need to avoid death; they need a base that is sustainable to inhabit.

#### M6 — Food Preservation
**Fantasy:** Existing food reserves are degrading; spoilage is an active leak on survival time.  
**Player goal:** Build a cold room / refrigeration loop to slow or stop food loss.  
**Engineering lesson:** Refrigeration, preservation, inventory protection.  
**Why now:** This solves an actively worsening problem with a visible daily benefit.

#### M7 — Restore Agency
**Fantasy:** Surviving inside the base is not enough; the crew needs reach, repair capability or access to outside resources.  
**Preferred direction:** Fuel production / conditioning for a salvaged vehicle to allow expeditions.  
**Alternative direction:** Restore fabrication / workshop capability.  
**Engineering lesson:** Energy converted into mobility or self-repair capacity.  
**Why now:** This unlocks a genuinely new capability instead of just improving a number.

#### M8 — Renewable Power
**Fantasy:** The base still depends too much on unstable or waste-derived power.  
**Player goal:** Install longer-term generation such as solar / wind if available in the setting.  
**Engineering lesson:** Shift from emergency recovery to durable infrastructure.  
**Why now:** After short-term stabilization, survivors naturally seek less fragile energy sources.

---

## Phase 3 — Sustainable survival

#### M9 — Greenhouse
**Fantasy:** Stored food and preservation are not enough; the base needs actual food production.  
**Player goal:** Make controlled agriculture viable.  
**Engineering lesson:** Integrated utilities, environmental control, long-horizon resource planning.  
**Why now:** Food production only makes sense once water, air, heat and power are under reasonable control.

#### M10 — Fertilizer / Nutrient Chain
**Fantasy:** The greenhouse works, but not efficiently or not at scale.  
**Player goal:** Produce the required nutrient inputs, including nitrogen-derived products if relevant.  
**Engineering lesson:** Resource conversion serving a clear biological objective.  
**Why now:** Fertilizer is justified once food production exists as a concrete need.

#### M11 — Advanced Loop Closure
**Fantasy:** The base survives, but wastes too much matter and energy.  
**Player goal:** Introduce deeper recycle chemistry such as Sabatier, advanced fuel integration, or other closure systems.  
**Engineering lesson:** Elegant process integration, closed-loop logic, efficiency as civilization rather than first aid.  
**Why now:** These systems are compelling only once the player already has something worth optimizing.

---

## Explicit design decisions validated in this version

- **Sabatier is removed from early progression**
  - It is realistic, but not the most natural immediate response to the early survival situation.
  - It becomes stronger later as an optimization / closure mission.

- **Power recovery happens before CO2 scrubbing**
  - Because electrolysis immediately stresses the battery.
  - This gives a clearer causal chain.

- **Not every energy improvement deserves its own top-level mission**
  - Combined cycles, vent gas combustion optimization, and similar ideas should usually appear as:
    - optional solutions
    - upgrades
    - branches inside broader power missions
  - not as separate mandatory chapters unless they create a clearly different player experience.

- **Cryogenic / refrigeration content is justified only when tied to an urgent lived problem**
  - especially food spoilage, preservation, or a later emergency
  - not just because cryogenic engineering is interesting

- **Vehicle / expedition unlock is valuable because it changes the structure of play**
  - it makes the game less static
  - it introduces a new survival power, not just a better efficiency number

---

## Mission selection rule

A mission should usually satisfy at least two of the following:

- solves an actively worsening survival problem
- produces a visible daily benefit
- feels narratively inevitable
- unlocks a clearly new capability

If it does not, it is probably:
- too early
- too optional
- or better treated as an upgrade rather than a full mission

---

## One-line progression summary

**Water -> Oxygen -> Power stress -> CO2 control -> Habitat stabilization -> Food preservation -> Agency / expedition -> Renewable power -> Greenhouse -> Fertilizer -> Advanced loop closure**
