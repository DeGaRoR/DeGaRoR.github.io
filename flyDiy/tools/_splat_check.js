#!/usr/bin/env node
// GATE SPLAT — the island's ground library and its recipe (TERRAIN FOLLOW-UP
// item 3, 2026-09-21). The alpha splatting chantier (G438, G438.1) landed
// with nothing gating it: a set dropped from RECIPE.library with a code still
// naming it, a re-bake that lost a file, a textureGrad that crept back into
// the arrays - each would have shown as a blank or a dead GPU process, in the
// game, in front of the user. This holds the recipe, the store and the
// shader's rules in node; with --gpu it boots the game and holds the sampler
// budget and the bench's compile on this machine's Chrome.
//
//   node tools/_splat_check.js              -> "GATE SPLAT: PASS|FAIL"
//   node tools/_splat_check.js --gpu        -> + the census on Jolene and the fxc probe (Chrome, ~5 min: fxc takes 160 s on the bench's shader; --wait ms for the census)
//   node tools/_splat_check.js --selftest   -> negative verification
//
// WHAT IT GUARDS
//   1. THE RECIPE'S SHAPE (src/core/28b_ground_fields.js RECIPE): every code
//      2..14 has a row; the sets it names exist in the library; scales positive
//      where a set is named; the far slots a set or null; the mask / vary
//      tuples numeric and in range; the knobs inside their ranges and the
//      split pairs ordered; the grades name library sets with a hex gain and a
//      saturation; the library's keys unique with positive metres; CODES
//      derived cleanly (period, sharp positive; bias finite; the sets the
//      row's); the code count and the library fit the shader's constants.
//   1b. THE FIELDS DO NOT REPEAT (2026-09-23, the user on four aerial shots of
//      the muskeg: "your algorithm for generating puddles ... produces results
//      which you can clearly see the repetition ... no grid pattern shows").
//      The primitive wrapped its lattice indices mod N, so every field built
//      on it was periodic: the puddles every 133 m OF GROUND, the set mask
//      every 150 m, the blotch every 1152 m - 100 % of points bit-identical
//      one tile away, in x AND in z. This holds the untiled primitive (no %
//      in either twin, and the tiled one gone rather than left beside it),
//      samples each field one old pitch away and refuses a match, and takes a
//      POND CENSUS over 2 km: coverage, ponds per km2, the median pond, and
//      that a fifth of the ground is still dry - the packs the user asked for
//      ("there should be less of them ... probably in packs").
//   1c. A MINERAL SET KEEPS ITS HUE (2026-09-23, the user on a shot of the
//      Jumbo Mine: "the rock assets have been fully colored green and they
//      look real bad ... revert at least for this texture"). normGains pulls
//      each set's mean onto the imagery's PER CHANNEL, which is right for a
//      vegetation set and a hue shift for rock, dirt, sand or snow - the
//      imagery's rock cells are forested rock. The carve-out existed and `mud`
//      was not in its list: gain 0.29/0.55/0.29 on Jolene, a green pull of
//      1.92, on the first (0.6) set of both muskeg and scrub. This measures the
//      REAL gains (the real manifest, the real island) and refuses any mineral
//      set whose gain is not one number, while requiring the vegetation sets to
//      still take the imagery's colour - a carve-out, not a retreat.
//   2. THE MANIFEST vs THE STORE (src/viewer/splat_tex.js, media/tex/splat/):
//      the manifest's order IS RECIPE.library (a set's index is its layer in
//      the arrays), its metres the library's, four files per set on disk at
//      512 (colour, normal, height, rough), a mean in 0..1 - GATE MEDIA's
//      reverse direction.
//   3. THE SHADER'S RULES, STATIC (the GLSL splat_ground.js actually splices,
//      obtained by running the module against a stub THREE): no textureGrad /
//      textureLod on the arrays (an fxc INTERNAL ERROR under ANGLE/D3D - the
//      trap that took the pane's GPU process down); the loops over the codes
//      and the candidates bound by UNIFORMS (a constant bound unrolls the
//      material chain fourteen times); the arrays declared highp; the colour
//      decoded in the shader (no sRGB array upload); no `out` parameter on the
//      sample chain (one struct through it); the roughness left for the
//      Standard ring; the fields' constants the JS's (the GLSL string embeds
//      GROUND_FIELDS.C; the JS self-check passes).
//   4. --gpu (opt-in; needs Chrome and serves this checkout itself):
//      (c) tools/sampler_census.js on Jolene - every program that carries
//      uSplat is LINKED and at or under THE RATCHET (near ring 12, outer ring
//      14, premises patch 15 - the Standard near ring's envMap + dfgLUT
//      counted, 2026-09-21); (d) the bench's fragment shader through
//      tools/_glsl_probe.html - linked, no fxc internal error.
//
// NEGATIVE-VERIFIED: --selftest breaks rules of 1, 1b, 2 and 3 in turn (1b hands
// the gate the puddle field as it was on master - tiled every 133 m, 13 % water).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERB = process.argv.includes('--verbose');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const num = v => typeof v === 'number' && Number.isFinite(v);

// THE RATCHET (tools/sampler_census.js, 2026-09-21): units per island ground program, of 16.
// Raising a number needs a census and a line here saying what joined.
const RATCHET = { near: 12, outer: 14, patch: 15, max: 16 };

