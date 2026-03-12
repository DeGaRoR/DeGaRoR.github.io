# PTIS Playtest Session 3 — Structured Report

## Save-count summary

- **Save-related mentions overall in the notes:** **11**
  - includes autosave/manual-save complaints and the crash/autosave expectation
- **Explicit intentional diagnostic save actions in the notes:** **9**
  - including the early **“first copy of the file”** before the crash
- **Explicit intentional diagnostic save actions that match the 8 attached JSON files:** **8**

### Save-related mentions found in the notes

- l.56 — expected autosave after browser crash / lost session
- l.100 — autosave spam complaint
- l.101 — manual save not visible / buried
- l.195 — “Save the file for inspection”
- l.208 — “I save the model again”
- l.213 — “Save file again for analysis”
- l.223 — “Saving file again”
- l.229 — “Saving file for analysis. 1:19AM”
- l.244 — “Saving file for analysis 1:31AM”
- l.247 — “Saving file for analysis, 1:36 AM”
- l.252 — “Saving the file a last time 1:40AM”

### Important mismatch

- There is also an earlier note at **l.54**: **“I get the first copy of the file”**.
- That gives **9 explicit diagnostic saves** in the narrative.
- Only **8 JSON save files** were attached.
- Best-fit interpretation: the **early “first copy” was not part of the attached set** (possibly lost with the crash, or not among the exported files).

---

## Suggested implementation priorities

### P0 — Broke the playtest / caused explicit frustration

1. **Crash / reload loses the current model instead of recovering the player state**  
   
   - l.56  
   - This is the single biggest session-breaker.

2. **Electrical distribution bug(s): some units wrongly report no power despite ample available power**
   
   - l.208–213, l.221–224, l.240, l.244
   - Air coolers fail with direct generators.
   - Pump never gets power.
   - Compressor oddly does get power.
   - Strong sign of inconsistent electrical dispatch / consumer handling.

3. **Spurious catastrophic tank temperature failures / temperature propagation diagnosis unclear**
   
   - l.73–78, l.160–164, l.186–189
   - Repeated rage/frustration trigger.
   - Needs either physics fix, state propagation fix, or much better diagnosis.

4. **Play button latency / delayed first simulation step**
   
   - l.24, l.45, l.67
   - Repeatedly described as disturbing / big issue.
   - Makes the whole game feel unresponsive and obscures cause/effect.

5. **Mass / energy balance reports appear wrong or misleading**
   
   - l.31–40, l.116–137
   - Repeatedly breaks trust in the simulation.

6. **Failure / unmet-condition diagnostics are too silent**
   
   - l.28, l.44, l.86, l.153, l.166, l.188–189
   - Missing or invisible toast, missing visual warnings, missing macro diagnosis.
   - This amplifies every real bug.

7. **Pressurized-tank flow / pressure behavior appears broken or inconsistent**
   
   - l.228–252
   - Tanks initialized at 5 bar unexpectedly.
   - Vacuum failure despite release setting.
   - Open-to-pressurized transfer seems impossible even with pump/compressor.
   - Session ends in near rage quit here.

### P1 — Major friction / design debt exposed by the session

1. **Inspector redesign for live editing and diagnosis clarity**
   - l.141, l.155–156, l.163–164
2. **Tier-1 simplification of air cooler / generator / electrolyzer parameters**
   - l.62–66, l.147–149, l.176, l.181
3. **Autosave / manual save UX and timeline management**
   - l.100–101
4. **Power dispatcher UX**
   - l.110, l.113–114, l.163, l.203
5. **Overflow / dump / drain guidance**
   - l.83, l.145, l.172
6. **Onboarding / mission guidance**
   - l.52, l.103

### P2 — Secondary but worthwhile

1. **Naming / terminology cleanup**
2. **Port iconography / port layout wording**
3. **Animation polish**
4. **Visual polish of stickers / gauges / flanges / plugs**
5. **Reward / mission feedback layer**

---

