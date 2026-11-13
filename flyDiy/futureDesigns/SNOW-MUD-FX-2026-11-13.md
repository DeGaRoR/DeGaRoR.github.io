# SNOW-MUD FX: the snow cloud and the mud's projection (13 Nov 2026)

The user (13 Nov): "design a professional looking particle system ... first a literature scouting to see how it's properly
done, then you will decide how to do it ... look at the existing dirt particles ... snow should certainly have some snow
clouds, particularly in the powder snow ... mud doesn't have a cloud, but it should have projection, maybe inspired by
what we have for the water ... less hard ... I let you judge."

Part 1 is the scout: a research agent's web search on 13 Nov. Most hosts blocked page fetches, so most claims rest on
the search engine's excerpts of the cited page. Labels: [SRC] the source states it; [EST] an inference. Part 2 is the
existing system. Part 3 is the decision. Part 4 is what was built.

## 1. THE SCOUT

### 1.1 How it is done in real time

- SIX-WAY LIGHTING is the current standard for smoke, dust and clouds. Light from six axes is baked into two RGBA maps and
  blended by the light's direction at run time [SRC] (Unity VFX Graph six-way lighting docs and blog;
  https://unity.com/blog/engine-platform/realistic-smoke-with-6-way-lighting-in-vfx-graph). "Smoke and fire are not
  surfaces, they are volumes": normal-mapped lighting looks wrong on them [SRC] (Mederic Chasse, Skull & Bones,
  https://realtimevfx.com/t/smoke-lighting-and-texture-re-usability-in-skull-bones/5339).
- Particles must be lit by the scene: unlit ones "looked too dark or too bright" [SRC] (DICE GDC 2011, Lighting you up in
  Battlefield 3). Frostbite's Battlefront II added a forward-scattering term for backlit particles [SRC].
- SOFT PARTICLES fade by the depth difference, along a contrast curve rather than a linear ramp [SRC] (NVIDIA 2007
  whitepaper). Spherical billboards remove the clipping and popping of quads [SRC] (Umenhoffer et al., GI 2006).
  Fade near the camera [SRC] (three.quarks near fade).
- OVERDRAW is the budget, on phones above all. Transparency is "excessively" costly on mobile, and HSR cannot cull blended
  fragments. Draw back to front with depth test on and depth write off, kill particles near the camera, keep particles
  small, avoid discard, and use geometry rather than alpha-bordered sprites for debris [SRC] (Unity mobile best
  practices; Imagination PowerVR; Android). Off-screen particles at 1/2-1/8 resolution suit low-frequency smoke, not
  high-frequency debris [SRC] (GPU Gems 3 ch. 23).
- STRETCHED BILLBOARDS are extruded along the view-space velocity, their length proportional to speed [SRC].
- WHAT LOOKS CHEAP (community consensus): an abrupt end (fade and shrink over life together; about 80 % of the life
  is follow-through), a single point emitter, a uniform fade instead of ALPHA EROSION, hard intersections, and large
  overlapping sprites [SRC] (realtimevfx.com dictionary; 80.lv production tips; Unreal community guide).
- MUD IN SHIPPED GAMES (the best documented case is Spintires / MudRunner, Saber, Game Developer 2017) [SRC]:
  - CPU-simulated mud of two kinds: camera-facing spray quads, and small "substance bits" that collide with water,
    terrain and wheels (about 14,000 on screen, spawned in chunks of 16);
  - each particle's start comes from the wheel's and the chassis' position, velocity, size and water depth;
  - landed bits WRITE MUD onto assets and leave terrain decals.
  - Unreal Niagara community setups drive mud from the tyre's radius, width and spin, the slip, the surface and its
    stickiness [SRC].
  - No breakdown was found for SnowRunner, Forza Horizon snow, RDR2 or BeamNG.

### 1.2 The physics

- SNOW LIFTS at a threshold friction velocity u*t of ~0.07-0.25 m/s for fresh, loose, dry snow, and much more for old,
  wind-hardened, dense or wet snow (~0.25-1 m/s) [SRC] (Pomeroy & Gray 1990). Li & Pomeroy 1997: the mean threshold
  10 m wind is 7.7 m/s for dry snow and 9.9 m/s for wet snow [SRC]. Water and the bonds it makes cut erosion: dry snow
  91 %, wetted snow 9 % in one Alpine study [SRC].
