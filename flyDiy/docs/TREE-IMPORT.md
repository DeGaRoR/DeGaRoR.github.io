# IMPORTING A TREE

How a tree gets from a download into the stand, and the rules that keep the
next one consistent with the last. Written after W0a, from the six collections
that went through it.

The bench is `tools/_trees.html` (port 8358, `.claude/launch.json` entry
`flydiy-trees`). The inspector is `tools/tree_inspect.js`. The payload the game
will read is baked by `tools/tree_prep.py` — see §7 and §8.

---

## 1. Licence first, before anything is looked at

`tree_inspect.js` reads the licence out of each file's `asset.extras` and
classifies it. A collection whose licence forbids redistribution is **dismissed
and deleted**, not parked — the standing ruling from the first pass, applied to
the SKETCHFAB Standard files.

`CREDITS.md` is **regenerated from `asset.extras`**, never transcribed by hand.
A CC-BY row goes in when the collection is chosen, not at the end. Poly Haven is
CC0 and still gets a provenance row.

## 2. Inventory before import

    node tools/tree_inspect.js            # -> tools/_trees_index.json
    node tools/tree_inspect.js --print    # and the per-group table

The inspector decides *what a file contains*; the bench only draws. It reports
per collection: subjects, triangles per subject, textures and their resolution,
alpha mode and cutoff, licence. Four kinds only: **tree, shrub, billboard,
terrain**.

Three traps it exists to handle, all met in practice:

- **A pack is not a scene.** One download held 944 nodes and 546 meshes that
  were ten geometries copied. Subjects are found by geometry signature, not by
  name.
- **Names lie.** Grouping by mesh name split trunks from their own foliage.
  Subjects come from the NODE GRAPH; parts merge by overlapping XZ box, guarded
  by *disjoint material sets* — a trunk and its foliage never share a material,
  two whole trees always do.
- **Regexes must be segment-anchored.** `Back*ground*_Tree_Atlas` matched
  `ground` and put 13 billboard cards in the terrain bucket.

Nothing is imported until that table exists.

## 3. Import as-is

Never decimate or re-encode an import. The triangle budget is a **selection**
criterion, not permission to decimate a scan. Every rung below LOD0 is
*generated* by the bench (§5), from the finest rung as shipped — **a pack's own
LOD chain is not used**, in the bench or in the payload. W0c.2 had kept the
shipped chains ("the author's rungs are better than anything generated"), and
LOLIPOP's chain ends in a 20-triangle crossed billboard that the game then
drew by the ten thousand as its fill; the forest the user judged was the
bench's, which builds its own ladder for every pack. Undone in W0c.10.

## 4. Curate in the bench, then tune

Open the bench, walk the shelf, decide what is in the mix. Then, per collection,
in the right-hand rail:

| dial | what it is |
|---|---|
| `hue` `sat` `light` `bark` | colour, **measured then corrected** — `suggest` brings every collection to the reference's measured hue/lightness; taste rides on top |
| `alpha` | the leaf cutout threshold. Packs sit on completely different alpha scales — cedar's leaves at 0.63, larch's at 0.08 — and this is the dial that says so |
| `sink` | how far the model is pushed into the ground to bury roots it was authored with |
| `size` `proportion` | its scale, and its **share of the forest** |
| `dead` | the fraction planted as standing snags |
| `stick` | the generated stem's base radius, as a fraction of the crown's footprint |
| `impa` `implight` | the impostor's alpha gain and its light trim (§6) |

`export json` → `tools/_trees_tuning.json`, committed. The bench reads it at
boot; localStorage holds the working copy on top. **The committed file must
carry the values actually fitted** — a stale one means a fresh browser sees a
different tree from the one that was signed off.

## 5. The ladder every collection gets

Generated, not authored. The woody decomposition measured it: branch structure
is more than half a tree and reads as almost nothing past the first rung.

| | L0 | L1 | L2 | L3 |
|---|---|---|---|---|
| **specimen** (clearing edge, furnished to the ground) | full mesh | stick + foliage | stick + half foliage | impostor |
| **stand** (top third only, stretched and widened) | full mesh | stick + crown | stick + half crown | impostor |
| **snag** | full mesh | impostor | impostor | impostor |

A snag has no ladder: thinning branches off a bare trunk gives a worse bare
trunk, not a cheaper one, so it goes straight to an impostor — baked at a finer
tile (`IMP_TILE_HI`) because it stands in from L1.

Which series an instance gets is **how far it stands from an edge** — the rim of
the stand, or the lip of a procedural glade — with a `furnished` fraction mixed
through the interior, because a stand where every inside tree is a bare pole
reads empty at density.

## 6. The impostor bake, and the six things that will bite

All six were met and fixed in W0a. They are listed because each one presents
as "the impostor is missing / wrong" and none of them looks like its cause.

