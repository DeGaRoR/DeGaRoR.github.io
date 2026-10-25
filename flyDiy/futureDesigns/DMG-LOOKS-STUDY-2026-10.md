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
| **P1a** structure by material (brief 2, §10) | steel tubes fold at a creased hinge and tear necked and bent; alloy frames crimp and tear jagged at their rivet line; wood stays straight, then splinters, splits, greensticks or crushes | **revised 25 Oct:** a parked **member pool** (frame members have no vertices to bend: §10.2), plus an event rule for where a broken member parts | none at the crash (the pool is made at roll-out); **+1 draw after a crash** | 2 sessions |
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

**P1a: MEMBERS BEND (G3620): SUPERSEDED on 25 Oct by §10 (structure by material, the member pool)**

> Brief 2 measured the flown snapshot. A drawn frame member has a ring only every ~14 cm (median 7 per metre), and
> many members are a single straight segment, so the riding term below has no vertices to bend. The term itself (the
> kink that keeps the length) is kept and moves into the pool's vertex shader. The original text stays for the
> record.

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
  - S1 crazing: **no trigger of its own.** The user ruled on 25 Oct: no crazing on hard landings. Crazing shows only
    as the core of an S2 star or an S3 failure;
  - S2: a windscreen-frame member's set over 0.5 %, or a strike on the pane (bird, trunk, debris);
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
  | alclad | bare alloy, 0-4 mm, metal 0.9 | **grey primer** (the user, 25 Oct), 4-14 mm | chipped paint to 3 cm |
  | fabric | frayed thread, 0-8 mm, the undoped polyester colour | — | — |
  | composite | pale fibre, 0-6 mm | a dark delamination line | — |
  | ply | raw wood, 0-16 mm | — | — |
  | steel tube stubs | bare steel at the break | oxide | — |

- **Option A.** A vertex attribute `aRim` read by AEROSKIN_HOOK into the weathering's substrate path. It is the
  simplest look, but it adds a varying to the one program, which the WEATHER gate forbids today. **A0's ruling.**
- **Option B: RULED by the user on 25 Oct.** A **rim overlay draw** per wreck fold:
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

**The user's rulings, 25 Oct:** **grey primer**; **P2 option B** (the parked rim overlay); **no crazing on hard
landings**. Brief 2 (Deform, the same day) adds: "proceed on the damage look, but beware of performance impact", and
structure by material (§10).

1. ~~P2 A or B~~: **B, ruled.**
2. ~~Primer colour~~: **grey, ruled.**
3. **How strongly a crushed tube kinks.** The proposal keeps the drawn length exactly. A partly elastic look (half
   the kink) is one constant if the box finds it too much.
4. ~~S1 crazing on a hard landing~~: **no, ruled.**
5. **Does the physics break members too readily for the look?** Brief 2 measured it: §10.4 lists the candidates. The user wants "bent elements". If, on the box,
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

---

## 10. Structure by material (brief 2, 25 Oct: `dmg-looks/BRIEF-2026-10-25-structure.md`)

**The ask.** The user, through A0: "We can proceed on the damage look, but beware of performance impact. ... a
solution for the structural elements that should bend: the tubular cage, the wooden pillars, the metal frames. The
metal should bend, wood should break like wood." The Deform Coordinator: extend the prototype (node only) on the
three validated builds; name the solver data, the calibration items and the cost.

**The answer in short.**

1. **Today every broken member is drawn split at exactly half its length**, with flat open ends. The skin's rule
   gives each place to its dominant end node, and on a tube bound by station that is t < 0.5 against t > 0.5.
   Kinked members (the solver books a kink as a break with a compression floor) are drawn split as well.
2. **The drawn members cannot bend.** A frame member in the flown snapshot has a ring only every ~14 cm: median 7 a
   metre, and many members are one straight segment (§10.2). So bending needs vertices that do not exist.
3. **The design.**
   - A **member pool**: one mesh of canonical members, parked and compiled at roll-out.
   - At an event, each bent or broken member gets a slot. The pool's vertex shader poses it from the solver's state
     and the live nodes.
   - The snapshot's own triangles for that member are collapsed, as today.
   - Plus a free **event rule**: a member that came off at a fitting or a glue line goes whole with its part,
     instead of being cut in two.
4. **Cost.** 0 at rest. At a crash: no GL object made, no program linked, about 10 µs of CPU for 40 members, and
   **one extra draw while a wreck exists**. That draw is the one point where the brief's "0 new draws" target is not
   met; §10.6 gives the alternative and why it costs more.