- GRAINS are 40-400 um (a 200 um mean in saltation). The saltation layer is <= 10-15 cm deep; suspension balances
  turbulence against settling [SRC]. Settling speed [EST, Stokes with a drag correction]: 50 um 0.07 m/s, 100 um
  0.25 m/s, 200 um 0.7 m/s, aggregates 0.5-1 m/s. A prop's wall jet (w' 1-3 m/s) holds the fines aloft, so the cloud
  LINGERS SECONDS TO TENS OF SECONDS and drifts.
- THE WALL JET: whiteout is brownout's snow twin (NASA rotorcraft brownout). Peak outwash runs up to ~2 V_h, decays as
  x^-1/2, and its half-height grows linearly [SRC]. Higher disc loading makes a bigger cloud [SRC]. No measured cloud
  heights were found. A Cub's static slipstream is ~29 m/s, which gives u* ~0.5-2 m/s a few metres aft [EST]: far over
  the powder threshold and near the packed one - a big cloud in powder, little on hardpack.
- MUD has scarce measured data [SRC] (SAE 2019-01-5068: no published droplet sizes; SAE 2025-01-8763: drop size goes
  with the tyre's spin). Particles inherit the tread's tangential velocity, and tread release is CENTRIFUGAL: a
  sticky clay sheds only at speed [SRC].
  - Release [EST]: v^2/R against an adhesion threshold of ~3-10 g.
  - AN AEROPLANE'S WHEELS ARE NOT DRIVEN [EST]: no wheelspin rooster tail. Mud comes from four places:
    - tread release off the rising tyre, up and forward in the ground frame;
    - a BOW WAVE and side splash where the tyre ploughs (0.2-0.5 x the ground speed);
    - a burst at the touchdown's spin-up skid;
    - the prop wash stripping wet mud into droplets.
  - Drag [EST]: a 1 cm clod's terminal speed is ~20 m/s, near ballistic; a 2 mm drop's 6-8 m/s.
  - Sizes [EST]: clods 5-30 mm, few, opaque; drops 1-5 mm, many, streaked; NO sub-mm cloud. Landed ones STICK and stay
    5-30 s.

### 1.3 The scout's top pitfalls

1. Uniform round puffs.
2. Flat, unlit white: snow reads as cotton.
3. Hard intersections.
4. Abrupt death.
5. Point emitters.
6. The wrong timing: snow falling like sand, mud floating like smoke, or misting like water.
7. No reaction to the wind, the speed or the surface.
8. Overdraw blowouts.
9. Mud with no aftermath.
10. Uniform colour: snow needs blue shadows and sparkle, mud a range from dry to wet and glossy. No additive mud.

## 2. WHAT EXISTS (src/viewer/dust.js, DIRT-DUST 9-11 Nov; src/viewer/spray.js, H7.1)

- dust.js already IS the industry answer for a cloud:
  - six-way lit volume sprites, baked in code;
  - Henyey-Greenstein forward scatter;
  - the cloud's own shadow;
  - curl-noise eddies;
  - soft on the ground and soft near the eye;
  - an OVERDRAW BUDGET in screens of cover per tier;
  - puffs that grow, thin, merge and settle;
  - physics-driven sources: wheel rolling V^1.5, the touchdown sink, the prop's round jet meeting the ground as a wall
    jet with Owen's u(u^2 - u_t^2) flux, the tip vortices.
- It has a ballistic GRIT pool for clods: kind 0 grit and kind 2 mud, motion-stretched.
- spray.js is the water's: stretched drops held at ~1 px (the speck law), heavy drops, a faint mist, lit as a scattering
  medium with a backlit lobe.
- Its gaps for snow and mud:
  - one luminance clamp (0.05-0.32, a soil's) would turn snow GREY;
  - one settling law for every class (dust lingers 30 s), so snow would hang like dust;
  - one phase g;
  - mud particles die where they land, leaving no aftermath;
  - mud's only sources are the dust's (a ring at touchdown, grit off the tread);
  - no ploughing bow wave.

## 3. THE DECISION

ONE system, the dust's, extended (one draw, its pools, its budget). No second module. The cloud machinery is already what
the literature recommends, and a second draw would be a second overdraw budget on the phone.

- PER-CLASS LAWS on the dust's class rows (absent = the dust's law, so dirt, sand, gravel, grass and paved are as they
  were):
  - `lum` [min, max]: snow's albedo range is 0.55-0.9, not a soil's;
  - `fall` [coarse share, tau coarse s, linger s]: snow falls out in seconds, its fines hang ~10 s;
  - `g`: the phase, 0.8 for ice crystals' strong forward scatter;
  - `blue`: the shadow's tint, snow's blue shadow;
  - `proj`: the projection law of a wet class (mud, slush).
- THREE SNOW CLASSES, as the ground has three:
  - `snow` packed: the threshold high (ut 8), fines few - mostly DRIFT streaks;
  - `powder`: ut 2 (u*t ~0.1-0.2), fines 1 - the big cloud, plus the plough;
  - `slush`: no cloud; grey-white wet clumps and drops, mud's projection in slush's colour.
- THE SNOW'S TWO LAYERS (the scout's recommendation 3a.3):
  - the SALTATION SKIN: a new grit kind, DRIFT (3). Short white streaks along the wall jet, within 15 cm of the ground,
    lit with a sparkle. Emitted wherever the jet passes the threshold - on packed snow too, where it is all there is.
  - the SUSPENDED CLOUD: the dust's puffs, in snow's laws.
