# WORLD V2 — the island, and the three resolutions it is made of
## Sizing, erosion, terrain material, and the modifier layer the editor will write
### (2026-09-01, from the user's design session)

STATUS: specification, unimplemented. Written to be handed to an
implementation session.

WHAT IT RELATES TO:
- `futureDesigns/WORLD-CONTRACT.md` — the pure deterministic data API. §5 below
  **amends one of its principles deliberately**, and says so.
- `futureDesigns/WORLD-GEN-PROC.md` — stages 0-5, all DONE. This is the sequel:
  the bake it describes stays, and grows a resolution ladder under it.
- `src/core/20_world.js` (`h0`, `terrainH`), `21_world_hydro.js`
  (`bakeHydrology`), `25_airfield.js` (`AIRFIELD_SITE`), `src/viewer/render_world.js`.
- ROADMAP P11 (the world glow-up). This is that item, specified.
- **The airfield editor is NOT specified here.** §9 settles the DATA it writes,
  because `terrainH` has to compose it; the editor itself is its own document.

---

## 0. THE RULE, IN ONE LINE

**Three resolutions, and each one earns its place: 49 m eroded everywhere,
4 m eroded where you land, and vector modifiers where somebody decided
something.**

---

## 1. WHAT EXISTS TODAY (measured, 2026-09-01)

**The good news is that almost every mechanism this spec needs is already
built, at the wrong scale or at the wrong fidelity, but built.**

| | today |
|---|---|
| domain | 24 × 24 km, bounds ±12000 |
| terrain | pure analytic `h0`: 5-octave fbm, IQ domain warp (320 m), ridged noise, altitude terracing above 120 m |
| hydrology | `bakeHydrology` — priority-flood (Barnes 2014), D8 routing, accumulation, river polylines, lakes. **512² grid, 46.9 m cells, ~0.55 s at `makeWorld()`** |
| erosion | **none.** Rivers CARVE, but nothing erodes. |
| terrain mesh | two rings — 17.6 m polys over ±4500, ~100 m strips to ±12000, fog caps ~5 km |
| terrain colour | vertex colour by altitude band (`MEAD`/`GRASS`/`HEATH`/`ALP`/`ROCK`/`HIGH`/`SNOW`/`SHORE`) + two-scale patch noise, baked per ring |
| terrain material | **none.** No normal map, no detail texture, no triplanar, no splat. |
| trees | `CylinderGeometry(0.16, 0.26, 1.9, 5)` + `ConeGeometry(1.7, 5.4, 7)` + `IcosahedronGeometry(2.05, 0)`, five species by colour ramp and non-uniform scale, chunked, **with a working impostor ladder (W17) whose atlas is rendered at boot from that same geometry** |
| ground materials | `site_tex.js` — **ten CC0 scans already shipped**: brushed, cracked, antislip, asphalt, asphaltaerial, grass004, grass005, leafygrass, ground003, dirt |
| surfaces | `SURFACE` enum (GRASS ROCK SCREE FOREST_FLOOR WATER PAVED GRAVEL SAND) and, since G115, a friction row per surface |
| terraform | **two hardcoded rectangles with smoothstep falloff inside `h0`** — see §9 |

Two diagnoses worth stating before any work is planned.

**THE UGLINESS IS NOT THE GEOMETRY.** It is, in order of impact: no terrain
material at all (altitude-banded vertex colour is a coloured paste); 17.6 m
polygons under an aeroplane about to land; tree SOURCE geometry; and fog
standing in for aerial perspective. The first is the cheapest to fix and the
largest win, and the ten scans it needs are already in the build.

**THE TREE PROBLEM IS NOT THE LOD.** The impostor ladder, the chunking, the
species system and the per-species tinting are all done and working. The
atlas is baked at boot from the near-tier geometry — so the impostors are
faithful impostors OF A CONE AND A BLOB. Replacing the source geometry
upgrades every tier at once and touches none of the machinery.

---

## 2. THE SIZING DECISION

### 2.1 The user's arithmetic, and the answer to it

200 km/h × 1 h ⇒ 200 km corner to corner. **The 200 km box is kept.** What is
rejected is the 1 m grid that came with it:

    200 000 × 200 000 samples = 4 × 10^10 = 80 GB at int16.

