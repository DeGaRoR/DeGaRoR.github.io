# THE SKY — one day, one air, one light

2026-09-11, on the user's ask: *"managing the sun position, the colours of the
sky, maybe holistically manage temperature… we should absolutely avoid to have
one temperature model for visuals and one temperature model for just the
planes… definitely the mist… night and all the times of the day… the
distortion, the flaring of the sun and the proper management of this unique
light source."* Clouds deliberately deferred to their own session; the water
shader noted and not taken.

Measured on this tree unless marked INFERRED. No code changed.

---

## 0. THE STATE, MEASURED — the suspicion is correct, and worse

**The world sky is a three-colour painted gradient with a hardcoded sun.**
`src/viewer/render_world.js:9-10`:

```js
const HAZE = 0xe8bd8d, SUNC = 0xffd39a;
const SUN = new THREE.Vector3(0.80, 0.185, 0.57).normalize();
```

and the dome's whole fragment shader is `mix(haze, mid, smoothstep(h))`,
`mix(→top, smoothstep(h))`, plus three powers of `dot(d, sun)` for the disc and
its glow. The file's own first line says it: *"Golden hour: low sun aft-right,
warm haze, long shadows."* **The game has exactly one hour, and it is a
constant vector.** There is no solar model, no date, no latitude, no night.

Three consequences that are all one cause:

1. **`scene.fog = new THREE.Fog(C(HAZE), 600, 5200)`** — linear, one colour,
   no altitude term. This IS the 5.2 km wall that `WORLD-V2.md` §8.3 R3 was
   written to delete.
2. **The reflection probe is baked ONCE AT BOOT** (`render_world.js:133-156`,
   PMREM from a throwaway scene holding this same dome). It is a photograph of
   golden hour. **This is the answer to "the sunset through the windows really
   doesn't look that good"**: the glazing is a Physical material reading
   `scene.environment`, so it reflects a sky frozen at boot, and no change of
   hour can ever reach it.
3. The sky's palette is authored in DISPLAY space and hand-linearised for the
   bake (the `encode` flag and its long comment). That is a careful fix for a
   real bug, and it is also the signature of a painted sky rather than a
   radiometric one — there is no radiance to convert, only colours that were
   tuned by eye.

### And there are already TWO sky systems — the good one is indoors

`src/viewer/hangar_sky.js` is a GENERATED file: one 8K panorama
(`alps_field_8k.hdr`) graded into **six hours** by `tools/sky_grade.py`, each
row carrying a MEASURED sun position (`sunUV`, `yaw`), a measured key colour
and directionality (`keyI`, `kc`, `direct 0.803`), a hemisphere pair, an
exposure, and a block of grading uniforms including `glow`, `star` and
`starWarm`. The light rig is measured off each hour's own radiance.

So the hangar has a principled, measured, six-hour day. The world outside has a
constant. **This is precisely the disease `light_rig.js` was created to cure,
one level up.** That file's own header:

> *"Before this file there were THREE independent light rigs — the hangar, the
> studio and the world — and each decided its own units, its own exposure and
> its own ambient… the aeroplane was lit one way indoors and another way out,
> and the difference read as 'washed out' the moment it left the door."*

The LIGHTS were unified. The SKY was not. That is this chantier, and
`light_rig.js` is both the precedent and the proof the project knows how to do
it.

---

## 1. THE ARCHITECTURAL ANSWER TO THE TEMPERATURE QUESTION

The user's constraint — *never two temperature models* — is not only right, it
is **already solved, and the socket already exists and is already named.**

`src/core/20_world.js:426`:
```js
// setWeather({ oatC, qnhPa, wind: { base, gust } }) — everything a day is.
```
and `:439-440` builds `atmos = hasAir ? makeAtmos(spec) : ATMOS_ISA`, which the
solver reads at `30_solver.js:95` (`airOf()`). `makeAtmos` (`05_atmos.js:62`)
returns `T(h), p(h), rho(h), sigma(h), a(h), densityAlt, pressureAlt, oatC` —
a full ISA column with the day's own `dISA` and QNH.

**So the physics already has the air. The visuals have nothing. The rule is
therefore: EXTEND THE DAY, NEVER ADD A SECOND ONE.**

