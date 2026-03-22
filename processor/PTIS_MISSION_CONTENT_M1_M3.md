# PTIS §MISSION-CONTENT — Arc A Intro + M1–M3
## Revised Narrative Content
### March 2026

---

> **Preplaced units (locked, cannot move or delete):**
> - Room (shelter) — all missions
> - Flare stack — from M2 onwards
> - Hydrovent (well) — from M3 onwards
>
> **Player places:**
> - M1: O₂ bottle, battery
> - M2: CO₂ scrubber
> - M3: Power dispatcher, air cooler, water barrel, optional L/V separator
>
> **Scene inheritance:** Always. Player's process carries over exactly.
> **Health checks:** All prior objectives remain enforced. Room always
> punishes failures (fainting, death) regardless of mission state.

---

## Arc A Intro

**6 beats. Full-screen cinematic. K narrates in past tense.**

### Beat A1 — Ship in orbit
**Image:** `intro_1.webp` (A1_shipOrbit)

> It started as the mission of a lifetime — the first crewed survey of Planet X, a promising Earth-like world with one deadly catch: 9% CO₂ in the atmosphere. It took years to get here. We were the first humans to lay eyes on it, and it was a purple marvel. A large part of the planet lived in permanent twilight, which made it beautiful and hypnotic.

### Beat A2 — K
**Image:** `intro_2.webp` (A2_K)

> I'm K. I fix things — you could call me a space mechanic, I guess. I had my reasons for signing up for a long interstellar voyage. None of them matter now. Things were real quiet out here, and I liked that.

### Beat A3 — Lena
**Image:** `intro_3.webp` (A3_Lena)

> Our mission was directed by Dr. Lena Vasquez. I didn't know her well. She was brilliant — that was obvious. She gave a briefing once, about atmospheric chemistry. Half the crew fell asleep. I stayed awake. Not because I understood it, but because she clearly loved every word of it.

### Beat A4 — The crash
**Image:** `intro_4.webp` (A4_shipCrash)

> Things did not go as planned. Not sure what caused the ship to plummet — the only thing I remember is that I was preparing for a space walk, and Dr. Vasquez came to check on me. Then everything started shaking. She rushed out, but all doors auto-locked, and we just got thrown around like cargo.

### Beat A5 — Injured
**Image:** `intro_5.webp` (A5_injured)

> Somehow, we made it. The room we were in got ejected from the main ship and landed a short distance away, mostly intact. The urgency was Lena's leg — it was bad. I did what I could with bandages and salvage, but she wasn't going to be walking anytime soon.

### Beat A6 — The plan
**Image:** `intro_6.webp` (A6_roleIntro)

> Dr. Vasquez — she asked me to call her Lena — was quite something. She didn't seem shaken by what we'd just been through. She told me she intended to live, no matter what, and that the situation was dire but not so different from what we'd originally planned. Really? When I pointed out that we were stuck in a tin can on a planet that would kill us the moment we stepped outside, she just said: "Don't worry. We have everything we need. We just need to know how to use it. And I know how. I'll guide you, you do the work. We'll both survive, you'll see."

---

## M1 — Breathe

### Story Intro
None. Arc intro flows directly into M1.

### Briefing (Lena, BUILD state)

> Alright, let's get our priorities straight. Do you know the survival rule of three? Three minutes without air, three days without water, three weeks without food. Roughly. Air comes first. As we speak, we're consuming oxygen and producing CO₂. We'll exhaust what's in this room in a matter of hours. I spotted an oxygen bottle nearby — find it and connect it to the room. There's also a good-sized battery left in here. Plug it in and give us some light. It's really dark.

### Guidance Steps

**Step 1 — Connect O₂**
Lena: "You can see the room where I'm sitting. On the left side, there's an oxygen bottle. Drag from the oxygen bottle's output connector to the 'O₂' port of the room."
*Highlight: connection guide from simple_gas_bottle.gas_out → shelter.o2_in*

On wrong connection: "That's not the right port. Oxygen won't flow there. Look for the O₂ port on the left side of the room."

On completion: "Good. But it won't do much until we have power. The fan inside needs electricity to circulate the air."

**Step 2 — Connect battery**
Lena: "See the battery above the room? Drag from its connector to the room's power port at the top."
*Highlight: connection guide from battery.elec → shelter.elec_in*

On completion: "Power! The lights came on and the ventilator is running. That already feels much better."

**Step 3 — Press play**
Lena: "Now let's test it. Press the play button at the bottom of the screen."
*Highlight: button 'btnPlay'*