Not "expensive": impossible, and unnecessary twice over.

**It is never stored.** A geometry clipmap gives 1 m under the aeroplane at a
cost independent of world size:

| level | spacing | extent (255² grid) |
|---|---|---|
| 0 | 1 m | 255 m |
| 4 | 16 m | 4 km |
| 7 | 128 m | 33 km |
| 10 | 1024 m | 261 km |

11 levels × 255² ≈ **1.4 M triangles, constant**, covering 261 km.

**And it is never needed.** At 300 m slant range a 1 m feature subtends ~6 px
on a 1080p / 60° view; at 1 km, ~2 px. One-metre GEOMETRY matters inside a
~500 m bubble and nowhere else. Beyond it, normal maps and objects carry the
detail — which is what every shipping flight simulator actually does: MSFS is
~30-90 m elevation (1-5 m LiDAR in places), X-Plane 30-90 m, DCS 50-100 m. The
"1 m look" is textures, objects, material response, and erosion structure.

### 2.2 The shape: a long island with a spine

A square is rejected in favour of a **long island with a mountain spine**, for
three reasons the user gave: it forces the crossing, the sea hides the world
edge, and it concentrates content along an axis instead of spreading it over
an area.

    TARGET: land mass ≈ 250 × 90 km, inside a 200 km working box.
            ~22 000 km² of land.

Real anchors: **Corsica 183 × 83 km** (spine, coastal plains, real bush
strips — the closest match), New Zealand's South Island 800 × 200 (the
canonical bush geography), Kodiak 160 × 108.

**Site budget: ~40.** Two main aerodromes, one at each end of the spine, so
that *crossing the range* is the signature flight; ~8 secondary fields in the
valleys and on the coast; ~30 bush strips on beaches, river bars, ridge
shoulders and moraine terraces. That is one site per 25 × 25 km — the density
of a real bush region, and comparable to DCS Caucasus (400 × 400 km, ~25
airfields).

**Consequence to design for:** the horizon at 3000 m is 195 km. On this island
you will see from one end to the other, so **aerial perspective is a first-
class renderer feature, not a polish item.**

---

## 3. THE THREE TIERS

| tier | resolution | extent | weight | residency | authored? |
|---|---|---|---|---|---|
| **1 · base** | 49 m | whole island | ~34 MB int16 | always | no — baked offline |
| **2 · hero tiles** | 4 m | ~4 km square per site | ~2 MB each | streamed, 3-5 resident | no — baked offline |
| **3 · modifiers** | vector | the decision itself | ~KB total | always | **yes — the editor** |

### Why the tiers, and why exactly these

**Tier 1** is the honest ceiling for in-browser-scale erosion (§4). 4096² over
200 km gives 48.8 m cells — *the same cell size the project runs today over
24 km*, on a map 70× larger. Nothing about the hydrology's physical
normalisation changes: thresholds are already stated in drainage AREA
(`A0m2`), explicitly so "the same rivers emerge at any resolution".

**Tier 2** is the user's own optimisation, and it is the large one. Uniform 8 m
over 200 km is 625 M cells — impossible. 49 m everywhere plus 40 tiles at 4 m
is 16.8 M + 42 M cells and ~118 MB total, of which only ~10 MB is ever
resident because you are near one site at a time.

**Tier 3** is where the editor lives, and it is measured in kilobytes.

### The rule that keeps this honest

> **Tiers 2 and 3 exist only where somebody decided something. Tier 1 and the
> analytic detail above it exist EVERYWHERE, because a bush aeroplane may land
> anywhere.**

This is the one place to resist the optimisation. "Detail only near designated
sites" is right for AUTHORED detail and wrong for PROCEDURAL detail: the heart
of bush flying is putting it down on a gravel bar nobody designated, and if
detail stops outside the hero tiles, that landing happens on painted paste. The
clipmap serves procedural detail everywhere for free; only the eroded grid and
the authored objects are site-local.

---

## 4. EROSION

### 4.1 Where it runs

**Offline, in a node tool, shipped as an asset.** Today's 0.55 s browser bake
becomes minutes at 4096² with erosion iterations. This is a change of kind, not
of degree, and it is the reason tier 1 is an asset rather than a computation.

Payload management: ship the eroded field as a **delta from the analytic
base**, not as absolute heights. The delta is smoother, compresses far better,
and keeps `h0` meaningful as the fallback wherever a tile is missing.