// ---- the module under test, and the GLSL it splices --------------------------
function loadRecipe() { delete require.cache[require.resolve('../src/core/28b_ground_fields.js')]; return require('../src/core/28b_ground_fields.js'); }
// run splat_ground.js against a stub THREE / document / manifest and take the
// strings make() returns: the shader text the game compiles, not a regex over the file
function spliceOf(G, srcText, lib) {
  const V4 = class { constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; } set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; } };
  const THREE = {
    Vector4: V4, Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } },
    Color: class { constructor() { this.r = this.g = this.b = 1; } },
    DataArrayTexture: class { constructor() {} }, RGBAFormat: 1, UnsignedByteType: 2, RepeatWrapping: 3, LinearMipmapLinearFilter: 4, LinearFilter: 5,
  };
  const img = () => ({ complete: true, naturalWidth: 0 });
  const SETS = lib.map(([key, metres]) => ({ key, metres, px: 512, mean: [0.2, 0.2, 0.2], get diff() { return img(); }, get nor() { return img(); }, get height() { return img(); } }));
  const ctx = { GROUND_FIELDS: G, SPLAT_TEX_SETS: SETS, THREE, console, Promise, Uint8Array, Math, JSON, Object, Array,
    document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8Array(4) }) }) }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '' } };
  ctx.window = ctx;
  vm.runInNewContext(srcText, ctx, { filename: 'splat_ground.js' });
  return ctx.SPLAT_GROUND.make({}, null);
}