```
THE DAY  —  world.setWeather(...) / world.day
  WHEN      date, utcMinutes, latitude, longitude   -> sun + moon direction
  AIR       oatC, qnhPa            -> T,p,rho,sigma  [EXISTS — physics reads it]
  WATER     relHumidity / dewpoint -> haze, mist, cloud base
  AEROSOL   turbidity              -> the Mie term, i.e. what the haze LOOKS like
  WIND      base, gust                                [EXISTS]
```

Everything visual is DERIVED from that, never declared beside it:

- **The Rayleigh density profile IS `atmos.rho(h)`.** Molecular scattering
  scales with number density, which `05_atmos.js` already computes from the
  day's own lapse. One number, two consumers — the wing's lift and the sky's
  blue come from the same column.
- **Cloud base** `≈ 125 · (T − Td)` metres, the dewpoint-spread rule. The
  visible deck and the OAT the plaque prints become one fact.
- **Visibility / mist density** from relative humidity and aerosol.
- **Density altitude** is already computed and already on the plaque.

**One honesty note, so this is not oversold.** The Rayleigh coupling to `dISA`
is real but VISUALLY TINY — a hot day's sky is a few percent different, not
perceptibly. The couplings the player will actually SEE are humidity → haze and
mist, and dewpoint → cloud base. The unification is worth doing because it
makes the model coherent and prevents the two-model disease, not because a
+15 °C day will look different in the blue.

---

## 2. THE PRECEDENTS

### Unreal Engine — the dominant answer, and it is four wired-together parts

- **Sky Atmosphere** — Hillaire's 2020 technique (below). Exposes Rayleigh
  scattering and its scale height, Mie scattering/absorption/anisotropy, an
  **ozone absorption "tent"**, ground albedo and multi-scattering.
- **Directional Light** flagged *Atmosphere Sun Light* — the sun disc and its
  colour are the ATMOSPHERE's, not a painted sprite. The light's colour at
  sunset is the transmittance along its own path.
- **Sky Light in Real-Time Capture mode** — the probe re-captures as the sun
  moves. **This is exactly the fix for the window problem**, and it is the
  industry-standard answer rather than a clever one.
- **Exponential Height Fog + Volumetric Fog + Local Fog Volumes** — the mist
  layer, separate from the atmosphere.

**The lesson worth stealing: these are ONE system.** The sky, the key light,
the probe and the fog all read the same atmosphere. That is the opposite of
what this project has today, where the sky is a gradient, the key light is a
constant and the probe is a photograph.

### Microsoft Flight Simulator

Real weather (METAR plus model data) drives a **weather STATE** — temperature,
dewpoint, pressure, winds aloft, cloud layers, visibility — which is a DATA
layer, separate from the renderer that draws it. **That separation is already
this project's own law**: `WORLD-CONTRACT.md` §0, *"the world is a pure,
deterministic, seed-driven data API. Three consumers — physics, renderer,
gates — read it independently."* The day belongs in the contract, and MSFS is
independent confirmation of the shape.

### The literature, in the order it matters here

- **Hillaire 2020, "A Scalable and Production Ready Sky and Atmosphere
  Rendering Technique" (EGSR/CGF)** — the model Unreal ships. Four small LUTs:
  transmittance, multi-scattering, sky-view, and an **aerial-perspective
  froxel volume**. Real-time, altitude-correct, and the AP volume is what
  makes distance read as distance.
- **Bruneton & Neyret 2008**, and **Bruneton 2017** (the improved, open
  reference implementation) — precomputed multiple scattering; the rigorous
  ancestor.
- **Preetham 1999** and **Hošek–Wilkie 2012** — ANALYTIC skies, a closed-form
  fit rather than a simulation. Cheap and genuinely pretty. Relevant here only
  as the WebGL2 fallback option (§4).
- **Wilkie et al. 2021 (Prague sky model)** — ground-to-space including ozone,
  the most faithful; more than this project needs.
- **Ozone, specifically, since the user asked**: yes, it matters, and it is
  already in Hillaire's model as an absorption layer. Ozone is *the reason
  twilight is blue rather than grey-brown* — it absorbs in the Chappuis band
  along the long twilight path. It is the difference between a good blue hour
  and a muddy one, and it costs a parameter, not a chantier.

---

## 3. WHAT IS ON THE SHELF — and one lands almost exactly on our stack

