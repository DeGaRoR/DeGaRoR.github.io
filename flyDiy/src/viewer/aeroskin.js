// AEROSKIN — ONE MATERIAL FOR THE WHOLE AEROPLANE (G67, ROADMAP P9).
//
// This replaces G38's uniform recipe, which was declared there as a
// placeholder: "the uniform recipe is the game editor's display treatment,
// and the right baseline until materials become a real chantier (P9)".
//
// THE VEHICLE IS MeshStandardMaterial + ONE onBeforeCompile, and in r128 that
// is not a preference. Read out of vendor/three.min.js, not recalled:
//
//   getParameters:  const w = r.isMeshStandardMaterial ? y.environment : null
//
// A hand-written ShaderMaterial is NOT isMeshStandardMaterial, so it never
// receives scene.environment — the PMREM bake of the hangar simply does not
// reach it, which is the same hole app.js already documents for the gear and
// the spinner. Three more reasons point the same way: refreshMaterialUniforms
// uploads envMapIntensity only for Standard/Physical (so hangar.js's mood
// pass keeps working), the encodings_fragment tail stays in the shader (the
// RGBE-black trap W18 paid for was a hand-written ShaderMaterial with none of
// three's chunks), and the depth/shadow path needs no customDepthMaterial.
//
//   Material.customProgramCacheKey() { return this.onBeforeCompile.toString() }
//
// ONE module-level function object therefore means ONE COMPILED PROGRAM for
// every section on the aeroplane. The corollary is the sharpest footgun here:
// NEVER interpolate a per-material value into the injected GLSL. The cache
// key is the function's SOURCE, not the generated source, so two materials
// with different source and the same .toString() silently share the first
// one's program. Every per-section number is a uniform; the only thing
// allowed to vary in `defines` is AEROSKIN_SURF.
//
// TWO COORDINATE BRANCHES, chosen by #define, never by a runtime `if`:
//   AEROSKIN_SURF 1  the metric surface field (G66) — aStruct.xy is metres
//                    along and around the body, so one tile number gives
//                    every surface the same real texel density
//   AEROSKIN_SURF 0  object-space triplanar with a whiteout blend, for
//                    geometry that has no lattice (rim beads, interior
//                    liners and frames, and every layer that is not the cage)
// A runtime mix would cost four fetches everywhere and put texture2D in
// divergent control flow, where derivatives are undefined.
//
// THE ALBEDO IS THE PARAMETER, THE LOOK IS THE NORMAL (user's own ruling:
// "the look of the material would essentially come from its normal and
// roughness maps, because the albedo should be parametrizable, with a color
// picker"). So the finish carries no colour map at all — its detail sheet is
// normal + roughness + metalness, and the colour is the material's own
// `color`. That is also what keeps the sampler budget comfortable (see THE
// PACKING), and what lets the join snapshot the look unchanged.
//
// r128 notes, same as props.js and hangar.js: colour space is `encoding`, not
// `colorSpace`; there is no scene.environmentIntensity, so each material
// carries its own envMapIntensity for the moods to scale (aeroSetEnv).
'use strict';

// ---------------------------------------------------------------------------
// THE DECLARED FINISH TABLE
// ---------------------------------------------------------------------------
// One row per finish the aeroplane can wear. `base` is the colour a section
// takes before any tint — an sRGB hex, converted ONCE on the way to the
// shader (see THE COLOUR TRAP). `tile` is the real size of one repeat of the
// detail sheet, in METRES: it is the number that makes the scale coherent,
// and it is stated per finish because a fabric weave and a ply sheet are not
// the same size in the world.
//
// THE SHEET IS MICROSURFACE AND MUST NEVER PRODUCE A VISIBLE RIDGE. Anything
// you can see as a SHAPE belongs to the grammar (G68) — a rib tape, a frame,
// a rivet, a lap. Every time this rule was broken the result was the same
// failure with a different material's name on it: the alclad sheet came out
// CORRUGATED, and the ply came out as corrugated cardboard. So `hs` scales
// what the sheet does to the NORMAL and `bs` what it does to ROUGHNESS and
// (through uAlb) colour — separately, because wood is almost all colour grain
// and almost no height, and treating them as one number is what made a
// varnished ply sheet look like a roofing panel.
//
// `rough`/`metal` are the scalars the sheet MULTIPLIES, so the sheet can only
// ever roughen or darken from here — the same discipline garage.js's mr sheet
// used, and the reason G42's roughness multiplier ceiling had to be lifted
// above 1 for the hangar. METALNESS IS NOT SHININESS: paint over aluminium is
// a dielectric and stays at 0 however glossy it looks. Only genuinely bare
// metal goes high, or the livery turns grey and takes its colour from the sky.
//
// THE CLEAR LAYER (G206, the user: "more shiny when they have been painted
// and varnished"). Paint and varnish are a CLEAR COAT over a pigment layer —
// a broad soft sheen sitting on top of the body colour — and no roughness
// number gives that: at roughness 0.3 a pigment reads as satin plastic, not
// as a varnished ply. `cc` / `ccR` are MeshPhysicalMaterial's clearcoat and
// its roughness; a row with `cc` > 0 builds Physical (which is still
// isMeshStandardMaterial, so it receives scene.environment like the rest),
// a row without stays Standard. Bare metal and cloth have no clear layer.
//
// THE LARGE-SCALE FIELD (G206, the user: "something like a musgrave texture
// at large scale over the whole body ... mostly on metal sheets, medium on
// wood and low on fabric"). `fld` is its amplitude in METRES, `fldL` its
// wavelength in metres, `fldR` how much of it reaches the roughness. THE
// AMPLITUDES ARE WHAT READS, NOT WHAT A MICROMETER SAYS (G206.3): the first
// cut carried the honest half-millimetres and was invisible at any gain the
// eye tolerated elsewhere — measured on the stand, 3 mm at x25 is a set
// panel and 0.4 mm at x12 is nothing. So ply is 1.5 mm, alclad 2.5, fabric
// 0.8, at x15, and the lab is where they get set by eye. It is a
// NON-REPEATING noise evaluated in metres in the shader (aeroField), never a
// term in the tiling sheet — because a slow term inside a tile IS the visible
// repeat, which is what the sheets carried until G206 (see aeroHeight).
// Roughness re-baselined at the same time: a polished dope finish sits
// about 0.4, varnished ply 0.3, polyurethane over alloy 0.28.
const AERO_FINISH = {
  // DOPE FILLS THE WEAVE. Four coats of butyrate over Ceconite leaves a
  // surface you can only find the cloth in by looking for it — what you
  // actually see on a fabric aeroplane is the rib tapes and the sag, which
  // are the grammar's job, not the sheet's. The first cut ran 22 threads
  // across a 0.30 m tile (13 mm each, at full normal strength) and the
  // fuselage came out as basket-weave upholstery.
  // G206: the tile drops 0.14 -> 0.06 m (a 2 mm thread, not a 5 mm one) and
  // `hs` 0.5 -> 0.15 — under four coats of dope the weave is a roughness
  // speckle, not a relief; the clear layer and the low field do the rest
  // THE CROSS HATCH IS THE LOOK (G214, the user: "I've lost the cross hatch
  // pattern completely ... it was great, needed to be tweaked"). G206 had
  // flattened it (hs 0.15, "a doped weave is a speckle") and the 3 cm tile
  // with 30 threads a tile made a 1 mm thread — under a screen pixel, mipped
  // to nothing. So: 10 threads on the 3 cm tile (a 3 mm hatch, which reads),
  // the height back, and `weave` is a row field the lab can turn.
  // ...AND THE USER'S DIALS ARE THE NEW 1.0 (G214, "update the defaults to
  // screenshot"): on the wing skin, tile x2.10, roughness x4.00 (the ceiling
  // — a fully matte pigment under the clear coat), normal x2.60, sheen x2.10,
  // field x0.55, wear x1. Folded into the row exactly as the fireproof foil's
  // were, so a saved build carries no deviation it did not ask for; a
  // section still dialled from before this multiplies AGAIN and wants its
  // label double-clicked back to 1.
  fabric:    { name: 'doped fabric', base: 0xd8d4c8, tile: 0.0536,
               rough: 0.90, metal: 0.0, nrm: 1.87, alb: 0.13,
               hs: 0.45, bs: 0.8, bake: 'weave', weave: 10,
               cc: 1.00, ccR: 0.25, fld: 0.00056, fldL: 0.40, fldR: 0.3 },
  // alb 0.50 -> 0.80 with the scanned sheet (G125): the maple face's B span
  // is a quarter of the procedural stripes', so the compensation keeps the
  // ply's grain visible at all — same measurement as spruce's note below
  // THE USER'S OWN, off the lab (G217, "find the new defaults settings,
  // update"): a wide 0.59 m sheet, nearly matte under a full clear coat, the
  // grain carried almost entirely by COLOUR (hs 0 — no relief at all) and a
  // long slow field. That is a varnished ply flank, and it is the row now.
  ply:       { name: 'birch ply',    base: 0xc9a06a, tile: 0.59,
               rough: 0.21, metal: 0.0, nrm: 0.32, alb: 0.67,
               hs: 0.00, bs: 1.45, bake: 'grain', sheet: 'maple',
               cc: 1.00, ccR: 0.12, fld: 0.00075, fldL: 0.93, fldR: 0.78 },
  alclad:    { name: '2024 alclad',  base: 0xd2d6da, tile: 0.70,
               rough: 0.28, metal: 0.0, nrm: 0.35, alb: 0.10,
               hs: 0.8, bs: 0.5, bake: 'sheet',
               cc: 0.45, ccR: 0.15, fld: 0.0025, fldL: 0.90, fldR: 0.35 },
  composite: { name: 'carbon/epoxy', base: 0x2b2e33, tile: 0.10,
               rough: 0.20, metal: 0.0, nrm: 0.30, alb: 0.22,
               hs: 0.5, bs: 1.0, bake: 'twill',
               cc: 0.60, ccR: 0.10, fld: 0.0006, fldL: 1.0, fldR: 0.2 },
  bareAlu:   { name: 'bare alloy',   base: 0xb6bcc3, tile: 0.45,
               rough: 0.26, metal: 0.90, nrm: 0.45, alb: 0.10,
               hs: 0.8, bs: 0.6, bake: 'sheet',
               fld: 0.0025, fldL: 0.90, fldR: 0.4 },
  steelTube: { name: '4130 tube',    base: 0x6f7780, tile: 0.30,
               rough: 0.48, metal: 0.80, nrm: 0.50, alb: 0.16,
               hs: 0.9, bs: 0.8, bake: 'sheet',
               fld: 0.0006, fldL: 0.3, fldR: 0.2 },
  // alb raised 0.55 -> 0.85 with the scanned sheet (G125): Wood091B's strip
  // boundaries are almost entirely COLOUR, and at 0.55 the laminations
  // vanished into the base — measured on the swatch strip, not guessed
  spruce:    { name: 'spruce',       base: 0xbb9560, tile: 0.30,
               rough: 0.40, metal: 0.0, nrm: 0.30, alb: 0.85,
               hs: 0.14, bs: 1.6, bake: 'grain', sheet: 'laminate',
               cc: 0.40, ccR: 0.20, fld: 0.0010, fldL: 0.5, fldR: 0.2 },

  // ---- THE SCANNED WOODS (G125) -------------------------------------------
  // The first baked CC0 payloads, landing the promise the sheet loader has
  // carried since G67 ("written so a baked CC0 payload can replace them
  // one-for-one"). `sheet` names a packed image in WOOD_TEX_SHEETS
  // (tools/wood_tex_import.py -> tools/wood_tex_prep.js -> wood_tex.js);
  // absent, unloaded, or in node, the procedural `bake` stands in, so the
  // gates and the first undecoded frame never notice. The pack keeps the
  // B channel's 0.80 mean — that number is a CONTRACT the wear pass reads
  // (see aeroHeight's caller), not a taste.
  //
  // `alb` above 1 is deliberate and only here: wood is almost all colour
  // grain (the rule G68 learned three times), and a scanned B spans the
  // full 0.60..0.94 the bake convention allows, where the procedural
  // grain's excursion was hundredths. The floor is 1 + alb*(B-0.85) at
  // B = 0.60: alb 1.3 still leaves 0.68 of the base, nowhere near zero.
  // ply and spruce above claim scanned sheets too (the maple face IS what
  // a birch ply skin shows; a built-up spruce member is glued strips).
  maple:     { name: 'maple',          base: 0xe3d4b9, tile: 0.90,
               rough: 0.42, metal: 0.0, nrm: 0.30, alb: 0.90,
               hs: 0.10, bs: 1.4, bake: 'grain', sheet: 'maple',
               cc: 0.30, ccR: 0.20, fld: 0.0008, fldL: 0.5, fldR: 0.2 },
  walnut:    { name: 'walnut',         base: 0xa98971, tile: 0.90,
               rough: 0.42, metal: 0.0, nrm: 0.30, alb: 1.10,
               hs: 0.10, bs: 1.6, bake: 'grain', sheet: 'walnut',
               cc: 0.30, ccR: 0.20, fld: 0.0008, fldL: 0.5, fldR: 0.2 },
  walnutFig: { name: 'figured walnut', base: 0x887e72, tile: 1.10,
               rough: 0.44, metal: 0.0, nrm: 0.30, alb: 1.30,
               hs: 0.10, bs: 1.6, bake: 'grain', sheet: 'walnutfig',
               cc: 0.30, ccR: 0.20, fld: 0.0008, fldL: 0.5, fldR: 0.2 },
  rubber:    { name: 'rubber',       base: 0x20222b, tile: 0.16,
               rough: 0.94, metal: 0.0, nrm: 0.55, alb: 0.20,
               hs: 0.7, bs: 0.9, bake: 'weave' },
  liner:     { name: 'cabin cloth',  base: 0x8d8578, tile: 0.16,
               rough: 0.88, metal: 0.0, nrm: 0.55, alb: 0.30,
               hs: 0.7, bs: 1.0, bake: 'weave' },
  trim:      { name: 'painted trim', base: 0xd8dde4, tile: 0.40,
               rough: 0.28, metal: 0.10, nrm: 0.25, alb: 0.08,
               hs: 0.6, bs: 0.5, bake: 'sheet',
               cc: 0.40, ccR: 0.20, fld: 0.0012, fldL: 0.45, fldR: 0.3 },
  // THE FIREPROOF SHEET. A firewall is a structural bulkhead with a sheet of
  // stainless or aluminised foil on the ENGINE side of it, and the foil is
  // the only surface on the aeroplane whose whole appearance is a CRINKLE: it
  // is thin, it is bonded to a panel that flexes, and it is never flat again
  // after it is fitted. So the sheet is the whole material here — no grammar,
  // no geometry, no rivet line (there is none on a foil).
  //
  // THREE NUMBERS WERE MEASURED AND THEN MOVED, AND THE MOVES ARE THE ROW.
  // tools/skin_tex_import.py prints what ambientCG's Foil001 actually is:
  // basecolor flat grey 0x7f7f7f (span 121..134 of 255 — JPEG noise, no
  // signal), roughness mean 0.100.
  //   base   0x7f7f7f is 0.22 in LINEAR, and a metalness-1 surface takes its
  //          specular colour from `base`: that is a dark mirror, darker than
  //          any real metal's F0 and darker than every metal row in this
  //          table (bareAlu 0xb6bcc3, chrome 0xdfe5ec). The scan's grey has
  //          nothing to lose, so the base is a metal's.
  //   rough  0.100 is a mirror, and a mirror shows only what it reflects —
  //          which, for a firewall, is the inside of a cowling. RENDERED at
  //          0.16 the plate came back BLACK with sparkle (screenshots, the
  //          garage's own light). 0.40 is where it reads as metal, and it is
  //          also the honest number: a firewall foil is dulled by heat, oil
  //          and handling long before anyone looks at it.
  //   nrm    same failure from the other side. At 0.85 the crinkle scatters
  //          every reflection into the dark bay and the sheet goes black.
  // THEN THE USER SET THE LAST TWO WITH THE EDITOR'S OWN DIALS and told them
  // to become the datum: "Tiling x4 by default (make it the new 1) and normal
  // = 0.5 by default (make it the new one too)". So `tile` 0.70 -> 2.80 m
  // (the crinkle at about 80 mm, a foil laid over a panel rather than one
  // crushed in the hand) and `nrm` 0.40 -> 0.20. Both are folded into the row
  // rather than left as per-section overrides, which is what "the new 1"
  // means: a builder's dial starts from this and a saved build carries no
  // deviation it did not ask for. The first cut ran tile 0.26 and read as
  // gravel — the same failure every sheet in this table has had once.
  fireFoil:  { name: 'fireproof foil', base: 0xc6cace, tile: 2.80,
               rough: 0.40, metal: 0.92, nrm: 0.20, alb: 0.16,
               hs: 0.9, bs: 1.0, bake: 'sheet', sheet: 'foil' },

  // ---- THE DASHBOARD'S TWO SURFACES (2026-09-04) --------------------------
  // The user, giving the cage's `dash` a second material: "1 for the flat
  // face facing the pilot, and one for the rest, including the lip. The first
  // ... a metal panel, and the second ... dark leather". So the facia is bare
  // alloy and the shell round it is hide, which is also what a real light
  // aeroplane is: an unpainted instrument panel screwed into a padded
  // glareshield. _cage_gen.js emits the two as `dashFace` and `dash`.
  //
  // BOTH ARE SCANNED (ambientCG, CC0, via tools/skin_tex_import.py), and each
  // one's numbers were MEASURED off its own maps before being moved, the same
  // way fireFoil's were above — the import prints them:
  //   Metal050C   Color 245,246,245 (span 218..254 — no colour signal),
  //               Roughness mean 0.240 (span 0.10..0.62), Metalness a flat
  //               255. So B rides the ROUGHNESS, the metalness map is worth
  //               nothing over the row's own scalar, and the base is a
  //               metal's F0 rather than the scan's near-white.
  //   Leather027  Color mean 15,15,15 — it IS a dark leather already, and
  //               its Roughness is nearly flat (span 0.37..0.55 about a mean
  //               of 0.45), so B rides the LUMINANCE here, wood's rule: the
  //               crease pattern is where this hide's colour lives.
  // THE MOVES: `rough` 0.24 -> 0.38 on the panel, for fireFoil's reason one
  // shelf up — a mirror in a shaded cockpit shows the shaded cockpit — and
  // `metal` 1.0 -> 0.92, so a little diffuse survives where nothing is there
  // to reflect. On the hide, 0.45 -> 0.52: a glareshield is deliberately the
  // most matte surface in an aeroplane, because the alternative is looking at
  // it in the windscreen. The bases are the one honest lift: near-black at
  // 0x0f0f0f the leather has no colour left to tint, so it is a very dark
  // warm brown, and a builder who wants it blacker has the dial.
  panelMetal: { name: 'metal panel',   base: 0xd0d4d8, tile: 0.60,
                rough: 0.38, metal: 0.92, nrm: 0.35, alb: 0.20,
                hs: 0.8, bs: 0.5, bake: 'sheet', sheet: 'panel',
                fld: 0.0010, fldL: 0.4, fldR: 0.3 },
  leatherDark: { name: 'dark leather', base: 0x2a2622, tile: 0.30,
                 rough: 0.52, metal: 0.0, nrm: 0.55, alb: 0.60,
                 hs: 0.8, bs: 0.9, bake: 'hide', sheet: 'leather' },

  // ---- THE HARDWARE VOCABULARY (G70) --------------------------------------
  // The eight rows above are what an airframe is COVERED in. These are what
  // the things bolted to it are MADE OF — the undercarriage, the engine, the
  // cowl, the cabin. They exist because G67 declared the gap in as many
  // words ("only the cage is AEROSKIN ... it wants a name->finish map for the
  // layers' own material names, which exist"), and because those layers were
  // wearing MeshLambert, which the G38 understudy then flattened to one grey.
  //
  // THE SAME MICROSURFACE RULE APPLIES AND IS EASIER TO BREAK HERE, because
  // hardware is small: a cast crankcase seen from 400 mm is the closest the
  // camera ever gets to any surface on this aeroplane, so a sheet that reads
  // as texture on a fuselage reads as gravel on a cylinder head. Every tile
  // below is therefore SMALL and every height gain is modest — the shape of a
  // fin, a lug or a boss belongs to the mesh, which already has it.
  //
  // METALNESS IS REAL HERE, unlike above. The rule the gate states — only
  // genuinely bare metal goes high — is not being relaxed: a cast crankcase,
  // a plated piston, a bronze bush and a copper winding ARE bare metal, and
  // they are the reason the rule needed an exemption list rather than a
  // ceiling. Anything PAINTED (a leg, a bracket, an engine mount, a firewall)
  // stays on `trim` and stays a dielectric.
  castAlu:   { name: 'cast alloy',   base: 0x9aa1a9, tile: 0.12,
               rough: 0.62, metal: 0.75, nrm: 0.55, alb: 0.18,
               hs: 0.9, bs: 0.9, bake: 'cast' },
  chrome:    { name: 'plated steel', base: 0xdfe5ec, tile: 0.50,
               rough: 0.10, metal: 0.95, nrm: 0.16, alb: 0.04,
               hs: 0.30, bs: 0.3, bake: 'sheet' },
  bronze:    { name: 'bronze',       base: 0xa8843c, tile: 0.10,
               rough: 0.40, metal: 0.85, nrm: 0.35, alb: 0.14,
               hs: 0.7, bs: 0.7, bake: 'cast' },
  // A SILENCER IS NOT A MIRROR. Mild steel that has been to 700 C is scaled,
  // straw-blue and half-matte, and the reason this is its own row rather than
  // steelTube is that the tube it is welded to has never been hot.
  exhaust:   { name: 'exhaust steel', base: 0x6b6259, tile: 0.20,
               rough: 0.62, metal: 0.55, nrm: 0.40, alb: 0.20,
               hs: 0.7, bs: 1.0, bake: 'sheet' },
  leather:   { name: 'leather',      base: 0x7a4f33, tile: 0.09,
               rough: 0.72, metal: 0.0, nrm: 0.55, alb: 0.26,
               hs: 0.8, bs: 0.9, bake: 'hide' },
  webbing:   { name: 'nylon webbing', base: 0x5a5d4c, tile: 0.06,
               rough: 0.86, metal: 0.0, nrm: 0.50, alb: 0.24,
               hs: 0.6, bs: 1.0, bake: 'weave' },
  plastic:   { name: 'moulded plastic', base: 0x2b3038, tile: 0.06,
               rough: 0.48, metal: 0.0, nrm: 0.22, alb: 0.10,
               hs: 0.5, bs: 0.6, bake: 'cast' },
  // THE COCKPIT'S HANDS-ON SURFACES (the panel arc, session 4f): five scans
  // the user delivered (assets/interior/, packed by skin_tex_import.py —
  // B rides the roughness on the plastics and the rubber, the luminance on
  // the hide). Each is a sheet the finish's own tint sits under: a black
  // scratched gloss for a throttle's ball, a grained matte plastic for a
  // knob, a scuffed semi-gloss for a bowl, a fine rubber for a grip, a
  // brown hide for a yoke's horns.
  plasticScr: { name: 'scratched gloss plastic', base: 0x1c1e22, tile: 0.08,
                rough: 0.30, metal: 0.0, nrm: 0.45, alb: 0.14,
                hs: 0.5, bs: 0.8, bake: 'cast', sheet: 'plasticScr' },
  plasticGrn: { name: 'grained plastic',   base: 0x2c2b29, tile: 0.06,
                rough: 0.55, metal: 0.0, nrm: 0.60, alb: 0.12,
                hs: 0.5, bs: 0.9, bake: 'cast', sheet: 'plasticGrn' },
  plasticWorn: { name: 'worn plastic',     base: 0x2a2d33, tile: 0.10,
                 rough: 0.42, metal: 0.0, nrm: 0.50, alb: 0.18,
                 hs: 0.5, bs: 0.9, bake: 'cast', sheet: 'plasticWorn' },
  rubberGrip: { name: 'grip rubber',       base: 0x202227, tile: 0.06,
                rough: 0.72, metal: 0.0, nrm: 0.70, alb: 0.16,
                hs: 0.6, bs: 0.9, bake: 'weave', sheet: 'rubberGrip' },
  hide:      { name: 'brown hide',         base: 0x7e543c, tile: 0.25,
               rough: 0.64, metal: 0.0, nrm: 0.55, alb: 0.40,
               hs: 0.8, bs: 0.9, bake: 'hide', sheet: 'hide' },
  copper:    { name: 'enamelled copper', base: 0xb3622f, tile: 0.06,
               rough: 0.38, metal: 0.90, nrm: 0.30, alb: 0.12,
               hs: 0.5, bs: 0.7, bake: 'sheet' },
  // THE ACRYLIC'S EDGE (G206.2): a sawn sheet edge lit by total internal
  // reflection reads as a bright green-white line, glossier than the pane's
  // face. Opaque — it is the one part of a pane that is — and a dielectric.
  acrylicEdge: { name: 'acrylic edge', base: 0xb9e8cf, tile: 0.10,
                 rough: 0.10, metal: 0.0, nrm: 0.10, alb: 0.04,
                 hs: 0.2, bs: 0.3, bake: 'sheet', cc: 0.6, ccR: 0.05 },
};

// THE TABLE AS WRITTEN (G206): the material lab edits AERO_FINISH in place
// and this is what "reset" and "deviation" are measured against.
const AERO_FINISH_DEF = JSON.parse(JSON.stringify(AERO_FINISH));

// ---------------------------------------------------------------------------
// THE ASSIGNMENT TABLE — construction x section ROLE -> finish
// ---------------------------------------------------------------------------
// The cage has ~30 section names and they must NOT become 30 dropdowns. They
// collapse to a handful of ROLES, and the construction type the spec already
// carries (GEN_MATERIALS: tubeFabric / wood / alloy / carbon — which already
// move cd0, and whose alloy row's own comment reads "flush rivets, but laps
// and oil-canning") picks the finish for each role. Per-section override sits
// on top, in the editor.
//
// _cage_ui.js's GLASSM / INTSKIN / INTSTRUCT sets are the seed of this and
// were already a degenerate version of it. Note `pasengerWindow` is misspelled
// and LOAD-BEARING — it is a material name from the user's Blender template
// and the fit verdict matches against it. Do not "fix" it.
const AERO_ROLE = {
  body: 'skin', taper: 'skin', taperPanel: 'skin',
  waistband: 'rail', ceilingLoop: 'rail', floorLoop: 'rail',
  pillarWindow: 'pillar', pillarCabin: 'pillar', pillarPassenger: 'pillar',
  pillarTail: 'pillar', pillarFront: 'pillar', pillarTaper: 'pillar',
  windshield: 'glass', pilotWindow: 'glass', pasengerWindow: 'glass',
  skyWindows: 'glass',
  // THE WINDOW FRAME IS ALUMINIUM (G214, the user: "I have looked at cessna
  // and jodels, and the 'joint' would rather be a aluminium riveted frame
  // rather than a rubber joint"). `joint` is the riveted retaining strip
  // round every pane — role `bead`, bare alloy in every construction — and
  // the DOOR's own seal is its own section now, `doorSeal`, role `seal`,
  // which stays the rubber the bead used to be: a door gap is sealed, a
  // window is framed.
  joint: 'bead',
  doorSeal: 'seal',
  paneEdge: 'edge',        // G206.2: the acrylic's own edge, whatever the build
  // G245: the REVEAL of a drawn window — the return between the skin and
  // the recessed pane. Structure: it is the frame's own lip, so it follows
  // the construction like a bulkhead does (unfielded, the post-pass branch)
  reveal: 'struct',
  // THE FIREWALL IS TWO SURFACES AND A SEAL. `firewall` is the panel itself —
  // structure, so it follows the construction like every other bulkhead — and
  // `fireProof` is the sheet on its ENGINE side, which follows nothing: a
  // fireproof foil is a fireproof foil on a fabric taildragger and on a
  // carbon canard, so `fire` resolves to the same finish in all four
  // constructions. `fireSeal` is the band round its contour and it is the
  // same part as a window bead — an extruded rubber seal between two panels
  // that move against each other — so it takes `bead` and inherits that
  // role's one ruling (black by default, whatever the aeroplane is built of).
  fireProof: 'fire', fireSeal: 'bead',
  boomTube: 'struct', tube: 'struct', woodFrame: 'struct',
  // THE DASHBOARD IS TWO SURFACES, like the firewall above and for the same
  // kind of reason: `dashFace` is the instrument facia — the flat plate the
  // pilot looks at — and `dash` is the padded shell round it, the
  // glareshield, the sides, the border roll and the lip. Neither follows the
  // construction: an unpainted alloy panel in a leather-topped coaming is
  // what a light aeroplane has whether it is fabric, wood, alclad or carbon,
  // so both roles resolve to the same finish in all four columns. `panel` was
  // already the dash's own role and nothing else's, so it keeps the name and
  // now means the facia; `pad` is the shell's.
  aluminium: 'struct', bulkhead: 'struct', firewall: 'struct',
  dash: 'pad', dashFace: 'panel',
  plywood: 'liner', cloth: 'liner', composite: 'liner', toele: 'liner',
};
// THE CABIN IS DARKER THAN THE DAY (G206.1, the audit's §1.1 item 4). The
// crew behind a pane were lit at the exterior's level — nothing in a
// forward renderer occludes the shed's rig inside the cabin — and that lack
// of contrast is half of what made a window read as a film rather than as
// a hole into a volume. What is INSIDE is a fact about the section: the
// liners, the frames and bulkheads, the dash, the fireproof sheet, the
// cabin fit (AERO_HARD.crew), the seats and the crew. The exterior skin's
// BACK FACE is inside too, which is what you see through a window on an
// aeroplane built without liners. `aeroIsInside` is the section rule; the
// factory takes `inside` and the shader scales every lit term by
// (1 - uCabin.x) on those fragments — sky, lamps and sun alike, because a
// roof and a skin stop all three.
const AERO_INSIDE_ROLES = new Set(['liner', 'struct', 'pad', 'panel', 'fire']);
function aeroIsInside(section) {
  if (section === 'boomTube' || section === 'taperPanel') return false;
  return AERO_INSIDE_ROLES.has(AERO_ROLE[section]);
}
// the interior LINERS say what they are made of in their own name — that is
// the whole point of the construction dropdown reading "composite / steel
// tube / plywood / aluminium" — so they resolve by name, not by construction
const AERO_LINER = { plywood: 'ply', cloth: 'fabric', composite: 'composite',
                     toele: 'alclad' };