// ---- 1. THE RECIPE'S SHAPE ----------------------------------------------------
function checkRecipe(G, splatSrc, quiet) {
  const R = G.RECIPE, out = [];
  const say = (ok, line) => { out.push([ok, line]); return ok; };
  const LIB = new Map(R.library.map(([k, m]) => [k, m]));
  say(R.library.length === new Set(R.library.map(x => x[0])).size, `library: ${R.library.length} sets, keys unique`);
  say(R.library.every(([k, m]) => typeof k === 'string' && /^[a-zA-Z]\w*$/.test(k) && num(m) && m > 0), 'library: every row [key, metres > 0]');
  const codes = Object.keys(R.codes).map(Number).sort((a, b) => a - b);
  say(codes.length === 13 && codes[0] === 2 && codes[12] === 14 && codes.every((c, i) => c === i + 2), `codes: rows for 2..14 (${codes.join(' ')})`);
  say([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].every(c => typeof R.names[c] === 'string' && R.names[c]), 'names: 0..14 named');
  const NC = splatSrc.match(/const NCODE = (\d+), NLIB = (\d+)/);
  say(!!NC && +NC[1] > Math.max(...codes) && +NC[2] >= R.library.length, `the shader's constants hold them: NCODE ${NC && NC[1]} > ${Math.max(...codes)}, NLIB ${NC && NC[2]} >= ${R.library.length}`);
  let bad = [];
  for (const c of codes) {
    const r = R.codes[c], w = m => bad.push(`${c} ${R.names[c]}: ${m}`);
    if (!Array.isArray(r.tex) || r.tex.length !== 3) { w('tex is not a triplet'); continue; }
    if (!r.tex[0]) w('near A is empty');
    r.tex.forEach((k, j) => { if (k !== null && !LIB.has(k)) w(`near ${'ABC'[j]} '${k}' not in the library`); });
    if (!Array.isArray(r.scale) || r.scale.length !== 3 || !r.scale.every(num)) w('scale is not three numbers');
    else r.tex.forEach((k, j) => { if (k && !(r.scale[j] > 0)) w(`near ${'ABC'[j]} scale ${r.scale[j]} not positive`); });
    const far = r.far || [null, null, null], fs = r.farScale || [0, 0, 0];
    if (!Array.isArray(far) || far.length !== 3) w('far is not a triplet');
    else far.forEach((k, j) => { if (k !== null && !LIB.has(k)) w(`far ${'ABC'[j]} '${k}' not in the library`); if (k && !(fs[j] > 0)) w(`far ${'ABC'[j]} scale ${fs[j]} not positive`); });
    if (!Array.isArray(r.mix) || r.mix.length !== 4 || !r.mix.every(num)) w('mix is not four numbers');
    else { if (!(r.mix[0] >= 1 && r.mix[0] <= 400)) w(`mask cell ${r.mix[0]} outside 1..400 m`); if (!(r.mix[1] > 0 && r.mix[1] <= 8)) w(`mask sharpness ${r.mix[1]} outside 0..8`);
      if (Math.abs(r.mix[2]) > 1 || Math.abs(r.mix[3]) > 1) w('a mask bias outside -1..1'); }
    if (!Array.isArray(r.vary) || r.vary.length !== 3 || !r.vary.every(num)) w('vary is not three numbers');
    else { if (r.vary[0] < 0 || r.vary[0] > 90) w(`hue swing ${r.vary[0]} outside 0..90 deg`); if (r.vary[1] < 0 || r.vary[1] > 1) w(`value swing ${r.vary[1]} outside 0..1`); if (!(r.vary[2] > 0)) w('vary cell not positive'); }
    if (r.orient !== undefined && r.orient !== 'sea') w(`orient '${r.orient}' is not 'sea'`);
    if (r.para !== undefined && !(num(r.para) && r.para >= 0 && r.para <= 2)) w(`para ${r.para} outside 0..2`);
    if (r.wet !== undefined && !(num(r.wet) && r.wet >= 0 && r.wet <= 1)) w(`wet ${r.wet} outside 0..1`);
    if (r.poolScale !== undefined && !(num(r.poolScale) && r.poolScale > 0)) w('poolScale not positive');
  }
  say(!bad.length, `every code's row well-formed and naming library sets${bad.length ? ' - ' + bad.join('; ') : ''}`);
  const K = R.knobs, kb = [];
  const rng = (k, lo, hi) => { if (!(num(K[k]) && K[k] >= lo && K[k] <= hi)) kb.push(`${k} ${K[k]} outside ${lo}..${hi}`); };
  rng('cliffLo', 0, 89); rng('cliffHi', 0, 90); rng('oldLo', 0, 60); rng('oldHi', 0, 60); rng('denseLo', 0, 20); rng('denseHi', 0, 20);
  rng('splatWobble', 0, 100); rng('splatBlend', 0.3, 5); rng('beachRot', -360, 360); rng('triK', 0, 32);
  rng('detailFrom', 0, 20000); rng('detailTo', 0, 20000); rng('macroFrom', 0, 50000); rng('macroTo', 0, 50000); rng('macroMix', 0, 1); rng('macroNear', 0, 1); rng('macroExp', 0.1, 10);
  rng('hDepth', 0.001, 2); rng('seamDepth', 0.001, 2); rng('hexOn', 0, 1); rng('hexN', 0.1, 16); rng('hexRot', 0, 360); rng('nrmK', 0, 5); rng('specK', 0, 5); rng('sheen', 0, 1);
  rng('pudCell', 0, 1e4); rng('pudCover', 0, 1); rng('pudEdge', 0.0005, 0.2); rng('pudSlope', 0.1, 20); rng('lakeEdge', 0, 50); rng('para', 0, 1); rng('paraSteps', 1, 64);
  if (!(K.cliffLo < K.cliffHi)) kb.push('cliffLo >= cliffHi'); if (!(K.oldLo < K.oldHi)) kb.push('oldLo >= oldHi'); if (!(K.denseLo < K.denseHi)) kb.push('denseLo >= denseHi');
  if (!(K.detailFrom < K.detailTo)) kb.push('detailFrom >= detailTo'); if (!(K.macroFrom < K.macroTo)) kb.push('macroFrom >= macroTo');
  if (K.para !== 0) kb.push(`para ${K.para}: the parallax stays OFF until real displacement maps (G438.1)`);
  say(!kb.length, `knobs in range, the split pairs ordered, the parallax off${kb.length ? ' - ' + kb.join('; ') : ''}`);
  const gb = [];
  for (const k in R.grade) { const g = R.grade[k];
    if (!LIB.has(k)) gb.push(`grade '${k}' names no library set`);
    if (!(typeof g.gain === 'string' && /^#[0-9a-fA-F]{6}$/.test(g.gain))) gb.push(`grade ${k}: gain '${g.gain}' is not #rrggbb`);
    if (!(num(g.sat) && g.sat >= 0 && g.sat <= 2)) gb.push(`grade ${k}: sat ${g.sat} outside 0..2`);
    if (g.gloss !== undefined && !(num(g.gloss) && g.gloss >= 0 && g.gloss <= 1)) gb.push(`grade ${k}: gloss ${g.gloss} outside 0..1`); }
  say(!gb.length, `grades: ${Object.keys(R.grade).length} sets, a hex gain and a saturation each, a gloss in 0..1 where given${gb.length ? ' - ' + gb.join('; ') : ''}`);
  const cb = [];
  for (const c of codes) { const d = G.CODES[c], r = R.codes[c];
    if (!d) { cb.push(`${c}: no CODES row`); continue; }
    if (!(d.period > 0 && d.sharp > 0 && num(d.bias))) cb.push(`${c}: period ${d.period} sharp ${d.sharp} bias ${d.bias}`);
    if (d.sets[0] !== r.tex[0] || d.sets[1] !== r.tex[1]) cb.push(`${c}: CODES.sets is not the row's near pair`);
    if (d.name !== R.names[c]) cb.push(`${c}: name mismatch`);
    if ((r.wet !== undefined) !== (d.wet !== undefined)) cb.push(`${c}: wet not carried`); }
  say(!cb.length, `CODES derived from RECIPE cleanly (period = 6 x cell, sharp = 2 x sharpness, the near pair)${cb.length ? ' - ' + cb.join('; ') : ''}`);
  say(G.selfCheck(), 'GROUND_FIELDS.selfCheck(): the fields finite and in 0..1');
  if (!quiet) for (const [ok, line] of out) verdict(ok, line);
  return out.every(x => x[0]);
}

// ---- 2. THE MANIFEST vs THE STORE ---------------------------------------------
function parseManifest(text) {
  const re = /\{ key: '(\w+)', metres: ([\d.]+), px: (\d+), mean: \[([^\]]*)\],\s*get diff\(\) \{ return mk\('([^']+)'\); \},\s*get nor\(\) \{ return mk\('([^']+)'\); \},\s*get height\(\) \{ return mk\('([^']+)'\); \},\s*get rough\(\) \{ return mk\('([^']+)'\); \} \}/g;
  const rows = []; let m;
  while ((m = re.exec(text))) rows.push({ key: m[1], metres: +m[2], px: +m[3], mean: m[4].split(',').map(Number), files: [m[5], m[6], m[7], m[8]] });
  return rows;
}
function checkManifest(G, text, rootDir, quiet) {
  const out = []; const say = (ok, line) => { out.push([ok, line]); return ok; };
  const rows = parseManifest(text), lib = G.RECIPE.library;
  say(rows.length === lib.length && rows.every((r, i) => r.key === lib[i][0]), `the manifest's order is RECIPE.library (${rows.length} of ${lib.length} sets, in order)`);
  say(rows.every((r, i) => lib[i] && Math.abs(r.metres - lib[i][1]) < 1e-6), 'each set\'s metres are the library\'s');
  say(rows.every(r => r.px === 512), 'every set at 512');
  say(rows.every(r => r.mean.length === 3 && r.mean.every(v => num(v) && v >= 0 && v <= 1)), 'a mean colour per set, linear 0..1');
  const missing = [];
  for (const r of rows) for (const f of r.files) { if (!/^media\/tex\/splat\/\w+_(diff|nor_gl|height|rough)_512\.[0-9a-f]{8}\.jpg$/.test(f)) missing.push(f + ' (not a store path)'); else if (!fs.existsSync(path.join(rootDir, f))) missing.push(f); }
  say(!missing.length, `four files per set (colour, normal, height, rough) present under media/tex/splat/ (${rows.length * 4})${missing.length ? ' - missing ' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? ' ...' : '') : ''}`);
  say(!/data:/.test(text), 'no data: URI in the manifest');
  if (!quiet) for (const [ok, line] of out) verdict(ok, line);
  return out.every(x => x[0]);
}

// ---- 3. THE SHADER'S RULES, STATIC ---------------------------------------------
function checkShader(G, splice, quiet) {
  const out = []; const say = (ok, line) => { out.push([ok, line]); return ok; };
  const glsl = splice.glslCommon + splice.glslMap + splice.glslNormal + splice.glslRough;
  say(!/textureGrad\s*\(|textureLod\s*\(/.test(glsl), 'no textureGrad / textureLod anywhere in the splat (fxc internal error on a sampler2DArray)');
  say(/uniform highp sampler2DArray uSplat, uSplatN;/.test(glsl), 'the two arrays declared highp sampler2DArray');
  say((glsl.match(/texture\(uSplat,/g) || []).length >= 1 && (glsl.match(/texture\(uSplatN,/g) || []).length >= 1, 'the arrays read with implicit texture()');
  say(/for \(int i = 0; i < uSNCode; i\+\+\)/.test(glsl) && /for \(int j = 0; j < uSNCand; j\+\+\)/.test(glsl), 'the code and candidate loops bound by uniforms (uSNCode, uSNCand)');
  say(!/for \(int [ij] = 0; [ij] < \d+; [ij]\+\+\) \{\s*\n?\s*if \(w\[/.test(glsl), 'no constant-bound loop over the candidates');
  say(/sRGBTransferEOTF/.test(glsl), 'the colour array decoded in the shader (no sRGB array upload: GL 1281)');
  say(!/\bout\s+(Smp|vec4|vec3|float)\s+\w+\s*[,)]/.test(glsl), 'no `out` parameter on the sample chain (one struct through it)');
  say(/struct Smp \{ vec4 c; vec4 n; \};/.test(glsl), 'the one struct Smp { c, n }');
  say(/gSRough = mix\(clamp\(nrm\.a, 0\.05, 1\.0\), 1\.0, mw\);/.test(glsl) && /roughnessFactor = 1\.0 - \(1\.0 - gSRough\) \* uSNrm\.y;/.test(splice.glslRough), 'the sets\' roughness reaches roughnessFactor (the Standard ring), faded to matte at the macro range, the sheen knob its lever');
  say(!/`/.test(glsl), 'no backtick in the spliced GLSL (a backtick in a GLSL comment closes the JS template)');
  // THE STANDARD RING'S HOOK (render_world.js, 2026-09-21): the IBL's irradiance cut (the hemisphere is the
  // one ambient) and BOTH specular lobes faded out by roughness 0.9 (GGX at 1 on a dark ground measured
  // +40 % linear - a haze the world never had); the patch's twin a Lambert (15 units, not 17)
  const rw = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
  say(/islandGroundHook \? new THREE\.MeshStandardMaterial\(\{ map: tex, roughness: 1, metalness: 0 \}\) : worldLambert/.test(rw), "the island's near ring is a MeshStandardMaterial (metalness 0), the analytic ring a Lambert");
  say(/const gMatTwin = islandGroundHook \? worldLambert\(\{ map: tex \}\) : gMat;[\s\S]{0,200}innerPatchShared = \{ mat: gMatTwin/.test(rw), 'the premises patch clones a Lambert TWIN under the same hook (15 units; a Standard clone asks 17 and fails to link)');
  say(rw.includes(".replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '/*"), "the hook cuts the IBL irradiance (the hemisphere stays the world's one ambient)");
  say(rw.includes("'vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness )' + GLOSS + ';'") && rw.includes("'reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation' + GLOSS + ';'") && /const SC = THREE\.ShaderChunk, GLOSS = ' \* smoothstep\( 0\.9, 0\.6, material\.roughness \)';/.test(rw), "the hook fades both specular lobes (the probe's and the sun's) out by roughness 0.9: dry ground is the Lambert it was");
  say(rw.includes("'#include <roughnessmap_fragment>' + SPL.glslRough"), "the sets' roughness spliced after roughnessmap_fragment");
  // THE POND'S SOFTENING IS A DISTANCE TERM AND DIES AT THE EYE (2026-09-23, the user
  // at 400 m: "they look like speckles on a surface, not like puddles"). The shore is
  // widened and the wet margin opened with distance; both must be scaled by `far`, or
  // the fix for altitude quietly softens the pond you are taxiing past.
  { const pool = (glsl.match(/the pools: muskeg AND scrub[\s\S]{0,2400}/) || [''])[0];
    say(/float far = clamp\(pd \/ 500\.0, 0\.0, 1\.0\);/.test(pool), 'the pond block measures its own distance (far, 0 at the eye and 1 by 500 m)');
    say(/uSPud\.z \* \(1\.0 \+ uSPud2\.x \* far\)/.test(pool), "the shore's width rides it (pudFar)");
    say(/float rim = uSPud2\.y \* far;/.test(pool), 'the wet margin rides it too (pudRim) - nothing softens up close'); }

  // the fields: the GLSL string carries GROUND_FIELDS.C's numbers (the JS is the reference)
  const C = G.C, want = [C.pool.period.toFixed(1), C.pool.thr0.toFixed(4), C.pool.thrWet.toFixed(4), C.mix.norm.toFixed(4), C.mix.scale2.toFixed(4), C.mix.w1.toFixed(4), C.mix.w2.toFixed(4), C.shade.scaleB.toFixed(4), String(C.blotch.cells)];
  const lost = want.filter(v => !G.glsl.includes(v));
  say(!lost.length, `GROUND_FIELDS.glsl embeds the JS table's constants${lost.length ? ' - missing ' + lost.join(', ') : ''}`);
  say(glsl.includes(G.glsl), 'the splat splices GROUND_FIELDS.glsl verbatim');
  // ---- 1b. THE FIELDS DO NOT REPEAT, and the puddles are a pond census --------
  // A wrap in the primitive is a period, and a period is the grid the user saw.
  const gfSrc = fs.readFileSync(path.join(ROOT, 'src/core/28b_ground_fields.js'), 'utf8');
  const jsVn = (gfSrc.match(/function vnoise\(px, pz\) \{[\s\S]*?\n  \}/) || [''])[0];
  const glVn = (G.glsl.match(/float gfVnoise\(float px, float pz\)\{[\s\S]*?\n  \}/) || [''])[0];
  say(!!jsVn && !/%/.test(jsVn), 'the JS primitive has no lattice wrap (a % here is a period, and a period is a grid)');
  say(!!glVn && !/%/.test(glVn), 'the GLSL primitive has no lattice wrap');
  say(!/(function|float)\s+g?f?[Vv]noiseT\s*\(/.test(gfSrc + G.glsl), 'the tiled primitive is gone, not left standing beside the new one (a comment may still name it)');
  // each field, sampled a pitch away: a periodic field answers the SAME number there
  const KN = G.RECIPE.knobs;
  const poolG = (x, z) => G.poolAt((x + KN.pudCell) * KN.pudSlope, (z + KN.pudCell) * KN.pudSlope, KN.pudCover, KN.pudEdge);
  // the repeat test reads the pool with a FAT edge: at the ground's own 0.01 the
  // field is 0 or 1 almost everywhere and a sample carries no information - the
  // periodicity, if there were any, belongs to the field under the threshold
  const poolSoft = (x, z) => G.poolAt((x + KN.pudCell) * KN.pudSlope, (z + KN.pudCell) * KN.pudSlope, KN.pudCover, 0.3);
  const FIELDS = [['the puddles ', poolSoft, [133.333, 400]],
                  ['the set mask', (x, z) => G.mixK(x, z, 150, 0.52, 4), [150, 300]],
                  ['the blotch  ', (x, z) => G.blotch(x, z, 5), [1152, 2304]]];
  for (const [nm, f, pitches] of FIELDS) for (const d of pitches) {
    let same = 0, n = 0;
    for (let i = 0; i < 1500; i++) {
      const x = (i * 613.7) % 9000 - 4500, z = (i * 271.3) % 9000 - 4500, a = f(x, z);
      if (a > 0.001 && a < 0.999) { n++; if (Math.abs(a - f(x + d, z)) < 1e-9 && Math.abs(a - f(x, z + d)) < 1e-9) same++; }
    }
    say(n > 50 && same / n < 0.02, nm + ': ' + (100 * same / Math.max(n, 1)).toFixed(1) + ' % of ' + n + ' sampled points repeat ' + d + ' m away');
  }
  // THE POND CENSUS: what the eye is actually given, over 2 km on a 2 m lattice
  {
    const S = 2000, ST = 2, NN = S / ST, km2 = (S / 1000) * (S / 1000), g = new Uint8Array(NN * NN);
    let wetN = 0;
    for (let j = 0; j < NN; j++) for (let i = 0; i < NN; i++) if (poolG(-S / 2 + i * ST, -S / 2 + j * ST) > 0.5) { g[j * NN + i] = 1; wetN++; }
    const lab = new Int32Array(NN * NN).fill(-1), sizes = [], st = [];
    let ponds = 0;
    for (let q0 = 0; q0 < NN * NN; q0++) {
      if (!g[q0] || lab[q0] >= 0) continue;
      lab[q0] = ponds; st.length = 0; st.push(q0);
      let cnt = 0;
      while (st.length) {
        const p = st.pop(); cnt++;
        const px = p % NN, pz = (p - px) / NN;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const qx = px + dx, qz = pz + dz;
          if (qx < 0 || qz < 0 || qx >= NN || qz >= NN) continue;
          const q = qz * NN + qx;
          if (g[q] && lab[q] < 0) { lab[q] = ponds; st.push(q); }
        }
      }
      sizes.push(cnt * ST * ST); ponds++;
    }
    sizes.sort((a, b) => a - b);
    const cov = 100 * wetN / (NN * NN), per = ponds / km2, med = sizes[ponds >> 1] || 0;
    const B = 100, nb = NN / B, blocks = [];
    for (let bj = 0; bj < nb; bj++) for (let bi = 0; bi < nb; bi++) {
      let c = 0;
      for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) c += g[(bj * B + j) * NN + bi * B + i];
      blocks.push(c / (B * B));
    }
    const dry = 100 * blocks.filter(b => b < 0.005).length / blocks.length;
    say(cov > 2 && cov < 9, 'the muskeg is ' + cov.toFixed(1) + ' % open water (2-9 %: it was 13.3 when the user called it too many)');
    say(per > 30 && per < 200, per.toFixed(0) + ' ponds per km2 (30-200: it was 738, which reads as a dotted texture)');
    say(med >= 80, 'the median pond is ' + med + ' m2 = ' + (2 * Math.sqrt(med / Math.PI)).toFixed(1) + ' m across (>= 80 m2: it was 36, a speck)');
    say(dry > 15, dry.toFixed(0) + ' % of 200 m blocks hold no water at all (> 15 %: the packs - it was 0, an even sprinkle)');
  }
  say(splice.uniforms.uSNCode.value > 14 && splice.uniforms.uSNCand.value >= 1 && splice.uniforms.uSNCand.value <= 8, `uSNCode ${splice.uniforms.uSNCode.value}, uSNCand ${splice.uniforms.uSNCand.value} (C[8])`);
  if (!quiet) for (const [ok, line] of out) verdict(ok, line);
  return out.every(x => x[0]);
}

// ---- 1c. A MINERAL SET KEEPS ITS HUE ----------------------------------------
// (2026-09-23, the user on a shot of the Jumbo Mine: "the rock assets have been
// fully colored green and they look real bad ... revert at least for this
// texture".) normGains (splat_ground.js) pulls each set's mean onto the
// imagery's, per channel, so that the island's colour is the authority. For a
// VEGETATION set that is the point; for rock, dirt, sand or snow it is a hue
// shift, and the imagery's rock cells are forested rock. The rule existed and
// `mud` was left out of its list - measured on Jolene its gain was
// 0.29/0.55/0.29, a GREEN PULL OF 1.92, and mud is the first (0.6) set of both
// muskeg and scrub, so most of the ground between the trees was algae. This
// walks the REAL gains, with the real manifest and the real island, and refuses
// any mineral set whose gain is not neutral.
function checkMineral(quiet) {
  const out = [], say = (ok, line) => { out.push([ok, line]); return ok; };
  let W = null;
  try { W = require('./island_node.js').islandWorld('jolene'); } catch (e) { W = null; }
  if (!W) { say(true, 'the island is not on this box - the gains cannot be measured here (FLYDIY_BENCH=<path>, or media/world)');
    if (!quiet) for (const [ok, line] of out) verdict(ok, line); return true; }
  const V4c = class { constructor(x = 0, y = 0, z = 0, w = 0) { Object.assign(this, { x, y, z, w }); } set(x, y, z, w) { Object.assign(this, { x, y, z, w }); return this; } };
  const ctx = { GROUND_FIELDS: loadRecipe(), console: { log() {} }, Promise, Uint8Array, Float32Array, Math, JSON, Object, Array, Number, String, isFinite, parseFloat,
    THREE: { Vector4: V4c, Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } },
      Color: class { constructor() { this.r = this.g = this.b = 1; } }, DataArrayTexture: class { constructor() {} },
      RGBAFormat: 1, UnsignedByteType: 2, RepeatWrapping: 3, LinearMipmapLinearFilter: 4, LinearFilter: 5 },
    document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8Array(4) }) }) }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '' } };
  ctx.Image = class { constructor() { this.complete = true; this.naturalWidth = 0; } set src(v) {} get src() { return ''; } addEventListener() {} };
  ctx.window = ctx;
  const EOL = String.fromCharCode(10);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/viewer/splat_tex.js'), 'utf8') + EOL + 'this.SPLAT_TEX_SETS = SPLAT_TEX_SETS;', ctx, { filename: 'splat_tex.js' });
  if (!ctx.SPLAT_TEX_SETS) { say(false, 'the manifest did not build in the harness'); if (!quiet) for (const [ok, l] of out) verdict(ok, l); return false; }
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/viewer/splat_ground.js'), 'utf8'), ctx, { filename: 'splat_ground.js' });
  const gU = {};
  for (const k of ['uSMatA', 'uSMatS', 'uSMatM', 'uSMatF', 'uSMatFS', 'uSVary', 'uSLum', 'uSplat', 'uSplatN', 'uSDist', 'uSDist2',
                   'uSSeam', 'uSHex', 'uSPud', 'uSSplit', 'uSSplit2', 'uSNrm', 'uSNCode', 'uSNCand', 'uSNearN', 'uSFarN', 'uSplatOn', 'uSGrade', 'uSLib']) gU[k] = { value: new V4c() };
  const SP = ctx.SPLAT_GROUND.make(gU, W.island);
  const norm = (SP && SP.api) ? SP.api.norm() : {};
  say(Object.keys(norm).length > 8, `${Object.keys(norm).length} sets carry a gain from the imagery`);
  // THE LIST IS THE RULE: every surface here is rock, dirt, sand or snow and may
  // only be brightened or darkened, never recoloured. A new mineral set joins it.
  const MUST_KEEP_HUE = ['rocksA', 'rocksB', 'rocksG', 'rockyA', 'rockyB', 'cliff', 'pebble', 'beach', 'coastA', 'coastSand', 'dirt', 'mud', 'snowAir'];
  const bad = [];
  for (const k of MUST_KEEP_HUE) {
    const g = norm[k]; if (!g) continue;
    const pull = g[1] / Math.max((g[0] + g[2]) / 2, 1e-6);
    if (Math.abs(g[0] - g[1]) > 1e-6 || Math.abs(g[1] - g[2]) > 1e-6) bad.push(`${k} ${g.map(v => v.toFixed(2)).join('/')} (green pull ${pull.toFixed(2)})`);
  }
  say(!bad.length, `every mineral set takes ONE luminance gain, not a colour: ${bad.length ? bad.join(', ') : MUST_KEEP_HUE.filter(k => norm[k]).length + ' checked, all neutral'}`);
  // and the vegetation sets still DO take the imagery's colour - the rule is a
  // carve-out, not a retreat from the normalisation the user asked for
  const veg = ['forestAir', 'grass', 'grassRock', 'dry', 'lush', 'leaves'].filter(k => norm[k]);
  const coloured = veg.filter(k => { const g = norm[k]; return Math.abs(g[0] - g[1]) > 1e-6 || Math.abs(g[1] - g[2]) > 1e-6; });
  say(coloured.length >= 2, `the vegetation sets still take the imagery's colour (${coloured.length} of ${veg.length} have a per-channel gain)`);
  if (!quiet) for (const [ok, line] of out) verdict(ok, line);
  return out.every(x => x[0]);
}