### 10.1 What the solver does to the structure: the census

`dmg-looks/structure_census.js` flies the treecrash rig's four standard crashes on the Cub, the Jodel and the metal
Cessna, as the game flies them (the join, with the certificate stamped). It reads every member at the end and saves
`structure_census.json`.

`how` is read back from each member's state at the frame it broke, because the solver keeps `how` only for the first
break:

- **kink**: compression past `ecu`, 3 %;
- **fold**: a trunk bend past `thf`;
- **ragged**: wood's staged break;
- **tension**: stretched to `etu`, or brittle at yield;
- **release**: no strain of its own. Its break group or its cluster's cut let it go.

| Build | Crash | Visibly bent (h > 1.5 cm) | Broken | of which kink / fold / tension / ragged / release | release at a fitting or bond |
|---|---|---|---|---|---|
| Cub | 3 m/s taxi into a trunk | 0 | 0 | — | — |
| Cub | 12 m/s nose-over | 6 | 7 | 0 / 7 / 0 / 0 / 0 | 0 |
| Cub | 30 m/s trunk, centreline | 30 | 113 | 15 / 41 / 8 / 4 / 45 | 42 |
| Cub | 30 m/s trunk, 2.5 m out | 35 | 49 | 9 / 8 / 1 / 2 / 29 | 24 |
| Jodel | taxi | 0 | 0 | — | — |
| Jodel | nose-over | 2 | 11 | 0 / 1 / 0 / 0 / 10 | 10 |
| Jodel | trunk, centreline | 24 | 145 | 18 / 8 / 6 / 10 / 103 | 88 |
| Jodel | trunk, 2.5 m out | 20 | 94 | 6 / 1 / 1 / 16 / 70 | 69 |
| metal Cessna | taxi | 0 | 0 | — | — |
| metal Cessna | nose-over | 0 | 7 | 1 / 1 / 0 / 0 / 5 | 5 |
| metal Cessna | trunk, centreline | 35 | 141 | 14 / 8 / 29 / 0 / 90 | 80 |
| metal Cessna | trunk, 2.5 m out | 14 | 24 | 4 / 5 / 4 / 0 / 11 | 10 |

**What it says.**

- **Releases dominate a 30 m/s crash.** 45-103 members per run break with no strain of their own. 83-99 % of them
  are at a fitting or a glue line: the wing, tail and gear attachments letting go, which is right. They read as
  "disassembled" only because the drawing cuts each one at mid-span. The event rule in §10.3 draws them whole on
  their part, at **zero cost**.
- **Steel folds tear at about 70°.** The Cub's steel members fold round the trunk; 41 of them tear on the
  centreline run. The fold angle at the tear is 71-77° median, against `thf` = 1.2 rad (69°) for tubeFabric. Alloy
  tears at 0.8 rad (46°); the measured range was 49-81°.
- **Steel bends are large where they do not break.** Bent but whole Cub tubes reach −38 % chord (`dk` up to
  0.38 m): exactly the "bent elements" the user asks for. Today they are drawn telescoped.
- **Wood behaves as wood in the solver.** No tension set; `ragged` staged breaks (4-16 per run); compression
  "kinks" at 3 %. The look is what is missing.

### 10.2 Why the drawing cannot bend them today: the mesh

`dmg-looks/structure_mesh.js` measures the flown snapshot headless (`tools/_dmg_wall_lib.js snapshotOf`: the page's
layers and join). Each vertex of the structure groups is matched to its nearest member, within 8 cm at rest, and the
distinct 1 cm stations along each member are counted. Output: `structure_mesh.txt`.

| Build : group | Members | Triangles a member (p50 / p90) | Rings a metre (p10 / p50 / p90) |
|---|---|---|---|
| Cub : `stube` (the 4130 cage) | 89 | 55 / 238 | 3 / 7 / 23 |
| Jodel : `swoodFrame` | 87 | 16 / 75 | 2 / 6 / 15 |
| metal Cessna : `stoele` (the alloy frames) | 137 | 33 / 184 | 2 / 7 / 19 |

A `tubeSeg` (`tools/_cage_gen.js`) is a six-sided tube with a ring at each end and nothing between. The bent runs
(`tubePath`) have rings only at their polyline points. A hinge needs a ring at the hinge, crimps need 4-6 rings in a
few centimetres, and splinters need strips along the member. None of that exists. Two ways to get it:

- **(a) Bake rings in.** Re-mesh every frame member at a ring every 4 cm, always.
  - Cost: Cub +13 k triangles (+14 % of the 91 k snapshot), Jodel +10.5 k (+12 %), metal Cessna up to +30 k (+24 % of
    124 k; an upper estimate, because the match takes in some sheet near the frames).
  - It is paid every frame and in every shadow pass, crashed or not.
  - It is a change in the cage generator, not in Deform's files.
  - Even then crimps and splinters are coarse at 4 cm.
- **(b) The member pool.** It is drawn only after a crash, only for the members that need it (§10.3). **Recommended.**

### 10.3 The design: the member pool and the parting rule

**The parting rule** (event-time, in `skin_break.js` `event()`; no geometry, no cost). Where a broken member's drawn
places part depends on `how`:

| how (and seam) | Where it parts | Drawn as |
|---|---|---|
| release at a `fitting` or `bond` | at the fitting end | whole on its own part, the fitting torn at the end (a lug, a bolt hole, a glue line) |
| release by a cluster's cut | at the cut's end (the cluster root) | whole, or a pool slot if the member is steel or alloy and should bend (calibration C3) |
| fold | at the hinge `kt1` | pool slot: torn after the bend |
| kink | **does not part** | pool slot: folded, one piece (the solver's floor holds its crushed length) |
| tension (ductile) | a seeded neck station, 0.3-0.7 | pool slot: necked and torn |
| ragged / tension (wood) | a seeded station, 0.3-0.7 | pool slot: splinters |

**The member pool.**

- **One parked mesh** of canonical members, made at roll-out with its own program. It is linked off the main thread
  exactly as `ground_scar.js`, so there is **no program link and no GL object made in a crash**.
- **Each slot is a member's worth of vertices.** The rings cluster round the slot's event station (the hinge, the
  break), so a slot can show a crease or splinters at about 300-500 triangles.
- **At an event**, a slot gets a few dozen floats: its two node indices, L0, section, material, `how`, station,
  bend axis and seed. That is one small `texSubImage` into an existing texture, like the place textures' refresh. The
  snapshot's triangles of that member are collapsed, as today (the member's triangles come from `tubePieces`, made at
  binding).
- **Each frame, the vertex shader poses every vertex** from its canonical coordinates, the slot's state and the two
  nodes' live positions. It reads the node texture DMG-SKINGPU already uploads, so there is **no CPU per frame**.
  The fragment shader colours the rim (bare steel, bare alloy, grey primer, raw wood) from the station distance: P2
  option B's rim for members, in the same program.
- **The prototype's pose functions are that vertex shader in JS** (`structure_proto.js`; the mirror rule of
  `rideMirror` / `RIDE_VS`). Every vertex depends only on (s, around or strip index, slot state, A, B).
- **Priority.** Slots go to the largest visible changes first. A cap of 128 slots covers every census run (at most 98
  needed). Past the cap, members keep today's drawing.

**The looks, by material and solver state** (pictures `dmg-looks/steel_cage.png`, `alloy_frames.png`,
`wood_members.png`: rest / today / proposed, drawn at the slot budget):

