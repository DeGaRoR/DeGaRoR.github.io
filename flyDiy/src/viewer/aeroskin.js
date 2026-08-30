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
const AERO_FINISH = {
  // DOPE FILLS THE WEAVE. Four coats of butyrate over Ceconite leaves a
  // surface you can only find the cloth in by looking for it — what you
  // actually see on a fabric aeroplane is the rib tapes and the sag, which
  // are the grammar's job, not the sheet's. The first cut ran 22 threads
  // across a 0.30 m tile (13 mm each, at full normal strength) and the
  // fuselage came out as basket-weave upholstery.
  fabric:    { name: 'doped fabric', base: 0xd8d4c8, tile: 0.14,
               rough: 0.66, metal: 0.0, nrm: 0.32, alb: 0.13,
               hs: 0.5, bs: 0.8, bake: 'weave' },
  ply:       { name: 'birch ply',    base: 0xc9a06a, tile: 0.35,
               rough: 0.44, metal: 0.0, nrm: 0.30, alb: 0.50,
               hs: 0.10, bs: 1.6, bake: 'grain' },
  alclad:    { name: '2024 alclad',  base: 0xd2d6da, tile: 0.70,
               rough: 0.34, metal: 0.0, nrm: 0.45, alb: 0.10,
               hs: 0.8, bs: 0.5, bake: 'sheet' },
  composite: { name: 'carbon/epoxy', base: 0x2b2e33, tile: 0.10,
               rough: 0.20, metal: 0.0, nrm: 0.30, alb: 0.22,
               hs: 0.5, bs: 1.0, bake: 'twill' },
  bareAlu:   { name: 'bare alloy',   base: 0xb6bcc3, tile: 0.45,
               rough: 0.26, metal: 0.90, nrm: 0.45, alb: 0.10,
               hs: 0.8, bs: 0.6, bake: 'sheet' },
  steelTube: { name: '4130 tube',    base: 0x6f7780, tile: 0.30,
               rough: 0.48, metal: 0.80, nrm: 0.50, alb: 0.16,
               hs: 0.9, bs: 0.8, bake: 'sheet' },
  spruce:    { name: 'spruce',       base: 0xbb9560, tile: 0.30,
               rough: 0.52, metal: 0.0, nrm: 0.30, alb: 0.55,
               hs: 0.14, bs: 1.6, bake: 'grain' },
  rubber:    { name: 'rubber',       base: 0x20222b, tile: 0.16,
               rough: 0.94, metal: 0.0, nrm: 0.55, alb: 0.20,
               hs: 0.7, bs: 0.9, bake: 'weave' },
  liner:     { name: 'cabin cloth',  base: 0x8d8578, tile: 0.16,
               rough: 0.88, metal: 0.0, nrm: 0.55, alb: 0.30,
               hs: 0.7, bs: 1.0, bake: 'weave' },
  trim:      { name: 'painted trim', base: 0xd8dde4, tile: 0.40,
               rough: 0.30, metal: 0.10, nrm: 0.25, alb: 0.08,
               hs: 0.6, bs: 0.5, bake: 'sheet' },
};

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
  joint: 'bead',
  boomTube: 'struct', tube: 'struct', woodFrame: 'struct',
  aluminium: 'struct', bulkhead: 'struct', firewall: 'struct', dash: 'panel',
  plywood: 'liner', cloth: 'liner', composite: 'liner', toele: 'liner',
};
// the interior LINERS say what they are made of in their own name — that is
// the whole point of the construction dropdown reading "composite / steel
// tube / plywood / aluminium" — so they resolve by name, not by construction
const AERO_LINER = { plywood: 'ply', cloth: 'fabric', composite: 'composite',
                     toele: 'alclad' };