// THE BEAD IS A RUBBER SEAL (the user: "make the joints black by default,
// they're currently white, it's odd"). It was `trim` in all four rows, and
// painted trim's base is 0xd8dde4 — so every window and every door on every
// aeroplane was outlined in near-white, whatever it was built of. A window
// seal is an extruded rubber section; it is black on a fabric taildragger and
// black on a carbon canard, which is why this is the one role that does NOT
// vary with the construction. AERO_HARD said so already for the lamp bays
// ("the JOINT that fairs it to the skin is a rubber seal") — the cage's own
// rims are the same part and now wear the same finish. The builder can still
// paint them: `joint` is a section like any other and takes a tint.
// `fire` was the second row after `bead` that is the same in all four
// columns, and `panel` and `pad` — the dashboard's facia and its padded
// shell — are the third and fourth, all for the same kind of reason: they
// are not what the aeroplane is built of, they are what the part IS. Kept as
// roles rather than pinned by name so a builder's per-section override still
// lands on them the ordinary way.
const AERO_BY_CONS = {
  tubeFabric: { skin: 'fabric', rail: 'fabric', pillar: 'fabric',
                struct: 'steelTube', panel: 'panelMetal', pad: 'leatherDark',
                bead: 'bareAlu', seal: 'rubber', fire: 'fireFoil',
                edge: 'acrylicEdge' },
  wood:       { skin: 'ply', rail: 'ply', pillar: 'ply',
                struct: 'spruce', panel: 'panelMetal', pad: 'leatherDark',
                bead: 'bareAlu', seal: 'rubber', fire: 'fireFoil',
                edge: 'acrylicEdge' },
  alloy:      { skin: 'alclad', rail: 'alclad', pillar: 'alclad',
                struct: 'bareAlu', panel: 'panelMetal', pad: 'leatherDark',
                bead: 'bareAlu', seal: 'rubber', fire: 'fireFoil',
                edge: 'acrylicEdge' },
  carbon:     { skin: 'composite', rail: 'composite', pillar: 'composite',
                struct: 'composite', panel: 'panelMetal', pad: 'leatherDark',
                bead: 'bareAlu', seal: 'rubber', fire: 'fireFoil',
                edge: 'acrylicEdge' },
  // THE FLYING SURFACES' OWN CONSTRUCTIONS (G213): fabric over wood, fabric
  // over steel tube — both wear doped fabric; what differs is the structure
  // showing through where a section is left open. Reached only from the
  // wing and tail layers (their cons tokens); a fuselage never says these.
  fabric:     { skin: 'fabric', rail: 'fabric', pillar: 'fabric',
                struct: 'spruce', panel: 'panelMetal', pad: 'leatherDark',
                bead: 'bareAlu', seal: 'rubber', fire: 'fireFoil',
                edge: 'acrylicEdge' },
  steel:      { skin: 'fabric', rail: 'fabric', pillar: 'fabric',
                struct: 'steelTube', panel: 'panelMetal', pad: 'leatherDark',
                bead: 'bareAlu', seal: 'rubber', fire: 'fireFoil',
                edge: 'acrylicEdge' },
};
const AERO_GLASS = new Set(['windshield', 'pilotWindow', 'pasengerWindow',
                            'skyWindows']);

// section name + construction -> finish key. ONE description of the mapping;
// the editor's per-section override is applied by the caller, not here.
// THE ONLY SURFACES STRUCTURE IS DRAWN ON. A rim bead, an interior liner, a
// frame, the trim and the glass are not skin: nothing is riveted through them
// and a frame pitch on them would be the decorative placement this whole
// grammar exists to avoid.
const AERO_SKIN_ROLES = new Set(['skin', 'rail', 'pillar']);
function aeroIsSkin(section) {
  return AERO_SKIN_ROLES.has(AERO_ROLE[section] || '') &&
         !AERO_LINER[section];
}

function aeroFinishFor(section, cons) {
  if (AERO_LINER[section]) return AERO_LINER[section];
  const role = AERO_ROLE[section] || 'skin';
  if (role === 'glass') return null;                 // glass is its own family
  const row = AERO_BY_CONS[cons] || AERO_BY_CONS.tubeFabric;
  return row[role] || row.skin;
}

// ---------------------------------------------------------------------------
// THE HARDWARE TABLE (G70) — every layer's own material names -> a finish
// ---------------------------------------------------------------------------
// G67 closed with "only the cage is AEROSKIN. The wing, fin, stab, gear,
// engine and cowl layers still take G38's uniform recipe, so a fabric
// fuselage sits beside a flat white wing"; G68.1 and G68.2 took the wing and
// the tail. This takes the rest, and it is the map that chantier said it
// would want: THE LAYERS ALREADY NAME THEIR MATERIALS, so nothing new has to
// be invented — `_gear_gen.js`'s MAT, `_eng_page.js`'s COL, `_cage_cowl.js`'s
// MATS and `_cage_crew.js`'s M are four vocabularies that were already
// describing what each piece is made of, in a Lambert colour.
//
// THE TABLE SAYS WHAT IT IS MADE OF; THE LAYER KEEPS SAYING WHAT COLOUR IT
// IS. That split is the same one the whole file is built on — "the albedo is
// the parameter, the look is the normal" — and it is what lets the engine
// bench's 30-colour legend go on being the parts list it was designed as
// while every one of those parts gains a real surface underneath.
//
// A NAME MAPPED TO null IS DELIBERATELY NOT DRESSED, and there are only three
// of them: the gear bench's ghost airframe and the two diagnostic markers.
// They are viewing aids, not parts of an aeroplane, and giving a red position
// marker a microsurface would be the same category error as riveting a
// windscreen.
const AERO_HARD = {
  // ---- the fittings (_cage_access.js, G83) --------------------------------
  // THREE NAMES AND NOT FIFTEEN, because a draw call is per material and a
  // fitting is a few hundred triangles: splitting further would cost more in
  // calls than it could ever buy in fidelity, and the snapshot merges by
  // material anyway. `paint` is anything painted with the aeroplane, so it
  // takes `trim` and ages with the airframe; `metal` is the bare turned and
  // plated hardware; `lens` is the beacon cover and nothing else — a coloured
  // dielectric with a specular. It takes `plastic` and NOT `glass`: glass is
  // its own factory here (aeroGlass) and is not a key in AERO_FINISH at all,
  // so naming it would hand aeroMaterial a finish that does not exist — and a
  // beacon lens really is a moulded polycarbonate, so the honest row is also
  // the working one.
  access: { paint: 'trim', metal: 'bareAlu', lens: 'plastic' },
  // ---- the control hardware (_cage_hinge.js) ------------------------------
  // Hinge straps, pins, horns, bellcranks and rod ends are STEEL — cadmium
  // plated, and the one place on a light aeroplane where nobody uses alloy,
  // because a hinge carries a fatigue load in bending. A fairing is painted.
  hinge: { metal: 'steelTube', fair: 'trim' },
  // ---- the undercarriage (_gear_gen.js MAT) -------------------------------
  // ---- the undercarriage (_gear_gen.js MAT) -------------------------------
  gear: {
    tyre: 'rubber', hub: 'castAlu', brake: 'castAlu', brakefix: 'castAlu',
    steel: 'steelTube',        // legs, blades, leaf springs
    alloy: 'bareAlu',          // machined fittings, the oleo cylinder
    chrome: 'chrome',          // the polished piston, and only that
    dark: 'rubber',            // boots, bungee, the rubber in compression
    bronze: 'bronze',          // bushes, the castor pivot
    fair: 'trim',              // a spat is painted, whatever it is made of
    body: null, mark: null,    // the bench's ghost airframe, and a marker
  },
  // ---- the powerplant (_eng_page.js COL) ----------------------------------
  // Sand casting is most of an engine: the case, its ridges, the sump, every
  // pad and boss, the heads and their fins. What is NOT cast is the short
  // list that matters — the pushrod tubes and the intake are drawn tube, the
  // exhaust has been to 700 C, the leads and pucks are rubber, and the
  // electric fiche (G25) brings anodising, moulded plastic and copper.
  eng: {
    emCase: 'castAlu', emRidge: 'castAlu', emSump: 'castAlu',
    emAcc: 'castAlu', emPad: 'castAlu',
    emBarrel: 'castAlu', emFin: 'castAlu', emHead: 'castAlu',
    emRocker: 'castAlu',
    emRod: 'steelTube', emIntake: 'steelTube', emExhaust: 'exhaust',
    emPlug: 'chrome', emCeramic: 'trim', emLead: 'rubber',
    emMag: 'castAlu', emMagCap: 'plastic',
    emGen: 'castAlu', emOil: 'trim', emCarb: 'castAlu', emAir: 'castAlu',
    emFilter: 'liner',         // pleated paper in a foam surround
    emSpider: 'bronze', emFlange: 'bareAlu',
    emMount: 'trim',           // a painted steel engine mount, a dielectric
    emPuck: 'rubber', emFirewall: 'bareAlu', emMark: 'plastic',
    emFuel: 'rubber', emThrottle: 'rubber',
    emEsc: 'bareAlu', emPhase: 'rubber', emBottle: 'plastic',
    emCopper: 'copper',
  },
  // ---- the cowl (_cage_cowl.js MATS) --------------------------------------
  // A COWL IS SHEET METAL ON EVERY AEROPLANE, including a fabric one: it is
  // the one panel that has to take heat, oil and a fastener every 100 mm, so
  // it is alclad over a fabric fuselage and nobody has ever covered one in
  // cloth. `host` is the stub fuselage the cowl bench sits on.
  cowl: {
    skin: 'alclad', host: 'trim', dark: 'rubber', steel: 'steelTube',
    prop: 'ply',
  },
  // ---- the aeroplane's own lights (_cage_light.js) ------------------------
  // A LAMP IS THREE THINGS and only two of them are hardware: the LODGE it
  // sits in is machined alloy, and the JOINT that fairs it to the skin is a
  // rubber seal. The LENS is neither — it is the emitter, it carries its own
  // material, and it must never take a finish that could dim it.
  light: { lodge: 'bareAlu', seal: 'rubber' },
  // ---- the instrument panel (_cage_panel.js MAT, the panel arc s3) -----
  // bezels and needles are painted alloy; the hub, the switch plates and
  // the knobs moulded; a toggle's bat, the lock barrel and the key are
  // bare metal; the FACE is the atlas material and takes no finish
  panel: { bezel: 'trim', needle: 'trim', hub: 'plastic', symbol: 'trim',
           ball: 'plastic', plate: 'plasticGrn', lever: 'chrome', knob: 'plasticGrn',
           rocker: 'plasticScr', key: 'chrome', barrel: 'chrome', bowl: 'plasticWorn',
           // the hardware kit's flat materials (the panel arc, session 4c)
           grip: 'plasticGrn', cap: 'plasticScr', amber: 'plastic',
           // session 4d: the bats and the lock are plated, the screws steel
           screw: 'steelTube',
           face: null },
  // ---- the cabin (_cage_crew.js M) ----------------------------------------
  crew: {
    shell: 'composite', shellC: 'composite',
    cushion: 'leather', pipe: 'leather',
    belt: 'webbing',
    frame: 'steelTube', metal: 'bareAlu',
    joint: 'plastic', knob: 'plastic', dark: 'plastic',
    ctrl: 'trim', console: 'plasticGrn', trim: 'trim',
    // THE PANEL (G94). A bezel is a painted alloy clamp ring and a needle is
    // painted too — both dielectrics; the dial FACE is a printed plastic disc,
    // and it is the one surface in the cabin that must stay matte, because a
    // glossy instrument face is unreadable in the one condition it exists for.
    bezel: 'trim', needle: 'trim', dial: 'plastic',
    board: 'ply',                 // floorboards: the same ply as a wood cabin
    // the controls' fittings (the panel arc, session 4e): a rubber grip and
    // boot, plated pins and collars, cast brackets, leather horns, a red button
    grip: 'rubberGrip', boot: 'rubberGrip', plated: 'chrome', cast: 'castAlu', hide: 'hide', ptt: 'plasticScr',
    ball: 'plasticScr', tread: 'rubberGrip', plateAl: 'panelMetal',
    marker: null,
  },
};
// the propeller's material is a CHOICE on the cowl bench (COWL_GEN.MATERIALS),
// not a name, so it maps by index — eight rows, six finishes. APPEND ONLY:
// the index is stored in presets and in every saved build (cw_material).
// The beech laminate wears spruce's sheet (glued honey-coloured strips —
// Wood091B is closer to a beech blank than the ply face is); maple and
// walnut are G125's scanned woods, and the reason the rows exist.
const AERO_PROP_FIN = ['ply', 'spruce', 'bareAlu', 'composite', 'composite',
                       'ply', 'maple', 'walnut'];

// HOW FAST EACH FINISH AGES, against the airframe's 1.0. One dial sets the
// condition of the aeroplane (aeroSetWear) and this is what stops that
// meaning "everything is equally dirty" — which is the single thing that
// makes a weathering pass read as a filter laid over the picture rather than
// as an aeroplane that has been flown. An exhaust is black by lunchtime, a
// tyre lives on the ground, and a spinner gets wiped every time somebody
// walks past it with a rag.
const AERO_WEAR_K = {
  fabric: 0.9,                    // G217: the user's own `wear x` on the wing
  exhaust: 2.2, rubber: 1.6, castAlu: 1.3, bronze: 1.2, copper: 1.2,
  steelTube: 1.1, webbing: 1.0, leather: 0.8, plastic: 0.7, chrome: 0.5,
};

// layer + the layer's own material name -> finish key, or null for "leave it
// alone". An UNKNOWN name is a fault, not a default: it means a layer grew a
// material nobody dressed, and answering it with a plausible finish is how
// that goes unnoticed for a year. The gate asserts every name resolves; at
// runtime the caller falls back to its own table and the part looks exactly
// as it did before, which is the harmless failure.
function aeroHardFinish(layer, name) {
  const row = AERO_HARD[layer];
  if (!row || !(name in row)) return undefined;
  return row[name];
}

// THE LAYERS' ONE-LINER, and the reason each layer keeps its own table.
// `null` back means "use what you already had", which happens in three
// honest cases: AEROSKIN is not loaded at all (the standalone gear, engine
// and cowl benches do not load it), the editor's material view is switched
// off, or this name is a viewing aid rather than a part. The layer therefore
// never has to know which of those it is in — it asks, and if the answer is
// nothing it draws what it drew before.
//
// THE COLOUR COMES FROM THE LAYER, sRGB, and is CONVERTED here (`tint`, not
// `tintLin`). Those palettes were picked by eye against an unconverted
// Lambert path, so they will read DARKER than they did — which is the colour
// trap running in the direction this file's header describes, and the
// darker picture is the correct one. Any row that turns out to want a
// different colour gets re-picked in its own layer's table, in daylight,
// rather than by cancelling the conversion here.
// ONE DESCRIPTION OF THE SWITCH. The editor's material view is the thing
// that decides whether the aeroplane wears its finishes or the diagnostic
// palette, and `_cage_ui.js` publishes it here rather than each layer
// reaching into the DOM for a select element it does not own. Absent (a
// bench page with no cage editor, or the game before the editor boots) means
// ON: aeroskin.js being loaded at all is the decision.
function aeroHardOn() {
  return !(typeof window !== 'undefined' && window.CAGE_AERO_ON) ||
         !!window.CAGE_AERO_ON();
}

function aeroHardMat(THREE, layer, name, tint, o) {
  if (!aeroHardOn()) return null;
  const fin = aeroHardFinish(layer, name);
  if (fin == null) return null;
  return aeroMaterial(THREE, {
    finish: fin, tint: tint,
    // NO SURFACE FIELD: none of this geometry carries a lattice, so it takes
    // the object-space triplanar branch — which is exactly what that branch
    // was built for (see TWO COORDINATE BRANCHES). fieldM is 1 because every
    // one of these layers already works in metres.
    surf: 0, fieldM: 1,
    side: (o && o.side != null) ? o.side : THREE.FrontSide,
    opacity: (o && o.opacity != null) ? o.opacity : 1,
    wearK: o && o.wearK,
    // the cabin fit lives in the cabin (G206.1); a caller may say otherwise
    inside: (o && o.inside != null) ? o.inside : (layer === 'crew' ? 1 : 0),
    // hardware is not paintwork (G207): no marking lands on it
    decals: (o && o.decals != null) ? o.decals : 0,
  });
}
// WHICH SECTIONS TAKE A MARKING (G207): the cage's exterior skin by role,
// the flying surfaces by role, and the two painted layer parts by name.
const AERO_DEC_ROLES = new Set(['skin', 'rail', 'pillar']);
const AERO_DEC_LAYER = new Set(['cowlSkin', 'spat']);
function aeroDecOk(section) {
  const row = AERO_SEC[section];
  // G267.1: a row may decline the marking — the twin booms lie outside the
  // fuselage's own projection box (aft of it, a metre outboard), so the
  // fuselage-class pattern painted them in whatever band its edge fell
  // in: the user set the master colour and the booms stayed the trim's.
  // They wear the base paint, plain.
  if (row && row.noDec) return 0;
  if (row) return (row.role === 'skin' || AERO_DEC_LAYER.has(section)) ? 1 : 0;
  return AERO_DEC_ROLES.has(AERO_ROLE[section]) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// THE LAYER SECTIONS — the per-part livery, and the chain it hangs from
// ---------------------------------------------------------------------------
// AERO_HARD above dresses hardware nobody paints. This table is the other
// half of the same split: the layer surfaces the builder DOES paint — a wing,
// a fin, a rudder — each declared once, with the section it FOLLOWS. The
// editor's five override maps (finish, tint, three dials) are keyed on these
// names exactly as they are on the cage's own sections, so `spec.finish`
// carries them with no new machinery: a section that says nothing walks up
// its parent chain, and a chain that says nothing falls back to the
// construction, which is precisely what `aeroFinishFor('body', cons)` — the
// literal every layer used to hardcode — meant all along.
//
// `parent: 'body'` is the one CAGE anchor a painted chain terminates at (a
// cage section is never a row HERE — its own overrides are simply the last
// stop on the walk). `role` feeds AERO_BY_CONS when the walk bottoms out;
// `fin` pins a bottom-out finish for parts whose material is not the
// airframe's (declared in later rows, e.g. hardware that joins the livery).
// `label` is what the editor's `auto (follows …)` read-out calls the parent.
//
// THESE NAMES ARE NOT CAGE MESH SECTIONS: they live on LAYER meshes, so the
// gear/tail placement filters (CAGE_MATS and its declared copies) must NOT
// learn them — that set is a cage-face filter, and a layer name in it would
// be a lie the tailwheel acts on.
const AERO_SEC = {
  wingSkin: { parent: 'body',     role: 'skin', label: 'the wing',
              layer: 'wing' },
  wingTip:  { parent: 'wingSkin', role: 'skin', label: 'the wing tips',
              layer: 'wing' },
  wingAil:  { parent: 'wingSkin', role: 'skin', label: 'the ailerons',
              layer: 'wing' },
  wingFlap: { parent: 'wingSkin', role: 'skin', label: 'the flaps',
              layer: 'wing' },
  finSkin:  { parent: 'body',     role: 'skin', label: 'the fin',
              layer: 'fin' },
  finRud:   { parent: 'finSkin',  role: 'skin', label: 'the rudder',
              layer: 'fin' },
  // G271: the ventral fins under twin booms, their own paint (the user:
  // "ensure they have their own finish section, with their own material
  // and colour"); they follow the fin's until repainted
  finVentral: { parent: 'finSkin', role: 'skin', label: 'the ventral fins',
                layer: 'fin' },
  stabSkin: { parent: 'body',     role: 'skin', label: 'the stabiliser',
              layer: 'stab' },
  stabElev: { parent: 'stabSkin', role: 'skin', label: 'the elevators',
              layer: 'stab' },
  // G267: the twin booms wear the body's paint (they asked for `body`, a
  // cage section this table never had, and fell back to bare white)
  boomSkin: { parent: 'body',     role: 'skin', label: 'the twin booms',
              layer: 'boom', noDec: true },
  // ---- the hardware the builder paints (phase C) --------------------------
  // A PINNED `fin` says what the part IS unless the builder repaints THAT
  // part: the fin channel stops at the section's own name (see the resolver),
  // while tint and the dials still walk — a spat stays painted trim when the
  // fuselage goes plywood, but it borrows the fuselage's colour. Rows with
  // `parent: null` follow nobody; the spinner follows the PROPELLER, whose
  // own bottom-out finish the engine layer passes per blade material
  // (cw_material stays the structure-tab choice, exactly as the prop always
  // worked — the section adds the override on top).
  // `wears: 'parent'` (G207): a PAINTED part with no colour of its own takes
  // the colour its parent actually WEARS — the parent's override if it has
  // one (that always walked), else the parent's own finish base — instead of
  // its pinned finish's base. The user: "the maintenance access on the side
  // should be colored like the fuselage"; a strut, a spat and a cowl are
  // painted with the fuselage on a light aeroplane, the fittings with it.
  // G238: THE CONTROL HARDWARE. A hinge, a horn, a pushrod and a cable are
  // STEEL, and steel is what they stay whatever the aeroplane is painted —
  // the pinned-finish rule, the same one that keeps a gear leg from turning
  // into plywood on a wooden aeroplane. `parent: null`: a hinge borrows
  // nobody's colour, because a hinge is not painted.
  // The FAIRING is the other case entirely and is why it is a second row: a
  // gap seal is a painted strip on a painted surface, so it follows the
  // aeroplane and wears what its parent wears (G207).
  ctlHinge: { parent: null,   fin: 'steelTube', label: 'the hinges & horns',
              layer: 'hinge' },
  ctlFair:  { parent: 'body', fin: 'trim',      label: 'the hinge fairings',
              layer: 'hinge', wears: 'parent' },
  strut:    { parent: 'body', fin: 'trim',      label: 'the lift struts',
              layer: 'wing', wears: 'parent' },
  // G185: the truss follows the lift struts (paint, the fuselage's colour)
  cabane:   { parent: 'strut', fin: 'trim',     label: 'the cabane struts',
              layer: 'brace', wears: 'parent' },
  interplane: { parent: 'strut', fin: 'trim',   label: 'the interplane struts',
              layer: 'brace', wears: 'parent' },
  braceWire: { parent: null,   fin: 'steelTube', label: 'the bracing wires',
              layer: 'brace' },
  // the second plane follows the first by default; painting it re-paints
  // its own tips, ailerons and flaps and nothing of the first
  wingSkin2: { parent: 'wingSkin',  role: 'skin', label: 'the second wing',
              layer: 'wing2' },
  wingTip2:  { parent: 'wingSkin2', role: 'skin', label: 'the second wing tips',
              layer: 'wing2' },
  wingAil2:  { parent: 'wingSkin2', role: 'skin', label: 'the second ailerons',
              layer: 'wing2' },
  wingFlap2: { parent: 'wingSkin2', role: 'skin', label: 'the second flaps',
              layer: 'wing2' },
  spat:     { parent: 'body', fin: 'trim',      label: 'the wheel fairings',
              layer: 'gear', wears: 'parent' },
  // THE LEGS ARE PAINTED WITH THE AEROPLANE (2026-09-10, the user: "the base
  // colour misses ... elements of suspension such as the blades"). They stood
  // at `parent: null` on the same ruling as the crankcase — an engine's grey
  // is not the airframe's paint — and for a gear leg that ruling is simply
  // wrong: a bending blade, a leaf spring and a bungee V are SHEET AND TUBE
  // BOLTED TO THE FUSELAGE, and every light aeroplane in the reference folder
  // wears them in the fuselage's colour. The pin keeps the MATERIAL steel (a
  // leg is a leg whatever the fuselage is made of, exactly as a spat is
  // painted trim) and `wears: 'parent'` gives it the colour the fuselage
  // actually wears — so the base-colour pick reaches the mains, the nose leg
  // and the tailwheel's castor and spring at last, and a builder who wants
  // bare steel back still has the row.
  gearLeg:  { parent: 'body', fin: 'steelTube', label: 'the gear legs',
              layer: 'gear', wears: 'parent' },
  prop:     { parent: null,                     label: 'the propeller',
              layer: 'eng' },
  spinner:  { parent: 'prop',                   label: 'the spinner',
              layer: 'eng' },
  cowlSkin: { parent: 'body', fin: 'alclad',    label: 'the cowling',
              layer: 'cowl', wears: 'parent' },
  // ---- THE ENGINE (G113.4, the user: "get the material and color picker
  // from the engine, block and covers should be pickable... so we have
  // something for the engine") -------------------------------------------
  // THREE ROWS, NOT ONE, because that is how an engine is actually finished:
  // a crankcase in one colour, cylinders in another, and rocker covers as the
  // accent. The chain runs case -> jugs -> covers, so painting the block
  // reaches all three and each can be overridden in turn — the same
  // follows-its-parent idiom the spinner takes from the propeller.
  //
  // `parent: null` on the block: an engine's grey is not the airframe's
  // paint, and a green fuselage must not repaint the crankcase. Same ruling
  // as the gear legs and the crew.
  //
  // THE CYLINDERS ARE HERE THOUGH THE USER NAMED ONLY BLOCK AND COVERS: they
  // are the largest thing you see of an engine, and leaving them unpaintable
  // between two paintable neighbours would read as an oversight rather than
  // as a decision.
  engBlock: { parent: null,       fin: 'castAlu', label: 'the crankcase',
              layer: 'eng' },
  engJug:   { parent: 'engBlock', fin: 'castAlu', label: 'the cylinders',
              layer: 'eng' },
  engCover: { parent: 'engJug',   fin: 'castAlu', label: 'the rocker covers',
              layer: 'eng' },
  // G156, the user: "Color selection engine braces". The MOUNT is the fourth
  // engine group and it is not a fourth castings group: AERO_HARD already
  // calls it `trim` — "a painted steel engine mount, a dielectric" — so it
  // bottoms out on paint, not on cast alloy, and it follows the BODY rather
  // than the crankcase. A mount is painted to match the aeroplane it is bolted
  // to, which is also why `accPaint` (the fittings) is written exactly this
  // way. The rubber pucks it holds are NOT included: a puck is rubber for what
  // it does, which is G104's own rule and the same reason a tyre is not
  // paintable.
  engMount: { parent: 'body',     fin: 'trim',    label: 'the engine mount',
              layer: 'eng' },
  accPaint: { parent: 'body', fin: 'trim',      label: 'the fittings',
              layer: 'access', wears: 'parent' },
  // ---- the cabin and its crew (phase D) -----------------------------------
  // The seats follow NOBODY on purpose: a green fuselage does not force
  // green leather. The dummies are the user's "give them a bit of
  // personality": one suit COLOUR each, the second following the first
  // (paint the crew once, then differ one) — the suit's MATERIAL stays
  // pinned composite, because an ATD is an ATD whatever it wears.
  seatTrim: { parent: null,     fin: 'leather',   label: 'the seats',
              layer: 'crew' },
  dummy1:   { parent: null,     fin: 'composite', label: 'the pilot',
              layer: 'crew' },
  dummy2:   { parent: 'dummy1', fin: 'composite', label: 'the pilot',
              layer: 'crew' },
};

// the walk itself: section -> parent -> ... -> a cage anchor (which has no
// row and therefore ends it). Bounded, because a declared table can still
// hold a cycle and the gate that says it doesn't runs at commit time, not
// in the player's browser.
function aeroSecChain(sec) {
  const chain = [];
  for (let s = sec; s != null && chain.length < 9; ) {
    chain.push(s);
    const row = AERO_SEC[s];
    if (!row) break;
    s = row.parent;
  }
  return chain;
}

// THE RESOLVER, and it is pure on purpose: everything it reads walks in
// through its arguments, so the node gate exercises the same code the
// browser runs. `over` is the editor's five maps ({fin,tint,tile,rough,nrm},
// each keyed by section); `ctx` is what the LAYER knows — `cons` the part's
// construction token, `fin` an optional layer-decided bottom-out finish
// (the propeller's material choice). Each of the five channels walks the
// chain INDEPENDENTLY: a set value stops that channel and no other, so a
// white-tinted aileron still follows the wing's finish and dials. `src`
// names the section whose override supplied the finish (null when the
// construction did), which is all the `auto (follows …)` label needs.
function aeroSecResolve(sec, over, ctx) {
  const row = AERO_SEC[sec] || {};
  const chain = aeroSecChain(sec);
  const walk = (map, ch) => {
    if (map) for (const s of ch)
      if (map[s] != null && map[s] !== '') return { v: map[s], src: s };
    return { v: null, src: null };
  };
  // A PINNED fin walks its OWN name only: the pin says what the part IS —
  // a spat is painted trim whatever the fuselage is built from — so an
  // ancestor's FINISH never reaches it. Its COLOUR still does: tint and
  // the dials keep the full chain.
  const f = walk(over && over.fin, row.fin ? [sec] : chain);
  const byCons = AERO_BY_CONS[ctx && ctx.cons] || AERO_BY_CONS.tubeFabric;
  const fin = f.v != null ? f.v
    : (ctx && ctx.fin) || row.fin || byCons[row.role || 'skin'] || byCons.skin;
  let tint = walk(over && over.tint, chain).v;
  // WEARS THE PARENT'S COLOUR (G207): no override anywhere up the chain, and
  // the row says it is painted with its parent — so the colour is the base
  // of the finish the PARENT resolves to (its own override having been the
  // walk's answer already). Bounded by the chain, like the walk.
  if (tint == null && row.wears === 'parent' && row.parent) {
    const pr = aeroSecResolve(row.parent, over, ctx);
    const pf = AERO_FINISH[pr.fin];
    if (pf) tint = pf.base;
  }
  return { fin, src: f.src,
           tint,
           tileK: walk(over && over.tile, chain).v,
           roughK: walk(over && over.rough, chain).v,
           nrmK: walk(over && over.nrm, chain).v,
           wearM: walk(over && over.wear, chain).v,
           // G206: the sheen and the field, same rule
           ccK: walk(over && over.cc, chain).v,
           fieldK: walk(over && over.field, chain).v,
           // G217: and the field's WAVELENGTH — the cowl's own, mostly
           fieldLK: walk(over && over.fieldL, chain).v,
           // G215: the metal flake in the paint
           metalK: walk(over && over.metal, chain).v };
}

// ---------------------------------------------------------------------------
// THE COLOUR TRAP, stated in both directions (63_gen_skin.js:2957 has the
// measured pixel values). r128 feeds a material's flat `color` to the shader
// as LINEAR, while a texture declared sRGBEncoding IS converted. Every colour
// that arrives here came from a picker or a hex chosen by eye — i.e. sRGB —
// so it converts, ALWAYS, here, once.
//
// The other direction matters just as much, and it is worth being exact
// because it is easy to state backwards. A hex fed in unconverted is treated
// as LINEAR, so 0x8b95a2 goes to the shader as 0.545 instead of 0.256 and
// renders about twice as bright as the swatch looks. Converting therefore
// DARKENS the picture relative to the legacy path — it does not lighten it —
// and what it actually does is make the aeroplane the colour you chose.
//
// MEASURED, in the room, on the fuselage flank: the G38 understudy at
// SEC.body reads (138,110,115) and AEROSKIN at the same hex reads (94,68,79),
// a linear ratio of 0.43 against the 0.47-0.57 the conversion alone predicts.
// So the shading is right and the whole difference is this.
//
// The consequence for the palette: `_cage_ui.js`'s SEC hexes were picked
// against the unconverted path AND they are a DIAGNOSTIC palette (magenta
// waistband, green pillars) rather than a livery. New pickers convert;
// legacy hexes stay bit-exact until deliberately re-picked.
function aeroLinear(THREE, hex) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

// ---------------------------------------------------------------------------
// THE PACKING — one RGBA sheet, three maps
// ---------------------------------------------------------------------------
//   R,G   tangent-space normal xy (z reconstructed)
//   B     roughness multiplier
//   A     metalness multiplier
// This is props.js's ONE MATERIAL logic pushed one step further: there, one
// image serves aoMap/roughnessMap/metalnessMap; here the normal joins it, so
// the whole finish is a SINGLE fetch — which matters most on the triplanar
// branch, where separate maps would be nine fetches instead of three.
//
// THE SAMPLER BUDGET, and it is why this packing is not an optimisation but a
// requirement. The hangar's rig is 1 casting directional (2048) + 6 casting
// spots (1024, G60) = 7 shadow samplers, + 1 envMap. That leaves the material
// two of a realistic sixteen. One goes here.
//
// v1 BAKES THESE PROCEDURALLY on a canvas, at 512 (power-of-two: WebGL1
// enforces POT for RepeatWrapping with mipmaps, so it will work on this
// machine and fail on someone else's otherwise). They are LINEAR data, never
// sRGB — a normal map and a roughness map are numbers, not pictures, and
// putting them through the sRGB curve bends every one of them (garage.js's
// `linTex` discipline). The loader is written so a baked CC0 payload can
// replace them one-for-one: same packing, same names, same tile metres —
// and G125 landed the first four (the woods; `sheet:` on the finish row).
const AERO_TEX = 512;
const AERO_TEX_CACHE = {};

function aeroHeight(kind, S, row) {
  // a height field, sampled at S x S, tiling seamlessly (every term is
  // periodic in S) — the same technique garage.js's bump sheet uses, and the
  // reason a covered airframe reads as fabric at all: the shape is carried by
  // the ridge catching the light, not by painted line-work.
  const H = new Float32Array(S * S);
  const T = Math.PI * 2 / S;
  const h = (x, y) => {
    const u = x * T, v = y * T;
    switch (kind) {
      case 'weave': {
        // A REAL OVER-AND-UNDER. The first cut of this was
        //   sin(u*24)*cos(v*24) - sin(u*24+PI)*cos(v*24+PI)
        // described as "two out-of-phase combs", and it is IDENTICALLY ZERO:
        // shifting both terms by PI negates both factors, so the product is
        // unchanged and the difference cancels. The whole fabric weave was a
        // flat sheet and it took looking at it close up to notice, because
        // "no visible weave" and "a subtle weave" are the same screenshot at
        // any distance. Warp and weft each ride over the other in
        // alternating cells, which is what a plain weave is.
        // NO SLOW TERM (G206): this carried 0.12*sin(u*3+v*2), one swell per
        // tile, and one swell per tile IS a visible repeat — the "tiling too
        // coarse" the user saw was that blotch every 14 cm, not the threads.
        // A tiling sheet carries 8+ cycles per tile and nothing slower; the
        // slow undulation is aeroField's, in metres, and never repeats.
        const n = (row && row.weave > 0) ? row.weave : 30;   // threads a tile
        const warp = Math.abs(Math.sin(u * n));
        const weft = Math.abs(Math.sin(v * n));
        const over = Math.sin(u * n * 0.5) * Math.sin(v * n * 0.5) > 0;
        return 0.55 * (over ? warp : weft);
      }
      case 'twill': {
        // 2x2 carbon twill: the diagonal is what identifies it
        const d = Math.sin((u + v) * 26) * 0.5 + Math.sin((u - v) * 26) * 0.5;
        return 0.5 * d + 0.10 * Math.sin(u * 52) * Math.sin(v * 52);
      }
      case 'grain': {
        // Long fibres along u with figure crossing them. FINE — the first cut
        // ran 46 cycles across a 0.55 m tile, i.e. a ridge every 12 mm at full
        // height, and a varnished ply fuselage came out as corrugated
        // cardboard. Real grain is a millimetre or two and is almost entirely
        // colour, which is what `hs` 0.10 / `bs` 1.6 says on the row above.
        const f = Math.sin(v * 150 + 2.6 * Math.sin(u * 3)) * 0.5;
        return 0.55 * f + 0.30 * Math.sin(v * 37 + Math.sin(u * 2) * 1.6)
             + 0.10 * Math.sin(u * 90);
      }
      case 'cast': {
        // SAND CAST (G70). A crankcase, a caliper, a brake drum, a moulded
        // knob: not a pattern at all, which is the point — a cast surface is
        // ISOTROPIC pebble with no direction in it, and the moment you can
        // see a repeat you are looking at a fabric instead. Three octaves of
        // a product-of-sines lattice, each turned against the last so no two
        // share an axis and the tile does not read as a grid.
        const g = (a, b, k) => Math.sin(u * a + v * b) * Math.sin(u * -b + v * a) * k;
        return g(37, 21, 0.34) + g(59, -43, 0.18) + g(97, 71, 0.09);
      }
      case 'hide': {
        // LEATHER. The grain is a broad, soft PEBBLE with fine pores in it,
        // and the failure mode is exactly the ply one: at full strength it
        // becomes a golf ball. Almost all of what says "leather" is the
        // roughness breakup (bs) and the wide low swell, not the height.
        const cell = Math.sin(u * 13 + 1.7 * Math.sin(v * 9))
                   * Math.sin(v * 11 + 1.7 * Math.sin(u * 7));
        return 0.45 * cell + 0.16 * Math.sin(u * 27 + v * 19)
             + 0.07 * Math.sin(u * 83) * Math.sin(v * 79);
      }
      default: {
        // Rolled sheet: NEARLY FLAT, and the discipline is to keep it that
        // way. The first cut ran 120 cycles of a 0.10-amplitude ripple across
        // the tile — one line every 6 mm at amplitude enough to see — and a
        // painted alloy fuselage came out CORRUGATED, which is precisely the
        // failure garage.js's own comment records ("the wing read as
        // corrugated iron rather than doped fabric"). Painted metal is smooth;
        // what stops it reading as plastic is a broad, very low undulation
        // and a mill grain you can only find by looking for it.
        // G206: the "broad, very low undulation" LEFT THE SHEET. At 0.06 over
        // two cycles of a 0.70 m tile it was a 35 cm ripple repeating every
        // 70 cm at hs 0.8 — the coarse repeat on every alloy fuselage. The
        // undulation is aeroField's now (metric, non-repeating, per finish);
        // what stays here is the mill grain and a fine isotropic breakup.
        return 0.010 * Math.sin(v * 90.0 + Math.sin(u * 5.0) * 0.7)
             + 0.008 * Math.sin(u * 23 + v * 17) * Math.sin(u * 19 - v * 29);
      }
    }
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) H[y * S + x] = h(x, y);
  return H;
}

function aeroDetailTex(THREE, key) {
  if (AERO_TEX_CACHE[key]) return AERO_TEX_CACHE[key];
  const row = AERO_FINISH[key] || AERO_FINISH.fabric;
  // THE BAKED PAYLOAD PATH (G125): a row claiming a `sheet` takes the scanned
  // pack from wood_tex.js — same packing, same names, same tile metres, which
  // is the swap this loader promised at G67. The canvas starts NEUTRAL
  // (n = 0,0,1 and B at the 0.80 contract mean) so an undecoded first frame
  // is the flat material, not a black one; the draw lands with needsUpdate.
  // drawImage fills A with 255, the procedural bake's own constant — a sheet
  // with real metal variation cannot ride a JPEG payload, and none does.
  // TWO PAYLOAD TABLES, ONE NAMESPACE: wood_tex.js is the wood library,
  // skin_tex.js everything else the finish table asks for (the fireproof
  // foil, first). A row names a sheet, not a store — so a sheet that moves
  // library is not a change here — and either table may be absent (node, an
  // older page, a bench that loads one script and not the other), which is
  // why each is tested for existence rather than assumed.
  const pay = row.sheet && (
    (typeof SKIN_TEX_SHEETS !== 'undefined' && SKIN_TEX_SHEETS
      && SKIN_TEX_SHEETS[row.sheet]) ||
    (typeof WOOD_TEX_SHEETS !== 'undefined' && WOOD_TEX_SHEETS
      && WOOD_TEX_SHEETS[row.sheet]));
  if (pay) {
    const S = pay.px;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.LinearEncoding;    // DATA, NOT A PICTURE, like the bake
    t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
    const draw = () => {
      ctx.drawImage(pay.img, 0, 0, S, S);
      t.needsUpdate = true;
    };
    if (pay.img.complete && pay.img.naturalWidth) draw();
    else {
      ctx.fillStyle = 'rgb(128,128,204)';   // 204 = the 0.80 mean, in bytes
      ctx.fillRect(0, 0, S, S);
      pay.img.addEventListener('load', draw);
    }
    return (AERO_TEX_CACHE[key] = t);
  }
  const S = AERO_TEX;
  const H = aeroHeight(row.bake, S, row);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const at = (x, y) => H[((y % S) + S) % S * S + (((x % S) + S) % S)];
  // central differences -> tangent-space normal, wrapped so the sheet tiles
  const SC = 1.6 * (row.hs != null ? row.hs : 1);
  const BS = (row.bs != null ? row.bs : 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * SC;
    const dy = (at(x, y + 1) - at(x, y - 1)) * SC;
    const L = Math.hypot(dx, dy, 1);
    const i = (y * S + x) * 4;
    img.data[i]     = Math.round(255 * (0.5 - 0.5 * dx / L));
    img.data[i + 1] = Math.round(255 * (0.5 + 0.5 * dy / L));
    // roughness rides the height: a raised thread catches more light than the
    // valley beside it, and that correlation is most of what sells a weave
    const hh = at(x, y);
    img.data[i + 2] = Math.round(255 * Math.max(0, Math.min(1,
      0.80 + 0.20 * hh * BS)));
    img.data[i + 3] = 255;                       // metalness rides the scalar
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // DATA, NOT A PICTURE: linear, always. Declaring this sRGB would bend every
  // normal and every roughness value in the sheet.
  t.encoding = THREE.LinearEncoding;
  t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
  t.needsUpdate = true;
  return (AERO_TEX_CACHE[key] = t);
}

// ---------------------------------------------------------------------------
// THE SHADER
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// DECALS (G69) — THE REGISTRATION, AND ANYTHING THAT MUST HOLD ITS SHAPE
// ---------------------------------------------------------------------------
// G4.5 built the first decal and recorded exactly why it needed one: the
// body's u is NORMALISED ANGLE, "so a glyph of fixed u-width covers less and
// less physical distance the further aft it sits", and "the decal mechanism
// is now the answer for any future marking that must hold its shape".
//
// THE SURFACE FIELD IS THAT MECHANISM, GENERALISED. sL and sC are METRES on
// the skin, so a decal is placed at a metric position with a metric size and
// holds its proportions by construction — on a fuselage, a wing or a fin,
// whatever the shape underneath. There is no projection matrix, no unwrap and
// no second geometry: it is two subtractions and a texture read.
//
// AND IT LANDS ON BOTH FLANKS, which is what a registration wants, but NOT
// the right way round on both without help. sC is |signed arc| up from the
// waist so the flanks share it; sL runs aft and is not mirrored at all — so
// the glyph is laid out along the same PHYSICAL direction on both sides, and
// seen from the far side that direction crosses the eye the other way. It
// reads backwards. That is G4.5's own trap ("the far side read backwards and
// upside down") arriving by a new route, and the answer is the same one:
// negate the along-body coordinate over there. See the shader.
//
// IT TOOK THREE LOOKS TO GET RIGHT, and the lesson is about the instrument
// rather than the code. The first fix went in on a hunch and flipped the
// WRONG flank; the second removed it again after the "correct" side was
// misread — the registration was six characters long and the frame had
// clipped the first, so a mirrored string looked like a correct one. It was
// only unambiguous once the test string was G-ABCD, which is not a
// palindrome and not clipped. A test whose FAILURE looks like its PASS is
// not a test.
//
// THE PRICE, declared: a decal is on BOTH sides or neither. An asymmetric
// marking needs a one-sided mask, which the field cannot supply.
// SIX, and the number is not a guess: three kit layers, the registration and
// the two image channels. Every one of these is an unrolled iteration of a
// texture fetch in the fragment shader, so the array is sized to what the
// panel can actually turn on and not to a round number.
const AERO_MAXD = 7;             // G208: +1, the certification stickers' strip
const AERO_ATLAS_N = 4;              // 4x4 pages
// 1024 -> 4096 (G207, the user: "the current decals are too low resolution,
// the pixels are clearly visible"). A page was 256 px, stretched over a
// metre or two of flank: 6 mm per texel at a registration's size. 1024 px
// a page is 1.5 mm, and the text is now drawn to FILL its page rather than
// at a fixed font size scaled down only. 64 MB of RGBA on the GPU, which a
// desktop game carries; the envelope keeps a 512 px copy of an image page
// (aeroDecalImageData), not the page. Every pixel size below (dilation,
// the outline stroke) scales with the page.
const AERO_ATLAS_PX = 4096;
const AERO_PAGE_REF = 256;           // what the pixel sizes were tuned at
// the fraction of page 0 the registration's glyph box occupies, written by
// aeroDecalText and read by the placement (G207)
let AERO_TEXT_FIT = { w: 0.86, h: 0.27 };
let AERO_ATLAS = null, AERO_ATLAS_CV = null;

function aeroAtlas(THREE) {
  if (AERO_ATLAS) return AERO_ATLAS;
  const S = AERO_ATLAS_PX;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, S, S);
  AERO_ATLAS_CV = cv;
  const t = new THREE.CanvasTexture(cv);
  // flipY stays TRUE — the canvas convention this repo uses everywhere except
  // props.js, which sets false because glTF's uv origin is top-left. Mixing
  // the two is how a registration ends up mirrored, so the page rect below
  // does the v flip explicitly and once.
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.encoding = THREE.sRGBEncoding;   // documentation: see the note below
  t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
  t.needsUpdate = true;
  return (AERO_ATLAS = t);
}

// the page's rect in atlas uv, with the flipY accounted for once
function aeroPageRect(p) {
  const N = AERO_ATLAS_N, px = p % N, py = Math.floor(p / N);
  return [px / N, 1 - (py + 1) / N, 1 / N, 1 / N];
}

// DILATE THE COLOUR INTO THE TRANSPARENT SURROUND. The canvas is
// premultiplied, so a page whose clear pixels are black fringes DARK as soon
// as the mip chain averages a glyph edge against them — the same trap
// render_world.js records twice ("a white transparent clear comes back
// black"). Flooding the glyph's own colour outward leaves alpha carrying the
// coverage and RGB carrying no surprises, and mipmapping is then correct for
// nothing extra.
function aeroDilate(g, x0, y0, w, h, rounds) {
  const img = g.getImageData(x0, y0, w, h), d = img.data;
  for (let r = 0; r < (rounds || 4); r++) {
    const src = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 8) continue;
      let cr = 0, cg = 0, cb = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4;
        if (src[j + 3] <= 8 && !(r > 0 && src[j] + src[j+1] + src[j+2] > 0))
          continue;
        cr += src[j]; cg += src[j + 1]; cb += src[j + 2]; n++;
      }
      if (!n) continue;
      d[i] = cr / n; d[i + 1] = cg / n; d[i + 2] = cb / n;
    }
  }
  g.putImageData(img, x0, y0);
}