| Material | Solver state | Look |
|---|---|---|
| **Steel tube** (4130, tubeFabric: the Cub's cage, every engine mount) | set < 0 or `dk` > 0, not broken | two legs that keep L0, meeting at a short rounded crease at `kt1` (0.5 ± 0.15 seeded for a kink); the tube **ovalised** there (−38 % in the bend plane, +20 % across) and the crease's inside pushed in |
| | fold past `thf`, or tension at `etu` | the crack opens at the crease. **Each stub keeps its bend** and a lip of the crease, its end **necked** (radius −40 % over 1.5 r) and **torn** (the end ring jagged ±0.9 r round the tube, seeded); bare steel at the tear |
| | kink (a floor) | folded, **one piece**, never split |
| **Alloy frame** (2024 / 6061 sections: the metal Cessna's formers, stringers, longerons) | set < 0 | **local buckling**: 2.5 crimps over a short zone (wavelength 2.2 × the flange width), amplitude from the chord lost (A = λ/π · √(δ/L_z)), flange tips moving most |
| | broken (tension, kink, a fitting) | a **jagged tear along the rivet line**, zig-zagging between the holes (pitch 22 mm), the holes torn open, lips curled; bare alloy at the rim, then **grey primer** |
| **Wood** (spruce longerons, spar caps, pillars; ply webs) | anything elastic | **straight**: the pool is never used for elastic wood |
| | ragged, tension, or fold past `thf` | a full break: a comb of **slivers**, 3-6 × the section depth and uneven (some short), on both pieces; tips tapered; a **lengthwise split** running back 5 × depth from the break; raw wood at the fracture and the end grain |
| | `dk` > 0 and not broken | **greenstick**: hanging bent at the crack, the tension face split and pulled out, the compression face folded |
| | kink (compression past 3 %) | a **crush**: a kink band inclined across the depth, still one piece |

**When the riding has not started.** A bent but unbroken frame has no skin riding yet, so DMG-SKINGPU's node texture
is not uploaded. In that case only, the pool uploads its own nodes: ~100 nodes × 2 texels, about 4 kB a frame.

### 10.4 Calibration candidates (for Deform; no physics changed here)

| # | What | Where it shows (build, crash, members) | Why it matters for the look | Suggestion |
|---|---|---|---|---|
| C1 | A **kinked ductile member** (steel, alloy) is booked as broken: `k = c = 0`, a compression floor only (`30_solver.js` ~l. 1383, G1813). The pieces logic says "a kink floor pushes only ... neither holds". | Cub trunk 0: 15 (10 fuselage, 4 engine mount, 1 tail); Cub trunk 2.5: 7 steel; Jodel trunk 0: 8 engine-mount tubes; metal trunk 0: 14 (4 alloy fuselage, 9 mount / vessel tubes); metal trunk 2.5: 4 alloy | A kinked tube is still one welded piece that carries real tension. Today it can let pieces part at a kink, and the drawing splits it. | Keep a tension tie on a kinked ductile member (like DMG-FABRIC's cover tie: a fraction of `fy`, torn at `etu`). The drawing (§10.3) already keeps it one piece. |
| C2 | **Steel folds tear at `thf` = 1.2 rad (69°)**; alloy at 0.8 rad (46°) | Cub trunk 0: 41 steel members torn after folding, median 77°; Cub nose-over: 7 (71-73°); metal Cessna: 14 (alloy, and the steel vessel members) | DEFORM §7.1 #5: "steel tube bends without breaking; the fabric wraps the bent frame". A real thin-wall tube folds flat before it cracks *(no number sourced here)*. | Revisit `thf` for tubeFabric (and perhaps alloy) against a source. Fewer torn tubes and more folded ones is the look the user asks for. |
| C3 | **Engine-mount tubes released with zero strain** by the engine cluster's root cut | Jodel trunk 0: members 112-115; metal trunk 0: 112-115 and 118. (The Cub's mount folds instead.) | The mount comes off rigid and its tubes never bend. Real mounts bend and tear at the welds. | The mount struts yield before the cut fires, or the cut fires on the struts' own state. |
| C4 | **Gear legs released with zero strain** by the gear cluster's cut | Cub trunk 2.5: 380; Jodel trunk 0 and trunk 2.5: 478; metal trunk 0 and trunk 2.5: 428 | A gear leg bending is a known real mode (DEFORM §7.3). Today it flies off straight. | As C3. |
| C5 | **Wing members released at zero strain** (cluster cut, no group) | Cub: 192-195; Jodel trunk 0: 308-317; metal trunk 0: 264-267 | The panel leaving at its root is right. The spar caps never strain, so no splinter follows from the physics. | Drawing only: part them at the root end (§10.3). A wood spar's root may be drawn splintered. |
| C6 | **Wood "kink"** (compression to 3 %) is a break | Jodel trunk 0: 10 wood (5 fuselage); trunk 2.5: 6 | Crushed wood keeps carrying compression (the floor does) and some tension. | Low priority; the drawing shows a crush band, one piece. |

### 10.5 What the page needs from the solver, per member, at an event only

| Item | In `30_solver.js` | On the page today | Missing / to add |
|---|---|---|---|
| material class | def `beams[i].mat` (tubeFabric / alloy / wood / ...) | yes (the page builds the def) | — |
| section size | `b.A`; the drawn radius or width in the snapshot | measurable from the member's places at binding | — |
| **how it broke** | `beamBreak(bi, how)`: only the first break's `how` is kept (`DMG.firstBreak`) | no | **a per-member code** (`Uint8Array` `DMG.how[bi]`: tension / kink / fold / ragged / group / cut / core), sent with the broken list |
| break station | fold: `b.kt1`. Kink, tension, release: none | no | for fittings and bonds, **which end is the fitting** (`b.fitEnd`, stamped where `61_gen_frame.js` tags the seam); the other stations can be seeded on the page |
| hinge station, depth | `b.kt1`, `b.dk` (trunk bends), `b.ks` (the chord deficit) | no (`simDmgHop` sends `ks` only for the set colour) | **send `kt1`, `dk`** for members whose bend moved, quantised, at events |
| bend axis | `b.dTx dTz dNx dNz` (horizontal: trunk bends only) | no | **send them** with `kt1`. A kink has no axis in the solver; the page seeds a side, or reads it off the neighbours' lateral motion |
| plastic set | `b.L0`, `b.Lr` | implicit: the live chord against the def's rest length | — |
| wood state | `b.rgS` (ragged stage), `b.kink`, `dk` with not broken (greenstick) | no | covered by the `how` code plus `dk` |
| grain axis | along the member | trivially | — |

About 8 bytes per changed member. 100 members is under 1 kB per event, on the damage hop that already carries the
broken list.

### 10.6 The cost (the user's "beware of performance")

Targets from the brief: 0 new draws, 0 program links at a crash, 0 per-frame CPU after the event.

| Technique | Triangles | Event CPU (10 broken + 30 bent) | Per frame after the event | Draws | Meets the targets? |
|---|---|---|---|---|---|
| Parting rule (fittings whole, kinks unsplit) | 0 new | well under 1 ms: a pass over the broken members' places, in the existing event (budgeted 8 ms a frame) | 0 | 0 | **yes** |
| Member pool, steel tube slot | 272 bent / 320 torn | slot state for 40 members: **~10 µs** measured; one small `texSubImage` | 0 CPU (the node texture is DMG-SKINGPU's); GPU vertex work on used slots only | **+1 while a wreck exists** (+1 more if it casts shadows; it need not) | **links: yes. CPU: yes** (except bent-before-any-break: ~4 kB node upload a frame). **Draws: no, +1** |
| Member pool, alloy slot | 414 buckled / 828 torn (two pieces) | (in the above) | as above | (the same draw) | as above |
| Member pool, wood slot | 480 broken | (in the above) | as above | (the same draw) | as above |
| Pool total in a 30 m/s crash | 27-98 slots, about 10-45 k triangles; 0 at rest | — | — | — | — |
| (a) Bake rings into every member | +10.5-30 k always (+12-24 %), and in every shadow pass | 0 | 0 | 0 | draws yes, **but always-on triangles**; a cage-generator change |
| CPU mirror (the prototype building every vertex itself) | — | 21 ms for 11 k triangles | — | — | **not done in the game**: it is what the vertex shader replaces |

**The flag.** "0 new draws" cannot be met with bendable members unless every member carries extra rings all the
time (a). The pool's one draw exists only after a crash. That is the better trade under "beware of performance".
Deform and the user decide.

### 10.7 Files, owners, and the in-game test (Deform's next step)

| Change | File : function | Owner |
|---|---|---|
| `how` per member, `fitEnd`, bend data on the hop | `src/core/30_solver.js` (`beamBreak`, the damage state); `src/core/61_gen_frame.js` (the seam stamp); `src/viewer/sim_host.js simDmgHop`, `sim_view.js simViewDmgState` | Deform |
| The parting rule | `src/viewer/skin_break.js` `event()` (the per-place side for tube, wood-frame and alloy-frame places), `tubePieces` | Deform |
| The member pool (parked mesh, slot texture, vertex and fragment shader) | new `src/viewer/dmg_members.js` (beside `ground_scar.js`); `app.js` roll-out compile list and `brkCage` | Deform |
| Hide a pooled member's snapshot triangles | `skin_break.js` (the index collapse, `dead` marks) | Deform |
| Calibration C1-C4 | `30_solver.js`, `60_gen_spec.js GEN_CRASH` (`thf`), the clusters | Deform (physics) |

**The in-game test** (brief 2 §2): a switch, OFF by default. On the Cub, the Jodel and the metal Cessna:

- before/after stills at the trunk 0 and trunk 2.5 crashes and the nose-over;
- the cost against master: draws, triangles, the crash's worst frame (the DMG IMPACT LAG rig, `dmg_skingpu_box`),
  and normal flight ABBA.

### 10.8 The prototypes added (node only; run from `futureDesigns/dmg-looks/`)

| File | What it does | Output |
|---|---|---|
| `structure_census.js` | The four standard crashes on the three validated builds, each member's end state and `how` | `structure_census.json`, the §10.1 table |
| `structure_mesh.js` | The flown snapshot's frame meshing | `structure_mesh.txt` (§10.2) |
| `structure_proto.js` + `raster3d.js` | The pool's pose functions per material and the pictures | `steel_cage.png`, `alloy_frames.png`, `wood_members.png`, `structure_cost_proto.txt` |
