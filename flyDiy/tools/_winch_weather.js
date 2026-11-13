// _winch_weather.js - THE WINCH'S WEATHERING (2026-11-13, the user: "we need full weathering on that, use the plane or
// the building methods, or both"). BOTH, each for what it is best at:
//
//   FROM THE BUILDINGS (tools/_house_gen.js, src/viewer/house_tex.js)
//     * THE SCANNED SURFACES - the house library's CC0 sets, read at their own `tile` (metres a repeat): painted steel
//       (`steelgrey`), rusting steel plate (`steelrust`), rusted steel (`rust`), galvanised sheet (`galv`). The paint is
//       the house's NEUTRAL-MAP rule: the scan's luminance carries the grain, the tint carries the colour.
//     * THE SPLASH LINE - the house's DIRT_EXPR: dirt from the ground up to `dirtTop`, fading over `dirtH`, in the
//       material's own dirt colour (pale on paint, a dark tide line on bare steel).
//     * AGE - the house's uAgeDesat / uAgeDark (chroma out, value down), and its low-frequency REPETITION BREAKER.
//   FROM THE AEROPLANES (src/viewer/aeroweather.js)
//     * THE MACROS - four dials, each fine layer a clamped sum of macro x coefficient (aeroWxResolve's rule): here
//       AGE (years), USE (launches: the engine's soot, the grease, the cable's polish), FIELD (grass and mud: the
//       wheels' throw, the splash) and RAIN (drips and rust bleed down the flanks, dust washed off the tops).
//     * THE GRUNGE SHEET - aeroWxGrunge, the same baked tileable four-channel sheet (R fine mottle, G cells, B finer
//       fbm, A the large blotch), read triplanar in prop space.
//     * THE COLOURS - AERO_WX_COL (dust, dirt, mud, soot, tar, rust, grime), linear.
//     * PLACED SOURCES - an exhaust plume from the stack's mouth, mud thrown by each wheel, grease at named points (the
//       generator's userData.wx), as the plane places its plume and its wheel mud in craft space.
//     * CHIPS AT EDGES expose the SUBSTRATE (primer, then rusting steel under the paint), and the NO-SHINY-DIRT
//       invariant: roughness saturates up and metalness falls under any cover; grease is the one glossy dirt (tar).
//   THE EDGES - every part carries `aBox` (its half extents and kind) from the generator, so a chip finds the edge of
//   the box or the rim of the cylinder it is on, in the part's own frame.
//
// Browser: window.WINCH_WX (needs THREE, and aeroweather.js loaded first). apply(group, { macro, tex }) where `tex` is
// { setKey: { diff: url, rough: url } } (the bench passes media/tex/house paths; the phone page embeds them).
'use strict';
(function (root) {
const MACRO = ['age', 'use', 'field', 'rain'];
// [age, use, field, rain] - a NEGATIVE coefficient washes (rain takes the dust off the tops)
const LAYERS = [
  { k: 'dust',   label: 'dust on the tops',               c: [0.25, 0.45, 0.35, -0.40] },
  { k: 'splash', label: 'splash line from the ground',    c: [0.30, 0.25, 0.75,  0.25] },
  { k: 'mud',    label: 'mud thrown by the wheels',       c: [0.00, 0.15, 0.85,  0.05] },
  { k: 'soot',   label: 'exhaust soot',                   c: [0.15, 0.90, 0.00, -0.10] },
  { k: 'grease', label: 'grease at the drums and rollers', c: [0.20, 0.85, 0.10,  0.00] },
  { k: 'fade',   label: 'paint fade, patchy',             c: [0.90, 0.10, 0.00,  0.10] },
  { k: 'chalk',  label: 'chalking on the tops',           c: [0.70, 0.05, 0.00,  0.05] },
  { k: 'chip',   label: 'chips and wear at the edges',    c: [0.80, 0.30, 0.05,  0.00] },
  { k: 'rust',   label: 'rust on the steel',              c: [0.55, 0.00, 0.05,  0.40] },
  { k: 'streak', label: 'drips and rust bleed',           c: [0.20, 0.00, 0.10,  0.90] },
  { k: 'rough',  label: 'roughness floor',                c: [0.80, 0.20, 0.10,  0.10] },
  { k: 'polish', label: 'cable-polished rollers',         c: [0.00, 0.90, 0.00,  0.00] },
  { k: 'glass',  label: 'glass: dust film and grime',     c: [0.30, 0.40, 0.30, -0.15] },
  { k: 'age',    label: 'age tone (chroma out, value down)', c: [0.75, 0.10, 0.05, 0.10] },
];
const NL = 4;   // vec4 slots
const PRESETS = {
  'new':   { age: 0.05, use: 0.10, field: 0.10, rain: 0.05 },
  'club':  { age: 0.45, use: 0.70, field: 0.55, rain: 0.40 },
  'tired': { age: 0.95, use: 0.85, field: 0.70, rain: 0.75 },
};
// the substrate of each of the generator's bags: tex (the house set), paint (neutral-map tint), chip (0..1: paint that
// chips to primer and steel), rust (0..1: steel that rusts), dirt (the splash's own colour: 0 pale dust, 1 dark tide)
const ROLE = {
  body:   { tex: 'steelgrey', paint: 1, chip: 1.0, rust: 0.6, dirt: 0.2 },
  trim:   { tex: 'steelgrey', paint: 1, chip: 0.8, rust: 0.5, dirt: 0.3 },
  steel:  { tex: 'steelgrey', paint: 1, chip: 0.6, rust: 1.0, dirt: 0.8 },
  deck:   { tex: 'galv',      paint: 0, chip: 0.0, rust: 0.5, dirt: 0.7 },
  bright: { tex: 'galv',      paint: 0, chip: 0.0, rust: 0.3, dirt: 0.6, polish: 1 },
  red:    { tex: 'steelgrey', paint: 1, chip: 1.0, rust: 0.6, dirt: 0.3 },
  rim:    { tex: 'galv',      paint: 0, chip: 0.0, rust: 0.4, dirt: 0.6, mud: 0.6 },
  grille: { tex: null,        paint: 0, chip: 0.0, rust: 0.3, dirt: 0.8 },
  rubber: { tex: null,        paint: 0, chip: 0.0, rust: 0.0, dirt: 0.5, mud: 0.45 },
  cable:  { tex: null,        paint: 0, chip: 0.0, rust: 0.4, dirt: 0.8 },
  chute:  { tex: null,        paint: 0, chip: 0.0, rust: 0.0, dirt: 0.3 },
  glass:  { tex: null,        paint: 0, chip: 0.0, rust: 0.0, dirt: 0.2, glass: 1 },
  lamp:   { tex: null,        paint: 0, chip: 0.0, rust: 0.0, dirt: 0.3 },
  amber:  { tex: null,        paint: 0, chip: 0.0, rust: 0.0, dirt: 0.3 },
};
const SETS = {   // the house library's tiles (src/viewer/house_tex.js), metres a repeat
  steelgrey: { tile: 2.0 }, steelrust: { tile: 2.0 }, rust: { tile: 1.8 }, galv: { tile: 1.0 },
};
const TEX_REPO = {   // the bench's paths (the phone page swaps these for data: URIs)
  steelgrey: { diff: 'media/tex/house/steelgrey_diff_512.3f023e20.jpg', rough: 'media/tex/house/steelgrey_rough_512.6f4a241b.jpg' },
  steelrust: { diff: 'media/tex/house/steelrust_diff_512.9e81baee.jpg', rough: 'media/tex/house/steelrust_rough_512.bd2b7526.jpg' },
  rust:      { diff: 'media/tex/house/rust_diff_512.5658a31a.jpg',      rough: 'media/tex/house/rust_rough_512.ec911b97.jpg' },
  galv:      { diff: 'media/tex/house/galv_diff_256.3f02ba2a.jpg',      rough: 'media/tex/house/galv_rough_256.19f4bffe.jpg' },
};

const clamp01 = v => Math.max(0, Math.min(1, +v || 0));
function resolve(macro, pin) {
  const m = macro || {}, p = pin || {}, out = new Float32Array(NL * 4);
  LAYERS.forEach((L, i) => {
    let v = 0; for (let g = 0; g < 4; g++) v += clamp01(m[MACRO[g]]) * L.c[g];
    out[i] = p[L.k] != null ? clamp01(p[L.k]) : Math.max(0, Math.min(1, v));
  });
  return out;
}

// ---- the GLSL (no backticks, no ${ - the aeroweather rule; every number a uniform or a constant) ----
const VS_HEAD = [
  'attribute vec4 aBox;',
  'uniform mat4 uWxInv;',
  'varying vec3 vWxP; varying vec3 vWxN; varying vec3 vWxL; varying vec4 vWxB;',
].join('\n');
const VS_BODY = [
  '  vWxP = (uWxInv * modelMatrix * vec4(transformed, 1.0)).xyz;',
  '  vWxN = normalize(mat3(uWxInv * modelMatrix) * objectNormal);',
  '  vWxL = transformed; vWxB = aBox;',
].join('\n');
const FS_HEAD = [
  'varying vec3 vWxP; varying vec3 vWxN; varying vec3 vWxL; varying vec4 vWxB;',
  'uniform vec4 uWxL[4];',            // the resolved layers
  'uniform vec4 uWxC[8];',            // AERO_WX_COL: dust dirt mud soot bug tar rust grime (linear rgb, roughness)
  'uniform sampler2D tWxG;',          // the grunge sheet
  'uniform vec4 uWxG;',               // x fine tile m, y coarse tile m, z streak across m, w streak along m
  'uniform vec4 uWxE;',               // the exhaust's mouth (xyz), w on
  'uniform vec4 uWxW[4];',            // wheels: contact centre xyz, w R
  'uniform vec4 uWxGr[8];',           // grease: xyz, w radius (0: none)
  'uniform vec4 uWxH;',               // x deck y, y splash top, z splash height, w the wind's drift (-z) per metre up
  'uniform sampler2D tWxD; uniform sampler2D tWxR;',   // the substrate's scan (diff, rough)
  'uniform sampler2D tWxRD; uniform sampler2D tWxRR;', // the rust under it (steelrust)
  'uniform vec4 uWxS;',               // x tex on, y tile m, z paint, w chip
  'uniform vec4 uWxS2;',
  'uniform vec4 uWxK;',               // x the mud's share on this substrate (a tyre sheds most of it)              // x rust, y splash dark, z polish, w glass
  'float wxL(int i) { int s = i / 4; int c = i - s * 4; vec4 v = uWxL[0];',
  '  if (s == 1) v = uWxL[1]; else if (s == 2) v = uWxL[2]; else if (s == 3) v = uWxL[3];',
  '  return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w; }',
  'vec3 wxW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / max(1e-4, w.x + w.y + w.z); }',
  'vec4 wxTri(sampler2D t, vec3 p, vec3 w, float tile) {',
  '  return texture2D(t, p.zy / tile) * w.x + texture2D(t, p.xz / tile) * w.y + texture2D(t, p.xy / tile) * w.z; }',
  'float wxLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
  // the edge: a box's second-nearest face, a cylinder's rim (the part's own frame)
  'float wxEdge() {',
  '  vec3 h = vWxB.xyz, a = abs(vWxL);',
  '  if (vWxB.w > 1.5 && vWxB.w < 2.5) { vec3 d = max(h - a, 0.0);',
  '    return d.x + d.y + d.z - min(d.x, min(d.y, d.z)) - max(d.x, max(d.y, d.z)); }',
  '  if (vWxB.w > 2.5) { float dr = max(0.0, h.x - length(vWxL.xz)); float dy = max(0.0, h.y - a.y); return max(dr, dy); }',
  '  return 1.0; }',
].join('\n');
// after <map_fragment>: the substrate, then every albedo layer; the masks stay in scope for the roughness and metal
const FS_MAP = [
  '  vec3 wN = normalize(vWxN), wW = wxW(wN), wP = vWxP;',
  '  vec4 gF = wxTri(tWxG, wP, wW, uWxG.x), gC = wxTri(tWxG, wP, wW, uWxG.y);',
  '  float up = wN.y, vert = 1.0 - abs(wN.y);',
  '  float wRough = 0.0, wMetal = 1.0, wCover = 0.0, wGrease = 0.0, wPolish = 0.0, wBare = 0.0;',
  '  vec3 base = diffuseColor.rgb;',
  // THE SCAN (the building method): paint takes the neutral luminance as grain; bare metal takes the scan itself
  '  if (uWxS.x > 0.5) {',
  '    vec4 sd = wxTri(tWxD, wP, wW, uWxS.y); vec4 sr = wxTri(tWxR, wP, wW, uWxS.y);',
  '    float lu = wxLum(sd.rgb);',
  '    base = uWxS.z > 0.5 ? base * (0.62 + 0.75 * lu) : base * sd.rgb * 2.2;',
  '    wRough = sr.g - 0.5;',
  '  }',
  // the house's repetition breaker: a slow field that does not tile with the scan
  '  base *= 0.92 + 0.16 * gC.a;',
  // FADE and CHALK (paint): the plane's, patchy on the large blotch, chalk on the tops
  '  if (uWxS.z > 0.5) {',
  '    float fd = wxL(5) * smoothstep(0.25, 0.85, gC.a);',
  '    base = mix(base, mix(vec3(wxLum(base)), base, 0.6) * 1.12 + 0.01, 0.30 * fd);   // sun-bleached: lighter, less chroma, never grey',
  '    float ck = wxL(6) * smoothstep(0.2, 0.9, up) * (0.6 + 0.4 * gF.b);',
  '    base = mix(base, vec3(0.42, 0.41, 0.39), 0.30 * ck);',
  '  }',
  // CHIPS (the plane's): at the edges and a few in the field; paint shows a primer ring, then the steel under it
  '  float edge = wxEdge();',
  '  float chipE = 1.0 - smoothstep(0.002, 0.008 + 0.03 * wxL(7) * wxL(7), edge);',
  '  float chipN = smoothstep(0.62 - 0.32 * wxL(7), 0.70 - 0.32 * wxL(7), gF.r * 0.6 + gF.b * 0.4);',
  '  float chipF = step(1.0 - 0.10 * wxL(7), gF.g);',
  '  float chip = uWxS.w * clamp(chipE * chipN * 1.4 + chipF * 0.8, 0.0, 1.0) * step(0.01, wxL(7));',
  '  vec3 rustC = wxTri(tWxRD, wP, wW, 2.0).rgb;',
  '  if (chip > 0.0) {',
  '    float core = smoothstep(0.35, 0.8, chip);',
  '    base = mix(base, vec3(0.30, 0.30, 0.29), chip);',                         // the primer's grey
  '    base = mix(base, mix(vec3(0.16, 0.16, 0.17), rustC, 0.55 + 0.45 * uWxS2.x), core);',   // the steel, rusting
  '    wBare = core;',
  '  }',
  // RUST (the steel's own): low on the part, along its lower edges, in the cells; the steelrust scan
  '  float lowP = 1.0 - smoothstep(uWxH.x - 0.2, uWxH.x + 0.6, wP.y);',
  '  float rustM = uWxS2.x * wxL(8) * clamp((0.2 + 0.8 * lowP) * smoothstep(0.5 - 0.25 * wxL(8), 0.85, gF.r * 0.45 + gC.a * 0.55) * 1.3',
  '                 + chip * 0.8 + (1.0 - smoothstep(0.0, 0.05, edge)) * 0.5 * step(-0.2, -up), 0.0, 1.0);',
  '  base = mix(base, rustC * 1.05, rustM * 0.85);',
  '  wBare = max(wBare, rustM);',
  // STREAKS (the plane's drips, the rain): long and thin down the vertical faces, rust-bled under steel
  '  vec2 sq = vec2(dot(wP.xz, normalize(vec2(abs(wN.z) + 1e-3, abs(wN.x) + 1e-3))) / uWxG.z, wP.y / uWxG.w);',
  '  float strk = texture2D(tWxG, vec2(sq.x, sq.y * 0.12)).b;',
  '  float streak = wxL(9) * vert * smoothstep(0.55, 0.8, strk) * (0.5 + 0.5 * gC.a);',
  '  base = mix(base, mix(base * 0.55 + uWxC[7].rgb, uWxC[6].rgb * 1.6, uWxS2.x * 0.7), streak * 0.45);',
  // THE AGE TONE (the house's): chroma out, value down
  '  float ag = wxL(13); base = mix(base, vec3(wxLum(base)), 0.14 * ag) * (1.0 - 0.14 * ag);',
  // DUST on the tops (the plane's)
  '  float dust = wxL(0) * smoothstep(0.30, 0.90, up) * (0.45 + 0.55 * gF.r) * (0.55 + 0.6 * gC.a);',
  '  base = mix(base, uWxC[0].rgb * 2.6, clamp(dust, 0.0, 0.85)); wCover = max(wCover, dust);',
  // THE SPLASH LINE (the house's DIRT_EXPR): from the ground up, pale on paint, a dark tide line on steel
  '  float spl = wxL(1) * clamp((uWxH.y - wP.y) / max(0.01, uWxH.z), 0.0, 1.0);',
  '  spl *= (0.55 + 0.45 * vert) * (0.5 + 0.7 * gF.b);',
  '  base = mix(base, mix(uWxC[1].rgb * 2.4, uWxC[2].rgb * 1.6, uWxS2.y), clamp(spl, 0.0, 0.9)); wCover = max(wCover, spl);',
  // MUD thrown by the wheels (the plane's): around each tyre, up its arch, on the undersides near it
  '  float mud = 0.0;',
  '  for (int i = 0; i < 4; i++) { vec4 w = uWxW[i]; float d = length(wP - w.xyz);',
  '    float under = 0.6 + 0.6 * smoothstep(0.0, -0.6, wN.y);',
  '    mud = max(mud, (1.0 - smoothstep(w.w * 0.7, w.w * 2.8, d)) * under); }',
  '  mud = wxL(2) * uWxK.x * mud * smoothstep(0.30, 0.65, gF.g * 0.5 + gF.r * 0.5 + 0.15);',
  '  base = mix(base, uWxC[2].rgb * 1.5, clamp(mud, 0.0, 0.95)); wCover = max(wCover, mud);',
  // SOOT from the stack (the plane's plume): a ring at the mouth, then the plume rising and drifting with the wind
  '  float soot = 0.0;',
  '  if (uWxE.w > 0.5) {',
  '    vec3 r = wP - uWxE.xyz; float t = max(0.0, r.y + 0.3);',
  '    vec2 off = vec2(r.x, r.z + uWxH.w * t);',
  '    float ring = 1.0 - smoothstep(0.03, 0.22, length(r));',
  '    float plume = exp(-dot(off, off) / pow(0.35 + 0.35 * t, 2.0)) * (1.0 - smoothstep(0.5, 3.0, t)) * smoothstep(-0.6, -0.1, r.y);',
  '    soot = clamp(ring + plume * (0.4 + 0.6 * smoothstep(-0.2, 0.6, dot(wN, normalize(vec3(-r.x, 0.6, -r.z + 0.01))))), 0.0, 1.0);',
  '    soot *= wxL(3) * (0.6 + 0.5 * gF.r);',
  '  }',
  '  base = mix(base, uWxC[3].rgb * 1.2, clamp(soot, 0.0, 0.92)); wCover = max(wCover, soot);',
  // GREASE (the tar: the one glossy dirt) at the drums, the rollers, the gearbox, the hitch - and a drip under each
  '  for (int i = 0; i < 8; i++) { vec4 g = uWxGr[i]; if (g.w <= 0.0) continue;',
  '    vec3 r = wP - g.xyz; float d = length(r);',
  '    float spot = 1.0 - smoothstep(g.w * 0.35, g.w, d);',
  '    float drip = (1.0 - smoothstep(g.w * 0.25, g.w * 0.6, length(r.xz))) * smoothstep(0.0, -0.05, r.y) * (1.0 - smoothstep(0.0, 0.7, -r.y)) * vert;',
  '    wGrease = max(wGrease, max(spot, drip * 0.8)); }',
  '  wGrease = wxL(4) * wGrease * smoothstep(0.35, 0.7, gF.r * 0.7 + gF.g * 0.6);',
  '  base = mix(base, uWxC[5].rgb * 1.3, clamp(wGrease, 0.0, 0.9));',
  // POLISH: the cable keeps the rollers bright
  '  wPolish = uWxS2.z * wxL(11) * (1.0 - smoothstep(0.0, 0.6, length(wP.xz - vec2(0.0, -2.8)) - 0.6));',
  '  base = mix(base, vec3(0.62, 0.63, 0.64), wPolish * 0.6);',
  // GLASS: a dust film and grime at the frame (the plane's gDust, gEdge)
  '  if (uWxS2.w > 0.5) {',
  '    float film = wxL(12) * (0.35 + 0.5 * gC.a) + wxL(12) * (1.0 - smoothstep(0.0, 0.12, edge)) * 0.8;',
  '    base = mix(base, uWxC[0].rgb * 3.0, clamp(film, 0.0, 0.7)); diffuseColor.a = max(diffuseColor.a, clamp(film, 0.0, 0.85));',
  '  }',
  '  diffuseColor.rgb = base;',
].join('\n');
// after <roughnessmap_fragment> and <metalnessmap_fragment>: THE INVARIANTS - no shiny dirt; bare steel is not paint
const FS_ROUGH = [
  '  roughnessFactor = clamp(roughnessFactor + wRough * 0.5 + 0.35 * wxL(10), 0.04, 1.0);',
  '  roughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.85), wBare);',
  '  roughnessFactor = max(roughnessFactor, mix(roughnessFactor, 0.92, clamp(wCover * 1.3, 0.0, 1.0)));',
  '  roughnessFactor = mix(roughnessFactor, 0.32, clamp(wGrease, 0.0, 1.0));',
  '  roughnessFactor = mix(roughnessFactor, 0.22, wPolish);',
].join('\n');
const FS_METAL = [
  '  metalnessFactor *= 1.0 - clamp(wCover * 1.3 + wBare * 0.7, 0.0, 1.0);',
  '  metalnessFactor = mix(metalnessFactor, 0.85, wPolish);',
].join('\n');

let GTEX = null;
function grungeTex(T) {
  if (GTEX) return GTEX;
  const AW = root.AEROWX || null;   // (the game exposes aeroweather.js as window.AEROWX; a bench page has its globals)
  const S = 256, data = AW && AW.aeroWxGrunge ? AW.aeroWxGrunge(S) : root.aeroWxGrunge ? root.aeroWxGrunge(S) : (typeof aeroWxGrunge === 'function' ? aeroWxGrunge(S) : null);
  if (!data) throw new Error('_winch_weather: load src/viewer/aeroweather.js first (aeroWxGrunge)');
  const t = new T.DataTexture(data, S, S, T.RGBAFormat);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return (GTEX = t);
}
const TEXC = new Map();
function texOf(T, url, srgb) {
  if (!url || typeof document === 'undefined') return null;   // (node - a gate's scene: no images; the substrate reads the grunge)
  if (TEXC.has(url)) return TEXC.get(url);
  const t = new T.TextureLoader().load(url, () => { if (WX.onLoad) WX.onLoad(); });
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
  if (srgb) { if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; else t.encoding = T.sRGBEncoding; }
  TEXC.set(url, t); return t;
}
const COLS = () => {
  const C = (root.AEROWX && root.AEROWX.AERO_WX_COL) || root.AERO_WX_COL || (typeof AERO_WX_COL !== 'undefined' ? AERO_WX_COL : null);
  if (!C) throw new Error('_winch_weather: load src/viewer/aeroweather.js first (AERO_WX_COL)');
  return C;
};

// ONE shared block (the layers, the placements, the colours) - a dial moves every material with no recompile
function sharedU(T) {
  if (WX.U) return WX.U;
  const v4 = n => Array.from({ length: n }, () => new T.Vector4());
  WX.U = {
    uWxInv: { value: new T.Matrix4() }, uWxL: { value: v4(NL) },
    uWxC: { value: COLS().map(c => new T.Vector4(c.v[0], c.v[1], c.v[2], c.v[3])) },
    tWxG: { value: grungeTex(T) }, uWxG: { value: new T.Vector4(0.35, 2.4, 0.22, 2.6) },
    uWxE: { value: new T.Vector4() }, uWxW: { value: v4(4) }, uWxGr: { value: v4(8) },
    uWxH: { value: new T.Vector4(0.8, 0.9, 0.9, 0.55) },
  };
  return WX.U;
}
function setMacro(macro, pin) {
  const U = WX.U; if (!U) return;
  const L = resolve(macro, pin);
  for (let i = 0; i < NL; i++) U.uWxL.value[i].set(L[i * 4], L[i * 4 + 1], L[i * 4 + 2], L[i * 4 + 3]);
  WX.macro = Object.assign({}, macro);
}
// the weathering onto a built winch: its materials hooked once each, the placements from its userData.wx
function apply(group, o) {
  const T = root.THREE || THREE; o = o || {};
  const U = sharedU(T), wx = (group.userData && group.userData.wx) || {};
  group.updateMatrixWorld(true);
  U.uWxInv.value.copy(group.matrixWorld).invert();
  if (wx.exhaust) U.uWxE.value.set(wx.exhaust[0], wx.exhaust[1], wx.exhaust[2], 1); else U.uWxE.value.set(0, 0, 0, 0);
  (wx.wheels || []).slice(0, 4).forEach((w, i) => U.uWxW.value[i].set(w[0], w[1], w[2], w[3]));
  for (let i = 0; i < 8; i++) { const g = (wx.grease || [])[i]; if (g) U.uWxGr.value[i].set(g[0], g[1], g[2], g[3]); else U.uWxGr.value[i].set(0, -99, 0, 0); }
  U.uWxH.value.set(wx.deckY || 0.8, 0.9, 0.9, 0.55);
  setMacro(o.macro || WX.macro || PRESETS.club, o.pin);
  const tex = o.tex || WX.tex || TEX_REPO, base = o.base || '';
  const seen = new Set();
  group.traverse(m => {
    if (!m.isMesh || !m.material || seen.has(m.material)) return;
    const mat = m.material; seen.add(mat);
    const R = ROLE[mat.userData.wxRole]; if (!R || !mat.isMeshStandardMaterial) return;
    const set = R.tex && tex[R.tex], rset = tex.steelrust;
    const PU = {
      tWxD: { value: (set && texOf(T, base + set.diff, true)) || U.tWxG.value },
      tWxR: { value: (set && texOf(T, base + set.rough, false)) || U.tWxG.value },
      tWxRD: { value: (rset && texOf(T, base + rset.diff, true)) || U.tWxG.value },
      tWxRR: { value: (rset && texOf(T, base + rset.rough, false)) || U.tWxG.value },
      uWxS: { value: new T.Vector4(set ? 1 : 0, set ? SETS[R.tex].tile : 1, R.paint || 0, R.chip || 0) },
      uWxS2: { value: new T.Vector4(R.rust || 0, R.dirt || 0, R.polish || 0, R.glass || 0) },
      uWxK: { value: new T.Vector4(R.mud == null ? 1 : R.mud, 0, 0, 0) },
    };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U, PU);
      sh.vertexShader = VS_HEAD + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VS_BODY);
      sh.fragmentShader = FS_HEAD + '\n' + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + FS_MAP)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FS_ROUGH)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + FS_METAL);
    };
    mat.customProgramCacheKey = () => 'winchwx1';
    mat.needsUpdate = true;
  });
  return group;
}

const WX = { MACRO, LAYERS, PRESETS, ROLE, SETS, TEX_REPO, resolve, apply, setMacro, macro: null, U: null, tex: null, onLoad: null };
root.WINCH_WX = WX;
if (typeof module !== 'undefined' && module.exports) module.exports = WX;
})(typeof window !== 'undefined' ? window : globalThis);