// draw a registration (or any short marking) into a page, and return the
// aspect so the caller can size it in metres without guessing
// THE FACES A MARKING MAY WEAR (G113.1, the user: "the registration also
// should offer... choice of police"). ONLY WHAT THE ARTIFACT SHIPS: this is a
// zero-network single-file build, and a livery that renders in a different
// face on somebody else's machine is not a livery — it is a suggestion. The
// vendored set is IBM Plex Mono at 400/500/600 and IBM Plex Sans as a
// 100-700 variable, so those are the four rows and no more.
//
// AND THE OLD DEFAULT ASKED FOR A WEIGHT THAT DOES NOT EXIST. Every
// registration since G69 has been drawn at `700 IBM Plex Mono` against a face
// that ships 400, 500 and 600 — a SYNTHESISED bold. `mono bold` is the real
// 600, which is what was being faked, and it is first so it stays the default.
const AERO_DEC_FONTS = [
  { name: 'mono bold',  css: '600 96px "IBM Plex Mono", ui-monospace, monospace',
    track: 8 },
  { name: 'mono light', css: '400 96px "IBM Plex Mono", ui-monospace, monospace',
    track: 10 },
  { name: 'sans bold',  css: '700 96px "IBM Plex Sans", ui-sans-serif, sans-serif',
    track: 4 },
  { name: 'sans light', css: '400 96px "IBM Plex Sans", ui-sans-serif, sans-serif',
    track: 6 },
];
// ---- THE DISTANCE FIELD (G212) ---------------------------------------------
// Felzenszwalb & Huttenlocher's exact Euclidean distance transform, separable
// and O(n) per row: squared distance from every pixel to the nearest SET
// pixel of a mask. Run twice — to the inside and to the outside — the
// difference of their roots is the signed distance to the glyph edge, which
// is what the page's alpha carries and the shader thresholds. Float64: the
// "infinite" seed must survive the adds of squares up to a million.
function aeroEDT1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
function aeroEDT(set, w, h) {
  const INF = 1e12, g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = set[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n);
  const v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    aeroEDT1(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    aeroEDT1(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = d[x];
  }
  return g;
}
// the spread of the field either side of the edge, in page pixels — wide
// enough that the coarsest mip still holds a slope, narrow enough that two
// registrations' letters never share it
const AERO_SDF_SPREAD = P => Math.max(4, Math.round(P * 0.03));
// ONE BAKE PER MARKING, NOT PER SLIDER (G212): every decal slider re-applied
// the whole list and re-drew the registration with it; with a distance
// transform in the loop that would be a laggy slider. The page is redrawn
// only when what is on it changes.
const AERO_TEXT_SIG = {};
const AERO_TEXT_ASPECT = {};

function aeroDecalText(THREE, page, text, colHex, outHex, font) {
  const t = aeroAtlas(THREE), S = AERO_ATLAS_PX, N = AERO_ATLAS_N;
  const P = S / N, px = (page % N) * P, py = Math.floor(page / N) * P;
  const sig = [text, colHex, outHex, font, P].join('|');
  if (AERO_TEXT_SIG[page] === sig && AERO_TEXT_ASPECT[page]) {
    AERO_TEXT_FIT = AERO_TEXT_ASPECT[page].fit;
    return AERO_TEXT_ASPECT[page].aspect;
  }
  AERO_TEXT_SIG[page] = sig;
  const g = AERO_ATLAS_CV.getContext('2d');
  g.save();
  g.clearRect(px, py, P, P);
  g.translate(px + P / 2, py + P / 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // the default is still a monospaced legal marking rather than a logotype,
  // which is garage.js's own reasoning; the choice is the builder's now
  const F = AERO_DEC_FONTS[Math.max(0, Math.min(AERO_DEC_FONTS.length - 1,
    Math.round(+font || 0)))];
  g.font = F.css;
  if ('letterSpacing' in g) g.letterSpacing = F.track + 'px';
  const mt = g.measureText(text || '');
  const w = Math.max(1, mt.width);
  // TO FILL THE PAGE, up or down (G207): the marking's size in metres is the
  // placement's, so the page is only the glyph box and the glyphs may as well
  // use all of it — capped by the line's own height so two letters do not
  // climb out of the box
  const fh = Math.max(1, (mt.actualBoundingBoxAscent || 0) +
                         (mt.actualBoundingBoxDescent || 0) || 96);
  const sc = Math.min((P * 0.86) / w, (P * 0.86) / fh);
  // WHAT THE GLYPHS OCCUPY OF THE PAGE, for the placement: the marking's
  // height in metres is the GLYPHS' height (G207), not the page's
  AERO_TEXT_FIT = { w: (w * sc) / P, h: (fh * sc) / P };
  g.scale(sc, sc);
  const hex = v => '#' + ((v == null ? 0x1b3a5c : v) >>> 0).toString(16)
                          .padStart(6, '0');
  const R = AERO_SDF_SPREAD(P);
  // THE COLOUR UNDERLAY (G212): the field's alpha ramps R px OUTSIDE the
  // glyph, and the texels there must already wear a colour — the shader
  // reads RGB wherever the threshold lets it, and the mips average it. A
  // stroke 2R wide in the outline's colour (the ink's when there is none)
  // puts that colour under the whole ramp, where the old dilation walked.
  g.lineJoin = 'round';
  g.lineWidth = (2 * R + 14 * (P / AERO_PAGE_REF)) / sc;
  g.strokeStyle = hex(outHex != null ? outHex : colHex);
  g.strokeText(text || '', 0, 0);
  if (outHex != null) {
    g.lineWidth = 14 * (P / AERO_PAGE_REF) / sc;
    g.strokeStyle = hex(outHex);
    g.strokeText(text || '', 0, 0);
  }
  g.fillStyle = hex(colHex);
  g.fillText(text || '', 0, 0);
  g.restore();
  // THE FIELD: the marking's own coverage (fill + outline, no underlay) on a
  // scratch page, a distance transform each way, and the signed result laid
  // into the atlas page's alpha over the colours just drawn — 0.5 at the
  // edge, 1 at R px inside, 0 at R px outside.
  {
    const cv = document.createElement('canvas');
    cv.width = cv.height = P;
    const m = cv.getContext('2d');
    m.translate(P / 2, P / 2);
    m.textAlign = 'center'; m.textBaseline = 'middle';
    m.font = F.css;
    if ('letterSpacing' in m) m.letterSpacing = F.track + 'px';
    m.scale(sc, sc);
    m.fillStyle = '#fff'; m.strokeStyle = '#fff'; m.lineJoin = 'round';
    if (outHex != null) {
      m.lineWidth = 14 * (P / AERO_PAGE_REF) / sc;
      m.strokeText(text || '', 0, 0);
    }
    m.fillText(text || '', 0, 0);
    const cov = m.getImageData(0, 0, P, P).data;
    const inside = new Uint8Array(P * P), outside = new Uint8Array(P * P);
    for (let i = 0; i < P * P; i++) {
      const on = cov[i * 4 + 3] > 127;
      inside[i] = on ? 1 : 0; outside[i] = on ? 0 : 1;
    }
    const dIn = aeroEDT(outside, P, P);    // from an inside pixel to the edge
    const dOut = aeroEDT(inside, P, P);    // from an outside pixel to the edge
    const img = g.getImageData(px, py, P, P), d = img.data;
    for (let i = 0; i < P * P; i++) {
      const sd = Math.sqrt(dIn[i]) - Math.sqrt(dOut[i]);
      const a = Math.max(0, Math.min(1, 0.5 + sd / (2 * R)));
      d[i * 4 + 3] = Math.round(a * 255);
    }
    g.putImageData(img, px, py);
  }
  t.needsUpdate = true;
  const aspect = w / fh;                            // glyph aspect, w:h
  AERO_TEXT_ASPECT[page] = { aspect, fit: AERO_TEXT_FIT };
  return aspect;
}

// draw an arbitrary image into a page — "project complex liveries from
// images onto anything", one page at a time
function aeroDecalImage(THREE, page, img) {
  const t = aeroAtlas(THREE), S = AERO_ATLAS_PX, N = AERO_ATLAS_N;
  const P = S / N, px = (page % N) * P, py = Math.floor(page / N) * P;
  const g = AERO_ATLAS_CV.getContext('2d');
  g.clearRect(px, py, P, P);
  const s = Math.min(P / img.width, P / img.height);
  const w = img.width * s, h = img.height * s;
  g.drawImage(img, px + (P - w) / 2, py + (P - h) / 2, w, h);
  aeroDilate(g, px, py, P, P, Math.round(5 * P / AERO_PAGE_REF));
  t.needsUpdate = true;
  AERO_PAGE_IMG[page] = { aspect: img.width / img.height };
  return img.width / img.height;
}
// THE IMAGE PAGES TRAVEL WITH THE BUILD (G190, the user: "the box projection
// decal does not survive the flight interface"). A page a builder loaded an
// image into was baked into this session's atlas and NOWHERE ELSE: the spec
// records where the marking sits and never the pixels (60_gen_spec's own
// deliberate gap), so a save, a reload and the aeroplane that then flew all
// had the placement of a picture that was not there. The pixels still stay
// out of the SPEC; they ride the save ENVELOPE beside the plaque and the log,
// as the page itself — 256 px square, already fitted and dilated — so a
// livery image is a few tens of kilobytes, not the upload. `aeroDecalImageData`
// reads a page out (null when none was ever loaded there), and
// `aeroDecalImageFrom` puts one back, through the same drawer the upload uses.
const AERO_PAGE_IMG = {};
function aeroDecalImageData(page) {
  if (!AERO_PAGE_IMG[page] || !AERO_ATLAS_CV) return null;
  const S = AERO_ATLAS_PX, N = AERO_ATLAS_N;
  const P = S / N, px = (page % N) * P, py = Math.floor(page / N) * P;
  // the ENVELOPE copy is capped at 512 px (G207): a 1024 px page is a
  // quarter-megabyte of PNG per image, and the save is not the upload
  const E = Math.min(P, 512);
  const cv = document.createElement('canvas');
  cv.width = cv.height = E;
  cv.getContext('2d').drawImage(AERO_ATLAS_CV, px, py, P, P, 0, 0, E, E);
  return cv.toDataURL('image/png');
}
// ...and a page is CLEARED when the build that comes in has nothing for it:
// the previous aeroplane's picture must not stay on the next one's wing.
function aeroDecalImageClear(THREE, page) {
  if (!AERO_PAGE_IMG[page] || !AERO_ATLAS_CV) return;
  const S = AERO_ATLAS_PX, N = AERO_ATLAS_N;
  const P = S / N, px = (page % N) * P, py = Math.floor(page / N) * P;
  AERO_ATLAS_CV.getContext('2d').clearRect(px, py, P, P);
  delete AERO_PAGE_IMG[page];
  const t = aeroAtlas(THREE); t.needsUpdate = true;
}
function aeroDecalImageFrom(THREE, page, dataURL, cb) {
  if (!dataURL || typeof dataURL !== 'string' || !/^data:image\//.test(dataURL)) return false;
  const im = new Image();
  im.onload = () => {
    const a = aeroDecalImage(THREE, page, im);
    // the stored page is square and fitted; the marking's own aspect is
    // the one the upload measured, carried beside it by the caller
    if (cb) cb(a);
  };
  im.src = dataURL;
  return true;
}

// A DECAL BELONGS TO THE AEROPLANE, NOT TO A SECTION, so these uniform
// objects are SHARED BY REFERENCE across every AEROSKIN material. One write
// to aeroSetDecals updates the whole aeroplane, including materials the
// editor builds later — the same reason props.js keeps its own env record.
// THE AEROPLANE-WIDE UNIFORMS, one object shared BY REFERENCE across every
// AEROSKIN material — the decals (G69) and the wear (G70). One write reaches
// the whole aeroplane, including materials the editor builds later and the
// ones the game builds for the aeroplane that flies: it is the same module in
// the same page, so the editor's marking and its wear arrive on the flown
// build without travelling through anything.
let AERO_DEC = null;
function aeroSharedU(THREE) {
  if (AERO_DEC) return AERO_DEC;
  const z4 = () => Array.from({ length: AERO_MAXD },
    () => new THREE.Vector4(0, 0, 0, 0));
  AERO_DEC = aeroSharedU0(THREE, z4);
  aeroLabGains(THREE);           // the saved gains, once the block exists
  return AERO_DEC;
}
function aeroSharedU0(THREE, z4) {
  return ({
    tAtlas: { value: aeroAtlas(THREE) },
    uDecN:  { value: 0 },
    uDecA:  { value: z4() },     // xy centre (sL, sC) m, zw half-size m
    uDecB:  { value: z4() },     // atlas rect u0 v0 du dv
    // w: MIRRORS ON THE FAR FLANK (G162). 0 is what every decal did before —
    // the along-body axis is negated over there so a REGISTRATION reads
    // left-to-right from both sides. 1 keeps the physical direction, which is
    // what PAINT wants: a two-tone that rises aft must rise aft from both
    // sides, and mirroring it makes it rise aft on one flank and fore on the
    // other. Zero is the old behaviour, so nothing that existed changes.
    uDecC:  { value: z4() },     // x rot, y roughness delta, z opacity, w mirror
    // G108: x mode (0 field, 1 box SIDE view, 2 box PLAN view), then one
    // flag per surface CLASS — body, wing, tail. A mask of three floats and
    // not a packed bitfield: three comparisons are exact and legible where
    // pow/mod bit tests in GLSL ES 1.0 are neither.
    uDecD:  { value: z4() },     // x mode, y onBody, z onWing, w onTail
    uDecE:  { value: z4() },     // x sdf (G212): the page's alpha is a distance
    // WORLD -> CRAFT: metres, x lateral, y aft, z up. SHARED, because it is a
    // fact about the AEROPLANE and not about any one material — the same
    // reason the decal list is shared.
    uCraftInv: { value: new THREE.Matrix4() },
    uInset: { value: 0.02 },
    // THE CONDITION OF THE AEROPLANE (G70). One number the player sets, and
    // three vectors that say WHERE it lands — measured off the build, never
    // painted by hand. See THE WEAR below.
    uWear:  { value: new THREE.Vector4(0, 0, 0, 0) },
    //        x amount 0..1  y grime gain  z fade gain  w streak gain
    uWearE: { value: new THREE.Vector4(0, 0, -1, 0) },   // exhaust streak
    uWearS: { value: new THREE.Vector4(0, 0, -1, 0) },   // gear splash
    //        x sL origin  y sC origin  z run (m, +aft; <0 = off)  w half-width
    // THE DISPLAY GAINS (G206), and there are THREE because one was the
    // waffle. uGGain was a single x4 over every gradient the grammar summed,
    // justified for the TAPE (a 0.6 deg slope is invisible and a real tape
    // has a pinked lip a Gaussian lacks) and applied, unjustified, to the
    // SAG and the DISH, which were declared as real dimensions and then
    // quadrupled — a 2.5 mm slack read as a 10 mm quilt. x = tape /
    // members / fasteners / seams, y = sag and dish, z = the large-scale
    // field. Shared, so the lab's one write reaches every material.
    uGain:  { value: new THREE.Vector3(AERO_GAIN_DEF.x, AERO_GAIN_DEF.y,
                                       AERO_GAIN_DEF.z) },
    // ...and the WING AND TAIL'S OWN (G206.3, the user: "we need it separate
    // for the body and the wing"). Picked in the shader by the surface class
    // in uG5.w, so one material serves both and nothing is rebuilt.
    uGainW: { value: new THREE.Vector3(AERO_GAIN_DEF.wx, AERO_GAIN_DEF.wy,
                                       AERO_GAIN_DEF.wz) },
    // THE CABIN'S DARKNESS (G206.1): x = how much of the light an inside
    // fragment loses, already times the aeroplane's glazing coverage
    uCabin: { value: new THREE.Vector4(AERO_CABIN_DEF, 0, 0, 0) },
  });
}
const aeroDecUniforms = aeroSharedU;    // the name G69 wrote it under

// ---------------------------------------------------------------------------
// THE WEAR (G70) — one dial, and every placement derived
// ---------------------------------------------------------------------------
// The user's ruling, in their own words: "wear 0.0 factory fresh / 0.4 flown:
// exhaust streak, boot scuffs at the root, tyre grime / 1.0 weathered:
// chalked paint, oil weep under the cowl, alloy dulled". ONE number, and
// WHERE it lands is computed from the aeroplane rather than authored — the
// same discipline as the structure grammar, and for the same reason: a
// hand-placed smudge is decoration, and decoration does not survive the
// aeroplane changing shape under it.
//
// FOUR THINGS HAPPEN, and each is a real mechanism rather than a filter:
//   GRIME settles in the valleys of the microsurface and nowhere else, which
//     is why a weave gets visibly dirty and a polished spinner does not.
//     It is read from the detail sheet's own height channel, so it costs no
//     extra fetch and it is automatically the right size for the material.
//   CHALKING is sun damage, so it is on UPWARD-FACING surfaces only: paint
//     oxidises pale and matte, which is the opposite of dirt and the reason
//     an old aeroplane reads as tired rather than merely dark.
//   METAL DULLS. Oxide and dirt are dielectrics, so metalness falls — this
//     is what stops a weathered bare-alloy cowl looking chrome-plated.
//   STREAKS run from SOURCES. Two, both measured: the exhaust exit and the
//     wheel that throws water and mud up the belly. They live in the surface
//     field, so they are on the fuselage and the flying surfaces only —
//     which is where you actually see them, and where a metric coordinate to
//     run them along exists at all.
// The hardware (gear, engine, cowl, cabin) takes the first three: it has no
// field to run a streak along, and an engine's own filth is the exhaust
// finish's `wearK`, which ages it faster than the airframe it hangs on.
function aeroSetWear(THREE, o) {
  const U = aeroSharedU(THREE);
  const w = Math.max(0, Math.min(1, (o && o.amount) || 0));
  U.uWear.value.set(w, (o && o.grime != null) ? o.grime : 1,
                       (o && o.fade  != null) ? o.fade  : 1,
                       (o && o.streak != null) ? o.streak : 1);
  const src = (v, d) => (d && d.length === 4)
    ? v.set(d[0], d[1], d[2], d[3]) : v.set(0, 0, -1, 0);
  src(U.uWearE.value, o && o.exhaust);
  src(U.uWearS.value, o && o.splash);
}

// THE LIST IS THE STATE. Callers hand over what the aeroplane wears; this
// writes it into the shared uniforms and every material sees it at once.
//   { page, sL, sC, w, h, rot, rough, opacity, on, mode }
//
//   on:   which SURFACE CLASSES it lands on — {body, wing, tail}, any subset.
//         It replaced a `target` scalar (0 fuselage / 1 flying surfaces /
//         2 both) that could not say "the body AND the tail but not the
//         wing", which is the one grouping the user asked for: "the fuselage
//         projection and the fin projection should be one... the wing and the
//         slabs another, fully independent one".
//   mode: 'field' — metres along and around the body, the G66 surface field.
//                   Right on a fuselage, where a marking must wrap.
//         'side'  — an ORTHOGRAPHIC projection through the craft, in the
//                   (along, up) plane. The projector G69's own gap list has
//                   owed since it landed.
//         'plan'  — the same, in the (lateral, along) plane: a stripe across
//                   both wings is one continuous thing.
const AERO_DEC_MODE = { field: 0, side: 1, plan: 2 };
// WHERE THE AEROPLANE IS, as one matrix. The caller hands over the transform
// of the craft's own root; this inverts it and folds in the axis convention,
// so the shader gets metres in a frame it can rely on and no layer has to
// agree with any other about units or origin — which they do not.
function aeroSetCraft(THREE, rootMatrixWorld, axes) {
  const U = aeroDecUniforms(THREE);
  const a = axes || {};
  const lat = a.lateral || 'x', along = a.along || 'z', up = a.up || 'y';
  const sgn = a.aft === false ? 1 : -1;
  const row = (ax, k) => (ax === 'x' ? [k, 0, 0] : ax === 'y' ? [0, k, 0] : [0, 0, k]);
  const r0 = row(lat, 1), r1 = row(along, sgn), r2 = row(up, 1);
  const P = new THREE.Matrix4();
  P.set(r0[0], r0[1], r0[2], 0,
        r1[0], r1[1], r1[2], 0,
        r2[0], r2[1], r2[2], 0,
        0, 0, 0, 1);
  const inv = new THREE.Matrix4();
  if (rootMatrixWorld) inv.copy(rootMatrixWorld).invert();
  U.uCraftInv.value.copy(P).multiply(inv);
}
// ===========================================================================
// THE MARKINGS OF A GIVEN AEROPLANE, from its spec (G160).
// ===========================================================================
// THE BUG THIS EXISTS TO FIX, in the user's own words: "the registration did
// not make it in-game intact, my settings affected only the garage." It was
// exactly that, and the save was never the broken half — a build file carries
// `finish.decals` and the user's Cub carries a placed one (regH 0.6, regL 3.15,
// regC 0.14). What carried it onto an aeroplane was `applyDecals` in
// _cage_ui.js, and _cage_ui.js is the EDITOR: it is bundled into the editor's
// scripts, it runs when a slider moves, and nothing on the flight side has ever
// called it. So the markings existed, were saved, were reloaded — and were
// painted on only while you were looking at the aeroplane in the garage.
//
// ONE KEEPER FOR THE TRANSLATION. The obvious repair is to build the same list
// again on the flight side, and that is the repair this file refuses: two
// implementations of "what does `finish.decals` mean" is precisely how the
// registration ends up in one place in the garage and 30 cm further aft in
// flight. `aeroDecalsFor` is the only thing that turns a placement into a decal
// list. The editor calls it with its live working state so an un-saved slider
// still previews; the flight calls it with the spec merged over the defaults.
//
// AND THE DEFAULTS LIVE HERE for the same reason. `finish.decals` stores
// DEVIATIONS, so a deviation needs something to deviate from, and that
// something has to be reachable from both bundles — the editor's copy was not.
const AERO_DEC_DEF = {
  reg: null,              // filled from the spec's own meta on first build
  regH: 0.30,             // 300 mm is the legal marking height in most places
  regL: 2.10, regC: 0.28, // metres aft of the firewall, metres above the waist
  regTarget: 0,           // 0 fuselage, 1 flying surfaces, 2 both, 3 body+tail
  regMode: 0,             // 0 field, 1 box side view, 2 box plan view
  regRot: 0,
  regCol: null, regOut: null,     // null follows spec.paint.trim (G113.4)
  regOutOn: 1,                    // G214: 0 = the ink alone, no keyline
  regMetal: 0, imgMetal: 0, wimMetal: 0,   // G215: metal flake in the marking
  regW: 0.96, regLock: 1,         // locked: width follows height at the aspect
  regFont: 0,                     // an index into AERO_DEC_FONTS
  imgOn: 0, imgL: 1.2, imgC: 0.0, imgW: 1.2, imgH: 0.6, imgTarget: 0,
  imgMode: 0, imgRot: 0, imgLock: 1,
  wimOn: 0, wimL: 0.0, wimC: 0.0, wimW: 2.0, wimH: 1.0,
  wimMode: 2, wimRot: 0, wimLock: 1,
  // G208.2: WHERE THE CERTIFICATION STICKERS ARE WORN — a place (an index
  // into stickers.js's STICKER_PLACES: the rear fuselage, the cabin side,
  // the fin, the nose, the wing) plus fine tuning off that place's own
  // station, the roundel's size and turn, and whether they show at all.
  // In the decal block so they ride `finish.decals` like every marking —
  // cosmetic, so moving them never withdraws the certificate they picture.
  // THE FIN IS WHERE THEY GO (2026-09-11, the user: "stick them on the fin,
  // that's about the only part all planes share, and it's nice, flat and
  // visible"). Place 3 in STICKER_PLACES; the rear fuselage (0) was the first
  // cut and it is the one panel a pod, a rod boom or a twin boom may not have.
  stkOn: 1, stkPlace: 3, stkL: 0, stkC: 0, stkSize: 0.12, stkRot: 0,
};
const AERO_DEC_ON = [
  { body: 1 },                        // 0 the fuselage
  { wing: 1, tail: 1 },               // 1 the flying surfaces
  { body: 1, wing: 1, tail: 1 },      // 2 both
  { body: 1, tail: 1 },               // 3 the body and the tail
];
const AERO_DEC_MODES = ['field', 'side', 'plan'];

// ===========================================================================
// THE MARKING KIT (G162) — READY-TO-APPLY LIVERY, DRAWN FROM A RECIPE
// ===========================================================================
// The user's ask, in their own words: "ready to apply decals, 2 to 3 colours,
// possible transparency, stripes, dual colour with bended transition (bend
// upwards aft/fore), etc. Possibly several layers, with transparency."
//
// A KIT PATTERN IS A RECIPE, NOT PIXELS, AND THAT IS THE WHOLE POINT. The two
// image channels above cannot reach the flown aeroplane and the file says so:
// `finish.decals` records WHERE a livery image sits and never what it looks
// like, so an imported picture lives exactly as long as the browser tab. A
// pattern is five numbers and three colours; it fits in the spec, it travels
// with the build, and `aeroDecalsFor` redraws it from that recipe on whichever
// side is asking. The kit is therefore the ONLY marking besides the
// registration that survives being saved, sent and flown.
//
// AND IT COSTS NOTHING NEW UNDERNEATH. A pattern is drawn into an atlas page
// and placed by the same eight numbers a registration is placed by — position,
// size, turn, opacity, surface class, projection. No shader branch, no second
// geometry, no unwrap. The only thing that had to grow is AERO_MAXD, because
// three layers plus a registration plus two images is six decals and the
// array held four.
//
// 256 PIXELS A PAGE IS ENOUGH, and the reason is worth writing down because it
// looks as though it should not be. A cheat line stretched 5 m along the body
// samples the page at 20 mm per pixel ALONG — and a stripe has no detail along
// its length. Across, the same page covers the 0.9 m the decal is tall, which
// is 3.5 mm per pixel, and across is where every edge in this kit runs. The
// resolution is in the direction the detail is in. A pattern whose interest
// ran the other way — a row of small badges down the flank — would need a page
// per badge, which is what the image channel is for.
//
// WHY EACH PATTERN CARRIES ITS OWN TWO KNOBS. `chequer` counts squares (2..16)
// and `sweep` measures a fraction of a page (0..0.6); one shared slider range
// cannot serve both, and a knob whose meaning changes silently under a fixed
// label is how a builder ends up with 8 metres of bend. The table declares the
// name, the range and the default, and the panel is generated from it — so a
// new pattern arrives complete with its controls and cannot arrive without
// them.
const AERO_KIT_PAGE0 = 3;        // 0 is the registration, 1 and 2 the images
const AERO_KIT_LAYERS = 3;

// THE KIT'S THREE LAYERS (G162), generated rather than written out, because
// forty-eight hand-typed defaults is forty-eight chances for layer 3 to differ
// from layers 1 and 2 in one field nobody notices. Off by default: an
// aeroplane nobody has decorated wears what it always wore.
//
// THE KNOBS DEFAULT TO null AND THAT IS DELIBERATE — null means "this
// pattern's own default", which is the only thing a shared default CAN mean
// when the ranges are 2..16 for one pattern and 0..0.6 for the next.
const AERO_KIT_LDEF = {
  On: 0, Pat: 0,
  A: 0xb42d2d, B: 0xffffff, D: 0x1b3a5c,
  Alp: 1, P: null, Q: null, Metal: 0,
  L: 2.20, C: 0.10, W: 5.00, H: 0.90,
  // THE FIELD FRAME, and the default placement is written in it. `side` is a
  // box projection through the whole craft, so its station is measured from
  // the craft root and not from the firewall: the same 2.2 lands 4.85 m aft in
  // field terms — off the back of a light aeroplane. A layer must be ON the
  // aeroplane the moment it is switched on, which is what "ready to apply"
  // means; decReframe converts the placement for a builder who wants a box.
  Rot: 0, Tgt: 0, Mode: 0, Flip: 0,
};
const AERO_KIT_FIELDS = Object.keys(AERO_KIT_LDEF);
for (let i = 1; i <= AERO_KIT_LAYERS; i++)
  for (const k of AERO_KIT_FIELDS) AERO_DEC_DEF['m' + i + k] = AERO_KIT_LDEF[k];

const AERO_KIT = [
  // CANVAS ORIENTATION, once, because every draw below depends on it and it is
  // not obvious: q.x comes from the along-body coordinate and q.y from the
  // around/up one, and the page rect accounts for flipY — so on this canvas
  // LEFT IS FORWARD, RIGHT IS AFT and UP IS UP. Patterns overhang the ends by
  // a couple of pixels on purpose: the decal rect is a window, and a stripe
  // that stops short of it grows a keyline across its end.
  { name: 'cheat line', cn: ['band', 'keyline'],
    help: 'one band with a keyline above and below — the stripe that runs the ' +
          'length of nearly every light aeroplane',
    k: [{ n: 'band width', lo: 0.04, hi: 0.90, st: 0.01, def: 0.26 },
        { n: 'keyline width', lo: 0, hi: 0.40, st: 0.01, def: 0.14 }],
    draw(g, P, o) {
      const h = Math.max(2, o.p * P), y = (P - h) / 2, e = o.q * h * 0.5;
      if (e >= 0.5) { g.fillStyle = o.b; g.fillRect(-2, y - e, P + 4, h + 2 * e); }
      g.fillStyle = o.a; g.fillRect(-2, y, P + 4, h);
    } },

  { name: 'twin stripe', cn: ['upper band', 'lower band', 'keyline'],
    help: 'two bands and a gap, in two colours over a shared keyline — the ' +
          'second colour is what makes a livery read as a scheme',
    k: [{ n: 'band width', lo: 0.02, hi: 0.40, st: 0.01, def: 0.13 },
        { n: 'gap', lo: 0, hi: 0.50, st: 0.01, def: 0.09 }],
    draw(g, P, o) {
      const h = Math.max(2, o.p * P), gap = o.q * P;
      const top = (P - (2 * h + gap)) / 2;
      const e = Math.min(h * 0.35, Math.max(1, P * 0.014));
      // THE GAP IS A HOLE, NOT A THIRD STRIPE. Drawing one keyline rectangle
      // behind both bands is a line shorter and floods the gap with the
      // keyline colour, which is a solid three-colour block and not a twin
      // stripe at all.
      const band = (y, col) => {
        g.fillStyle = o.d; g.fillRect(-2, y - e, P + 4, h + 2 * e);
        g.fillStyle = col; g.fillRect(-2, y, P + 4, h);
      };
      band(top, o.a);
      band(top + h + gap, o.b);
    } },

  { name: 'sweep', cn: ['below the line', 'the line'],
    help: 'the two-tone split with a bent transition: everything below the ' +
          'line in one colour, the line rising aft — mirror it to rise fore. ' +
          'Give it enough DEPTH to swallow the belly: the fill stops at the ' +
          'bottom of the layer’s own rectangle, and that edge is a hard one',
    k: [{ n: 'level', lo: 0.05, hi: 0.95, st: 0.01, def: 0.44 },
        { n: 'bend', lo: 0, hi: 0.60, st: 0.01, def: 0.24 }],
    draw(g, P, o) {
      const y0 = (1 - o.p) * P, y1 = y0 - o.q * P;
      // FLAT, THEN RISING — both control points are weighted forward so the
      // line leaves the nose level and lifts over the back half. A straight
      // interpolation between the two heights gives a wedge, which is a racing
      // stripe and not the shape the user asked for.
      const line = () => {
        g.beginPath();
        g.moveTo(-2, y0);
        g.bezierCurveTo(P * 0.46, y0, P * 0.60, y1, P + 2, y1);
      };
      line();
      g.lineTo(P + 2, P + 4); g.lineTo(-2, P + 4); g.closePath();
      g.fillStyle = o.a; g.fill();
      g.lineWidth = Math.max(1.5, P * 0.016);
      g.strokeStyle = o.b;
      line(); g.stroke();
    } },

  { name: 'flash', cn: ['band', 'keyline'],
    help: 'the kinked stripe — the Cub lightning bolt, and every stripe that ' +
          'steps up over the cabin',
    k: [{ n: 'band width', lo: 0.04, hi: 0.50, st: 0.01, def: 0.16 },
        { n: 'step', lo: 0, hi: 0.60, st: 0.01, def: 0.28 }],
    draw(g, P, o) {
      const w = Math.max(2, o.p * P), s = o.q * P;
      const yA = P * 0.5 + s * 0.5, yB = P * 0.5 - s * 0.5;
      const path = () => {
        g.beginPath();
        g.moveTo(-4, yA); g.lineTo(P * 0.34, yA);
        g.lineTo(P * 0.56, yB); g.lineTo(P + 4, yB);
      };
      g.lineCap = 'butt'; g.lineJoin = 'miter'; g.miterLimit = 8;
      g.strokeStyle = o.b; g.lineWidth = w + Math.max(2, P * 0.03);
      path(); g.stroke();
      g.strokeStyle = o.a; g.lineWidth = w;
      path(); g.stroke();
    } },

  { name: 'chequer', cn: ['squares', 'the others'],
    help: 'alternating squares — a rudder, a cowl band, a wing tip',
    k: [{ n: 'along', lo: 2, hi: 16, st: 1, def: 8 },
        { n: 'across', lo: 1, hi: 8, st: 1, def: 2 }],
    draw(g, P, o) {
      const nx = Math.max(1, Math.round(o.p)), ny = Math.max(1, Math.round(o.q));
      const cw = P / nx, ch = P / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        g.fillStyle = ((i + j) & 1) ? o.b : o.a;
        // the half-pixel overlap is not sloppiness: adjacent fills that meet
        // exactly leave an antialiased seam, and a seam through a chequer is
        // a grey grid the builder never asked for
        g.fillRect(i * cw - 0.5, j * ch - 0.5, cw + 1, ch + 1);
      }
    } },
];

// A KNOB IS CLAMPED TO ITS OWN PATTERN'S RANGE, and an unset one takes that
// pattern's default rather than zero. Unset is the normal state: switching
// pattern CLEARS both knobs, because 8 squares and a 0.08 bend are not the
// same number wearing different labels.
function aeroKitKnob(pat, j, v) {
  const k = pat && pat.k && pat.k[j];
  if (!k) return 0;
  const x = (v == null || v === '') ? k.def : +v;
  return Math.max(k.lo, Math.min(k.hi, x !== x ? k.def : x));
}

// THE LAYERS OF A PLACEMENT, resolved and nothing drawn — so the arithmetic
// that decides which page a layer owns, what its knobs mean and where it lands
// can be proven in node, where there is no canvas. The draw is the half that
// needs one, and it is separate for exactly that reason.
function aeroKitLayers(D) {
  const out = [];
  if (!D) return out;
  const onOf = t => AERO_DEC_ON[Math.max(0, Math.min(3, +t || 0))];
  const modeOf = m => AERO_DEC_MODES[Math.max(0, Math.min(2, +m || 0))];
  for (let i = 0; i < AERO_KIT_LAYERS; i++) {
    const q = 'm' + (i + 1);
    if (!D[q + 'On']) continue;
    const pi = Math.max(0, Math.min(AERO_KIT.length - 1,
                 Math.round(+D[q + 'Pat'] || 0)));
    const pat = AERO_KIT[pi], page = AERO_KIT_PAGE0 + i;
    out.push({
      page, pat: pi, name: pat.name,
      a: D[q + 'A'], b: D[q + 'B'], d: D[q + 'D'],
      p: aeroKitKnob(pat, 0, D[q + 'P']),
      q: aeroKitKnob(pat, 1, D[q + 'Q']),
      flip: D[q + 'Flip'] ? 1 : 0,
      place: {
        page,
        sL: +D[q + 'L'] || 0, sC: +D[q + 'C'] || 0,
        w: Math.max(0.02, +D[q + 'W'] || 0.02),
        h: Math.max(0.02, +D[q + 'H'] || 0.02),
        rot: +D[q + 'Rot'] || 0,
        // a painted stripe is paint on paint: smoother than the weave under
        // it, and by less than a registration's ink is
        rough: -0.05,
        // PAINT, NOT LETTERING: hold the physical direction on both flanks.
        // Without this a sweep rises aft on one side of the aeroplane and
        // fore on the other, which is the picture that found the defect.
        noMirror: 1,
        opacity: Math.max(0, Math.min(1,
          D[q + 'Alp'] == null ? 1 : (+D[q + 'Alp'] || 0))),
        metal: +D[q + 'Metal'] || 0,                        // G215
        on: onOf(D[q + 'Tgt']), mode: modeOf(D[q + 'Mode']),
      },
    });
  }
  return out;
}

// REDRAWN ONLY WHEN THE RECIPE CHANGES. Every one of these pages costs a fill
// plus three dilation rounds over 65k pixels, and applyDecals runs on every
// frame of a slider drag — so three layers redrawn unconditionally would put
// a visible lag between the mouse and the picture. The signature is the whole
// recipe, which is the only version of this cache that cannot go stale:
// anything the draw reads is in it.
const AERO_KIT_SIG = {};
function aeroKitDraw(THREE, L) {
  const t = aeroAtlas(THREE), S = AERO_ATLAS_PX, N = AERO_ATLAS_N;
  const sig = [L.pat, L.a, L.b, L.d, L.p, L.q, L.flip].join('|');
  if (AERO_KIT_SIG[L.page] === sig) return false;
  AERO_KIT_SIG[L.page] = sig;
  const P = S / N, px = (L.page % N) * P, py = Math.floor(L.page / N) * P;
  const g = AERO_ATLAS_CV.getContext('2d');
  const hex = v => '#' + ((v == null ? 0 : v) >>> 0).toString(16).padStart(6, '0');
  g.save();
  // CLIPPED, because a pattern overhangs its page on purpose and an overhang
  // that reached the neighbouring page would paint the registration's cell.
  g.beginPath(); g.rect(px, py, P, P); g.clip();
  g.clearRect(px, py, P, P);
  g.translate(px, py);
  // MIRRORED HERE AND NOWHERE ELSE: "bend upwards aft" and "bend upwards
  // fore" are one pattern seen two ways, and a second table row for the
  // mirror is a second thing to keep in step with the first.
  if (L.flip) { g.translate(P, 0); g.scale(-1, 1); }
  AERO_KIT[L.pat].draw(g, P,
    { a: hex(L.a), b: hex(L.b), d: hex(L.d), p: L.p, q: L.q });
  g.restore();
  aeroDilate(g, px, py, P, P, Math.round(3 * P / AERO_PAGE_REF));
  t.needsUpdate = true;
  return true;
}

// D is a placement in AERO_DEC_DEF's shape; `opts` carries what the placement
// does NOT own — the registration string and the paint it defaults its colour
// to. Returns { list, aspect }: the caller gets the aspect back because the
// editor needs it to drive its own width lock, and a return value is how it
// gets it without this function knowing the editor exists.
function aeroDecalsFor(THREE, D, opts) {
  opts = opts || {};
  const trim = opts.trim != null ? opts.trim : 0x1b3a5c;
  const onOf = t => AERO_DEC_ON[Math.max(0, Math.min(3, +t || 0))];
  const modeOf = m => AERO_DEC_MODES[Math.max(0, Math.min(2, +m || 0))];
  const aspect = aeroDecalText(THREE, 0, opts.reg || D.reg || 'F-PGAR',
                   D.regCol != null ? D.regCol : trim,
                   // G214: the keyline is optional — off, the underlay and
                   // the field are the ink's alone
                   (D.regOutOn == null || +D.regOutOn)
                     ? (D.regOut != null ? D.regOut : 0xffffff) : null,
                   D.regFont) || 3.2;
  // LOCKED means the width is DERIVED, and it has to be derived here rather
  // than read off the spec: `regW` is only meaningful when the lock is off, and
  // a saved build that was locked carries whatever width the last font happened
  // to give it. Deriving it is what makes the flown marking the same shape as
  // the drawn one even when the two ran different fonts.
  const w = D.regLock ? D.regH * Math.max(1.2, aspect) : Math.max(0.02, D.regW);
  // THE PAGE IS BIGGER THAN THE GLYPHS (G207, the user: "the height slider
  // is far too limited"). `regH` was the PAGE's height and the glyphs filled
  // a quarter of it, so a 300 mm marking drew 80 mm letters. The page rect is
  // the glyph box divided by what the glyphs occupy of it, and the sliders
  // mean what they say.
  const fit = AERO_TEXT_FIT || { w: 0.86, h: 0.27 };
  const pw = w / Math.max(0.05, fit.w), ph = D.regH / Math.max(0.05, fit.h);
  // THE KIT GOES ON FIRST because the shader mixes the list IN ORDER: a kit
  // layer is paint, and a registration painted under its own cheat line is a
  // registration you cannot read.
  const list = [];
  for (const L of aeroKitLayers(D)) { aeroKitDraw(THREE, L); list.push(L.place); }
  list.push({ page: 0, sL: D.regL, sC: D.regC, w: pw, h: ph,
                  rot: D.regRot, rough: -0.06, sdf: 1, metal: +D.regMetal || 0,
                  on: onOf(D.regTarget), mode: modeOf(D.regMode) });
  if (D.imgOn) list.push({ page: 1, sL: D.imgL, sC: D.imgC, w: D.imgW,
    h: D.imgH, rot: D.imgRot, rough: -0.04, metal: +D.imgMetal || 0,
    on: onOf(D.imgTarget), mode: modeOf(D.imgMode) });
  // the wing's own channel: its own page, its own placement, never the body's
  // classes — that is what "fully independent" means (G113.2).
  if (D.wimOn) list.push({ page: 2, sL: D.wimL, sC: D.wimC, w: D.wimW,
    h: D.wimH, rot: D.wimRot, rough: -0.04, metal: +D.wimMetal || 0,
    on: { wing: 1 }, mode: modeOf(D.wimMode) });
  // G208: THE CERTIFICATION STICKERS — placements the bench's sticker module
  // hands over (page 6, one strip of roundels under the cockpit); it draws
  // its own page and returns nothing while the aeroplane holds no
  // certificate. Through a window hook so this file knows no bench.
  try {
    const X = (typeof window !== 'undefined' && typeof window.AERO_EXTRA_DECALS === 'function')
            ? window.AERO_EXTRA_DECALS(THREE, D) : null;
    if (X) for (const p of X) list.push(p);
  } catch (e) {}
  return { list, aspect };
}

// THE GLAZING A SPEC ASKS FOR (G216). `finish.glass` holds DEVIATIONS from
// the declared set, exactly as the sections and the decals do, so this is the
// one place that turns a saved build into the dial set aeroGlass takes — and
// the flight side calls it instead of guessing. Unknown keys (a dial a later
// chantier retired) are ignored rather than passed on.
function aeroGlassSpec(spec) {
  const out = {};
  for (const k in GLASS_DEF) out[k] = GLASS_DEF[k];
  const s = spec && spec.finish && spec.finish.glass;
  if (s && typeof s === 'object')
    for (const k in GLASS_DEF) if (s[k] !== undefined) out[k] = s[k];
  return out;
}

// THE FLIGHT SIDE'S ONE CALL. Takes a resolved spec and puts that aeroplane's
// markings on it. A spec with no `finish` is not a mistake and is not skipped:
// it is an aeroplane with a factory marking, which is what the defaults ARE.
//
// THE IMAGE PAGES ARE DELIBERATELY NOT DRAWN HERE. `finish.decals` records
// where a livery image sits and never the pixels — 60_gen_spec.js calls that
// out as a deliberate gap — so a flown aeroplane shows the registration and
// any image the editor has already baked into the atlas this session. Painting
// a placeholder into pages 1 and 2 would put a wrong marking on the aeroplane,
// which is worse than the absence.
// THE MERGE, on its own so it can be proven without a canvas. `finish.decals`
// holds DEVIATIONS: a field the builder never touched is absent, and absent has
// to mean the default rather than zero — a missing `regH` read as 0 would give
// a marking no height at all and look exactly like the bug this arc just fixed.
function aeroDecalMerge(spec) {
  const D = {};
  for (const k in AERO_DEC_DEF) D[k] = AERO_DEC_DEF[k];
  const saved = (spec && spec.finish && spec.finish.decals) || {};
  for (const k in saved) if (saved[k] != null) D[k] = saved[k];
  return D;
}
function aeroApplySpecDecals(THREE, spec) {
  if (!spec) return;
  const D = aeroDecalMerge(spec);
  const paint = spec.paint || {};
  const reg = (spec.meta && spec.meta.reg) || spec.reg || null;
  const r = aeroDecalsFor(THREE, D, { reg, trim: paint.trim, base: paint.base });
  aeroSetDecals(THREE, r.list);
}

function aeroSetDecals(THREE, list) {
  const U = aeroDecUniforms(THREE);
  const n = Math.min(AERO_MAXD, (list || []).length);
  U.uDecN.value = n;
  for (let i = 0; i < n; i++) {
    const d = list[i], r = aeroPageRect(d.page || 0);
    U.uDecA.value[i].set(d.sL || 0, d.sC || 0,
      Math.max(1e-4, (d.w || 0.5) * 0.5), Math.max(1e-4, (d.h || 0.3) * 0.5));
    U.uDecB.value[i].set(r[0], r[1], r[2], r[3]);
    U.uDecC.value[i].set(d.rot || 0, d.rough || 0,
      d.opacity != null ? d.opacity : 1, d.noMirror ? 1 : 0);
    const on = d.on || { body: 1 };
    U.uDecD.value[i].set(AERO_DEC_MODE[d.mode] || 0,
      on.body ? 1 : 0, on.wing ? 1 : 0, on.tail ? 1 : 0);
    U.uDecE.value[i].set(d.sdf ? 1 : 0,
      Math.max(0, Math.min(1, +d.metal || 0)),
      d.one ? 1 : 0, 0);      // y: metallic (G215)  z: one side only
  }
}

const AERO_PARS_VS = `
attribute vec4 aStruct;
uniform mat4 uCraftInv;
varying vec4 vSurf;
varying vec3 vObjPos;
varying vec3 vObjNrm;
varying vec3 vCraftPos;
varying vec3 vCraftNrm;
`;

// beginnormal_vertex runs BEFORE begin_vertex, so objectNormal and transformed
// are both in hand here.
const AERO_MAIN_VS = `
  vSurf   = aStruct;
  vObjPos = transformed;
  vObjNrm = objectNormal;
  vCraftPos = (uCraftInv * modelMatrix * vec4(transformed, 1.0)).xyz;
  // ...AND WHICH WAY THE SURFACE FACES, IN THE SAME FRAME (2026-09-11). A
  // marking that must land on ONE SIDE of a thin surface cannot be decided
  // from the position: both faces of a centreline fin are the same 30 mm from
  // the craft's own plane, and both faces of a twin boom's fin are the same
  // 1.2 m out. The NORMAL is what separates them. Rotation only (uCraftInv is
  // orthonormal and the craft has no shear), so mat3 of the pair is enough —
  // this is a SIGN test, not a lighting normal.
  vCraftNrm = mat3(uCraftInv) * mat3(modelMatrix) * objectNormal;
`;

// ---------------------------------------------------------------------------
// THE STRUCTURE GRAMMAR (G68)
// ---------------------------------------------------------------------------
// GEN_BUILD_GRAMMAR says, in metres, how each construction shows itself. This
// is where it is drawn, and the split is the one thing that makes it work:
//
//   THE MASKS DECIDE WHERE, ANALYTICALLY. Frames, stringers, panel lines,
//   laps and the mould parting line are 1-D step functions of the G66 surface
//   field, antialiased on fwidth() of a coordinate that is already in metres.
//   They carry ALL the structural meaning and none of the high frequency.
//
//   A MIPPED STAMP SUPPLIES THE PIXELS. A 4.8 mm rivet head on a 6 m
//   aeroplane filling half a 1920-wide frame is 6.25 mm per pixel — SMALLER
//   THAN ONE PIXEL at the game's ordinary framing, at a 24 mm pitch. An
//   analytic head samples that once per pixel and moires and crawls, and
//   fading it to the mean gives flat, where a real minified rivet row
//   converges to a faint continuous LINE and stays legible. A repeating tile
//   sampled through a coordinate that is continuous in metres gets correct
//   mips and anisotropy for free, and mip 5 of a rivet row IS that line.
//
// The user's objection — "not a decorative tiled texture" — is answered by
// the first half, not contradicted by the second: the objection is to
// decorative PLACEMENT. A tile stamped along a real stringer, at the real
// pitch, with the panel line beside it, is a rivet row.
// GEN_BUILD_GRAMMAR lives in src/core/60_gen_spec.js, beside GEN_MATERIALS,
// because it is the same fact seen from the other side — and it is reached
// the way every other core table is, not copied. A viewer that loads without
// the core (the headless smoke harness) simply gets no structure.
const AERO_GRAMMAR = () =>
  (typeof GEN_BUILD_GRAMMAR !== 'undefined' && GEN_BUILD_GRAMMAR) ||
  (typeof window !== 'undefined' && window.GEN_BUILD_GRAMMAR) || {};

const AERO_FAST_CACHE = {};
function aeroFastTex(THREE, gk, G) {
  if (AERO_FAST_CACHE[gk]) return AERO_FAST_CACHE[gk];
  const f = G && G.fastener;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  // ONE TILE IS ONE PITCH SQUARE OF SURFACE with a single head at its centre,
  // so sampling (alongRow/pitch, acrossRow/pitch + 0.5) puts a head every
  // pitch metres along the row and nowhere else. Repeat wrapping on both
  // axes; the row mask is what keeps them on the member.
  const R = f ? (f.dia * 0.5) / f.pitch : 0;      // head radius, tile units
  const RISE = f ? f.rise / f.pitch : 0;          // and its height, same units
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S - 0.5, v = (y + 0.5) / S - 0.5;
    const r = Math.hypot(u, v);
    let dx = 0, dy = 0, rg = 0.5;
    if (f && r < R && R > 0) {
      // a spherical cap: h = RISE * sqrt(1 - (r/R)^2), so dh/dr is
      // -RISE*(r/R^2)/sqrt(...) and the gradient points along (u,v)/r
      const t = 1 - (r / R) * (r / R);
      const dhdr = -RISE * (r / (R * R)) / Math.max(Math.sqrt(t), 0.08);
      dx = dhdr * (u / (r || 1e-6));
      dy = dhdr * (v / (r || 1e-6));
      // a driven head sits proud and polished at the crown, dirty in the ring
      rg = 0.5 + 0.16 * (r / R) - 0.08;
    }
    const L = Math.hypot(dx, dy, 1);
    const i = (y * S + x) * 4;
    img.data[i]     = Math.round(255 * (0.5 - 0.5 * dx / L));
    img.data[i + 1] = Math.round(255 * (0.5 + 0.5 * dy / L));
    img.data[i + 2] = Math.round(255 * Math.max(0, Math.min(1, rg)));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.LinearEncoding;
  t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
  t.needsUpdate = true;
  return (AERO_FAST_CACHE[gk] = t);
}

const AERO_PARS_FS = `
#define AERO_MAXD 7
uniform sampler2D tDetail;
uniform sampler2D tFast;
uniform vec4 uG0;   // x framePitch  y stringerPitch  z panelAlong  w panelAround
uniform vec4 uG1;   // x tapeW  y tapeRise  z sagFrac  w sagExp
uniform vec4 uG2;   // x dish  y fastPitch  z fastRowW  w fastGain
uniform vec4 uG3;   // x seamW  y seamStep  z partingW  w seamRough
uniform float uGOn; // 0 = this section has no structure (trim, liners, glass)
// MEMBER SCREWS (G214, the user: "some subtle rivets along the pillars and
// rings ... painted in the appropriate color. Smaller than [the cowl's]
// too, maybe like little nails or small screws"). x pitch m, y row half-
// width m, z gain, w on. The stamp is tFastM; the rows are the REAL members
// — the cage's rings (integer stations) and rails (integer levels) — which
// is where a ply or alloy skin is actually screwed to the frame.
uniform vec4 uG6;
uniform sampler2D tFastM;
// METALLIC PAINT (G215, the user: "allow for metallic paint on the global
// fuselage and for the decals"). x = the flake, 0..1. A metallic paint is
// metal flake in a pigment under a clear coat: the material's metalness is
// raised toward the flake's (the factory does that), and the flake breaks
// the roughness up at a scale far below the sheet's so the reflection
// SPARKLES instead of reading as one polished plate.
uniform float uFlake;
uniform sampler2D tAtlas;
uniform int  uDecN;
uniform vec4 uDecA[AERO_MAXD];
uniform vec4 uDecB[AERO_MAXD];
uniform vec4 uDecC[AERO_MAXD];
uniform vec4 uDecD[AERO_MAXD];
uniform vec4 uDecE[AERO_MAXD];  // x: the page's alpha is a signed distance (G212)
uniform float uInset;
// THE THREE DISPLAY GAINS (G206) — shared; see aeroSharedU. x members and
// tapes, y sag and dish, z the large-scale field. uGGain was one x4 over
// everything, and that one number was most of the waffle.
uniform vec3 uGain;
uniform vec3 uGainW;     // the same three for the wing and the tail (G206.3)
// THE LARGE-SCALE FIELD (G206): x amplitude m, y wavelength m, z roughness
// gain. Per material, off the finish row times the section's own dial.
uniform vec4 uField;
// THE CABIN (G206.1): uCabin.x the darkening (shared); uInside.x this
// material is inside on both faces, uInside.y on its BACK face only (the
// exterior skin seen from within)
uniform vec4 uCabin;
uniform vec2 uInside;
// MARKINGS LAND ON PAINTWORK ONLY (G207, the user: "the box projection
// should exclude the engine, the prop, the landing gears, the interior, the
// fuel tanks and the truss"). 1 on the exterior skin, the flying surfaces,
// the cowl and the spats; 0 on everything else.
uniform float uDecOk;
uniform vec4 uG4;   // x realRise  y realHalfW(m)  z lePolish(chord frac)  w realFast
// uG5.w was a wing? FLAG and is a surface CLASS now (G108): 0 the body,
// 1 the wing, 2 the tail. Everything that tested > 0.5 for "is this a
// flying surface" still reads true for both 1 and 2, which is why the widening
// cost nothing — and the decal loop can finally tell a fin from a wing.
uniform vec4 uG5;   // x sparFront(chord frac)  y sparSpan  z tipStart  w class
uniform vec2  uTileM;      // metres per repeat of the detail sheet
uniform float uFieldM;     // metres per unit of aStruct.xy / of object space
uniform vec2  uDetail;     // x normal scale, y roughness gain
uniform float uAlb;        // how much the detail modulates the albedo
// TRANSPOSE THE TRIPLANAR DETAIL (G125.1): 1 swaps the sheet's axes, so a
// grain that runs along the image runs along the OTHER object axis. It
// exists for the propeller: a laminated blade's glue lines run SPANWISE,
// and the sheet's grain arrived chordwise on the blade face. Triplanar
// branch only — the metric field keeps its own frame. The sampled normal's
// xy is deliberately NOT re-swapped: wood sheets carry nrm 0.30 of an
// already-flat veneer map, and the error is below anything the eye finds.
uniform float uDetRot;
uniform vec4 uWear;        // x amount 0..1  y grime  z fade  w streak
uniform vec4 uWearE;       // exhaust streak: sL, sC, run m (<0 off), half-width
uniform vec4 uWearS;       // gear splash:    sL, sC, run m (<0 off), half-width
uniform float uWearK;      // how fast THIS material ages; 1.0 = the airframe
// BOX-MAPPED DETAIL (G113.3, the user: "I would much rather have some box
// mapping for the slabs... we cannot rely on geometry for the mapping of
// these parts, but they are also very flat"). uBoxDet mixes the detail
// SHEET's coordinate from the surface field to a craft-space plane; uBoxPlane
// picks which plane, and the CALLER measures it off the panel's own normals
// rather than assuming - which is what makes a canted V-tail resolve itself.
// The STRUCTURE, the leading-edge wash-out and the field-mode decals all keep
// the field: they are different consumers of the same attribute and only the
// microsurface wanted moving.
uniform float uBoxDet;     // 0 the surface field, 1 a craft-space plane
uniform float uBoxPlane;   // 0 (along, up) the flank; 1 (lateral, along) plan
uniform vec4  uGlass;      // x scratch  y wipe  z grime  w rainbow
// computed in roughnessmap_fragment and SPENT in the clearcoat block, which
// runs after it. On a transmission 0.92 / clearcoat 1.0 material the BASE
// roughness barely shows - the clear layer owns the specular - so a scratch
// that only roughened the base was invisible, measured, in two renders that
// came back pixel-identical. A scratch is geometry: it perturbs the clear
// coat normal, and that is what makes it catch the light.
float aeroGDirt = 0.0;
vec3  aeroGRain = vec3(1.0);   // the rainbow, as a tint on the SPECULAR (G206)
uniform vec4  uGlassE;     // the pane's own extent in field metres: lo.xy hi.xy
// THE GLAZING'S BASE NUMBERS (G206): x how far the Fresnel closes the pane
// at the limb, y how much of a lit body colour an opaque pane shows
uniform vec4  uGlassB;
varying vec4 vSurf;
varying vec3 vObjPos;
varying vec3 vObjNrm;
// CRAFT SPACE (G108): metres, x lateral, y aft, z up, ONE frame for the whole
// aeroplane. vObjPos cannot do this job — every layer is in its own local
// frame and its own units (measured on the stock build: the cowl, the gear
// and the crew are in metres, the fin and stab in cage units at 0.745 m each)
// so a projector built on it changes scale at every layer boundary it crosses.
varying vec3 vCraftPos;
varying vec3 vCraftNrm;

// WHERE THE DETAIL SHEET IS READ FROM. The field on a fuselage, a flat plane
// through the craft on a tail surface - and a mix rather than a branch, so
// every fragment in a quad takes one path and the derivatives stay defined.
vec2 aeroDetST() {
  vec2 fieldC = vSurf.xy * uFieldM;
  vec2 boxC = mix(vec2(vCraftPos.y, vCraftPos.z),
                  vec2(vCraftPos.x, vCraftPos.y), step(0.5, uBoxPlane));
  return mix(fieldC, boxC, uBoxDet) / uTileM;
}

vec3 aeroUnpack(vec4 t, float s) {
  vec2 xy = (t.rg * 2.0 - 1.0) * s;
  return vec3(xy, sqrt(max(1.0 - dot(xy, xy), 0.0)));
}

// UDN: the cheap, stable blend for two normals that share a tangent frame —
// the weave of the cloth and the rib the cloth is stretched over. Their
// gradients add, which is what stacking surface features means. It is NOT the
// operator for the triplanar case, where the three samples live in three
// different frames and whiteout is what reorients them.
vec3 aeroUDN(vec3 a, vec3 b) {
  return normalize(vec3(a.xy + b.xy, a.z));
}

// r128's perturbNormal2Arb, split so the frame can be driven by ANY 2-D
// coordinate instead of the hard-coded vUv — which is the whole point, since
// this material binds no map and USE_UV is never defined. Same math, same
// faceDirection. det == 0 (a coordinate that does not vary, i.e. a pole or a
// group with no field) yields scale 0, so the normal is left alone rather
// than becoming NaN.
// signed distance, in metres, to the nearest multiple of p (0 = a member is
// here). p <= 0 means "this construction has none", answered as far away.
float aeroNear(float x, float p) {
  return (p > 0.0) ? (fract(x / p + 0.5) - 0.5) * p : 1e3;
}
// THE NEARER OF TWO MEMBERS (G222, the user: "I'd want the tape lines and the
// rivet lines to coincide. Is that possible?"). An airframe has TWO families
// of member and the grammar draws both: the REAL rings and rails the
// generator knows about (integer stations and levels — the bulkheads, the
// pillars, the longerons) and the METRIC pitch a construction has between
// them. Each family telegraphed its own line and carried its own fastener
// row, so heads landed on lines that were not there and lines ran with no
// heads on them. A skin is screwed to WHATEVER member is under it, so every
// fastener row now takes the nearer of the two — which puts a head on every
// line the grammar draws, and nowhere else. Signed, because the stamp needs
// which side of the row it is on. 1e3 is "this family has none", so the
// other one wins by construction.
float aeroNearer(float a, float b) {
  return (abs(a) < abs(b)) ? a : b;
}

// A STREAK IS A SOURCE AND A RUN (G70), not a smudge somebody placed. The
// second argument is the source in the surface field — where the exhaust actually exits, where
// the wheel actually throws — and the trail runs AFT from it in metres,
// widening and thinning as it goes, which is what soot on a flank does.
// Everything here is metric, so it does not change when the aeroplane does.
//
// The early return is UNIFORM-SAFE: it contains no texture fetch, so no
// derivative depends on it. That is the rule the decal loop was written to
// (see THE LOOP IS UNIFORM) and it is worth restating rather than
// rediscovering — the sampling for a streak's break-up happens outside.
float aeroStreak(vec2 m, vec4 s) {
  if (s.z <= 0.0) return 0.0;                 // this source is not declared
  float t = (m.x - s.x) / s.z;
  if (t < 0.0 || t > 1.0) return 0.0;
  float wid = s.w * (0.55 + 0.85 * t);        // the plume spreads as it goes
  float d = (m.y - s.y) / max(wid, 1e-4);
  return exp(-d * d) * (1.0 - t) * smoothstep(0.0, 0.10, t);
}

// THE LARGE-SCALE FIELD (G206, the user: "something like a musgrave texture
// at large scale over the whole body"). What every real skin has and no
// tiling sheet can carry: the slow, NON-REPEATING undulation of rolled
// sheet and set panels on metal (0.3-1.5 m, 0.5-2 mm), sanding and glue-line
// ghosts on ply, the barely-there slack of fabric between its stringers.
// Musgrave's hybrid multifractal is the classic generator because it is
// HETEROGENEOUS — smooth in places, busy in others — which is what set
// panels look like, where plain fBm is uniformly busy.
//
// EVALUATED IN METRES, off the surface field (or a craft-space plane on the
// triplanar branch), so it never repeats and stays the same size on every
// layer. The gradient is a fixed METRIC step, not fwidth: a slope must be the
// same slope from every distance, or the undulation breathes with the zoom.
// The sin-hash is the same value noise the grammar's oil-canning seeds on.
float aeroHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float aeroVNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(aeroHash(i), aeroHash(i + vec2(1.0, 0.0)), u.x),
             mix(aeroHash(i + vec2(0.0, 1.0)), aeroHash(i + vec2(1.0, 1.0)), u.x),
             u.y);
}
float aeroMusgrave(vec2 p) {
  float sum = 0.0, w = 1.0, amp = 1.0, f = 1.0;
  for (int i = 0; i < 4; i++) {
    float s = ((aeroVNoise(p * f) - 0.5) * 2.0 + 0.55) * amp;
    sum += w * s;
    w = clamp(sum, 0.0, 1.0);          // hybrid: the high ground gets busy
    amp *= 0.5; f *= 2.07;
  }
  return sum * 0.55 - 0.45;            // about -1 .. 1
}
// adds the field's height gradient (m/m) to dF and its roughness to rgh;
// returns the field's own value, which the oil-canning reads to vary the
// dish depth. No fetch inside, so the early return is uniform-safe.
float aeroField(vec2 m, inout vec2 dF, inout float rgh) {
  if (uField.x <= 0.0 || uField.y <= 0.0) return 0.0;
  float L = uField.y;
  vec2 p = m / L;
  float e = 0.02;
  float h0 = aeroMusgrave(p);
  float hx = aeroMusgrave(p + vec2(e, 0.0));
  float hy = aeroMusgrave(p + vec2(0.0, e));
  float k = uField.x / (e * L);
  dF.x += (hx - h0) * k;
  dF.y += (hy - h0) * k;
  rgh += h0 * uField.z * 0.12;
  return h0;
}

// THE GRAMMAR. Height GRADIENTS in metres per metre, which is what a
// tangent-space normal is, so every amplitude below is a real dimension and
// not a taste knob. Accumulated as dH and converted once at the end, because
// summing gradients is what stacking surface features actually means.
// THREE ACCUMULATORS SINCE G206, one per display gain: dH is what a member
// prints (tape, telegraphing, fasteners, seams), dS is what the covering does
// between members (sag, dish), dF is the large-scale field. They were one
// sum under one x4, and the sag and dish quadrupled were the waffle.
vec3 aeroStructure(vec2 m, inout float rgh) {
  vec2 dH = vec2(0.0);
  vec2 dS = vec2(0.0);
  vec2 dF = vec2(0.0);
  // the body's gains, or the flying surfaces' (uG5.w is the surface class)
  vec3 gn = (uG5.w > 0.5) ? uGainW : uGain;
  float fw = max(fwidth(m.x) + fwidth(m.y), 1e-6);   // ~metres per pixel
  // the field applies to every skin that declares one, structure or not: a
  // painted strut fairing has no frames and still has set panels
  float fldV = aeroField(m, dF, rgh);
  if (uGOn > 0.5) {

  // THE REAL MEMBERS (G68.1). The metric pitches below place the frames and
  // stringers a construction HAS; these place the ones the generator KNOWS
  // ABOUT — an integer station is a bulkhead or a rib, an integer rail is a
  // longeron or a SPAR. On the fuselage they are the pillars and the named
  // rails; on the wing they are the whole story, because ribs are not evenly
  // spaced across the span (61_gen_frame divides each panel separately) and
  // spars sit at 0.15 and 0.65 chord, which is not a pitch at all.
  //
  // The width is wanted in METRES and the coordinate is an index, so the two
  // derivatives give the conversion. It is well conditioned here — both vary
  // smoothly and near-linearly across a bay — and clamped anyway, because at
  // a silhouette the ratio is meaningless.
  // THE D-SKIN IS SMOOTH, AND NOT ONLY PALE (2026-09-04, the user: "the wing
  // spars are visible everywhere, while IRL the leading edge is smooth. Could
  // we limit the ribbed normal to the wing but the leading edge"). The band
  // below already existed — as a ROUGHNESS and an albedo feature, further
  // down — because a leading edge is a metal D-skin wrapped over the front of
  // the ribs and bonded to the front spar. That is a stressed shell, not
  // fabric pulled over stations: nothing telegraphs through it, there is no
  // sag between the ribs under it, and the front spar it is bonded to is the
  // one member on a wing that cannot print. So the same band that pales the
  // paint now also silences the RELIEF, over the same distance in metres from
  // the edge and off the same uniform, and everything aft of it is unchanged.
  //
  // AND IT IS A CUT, NOT A FADE (the user, on the first version, tracing the
  // line on a screenshot: "rather than a progressive disparition of the
  // normal, maybe we should just cut the marks from that line onwards? The
  // real things put a smooth semirigid thing in front of the spars, so it
  // starts sharp"). That is right, and for a physical reason: the D-skin's aft
  // edge is a LAP JOINT onto the covering, not a blend — the ribs print
  // through right up to it and not at all in front of it. A ramp over 120 mm
  // was a haze where a real wing has an edge. The transition is one fragment
  // wide (fw is this pixel's own footprint in metres), which is a hard line
  // that still does not crawl at a distance.
  // NO BACKTICKS IN HERE — this whole block is a template literal and a stray
  // one ends it mid-shader. It has now cost three debugging rounds.
  float leK = (uG4.z > 0.0 && uG5.w > 0.5)
    ? smoothstep(uG4.z - fw, uG4.z + fw, max(m.y, 0.0)) : 1.0;
  // BOTH FAMILIES' DISTANCES, IN ONE PLACE (G222). They were computed in two
  // scopes — the real members inside the branch below, the metric ones after
  // it — which is why nothing could put a fastener on both. 1e3 = absent.
  float dSt = 1e3, dLv = 1e3;
  float df = aeroNear(m.x, uG0.x);      // to the nearest metric frame
  float ds = aeroNear(m.y, uG0.y);      // to the nearest metric stringer
  if (uG4.x > 0.0) {
    float mSt = clamp(fwidth(m.x) / max(fwidth(vSurf.z), 1e-5), 0.02, 4.0);
    float mLv = clamp(fwidth(m.y) / max(fwidth(vSurf.w), 1e-5), 0.02, 4.0);
    dSt = (fract(vSurf.z + 0.5) - 0.5) * mSt;         // metres to the ring
    dLv = (fract(vSurf.w + 0.5) - 0.5) * mLv;         // metres to the rail
    float w2 = max(uG4.y * uG4.y, 1e-8);
    dH.x += leK * uG4.x * (-2.0 * dSt / w2) * exp(-dSt * dSt / w2);
    dH.y += leK * uG4.x * (-2.0 * dLv / w2) * exp(-dLv * dLv / w2);
    // and the SAG between ribs, which on a fabric wing is the whole look:
    // the covering is pulled between them and the tape rides the ridge
    if (uG1.z > 0.0) {
      // amplitude is frac x the BAY (mSt metres); the chain rule then divides
      // by that same bay, because t is fract(station) and not metres. The
      // first cut multiplied by mSt again at the end, which cancelled the
      // division and left the sag ~2.7x too shallow to see.
      const float PI2 = 3.14159265;
      float t = fract(vSurf.z), sg = sin(PI2 * t);
      dS.x -= leK * uG1.z * uG1.w * pow(max(sg, 1e-4), uG1.w - 1.0)
            * cos(PI2 * t) * PI2;
    }
    // MEMBER SCREWS (G214) along the real rings and rails of the BODY: the
    // same stamp discipline as the rivet rows (a head smaller than a pixel
    // must be a mipped stamp, not an analytic dome), painted — so they are
    // a normal and a little roughness, never a colour. Where a ring and a
    // rail cross, the stronger head wins rather than summing to a lump.
    if (uG6.w > 0.0 && uG6.x > 0.0 && uG5.w < 0.5) {
      float p3 = uG6.x;
      // G222: on the nearer member of either family, so a head lands on
      // every line the grammar draws
      vec4 fs2 = texture2D(tFastM, vec2(m.y / p3, aeroNearer(dSt, df) / p3 + 0.5));
      vec4 ff2 = texture2D(tFastM, vec2(m.x / p3, aeroNearer(dLv, ds) / p3 + 0.5));
      float ms2 = 1.0 - smoothstep(uG6.y - fw, uG6.y + fw, abs(aeroNearer(dSt, df)));
      float mf2 = 1.0 - smoothstep(uG6.y - fw, uG6.y + fw, abs(aeroNearer(dLv, ds)));
      vec2 g2 = (fs2.rg * 2.0 - 1.0) * ms2;
      vec2 g3 = (ff2.rg * 2.0 - 1.0) * mf2;
      vec2 gg2 = (dot(g2, g2) > dot(g3, g3)) ? g2 : g3;
      dH.x += -gg2.x * uG6.z;
      dH.y +=  gg2.y * uG6.z;
      rgh += ((fs2.b - 0.5) * ms2 + (ff2.b - 0.5) * mf2) * 0.25;
    }
    // fasteners along the real members: rib lacing, or the spar-cap rivets
    if (uG4.w > 0.0 && uG2.y > 0.0) {
      float p2 = uG2.y;
      vec4 fr = texture2D(tFast, vec2(m.y / p2, dSt / p2 + 0.5));
      float mr = (1.0 - smoothstep(uG2.z - fw, uG2.z + fw, abs(dSt))) * leK;
      vec2 gr = (fr.rg * 2.0 - 1.0) * mr;
      dH.x += -gr.x * uG4.w;
      dH.y +=  gr.y * uG4.w;
      rgh += (fr.b - 0.5) * mr * 0.5;
    }
  }

  // THE WASHED-OUT LEADING EDGE, which the user named as one of the three
  // things the old yellow plane got right. It is not a normal feature at
  // all: the LE is a metal D-skin on a fabric wing and bare polished alloy on
  // a metal one, so it is SMOOTHER and LIGHTER than the covering behind it.
  //
  // IN METRES FROM THE EDGE, not in chord fraction. A fraction makes the band
  // narrow where the chord is short and wide where it is long — on this
  // aeroplane's fin, whose dorsal carries a 3.9 m root chord against a 0.6 m
  // tip, that is narrow at the root and wide at the tip, which is the exact
  // opposite of a real D-skin. sC is already metres from the leading edge, so
  // the honest version is also the simpler one.
  if (uG4.z > 0.0 && uG5.w > 0.5)
    rgh -= (1.0 - smoothstep(0.0, uG4.z, max(m.y, 0.0))) * 0.30;

  // ...and the ONE distance each way that every fastener row rides (G222):
  // the nearer member, whichever family it belongs to
  float dA = aeroNearer(dSt, df);       // to the nearest frame, either kind
  float dB = aeroNearer(dLv, ds);       // to the nearest longeron, either kind

  // TAPE / TELEGRAPHING. On fabric this is the 50 mm surface tape doped over
  // every rib and former, and it is the single feature that makes a covered
  // airframe read as covered. On ply and alloy the same term is the member
  // itself printing faintly through the skin.
  if (uG1.y > 0.0 && uG1.x > 0.0) {
    float w2 = uG1.x * uG1.x;
    dH.x += uG1.y * (-2.0 * df / w2) * exp(-df * df / w2);
    dH.y += uG1.y * (-2.0 * ds / w2) * exp(-ds * ds / w2);
  }

  // SAG. Fabric slack between members, FLAT-BOTTOMED: the exponent is what
  // makes it a membrane under tension instead of a sine wave, and 1.4 is the
  // number the old bump sheet used because it read right.
  if (uG1.z > 0.0) {
    const float PI = 3.14159265;
    // ONE DIRECTION ON A FABRIC FUSELAGE (G206): a construction whose
    // framePitch is 0 (tube + fabric, since the covering touches only the
    // stringers) sags ACROSS the stringers and nowhere else — this is what
    // makes a Cub read as flat with long lines rather than as a quilt.
    if (uG0.x > 0.0) {
      float t = fract(m.x / uG0.x), s = sin(PI * t);
      dS.x -= uG1.z * uG0.x * uG1.w * pow(max(s, 1e-4), uG1.w - 1.0)
            * cos(PI * t) * PI / uG0.x;
    }
    if (uG0.y > 0.0) {
      float t = fract(m.y / uG0.y), s = sin(PI * t);
      dS.y -= uG1.z * uG0.y * uG1.w * pow(max(s, 1e-4), uG1.w - 1.0)
            * cos(PI * t) * PI / uG0.y;
    }
  }

  // OIL-CANNING. A dish per cell, seeded on the cell so it is stable frame to
  // frame, and it DISHES IN more than it bulges — which is what an unloaded
  // metal panel actually does, and what makes metal read as metal in raking
  // light. Nothing else in this file is doing that job.
  // ...AND IRREGULAR (G206). A dish in EVERY cell at a regular sin*sin is a
  // waffle by construction, whatever the depth. Real oil-canning is one bay
  // in two or three, each its own depth, and the large-scale field bends
  // the depth again so no two neighbours read alike.
  if (abs(uG2.x) > 0.0 && uG0.x > 0.0 && uG0.y > 0.0) {
    const float PI = 3.14159265;
    vec2 cell = floor(vec2(m.x / uG0.x, m.y / uG0.y));
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float on = smoothstep(0.40, 0.60, h);
    float a = uG2.x * (0.35 + 1.1 * h) * on
            * (0.6 + 0.8 * clamp(fldV + 0.5, 0.0, 1.0));
    float tx = fract(m.x / uG0.x), ty = fract(m.y / uG0.y);
    dS.x += a * PI / uG0.x * cos(PI * tx) * sin(PI * ty);
    dS.y += a * PI / uG0.y * sin(PI * tx) * cos(PI * ty);
  }

  // PANEL LINES and LAPS. The boundary is a groove; on alloy it also carries
  // a step of one sheet thickness, and the lap always faces AFT so the
  // airflow cannot lift the edge. A step is a delta in the gradient, so it is
  // spread over a ramp no narrower than a pixel or it aliases into confetti.
  float dpA = aeroNear(m.x, uG0.z), dpB = aeroNear(m.y, uG0.w);
  // ---------------------------------------------------------------------
  // A SHEET EDGE STOPS WHERE THE SHEET RUN STOPS (user, 2026-08-31: "the
  // bump line of the texturing riding along the waist should end at the
  // window pillar (the one in front of the pilot), and not extend into the
  // nose part").
  //
  // The line the user is looking at is the LONGITUDINAL LAP: measured on
  // their own build the skin grammar is wood — partingW 0, so it is not
  // the mould line — with panelAround 0.85 and a 0.4 mm step, three times
  // the tape's 0.12 mm rise, and at 850 mm round the section one of those
  // laps lands exactly on sC = 0, which IS the waist rail.
  //
  // sL = 0 is already the windscreen base ring, by the definition the join
  // has used since G49 (_cage_gen.js's own sLOf), so "stop it at the window
  // pillar" needs no new uniform and no new attribute: it is m.x >= 0.
  //
  // WHAT IS MASKED AND WHAT IS NOT, because they are different things:
  //   * the longitudinal LAP and the mould PARTING LINE are sheet edges, and
  //     the nose deck is a different sheet run — they stop.
  //   * the tape / telegraphing over the STRINGERS does not: a longeron runs
  //     forward through the firewall, and its print on the skin runs with it.
  //   * the circumferential lap (dpA, along the body) does not: the nose has
  //     its own frames and its own seams round the section.
  //
  // BODY ONLY. On a wing or a tail sL is a spanwise coordinate, not a
  // station aft of a firewall, so masking m.x < 0 there would strip the laps
  // off one half of the surface. uG5.w is the surface CLASS: 0 the body.
  float runFwd = (uG5.w < 0.5)
    ? smoothstep(-0.045, 0.005, m.x)
    : 1.0;
  if (uG3.x > 0.0) {
    // THE LINE IS THE SHEET EDGE, and a sheet edge is half a millimetre —
    // never the 22 mm of the lap itself. Widening the groove to the lap width
    // turned a panel line into a broad soft swell you had to be told about.
    // The lap's own width is what the STEP is spread over, below.
    float w = max(0.0006, fw * 0.8), w2 = w * w;
    float d = 0.00035;                       // groove depth, metres
    dH.x += 2.0 * d * dpA / w2 * exp(-dpA * dpA / w2);
    // the LONGITUDINAL groove fades out forward of the window pillar
    dH.y += runFwd * 2.0 * d * dpB / w2 * exp(-dpB * dpB / w2);
    // and the LAP STEP: one sheet thickness, spread over a ramp no narrower
    // than a pixel or it aliases into confetti. It faces AFT, so the forward
    // sheet lies on top and the airflow cannot lift the edge.
    float ramp = max(uG3.x * 0.5, fw * 1.5);
    if (uG0.z > 0.0 && abs(dpA) < ramp) dH.x -= uG3.y / ramp;
    rgh += uG3.w * (exp(-dpA * dpA / w2) + runFwd * exp(-dpB * dpB / w2));
  }
  // THE MOULD PARTING LINE, and it needs no pitch at all: a moulded fuselage
  // splits at the waterline, and the waist rail IS sC = 0.
  if (uG3.z > 0.0) {
    float w2 = uG3.z * uG3.z;
    // and it stops at the same station, for the same reason: the nose is a
    // different moulding, so the shell's own split does not run through it
    dH.y += runFwd * 2.0 * 0.0004 * m.y / w2 * exp(-m.y * m.y / w2);
  }

  // FASTENERS. The row is ON the member; the panel edge is a few millimetres
  // away, which is the 2D edge-distance rule showing itself for free.
  if (uG2.w > 0.0 && uG2.y > 0.0) {
    float p = uG2.y, rw = uG2.z;
    // along a stringer the row runs ALONG the body; along a frame it runs
    // AROUND the section. Same tile, two orientations.
    // G222: the SAME two distances the tape and the member screws use — a
    // rivet row that rode only the metric pitch put heads where the user's
    // build (tape rise 0, the real rings carrying every visible line) drew
    // no line at all.
    vec4 fs = texture2D(tFast, vec2(m.x / p, dB / p + 0.5));
    vec4 ff = texture2D(tFast, vec2(m.y / p, dA / p + 0.5));
    float ms = 1.0 - smoothstep(rw - fw, rw + fw, abs(dB));
    float mf = 1.0 - smoothstep(rw - fw, rw + fw, abs(dA));
    // a row is silenced only when NEITHER family has a member that way
    if (uG0.y <= 0.0 && uG4.x <= 0.0) ms = 0.0;
    if (uG0.x <= 0.0 && uG4.x <= 0.0) mf = 0.0;
    vec2 gs = (fs.rg * 2.0 - 1.0) * ms;
    vec2 gf = (ff.rg * 2.0 - 1.0) * mf;
    // the two rows cross on a member intersection: take the stronger head
    // rather than summing, or the crossing grows a lump no aeroplane has
    vec2 gg = (dot(gs, gs) > dot(gf, gf)) ? gs : gf;
    dH.x += -gg.x * uG2.w;
    dH.y +=  gg.y * uG2.w;
    rgh += (fs.b - 0.5) * ms * 0.5 + (ff.b - 0.5) * mf * 0.5;
  }

  // A DISPLAY GAIN, AND IT IS NAMED AS ONE. Every amplitude above is a real
  // dimension, so dH is the true slope of the real surface — and the true
  // slope of a 0.65 mm rib tape over a 50 mm shoulder is 1.3 %, which is
  // 0.6 degrees and reads as nothing at all. Real tapes are legible across an
  // airfield anyway, because a doped tape has a pinked edge and a lip of dope
  // that a Gaussian does not, and because the sun is a harder source than six
  // shop lamps. Rather than corrupt the grammar's numbers to compensate — they
  // are the honest ones, and G68's whole claim is that they are real — the
  // exaggeration lives HERE, in one uniform, where it is visible and tunable.
  // Same posture as garage.js's nrmScale, which was 0.9 over a normalised
  // field for the same reason.
  //
  // THREE GAINS (G206), not one: the tape's exaggeration was never the sag's
  // to borrow. uGain.x exaggerates what a member prints, uGain.y what the
  // covering does between members (near 1: those numbers were honest and
  // were quadrupled), uGain.z the large-scale field. All three are the lab's.
  }
  return normalize(vec3(-(dH.x * gn.x + dS.x * gn.y + dF.x * gn.z),
                         (dH.y * gn.x + dS.y * gn.y + dF.y * gn.z),
                         1.0));
}

void aeroFrame(vec3 eye, vec3 N, vec2 st, float fd, out vec3 T, out vec3 B) {
  vec3 q0 = vec3(dFdx(eye.x), dFdx(eye.y), dFdx(eye.z));
  vec3 q1 = vec3(dFdy(eye.x), dFdy(eye.y), dFdy(eye.z));
  vec2 s0 = dFdx(st), s1 = dFdy(st);
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  T = q1p * s0.x + q0p * s1.x;
  B = q1p * s0.y + q0p * s1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = (det == 0.0) ? 0.0 : fd * inversesqrt(det);
  T *= sc; B *= sc;
}
`;

// THE ALBEDO. v1 of the layer stack the user specified — "base material from
// the configurator, per section -> color picker tinting the albedo ->
// orthographic projection -> decals". The first two land here; the projection
// and the decals are G69, and they composite on top of exactly this.
//
// There is no colour map, by design (see the header): the detail sheet
// modulates VALUE only, off the same roughness channel that already carries
// the weave, so a raised thread reads slightly differently from the valley
// beside it without a second sampler and without fighting the colour picker.
// THE COLOUR LIVES ON material.color, NOT IN A UNIFORM, and that is a join
// requirement rather than a style choice. `_cage_join.js`'s snapshot reads
// `m0.color.getHex()` off every material it freezes — it is how the flown
// aeroplane learns what the editor's aeroplane looked like — so a material
// that hides its albedo in a uniform snapshots as WHITE. Putting the
// resolved colour (the finish's base, or the section's pick) on `color`
// keeps that path working untouched, makes the material introspectable, and
// costs nothing: `diffuse` is already in the shader.
//
// It round-trips exactly, because r128 feeds `color` to the shader as linear
// and takes it back out the same way — so the value the join carries is the
// value the game re-applies.
const AERO_ALBEDO_FS = `
  // declared HERE, and used again in the surface pass below: map_fragment
  // runs before normal_fragment_maps, so this is the earlier of the two and
  // the one that owns the name.
  vec2 aeroM = vSurf.xy * uFieldM;
  float aeroDecR = 0.0;
  float aeroDecM = 0.0;      // G215: how much of the pixel a METALLIC marking covers
  float aeroD = 0.0;
  // the wear masks, declared here and spent in the surface pass below:
  // grime, sun chalking, exhaust soot, wheel splash
  float aeroWG = 0.0, aeroWF = 0.0, aeroWS = 0.0, aeroWM = 0.0;
  #if AEROSKIN_SURF == 1
    // MIXED, never branched: a branch around texture2D makes the mip level
    // undefined, which is this file's oldest shader rule.
    aeroD = texture2D(tDetail, aeroDetST()).b;
  #else
    vec3 aeroW0 = pow(abs(normalize(vObjNrm)), vec3(4.0));
    aeroW0 /= (aeroW0.x + aeroW0.y + aeroW0.z);
    vec3 aeroP0 = vObjPos * uFieldM;
    aeroD = texture2D(tDetail, aeroP0.zy / uTileM).b * aeroW0.x
          + texture2D(tDetail, aeroP0.xz / uTileM).b * aeroW0.y
          + texture2D(tDetail, aeroP0.xy / uTileM).b * aeroW0.z;
  #endif
  diffuseColor.rgb *= 1.0 + uAlb * (aeroD - 0.85);
  // THE DECALS, last in the albedo stack — "base material from the
  // configurator, per section -> color picker tinting the albedo ->
  // orthographic projection -> decals", in the user's own order.
  //
  // THE LOOP IS UNIFORM, deliberately. Its bound is a constant and its break
  // is on a UNIFORM, so every fragment in a quad takes the same path and
  // texture2D's derivatives are defined. A per-fragment continue for an
  // out-of-bounds decal would be the obvious way to write this and it is
  // wrong: divergent flow makes the mip level undefined, which shows up as
  // the decal's edge crawling and nowhere else.
  // THE BOX PROJECTOR WORKS IN CRAFT SPACE, and every axis convention is
  // baked into uCraftInv on the way in — so there is no axis juggling here,
  // no handedness to get wrong, and no uSideAxis. x is lateral, y runs AFT
  // (the same sense the surface field's sL runs, so the station slider means
  // one thing in both modes), z is up, all in metres.
  //
  // vObjPos CANNOT DO THIS JOB, and it took a picture to see why. Every layer
  // is in its own local frame and its own units: measured on the stock build,
  // the cowl, the gear and the crew are in metres (uFieldM 1) while the fin
  // and stab are in cage units (0.745). A projector built on vObjPos placed
  // the marking at a different scale on every layer it crossed — which is why
  // a registration walked up to the cowl seam and stopped dead there.
  vec3 aeroA = vCraftPos;
  float aeroSideF = (aeroA.x < 0.0) ? -1.0 : 1.0;
  for (int di = 0; di < AERO_MAXD; ++di) {
    if (di >= uDecN) break;
    // WHICH SURFACES THIS ONE LANDS ON, by class rather than by a
    // fuselage/flying/both scalar — the fin belongs with the fuselage and the
    // wing does not, and the old scalar could not say so.
    float cls = uG5.w;
    float onMe = (cls < 0.5) ? uDecD[di].y
               : (cls < 1.5) ? uDecD[di].z : uDecD[di].w;
    // THE FAR FLANK READS BACKWARDS unless its along-body axis is negated —
    // G4.5's trap, arriving by a new route. sL runs aft and is NOT mirrored,
    // so the glyph is laid out in the same physical direction on both sides;
    // seen from the other side that direction runs the other way across the
    // eye. CRAFT SPACE names the lateral axis for us now (G108 retired
    // uSideAxis, which had been declared, defaulted and never passed by any
    // caller since G69 — so it claimed "z in the flown model frame" and was
    // 0 everywhere), and the positive flank is the one to mirror. Same answer G4.5 reached — "walk the far
    // arc BACKWARDS and flip nothing" - applied to a coordinate. WHICH sign
    // is measured, not derived: on this build the flank whose registration
    // reads backwards is the one at negative x, and reasoning about the
    // handedness of the cage frame got it wrong twice before the picture
    // settled it.
    // THE COORDINATE, one of three, chosen by a uniform and MIXED rather than
    // branched: a per-fragment branch around a texture2D makes the mip level
    // undefined, and this loop's whole shape exists to avoid that.
    //
    //   FIELD  metres along and around the body. It wraps, which is what a
    //          fuselage marking must do, and it is meaningless where there is
    //          no field — so on the triplanar branch it is not offered.
    //   SIDE   an orthographic projection in (along, up): the flank view. A
    //          marking runs continuously from the fuselage onto the fin,
    //          which was the user's "the fuselage projection and the fin
    //          projection should be one".
    //   PLAN   the same in (lateral, along): a stripe crosses both wings as
    //          one thing, because that is what looking down at it does.
    float mode = uDecD[di].x;
    // A REGISTRATION MIRRORS AND PAINT DOES NOT (G162). aeroSideF negates the
    // along-body axis on the far flank so a marking reads the right way round
    // from both sides — correct for letters, wrong for a livery: a sweep that
    // rises aft on this side would rise FORE on the other, which no aeroplane
    // has ever been painted. uDecC.w picks, and 0 is the old behaviour.
    float mir = mix(aeroSideF, 1.0, step(0.5, uDecC[di].w));
    vec2 fieldC = vec2((aeroM.x - uDecA[di].x) * mir,
                        aeroM.y - uDecA[di].y);
    // SIDE mirrors the far flank exactly as the field does, and for the same
    // reason: the glyph is laid out along one physical direction, and seen
    // from the other side that direction crosses the eye the other way.
    // PLAN does not — a plan view has one handedness and a stripe drawn
    // across the span is the same stripe from either wing tip.
    vec2 sideC2 = vec2((aeroA.y - uDecA[di].x) * mir,
                        aeroA.z - uDecA[di].y);
    vec2 planC = vec2(aeroA.x - uDecA[di].x, aeroA.y - uDecA[di].y);
    vec2 boxC = mix(sideC2, planC, step(1.5, mode));
    #if AEROSKIN_SURF == 1
      vec2 dd = mix(fieldC, boxC, step(0.5, mode));
    #else
      // no field here: a triplanar surface has no aStruct to read, so the
      // only honest coordinate is the box one. This is what lets a marking
      // reach the COWL at all — the loop used to be inside the field's own
      // #if, and every analytic surface was outside it.
      vec2 dd = boxC;
      if (mode < 0.5) onMe = 0.0;
    #endif
    float cr = cos(uDecC[di].x), sr = sin(uDecC[di].x);
    dd = vec2(dd.x * cr - dd.y * sr, dd.x * sr + dd.y * cr);
    vec2 q = dd / uDecA[di].zw * 0.5 + 0.5;
    vec2 ib = step(vec2(0.0), q) * step(q, vec2(1.0));
    // ONE SIDE, AND ONE BOOM (2026-09-11, the user, of the certification
    // stickers: "Only on 1 side, and only on 1 boom for the twin boom
    // configs"). A box projection paints THROUGH the aeroplane, so a marking
    // aimed at the fin lands on both of its faces — and on a twin boom, on
    // both fins' four faces. Two tests, and it takes BOTH:
    //   the POSITION picks the fin      (x < 0 is the other boom)
    //   the NORMAL picks the face       (x < 0 is the far side of this one)
    // On a centreline fin the first is nearly free (its faces straddle x = 0
    // by the skin's own half thickness) and the second does the work; on a
    // twin boom the first is what keeps the port boom bare. The -0.02 slack
    // is the centreline fin's own half thickness, so a fin ON the centreline
    // is not cut in half by a rounding error.
    float aOne = uDecE[di].z;
    float aSide = step(-0.02, aeroA.x) * step(0.0, vCraftNrm.x);
    float w = ib.x * ib.y * uDecC[di].z * onMe * uDecOk
            * mix(1.0, aSide, step(0.5, aOne));
    // INSET against mip bleed: at low mip a page averages into its
    // neighbours, and a gutter costs a page of atlas where an inset costs
    // nothing. Sampling always happens — w is what decides, not a branch.
    vec2 auv = uDecB[di].xy + uDecB[di].zw
             * (clamp(q, 0.0, 1.0) * (1.0 - 2.0 * uInset) + uInset);
    vec4 tx = texture2D(tAtlas, auv);
    // THE ATLAS IS AUTHORED sRGB AND MUST BE CONVERTED BY HAND. Setting
    // texture.encoding is INERT on a uniform three did not generate a decode
    // function for - it is only read for map/envMap/emissiveMap and friends -
    // so on the atlas it is documentation, and this line is the conversion.
    // (No backticks in here: this whole block is a template literal, and a
    // stray one ends it mid-shader. It has cost two debugging rounds.)
    vec3 dc = sRGBToLinear(tx).rgb;
    // THE REGISTRATION IS A DISTANCE FIELD (G212, the user: "either we need
    // higher resolution, or vectorial"). Its page's alpha is a signed
    // distance to the glyph edge, 0.5 AT the edge, so the edge is wherever
    // the threshold falls — at any zoom, one screen pixel wide (fwidth), and
    // the texels behind it can be as coarse as they like. MIXED, not
    // branched: the loop is uniform and fwidth wants every lane.
    float aSdf = uDecE[di].x;
    float aSw = max(fwidth(tx.a) * 0.75, 0.003);
    float aCov = mix(tx.a, smoothstep(0.5 - aSw, 0.5 + aSw, tx.a), aSdf);
    float a = aCov * w;
    diffuseColor.rgb = mix(diffuseColor.rgb, dc, a);
    aeroDecR += a * uDecC[di].y;
    aeroDecM = max(aeroDecM, a * uDecE[di].y);
  }
  // and the leading edge is WASHED OUT, not merely polished — the other half
  // of the same feature, and the half garage.js did in its paint sheet
  // (mix toward 0xdfe3e8 at the very edge). Roughness alone reads as a
  // reflection change; the pale band is what makes it look like bare metal
  // ahead of painted fabric.
  // ...AND ONLY ON AN AEROPLANE THAT HAS FLOWN (G187, the user: "the leading
  // edge fading should only be there for weathered aircraft, not for factory
  // fresh"). The wash is paint worn off by rain and bugs, so it rides the
  // condition dial: nothing at factory fresh, full by 'flown' (0.35). The
  // roughness polish above stays — a smooth D-skin is how it is built.
  #if AEROSKIN_SURF == 1
    if (uG4.z > 0.0 && uG5.w > 0.5)
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.90),
        (1.0 - smoothstep(0.0, uG4.z, max(vSurf.y * uFieldM, 0.0))) * 0.30
        * clamp(uWear.x * uWearK / 0.35, 0.0, 1.0));
  #endif

  // ---- THE WEAR (G70), and it goes on LAST, over the paint and over the
  // markings alike — because dirt does. A registration that stayed clean on
  // a filthy aeroplane would read as a sticker applied this morning, which
  // is occasionally true and never what a 400-hour aeroplane looks like.
  //
  // The branch is on UNIFORMS ONLY (the dial and this material's own rate),
  // so it is uniform across the draw call and the fetch inside it is legal.
  // It also means a factory-fresh aeroplane pays nothing at all.
  //
  // aeroWA, NOT aeroW: the triplanar branch of the surface pass declares its
  // own vec3 aeroW for the whiteout weights, and these two blocks are inlined
  // into the SAME function scope — so the first name collided, and the
  // failure was a redefinition plus nine bogus "field selection requires a
  // vector" errors pointing at code that had not changed. A shared scope is
  // the price of injecting into three's main(), and every local in here has
  // to be read as if it were global.
  float aeroWA = uWear.x * uWearK;
  if (aeroWA > 0.0) {
    // GRIME IS A THIN FILM EVERYWHERE AND A THICK ONE IN THE VALLEYS. aeroD
    // is the detail sheet's own height-riding channel, so the second half is
    // dirt at the material's own scale for free — a weave holds it, a
    // polished spinner has nowhere to hold it.
    //
    // THE VALLEY TERM IS SCALED OFF THE SHEET'S OWN CONSTRUCTION, and getting
    // that wrong is why the first cut did nothing. aeroDetailTex writes
    // 0.80 + 0.20*h*bs, so 0.80 is the MEAN and the excursion is a couple of
    // hundredths, not a couple of tenths: a mask of (0.86 - aeroD) * 3 could
    // never exceed 0.25, and on a black tyre 25 % of an effect is invisible.
    // Measured, not guessed — the tyre moved 14 -> 16 out of 255.
    float aeroVal = clamp((0.80 - aeroD) * 25.0, 0.0, 1.0);
    aeroWG = clamp((0.35 + 0.65 * aeroVal) * uWear.y * aeroWA, 0.0, 1.0);
    // CHALKING IS SUN DAMAGE, so it is on what faces the sun. vObjNrm is the
    // object normal and every one of these frames is y-up (the cage, the
    // wing, the tail and the model frame alike), so this needs no uniform.
    float up = clamp(normalize(vObjNrm).y, 0.0, 1.0);
    // clamped for the same reason as the grime: a material with a high rate
    // (an exhaust at 2.2) would otherwise drive every downstream mix past 1
    aeroWF = clamp(up * up * uWear.z * aeroWA, 0.0, 1.0);
    #if AEROSKIN_SURF == 1
      // THE BREAK-UP, sampled with the tile stretched hard along the body:
      // a real streak is a bundle of fine trails, and a smooth gaussian
      // plume is an airbrush. Stretched, not noised — same sheet, no
      // second texture, and it stays the right size in metres.
      float aeroBr = texture2D(tDetail,
        vec2(aeroM.y * 2.5, aeroM.x * 0.12) / uTileM).b;
      float aeroBk = (0.45 + 0.90 * aeroBr) * uWear.w * aeroWA;
      aeroWS = clamp(aeroStreak(aeroM, uWearE) * aeroBk, 0.0, 1.0);
      aeroWM = clamp(aeroStreak(aeroM, uWearS) * aeroBk, 0.0, 1.0);
    #endif
    // DUST IS A COLOUR, NOT A MULTIPLIER, and this was measured rather than
    // reasoned: darkening by a factor made the paint dirty and left the TYRES
    // untouched, because 30 % off something already black is nothing. Dirt is
    // a pale powder — it darkens a light surface and LIGHTENS a dark one, and
    // a grey tyre is one of the most recognisable signs of an aeroplane that
    // lives outside. Mixing toward a fixed dust colour does both with one
    // term. (Linear, like everything else at this point in the shader.)
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.100, 0.088, 0.072),
                           0.35 * aeroWG);
    // soot is nearly black; what a wheel throws up the belly is mud
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.040, 0.036),
                           0.72 * aeroWS);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.130, 0.104, 0.076),
                           0.60 * aeroWM);
    // OXIDISED PAINT GOES MILKY, NOT GREY: toward a desaturated version of
    // the colour it already is, and LIGHTER. Mixing toward grey instead is
    // what makes a weathering pass look like a dust filter over the lens.
    float aeroLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = mix(diffuseColor.rgb,
      mix(diffuseColor.rgb, vec3(aeroLum), 0.55) * 1.18, 0.50 * aeroWF);
  }
`;

// THE SURFACE. Replaces normal_fragment_maps, which is where `normal` and
// `faceDirection` already exist and where a tangent frame belongs. It also
// writes roughnessFactor and metalnessFactor: the stock roughnessmap_fragment
// and metalnessmap_fragment run EARLIER (before faceDirection exists) and are
// left in place to declare them from the scalars, so this only has to modulate.
//
// The triplanar blend is WHITEOUT, not UDN. UDN is the right operator for
// stacking wrinkles that share a frame; across three planes the samples live
// in three DIFFERENT frames, and whiteout is the blend that reorients each
// into object space before mixing.
const AERO_SURFACE_FS = `
#if AEROSKIN_SURF == 1
  vec2 aeroST = aeroDetST();
  vec4 aeroT = texture2D(tDetail, aeroST);
  vec3 aeroN = aeroUnpack(aeroT, uDetail.x);
  // THE STRUCTURE ON TOP OF THE MICROSURFACE, and UDN is the right operator
  // for it: both live in the SAME tangent frame — one is the weave of the
  // cloth, the other is the rib the cloth is stretched over — so their
  // gradients add, and one frame application converts the total.
  float aeroRA = 0.0;
  vec3 aeroSN = aeroStructure(aeroM, aeroRA);
  aeroN = aeroUDN(aeroN, aeroSN);
  vec3 aeroTan, aeroBit;
  aeroFrame(-vViewPosition, normal, aeroST, faceDirection, aeroTan, aeroBit);
  normal = normalize(aeroTan * aeroN.x + aeroBit * aeroN.y + normal * aeroN.z);
  roughnessFactor *= mix(1.0, aeroT.b / 0.85, uDetail.y);
  // a decal is a paint film: it is smoother than what it sits on, which is
  // most of why a vinyl registration reads as applied rather than printed
  roughnessFactor = clamp(roughnessFactor + aeroRA + aeroDecR, 0.02, 1.0);
  metalnessFactor *= aeroT.a;
  // THE FLAKE (G215): the detail sheet read at a twelfth of its tile is a
  // fine, stable, non-repeating-enough breakup; it opens the roughness where
  // a flake faces the light and closes it beside. A METALLIC MARKING raises
  // the metalness where it covers the pixel — the ink becomes flake too.
  {
    float aeroFl = texture2D(tDetail, aeroST * 12.0).b;
    float aeroFlake = max(uFlake, aeroDecM);
    roughnessFactor = mix(roughnessFactor,
      clamp(roughnessFactor * (0.55 + 1.6 * (aeroFl - 0.80) * 5.0 + 0.45), 0.02, 1.0),
      aeroFlake * 0.6);
    metalnessFactor = mix(metalnessFactor, 0.85, aeroDecM);
  }
#else
  vec3 aeroGN = normalize(vObjNrm) * faceDirection;
  vec3 aeroW = pow(abs(aeroGN), vec3(4.0));
  aeroW /= (aeroW.x + aeroW.y + aeroW.z);
  vec3 aeroP = vObjPos * uFieldM;
  vec2 aeroMX = vec2(aeroP.z * sign(aeroGN.x), aeroP.y) / uTileM;
  vec2 aeroMY = vec2(aeroP.x * sign(aeroGN.y), aeroP.z) / uTileM;
  vec2 aeroMZ = vec2(-aeroP.x * sign(aeroGN.z), aeroP.y) / uTileM;
  aeroMX = mix(aeroMX, aeroMX.yx, uDetRot);
  aeroMY = mix(aeroMY, aeroMY.yx, uDetRot);
  aeroMZ = mix(aeroMZ, aeroMZ.yx, uDetRot);
  vec4 aeroTX = texture2D(tDetail, aeroMX);
  vec4 aeroTY = texture2D(tDetail, aeroMY);
  vec4 aeroTZ = texture2D(tDetail, aeroMZ);
  vec3 aeroNX = aeroUnpack(aeroTX, uDetail.x);
  vec3 aeroNY = aeroUnpack(aeroTY, uDetail.x);
  vec3 aeroNZ = aeroUnpack(aeroTZ, uDetail.x);
  aeroNX = vec3(aeroNX.xy + aeroGN.zy, abs(aeroNX.z) * aeroGN.x);
  aeroNY = vec3(aeroNY.xy + aeroGN.xz, abs(aeroNY.z) * aeroGN.y);
  aeroNZ = vec3(aeroNZ.xy + aeroGN.xy, abs(aeroNZ.z) * aeroGN.z);
  vec3 aeroON = normalize(aeroNX.zyx * aeroW.x + aeroNY.xzy * aeroW.y
                        + aeroNZ.xyz * aeroW.z);
  normal = normalize(normalMatrix * aeroON);
  float aeroR = aeroTX.b * aeroW.x + aeroTY.b * aeroW.y + aeroTZ.b * aeroW.z;
  float aeroMet = aeroTX.a * aeroW.x + aeroTY.a * aeroW.y + aeroTZ.a * aeroW.z;
  roughnessFactor *= mix(1.0, aeroR / 0.85, uDetail.y);
  metalnessFactor *= aeroMet;
  // G215: the flake on a triplanar surface (the cowl, the spats)
  {
    float aeroFl = aeroTX.b * aeroW.x + aeroTY.b * aeroW.y + aeroTZ.b * aeroW.z;
    float aeroFlake = max(uFlake, aeroDecM);
    roughnessFactor = mix(roughnessFactor,
      clamp(roughnessFactor * (0.55 + 1.6 * (aeroFl - 0.80) * 5.0 + 0.45), 0.02, 1.0),
      aeroFlake * 0.6);
    metalnessFactor = mix(metalnessFactor, 0.85, aeroDecM);
  }
  // THE FIELD ON A SURFACE WITH NO FIELD (G206): the cowl, the spats, the
  // struts, the gear legs. A craft-space plane stands in for the metric
  // field — the flank plane where the normal is sideways, the plan plane
  // where it faces up — MIXED, never branched, so every fragment in a quad
  // takes one path and the derivatives aeroFrame needs stay defined. The
  // frames are y-up (the wear pass relies on the same fact).
  {
    float aeroUp = clamp(abs(normalize(vObjNrm).y), 0.0, 1.0);
    vec2 aeroFC = mix(vCraftPos.yz, vCraftPos.xy, aeroUp * aeroUp);
    vec2 aeroDF = vec2(0.0);
    float aeroFR = 0.0;
    aeroField(aeroFC, aeroDF, aeroFR);
    vec3 aeroFT, aeroFB;
    aeroFrame(-vViewPosition, normal, aeroFC, faceDirection, aeroFT, aeroFB);
    vec3 aeroFN = normalize(vec3(-aeroDF.x * uGain.z, aeroDF.y * uGain.z, 1.0));
    normal = normalize(aeroFT * aeroFN.x + aeroFB * aeroFN.y + normal * aeroFN.z);
    roughnessFactor += aeroFR;
  }
#endif

// THE OTHER HALF OF THE WEAR (G70), common to both branches because none of
// it needs a coordinate: the masks were computed in the albedo pass and this
// is what they do to the surface.
//
// METAL DULLS, and that is the term that does the most work. Oxide, dust and
// oil are DIELECTRICS, so a weathered bare-alloy cowl stops behaving like a
// mirror and starts taking its colour from its own albedo instead of from
// the sky. Without this, wear on a metal aeroplane is nearly invisible: the
// environment map washes every albedo change straight out.
roughnessFactor = clamp(roughnessFactor + 0.22 * aeroWG + 0.18 * aeroWF
                        + 0.30 * (aeroWS + aeroWM), 0.02, 1.0);
metalnessFactor *= 1.0 - 0.55 * max(aeroWG, max(aeroWS, aeroWM));
`;

// normalMatrix is declared in the FRAGMENT prefix only under
// OBJECTSPACE_NORMALMAP, so the triplanar branch declares it here. That is
// safe ONLY while no normalMap is bound — and if anyone ever binds one for a
// quick test it is a compile error, not a wrong picture, which is the good
// failure.
const AERO_NMAT_FS = 'uniform mat3 normalMatrix;\n';

// ONE FUNCTION OBJECT, module scope. Its .toString() IS the program cache key
// (see the header), so every AEROSKIN material shares it by REFERENCE and the
// build compiles one program per AEROSKIN_SURF value — two, not thirty.
const AEROSKIN_HOOK = function (shader) {
  const u = this.userData.aeroU;
  for (const k in u) shader.uniforms[k] = u[k];
  // the aeroplane-wide ones, BY REFERENCE: one write reaches every section
  const d = this.userData.aeroD;
  if (d) for (const k in d) shader.uniforms[k] = d[k];
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', AERO_PARS_VS + '\n#include <common>')
    .replace('#include <begin_vertex>',
             '#include <begin_vertex>\n' + AERO_MAIN_VS);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>',
             AERO_NMAT_FS + AERO_PARS_FS + '\n#include <common>')
    .replace('#include <map_fragment>', AERO_ALBEDO_FS)
    .replace('#include <normal_fragment_maps>', AERO_SURFACE_FS)
    // THE CLEAR LAYER FOLLOWS THE RELIEF (G206). r128's own chunk puts the
    // clearcoat on geometryNormal — the smooth mesh — so varnish over a rib
    // tape would reflect the sky as if the tape were not there. A clear coat
    // is brushed ONTO the tapes and the set panels; it takes the perturbed
    // normal. Inert on a Standard material: the include is not in its shader.
    .replace('#include <clearcoat_normal_fragment_begin>',
             '#ifdef CLEARCOAT\n  vec3 clearcoatNormal = normal;\n#endif')
    .replace('#include <lights_fragment_end>', AERO_CABIN_FS);
};

// THE CABIN'S DARKNESS, IN THE SHADER (G206.1). After every light has been
// summed and before the output: an inside fragment keeps (1 - uCabin.x) of
// all of it. Emissive is spared — a lit instrument face is the one thing
// that should glow in a dark cabin. faceDirection is r128's own (+1 front,
// -1 back), declared in normal_fragment_begin, long before this point.
const AERO_CABIN_FS = `
#include <lights_fragment_end>
{
  float aeroInK = max(uInside.x, uInside.y * step(faceDirection, 0.0));
  float aeroCab = 1.0 - uCabin.x * aeroInK;
  reflectedLight.directDiffuse *= aeroCab;
  reflectedLight.indirectDiffuse *= aeroCab;
  reflectedLight.directSpecular *= aeroCab;
  reflectedLight.indirectSpecular *= aeroCab;
}`;

// THE SAME DARKNESS ON A MATERIAL THAT IS NOT AEROSKIN'S (G206.1): the
// crew's own skinned materials (_cage_char.js) and the flown payload's
// textured buckets. ONE module-level function object, like the other hooks
// and for the same r128 reason (the cache key is its source). It reads the
// same shared block, attached the same way.
const AERO_CABIN_HOOK = function (shader) {
  const u = this.userData.aeroU;
  for (const k in u) shader.uniforms[k] = u[k];
  const d = this.userData.aeroD;
  if (d) for (const k in d) shader.uniforms[k] = d[k];
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>',
             'uniform vec4 uCabin;\nuniform vec2 uInside;\n#include <common>')
    .replace('#include <lights_fragment_end>', AERO_CABIN_FS);
};
function aeroCabinHook(THREE, m, inside) {
  if (!m || !m.isMeshStandardMaterial) return m;
  m.userData.aeroU = Object.assign(m.userData.aeroU || {},
    { uInside: { value: new THREE.Vector2(inside != null ? +inside : 1, 0) } });
  m.userData.aeroD = aeroSharedU(THREE);
  m.userData.aeroInside = inside != null ? +inside : 1;
  m.onBeforeCompile = AERO_CABIN_HOOK;
  m.needsUpdate = true;
  return m;
}
// the aeroplane's coverage scales the darkness: an open cockpit still has a
// combing and a floor, so it keeps some, and the lab's `cabin` sets the rest
const AERO_CABIN_DEF = 0.81;      // G217: the user's own
const AERO_CABIN = { coverage: 1 };
function aeroSetCabin(THREE, o) {
  if (o && o.coverage != null) AERO_CABIN.coverage = Math.max(0, Math.min(1, +o.coverage));
  const amt = AERO_LAB.gain.cabin != null ? AERO_LAB.gain.cabin : AERO_CABIN_DEF;
  aeroSharedU(THREE).uCabin.value.x = amt * AERO_CABIN.coverage;
}