On completion: "You can see the room's indicators — our oxygen is improving. We're safe on that side for a little while. See the particles moving from the bottle through the pipes? That's oxygen flowing."

**Step 4 — Inspect battery**
Lena: "One more thing. Click on the battery and look at its details. The charge should last a couple of days, but we'll need more power as we go. Better keep an eye on it."
*Highlight: unit 'battery'*
*Completion: unit_inspected*

On completion: "Well done. We're just getting started, but this is really encouraging."

### Stars

- ★ Both connections made. O₂ flowing to room for 1 simulated hour.
  *Rationale: confirms the player completed the tutorial and ran the sim.*
- ★★ Completed in under 3 minutes.
  *Rationale: rewards a fast learner or replay familiarity.*
- ★★★ O₂ stable above 19% for 2 consecutive hours.
  *Rationale: confirms sustainable supply, not just momentary flow.*

### Victory Lines

- ★ "It works. We're not dead yet."
- ★★ "Fast hands. I like that."
- ★★★ "Stable oxygen for two hours straight. Textbook."

### Story Outro
**Image:** `story_outro_1.webp` (M1_oxygen)

> The first step done. I wasn't sure where we were going, but Lena seemed very clear on the direction. That made me feel hopeful, as I plugged in that oxygen bottle and gave us fresh air to breathe. It was dark outside, but the lights were on inside.

### Triggers
None for M1.

### Objectives

```
Primary:
- connection: battery.elec → shelter.elec_in
- connection: simple_gas_bottle.gas_out → shelter.o2_in
- maintain_conditions: O2_pct_gte: 18, duration_s: 3600
```

---

## M2 — Clear the Air

### Story Intro
**Image:** `story_intro_1.webp` (M2B_flare)

> While Lena slept, I started putting pipes together from the wreckage and made a big chimney. Lena had said we were going to work with gases, and I figured it wasn't a good idea to have flammable mixtures building up around the shelter. We could dump everything we didn't need up there, and maybe even burn it. I think it's called a flare.

### Briefing (Lena, BUILD state)

> Excellent work on the tower. Now, air. We're halfway there — sort of. We have oxygen, but the poison building up is CO₂. That's the real problem inside this room, and even more so on the planet. We can't tolerate much more than 1% CO₂ in the air, and this planet's atmosphere has nearly 10%. We'd last minutes outside. Apart from that, Planet X has perfectly good air. I salvaged the ship's CO₂ removal system. It runs on LiOH cartridges, and they're not going to last long — maybe days if we're lucky. But it'll buy us time, and I have more ideas.

### Guidance Steps

**Step 1 — Connect exhaust to scrubber**
Lena: "There's a CO₂ absorber on the right side of the room. We need to make a loop: air exits the room, goes through the scrubber, and clean air comes back. First, drag from the room's air exhaust port to the scrubber's feed inlet."
*Highlight: connection guide from shelter.air_exhaust → co2_scrubber.mat_in*

On completion: "Good. Now the dirty air has somewhere to go."

**Step 2 — Connect clean air return**
Lena: "Now connect the 'permeate' port — that's the clean air that passed through — back to the room's air return port, at the bottom right."
*Highlight: connection guide from co2_scrubber.perm_out → shelter.air_return*

On completion: "Clean air loop closed. Almost there."

**Step 3 — Connect CO₂ to flare**
Lena: "Last one. The 'retentate' port — that's the CO₂ the scrubber caught. Send that to your tower."
*Highlight: connection guide from co2_scrubber.ret_out → flare_stack (nearest inlet)*

On completion: "Nice. Not sure why you went through the trouble of building that tower, but it's looking good, I'll give you that."

**Step 4 — Run simulation**
Lena: "Press play and watch. You'll see the CO₂ particles being separated from the room air. The change is gradual, but trust me — without this, we'd be passing out by tomorrow."
*Highlight: button 'btnPlay'*

On completion: "Breathing easier already. Keep an eye on that cartridge gauge though."

### Stars

- ★ CO₂ < 1% sustained for 2 hours. O₂ still flowing.
  *Rationale: basic confirmation the loop works and M1 wasn't broken.*
- ★★ CO₂ < 0.5% sustained for 2 hours.
  *Rationale: tighter scrubbing, shows the system is well-balanced.*
- ★★★ CO₂ < 0.1% sustained for 2 hours.
  *Rationale: exceptional air quality, requires the scrubber running efficiently.*

### Victory Lines

- ★ "Air's moving. Head's clearing."
- ★★ "Under half a percent. That's proper clean air."
- ★★★ "Under 0.1%. That's better than the ship was."

### Story Outro
**Image:** `story_outro_1.webp` (M2_airRecycling)