### 4.2 The resolution ladder, priced

For a 200 km domain:

| grid | cell | cells | int16 raw |
|---|---|---|---|
| 512² | 390 m | 262 k | 0.5 MB — today's grid, useless at this scale |
| 2048² | 98 m | 4.2 M | 8 MB |
| **4096²** | **49 m** | **16.8 M** | **34 MB** ← tier 1 |
| 8192² | 24 m | 67 M | 134 MB — offline only |
| 16384² | 12 m | 268 M | 537 MB — offline only, tiled |
| 200000² | 1 m | 4 × 10^10 | 80 GB — impossible |

Hero tiles are the same machinery on a 4 km window: 1024² at 4 m.

### 4.3 The rule that makes 49 m look like 1 m

**Detail below the bake is SYNTHESISED, and it is GUIDED by the erosion, never
free.**

The eroded pass already produces, per cell, everything needed to steer it:
flow accumulation, slope, curvature, aspect, and fill depth. Detail whose
amplitude, frequency and character change because a point is on a ridge, in a
gully, on a scree slope or on a valley floor **reads as eroded all the way
down**. Free fbm at the same amplitude does not, and this is exactly the defect
the user named in MSFS ("l'érosion a fait un job superficiel"): real elevation
data with generic noise beneath it.

This is the single highest-value idea in this document and the one place where
this project can beat a commercial simulator at the altitude it is flown at.

`bakeHydrology` already computes accumulation and does priority-flood and D8
routing. **The infrastructure exists; the iteration loop and the guide-field
export do not.**

---

## 5. THE COMPOSITION CONTRACT (an amendment, taken consciously)

`WORLD-CONTRACT.md` states: *"The continuous `terrainH` never reads a stored
heightmap"*, composing analytic base + SDF modifiers. **V2 breaks that**, and
the replacement is:

    terrainH(x, z) =  bilinear( base delta, 49 m )        // tier 1, baked
                    + bilinear( hero delta, 4 m )         // tier 2, if resident
                    + h0(x, z)                            // the analytic base
                    + guidedDetail(x, z, guides)          // §4.3, analytic
                    + Σ modifiers(x, z)                   // tier 3, §9

Four properties this must keep, all of which V1 has and none of which are free:

1. **Determinism.** Same inputs, same bytes, on any engine. GATE WORLD's golden
   hashes are re-captured in the commit that changes the world, never after.
2. **One authority.** Physics, renderer and gates read the same composition.
   The renderer may resample; it may not re-derive.
3. **C¹ continuity.** Every modifier blends with a smoothstep falloff, as the
   existing runway carve and meadow blend already do.
4. **Hot-path budget.** `h0` is called per node per substep — up to ~8000
   times a frame. **This change makes it CHEAPER**: a bilinear lookup beats a
   5-octave warped fbm. The analytic terms that remain are the detail ones,
   and their octave count is now a budget to spend deliberately.

**A missing tier must degrade, never fail.** No hero tile ⇒ tier 2 term is
zero and the base carries. No base asset at all ⇒ `h0` alone, which is the
world as it is today. That fallback is what lets the gates run headless and
lets a build ship before the bake exists.

---

## 6. RENDERING, IN ORDER OF IMPACT

### 6.1 Terrain material — do this first

Replace altitude-banded vertex colour with a **splat material**: a small set of
tiling PBR materials (colour + normal + roughness), selected per fragment by a
weight set, sampled triplanar on steep ground.

Two properties that matter:

- **Texture cost is bounded by the MATERIAL COUNT, not by world size.** A
  200 km island costs the same as a 24 km one. This is what makes the whole
  sizing decision affordable.
- **The weights are already computed.** The `SURFACE` classifier exists, the
  biome stage exists, and the erosion guides (§4.3) give slope, accumulation
  and curvature — which are exactly the right splat inputs (rock on steep,
  scree below cliffs, silt on valley floors, gravel along channels).

Start from the ten CC0 scans already shipped in `site_tex.js`; grass004,
grass005, leafygrass, ground003 and dirt are directly usable, and the hangar's
`PARTS`/`LIB` wardrobe is a proven pattern for the per-surface tile / roughness
/ normal dials.