## All remarks grouped by theme and severity

## Physics / simulation correctness

### BUG

- **Persistent mass imbalance warning appears wrong** — l.31–40, l.54, l.87, l.116–125  
  Repeated imbalance in simple setups; likely incorrect report or accounting.
- **Energy balance shows large accumulation in a setup with no battery, undermining trust** — l.126–137
- **Tank temperature destruction appears inconsistent with inlet conditions** — l.73–78  
  Example: tank reports 284.1°C despite 33°C feed and upstream feed at 176.
- **Tank destroyed by temperature again even though downstream conditions should be isolated** — l.160–164
- **Air cooler min setpoint / ambient handling is wrong at UX level and probably logic level** — l.69–70  
  Slider allows impossible target then blames the user.
- **Electrolyzer outlet very hot; catastrophic behavior surprising / insufficiently explained** — l.186–189  
  May be physically valid, but current behavior reads as a bug because diagnosis is too weak.
- **Broken / isolated equipment still throws catastrophic failure on later runs** — l.191–195
- **Pressurized tanks seem initialized at 5 bar unexpectedly** — l.228–229
- **Pressurized tanks hit vacuum despite release set to 0.8 bar** — l.231–233
- **Open-to-pressurized transfer appears impossible despite pumps/compressors** — l.238–252
- **Flow without visible delta-P / pressure does not propagate through the network** — l.219
- **Possible wrong species/mass-flow reporting on electrolyzer clean outlets** — l.246  
  O2 reported 0.23 kg/h vs H2 0.03 kg/h; user suspects wrong quantity reported.
- **Solver failure indicator noticed late (“failing after 3 iteration”)** — l.253  
  Important hidden solver-state information.

### ANNOYANCE

- **Open tank venting should not appear as a warning** — l.29
- **Electrolyzer non-complete conversion letting H2O escape with H2 is probably acceptable but odd** — l.174

### FEATURE REQUEST IMPORTANT

- **All deactivated streams should explain why they are deactivated** — l.189
- **Top-level diagnosis should relate linked events and provide macro recommendations** — l.164, l.166
- **Show tank liquid composition in inspector** — l.91
- **Show pressurized-tank composition in inspector** — l.237
- **Compressor should clearly state requested vs received power** — l.241

### FEATURE REQUEST SECONDARY

- **Represent atmospheric-condition units with an expansion valve to explain phase / pressure discontinuity** — l.93
- **Could make overflow catastrophe visually more like water going everywhere** — l.85

---

## Electrical / power system

### BUG

- **Unpowered air cooler fails too silently** — l.44  
  UX issue, but also a blocking gameplay failure.
- **Two new air coolers report insufficient power despite ample power available** — l.208–210
- **Same air-cooler power bug persists even when connected directly to 20 kW generators** — l.211–213
- **Pump also gets no power, even from direct generator** — l.221–224, l.243–244
- **Compressor gets power from hub while pumps/air coolers fail, inconsistent behavior** — l.240
- **Pump animation keeps running when pump does not work** — l.224

### ANNOYANCE

- **Generator default/max values are confusing (0.1 kW default, 9990 kW range)** — l.147–149
- **Power draw near zero displays as 0.00 kW; should switch to W or more precise display** — l.221

### FEATURE REQUEST IMPORTANT

- **Power dispatcher should show curtailment factor** — l.163
- **Power dispatcher inspector is cluttered by unconnected port info** — l.110
- **Unconnected-port pulsing logic is wrong for dispatcher; connected consumer ports also pulse** — l.113
- **Need better visual distinction for surplus port and matching sink iconography** — l.109, l.114
- **Need a horizontal power dispatcher for process-chain usage** — l.203
- **Any unexpected unit behavior should report clearly** — l.166

### FEATURE REQUEST SECONDARY

- **Male/female style power plugs / more familiar electrical inlet iconography** — l.96
- **Remove confusing extra 3-light square / unclear light logic on hub** — l.151

---

