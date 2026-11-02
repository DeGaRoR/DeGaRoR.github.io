# WEATHER-DAYS: a credible day, fourteen crafted days, a plan that loops (study, 2026-11-02)

> **Status:** a STUDY. No game code was changed and nothing was rendered (cloud session). Asked by the user on 2 Nov
> through A0 (the flyDiy Performance Coordinator). A0 relayed three more of the user's points the same evening: one
> stormy day, nights that are a showcase, and proper time controls.
>
> **What is in this branch** (`claude/weather-days-study`):
> - this file;
> - `futureDesigns/weather-days/days/*.json`: the fourteen crafted days, one JSON per day (14 KB in all);
> - `futureDesigns/weather-days/plan_proto.js`: the deterministic evaluator `(plan, instant) -> the day's spec`, run
>   through the game's OWN almanac and air (`tools/flight_core.js`: `DAY`, `SOLAR`, `makeAtmos`). Every number in §2-§5
>   and the appendices comes from it. It is study evidence, not game code: nothing in `src/` or `build.js` reads it.
>
> ```
> node futureDesigns/weather-days/plan_proto.js            # the 14 days, hourly (Appendix A)
> node futureDesigns/weather-days/plan_proto.js --fly      # flyable half-hours per day (§4.2)
> node futureDesigns/weather-days/plan_proto.js --smooth   # two loops walked minute by minute: the largest step (§3.9)
> node futureDesigns/weather-days/plan_proto.js --season   # one plan across the season; the aurora night's dates (§2)
> ```

---

## 0. THE ANSWER ON ONE PAGE

