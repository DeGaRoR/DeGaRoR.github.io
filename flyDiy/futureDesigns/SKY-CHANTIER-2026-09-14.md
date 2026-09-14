# THE SKY CHANTIER — one day, one sun, one atmosphere

2026-09-14, on the user's ask: *"We really need a full day-night cycle by now,
and a top-class lighting and atmosphere generator… a fully functional,
configurable and flexible time-enabled sky with colors and everything. Clouds
later or as one. It's time."*

This is the EXECUTION plan for `SKY-ATMOSPHERE-2026-09-11.md` (the design; its
§4b amendment of the same day withdrew `@pmndrs/sky` and ruled the sky written
by hand in GLSL, port-cheap). This document takes the rulings that doc left
owed, records what the exploration found that the design did not know, and
cuts the work into sessions. Each session lands with its gate under its own
`## G` in HANDOVER; this file is updated at each landing.

---

## 0. RULINGS TAKEN (the user, 2026-09-14)

| ruling | decision |
|---|---|
| **(aj) the clock** | A REAL CLOCK that advances with play. Date + UT set by the player, at a rate the player sets (0 frozen · 1 · 10 · 60 · 600), ONE clock for the shed and the world (ROADMAP Phase 7 item 6). Frame-locked like the sim (1/60 a frame), never the wall clock: a screenshot, a fixture and a gate all see the same sun. |
| **(ai) latitude** | REAL. Every world declares `geo { lat, lon, tz, convergenceDeg }`. JOLENE = Annette Island: the origin at 55.04327 °N 131.57222 °W (rasterio, EPSG:3338 → 4326), AKST −9 with the US daylight rule. The analytic world stands at the same lat/lon with its −z as TRUE north. |
| **clouds** | The NEXT chantier. This one carries the data slot (dewpoint → cloud base, a cover fraction, a type) and re-lights and re-places the billboards that exist. |
| **the hangar** | ONE SKY. The shed sees the world's physical sky at the clock's hour; the six graded HDRI moods retire as a LIGHT SOURCE (the tools stay; the 6.3 MB of media leaves the boot path). |
| **the engine (S3)** | Hillaire 2020 BY HAND in GLSL on today's `WebGLRenderer`, port-cheap (SKY-ATMOSPHERE §4b, RENDERER-DECISION §4k). Not `@pmndrs/sky` (WebGPU-only; the TSL port counted at 27 hooks + 6 depth materials + the passes, 10–14 sessions), not `@takram/three-atmosphere` (EffectComposer + Lambertian post-lighting: it would replace the PBR pipeline). Hillaire is a transcription of an open MIT reference (~600 lines of GLSL in four fragment passes), numpy-mirrored for the gate the way `sky_grade.py` is. |

---

## 1. WHAT THE EXPLORATION FOUND THAT THE DESIGN DID NOT KNOW