const AERO_BY_CONS = {
  tubeFabric: { skin: 'fabric', rail: 'fabric', pillar: 'fabric',
                struct: 'steelTube', panel: 'trim', bead: 'trim' },
  wood:       { skin: 'ply', rail: 'ply', pillar: 'ply',
                struct: 'spruce', panel: 'trim', bead: 'trim' },
  alloy:      { skin: 'alclad', rail: 'alclad', pillar: 'alclad',
                struct: 'bareAlu', panel: 'trim', bead: 'trim' },
  carbon:     { skin: 'composite', rail: 'composite', pillar: 'composite',
                struct: 'composite', panel: 'trim', bead: 'trim' },
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
// replace them one-for-one: same packing, same names, same tile metres.
const AERO_TEX = 512;
const AERO_TEX_CACHE = {};

function aeroHeight(kind, S) {
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
        const n = 30;
        const warp = Math.abs(Math.sin(u * n));
        const weft = Math.abs(Math.sin(v * n));
        const over = Math.sin(u * n * 0.5) * Math.sin(v * n * 0.5) > 0;
        return 0.55 * (over ? warp : weft) + 0.12 * Math.sin(u * 3 + v * 2);
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
      default: {
        // Rolled sheet: NEARLY FLAT, and the discipline is to keep it that
        // way. The first cut ran 120 cycles of a 0.10-amplitude ripple across
        // the tile — one line every 6 mm at amplitude enough to see — and a
        // painted alloy fuselage came out CORRUGATED, which is precisely the
        // failure garage.js's own comment records ("the wing read as
        // corrugated iron rather than doped fabric"). Painted metal is smooth;
        // what stops it reading as plastic is a broad, very low undulation
        // and a mill grain you can only find by looking for it.
        return 0.06 * Math.sin(u * 2.0 + v * 1.3)
             + 0.03 * Math.sin(v * 3.7 - u * 1.1)
             + 0.010 * Math.sin(v * 90.0 + Math.sin(u * 5.0) * 0.7);
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
  const S = AERO_TEX;
  const H = aeroHeight(row.bake, S);
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
const AERO_MAXD = 4;
const AERO_ATLAS_N = 4;              // 4x4 pages
const AERO_ATLAS_PX = 1024;
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
function aeroDecalText(THREE, page, text, colHex, outHex) {
  const t = aeroAtlas(THREE), S = AERO_ATLAS_PX, N = AERO_ATLAS_N;
  const P = S / N, px = (page % N) * P, py = Math.floor(page / N) * P;
  const g = AERO_ATLAS_CV.getContext('2d');
  g.save();
  g.clearRect(px, py, P, P);
  g.translate(px + P / 2, py + P / 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // the same face garage.js's registration used, and the same reason: a
  // registration is a monospaced legal marking, not a logotype
  g.font = '700 96px "IBM Plex Mono", ui-monospace, monospace';
  if ('letterSpacing' in g) g.letterSpacing = '8px';
  const w = Math.max(1, g.measureText(text || '').width);
  const sc = Math.min(1, (P * 0.86) / w);
  g.scale(sc, sc);
  if (outHex != null) {
    g.lineWidth = 14; g.lineJoin = 'round';
    g.strokeStyle = '#' + (outHex >>> 0).toString(16).padStart(6, '0');
    g.strokeText(text || '', 0, 0);
  }
  g.fillStyle = '#' + ((colHex == null ? 0x1b3a5c : colHex) >>> 0)
    .toString(16).padStart(6, '0');
  g.fillText(text || '', 0, 0);
  g.restore();
  aeroDilate(g, px, py, P, P, 5);
  t.needsUpdate = true;
  return (w * sc) / (96 * sc) * 96 / (96 * 1.25);   // glyph aspect, w:h
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
  aeroDilate(g, px, py, P, P, 5);
  t.needsUpdate = true;
  return img.width / img.height;
}

// A DECAL BELONGS TO THE AEROPLANE, NOT TO A SECTION, so these uniform
// objects are SHARED BY REFERENCE across every AEROSKIN material. One write
// to aeroSetDecals updates the whole aeroplane, including materials the
// editor builds later — the same reason props.js keeps its own env record.
const AERO_SHARED = null;   // built lazily, once THREE is in hand
let AERO_DEC = null;
function aeroDecUniforms(THREE) {
  if (AERO_DEC) return AERO_DEC;
  const z4 = () => Array.from({ length: AERO_MAXD },
    () => new THREE.Vector4(0, 0, 0, 0));
  return (AERO_DEC = {
    tAtlas: { value: aeroAtlas(THREE) },
    uDecN:  { value: 0 },
    uDecA:  { value: z4() },     // xy centre (sL, sC) m, zw half-size m
    uDecB:  { value: z4() },     // atlas rect u0 v0 du dv
    uDecC:  { value: z4() },     // x rot, y roughness delta, z opacity, w target
    uInset: { value: 0.02 },
  });
}

// THE LIST IS THE STATE. Callers hand over what the aeroplane wears; this
// writes it into the shared uniforms and every material sees it at once.
//   { page, sL, sC, w, h, rot, rough, opacity, target }
//   target: 0 the fuselage, 1 the flying surfaces, 2 both
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
      d.opacity != null ? d.opacity : 1, d.target != null ? d.target : 0);
  }
}

const AERO_PARS_VS = `
attribute vec4 aStruct;
varying vec4 vSurf;
varying vec3 vObjPos;
varying vec3 vObjNrm;
`;

// beginnormal_vertex runs BEFORE begin_vertex, so objectNormal and transformed
// are both in hand here.
const AERO_MAIN_VS = `
  vSurf   = aStruct;
  vObjPos = transformed;
  vObjNrm = objectNormal;
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
#define AERO_MAXD 4
uniform sampler2D tDetail;
uniform sampler2D tFast;
uniform vec4 uG0;   // x framePitch  y stringerPitch  z panelAlong  w panelAround
uniform vec4 uG1;   // x tapeW  y tapeRise  z sagFrac  w sagExp
uniform vec4 uG2;   // x dish  y fastPitch  z fastRowW  w fastGain
uniform vec4 uG3;   // x seamW  y seamStep  z partingW  w seamRough
uniform float uGOn; // 0 = this section has no structure (trim, liners, glass)
uniform sampler2D tAtlas;
uniform int  uDecN;
uniform vec4 uDecA[AERO_MAXD];
uniform vec4 uDecB[AERO_MAXD];
uniform vec4 uDecC[AERO_MAXD];
uniform float uInset;
uniform float uSideAxis;   // which OBJECT axis is lateral: 0 x, 1 y, 2 z
uniform float uGGain; // display gain over the PHYSICAL gradient - see below
uniform vec4 uG4;   // x realRise  y realHalfW(m)  z lePolish(chord frac)  w realFast
uniform vec4 uG5;   // x sparFront(chord frac)  y sparSpan  z tipStart  w wing?
uniform vec2  uTileM;      // metres per repeat of the detail sheet
uniform float uFieldM;     // metres per unit of aStruct.xy / of object space
uniform vec2  uDetail;     // x normal scale, y roughness gain
uniform float uAlb;        // how much the detail modulates the albedo
varying vec4 vSurf;
varying vec3 vObjPos;
varying vec3 vObjNrm;

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

// THE GRAMMAR. Height GRADIENTS in metres per metre, which is what a
// tangent-space normal is, so every amplitude below is a real dimension and
// not a taste knob. Accumulated as dH and converted once at the end, because
// summing gradients is what stacking surface features actually means.
vec3 aeroStructure(vec2 m, inout float rgh) {
  if (uGOn < 0.5) return vec3(0.0, 0.0, 1.0);
  vec2 dH = vec2(0.0);
  float fw = max(fwidth(m.x) + fwidth(m.y), 1e-6);   // ~metres per pixel

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
  if (uG4.x > 0.0) {
    float mSt = clamp(fwidth(m.x) / max(fwidth(vSurf.z), 1e-5), 0.02, 4.0);
    float mLv = clamp(fwidth(m.y) / max(fwidth(vSurf.w), 1e-5), 0.02, 4.0);
    float dSt = (fract(vSurf.z + 0.5) - 0.5) * mSt;   // metres to the rib
    float dLv = (fract(vSurf.w + 0.5) - 0.5) * mLv;   // metres to the spar
    float w2 = max(uG4.y * uG4.y, 1e-8);
    dH.x += uG4.x * (-2.0 * dSt / w2) * exp(-dSt * dSt / w2);
    dH.y += uG4.x * (-2.0 * dLv / w2) * exp(-dLv * dLv / w2);
    // and the SAG between ribs, which on a fabric wing is the whole look:
    // the covering is pulled between them and the tape rides the ridge
    if (uG1.z > 0.0) {
      // amplitude is frac x the BAY (mSt metres); the chain rule then divides
      // by that same bay, because t is fract(station) and not metres. The
      // first cut multiplied by mSt again at the end, which cancelled the
      // division and left the sag ~2.7x too shallow to see.
      const float PI2 = 3.14159265;
      float t = fract(vSurf.z), sg = sin(PI2 * t);
      dH.x -= uG1.z * uG1.w * pow(max(sg, 1e-4), uG1.w - 1.0)
            * cos(PI2 * t) * PI2;
    }
    // fasteners along the real members: rib lacing, or the spar-cap rivets
    if (uG4.w > 0.0 && uG2.y > 0.0) {
      float p2 = uG2.y;
      vec4 fr = texture2D(tFast, vec2(m.y / p2, dSt / p2 + 0.5));
      float mr = 1.0 - smoothstep(uG2.z - fw, uG2.z + fw, abs(dSt));
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

  float df = aeroNear(m.x, uG0.x);      // to the nearest frame
  float ds = aeroNear(m.y, uG0.y);      // to the nearest stringer

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
    if (uG0.x > 0.0) {
      float t = fract(m.x / uG0.x), s = sin(PI * t);
      dH.x -= uG1.z * uG0.x * uG1.w * pow(max(s, 1e-4), uG1.w - 1.0)
            * cos(PI * t) * PI / uG0.x;
    }
    if (uG0.y > 0.0) {
      float t = fract(m.y / uG0.y), s = sin(PI * t);
      dH.y -= uG1.z * uG0.y * uG1.w * pow(max(s, 1e-4), uG1.w - 1.0)
            * cos(PI * t) * PI / uG0.y;
    }
  }

  // OIL-CANNING. A dish per cell, seeded on the cell so it is stable frame to
  // frame, and it DISHES IN more than it bulges — which is what an unloaded
  // metal panel actually does, and what makes metal read as metal in raking
  // light. Nothing else in this file is doing that job.
  if (abs(uG2.x) > 0.0 && uG0.x > 0.0 && uG0.y > 0.0) {
    const float PI = 3.14159265;
    vec2 cell = floor(vec2(m.x / uG0.x, m.y / uG0.y));
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float a = uG2.x * (0.55 + 0.9 * h);
    float tx = fract(m.x / uG0.x), ty = fract(m.y / uG0.y);
    dH.x += a * PI / uG0.x * cos(PI * tx) * sin(PI * ty);
    dH.y += a * PI / uG0.y * sin(PI * tx) * cos(PI * ty);
  }

  // PANEL LINES and LAPS. The boundary is a groove; on alloy it also carries
  // a step of one sheet thickness, and the lap always faces AFT so the
  // airflow cannot lift the edge. A step is a delta in the gradient, so it is
  // spread over a ramp no narrower than a pixel or it aliases into confetti.
  float dpA = aeroNear(m.x, uG0.z), dpB = aeroNear(m.y, uG0.w);
  if (uG3.x > 0.0) {
    // THE LINE IS THE SHEET EDGE, and a sheet edge is half a millimetre —
    // never the 22 mm of the lap itself. Widening the groove to the lap width
    // turned a panel line into a broad soft swell you had to be told about.
    // The lap's own width is what the STEP is spread over, below.
    float w = max(0.0006, fw * 0.8), w2 = w * w;
    float d = 0.00035;                       // groove depth, metres
    dH.x += 2.0 * d * dpA / w2 * exp(-dpA * dpA / w2);
    dH.y += 2.0 * d * dpB / w2 * exp(-dpB * dpB / w2);
    // and the LAP STEP: one sheet thickness, spread over a ramp no narrower
    // than a pixel or it aliases into confetti. It faces AFT, so the forward
    // sheet lies on top and the airflow cannot lift the edge.
    float ramp = max(uG3.x * 0.5, fw * 1.5);
    if (uG0.z > 0.0 && abs(dpA) < ramp) dH.x -= uG3.y / ramp;
    rgh += uG3.w * (exp(-dpA * dpA / w2) + exp(-dpB * dpB / w2));
  }
  // THE MOULD PARTING LINE, and it needs no pitch at all: a moulded fuselage
  // splits at the waterline, and the waist rail IS sC = 0.
  if (uG3.z > 0.0) {
    float w2 = uG3.z * uG3.z;
    dH.y += 2.0 * 0.0004 * m.y / w2 * exp(-m.y * m.y / w2);
  }

  // FASTENERS. The row is ON the member; the panel edge is a few millimetres
  // away, which is the 2D edge-distance rule showing itself for free.
  if (uG2.w > 0.0 && uG2.y > 0.0) {
    float p = uG2.y, rw = uG2.z;
    // along a stringer the row runs ALONG the body; along a frame it runs
    // AROUND the section. Same tile, two orientations.
    vec4 fs = texture2D(tFast, vec2(m.x / p, ds / p + 0.5));
    vec4 ff = texture2D(tFast, vec2(m.y / p, df / p + 0.5));
    float ms = 1.0 - smoothstep(rw - fw, rw + fw, abs(ds));
    float mf = 1.0 - smoothstep(rw - fw, rw + fw, abs(df));
    if (uG0.y <= 0.0) ms = 0.0;
    if (uG0.x <= 0.0) mf = 0.0;
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
  return normalize(vec3(-dH.x * uGGain, dH.y * uGGain, 1.0));
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
  float aeroD = 0.0;
  #if AEROSKIN_SURF == 1
    aeroD = texture2D(tDetail, (vSurf.xy * uFieldM) / uTileM).b;
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
  #if AEROSKIN_SURF == 1
  for (int di = 0; di < AERO_MAXD; ++di) {
    if (di >= uDecN) break;
    // this decal is for the fuselage, the flying surfaces, or both
    float tgt = uDecC[di].w;
    float onMe = (tgt > 1.5) ? 1.0
      : (tgt > 0.5) ? step(0.5, uG5.w) : (1.0 - step(0.5, uG5.w));
    // THE FAR FLANK READS BACKWARDS unless its along-body axis is negated —
    // G4.5's trap, arriving by a new route. sL runs aft and is NOT mirrored,
    // so the glyph is laid out in the same physical direction on both sides;
    // seen from the other side that direction runs the other way across the
    // eye. uSideAxis names which OBJECT axis is lateral (x in the cage,
    // the wing and the tail; z in the flown model frame) and the positive
    // flank is the one to mirror. Same answer G4.5 reached — "walk the far
    // arc BACKWARDS and flip nothing" - applied to a coordinate. WHICH sign
    // is measured, not derived: on this build the flank whose registration
    // reads backwards is the one at negative x, and reasoning about the
    // handedness of the cage frame got it wrong twice before the picture
    // settled it.
    float sideC = (uSideAxis < 0.5) ? vObjPos.x
                : (uSideAxis < 1.5) ? vObjPos.y : vObjPos.z;
    float sideF = (sideC < 0.0) ? -1.0 : 1.0;
    vec2 dd = vec2((aeroM.x - uDecA[di].x) * sideF, aeroM.y - uDecA[di].y);
    float cr = cos(uDecC[di].x), sr = sin(uDecC[di].x);
    dd = vec2(dd.x * cr - dd.y * sr, dd.x * sr + dd.y * cr);
    vec2 q = dd / uDecA[di].zw * 0.5 + 0.5;
    vec2 ib = step(vec2(0.0), q) * step(q, vec2(1.0));
    float w = ib.x * ib.y * uDecC[di].z * onMe;
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
    float a = tx.a * w;
    diffuseColor.rgb = mix(diffuseColor.rgb, dc, a);
    aeroDecR += a * uDecC[di].y;
  }
  #endif
  // and the leading edge is WASHED OUT, not merely polished — the other half
  // of the same feature, and the half garage.js did in its paint sheet
  // (mix toward 0xdfe3e8 at the very edge). Roughness alone reads as a
  // reflection change; the pale band is what makes it look like bare metal
  // ahead of painted fabric.
  #if AEROSKIN_SURF == 1
    if (uG4.z > 0.0 && uG5.w > 0.5)
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.90),
        (1.0 - smoothstep(0.0, uG4.z, max(vSurf.y * uFieldM, 0.0))) * 0.30);
  #endif
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
  vec2 aeroST = aeroM / uTileM;
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
#else
  vec3 aeroGN = normalize(vObjNrm) * faceDirection;
  vec3 aeroW = pow(abs(aeroGN), vec3(4.0));
  aeroW /= (aeroW.x + aeroW.y + aeroW.z);
  vec3 aeroP = vObjPos * uFieldM;
  vec2 aeroMX = vec2(aeroP.z * sign(aeroGN.x), aeroP.y) / uTileM;
  vec2 aeroMY = vec2(aeroP.x * sign(aeroGN.y), aeroP.z) / uTileM;
  vec2 aeroMZ = vec2(-aeroP.x * sign(aeroGN.z), aeroP.y) / uTileM;
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
#endif
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
    .replace('#include <normal_fragment_maps>', AERO_SURFACE_FS);
};

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
  }`)
    .replace('#include <clearcoat_normal_fragment_begin>', `
  vec3 clearcoatNormal = normal;
  {
    vec2 g = (vSurf.xy * uFieldM) / uTileM;
    vec3 T, B;
    aeroFrame(-vViewPosition, normal, g, faceDirection, T, B);
    vec3 cn = aeroUnpack(texture2D(tDetail, g), uDetail.x);
    clearcoatNormal = normalize(T * cn.x + B * cn.y + normal * cn.z);
  }`);
};

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
               o.struct ? (o.grm || '') : '', o.wing ? 'w' : '',
               'M' + (o.fieldM != null ? o.fieldM : 1),
               'S' + (o.sideAxis != null ? o.sideAxis : 0)].join('|');
  const hit = AERO_POOL.get(key);
  if (hit) return hit;
  const row = AERO_FINISH[o.finish] || AERO_FINISH.fabric;
  const op = o.opacity != null ? o.opacity : 1;
  const U = {
    tDetail:  { value: aeroDetailTex(THREE, o.finish) },
    uTileM:   { value: new THREE.Vector2(row.tile, row.tile) },
    uFieldM:  { value: o.fieldM != null ? o.fieldM : 1 },
    uDetail:  { value: new THREE.Vector2(row.nrm, 1) },
    uAlb:     { value: row.alb },
  };
  // THE GRAMMAR (G68). Only EXTERIOR SKIN carries structure: the rim beads,
  // the interior liners and frames, the trim and the glass are surfaces that
  // nothing is riveted through, and giving them frames would be exactly the
  // decorative placement this is built to avoid. `grm` names the
  // construction; `struct` says this section is skin.
  const GR = (o.struct && o.grm && AERO_GRAMMAR()[o.grm]) || null;
  const f = GR && GR.fastener;
  Object.assign(U, {
    tFast: { value: aeroFastTex(THREE, (o.grm || 'x') + (f ? f.kind : '-'),
                                GR) },
    uG0: { value: new THREE.Vector4(GR ? GR.framePitch : 0,
                                    GR ? GR.stringerPitch : 0,
                                    GR ? (GR.panelAlong || 0) : 0,
                                    GR ? (GR.panelAround || 0) : 0) },
    uG1: { value: new THREE.Vector4(GR ? GR.tape.w : 0, GR ? GR.tape.rise : 0,
                                    GR ? GR.sag.frac : 0,
                                    GR ? GR.sag.exp : 1) },
    // uG2.w is the FASTENER's own gain, and it is small on purpose: a driven
    // head is already a 1.4 mm dome on a 2.4 mm radius — a genuinely steep
    // slope — so unlike the tape it does not need the display exaggeration,
    // and at uGGain it read as a row of ball bearings.
    uG2: { value: new THREE.Vector4(GR ? (GR.dish || 0) : 0,
                                    f ? f.pitch : 0, f ? f.rowW : 0,
                                    f ? 0.35 : 0) },
    uG3: { value: new THREE.Vector4(GR && GR.seam ? GR.seam.width : 0,
                                    GR && GR.seam ? GR.seam.step : 0,
                                    GR ? (GR.partingAtWaist || 0) : 0,
                                    GR && GR.rough ? GR.rough.seam : 0) },
    uGOn: { value: GR ? 1 : 0 },
    uGGain: { value: 4.0 },
    uSideAxis: { value: o.sideAxis != null ? o.sideAxis : 0 },
    // THE WING'S MEMBERS ARE ITS OWN. On the fuselage the real rings take a
    // light extra line over the metric frames; on the wing they ARE the
    // structure, so the metric pitches are switched off entirely and the ribs
    // and spars carry it — see aeroStructure.
    uG4: { value: new THREE.Vector4(
      GR ? (o.wing ? 0.0011 : 0.0004) : 0,
      o.wing ? 0.030 : 0.016,
      o.wing ? 0.12 : 0,              // LE band, METRES aft of the edge
      (GR && f) ? (o.wing ? 0.30 : 0.0) : 0) },
    uG5: { value: new THREE.Vector4(0.15, 0.50, 0.86, o.wing ? 1 : 0) },
  });
  if (o.wing && GR) {
    // a wing has ribs and spars, not frames and stringers
    U.uG0.value.x = 0; U.uG0.value.y = 0;
    U.uG0.value.z = 0; U.uG0.value.w = 0;
  }
  // ALPHA-TESTED CUT-OUTS ARE DELIBERATELY ABSENT. r128's getDepthMaterial
  // copies neither `map` nor `alphaTest` onto the depth variants, so an
  // alpha-tested cut-out casts a SOLID shadow anyway — and a registration
  // decal is paint on an opaque panel that must cut nothing. Keeping
  // alphaTest at 0 also keeps ALPHATEST out of the program cache key and
  // early-Z alive, which is worth having under logarithmicDepthBuffer.
  const m = new THREE.MeshStandardMaterial({
    // the section's pick, or the finish's own colour. sRGB in, linear out
    // (see THE COLOUR TRAP) — and this is also what the join snapshots.
    color: o.tintLin != null ? new THREE.Color(o.tintLin)
         : aeroLinear(THREE, o.tint != null ? o.tint : row.base),
    roughness: row.rough,
    metalness: row.metal,
    envMapIntensity: 1.0,
    side: o.side || THREE.DoubleSide,
    transparent: op < 1,
    opacity: op,
    depthWrite: op >= 1,
  });
  m.defines = { AEROSKIN_SURF: o.surf ? 1 : 0 };
  m.extensions = { derivatives: true };
  m.userData.aeroU = U;
  m.userData.aeroD = aeroDecUniforms(THREE);
  m.userData.aeroskin = 1;             // the G38 understudy must skip this
  // what the join needs to rebuild this material on the other side: which
  // finish, and which shader branch. Carried on the MATERIAL because that is
  // what the snapshot walks.
  m.userData.aeroFinish = o.finish;
  m.userData.aeroSurf = o.surf ? 1 : 0;
  m.userData.aeroGrm = o.struct ? (o.grm || '') : '';
  m.userData.env0 = m.envMapIntensity;
  m.onBeforeCompile = AEROSKIN_HOOK;
  AERO_POOL.set(key, m);
  AERO_BUILT.push(m);
  return m;
}