> With the CO₂ scrubber in place, I felt proud of myself. But only an hour later, I already had to replace the first cartridge. And we didn't have many. I felt a mild panic changing them again and again, but Lena stayed calm and self-assured. What was she going to think of next? I felt lucky she was there, but a bit fearful of her next idea.

### Triggers

```
- id: scrubber_50pct
  condition: depletion_below, profileId: co2_scrubber, threshold: 0.5
  action: dialogue, speaker: lena,
    text: "That scrubber cartridge is half gone. Just so you know."
    expression: disappointed
  once: true

- id: scrubber_20pct
  condition: depletion_below, profileId: co2_scrubber, threshold: 0.2
  action: dialogue, speaker: lena,
    text: "Cartridge is getting low. We're going to need a better solution."
    expression: worried
  once: true
```

### Objectives

```
Primary:
- connection: shelter.air_exhaust → co2_scrubber.mat_in
- connection: co2_scrubber.perm_out → shelter.air_return
- maintain_conditions: CO2_pct_lte: 1.0, O2_pct_gte: 18, duration_s: 7200

Inherited health:
- maintain_conditions: O2_pct_gte: 18, duration_s: 7200
```

---

## M3 — Find Water

### Story Intro (3 images)

**Beat 1**
**Image:** `m3/story_intro_1.webp` (M3A_hydrovent)

> Lena didn't disappoint. She'd spotted a hydrothermal vent not far from the shelter. She said it had plenty of water vapor, and might even carry useful gases — natural gas, hydrogen. She wanted me to "tame it," whatever that meant.

**Beat 2**
**Image:** `m3/story_intro_2.webp` (M3B_airCooler)

> She explained that the vent threw out high-pressure, high-temperature water along with other gases. We needed to cool it down before we could get liquid water out of it. I patched together a fan and some cooling fins from the wreckage. I thought it should work to bring the fluid down to ambient temperature.

**Beat 3**
**Image:** `m3/story_intro_3.webp` (M3C_hydrovent)

> Lena also pointed out some salvaged parts near the shelter that could be welded together into — well, the only word for it is a wellhead. I didn't drill it, but I capped it, and I can tell you it was a lot of hard work. I routed everything to the flare chimney for now, and lit it on fire. Judging by the flames, there was definitely natural gas in there.

### Briefing (Lena, BUILD state)

> I'm really impressed. There's everything we need in that vent. It's not very powerful right now, but more than enough for the two of us. Water is becoming urgent — I'm lightheaded already. The principle is simple: take what comes out of the well, run it through your new air cooler, and collect the condensed water in a barrel. Then connect the barrel to the shelter's water port.

> But there's a problem. The battery can only connect to one thing, and right now it's connected to the room. The air cooler needs electricity too, for its fan. We need a power dispatcher — it takes electricity in and splits it out to multiple consumers. You should set that up first.

### Guidance Steps

**Step 1 — Place power dispatcher**
Lena: "Open the palette and find the power dispatcher. Place it on the canvas."
*Highlight: palette_tile 'power_dispatcher_5'*
*Completion: unit_placed, profileId: power_dispatcher_5*

On completion: "That's our junction box. Now let's rewire."

**Step 2 — Rewire battery through dispatcher**
Lena: "Disconnect the battery from the room. Then connect the battery to the dispatcher's input, and the dispatcher's first output to the room."
*Highlight: unit 'power_dispatcher_5'*
*Completion: connection, fromProfile: battery, toProfile: power_dispatcher_5*

On completion: "Good. The room's getting power through the dispatcher now."

**Step 3 — Connect dump load**
Lena: "Connect a dump load to the dispatcher's surplus port. If the battery produces more than we need, the surplus has to go somewhere, or things fry."
*Highlight: palette_tile 'sink_electrical'*
*Completion: connection, fromProfile: power_dispatcher_5, toProfile: sink_electrical, portType: elec*

On completion: "Safety first. Smart."

**Step 4 — Build the water circuit (free-form)**
Lena: "Now for the water. Get the air cooler from the palette and connect it to the dispatcher for power. Then route the well's output through the cooler, into the barrel, and connect the barrel to the shelter's water port. If you can, put the barrel overflow on the flare so we don't flood anything."
*Highlight: none (free-form from here)*
*Completion: objective_complete, objectiveId: water_flowing*

**On air cooler placement:** "That's a solid air cooler. Don't forget to give its fan electricity from the dispatcher."

**On barrel placement:** "There's your barrel. A big blue plastic one. Don't put boiling water in it — it'll melt. The cooler needs to bring the temperature down first."