- THE PLOUGH, for powder and slush: a wheel sinking z deep at speed V throws a bow wave of snow clumps forward and to the
  sides (a new grit kind, CLUMP (4), white, ballistic). Each breaks into a little cloud as it lands, in powder.
  - The sinkage is the physics' own: sim.out.softZ, the frame's deepest, read by app.js into each wheel's `sink`.
- MUD'S PROJECTION, the water's laws in mud's weight. Three particle kinds:
  - CLOD (2, the existing mud kind, now tumbling, lumpy-lit, with dry and wet variants);
  - DROP (5): spray's stretched speck, dark and glossy, with a glint;
  - SPLAT (6): a flat irregular blot lying on the ground, wet and glossy at first, drying duller, fading by ALPHA
    EROSION over 20 s - the aftermath. Its own ring pool, in the same batch.
- MUD'S FOUR SOURCES (the scout's 2.4):
  - TREAD RELEASE: the shedding rate goes with smooth(v^2/R over the adhesion threshold, 3-10 g); each clod leaves at
    an angle round the tyre, at the tread's ground-frame velocity (V(1 - cos phi), V sin phi);
  - the BOW WAVE: x sinkage x V, out to the sides and forward;
  - the TOUCHDOWN spin-up: a burst thrown AFT (the skid), not a ring;
  - the PROP WASH over wet mud: drops stripped aft where the jet is fast.
  - Landed clods and drops SPLAT; the splat pool is bounded per tier.
