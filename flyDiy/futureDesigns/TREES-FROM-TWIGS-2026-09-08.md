# TREES FROM TWIGS — a species generator on generated source art

2026-09-08, on the user's proposal: *"I looked for assets on the web… obviously
it's going to be hard to have consistent quality and have exactly the species
that I want. So I want to try something else."* He has generated, by image
model, twigs and tileable bark for **western hemlock, Sitka spruce, yellow
cedar, alder**, plus blueberry, grasses, small-plant atlases and dead branches
— the Admiralty Island flora. The question: is a generator on that basis
realistic, is there literature, can the LODs and billboards be derived, and can
shadows be baked in.

**Short answer: yes, it is realistic, it is the standard pipeline, and it is
not research.** The risk is not the generator. It is the normalisation of the
source art, and it is described in §3 because that is where the quality will be
won or lost.

Companion to `WORLD-V2.md` §8.3 (the ladder R1–R4) and
`RENDERER-DECISION-2026-09-07.md`. Relates to `tools/tree_inspect.js` and
`tools/_trees.html` (the W0a bench) — see §8, which is a real tension.

---

## 1. THE DECOMPOSITION IS RIGHT, AND IT IS WHAT THE INDUSTRY DOES

The user's proposal — *twigs for trees, branches for bushes, atlases for small
plants* — is exactly the standard decomposition, and worth stating in the
project's own terms because it is the thing that makes the rest tractable:

| layer | source | built by |
|---|---|---|
| **skeleton** (trunk, branch orders) | nothing — parameters | the generator |
| **bark** | tileable texture (generated) | mapped along branch cylinders |
| **foliage** | **the twig** — the atomic unit | instanced at the tips of the last branch order |

SpeedTree, Blender's Sapling, and every film foliage pipeline work this way.
The twig is the atom; everything above it is procedure. This is why *four or
five species* is a tractable scope and "a tree generator that does everything"
is not — the user's instinct to narrow is the correct one.

**One correction to the twig as imagined.** For a conifer, a twig must not be a
single flat card. A hemlock or spruce twig is a spray with thickness; one card
reads as a razor blade edge-on, and at a strip you will be standing next to
these. Build the twig as **2–4 cards in a shallow fan or V** (or a tiny custom
mesh), from the SAME generated image. Cost is trivial, and it is the difference
between foliage and cardboard. Alder, being broadleaf, can be flatter.

---

## 2. THE LITERATURE — abundant, mature, and one paper does most of it

The user is right that this is well covered. Nothing here needs inventing.

- **Weber & Penn, "Creation and Rendering of Realistic Trees", SIGGRAPH 1995.**
  THE reference, and the right primary for this project. A parametric model of
  ~100 numbers organised by recursion level — `nLevels`, `nBranches`,
  `nLength`, `nCurve`/`nCurveBack`/`nCurveV`, `nDownAngle`, `nRotate`,
  `nSegSplits`/`nSplitAngle`, `Ratio`, `RatioPower`, `Scale`, `Lobes`, `Flare`.
  It is species-parameterised BY CONSTRUCTION, which is precisely the ask.
  Conifers sit comfortably in its range: whorled branching, strong apical
  dominance and a conical envelope are what `nRotate`, `nDownAngle` and the
  per-level length ratios express directly.
  Implementations to read rather than rewrite: **Blender's "Sapling Tree Gen"
  add-on** (ships with Blender) and **Arbaro** (Java). Both carry parameter
  sets that are a starting point rather than a blank page.
- **Prusinkiewicz & Lindenmayer, "The Algorithmic Beauty of Plants" (1990).**
  The L-system bible, free online. More use here for the HERBACEOUS layer —
  blueberry, ferns, grasses — than for the conifers.
- **Runions et al., "Modeling Trees with a Space Colonization Algorithm"
  (2007).** Branches grow toward attraction points sampled inside a crown
  envelope. ~200 lines, and the right tool when you want a SPECIFIC
  SILHOUETTE — which is the case for a species you can point at. Worth having
  as the alternative for alder and for wind-flagged coastal forms.
- **Palubicki et al., "Self-Organizing Tree Models for Image Synthesis"
  (SIGGRAPH 2009).** Light competition and bud fate. More faithful, more
  machinery. Not needed for five species; read it for the crown-density ideas.
- For the far tiers: the **octahedral impostor** technique (the Unreal
  writeups are the clearest) is the modern standard for §8.3 R2.

**Recommendation: Weber–Penn as the primary, space colonisation held in
reserve.** Do not write a new model.

---

## 3. THE REAL RISK — SOURCE NORMALISATION, NOT THE GENERATOR

The user already named the failure mode for downloaded assets: *"hard to have
consistent quality."* **Generated assets have the same disease in a different
form**, and it must be treated as a pipeline stage rather than as care taken
while prompting.

**3.1 Scale is the killer, and it is invisible.** A generated hemlock twig
carries no size. If a twig that is 10–14 cm in life is placed at 40 cm, the
tree does not look like a bad tree — it looks like a MODEL, and nobody can say
why. This is the single most common reason AI-sourced foliage reads wrong.
**Every twig plate gets a declared `cm_across`, measured against botanical
reference, stored beside it, and the generator works in metres from there.**
Non-negotiable; everything else can be tuned by eye, this one cannot.