// ---- 4. --gpu: the census and the fxc probe on this machine's Chrome ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
function run(cmd, args, opts) {
  return new Promise(res => { const p = spawn(cmd, args, Object.assign({ cwd: ROOT, shell: false }, opts || {})); let o = '', e = '';
    p.stdout.on('data', d => { o += d; if (VERB) process.stdout.write(d); }); p.stderr.on('data', d => { e += d; if (VERB) process.stderr.write(d); });
    p.on('close', code => res({ code, out: o, err: e })); });
}
async function checkGPU() {
  const repoRoot = path.join(ROOT, '..');
  const MAIN = 'D:/Dev/DeGaRoR.github.io';
  const isWorktree = path.resolve(repoRoot).toLowerCase() !== path.resolve(MAIN).toLowerCase();
  const port = 8600 + (process.pid % 300);
  // this checkout served over the main checkout's gitignored data (bench/, assets/) - never a junction
  const srv = spawn(process.execPath, [path.join(ROOT, 'tools', '_serve.js'), String(port), repoRoot].concat(isWorktree ? ['--fallback', MAIN] : []), { cwd: repoRoot, stdio: 'ignore' });
  await sleep(1200);
  try {
    // (c) THE CENSUS on Jolene: every program carrying uSplat linked and under the ratchet
    console.log(`4c. the census on Jolene (port ${port}, ~2 min)`);
    // the census's --wait is split before and after the roll-out: at its 40 s default the ground's
    // program was not always compiled when the scene was read (an empty census twice on a busy
    // machine, 2026-09-21) - 90 s here, and one retry on an empty census
    const WAIT = process.argv.includes('--wait') ? process.argv[process.argv.indexOf('--wait') + 1] : '90000';
    let r = null, rows = [];
    for (let attempt = 0; attempt < 2 && !rows.length; attempt++) {
      if (attempt) console.log('  (an empty census - the game had not drawn its ground yet; once more)');
      r = await run(process.execPath, [path.join(ROOT, 'tools', 'sampler_census.js'), '--port', String(port), '--all', '--wait', WAIT]);
      rows = r.out.split('\n').map(l => l.match(/^\s*(\d+)\s+(!LINK\s+)?(\S+)\s+(\S+)\s+(.*)$/)).filter(Boolean)
        .map(m => ({ n: +m[1], linked: !m[2], mesh: m[3], mat: m[4], list: m[5].trim().split(/\s+/) }));
    }
    const maxu = +((r.out.match(/MAX_TEXTURE_IMAGE_UNITS (\d+)/) || [])[1] || 0);
    const splat = rows.filter(x => x.list.includes('uSplat'));
    verdict(r.code === 0 && maxu >= 16, `the census ran (exit ${r.code}), MAX_TEXTURE_IMAGE_UNITS ${maxu}${r.code ? ' - ' + r.err.trim().split('\n').pop() : ''}`);
    verdict(splat.length >= 2, `${splat.length} island ground programs carry the splat (near ring, outer ring, the premises patch when one is in view)`);
    verdict(splat.every(x => x.linked), 'every one of them LINKED');
    // the near ring is the Standard one (dfgLUT), the patch the one with the premises' material maps, the outer ring the canopy hook's
    const kind = x => x.list.includes('dfgLUT') ? 'near' : x.list.some(u => /^uMat|^uPMat|uPrem/.test(u)) ? 'patch' : 'outer';
    for (const x of splat) { const k = kind(x); verdict(x.n <= RATCHET[k] && x.n <= maxu, `${k.padEnd(5)} ${x.n} of ${maxu} (ratchet ${RATCHET[k]}): ${x.list.join(' ')}`); }
    verdict(splat.some(x => kind(x) === 'near'), 'the near ring is the Standard one (dfgLUT bound) - the sets\' roughness has somewhere to go');
    // (d) THE FXC PROBE: the bench's fragment shader compiled and linked, no internal error
    console.log('4d. the bench\'s shader through _glsl_probe.html');
    const probe = await run(process.execPath, ['-e', `
      const { spawn } = require('child_process'); const http = require('http'); const fs = require('fs'); const path = require('path');
      const PORT = 9400 + (process.pid % 500);
      const CHROME = ['C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe', 'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
      if (!CHROME) { console.log('no chrome'); process.exit(3); }
      const udd = path.join(require('os').tmpdir(), 'cdp_splatgate_' + PORT + '_' + Date.now());
      const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
      (async () => {
        let tgt = null; for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
        const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
        let id = 0; const waits = new Map(); ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
        const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
        const ev = async expr => (await cmd('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
        await cmd('Page.enable'); await cmd('Runtime.enable');
        await cmd('Page.navigate', { url: 'http://localhost:${port}/flyDiy/tools/_glsl_probe.html?page=_island.html&variant=base' });
        let out = ''; for (let i = 0; i < 240; i++) { await sleep(500); if (await ev('document.title') === 'done') { out = await ev("document.getElementById('out').textContent"); break; } }
        console.log(out || 'TIMEOUT'); ws.close(); ch.kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} process.exit(0);
      })().catch(e => { console.log('ERR ' + e.message); ch.kill(); process.exit(1); });
    `]);
    const line = probe.out.trim().split('\n').pop() || '';
    verdict(/linked true/.test(line) && /fxcInternal false/.test(line), `the bench's shader: ${line.slice(0, 200) || 'no output (' + probe.err.trim().slice(-120) + ')'}`);
  } finally { srv.kill(); }
}