- COST: no new draw and no new program (the dust's, re-linked once at the roll-out). The pools grow by the splat ring
  (40 on the phone, 200 on gamer). On every class but the five, nothing changes.

## 4. AS BUILT (src/viewer/dust.js, app.js, tools/_dust.html; GATE SNOWMUDFX)

- CLASSES: the dust's five, then `mud` 5, `snow` 6 (packed), `powder` 7 and `slush` 8. app.js maps SURFACE 8-12 to snow,
  powder, slush, mud and mud. Under the pavement's `snow` and `mud` looks the SURFACE code decides (`DUST_BY_CODE`).
  Each wheel carries `sink` (sim.out.softZ, the frame's deepest sinkage).
- The laws as tuned on 13 Nov, gamer tier, GATE DUST's Cub kinematics, cloud as optical m^2:

  | class    | fines | ut  | fall [coarse, s, linger s] | g   | drift | the result (--show)                               |
  |----------|-------|-----|----------------------------|-----|-------|---------------------------------------------------|
  | dirt     | 1.0   | 4.0 | (dust: 0.35, 6, 30)        | 0.6 | -     | run-up peak 543, 31 % left 30 s after it          |
  | powder   | 0.45  | 2.0 | 0.55, 3, 12                | 0.8 | 3     | run-up peak 1281 (2.4 x dirt), 4 % left, drift streaks |
  | packed   | 0.10  | 8.0 | 0.6, 2.5, 8                | 0.8 | 2     | run-up peak 1 (no cloud), drift streaks only      |
  | mud      | 0     | -   | -                          | -   | -     | no cloud; clods + drops <= 1.5 m; splats          |
  | slush    | 0     | -   | -                          | -   | -     | as mud, grey-white, less sticky (adh 2.5 g)       |

- MUD'S PROJECTION (`projWheel`, `proj` on the class row):
  - Adhesion: mud `adh` 4 g, slush 2.5 g.
  - Rates per second: tread 9-10 x V x (0.4 + sink), bow 120-160 x sink, prop wash 6-9 x (u - 12..14 m/s).
  - Mix: clods 25-35 %, the rest drops.
  - The lift is held to `projUp` 5 m/s, a ~1.3 m rise.
  - Each wheel throws at most `projMax` 220 a second, scaled down on a tier whose pool is under 400.
  - Sizes: a CLOD is a 6-24 mm lump; a DROP is a CLUSTER of drops, 1.2-3.5 cm, the way games draw spray (the stills
    showed true 1-5 mm drops drawing under a pixel).
  - Landed clods splat at 0.5 x `splat`, drops at 0.15 x.
  - Splats: 5-18 cm, `splatLife` 22 s, wet gloss gone by 0.4 of it, eroded over the last half. The ring holds 40 (phone),
    60 (potato), 120 (retro) and 200 (gamer); a full ring of fresh splats takes no more.
- SNOW'S EXTRAS:
  - `rise`: packed 1.6, powder 2.4. The cloud grows up that much faster, may stand up to sqrt(rise) taller (capped at
    1.3 x the dust's cap) and is rounder.
  - `plough` (powder): 40 clumps a second x the sinkage x V/15, plus a puff topped up at the wheel's nose.
  - Drift: 6 x drift x the jet's flux, under 15 cm, 0.35-0.7 s, sparkling.
- THE DRAW:
  - Still one instanced batch and one program.
  - Splat: a ground-plane quad 3.5 cm over the contact; under a pixel it collapses.
  - Snow puffs: the phase g 0.8, the forward cap 2.6, a blue shade where the six-way light is low.
  - Thrown kinds:
    - drift is a white streak with a sparkle;
    - a clump is an irregular white lump with a blue shade;
    - a drop is the spray's glossy streaked speck;
    - a clod is a tumbling, torn, bump-lit lump with its own shade and a glint on the wet ones.
  - The dust's kinds and classes draw by their old lines.
- THE BENCH (tools/_dust.html): Mud, Packed snow, Powder and Wet snow surfaces, a snowfield ground, the sinkage per
  surface. `?scen=&cls=&cam=&sun=&t=&still=1` seeks a moment in 1/30 s steps (the stills' rig).
- WHAT THE STILLS TAUGHT (the dust bench in headless Chromium on SwiftShader, 13 Nov; the bench had been broken on master,
  missing matlib.js):
  1. A backlit powder cloud drew DARK SLATE. The inter-puff shadow had treated ice like soil. Now snow puffs take 0.3 of
     the shadow and a multiple-scattering FILL; backlit the cloud glows warm white.
  2. The run-up cloud hugged the ground. `rise` now makes it billow up into a cauliflower behind the aeroplane.
  3. Mud and slush were INVISIBLE at their true sizes. Now they use clusters and lumps.
  4. Long, thin, lit drop streaks read as a SPARKLER. A drop now smears at most 2.5 x its size, darker, with a small glint.
  5. Lit orange by a low sun, clods read as EMBERS. The soft classes' mud is now darker and duller.
  6. On the pavement, aerial mud's tyre fans spread everywhere and the wet film mirrored the sky pink. The strip is now
     plain dirt recoloured to wet clay (saturation 0.5), with the muddy ruts darker in the tracks and the film at 0.3.
  - The stills: the powder run-up seen from the strip end and from beside it (backlit); a mud take-off and taxi from the
    new Wheel camera, front-lit and backlit; a slush take-off; the snow and mud strips on the pavement bench.
- NOT DONE, NAMED:
  - no full-screen whiteout fog when the eye is inside a cloud (the near fade carries it);
  - no mud written onto the airframe from a roll on mud (aeroweather's BUSH macro is career wear, not physics);
  - no splat on the airframe;
  - no splat decal persisting past 22 s;
  - no per-wheel sinkage (the frame's deepest serves every wheel).