**On separator placement:** "Nice thinking. This thing is just a big tube standing upright — gas rises, liquid falls, you draw from the top and bottom. Keeps the barrel cleaner."

**On barrel overheating (T > 90°C):** "You're trying to fill a plastic barrel with near-boiling water. HDPE melts around 130°C, but it deforms well before that. Cool it down first."

**On first water reaching the barrel:** "That looks good! I'm so thirsty. Let's fill this halfway and call it done."

### Stars

- ★ Water barrel at least half full. Water connected to shelter.
  *Rationale: basic objective — sustainable water supply.*
- ★★ ★ conditions + barrel overflow connected + dump load connected.
  *Rationale: rewards proper safety practice (overflow routing, surplus power).*
- ★★★ ★★ conditions + L/V separator installed before the barrel.
  *Rationale: rewards engineering cleanliness — separating gas from liquid before storage.*

### Victory Lines

- ★ "Water. Not exactly Evian, but I'll take it."
- ★★ "Water and safety measures. You're thinking ahead."
- ★★★ "Gas-liquid separation before storage. That's proper engineering."

### Story Outro
**Image:** `story_outro_1.webp` (M3D_plugWater)

> Finally, water. I felt real proud plugging that barrel into our shelter. I felt like I could do anything, and we were going to make it for sure. I wanted a hot drink, but we only had cold water. I really enjoyed my glass of water though. Best water ever.

### Triggers

```
- id: barrel_overheat
  condition: temperature_above, location: simple_open_tank, T_K: 363
  action: dialogue, speaker: lena,
    text: "That barrel is way too hot. The plastic is going to warp. Cool the water before it goes in."
    expression: shouting
    autoPause: true
  once: false  (repeating — important safety warning)

- id: first_water
  condition: inventory_below is NOT right here — need a "inventory above" type
  ... (trigger when barrel level > 10%)
  action: dialogue, speaker: lena,
    text: "Water coming in. Keep going!"
    expression: happy
  once: true
```

### Objectives

```
Primary:
- connection: battery → power_dispatcher_5 (power routed through dispatcher)
- connection: power_dispatcher_5 → shelter (room still powered)
- flow_rate: species: H2O, min_molPerS: 0.0001, targetProfile: shelter, portId: h2o_in
- store_component: species: H2O, targetProfile: simple_open_tank, minLevel: 0.5

Inherited health:
- maintain_conditions: O2_pct_gte: 18, CO2_pct_lte: 1.0, duration_s: 3600

Star 2 additions:
- connection: simple_open_tank.overflow → flare_stack or sink
- connection: power_dispatcher_5.elec_surplus → sink_electrical

Star 3 additions:
- unit_placed: flash_drum (L/V separator present in circuit)
```

---

## Asset File Mapping

```
assets/campaigns/planet_x/arc_a/
  intro_1.webp          ← A1_shipOrbit
  intro_2.webp          ← A2_K
  intro_3.webp          ← A3_Lena
  intro_4.webp          ← A4_shipCrash
  intro_5.webp          ← A5_injured
  intro_6.webp          ← A6_roleIntro
  m1/
    story_outro_1.webp  ← M1_oxygen
  m2/
    story_intro_1.webp  ← M2B_flare
    story_outro_1.webp  ← M2_airRecycling
  m3/
    story_intro_1.webp  ← M3A_hydrovent
    story_intro_2.webp  ← M3B_airCooler
    story_intro_3.webp  ← M3C_hydrovent
    story_outro_1.webp  ← M3D_plugWater
```

---

## Notes for Implementation

**Barrel temperature limit:** Change simple_open_tank profile
T_HH from 473K to 363K (90°C, HDPE deformation threshold).
Or create a custom profile 'water_barrel_m3' with this limit.

**Trigger gap:** The trigger system needs an `inventory_above`
condition (barrel level > threshold) to fire "water coming in."
Currently only `inventory_below` exists. Add to evaluator types.

**M3 dispatcher rewiring:** The guidance says "disconnect the
battery from the room." This requires the player to delete an
existing connection, then make two new ones. The guidance system
needs to handle this — the completion condition for step 2 should
be "battery connected to dispatcher" regardless of whether the
old connection still exists (the engine won't allow fan-out, so
connecting battery → dispatcher automatically displaces the old
battery → room connection, or the player deletes it manually).
Verify which behavior the engine uses.

**Preplaced unit list per mission:**
- M1 initial scene: room (preplaced)
- M2 initial scene: inherits M1 + flare_stack (preplaced, added)
- M3 initial scene: inherits M2 + hydrovent (preplaced, added)
