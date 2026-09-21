# THE WATER SHADER — as built (H6, G460 … G460.8), and how it grows

The design's H6 (`WATER-2026-09-13.md` §3), built 2026-09-21 after the r186 migration. This
is the as-built record and the evolution map; the G entries in HANDOVER carry the day's
findings, `src/viewer/water.js`'s header carries the mechanism.

## 0. The rulings the build stands on (the user, 2026-09-21)

- **Ruling (aq) Gerstner-not-FFT stands**: the sea is a sum of trains in world data
  (`SEA.W`), the floats feel what the shader draws. The user first froze the two-train
  model pending the physics report; the report came the same day (waterH 0.9 → 4.1 µs a
  call at 32 trains, ~130 calls a frame — half a millisecond) and the sea became 32
  trains drawn from the spectrum (G460.3): two cosines are periodic by construction.
- **Interaction is a sampler input**: `WATER.setInteraction(tex, x0, z0, size)`. The field
  that writes it (a wake, a splash, a ripple) is H7.
- **Depth is analytic** off the coast and lake fields the ground carries; no depth buffer.
- The geometry is not distorted beyond what existed: the 360 m near patch was CPU-displaced
  already and is GPU-displaced now; the 400 km plane never moves; the `simple` tier lifts
  nothing.

## 1. What the research settled

Every credible system (Sea of Thieves, MSFS, Crest / UE Water, Triton, Proland, the 2026
three.js kits — Tidewater, clean-room-fft-ocean, Water Free) is one architecture: a wave
FIELD (GPU displacement + normal + foam from a JONSWAP spectrum through 2–4 FFT cascades)
and a surface SHADER (Fresnel, sky reflection, depth absorption, Jacobian crest foam, shore
foam). A lake, a river, a pool are the same shader retuned. The technique that matters for a
FLIGHT game is Bruneton 2010 / Proland: water is seen from 1 m to the horizon, and a wave
must be geometry at 1 m, a normal at 200 m and roughness at 2 km or it shimmers; the waves
finer than the pixel fold into a slope variance read off the screen-space footprint. That
is the spine of `water.js`, mapped onto three's own GGX + PMREM as a per-pixel roughness.
Sources: the plan of 2026-09-21 (`~/.claude/plans/…merry-deer.md`) lists them.

## 2. As built — three bands, one normal, one material, four bodies

`MeshPhysicalMaterial` (ior 1.333 = F0 0.02) + ONE module-level hook through ATMO's
accessor: probe, aerial perspective, mist, cloud shadow, near shadow, log depth all through
three's chunks.

| band | source | reaches | the physics feels it |
|---|---|---|---|
| 1 felt | `SEA.W` in GLSL (`uWTrA[32]`, `uWTrD[32]`, phases reduced mod 2π on the CPU): a swell band of 8 (0.78–1.28 L, ±18°, JONSWAP-shaped) + a wind sea of 24 (L/1.4–L/7, Hasselmann spread ±12°→±55°, equilibrium amplitudes), each band normalised to the old pair's variance; each train's slope fades where its own wavelength is under ~6 px | height (near patch), slope, fold (whitecaps) | yes — `waterH(x,z,t)`, parity held by GATE WATER |
| 2 detail | one baked tile (96 integer-wavenumber cosines, peaked k⁻³, ±75° spread) read at 3.2 m and 0.75 m, scrolled at each length's phase speed, strength the wind's | slope, crest mask | no |
| 3 sub-pixel | `wSigma2(footprint)`: Cox-Munk 0.003 + 0.00512 U10 × the unresolved fraction of the equilibrium tail | roughness = (2σ²)^¼ | no |