// ---------------------------------------------------------------------------
// GLASS — its own family, its own hook, its own program
// ---------------------------------------------------------------------------
// r128's transmission is ONE line at the tail of meshphysical_frag:
//   diffuseColor.a *= mix(saturate(1. - totalTransmission
//     + linearToRelativeLuminance(directSpecular + indirectSpecular)),
//     1.0, metalness)
// i.e. alpha modulation that SPARES THE SPECULAR. That is the whole recipe:
// the specular IS the glass, so feed it. clearcoat adds a second sharp lobe
// which lands in indirectSpecular, which transmission then reads back to
// RAISE alpha — so the canopy goes near-invisible facing nothing and snaps to
// a hard glint on the roof lights. It is also the closest r128 gets to a
// two-layer model. There is no `thickness` before r132; opacity carries the
// slab, exactly as hangar.js:730 already documents for the shed's windows.
//
// The ripple goes on the CLEARCOAT normal only, leaving the base normal
// smooth: physically a wavy outer surface over a clean bulk, and it keeps the
// transmitted image from wobbling. r128's clearcoat_normal_fragment_begin is
// three lines, so replacing it is clean and needs no clearcoatNormalMap
// (which would demand vUv).
//
// NOT `sheen`: r128 only has the old crude `sheen: Color` API, useless for
// glass and a flat rim wash on fabric, and it is another program permutation.
// THE GLAZING'S OWN DIALS (G113.2, the user: "the glass material needs a lot
// more options, and the ability for a scratch roughness map... transparency,
// possibly edge detection for some corner dirt, reflection, possibly tinting
// or rainbow reflections. Be clever, see what we need and what the three.js
// materials allow.")
//
// WHAT r128 ALLOWS, and it is the reason this is a hook and not a material
// swap. MeshPhysicalMaterial here has `transmission`, `clearcoat`,
// `clearcoatRoughness` and `reflectivity` and NOTHING ELSE of the modern
// glass set: `ior` arrived in r137, `iridescence` far later, `thickness` and
// `attenuationColor` are not wired on this path. So tint, transparency and
// reflection are material fields; the scratches, the grime and the rainbow
// are drawn HERE, in the shader, out of the same analytic-mask discipline
// G68's structure grammar uses — no new bytes, and they scale with the pane
// instead of being a photograph stretched over it.
//
// THE SCRATCH SHEET IS PROCEDURAL ON PURPOSE. The user offered "which you can
// probably find online somewhere", and a downloaded map would be the only
// bitmap in a material system whose every other detail sheet is baked at
// runtime — it would also need re-encoding, a payload budget and a licence.
// A wiper arc and a field of fine scratches are cheap to describe and are
// PLACED rather than tiled: the arc sweeps from a real pivot, which is what
// makes it read as a wiper rather than as texture.
//
// THE BLEND, BY HAND (G206, the user: "I don't believe in our glass"). What
// was wrong was not a number but the blend model. Under three's ordinary
// alpha blend the whole outgoing light is scaled by alpha, so at clarity
// 0.38 SIXTY PERCENT OF EVERY REFLECTION WAS THROWN AWAY — and the reflection
// is the thing that IS glass. The pale `color` was a real Lambert diffuse at
// half alpha, lit by the room and laid over the crew: a milky plastic film,
// which is exactly what "cut paper" looks like. And alpha was constant over
// the pane, where real glass is 4 % reflective head-on and a mirror at the
// limb (Fresnel), so a flat pane at one alpha had no curvature to show.
//
// TWO DRAWS OF THE SAME PANE, each order-independent:
//   1. aeroGlassTint — a MULTIPLY pass (blend ZERO, SRC_COLOR): what is
//      behind the pane is darkened by the pane's transmission, tinted by
//      its colour, and CLOSED at the limb by Fresnel. Multiplies commute, so
//      two panes in line need no sorting.
//   2. aeroGlass — an ADD pass (blend ONE, ONE): the specular at FULL
//      strength whatever the clarity, plus a damped body colour scaled by
//      how opaque the pane is. Adds commute too; and three draws every
//      renderOrder -1 item before every renderOrder 0 item, so all the
//      multiplies land before all the adds: dst * PI(T) + SUM(spec), exact.
// r128's own `transmission` line was one alpha-restoration term trying to
// do pass 2 alone, and it was measured dead in the game (below). This is the
// same idea done where it can be seen.
const GLASS_DEF = {
  tint: 0xaec9d8,   // the pale blue-green of thick acrylic seen edge-on
  // G206: 0.5 -> 0.2. Under the old model half the light was the only way
  // to see the pane at all; a tinted acrylic canopy actually stops 10-30 %
  opacity: 0.2,
  // THE SCRATCHES AND THE WIPER ARC ARE GONE (G217, the user: "the window
  // scratches is pretty bad. Let's get rid of that, including in the
  // weathering slider, but let's add some roughness map like they have been
  // touched, and maybe rougher around the edges"). They were two families of
  // periodic stripes tilting the clear coat — corduroy, at any strength that
  // showed. WHAT REPLACES THEM IS ROUGHNESS AND NOTHING ELSE: hands, cuffs
  // and a cloth leave a broad soft smear with no relief at all, which is the
  // whole difference between a wiped pane and a scratched one — and a pane is
  // cleaned least where the frame holds it, so the edge goes rougher too.
  touch: 0.35,      // 0 straight off the mould .. 1 a thousand hands
  grime: 0.0,       // dirt gathering toward the frame
  refl: 1.0,        // x envMapIntensity, on top of the mood's own scale
  rainbow: 0.0,     // thin-film interference, an EFFECT and not physics
  // ---- THE BASE NUMBERS (G206), the lab's rather than the builder's ----
  // G217: the user's own, off the lab
  rough: 0.12,      // the bulk
  ccR: 0.13,        // the clear layer that carries the moulding ripple
  fresnel: 1.18,    // how far the limb closes to a mirror (0 = old flat pane)
  diffuse: 0.20,    // what an OPAQUE pane shows of a lit body colour
};