1. **More is unified than the user remembers.** The core already has ONE weather state: the DAY (`07_day.js`, inside the
   world). It carries the air (OAT, QNH, the column's shape), the water (dew point, cloud base, visibility, mist), the
   cloud decks, the wind spec and a front. The SOLVER flies in it live: density, power, propeller and EAS
   (`30_solver.js:123`, `:2829`). Density altitude is in the physics TODAY, exact (`05_atmos.js:63`).
2. **What the clock does NOT drive is the weather's values.** The clock moves the sun, the moon, the twilight, the
   thermals' and the sea breeze's drive, and the morning burn-off of the mist. Everything else is a FIXED declaration
   set once from a menu: the temperature (no diurnal swing on the game's day), the QNH, the dew point, the cloud cover,
   the wind's speed and direction. The game's day (`day_clock.js:34`) is "Standard · light breeze 8 kt" at 15 °C and
   1013.25 hPa, 24 hours a day. In the career that weather is **the sandbox's own saved pref**, shared between the two
   modes, and the player can still change it from the menu (§1.4).
3. **The model:** one pure function `weatherAt(plan, instant) -> the DAY's own spec fields`, evaluated INSIDE
   `07_day.js` `recompute()` the way the diurnal swing and the front already are. So the page and the physics worker
   compute the same numbers with no message, nothing bumps `day.version` per frame, and the visuals and the physics
   read ONE source. Temperature uses Parton & Logan (minimum at dawn, peak about 15:00 local). Every other quantity is a
   keyframe track blended across days, so the plan is continuous by construction. The minute-by-minute walk over two
   loops finds no step bigger than 0.08 °C, 0.14 kt or 0.02 of cloud cover per minute (§3.9).
4. **Fourteen days, one storm.** 10 easy, 3 gently challenging, 1 storm, forecast three days ahead. Over one loop's
   daylight: **80 % easy, 11 % fly with care, 10 % no-fly**, and the no-fly hours are only the storm (08:30-17:30)
   and two foggy mornings you wait out (§4.2). Five aurora nights. Every night except two is clear or broken, and the
   two overcast ones are showcases of their own: the dock lights on glassy water, and the moon over a sea of fog.
5. **The loop and the calendar.** The weather loops on 14 days, keyed to the career's LOCAL DATE. The sun, the moon and
   the length of the day follow the REAL date. A 14-day loop is half a lunation, so each crafted night alternates
   between a near-full and a near-new moon from one loop to the next: every aurora night is seen both ways within a
   month. **No snow** comes from a **flying season** of 20 May to 30 September: ending it is a story beat, the "winter
   layup", that lands the career on the next season's opening, always forward (§5.3).
6. **The certificate stays on the standard day** by construction: the bench worker builds its own calm ISA world
   (`bench_worker.js:158`, `:194`), and `genShakedown` / `genDensityAlt` set their air themselves. What weather DOES
   reach is the FLOWN acceptance leg, which today records TAS and fuel in the day's air with no correction. Over
   Jolene's range that is σ 0.98-1.03, a few per cent (§1.6).
7. **Time rules (A0's point 3).** The career: real time; WAIT forward only, on the ground, to a named hour, a clock time,
   "until the window opens" (exists), "until the weather improves" (new, reads the plan); no free time of day, no
   weather menu, no rate. The sandbox: everything free, plus "play plan day N". The garage gets a TIME icon: the clock,
   today's forecast, a three-day outlook, the waits with their previews. The data GAME-MENUS reads is in §6.3.
8. **Bugs found on the way** (worth fixing even without a plan, §1.5): the drawn clouds ignore a front's overcast
   (they read `cloudCover`, not `cloudCoverEff`); a front ends with a **55° snap** of the wind direction (the default
   veer); its temperature drops **in one step** at passage; the mist forms in a gale (no wind term); the contracts' moon
   reads the declared cover, not the effective one.

**Decisions for the user** are collected in §8. The two that shape everything: the season window (and whether the
career should still open on 21 June, in the white nights when the aurora is faint), and in-flight time acceleration.

---

## 1. AUDIT: what the career's clock drives, and what it does not

### 1.1 The single source of truth, as it stands

```
                      world.day  (07_day.js DAY.makeDay, made in 20_world.js:1031)
   ┌───────────────────────────────────────────────────────────────────────────────────┐
   │ WHEN   date, utc, rate             advanced ONLY by the viewer (DAY_CLOCK.tick ->    │
   │                                    world.dayTick, 20_world.js:1139); career: rate 1 │
   │ WHERE  lat 55.04 N, lon 131.57 W, AKST/AKDT (07_day.js GEO_DEFAULT)                 │
   │ AIR    oatC | dISA, qnhPa, lapse, mixH, inversion   (AIR_KEYS, 07_day.js:51)        │
   │ WEATHER wind (the climate's spec), storm (a front on the clock), diurnalC           │
   │ WATER  dewC | rh  -> cloudBase (125 m/°C), visibilityKm, mistRho0, mistBurn          │
   │ AEROSOL turbidity, ozone, groundAlbedo                                               │
   │ CLOUD  cloudCover, cloudType, cloudSeed, cloudUpper[2]                                │
   │ DERIVED sun, moon (06_solar: NOAA / Schlyter), illumClass, sunElLag, local time      │
   └───────────────────────────────────────────────────────────────────────────────────┘
      │ airKey -> world.atmos (lazy makeAtmos, 20_world.js:1125) -> SOLVER (30_solver.js:123)
      │ wind   -> CLIMATE (09_climate.js) -> solver strips (wind(), linearised) + everyone else (sample())
      │        -> the sea's target (20_world.js:1040) -> CLIMATE_LINK.pub (socks, ripples, smoke, drift)
      │ the whole object -> atmo.js (sky LUTs on version), sky_light.js (key, hemi, night floor),
      │        clouds.js (decks), radio_talk.js (the weather in words), contracts (the moon, the cover)
      │ the worker (?simw=1): the day's SPEC is mirrored at init and on every setDay (sim_link.js:65,
      │        sim_host.js:408, :632); the worker ticks its own copy (sim_host.js:687)
```

The rule in the code is the user's own: *"EXTEND THE DAY, NEVER ADD A SECOND ONE"* (07_day.js header). This study keeps
it. The plan is not a second weather. It is what fills the DAY's declared fields as a function of the clock.

### 1.2 What the clock drives TODAY

| Quantity | Where | Driven by the clock? |
|---|---|---|
| date / time | `07_day.js` `advance()`; career instant in `74_career.js:36` (`CAREER_DAY0` = 22 Jun 00:00 UT = 21 Jun 16:00 AKDT), forward only (`careerDaySet`, `:228`) | yes: real time in the career (`day_clock.js:258` refuses any other rate), waits (`07b_clock.js:100` `dayWaitUntil`) |
| sun position, twilight class | `06_solar.js` NOAA; `07_day.js:98` `illumClass` | **yes** |
| moon position + phase | `06_solar.js:128` Schlyter, topocentric; `07_day.js:100` | **yes**, from the real date (the 2026 full moons: 30 Jun, 29 Jul, 28 Aug, 26 Sep) |
| the sky (Hillaire LUTs, stars, moon disc) | `atmo.js` (stars `:728`, hidden by the sky's own light) | **yes** (sun / moon); turbidity is fixed |
| the light rig, exposure, the night floor | `sky_light.js:70` `nightFloor`, `render_world.js:7754` `nightVisibility: 0.8` (the owner's pick, PERF NIGHTVISIBILITY) | **yes** |
| the thermals | `09_climate.js` convection on `sunElLag` (the ground's 2 h lag); none at night (`:465`) | **yes**, the drive; the wind spec is fixed |
| the sea breeze / land breeze | `09_climate.js:609` `breezeAt`: drive = sin(el) × (1 − 0.8 cover); −0.25 at night | **yes** (only when the spec names `breeze`; the game's breeze preset does) |
| the mist's burn-off | `07_day.js:214` `mistRho0` × (1 − burn(sunElLag, cover)) | **yes**, but the mist's DENSITY comes from a fixed rh (§1.3) |
| a front | `07_day.js:58` `STORM_D`, pure in utc | **yes**, once declared (menu "a front", `?storm=`) |
| the diurnal temperature swing | `07_day.js:149`: a cosine, peak 3 h after solar noon | **only if** `diurnalC` is set. The game's day and 5 of 7 presets set none |

### 1.3 What it does NOT drive

| Quantity | Value on the game's day | Set by | Reaches the physics? |
|---|---|---|---|
| OAT | 15 °C all day (ISA) | the preset (`weather_ui.js:33`), F8, the pref | **yes**, through `world.atmos` |
| QNH | 1013.25 hPa | same | **yes** |
| **density altitude** | 0 at sea level | derived (`05_atmos.js` `densityAlt`) | **yes**: σ in every strip's dynamic pressure (`30_solver.js:3131`), the Gagg-Ferrar power lapse, the prop's kT / kV (`05_atmos.js:242`, `:275`), EAS for the AP (`easK`) |
| humidity / dew point | rh 0.5 → Td 4.7 °C | `DAY.DEFAULT.rh` | no (dry air, a declared cut: < 1 % at 30 °C) |
| visibility, haze | 375/T² km ≈ 48 km at turbidity 2.8 | `turbidity` fixed (`GAME_DAY`) | no (the AP and pilots do not read it) |
| mist / fog | none: rh 0.5 never crosses 0.7 | derived from rh | no |
| cloud cover / type | 0.25 `cuh`, seed 1 | `GAME_DAY`, the clouds panel, `?cloud=` | the convection reads the cover (`09_climate.js:457`) |
| cloud base | 125 × (15 − 4.7) ≈ 1290 m | derived | the thermals' tops |
| wind speed / direction | 8 kt from 250°, gust 0.15, `breeze: 1` | `GAME_WIND` (`day_clock.js:33`) | **yes**: every strip, the sea, the pilot's runway choice |
| gusts / turbulence | 0.15, fixed | the spec | **yes** |
| rain | **does not exist** | — (aeroweather's `rain` is parking wear, not precipitation) | — |
| aurora | **does not exist** (no code on any branch) | — NIGHT-LOOK is building it | — |

### 1.4 How each is set today: six doors and one keeper

1. **The game's day** `GAME_DAY` (`day_clock.js:34`): 21 Jun, 16:00 local, `cuh` 0.25, turbidity 2.8, the 8 kt breeze.
   A first boot only.
2. **The weather card** `WEATHER_UI.PRESETS` (`weather_ui.js:33`): calm, light breeze, ridge, thermal, hot and high, a
   front, gale. Each one is a whole day in the DAY's own fields. `#selCond` (`body.html:113`) stays the keeper, and the
   HUD slot shows its option text, so the brief reads "Standard · light breeze 8 kt" (`app.js:17727` `flDay`). The
   label is the SELECT's text, not a reading of the air.
3. **The clouds panel** (`clouds_ui.js`) and **the day panel** (`day_ui.js`): cover, type, decks; the time presets.
4. **URL** `?day=`, `?wind=kt,deg,gust,terrain`, `?storm=h,intensity`, `?cloud=` (`day_clock.js`, read last: a link wins).
5. **The F8 dials** (the developer's).
6. **The saved pref** `flydiy.day.v3`. **In the career it is the same pref**: `bind()` restores the pref's weather
   (`day_clock.js:158`), `career(hook)` only replaces the INSTANT (`:241`), and `save()` (`:64`) writes the career's
   weather back into the sandbox's pref. So a career's weather is whatever the player last picked anywhere, and it can
   still be changed mid-career from the card.

### 1.5 Unified, and not: the findings

What IS one: the air and the wind are one object (`setWeather` → `setDay`, `20_world.js:1160`). The solver, the sky, the
light, the clouds, the sea, the socks, the radio and the contracts all read the same `world.day`. The worker mirrors
it. The climate's rule *"the day declares, the climate derives"* holds everywhere it was applied.

What is NOT, each one a defect worth fixing on its own (W0 in §7):

| # | Finding | Where | Effect |
|---|---|---|---|
| F1 | **The drawn clouds read the DECLARED cover and type**, not the effective ones | `08_cloud_field.js` `layer()`/`layers()` read `day.cloudCover` / `day.cloudType`; `clouds.js:686`. Only the climate (`09_climate.js:457`) and the radio read `cloudCoverEff` | a front's overcast and its cumulonimbus change the thermals, the breeze, the mist burn and the radio's words, but **not the sky you see** |
| F2 | **A front ends with a direction snap** | `07_day.js` storm `veer` holds its full value through `post` (no `× I`); `09_climate.js:305` `stormOf()` returns null at I = 0 | at the end of `post` the wind swings back by `veerDeg` (55° by default) **in one tick** |
| F3 | **A front's temperature drops in one step** | `07_day.js:136` `dTemp × (t > at ? 1 : 0) × I` | −6 K by default (−3 K in the walk) at the instant of passage: σ steps ~2 %, the cloud base 280-750 m, in one frame |
| F4 | **A front is a transient, not a regime** | same block: dTemp, dQnh and veer all return to zero after `post` | the cold, clear, veered air behind a cold front is the whole point of a frontal passage. The plan must carry it in its tracks (§3.7) |
| F5 | **Mist forms in a gale** | `07_day.js:214`: mistRho0 is a function of rh and the burn, with no wind term | the walk (storm day, 14:00, 21 kt gusting 35, rain): today's law draws 1.39 /km of ground fog; radiation fog cannot exist above ~10 kt |
| F6 | **A sea fog burns off like a valley fog** | same: one radiation law, burnt by the lagged sun | an advection fog over cold water does not burn off in the morning. A day cannot say "fog on the sea until noon" (§3.4) |
| F7 | **The night sky of an offer reads the declared cover** | `75_career_wire.js:205`, `app.js:635`/`:8852` (`career.cover = day.cloudCover`) | a forecast overcast night is not known at all: the cover is "as the page last saw it" |
| F8 | **The career's weather is the sandbox's pref** | `day_clock.js:64`, `:158`, `:241` | see §1.4. A plan must cut this (the career reads the plan; the pref keeps the sandbox's) |
| F9 | **The HUD's weather slot is a menu label** | `app.js:17727` | a planned day needs a reading ("Clear high · W 9 kt · 17 °C") |
| F10 | **The cloud map re-thresholds on the CPU** whenever any deck's cover moves 0.001 | `clouds.js:622` `mapsFor` keyed on `cover.toFixed(3)`; a rebuild re-uploads a 256²×4×3 `DataArrayTexture` and asks for a new fit | a cover that grows smoothly through the afternoon would rebuild the map every few seconds, and the cells grow in visible jumps. The CLIMATE plan already named "the cloud refit thrash" (CLIMATE §10) |
| F11 | **The sea is redrawn on every wind set** unless `seaTau > 0` | `20_world.js:1055` `seaFrom` | the game's day has `seaTau` 0. A plan whose wind moves must set 900 s (the measured smooth build, `20_world.js` K4 notes) |
| F12 | **The altimeter is geometric** | `cockpit.js:257` `raw.alt = cg[1] − CK.qnh` (the field's elevation) | the QNH has NO cockpit consequence: always "correctly set". Honest and simple, and worth keeping (§8 Q6) |

### 1.6 The physics contract: WYSIWYG under a non-standard day

**The solver** reads `world.atmos` live (`30_solver.js:123`), at the aeroplane's own height (`:2828`), every substep:
ρ in every strip (`:3131`), the prop wash (`:2910`), the power lapse and the prop's thrust and speed scaling (`:2840`),
and the EAS factor the autopilot flies its numbers in. **A planned day changes how every aeroplane flies, at once,
mid-flight, with no reset.** That is the design, and it is already true for any preset.

**What the bench and the certificate measure: the standard day, by construction.**
- `genShakedown` builds its sim with `world = null` → `ATMOS_ISA` (`05_atmos.js:146`).
- `genDensityAlt` (`64_gen_build.js:1210`) sets its own air: ISA at sea level and "1000 m, ISA+20" (`:1200`). It is the
  game's "what does it do on a hot day" sheet, and it is already independent of the day.
- The certificate's flown pull sets ISA at 400 m (`66_gen_cert.js:636`).
- The bench worker makes its own `makeWorld()` (`bench_worker.js:158`, `:194`) with the default DAY: no air, no wind.
- The contracts' crosswind criterion `xwindKt` is the design check's rudder row (`72_accept.js:82`): static.

So **a plan changes no certificate and no bench number**, provided the worker's `makeWorld()` never inherits a plan
(a gate must hold that: §7).

**What weather DOES reach, honestly or not:**

| Reader | Today | Under a plan |
|---|---|---|
| the flown ACCEPTANCE LEG (`72_accept.js`) | TAS "calm-air" (the wind removed, `:17`), fuel flow, steadiness bands, all **in the day's air**, no σ correction | the same leg on a 22 °C afternoon reads σ 0.98: TAS about +1 %, piston power −2.3 %; a thermal afternoon may break the steadiness bands. **Record the air on the signed record** (OAT, QNH, DA), and either correct the TAS / flow to the standard day with `05_atmos` or widen the bands. Decision Q5 |
| `pilotCanFly` (`43_pilot.js:278`) | the machine sheet's ISA landing roll; the wind only on one-way strips | the short strips (`nv_strip` 150 m, `w4` 216 m, `mn_strip` 250 m) feel density altitude. A factor 1/(σ·kT) on the roll is honest and cheap |
| the hired pilot's refusal (`76_pilots.js:44`, 18 kt) | `leg.windKt` = the wind NOW at the page (`app.js:9153`) | the plan's wind at the leg's own hours (the forecast) |
| the AP's route budget | `43_pilot.js:602`: "× 1.6 for the wind and the circuit" | the forecast's winds aloft give a real ground speed (§5.6) |

**What a non-standard day means in numbers.** From `makeAtmos` and `atmosPropScale`; the take-off factor is the
first-order 1/(σ·kT), lift-off TAS² ∝ 1/σ and the accelerating force ∝ kT:

| Day | At | DA (m) | σ | piston power | take-off roll (piston) | (electric) |
|---|---|---|---|---|---|---|
| ISA | sea level | 0 | 1.000 | 1.000 | ×1.00 | ×1.00 |
| crisp morning 8 °C, 1022 | sea level | −347 | 1.034 | 1.038 | ×0.93 | ×0.96 |
| warm afternoon 24 °C, 1018 | sea level | +271 | 0.974 | 0.971 | ×1.06 | ×1.04 |
| front 12 °C, 995 | sea level | +80 | 0.992 | 0.991 | ×1.02 | ×1.01 |
| warm afternoon 24 °C, 1018 | a 300 m strip | +560 | 0.947 | 0.940 | ×1.12 | ×1.08 |

**Jolene's summer moves a take-off roll by −7 % to +12 %.** That is real and fair, and it is felt only on the shortest
strips. It is the argument for the mild Southeast-Alaska climate this plan keeps: nothing in it is "hot and high".

---

## 2. THE REGION AND THE SEASON

Jolene is 55.04 N, 131.57 W: Ketchikan's latitude. The game runs on AKDT all season (`07_day.js` US DST rule). From
the game's own almanac (`06_solar` through `DAY`):

| date | sunrise | sunset | civil dawn | civil dusk | sun at midnight | sun at noon |
|---|---|---|---|---|---|---|
| 15 May | 04:38 | 20:49 | 03:50 | 21:37 | −16.0° | 54° |
| 21 Jun | 04:07 | 21:30 | 03:07 | 22:29 | **−11.5°** | 58° |
| 15 Jul | 04:28 | 21:16 | 03:34 | 22:09 | −13.4° | 56° |
| 1 Aug | 04:55 | 20:49 | 04:09 | 21:35 | −17.0° | 53° |
| 15 Aug | 05:21 | 20:19 | 04:39 | 21:01 | −20.9° | 49° |
| 1 Sep | 05:53 | 19:38 | 05:14 | 20:17 | −26.7° | 43° |
| 15 Sep | 06:19 | 19:03 | 05:42 | 19:39 | −32.0° | 38° |

**The night's arc through a season.** Around the solstice the sun never sinks below −11.5°. The night is one long
NAUTICAL TWILIGHT: a blue glow in the north all night, the brightest stars only, an aurora seen faintly. Astronomical
darkness (below −18°) returns about 1 August. From mid-August the nights are truly dark: the Milky Way, and the aurora
at full strength. **This is a gift for the "beautiful nights" brief**: June's nights are luminous blue, and August and
September's are deep and starry with aurora. Both are inviting, and the career walks from one to the other.

**The normals** (Ketchikan-like, rounded; monthly mean daily high / low, °C, read at mid-month and interpolated
continuously): May 14.5/6.5 · Jun 17/9.5 · Jul 18.5/11.5 · Aug 18.5/11.5 · Sep 15.5/9 · Oct 11/5.5. A crafted day
declares its temperatures as **anomalies against these**, so the same "clear high" is 6.5 → 16.3 °C on 25 May and
11.5 → 18.5 °C on 19 July (`--season`). The plan stays credible all season without a second set of days.

**No snow.** Ketchikan's lowland snow season is November to March; its September is cool and wet, never white.
**The flying season: 20 May → 30 September.** Inside it, nothing in this plan ever needs snow, frost on the ground or
ice. §5.3 is how the career stays inside it.

**Honesty about rain.** Real Ketchikan is one of the wettest towns in the US, with measurable rain on about half of its
summer days. This plan is **a good summer**, a long dry spell under the North Pacific high with one front through it.
That is a game's licence and is stated here as one. Reality's ratio would have the player waiting a day in two.

---

## 3. THE CREDIBLE DAY MODEL

### 3.1 The shape: one pure function, inside the DAY

```
weatherAt(plan, abs, geo) -> { oatC, qnhPa, dewC, wind{kts,dirDeg,gust,refH,breeze,terrain,thermals,aloftK,veerDeg},
                               cloudCover, cloudType, cloudUpper[], turbidity, lapse:'mixed', mixH, inversion,
                               storm, seaTau, rain, aurora{kp}, fog{hold,where}, meta{planIdx,id,name,fly,forecast} }
```

`abs` is the instant (`07b_clock.js` `dayAbs`). The output is **the DAY's own declared fields**: no new consumer API.
Where it runs decides everything:

- **NOT** "the career calls `world.setDay(weatherAt(now))` every few seconds". `set()` bumps `day.version`, which
  re-bakes the sky's transmittance and multi-scatter LUTs (atmo.js) and the probes. It is also mirrored to the
  worker as a command per call.
- **YES** in `07_day.js` `recompute()`, beside the diurnal swing and the front, which already work this way: the spec
  holds `plan: { id, epoch, loop }`, and `recompute()` evaluates the plan at `(jdn, utc)` into an internal EFFECTIVE
  spec that every derived quantity reads. Then `advance()` moves the weather WITHOUT a version bump (the existing
  rule). `airKey` changes, so `world.atmos` rebuilds lazily (`20_world.js:1125`, already). The worker computes the
  same numbers from the same spec on its own clock: the page and the worker cannot disagree.
- The wind needs one more line: `world.dayTick` already re-resolves the climate when a front moves
  (`20_world.js:1139`). Add "when the plan's wind key moved" (speed to 0.1 kt, direction to 1°, gust to 0.01: a few
  re-resolves a minute at rate 1; the relief raster is built once).

### 3.2 The weather day and the tracks

**The weather day owns 04:00 → 28:00 local** (04:00 the next morning). That is a pilot's day: its dawn, its afternoon,
its evening and the night that follows. So "the aurora night after the storm" and "the calm clear night that makes
tomorrow's fog" are written in the day they belong to.

**Everything is a track** `[[hour, value…], …]` in the weather day's hours. The evaluator lays the day before, the day
and the day after on one timeline (shifted −24 / 0 / +24 h), and interpolates between neighbouring keyframes with a
smoothstep. Smoothstep has zero slope at each key, so there is no overshoot and no ringing, and a value held across
two keys is held. So:

- **continuity across days is by construction**: the evening of day N and the morning of day N+1 are ONE interpolation,
  whatever the two days declare;
- a SETTING (the breeze's, the terrain's and the thermals' weights, aloftK, the column) written as one number is a
  one-key track at 15:00, and it blends into its neighbours overnight;
- an EVENT (fog, rain, aurora, a temperature offset) a day does not name is ZERO across that day (keyed at both of its
  ends), so it never leaks into a neighbour by more than the hour around the boundary. The prototype's first draft
  leaked a sea fog 13 h into the next afternoon; that is how this rule was found.

### 3.3 Temperature: Parton & Logan, against the season's normals

The minimum near dawn and the maximum mid-afternoon (Parton & Logan 1981, the standard diurnal model):

- **day** (sunrise + c → sunset): `T = Tmin + (Tmax − Tmin) sin(π m / (Y + 2a))`, with m the hours since sunrise + c and
  Y the day length; a = 1.6 h, c = 0.5 h. The peak falls at sunrise + c + Y/2 + a: **14:54 on 21 June, 14:47 on
  15 September**, as observed;
- **night** (sunset → the next morning's minimum): an exponential fall (b = 2.2) from the sunset temperature to **the
  NEXT day's Tmin**, so each night meets the next dawn exactly;
- `Tmin` / `Tmax` = the date's normals + the day's anomalies; plus an optional `tAdd` track (a front's sharp drop,
  which no diurnal curve makes).

This replaces `07_day.js`'s cosine (`:149`) under a plan. That cosine is symmetric, peaks 3 h after solar noon, and
its own comment names the cut: "the real curve is asymmetric with a sharp post-dawn rise". Parton-Logan is that curve.

### 3.4 Water: the dew point → humidity → cloud base, haze, mist and fog

The dew point is a track, again an anomaly against the normal low. Everything else is **derived by the existing laws**:
rh by Magnus, the cloud base at 125 m per degree of spread (the LCL of a mixed layer, `05_atmos.js:174`), the column's
visibility from turbidity and rh (`07_day.js:181`), the ground mist's density from rh with the lagged-sun burn
(`07_day.js:214`).

**The authoring rule that makes a fog morning (and keeps the others clear)**: the dawn spread is
`(normal low + temp.min) − (normal low + dew)`. A fair day keeps it **≥ 3.5 °C** (rh ≈ 0.78 at dawn: a thin haze, never
mist). A fog day sets it to **0** (`dew ≥ temp.min`). The prototype's first draft had dawn mist on 9 days of 14
because its dew points sat 2 °C under the minimum. 3.5 °C is the measured bar.

**Two proposed terms** (W0; the prototype prints today's law and the proposal side by side, `today / planned`):

1. **Radiation fog needs calm air.** `mist × (1 − smoothstep((kts − 3)/7))`: full in calm air, gone by ~10 kt. It fixes
   F5. On the storm day at 14:00 today's law draws 1.39 /km of fog in a 35 kt gust; the proposal draws 0.
2. **A declared advection fog.** `fog: { where: 'sea' | 'low', hold: track 0..1 }`. The layer's density is
   `0.0025 × max(radiation term, hold)`: saturated marine air rolling in and out when the day says. It needs neither
   the island's humidity nor the sun's permission. It fixes F6. It needs the renderer to lay the layer by `where`
   (the sea and the shore only, or the valley floors). FOG-MIST F2 already owns "where the layer lies"
   (`07_day.js` comment above `:181`), so this is one more input to it.

### 3.5 Clouds: decks, types, the dip rule

- the **low deck**: cover track + type (`st sc cuh cu cb`); its BASE stays derived (the dew-point spread), so a fog morning
  lifts into a stratus deck, and a warm afternoon raises the cumulus' base, without anyone writing a base;
- **one upper deck** (`ac as`) with its own base track (the DAY already supports two, `07_day.js` `cloudUpper`);
- **a type never changes under cover.** Two keys of different types fade the old type out to zero by their midpoint and
  the new one in from it. The validator (§7, GATE WEATHERPLAN) refuses such a dip in daylight unless the cover on
  both sides is ≤ 0.05. The 14 days change type only at night or through near-clear sky;
- the **front's** `cover` / `type` (0.98 `cb`) applies while its intensity is above 0.5, as today. Its overcast must
  REACH the renderer (F1);
- **cover moves slowly** (≤ 0.02 per minute in the walk), and the renderer must grow cells continuously rather than
  re-threshold the map (F10): upload the weather map's raw field once and threshold it on the GPU with a `uCover`
  uniform per deck, or cross-fade two maps. CLOUD / NIGHT-LOOK own this (§7 W3). Until it lands the plan can be
  quantised to 0.05 steps, at the cost of a visible re-fit every step.

### 3.6 Wind: the synoptic track, plus the climate's own diurnal terms

- **the synoptic wind** is a track of `[hour, kts, dirFrom, gust]`, interpolated **as a vector**, so a reversal passes
  through calm (a sea breeze dying and a land breeze filling in) rather than swinging round at full strength;
- **the diurnal cycle is authored on top of physics that already exist.** A calm dawn and a stronger afternoon are in the
  track (most days: 1-3 kt at 04:00, 6-9 kt at 15:00, falling at dusk). The SEA BREEZE is the climate's own
  (`breezeAt`, `09_climate.js:609`: onshore with the sun, a weak land breeze at night), as are the THERMALS
  (`sunElLag`, the mixed layer's depth), the terrain's lift and lee (`terrain`), and the winds aloft (`aloftK`,
  `veerDeg`). The plan sets their weights per day, as tracks too;
- **gusts** are the spec's `gust` (the four gust sines' amplitude). The climate adds turbulence from the thermals, the
  lee and a front (`gustK`) on top. The radio and the classifier read a gust spread of `2 × gust × kts` (radio:
  `GUST_SPREAD_KT 10`), so the peak gust is about `kts × (1 + gust)`;
- `seaTau: 900` on every planned day (F11): the sea walks after the wind.

### 3.7 Pressure, and a front done right

QNH is a track (1001-1023 hPa across the loop; the trend is the story: the high's 1022-1023, the fall ahead of the
front, the rise behind it). **A front under a plan is split in two**:

- the **regime** (the veer from SE to W, the cold air behind, the pressure rise, the clearing) is written in the
  TRACKS, so it persists into the next day as a real frontal passage does;
- the **transient** (the gust factor, the wind boost, the `cb` overcast at passage) stays `07_day`'s `storm`, with
  `veerDeg: 0, dTemp: 0, dQnh: 0`, which avoids F2 and F3 entirely.

The storm day's temperature drop is a `tAdd` track (−3 K over an hour at passage): the walk's largest temperature step
went from **2.999 °C per minute** (07_day's dTemp) to **0.074**.

### 3.8 Night: the moon (real), the stars, the aurora (a per-night Kp)

- **the moon** is never planned. It is the real date's (`06_solar`), so the plan's night cover decides whether its light
  reaches the ground. The contracts' moon must read the PLANNED cover of that night (F7: the night premium, the
  "moonless" words);
- **the stars** are the dome's (`atmo.js:728`), hidden by the sky's own light, the moon (G2600 washes the faint ones)
  and the decks. No plan data is needed;
- **the aurora: `aurora: [[hour, Kp], …]`**, a Kp-like 0-9 index per night (geomagnetic activity is the one thing at
  night that is genuinely "weather" and not astronomy). A proposed visibility law for NIGHT-LOOK, the prototype's:

  ```
  aurora = clamp((Kp − 2) / 4, 0, 1)                      at 55 N geographic (~61 geomagnetic): Kp 3 a glow low in the
                                                          north, Kp 5 arcs to 30-40 deg, Kp 6+ overhead
         × smoothstep((−6 − sunEl) / 9)                   0 at civil dusk, 1 at −15 deg: June's twilight halves it
         × (1 − 0.5 × moonIllum × moonUp)                 a full moon washes the faint structure out
         × (1 − lowCover^1.5)                             under the decks it is hidden, between broken cloud it shows
  ```

  `--season` walks the Kp-6 night across the season. **The same planned night reads 0.33-0.64 in June (twilight, and a
  full moon on half its dates) and 0.96 from August** (dark, the moon down). The aurora is part of the season's arc,
  as it is in reality. NIGHT-LOOK owns its look, its radiance under the pre-exposure (×P, GATE LIGHT's sweep) and its
  colour. The plan owns only Kp.

### 3.9 Smooth: the walk (two loops, minute by minute)

`--smooth` walks 28 days at one-minute steps through the full derivation (07_day + 05_atmos) and reports the largest
one-minute step of each quantity:

| quantity | largest step per minute | where |
|---|---|---|
| T | 0.074 °C | the storm, the front's drop (a `tAdd` hour) |
| Td | 0.137 °C | the sea fog's marine air leaving, 03:30 |
| QNH | 0.125 hPa | the rise after the front, 03:30 |
| wind | 0.14 kt | the storm |
| cover | 0.020 | the sea fog rolling out at 03:20 |
| cloud base | 20 m | **07_day's own 20 m quantum**, which is there to stop re-fit thrash (`07_day.js:164`) |
| visibility | 2.5 km (in a 40-90 km range) | the fog's hold releasing |
| Kp | 0.075 | |
| rain | 0.009 | |
| mist | 0.12 /km | |

**No pops.** The first draft of the prototype showed four: a 3 K front step (F3), a dew point stepping at midnight (the
normals by calendar date, now continuous), the rich terms switching at 04:00, and the fog leak. Each is fixed above,
and each is the kind of thing GATE WEATHERPLAN's walk must keep fixed.

### 3.10 The visuals and the physics read the SAME numbers

Under this design there is nowhere for them to differ. `07_day` evaluates the plan; `world.atmos`, the climate, the sky,
the clouds, the mist, the sea, the radio, the contracts and the forecast UI all read the DAY. The only two readers that
need a change of what they read are F1 (the clouds read the effective cover) and F7 (the contracts read the planned
night).

---

## 4. FOURTEEN DAYS

### 4.1 The sequence: a summer's regimes

Read as weather moves: a high (1-5), a front (6-8), a new high (9-14), and back to the start. Dates are the first loop
from the career's first day (21 Jun 2026). Each day's hourly table is in Appendix A.

| # | Day | Regime | Flyability | The day | Its night |
|---|---|---|---|---|---|
| 1 | **Fair-weather cumulus** | the high | easy | THE GAME'S OWN DAY (`GAME_DAY`'s look, the user's "small, elegant summer clouds"): `cuh` to 0.25, base ~1500 m, W 5 → sea breeze 8 kt | clear; aurora Kp 3 low in the north |
| 2 | **Clear high** | the high | easy | cloudless, calm cool dawn, sea breeze after lunch, 60 km | clear and still; fog forms in the small hours |
| 3 | **Morning fog on the sound** | the high | easy after a wait | fog on the water and the valleys at dawn (1.6 km), held until ~10:30, then fair | clear |
| 4 | **Warm and hazy** | the high's peak | easy | 22.8 °C at 14:00, haze (21 km), cumulus over the ridges, DA +222 m at sea level | mild, few clouds, a gibbous moon through haze |
| 5 | **High cloud coming** | the high breaks down | easy | a halo, altostratus thickening from the SW, the wind backing SE, 1017 → 1013. **The front is forecast** | high overcast, the moon a pale disc |
| 6 | **Overcast calm** | ahead of the front | easy | flat `sc` at 0.85, base ~750 m, 3-6 kt, pewter water. **"The front arrives tomorrow afternoon"** | overcast: **the town and dock lights doubled on glassy water** |
| 7 | **The storm** | the front | **storm: no VFR 08:30-17:30** | SE 14 G20, low cloud 250-300 m from 08:30, rain from 10:00, the cold front 13:30-15:00: SW → W, **gusts to 35 kt, base 150 m, 3 km in heavy rain**, then tearing open by 17:30 | **clear, cold, very still: aurora Kp 5** |
| 8 | **Showers and sunshine** | behind the front | moderate | NW 10-13 G17, sharp-edged cumulus, showers 13-17, 90 km between them | cold, clear: **aurora Kp 6, the showcase** |
| 9 | **Crisp and clear** | the new high | easy | the coldest dawn (7.9 °C), calm, 94 km, small cumulus | clear and cold; aurora Kp 4 |
| 10 | **Ridge day** | a westerly | moderate | WSW 13-17 kt gusting 22 over the hills, lift on every windward face, rough lee. Crosswind practice | wind easing, broken cloud, the moon between |
| 11 | **Thermal day** | the high's sun | easy | a deep mixed layer to 1900 m under a 3 K lid, `cu` 0.35 at its top, the best climbs of the fortnight | clear and mild; the marine air arrives at 02:00 |
| 12 | **Sea fog bank** | marine air | moderate | **fog on the sea and the seaplane bases until 12:00**, inland fine; the bank pulls back offshore at noon and returns at 20:00 | **the moon over a sea of fog** |
| 13 | **Golden evening** | settled | easy | gentle W 6 kt, calm from 18:00: **glass-calm water**, a gold sunset into a clean horizon | clear, moonlit; aurora Kp 4 |
| 14 | **Light southerly** | the high slides east | easy | S 8-9 kt, a mackerel sky of altocumulus pink at sunset | broken altocumulus with the moon, clearing to day 1 |

**The nights** (A0's point 2, "beautiful, full of light"): 9 of 14 clear or almost clear; 3 broken or high cloud with the
moon showing (5, 10, 14); 2 overcast, each with a showcase of its own (6: the lights on still water; 12:
the moon over the fog). **Five aurora nights**: 1 (Kp 3), 7 (Kp 5), 8 (Kp 6), 9 (Kp 4), 13 (Kp 4). No night is dark
and empty; the darkest is a moonless clear night, and that is the one with the most stars.

### 4.2 Flyability, measured

`--fly` classifies every daylight half-hour at sea level with a VFR pilot's reading of the hour. **easy**: wind ≤ 12 kt,
peak gust ≤ 20, a broken-or-worse base ≥ 600 m, visibility ≥ 8 km, no real rain. **care**: ≤ 20 kt, gusts ≤ 30, base
≥ 300 m, ≥ 3 km. Otherwise **no-fly**.

| # | Day | easy | care | no-fly | where it is not easy |
|---|---|---|---|---|---|
| 1 | fair-cumulus | 33 | 0 | 0 | |
| 2 | clear-high | 33 | 0 | 0 | |
| 3 | morning-fog | 21 | 3 | 9 | fog 05:00-09:00, lifting 09:30-10:30 |
| 4 | warm-hazy | 33 | 0 | 0 | |
| 5 | high-cloud | 33 | 0 | 0 | |
| 6 | overcast-calm | 30 | 3 | 0 | morning haze under the deck, 05:00-06:00 |
| 7 | the-storm | 7 | 8 | 18 | low cloud and the front, 08:30-17:00 |
| 8 | showers-sunshine | 24 | 9 | 0 | showers and gusts, 13:00-17:00 |
| 9 | crisp-clear | 33 | 0 | 0 | |
| 10 | ridge-day | 8 | 25 | 0 | the wind, 07:30-19:30 (by design) |
| 11 | thermal-day | 33 | 0 | 0 | (bumpy, not limiting) |
| 12 | sea-fog | 14 | 2 | 17 | the coast's fog to 11:30, again from 20:00 (inland strips stay open) |
| 13 | golden-evening | 33 | 0 | 0 | |
| 14 | light-southerly | 33 | 0 | 0 | |
| | **one loop** | **368 (80 %)** | **50 (11 %)** | **44 (10 %)** | |

"A vast majority of them good, pleasant weather to fly in": 10 of 14 days are easy all day, or after a coffee. Three are
gently challenging, each in a way that teaches something (gusts, a crosswind, fog you route around). One is a storm,
forecast three days ahead and announced twice. The classifier is the prototype's and is crude on purpose (sea level, no
crosswind component); the real one should be per strip (§5.6).

### 4.3 The data: one JSON per day

```json
{ "v": 1, "id": "the-storm", "name": "The storm",
  "story": "…", "fly": "storm", "noFly": [["08:30", "17:30"]], "forecast": "STORM WARNING, NO VFR 08:30-17:30. …",
  "temp": { "min": 3, "max": -2 },                  // °C against the date's normal low / high
  "tAdd": [[4, 0], [13.6, 0], [14.6, -3], [19, -2.5], [27, -1]],     // °C added (the front's drop)
  "dew":  [[4, 0.5], [12, 3], [15, 3], [20, -3], [27, -5]],          // °C against the normal low
  "qnh":  [[4, 1008], [13, 1001], [16, 1003], [22, 1009], [27, 1013]],
  "wind": [[4, 11, 135, 0.2], [9, 14, 135, 0.25], …, [27, 3, 290, 0.1]],   // [h, kt, FROM deg true, gust]
  "storm": { "at": 14.0, "pre": 1.5, "dur": 1.0, "post": 2.5, "windK": 1.6, "gustK": 1.6,
             "veerDeg": 0, "dTemp": 0, "dQnh": 0, "cover": 0.98, "type": "cb" },   // the transient only (§3.7)
  "rich": { "breeze": 0.0, "terrain": 1.0, "thermals": 0.0, "aloftK": 1.3, "veerDeg": 20 },
  "low":  [[4, 0.9, "sc"], …, [23, 0.03, "sc"]],    // [h, cover, type]
  "up":   [[4, 0.8, "as", 3500], …],                // [h, cover, type, base m]
  "rain": [[4, 0.0], [10, 0.1], [12, 0.45], [14.2, 0.95], [15.5, 0.5], [17, 0.2], [20, 0.0]],
  "fog":  { "where": "sea", "hold": [[4, 1], …] },  // only on the fog days
  "column": { "mixH": [[4, 50], [15, 1900], …], "inversion": { "dT": [[4, 0], [10, 3], …], "thick": 200 } },
  "turbidity": 2.2, "aurora": [[22, 4], [24, 5], [27, 4]] }
```

Hours are the weather day's, 4 → 28. **Size**: the fourteen files are 14 KB together (about 1 KB a day). In the game
they would be ONE data block inlined by `build.js`, like `city_packs.json` (`src/core/weather_days.json`, read by a
`09b_weather_plan.js`), and they sit in the core because the physics worker needs them as much as the page does. No
fetch, no lazy load. The full schema is Appendix B.

---

## 5. THE PLAN THAT LOOPS

### 5.1 The mapping: deterministic, by local date

```
planDay(localDate, localHour) = DAYS[ mod( jdn(weatherDate) − jdn(EPOCH), L ) ]
    weatherDate = localHour < 04:00 ? localDate − 1 : localDate        (the weather day owns 04:00 → 28:00)
    EPOCH = '2026-06-21'  (the career's first local day: plan day 1 = the game's own day)      L = 14
```

- **The same career day maps to the same weather**, for every career and in the sandbox's "plan" mode, so a screenshot,
  a bug report and a gate all agree. No per-career seed: a seed would buy variety nobody asked for, and lose
  "tomorrow is the storm" as a shared fact. (If one is wanted later, an epoch offset per career is one number.)
- **The career's first flight** (21 Jun, 16:00) is in plan day 1, the game's own day, so the tutorial flies in the sky
  the user chose on screenshots. The story's T1 is unaffected.

### 5.2 Meeting the real calendar

- **The sun and the moon follow the REAL date**: the clock's date is honest, GQ17 / §R.3 of GAME-2026-10-06 ("the moon's
  phase follows the calendar"). Only the WEATHER loops.
- **The 14-day loop is half a lunation** (29.53 / 14 = 2.11 loops a lunation). The same crafted night therefore
  alternates between a near-full and a near-new moon from loop to loop, drifting slowly (`--season`: the Kp-6 night
  falls on 99 % / 0 % / 99 % / 2 % / 95 % / 8 % …). Every aurora night is seen moonlit and moonless within a month.
  13 days would make it drift faster (0.44 of a lunation a loop), 15 slower; 14 is recommended for the "two weeks" a player can hold in mind.
- **The season shifts the plan's temperatures and nights**, not its story (§2: the normals; the night's arc).

### 5.3 The season and the winter layup (no snow)

The career's date must stay within **20 May → 30 September**. Proposed (decision Q1):

- the career's clock still only moves forward (`careerDaySet`, `74_career.js:228`). **A wait that would cross
  30 September at dusk lands instead on the next season's opening**, 20 May of the next year at dawn: the
  **winter layup**, told as a story beat (the club's hangar shut, a winter's work done, the field opening again). The
  instant still increases (`dayAbs` grows by ~8 months), so every forward-only rule holds;
- the career's normaliser refuses an instant outside the season (an old save after 30 Sep is lifted to the next
  opening);
- the moon stays honest through it (the layup lands on whatever phase 20 May has);
- the sandbox may set any date. Outside the season it plays the plan with the date's normals: cold, with no snow
  drawn. A sandbox player choosing December gets a cold green island, which is honest about the cut.

**At real time and with waits, how fast does a career move?** A flight is minutes of sim time, and a session is mostly
on the ground. The clock moves mainly by WAITS: to dawn, to the window, to the weather. A player who waits to dawn
each session moves a day a session, so the 133-day season is a long career. The layup is far away, but it must exist,
because nothing else stops November.

### 5.4 The forecast (shown, never set)

`weatherForecast(plan, fromAbs, hours)` → hourly rows (the derived numbers + the classifier) and the day's own words
(`name`, `story`, `forecast`, `noFly`). Three uses:

1. **today's card** in the garage TIME menu and the HUD's weather slot (F9): the day's name, the reading NOW, the
   no-fly window, and when the fog lifts;
2. **the outlook**: day N+1 and N+2 as names + one line ("Tomorrow: overcast calm. Thursday: STORM, no VFR 08:30-17:30").
   The storm is in the three-day outlook from day 4, and in day 5's and day 6's own forecasts;
3. **the radio**: `radio_talk.js` already reads the game's numbers and quantises them into words (sky, wind band,
   hazards, the trend), and looks 18 h ahead for a front (`FRONT_S`). Handing it the plan's forecast gives Norman
   "tomorrow" and "the day after" as well, with no new voice lines: the broadcast already has a weather slot (`@wx`).

### 5.5 Contracts and the night

- a job's NIGHT (§R.3, `73_contracts.js:256` `CONTRACT_NIGHT`) is drawn with the moon of that night and "overcast"
  at cover ≥ 0.75. Under a plan, that cover is **the plan's cover at the window's middle hour on that night** (F7),
  known in advance. The "moonless" premium is then a forecast fact, not a guess from the sky at the moment of the offer;
- a contract MAY name weather in its window later ("before the front", "when the fog lifts"). The time-of-day window
  machinery (`dayWaitUntil`, `careerWaitWindow`) already exists; a weather target is §6.2's `wait('weather')`.

### 5.6 The pilots and the autopilot

- **the hired pilot's refusal** (`76_pilots.js:44`, 18 kt) reads the plan's surface wind at the leg's departure and over
  its hours, not the page's wind now (`app.js:9153`). The storm day refuses on its own, and the line can say why from
  the forecast ("Ada won't fly before 17:30: the front");
- **`pilotCanFly`** adds the density factor 1/(σ·kT) on the landing roll from the plan's air at the strip's elevation
  and the arrival hour (§1.6);
- **the AP's route**: the wind AT the leg's altitude and hours, `CLIMATE.sample` on the planned day (pure, so a FUTURE
  hour's day can be built and sampled without touching the live one, as `07b_clock`'s `dayProbe` builds a scratch day)
  → a real ground speed per leg, the route's time, its fuel against the reserve, and a 1.6 that becomes a computed
  number;
- **the runway choice** (`43_pilot.js` into-wind scoring) is already live on the climate's wind. Nothing changes.

---

## 6. TIME RULES (A0's point 3: "proper time controls, including in the garage")

### 6.1 Career vs sandbox

| | CAREER | SANDBOX |
|---|---|---|
| the rate | **real time, always** (today: `day_clock.js:258`) | 0 · 1 · 10 · 60 · 600 (today) |
| the date / time of day | **never set**. Forward only, by waits | free, either way (today) |
| WAIT to a named hour (dawn, morning, noon, afternoon, golden, sunset, dusk, night) | **yes, on the ground** (today: `wait`, `waitGuard`) | (it sets) |
| WAIT to a clock time (HH:MM) | yes (today) | (it sets) |
| WAIT until the window opens | yes (today, `careerWaitWindow`) | — |
| **WAIT until the weather improves** (new) | yes: the first half-hour ahead when HOME (or the tracked contract's strips) classifies `easy`; shows its preview ("10:30: the fog lifts") | — |
| **WAIT until tomorrow's dawn** | yes (= `wait('dawn')`) | — |
| a wait's cap | ~36 h (today's `dayWaitUntil` horizon); the layup is the one longer jump | — |
| in-flight time | real time. **Proposed: no acceleration** (decision Q2). Later, "skip the cruise" on the AP's enroute legs: advance the clock by the leg's computed time and the fuel by its burn, under the forecast's winds, refused when the leg's weather is below the pilot's limit | free (today's rates) |
| the WEATHER | **follows the plan, shown, never set**. The weather card, the clouds panel, `?wind` / `?storm` / `?cloud` are hidden or inert | free: the presets, the panels, the URL; **plus "play the plan"** (pick plan day N, or follow the plan from the date) |
| the next full moon | only by waiting (today) | a jump (today) |
| the pref | the career's instant lives in the career document (today). **Its weather is the PLAN's** and is never written to the sandbox's pref (F8) | `flydiy.day.v3` (today) |

### 6.2 The new wait

`dayWaitUntil(day, 'weather', { at: strip ids, class: 'easy' })`: walk the forecast in half-hours from now. The first
slot at or after `now + DAY_WAIT_MIN_S` whose classification at every named strip meets the class. Null if none within
36 h, and then the menu says "no flyable weather before …". It is a pure function of (plan, instant) like the others
in `07b_clock.js`, and ONE `DAY_CLOCK.jump`.

### 6.3 What GAME-MENUS reads (the garage TIME icon; in career flight it replaces the free time/weather menu)

All pure, all from the core, all available in both modes:

```
DAY_CLOCK.label()                       '16:02 AKDT · sun 46° · day'            (today)
DAY_CLOCK.isCareer(), .canWait()        the mode and the ground guard            (today)
DAY_CLOCK.waitPreview(target)           { date, utc, waitS } for a target        (today; + 'weather')
DAY_CLOCK.wait(target)                  one jump, forward                         (today; + 'weather')
WEATHER_PLAN.today(day)                 { idx, id, name, story, fly, forecast, noFly[], now: { oatC, dewC, qnhHpa,
                                          windFromDeg, windKt, gustKt, cover, type, baseM, visKm, rain, kp, auroraVis,
                                          flyClass } }
WEATHER_PLAN.hourly(day, hours=24)      [{ localH, …the same fields }]        the strip under today's card
WEATHER_PLAN.outlook(day, n=3)          [{ date, name, fly, oneLine, storm: bool }]
WEATHER_PLAN.night(day)                 { dusk, dawn, moon: { illum, word, rise, set }, cover, kp, auroraWord }
WEATHER_PLAN.season(day)                { dayOfSeason, of: 133, layupIn: days, opening: date }
```

**The card**: the day's name in large type, the reading now, the hourly strip (temperature, wind arrow and speed,
cover), the no-fly window shaded, tonight (moon, aurora), the three-day outlook, and the WAIT buttons, each showing
its landing ("Dawn · 04:07 tomorrow", "Weather · 10:30 today: the fog lifts"). In the sandbox the same card gains the
free controls (the rate, the presets, "play the plan").

---

## 7. THE IMPLEMENTATION PLAN (later, not now)

| Step | Piece | Owner | Gates it needs | Size |
|---|---|---|---|---|
| **W0** | the findings, fixed whether or not a plan lands: F1 (`layers()` reads `cloudCoverEff` / `cloudTypeEff`), F2 (the storm's veer × I, so it fades with the intensity), F3 (dTemp eased over ~15 min), F5 (the mist's calm term), F7 (the contracts read the effective, later the planned, cover) | core (07_day, 08_cloud_field) + CLOUD | GATE DAY (a front's walk: no step > a bound; F2 / F3 as assertions), GATE CLOUD (a front's overcast reaches the decks), GATE CONTRACTS | small |
| **W1** | `09b_weather_plan.js` + `weather_days.json`: the evaluator (this prototype, hardened), `07_day` `recompute()` reading `spec.plan`, the plan's wind key in `world.dayTick`, `seaTau` | core | **GATE WEATHERPLAN** (new): schema; determinism (same abs → same spec, twice and in a fresh process); the minute walk over two loops with bounds per quantity (§3.9's table as the bar); no type-change dip in daylight; flyability ≥ 70 % easy and exactly the declared storm days with a forecast ≥ 2 days ahead; **ISA identity**: a world with no plan is bit-identical (GATE DAY's "same object" checks), and the bench worker's `makeWorld()` has no plan | medium |
| **W2** | the career: `career.day` + season + layup; the career reads the plan, never the pref (F8); the waits (`'weather'`); the HUD's reading (F9); the hired pilot's forecast; the night's planned cover | Game | GATE CLOCK (forward only; the layup forward; the waits), GATE CONTRACTS, GATE HONESTY (today it holds `GAME_WIND` equal to the breeze preset: in the career the day comes from plan day 1, so the identity moves there), the career save's normaliser (a v3 doc) | medium |
| **W2b** | the TIME menu (the garage icon; the career flight's replacement for the free menu) | GAME-MENUS | UISMOKE; the menu reads only §6.3 | medium |
| **W3** | the clouds' continuous cover (GPU threshold or a two-map cross-fade, F10) and a fog layer laid by `where` (F6) | CLOUD / NIGHT-LOOK | GATE CLOUD (a 0.25 → 0.45 ramp over an hour: no refit, coverage error bounded), FRAMECOST (no per-frame map upload) | medium |
| **W4** | the aurora (`day.aurora.kp` → the visibility law → NIGHT-LOOK's curtains), and the night showcase checks per crafted night | NIGHT-LOOK | GATE LIGHT (the aurora's writer × P under the pre-exposure), NIGHTVISIBILITY, `night_shots.js` stills on nights 6, 8, 12, 13 | medium |
| **W5** | the AP's planned winds (route time and fuel), `pilotCanFly`'s density factor, the radio's forecast | Pilot, SOUND | PILOT (calm-air numbers unchanged with no plan), a route-time check against a flown leg | small-medium |
| **W6** | rain: streaks, the windscreen, wet ground, `aeroweather`'s rain macro washing | a new visual chantier | its own; the plan's `rain` track already exists | large; LAST |
| **W7** | the acceptance leg's air: record OAT, QNH and DA on the signed record; correct or band (Q5) | Game + core | GATE ACCEPT | small |

**Order:** W0 → W1 → (W2 + W2b) → W3 → W4 → W5 → W7 → W6. W0 is valuable alone. W1 alone (behind `?plan=1`) lets
everyone see the days in the sandbox before the career depends on them.

**Risks, named:**
- **The certificate under non-standard air**: none by construction (§1.6), PROVIDED the bench worker's world never
  carries a plan. The flown acceptance leg is the one real exposure (W7).
- **The performance of a live atmosphere**: `airKey` moves when the temperature moves 0.001 K, so `makeAtmos` would
  rebuild about every 3 s at rate 1 and every frame at 600× (layered branch: a few layers, cheap, but measure it); quantise the
  key's temperature to 0.05 K. The climate's re-resolve on the wind key: measure (the relief raster is built once). The
  ATMO LUT re-bake on turbidity (`atmo.js:53`, keyed to 3 decimals): change turbidity only overnight and in 0.1 steps.
  The cloud map (F10): the biggest; W3 fixes it, and until then quantise.
- **The worker**: a pure plan in the core needs no messages; the spec carries `plan: { id, epoch }` and both sides
  evaluate it. CORE_MATH (`sin`, `cos`, `pow`) keeps them bit-identical.
- **The sea**: `seaTau` 900 or the sea is redrawn on every wind step (F11).
- **Gates that read the game's day**: GATE HONESTY (`GAME_WIND`), the pilot matrix's `breeze` weather, GATE DEFAULT
  (`_stock_pin.js`). None may get a plan by default: the sandbox stays on `GAME_DAY` unless the player picks "play the
  plan".
- **Save compatibility**: a v2 career (no season, its date maybe past 30 Sep) is lifted by the normaliser.

---

## 8. DECISIONS FOR THE USER

| # | Question | Recommendation |
|---|---|---|
| Q1 | **The season**: 20 May → 30 Sep with a winter layup to the next opening? | Yes. It is the only way to never need snow and keep an honest calendar |
| Q2 | **In-flight time acceleration** in the career? | No free acceleration. Later, "skip the cruise" on AP enroute legs, computed from the forecast |
| Q3 | **The career's first day**: keep 21 June (the white nights, the aurora faint until August), or open later (1 Aug: dark nights and full aurora from the start, shorter days)? | Keep 21 June. The luminous nights are beautiful in their own way, and the darkening through the season is a reward |
| Q4 | **The loop**: 14 days, the same for every career? | Yes (shared facts, reproducible; the moon varies it) |
| Q5 | **The flown acceptance leg on a non-standard day**: correct to the standard day, or band the criteria? | Record the air always; correct TAS / flow to the standard day with `05_atmos` (exact, explainable: "measured on a 21 °C day, corrected") |
| Q6 | **The altimeter**: keep it geometric (always correctly set), or a real QNH setting? | Keep it. The pressure swing is felt in the air, not the needle |
| Q7 | **The days themselves**: the 14 stories, their order, the one storm | Read §4.1. Every number in them is one JSON edit away |

---

## Appendix A: the fourteen days, hourly (first loop, `plan_proto.js`)

Columns: local time; temperature and dew point (°C); QNH (hPa); the wind (FROM °true / kt, `G` = peak gust when the
spread is ≥ 4 kt); the low deck's cover and type (+ the upper deck); the cloud base (m, the dew-point spread); the
surface visibility (km: the column, the mist and the rain as summed extinctions); the ground mist's density (/km) under
TODAY's law and the PLANNED one (§3.4); rain (0-1); density altitude at sea level (m) and σ; the sun's elevation; the
moon's illumination (% and `up`); Kp and the aurora's visibility (§3.8); the classifier (§4.2). The 02:00 row belongs
to the night that follows.

### 1. Fair-weather cumulus (fair-cumulus, 2026-06-21, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 10.3 | 5.9 | 1019 | 258/3 | 0.06 cuh | 555 | 31.3 | 0.04 / 0.04 | 0.00 | -229 | 1.022 | 5 | 46 | 2.0 | 0.00 | easy |
| 08:00 | 13.6 | 5.8 | 1019 | 251/5 | 0.10 cuh | 973 | 48.5 | 0.00 / 0.00 | 0.00 | -112 | 1.011 | 29 | 47 | 2.0 | 0.00 | easy |
| 11:00 | 16.0 | 5.6 | 1019 | 250/6 | 0.14 cuh | 1306 | 48.1 | 0.00 / 0.00 | 0.00 | -24 | 1.002 | 53 | 49 | 2.0 | 0.00 | easy |
| 14:00 | 17.2 | 5.5 | 1019 | 250/8 | 0.25 cuh | 1472 | 47.8 | 0.00 / 0.00 | 0.00 | 17 | 0.998 | 56 | 50up | 2.0 | 0.00 | easy |
| 17:00 | 16.9 | 5.5 | 1020 | 250/7 | 0.22 cuh | 1430 | 48.1 | 0.00 / 0.00 | 0.00 | 4 | 1.000 | 34 | 51up | 2.0 | 0.00 | easy |
| 20:00 | 15.2 | 5.6 | 1020 | 250/6 | 0.09 cuh | 1191 | 49.4 | 0.00 / 0.00 | 0.00 | -61 | 1.006 | 10 | 53up | 2.0 | 0.00 | easy |
| 23:00 | 11.8 | 5.8 | 1020 | 247/4 | 0.04 cuh | 747 | 51.6 | 0.00 / 0.00 | 0.00 | -185 | 1.018 | -8 | 54up | 2.5 | 0.01 | easy |
| 02:00 | 9.7 | 6.0 | 1020 | 240/3 | 0.01 cuh | 470 | 17.1 | 0.15 / 0.15 | 0.00 | -262 | 1.025 | -10 | 55 | 2.3 | 0.03 | easy |

### 2. Clear high (clear-high, 2026-06-22, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 9.5 | 5.0 | 1022 | 104/1 | 0.00 cuh | 568 | 39.8 | 0.03 / 0.03 | 0.00 | -291 | 1.028 | 5 | 56 | 2.0 | 0.00 | easy |
| 08:00 | 13.6 | 4.8 | 1022 | 193/2 | 0.01 cuh | 1095 | 60.9 | 0.00 / 0.00 | 0.00 | -141 | 1.014 | 29 | 58 | 1.8 | 0.00 | easy |
| 11:00 | 16.7 | 4.6 | 1022 | 210/3 | 0.03 cuh | 1510 | 63.5 | 0.00 / 0.00 | 0.00 | -29 | 1.003 | 53 | 59 | 1.6 | 0.00 | easy |
| 14:00 | 18.3 | 4.5 | 1022 | 248/6 | 0.04 cuh | 1718 | 65.0 | 0.00 / 0.00 | 0.00 | 24 | 0.998 | 56 | 60 | 1.4 | 0.00 | easy |
| 17:00 | 17.9 | 4.9 | 1023 | 250/6 | 0.03 cuh | 1621 | 64.5 | 0.00 / 0.00 | 0.00 | 8 | 0.999 | 34 | 61up | 1.2 | 0.00 | easy |
| 20:00 | 15.7 | 6.1 | 1023 | 250/4 | 0.00 cuh | 1191 | 61.6 | 0.00 / 0.00 | 0.00 | -74 | 1.007 | 10 | 63up | 1.1 | 0.00 | easy |
| 23:00 | 11.7 | 6.7 | 1023 | 253/2 | 0.00 cuh | 621 | 52.2 | 0.01 / 0.01 | 0.00 | -219 | 1.021 | -8 | 64up | 1.0 | 0.00 | easy |
| 02:00 | 9.4 | 8.3 | 1023 | 060/1 | 0.00 cuh | 131 | 2.4 | 1.49 / 1.49 | 0.00 | -306 | 1.030 | -10 | 65 | 1.0 | 0.00 | NO |

### 3. Morning fog on the sound (morning-fog, 2026-06-23, easy-after-wait)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 9.0 | 8.6 | 1022 | 180/0 | 0.00 cuh | 53 | 1.6 | 2.05 / 2.21 | 0.00 | -308 | 1.030 | 5 | 66 | 1.0 | 0.00 | NO |
| 08:00 | 12.9 | 8.5 | 1022 | 180/1 | 0.03 cuh | 551 | 1.9 | 0.04 / 2.00 | 0.00 | -164 | 1.016 | 29 | 67 | 1.0 | 0.00 | NO |
| 11:00 | 15.9 | 6.6 | 1022 | 218/4 | 0.05 cuh | 1163 | 42.9 | 0.00 / 0.00 | 0.00 | -54 | 1.005 | 53 | 68 | 1.0 | 0.00 | easy |
| 14:00 | 17.3 | 5.7 | 1021 | 232/6 | 0.10 cuh | 1448 | 41.8 | 0.00 / 0.00 | 0.00 | 2 | 1.000 | 56 | 70 | 1.0 | 0.00 | easy |
| 17:00 | 17.0 | 5.6 | 1021 | 240/7 | 0.09 cuh | 1417 | 41.0 | 0.00 / 0.00 | 0.00 | -7 | 1.001 | 34 | 71up | 1.0 | 0.00 | easy |
| 20:00 | 14.9 | 5.8 | 1020 | 240/3 | 0.04 cuh | 1135 | 38.2 | 0.00 / 0.00 | 0.00 | -79 | 1.008 | 10 | 72up | 1.0 | 0.00 | easy |
| 23:00 | 12.6 | 6.0 | 1020 | 235/3 | 0.00 cuh | 826 | 34.2 | 0.00 / 0.00 | 0.00 | -159 | 1.015 | -8 | 73up | 1.0 | 0.00 | easy |
| 02:00 | 11.9 | 6.1 | 1020 | 220/2 | 0.01 cu | 721 | 30.2 | 0.00 / 0.00 | 0.00 | -184 | 1.018 | -10 | 74 | 1.0 | 0.00 | easy |

### 4. Warm and hazy (warm-hazy, 2026-06-24, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 12.2 | 7.6 | 1020 | 144/2 | 0.04 cu | 577 | 21.7 | 0.03 / 0.03 | 0.00 | -169 | 1.016 | 5 | 75 | 0.0 | 0.00 | easy |
| 08:00 | 17.2 | 7.8 | 1020 | 183/2 | 0.07 cu | 1177 | 24.0 | 0.00 / 0.00 | 0.00 | 12 | 0.999 | 29 | 76 | 0.0 | 0.00 | easy |
| 11:00 | 21.0 | 8.0 | 1019 | 200/3 | 0.10 cu | 1625 | 22.2 | 0.00 / 0.00 | 0.00 | 151 | 0.986 | 52 | 77 | 0.0 | 0.00 | easy |
| 14:00 | 22.8 | 8.1 | 1019 | 223/6 | 0.25 cu | 1839 | 21.3 | 0.00 / 0.00 | 0.00 | 222 | 0.979 | 56 | 78 | 0.0 | 0.00 | easy |
| 17:00 | 22.4 | 8.1 | 1018 | 224/6 | 0.26 cu | 1783 | 21.5 | 0.00 / 0.00 | 0.00 | 212 | 0.980 | 34 | 79 | 0.0 | 0.00 | easy |
| 20:00 | 19.7 | 8.0 | 1018 | 220/5 | 0.15 cu | 1466 | 22.7 | 0.00 / 0.00 | 0.00 | 123 | 0.988 | 10 | 80up | 0.0 | 0.00 | easy |
| 23:00 | 15.0 | 7.8 | 1017 | 198/4 | 0.04 cu | 896 | 24.8 | 0.00 / 0.00 | 0.00 | -42 | 1.004 | -8 | 81up | 0.0 | 0.00 | easy |
| 02:00 | 12.2 | 7.7 | 1017 | 160/3 | 0.01 cuh | 563 | 20.9 | 0.04 / 0.04 | 0.00 | -141 | 1.014 | -10 | 82 | 0.0 | 0.00 | easy |

### 5. High cloud coming (high-cloud, 2026-06-25, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 11.6 | 7.7 | 1017 | 151/3 | 0.05 cuh+as 0.01 | 489 | 14.9 | 0.13 / 0.13 | 0.00 | -162 | 1.016 | 5 | 83 | 0.0 | 0.00 | easy |
| 08:00 | 15.0 | 7.8 | 1017 | 157/4 | 0.08 cuh+as 0.07 | 897 | 35.6 | 0.00 / 0.00 | 0.00 | -35 | 1.003 | 29 | 84 | 0.0 | 0.00 | easy |
| 11:00 | 17.6 | 8.0 | 1016 | 160/6 | 0.10 cuh+as 0.12 | 1199 | 39.3 | 0.00 / 0.00 | 0.00 | 66 | 0.994 | 52 | 85 | 0.0 | 0.00 | easy |
| 14:00 | 18.9 | 8.2 | 1015 | 156/7 | 0.11 cuh+as 0.29 | 1341 | 41.5 | 0.00 / 0.00 | 0.00 | 119 | 0.989 | 56 | 85 | 0.0 | 0.00 | easy |
| 17:00 | 18.6 | 8.3 | 1015 | 150/9 | 0.11 cuh+as 0.37 | 1290 | 41.9 | 0.00 / 0.00 | 0.00 | 115 | 0.989 | 34 | 86 | 0.0 | 0.00 | easy |
| 20:00 | 16.8 | 8.6 | 1014 | 144/8 | 0.06 cuh+as 0.54 | 1019 | 42.9 | 0.00 / 0.00 | 0.00 | 57 | 0.995 | 10 | 87up | 0.0 | 0.00 | easy |
| 23:00 | 14.3 | 9.0 | 1013 | 139/8 | 0.02 cuh+as 0.61 | 662 | 44.6 | 0.00 / 0.00 | 0.00 | -27 | 1.003 | -8 | 88up | 0.0 | 0.00 | easy |
| 02:00 | 13.1 | 9.2 | 1013 | 136/8 | 0.22 sc+as 0.69 | 491 | 34.0 | 0.14 / 0.03 | 0.00 | -65 | 1.006 | -10 | 89 | 0.0 | 0.00 | easy |

### 6. Overcast calm (overcast-calm, 2026-06-26, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 12.9 | 8.8 | 1013 | 140/6 | 0.58 sc+as 0.70 | 520 | 27.7 | 0.10 / 0.06 | 0.00 | -73 | 1.007 | 5 | 89 | 0.0 | 0.00 | care |
| 08:00 | 14.4 | 8.9 | 1013 | 140/5 | 0.82 sc+as 0.70 | 680 | 52.1 | 0.00 / 0.00 | 0.00 | -16 | 1.002 | 29 | 90 | 0.0 | 0.00 | easy |
| 11:00 | 15.5 | 9.1 | 1012 | 140/5 | 0.85 sc+as 0.71 | 800 | 54.2 | 0.00 / 0.00 | 0.00 | 31 | 0.997 | 52 | 91 | 0.0 | 0.00 | easy |
| 14:00 | 16.0 | 9.3 | 1011 | 144/6 | 0.87 sc+as 0.72 | 840 | 55.4 | 0.00 / 0.00 | 0.00 | 60 | 0.994 | 56 | 91 | 0.0 | 0.00 | easy |
| 17:00 | 15.9 | 9.4 | 1010 | 145/6 | 0.88 sc+as 0.73 | 820 | 55.8 | 0.00 / 0.00 | 0.00 | 65 | 0.994 | 34 | 92 | 0.0 | 0.00 | easy |
| 20:00 | 15.1 | 9.7 | 1009 | 141/7 | 0.88 sc+as 0.74 | 680 | 57.4 | 0.00 / 0.00 | 0.00 | 46 | 0.996 | 10 | 93up | 0.0 | 0.00 | easy |
| 23:00 | 14.0 | 10.0 | 1008 | 139/8 | 0.89 sc+as 0.75 | 500 | 44.4 | 0.14 / 0.02 | 0.00 | 14 | 0.999 | -8 | 93up | 0.0 | 0.00 | care |
| 02:00 | 13.5 | 10.3 | 1008 | 135/11 | 0.90 sc+as 0.75 | 400 | 56.5 | 0.33 / 0.00 | 0.00 | -1 | 1.000 | -10 | 94 | 0.0 | 0.00 | care |

### 7. The storm (the-storm, 2026-06-27, storm)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 13.4 | 10.9 | 1008 | 135/11 | 0.90 sc+as 0.80 | 320 | 46.4 | 0.61 / 0.00 | 0.01 | -1 | 1.000 | 5 | 94 | 0.1 | 0.00 | care |
| 08:00 | 14.4 | 12.1 | 1005 | 135/14 | 0.93 sc+as 0.85 | 300 | 22.6 | 0.67 / 0.00 | 0.07 | 64 | 0.994 | 29 | 95 | 0.7 | 0.00 | care |
| 11:00 | 15.2 | 13.2 | 1002 | 139/15G20 | 0.95 sc+as 0.90 | 240 | 9.1 | 0.85 / 0.00 | 0.28 | 125 | 0.988 | 52 | 95 | 1.5 | 0.00 | NO |
| 14:00 | 14.5 | 13.3 | 1002 | 184/21G35 | 0.98 cb+as 0.76 | 140 | 3.2 | 1.39 / 0.00 | 0.94 | 104 | 0.990 | 56 | 96 | 2.5 | 0.00 | NO |
| 17:00 | 12.8 | 11.2 | 1003 | 251/11 | 0.77 sc+as 0.50 | 200 | 11.4 | 0.89 / 0.00 | 0.20 | 20 | 0.998 | 34 | 96 | 3.3 | 0.00 | NO |
| 20:00 | 12.5 | 7.4 | 1007 | 276/9 | 0.26 sc+as 0.10 | 640 | 79.0 | 0.00 / 0.00 | 0.00 | -31 | 1.003 | 10 | 97 | 3.9 | 0.00 | easy |
| 23:00 | 10.0 | 6.6 | 1009 | 285/7 | 0.03 sc | 420 | 23.4 | 0.24 / 0.11 | 0.00 | -143 | 1.014 | -8 | 97up | 4.5 | 0.05 | easy |
| 02:00 | 7.9 | 5.5 | 1013 | 289/3 | 0.01 cu | 300 | 5.8 | 0.62 / 0.62 | 0.00 | -256 | 1.025 | -10 | 98up | 4.3 | 0.13 | care |

### 8. Showers and sunshine (showers-sunshine, 2026-06-28, moderate)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 8.3 | 3.9 | 1014 | 301/4 | 0.06 cu | 540 | 47.4 | 0.04 / 0.04 | 0.00 | -255 | 1.025 | 5 | 98 | 4.0 | 0.00 | easy |
| 08:00 | 11.7 | 3.9 | 1015 | 304/8 | 0.20 cu | 980 | 90.0 | 0.00 / 0.00 | 0.00 | -138 | 1.013 | 29 | 98 | 4.2 | 0.00 | easy |
| 11:00 | 14.3 | 3.9 | 1016 | 306/10 | 0.28 cu | 1300 | 92.4 | 0.00 / 0.00 | 0.00 | -55 | 1.005 | 52 | 99 | 4.4 | 0.00 | easy |
| 14:00 | 15.6 | 3.9 | 1017 | 310/13G17 | 0.45 cu | 1460 | 12.3 | 0.00 / 0.00 | 0.21 | -17 | 1.002 | 56 | 99 | 4.6 | 0.00 | care |
| 17:00 | 15.3 | 4.0 | 1017 | 310/11 | 0.37 cu | 1420 | 12.6 | 0.00 / 0.00 | 0.21 | -31 | 1.003 | 34 | 99 | 4.8 | 0.00 | care |
| 20:00 | 13.4 | 4.1 | 1018 | 309/8 | 0.15 cu | 1160 | 39.6 | 0.00 / 0.00 | 0.04 | -108 | 1.010 | 10 | 99 | 5.0 | 0.00 | easy |
| 23:00 | 10.1 | 4.3 | 1019 | 300/4 | 0.02 cu | 720 | 93.8 | 0.00 / 0.00 | 0.00 | -240 | 1.023 | -8 | 99up | 5.5 | 0.07 | easy |
| 02:00 | 8.2 | 4.4 | 1020 | 300/2 | 0.00 cuh | 460 | 20.3 | 0.15 / 0.15 | 0.00 | -320 | 1.031 | -10 | 100up | 5.0 | 0.17 | easy |

### 9. Crisp and clear (crisp-clear, 2026-06-29, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 7.9 | 3.4 | 1021 | 317/1 | 0.00 cuh | 556 | 51.6 | 0.03 / 0.03 | 0.00 | -341 | 1.033 | 5 | 100 | 3.0 | 0.00 | easy |
| 08:00 | 12.0 | 3.5 | 1021 | 304/2 | 0.03 cuh | 1062 | 93.8 | 0.00 / 0.00 | 0.00 | -192 | 1.019 | 29 | 100 | 3.0 | 0.00 | easy |
| 11:00 | 15.1 | 3.5 | 1021 | 300/3 | 0.05 cuh | 1451 | 93.8 | 0.00 / 0.00 | 0.00 | -81 | 1.008 | 52 | 100 | 3.0 | 0.00 | easy |
| 14:00 | 16.6 | 3.5 | 1022 | 291/6 | 0.12 cuh | 1642 | 93.8 | 0.00 / 0.00 | 0.00 | -30 | 1.003 | 56 | 100 | 3.0 | 0.00 | easy |
| 17:00 | 16.2 | 3.6 | 1022 | 287/5 | 0.10 cuh | 1581 | 93.0 | 0.00 / 0.00 | 0.00 | -47 | 1.005 | 34 | 100 | 3.0 | 0.00 | easy |
| 20:00 | 14.0 | 4.1 | 1023 | 280/4 | 0.02 cuh | 1249 | 89.7 | 0.00 / 0.00 | 0.00 | -130 | 1.013 | 10 | 100 | 3.0 | 0.00 | easy |
| 23:00 | 11.8 | 4.6 | 1023 | 284/2 | 0.03 cuh | 902 | 84.7 | 0.00 / 0.00 | 0.00 | -214 | 1.021 | -8 | 100up | 3.3 | 0.03 | easy |
| 02:00 | 11.2 | 5.0 | 1023 | 300/1 | 0.12 cuh | 781 | 79.3 | 0.00 / 0.00 | 0.00 | -238 | 1.023 | -10 | 100up | 3.5 | 0.09 | easy |

### 10. Ridge day (ridge-day, 2026-06-30, moderate)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 11.3 | 7.0 | 1018 | 255/9 | 0.16 cuh | 536 | 70.7 | 0.07 / 0.00 | 0.00 | -184 | 1.018 | 5 | 100 | 0.0 | 0.00 | easy |
| 08:00 | 14.0 | 7.0 | 1018 | 255/13 | 0.21 cuh | 877 | 69.8 | 0.00 / 0.00 | 0.00 | -83 | 1.008 | 29 | 99 | 0.0 | 0.00 | care |
| 11:00 | 16.1 | 7.0 | 1018 | 253/14G19 | 0.25 cuh | 1140 | 66.7 | 0.00 / 0.00 | 0.00 | -5 | 1.000 | 52 | 99 | 0.0 | 0.00 | care |
| 14:00 | 17.2 | 7.0 | 1018 | 250/17G22 | 0.28 cuh | 1268 | 65.2 | 0.00 / 0.00 | 0.00 | 34 | 0.997 | 56 | 99 | 0.0 | 0.00 | care |
| 17:00 | 16.9 | 7.1 | 1017 | 250/14G19 | 0.29 cuh | 1232 | 64.5 | 0.00 / 0.00 | 0.00 | 27 | 0.997 | 34 | 99 | 0.0 | 0.00 | care |
| 20:00 | 15.5 | 7.2 | 1017 | 248/11 | 0.25 cuh | 1027 | 61.6 | 0.00 / 0.00 | 0.00 | -24 | 1.002 | 10 | 99 | 0.0 | 0.00 | easy |
| 23:00 | 13.0 | 7.4 | 1017 | 245/9 | 0.33 cuh | 694 | 57.4 | 0.00 / 0.00 | 0.00 | -113 | 1.011 | -8 | 98up | 0.0 | 0.00 | easy |
| 02:00 | 11.6 | 7.6 | 1017 | 241/6 | 0.31 cuh | 503 | 28.6 | 0.11 / 0.06 | 0.00 | -163 | 1.016 | -10 | 98up | 0.0 | 0.00 | easy |

### 11. Thermal day (thermal-day, 2026-07-01, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 11.6 | 7.1 | 1018 | 201/2 | 0.01 cu | 562 | 31.6 | 0.04 / 0.04 | 0.00 | -174 | 1.017 | 5 | 98up | 0.0 | 0.00 | easy |
| 08:00 | 16.3 | 6.9 | 1018 | 208/4 | 0.07 cu | 1167 | 45.3 | 0.00 / 0.00 | 0.00 | -2 | 1.000 | 29 | 97 | 0.0 | 0.00 | easy |
| 11:00 | 19.9 | 6.7 | 1018 | 210/5 | 0.12 cu | 1644 | 42.9 | 0.00 / 0.00 | 0.00 | 129 | 0.988 | 52 | 97 | 0.0 | 0.00 | easy |
| 14:00 | 21.7 | 6.6 | 1018 | 201/7 | 0.35 cu | 1884 | 41.8 | 0.00 / 0.00 | 0.00 | 194 | 0.982 | 55 | 97 | 0.0 | 0.00 | easy |
| 17:00 | 21.3 | 7.0 | 1017 | 200/6 | 0.30 cu | 1782 | 41.6 | 0.00 / 0.00 | 0.00 | 181 | 0.983 | 34 | 96 | 0.0 | 0.00 | easy |
| 20:00 | 18.7 | 8.2 | 1017 | 200/4 | 0.08 cu | 1311 | 41.1 | 0.00 / 0.00 | 0.00 | 93 | 0.991 | 9 | 96 | 0.0 | 0.00 | easy |
| 23:00 | 14.5 | 8.8 | 1017 | 197/3 | 0.00 cu | 702 | 40.3 | 0.00 / 0.00 | 0.00 | -59 | 1.006 | -8 | 95 | 0.0 | 0.00 | easy |
| 02:00 | 12.0 | 10.4 | 1017 | 190/2 | 0.09 st | 202 | 3.1 | 1.10 / 1.10 | 0.00 | -146 | 1.014 | -10 | 95up | 0.0 | 0.00 | care |

### 12. Sea fog bank (sea-fog, 2026-07-02, moderate)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 11.4 | 11.4 | 1017 | 220/3 | 0.36 st | 0 | 1.2 | 2.50 / 2.50 | 0.00 | -170 | 1.016 | 5 | 94up | 0.0 | 0.00 | NO |
| 08:00 | 14.1 | 11.3 | 1017 | 223/4 | 0.39 st | 358 | 1.5 | 0.36 / 2.50 | 0.00 | -70 | 1.007 | 29 | 93 | 0.0 | 0.00 | NO |
| 11:00 | 16.2 | 10.4 | 1017 | 225/4 | 0.26 st | 725 | 1.8 | 0.00 / 2.11 | 0.00 | 4 | 1.000 | 52 | 93 | 0.0 | 0.00 | NO |
| 14:00 | 17.3 | 9.7 | 1017 | 230/7 | 0.11 st | 952 | 36.6 | 0.00 / 0.00 | 0.00 | 40 | 0.996 | 55 | 92 | 0.0 | 0.00 | easy |
| 17:00 | 17.0 | 9.5 | 1018 | 229/7 | 0.05 st | 943 | 36.9 | 0.00 / 0.00 | 0.00 | 29 | 0.997 | 34 | 92 | 0.0 | 0.00 | easy |
| 20:00 | 15.6 | 11.2 | 1018 | 225/5 | 0.22 st | 547 | 2.9 | 0.02 / 1.25 | 0.00 | -26 | 1.003 | 9 | 91 | 0.0 | 0.00 | NO |
| 23:00 | 12.7 | 11.4 | 1018 | 223/4 | 0.29 st | 162 | 1.5 | 1.32 / 2.50 | 0.00 | -132 | 1.013 | -8 | 90 | 0.0 | 0.00 | NO |
| 02:00 | 10.9 | 10.9 | 1018 | 220/3 | 0.39 st | 0 | 1.3 | 2.50 / 2.50 | 0.00 | -199 | 1.019 | -11 | 89up | 0.0 | 0.00 | NO |

### 13. Golden evening (golden-evening, 2026-07-03, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 10.5 | 6.2 | 1020 | 269/2 | 0.02 cuh | 543 | 28.4 | 0.06 / 0.06 | 0.00 | -232 | 1.022 | 4 | 89up | 0.1 | 0.00 | easy |
| 08:00 | 14.2 | 6.1 | 1020 | 262/3 | 0.06 cuh | 1010 | 53.6 | 0.00 / 0.00 | 0.00 | -101 | 1.010 | 28 | 88up | 0.5 | 0.00 | easy |
| 11:00 | 16.9 | 5.9 | 1020 | 260/4 | 0.10 cuh | 1382 | 57.6 | 0.00 / 0.00 | 0.00 | -2 | 1.000 | 52 | 87 | 1.1 | 0.00 | easy |
| 14:00 | 18.3 | 5.8 | 1020 | 256/6 | 0.11 cuh | 1571 | 59.8 | 0.00 / 0.00 | 0.00 | 46 | 0.996 | 55 | 86 | 1.9 | 0.00 | easy |
| 17:00 | 18.0 | 5.8 | 1021 | 253/3 | 0.10 cuh | 1521 | 59.8 | 0.00 / 0.00 | 0.00 | 32 | 0.997 | 34 | 85 | 2.5 | 0.00 | easy |
| 20:00 | 16.0 | 6.1 | 1021 | 250/1 | 0.01 cuh | 1238 | 58.9 | 0.00 / 0.00 | 0.00 | -40 | 1.004 | 9 | 84 | 2.9 | 0.00 | easy |
| 23:00 | 13.4 | 6.5 | 1021 | 229/0 | 0.01 cuh | 865 | 57.6 | 0.00 / 0.00 | 0.00 | -136 | 1.013 | -9 | 84 | 3.5 | 0.07 | easy |
| 02:00 | 12.2 | 6.8 | 1021 | 090/1 | 0.03 cuh | 684 | 56.0 | 0.00 / 0.00 | 0.00 | -181 | 1.017 | -11 | 83up | 3.3 | 0.10 | easy |

### 14. Light southerly (light-southerly, 2026-07-04, easy)

| local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05:00 | 12.0 | 7.8 | 1018 | 170/4 | 0.04 cuh+ac 0.00 | 531 | 27.1 | 0.08 / 0.07 | 0.00 | -157 | 1.015 | 4 | 82up | 2.9 | 0.00 | easy |
| 08:00 | 15.0 | 7.8 | 1018 | 174/6 | 0.08 cuh+ac 0.05 | 899 | 53.0 | 0.00 / 0.00 | 0.00 | -50 | 1.005 | 28 | 81up | 2.7 | 0.00 | easy |
| 11:00 | 17.3 | 7.8 | 1018 | 175/7 | 0.12 cuh+ac 0.10 | 1182 | 52.0 | 0.00 / 0.00 | 0.00 | 30 | 0.997 | 52 | 80 | 2.3 | 0.00 | easy |
| 14:00 | 18.4 | 7.8 | 1018 | 179/9 | 0.12 cuh+ac 0.25 | 1322 | 51.5 | 0.00 / 0.00 | 0.00 | 69 | 0.993 | 55 | 79 | 1.9 | 0.00 | easy |
| 17:00 | 18.1 | 7.8 | 1019 | 180/8 | 0.11 cuh+ac 0.41 | 1293 | 51.4 | 0.00 / 0.00 | 0.00 | 57 | 0.995 | 34 | 78 | 1.4 | 0.00 | easy |
| 20:00 | 16.5 | 7.6 | 1019 | 180/6 | 0.03 cuh+ac 0.47 | 1111 | 51.0 | 0.00 / 0.00 | 0.00 | -2 | 1.000 | 9 | 76 | 1.1 | 0.00 | easy |
| 23:00 | 13.5 | 7.5 | 1019 | 187/4 | 0.04 cuh+ac 0.46 | 750 | 50.5 | 0.00 / 0.00 | 0.00 | -114 | 1.011 | -9 | 75 | 1.0 | 0.00 | easy |
| 02:00 | 11.6 | 7.3 | 1019 | 200/3 | 0.05 cuh+ac 0.19 | 527 | 24.5 | 0.08 / 0.08 | 0.00 | -184 | 1.018 | -11 | 74up | 2.0 | 0.00 | easy |

---

## Appendix B: the day schema (v1)

| key | type | meaning | default when absent |
|---|---|---|---|
| `v`, `id`, `name` | 1, slug, words | | required |
| `story`, `forecast` | words | the card's paragraph; the forecast (spoken and shown) | required |
| `fly` | `easy` · `easy-after-wait` · `moderate` · `storm` | the authored class; GATE WEATHERPLAN checks it against the classifier | required |
| `noFly` | `[["HH:MM", "HH:MM"], …]` | the declared no-VFR windows (the card shades them; the pilots refuse inside) | none |
| `waitUntil` | `"HH:MM"` | the "wait" the story promises (the fog day) | none |
| `temp` | `{ min, max }` °C | anomalies against the date's normal low / high | 0, 0 |
| `tAdd` | track °C | added to the curve | zero |
| `dew` | track °C | against the normal low | −4 |
| `qnh` | track hPa | | 1013.25 |
| `wind` | `[[h, kt, fromDeg, gust], …]` | the synoptic surface wind (10 m), as a vector | required |
| `rich` | `{ breeze, terrain, thermals, aloftK, veerDeg }` numbers or tracks | the climate's terms (09_climate) | 0 (aloftK 1) |
| `storm` | 07_day's storm, `at`/`pre`/`dur`/`post` in hours | the front's TRANSIENT; `veerDeg`, `dTemp`, `dQnh` 0 under a plan (§3.7) | none |
| `low` | `[[h, cover, type], …]` | the low deck; its base derived | no cloud |
| `up` | `[[h, cover, type, baseM], …]` | one upper deck | none |
| `rain` | track 0-1 | 0.1 drizzle · 0.3 showers · 0.6 rain · 1 heavy (≈ 12 mm/h) | zero |
| `fog` | `{ where: 'sea' \| 'low', hold: track 0-1 }` | a declared advection / lingering fog (§3.4) | none |
| `column` | `{ mixH: track m, inversion: { dT: track K, thick: m } }` | the convective column (05_atmos K2); mixH sinks to 50 m on days that name none | 50 m, no lid |
| `turbidity` | number or track | the aerosol (sky + haze); change it overnight (§7 risks) | 2.8 |
| `aurora` | track Kp 0-9 | the night's geomagnetic activity | zero |

Hours are the weather day's, 4 → 28 (04:00 → 04:00 the next morning). Tracks are `[[hour, value], …]` with smoothstep
between keys, across the neighbouring days.

---

## Appendix C: the walk (`--smooth`), verbatim

```
T      max step per minute 0.0743 at 2026-07-11 14.1h the-storm
Td     max step per minute 0.1374 at 2026-07-17 3.5h sea-fog
qnh    max step per minute 0.1250 at 2026-06-30 3.5h crisp-clear
kts    max step per minute 0.1412 at 2026-06-27 15.9h the-storm
cover  max step per minute 0.0200 at 2026-07-03 3.3h sea-fog
base   max step per minute 20.0000 at 2026-06-26 4.8h overcast-calm
vis    max step per minute 2.4657 at 2026-06-23 10.9h morning-fog
kp     max step per minute 0.0750 at 2026-06-30 3.5h crisp-clear
rain   max step per minute 0.0087 at 2026-06-27 14.9h the-storm
mist   max step per minute 0.1244 at 2026-07-03 3.3h sea-fog
```