1. **Grid north is not true north on the island.** `28_island.js`: x east, north −z, y up — but the frame is Alaska Albers (EPSG:3338, lon₀ −154, parallels 55/65). At Jolene the grid's north stands **19.32° EAST of true north** (measured with rasterio: a point 1 km grid-north of the origin bears 19.32° true; the conic formula n(λ−λ₀) gives 19.35). So `azGrid = azTrue − 19.32`, and the true-south noon sun stands 19.3° east of +z in grid terms. Without the term the noon sun lights from 19° off. The world's `geo.convergenceDeg` carries it; the analytic world declares 0.
2. **The rig's azimuth is not a compass.** `render_world.js rigApply`: `SUN = (sin az·cos el, sin el, cos az·cos el)` — azim 0 = +z = SOUTH. `rigAzim = 180 − azGrid`, wrapped to (−180, 180]. `day.rigAzim` publishes it so F8 agrees with the almanac.
3. **Three r186 facts, verified in `vendor/three.min.js`, that bind S3–S5:**
   - every built-in fragment shader ends `opaque_fragment → tonemapping_fragment → colorspace_fragment → fog_fragment`: **fog is applied AFTER tone mapping, in display space**. A linear-radiance aerial perspective cannot live in `fog_fragment`; it goes in at the head of `tonemapping_fragment` (guarded `#ifdef USE_FOG`) with `fog_fragment` emptied — still ONE splice in ONE place (§4k rule 3), installed globally so the Standard materials (the aeroplane, the water, the impostors) get it too, not only `worldLambert()`'s sites;
   - `ShaderLib.*.uniforms` are CLONED at module load — adding to `UniformsLib.fog` afterwards reaches nothing; scalars go through `THREE.ShaderLib[k].uniforms` per lib (a shared `Float32Array` survives `cloneUniforms` by reference), samplers through `onBeforeCompile` (`cloneUniforms` NULLS a render-target texture with a warning);
   - `scene.environmentIntensity` OVERRIDES `envMapIntensity` on every material without its own `envMap` — so `aeroSetEnv(WORLD_ENV = 0.5)`, `propSetEnv`, the hangar's `ENV0` loop and `CAGE_ENERGY.setEnv` have been **inert since W0.5a** (a pre-existing regression; Session D measures it and moves the number to `scene.environmentIntensity`).
4. **The rAF trap, again.** The Browser pane is hidden while a script drives it (canvas 0×0, `document.hidden`), so nothing renders and the clock does not tick; the instrument is headless Chrome + CDP (`tools/tree_perf.js`'s rig; the session's `sky_shots.js` boots `dev.html?day=<preset>`, rolls out, hides the UI, captures). The FIRST navigation of a fresh profile never rolls out (the chooser) — shoot a throw-away preset first.

---

## 2. THE ARCHITECTURE (one model, every consumer derived)

```
world.day  (src/core/07_day.js — pure; STATE like setWeather, never the wall clock)
  WHEN  date, utc, rate | WHERE geo{lat,lon,tz,convergenceDeg} | AIR oatC/dISA, qnhPa (== makeAtmos's fields)
  WATER dewC | rh (one fact, two spellings) | AEROSOL turbidity, ozone, groundAlbedo | CLOUD cover, type | WIND, SEA (exist)
  derived: sun / moon (06_solar.js: NOAA + Schlyter), sunEl / sunAz (true) / sunAzGrid / rigAzim, sunUp, illumClass,
           moonPhase, sunrise / noon / sunset, cloudBase = 125 (T − Td), an authored visibilityKm, local time, version
        │
        ├─ physics: world.atmos — THE SAME OBJECT unless an AIR field moved            ← GATE DAY §3
        ├─ render_world.js dayApply(): SUN (2° floor, every shadow pass) + SUN_SKY (true, the disc)   ← LANDED (A)
        ├─ ATMO (src/viewer/atmo.js): transmittance 256×64 + multi-scatter 32×32 in JS → DataTextures;
        │     sky-view 192×108 + aerial-perspective atlas 1024×32 as GPU passes; a JS mirror for the gate   ← B
        ├─ SKY_LIGHT.applyDay(day, atmo, room) THROUGH light_rig: the ONE DirectionalLight is the sun, or the
        │     moon below the horizon (hysteresis); colour = transmittance on the sun's path; hemisphere from the
        │     sky irradiance; exposure = light_rig.exposureFor(sunEl) as a BASE through GFX.setExposure     ← B
        ├─ the dome (world r=2 camera-parented, hangar r=600): sky-view + disc + moon + stars, tone-mapped
        │     WITH the scene (the raw-palette convention retires with the palette)                          ← B
        ├─ aerial perspective: the one splice; scene.fog a sentinel; the 5.2 km / 90 km walls go            ← C
        ├─ the probe: PMREM re-baked when the sun moved > 1.5° (double-buffered); the hangar's backdrop      ← D
        ├─ the clock on every rail, persistence, the pilot's night, the cockpit clock                        ← E
        └─ the night: lamps' emissives + a fixed pool of PointLights, nav/beacon by rule; mist + glare      ← F
```