const AEROGLASS_HOOK = function (shader) {
  const u = this.userData.aeroU;
  for (const k in u) shader.uniforms[k] = u[k];
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', AERO_PARS_VS + '\n#include <common>')
    .replace('#include <begin_vertex>',
             '#include <begin_vertex>\n' + AERO_MAIN_VS);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', AERO_PARS_FS + '\n#include <common>')
    .replace('#include <roughnessmap_fragment>', `
  float roughnessFactor = roughness;
  {
    vec2 g = (vSurf.xy * uFieldM) / uTileM;
    // orange peel off the sheet, plus a slow moulding ripple along the body
    float op = texture2D(tDetail, g).b - 0.85;
    roughnessFactor += op * 0.10 + 0.010 * sin(g.x * 5.0);
    // ---- WHAT A USED PANE LOOKS LIKE ---------------------------------
    // Metres on the pane, not tile units: a scratch is a real length and
    // must not resize when the tile does.
    vec2 mm = vSurf.xy * uFieldM;
    // A PANE THAT HAS BEEN TOUCHED (G217). Two reads of the same sheet at
    // two large scales — a quarter of a metre and most of one — added as a
    // ROUGHNESS and nothing else: no normal, no relief, no periodic family.
    // That is what a smeared pane is, and it is why this replaces the
    // scratches rather than joining them.
    if (uGlass.x > 0.0) {
      float sm  = texture2D(tDetail, mm * 4.0).b - 0.80;
      float sm2 = texture2D(tDetail, mm * 1.3 + vec2(0.37, 0.11)).b - 0.80;
      roughnessFactor += (sm * 2.2 + sm2 * 3.2) * uGlass.x;
    }
    // ...AND ROUGHER AROUND THE EDGES, where a pane is held, sealed and
    // cleaned least. uGlassE is its own extent in field metres (min sL,
    // min sC, max sL, max sC), measured off the drawn mesh — so "toward the
    // edge" is a real distance on a real pane and not a screen-space edge
    // detect, which would move when the camera did. The GRIME rides the same
    // distance, closer in, and is the only one of the two that is a colour.
    if (uGlassE.z > uGlassE.x) {
      vec2 lo = mm - uGlassE.xy, hi = uGlassE.zw - mm;
      float e = min(min(lo.x, lo.y), min(hi.x, hi.y));
      roughnessFactor += (1.0 - smoothstep(0.0, 0.11, max(e, 0.0)))
                       * (0.06 + 0.26 * uGlass.x);
      if (uGlass.z > 0.0) {
        aeroGDirt = (1.0 - smoothstep(0.0, 0.075, max(e, 0.0))) * uGlass.z;
        roughnessFactor += aeroGDirt * 0.35;
      }
    }
    roughnessFactor = clamp(roughnessFactor, 0.0, 1.0);
  }`)
    .replace('#include <clearcoat_normal_fragment_begin>', `
  vec3 clearcoatNormal = normal;
  {
    vec2 g = (vSurf.xy * uFieldM) / uTileM;
    vec3 T, B;
    aeroFrame(-vViewPosition, normal, g, faceDirection, T, B);
    vec3 cn = aeroUnpack(texture2D(tDetail, g), uDetail.x);
    clearcoatNormal = normalize(T * cn.x + B * cn.y + normal * cn.z);
    // NOTHING ELSE TILTS THE CLEAR COAT (G217). The scratches did, and that
    // was right for a scratch — a hairline shows by what it does to a
    // reflection — but a smear is not geometry, and the moulding ripple
    // above is the only relief a pane has.
  }
  // DIRT AT THE FRAME IS A PALE FILM, not only a rough patch: grime scatters,
  // so it lightens what you see through it. Same reason the wear system
  // lightens rather than darkens on the airframe.
  if (aeroGDirt > 0.0)
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.60, 0.56),
                           aeroGDirt * 0.55);
  // RAINBOW REFLECTIONS, and they are an EFFECT rather than physics — said
  // plainly, because r128's MeshPhysicalMaterial has no iridescence (it
  // arrived many releases later) and pretending otherwise is the kind of
  // quiet lie this project keeps a ledger against. What this IS: a thin-film
  // hue driven by the grazing angle, which is what makes a laminated screen
  // or an anti-glare coating flare colour at the limb. It rides the ALBEDO,
  // where a transmissive material shows it, and leaves the specular alone.
  //
  // IT LIVES HERE AND NOT AT map_fragment, which is where it was written
  // first and where normal DOES NOT EXIST YET — the chunk that declares it
  // runs later, and the fragment shader would not compile. diffuseColor is
  // declared earlier and is still in scope, so this is the first point where
  // both are in hand.
  // ...AND ON THE SPECULAR (G206): with the diffuse damped to what an opaque
  // pane shows, a hue on the albedo would vanish; a coating flares in the
  // REFLECTION, which is where it always was on the real thing.
  if (uGlass.w > 0.0) {
    float ct = clamp(1.0 - abs(dot(normalize(normal),
                     normalize(vViewPosition))), 0.0, 1.0);
    float f = pow(ct, 2.2);
    vec3 hue = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + ct * 2.4));
    aeroGRain = mix(vec3(1.0), hue * 1.7, f * uGlass.w * 0.55);
  }`)
    // THE OUTPUT, BY HAND (G206) — see the family header. The specular adds
    // at full strength; the body colour is scaled by how much of the pane is
    // NOT transmission, Fresnel-closed at the limb exactly as the multiply
    // pass closes it, so the two passes describe one pane. Alpha 1: the
    // blend is ONE, ONE and reads no alpha; the premultiply chunk is inert.
    .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
  float aeroNV = clamp(dot(normalize(normal), normalize(vViewPosition)),
                       0.0, 1.0);
  float aeroFr = pow(1.0 - aeroNV, 5.0) * uGlassB.x;
  float aeroT = (1.0 - diffuseColor.a) * (1.0 - aeroFr);
  vec3 aeroSpec = (reflectedLight.directSpecular
                 + reflectedLight.indirectSpecular) * aeroGRain;
  vec3 aeroDiff = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse
                + totalEmissiveRadiance;
  gl_FragColor = vec4(aeroDiff * (1.0 - aeroT) * uGlassB.y + aeroSpec, 1.0);`);
};

// THE MULTIPLY PASS (G206): pass 1 of the glass, see the family header. A
// ShaderMaterial on purpose — it needs no environment, no lights and no
// chunk of three's, only the view normal for the Fresnel. Pooled like the
// rest. What passes through: (1 - opacity), tinted toward the pane's colour
// as the pane thickens, and closed toward zero at the limb by the same
// Schlick term the add pass uses.
const AERO_GTINT_VS = `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const AERO_GTINT_FS = `
uniform vec3 uTint; uniform float uA; uniform float uFres;
varying vec3 vN; varying vec3 vV;
void main() {
  float nv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float fr = pow(1.0 - nv, 5.0) * uFres;
  vec3 pass = mix(vec3(1.0), uTint, clamp(uA * 2.0, 0.0, 1.0));
  gl_FragColor = vec4(pass * (1.0 - uA) * (1.0 - fr), 1.0);
}`;
function aeroGlassTint(THREE, o) {
  const G = k => (o[k] != null ? +o[k] : GLASS_DEF[k]);
  const key = 'gtint|' + (o.tint != null ? o.tint : '') + 'L' +
              (o.tintLin != null ? o.tintLin : '') + '|' + G('opacity') +
              '|' + G('fresnel');
  const hit = AERO_POOL.get(key);
  if (hit) return hit;
  const col = o.tintLin != null ? new THREE.Color(o.tintLin)
            : aeroLinear(THREE, o.tint != null ? o.tint : GLASS_DEF.tint);
  const m = new THREE.ShaderMaterial({
    uniforms: { uTint: { value: col }, uA: { value: G('opacity') },
                uFres: { value: G('fresnel') } },
    vertexShader: AERO_GTINT_VS,
    fragmentShader: AERO_GTINT_FS,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
  });
  m.userData.aeroskin = 1;
  m.userData.aeroFinish = 'glassTint';
  m.userData.env0 = 0;
  AERO_POOL.set(key, m);
  AERO_BUILT.push(m);
  return m;
}
// the invisible stand-in for every non-glass group of a companion mesh —
// r128 skips a group whose material is not visible, so one shared object
// costs nothing per pane
let AERO_GNONE = null;
function aeroGlassNone(THREE) {
  if (!AERO_GNONE) {
    AERO_GNONE = new THREE.MeshBasicMaterial({ visible: false });
    AERO_GNONE.userData.aeroskin = 1;
  }
  return AERO_GNONE;
}
// THE COMPANION (G206): the multiply pass as a second mesh sharing the
// pane's geometry, drawn one renderOrder EARLIER so every multiply lands
// before every add. `mats` is the host's material list (an array, or one);
// only the glass entries get the tint, the rest are invisible. Tagged
// `aeroCompanion` so the join's snapshot walks past it — it is the same
// faces the host already carries, not new skin.
function aeroGlassCompanion(THREE, host, mats, tintOf) {
  const list = Array.isArray(mats) ? mats : [mats];
  let any = false;
  const cm = list.map(m => {
    if (m && m.userData && m.userData.aeroFinish === 'glass') {
      any = true;
      return tintOf(m);
    }
    return aeroGlassNone(THREE);
  });
  if (!any) return null;
  const c = new THREE.Mesh(host.geometry, Array.isArray(mats) ? cm : cm[0]);
  c.renderOrder = (host.renderOrder || 0) - 1;
  c.castShadow = false; c.receiveShadow = false;
  c.userData.aeroCompanion = 1;
  c.userData.edHi = 1;             // and every other bake that skips overlays
  c.matrixAutoUpdate = host.matrixAutoUpdate;
  host.add(c);
  return c;
}

// ---------------------------------------------------------------------------
// THE FACTORY
// ---------------------------------------------------------------------------
// Materials are POOLED, not rebuilt. A spec apply already spends ~340 ms in
// buildGen + genSkin + the texture bakes; recreating thirty MeshStandard
// materials each time would add initMaterial and a full clone of
// ShaderLib.standard.uniforms per section for values that could be written
// directly. Pooling also keeps userData.env0 stable across applies, which is
// what aeroSetEnv reads — the same posture props.js takes.
const AERO_POOL = new Map();
const AERO_BUILT = [];
let AERO_ENV_F = 1;        // the last mood factor aeroSetEnv applied (G125.1)

// THE GRAMMAR'S UNIFORMS, WRITTEN BY ONE FUNCTION (G206). The factory wrote
// uG0..uG5 and tFast inline; the material lab needs to write them AGAIN on a
// built material when a grammar row moves, so the mapping lives here and both
// call it. `o` is what the factory was given, or what the material remembers
// of it on userData (grm, struct, wing, ribM). Creates the uniform objects
// on a fresh U, overwrites the values on an existing one — the uniform
// OBJECTS are shared with the compiled program by reference, so writing
// `.value` reaches the GPU without a recompile.
function aeroGrammarU(THREE, U, o) {
  aeroLabGramApply();          // the lab's deviations, once the core is here
  const GR = (o.struct && o.grm && AERO_GRAMMAR()[o.grm]) || null;
  const f = GR && GR.fastener;
  const v4 = (k, x, y, z, w) => {
    if (!U[k]) U[k] = { value: new THREE.Vector4() };
    U[k].value.set(x, y, z, w);
  };
  const v1 = (k, x) => { if (!U[k]) U[k] = { value: 0 }; U[k].value = x; };
  // the stamp's cache key carries the head's own numbers, so a lab edit to
  // the fastener row bakes a new stamp rather than finding the old one
  if (!U.tFast) U.tFast = { value: null };
  U.tFast.value = aeroFastTex(THREE,
    (o.grm || 'x') + (f ? f.kind : '-') +
    (f ? '|' + [f.pitch, f.dia, f.rise].join(',') : ''), GR);
  v4('uG0', GR ? GR.framePitch : 0, GR ? GR.stringerPitch : 0,
             GR ? (GR.panelAlong || 0) : 0, GR ? (GR.panelAround || 0) : 0);
  v4('uG1', GR ? GR.tape.w : 0, GR ? GR.tape.rise : 0,
             GR ? GR.sag.frac : 0, GR ? GR.sag.exp : 1);
  // uG2.w is the FASTENER's own gain, and it is small on purpose: a driven
  // head is already a 1.4 mm dome on a 2.4 mm radius — a genuinely steep
  // slope — so unlike the tape it does not need the display exaggeration,
  // and at the tape's gain it read as a row of ball bearings.
  v4('uG2', GR ? (GR.dish || 0) : 0, f ? f.pitch : 0, f ? f.rowW : 0,
             f ? 0.35 : 0);
  v4('uG3', GR && GR.seam ? GR.seam.width : 0,
             GR && GR.seam ? GR.seam.step : 0,
             GR ? (GR.partingAtWaist || 0) : 0,
             GR && GR.rough ? GR.rough.seam : 0);
  v1('uGOn', GR ? 1 : 0);
  // THE MEMBER SCREWS (G214): `memF` = [pitch m, head diameter m, rise m] or
  // null. Their stamp is the rivet baker's with the screw's own numbers;
  // the row half-width is a little more than the head so the mask does not
  // clip it. Only exterior skin with a grammar carries them.
  const mf = (GR && o.memF && o.memF[0] > 0) ? o.memF : null;
  if (!U.tFastM) U.tFastM = { value: null };
  U.tFastM.value = aeroFastTex(THREE,
    mf ? 'mem|' + mf.map(x => +x).join(',') : 'mem|-',
    mf ? { fastener: { kind: 'screw', pitch: mf[0], rowW: mf[1] * 0.6,
                       dia: mf[1], rise: mf[2] } } : null);
  v4('uG6', mf ? mf[0] : 0, mf ? mf[1] * 0.6 : 0, 0.5, mf ? 1 : 0);
  // THE WING'S MEMBERS ARE ITS OWN. On the fuselage the real rings take a
  // light extra line over the metric frames; on the wing they ARE the
  // structure, so the metric pitches are switched off entirely and the ribs
  // and spars carry it — see aeroStructure.
  v4('uG4', GR ? (o.wing ? 0.0011 : 0.0004) : 0,
             o.wing ? 0.030 : 0.016,
             o.wing ? 0.12 : 0,              // LE band, METRES aft of the edge
             (GR && f) ? (o.wing ? 0.30 : 0.0) : 0);
  // the surface CLASS rides uG5.w (G108) — 0 body, 1 wing, 2 tail — and is
  // never flattened to a flag; the literal form below is what GATE SKINMAT
  // reads for that promise
  if (!U.uG5) Object.assign(U, {
    uG5: { value: new THREE.Vector4(0.15, 0.50, 0.86, +o.wing || 0) } });
  else U.uG5.value.set(0.15, 0.50, 0.86, +o.wing || 0);
  if (o.wing && GR) {
    // a wing has ribs and spars, not frames and stringers
    U.uG0.value.set(0, 0, 0, 0);
    // ---- AND A COARSE SURFACE CANNOT CARRY AN INDEX (G97) -----------------
    // The index members (uG4.x) put a rib at every INTEGER STATION and a spar
    // at every integer rail, reading `fract(vSurf.z)` and `fract(vSurf.w)`.
    // That is exact on the WING, whose field is built from the real rib list
    // and interpolates over many chordwise vertices. It is NOISE on the TAIL,
    // whose mesh is far coarser.
    //
    // MEASURED on the fin: `lv` sweeps -0.81..2.05 across the chord while 91
    // of its 224 triangles span more than half a rail — and one spans 2.08,
    // a single triangle crossing two whole spars. `fract` of a value that
    // coarse crosses an integer wherever the LINEAR INTERPOLATION happens to
    // put it, so the lines wander with the triangulation and branch at its
    // edges. That is the dendritic pattern reported on the fins and slabs,
    // and no width tuning fixes it: the coordinate is not faithful there.
    //
    // A CALLER THAT KNOWS ITS OWN PITCH IN METRES SAYS SO. `ribM` puts the
    // members back on the METRIC path (`aeroNear(m.x, pitch)`), which reads
    // sL directly and is exact whatever the mesh does. The chordwise term
    // stays OFF: what prints through a fabric tail is the RIB TAPES, and one
    // spar does not telegraph as an evenly spaced pitch.
    if (o.ribM > 0) {
      U.uG0.value.x = o.ribM;
      U.uG4.value.x = 0;
    }
  }
  return U;
}

// THE FINISH'S OWN NUMBERS ON A MATERIAL (G206), factory and lab alike: the
// row's tile / normal / albedo / field, each times the section's dial, and
// the scalars three reads off the material itself. `o` carries the dials
// (tileK, nrmK, roughK, ccK, fieldK); absent is 1.
function aeroFinishU(THREE, m, U, row, o) {
  const K = k => (o[k] != null ? o[k] : 1);
  if (!U.uTileM) U.uTileM = { value: new THREE.Vector2() };
  U.uTileM.value.set(row.tile * K('tileK'), row.tile * K('tileK'));
  if (!U.uDetail) U.uDetail = { value: new THREE.Vector2(0, 1) };
  U.uDetail.value.x = row.nrm * K('nrmK');
  if (!U.uAlb) U.uAlb = { value: 0 };
  U.uAlb.value = row.alb;
  if (!U.uField) U.uField = { value: new THREE.Vector4() };
  // A SHORT PART WANTS A SHORT FIELD (G217, the user: "there should be a
  // special field slider for the cowl"). The amplitude was dialled per
  // section since G206 and the WAVELENGTH was not, so a cowl — 700 mm of
  // tightly curved sheet — carried the fuselage's 0.8 m undulation and read
  // as flat. `fieldL x` multiplies the row's own wavelength; every section
  // has it, and the cowl is the one that needed it.
  U.uField.value.set((row.fld || 0) * K('fieldK'),
                     (row.fldL || 0.5) * K('fieldLK'),
                     row.fldR || 0, 0);
  if (m) {
    m.roughness = Math.max(0, Math.min(1, row.rough * K('roughK')));
    // G215: a metallic paint is flake under a clear coat — the metalness
    // rises toward the flake's with the dial, on any painted row
    const mk = Math.max(0, Math.min(1, +(o.metalK || 0)));
    m.metalness = row.metal + (0.85 - row.metal) * mk;
    if (U.uFlake) U.uFlake.value = mk;
    if (m.isMeshPhysicalMaterial) {
      m.clearcoat = Math.max(0, Math.min(1, (row.cc || 0) * K('ccK')));
      m.clearcoatRoughness = row.ccR != null ? row.ccR : 0.2;
    }
  }
  return U;
}

// TWO WAYS IN, AND THEY ARE NOT INTERCHANGEABLE. `tint` is an sRGB hex — a
// colour a human picked — and gets converted. `tintLin` is a hex ALREADY IN
// LINEAR SPACE, which is what comes back out of a snapshot (r128 stores
// material.color linearly and getHex hands it back the same way). Converting
// that a second time is the exact trap this file's header describes, and it
// would darken the flown aeroplane against the one in the editor by the
// square of the transfer — visible, and easy to misread as a lighting bug.
function aeroMaterial(THREE, o) {
  // fieldM IS PART OF THE KEY, and leaving it out was a real bug: the cage
  // and the tail build in cage units and hand over CAGE_UNIT x planeScale,
  // while the wing and the flown payload are already metric and hand over 1.
  // Pooled on a key that ignored it, whichever asked first won and the other
  // got its neighbour's scale — the tail came out with the wing's, silently.
  const key = [o.finish, o.tint, 'L' + o.tintLin, o.surf ? 1 : 0, o.side || 0,
               o.opacity != null ? o.opacity : 1,
               o.struct ? (o.grm || '') : '', 'w' + (+o.wing || 0),
               o.boxDet ? 'B' + (+o.boxPlane || 0) : '',
               'M' + (o.fieldM != null ? o.fieldM : 1),
               'W' + (o.wearK != null ? o.wearK : ''),
               // the per-part CONDITION multiplier (G114) — G70's "no
               // per-part condition" answered: the one dial still sets the
               // aeroplane, this says how much of it THIS part shows
               'wm' + (o.wearM != null ? o.wearM : 1),
               // THE PER-SECTION DIALS (the user: "I'd want to be able to
               // control scaling, roughness and normal/bump size for every
               // material"). They multiply the finish's own numbers rather
               // than replacing them, so a dial at 1 is the material as
               // designed and the finish table stays the authority on what
               // alclad or doped fabric IS. They are IN THE KEY for the
               // reason fieldM had to be: two sections sharing a finish and
               // differing only by a dial would otherwise share a material,
               // and whichever asked first would win.
               'T' + (o.tileK != null ? o.tileK : 1),
               'R' + (o.roughK != null ? o.roughK : 1),
               'N' + (o.nrmK != null ? o.nrmK : 1),
               'B' + (o.ribM != null ? o.ribM : ''),
               'D' + (o.detRot ? 1 : 0),
               // G206: the sheen and the field dials, for the same reason
               'C' + (o.ccK != null ? o.ccK : 1),
               'F' + (o.fieldK != null ? o.fieldK : 1),
               'L' + (o.fieldLK != null ? o.fieldLK : 1),
               'I' + (+o.inside || 0),
               'K' + (o.decals != null ? +o.decals : 1),
               'S' + (o.memF ? o.memF.join(',') : ''),
               'Q' + (o.metalK != null ? o.metalK : 0)].join('|');
  const hit = AERO_POOL.get(key);
  if (hit) return hit;
  const row = AERO_FINISH[o.finish] || AERO_FINISH.fabric;
  const op = o.opacity != null ? o.opacity : 1;
  const U = {
    tDetail:  { value: aeroDetailTex(THREE, o.finish) },
    uFieldM:  { value: o.fieldM != null ? o.fieldM : 1 },
    // uTileM, uDetail, uAlb, uField: aeroFinishU below, shared with the lab
    // per material, because how fast a thing ages is a property of what it
    // is made of — the dial itself is aeroplane-wide and shared by reference
    uWearK:   { value: (o.wearK != null ? o.wearK
                     : (AERO_WEAR_K[o.finish] != null
                        ? AERO_WEAR_K[o.finish] : 1))
                     // ...times the part's own condition (G114): a rate is
                     // what the material IS, the multiplier is how this
                     // part has been treated
                     * (o.wearM != null ? o.wearM : 1) },
  };
  // THE GRAMMAR (G68). Only EXTERIOR SKIN carries structure: the rim beads,
  // the interior liners and frames, the trim and the glass are surfaces that
  // nothing is riveted through, and giving them frames would be exactly the
  // decorative placement this is built to avoid. `grm` names the
  // construction; `struct` says this section is skin. Written by
  // aeroGrammarU (G206) so the lab can write it again on a live material.
  Object.assign(U, {
    uBoxDet:   { value: o.boxDet ? 1 : 0 },
    uBoxPlane: { value: +o.boxPlane || 0 },
    uDetRot:   { value: o.detRot ? 1 : 0 },
    // G206.1: inside on both faces, or — exterior skin — on the back face
    uInside:   { value: new THREE.Vector2(+o.inside || 0,
                                          (!o.inside && o.struct) ? 1 : 0) },
    // G207: absent means yes, which is what every caller before G207 meant
    uDecOk:    { value: o.decals != null ? +o.decals : 1 },
    // G215: the metal flake in the paint, 0 for every paint before it
    uFlake:    { value: Math.max(0, Math.min(1, +o.metalK || 0)) },
  });
  aeroGrammarU(THREE, U, o);
  aeroFinishU(THREE, null, U, row, o);
  // ALPHA-TESTED CUT-OUTS ARE DELIBERATELY ABSENT. r128's getDepthMaterial
  // copies neither `map` nor `alphaTest` onto the depth variants, so an
  // alpha-tested cut-out casts a SOLID shadow anyway — and a registration
  // decal is paint on an opaque panel that must cut nothing. Keeping
  // alphaTest at 0 also keeps ALPHATEST out of the program cache key and
  // early-Z alive, which is worth having under logarithmicDepthBuffer.
  // THE CLEAR LAYER (G206): a finish with a clearcoat builds Physical, one
  // without stays Standard. Physical IS isMeshStandardMaterial in r128, so
  // scene.environment, envMapIntensity and the depth path all hold; what it
  // adds is the second lobe, and the PHYSICAL define that switches it on —
  // r128's meshphysical_frag turns CLEARCOAT on under `#ifdef PHYSICAL`, and
  // the constructor's own defines are replaced below, so it is put back by
  // hand. One more program per SURF value (the material type is in three's
  // program key), which is four, not thirty.
  const ccK = o.ccK != null ? o.ccK : 1;
  const Phys = (row.cc || 0) * ccK > 0;
  const m = new (Phys ? THREE.MeshPhysicalMaterial
                      : THREE.MeshStandardMaterial)({
    // the section's pick, or the finish's own colour. sRGB in, linear out
    // (see THE COLOUR TRAP) — and this is also what the join snapshots.
    color: o.tintLin != null ? new THREE.Color(o.tintLin)
         : aeroLinear(THREE, o.tint != null ? o.tint : row.base),
    roughness: Math.max(0, Math.min(1,
      row.rough * (o.roughK != null ? o.roughK : 1))),
    // G249: THE FLAKE'S METALNESS WAS NEVER BUILT IN (the user: "the
    // metallic option does not seem to work on the paint material, only on
    // the decals"). aeroFinishU raises the metalness with the dial, but the
    // call above hands it no material, and this constructor pinned the row's
    // own number — so a painted section got the flake's roughness breakup
    // and none of the metal. A decal worked because the shader lifts
    // metalnessFactor from aeroDecM directly. Same formula as aeroFinishU.
    metalness: row.metal + (0.85 - row.metal) *
      Math.max(0, Math.min(1, +(o.metalK || 0))),
    envMapIntensity: 1.0,
    side: o.side || THREE.DoubleSide,
    transparent: op < 1,
    opacity: op,
    depthWrite: op >= 1,
  });
  m.defines = { AEROSKIN_SURF: o.surf ? 1 : 0 };
  if (Phys) {
    m.defines.STANDARD = ''; m.defines.PHYSICAL = '';
    m.clearcoat = Math.max(0, Math.min(1, row.cc * ccK));
    m.clearcoatRoughness = row.ccR != null ? row.ccR : 0.2;
    m.transmission = 0;
  }
  m.extensions = { derivatives: true };
  m.userData.aeroU = U;
  m.userData.aeroD = aeroDecUniforms(THREE);
  m.userData.aeroskin = 1;             // the G38 understudy must skip this
  // what the join needs to rebuild this material on the other side: which
  // finish, and which shader branch. Carried on the MATERIAL because that is
  // what the snapshot walks.
  m.userData.aeroFinish = o.finish;
  m.userData.aeroSurf = o.surf ? 1 : 0;
  // G108: the SURFACE CLASS (0 body, 1 wing, 2 tail). The snapshot walks
  // materials, so anything the flown aeroplane needs to be painted the same
  // way has to be readable from one — and without this every flown surface
  // came back class 0, which is why a marking aimed at the wing landed on
  // the fuselage and one aimed at the fuselage landed on the lot.
  m.userData.aeroWing = +o.wing || 0;
  m.userData.aeroGrm = o.struct ? (o.grm || '') : '';
  // ...and the section's own DIALLED deviations (G113). The join walks
  // materials, so anything the flown aeroplane must keep has to be readable
  // off one — without these, a dialled section reverted to its finish's own
  // numbers in the air (true for the cage too, since G105). Stamped only
  // when they deviate, so an untouched material carries nothing.
  if (o.tileK != null && o.tileK !== 1) m.userData.aeroTileK = o.tileK;
  if (o.roughK != null && o.roughK !== 1) m.userData.aeroRoughK = o.roughK;
  if (o.nrmK != null && o.nrmK !== 1) m.userData.aeroNrmK = o.nrmK;
  if (o.ribM > 0) m.userData.aeroRibM = o.ribM;
  if (o.detRot) m.userData.aeroDetRot = 1;
  // G216: the BOX-MAPPED microsurface (G113.3) is a material fact too — the
  // tail asks for it, and without a stamp it could not cross the join: the
  // flown slabs fell back to the surface field and lost the mapping the
  // editor drew them with.
  if (o.boxDet) { m.userData.aeroBoxDet = 1;
                  m.userData.aeroBoxPlane = +o.boxPlane || 0; }
  if (o.ccK != null && o.ccK !== 1) m.userData.aeroCcK = o.ccK;
  if (o.fieldK != null && o.fieldK !== 1) m.userData.aeroFieldK = o.fieldK;
  if (o.fieldLK != null && o.fieldLK !== 1) m.userData.aeroFieldLK = o.fieldLK;
  // what the lab needs to re-derive the grammar uniforms on this material
  m.userData.aeroStruct = o.struct ? 1 : 0;
  if (o.inside) m.userData.aeroInside = 1;
  if (o.decals != null && !+o.decals) m.userData.aeroNoDec = 1;
  if (o.memF) m.userData.aeroMemF = o.memF.slice();
  // THE FIELD'S OWN SCALE, REMEMBERED (G216). `aStruct` is in whatever unit
  // the layer that built it works in — the cage's is CAGE_UNIT x planeScale,
  // the wing's is metres, the tail's is its own — and `uFieldM` is what turns
  // it into metres. The join has to carry it or the flown aeroplane measures
  // its own skin in the wrong unit: on a 0.745-scale build the registration
  // sat a third of a metre forward of where it was placed, and every metric
  // pitch in the grammar was 34 % coarse. Stamped always, so the join reads
  // one number rather than inferring it from the layer.
  m.userData.aeroFieldM = o.fieldM != null ? +o.fieldM : 1;
  if (o.metalK != null && +o.metalK > 0) m.userData.aeroMetalK = +o.metalK;
  if (o.wearK != null) m.userData.aeroWearK = o.wearK;
  if (o.wearM != null && o.wearM !== 1) m.userData.aeroWearM = o.wearM;
  m.userData.env0 = m.envMapIntensity;
  // ...scaled to the mood the room is ALREADY in — see aeroSetEnv (G125.1)
  m.envMapIntensity = m.userData.env0 * AERO_ENV_F;
  m.onBeforeCompile = AEROSKIN_HOOK;
  AERO_POOL.set(key, m);
  AERO_BUILT.push(m);
  return m;
}

function aeroGlass(THREE, o) {
  // GLASS TAKES WEAR AT LAST (G113.4). G70 declared the gap in as many words
  // — "glass takes no wear" — and it has been open since. The condition dial
  // ADDS to the builder's own numbers rather than replacing them, which is
  // the only way to have both without one look answering to two masters: the
  // dials are the floor an aeroplane leaves the factory with, and the years
  // are added on top. A pane with `wearM` 0 ages at nothing, exactly as a
  // section of the airframe does.
  const wr = Math.max(0, Math.min(1, +o.wear || 0));
  const G = k => {
    const v = (o[k] != null ? +o[k] : GLASS_DEF[k]);
    // G217: the years land on the HANDLING and the grime, and on nothing
    // else — a pane that has been flown is smeared and dirty at its frame,
    // not scored. Both ADD to the builder's own number rather than
    // replacing it: the dials are the floor a pane leaves the factory with.
    if (k === 'touch') return Math.min(1, v + wr * 0.55);
    if (k === 'grime') return Math.min(1, v + wr * 0.70);
    return v;
  };
  const ext = o.ext || [0, 0, 0, 0];
  // EVERY DIAL JOINS THE KEY, or two panes with different settings silently
  // share one material — the pool is keyed on LOOK, and these are the look.
  // (Before this the key was tint and opacity alone, which was true when
  // those were the only two things a pane could differ by.)
  const key = 'glass|' + (o.tint != null ? o.tint : '') + 'L' +
              (o.tintLin != null ? o.tintLin : '') + '|' + G('opacity') +
              '|' + G('touch') + ',' + G('grime') +
              ',' + G('refl') + ',' + G('rainbow') +
              '|' + G('rough') + ',' + G('ccR') + ',' + G('fresnel') +
              ',' + G('diffuse') +
              '|' + wr.toFixed(3) +
              '|' + ext.map(v => (+v).toFixed(3)).join(',') +
              '|' + (o.fieldM != null ? o.fieldM : 1);
  const hit = AERO_POOL.get(key);
  if (hit) return hit;
  const U = {
    tDetail: { value: aeroDetailTex(THREE, 'alclad') },
    uTileM:  { value: new THREE.Vector2(0.5, 0.5) },
    uFieldM: { value: o.fieldM != null ? o.fieldM : 1 },
    uDetail: { value: new THREE.Vector2(0.14, 1) },
    uAlb:    { value: 0 },
    // G217: x the handling smear, y spare, z the edge grime, w the rainbow
    uGlass:  { value: new THREE.Vector4(G('touch'), 0,
                                        G('grime'), G('rainbow')) },
    uGlassE: { value: new THREE.Vector4(ext[0], ext[1], ext[2], ext[3]) },
    uGlassB: { value: new THREE.Vector4(G('fresnel'), G('diffuse'), 0, 0) },
  };
  const m = new THREE.MeshPhysicalMaterial({
    color: o.tintLin != null ? new THREE.Color(o.tintLin)
         : aeroLinear(THREE, o.tint != null ? o.tint : 0xaec9d8),
    // G206: the bulk is nearly a mirror and the clear layer carries the
    // ripple — two lobes with two jobs, not two copies of one highlight
    roughness: G('rough'),
    metalness: 0.0,
    // NO TRANSMISSION (2026-08-31, MEASURED — the family header's whole
    // "feed the specular" theory did not survive the game renderer). Pixel
    // bisection on the flown page: transmission 0.92 -> the pane contributes
    // ZERO pixels to the frame, with scene.environment set AND with an
    // explicit envMap forced onto the material; transmission 0, same
    // material -> the pane draws at full contribution. Whatever r128's
    // alpha-restoration line does on the bench, in the game it erases the
    // pane outright. So the slab is carried by OPACITY alone — which is the
    // recipe the shed's own windows have documented all along (hangar.js:
    // "opacity carries the slab") and the reason the clarity dial now maps
    // 1:1 onto what you see. The glint stays clearcoat + envMapIntensity.
    transmission: 0,
    transparent: true,
    opacity: o.opacity != null ? o.opacity : GLASS_DEF.opacity,
    reflectivity: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: G('ccR'),
    // THE ADD PASS (G206): ONE, ONE. The output block writes
    // diffuse * (1 - T) + specular and alpha 1; nothing here reads alpha.
    // `opacity` still carries the slab — the shader reads it as diffuseColor.a
    // — it just no longer scales the reflection.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    // THE MOOD STILL SCALES IT. aeroSetEnv multiplies every material by the
    // room's own factor off `userData.env0`, so the builder's dial has to be
    // folded into the BASE rather than written on top of it, or the two fight
    // and the last one to run wins.
    envMapIntensity: 1.4 * G('refl'),
    // FRONT SIDE ONLY: with DoubleSide transparency the far side of a curved
    // pane rendered through the near one and its limb read as a phantom
    // circle on the bubble (_cage_ui.js:231, the user's own report).
    side: THREE.FrontSide,
    depthWrite: false,
  });
  m.extensions = { derivatives: true };
  m.userData.aeroU = U;
  m.userData.aeroskin = 1;
  m.userData.aeroFinish = 'glass';
  // G216: WHAT THIS PANE IS, for the join — the six builder dials, the
  // pane's own extent and the field scale it was measured in. None of this
  // crossed before: the flown glazing was built from a colour and an opacity
  // (app.js's own call), so a scratched, dirty, tinted canopy flew clean.
  m.userData.aeroGlassD = { opacity: G('opacity'), grime: G('grime'),
                            refl: G('refl'), rainbow: G('rainbow'),
                            touch: G('touch'), wear: wr };
  m.userData.aeroGlassE = ext.slice();
  m.userData.aeroFieldM = o.fieldM != null ? +o.fieldM : 1;
  m.userData.env0 = m.envMapIntensity;
  // ...scaled to the mood the room is ALREADY in, like every material —
  // see aeroSetEnv (G125.1). A same-day exemption for glass existed for a
  // few hours while the pane's alpha still hung off the specular; with
  // transmission gone (measured out, above) the alpha is the opacity and
  // the exemption was unjustified complexity, so it went.
  m.envMapIntensity = m.userData.env0 * AERO_ENV_F;
  m.onBeforeCompile = AEROGLASS_HOOK;
  AERO_POOL.set(key, m);
  AERO_BUILT.push(m);
  return m;
}

// ---------------------------------------------------------------------------
// THE MATERIAL LAB (G206) — the tables, live
// ---------------------------------------------------------------------------
// The user: "it would be good to have an editor to these parameters (right
// now I can't access this layer)". Until G206 the builder had four per-
// section multipliers and six glazing dials; every number that decides what
// alclad or doped fabric IS — the finish rows, the grammar rows, the display
// gain, the glass base — was a constant in a table. This is the designer's
// bench over those tables.
//
// THE POSTURE: the lab edits the LIVE tables in place (AERO_FINISH,
// GEN_BUILD_GRAMMAR, GLASS_DEF, the gains) and remembers DEVIATIONS from the
// tables as written, in the person's own localStorage — never in the spec.
// A tuned set is EXPORTED as JSON and pasted back into the table, which is
// how "make it the new 1" has always landed here. The builder's per-section
// dials multiply whatever the lab says the finish is.
//
// LIVE means live: nearly every number is a uniform or a material scalar and
// is rewritten on every built material of that finish or construction (the
// pool keeps them; aeroFinishU / aeroGrammarU are the writers the factory
// itself uses). Two things need more than a write: `hs` / `bs` REBAKE the
// detail sheet, and a clear coat added to a row that had none changes the
// material CLASS, so the affected pooled materials are dropped and the next
// build makes Physical ones.
const AERO_LAB_KEY = 'flydiy.aeroLab';
// THE FIELD'S GAIN WAS INVISIBLE AT 3 (G206.3, the user: "I can't see the
// changes from ... field x"). Measured on the numbers: ply's 0.4 mm over
// 0.5 m through the multifractal's gradient is a slope of ~0.0016, and x3
// is a quarter of a degree — nothing. x12 puts ply at ~1 deg and alclad at
// ~3, which is a set panel under a reflection and not a wave. The honest
// amplitudes stay honest; the gain says how much the eye is helped, as the
// tape's does. `w*` are the wing and tail's own set.
// G217: the user's own, off the lab — the body reads quieter than the
// flying surfaces (a fuselage is stressed skin, a wing is fabric over ribs)
const AERO_GAIN_DEF = { x: 3.0, y: 1.15, z: 8.5, wx: 4.3, wy: 2.2, wz: 15.0 };
// field -> [min, max, step, label]
const AERO_LAB_FIELDS = {
  tile:  [0.005, 3.0, 0.005, 'tile (m)'],
  rough: [0.02, 1.0, 0.01, 'roughness'],
  metal: [0, 1, 0.01, 'metalness'],
  nrm:   [0, 3.0, 0.01, 'sheet normal'],
  alb:   [0, 1.5, 0.01, 'sheet albedo'],
  hs:    [0, 1.5, 0.01, 'sheet height (rebakes)'],
  bs:    [0, 2.0, 0.01, 'sheet roughness (rebakes)'],
  weave: [2, 60, 1, 'weave threads a tile (rebakes)'],
  cc:    [0, 1, 0.01, 'clear coat'],
  ccR:   [0, 1, 0.01, 'clear coat roughness'],
  fld:   [0, 0.003, 0.00005, 'field amplitude (m)'],
  fldL:  [0.1, 2.0, 0.01, 'field wavelength (m)'],
  fldR:  [0, 1, 0.01, 'field -> roughness'],
};
// dotted paths into a GEN_BUILD_GRAMMAR row
const AERO_LAB_GRAM = {
  framePitch:      [0, 1.0, 0.005, 'frame pitch (m)'],
  stringerPitch:   [0, 0.5, 0.005, 'stringer pitch (m)'],
  panelAlong:      [0, 3.0, 0.01, 'panel along (m)'],
  panelAround:     [0, 2.0, 0.01, 'panel around (m)'],
  'tape.w':        [0, 0.10, 0.001, 'tape width (m)'],
  'tape.rise':     [0, 0.002, 0.00001, 'tape rise (m)'],
  'sag.frac':      [0, 0.02, 0.0001, 'sag (frac of bay)'],
  'sag.exp':       [1, 3, 0.01, 'sag exponent'],
  dish:            [-0.003, 0.003, 0.00005, 'dish (m, - in)'],
  'seam.width':    [0, 0.05, 0.0005, 'lap width (m)'],
  'seam.step':     [0, 0.002, 0.00001, 'lap step (m)'],
  'fastener.pitch': [0.01, 0.10, 0.001, 'fastener pitch (m)'],
  'fastener.rowW': [0, 0.05, 0.0005, 'fastener row width (m)'],
  'fastener.dia':  [0.0005, 0.010, 0.0001, 'fastener head (m)'],
  'fastener.rise': [0, 0.003, 0.00005, 'fastener rise (m)'],
  partingAtWaist:  [0, 0.02, 0.0005, 'parting line (m)'],
  'rough.seam':    [0, 0.2, 0.005, 'seam roughness'],
};
const AERO_LAB_GAIN = {
  x:  [0, 8, 0.1, 'body: members & tapes x'],
  y:  [0, 4, 0.05, 'body: sag & dish x (fabric sags, alloy dishes; ply neither)'],
  z:  [0, 30, 0.5, 'body: field x'],
  wx: [0, 8, 0.1, 'wing & tail: members & tapes x'],
  wy: [0, 4, 0.05, 'wing & tail: sag x'],
  wz: [0, 30, 0.5, 'wing & tail: field x'],
  cabin: [0, 0.95, 0.01, 'cabin darkness'] };
// which shared vector a gain key writes, and which component
function aeroGainSlot(THREE, key) {
  const U = aeroSharedU(THREE);
  return key[0] === 'w' ? [U.uGainW.value, key[1]] : [U.uGain.value, key];
}
const AERO_LAB_GLASS = { rough:   [0.0, 0.5, 0.005, 'bulk roughness'],
                         ccR:     [0.0, 0.5, 0.005, 'coat roughness'],
                         fresnel: [0, 1.5, 0.01, 'limb closes (fresnel)'],
                         diffuse: [0, 1.5, 0.01, 'opaque body colour'] };
const GLASS_LAB_DEF = JSON.parse(JSON.stringify(GLASS_DEF));
// DEVIATIONS ONLY — the state that is saved and exported
const AERO_LAB = { gain: {}, finish: {}, grammar: {}, glass: {} };
let AERO_GRAM_DEF = null;
const pathGet = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const pathSet = (o, p, v) => {
  const ks = p.split('.');
  let a = o;
  for (let i = 0; i < ks.length - 1; i++) {
    if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {};
    a = a[ks[i]];
  }
  a[ks[ks.length - 1]] = v;
};
// the grammar table as written — frozen the first time it is seen, which is
// before any deviation is laid on it (aeroLabGramApply runs after this)
function aeroGramDef() {
  if (!AERO_GRAM_DEF) {
    const G = AERO_GRAMMAR();
    if (!Object.keys(G).length) return null;    // the core is not loaded yet
    AERO_GRAM_DEF = JSON.parse(JSON.stringify(G));
  }
  return AERO_GRAM_DEF;
}
let AERO_GRAM_APPLIED = false;
function aeroLabGramApply() {
  if (AERO_GRAM_APPLIED) return;
  const D = aeroGramDef();
  if (!D) return;
  const G = AERO_GRAMMAR();
  for (const c in AERO_LAB.grammar)
    if (G[c]) for (const p in AERO_LAB.grammar[c])
      pathSet(G[c], p, AERO_LAB.grammar[c][p]);
  AERO_GRAM_APPLIED = true;
}
function aeroLabGet(kind, key, field) {
  if (kind === 'gain') return AERO_LAB.gain[key] != null ? AERO_LAB.gain[key]
    : (key === 'cabin' ? AERO_CABIN_DEF : AERO_GAIN_DEF[key]);
  if (kind === 'finish') return AERO_FINISH[key] ? AERO_FINISH[key][field] : undefined;
  if (kind === 'grammar') { aeroLabGramApply();
    const G = AERO_GRAMMAR(); return G[key] ? pathGet(G[key], field) : undefined; }
  if (kind === 'glass') return GLASS_DEF[key];
  return undefined;
}
function aeroLabSave() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AERO_LAB_KEY, JSON.stringify(AERO_LAB));
  } catch (e) {}
}
function aeroLabLoad() {
  try {
    if (typeof localStorage === 'undefined') return;
    const j = JSON.parse(localStorage.getItem(AERO_LAB_KEY) || '{}');
    for (const k of ['gain', 'finish', 'grammar', 'glass'])
      if (j[k] && typeof j[k] === 'object') AERO_LAB[k] = j[k];
  } catch (e) {}
  // lay the deviations on the tables this file owns; the grammar's wait
  // for the core (aeroLabGramApply, called from aeroGrammarU)
  for (const k in AERO_LAB.finish)
    if (AERO_FINISH[k]) Object.assign(AERO_FINISH[k], AERO_LAB.finish[k]);
  for (const k in AERO_LAB.glass)
    if (k in GLASS_LAB_DEF) GLASS_DEF[k] = AERO_LAB.glass[k];
}
// THE GAINS COME BACK WITH THE PAGE (G206.3): the shared block is built
// lazily, so the saved gains are laid on it the first time it exists
function aeroLabGains(THREE) {
  const U = aeroSharedU(THREE);
  for (const k in AERO_LAB.gain) {
    if (k === 'cabin') continue;
    const [v, c] = aeroGainSlot(THREE, k);
    v[c] = AERO_LAB.gain[k];
  }
  aeroSetCabin(THREE);
  return U;
}
// write one number: the table, the deviation record, every live material
function aeroLabSet(THREE, kind, key, field, value) {
  value = +value;
  // a NaN in a shared uniform paints the aeroplane black (measured: one
  // four-argument call from a console); refuse it here, once
  if (!isFinite(value)) return;
  if (kind === 'gain') {
    const def = key === 'cabin' ? AERO_CABIN_DEF : AERO_GAIN_DEF[key];
    if (Math.abs(value - def) < 1e-9) delete AERO_LAB.gain[key];
    else AERO_LAB.gain[key] = value;
    if (key === 'cabin') aeroSetCabin(THREE);
    else { const [v, c] = aeroGainSlot(THREE, key); v[c] = value; }
  } else if (kind === 'finish') {
    const row = AERO_FINISH[key], def = AERO_FINISH_DEF[key];
    if (!row) return;
    const d = AERO_LAB.finish[key] || (AERO_LAB.finish[key] = {});
    const dv = def[field] != null ? def[field] : 0;
    if (Math.abs(value - dv) < 1e-9) delete d[field]; else d[field] = value;
    if (!Object.keys(d).length) delete AERO_LAB.finish[key];
    row[field] = value;
    aeroLabRefresh(THREE, 'finish', key, field);
  } else if (kind === 'grammar') {
    aeroLabGramApply();
    const G = AERO_GRAMMAR(), D = aeroGramDef();
    if (!G[key] || !D) return;
    const d = AERO_LAB.grammar[key] || (AERO_LAB.grammar[key] = {});
    const dv = pathGet(D[key], field);
    if (dv != null && Math.abs(value - dv) < 1e-9) delete d[field];
    else d[field] = value;
    if (!Object.keys(d).length) delete AERO_LAB.grammar[key];
    pathSet(G[key], field, value);
    aeroLabRefresh(THREE, 'grammar', key, field);
  } else if (kind === 'glass') {
    if (!(key in GLASS_LAB_DEF)) return;
    if (Math.abs(value - GLASS_LAB_DEF[key]) < 1e-9) delete AERO_LAB.glass[key];
    else AERO_LAB.glass[key] = value;
    GLASS_DEF[key] = value;
    aeroLabRefresh(THREE, 'glass', key, key);
  }
  aeroLabSave();
}
// back to the table as written: one kind + key, or everything
function aeroLabReset(THREE, kind, key) {
  const all = !kind;
  if (all || kind === 'gain') {
    AERO_LAB.gain = {};
    const U = aeroSharedU(THREE);
    U.uGain.value.set(AERO_GAIN_DEF.x, AERO_GAIN_DEF.y, AERO_GAIN_DEF.z);
    U.uGainW.value.set(AERO_GAIN_DEF.wx, AERO_GAIN_DEF.wy, AERO_GAIN_DEF.wz);
    aeroSetCabin(THREE);
  }
  if (all || kind === 'finish')
    for (const k of (all || !key) ? Object.keys(AERO_LAB.finish) : [key]) {
      delete AERO_LAB.finish[k];
      if (AERO_FINISH[k]) {
        for (const f in AERO_FINISH[k])
          if (!(f in AERO_FINISH_DEF[k])) delete AERO_FINISH[k][f];
        Object.assign(AERO_FINISH[k], AERO_FINISH_DEF[k]);
        aeroLabRefresh(THREE, 'finish', k, 'hs');
      }
    }
  if (all || kind === 'grammar') {
    aeroLabGramApply();
    const G = AERO_GRAMMAR(), D = aeroGramDef();
    for (const k of (all || !key) ? Object.keys(AERO_LAB.grammar) : [key]) {
      delete AERO_LAB.grammar[k];
      if (G[k] && D && D[k]) {
        for (const f in G[k]) delete G[k][f];
        Object.assign(G[k], JSON.parse(JSON.stringify(D[k])));
        aeroLabRefresh(THREE, 'grammar', k, '');
      }
    }
  }
  if (all || kind === 'glass') {
    AERO_LAB.glass = {};
    Object.assign(GLASS_DEF, GLASS_LAB_DEF);
    aeroLabRefresh(THREE, 'glass', '', '');
  }
  aeroLabSave();
}
function aeroLabExport() {
  return JSON.stringify(AERO_LAB, null, 2);
}
// the live materials learn the new number
function aeroLabRefresh(THREE, kind, key, field) {
  if (kind === 'finish') {
    const row = AERO_FINISH[key];
    const rebake = field === 'hs' || field === 'bs' || field === 'weave';
    if (rebake) delete AERO_TEX_CACHE[key];
    for (const m of AERO_BUILT) {
      const ud = m.userData || {};
      if (ud.aeroFinish !== key || !ud.aeroU) continue;
      aeroFinishU(THREE, m, ud.aeroU, row,
        { tileK: ud.aeroTileK, nrmK: ud.aeroNrmK, roughK: ud.aeroRoughK,
          ccK: ud.aeroCcK, fieldK: ud.aeroFieldK, fieldLK: ud.aeroFieldLK,
          metalK: ud.aeroMetalK });
      // A SWAPPED SAMPLER NEEDS A RECOMPILE (G206.3, measured): with a new
      // texture object in the uniform and nothing else changed, r128 drew
      // the fuselage BLACK and the wing white until needsUpdate — the
      // program is cached, so the recompile is a lookup, not a compile
      if (rebake) {
        ud.aeroU.tDetail.value = aeroDetailTex(THREE, key);
        m.needsUpdate = true;
      }
      // THE CLASS CHANGED: a clear coat on a row that had none (or gone from
      // one that had) — the material cannot become Physical in place, so it
      // leaves the pool and the next build makes the right one
      const wantPhys = (row.cc || 0) * (ud.aeroCcK != null ? ud.aeroCcK : 1) > 0;
      if (wantPhys !== !!m.isMeshPhysicalMaterial)
        for (const [k, v] of AERO_POOL) if (v === m) AERO_POOL.delete(k);
    }
  } else if (kind === 'grammar') {
    for (const m of AERO_BUILT) {
      const ud = m.userData || {};
      if (ud.aeroGrm !== key || !ud.aeroStruct || !ud.aeroU) continue;
      aeroGrammarU(THREE, ud.aeroU, { grm: ud.aeroGrm, struct: 1,
                                       wing: ud.aeroWing, ribM: ud.aeroRibM,
                                       memF: ud.aeroMemF });
    }
  } else if (kind === 'glass') {
    for (const m of AERO_BUILT) {
      const ud = m.userData || {};
      if (ud.aeroFinish === 'glass' && ud.aeroU) {
        m.roughness = GLASS_DEF.rough;
        m.clearcoatRoughness = GLASS_DEF.ccR;
        ud.aeroU.uGlassB.value.set(GLASS_DEF.fresnel, GLASS_DEF.diffuse, 0, 0);
      } else if (ud.aeroFinish === 'glassTint' && m.uniforms)
        m.uniforms.uFres.value = GLASS_DEF.fresnel;
    }
  }
}
aeroLabLoad();