### 6.2 Geometry — the clipmap

Replace the two-ring mesh with the ladder in §2.1. It removes the ring seam,
the ~100 m far strips and the 5 km fog cap in one move, and it is what makes
1 m ground under the wheels possible at all.

### 6.3 Trees — replace the source geometry, keep the ladder

The impostor system, chunking, species and tinting all stay. Only the near-tier
geometry changes, and every tier improves because the atlas is baked from it.

### 6.4 Aerial perspective

Fog is not distance. On a 250 km island seen from 3000 m (195 km horizon),
height-dependent extinction and in-scattering are what separate a landscape
from a model.

---

## 7. SITE NOMINATION — where the semi-manual starts

Once the erosion is baked, slope, flow accumulation, curvature and elevation
are known everywhere. A pass can **score landability** and NOMINATE sites:
flat run length, cross-slope, approach clearance along the two axis
directions, surface class, distance to water, and elevation.

    river bars · ridge shoulders · beaches · moraine terraces · valley flats

**The author then PROMOTES, rather than searches.** Over 22 000 km² that is the
difference between forty sites and four, and it is the same pattern the project
already uses twice: the seating starter and the nose configuration — a
high-level intent, derived details, everything editable afterwards.

Nominations are DATA (a scored list), not terrain. Promoting one creates a site
record; the rest stay as candidates the game may use for emergent missions.

---

## 8. BUDGETS

| item | budget | note |
|---|---|---|
| tier-1 asset | ≤ 35 MB | delta from `h0`, compressed |
| hero tile | ≤ 2 MB | 1024² × int16 delta |
| resident hero tiles | 3-5 | current site + neighbours |
| terrain triangles | ≤ 1.5 M | clipmap, constant |
| splat materials | ≤ 12 | texture cost is bounded by this, not by area |
| offline bake | minutes | node tool, not the browser |
| browser init | ≤ 1.5 s | WORLD-GEN-PROC's existing budget, preserved: the vector stages still bake at `makeWorld()` |
| `terrainH` hot path | ≤ today | bilinear + reduced analytic; measure, do not assume |

---

## 9. THE MODIFIER LAYER — settled here, edited elsewhere

The airfield editor is its own document. What belongs HERE is the data it
writes, because `terrainH` composes it (§5) and the format cannot be decided by
the UI that happens to author it.

### 9.1 The primitive already exists, twice, hardcoded

Inside `h0` today:

```js
const dxC = Math.max(0, Math.max(-3400 - x, x - 400));      // the corridor
const dzC = Math.max(0, Math.abs(z) - 750);
h *= 0.06 + 0.94 * sstep(0, 700, Math.hypot(dxC, dzC));

const dxR = Math.max(0, Math.max(-1180 - x, x - 130));      // the runway
const dzR = Math.max(0, Math.abs(z) - 90);
h *= sstep(0, 260, Math.hypot(dxR, dzR));
```

Each is a **terraforming polygon with a smoothstep falloff** — a rectangle, a
signed distance, a blend width — which is the central primitive of the MSFS
Scenery Editor, written by hand, in the physics hot path. Generalising these
two into a typed list is simultaneously the editor's foundation and half of
the world's quality.

It is also the same move `25_airfield.js` already made once and documented:
three copies of one runway had disagreed, so the runway became one declared
record both scenes read.

### 9.2 The modifier types

    flatten     polygon/rect + target height + falloff      (the two above)
    grade       polyline + width + longitudinal profile     (the strip)
    ramp        polygon + plane/profile + falloff           (aprons, shelves)
    surface     polygon + SURFACE enum                      (reaches physics)
    material    polygon + splat weights                     (paint)
    exclude     polygon + what to exclude (trees/rocks/…)   (placement pass)
    objects     placed instances from the prop registry

Every one carries a falloff and composes in a declared order.

### 9.3 The strip is a profile, not a rectangle

For bush flying the runway object must carry:

    centreline    polyline — bush strips CURVE
    width         may vary along it
    slope         longitudinal — and this is content, not decoration
    crossfall     camber
    surface       SURFACE enum → the friction row
    ends          displaced thresholds, overrun, blast pad

