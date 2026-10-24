# DMG-LOOKS: making a wreck look torn, not taken apart (study, 2026-10-25)

For the **Deform Coordinator** and **the user**. Written by DMG-LOOKS, a cloud desk study: no GPU, no render of the
game, and no change to `src/`. The prototypes under `futureDesigns/dmg-looks/` run in node and are explained in §6.
HANDOVER IDs G3620-G3629.

> **The user, 25 Oct 2026:** "Currently, the damage separates the parts OK, but ... The torn parts 'cut' too clean.
> That looks disassembled, not torn apart. Structure should get bent elements, panels should tear irregularly,
> according to their materials, rupture points should be irregular and probably have a different texture. Can we
> launch a study on how others are doing that, the state of the art for looks of ruptured panels and structure? And
> add the window damage texture to that?"

## 0. The answer in one page

**Why it looks cut.** Three things in our own code, none of them in the physics:

1. **The skin is deleted along a straight line.** At a break, `skin_break.js` removes every triangle whose corners
   sit on two pieces (`event()`, step 3). On a regular skin that leaves a slot one triangle wide (about 3-4 cm) that
   follows the break group's boundary exactly. The torn edge is left open and bare: DEFORM-AND-BREAK §5.1 says "a
   cut-edge cap is a later polish", and that polish was never done.
2. **Crushed tubes are drawn shorter instead of bent.** A drawn frame tube is bound to its member's two end nodes
   by its station along the member (the `tube` class, G1855). When the solver crushes or bends a member, the chord
   shortens, so the drawn tube telescopes: it stays straight and gets shorter. The solver already knows the bend
   (`b.dk`, `b.kt1` and the bend direction `b.dN*` in `30_solver.js`), but none of it reaches the page.
3. **Nothing changes colour at a rupture, and glass never cracks.** A broken edge wears the same paint as the middle
   of the panel. A crushed pane leaves the cabin whole, as a debris body (`wreck_debris.js`). The "windscreen
   cracked" switch in DEFORM-AND-BREAK §5.3 was never built.

**What others do.** The tools that look torn all add one of two things to a clean break:

- **Noise on the cut line, plus a separate material for the cut face.** Unreal Chaos has fracture Noise and an
  internal material ID. Houdini's Metal mode has Noise Height and Element Size. three-pinata has an inner-face
  material group.
- **Bending before breaking.** BeamNG uses `beamDeform` below `beamStrength`. Houdini Metal bends pieces that are
  still constrained.