// THE MOODS REACH THE AEROPLANE (a gap found while building this: app.js set
// envMapIntensity once at :779 and nothing ever touched it, so under DUSK the
// room dimmed and the aeroplane kept reflecting a midday probe). Same shape
// as props.js's propSetEnv, and hangar.js's setMood calls both.
// THE FACTOR IS REMEMBERED (G125.1). aeroSetEnv only runs on a mood change,
// so a material built BETWEEN moods sat at envMapIntensity 1.0 until the
// next one — measured on a rebuilt propeller blade: 1.0 against the room's
// 0.155, six times the ambient every other material got, and a dark walnut
// blade rendered washed-out tan. The factory stamps new materials with the
// CURRENT factor instead (the posture props.js always had).
function aeroSetEnv(f) {
  AERO_ENV_F = f;
  for (const m of AERO_BUILT)
    m.envMapIntensity = (m.userData.env0 || 1) * f;
}

// the pool is keyed on look, so a rebuild reuses; this is for a teardown that
// really does want the GPU memory back
function aeroDispose() {
  for (const m of AERO_BUILT) m.dispose();
  AERO_BUILT.length = 0;
  AERO_POOL.clear();
}

if (typeof window !== 'undefined')
  window.AEROSKIN = { AERO_FINISH, AERO_ROLE, AERO_BY_CONS, AERO_LINER,
                      AERO_GLASS, AERO_SKIN_ROLES, aeroFinishFor, aeroIsSkin,
                      aeroMaterial, aeroGlass,
                      aeroGlassTint, aeroGlassCompanion, GLASS_DEF,
                      aeroGlassSpec,
                      aeroIsInside, aeroCabinHook, aeroSetCabin,
                      AERO_CABIN_DEF, aeroDecOk,
                      aeroSetEnv, aeroDispose, aeroLinear, AERO_TEX,
                      aeroSetDecals, aeroSetCraft,
                      aeroDecalsFor, aeroApplySpecDecals, AERO_DEC_DEF,
                      aeroDecalText, aeroDecalImage,
                      aeroDecalImageData, aeroDecalImageFrom, aeroDecalImageClear,
                      aeroAtlas, aeroPageRect, AERO_MAXD, AERO_ATLAS_N,
                      AERO_DEC_FONTS,
                      AERO_KIT, AERO_KIT_LAYERS, AERO_KIT_PAGE0,
                      AERO_KIT_LDEF, AERO_KIT_FIELDS,
                      aeroKitKnob, aeroKitLayers, aeroKitDraw,
                      AERO_HARD, AERO_PROP_FIN, AERO_WEAR_K,
                      AERO_SEC, aeroSecResolve,
                      aeroHardFinish, aeroHardMat, aeroHardOn, aeroSetWear,
                      // THE LAB (G206)
                      AERO_LAB, AERO_LAB_FIELDS, AERO_LAB_GRAM, AERO_LAB_GAIN,
                      AERO_LAB_GLASS, AERO_FINISH_DEF, AERO_GAIN_DEF,
                      aeroGramDef, aeroLabGet, aeroLabSet, aeroLabReset,
                      aeroLabExport };