Colour: the column off the fields (sea: a 1:12 beach off the line capped by the island's
shelf, so the sand shows through a 40–60 m turquoise fringe; lake: 1.2 × its field to 8 m)
→ `sct (1 − e^(−2 abs d)) (1 − F)`; alpha = the shore's fade × the column's opacity.
**The body colour is not a Lambert surface** (G460.5): three would light it by dot(N, L)
on the wave normal — a painted relief; the material's diffuse is zeroed and the column
colour is added lit by the UP normal (each light's colour × saturate(up·L), the sky's
irradiance after the loop), so the waves live only in the reflection and the glitter.
The IBL normal is bent so the reflection never looks under the horizon. Foam: whitecaps
where the fold (in units of its RMS) exceeds the Gaussian quantile of Monahan's cover
(3.84e-6 U10^3.41 — 3 % at 7 m/s, 10 % at 10), a faint noisy wash over the last 14 m of the
shore, both on the water only. The ground keeps the beach's texture 60 m under the water
and paints the lake bed dark peat. Bodies by a vertex attribute
`aWater = (body, wavy)`: sea 0 / lake 1 / river 2 / premises 3, each a preset row in
uniforms — nothing per body in the GLSL, one program. Tiers `simple` / `full`; `?water=0`
the stock material; debug views 1–9.

Cost (tools/water_shot.js --perf / --ab, the queries round the water's own draws, 1080p,
the full tier): 0.38 ms at 12 m, 0.45 over the coast, 0.77 ms at 300 m straight down over
open sea — inside the 1.0 ms budget at every eye (G460.7: every wind-sea train fades out of
the slope between 12 and 3 px of its own wavelength and costs nothing once gone; σ² takes
over at 6 px). Samplers: 8 of 16 (uWSdf, uWDetail, uWInter, envMap, uApAtlas, dfgLUT, two
shadow maps).