**`@pmndrs/sky`** (MIT, v0.3.0, active) — *"Full WebGPU sky system based on the
Unreal Engine sky by Sébastien Hillaire."* It provides:

- Hillaire's full model, *"physically-based sky driven by real solar position,
  correct at any camera altitude from ground level to orbit"*;
- **real NOAA solar positioning from latitude, day of year and time of day** —
  which is the user's first ask, implemented;
- aerial perspective (AP-LUT or raymarch);
- a moon; LUT baking; a stylised-looks layer;
- **written in TSL** — the exact stack `RENDERER-DECISION-2026-09-07.md` §8.0
  committed to four days ago.

Stated out of scope: **volumetric clouds and god-rays** — which matches the
user's own instinct that clouds deserve their own session.

**The one real catch: it is WebGPU-ONLY, no WebGL2 fallback.** That collides
with §8.0's rule that *"if a feature cannot be expressed once for both
backends, it does not ship in the world layer."* §4 resolves it.

**`@takram/three-atmosphere`** — Bruneton precomputed, WebGL-capable. Rejected
as the primary for two measured reasons: its **reference frame is fixed to
ECEF and cannot be configured**, while this game's world is a flat local frame
at ±12 km; and its irradiance is Lambertian-only and *"approximated only for
small-scale scenes."* Keep as the fallback candidate if §4's route fails.

---

## 4. THE RULE THAT RESOLVES THE BACKEND COLLISION

**ONE MODEL, TWO RENDERERS OF IT — and the model is the fallback's input.**

§8.0's rule is about not maintaining two *material systems*. It is satisfied,
in spirit and better than by the letter, like this:

- **The DAY and the SUN (§1) are pure data.** No renderer at all. Both
  backends, every gate, headless node, the physics — all read the same object.
- **WebGPU: the real thing.** `@pmndrs/sky`'s LUTs, aerial perspective, the
  probe.
- **WebGL2: the existing painted dome, KEPT — but no longer painted.** Its
  three colours (`uTop`, `uMid`, `uHaze`) and `uSun` stop being constants and
  become **samples of the sky-view LUT**, baked offline into a small
  per-hour table by the same tool that runs the model. The gradient becomes a
  cheap *reconstruction* of the physical sky rather than an independent
  invention of it — exactly the relationship `hangar_sky.js` already has to
  `sky_grade.py`, which is a pattern this project has shipped once and liked.

That also means the fallback improves for free whenever the model is tuned, and
that a WebGL2 user gets the right sunset colours at the wrong fidelity rather
than a different sunset.

---

## 5. THE LAYERS, IN DEPENDENCY ORDER

1. **The sun and moon.** NOAA position from date, UTC time, latitude,
   longitude. **Ursoy is Admiralty Island, ~57.7 °N**, and that latitude is a
   gift: long shallow twilights, a low winter sun that rakes the terrain, and
   in June no true night at all (astronomical twilight right through). A
   flight sim set at 57° gets its best light for free — and the current
   hardcoded vector throws all of it away.
2. **The atmosphere.** Transmittance, multi-scatter, sky-view LUTs. Rayleigh
   driven by `atmos.rho(h)` (§1), Mie by the aerosol/water terms, ozone as its
   own absorption layer.
3. **The key light reads the LUT.** The directional light's colour and
   intensity are the transmittance along the sun's own path — so the sunset
   key is COMPUTED. This must go **through `light_rig.js`, never around it**:
   that file owns exposure and the light model, and an atmosphere that also
   contributes irradiance on its own is how the project acquires a fourth
   independent rig. The rig's CENSUS (its §4) must still come back complete.
4. **The probe becomes dynamic.** Re-bake the PMREM cube when the sun has
   moved more than a threshold (or one cube face per frame on a budget).
   **This is the window fix**, and it also repairs the aircraft skin and the
   water, which read the same probe.
5. **Aerial perspective replaces `scene.fog`.** Per-pixel in-scattering and
   transmittance from the AP volume. Deletes the 600–5200 m linear fog and
   the 5.2 km wall — **coordinate with `WORLD-V2.md` §8.3 R3**, since the
   canopy shell and aerial perspective are two halves of the same horizon and
   must land knowing about each other.