## Interaction / controls / responsiveness

### BUG

- **First drag of open tank does nothing** — l.22
- **Reconnecting existing connection by click-click does not work; only drag works** — l.23
- **Play does not trigger an immediate first simulation step** — l.24, l.67
- **Live parameter editing loses input focus on recalculation; layout shifts** — l.141

### ANNOYANCE

- **Changes are not visible immediately after pressing play; response feels delayed** — l.45
- **Particles do not scale speed with simulation speed, unlike other animations** — l.97

### FEATURE REQUEST IMPORTANT

- **Play should compute immediately, then animate the interval** — l.24, l.67
- **Auto-insert a unit in the middle of an existing connection when dragged from palette** — l.108
- **Bypass mode should render a pipe over the greyed-out unit** — l.225–226

### FEATURE REQUEST SECONDARY

- **Sliders are preferred; open tank should use sliders too for percentages** — l.65
- **Temperature setpoint slider should show one decimal digit only** — l.63

---

## Diagnostics / feedback / toasts / warnings

### BUG

- **No visible toast on tank fry event** — l.28
- **Catastrophe toast is too brief / hidden behind action bar / effectively invisible** — l.86
- **Destroyed equipment LED remains green** — l.27
- **Playtest repeatedly hits silent failure states** — l.44, l.69, l.153, l.166, l.188

### ANNOYANCE

- **Cause of frying is not visually obvious enough** — l.25
- **Bright yellow middle elements are unclear / misread** — l.26
- **System shutdown is visually too silent even when logic is working** — l.188

### FEATURE REQUEST IMPORTANT

- **Use large centered glowing/pulsing failure-cause icon on catastrophe** — l.25
- **Use similarly strong non-red icon for missing required connection / missing power** — l.44, l.153
- **Toasts should be persistent, manually dismissible, and suppressible** — l.86
- **Unexpected behavior should surface locally and in a top-level diagnosis layer** — l.166
- **Show unmet conditions brutally enough that the player cannot miss them** — l.44, l.153

### FEATURE REQUEST SECONDARY

- **Reward layer should acknowledge success milestones** — l.82, l.103

---

## UI / inspector / information architecture

### BUG

- **Pipe phase sometimes shows “-” instead of a determined phase** — l.18
- **Inspector focus loss during play-mode editing** — l.141

### ANNOYANCE

- **Heat category color too close to supply/drain color** — l.30
- **Auto-generated instance names do not match palette names** — l.50
- **“Clear scene” label is less clear than “New process”** — l.60
- **“Material dump” name is unclear** — l.61
- **“Auto” wording on air cooler is misleading because no auto mode exists** — l.64
- **“10 K approach” wording is opaque to non-technical players** — l.64
- **Port layout names “standard” / “mirrored” are not descriptive** — l.156

### FEATURE REQUEST IMPORTANT

- **Inspector should prioritize mass flow, then volume/molar** — l.8
- **Stream T and P should be shown as gauges** — l.17
- **Well should have a pressure gauge with high-pressure warning** — l.9
- **Power dispatcher port-setup option placement/wording needs improvement** — l.110
- **Ports being in consistent places across units works much better** — l.155
- **Ports likely belong at top of inspector** — l.155
- **Splitter inspector should mention which branch each split ratio refers to** — l.140

### FEATURE REQUEST SECONDARY

- **Stickers should be redesigned in a simpler/minimal style** — l.46
- **Maybe render stickers as tiny gauges, if manageable** — l.46
- **Use semantic autogenerated codenames instead of bland instance numbers** — l.51

---

## Animation / visuals / asset polish

### BUG

- **Selected pipe looks odd without cutout** — l.5
- **Particle clipping on lateral borders missing** — l.10
- **Particles do not line up with sink stubs** — l.12
- **Smoke / yellow particle effect on frying tank is visually wrong** — l.53, l.92
- **Electrolyzer animation is wrong; all particles follow same trajectory** — l.182
- **Gauge placement too high; dark gap visible in viewing glass** — l.81
- **Gauge wobble amplitude too large and misleading** — l.90