0. **BAKE A G-BUFFER, NOT A PHOTOGRAPH.** This is the one that matters and the
   one that was got wrong first. A sheet of final shaded RGB is 64 pictures of
   the tree taken under one sun: nothing can re-light a picture, so the far band
   does not answer to sunset, to night, to a moved light or to a shadow, and
   beside geometry that does it reads as cardboard. The atlas holds **albedo +
   opacity** in one sheet and the tree's **world normal** in a second, baked in
   the same loop over the same 64 camera bases so the two agree texel for texel;
   the billboard is then an ordinary `MeshStandardMaterial` whose `normal` comes
   out of the second sheet, and sun, hemisphere, environment and shadow map all
   reach it through the code path they reach the geometry through. This is what
   Epic's octahedral impostor baker writes and why SpeedTree ships a normal map
   beside every billboard diffuse. Two consequences worth writing down:
   - the **AO** has to go into the albedo, because there is no third channel for
     it — but the geometry SPLITS its occlusion (full exponent on the ambient,
     0.35 of it on the sun), and one albedo cannot. The sheet takes the middle,
     `pow(ao, aoBake * 0.5)`; with the full exponent the far band measured 0.82x
     the geometry's brightness.
   - the bake signature gets SHORTER, not longer. Sky, exposure and the leaf
     terms no longer reach the sheet, so they must stop invalidating it — a
     change of light used to cost fifteen rebakes. What does reach it now (and
     did not before) is the AO dial.
   - **the sheet is written in the TARGET's encoding, not the renderer's.**
     r128 picks it as `null !== target ? target.texture.encoding :
     renderer.outputEncoding`, and a `WebGLRenderTarget`'s texture is
     `LinearEncoding` by default. So an albedo pass under `outputEncoding =
     sRGBEncoding` lands LINEAR, and a draw that decodes it as sRGB is a flat
     2.2x too dark over the whole far band — which is exactly what the first
     G-buffer build shipped. Set `rt.texture.encoding = THREE.sRGBEncoding` on
     the albedo target, and keep sRGB rather than dropping the decode: eight
     bits of LINEAR is the wrong container for foliage, where an albedo near
     0.03–0.15 is eight to thirty-eight levels. The NORMAL target stays linear.

   Two dials come out of this and neither is a fudge. **`imp lit`** is the
   tier's own gain on everything the lights put in — and it must scale all FOUR
   reflected terms, because at roughness 1 the physical model's multiscatter
   term rides on the sky irradiance rather than on the albedo and measured 39.7
   of the band's 55.6 luminance; scaling only the diffuse left a floor that ate
   the dial. **`imp round`** blends the baked normal toward a hemisphere built
   from the quad's own uv; measured at MATCHED brightness it LOSES relief
   (sd 22.4 at 0 against 20.7 at 1, the geometry's being 26.4), so the default
   is 0 — the sheet's normals carry real per-card variation and smoothing them
   is a loss, whatever one expects of leaf cards. With the albedo right, every
   family's `implight` gamma goes back to 1.0 and ONE tier gain of 0.6 holds the
   far band within 7 % of the geometry across five skies.

   And a snag is not a crown. The alpha curve is centred on 0.40, which is right
   for a leaf texel only one of three views carries; a bare trunk's branch is
   one texel wide and arrives at 0.2–0.3 along its whole length, so it survives
   in places and is discarded in others and the branch comes and goes every few
   pixels. The snag series gets its own centre (0.10).

1. **Cache the SIGNATURE, not the name.** An atlas keyed on the tree's name
   outlives every fix made after it. Measured: cached max alpha 0 over 0 texels
   where a fresh bake of the same tree gave 255 over 215 184.
2. **Wait for texture decode.** `imageTex` sets `tex.image` in `onload`; a bake
   that runs first writes a tree-shaped RGB with no alpha at all.
3. **The tile rect lives on the RENDER TARGET.** `renderer.setViewport` is
   overwritten by any pass that re-binds a target — the shadow map does, once —
   and every tile after it draws at 8× magnification, clipped to its tile.
4. **The cutout threshold is per collection.** A flat floor is an absolute
   number over packs on different alpha scales: at 0.15 the larch lost its whole
   canopy (1–3 % tile coverage against cedar's 15–24 %). The bake must take the
   same step the screen's sharpen takes, at the collection's own cutoff.
5. **Coverage-preserving mipmaps for the sheet**, per tile — the 64 views are
   not equally dense. Without them the larch held 32 % of its canopy at a
   16-texel tile where the preserved chain held 111 %.

Then: the silhouette is the **union** of the three blended views, not their
average (three binary masks averaged put a texel carried by one view at a third,
which the alpha test throws away); and the light trim is a **gamma**, not a
multiply, so lifting dark foliage does not blow a pale trunk white.

Fit `implight` by measuring the impostor against its own geometry at the same
camera and **bisecting** — the Newton step oscillates. All six land within 2 %.
Refit it after ANY change to what the sheet holds — a trim fitted against an
older sheet is not a smaller error, it is a wrong number that looks like a tuned
one. That said, the better outcome is not needing it: under a correct G-buffer
the impostor's albedo IS the tree's albedo, and once the sheet's ENCODING was
right (§6 trap 0) every family came back to `implight` 1.0 with one global tier
gain carrying the difference. A big per-family spread is a smell — the first
refit produced 0.42 to 1.85 and every one of those numbers was compensating for
the same 2.2x encoding bug.

## 7. Bake it (W0b)

    python tools/tree_prep.py            # the collections _trees_tuning.json includes
    python tools/tree_prep.py --report   # inventory only, writes nothing
    node   tools/_tree_check.js          # GATE TREES

Writes `media/geo/trees/<collection>.<h8>.bin` (one binary per collection),
`media/tex/trees/*` (the maps) and `src/core/trees_pack.json` (the manifest).
Decoded by `src/core/53_tree_codec.js`, pure JS, no three.js.

**Geometry.** Positions int16 over the subject's box, normals int8, uvs uint16
over the part's own range, indices uint16 (uint32 where a subject passes 65 536
verts, which a tree does and a prop never did) — plus **one AO byte per
vertex**, with a foot-to-crown gradient on bark.

Every rung of a subject quantises over ONE box, and that box is the **union of
all of them**: a coarser rung is not a subset of the finest, and LOD1 overflowed
the int16 when the finest rung's box was used alone.

**Maps.** Base colour at the resolution the author shipped — a leaf map's ALPHA
IS THE TREE, and resizing a cutout thins its coverage. Normals at half. Metal /
roughness dropped: two collections ship none and the two that do ship a palette
or a bilevel image. Cutout maps are PNG because JPEG cannot carry alpha at all.

**The dials are not baked in.** `size`, `proportion`, `sink`, `dead` and the
colour corrections ride in the manifest as data, so a world editor moves them
without a re-bake.

**One thing the renderer still owes.** Every cutout material carries
`coverageMips: true` and its own `cutoff`. The viewer must build
coverage-preserving mips for those maps at load, or the canopy thins with every
level and the stand dissolves at distance — exactly as it did in the bench
before §6.5. The flag is in the manifest because only the material knows the
threshold the coverage has to be preserved against.

## 8. What is done in the game, and what is not

**Done (W0c, W0c.1, W0c.2).** `render_world.js` fetches the payload
(`treeWarm`), plants the woodland from the cone at boot and again from the
real tree when the bytes land, and the dense fill climbs **the same
three-band ladder as the woodland** (W0c.10; before that it drew one rung —
the series' cheapest — across the whole near tier, and a pack's shipped
billboard where it had one). `tree_prep.py` generates the rungs by the
bench's own rules (§5), in three series per subject — `rungs`, `stand`, `snag` —
all quantised over one box; GATE TREES decodes every rung of every series and
requires each ladder to descend. The crown stretch is a **dial** (`place.crownH`)
and not geometry: baking it made the stand series taller than the tree it came
from, and the specimen L0 then filled 77 % of a box stretched to fit a rung it
had nothing to do with.

**The ladder in the near tier (W0c.4).** Three rungs of the specimen series,
bands 150 / 300 / 450 m (`window.TREE_LOD_R`, live). The partition is on the
**CPU**: each rung's InstancedMesh carries only the instances in its band,
re-sorted every ten frames or 25 m, `count` set to what was written. The shader
band alone measured 32 ms — a collapsed instance still runs the vertex shader,
and a 2 km chunk is on for every rung at once. Each rung's parts also get a
depth material of their own, wearing the part's map and cutoff: r128's shadow
pass copies neither, so the leaf cards had been casting solid-card shadows.

**Measured in a dense stand, unthrottled, 1920×1080:** all-L0 21.4 ms ·
150/300/450 21.2 · 80/200/450 21.0 · all-L2 20.5. **The near tier's triangles
are not the wall** — 800 trees at 7 784 triangles cost under a millisecond
more than the same 800 at 1 798. The frame goes elsewhere (the streamed fill's
thousands of instances, the shadow pass, the terrain, the sim), and that is
the W0e question. The ladder still matters where density goes up by the
order of magnitude Ursoy wants, and it is already what lets the fill draw a
real tree at all.

**The mix and the density (W0c.5).** Every tree — woodland and fill — is dealt
a series by the bench's rule: `place.dead` of them snags, and of the living
`TREE_MIX.furnished` specimen and the rest stand-shaped. `furnished` is **1.0**
on the user's ruling (only full-foliage trees show); the stand series is baked,
planted and waiting behind that one number. Each series has its own impostor
atlas per side, so a dead tree at 500 m is a dead tree. The fill's near meshes
are partitioned on the CPU like the woodland's — at a 3.2 m grid the shader
band alone was 90 ms, the partition 54. Density is `window.TREE_FILL.set(ng)`,
grid points per 1024 m chunk, re-gridded live:

| NG | spacing | frame (RTX 3080, 1920×1080, densest stand) | near fill instances |
|---|---|---|---|
| 112 | 9.1 m | 25 ms | 5 200 |
| **160** | **6.4 m** | **31 ms** | 10 800 |
| 224 | 4.6 m | 36 ms | 21 400 |
| 320 | 3.2 m | 54 ms | 43 600 |

The strip, with no near tree at all, is 17–21 ms: the trees are a third of the
frame at 224 and half at 320. What the dense stand exposes is not the count but
the **shading**: looking into the low sun a Lambert leaf card with no wrap and
no translucency is black, and a closed canopy is mostly backlit cards. The
bench's `LEAF_GLSL` (wrap + SSS on a Standard material with the environment) is
the answer, and is in the game's `trees.js` now (W0c.6): `window.TREE_LEAF`
carries the same four dials.

**The G-buffer impostor (W0c.8).** The game's bake is the bench's now: two
sheets from one camera basis — albedo × baked AO with a BINARY mask (the tree's
own material with `TREE_LEAF.bake` at 1, into an sRGB target) and world normals
(a ShaderMaterial into a linear one) — and the impostor is a `MeshStandardMaterial`
whose `normal` is the second sheet, lit by the world's rig with the leaf terms,
scaled by `WORLD.treeLod.lit` (the bench's `imp lit`, 1.0 here). Three traps
the port met, each measured by reading the targets back
(`WORLD.renderer.readRenderTargetPixels(atlas.rt, …)`): the band guard collapsed
an L2 rung baked from thirty metres (`uNoBand` lifts it for the bake); a map first
requested after `treeMapsReady()` was never awaited (`treeSettle` builds EVERY
rung first); and `vertexColors: true` on a quad with no `color` attribute
multiplied every impostor by an unbound (0,0,0) — the tint rides on
`USE_INSTANCING_COLOR` alone.

**The dials in the game (W0c.11).** F8 opens the developer panel
(`src/viewer/dev_panel.js`): fill density, the three band edges (`TREE_LOD`,
shared uniforms, so `[150, 150, 150]` is "L0 then impostor" live), `imp lit`,
the leaf terms and master tint, and the RIG AS DATA (`WORLD_RIG`): sun
elevation / azimuth / strength / warmth, hemisphere, exposure, the dome's
palette, shadow reach and map, and the environment — the boot dome or the
alps panorama rebuilt from the hangar's base + gain pair the way the bench
does it, invisible, PMREM'd. Two rows: `sunset` (the world's, snapshotted at
boot) and `alps` (the bench's afternoon: keyI 2.8 `ffdca8` at 33°, hemi 0.274,
ex 0.92). Under `alps` the game's stand reads as the bench's.

**The ladder, whole and soft (W0c.12, W0c.13).** The shader band reads the
INSTANCE ORIGIN, not the vertex — a tree straddling an edge was sliced down the
middle with its cut's slivers stretched to the clip point — and the partition
measures from the eye as the band does (it measured from the CG; in chase view
the 30 m between the two was a moving gap). Transitions are Unreal's dithered
LOD transition: over `TREE_LOD.fade` metres (30) about every edge both rungs
are drawn through interleaved-gradient-noise dithers with complementary
thresholds, the partition deals a tree to every rung whose window holds it,
and it refreshes every 6 frames / 10 m — inside the half-window — so the next
rung is resident before the fade needs it. The shadow materials dither too.

**The pool (W0c.14).** Every subject of every collection is planted, weighted
the bench's way (`proportion` per collection, split over its subjects; LOLIPOP
2.85 : 1 : 1 : 1). Cedar is tuned and excluded pending the user's word.

