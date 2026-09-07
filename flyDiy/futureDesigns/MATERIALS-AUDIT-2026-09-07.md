# MATERIALS AUDIT — the glass, the fuselage skin, the window joints

2026-09-07. Read off `src/viewer/aeroskin.js`, `src/core/60_gen_spec.js`
(GEN_BUILD_GRAMMAR), `tools/_cage_gen.js` (cageRims) and `tools/_cage_ui.js`
(the materials panel), plus one look at the stock Jodel-type build on
dev.html in the AFTERNOON shed. Numbers below are the code's own; nothing was
pixel-measured, so where a number is a judgement it says so.

The user's brief, verbatim in spirit: the glass is so-so; the wings are fine
but the fuselages are not — the normals are far too strong, the tiling is
too coarse, real Cubs and Jodels are FLAT with the longitudinal members just
visible, and shinier when painted and varnished; a large-scale musgrave-type
undulation is missing (strong on metal, medium on ply, low on fabric); the
"waffle" is wrong; the windows look like cut paper; the window joints are a
suspect; and none of this layer is reachable from an editor.

Verdict first: **the architecture is right and the numbers are wrong.** One
material, metric field, analytic grammar, mipped stamps — keep all of it.
What is off is (1) the GLASS blend model, which cannot produce glass at all
under normal alpha blending, (2) the grammar's decision to print BOTH member
directions plus a per-cell dish, times a 4x gain, which is a waffle by
construction, (3) low-frequency terms baked INTO tiling sheets, which is the
visible repeat, and (4) no clear layer anywhere on the airframe, so paint
and varnish read as matte pigment.

---------------------------------------------------------------------------
## 1. THE GLASS — why it is so-so

`aeroGlass`: MeshPhysicalMaterial, `color` 0xaec9d8, `opacity` 0.5
(clarity dial), `roughness` 0.045, `clearcoat` 1.0 / 0.03, `reflectivity`
0.5, `transmission` 0 (measured out on the flown page, header comment),
`transparent`, `depthWrite` false, FrontSide. Plus the scratch / wiper /
grime / rainbow hook.

### 1.1 The blend is the whole problem

With `transparent: true` and the default blend, r128 writes
`gl_FragColor = vec4(outgoingLight, alpha)` and blends
`src*alpha + dst*(1-alpha)`. `outgoingLight` = diffuse + specular. So:

- **the specular reflection — the thing that IS glass — is multiplied by
  alpha.** At clarity 0.38 (the screenshot's setting) 62 % of every
  reflection is thrown away. r128's `transmission` line existed precisely to
  restore alpha by the specular's luminance, and it was measured dead in the
  game, so nothing restores it now.
- **the diffuse is a real diffuse of a pale blue at alpha 0.5.** Glass has
  no diffuse term. What you see in the screenshot is a milky translucent
  plastic sheet: 50 % pale-blue Lambert, lit by the room, laid over the crew.
  That is the "cut paper".
- **alpha is constant across the pane.** Real glass: ~4 % reflective and
  ~92 % transmissive head-on, reflection rising to 100 % at grazing angle
  (Fresnel), transmission falling to zero there. A pane that is equally
  see-through at every angle has no curvature cue, and a flat pane at
  constant alpha is by definition a piece of tinted paper.

What to do (r128 has everything needed; no transmission, no thickness):

1. `premultipliedAlpha: true` on the material. Blend becomes
   `ONE, ONE_MINUS_SRC_ALPHA`, and r128's `premultiplied_alpha_fragment` is
   the ONE line `gl_FragColor.rgb *= gl_FragColor.a` — replace it in the hook
   with
   `gl_FragColor.rgb = diffusePart * a + (reflectedLight.directSpecular +
   reflectedLight.indirectSpecular)` — i.e. the specular ADDS at full
   strength regardless of alpha, the diffuse is scaled. This is exactly the
   "the specular IS the glass" recipe the header wrote, done by hand instead
   of through the chunk that died. Order-independent between panes because
   the specular is additive.
2. Fresnel-driven alpha: `a = mix(clarityAlpha, 1.0, schlick(NdotV))`
   computed in the same block — head-on the pane is as clear as the dial
   says, at the limb it goes opaque-reflective. This alone produces
   curvature on a bubble.
3. `color` near black (0x0a0d10) with the tint pushed into a MULTIPLY of the
   background rather than a diffuse. r128 can't multiply the background in
   one pass; two options: (a) accept a small dark diffuse (looks like a
   shaded cabin, which is what a pane over a cockpit shows anyway), or (b) a
   second draw of the same pane with `blending: CustomBlending, blendSrc:
   ZERO, blendDst: SRC_COLOR` carrying the tint colour — a true tinted
   transmission, order-independent, costs one extra pane draw. (b) is the
   proper answer; (a) is one evening.
4. Interior darkening. The crew behind the pane are lit at the exterior's
   level — nothing occludes the shed's rig inside the cabin. A real cabin is
   2–3 stops darker than the outside, and that contrast is half of what makes
   a window read as a hole into a volume. Cheapest honest version: a cabin
   AO uniform on interior finishes (liners, seats, crew) scaled by the
   glazing coverage, before any real occlusion work.

### 1.2 The pane has no thickness and no edge

The cut (`cageCut`) separates the pane faces from the skin, coplanar with
it, and draws one surface FrontSide. An acrylic pane is 3–5 mm thick; its
EDGE is the brightest thing on it (total internal reflection makes it a
green-white line), and the pane sits either INSET in a rebate or PROUD of
the skin by its thickness. Coplanar-and-edgeless is the cut-paper geometry.
Fix in the generator, not the shader: offset the pane 2 mm (inset on wood
and metal, proud on fabric where it is screwed over the covering) and emit
the edge ring as a thin strip with the glass material at alpha 1 and a
green-tinted `color`. Cost: one extra quad ring per pane.

### 1.3 The joint (the user's suspect — confirmed)

`cageRims`: an octagonal tube, `rimW` 12 mm, centre ON the surface (6 mm
proud), swept round every pane and the windscreen, wearing `rubber`
(AERO_BY_CONS `joint`), dark by default. In the screenshot it reads as a
thin PALE outline round each pane — either this build tints it or the
rubber row's specular under the shed's probe lifts it; either way the
result is a pencil line traced round a flat pane, which is the sticker cue.

What a light-aeroplane window joint actually is:
- fabric (Cub): the pane is screwed through the fabric onto the frame, and
  a doped 25–50 mm edge TAPE covers the screw line. Flat, same colour as the
  fuselage, a soft 0.5 mm step at the tape edge.
- ply (Jodel): the pane is screwed under a thin aluminium or wood
  retaining STRIP, 15–20 mm wide, 1–2 mm proud, often painted body colour.
- alloy (C172): a riveted aluminium retainer strip or a rubber glazing
  channel; the rubber is 6–8 mm wide and FLUSH, not a half-round bead.

So the bead should become a flat STRIP (width 15–25 mm, rise 1 mm, cross
section a low trapezoid, not an octagon) with a per-construction finish
(tape = `fabric` tinted body colour; strip = `trim`/`bareAlu`; channel =
`rubber`), and the pane should step DOWN inside it. The current tube is the
right tool for a DOOR seal only. Doors keep the tube.

### 1.4 Smaller glass points

- `roughness` 0.045 under `clearcoat` 1.0 / 0.03 is two identical sharp
  lobes: a doubled highlight, no second layer. Make the base the bulk
  (roughness 0.02, reflectivity 0.5) and the clearcoat the ripple carrier
  at 0.4, and the glint stops looking like two suns.
- The scratch field is `fract(a*190)` stripes gated by `step`, i.e. two
  periodic corduroy families. The comment names `aeroHash` as "the grammar's
  own value noise"; no such function exists in the file. When the noise of
  §3 lands, seed the scratches from it.
- The rainbow rides the DIFFUSE (`diffuseColor.rgb = mix(...)`), so with a
  dark diffuse (§1.1) it disappears; move it onto the specular tint.

---------------------------------------------------------------------------
## 2. THE FUSELAGE SKIN — the waffle, measured

`aeroStructure` sums, for every skin fragment, height gradients from: the
real rings and rails (uG4.x), the metric frame pitch AND the metric stringer
pitch (tape term in both x and y), the sag in both x and y, an oil-canning
dish `sin(pi tx) * sin(pi ty)` per frame x stringer cell, laps, fasteners —
then multiplies the lot by `uGGain` = 4.0.

What that produces, per construction, with the gain applied:

| construction | tape slope | sag slope | dish | cell |
|---|---|---|---|---|
| tubeFabric | 0.65 mm / 50 mm -> 1.1 % x4 = 2.5 deg, on frames AND stringers | frac 0.006, exp 1.4 -> 2.6 % x4 = 6 deg, BOTH directions | 0 | 0.42 x 0.16 m |
| wood | 0.12 mm / 20 mm x4 -> 0.5 deg both ways | 0.15 % x4 both ways | -0.3 mm x4 = -1.2 mm per cell | 0.38 x 0.22 m |
| alloy | 0.08 mm / 12 mm x4 | 0 | -1.2 mm x4 = -4.8 mm per cell | 0.45 x 0.14 m |

Two-directional sag on a rectangular grid IS a quilt. Same for a per-cell
sin*sin dish. That is the waffle, and it is not a tuning problem: it is the
grammar printing members that do not print.

### 2.1 What actually prints, per construction

- **Tube + fabric (Cub).** The fabric touches only the STRINGERS (wooden
  battens running fore-aft over the formers). The truss bays behind them
  never touch the fabric, so nothing prints at the frame pitch. What you
  see: long continuous longitudinal lines at the stringer pitch with a
  gentle flute between them, the tail-post and a few real formers where
  the stringers end. So: `framePitch` 0 for the skin (the real rings keep
  uG4.x at 0.4 mm — that is the former you do see), sag ACROSS the stringers
  only (dH.y only), tape on stringers only. One direction, and the fuselage
  goes flat with lines, which is the user's description of a Cub.
- **Ply (Jodel).** A stressed skin glued to longerons and frames: FLAT.
  What prints: the longerons faintly (0.1 mm over 20 mm is right, but not
  x4), scarf joints as a shallow line, and NO dish — ply does not oil-can
  between members 0.22 m apart. `dish` 0, `sag` 0, tape gain 1.
- **Alloy.** Rivet rows say where the members are; the skin between is
  flat except for genuine oil-canning, which is IRREGULAR: one bay in three,
  bigger than a 0.14 m stringer bay (it happens on the wider unsupported
  panels), never a regular sin*sin. Replace the per-cell dish with the
  large-scale field of §3 masked by a per-cell random threshold, and keep
  rivets + laps + telegraphing as they are (those are good).
- **Carbon.** Already right by restraint. Only the §3 field applies, low.

### 2.2 The gain

One `uGGain` of 4 applies to everything. The comment justifies it for the
TAPE (a 0.6 deg slope is invisible and real tapes have a pinked lip a
Gaussian lacks). It does not justify multiplying sag and dish, which were
declared "real dimensions". Split it: `uGGain.x` for tape/telegraphing
(keep 3–4), `uGGain.y` for sag/dish (1.0–1.5). Two floats, no new program.

### 2.3 The sheet tiling — the coarse repeat is a low-frequency term inside a tiling texture

`aeroHeight` bakes into every 512 px tile a term at the TILE'S OWN period:
- weave: `0.12*sin(u*3+v*2)` on a 0.14 m tile -> a blotch every 14 cm
- sheet (alclad/trim/bareAlu): `0.06*sin(u*2+v*1.3)` on a 0.70 m tile,
  with `hs` 0.8 and `nrm` 0.45 -> a 35 cm ripple that repeats every 70 cm
- grain: `sin(u*3)` figure at the 0.35 m tile
- cast/hide: same shape, smaller tiles

A periodic term at the tile period is precisely a visible repeat, and it is
the "tiling too coarse" the user sees: not the thread count but the
blotch. Rule to adopt: **a tiling sheet carries only frequencies of 8+
cycles per tile; anything slower is evaluated in the shader in metres and
never repeats.** Strip the slow terms from the bakes (and from the
scanned sheets' expectations), and let §3 own everything slow.

The weave itself: 30 threads across 0.14 m = 4.7 mm per thread. Ceconite is
about 70 threads per inch (0.36 mm); under four coats of dope it is
invisible at 1 m. At `nrm` 0.32 x `hs` 0.5 the sheet still reads as burlap
under raking light. `hs` for fabric should be ~0.15 and the tile 0.05 m, or
simpler: fabric's sheet becomes a roughness speckle with almost no normal.

### 2.4 Shine

Current `rough`: fabric 0.66, ply 0.44, alclad 0.34, trim 0.30. Painted and
polished butyrate dope sits about 0.35–0.45; varnished ply 0.25–0.35;
polyurethane over alloy 0.20–0.30. But roughness alone does not give
"painted and varnished": that look is a CLEAR LAYER over a pigment layer, a
broad soft sheen on top of the body colour. Three has it: MeshPhysicalMaterial
`clearcoat` — and Physical `isMeshStandardMaterial`, so it still receives
`scene.environment`, and the glass already proves the hook works on it. So:

- painted/varnished finishes (fabric, ply, alclad, trim, composite, spruce
  when varnished) build on MeshPhysicalMaterial with `clearcoat` 0.3–0.6,
  `clearcoatRoughness` 0.15–0.30; bare metals and cabin cloth stay Standard.
- roughness re-baselined per row as above.
- both numbers join the finish row (`cc`, `ccR`) and the per-section dials
  (a `sheen x` beside `roughness x`).

Cost: one more specular lobe on skin fragments; one more program (Physical
vs Standard is a different ShaderLib, so two hooks or one hook with a
guard). The G38 understudy and GATE SKINMAT's dielectric list both need to
learn `isMeshPhysicalMaterial`.

---------------------------------------------------------------------------
## 3. THE LARGE-SCALE FIELD ("musgrave")

What the user is describing is the slow, non-repeating undulation every
real skin has: rolled-sheet waviness and panel set on metal (wavelength
0.3–1.5 m, amplitude 0.5–2 mm), sanding and glue-line ghosts on ply
(0.2–0.8 m, 0.2–0.5 mm), and the barely-there slack of fabric between the
stringers beyond what the grammar gives (0.2–0.5 mm). Musgrave's
hybrid/ridged multifractal is the classic generator because it is
heterogeneous — smooth in places, busy in others — which is what set panels
look like, where fBm is uniformly busy.

Implementation, all inside the existing hook, no new sampler:

- a value-noise `aeroHash`/`aeroVNoise(vec2)` (the one the glass comment
  already believes exists), 3–4 octaves, lacunarity 2, H ≈ 0.8, hybrid
  multifractal weighting (`w = clamp(prev*gain)` per octave).
- coordinate: `aeroM` (metres along/around) on the field branch, the
  craft-space plane (`vCraftPos`) on the triplanar branch — never the tile
  coordinate, so it never repeats and stays metric on every layer.
- gradient by two extra evaluations (finite difference at the fragment's
  own `fwidth`) -> `dH` in metres per metre, added into `aeroStructure`
  BEFORE the gain, with its OWN uniform `uField` = (amplitude m, wavelength
  m, roughness gain, octaves). Per finish: alclad 1.5 mm / 0.8 m, bareAlu
  same, ply 0.4 mm / 0.5 m, fabric 0.25 mm / 0.35 m, composite 0.3 mm /
  1.0 m, trim 0.5 mm / 0.4 m. Per-section dial `field x`.
- the same field, thresholded per cell, replaces the alloy sin*sin dish
  (§2.1), breaks up the grime (`aeroWG`) and the exhaust streak, and seeds
  the glass scratches.
- cost: ~10 noise evaluations per skin fragment (3 evals x 3–4 octaves),
  cheap next to the six decal fetches already in the loop.

---------------------------------------------------------------------------
## 4. THE EDITOR — what is reachable today, what is not

Reachable: per section `tile x`, `roughness x`, `normal x`, `wear x`, finish
dropdown, tint; six shared glazing dials; the condition dial. Everything
else is a constant in a table: the finish rows (`rough`, `metal`, `nrm`,
`alb`, `hs`, `bs`, `tile`), the grammar rows (pitches, tape, sag, dish,
seam, fastener), `uGGain`, and the glass base numbers (roughness,
clearcoat, reflectivity, tint).

Proposal — a MATERIAL LAB block (dev.html and the editor's FINISH view,
folded by default):

- a finish picker; below it every number of that AERO_FINISH row as a
  slider, plus the new ones (`cc`, `ccR`, `field` amp/len). `tile`, `rough`,
  `metal`, `nrm`, `alb`, `cc`, `ccR`, `field` are uniforms or material
  scalars and update LIVE on every pooled material of that finish (walk
  AERO_BUILT by `userData.aeroFinish`); `hs`/`bs`/`bake` rebake the sheet
  (drop AERO_TEX_CACHE[key], reassign `tDetail.value`).
- a construction picker; below it the GEN_BUILD_GRAMMAR row as sliders —
  all uniforms (uG0..uG3), live.
- the two gains, live.
- the glass base numbers, live (the pool key must grow to include them, or
  the lab bypasses the pool by writing to built materials).
- an EXPORT button that prints the edited rows as JSON so a tuned set can
  be pasted back into the tables — the lab edits the LIVE numbers, the
  tables stay the authority, same posture as "make it the new 1".
- nothing here is saved with the aeroplane: it is the designer's bench,
  not a builder's dial. The per-section dials stay the builder's.

---------------------------------------------------------------------------
## 5. Everything else the screenshot said

- The registration decal, the cowl, the wing and the spinner read well.
  The wing is fine because its grammar is one-directional (ribs) with the
  D-skin cut — the fuselage should learn from it.
- The crew are as bright inside as the cowl is outside (§1.1.4).
- The pane's outline is pale on this build; check the `joint` section's
  tint, and read §1.3 regardless.
- The boom shows the 0.42 m frame pitch as strong diagonal bands — the
  clearest instance of §2.1.
- The whole skin is one roughness; nothing on the aeroplane has a clear
  layer, so a "varnished" Jodel and a "doped" Cub differ only by 0.22 of
  roughness (§2.4).

---------------------------------------------------------------------------
## 6. Proposed order (smallest change with the largest visible effect first)

1. **GLASS BLEND** (§1.1 items 1–2, item 3a): premultiplied hand-blend +
   Fresnel alpha + dark diffuse. One hook edit, one material flag. This is
   the "cut paper" fix.
2. **GRAMMAR PER CONSTRUCTION + SPLIT GAIN** (§2.1, §2.2): table edits in
   60_gen_spec.js and one uniform split. This is the waffle fix.
3. **THE FIELD** (§3) and **strip the slow terms from the sheets** (§2.3).
4. **CLEAR LAYER** (§2.4): Physical for painted/varnished rows, roughness
   re-baseline.
5. **PANE INSET + EDGE + FLAT STRIP JOINT** (§1.2, §1.3): generator work.
6. **MATERIAL LAB** (§4) — arguably first, because every number in 2–4
   should be set by eye with it. If it comes first, do it before 2.
7. Cabin darkening, tinted second pass, scratch reseed, rainbow on
   specular (§1.1.4, §1.1.3b, §1.4).

Gates touched: SKINMAT (the dielectric list, the backtick grep, Physical),
GATE SAVE (new per-section dials), GATE BUILD (finishFromSpec fields), and
the join snapshot (`aeroCC`, `aeroField` on userData like `aeroTileK`).

---------------------------------------------------------------------------
## 7. LANDED (G206, 2026-09-07, same day)

Items 1-6 of §6 landed as G206 — see HANDOVER.md "G206". Still owed from
this audit: the cabin darkening (§1.1 item 4), the pane's own EDGE strip
(§1.2; the inset + retaining strip landed), the scratches re-seeded from
the field noise (§1.4), and the roughness/gain numbers set by eye in the
lab rather than by reasoning here.