function aeroGlass(THREE, o) {
  const key = 'glass|' + (o.tint != null ? o.tint : '') + 'L' +
              (o.tintLin != null ? o.tintLin : '') + '|' +
              (o.opacity != null ? o.opacity : 0.5);
  const hit = AERO_POOL.get(key);
  if (hit) return hit;
  const U = {
    tDetail: { value: aeroDetailTex(THREE, 'alclad') },
    uTileM:  { value: new THREE.Vector2(0.5, 0.5) },
    uFieldM: { value: o.fieldM != null ? o.fieldM : 1 },
    uDetail: { value: new THREE.Vector2(0.14, 1) },
    uAlb:    { value: 0 },
  };
  const m = new THREE.MeshPhysicalMaterial({
    color: o.tintLin != null ? new THREE.Color(o.tintLin)
         : aeroLinear(THREE, o.tint != null ? o.tint : 0xaec9d8),
    roughness: 0.045,
    metalness: 0.0,
    transmission: 0.92,
    transparent: true,
    opacity: o.opacity != null ? o.opacity : 0.5,
    reflectivity: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.4,
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
  m.userData.env0 = m.envMapIntensity;
  m.onBeforeCompile = AEROGLASS_HOOK;
  AERO_POOL.set(key, m);
  AERO_BUILT.push(m);
  return m;
}

// THE MOODS REACH THE AEROPLANE (a gap found while building this: app.js set
// envMapIntensity once at :779 and nothing ever touched it, so under DUSK the
// room dimmed and the aeroplane kept reflecting a midday probe). Same shape
// as props.js's propSetEnv, and hangar.js's setMood calls both.
function aeroSetEnv(f) {
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
                      aeroSetEnv, aeroDispose, aeroLinear, AERO_TEX,
                      aeroSetDecals, aeroDecalText, aeroDecalImage,
                      aeroAtlas, aeroPageRect, AERO_MAXD, AERO_ATLAS_N };
if (typeof module !== 'undefined')
  module.exports = { AERO_FINISH, AERO_ROLE, AERO_BY_CONS, AERO_LINER,
                     AERO_GLASS, AERO_SKIN_ROLES, aeroFinishFor, aeroIsSkin,
                     aeroLinear, AERO_TEX, AERO_MAXD, AERO_ATLAS_N,
                     aeroPageRect };