**The impostor, complete (W0c.15).** 64 views, the bench's alpha curve (gain
6, cut 0.40 / 0.15 / 0.10 by series, `solid`), the one-texel gutter,
alpha-to-coverage — and ONE atlas per subject and series shared by both
layers (the woodland and the fill had each baked and disposed their own).

**Anchored (W0c.17).** The fill casts and receives (its meshes were still
"canopies only — no shadows" from the cone era, and a tree line that shades
nothing floats); the ground under the near canopy is darkened through the
domain forest mask (`uFloor`, 0.70, bilinear at 47 m a texel — a soft apron of
occlusion at every stand edge, handing over to the far tier's canopy texture);
and the tree materials read the shadow map with plain 4-tap PCF while the
renderer keeps PCF-soft for the aeroplane — soft sampling on every leaf
fragment of the supersampled tier was 117 ms against 54.

**The benchmark: `node tools/tree_perf.js`.** Headless Chrome on this GPU, the
densest stand at 110 m, the rig row fixed, the streamer SETTLED (no chunk
generated for 60 frames — every earlier table in this file was taken while it
was still working, and overstated), a warm-up pass per tier, then 120 frames.
RTX 3080, 1920×1080, NG 128, alps row, W0c.17: **Off (4× MSAA) 31 ms · Smooth
(8×) 36 ms · Smoothest (8× + 1.25×) 43 ms** median; ~15 500 near instances,
~170 000 impostors, 37 M triangles; the raw scene without the AA pass is under
5 ms. `--probe "<js>"` runs an ablation first, `--compare <json>` prints deltas;
the JSON lands in `tools/perf/`. The AA tier is on the F8 panel.

**The look pass (W0c.18).** `imp lit` is 0.9, MEASURED: the same stand drawn
as geometry and as impostors from 40 m under the alps row, mean luminance over
the forest half of the frame 81.9 against 85.8 at 0.9 (92.1 at 1.0, 79.0 at
0.8); the impostor's contrast is lower (sd 20 vs 30 — the baked AO) so the
lit faces sit ~10 % under the geometry's p90, a fair trade against a seam. And
the impostor CASTS: a depth material of its own lays the quad facing the sun
and folds the sun's direction into the atlas, so the shadow is the tree's real
silhouette from the sun's side (the bench's W0a.4, done in the shader rather
than as a second mesh); it collapses beyond the shadow frustum's live reach so
it costs nothing while the bands keep the impostors outside it. With the bands
at 60 m the far stand casts onto the meadow and the two tiers are hard to tell
apart.