if (typeof module !== 'undefined')
  module.exports = { AERO_FINISH, AERO_ROLE, AERO_BY_CONS, AERO_LINER,
                     AERO_GLASS, AERO_SKIN_ROLES, aeroFinishFor, aeroIsSkin,
                     aeroLinear, AERO_TEX, AERO_MAXD, AERO_ATLAS_N,
                     aeroPageRect, AERO_DEC_FONTS,
                     AERO_HARD, AERO_PROP_FIN, AERO_WEAR_K, aeroHardFinish,
                     // AERO_DEC_DEF is exported to node so a gate can prove the
                     // MERGE without a canvas: `finish.decals` holds deviations,
                     // and "what does an unset field fall back to" is the half
                     // of G160 that a source regex cannot check.
                     AERO_DEC_DEF, aeroDecalMerge,
                     // and the kit's PLACEMENT half (G162) for the same
                     // reason: which page a layer owns, what its knobs resolve
                     // to and where it lands are all arithmetic, and node has
                     // no canvas to draw the other half with.
                     AERO_KIT, AERO_KIT_LAYERS, AERO_KIT_PAGE0,
                     AERO_KIT_LDEF, AERO_KIT_FIELDS,
                     aeroKitKnob, aeroKitLayers,
                     AERO_SEC, aeroSecResolve,
                     AERO_FINISH_DEF, AERO_LAB_FIELDS, AERO_LAB_GRAM,
                     AERO_GAIN_DEF, GLASS_DEF, aeroIsInside, AERO_CABIN_DEF,
                     aeroDecOk };