### ANNOYANCE

- **Ellipses for gas look cheap** — l.11
- **Well animation is not interesting / should come from reservoir** — l.13
- **Smoke could be slightly more visible** — l.92

### FEATURE REQUEST IMPORTANT

- **Wells should use same color language as sources** — l.6
- **Sink animation should look more coherent / more chimney-like** — l.7
- **Sink should maybe show outlet-condition particles, or at least explain difference** — l.14–15
- **Manual placement of decorative details / LEDs / plates / viewing pane** — l.16
- **Smoke should emit from multiple scattered points over tank top with better sizing / velocity** — l.53, l.92
- **Atmospheric sinks should show inlet valve/decompression cue** — l.15, l.93
- **All flanges should be grey; remove colored half-flanges** — l.94
- **Remove faint circles on material/electrical ports** — l.95
- **Electrolyzer should bubble from anode/cathode zones, grow/release toward outlets, with blue water-like bubbling** — l.182

### FEATURE REQUEST SECONDARY

- **Surplus port / sink icon could use lightning+skull style language** — l.114

---

## Unit design / parameter design / default values

### BUG

- **Default opening 0% on tank is confusing and creates false no-flow situations** — l.142

### ANNOYANCE

- **Tier-1 air cooler has too many knobs** — l.62
- **Generator should have realistic cap for the scenario** — l.66
- **Electrolyzer shows parameters that likely should be locked for tier-1 gameplay** — l.176, l.181

### FEATURE REQUEST IMPORTANT

- **Tier-1 air cooler should only expose power priority + target outlet temperature** — l.62
- **Generator slider should only limit below a sensible max; maybe remove unneeded control entirely** — l.66
- **Default tank liquid opening should be 50%** — l.142
- **Electrolyzer should probably be hard-coded to 100% conversion / fixed efficiency for the intended gameplay model** — l.176, l.181

### FEATURE REQUEST SECONDARY

- **Limit max conversion UI to 100% if design intent is complete electrolysis** — l.181

---

## Save / load / persistence

### BUG

- **Crash reload returns to demo instead of recovering the model** — l.56

### ANNOYANCE

- **Autosave spam creates ~20 saves with little change and a daunting list** — l.100
- **Manual save seems buried / inaccessible in timeline** — l.101

### FEATURE REQUEST IMPORTANT

- **Autosaves should self-manage better (limit count / prune / structure by time)** — l.100
- **Manual saves should remain visible and easy to retrieve in the timeline** — l.101

---

## Onboarding / game design / player guidance

### ANNOYANCE

- **Player may not naturally discover stickers and temperature view** — l.52
- **At this point player expects stronger reward / reinforcement** — l.82, l.103

### FEATURE REQUEST IMPORTANT

- **First mission should be highly guided and maybe only ask player to connect, play, and place a sticker** — l.52
- **Need mission framework soon** — l.103
- **Need guidance around overflow handling before next catastrophe** — l.83
- **Need a discharge / drain manifold or base-scene sinks for unused outlets** — l.145, l.172
- **Initially placed base-scene units should probably be locked in place** — l.145

### FEATURE REQUEST SECONDARY

- **Could use semantic names to aid attachment / readability** — l.51

---

## Save-file index (best-effort mapping)

## Attached files mapped to narrative

### 1) `process_grid_2026-03-10-23-49-56.json`

**Best match in notes:** l.195 — **“Save the file for inspection.”**  
**What it appears to diagnose:**

- mysterious repeated catastrophe from previously broken / isolated equipment
- “equipment destroyed bypassed” confusion
- state around broken side tanks before extra cooling tests
  **Why this match fits:**
- snapshot contains the electrolysis branch and two pressurized tanks (`tank-34`, `tank-35`) present but not yet connected
- no extra copied air coolers yet

### 2) `process_grid_2026-03-10-23-57-11.json`