**The far cascade (W0c.19).** The sun's shadow map reaches ±105–540 m around
the aircraft and the impostor band starts at 450 m, so no caster could make the
far stand shade anything. A second cascade, narrow on purpose: an orthographic
depth pass of the impostor QUADS alone through their sun-facing depth material,
±1400 m about the eye into a 2048² target (1.4 m a texel), every fourth frame
or on 20 m of movement, cleared to white (packed depth 1 = nothing casts — the
renderer's black clear decodes to depth 0 and shaded the whole terrain), and
sampled by the TERRAIN alone with four taps on the direct term. Proven from
900 m: every tree an impostor, and the isolated ones and the stand edges cast
onto the meadow. `farShadow` on the rig row and the panel.

**Tint at the draw (W0c.20).** The impostor sheet is baked untinted and the
collection's tint is applied at the draw on both tiers with uniforms shared by
reference, so `TREE_LEAF.tintOf(name, {hue, sat, light, bark})` — one block per
collection on the panel — moves a tree at every distance. Measured: at
`imp lit` 0.9 the far tier still reads 83.7 against the geometry's 81.9, and
LOLIPOP at light 0.7 reads 71.2 as geometry, 71.9 as impostors.

**Re-benchmarked after the shadow pass** (`tree_perf`, NG 128, alps, W0c.20):
Off 24 ms · Smooth 35 ms · Smoothest 42 ms — the fill casting and receiving,
the impostor casters, the far cascade and the draw-time tint all in, against
W0c.17's 31 / 36 / 43.

**Still shadows (W0c.22).** The sun's shadow camera followed the aircraft
continuously, sliding its texel grid a fraction of a texel every frame, and every
shadow edge re-quantised against the moving grid — the canopy swam. Both
cascades now move their targets only in whole-texel steps in light space (the
basis three.js's `lookAt` builds), and the LOD-fade dither in the shadow pass
hashes world position rather than the map's pixel, so a still tree lands on the
same texels frame after frame. Measured with the eye still and the shadow
target creeping 0.37 m a frame through a canopy close-up: unsnapped, 0.71 % of
pixels change by more than 60/765 each frame (mean 1.55); snapped, **0.00 %**.
`snap` on the rig row and the panel, for the A/B.

**The canopy map, and the phantom forest (W0c.23).** Two faults the user
caught in one screenshot. The floor term darkened wherever the biome
CLASSIFIER said forest floor — the domain mask — and the planter then rejects
trees on the airfield corridor, the exclusion zones, near water and where no
stand tree is near, so classified-but-unplanted fields darkened ("you compute
stuff based on the untrimmed distribution"). The floor is now the CANOPY MAP: a
straight-down pass of the real tree quads (the far cascade's proxies, their
depth material told to face up so the fold picks the crown's top view) over
±1400 m into a 2048² map, re-rendered on 20 m of movement or when a chunk lands,
and the terrain darkens (`floor` 0.30, the user's number) by sixteen taps of
coverage over ±6 m. Nothing classified: a texel is dark because a crown is over
it. And the "ghost patches that cast shadows": the fill registered its impostor
mesh for the cascade BEFORE its chunk offset was set, so every fill chunk's
trees had a copy at the ORIGIN — a phantom forest over the airfield, at the
heights of their real, hilly chunks, casting from 160 m up. Found by
unprojecting the cascade's texels: casters at (506, 163, 503) with no instance
within 70 m. The proxies take the source mesh's position every pass.
Cost: the map is a white MASK with mipmaps and the terrain takes ONE tap two
levels down (5.5 m texels) — sixteen taps of packed depth were +12 ms on the
supersampled tier; the mask is +1–5. `tree_perf` W0c.23: Off 25 · Smooth 39 ·
Smoothest 48 ms. A caveat on the benchmark itself: with other sessions' Chrome
instances holding 7.5 of the card's 10 GB, one run in four of the Smoothest
tier came back at 160 ms; a run is trustworthy only when its three tiers sit
in their usual ratio, and the JSON in `tools/perf/` is such a run.

**One caster per tree (W0c.24).** The user filmed shadows "redrawn a little
different" on every small camera move: long sunset streaks in layers, the
layers changing. The shadow pass had copied the draw's fade window — inside it
a tree cast from TWO rungs, each dithered with thresholds that moved with the
eye's distance, plus its impostor caster whole. The shadow pass has no window
now: a rung casts inside its band at a hard edge, the impostor casts beyond the
last one, nothing is dithered, and nothing in a shadow depends on where the eye
is beyond that choice. Measured with the eye creeping 0.37 m a frame over a
meadow of sunset streaks: the frame-to-frame change in the shadow region is
1.1 % of pixels with shadows on and 1.3 % with every shadow off — the shadows
add nothing above the parallax floor.

**The defaults, from the matrix (W0c.26).** `tree_perf`, densest stand, RTX 3080,
1080p, alps, median ms:

| fill NG | bands 150/300/450 Smooth · Smoothest | bands 60/132/270 Smooth · Smoothest |
|---|---|---|
| 96 (10.7 m) | 25.5 · 31.1 | 23.9 · 25.7 |
| 112 (9.1 m) | 31.5 · 37.9 | 23.8 · 28.5 |
| 128 (8.0 m) | 38.9 · 51.4 | 22.8 · 26.0 |

With the bench's bands the frame is all but independent of density — the
impostor is one quad, the near tier's fragments are the whole cost — so the
defaults are **bands 60 / 132 / 270 m** (the bench's, as judged) and **NG 112**
(the user's eye: 128 "still generous"). The graphics menu
(`futureDesigns/GRAPHICS-SETTINGS-2026-09-12.md`) will make both a preset.

**Trees placed by hand, and the floor that was sampling noise (W0c.28).**
`TREE_PLACE.add({ x, z, key, size, yaw })` / `set(list)` / `list()` / `keys()`
/ `replant()`: a placed tree is one more record in the woodland's own list, so
it gets the whole rig — the three rungs, the fade, the impostor, both shadow
cascades, the canopy map. The airfield's windbreak (the declared row in
`25_airfield.js`) is placed this way now: eleven Georgeous firs on the cones'
own jittered line, at the row's spread of sizes; no cone is drawn in the world
(the shed scene's own windbreak, `hangar.js`, keeps its cones — a different
scene). Not persisted: the map-and-hand editor that will own it is not this.
And the floor dial "did not go down": the canopy map had been sampling NOISE
since W0c.23b — r128 keys its program cache on `onBeforeCompile.toString()`
plus the material's parameters, and the cover variant of the impostor depth
material differs from the far variant only in a closure variable, so it was
handed the far program and wrote packed depth instead of a white mask. Each
variant names itself in `customProgramCacheKey` now; the coverage is shaped
(`smoothstep(0.04, 0.35, …)`) so any real canopy is full shade and the dial
reaches all of it, and the dial runs to 0.

**The cedar is in, and species go by place (W0c.29).** `cedar_tree.glb` joins
`included` (five collections, 4.47 MB; its rungs 20.7 k / 15.4 k / 9.0 k
triangles — the heaviest L0 of the set, its own ladder from `tree_prep.py`, its
impostor from the same atlas cache). The per-collection `impa` / `implight`
numbers now ride in the payload (`place` carries `impa`, `implight` beside
`size`, `proportion`, `sink`, `dead`) and each impostor material takes its
collection's gain (`uIGain = impa`); the F8 "imp gain" dial is a multiplier
over all of them (`uIGainK`). And the pool's draw is weighted by WHERE the tree
stands — the user: "slightly cluster by species... always have a little mix,
but zones denser in a given species; start with altitude and ground type".
`SPECIES_PREF` (render_world.js) is the table:

| species | at home (m) | patch wavelength | ground bonus |
|---|---|---|---|
| cedar | 0 – 90 | 420 m | wet ×1.6 |
| LOLIPOP firs | 0 – 160 | 340 m | — |
| Georgeous fir | 30 – 220 | 360 m | — |
| spruce | 70 – 320 | 300 m | — |
| larch | 150 – 460 | 480 m | steep ×1.6 |

Three factors over the collection's `proportion`: the ALTITUDE band (full
weight inside, fading to a quarter over 60 m outside), the species' own
PATCHES (a value noise seeded per species at its wavelength, squared —
`0.3 + 1.4·n²` — so a patch reads as a stand and not a tint), and the GROUND.
The ground is NOT the surface class (W0c.30 corrected W0c.29's first cut,
whose "sand" and "scree" bonuses could never fire: a forest point is
FOREST_FLOOR by definition, the classifier says SAND or SCREE before it ever
says forest). What a forest point can be is **wet** — within 60 m of water,
`world.hydro.distW`, the riparian strip the planter knows — or **steep**, a
slope over 0.3 from two more terrain samples. Measured on a 60 m lattice over
the domain: cedar is 25 % of the draw on wet ground and 16 % on dry. Nothing
goes to zero, so every stand keeps a little of everything. Measured in-page over the domain (`TREE_PLACE.speciesAt`
on a 400 m grid, 60 draws a cell): the LOLIPOP pack holds 40–77 % everywhere
(its `proportion`); cedar runs 2–43 % by cell, larch 2–32 %, spruce 2–28 %;
by altitude band the cedar share goes 18 → 13 → 4 % across 0–60 / 60–150 /
150–300 m while larch goes 5 → 7 → 12 % and spruce 8 → 14 → 18 %. The same
weights serve the woodland (`groupOf`) and the fill (`gi`), so a stand's mix
does not change at the fill's edge. The bands are a first guess at a temperate
valley, written as data so they can move with the world.

**The optimisation pass (W0c.30).** First the instrument: `tree_perf` was
teleporting the aeroplane and letting it glide on through the settle and the
three tiers, so no two runs saw the same stand (near count 4177–4774, ±5 ms
at the supersampled tier). It PAUSES the sim after the teleport now — the world
still streams, partitions and renders — and two runs repeat to 0.2 ms. The
paused frame is the trees' frame: it excludes `sim.step` and the instruments,
which were ~7 ms of the unpaused median on this machine (a finding for the
physics, not the forest). Then the ablations, each a `--probe` on a settled
run — NG 112, alps, densest stand, median ms, **Off / Smoothest** (baseline
**10.6 / 24.6**):

| ablation | Off | Smoothest | what it says |
|---|---|---|---|
| shadows off (`sun.castShadow`) | 9.0 (−1.6) | 19.4 (−5.2) | the three shadow passes |
| far cascade + canopy map off | 10.1 (−0.5) | — (noise) | 0.5 ms, every 4th frame |
| no near geometry (bands 10/10/10) | 10.1 (−0.5) | 20.5 (−4.1) | 11 Mtris of L0–L2 cost 0.5 ms |
| bands halved (30/66/135) | 10.6 (0) | 20.5 (−4.1) | same as no geometry: it is fill-rate, not triangles |
| fill NG 16 (woodland only) | 10.0 (−0.6) | 17.5 (−7.1) | **the whole streamed forest** |
| impostors hidden | 9.5 (−1.1) | 21.6 (−3.0) | 127 k quads, 267 draw calls |

So the forest is **0.6 ms of a 10.6 ms frame** at the Off tier and **7 of 24.6**
at Smoothest, where every one of its costs is the AA pass's fill-rate; the
other ~10 / ~17.5 ms is terrain, village, props, clutter, the aeroplane and the
resolve — the base the trees stand on, not theirs. The near tier's triangles
are free; halving the bands buys nothing at Off. The verdict of W0c.27 stands
and is sharper: there is no tree optimisation left that moves the frame; what
moves it is the AA tier, which the graphics menu owns.

What the pass did change is the HITCH, which a settled frame cannot see: a
fill chunk's `gen` walks 112² grid points (classify, place, draw the species)
and builds seven instanced meshes, and the streamer was generating THREE of
them in one frame near the aircraft — the 30–60 ms stall on a fresh spawn or
a teleport. Now: the surface is classified once per point and handed to
`forestHere` and the species weights (they were classifying it three times),
the weights are computed once per draw, the streamer generates ONE chunk every
four frames while a close chunk is waiting (the same fill in the same time,
a third of the stall), the partition uploads only the instances it wrote
(`updateRange`; a rung's buffer is sized for the whole series), and the
streamer keeps its own clock — `TREE_FILL.stat()`, on the F8 panel as
"fill chunks", and in every `tree_perf` result as `gen`. And then the walk
itself was cut: `world.surface` is 2.4 µs a call and `forestHere` asked it
FIRST, on every one of the 12 544 points; the corridor, the aerodromes and
the woodland bins (`nearTree`, a few distances) come first now and most
points never reach the classifier — the same conjunction, the same forest
(219 518 trees before and after). And the walk is SLICED: 24 rows a frame,
the build in the frame the walk finishes, one chunk at a time, the next
picked up the frame this one lands. Measured (`tree_perf`, 102 chunks): a
chunk was **35 ms** in one frame (walk 28, build 7) and three of them could
land together; it is **18 ms** of work now (walk 16, build 2) spread over
five frames, and the streamer's worst FRAME is **15–18 ms** — the build of
the densest chunk plus a slice — against 35–105 before. A fresh spawn fills
its 4 km ring in ~8 s. The settled frame is unchanged within noise (Off 8.8 ·
Smooth 19.1 · Smoothest 24.1), which is the point: the forest was never the
frame, it was the hitch.

Three traps the pass hit in the instrument, each now refused by `tree_perf`
itself: a profile that had saved the free camera booted with the eye at the
origin and measured the runway (a fresh `--user-data-dir` per run, and
app.js boots a saved `free` as the chase); a static server too slow for the
payload left the world drawing cones and black impostors (the run refuses
unless `treeReady()`); and a roll-out that never happened wrote a table of
zeros (refused). The settle reads the streamer's own `busy` flag now — the
sliced walk keeps every frame under the 8 ms the first cut listened for.

**The user's pass over the dials (W0c.31, closing).** Read off two F8
screenshots and the user's notes, and made the defaults:

- **Leaf:** wrap 0.80, sss 1.12, sss power 5.75, ao bake 4.0, sharp 0.90;
  master tint hue −0.045, sat 1.58 (the panel's sat slider runs to 2 now),
  light 1.12 (`trees.js` LEAF / MASTER / U_SHARP; the tuning's `master` and
  `view` say the same, so the bench opens on the game's look).
- **Bark per collection** (the tuning, re-baked into the manifest — geometry
  untouched): cedar 0.34, Georgeous fir 0.42, larch 0.84, LOLIPOP 0.64,
  spruce 0.42. (The screenshot also showed cedar at hue 0.005 / light 0.82
  against the tuning's 0.03 / 0.59; only the bark was asked for — the two
  cedar numbers are a note, not a change.)
- **Fill density 100** (10.2 m; "quite OK and balanced") — `FILL.ng`, and
  the graphics menu's *normal* step; *sparse* is 80.
- **Shadow reach at the dial's maximum, ±540 m** in both rig rows ("I'd
  rather drop density than shadow fidelity"). Measured against 250 in the
  same build: −0.9 / +0.6 / −0.1 ms — noise. The sun map's fidelity is the
  map size (2048 on Medium and above), not the reach.
- **The forest floor blurred** ("too detailed... blurred, extend further,
  a smoother transition"): the canopy map is read at mip 5.5 (~62 m texels;
  was 3.5, ~11 m — every crown drew its own disc) and the coverage ramp's
  knee at 0.26 (was 0.35), so a stand's apron reaches further and fades;
  both on the rig as `floorBlur` / `floorEdge`, and on the panel.
- **Furnished works:** the dial had moved a number nothing re-read — the
  series is dealt at plant time. `TREE_MIX.apply()` replants both layers;
  the panel calls it on release (furnished and size spread). At 0.3 the
  stand series shows: the bench's stretched form, bare trunks with the crown
  at the top.

Baseline `tools/perf/tree_perf.json` at these defaults (NG 100, reach 540,
alps): **Off 10.2 · Smooth 19.9 · Smoothest 27.9 ms**.

**Bench parity, answered.** Every dial of `tools/_trees.html`'s view is in
the game or in its bake: sky/ev (the rig rows and exposure), shadows, sharp,
wrap, sss, a2c, mips (`coverageMips` on the mask materials), aobake, trunkao
(baked into the payload's AO by `tree_prep.py`), isolid / icut / ilit
(+ igain per collection), crownH / crownW (the bake's view), trueScale (the
size rule), the per-collection tint and the master. Two are not, on purpose:
**SSAO** (the bench's screen-space pass; off in the committed view, never part
of a judged look — the floor and the baked AO do that job in the game) and
**imp round** (`isph`, the sphere-normal blend for the impostor; measured 0
on the bench and superseded by the G-buffer's real normal sheet).

**Not done.** The boot rig is still `sunset`; `alps` is two clicks on the
panel and is the row the trees were judged in — a world decision. Bushes and
grass are the next kinds through this same door.
See `futureDesigns/WORLD-V2.md` §8.3 and the W0c–W0e rows of the staging plan.