// ---- main -----------------------------------------------------------------------
(async () => {
  const G = loadRecipe();
  const splatSrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'splat_ground.js'), 'utf8');
  const manifest = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'splat_tex.js'), 'utf8');
  if (process.argv.includes('--selftest')) {
    console.log('  --selftest: breaking each rule in turn');
    const clone = () => { const g = loadRecipe(); g.RECIPE = JSON.parse(JSON.stringify(g.RECIPE)); return g; };
    let g = clone(); g.RECIPE.codes[5].tex[0] = 'granite';                   verdict(!checkRecipe(g, splatSrc, true), 'a code naming a set outside the library is caught');
    g = clone(); g.RECIPE.codes[7].scale[0] = 0;                              verdict(!checkRecipe(g, splatSrc, true), 'a zero scale under a named set is caught');
    g = clone(); g.RECIPE.codes[11].far[0] = 'nothing';                       verdict(!checkRecipe(g, splatSrc, true), 'a far slot naming no set is caught');
    g = clone(); g.RECIPE.knobs.cliffLo = 50;                                 verdict(!checkRecipe(g, splatSrc, true), 'a split pair out of order is caught');
    g = clone(); g.RECIPE.knobs.para = 0.5;                                   verdict(!checkRecipe(g, splatSrc, true), 'the parallax turned on is caught');
    g = clone(); g.RECIPE.grade.mud = { gain: 'brown', sat: 1 };              verdict(!checkRecipe(g, splatSrc, true), 'a grade gain that is not a hex is caught');
    g = clone(); g.RECIPE.library.push(['extra', 3]); for (let i = 0; i < 8; i++) g.RECIPE.library.push(['x' + i, 1]);
                                                                              verdict(!checkRecipe(g, splatSrc, true), 'a library past NLIB is caught');
    g = clone(); delete g.RECIPE.codes[9];                                    verdict(!checkRecipe(g, splatSrc, true), 'a missing code row is caught');
    verdict(!checkManifest(G, manifest.replace("key: 'rocksA'", "key: 'rocksZ'"), ROOT, true), 'a manifest out of the library\'s order is caught');
    verdict(!checkManifest(G, manifest.replace(/beach_diff_512\.[0-9a-f]{8}/, 'beach_diff_512.deadbeef'), ROOT, true), 'a manifest naming a file the store lacks is caught');
    verdict(!checkManifest(G, manifest.replace('metres: 1.25', 'metres: 2.5'), ROOT, true), 'a manifest metres off the library is caught');
    const sp = spliceOf(G, splatSrc, G.RECIPE.library);
    const brk = (a, b) => { const s2 = Object.assign({}, sp); s2.glslCommon = sp.glslCommon.replace(a, b); return s2; };
    verdict(!checkShader(G, brk('o.c = texture(uSplat, vec3(uv, layer));', 'o.c = textureGrad(uSplat, vec3(uv, layer), dFdx(uv), dFdy(uv));'), true), 'a textureGrad on the array is caught');
    verdict(!checkShader(G, brk('for (int i = 0; i < uSNCode; i++) {\n      if (w[i]', 'for (int i = 0; i < 15; i++) {\n      if (w[i]'), true), 'a constant-bound candidate loop is caught');
    verdict(!checkShader(G, brk('uniform highp sampler2DArray uSplat, uSplatN;', 'uniform sampler2DArray uSplat, uSplatN;'), true), 'an array without highp is caught');
    verdict(!checkShader(G, brk('Smp sFetch(float layer, vec2 uv, vec2 cs){', 'void sFetch2(float layer, out Smp o){ }\n  Smp sFetch(float layer, vec2 uv, vec2 cs){'), true), 'an `out` parameter on the chain is caught');
    verdict(!checkShader(G, brk('o.c.rgb = sRGBTransferEOTF(vec4(o.c.rgb, 1.0)).rgb;', ''), true), 'the colour left undecoded is caught');
    // 1b: THE FIELD AS IT WAS ON MASTER, handed back to the gate - tiled every 133 m
    // of ground and 13.3 % open water. It must be caught, or the rule is decoration.
    {
      const g2 = loadRecipe();
      const h2 = g2.hash2, OCT = [[5, 0.55, 0.0, 0.0], [11, 0.30, 0.37, 0.11], [23, 0.15, 0.71, 0.53]];
      const vT = (u, w, N) => {   // the wrapped primitive, verbatim from before 2026-09-23
        u -= Math.floor(u); w -= Math.floor(w);
        const fu = u * N, fw = w * N, iu = Math.floor(fu), iw = Math.floor(fw);
        let tu = fu - iu, tw = fw - iw; tu = tu * tu * (3 - 2 * tu); tw = tw * tw * (3 - 2 * tw);
        const i0 = iu % N, i1 = (iu + 1) % N, j0 = iw % N, j1 = (iw + 1) % N;
        const a = h2(i0, j0), b = h2(i1, j0), c = h2(i0, j1), d = h2(i1, j1);
        return (a + (b - a) * tu) + ((c + (d - c) * tu) - (a + (b - a) * tu)) * tw;
      };
      g2.poolAt = (x, z, wet, edge) => {
        const e = edge === undefined ? 0.01 : edge;
        let n = 0; for (const [N, k, du, dw] of OCT) n += k * vT(x / 400 + du, z / 400 + dw, N);
        const t = Math.max(0, Math.min(1, (n - (0.66 - 0.30 * wet - e)) / (2 * e)));
        return t * t * (3 - 2 * t);
      };
      verdict(!checkShader(g2, sp, true), 'the puddle field as it was - tiled every 133 m, 13 % open water - is caught');
    }
    verdict(checkRecipe(G, splatSrc, true) && checkManifest(G, manifest, ROOT, true) && checkShader(G, sp, true), 'the tree as it stands passes all three');
    console.log(`GATE SPLAT (selftest): ${fails ? 'FAIL' : 'PASS'}`); process.exit(fails ? 1 : 0);
  }
  console.log('1. THE RECIPE\'S SHAPE (28b_ground_fields.js RECIPE)');
  checkRecipe(G, splatSrc, false);
  console.log('1c. A MINERAL SET KEEPS ITS HUE (the gains normGains computes on the island)');
  checkMineral(false);
  console.log('2. THE MANIFEST vs THE STORE (splat_tex.js, media/tex/splat/)');
  checkManifest(G, manifest, ROOT, false);
  console.log('3. THE SHADER\'S RULES (the GLSL splat_ground.js splices)');
  let sp = null; try { sp = spliceOf(G, splatSrc, G.RECIPE.library); } catch (e) { verdict(false, 'splat_ground.js runs against the stub: ' + e.message); }
  if (sp) checkShader(G, sp, false);
  if (process.argv.includes('--gpu')) { console.log('4. --gpu: the census and the fxc probe (Chrome)'); await checkGPU(); }
  else console.log('4. (--gpu not asked: the sampler census on Jolene and the fxc probe need Chrome; node tools/_splat_check.js --gpu)');
  console.log(`GATE SPLAT: ${fails ? 'FAIL' : 'PASS'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.stack); console.log('GATE SPLAT: FAIL'); process.exit(1); });