---

## 3. THE SESSIONS

### A — S1 + S2: THE DAY and THE SUN — **LANDED 2026-09-14 (see HANDOVER)**
- `src/core/06_solar.js`: the NOAA sun (declination, equation of time, hour angle, NOAA's refraction, azimuth from north), rise/transit/set iterated at the event's own time, Schlyter's moon with topocentric parallax and the illuminated fraction, `toFrame(el, az, convergence)` → `[cos el sin A', sin el, −cos el cos A']`, `rigAzim`.
- `src/core/07_day.js`: `DAY.makeDay(spec, geo)` — `set()` (bumps `version`, returns whether an AIR field moved), `advance(dt)` (never bumps the version; rolls the date), `spec()` (sorted keys; round-trips), `utcFor(el, rising)` (bisection on the half-day), the US daylight rule, Magnus dewpoint ↔ rh. Default **2026-06-21 18:00 UT = 10:00 AKDT**.
- `20_world.js`: `GEO` beside `BOUNDS`; `day = DAY.makeDay(opts.day, GEO)`; `setDay(spec)` rebuilds `atmos` only on an air change; `setWeather` is the AIR + WIND subset, absent fields cleared — CONDITIONS and every gate unchanged. `28_island.js`: `ISLAND_GEO.jolene` (the header may override) on the island record.
- `render_world.js`: `SUN_SKY` beside `SUN`; `dayApply()` first thing in `worldUpdate` (writes both vectors, `rigCur.elev/azim`, an **INTERIM DIMMER** on sun / hemisphere / dome (`uDim`) / fog colour through the twilight with a warm key below 12°, the clouds at `day.cloudBase` by `day.cloudCover`); `rigApply` writes `SUN` only when `manual` (a row write re-arms the day); the shadow follow divides by `max(SUN.y, sin 2°)`.
- `src/viewer/day_clock.js`: `bind / tick / set / preset / rate / label / nearestPreset`; presets solved on the day's own almanac (dawn −6° rising, morning 25° rising, noon, golden 8° falling, sunset, dusk −6° falling, night = solar midnight; every fallback a real hour); pref `flydiy.day` {date, utc, rate}; `?day=YYYY-MM-DDTHH:MM[Z]` or `?day=<preset>`. `app.js`: bound after `makeWorld`, ticked 1/60 in `loop()` when running or in the garage.
- F8 (`dev_panel.js`): a `clock` fold — preset, local hour, date, rate, the sun's driver (the day / manual), a live almanac readout; the environment fold's sun sliders take the rig MANUAL.
- **GATE DAY** (`tools/test_day.js`, core): USNO rise / transit / set at four sites to the minute, noon altitude = 90 − |lat − dec|, the June lower culmination (−11.5°: never below nautical twilight at 55 °N), the moon's fraction on three days and at the four 2026 eclipses, `atmos` identity under visual-only changes, ISA restored by `setWeather(null)`, the cloud-base rule, Magnus round-trips, monotone visibility, the spec round-trip, the clock's determinism and date roll, the frame (analytic noon → +z, 06:00 → +x; island noon 19.32° east of +z; `rigAzim`), the twilight ladder, and a source assertion (no `Date`, no THREE, no DOM in core).
- The interim dimmer's retirement is Session B's first line of work.

### B — S3: THE ATMOSPHERE (LUTs, the dome, the key light) — **LANDED 2026-09-14 (see HANDOVER, SESSION B)**
As designed below, with three findings: the probe's ground cap must be lit by the day (a constant cap was 1000x a dusk sky), the stars are ~1e-5 in the sun's units (anything brighter glows in the probe), and the eye needs a 10 m floor over the ground sphere. The exposure schedule (light_rig EV_KNOTS) is authored and owed the user's eye. The interim fog takes the physical horizon until C.
`src/viewer/atmo.js` (after `light_rig.js` in the bundle): the Hillaire parameter table (R 6360/6460 km; Rayleigh (5.802, 13.558, 33.1)e-3/km, H 8 km; Mie 3.996e-3 + absorption 4.40e-3, H 1.2 km, g 0.8; ozone (0.650, 1.881, 0.085)e-3, tent 25 ± 15 km; `day.turbidity / ozone / groundAlbedo` scale them); transmittance and multi-scatter computed in JS into `DataTexture`s on `day.version`; sky-view and the AP atlas as fullscreen `ShaderMaterial`s of pure functions (the hangar's `gradeScene` idiom) into HalfFloat targets per frame; `ATMO.U` shared uniform objects (`uAtmo` vec4[K] in a `Float32Array`); `ATMO.cpu` the JS mirror (`transmittance`, `singleScatterSky`, `skyIrradiance`); `tools/atmo_lut.py` writes `tools/atmo_ref.json`. The dome: sky-view sample + limb-darkened disc × T + moon (phase) + hash stars masked by sky luminance, then `tonemapping_fragment` + `colorspace_fragment`; the `encode` flag and the palette uniforms retire; `skyMatTSL` stays under the flag. `src/viewer/sky_light.js applyDay(day, atmo, {key, hemi, scene, roomGain, roomYaw})` + `light_rig.exposureFor(sunEl)` (an authored EV curve), `SUN_LUX`, `MOON_RATIO ≈ 2.5e-6 · phase`. **Calibration:** the `alps` (2.8π @ 33.4°, ex 0.92) and `sunset` (2.75π @ 10.6°, ex 1.12) rows the user judged are reproduced as sun × exposure PRODUCTS within 5 %; the world/hangar unit gap (×π vs raw `keyI`) becomes `roomGain`. `WORLD_RIG` rows lose the sun/dome fields, gain `hemiBoost / exposureK / envK`; F8 gains an `atmosphere` fold; the GRAPHICS `lighting` row retires with `_gfx_check.js`. **GATE ATMO** (`tools/_atmo_check.js`, core): `ATMO.cpu` vs the JSON within 2 %; zenith/horizon ratio band at noon; sun-path R/B > 3 at 2°; night sky < 1e-4 of noon; everything finite; the calibration products; the census count (`tools/tsl_census.js --since`) in the entry. A GPU half (`tools/atmo_probe.js`, CDP): LUT texel readback, the disc pixel at the almanac direction, frame time at four hours (+2 ms over 27.9 / 19.9 / 10.2 allowed).

### C — S4: AERIAL PERSPECTIVE — **LANDED 2026-09-14 (see HANDOVER, SESSION C)**
As designed: install() at atmo.js eval, the splice at the head of `tonemapping_fragment`, the scalars on a shared Float32Array through ShaderLib, the sampler through the prototype hook + 17 explicit injects, the flag per room, the sentinel fog. The atlas is camera-independent (direction x distance) rather than Hillaire's screen-aligned froxels — a forward renderer with many cameras wants that.
`ATMO.install()` at eval: `fog_vertex` exports `vAtmoView = mvPosition.xyz`; `fog_pars_fragment` declares `uAtmo`, the samplers and `apSample(dir, dist)`; `fog_fragment = ''`; `tonemapping_fragment = '#ifdef USE_FOG' + AP + '#endif' + original` (fact 3); `THREE.ShaderLib[basic|lambert|phong|standard|physical|toon|matcap|points|sprite].uniforms.uAtmo = ATMO.U.atmo`; `THREE.Material.prototype.onBeforeCompile = sh => ATMO.inject(sh)` (idempotent, text-guarded on `USE_FOG`) and `ATMO.inject(sh)` as the first line of the 12 hooks that define their own (`render_world.js` ×7, `render_premises.js` ×2, `props.js`, `lot_tex.js`, `site_ground.js`, `trees.js`, `cabin.js`, `aeroskin.js` ×2). Glass → `fog:false`. `scene.fog` stays a `THREE.Fog` (it is what defines `USE_FOG`) with sentinel near/far; the island's 20–90 km rows and F8's fog rows retire; bake scenes stay fog-less; `hangarScene.fog = null`. Gate: the static inject check; every drawn material's `uApAtlas.value === ATMO.U.ap.value` (CDP); distance reads as distance and no wall at 90 km on `?world=jolene`; perf on the densest stand. Ruling R5 (the canopy shell vs the wall) is answered here.

### D — S5: THE DYNAMIC PROBE + ONE SKY IN THE HANGAR
Measure first: `pmrem.fromScene` time; the `scene.environmentIntensity` A/B (fact 3c). `ATMO.makeProbe` with one generator kept alive, threshold 1.5° (6 min at 1×, 6 s at 60×), new target → swap → dispose; `buildAlpsEnv / alpsEnv / envState` retire; `WORLD_ENV` applied as `scene.environmentIntensity`. Hangar: `skyMesh` takes the dome material (reset `scale.x = 1`, `rotation.y = 0` — the flip inverts winding), `aimKey` from `day.sun` rotated by the shed's world yaw, `setMood` keeps lamps/panel/card/shaft, MOODS become hour presets (GATE VIEW wants the row label `time of day`), `renderSky / gradeTextures / setSky / skyTexture` leave the boot path, `bakeHangarEnv`'s sky path takes the world probe, `hangar_sky.js` out of the bundle, `media/tex/sky/*` deleted in a separate reversible commit with `_media_check.js`; `flydiy.garageMood` mapped once to a preset. Gates: `test_world_render.js` ("baked once at boot; a 3° move re-bakes, 0.5° does not"), LIGHT (the dome declared on the hangar board), HANGAR / MEDIA / VIEW.

### E — THE CLOCK ON EVERY RAIL + PERSISTENCE
`body.html #selTime` → the preset select in `#flStore`; `FL_BUILD.slot_day` borrows it + an hour range + rate pills + a date row; the `air` flyout's `time of day` becomes a live readout; `flDay()` appends `DAY_CLOCK.label()`. Garage: `GARAGE_ENV`'s moods trio → presets, `_cage_ui.js` hour + rate rows, `editor.js` glyphs. WORLD editor: `premises_ui.js viewRows` sun sliders → readouts + preset / hour. CONDITIONS gain `dewC / rh` and an optional `day.preset`; cockpit `tClock` from `ctx.day`; `43_pilot.js` `setStatus.night` and `ap.lights {nav, beacon}` from sunset to sunrise, applied when not by hand; `pilot_trace.js --date/--utc`; the logbook row gains `day`.

### F — S6: THE NIGHT'S CONSUMERS (+ mist and glare if the budget allows)
`props.js propSetGlowOf(key, f)` on the lamp fixtures' emissives; `render_premises.js` a CONSTANT pool of 8 PointLights re-assigned every ~0.5 s to the nearest published lights (a count change recompiles every lit material), 0 by day, declared on the world board; moon and stars tuned against the lamps; a screenshot sheet at five hours on both worlds. Optional S7: a height-limited mist volume from `rh` and the cloud-base spread, bloom on the disc, an occlusion-gated flare (zero behind geometry — the gate). Closes DEBT-REGISTER "nothing switches on at night by itself".

---

## 4. GATES AND DOCS PER SESSION
Core tier: DAY (A), ATMO (B). Touched: WORLDRENDER, LIGHT, GFX, VIEW, HANGAR, MEDIA, UISMOKE; PILOTMATRIX unchanged by construction (the default day is fixed and the solver never reads it). HANDOVER one `## G` per landing; ROADMAP Phase 7 item 6 blockquote; `design_handoff_flight_interface/README.md` L276, PREMISES-EDITOR L110, PANEL's clock line, PILOT-ROADMAP P5, `WORLD-CONTRACT.md` §2 (the day is state, like setWeather). The census: `node tools/tsl_census.js --since <prev G>` in every entry that adds a shader.