**3.2 Lighting and colour drift between generations.** Separate prompts give
different key direction, exposure and colour temperature. Two twigs on one tree
with different implied suns is instantly legible. Fix: nominate **one reference
plate** per species group and run a calibration pass — flat-field, white
balance and exposure matched to it. `tools/_trees.html` already does exactly
this for the downloaded packs (`REFNAME = …; // the colour others are brought
to`), so the idiom exists in the tree bench today.

**3.3 Alpha is the hard part, and it has two classic bugs.**
- **Cutout.** Generate on a flat, contrasting, non-green background; key it,
  then erode a pixel. Soft generated shadows and antialiased edges carry
  background colour into the fringe.
- **Colour dilation under the alpha (MANDATORY).** Bleed RGB outward into the
  transparent region before mipmapping. Without it, mip levels average
  transparent black into the edges and the canopy goes dirty and dark at range
  — the classic "my forest looks muddy from the air", which in a flight sim is
  the view that matters.
- **Mip alpha coverage.** Plain alpha-test foliage THINS OUT with distance as
  mips soften the mask, so a dense canopy dissolves exactly where §8.3 R4
  wants density. Preserve coverage per mip (raise the cutoff or rescale alpha
  per level so drawn coverage stays constant), and prefer alpha-to-coverage /
  alpha hashing over a hard test. This is cheap and it is the difference
  between R2 working and R2 looking like a haze.

**3.4 Normals and thickness, derived not authored.** A crude height-from-
luminance normal map is adequate for foliage. More valuable is a **thickness/
translucency** map (derivable from luminance and alpha) — see §5.

---

## 4. LODs AND BILLBOARDS — where it is automatic and where it is not

The user asks whether these can be derived. Mostly yes, with one honest
exception, and the exception is an argument FOR the generator.

- **LOD0 → LOD1: REGENERATE, do not decimate.** Automatic decimation of
  alpha-card foliage destroys the silhouette, because the silhouette lives in
  the alpha and not in the mesh. A generator has the answer a scanned asset
  cannot: **rebuild at lower recursion with fewer, larger twig cards** from
  the same parameters and the same source plate. This is a genuine advantage
  of this approach over the downloaded packs and should be stated as one.
- **LOD2: the octahedral impostor, baked at build time from LOD0.** Fully
  automatic — render N×N views over the hemisphere into an atlas carrying
  albedo, normal and depth. `WORLD-V2.md` §8.3 R2 already requires the atlas
  be baked FROM the near asset; a generator guarantees it.
- **LOD3: the canopy shell** (§8.3 R3), which is terrain, not trees.
- **Small plants get no LOD at all** — the user's own call, and it is right.
  Scatter, then fade out with distance. They are never seen from the air.

---

## 5. "BAKE THE SHADOWS IN" — SPLIT THE ASK, AND THE PROJECT HAS ALREADY RULED

This must be separated, because half of it is essential and half of it fights a
ruling the project already made.

**YES — bake AMBIENT OCCLUSION.** View- and sun-independent, and it is what
stops a procedural tree looking like plastic. Two places: per-vertex on the
branch geometry, and into the twig cards' vertex colour, darker deeper inside
the crown. Free at runtime, large effect. Do this.

**NO — do not bake DIRECTIONAL SUN SHADOW into the plates.** The game has a
day–night cycle, and `ISLAND-ADMIRALTY.md` §1 already rejected exactly this for
terrain imagery: *"carries baked lighting and shadows that fight a dynamic
sun."* The same argument holds for a twig, and a twig is worse — it is
instanced thousands of times in every orientation, so a baked key direction is
wrong on most of them. **Any generated plate that arrives with a visible cast
shadow must have it flattened in the normalisation pass (§3.2), not kept.**

**What is actually being wanted here, and it is better than a baked shadow:**

- **Translucency / transmission.** Backlit foliage GLOWS, and its absence is
  what makes untextured procedural trees read as dead. A cheap wrap-light term
  driven by a thickness map does more for realism than any baked shadow, and
  it stays correct as the sun moves.
- **Normal bending.** A card shaded with its true flat normal looks flat. Blend
  the shading normal toward the crown's outward direction (from the tree's
  centre, or a baked canopy normal) so the crown shades as a VOLUME. This is
  the trick that makes game foliage look round, it costs nothing, and it is
  very likely the effect being reached for by "bake the shadows in".
- **Real dynamic shadows** stay the renderer's job, and the aeroplane's shadow
  crossing the canopy on short final is worth more than anything baked.

---

## 6. WIND — DECIDE IT NOW, NOT LATER

Foliage wind is vertex animation driven by a **stiffness/phase attribute: 0 at
the trunk, 1 at the twig tip.** Only the generator knows the topology that
produces that number, so retrofitting it means re-authoring every asset. It is
nearly free to emit at generation time. Emit it whether or not wind ships.

The project has a live wind field already (`world.wind(x,y,z,t)`), so the
foliage can eventually agree with what the aeroplane is flying through — which
is the kind of coherence this project is actually about.

