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

**Not done.** The `impa` / `implight` per-collection numbers are not in the
payload (6 / 6.5 and 1 in the tuning: one gain, one lit, for all). The boot rig
is still `sunset`; `alps` is two clicks on the panel and is the row the trees
were judged in — a world decision. Bushes and grass are the next kinds through this same door.
See `futureDesigns/WORLD-V2.md` §8.3 and the W0c–W0e rows of the staging plan.