The grazing eye (G460.7): the footprint is the geometric mean of the pixel's two axes on the
water (the longer one put the horizon at Cox-Munk's total); the rough IBL ray is lifted by
the lobe's half-angle so the cone never straddles the probe's ground cap; Bruneton's mean
Fresnel darkens the sky reflection toward grazing (a prefiltered lookup has no masking);
`nonPerturbedNormal` is the up normal (three adds its derivative to the roughness).

The clock: the solver publishes `sim.t` (it never had), app.js hands it to `WATER.setTime`
every step, the buoys and the patch read `WATER.time()` — ruling (ap) honoured for the
first time (render_world's own 1/60 accumulator drew the hull a frame away from the wave
that pushed it, pause or not).

## 2b. The interaction field (H7, G460.8) — wakes, ripples, splashes

The slot §2 opened (`setInteraction`) is written live now by a field inside water.js:
a world-locked heightfield of 256² half-float texels over 128 m (0.5 m a texel) following
the CG, stepped every frame by the wave equation with damping —
`h' = (2h − h_prev)·d + (c·dt/dx)²·lap(h)`, c = 1.6 m/s (a metre-and-a-half ripple's phase
speed; non-dispersive, so a hull faster than c leaves a V of half-angle asin(c/V) — narrower
than Kelvin's 19.5° at speed, and the foam trail along the track carries the wake's read
from altitude), d = 0.996 a frame (a ripple's e-fold 4 s), an absorbing rim over the last
12 texels (a box edge would ring). The box moves with the CG snapped to whole texels and the
step reads the previous state through the move's offset, so the water stands still in the
world while the box slides over it. The state is (h, h_prev, foam): a third channel of its
own, decaying 0.985 a frame. A DERIVE pass writes the slot's texture — RG the slope over
[−2, 2] (the shader adds it to the normal, the same encode the painted V used), B the foam
(added to the mask). Two 256² passes: ~0.1 ms.

**Stamps** (`WATER.stamp(x, z, r, amp, foam, kind)`, up to 16 a frame, folded into the step
— never a readback): a `press` pulls the surface toward a target height under a gaussian
(a wet hull's draft), a `ring` is a crater with a rim (a splash's first instant), a `foam`
stamp is foam alone. **A stamp displaces h and h_prev together** — the first build changed
h alone and the leapfrog read the change as a velocity: the crater deepened instead of
rebounding (the bench's readback found it).

**The emitters** (app.js `syncWaterFx`, the hydro's own numbers, never authored):
(1) the wet hull presses the surface under its keel (the centre of the step keel and the
stern, r = 0.9 beam, the depth −0.06 − 0.10 × the wet fraction; foam 0.35·min(1, V/10) when
moving) — the wake radiates from the moving depression; (2) TOUCHDOWN or a crash: a float
that goes wet this frame with a vertical speed above 0.4 m/s drops a ring (depth 0.3 m at
1 m/s, 1.2 at 4; r = beam × (1.2 + 0.4 vy)) with foam and a burst of the spray (25 droplets
per m/s, up to 120); (3) the planing chine's white water: a foam stamp wherever the spray
fires. The wake RIBBONS (G370's vertex strips) are retired — the field carries the wake.
The field runs while a floatplane's CG is within 60 m over water (the slot cleared
otherwise); a wheeled build has no hydro and the dev panel's `interaction field (H7)` row
forces it on under any aeroplane, with `a test splash under the CG`. The bench
(`tools/_water.html`) has the same slot option (`the live field`), a splash button, a hull's
run (a press moving at 8 m/s for 6 s) and a readback a second after the splash. The physics
does not feel the field: a ripple is not a wave the floats ride, and the near patch is not
displaced by it (a slope-only band, like the wind sea).

Proof: screenshots/water-g440/h7*/ (the ring from 30 m, the wake's V from 40 m and from
a low eye); GATE WATER §5 (the CFL, the damping, the displaced pair, the encode/decode
pair, the emitters in app.js, the ribbons gone).

## 3. What the pictures say (screenshots/water-g440/, by round)

- g9/g10/g11 (the last round): 7 m/s at 300 m — dark blue, wave groups, the sun's glitter,
  no relief; 4 m — the swell has volume through the reflection; the coast from 300 m —
  the beach under the water, a turquoise fringe, the deep is deep; 10 m/s — scattered
  whitecaps at every height; calm — glassy with the clouds' shadows; the lake dark and
  opaque with a peat rim.
- The seam across the sea at 1000 m (g5) was the cloud shadow tile's wrap line, not the
  water's (G460.4). The cyan cliffs on the far coast were the ground's seabed paint above
  the water (G460.2). The lattice in the ripples was the tile repeating (G460.2, hex
  stochastic tiling); the checkerboard / weave was the two-train model (G460.3).

## 4. How it grows (designed in, not built)

1. **The spectrum** — DONE as G460.3 (32 trains). What remains of it: fetch and depth
   (a lake's own short chop from its size; the wind sea limited by the water's depth),
   which `seaFrom` does not know yet — lakes stay glassy by their preset row.
2. **A live FFT for the detail band** (only if the open sea becomes the subject):
   1–2 cascades at 128²/256², ping-pong `WebGLRenderTarget`s (spectrum once, `h(k,t)` per
   frame, row/column butterflies, a normal pass; ≈ 0.1–0.4 ms) writing `uWDetail` and
   `uWDetailK.x`. `detailNormal(xz)` reads it unchanged. The physics does not feel it.
3. **H7 — the interaction field** — DONE as G460.8 (§2b). What remains of it: the
   analytic Kelvin V (19.47°) for the far trail beyond the 128 m box (the field's V is
   the non-dispersive asin(c/V)); a dispersive step (two speeds: the capillary ring and
   the gravity wake) if a low eye on a taxiing hull asks for it; the energy budget from
   the displaced volume (the press depth is a fit today, −0.06..−0.16 m); a lake's rim
   reflecting the ripples (the rim absorbs everywhere, a shore should reflect).
4. **A near-ring clipmap** with displacement, if the dock and float views ask for more
   than the 360 m patch; the shader is displacement-ready (band 1 in the vertex path).
5. **The depth buffer** as a refinement for hulls and docks (a waterline fade; a frame
   stale, as the clouds read it) — the fields stay the terrain's answer.
6. **Underwater** (§3.5 of the design): a tint and a fog when the eye goes under; the
   material is DoubleSide already.
7. **The sea floor as a beach**: the physics' shelf is −5 m at the line (28_island.js),
   so what shows through the shallows is a cliff's mesh with sand painted on it; a real
   beach profile in the terrain (and the hydro's depth) would let the shallows read from
   a low eye as they do from 300 m.
8. **The horizon at a low eye** — DONE as G460.7 (the footprint's mean, the lifted IBL
   ray, Bruneton's mean Fresnel). What remains is the sky's: the mist's density over water
   and the horizon sky's colour are the atmosphere's to judge.