The high end (BeamNG's thousands of beams, research on tearing thin shells) is out of reach in a browser. The cheap
end is exactly what we lack: a jagged line, a rim band, a bent member, a crack mask.

**What fits flyDiy.** We already have most of the machinery. Event-time fields per place (the fabric DRAPE), GPU
riding with free data slots (DMG-SKINGPU), a weathering block that already "exposes the substrate" under a chip, and
a glass hook that already works in pane metres. So the first phase is a re-use, not a new system:

| Phase | What the player sees | Where | New GL objects at a crash | Size |
|---|---|---|---|---|
| **P1a** member bends | crushed and bent tubes drawn kinked, at their real length | skin_break tube places + the riding shader; the solver's bend sent to the page | none | 1 session |
| **P1b** torn line | a jagged, material-specific tear (rivet lines unzip, fabric splits along the weave, laminate cracks, ply splinters), petals curled | skin_break `event()`: the triangle choice, rim jitter, a CURL field beside DRAPE | none | 1-2 sessions |
| **P1c** window cracks | crazing, impact stars, failed panes with missing shards, before a pane ever leaves | the glass hook (`aeroGlass`), one uniform block per pane | none (a material clone, same program) | 1 session |
| **P2** rupture rim | bare metal, primer, raw wood, frayed thread, exposed fibre along every torn edge; scrape and scorch | an edge-distance value per place, fed to the weathering's substrate path or to a rim overlay draw | one program, linked at roll-out like the ground scar | 2 sessions + an A0 ruling |
| **P3** bigger chantiers | flapping fabric strips; panes shattering into shards; dents on aluminium panels; sub-triangle erosion | worker ribbons, pre-fractured panes, a dent field | some | later |

The **impact-lag rule** governs all of this. DMG IMPACT LAG was closed on 21 Oct at the user's "moderate" bar. Its
lesson: any GL object or read-back made at a break is a main-thread stall. P1 therefore adds no GL objects. It
writes into data the break already uploads (the place textures), into uniforms, or into an index the event already
compacts. P2 needs one program, which must be linked at roll-out exactly as `ground_scar.js` does.

---

## 1. What the code does today (read, not guessed)

| Stage | File : function | What it does | Why it reads "disassembled" |
|---|---|---|---|
| Pieces | `30_solver.js` beamBreak, the D1b pieces | Members break at fittings and seams (D1a). A broken group lets go (G1894). | The physics is fine: members yield, kink (`ecu` 3 %), fold round trunks (`thf`: steel tube 1.2 rad, alloy 0.8, wood 0.12) and break by material (`60_gen_spec.js GEN_CRASH`). |
| Skin over a break | `skin_break.js` `event()` | Each vertex goes with the piece holding most of its weight. A triangle spanning two pieces is removed, its indices collapsed onto one vertex. | The removed set is the seam itself: a straight, regular slot. Removed triangles are never replaced by a cap. |
| The tear | `skin_break.js` `tear()` / `tearPlaces()` | A watched triangle stretched past 15 % (fabric, 2024-T3) or 5 % (composite shell) is torn for good. | It tears along triangle edges, so it is irregular only by luck. The GPU tear runs every 0.15 s (v2, approved). |
| The drape | `skin_break.js` (G1852) | A fabric panel over a broken member sags 6 % of the member's length, with wrinkles. A fixed field per place, made at the event; one multiply-add per frame. | Good, and it is the template for the curl field in P1b. |
| Tubes | `skin_break.js` `tubePieces()` / `inhClass` 'tube' | A tube place blends its member's two end nodes by station t. | A crushed member telescopes. The solver's `dk` / `kt1` / `dN` never reach the page (`sim_host.js simDmgHop` sends `ks` only, for the set colour). |
| Riding | `skin_gpu.js` RIDE_VS (transform feedback) | Place data lives in five float textures (8 node slots); nodes are 2 texels each per frame. Every material draws the ridden buffers unchanged. | No material or program changes by design. A look change must live in the riding or in the event. |
| Debris | `wreck_debris.js` | Cowls, wheels and panes leave as rigid bodies once crushed (6 cm) or torn off (25 cm). | A pane leaves whole and uncracked. |
| Ground | `ground_scar.js` (G2359) | A procedural soil decal on one parked mesh, linked at roll-out. | Precedent: "NO PROGRAM LINKS IN A CRASH". |
| Weathering | `aeroweather.js` | Layer `chip` ("chips and peel at the edges") exposes `AERO_WX_SUBSTRATE` per finish: alclad shows bare alloy (metal 0.9), steel tube shows red oxide, ply shows wood. | Nothing drives it from damage. It is the cheapest rupture texture we will ever get (P2). |
| Glass | `aeroskin.js aeroGlass` + `AERO_WX_GLASS_FS` | MeshPhysicalMaterial with one hook. Works in pane metres (`mm = vSurf.xy * uFieldM`) and knows the pane's extent (`uGlassE`). Opacity carries the slab (no transmission). | It has everything a crack mask needs (P1c). |

---

## 2. State of the art, by subject

**How the sources were checked.** The research sub-sessions could fetch only github.com pages in full. That covers
the three.js `ConvexObjectBreaker` source, the `webgl_decals` example and the three-pinata README. Every other URL
was confirmed through web-search results: its title and snippet, not a page read. Claims marked *(unverified)* had
no primary source. *(inference)* marks our own reasoning. Before anything here becomes a gate number, a session
with wider network access should click the links through.

### 2.1 Torn sheet metal (the Cessnas' 2024-T3, cowls, the metal fleet)

**How real sheet fails:**

- A thin ductile sheet pushed through by a point tears into **petals**: radial cracks, then plastic bending of the
  flaps. Four petals is the force-minimising number for ductile sheet, and plastic bending of the petals is a large
  share of the force. https://arxiv.org/pdf/1108.3534
- Studies on thin plates describe three stages: dishing, central cracking, then petals forming and curling. The curl
  can cause secondary tearing at the petal roots.
  https://pure.bit.edu.cn/en/publications/mechanism-research-of-thin-plate-petaling-under-local-loading-bas/
- Aluminium petals at low impact speed, and necks with an enlarged hole at high speed.
  https://sam.ensam.eu/bitstream/10985/9630/3/DUMAS_IJIE_VIOT_2015.pdf
- Riveted skin fails along **rivet rows**: cracks start at several holes, link up, and the lead crack then runs fast
  along the row. In one NASA full-scale test it crossed 12 holes and ran into the next bay.
  https://ntrs.nasa.gov/api/citations/19950008506/downloads/19950008506.pdf ,
  https://core.ac.uk/works/24833474
- That is fatigue, not a crash. Extending link-up to a crash tear (the tear runs along a rivet line, then jumps
  across the sheet to the next one) is *(inference)*, but a reasonable one: a rivet row is the sheet's weakest line.

**How games and tools do it:**

| Who | Technique | Runtime cost | Build cost | Payoff | Source |
|---|---|---|---|---|---|
| BeamNG.drive | Flexbody vertices ride 3-4 nodes. Mesh breaking deletes polygons over a broken beam. Panels rip where the beams broke, not at a mesh seam. | very high CPU (thousands of beams) | very high (a hand-built node/beam skeleton per vehicle) | the best | https://documentation.beamng.com/modding/vehicle/sections/flexbodies/ , https://documentation.beamng.com/modding/vehicle/sections/beams/ |
| Rigs of Rods | Coarse node grid per panel; unbreakable low-threshold "deformer" beams keep dents | high CPU | high | good | https://docs.rigsofrods.org/vehicle-creation/flexbody-deforming-detaching-parts/ |
| Houdini RBD Material Fracture, **Metal** mode | Sheet as a shell, Voronoi-fractured, extruded. **Noise Height** makes torn edges (0 = straight). Still-constrained pieces are *bent* by RBD Deform Pieces; broken constraints tear. | offline; rigid pieces at runtime | medium-high (bake pipeline) | high, bend and tear together | https://www.sidefx.com/docs/houdini/destruction/metal.html , https://sidefx.com/docs/houdini/destruction/plasticity.html |
| Unreal Chaos | Geometry Collections (Voronoi, cluster, radial, planar, brick). **Noise** amplitude / frequency / octaves on cut faces (0 = clean); **InternalMaterialID** for new faces | rigid pieces | medium | high on edges | https://dev.epicgames.com/documentation/en-us/unreal-engine/fracturing-geometry-collections-user-guide , https://docs.unrealengine.com/4.26/API/Plugins/FractureEditor/UFractureCommonSettings/index.html |
| NVIDIA Blast | Offline chunk hierarchy and runtime bond graph: our "predefined seams", with nested sub-chunks | low | medium | medium | https://docs.nvidia.com/gameworks/content/gameworkslibrary/blast/1.1/api_docs/files/pagedefinitions.html |
| IL-2 Great Battles | Three pre-authored damage states per part (holes S/M/L). Material-aware "Dynamic Visual Damage" hit marks since 2021 | negligible | high (states per part) | good at a distance, discrete | https://il2sturmovik.com/news/530/dev-blog-243/ , https://il2sturmovik.com/news/616/dev-blog-275/ |
| DCS World | Damage zones in the Lua `Damage` table drive mesh visibility through EDM animation arguments | negligible | high | discrete | forum only *(unverified)*: https://forum.dcs.world/topic/145654-detecting-damage-in-aircraft-mod/ |
| GTA V | Vehicle vertex colours carry deformation, AO and burn. The runtime dent method is undocumented. | low | low | medium | https://docs.sollumz.org/2.8/documentation/fragments.yft/vehicle-shaders (runtime *(unverified)*) |
| Research (Pfaff et al. 2014; O'Brien & Hodgins 1999/2002; Busaryev 2013; DMM) | Adaptive remeshing at crack tips, plasticity then tear; FEM fracture | very high | very high | the best | https://escholarship.org/content/qt1mc8b47z/qt1mc8b47z.pdf , https://ri.cmu.edu/publications/graphical-modeling-and-animation-of-ductile-fracture , https://escholarship.org/uc/item/2kj9p4bw |

**Takeaway.** What reads as "torn" at game distance is an irregular line, curled edges, and a different colour at
the rim. None of the three needs a real tearing simulation.

### 2.2 Torn fabric and doped skins (the Cubs, the ultralights)

- **What the real thing does.**
  - Polyester or cotton covering is shrunk drum-tight and doped. AC 43.13-1B treats tear resistance as a design
    property of the fabric (ASTM D 1424). https://corpora.tika.apache.org/base/docs/govdocs1/023/023511.pdf
  - The covering is held to ribs by rib-stitching and tapes. CASA's bulletin covers the system:
    https://www.casa.gov.au/index.php/aircraft/airworthiness/airworthiness-bulletins/aircraft-fabric-coverings
  - A sim-forum observation is that fabric "will rip away until [it reaches] the next attachment point" (rib
    stitching or tape) *(informal)*:
    https://sim-outhouse.org/sohforums/threads/art-of-damage-comments-please.38541/latest
  - DMG-FABRIC's own physics already tears the covering bay by bay (G2040).
- **What woven cloth does when it tears.** The tear runs along warp or weft threads, and the edges fray. Metaaphanon
  et al. simulate yarns only near the tear and get fraying along the line. https://web.media.mit.edu/~bandy/cloth/PG09cloth.pdf
- **How tools do it.**
  - Houdini Vellum tears only along pre-cut edges, welded with breakable constraints. The cut pattern is what
    decides whether it reads as torn or sliced. https://www.sidefx.com/docs/houdini/vellum/breaking_tearing.html
  - Games use alpha-tested frayed edges *(general practice; no shipped flight sim found documenting flapping torn
    fabric)*.
  - IL-2 Flying Circus: no official description of torn fabric was found *(unverified)*.
- **What it means for us.**
  - A fabric tear should run straight along the weave, in long runs with right-angle steps, and stop at ribs and
    tapes.
  - It should spring open (tension), show a frayed rim and a few loose threads, and show the steel tube behind it.
  - Our drape already makes the slack panel.

### 2.3 Bent and buckled structure (tubes, spars, stringers, longerons)

- **What the real thing does.**
  - A thin-walled tube in bending collapses at a **plastic hinge**: a short zone of large plastic strain, governed
    by local buckling on the compression side. It keeps carrying load while it folds.
    https://investigacion.pucp.edu.pe/grupos/appliedmechanics/publicacion/on-the-collapse-mechanics-of-steel-rectangular-tubes-in-cantilever-bending/
  - Under oblique crash loads, Euler-type buckling dominates.
    https://scholarworks.indianapolis.iu.edu/items/27635f80-6f3b-48c1-8b7e-942a28c9533f/full
  - DEFORM-AND-BREAK §7.1 #5 already has the Piper case: "steel tube bends without breaking; the fabric wraps the
    bent frame like a deflated balloon".
- **How games do it.**
  - BeamNG and Rigs of Rods give each beam a plastic threshold below its break threshold, so a tube bends a lot
    before it fails: https://documentation.beamng.com/modding/vehicle/sections/beams/
  - Houdini's constraint plasticity bends the mesh between pieces that are still joined:
    https://sidefx.com/docs/houdini/destruction/plasticity.html
  - Cyberpunk 2077 swaps in a pre-authored damaged end state:
    https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-creators-theory/3d-modelling/morphtargets
  - Bone chains with a plastic offset are standard skinning practice, not a documented game technique *(inference)*.
- **What it means for us.**
  - The physics half is done: TREE-CRASH's return mapping, the 3 % kink, `dk` round a trunk, the fold angle `thf`
    per material.
  - The look half is missing. The drawn tube must keep its length and fold at the hinge (§6.2).
  - A tube that broke should keep the bend it had. Its stub ends bent and torn, not as a straight cylinder.

### 2.4 Rupture-edge materials (bare metal, primer, fray, scorch, scrape)

- **The layered reveal.**
  - A chip or tear shows layers: paint, then primer, then bare metal, with a thin dark line inside each step. A
    single flat colour underneath looks wrong.
    https://www.tripo3d.ai/blog/explore/hd-model-paint-wear-chipping-and-edge-damage-realism
  - Substance Painter's Metal Edge Wear generator builds that mask from curvature, AO and noise:
    https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/effects/generators/metal-edge-wear
- **The distance-field edge.**
  - Valve (SIGGRAPH 2007): store a distance in one channel and threshold it with noise. That gives crisp, scalable
    edges plus outline and glow bands.
    https://cdn.akamai.steamstatic.com/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
  - Frostbite 2 (SIGGRAPH 2010) computed destruction masks as signed distances from artist-placed spheres into a
    small volume, drawn as a deferred decal:
    https://www.advances.realtimerendering.com/s2010/Kihl-Destruction%20in%20Frostbite(SIGGRAPH%202010%20Advanced%20RealTime%20Rendering%20Course).pdf
  - That is exactly the "edge-distance per place" proposed in P2: a band per material, broken by noise.
- **Burn and dissolve.**
  - Noise against a threshold, with a `smoothstep` rim (emissive char), then a soot band.
  - three.js version injected into a stock material:
    https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/
  - Unity version: https://mirzabeig.substack.com/p/unity-tutorial-dissolve-shader-part-2
  - A dissolve alone reads as "burnt", not "torn" (research summary). Use it for fire (DEFORM §9), not for tears.
- **BeamNG's mip warning.** Never mask the base paint layer, because filtering makes bright seams. Mask the detail
  layers above it. https://documentation.beamng.com/modding/materials/vehicle/typicalmaterials/
- **Decals.** The three.js `DecalGeometry` example projects a box onto a mesh, with `polygonOffset` and
  `depthWrite:false`. It distorts round corners and must be re-projected if the mesh moves, so it is a poor fit for a
  ridden wreck. https://github.com/mrdoob/three.js/blob/dev/examples/webgl_decals.html

### 2.5 Cracked and shattered windows

- **What the real material does.**
  - Light aircraft glazing is acrylic (PMMA), which is brittle: notched Charpy about 2 kJ/m², against 65-75 for
    polycarbonate. https://www.k-online.com/en/media_news/k-mag/plastics-in-practice/plastics-garden-hail-polycarbonate
  - It breaks in **large sharp pieces**. In the C210 VH-WRD accident a kite hawk "broke the Perspex into pieces".
    https://www.atsb.gov.au/node/6481
  - A cast-acrylic windshield shattered on a bird strike: https://flightsafety.org/asw-article/windshield-weakness/
  - **Crazing** is a network of fine silver-white cracks. Solvents and sun cause it, and AC 43.13-1B lists it as an
    inspection item. https://www.aopa.org/news-and-media/all-news/2000/june/flight-training-magazine/what-it-looks-like ,
    https://www.govinfo.gov/content/pkg/FR-2003-08-20/pdf/03-20985.pdf
  - Tempered glass makes cubes; laminated glass makes a held spider-web.
    https://www.guardianglass.com/eu/en/why-glass/build-with-glass/glass-functions/safety-glass
  - Neither is our fleet's material. **So: crazing, then an impact star, then a failed pane with big shards missing.**
- **How games and tools do it.**
  - **BeamNG** uses a deformGroup that swaps the whole glass material (`glass` to `glass_dmg`) at a small
    deformation ratio. The damage texture is generic, and the trigger is costly, so it is used sparingly.
    https://documentation.beamng.com/modding/vehicle/vehicle-art/texturing/glass-damage-textures/
  - **GTA V** uses glass-crack decals (`fxdecal_glass`) *(community sources only)*.
  - **Houdini Glass mode** is the standard parameter set: impact points, a radial crack count, and concentric rings
    set by width and spread. https://sidefx.com/docs/houdini/destruction/glass.html
  - **Chaos** has radial fracture and clustering, so big pieces break later into shards.
  - **Godot "Impact Glass Shader"** (MIT): Voronoi cracks with refraction. https://godotshaders.com/shader/impact-glass-shader/
  - **Shadertoy** shaders default to **CC BY-NC-SA 3.0**, which our rule excludes. Use them for reference only.
    https://www.shadertoy.com/terms
- **Texture or geometry.** For a pane that stays in its frame, a mask (procedural or atlas) is enough, and missing
  shards are just alpha 0 on an already transparent material. Geometry (pre-fractured shards) is only needed once
  pieces fly, which is P3.

### 2.6 Web and three.js scale

- `ConvexObjectBreaker` makes recursive plane cuts of convex hulls. It produces the flat-faced "disassembled" look,
  which is the opposite of what we want.
  https://github.com/mrdoob/three.js/blob/dev/examples/jsm/misc/ConvexObjectBreaker.js
- **three-pinata** (MIT): Voronoi fracture in 3D or 2.5D, impact-concentrated, with an inner-face material and
  refracture. It needs manifold meshes, and recommends 10-50 fragments and pre-fracturing. A candidate for P3
  pre-fractured panes. https://github.com/dgreenheck/three-pinata
- **three-bvh-csg** gives booleans on two-manifold input only. Our open skins are not manifold.
  https://www.npmjs.com/package/three-bvh-csg
- **Avoid `transmission` on panes.** Every distinct transmissive material adds a scene pass:
  https://discourse.threejs.org/t/transmission-effect-pbr-material-performance/59274 . Our glass already avoids it
  (aeroskin's measured note).

---

## 3. Every technique against flyDiy

Costs are judged against our constraints: 30 fps, the solver in a worker, one aeroskin program for every section, no
program link and no GL read-back during a crash (DMG IMPACT LAG), and a break-event budget of 8 ms per frame (v3).

| # | Technique | CPU | GPU | Memory | Build time | Fits the pipeline? | Look payoff | Verdict |
|---|---|---|---|---|---|---|---|---|
| T1 | **Kinked member drawing** (length kept, hinge at `kt1`, side `dN`) | ~0 (a sqrt per tube place, in the riding shader) | ~0 | 0 (6 free slots of a tube place's 8) | 0 | yes: the riding formula plus a term; the solver's bend sent on the damage hop | **high**: "bent elements" | **P1a** |
| T2 | **Material tear path** (which side a place goes, seeded per material) | event: ~2-8 ms per metre of tear, unoptimised (§6.1) | 0 | 0 | 0 | yes: replaces step 1-3's piece choice near a break; still only removes triangles | **high** | **P1b** |
| T3 | **Gap** (extra triangles removed along the path) | in T2 | 0 | 0 | 0 | yes: same index collapse | medium | P1b |
| T4 | **Rim jitter** (torn-edge places nudged in the surface plane) | in T2 | 0 | one offset per place (a DRAPE-like field) | 0 | yes: riding offset | medium: kills the staircase | P1b |
| T5 | **Curl / petal field** (sheet curls out and in, a fabric flap hangs) | in T2 | 0 | as T4 | 0 | yes: exactly the DRAPE field's form | **high** for metal | P1b |
| T6 | **Window crack mask**, procedural in the glass hook | 0 | ~one noise ray set plus rings per covered pane pixel, only while cracked | 4 uniforms per pane | 0 | yes: the glass hook has `mm`, `uGlassE` and opacity; a cracked pane gets a cloned material (same program, no link) | **high** | **P1c** |
| T7 | Window crack **atlas** (512², 2×2 variants, baked by our own tool) | 0 | 1 fetch | ~50 kB PNG, smaller as KTX2 | a bake step | yes | high, but repeats | P1c alternative |
| T8 | **Edge-distance field** per place (Dijkstra over the kept mesh, 15 cm band) | in T2 | 0 | one float per place | 0 | yes: computed at the event | enables T9 | P2 |
| T9 | **Rupture rim band** (bare metal / primer / raw wood / fray / fibre) via the weathering's substrate path | 0 | a few ALU | one vertex attribute (needs a varying) | 0 | **needs a ruling**: one program, but the WEATHER gate holds "zero new varyings" | **high** | P2 (option A) |
| T10 | Rupture rim band via a **rim overlay draw**: the same ridden buffers, its own index (rim triangles), its own parked material | 0 | one draw per wreck fold | a small index and one attribute | 0 | yes: the ground scar's parked-program precedent; shares the transform-feedback buffers so it rides for free | **high** | P2 (option B, recommended) |
| T11 | **Sub-triangle erosion** (`discard` where e + noise < 0) | 0 | low ALU, but a `discard` in the aeroplane's one program can cost early-z on some GPUs, every frame, damaged or not | 0 | 0 | only inside T10's overlay (rim triangles only) | medium close up; nil at chase distance | P3 |
| T12 | Scrape and scorch on ground contact (from 34_scar contacts) | event | via T9/T10 | small | 0 | yes: the scar already records contacts | medium | P2 |
| T13 | Flapping fabric strips (PBD ribbons in the worker) | worker | small | small | 0 | new system | high for fabric | P3 |
| T14 | Pre-fractured panes (three-pinata 2.5D at roll-out, parked) and shard debris | roll-out ~ms per pane | a few bodies | small | 0 | wreck_debris bodies exist; meshes must be parked | high | P3 |
| T15 | Dents on aluminium (impact into a per-place offset, oil-canning) | event | 0 | as T4 | 0 | yes: a field like T5 | medium | P3 |
| T16 | Offline jagged-seam bake (Chaos- or Houdini-style noise on seams at build) | build | 0 | more vertices on seams | build-time | possible: the cage is generated, so it could knife a noisy seam in (WINDOW-KNIFE precedent) | high | P3, only if T2's triangle granularity proves too coarse on the box |
| T17 | Full node/beam skin, FEM shells | very high | — | — | — | no | — | out of scope (DEFORM §6.4 already says so) |

**Triangle granularity.** The snapshot's places sit about 3-4 cm apart on the flown Cub (~85 k welded places).
From a chase camera at 8-15 m a triangle is a few pixels, so a tear chosen per triangle reads as jagged. The
prototype's plywood comb shows the limit: 1.6 cm splinters are finer than the mesh and come out as missing blocks.
So splinters and fray should be a band of 2+ triangles in geometry, with the fine detail left to colour (P2) or,
close up, to erosion (P3).

---

## 4. The recommended plan

### P1: cheap and convincing, no new GL objects at a crash (3-4 sessions)

**P1a: MEMBERS BEND (G3620)**

- **The solver's bend to the page.** Send the solver's per-member bend on the damage hop, only for members whose
  set moved, only at an event: `kt1`, `dk` (or `ks`), and the bend direction (`dTx dTz dNx dNz`).
- **Packing.** At binding, pack each tube place's L0 (rest length), kt1 and a fallback seeded side into the place's
  unused node slots.
- **The riding.** In the riding (CPU mirror `rideMirror` and GPU `RIDE_VS` together, the rule of their header), a
  tube place offsets along the bend direction by `h × tent(t)`, where
  `h = sqrt(max(a² − x², 0))`, `a = kt1·L0`, `x = (a² − b² + c²)/2c`.
- **Broken tubes.** A broken tube's stubs keep the last bend (their station offset frozen at the break) instead of
  snapping straight.
- **Gate.** Extend DMGSKIN with "a crushed member's drawn length stays within 2 % of L0" (the prototype draws 0.495
  for 0.500).
- **Look on the box.** The Cub trunk crash, the nose-in.

**P1b: THE TEAR HAS A MATERIAL (G3621-G3622)**

- **The rule.** In `event()`, near a break (the places bound to broken members' nodes), choose each place's side by
  a **seeded material tear path** instead of the bare piece weight. Then remove a small **gap**, jitter the **rim**
  in plane, and make a **curl field** (offset along the normal, in the node frame, packed like the drape's sag).
- **The profiles** (prototype `tear_proto.js`):

  | Material (GEN_CRASH row) | Path | Gap | Curl |
  |---|---|---|---|
  | alloy / 2024-T3 | unzips along rivet lines (pitch from the build's rivet grammar), jumps diagonally between lines | ~0-6 mm | petals ±7 cm over 10 cm, alternating out and in, some flat |
  | tubeFabric covering | straight along the weave, right-angle steps, stops at ribs and tapes | 1.5-4.5 cm (springs open) | the flap sags inward, its undoped underside showing; plus the existing drape |
  | composite (carbon, glass) | angular cracks (20-60° turns, 3-10 cm segments) | shards drop out in clusters within 4 cm | none (DMG-COMPOSITE: it never stretches) |
  | wood / ply | a splinter comb along the grain, teeth ≥ 2 triangles | 3 mm | small (1.5 cm) |

- **The rule must hold.** A triangle is still only removed: no new vertex, no re-layout (G3024 / G3028's lesson).
  A part that comes off whole keeps every triangle (the existing rule).
- **Budget.** The tear's event work runs inside the existing 8 ms break-event budget. Prototype cost:
  10-40 ms per 10 m of tear in unoptimised JS, so roughly 1-4 ms for a typical 1 m break. The adjacency should be
  built at binding, not per event.
- **Determinism.** Seed from the break itself (member index plus the build's seed), so the same crash gives the same
  tear (the DMG-DETERMINISM habit).

**P1c: THE WINDOWS CRACK (G3623)**

- **States per pane.** S1 crazing, S2 star, S3 failed (prototype `crack_proto.js`, `crack_states.png`).
- **Triggers.** Reuse DEFORM §5.3's switch:
  - S1: a windscreen-frame member with permanent set over 0.2 %, or a very hard landing *(the threshold is a tuning
    point)*;
  - S2: set over 0.5 %, or a strike on the pane (bird, trunk, debris);
  - S3: wreck_debris's CRUSH (6 cm) **before** it releases the pane.
- **S3 as a two-step.** The pane first fails in place (holes). Only a second crush step, or the carrying set breaking
  off, throws what is left as a body. Acrylic does both (§2.5).
- **Implementation.** The glass hook gains one block, `if (uCrack.z > 0.0) { ... }`, spliced where
  `AERO_WX_GLASS_FS` already sits:
  - `uCrack = (impact u, impact v in pane metres, state + severity, seed)`;
  - the line darkens and glints;
  - the haze raises roughness and adds a white scatter;
  - a hole sets alpha 0.
- **Per-pane materials.** Glass materials are pooled by look key (`AERO_POOL`), so a cracked pane gets
  `material.clone()` with its own `uCrack`. That is the same hook source, so the same program and no link. It is an
  event (CPU), and the clone is dropped at the heal.
- **Cost.** The procedural mask is ~1 µs in node per evaluation. On the GPU it is a handful of noise calls, only on
  cracked pane pixels.
- **Licences.** No asset at all, so nothing to license.

### P2: the rupture texture (2 sessions + one A0 ruling)

**THE RIM (G3624-G3625)**

- **The value.** The event computes an **edge distance `e`** per place (Dijkstra over the kept mesh, cut at 15 cm).
- **The bands, per finish.** Use the existing `AERO_WX_SUBSTRATE` colours, so a tear exposes what a chip would:

  | Finish | Band 1 | Band 2 | Band 3 |
  |---|---|---|---|
  | alclad | bare alloy, 0-4 mm, metal 0.9 | primer, 4-14 mm (zinc-chromate green-yellow or grey: a look ruling) | chipped paint to 3 cm |
  | fabric | frayed thread, 0-8 mm, the undoped polyester colour | — | — |
  | composite | pale fibre, 0-6 mm | a dark delamination line | — |
  | ply | raw wood, 0-16 mm | — | — |
  | steel tube stubs | bare steel at the break | oxide | — |

- **Option A.** A vertex attribute `aRim` read by AEROSKIN_HOOK into the weathering's substrate path. It is the
  simplest look, but it adds a varying to the one program, which the WEATHER gate forbids today. **A0's ruling.**
- **Option B (recommended).** A **rim overlay draw** per wreck fold:
  - it draws the **same ridden GL buffers** (the `GLBufferAttribute` DMG-SKINGPU already hands the geometries), so
    it rides for free;
  - it has **its own index** (the rim triangles only, written at the event) and its own `aRim` attribute;
  - its material is a small one, **made and linked at roll-out, parked**, exactly as `ground_scar.js` does;
  - it draws with polygon offset over the skin, so the aeroplane's program is untouched;
  - this is also the only place where P3's erosion (`discard`) could live safely.
- **Scrape and scorch (G3626).** 34_scar's ground contacts give each contact place a scrape (bright scratches
  aligned with the slide) and the fire state gives a soot band. Both use the same overlay.

### P3: the bigger chantiers (later, each its own session)

- **Flapping fabric strips (G3627).** A few PBD/Verlet ribbons per torn fabric bay, run in the worker, with
  frayed-alpha edges. The research found no shipped flight sim doing this, so the payoff is *(inference)*.
- **Shattering panes (G3628).** At roll-out, pre-fracture each pane in 2.5D (three-pinata-style, 10-30 cells,
  impact-weighted at crack time by choosing which cells go). The shard meshes are parked; shards become
  wreck_debris bodies; a few instanced sparkle shards. This needs the impact-lag rule respected: meshes made before
  the crash, never during it.
- **Dents on metal (G3629).** An impact into a per-place offset field (like the curl), plus oil-canning panels. Ties
  to DEFORM §6.4's "part detach plus dent decals" for the monocoque.
- **Sub-triangle erosion and a noisy seam knifed in at build.** Only if the box shows triangle-level jaggedness is
  not enough up close.

---

## 5. Files, functions and owners per phase

The **Deform Coordinator** owns damage: `skin_break.js`, `skin_gpu.js`, `wreck_debris.js`, `ground_scar.js`,
`34_scar.js`, the damage half of `app.js`, the damage hop, and the crash parts of `30_solver.js` / `60_gen_spec.js`.
`aeroskin.js` and `aeroweather.js` are the look's shared program. Changes there go through **A0's ruling** (the
one-program rules in their headers, GATE WEATHER).

| Phase | File : function | Change | Owner |
|---|---|---|---|
| P1a | `src/core/30_solver.js` (bend state `dk kt1 dTx dTz dNx dNz`, ~l. 798, 1326-1383, 3485) | none: read only | Deform |
| P1a | `src/viewer/sim_host.js simDmgHop`, `src/viewer/sim_view.js simViewDmgState` | carry `kt1`, `dk`, direction for set members, per event | Deform |
| P1a | `src/viewer/skin_break.js` `tubePieces`, `inhSteps` / 'tube' binding, `packPlaces`, `rideMirror`, `poseCage` | L0 / kt1 / side in a tube place's free slots; the kink term | Deform |
| P1a | `src/viewer/skin_gpu.js` RIDE_VS | the same kink term (the mirror rule) | Deform |
| P1a | `tools/_dmg_skin_check.js` (GATE DMGSKIN), `tools/_dmg_skingpu*` | drawn-length row | Deform |
| P1b | `skin_break.js` `event()`, `prepV`, the DRAPE field, `packPlaces` | tear path per material, gap, rim jitter, curl field | Deform |
| P1b | `src/viewer/app.js` `brkCage` (the record's material: `R.sheetTear`, `R.shellTear`, fabric) | pass the GEN_CRASH row / finish to the record | Deform |
| P1b | `src/core/60_gen_spec.js GEN_CRASH` | optional: the tear profile's numbers beside each row | Deform |
| P1c | `src/viewer/aeroskin.js` `aeroGlass` + the glass hook; `src/viewer/aeroweather.js AERO_WX_GLASS_FS` neighbour | the `uCrack` block | A0 ruling; Deform implements |
| P1c | `src/viewer/wreck_debris.js` (pane candidates, CRUSH) | S3 in place before release | Deform |
| P1c | `src/viewer/app.js` (the switch, the material clone and heal) | the trigger | Deform |
| P2 | `skin_break.js event()` (edge distance), a new `src/viewer/dmg_rim.js` (parked overlay, like `ground_scar.js`), `app.js` roll-out compile list | the rim | Deform; A0 rules A vs B |
| P2 | `aeroweather.js AERO_WX_SUBSTRATE` | read only (the colours) | A0 |
| P2 | `src/core/34_scar.js` contacts | scrape positions | Deform |
| P3 | `wreck_debris.js`, worker side (`sim_host.js`), three-pinata-style pre-fracture at roll-out | ribbons, shards, dents | Deform |

---

## 6. The prototypes (`futureDesigns/dmg-looks/`, node only)

Run them from that folder with `node <file>`. Nothing there is loaded by the game. `png.js` and `noise.js` are
helpers, and every noise function maps 1:1 onto GLSL.

### 6.1 `tear_proto.js`: the tear has a material

- **Input.** A 1.2 m × 0.8 m panel with 3.5 cm triangles (the flown Cub's density) and a break 0.6 m in.
- **Output.** `tear_panels.png`, five rows:
  1. today (a straight slot);
  2. alloy (rivet-line unzip, diagonal jumps, petals, bare-metal / primer / chipped-paint rim);
  3. doped fabric (weave-straight runs, sprung gap, a hanging flap, loose threads, the tube behind);
  4. composite (angular crack, shards out, fibre rim and tufts);
  5. plywood (splinter comb).
- **Erosion variant.** `--erode` writes `tear_panels_erode.png` with the optional sub-triangle erosion.
- **What it shows.**
  - Removing triangles only, with no new geometry, already reads torn once the path is material-specific and the
    rim is jittered and curled.
  - The colour band is what sells "rupture".
  - Plywood splinters finer than the mesh turn into missing blocks: keep teeth to 2 or more triangles.
- **Cost** (`--perf`, an 85 k-place mesh): on the 15 cm band only, warm, **10-40 ms per 10.2 m of tear** in
  unoptimised JS (composite costs most: its second pass). A real 1-2 m break is a few ms. The per-place loops still
  walk all places; building the adjacency at binding cuts more.

### 6.2 `bend_proto.js`: crushed members drawn kinked

- **Output.** `bend_members.svg`: a Warren-braced fuselage bay at rest, today (telescoped tubes), and proposed
  (kinked, length kept).
- **Numbers.** With the nose pushed 9 cm aft:
  - a 0.50 m longeron 9 % short is drawn 0.495 m long with a 10.3 cm kink (today: 0.455 m, straight);
  - a 0.78 m diagonal 4.6 % short gets an 11.7 cm kink.
  - At the solver's 3 % kink the hinge is already about 12 % of the member's length deep. It is very visible, which
    is the point.

### 6.3 `crack_proto.js`: the window states

- **Outputs.**
  - `crack_states.png`: a 0.9 × 0.6 m pane in four states. S1 crazing (patchy), S2 light star, S2 hard star (crazed
    core, whitened flanks, arcs), S3 failed (shards out, jagged rim).
  - `crack_atlas.png`: the same function baked as a 512² RGB data atlas (R line, G haze, B hole), about 50 kB as
    PNG. This is the T7 alternative, and it is our own work, so there is nothing to license.
- **Cost.** `mask()` is about 1 k evaluations per ms in node.
- **Known limit.** Real crazing lines run perpendicular to the main stress (§2.5). The prototype's Voronoi network
  is isotropic. A stress direction per pane (from the frame member that set) would orient it.

---

## 7. Window damage: the concrete proposal

| Question | Proposal |
|---|---|
| Procedural or atlas? | **Procedural first** (T6): no repetition, the impact point is exact, no asset or fetch. The **atlas** (T7) is the fallback if the box shows the noise rays costing on a full-screen cockpit view. It is baked by our own `crack_proto.js`, so it stays CC0-by-us. |
| How it maps onto our glazing | Pane metres: the glass hook's `mm = vSurf.xy * uFieldM`; the pane extent `uGlassE` keeps cracks inside and lets the S3 rim follow the frame. The hook already reads `mm` for every pane it draws (the weathering's dust and edge grime); whether band panes (G12.3 material zones) and drawn panes (WINDOW-KNIFE) carry an equally clean surface field is to be checked on the box. |
| Per-pane state | `material.clone()` of the pooled glass at the first crack, with its own `uCrack` vec4 (and a second vec4 for a second impact if wanted). Same hook source, so the same program and no link (`customProgramCacheKey` is the hook's source; aeroskin header). Disposed at the heal. |
| What it changes on screen | Line: darker and glinting (roughness up, a little albedo). Haze: white scatter (the dust film's path, `aeroWxCov`-style). Hole: opacity 0. Glass is already alpha-blended, so no `discard` is needed. |
| Triggers | DEFORM §5.3's "windscreen cracked" switch, with three thresholds (§4 P1c). The bird-strike / debris impact point comes from the contact; a frame-set crack starts at the frame member's nearest edge. |
| From the cockpit | The same mask, seen from inside. Optionally the crazed haze gets a small view-dependent boost (scatter is brighter against the sun): one dot product. |
| Licences | None needed. **If an asset is ever wanted:** only CC0 or CC-BY, recorded in CREDITS.md. Candidates (search-indexed, *not opened*; click through before use): TextureCan "Broken Glass Texture with Cracks (Imperfection 0001)", CC0, https://www.texturecan.com/details/19/ (terms https://texturecan.com/terms/); ambientCG Scratches 005 for scrape masks, CC0, https://ambientcg.com/view?id=Scratches005 (https://docs.ambientcg.com/license/); Poly Haven "Rusty Painted Metal" as a chipping reference, CC0, https://polyhaven.com/a/rusty_painted_metal (https://polyhaven.com/license). **Avoid**: Shadertoy code (CC BY-NC-SA 3.0 by default), Textures.com (no redistribution), ShareTextures (a "custom CC0" that forbids redistribution through other sites: https://sharetextures.com/p/license), personal-use packs. The tree already uses ambientCG and Poly Haven (CREDITS.md, `skin_tex.js`, `ground_tex.js`). |

---

## 8. Open points for the Deform Coordinator and the user

1. **P2 A or B**: a varying in the one aeroskin program, or the parked rim overlay. A0's ruling. B is recommended.
2. **Primer colour** for the alloy fleet's rim (zinc-chromate green-yellow, grey, or none): a look ruling for the
   user.
3. **How strongly a crushed tube kinks.** The proposal keeps the drawn length exactly. A partly elastic look (half
   the kink) is one constant if the box finds it too much.
4. **S1 crazing on a hard landing**: is a cosmetic crack on a non-crash welcome, or noise? The user's call.
5. **Does the physics break members too readily for the look?** The user wants "bent elements". If, on the box,
   members break where a tube should only fold, that is calibration (`thf`, `etu`, the group-release third,
   G1894), not drawing: the Deform Coordinator's. This study does not touch it.

---

## 9. Sources (all cited inline above; collected)

**Games and tools**

- BeamNG docs:
  - https://documentation.beamng.com/modding/vehicle/sections/flexbodies/
  - https://documentation.beamng.com/modding/vehicle/sections/beams/
  - https://documentation.beamng.com/modding/vehicle/vehicle-art/texturing/glass-damage-textures/
  - https://documentation.beamng.com/modding/materials/vehicle/typicalmaterials/
- Rigs of Rods: https://docs.rigsofrods.org/vehicle-creation/flexbody-deforming-detaching-parts/
- IL-2:
  - https://il2sturmovik.com/news/530/dev-blog-243/
  - https://il2sturmovik.com/news/616/dev-blog-275/
- DCS: https://forum.dcs.world/topic/145654-detecting-damage-in-aircraft-mod/
- GTA V vehicle shaders: https://docs.sollumz.org/2.8/documentation/fragments.yft/vehicle-shaders
- Cyberpunk 2077 morph targets: https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-creators-theory/3d-modelling/morphtargets
- Houdini:
  - https://www.sidefx.com/docs/houdini/destruction/metal.html
  - https://sidefx.com/docs/houdini/destruction/plasticity.html
  - https://sidefx.com/docs/houdini/destruction/glass.html
  - https://www.sidefx.com/docs/houdini/vellum/breaking_tearing.html
- Unreal Chaos:
  - https://dev.epicgames.com/documentation/en-us/unreal-engine/fracturing-geometry-collections-user-guide
  - https://docs.unrealengine.com/4.26/API/Plugins/FractureEditor/UFractureCommonSettings/index.html
- NVIDIA Blast: https://docs.nvidia.com/gameworks/content/gameworkslibrary/blast/1.1/api_docs/files/pagedefinitions.html

**Research**

- Pfaff et al. 2014: https://escholarship.org/content/qt1mc8b47z/qt1mc8b47z.pdf
- O'Brien & Hodgins 2002: https://ri.cmu.edu/publications/graphical-modeling-and-animation-of-ductile-fracture
- Parker & O'Brien (DMM): https://escholarship.org/uc/item/2kj9p4bw
- Metaaphanon et al. 2009: https://web.media.mit.edu/~bandy/cloth/PG09cloth.pdf
- Forced tearing of thin sheets: https://arxiv.org/pdf/1108.3534
- Thin-plate petalling: https://pure.bit.edu.cn/en/publications/mechanism-research-of-thin-plate-petaling-under-local-loading-bas/
- Aluminium impact modes: https://sam.ensam.eu/bitstream/10985/9630/3/DUMAS_IJIE_VIOT_2015.pdf
- NASA lap-joint link-up: https://ntrs.nasa.gov/api/citations/19950008506/downloads/19950008506.pdf
- Fuselage lap splice fatigue: https://core.ac.uk/works/24833474
- Tube plastic hinge:
  - https://investigacion.pucp.edu.pe/grupos/appliedmechanics/publicacion/on-the-collapse-mechanics-of-steel-rectangular-tubes-in-cantilever-bending/
  - https://scholarworks.indianapolis.iu.edu/items/27635f80-6f3b-48c1-8b7e-942a28c9533f/full

**Rendering**

- Valve SDF: https://cdn.akamai.steamstatic.com/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf
- Frostbite destruction masks: https://www.advances.realtimerendering.com/s2010/Kihl-Destruction%20in%20Frostbite(SIGGRAPH%202010%20Advanced%20RealTime%20Rendering%20Course).pdf
- Dissolve, three.js: https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/
- Dissolve, Unity: https://mirzabeig.substack.com/p/unity-tutorial-dissolve-shader-part-2
- Substance Metal Edge Wear: https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/effects/generators/metal-edge-wear
- Paint wear layering: https://www.tripo3d.ai/blog/explore/hd-model-paint-wear-chipping-and-edge-damage-realism

**Web scale**

- https://github.com/mrdoob/three.js/blob/dev/examples/jsm/misc/ConvexObjectBreaker.js
- https://github.com/mrdoob/three.js/blob/dev/examples/webgl_decals.html
- https://github.com/dgreenheck/three-pinata
- https://www.npmjs.com/package/three-bvh-csg
- https://discourse.threejs.org/t/transmission-effect-pbr-material-performance/59274
- Godot Impact Glass Shader (MIT): https://godotshaders.com/shader/impact-glass-shader/
- Shadertoy terms: https://www.shadertoy.com/terms

**Materials and aviation**

- Acrylic vs polycarbonate: https://www.k-online.com/en/media_news/k-mag/plastics-in-practice/plastics-garden-hail-polycarbonate
- ATSB VH-WRD: https://www.atsb.gov.au/node/6481
- Flight Safety Foundation, windshield weakness: https://flightsafety.org/asw-article/windshield-weakness/
- AOPA on crazing: https://www.aopa.org/news-and-media/all-news/2000/june/flight-training-magazine/what-it-looks-like
- MU-2B AD 2003-17-04: https://www.govinfo.gov/content/pkg/FR-2003-08-20/pdf/03-20985.pdf
- Safety glass: https://www.guardianglass.com/eu/en/why-glass/build-with-glass/glass-functions/safety-glass
- AC 43.13-1B copy: https://corpora.tika.apache.org/base/docs/govdocs1/023/023511.pdf
- CASA fabric coverings: https://www.casa.gov.au/index.php/aircraft/airworthiness/airworthiness-bulletins/aircraft-fabric-coverings
- Fabric tear stops (informal): https://sim-outhouse.org/sohforums/threads/art-of-damage-comments-please.38541/latest

**Licences**

- https://docs.ambientcg.com/license/
- https://polyhaven.com/license
- https://texturecan.com/terms/
- https://sharetextures.com/p/license
- https://www.textures.com/about/terms-of-use