Two things fall out for free. **The surface reaches the physics immediately**:
`GROUND_SURF` already holds a friction row per surface (GRASS 0.05/0.45/0.80,
PAVED 0.02/0.55/0.90, GRAVEL 0.045/0.38/0.75, SAND 0.10/0.30/0.60). And a real
longitudinal slope gives the **one-way sloping strip** — land uphill, take off
downhill, whatever the wind — which is a signature bush-flying mechanic that
costs nothing once the profile is honest.

### 9.4 What NOT to take from the MSFS editor

- **The project → package → BGL compile pipeline.** Heavyweight, and against
  this project's grain: a declared record read by several consumers is better,
  and is what `AIRFIELD_SITE` already is.
- **The civil-airport object model** — ILS, procedures, frequencies, ATC.
  Enormous and irrelevant to bush flying.
- **The editor/sim separation.** This project's own precedent is better and is
  already ruled: *the editor IS the garage screen, there is no "back to the
  game" door.*

### 9.5 Two constraints the editor must be designed against

**Determinism.** An editor that MUTATES terrain breaks GATE WORLD silently. It
must only ever write modifier records that re-compose identically, and a world
change re-goldens in its own commit.

**Physics/render identity in the same frame.** Deform live and the renderer's
mesh and `terrainH` must agree immediately, or the aeroplane lands on ground
that is no longer there. The modifier list is the shared source; the renderer
rebuilds the affected clipmap levels. This is an architecture decision, not an
implementation detail, and it is taken here.

---

## 10. THE GATES

**GATE WORLD** (exists, extend). Golden hashes over the composed `terrainH`,
now including the tier-1 asset. Add: with tiers 1 and 2 absent, the composition
falls back to `h0` and reproduces today's world bit-identically.

**GATE TERRAIN** (new).
1. Composition is C¹ across every tier boundary and every modifier falloff —
   sampled, not asserted.
2. Physics and renderer sample the same height at the same (x, z), at every
   clipmap level.
3. A hero tile loading or unloading changes no height by more than the tier-1
   quantisation.
4. The hot path is within budget, measured against the current `h0`.

**GATE SITES** (new). Every nominated site is landable by its own declared
criteria — measured by flying the test pilot into it, which is machinery
`41_test_pilot.js` already provides.

**GATE SITE** (exists) extends to the multi-site registry — see `HANGARS.md` §6,
which needs the same change for the same reason.

---

## 11. STAGING

**W1 — the material.** Splat terrain material on TODAY's mesh and TODAY's
24 km world, from the ten scans already shipped. No new data, no new size, no
contract change. **This is the largest visible improvement in the document and
it is first because it depends on nothing.**

**W2 — the clipmap.** Replaces the two rings. Still 24 km, still analytic.
Removes the seam, the fog cap and the 17.6 m floor.

**W3 — trees.** New source geometry; the existing ladder inherits it.

**W4 — the offline bake.** The node tool, erosion at 4096², the guide fields,
the delta format, the `h0` fallback. Still on the 24 km domain, so the change
is provable against a known world before the map grows.

**W5 — the island.** Grow the domain, author the spine, re-bake. This is the
step that changes every golden, and it should be the step that changes ONLY
that.

**W6 — hero tiles + nomination.** Streaming, the landability pass, promotion.

**W7 — the editor.** Its own document, standing on §9's format.

The order is chosen so that each step is provable on a world that already
works, and so that the one step that invalidates every golden (W5) does
nothing else.

---

## 12. OPEN QUESTIONS

1. **Does the 200 km box stay, or does the island define the box?** This spec
   keeps the user's 200 km and puts a 250 × 90 island in it, which means the
   box is not square. Cleaner might be a 260 × 120 domain fitted to the land.
2. **Seeded or authored island?** WORLD-GEN-PROC's whole architecture is
   seed-driven and the shape functions are analytic. A hand-authored coastline
   and spine is a different thing: better art direction, no reseeding. A middle
   path — an authored MASK, procedural everything else — is probably right and
   should be decided before W5.
3. **Hero tile bake: authored or automatic?** §7 nominates automatically. Do
   hero tiles follow nomination (every promoted site gets one) or authoring
   (only sites somebody finished)?
4. **How much of `h0` survives?** With a baked eroded base, the analytic field
   becomes a fallback and a detail source. Its terracing and ridged terms may
   fight the erosion rather than help it, and that is worth measuring at W4
   rather than assuming either way.