**Best match in notes:** l.208 — **2 new air coolers report lacking power despite available power**  
**What it appears to diagnose:**

- copied air coolers not receiving power
- dispatcher / consumer handling suspicion
  **Why this match fits:**
- snapshot adds **two copied air coolers** (`air_cooler-43`, `air_cooler-44`)
- consistent with first cooling-power bug save

### 3) `process_grid_2026-03-11-00-04-40.json`

**Best match in notes:** l.213 — **same cooler-power issue even with direct 20 kW generators**  
**What it appears to diagnose:**

- cooler power bug persists outside the dispatcher
- direct-generator test case
  **Why this match fits:**
- snapshot adds **two 20 kW generators** (`grid_supply-53`, `grid_supply-54`) and fresh coolers (`air_cooler-57`, `air_cooler-58`)

### 4) `process_grid_2026-03-11-00-15-02.json`

**Best match in notes:** l.223 — **pump/electrical bug after switching to heat exchangers**  
**What it appears to diagnose:**

- workaround via heat exchangers works
- pump introduced but power behavior becomes suspect
- broader electrical inconsistency after expanding the process
  **Why this match fits:**
- snapshot contains **hex-65**, **hex-74**, **pump-81**, extra generator
- no pressurized-tank connection yet

### 5) `process_grid_2026-03-11-00-19-46.json`

**Best match in notes:** l.229 — **pressurized tanks shut the network down / unexpected 5 bar initialization**  
**What it appears to diagnose:**

- pressurized tanks connected after cooling
- vent lines hooked up
- network shutdown / back-pressure confusion
  **Why this match fits:**
- snapshot shows `tank-34` and `tank-35` now actually connected from the HEX hot outlets to sinks via vents
- attached timestamp aligns with the note’s **1:19AM** if filenames are offset by 1 hour

### 6) `process_grid_2026-03-11-00-31-41.json`

**Best match in notes:** l.244 — **pump still won’t get power; compressor inserted**  
**What it appears to diagnose:**

- pressurized tanks removed
- compressor added as new attempt to push into pressure
- pump/compressor behavior divergence
  **Why this match fits:**
- tanks are gone
- **compressor-100** appears
- timestamp aligns with **1:31AM** note

### 7) `process_grid_2026-03-11-00-36-54.json`

**Best match in notes:** l.247 — **possible wrong outlet mass-flow/species reporting**  
**What it appears to diagnose:**

- compressor outlet conditions adjusted
- user comparing clean O2 vs H2 outlet values
  **Why this match fits:**
- same general topology as previous save, but compressor parameters changed
- timestamp aligns with **1:36AM**

### 8) `process_grid_2026-03-11-00-40-23.json`

**Best match in notes:** l.252 — **last save after trying to fill a pressurized tank again**  
**What it appears to diagnose:**

- renewed attempt to feed a pressurized tank after compressor changes
- network stops with crosses / still cannot transfer into pressure
- near rage-quit endpoint
  **Why this match fits:**
- new connected **tank-110** appears on compressor/HEX branch
- timestamp aligns with **1:40AM**

---

## Unattached or ambiguous save mention

### Early note not represented by attached files

- **l.54 — “I get the first copy of the file”**
- Most likely:
  - either not included among the uploaded JSON files,
  - or lost / superseded around the crash-reload incident.

---

## Compressed action list

### Fix first

- crash recovery / autosave restore
- electrical dispatch / consumer-power bug
- spurious tank-temperature failures
- immediate-step-on-play
- mass/energy balance trust issues
- visible failure diagnostics / persistent toasts
- pressurized-tank / pressure propagation behavior

### Then

- inspector redesign for live editing + diagnosis
- save-list UX
- tier-1 parameter simplification
- dispatcher UX / curtailment visibility
- overflow / discharge guidance
- first-mission guidance

### Then polish

- naming / wording cleanup
- port language and iconography
- particles / smoke / gauge visuals
- reward feedback