6. **Mist, as its own term — and the user is right that it is a blessing.**
   A height-limited ground/valley fog volume, separate from the atmosphere,
   driven by humidity and terrain (rivers, lakes, the hydrology stage already
   knows where the water is). It is beautiful, it is characteristic of
   Southeast Alaska, it is an honest view limiter that replaces a fog wall
   with a *reason*, and it is genuine flight pressure — marginal VFR, a strip
   that goes in and out. Of everything in this document it has the best ratio
   of atmosphere-per-hour.
7. **Night.** Moon, stars, and the dark end of the exposure curve.
   `hangar_sky.js` already carries `star` and `starWarm` uniforms, so the
   idiom exists indoors and can be lifted.
8. **The sun's disc, glare and flare.** The disc comes from the atmosphere
   (not a sprite). Bloom for the glare. A lens flare is a post-process and
   **must be gated on the sun being unoccluded** — depth-tested or an
   occlusion query — or it shines cheerfully through the wing, which is the
   classic failure and instantly reads as fake.
9. **Rain** — deferred, but note it is mostly a *material* problem (wet
   surfaces, a windscreen shader) plus a particle layer, and the day already
   has the humidity term it would key on.

---

## 6. STAGING — S1..S6

Numbered S to avoid collision with the W-series. **S1 depends on nothing and
does not need the renderer port** — it can land immediately, in parallel with
W0/W0.5.

| | size | content | gate |
|---|---|---|---|
| **S1 — THE DAY** | **S** | extend `setWeather` with when/where/water/aerosol; derive cloud base, visibility; publish `world.day`; save/round-trip | GATE SKY: the day round-trips; cloud base matches the dewpoint rule; `atmos` unchanged bit-for-bit when only visual terms move |
| **S2 — THE SUN** | **S–M** | NOAA solar position replaces the constant vector; the directional light follows it; the gradient stays but MOVES | GATE SKY: **sun azimuth/elevation against published almanac values** for known lat/long/date — checkable to arcminutes, headless, no renderer. The cheapest strong gate in the document |
| **S3 — THE ATMOSPHERE** | **L** | `@pmndrs/sky` in; LUTs; the key light sampled from transmittance through `light_rig`; the gradient re-derived as the WebGL2 fallback table (§4) | the rig's census still complete; fallback vs WebGPU colour delta bounded at N sampled hours |
| **S4 — AERIAL PERSPECTIVE** | **M** | replaces `scene.fog`; the 5.2 km wall goes | with `WORLD-V2` §8.3 R3 |
| **S5 — THE DYNAMIC PROBE** | **M** | re-bake on sun movement; **the window fix** | a sunset probe differs measurably from a noon probe; frame budget held |
| **S6 — MIST + GLARE** | **M** | ground/valley fog volume; bloom; occlusion-gated flare | flare is zero when the sun is behind geometry |

Deferred, each its own session: **clouds** (the user's own call, and
`@pmndrs/sky` excludes them anyway), **rain**, **the water shader**.

---

## 7. RULINGS OWED

- **(ac)** One day object, extending `setWeather`; every visual term DERIVED
  from it; no second temperature model anywhere. **Recommended** — this is the
  user's own constraint and the socket already exists.
- **(ad)** `@pmndrs/sky` (Hillaire, TSL, MIT) as the WebGPU atmosphere rather
  than writing one. **Recommended.**
- **(ae)** The painted dome is KEPT as the WebGL2 fallback but re-derived from
  the model's own LUT, never hand-tuned again (§4). **Recommended.**
- **(af)** The atmosphere feeds the key light THROUGH `light_rig.js`; the
  census must stay complete. **Recommended** — this is the rule that stops the
  project growing a fourth light rig.
- **(ag)** S1 and S2 land ahead of the renderer port, since they are pure data
  and pure direction. **Recommended.**
- **(ah)** Ozone in, as its own absorption layer — it is what makes the blue
  hour blue, and it is a parameter, not a chantier. **Recommended.**
- **(ai)** Latitude/longitude: is Ursoy at Admiralty's true 57.7 °N, or is the
  latitude a dial the player sets? The island is renamed and fictional, so
  this is a design choice with a real visual consequence. **Owed.**
- **(aj)** Does the day advance with play, on a clock the player sets, or is
  it chosen per flight? Affects S5's re-bake budget directly. **Owed.**