---

## 7. THE PIPELINE, PROPOSED

Offline, node-side, matching the project's existing idioms (`props_table.py` +
`_props.html`, `tree_inspect.js` + `_trees.html`):

```
assets/treeSrc/<species>/            generated plates, as received
  twig_*.png  bark_*.png  dead_*.png  atlas_*.png
  species.json      <- cm_across per plate, reference plate, botanical notes

tools/tree_src_prep.py               NORMALISATION (§3): key, erode, dilate
                                     under alpha, colour-match to reference,
                                     resample to declared scale, derive normal
                                     + thickness, emit mip-coverage tables

tools/tree_gen.js                    WEBER-PENN (§2) -> trunk/branch mesh +
                                     twig instances + AO + wind attribute;
                                     one parameter block per species x age;
                                     seeds give variants
                                     -> GLB, through the EXISTING import path
                                        (docs/MODEL-IMPORT-PROC.md)

tools/tree_bake.js                   LOD1 regenerate, LOD2 octahedral impostor
tools/_trees.html                    the bench, unchanged in role: it DRAWS
```

**Set size.** 4–5 species × 2–3 age classes × ~6 seeds ≈ 60–90 trees. A fixed,
small, hand-checkable set — which is why this is offline and not a runtime
generator. Runtime variety comes from rotation, scale and the tint ramp the
renderer already applies (`setColorAt`, per-species colour ramps in
`_base_render_world.js`).

**Snags.** Standing dead trees are characteristic of Southeast Alaska old
growth, and the user already has dead-branch plates. A snag is the generator
with foliage off and a broken top — nearly free, and it is the detail that will
say "this is a temperate rainforest" rather than "this is a forest".

---

## 8. THE TENSION WITH THE BENCH THAT LANDED TODAY — and the recommendation

`tools/tree_inspect.js` states its governing rule plainly:

> *"The rule that governs what happens next: IMPORT AS-IS. Where a pack ships
> an LOD chain, that chain IS the chain — this tool reports it, it never
> proposes to build another one."*

That is the correct rule for downloaded packs and the **opposite** of what a
generator does. These are two pipelines, and the project should say which is
which rather than let them blur.

**Recommendation: keep both, for different jobs, and do not stop the spike.**

1. **`assets/treesRaw` is not wasted and must not be deleted.** It becomes
   (a) the **silhouette and colour calibration target** — real packs are how
   Weber–Penn parameters get judged, and `_trees.html` already brings assets
   to one reference colour; (b) the **fallback** if the generator runs long;
   and (c) the **stand-in for W0**.
2. **W0 — the tree spike — should run on the DOWNLOADED packs, now, in
   parallel with the generator work.** W0 exists to answer a PERFORMANCE and
   PLATFORM question: real density, frame time, and which wall is hit
   (`WORLD-V2.md` §11). It does not need beautiful trees, only representative
   ones — right triangle counts, right card counts, right overdraw. Blocking
   the renderer decision on an art pipeline would be a category error, and it
   is exactly the coupling W0 was designed to avoid.
3. **The generator is the R1 answer** and lands into the ladder when it is
   ready. `CREDITS.md` §"Trees, billboards and terrain" already says the
   candidates are under evaluation and none ships — so nothing has to be
   unwound.

---

## 9. IS THE QUALITY REACHABLE? — the honest estimate

Yes, and the ceiling is high: this is how good-looking games make trees. But it
is not a weekend, and the plan should not pretend otherwise.

| stage | effort |
|---|---|
| source normalisation (§3), including the scale audit | a few days, mostly once |
| Weber–Penn params to convincing conifers | 1–2 weeks — the parameters take real fiddling, and this is where a reference silhouette earns its keep |
| twig assembly (multi-card), AO bake, wind attribute | a few days |
| impostor bake + LOD1 regeneration | a few days, well-trodden |
| translucency + normal bending in the material | a few days, and the biggest per-day payoff of anything on this list |

Call it **four to six weeks of evenings to a forest worth flying over** —
bounded, sequential, no research risk. The two things that decide whether it
looks good are both in §3 and §5, not in the branching model: **declared scale**
and **foliage shading**. A mediocre skeleton with correct scale and good
translucency reads as a forest; a perfect skeleton at the wrong scale with flat
cards does not.

---

## 10. RULINGS OWED

- **(x)** Weber–Penn as the branching model, Blender Sapling / Arbaro as the
  parameter starting point rather than a fresh implementation. Recommended.
- **(y)** AO baked, directional sun NOT baked, translucency + normal bending
  in the material instead (§5). Recommended — and it follows a ruling the
  project already made for terrain.
- **(z)** W0 runs on the downloaded packs, in parallel; the generator is R1 and
  does not gate the renderer decision (§8). Recommended.
- **(aa)** Offline generation to GLB through the existing import path, not a
  runtime generator (§7). Recommended.
- **(ab)** `cm_across` declared per plate, and a scale audit gate that fails a
  species whose twig is outside a botanical band (§3.1). Recommended — this is
  the cheapest gate in the document and it catches the most damaging error.
